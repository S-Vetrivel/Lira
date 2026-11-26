const AIConfig = require("../models/aiConfigModel");
const AIGlobalGrant = require("../models/aiGlobalGrantModel");
const AIUsageLog = require("../models/aiUsageLogModel");
const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const Project = require("../models/projectModel");
const {
  AI_PROVIDERS_CATALOG,
  getAllEnvProvidersSummary,
  getEnvKeyForProvider,
} = require("../config/aiCatalog");
const { MODULES_CATALOG } = require("../config/modulesCatalog");
const { encryptSecret, decryptSecret } = require("../utils/cryptoVault");
const {
  queryAI,
  testRawAIKey,
  recordAIUsageLog,
  getUserGlobalGrantsSummary,
} = require("../services/aiService");
const {
  getOrCreateSession,
  enqueueAssistantChat,
  stopAssistantJob,
  confirmAssistantMessageAction,
  executeDirectCardStep,
  clearAssistantSessionForUser,
  getUserAvailableModels,
  classifyPromptSecurity,
  recordMisuseAudit,
} = require("../services/aiAssistantService");
const {
  processUploadedAttachment,
  deleteAttachmentFileSafe,
  cleanupAttachmentFiles,
  generatePDFBuffer,
  generatePPTXBuffer,
  generateCSVString,
} = require("../services/aiExportService");
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

    const secCheck = classifyPromptSecurity({
      prompt: `${title}\n${description || ""}`,
      user: req.user,
    });
    if (secCheck.blocked) {
      await recordMisuseAudit({
        user: req.user,
        prompt: `${title} ${description || ""}`,
        misuseCategory: secCheck.misuseCategory,
        warning: secCheck.warning,
        moduleKey: "tasks",
      });
      return res.status(403).json({
        success: false,
        blocked: true,
        misuseCategory: secCheck.misuseCategory,
        message: secCheck.warning,
      });
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
      userId: req.user?._id || null,
      projectId: req.body.projectId || null,
      departmentId: req.body.departmentId || null,
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

// 2. Modular AI Query Endpoint (enforces personal BYOK vs Superadmin Global Key Grants per module)
exports.executeModularQuery = async (req, res) => {
  try {
    const {
      prompt,
      systemPrompt,
      provider,
      model,
      taskType = "module_assistant",
      moduleKey = "chat",
      projectId = null,
      departmentId = null,
      preferGlobal = false,
      maxOutputTokens = 1000,
      thinkingLevel = "low",
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: "Prompt is required" });
    }

    const secCheck = classifyPromptSecurity({
      prompt: prompt.trim(),
      user: req.user,
    });
    if (secCheck.blocked) {
      await recordMisuseAudit({
        user: req.user,
        prompt: prompt.trim(),
        misuseCategory: secCheck.misuseCategory,
        warning: secCheck.warning,
        moduleKey,
      });
      return res.status(403).json({
        success: false,
        blocked: true,
        misuseCategory: secCheck.misuseCategory,
        message: secCheck.warning,
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
      projectId,
      departmentId,
      preferGlobal: Boolean(preferGlobal),
      maxOutputTokens,
      thinkingLevel,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
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
    if (cfg.scope === "global") {
      enqueueWebSocketEvent({ target: "all", event: "ai:config-updated", data: { provider: cfg.provider } });
    }
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

// =========================================================================
// GLOBAL KEY ACCESS GRANTS (USER / DEPARTMENT / TEAM-PROJECT + MODULES)
// =========================================================================

const TARGET_MODEL_MAP = {
  user: "User",
  department: "Department",
  project: "Project",
};

exports.listGlobalGrants = async (req, res) => {
  try {
    const [grants, users, departments, projects] = await Promise.all([
      AIGlobalGrant.find({})
        .populate("grantedBy", "fullname email publicId")
        .populate("revokedBy", "fullname email publicId")
        .sort({ isActive: -1, createdAt: -1 })
        .lean(),
      User.find({
        isActive: { $ne: false },
        status: { $nin: ["pending_approval", "rejected"] },
      })
        .select("_id fullname email publicId role department departmentName jobTitle")
        .sort({ fullname: 1 })
        .lean(),
      Department.find({}).select("_id name code color").sort({ name: 1 }).lean(),
      Project.find({}).select("_id name prefix").sort({ name: 1 }).lean(),
    ]);

    const moduleOptions = [
      { key: "*", label: "All AI Modules (*)" },
      ...MODULES_CATALOG.map((m) => ({ key: m.key, label: m.name })),
    ];

    res.status(200).json({
      success: true,
      grants,
      targets: { users, departments, projects },
      moduleOptions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGlobalGrant = async (req, res) => {
  try {
    const {
      targetType,
      targetId,
      provider = "all",
      allowedModules = ["*"],
      note = "",
    } = req.body;

    const targetModel = TARGET_MODEL_MAP[targetType];
    if (!targetModel || !targetId) {
      return res.status(400).json({ success: false, message: "Valid targetType and targetId are required" });
    }
    if (!["all", "google", "openai", "anthropic"].includes(provider)) {
      return res.status(400).json({ success: false, message: "Invalid provider" });
    }

    let targetName = "";
    if (targetType === "user") {
      const u = await User.findById(targetId).select("fullname email").lean();
      if (!u) return res.status(404).json({ success: false, message: "Target user not found" });
      targetName = u.fullname || u.email;
    } else if (targetType === "department") {
      const d = await Department.findById(targetId).select("name code").lean();
      if (!d) return res.status(404).json({ success: false, message: "Target department not found" });
      targetName = `${d.name}${d.code ? ` (${d.code})` : ""}`;
    } else if (targetType === "project") {
      const p = await Project.findById(targetId).select("name prefix").lean();
      if (!p) return res.status(404).json({ success: false, message: "Target project/team not found" });
      targetName = `${p.name}${p.prefix ? ` [${p.prefix}]` : ""}`;
    }

    const cleanModules =
      Array.isArray(allowedModules) && allowedModules.length > 0
        ? [...new Set(allowedModules.map((m) => String(m).trim()).filter(Boolean))]
        : ["*"];

    let grant = await AIGlobalGrant.findOne({ targetType, targetId, provider });
    if (grant) {
      grant.allowedModules = cleanModules;
      grant.targetName = targetName;
      grant.isActive = true;
      grant.revokedAt = null;
      grant.revokedBy = null;
      grant.grantedBy = req.user._id;
      grant.note = note.trim();
      await grant.save();
    } else {
      grant = await AIGlobalGrant.create({
        targetType,
        targetId,
        targetModel,
        targetName,
        provider,
        allowedModules: cleanModules,
        isActive: true,
        grantedBy: req.user._id,
        note: note.trim(),
      });
    }

    enqueueWebSocketEvent({
      target: "all",
      event: "ai:grants-updated",
      data: { grantId: grant._id, targetType, targetName, isActive: true },
    });

    res.status(201).json({
      success: true,
      message: `Global AI Key access granted to ${targetType} "${targetName}"`,
      grant,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.revokeGlobalGrant = async (req, res) => {
  try {
    const grant = await AIGlobalGrant.findByIdAndUpdate(
      req.params.grantId,
      { isActive: false, revokedAt: new Date(), revokedBy: req.user._id },
      { new: true }
    );
    if (!grant) {
      return res.status(404).json({ success: false, message: "Grant not found" });
    }
    enqueueWebSocketEvent({
      target: "all",
      event: "ai:grants-updated",
      data: { grantId: grant._id, isActive: false },
    });
    res.status(200).json({ success: true, message: `Revoked global AI access for "${grant.targetName}"`, grant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.restoreGlobalGrant = async (req, res) => {
  try {
    const grant = await AIGlobalGrant.findByIdAndUpdate(
      req.params.grantId,
      { isActive: true, revokedAt: null, revokedBy: null },
      { new: true }
    );
    if (!grant) {
      return res.status(404).json({ success: false, message: "Grant not found" });
    }
    enqueueWebSocketEvent({
      target: "all",
      event: "ai:grants-updated",
      data: { grantId: grant._id, isActive: true },
    });
    res.status(200).json({ success: true, message: `Restored global AI access for "${grant.targetName}"`, grant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteGlobalGrant = async (req, res) => {
  try {
    const grant = await AIGlobalGrant.findByIdAndDelete(req.params.grantId);
    if (!grant) {
      return res.status(404).json({ success: false, message: "Grant not found" });
    }
    enqueueWebSocketEvent({
      target: "all",
      event: "ai:grants-updated",
      data: { grantId: grant._id, deleted: true },
    });
    res.status(200).json({ success: true, message: "Global AI grant deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyAIAccess = async (req, res) => {
  try {
    const summary = await getUserGlobalGrantsSummary(req.user._id);
    res.status(200).json({ success: true, ...summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// FINE-GRAINED AI KEY USAGE AUDIT LOGS
// =========================================================================

exports.getAIUsageLogs = async (req, res) => {
  try {
    const {
      provider = "",
      credentialScope = "",
      moduleKey = "",
      status = "",
      search = "",
      limit = 60,
      page = 1,
    } = req.query;

    const filter = {};
    if (provider) filter.provider = provider;
    if (credentialScope) filter.credentialScope = credentialScope;
    if (moduleKey) filter.moduleKey = moduleKey;
    if (status) filter.status = status;
    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { userName: rx },
        { userEmail: rx },
        { userPublicId: rx },
        { keyLabel: rx },
        { model: rx },
        { grantTargetName: rx },
        { moduleKey: rx },
      ];
    }

    const lim = Math.min(200, Math.max(1, Number(limit) || 60));
    const pg = Math.max(1, Number(page) || 1);

    const [logs, totalCount, scopeAgg, statusAgg, tokenAgg] = await Promise.all([
      AIUsageLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pg - 1) * lim)
        .limit(lim)
        .lean(),
      AIUsageLog.countDocuments(filter),
      AIUsageLog.aggregate([{ $group: { _id: "$credentialScope", count: { $sum: 1 } } }]),
      AIUsageLog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      AIUsageLog.aggregate([
        {
          $group: {
            _id: null,
            totalTokens: { $sum: "$totalTokens" },
            promptTokens: { $sum: "$promptTokens" },
            completionTokens: { $sum: "$completionTokens" },
            avgLatencyMs: { $avg: "$latencyMs" },
          },
        },
      ]),
    ]);

    const byScope = Object.fromEntries(scopeAgg.map((r) => [r._id, r.count]));
    const byStatus = Object.fromEntries(statusAgg.map((r) => [r._id, r.count]));
    const totals = tokenAgg[0] || {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      avgLatencyMs: 0,
    };

    res.status(200).json({
      success: true,
      logs,
      totalCount,
      page: pg,
      limit: lim,
      stats: {
        totalCalls:
          (byStatus.success || 0) +
          (byStatus.failed || 0) +
          (byStatus.denied || 0) +
          (byStatus.misuse || 0),
        successCalls: byStatus.success || 0,
        failedCalls: byStatus.failed || 0,
        deniedCalls: byStatus.denied || 0,
        misuseCalls: byStatus.misuse || 0,
        globalVaultCalls: byScope.global_vault || 0,
        globalEnvCalls: byScope.global_env || 0,
        userByokCalls: byScope.user_byok || 0,
        totalTokens: totals.totalTokens || 0,
        promptTokens: totals.promptTokens || 0,
        completionTokens: totals.completionTokens || 0,
        avgLatencyMs: Math.round(totals.avgLatencyMs || 0),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// LIRA PERSISTENT AI ASSISTANT / COPILOT (RELOAD-RESILIENT)
// =========================================================================

exports.getAssistantSession = async (req, res) => {
  try {
    const [session, modelInfo] = await Promise.all([
      getOrCreateSession(req.user._id),
      getUserAvailableModels(req.user),
    ]);
    res.status(200).json({ success: true, session, ...modelInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAssistantModels = async (req, res) => {
  try {
    const info = await getUserAvailableModels(req.user);
    res.status(200).json({ success: true, ...info });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadAssistantAttachments = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = [];
    for (const f of files) {
      const processed = await processUploadedAttachment(f);
      if (processed) attachments.push(processed);
    }
    res.status(201).json({ success: true, attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAssistantAttachment = async (req, res) => {
  try {
    const target = req.body?.filePath || req.body?.filename || req.query?.filename || "";
    const deleted = deleteAttachmentFileSafe(target);
    res.status(200).json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.postAssistantChat = async (req, res) => {
  try {
    const {
      prompt,
      mode = "review",
      moduleKey = "dashboard",
      selectedModelKey = "auto",
      currentRoute = "/",
      activeProjectId = null,
      attachments = [],
    } = req.body;

    if ((!prompt || !String(prompt).trim()) && (!Array.isArray(attachments) || attachments.length === 0)) {
      return res.status(400).json({ success: false, message: "Message or attachment is required" });
    }

    const { session, jobId } = await enqueueAssistantChat({
      user: req.user,
      prompt: String(prompt || (attachments.length ? `Analyze attached file(s): ${attachments.map((a) => a.name).join(", ")}` : "")).trim(),
      mode,
      moduleKey,
      selectedModelKey,
      currentRoute,
      activeProjectId,
      attachments: Array.isArray(attachments) ? attachments.slice(0, 5) : [],
    });

    res.status(202).json({
      success: true,
      jobId,
      session,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.executeAssistantCardStep = async (req, res) => {
  try {
    const { step, messageId = "", replyText = "" } = req.body || {};
    if (!step || !step.type) {
      return res.status(400).json({ success: false, message: "Valid action step is required" });
    }
    const { session, executedResult } = await executeDirectCardStep({
      user: req.user,
      step,
      messageId,
      replyText,
    });
    res.status(200).json({ success: true, session, executedResult });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.exportAssistantArtifact = async (req, res) => {
  try {
    const { format = "pdf", artifact = {} } = req.body || {};
    const safeTitle = String(artifact.title || "Lira-Workspace-Report").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 64) || "Lira-Report";
    const fmt = String(format).toLowerCase();

    if (fmt === "csv") {
      const csv = generateCSVString({
        headers: artifact.headers || artifact.columns || [],
        rows: artifact.rows || [],
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.csv"`);
      return res.status(200).send(csv);
    }

    if (fmt === "ppt" || fmt === "pptx") {
      const buf = await generatePPTXBuffer({
        title: artifact.title || safeTitle,
        subtitle: artifact.subtitle || "Workspace Analytics & Status Deck",
        slides: Array.isArray(artifact.slides) ? artifact.slides : [],
        generatedBy: req.user?.fullname || req.user?.email || "Lira Copilot",
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pptx"`);
      return res.status(200).send(buf);
    }

    const pdfBuf = await generatePDFBuffer({
      title: artifact.title || safeTitle,
      subtitle: artifact.subtitle || "Workspace Document Export",
      sections: Array.isArray(artifact.sections) ? artifact.sections : [],
      table: artifact.table || (artifact.headers ? { headers: artifact.headers, rows: artifact.rows } : null),
      generatedBy: req.user?.fullname || req.user?.email || "Lira Copilot",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
    return res.status(200).send(pdfBuf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setAssistantMode = async (req, res) => {
  try {
    const { mode = "review" } = req.body;
    const session = await getOrCreateSession(req.user._id);
    session.mode = mode === "auto" ? "auto" : "review";
    await session.save();
    res.status(200).json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.stopAssistantGeneration = async (req, res) => {
  try {
    const { jobId = "" } = req.body || {};
    const result = await stopAssistantJob({ userId: req.user._id, jobId });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.confirmAssistantAction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { session, executedResult } = await confirmAssistantMessageAction({
      user: req.user,
      messageId,
    });
    res.status(200).json({ success: true, session, executedResult });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.clearAssistantSession = async (req, res) => {
  try {
    const session = await clearAssistantSessionForUser(req.user._id);
    res.status(200).json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
