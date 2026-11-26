const AIConfig = require("../models/aiConfigModel");
const {
  AI_PROVIDERS_CATALOG,
  getAllEnvProvidersSummary,
  getEnvKeyForProvider,
} = require("../config/aiCatalog");
const { encryptSecret, decryptSecret } = require("../utils/cryptoVault");
const { queryAI } = require("../services/aiService");
const { enqueueWebSocketEvent } = require("../services/queue");

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

    // Only Superadmin or ai.manage holders (or approved global features) may invoke `global_task` directly
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

// 3. Safe active AI Models summary for workspace users (`ai.use`)
exports.getAIModelsSummary = async (req, res) => {
  try {
    const [globalConfigs, envSummary] = await Promise.all([
      AIConfig.find({ scope: "global", owner: null })
        .select("-encryptedKey")
        .lean(),
      Promise.resolve(getAllEnvProvidersSummary()),
    ]);

    const providers = AI_PROVIDERS_CATALOG.map((p) => {
      const cfg = globalConfigs.find((c) => c.provider === p.key);
      const hasEnv = Boolean(envSummary[p.key]?.configured);
      const hasVault = Boolean(cfg?.maskedKey);
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

// 4. Superadmin Admin Panel: Full Catalog, .env Status & Encrypted Global Vault Status
exports.getAIAdminConfig = async (req, res) => {
  try {
    const [globalConfigs, userKeysCount] = await Promise.all([
      AIConfig.find({ scope: "global", owner: null })
        .populate("invokedBy", "fullname email publicId")
        .select("-encryptedKey")
        .lean(),
      AIConfig.countDocuments({ scope: "user" }),
    ]);

    const envSummary = getAllEnvProvidersSummary();

    const providers = AI_PROVIDERS_CATALOG.map((p) => {
      const cfg = globalConfigs.find((c) => c.provider === p.key);
      const envInfo = envSummary[p.key];
      return {
        ...p,
        envConfigured: envInfo.configured,
        envVar: envInfo.envVar,
        envMaskedKey: envInfo.maskedKey,
        vaultConfigured: Boolean(cfg?.maskedKey),
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

// 5. Superadmin: Store encrypted provider API key & configure models/global default
exports.updateAIAdminConfig = async (req, res) => {
  try {
    const { provider } = req.params;
    const providerCatalog = AI_PROVIDERS_CATALOG.find((p) => p.key === provider);
    if (!providerCatalog) {
      return res.status(400).json({ success: false, message: `Unsupported provider '${provider}'` });
    }

    const {
      apiKey,
      keySource,
      enabled = true,
      isGlobalDefault = false,
      defaultModel,
      allowedModels,
      thinkingLevel = "low",
    } = req.body;

    if (isGlobalDefault) {
      await AIConfig.updateMany(
        { scope: "global", owner: null, provider: { $ne: provider } },
        { $set: { isGlobalDefault: false } }
      );
    }

    const updateSet = {
      scope: "global",
      provider,
      owner: null,
      moduleKey: "global",
      enabled: Boolean(enabled),
      isGlobalDefault: Boolean(isGlobalDefault),
      globalOnly: true, // Enforced strictly for Superadmin global vault keys
      defaultModel: defaultModel || providerCatalog.defaultModel,
      thinkingLevel: ["minimal", "low", "medium", "high", "xhigh"].includes(thinkingLevel)
        ? thinkingLevel
        : "low",
      invokedBy: req.user._id,
    };

    if (Array.isArray(allowedModels)) {
      updateSet.allowedModels = allowedModels;
    }

    if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
      const encrypted = encryptSecret(apiKey.trim());
      updateSet.encryptedKey = {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
      };
      updateSet.maskedKey = encrypted.maskedKey;
      updateSet.keySource = "superadmin_vault";
    } else if (keySource === "env" || keySource === "superadmin_vault") {
      updateSet.keySource = keySource;
    }

    const updated = await AIConfig.findOneAndUpdate(
      { scope: "global", provider, owner: null, moduleKey: "global" },
      { $set: updateSet },
      { upsert: true, new: true }
    )
      .select("-encryptedKey")
      .lean();

    enqueueWebSocketEvent({
      target: "all",
      event: "ai:config-updated",
      data: { provider, defaultModel: updated.defaultModel, enabled: updated.enabled },
    });

    res.status(200).json({
      success: true,
      message: `${providerCatalog.name} configuration encrypted & saved`,
      config: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Superadmin: Revoke stored encrypted API key for a provider
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
          keySource: "env",
          enabled: Boolean(envFound),
        },
      },
      { new: true }
    )
      .select("-encryptedKey")
      .lean();

    res.status(200).json({
      success: true,
      message: `Encrypted Superadmin key removed for ${provider}`,
      config: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Superadmin: Test live provider execution (verifies encryption/decryption + API connectivity)
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

// 8. Modular User BYOK Foundation (Encrypted per-user API keys for module assistants)
exports.listUserAIKeys = async (req, res) => {
  try {
    const docs = await AIConfig.find({ scope: "user", owner: req.user._id })
      .select("-encryptedKey")
      .lean();
    res.status(200).json({ success: true, keys: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveUserAIKey = async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, moduleKey = "all", defaultModel } = req.body;
    const providerCatalog = AI_PROVIDERS_CATALOG.find((p) => p.key === provider);
    if (!providerCatalog) {
      return res.status(400).json({ success: false, message: `Unsupported provider '${provider}'` });
    }
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ success: false, message: "API key is required" });
    }

    const encrypted = encryptSecret(apiKey.trim());
    const doc = await AIConfig.findOneAndUpdate(
      { scope: "user", provider, owner: req.user._id, moduleKey },
      {
        $set: {
          scope: "user",
          provider,
          owner: req.user._id,
          moduleKey,
          enabled: true,
          globalOnly: false,
          keySource: "user_byok",
          encryptedKey: {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            keyVersion: encrypted.keyVersion,
          },
          maskedKey: encrypted.maskedKey,
          defaultModel: defaultModel || providerCatalog.defaultModel,
          invokedBy: req.user._id,
        },
      },
      { upsert: true, new: true }
    )
      .select("-encryptedKey")
      .lean();

    res.status(200).json({ success: true, config: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
