const { maskSecret } = require("../utils/cryptoVault");

/**
 * Live Multi-Provider AI Catalog (OpenAI GPT-6, Anthropic Claude 5, Google Gemini 3.5-4)
 */
const AI_PROVIDERS_CATALOG = [
  {
    key: "openai",
    name: "OpenAI API",
    sdkInfo: "openai v3.59.0 · openai-agents v0.25.0 · tiktoken v0.14.0 (o200k_base)",
    endpointNote: "Tool calling on GPT-6.2 uses Responses API (/v1/responses). >272K inputs bill 2x in / 1.5x out.",
    envVarNames: ["OPENAI_API_KEY"],
    defaultModel: "gpt-6.2-sol",
    models: [
      {
        id: "gpt-6.2-astra",
        name: "GPT-6.2 Astra",
        category: "Frontier",
        context: "1.05M",
        maxOut: "128K",
        pricing: "$8.00 / $40.00",
        capabilities: ["text", "tools", "vision", "reasoning"],
        endpointMode: "responses",
      },
      {
        id: "gpt-6.2-sol",
        name: "GPT-6.2 Sol",
        category: "General / Coding",
        context: "1.05M",
        maxOut: "128K",
        pricing: "$2.00 / $10.00",
        capabilities: ["text", "tools", "vision", "coding"],
        endpointMode: "responses",
      },
      {
        id: "gpt-6.1-terra",
        name: "GPT-6.1 Terra",
        category: "Fast Visual / CUA",
        context: "1.05M",
        maxOut: "128K",
        pricing: "$1.00 / $5.00",
        capabilities: ["text", "tools", "vision", "cua"],
        endpointMode: "responses",
      },
      {
        id: "gpt-6-luna",
        name: "GPT-6 Luna",
        category: "High-Volume",
        context: "1.05M",
        maxOut: "128K",
        pricing: "$0.10 / $0.50",
        capabilities: ["text", "tools"],
        endpointMode: "responses",
      },
      {
        id: "gpt-6-cyber",
        name: "GPT-6 Cyber",
        category: "Cybersecurity",
        context: "1.05M",
        maxOut: "128K",
        pricing: "Authorized Daybreak testing",
        capabilities: ["text", "security"],
        endpointMode: "responses",
      },
      {
        id: "gpt-live-1.1",
        name: "GPT-Live 1.1",
        category: "Realtime Voice",
        context: "128K",
        maxOut: "32K",
        pricing: "$0.05/min Live",
        capabilities: ["audio", "realtime"],
        endpointMode: "realtime",
      },
      {
        id: "gpt-realtime-2.1",
        name: "GPT-Realtime 2.1",
        category: "Realtime Voice",
        context: "128K",
        maxOut: "32K",
        pricing: "$32 in audio",
        capabilities: ["audio", "realtime"],
        endpointMode: "realtime",
      },
      {
        id: "gpt-image-2.6-sunburst",
        name: "GPT-Image-2.6 Sunburst",
        category: "Image Gen",
        context: "—",
        maxOut: "—",
        pricing: "$5 text in / $30 image out",
        capabilities: ["image"],
        endpointMode: "images",
      },
      {
        id: "gpt-image-2.6-flare",
        name: "GPT-Image-2.6 Flare",
        category: "Image Gen",
        context: "—",
        maxOut: "—",
        pricing: "$5 text in / $30 image out",
        capabilities: ["image"],
        endpointMode: "images",
      },
    ],
  },
  {
    key: "anthropic",
    name: "Anthropic Claude API",
    sdkInfo: "anthropic-version: 2026-10-21 · anthropic v2.14.0 · claude-agent-sdk v0.2.188",
    endpointNote: "claude-fable-5-2 & claude-opus-5-5 enforce adaptive thinking and reject forced tool_choice (400).",
    envVarNames: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-sonnet-5-5",
    models: [
      {
        id: "claude-fable-5-2",
        name: "Claude Fable 5.2",
        category: "Frontier Reasoning",
        context: "1M",
        maxOut: "128K",
        pricing: "$8.00 / $40.00",
        capabilities: ["text", "tools", "vision", "adaptive_thinking"],
        adaptiveThinking: true,
        endpointMode: "messages",
      },
      {
        id: "claude-mythos-5-2",
        name: "Claude Mythos 5.2",
        category: "Restricted Frontier",
        context: "1M",
        maxOut: "128K",
        pricing: "$8.00 / $40.00 (approval required)",
        capabilities: ["text", "tools", "vision"],
        approvalRequired: true,
        endpointMode: "messages",
      },
      {
        id: "claude-opus-5-5",
        name: "Claude Opus 5.5",
        category: "Agentic Coding",
        context: "1M",
        maxOut: "128K",
        pricing: "$4.00 / $20.00",
        capabilities: ["text", "tools", "vision", "adaptive_thinking"],
        adaptiveThinking: true,
        endpointMode: "messages",
      },
      {
        id: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        category: "Balanced Speed",
        context: "1M",
        maxOut: "128K",
        pricing: "$2.00 / $10.00",
        capabilities: ["text", "tools", "vision"],
        endpointMode: "messages",
      },
      {
        id: "claude-haiku-5-5",
        name: "Claude Haiku 5.5",
        category: "Fast / Subagents",
        context: "1M",
        maxOut: "128K",
        pricing: "From $0.10 / $0.50",
        capabilities: ["text", "tools"],
        endpointMode: "messages",
      },
    ],
  },
  {
    key: "google",
    name: "Google Gemini API",
    sdkInfo: "google-genai v3.6.1 · default endpoint v1 (v1beta for preview/live)",
    endpointNote: "Gemini 3.6+ and 4 deprecate temperature/top_p/top_k; use thinking_level (minimal..xhigh). 2.5 aliases auto-route to 3.8 Flash / 3.5 Flash-Lite.",
    envVarNames: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"],
    defaultModel: "gemini-3.8-flash",
    models: [
      {
        id: "gemini-4-neon",
        name: "Gemini 4 Neon",
        category: "Flagship Reasoning",
        context: "1M",
        maxOut: "64K (1M long)",
        pricing: "$3.00 / $15.00",
        capabilities: ["text", "tools", "vision", "reasoning"],
        supportsThinkingLevel: true,
        endpointMode: "v1_generate",
      },
      {
        id: "gemini-4-carbon",
        name: "Gemini 4 Carbon",
        category: "Deep / Security Reasoning",
        context: "1M",
        maxOut: "64K (1M long)",
        pricing: "$2.00 / $10.00 (intro)",
        capabilities: ["text", "tools", "security", "reasoning"],
        supportsThinkingLevel: true,
        endpointMode: "v1_generate",
      },
      {
        id: "gemini-4-hydrogen",
        name: "Gemini 4 Hydrogen",
        category: "General / Coding",
        context: "1M",
        maxOut: "64K (1M long)",
        pricing: "$1.50 / $7.50",
        capabilities: ["text", "tools", "coding", "vision"],
        supportsThinkingLevel: true,
        endpointMode: "v1_generate",
      },
      {
        id: "gemini-4-argon",
        name: "Gemini 4 Argon",
        category: "Efficient Frontier",
        context: "1M",
        maxOut: "64K",
        pricing: "Lower token spend",
        capabilities: ["text", "tools"],
        supportsThinkingLevel: true,
        endpointMode: "v1_generate",
      },
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        category: "Previous Flash",
        context: "1M",
        maxOut: "64K",
        pricing: "Replaces gemini-2.5-pro",
        capabilities: ["text", "tools", "vision"],
        supportsThinkingLevel: true,
        endpointMode: "v1_generate",
      },
      {
        id: "gemini-3.5-flash-lite",
        name: "Gemini 3.5 Flash-Lite",
        category: "High-Throughput",
        context: "1M",
        maxOut: "64K",
        pricing: "$0.30 / $2.50",
        capabilities: ["text", "tools"],
        endpointMode: "v1_generate",
      },
      {
        id: "gemini-nano-banana-2.1",
        name: "Nano Banana 2.1",
        category: "Multimodal Media",
        context: "—",
        maxOut: "—",
        pricing: "Media Gen",
        capabilities: ["image"],
        endpointMode: "v1beta_media",
      },
      {
        id: "gemini-omni-1.2-flash",
        name: "Gemini Omni 1.2 Flash",
        category: "Multimodal Media",
        context: "1M",
        maxOut: "—",
        pricing: "Image / 4K Video",
        capabilities: ["vision", "video", "audio"],
        endpointMode: "v1beta_media",
      },
      {
        id: "gemini-3.8-live",
        name: "Gemini 3.8 Live",
        category: "Multimodal Media",
        context: "—",
        maxOut: "—",
        pricing: "Live Audio",
        capabilities: ["audio", "realtime"],
        endpointMode: "v1beta_live",
      },
      {
        id: "gemini-embedding-2",
        name: "Gemini Embedding 2",
        category: "Embeddings",
        context: "—",
        maxOut: "—",
        pricing: "Multimodal Embeddings",
        capabilities: ["embedding"],
        endpointMode: "v1_embed",
      },
    ],
  },
];

function getEnvKeyForProvider(providerKey) {
  const provider = AI_PROVIDERS_CATALOG.find((p) => p.key === providerKey);
  if (!provider) return null;
  for (const envVar of provider.envVarNames) {
    const val = process.env[envVar];
    if (val && String(val).trim()) {
      return { envVar, rawKey: String(val).trim(), maskedKey: maskSecret(String(val).trim()) };
    }
  }
  return null;
}

function getAllEnvProvidersSummary() {
  const map = {};
  AI_PROVIDERS_CATALOG.forEach((p) => {
    const found = getEnvKeyForProvider(p.key);
    map[p.key] = {
      configured: Boolean(found),
      envVar: found?.envVar || p.envVarNames[0],
      maskedKey: found?.maskedKey || "",
    };
  });
  return map;
}

function findCatalogModel(modelId) {
  for (const provider of AI_PROVIDERS_CATALOG) {
    const found = provider.models.find((m) => m.id === modelId);
    if (found) return { provider, model: found };
  }
  return null;
}

module.exports = {
  AI_PROVIDERS_CATALOG,
  getEnvKeyForProvider,
  getAllEnvProvidersSummary,
  findCatalogModel,
};

