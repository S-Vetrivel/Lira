const axios = require("axios");
const AIConfig = require("../models/aiConfigModel");
const AIGlobalGrant = require("../models/aiGlobalGrantModel");
const AIUsageLog = require("../models/aiUsageLogModel");
const User = require("../models/userModel");
const Project = require("../models/projectModel");
require("../models/departmentModel");
require("../models/roleModel");
const {
  AI_PROVIDERS_CATALOG,
  getEnvKeyForProvider,
  findCatalogModel,
} = require("../config/aiCatalog");
const { decryptSecret } = require("../utils/cryptoVault");

function normalizeUsageTokens(providerKey, usage) {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  if (providerKey === "google") {
    const promptTokens = Number(usage.promptTokenCount || 0);
    const completionTokens = Number(usage.candidatesTokenCount || 0);
    const totalTokens = Number(usage.totalTokenCount || promptTokens + completionTokens);
    return { promptTokens, completionTokens, totalTokens };
  }
  const promptTokens = Number(usage.input_tokens || usage.prompt_tokens || 0);
  const completionTokens = Number(usage.output_tokens || usage.completion_tokens || 0);
  const totalTokens = Number(usage.total_tokens || promptTokens + completionTokens);
  return { promptTokens, completionTokens, totalTokens };
}

async function recordAIUsageLog({
  userId = null,
  userSnapshot = null,
  provider = "unknown",
  model = "",
  moduleKey = "global",
  taskType = "module_assistant",
  credentialScope = "none",
  keyId = "",
  keyLabel = "",
  maskedKey = "",
  grantId = null,
  grantTargetType = "system",
  grantTargetName = "",
  projectId = null,
  departmentId = null,
  status = "success",
  misuseCategory = "",
  promptSnippet = "",
  latencyMs = 0,
  usage = null,
  errorMessage = "",
}) {
  try {
    let snap = userSnapshot;
    if (!snap && userId) {
      snap = await User.findById(userId)
        .select("fullname email publicId role department")
        .populate("department", "name")
        .lean();
    }
    const tokens = normalizeUsageTokens(provider, usage);
    await AIUsageLog.create({
      user: userId || snap?._id || null,
      userName: snap?.fullname || "System",
      userEmail: snap?.email || "",
      userPublicId: snap?.publicId || "",
      userRole: snap?.role || "",
      departmentName: snap?.department?.name || "",
      provider: ["google", "openai", "anthropic"].includes(provider) ? provider : "unknown",
      model: model || "",
      moduleKey: moduleKey || "global",
      taskType: taskType || "module_assistant",
      credentialScope,
      keyId: keyId ? String(keyId) : "",
      keyLabel: keyLabel || "",
      maskedKey: maskedKey || "",
      grantId: grantId || null,
      grantTargetType,
      grantTargetName: grantTargetName || "",
      projectId: projectId || null,
      departmentId: departmentId || snap?.department?._id || snap?.department || null,
      status,
      misuseCategory: misuseCategory || "",
      promptSnippet: promptSnippet ? String(promptSnippet).slice(0, 240) : "",
      latencyMs: Number(latencyMs || 0),
      promptTokens: tokens.promptTokens,
      completionTokens: tokens.completionTokens,
      totalTokens: tokens.totalTokens,
      errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : "",
    });
    console.log(
      `[AI USAGE] status=${String(status).toUpperCase()} user=${snap?.email || snap?.fullname || "system"} module=${moduleKey} scope=${credentialScope} provider=${provider} model=${model || "-"} tokens=${tokens.totalTokens} latency=${Number(latencyMs || 0)}ms${misuseCategory ? ` misuse=${misuseCategory}` : ""}`
    );
    try {
      const { enqueueWebSocketEvent } = require("./queue");
      enqueueWebSocketEvent({
        target: "all",
        event: "ai:usage-logged",
        data: { provider, model, status, totalTokens: tokens.totalTokens },
      }).catch(() => {});
    } catch {
      // non-fatal
    }
  } catch (err) {
    console.warn("[AIUsageLog] Failed to record usage:", err.message);
  }
}

async function getUserContextForGrants(userId) {
  if (!userId) return null;
  const userDoc = await User.findById(userId)
    .select("fullname email publicId role isSuperAdmin department")
    .populate("department", "name")
    .lean();
  if (!userDoc) return null;
  const userProjects = await Project.find({ members: userId }).select("_id name").lean();
  return {
    userDoc,
    isSuperAdmin: Boolean(userDoc.isSuperAdmin || userDoc.role === "superadmin"),
    departmentId: userDoc.department?._id || userDoc.department || null,
    projectIds: userProjects.map((p) => p._id),
  };
}

async function getUserGlobalGrantsSummary(userId) {
  const ctx = await getUserContextForGrants(userId);
  if (!ctx) return { isSuperAdmin: false, grants: [] };
  if (ctx.isSuperAdmin) {
    return { isSuperAdmin: true, grants: [] };
  }
  const orConditions = [{ targetType: "user", targetId: userId }];
  if (ctx.departmentId) {
    orConditions.push({ targetType: "department", targetId: ctx.departmentId });
  }
  if (ctx.projectIds.length > 0) {
    orConditions.push({ targetType: "project", targetId: { $in: ctx.projectIds } });
  }
  const grants = await AIGlobalGrant.find({ isActive: true, $or: orConditions })
    .sort({ createdAt: -1 })
    .lean();
  return { isSuperAdmin: false, grants };
}

async function findActiveGlobalGrant({ userCtx, providerKey, moduleKey, projectId, departmentId }) {
  if (!userCtx) return null;
  const orConditions = [{ targetType: "user", targetId: userCtx.userDoc._id }];
  const deptIds = [departmentId, userCtx.departmentId].filter(Boolean);
  if (deptIds.length > 0) {
    orConditions.push({ targetType: "department", targetId: { $in: deptIds } });
  }
  const projIds = [...new Set([...(userCtx.projectIds || []).map(String), ...(projectId ? [String(projectId)] : [])])];
  if (projIds.length > 0) {
    orConditions.push({ targetType: "project", targetId: { $in: projIds } });
  }

  const grants = await AIGlobalGrant.find({
    isActive: true,
    provider: { $in: ["all", ...(providerKey ? [providerKey] : [])] },
    allowedModules: { $in: ["*", moduleKey] },
    $or: orConditions,
  }).lean();

  if (!grants.length) return null;
  const priority = { user: 1, project: 2, department: 3 };
  grants.sort((a, b) => (priority[a.targetType] || 9) - (priority[b.targetType] || 9));
  return grants[0];
}

/**
 * Resolve which provider, model, and decrypted API key should handle an AI request.
 * Policy:
 * 1. Unless `preferGlobal` is set, check User BYOK key for `(moduleKey || "all")` & provider first.
 * 2. Otherwise allow Global Key (`superadmin_vault` or `.env`) ONLY if:
 *    - Caller is Superadmin (`isSuperAdmin`), OR
 *    - Internal system global task (`!userId && taskType === "global_task"`), OR
 *    - Caller has an active `AIGlobalGrant` (directly, via Department, or via Project/Team) covering `provider` and `moduleKey`.
 */
async function resolveExecutionCredentials({
  providerKey,
  requestedModel,
  taskType = "global_task",
  moduleKey = "global",
  userId = null,
  projectId = null,
  departmentId = null,
  preferGlobal = false,
}) {
  let targetProviderKey = providerKey;
  let targetModel = requestedModel;

  if (requestedModel && !targetProviderKey) {
    const match = findCatalogModel(requestedModel);
    if (match) targetProviderKey = match.provider.key;
  }

  const userCtx = userId ? await getUserContextForGrants(userId) : null;

  // 1. Check User BYOK encrypted key first when a userId is supplied (unless preferGlobal is true)
  if (userId && !preferGlobal) {
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
        credentialScope: "user_byok",
        keyId: activeUserEntry?._id ? String(activeUserEntry._id) : String(userCfg._id),
        keyLabel: activeUserEntry?.label || "Personal BYOK Key",
        maskedKey: activeUserEntry?.maskedKey || userCfg.maskedKey || "",
        grantId: null,
        grantTargetType: "self_byok",
        grantTargetName: userCtx?.userDoc?.fullname || "Personal BYOK",
        userSnapshot: userCtx?.userDoc || null,
        thinkingLevel: userCfg.thinkingLevel || "low",
      };
    }
  }

  // Pick global provider (if caller omitted providerKey, prefer isGlobalDefault, or a provider matching user's active grant & configured credentials)
  let globalCfg = null;
  if (targetProviderKey) {
    globalCfg = await AIConfig.findOne({ scope: "global", provider: targetProviderKey, owner: null })
      .select("+encryptedKey +keys.encryptedKey")
      .lean();
  } else {
    const allGlobalCfgs = await AIConfig.find({ scope: "global", enabled: true, owner: null })
      .select("+encryptedKey +keys.encryptedKey")
      .lean();

    const cfgHasUsableKey = (c) => {
      if (!c) return false;
      const entry = c.keys?.find((k) => String(k._id) === String(c.activeKeyId)) || c.keys?.[0];
      const hasVault = Boolean((entry?.encryptedKey || c.encryptedKey)?.ciphertext);
      const hasEnv = Boolean(getEnvKeyForProvider(c.provider)?.rawKey);
      return c.keySource === "superadmin_vault" ? hasVault : hasEnv || hasVault;
    };

    const candidateProviders = [];
    const defaultCfg = allGlobalCfgs.find((c) => c.isGlobalDefault && cfgHasUsableKey(c));
    if (defaultCfg) candidateProviders.push(defaultCfg.provider);
    ["google", "openai", "anthropic"].forEach((p) => {
      const cfg = allGlobalCfgs.find((c) => c.provider === p);
      if (getEnvKeyForProvider(p)?.rawKey || cfgHasUsableKey(cfg)) {
        if (!candidateProviders.includes(p)) candidateProviders.push(p);
      }
    });

    if (userCtx && !userCtx.isSuperAdmin) {
      for (const pKey of candidateProviders) {
        const g = await findActiveGlobalGrant({
          userCtx,
          providerKey: pKey,
          moduleKey,
          projectId,
          departmentId,
        });
        if (g) {
          targetProviderKey = pKey;
          globalCfg = allGlobalCfgs.find((c) => c.provider === pKey) || null;
          break;
        }
      }
    } else if (candidateProviders.length > 0) {
      targetProviderKey = candidateProviders[0];
      globalCfg = allGlobalCfgs.find((c) => c.provider === targetProviderKey) || null;
    }
  }

  // 2. Enforce Global Key Grant / Superadmin Guard
  let matchedGrant = null;
  let grantTargetType = "system";
  let grantTargetName = "Global Platform";

  if (userCtx) {
    if (userCtx.isSuperAdmin) {
      grantTargetType = "superadmin";
      grantTargetName = userCtx.userDoc.fullname || "Superadmin";
    } else {
      matchedGrant = await findActiveGlobalGrant({
        userCtx,
        providerKey: targetProviderKey,
        moduleKey,
        projectId,
        departmentId,
      });
      if (!matchedGrant) {
        const err = new Error(
          `Access denied: No personal BYOK key configured and no Global AI Key grant exists for module '${moduleKey}'.`
        );
        err.statusCode = 403;
        err.deniedMeta = {
          userId,
          userSnapshot: userCtx.userDoc,
          provider: targetProviderKey || "unknown",
          model: targetModel || "",
          moduleKey,
          taskType,
          projectId,
          departmentId,
        };
        throw err;
      }
      grantTargetType = matchedGrant.targetType;
      grantTargetName = matchedGrant.targetName || matchedGrant.targetType;
    }
  } else if (taskType !== "global_task") {
    throw new Error(
      `Personal API key or Global Grant required for module '${moduleKey}'.`
    );
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
      credentialScope: "global_vault",
      keyId: activeVaultEntry?._id ? String(activeVaultEntry._id) : String(globalCfg._id),
      keyLabel: activeVaultEntry?.label || "Superadmin Vault Key",
      maskedKey: activeVaultEntry?.maskedKey || globalCfg.maskedKey || "",
      grantId: matchedGrant?._id || null,
      grantTargetType,
      grantTargetName,
      userSnapshot: userCtx?.userDoc || null,
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
      credentialScope: "global_env",
      keyId: "env",
      keyLabel: `.env (${envInfo.envVar})`,
      maskedKey: envInfo.maskedKey || "",
      grantId: matchedGrant?._id || null,
      grantTargetType,
      grantTargetName,
      userSnapshot: userCtx?.userDoc || null,
      thinkingLevel,
    };
  }

  if (vaultEnc?.ciphertext) {
    return {
      providerKey: targetProviderKey,
      model: resolvedModel,
      apiKey: decryptSecret(vaultEnc),
      keySource: "superadmin_vault",
      credentialScope: "global_vault",
      keyId: activeVaultEntry?._id ? String(activeVaultEntry._id) : String(globalCfg._id),
      keyLabel: activeVaultEntry?.label || "Superadmin Vault Key",
      maskedKey: activeVaultEntry?.maskedKey || globalCfg.maskedKey || "",
      grantId: matchedGrant?._id || null,
      grantTargetType,
      grantTargetName,
      userSnapshot: userCtx?.userDoc || null,
      thinkingLevel,
    };
  }

  throw new Error(`No API key available for provider '${targetProviderKey}' (neither encrypted vault nor .env)`);
}

/**
 * Read a Node HTTP SSE stream into accumulated full text and usage metadata, calling onChunk with partial text.
 */
function parseSSEStream(stream, extractDeltaFn, extractUsageFn, onChunk) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let fullText = "";
    let usage = null;

    stream.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;
        try {
          const evt = JSON.parse(dataStr);
          const delta = extractDeltaFn(evt);
          if (delta) {
            fullText += delta;
            if (typeof onChunk === "function") onChunk(fullText, delta);
          }
          const u = extractUsageFn?.(evt);
          if (u) usage = u;
        } catch {
          // ignore partial or non-JSON keepalive frame
        }
      }
    });
    stream.on("end", () => resolve({ text: fullText, usage }));
    stream.on("error", (err) => reject(err));
  });
}

async function callOpenAIResponses({ apiKey, model, prompt, systemPrompt, maxOutputTokens, attachments = [], timeoutMs = 45000, signal, onChunk }) {
  const userContent = [{ type: "input_text", text: prompt }];
  for (const att of attachments || []) {
    if (att.kind === "image" && att.base64) {
      userContent.push({
        type: "input_image",
        image_url: `data:${att.mimeType || "image/png"};base64,${att.base64}`,
      });
    }
  }
  const input = systemPrompt
    ? [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent.length > 1 ? userContent : prompt },
      ]
    : userContent.length > 1
    ? [{ role: "user", content: userContent }]
    : prompt;

  const isStreaming = typeof onChunk === "function";
  const res = await axios.post(
    "https://api.openai.com/v1/responses",
    {
      model,
      input,
      max_output_tokens: maxOutputTokens,
      ...(isStreaming ? { stream: true } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      responseType: isStreaming ? "stream" : "json",
      timeout: timeoutMs,
      ...(signal ? { signal } : {}),
    }
  );

  if (isStreaming) {
    return parseSSEStream(
      res.data,
      (evt) => (evt.type === "response.output_text.delta" ? evt.delta || "" : ""),
      (evt) => evt.response?.usage || evt.usage || null,
      onChunk
    );
  }

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

async function callAnthropicMessages({ apiKey, model, prompt, systemPrompt, maxOutputTokens, attachments = [], timeoutMs = 45000, signal, onChunk }) {
  const blocks = [];
  for (const att of attachments || []) {
    if (att.kind === "image" && att.base64) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mimeType || "image/png",
          data: att.base64,
        },
      });
    }
  }
  blocks.push({ type: "text", text: prompt });

  const isStreaming = typeof onChunk === "function";
  const body = {
    model,
    max_tokens: maxOutputTokens,
    ...(isStreaming ? { stream: true } : {}),
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: blocks.length > 1 ? blocks : prompt }],
  };

  const res = await axios.post("https://api.anthropic.com/v1/messages", body, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2026-10-21",
      "Content-Type": "application/json",
    },
    responseType: isStreaming ? "stream" : "json",
    timeout: timeoutMs,
    ...(signal ? { signal } : {}),
  });

  if (isStreaming) {
    return parseSSEStream(
      res.data,
      (evt) => (evt.type === "content_block_delta" ? evt.delta?.text || "" : ""),
      (evt) => evt.usage || evt.message?.usage || null,
      onChunk
    );
  }

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
  jsonMode = false,
  attachments = [],
  timeoutMs = 45000,
  signal,
  onChunk,
}) {
  const catalogMatch = findCatalogModel(model);
  const endpointVersion = catalogMatch?.model?.endpointMode?.startsWith("v1beta") ? "v1beta" : "v1";
  const supportsThinking =
    (catalogMatch?.model?.supportsThinkingLevel || /^gemini-(3\.[6-9]|4)/.test(model)) &&
    !model.includes("flash-lite");

  const generationConfig = { maxOutputTokens };
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }
  if (supportsThinking) {
    generationConfig.thinkingConfig = {
      thinkingLevel: thinkingLevel === "minimal" ? "low" : thinkingLevel || "low",
    };
  } else {
    generationConfig.temperature = 0.2;
  }

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const parts = [{ text: fullPrompt }];
  for (const att of attachments || []) {
    if (att.kind === "image" && att.base64) {
      parts.push({
        inlineData: {
          mimeType: att.mimeType || "image/png",
          data: att.base64,
        },
      });
    }
  }
  const isStreaming = typeof onChunk === "function";
  const url = isStreaming
    ? `https://generativelanguage.googleapis.com/${endpointVersion}/models/${model}:streamGenerateContent?alt=sse`
    : `https://generativelanguage.googleapis.com/${endpointVersion}/models/${model}:generateContent`;

  const res = await axios.post(
    url,
    {
      contents: [{ parts }],
      generationConfig,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      responseType: isStreaming ? "stream" : "json",
      timeout: timeoutMs,
      ...(signal ? { signal } : {}),
    }
  );

  if (isStreaming) {
    return parseSSEStream(
      res.data,
      (evt) => evt.candidates?.[0]?.content?.parts?.[0]?.text || "",
      (evt) => evt.usageMetadata || null,
      onChunk
    );
  }

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
  projectId = null,
  departmentId = null,
  preferGlobal = false,
  maxOutputTokens = 1000,
  thinkingLevel,
  jsonMode = false,
  attachments = [],
  timeoutMs = 35000,
  signal,
  onChunk,
}) {
  const startedAt = Date.now();
  let creds = null;
  try {
    creds = await resolveExecutionCredentials({
      providerKey: provider,
      requestedModel: model,
      taskType,
      moduleKey,
      userId,
      projectId,
      departmentId,
      preferGlobal,
    });

    const adapter = PROVIDER_ADAPTERS[creds.providerKey];
    if (!adapter) {
      throw new Error(`Unsupported AI provider adapter: ${creds.providerKey}`);
    }

    let result;
    let usedModel = creds.model;
    try {
      result = await adapter({
        apiKey: creds.apiKey,
        model: usedModel,
        prompt,
        systemPrompt,
        maxOutputTokens,
        thinkingLevel: thinkingLevel || creds.thinkingLevel || "low",
        jsonMode,
        attachments,
        timeoutMs,
        signal,
        onChunk,
      });
    } catch (callErr) {
      if (signal?.aborted || callErr?.code === "ERR_CANCELED" || callErr?.name === "CanceledError") {
        const abortErr = new Error("Request cancelled by user");
        abortErr.isAborted = true;
        throw abortErr;
      }
      const status = callErr?.response?.status;
      const apiMsg = callErr?.response?.data?.error?.message || callErr?.message || "";
      const isTimeout = callErr?.code === "ECONNABORTED" || /timeout/i.test(apiMsg);
      if (
        (isTimeout || status === 503 || status === 429 || status === 502 || status === 404 || (status === 400 && /thinking|model|not found|stream/i.test(apiMsg))) &&
        creds.providerKey === "google" &&
        usedModel !== "gemini-3.5-flash-lite"
      ) {
        usedModel = "gemini-3.5-flash-lite";
        result = await adapter({
          apiKey: creds.apiKey,
          model: usedModel,
          prompt,
          systemPrompt,
          maxOutputTokens,
          thinkingLevel: "low",
          jsonMode,
          attachments,
          timeoutMs: Math.max(timeoutMs, 25000),
          signal,
        });
      } else {
        const cleanErr = new Error(apiMsg || "AI provider request failed");
        cleanErr.statusCode = status || callErr?.statusCode;
        throw cleanErr;
      }
    }
    creds.model = usedModel;

    const latencyMs = Date.now() - startedAt;
    await recordAIUsageLog({
      userId,
      userSnapshot: creds.userSnapshot,
      provider: creds.providerKey,
      model: creds.model,
      moduleKey,
      taskType,
      credentialScope: creds.credentialScope,
      keyId: creds.keyId,
      keyLabel: creds.keyLabel,
      maskedKey: creds.maskedKey,
      grantId: creds.grantId,
      grantTargetType: creds.grantTargetType,
      grantTargetName: creds.grantTargetName,
      projectId,
      departmentId,
      status: "success",
      latencyMs,
      usage: result.usage,
    });

    return {
      success: true,
      provider: creds.providerKey,
      model: creds.model,
      keySource: creds.keySource,
      credentialScope: creds.credentialScope,
      keyLabel: creds.keyLabel,
      grantTargetType: creds.grantTargetType,
      grantTargetName: creds.grantTargetName,
      text: result.text,
      usage: result.usage,
      latencyMs,
    };
  } catch (err) {
    if (err?.isAborted) {
      throw err;
    }
    const latencyMs = Date.now() - startedAt;
    const isDenied = err.statusCode === 403 || Boolean(err.deniedMeta);
    await recordAIUsageLog({
      userId,
      userSnapshot: creds?.userSnapshot || err.deniedMeta?.userSnapshot || null,
      provider: creds?.providerKey || err.deniedMeta?.provider || provider || "unknown",
      model: creds?.model || err.deniedMeta?.model || model || "",
      moduleKey,
      taskType,
      credentialScope: creds?.credentialScope || "none",
      keyId: creds?.keyId || "",
      keyLabel: creds?.keyLabel || "",
      maskedKey: creds?.maskedKey || "",
      grantId: creds?.grantId || null,
      grantTargetType: isDenied ? "denied" : creds?.grantTargetType || "system",
      grantTargetName: creds?.grantTargetName || "",
      projectId,
      departmentId,
      status: isDenied ? "denied" : "failed",
      latencyMs,
      errorMessage: err.message,
    });
    throw err;
  }
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

const EMBEDDING_DIMS = 128;

function l2NormalizeVector(vec) {
  let normSq = 0;
  for (let i = 0; i < vec.length; i++) normSq += vec[i] * vec[i];
  if (normSq === 0) return vec;
  const inv = 1 / Math.sqrt(normSq);
  return vec.map((v) => Number((v * inv).toFixed(6)));
}

/**
 * Compute cosine similarity in [-1, 1] between two numeric vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function fnv1aHash(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * Fast, deterministic 128-dim local feature-hashed embedding (word unigrams + char trigrams)
 * used as zero-cost offline fallback when no embedding API key is reachable.
 */
function localEmbedText(text, dims = EMBEDDING_DIMS) {
  const vec = new Array(dims).fill(0);
  const clean = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return vec;

  const words = clean.split(" ").filter(Boolean).slice(0, 160);
  const addFeature = (token, weight) => {
    const idx = fnv1aHash(token, 2166136261) % dims;
    const sign = (fnv1aHash(token, 16777619) & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  };

  for (const w of words) {
    addFeature(`w:${w}`, 1.0);
    if (w.length >= 3) {
      const padded = `_${w}_`;
      for (let i = 0; i <= padded.length - 3; i++) {
        addFeature(`c:${padded.slice(i, i + 3)}`, 0.4);
      }
    }
  }
  return l2NormalizeVector(vec);
}

/**
 * Generate a 128-dim normalized embedding vector using configured Google/OpenAI embedding
 * credentials when available, with automatic fallback to `localEmbedText`.
 */
async function generateEmbeddingVector(text, { userId = null, allowRemote = true } = {}) {
  const clean = String(text || "").trim().slice(0, 4000);
  if (!clean) return new Array(EMBEDDING_DIMS).fill(0);

  if (allowRemote && !process.env.DISABLE_REMOTE_EMBEDDINGS) {
    for (const providerKey of ["openai", "google"]) {
      try {
        const creds = await resolveExecutionCredentials({
          providerKey,
          requestedModel: providerKey === "openai" ? "text-embedding-3-small" : "gemini-embedding-001",
          taskType: "global_task",
          moduleKey: "assistant",
          userId: null, // Global / system credential lookup without spamming per-user denied logs
          preferGlobal: true,
        });
        if (!creds?.apiKey) continue;

        if (providerKey === "openai") {
          const resp = await axios.post(
            "https://api.openai.com/v1/embeddings",
            {
              model: "text-embedding-3-small",
              input: clean,
              dimensions: EMBEDDING_DIMS,
            },
            {
              headers: {
                Authorization: `Bearer ${creds.apiKey}`,
                "Content-Type": "application/json",
              },
              timeout: 3500,
            }
          );
          const emb = resp?.data?.data?.[0]?.embedding;
          if (Array.isArray(emb) && emb.length === EMBEDDING_DIMS) {
            return l2NormalizeVector(emb);
          }
        } else if (providerKey === "google") {
          const embedModel = "gemini-embedding-001";
          const resp = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${embedModel}:embedContent?key=${encodeURIComponent(
              creds.apiKey
            )}`,
            {
              model: `models/${embedModel}`,
              content: { parts: [{ text: clean }] },
              outputDimensionality: EMBEDDING_DIMS,
            },
            {
              headers: { "Content-Type": "application/json" },
              timeout: 3500,
            }
          );
          const emb = resp?.data?.embedding?.values;
          if (Array.isArray(emb) && emb.length === EMBEDDING_DIMS) {
            return l2NormalizeVector(emb);
          }
        }
      } catch {
        // Silently fall through to next provider or deterministic local vector
      }
    }
  }

  return localEmbedText(clean, EMBEDDING_DIMS);
}

module.exports = {
  resolveExecutionCredentials,
  queryAI,
  testRawAIKey,
  recordAIUsageLog,
  getUserGlobalGrantsSummary,
  cosineSimilarity,
  localEmbedText,
  generateEmbeddingVector,
};

