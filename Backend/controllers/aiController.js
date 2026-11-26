const AIConfig = require("../models/aiConfigModel");
const {
  AI_PROVIDERS_CATALOG,
  getAllEnvProvidersSummary,
  getEnvKeyForProvider,
} = require("../config/aiCatalog");
const { encryptSecret, decryptSecret } = require("../utils/cryptoVault");
const { queryAI, testRawAIKey } = require("../services/aiService");
const { enqueueWebSocketEvent } = require("../services/queue");

const sanitizeKeysArray = (cfg) => {
  if (!cfg || !Array.isArray(cfg.keys)) return [];
  const activeId = cfg.activeKeyId ? String(cfg.activeKeyId) : null;
  return cfg.keys.map((k) => ({
    _id: k._id,
    label: k.label,
    maskedKey: k.maskedKey,
    isActive: activeId ? String(k._id) === activeId : false,
    lastTestedAt: k.lastTestedAt || null,
    lastTestResult: k.lastTestResult || null,
    createdAt: k.createdAt,
  }));
};

const canManageConfig = (cfg, user) => {
  if (!cfg || !user) return false;
  if (cfg.scope === "global") {
    return Boolean(
      user.isSuperAdmin ||
        (Array.isArray(user.permissions) &&
          (user.permissions.includes("*") || user.permissions.includes("ai.manage")))
    );
  }
  return String(cfg.owner) === String(user._id);
};

// 1. Task Breakdown Assistant (Global Task using active Vault or .env provider)
exports.generateTaskBreakdown = async (req, res) => {
  try {
    const { title, description, provider, model } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    const prompt = `You are an agile software engineering and office operations lead.
Analyze this task:
Title: "${title}"
Description: "${description || "None provided"}"

Provide a JSON response with:
1. "description": A concise, clear 2-3 sentence markdown description of the work and acceptance criteria.
2. "subtasks": An array of 3 to 6 concise, actionable checklist steps (strings).
3. "priority": One of "low", "medium", "high", "urgent".
4. "estimatedHours": A realistic number of hours (e.g. 2, 4, 8, 16).
5. "type": One of "task", "bug", "client_request", "approval".

Reply ONLY with valid raw JSON, no markdown code fence ticks.`;

    const aiRes = await queryAI({
      prompt,
      provider,
      model,
      taskType: "global_task",
      moduleKey: "tasks",
      maxOutputTokens: 1000,
    });

    let rawText = (aiRes.text || "{}").trim();
    rawText = rawText.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(rawText);

    res.status(200).json({
      success: true,
      aiSuggestion: parsed,
      provider: aiRes.provider,
      model: aiRes.model,
      keySource: aiRes.keySource,
      latencyMs: aiRes.latencyMs,
    });
  } catch (error) {
    console.warn("[AI Breakdown] Fallback used:", error.message);
    const title = req.body.title || "Task";
    res.status(200).json({
      success: true,
      fallback: true,
      aiSuggestion: {
        description: `Implement and verify requirements for: ${title}. Ensure all tests and edge-cases pass review.`,
        subtasks: [
          `Review requirements & specifications for ${title}`,
          `Draft initial implementation and architecture`,
          `Write test cases and verify edge conditions`,
          `Perform code review and documentation check`,
        ],
        priority: "medium",
        estimatedHours: 4,
        type: "task",
      },
    });
  }
};

// 2. Modular AI Query Endpoint (enforces global-task-only rule for Superadmin vault keys vs user BYOK)
exports.executeModularQuery = async (req, res) => {
  try {
    const {
      prompt,
      systemPrompt,
      provider,
      model,
      taskType = "module_assistant",
      moduleKey = "chat",
      maxOutputTokens = 1000,
      thinkingLevel = "low",
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: "Prompt is required" });
    }

    if (taskType === "global_task" && !req.user?.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only global platform tasks or Superadmin may invoke global AI keys directly; configure your personal key for module assistants.",
      });
    }

    const result = await queryAI({
      prompt: prompt.trim(),
      systemPrompt,
      provider,
      model,
      taskType,
      moduleKey,
      userId: req.user?._id,
      maxOutputTokens,
      thinkingLevel,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// 3. Test a raw pasted API key BEFORE storing it into DB (works for Superadmin & Users)
exports.testRawKeyEndpoint = async (req, res) => {
  try {
    const { provider, model, apiKey, thinkingLevel = "low" } = req.body;
    const result = await testRawAIKey({ provider, model, apiKey, thinkingLevel });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message || "Key verification failed";
    res.status(200).json({ success: false, ok: false, message: msg });
  }
};

// 4. Add a labeled encrypted key into the Multi-Key Ring (Global or User BYOK) + optional pre-save test
exports.addKeyRingEntry = async (req, res) => {
  try {
    const {
      scope = "user",
      provider,
      moduleKey,
      label = "Primary Key",
      apiKey,
      defaultModel,
      thinkingLevel = "low",
      activate = true,
      testBeforeSave = false,
    } = req.body;

    const providerCatalog = AI_PROVIDERS_CATALOG.find((p) => p.key === provider);
    if (!providerCatalog) {
      return res.status(400).json({ success: false, message: `Unsupported provider '${provider}'` });
    }
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ success: false, message: "API key is required" });
    }

    const cleanScope = scope === "global" ? "global" : "user";
    if (cleanScope === "global") {
      const allowed =
        req.user?.isSuperAdmin ||
        (Array.isArray(req.user?.permissions) &&
          (req.user.permissions.includes("*") || req.user.permissions.includes("ai.manage")));
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Only Superadmin / ai.manage may store global platform keys",
        });
      }
    }

    let testSummary = null;
    if (testBeforeSave) {
      try {
        const testRes = await testRawAIKey({
          provider,
          model: defaultModel || providerCatalog.defaultModel,
          apiKey: apiKey.trim(),
          thinkingLevel,
        });
        testSummary = {
          ok: true,
          message: testRes.message,
          latencyMs: testRes.latencyMs,
        };
      } catch (testErr) {
        return res.status(400).json({
          success: false,
          message: `Pre-save verification failed: ${testErr.response?.data?.error?.message || testErr.message}`,
        });
      }
    }

    const encrypted = encryptSecret(apiKey.trim());
    const ownerId = cleanScope === "global" ? null : req.user._id;
    const modKey = cleanScope === "global" ? "global" : moduleKey || "all";

    let cfg = await AIConfig.findOne({
      scope: cleanScope,
      provider,
      owner: ownerId,
      moduleKey: modKey,
    }).select("+encryptedKey +keys.encryptedKey");

    if (!cfg) {
      cfg = new AIConfig({
        scope: cleanScope,
        provider,
        owner: ownerId,
        moduleKey: modKey,
        enabled: true,
        globalOnly: cleanScope === "global",
        keySource: cleanScope === "global" ? "superadmin_vault" : "user_byok",
        defaultModel: defaultModel || providerCatalog.defaultModel,
        thinkingLevel,
        keys: [],
      });
    }

    cfg.keys.push({
      label: label.trim() || `Key #${cfg.keys.length + 1}`,
      maskedKey: encrypted.maskedKey,
      encryptedKey: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
      },
      addedBy: req.user._id,
      ...(testSummary ? { lastTestedAt: new Date(), lastTestResult: testSummary } : {}),
    });

    const newEntry = cfg.keys[cfg.keys.length - 1];
    if (activate || !cfg.activeKeyId) {
      cfg.activeKeyId = newEntry._id;
      cfg.maskedKey = encrypted.maskedKey;
      cfg.encryptedKey = newEntry.encryptedKey;
      cfg.keySource = cleanScope === "global" ? "superadmin_vault" : "user_byok";
      cfg.enabled = true;
    }
    if (defaultModel) cfg.defaultModel = defaultModel;
    cfg.invokedBy = req.user._id;

    await cfg.save();

    if (cleanScope === "global") {
      enqueueWebSocketEvent({
        target: "all",
        event: "ai:config-updated",
        data: { provider, keyLabel: newEntry.label },
      });
    }

    res.status(201).json({
      success: true,
      message: `Encrypted key "${newEntry.label}" saved to ${cleanScope === "global" ? "Superadmin Vault" : "Personal Key Ring"}`,
      configId: cfg._id,
      key: {
        _id: newEntry._id,
        label: newEntry.label,
        maskedKey: newEntry.maskedKey,
        isActive: String(cfg.activeKeyId) === String(newEntry._id),
        lastTestedAt: newEntry.lastTestedAt || null,
        lastTestResult: newEntry.lastTestResult || null,
      },
      keys: sanitizeKeysArray(cfg),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Switch active encrypted key inside a Key Ring (or pass keyId="env" to switch back to .env)
exports.activateKeyRingEntry = async (req, res) => {
  try {
    const { configId, keyId } = req.params;
    const cfg = await AIConfig.findById(configId).select("+encryptedKey +keys.encryptedKey");
    if (!cfg) {
      return res.status(404).json({ success: false, message: "AI Key configuration not found" });
    }
    if (!canManageConfig(cfg, req.user)) {
      return res.status(403).json({ success: false, message: "Access denied for this key ring" });
    }

    if (keyId === "env") {
      if (cfg.scope !== "global") {
        return res.status(400).json({ success: false, message: "Personal BYOK keys cannot switch to server .env" });
      }
      cfg.activeKeyId = null;
      cfg.keySource = "env";
      await cfg.save();
      enqueueWebSocketEvent({ target: "all", event: "ai:config-updated", data: { provider: cfg.provider } });
      return res.status(200).json({
        success: true,
        message: `Switched ${cfg.provider} back to .env key`,
        keySource: "env",
        keys: sanitizeKeysArray(cfg),
      });
    }

    const entry = cfg.keys.id(keyId);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Key entry not found in key ring" });
    }

    cfg.activeKeyId = entry._id;
    cfg.maskedKey = entry.maskedKey;
    cfg.encryptedKey = entry.encryptedKey;
    cfg.keySource = cfg.scope === "global" ? "superadmin_vault" : "user_byok";
    cfg.enabled = true;
    await cfg.save();

    if (cfg.scope === "global") {
      enqueueWebSocketEvent({ target: "all", event: "ai:config-updated", data: { provider: cfg.provider } });
    }

    res.status(200).json({
      success: true,
      message: `Switched ${cfg.provider} active key to "${entry.label}" (${entry.maskedKey})`,
      activeKeyId: cfg.activeKeyId,
      maskedKey: cfg.maskedKey,
      keys: sanitizeKeysArray(cfg),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Test a stored encrypted key inside the Key Ring
exports.testKeyRingEntry = async (req, res) => {
  try {
    const { configId, keyId } = req.params;
    const { model } = req.body || {};
    const cfg = await AIConfig.findById(configId).select("+keys.encryptedKey");
    if (!cfg) return res.status(404).json({ success: false, message: "Config not found" });
    if (!canManageConfig(cfg, req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const entry = cfg.keys.id(keyId);
    if (!entry) return res.status(404).json({ success: false, message: "Key not found" });

    const plaintext = decryptSecret(entry.encryptedKey);
    try {
      const testRes = await testRawAIKey({
        provider: cfg.provider,
        model: model || cfg.defaultModel,
        apiKey: plaintext,
        thinkingLevel: cfg.thinkingLevel || "low",
      });
      entry.lastTestedAt = new Date();
      entry.lastTestResult = { ok: true, message: testRes.message, latencyMs: testRes.latencyMs };
      await cfg.save();
      return res.status(200).json({ success: true, ...entry.lastTestResult, keyId: entry._id });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      entry.lastTestedAt = new Date();
      entry.lastTestResult = { ok: false, message: msg, latencyMs: 0 };
      await cfg.save();
      return res.status(200).json({ success: false, ...entry.lastTestResult, keyId: entry._id });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Delete an encrypted key entry from the Key Ring
exports.deleteKeyRingEntry = async (req, res) => {
  try {
    const { configId, keyId } = req.params;
    const cfg = await AIConfig.findById(configId).select("+encryptedKey +keys.encryptedKey");
    if (!cfg) return res.status(404).json({ success: false, message: "Config not found" });
    if (!canManageConfig(cfg, req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const wasActive = String(cfg.activeKeyId) === String(keyId);
    cfg.keys.pull({ _id: keyId });

    if (wasActive) {
      if (cfg.keys.length > 0) {
        const nextEntry = cfg.keys[0];
        cfg.activeKeyId = nextEntry._id;
        cfg.maskedKey = nextEntry.maskedKey;
        cfg.encryptedKey = nextEntry.encryptedKey;
      } else {
        cfg.activeKeyId = null;
        cfg.maskedKey = "";
        cfg.encryptedKey = undefined;
        cfg.keySource = cfg.scope === "global" ? "env" : "user_byok";
      }
    }

    await cfg.save();
    res.status(200).json({
      success: true,
      message: "Encrypted key removed",
      keys: sanitizeKeysArray(cfg),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Safe active AI Models summary for workspace users (`ai.use`)
exports.getAIModelsSummary = async (req, res) => {
  try {
    const [globalConfigs, envSummary] = await Promise.all([
      AIConfig.find({ scope: "global", owner: null }).select("-encryptedKey -keys.encryptedKey").lean(),
      Promise.resolve(getAllEnvProvidersSummary()),
    ]);

    const providers = AI_PROVIDERS_CATALOG.map((p) => {
      const cfg = globalConfigs.find((c) => c.provider === p.key);
      const hasEnv = Boolean(envSummary[p.key]?.configured);
      const hasVault = Boolean(cfg?.maskedKey || cfg?.keys?.length > 0);
      return {
        key: p.key,
        name: p.name,
        enabled: cfg ? cfg.enabled : hasEnv,
        isGlobalDefault: Boolean(cfg?.isGlobalDefault),
        defaultModel: cfg?.defaultModel || p.defaultModel,
        models: p.models.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          context: m.context,
          maxOut: m.maxOut,
        })),
        configured: (cfg ? cfg.enabled : true) && (hasEnv || hasVault),
      };
    });

    res.status(200).json({ success: true, providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Superadmin Admin Panel: Full Catalog, .env Status & Multi-Key Encrypted Vault Status
exports.getAIAdminConfig = async (req, res) => {
  try {
    const [globalConfigs, userKeysCount] = await Promise.all([
      AIConfig.find({ scope: "global", owner: null })
        .populate("invokedBy", "fullname email publicId")
        .select("-encryptedKey -keys.encryptedKey")
        .lean(),
      AIConfig.countDocuments({ scope: "user" }),
    ]);

    const envSummary = getAllEnvProvidersSummary();

    const providers = AI_PROVIDERS_CATALOG.map((p) => {
      const cfg = globalConfigs.find((c) => c.provider === p.key);
      const envInfo = envSummary[p.key];
      const sanitizedKeys = sanitizeKeysArray(cfg);
      return {
        ...p,
        configId: cfg?._id || null,
        activeKeyId: cfg?.activeKeyId || null,
        keys: sanitizedKeys,
        envConfigured: envInfo.configured,
        envVar: envInfo.envVar,
        envMaskedKey: envInfo.maskedKey,
        vaultConfigured: Boolean(cfg?.maskedKey || sanitizedKeys.length > 0),
        maskedKey: cfg?.maskedKey || "",
        keySource: cfg?.keySource || (envInfo.configured ? "env" : "superadmin_vault"),
        enabled: cfg ? cfg.enabled : envInfo.configured,
        isGlobalDefault: Boolean(cfg?.isGlobalDefault),
        globalOnly: cfg?.globalOnly !== false,
        defaultModel: cfg?.defaultModel || p.defaultModel,
        allowedModels:
          Array.isArray(cfg?.allowedModels) && cfg.allowedModels.length > 0
            ? cfg.allowedModels
            : p.models.map((m) => m.id),
        thinkingLevel: cfg?.thinkingLevel || "low",
        invokedBy: cfg?.invokedBy || null,
        lastTestedAt: cfg?.lastTestedAt || null,
        lastTestResult: cfg?.lastTestResult || null,
      };
    });

    res.status(200).json({
      success: true,
      providers,
      userByokCount: userKeysCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Superadmin: Store/Update provider config + add encrypted key to key ring
exports.updateAIAdminConfig = async (req, res) => {
  try {
    const { provider } = req.params;
    const providerCatalog = AI_PROVIDERS_CATALOG.find((p) => p.key === provider);
    if (!providerCatalog) {
      return res.status(400).json({ success: false, message: `Unsupported provider '${provider}'` });
    }

    const {
      apiKey,
      keyLabel,
      keySource,
      enabled = true,
      isGlobalDefault = false,
      defaultModel,
      allowedModels,
      thinkingLevel = "low",
      testBeforeSave = false,
    } = req.body;

    if (isGlobalDefault) {
      await AIConfig.updateMany(
        { scope: "global", owner: null, provider: { $ne: provider } },
        { $set: { isGlobalDefault: false } }
      );
    }

    let cfg = await AIConfig.findOne({
      scope: "global",
      provider,
      owner: null,
      moduleKey: "global",
    }).select("+encryptedKey +keys.encryptedKey");

    if (!cfg) {
      cfg = new AIConfig({
        scope: "global",
        provider,
        owner: null,
        moduleKey: "global",
        globalOnly: true,
        keys: [],
      });
    }

    cfg.enabled = Boolean(enabled);
    cfg.isGlobalDefault = Boolean(isGlobalDefault);
    cfg.globalOnly = true;
    cfg.defaultModel = defaultModel || cfg.defaultModel || providerCatalog.defaultModel;
    cfg.thinkingLevel = ["minimal", "low", "medium", "high", "xhigh"].includes(thinkingLevel)
      ? thinkingLevel
      : "low";
    cfg.invokedBy = req.user._id;
    if (Array.isArray(allowedModels)) cfg.allowedModels = allowedModels;

    if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
      let testSummary = null;
      if (testBeforeSave) {
        const testRes = await testRawAIKey({
          provider,
          model: cfg.defaultModel,
          apiKey: apiKey.trim(),
          thinkingLevel: cfg.thinkingLevel,
        });
        testSummary = { ok: true, message: testRes.message, latencyMs: testRes.latencyMs };
      }

      const encrypted = encryptSecret(apiKey.trim());
      cfg.keys.push({
        label: (keyLabel || "").trim() || `Vault Key #${cfg.keys.length + 1}`,
        maskedKey: encrypted.maskedKey,
        encryptedKey: {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
        },
        addedBy: req.user._id,
        ...(testSummary ? { lastTestedAt: new Date(), lastTestResult: testSummary } : {}),
      });
      const latest = cfg.keys[cfg.keys.length - 1];
      cfg.activeKeyId = latest._id;
      cfg.maskedKey = encrypted.maskedKey;
      cfg.encryptedKey = latest.encryptedKey;
      cfg.keySource = "superadmin_vault";
    } else if (keySource === "env" || keySource === "superadmin_vault") {
      cfg.keySource = keySource;
    }

    await cfg.save();

    const cleanCfg = await AIConfig.findById(cfg._id)
      .select("-encryptedKey -keys.encryptedKey")
      .lean();
    cleanCfg.keys = sanitizeKeysArray(cleanCfg);

    enqueueWebSocketEvent({
      target: "all",
      event: "ai:config-updated",
      data: { provider, defaultModel: cleanCfg.defaultModel, enabled: cleanCfg.enabled },
    });

    res.status(200).json({
      success: true,
      message: `${providerCatalog.name} configuration encrypted & saved`,
      config: cleanCfg,
    });
  } catch (error) {
    const status = error.response?.status === 401 || error.message?.includes("Invalid") ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// 11. Superadmin: Revoke stored encrypted API key ring for a provider
exports.revokeAIAdminKey = async (req, res) => {
  try {
    const { provider } = req.params;
    const envFound = getEnvKeyForProvider(provider);

    const updated = await AIConfig.findOneAndUpdate(
      { scope: "global", provider, owner: null, moduleKey: "global" },
      {
        $unset: { encryptedKey: 1 },
        $set: {
          maskedKey: "",
          activeKeyId: null,
          keys: [],
          keySource: "env",
          enabled: Boolean(envFound),
        },
      },
      { new: true }
    )
      .select("-encryptedKey -keys.encryptedKey")
      .lean();

    res.status(200).json({
      success: true,
      message: `Encrypted Superadmin keys cleared for ${provider}`,
      config: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 12. Superadmin: Test active provider connection
exports.testAIProviderConnection = async (req, res) => {
  try {
    const { provider } = req.params;
    const { model } = req.body || {};

    const result = await queryAI({
      prompt: 'Reply strictly with JSON: {"status":"ok","pong":true}',
      provider,
      model,
      taskType: "global_task",
      moduleKey: "global",
      maxOutputTokens: 60,
      thinkingLevel: "minimal",
    });

    const testSummary = {
      ok: true,
      message: `Connected via ${result.keySource} (${result.model}) in ${result.latencyMs}ms`,
      latencyMs: result.latencyMs,
    };

    await AIConfig.findOneAndUpdate(
      { scope: "global", provider, owner: null, moduleKey: "global" },
      { $set: { lastTestedAt: new Date(), lastTestResult: testSummary } }
    );

    res.status(200).json({ success: true, ...testSummary, sample: result.text });
  } catch (error) {
    const failSummary = {
      ok: false,
      message: error.response?.data?.error?.message || error.message,
      latencyMs: 0,
    };
    await AIConfig.findOneAndUpdate(
      { scope: "global", provider: req.params.provider, owner: null, moduleKey: "global" },
      { $set: { lastTestedAt: new Date(), lastTestResult: failSummary } }
    ).catch(() => {});

    res.status(200).json({ success: false, ...failSummary });
  }
};

// 13. Modular User BYOK Management (Encrypted multi-key ring per user & module)
exports.listUserAIKeys = async (req, res) => {
  try {
    const docs = await AIConfig.find({ scope: "user", owner: req.user._id })
      .select("-encryptedKey -keys.encryptedKey")
      .lean();
    const configs = docs.map((d) => ({ ...d, keys: sanitizeKeysArray(d) }));
    res.status(200).json({ success: true, keys: configs, configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveUserAIKey = async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, label = "Personal Key", moduleKey = "all", defaultModel, testBeforeSave = false } = req.body;
    const providerCatalog = AI_PROVIDERS_CATALOG.find((p) => p.key === provider);
    if (!providerCatalog) {
      return res.status(400).json({ success: false, message: `Unsupported provider '${provider}'` });
    }
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ success: false, message: "API key is required" });
    }

    let testSummary = null;
    if (testBeforeSave) {
      const testRes = await testRawAIKey({
        provider,
        model: defaultModel || providerCatalog.defaultModel,
        apiKey: apiKey.trim(),
      });
      testSummary = { ok: true, message: testRes.message, latencyMs: testRes.latencyMs };
    }

    const encrypted = encryptSecret(apiKey.trim());
    let cfg = await AIConfig.findOne({
      scope: "user",
      provider,
      owner: req.user._id,
      moduleKey,
    }).select("+encryptedKey +keys.encryptedKey");

    if (!cfg) {
      cfg = new AIConfig({
        scope: "user",
        provider,
        owner: req.user._id,
        moduleKey,
        enabled: true,
        globalOnly: false,
        keySource: "user_byok",
        defaultModel: defaultModel || providerCatalog.defaultModel,
        keys: [],
      });
    }

    cfg.keys.push({
      label: label.trim() || `Personal Key #${cfg.keys.length + 1}`,
      maskedKey: encrypted.maskedKey,
      encryptedKey: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
      },
      addedBy: req.user._id,
      ...(testSummary ? { lastTestedAt: new Date(), lastTestResult: testSummary } : {}),
    });
    const latest = cfg.keys[cfg.keys.length - 1];
    cfg.activeKeyId = latest._id;
    cfg.maskedKey = encrypted.maskedKey;
    cfg.encryptedKey = latest.encryptedKey;
    cfg.invokedBy = req.user._id;
    await cfg.save();

    const clean = await AIConfig.findById(cfg._id)
      .select("-encryptedKey -keys.encryptedKey")
      .lean();
    clean.keys = sanitizeKeysArray(clean);

    res.status(200).json({ success: true, config: clean });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteUserAIKey = async (req, res) => {
  try {
    const { provider } = req.params;
    const { moduleKey = "all" } = req.query;
    await AIConfig.findOneAndDelete({ scope: "user", provider, owner: req.user._id, moduleKey });
    res.status(200).json({ success: true, message: "Personal AI key removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
