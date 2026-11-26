const axios = require("axios");
const AIConfig = require("../models/aiConfigModel");
const {
  AI_PROVIDERS_CATALOG,
  getEnvKeyForProvider,
  findCatalogModel,
} = require("../config/aiCatalog");
const { decryptSecret } = require("../utils/cryptoVault");

/**
 * Resolve which provider, model, and decrypted API key should handle an AI request.
 * Policy:
 * 1. If `userId` has an enabled encrypted user BYOK config for `(moduleKey || "all")` & provider, use user BYOK key.
 * 2. Otherwise ONLY if `taskType === "global_task"` allow Superadmin encrypted vault key (`scope: "global"`, `globalOnly: true`) or `.env` key.
 * 3. Non-global user requests NEVER receive Superadmin's encrypted global key!
 */
async function resolveExecutionCredentials({
  providerKey,
  requestedModel,
  taskType = "global_task",
  moduleKey = "global",
  userId = null,
}) {
  let targetProviderKey = providerKey;
  let targetModel = requestedModel;

  if (requestedModel && !targetProviderKey) {
    const match = findCatalogModel(requestedModel);
    if (match) targetProviderKey = match.provider.key;
  }

  // 1. Check User BYOK encrypted key first when a userId is supplied
  if (userId) {
    const userQuery = {
      scope: "user",
      owner: userId,
      enabled: true,
      ...(targetProviderKey ? { provider: targetProviderKey } : {}),
      moduleKey: { $in: [moduleKey, "all", "global"] },
    };
    const userCfg = await AIConfig.findOne(userQuery)
      .select("+encryptedKey +keys.encryptedKey")
      .sort({ updatedAt: -1 })
      .lean();

    const activeUserEntry =
      userCfg?.keys?.find((k) => String(k._id) === String(userCfg.activeKeyId)) ||
      userCfg?.keys?.[0];
    const userEnc = activeUserEntry?.encryptedKey || userCfg?.encryptedKey;

    if (userCfg && userEnc?.ciphertext) {
      return {
        providerKey: userCfg.provider,
        model: targetModel || userCfg.defaultModel,
        apiKey: decryptSecret(userEnc),
        keySource: "user_byok",
        thinkingLevel: userCfg.thinkingLevel || "low",
      };
    }
  }

  // 2. Enforce global-only guard for Superadmin encrypted vault key
  if (taskType !== "global_task") {
    throw new Error(
      `Personal API key required for module '${moduleKey}'. Global Superadmin AI keys can only be used in global tasks.`
    );
  }

  // Pick global default provider if caller omitted providerKey
  let globalCfg = null;
  if (targetProviderKey) {
    globalCfg = await AIConfig.findOne({ scope: "global", provider: targetProviderKey, owner: null })
      .select("+encryptedKey +keys.encryptedKey")
      .lean();
  } else {
    globalCfg =
      (await AIConfig.findOne({ scope: "global", isGlobalDefault: true, enabled: true, owner: null })
        .select("+encryptedKey +keys.encryptedKey")
        .lean()) ||
      (await AIConfig.findOne({ scope: "global", enabled: true, owner: null })
        .select("+encryptedKey +keys.encryptedKey")
        .lean());
    if (globalCfg) {
      targetProviderKey = globalCfg.provider;
    }
  }

  // If no DB config exists yet, fall back to whichever provider has an .env key (preferring google if set)
  if (!targetProviderKey) {
    const preferredOrder = ["google", "openai", "anthropic"];
    for (const pKey of preferredOrder) {
      if (getEnvKeyForProvider(pKey)) {
        targetProviderKey = pKey;
        break;
      }
    }
  }

  if (!targetProviderKey) {
    throw new Error("No AI provider configured in Superadmin Vault or .env");
  }

  const catalogProvider = AI_PROVIDERS_CATALOG.find((p) => p.key === targetProviderKey);
  const resolvedModel =
    targetModel || globalCfg?.defaultModel || catalogProvider?.defaultModel || "gemini-3.8-flash";
  const thinkingLevel = globalCfg?.thinkingLevel || "low";

  if (globalCfg && globalCfg.enabled === false) {
    throw new Error(`Provider '${targetProviderKey}' is currently disabled by Superadmin`);
  }

  const activeVaultEntry =
    globalCfg?.keys?.find((k) => String(k._id) === String(globalCfg.activeKeyId)) ||
    globalCfg?.keys?.[0];
  const vaultEnc = activeVaultEntry?.encryptedKey || globalCfg?.encryptedKey;

  // Prefer Superadmin's encrypted key when explicitly invoked in Vault
  if (globalCfg && globalCfg.keySource === "superadmin_vault" && vaultEnc?.ciphertext) {
    return {
      providerKey: targetProviderKey,
      model: resolvedModel,
      apiKey: decryptSecret(vaultEnc),
      keySource: "superadmin_vault",
      thinkingLevel,
    };
  }

  const envInfo = getEnvKeyForProvider(targetProviderKey);
  if (envInfo?.rawKey) {
    return {
      providerKey: targetProviderKey,
      model: resolvedModel,
      apiKey: envInfo.rawKey,
      keySource: "env",
      thinkingLevel,
    };
  }

  if (vaultEnc?.ciphertext) {
    return {
      providerKey: targetProviderKey,
      model: resolvedModel,
      apiKey: decryptSecret(vaultEnc),
      keySource: "superadmin_vault",
      thinkingLevel,
    };
  }

  throw new Error(`No API key available for provider '${targetProviderKey}' (neither encrypted vault nor .env)`);
}

async function callOpenAIResponses({ apiKey, model, prompt, systemPrompt, maxOutputTokens }) {
  const input = systemPrompt
    ? [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ]
    : prompt;

  const res = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model,
      input,
      max_output_tokens: maxOutputTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  let text = res.data?.output_text || "";
  if (!text && Array.isArray(res.data?.output)) {
    text = res.data.output
      .flatMap((o) => o.content || [])
      .map((c) => c.text || "")
      .join("\n")
      .trim();
  }
  return { text, usage: res.data?.usage || null };
}

async function callAnthropicMessages({ apiKey, model, prompt, systemPrompt, maxOutputTokens }) {
  const body = {
    model,
    max_tokens: maxOutputTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  };

  const res = await axios.post("https://api.anthropic.com/v1/messages", body, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2026-10-21",
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });

  const text = Array.isArray(res.data?.content)
    ? res.data.content.map((c) => c.text || "").join("\n").trim()
    : "";
  return { text, usage: res.data?.usage || null };
}

async function callGoogleGemini({
  apiKey,
  model,
  prompt,
  systemPrompt,
  maxOutputTokens,
  thinkingLevel = "low",
}) {
  const catalogMatch = findCatalogModel(model);
  const endpointVersion = catalogMatch?.model?.endpointMode?.startsWith("v1beta") ? "v1beta" : "v1";
  const supportsThinking =
    catalogMatch?.model?.supportsThinkingLevel || /^gemini-(3\.[6-9]|4)/.test(model);

  const generationConfig = { maxOutputTokens };
  if (supportsThinking) {
    generationConfig.thinkingConfig = { thinkingLevel };
  } else {
    generationConfig.temperature = 0.2;
  }

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const url = `https://generativelanguage.googleapis.com/${endpointVersion}/models/${model}:generateContent`;

  const res = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      timeout: 15000,
    }
  );

  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { text, usage: res.data?.usageMetadata || null };
}

const PROVIDER_ADAPTERS = {
  openai: callOpenAIResponses,
  anthropic: callAnthropicMessages,
  google: callGoogleGemini,
};

/**
 * Modular unified AI execution engine supporting OpenAI, Anthropic, and Google Gemini
 * using encrypted vault keys or `.env` fallback under strict scope governance.
 */
async function queryAI({
  prompt,
  systemPrompt = "",
  provider,
  model,
  taskType = "global_task",
  moduleKey = "global",
  userId = null,
  maxOutputTokens = 1000,
  thinkingLevel,
}) {
  const startedAt = Date.now();
  const creds = await resolveExecutionCredentials({
    providerKey: provider,
    requestedModel: model,
    taskType,
    moduleKey,
    userId,
  });

  const adapter = PROVIDER_ADAPTERS[creds.providerKey];
  if (!adapter) {
    throw new Error(`Unsupported AI provider adapter: ${creds.providerKey}`);
  }

  const result = await adapter({
    apiKey: creds.apiKey,
    model: creds.model,
    prompt,
    systemPrompt,
    maxOutputTokens,
    thinkingLevel: thinkingLevel || creds.thinkingLevel || "low",
  });

  return {
    success: true,
    provider: creds.providerKey,
    model: creds.model,
    keySource: creds.keySource,
    text: result.text,
    usage: result.usage,
    latencyMs: Date.now() - startedAt,
  };
}

/**
 * Test a raw plaintext API key in memory BEFORE storing it into the encrypted vault.
 */
async function testRawAIKey({ provider, model, apiKey, thinkingLevel = "low" }) {
  const catalogProvider = AI_PROVIDERS_CATALOG.find((p) => p.key === provider);
  if (!catalogProvider) {
    throw new Error(`Unsupported provider '${provider}'`);
  }
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("API key is required to test connection");
  }

  const adapter = PROVIDER_ADAPTERS[provider];
  const resolvedModel = model || catalogProvider.defaultModel;
  const startedAt = Date.now();

  const res = await adapter({
    apiKey: apiKey.trim(),
    model: resolvedModel,
    prompt: 'Reply strictly with JSON: {"status":"verified","ok":true}',
    systemPrompt: "",
    maxOutputTokens: 50,
    thinkingLevel,
  });

  return {
    ok: true,
    provider,
    model: resolvedModel,
    latencyMs: Date.now() - startedAt,
    message: `Verified ${catalogProvider.name} (${resolvedModel}) in ${Date.now() - startedAt}ms`,
    sample: res.text,
  };
}

module.exports = {
  resolveExecutionCredentials,
  queryAI,
  testRawAIKey,
};

