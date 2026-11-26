const dns = require("dns").promises;
const net = require("net");
const ActionLog = require("../models/actionLogModel");
const { recordAIUsageLog } = require("./aiService");
const { isSuperAdminUser } = require("../utils/roles");
const { enqueueWebSocketEvent } = require("./queue");
const { getIO } = require("../config/socket");
const { escapeRegex } = require("../utils/envSecrets");

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const hasPerm = (user, slug) => {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes("*")) return true;
  if (!slug) return true;
  if (perms.includes(slug)) return true;
  const [mod, act] = String(slug).split(".");
  if (perms.includes(`${mod}.*`)) return true;
  const mods = Array.isArray(user.modules) ? user.modules : [];
  if (act === "view" && (mods.includes("*") || mods.includes(mod))) return true;
  return false;
};

/**
 * Determine whether a resolved IPv4 or IPv6 address belongs to loopback, link-local, CGNAT,
 * cloud metadata, or private RFC1918 / ULA ranges.
 */
function isPrivateOrReservedIp(ip) {
  const clean = String(ip || "").trim().toLowerCase();
  if (!clean) return true;

  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  if (clean.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(clean.slice(7));
  }

  const version = net.isIP(clean);
  if (version === 4) {
    const parts = clean.split(".").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 127) return true; // 0.0.0.0/8, 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC1918
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT / Tailscale
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (version === 6) {
    if (clean === "::" || clean === "::1") return true; // unspecified / loopback
    if (clean.startsWith("fe8") || clean.startsWith("fe9") || clean.startsWith("fea") || clean.startsWith("feb")) {
      return true; // fe80::/10 link-local
    }
    if (clean.startsWith("fc") || clean.startsWith("fd")) return true; // fc00::/7 unique local address
    if (clean.startsWith("ff")) return true; // ff00::/8 multicast
    return false;
  }

  return true;
}

/**
 * Top-level SSRF-safe external HTTP(S) URL validator.
 * Rejects non-HTTP(S) schemes, URLs with credentials, internal hostnames, decimal/hex IP encodings,
 * IPv4-mapped IPv6, and any DNS target resolving to private/loopback/metadata ranges.
 */
async function assertSafeWebUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Invalid URL format");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credentials inside URLs are not allowed");
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const internalHostnames = new Set(["localhost", "mongo", "redis", "minio", "nginx", "metadata.google.internal"]);
  if (
    !host ||
    internalHostnames.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    /^\d+$/.test(host) || // Decimal integer IPs like 2130706433
    /^0x[0-9a-f]+$/i.test(host) // Hex IPs
  ) {
    throw new Error("Internal or loopback host URLs are blocked by policy");
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error("Private, loopback, or reserved IP URLs are blocked by policy");
    }
    return parsed.toString();
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("Target hostname could not be resolved");
    }
    if (records.some((r) => isPrivateOrReservedIp(r.address))) {
      throw new Error("Target resolves to private or internal network space and is blocked by policy");
    }
  } catch (err) {
    if (err.message?.includes("blocked") || err.message?.includes("resolved")) {
      throw err;
    }
    throw new Error("Target hostname DNS lookup failed or could not be verified");
  }

  return parsed.toString();
}

function sanitizeCopilotHtmlServer(html = "") {
  if (!html || typeof html !== "string") return "";
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(iframe|object|embed|form|link|meta|base|applet)\b[^>]*>/gi, "")
    .replace(/<input\b(?![^>]*\btype\s*=\s*["']?(?:checkbox|radio)\b)[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action|xlink:href)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi, "")
    .trim()
    .slice(0, 16000);
}

function sanitizeArtifactsServer(rawArtifacts = []) {
  if (!Array.isArray(rawArtifacts)) return [];
  const allowedTypes = new Set(["chart", "table", "csv", "pdf", "ppt", "image"]);
  return rawArtifacts
    .filter((a) => a && allowedTypes.has(String(a.type || "").toLowerCase()))
    .slice(0, 4)
    .map((a) => {
      const copy = { ...a, type: String(a.type).toLowerCase() };
      if (copy.type === "image" && typeof copy.svgMarkup === "string") {
        copy.svgMarkup = copy.svgMarkup
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
          .replace(/href\s*=\s*"\s*javascript:[^"]*"/gi, "");
      }
      return copy;
    });
}

const SECURITY_TYPO_FIXES = [
  [/\b(delte|deleet|delet|dlete|del|erase|scrub|cleanse|purge)\b/gi, "delete"],
  [/\b(audi|audt|audti)\b/gi, "audit"],
  [/\b(reveel|reval|shw)\b/gi, "reveal"],
  [/\b(systm)\b/gi, "system"],
  [/\b(prmpt)\b/gi, "prompt"],
  [/\b(projcts?)\b/gi, "projects"],
  [/\b(departmnts?|departemtns?)\b/gi, "departments"],
];

function decodeLeetspeakAndBase64(text) {
  const leet = String(text || "")
    .replace(/0/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t");

  const decodedSegments = [];
  const b64Matches = String(text || "").match(/\b[A-Za-z0-9+/]{16,}={0,2}\b/g) || [];
  for (const token of b64Matches.slice(0, 4)) {
    try {
      const buf = Buffer.from(token, "base64").toString("utf8");
      if (/^[\x20-\x7E\r\n\t]+$/.test(buf) && /[a-zA-Z]{3}/.test(buf)) {
        decodedSegments.push(buf);
      }
    } catch {
      // ignore non-base64 strings
    }
  }
  return [text, leet, ...decodedSegments].join("\n");
}

function normalizeSecurityCandidates(rawPrompt) {
  const clean = String(rawPrompt || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const expanded = decodeLeetspeakAndBase64(clean);
  let normalized = expanded;
  for (const [rx, rep] of SECURITY_TYPO_FIXES) {
    normalized = normalized.replace(rx, rep);
  }
  return { rawClean: clean, normalized };
}

/**
 * Classify prompt and attachment payloads for security, compliance, and RBAC misuse
 * before invoking external LLMs or action planners.
 */
function classifyPromptSecurity({ prompt, user, attachments = [] }) {
  const { rawClean, normalized } = normalizeSecurityCandidates(prompt);
  const p = normalized.toLowerCase();
  const isSuper = isSuperAdminUser(user);

  // Scan attachment extracted text for embedded prompt injection or architecture probes
  const combinedAttachmentText = (Array.isArray(attachments) ? attachments : [])
    .map((a) => String(a?.extractedText || ""))
    .join("\n")
    .slice(0, 12000);
  if (
    combinedAttachmentText &&
    /\bignore\s+(all\s+|previous\s+|above\s+)?instructions\b|\breveal\s+(the\s+|your\s+)?(system\s*prompt|secrets?|api\s*keys?|\.env)\b/i.test(
      combinedAttachmentText
    )
  ) {
    return {
      blocked: true,
      misuseCategory: "architecture_probe",
      warning:
        "Security Alert: Prompt injection instructions detected inside an attached document. Request blocked and logged.",
    };
  }

  // 1. Immutable Compliance Guard: Audit & security logs cannot be altered or deleted by anyone
  const auditTamperPatterns = [
    /\b(delete|clear|wipe|purge|remove|erase|truncate|drop|modify|edit|tamper|alter|hide|disable|turn\s*off|scrub|cleanse)\b.{0,40}\b(audit\s*logs?|action\s*logs?|system\s*logs?|security\s*logs?|misuse\s*logs?|ai\s*usage\s*logs?|audit\s*trail|compliance\s*(history|records?|logs?)|history\s*logs?|telemetry|logging)\b/i,
  ];
  if (auditTamperPatterns.some((rx) => rx.test(normalized))) {
    return {
      blocked: true,
      misuseCategory: "audit_tampering",
      warning:
        "Security Alert: Audit logs and compliance trails are immutable records and cannot be deleted, disabled, or modified.",
    };
  }

  // 2. Credential / Secret / Vault Exfiltration Guard (blocked for all users)
  const credentialPatterns = [
    /\b(dump|extract|leak|reveal|print|show|export|list|give\s+me|decrypt|decode)\b.{0,35}\b(passwords?|password\s*hash(?:es)?|bcrypt|jwt[\s_-]?secret|aes[\s_-]?key|ciphertext|encrypted[\s_-]?key|private[\s_-]?key|plaintext\s*(api\s*)?keys?|raw\s*(api\s*)?keys?|vault\s*keys?|session\s*tokens?|cookies?|\.env\b|process\.env)\b/i,
  ];
  if (credentialPatterns.some((rx) => rx.test(normalized))) {
    return {
      blocked: true,
      misuseCategory: "credential_exfiltration",
      warning:
        "Security Alert: Accessing plaintext credentials, vault secrets, tokens, or environment keys is prohibited and logged.",
    };
  }

  // 3. Privilege Escalation Guard (blocked for non-Superadmin)
  if (
    !isSuper &&
    /\b(make\s+me|promote\s+me\s+to|elevate\s+(my\s+)?role\s+to|grant\s+myself|give\s+myself)\b.{0,25}\b(superadmin|admin|all\s+modules|global\s*key|\*)\b|\b(bypass|disable|circumvent)\b.{0,25}\b(rbac|permissions?|auth|security\s*policy|access\s*control)\b/i.test(
      normalized
    )
  ) {
    return {
      blocked: true,
      misuseCategory: "privilege_escalation",
      warning:
        "Security Alert: Privilege escalation or bypassing RBAC access controls is prohibited and logged.",
    };
  }

  // 4. Destructive Full-System Wipe Guard (Superadmin allowed bulk workspace/seeded cleanup)
  const dbNukePatterns = [
    /\b(wipe|nuke|destroy|drop|erase)\b.{0,25}\b(database|mongodb|entire\s*system|all\s+collections?)\b/i,
  ];
  if (dbNukePatterns.some((rx) => rx.test(normalized))) {
    return {
      blocked: true,
      misuseCategory: "destructive_wipe",
      warning:
        "Security Alert: Database-level wipe or drop requests are blocked by security policy.",
    };
  }

  if (
    !isSuper &&
    /\b(delete|remove|wipe|purge|clear)\s+(all|the\s+seeded)\b.{0,30}\b(departments?|projects?|workspaces?|users?|members?|roles?|tasks?|data)\b|\b(wipe|nuke|destroy|erase)\b.{0,25}\b(entire\s*workspace|everything|all\s+data)\b/i.test(
      normalized
    )
  ) {
    return {
      blocked: true,
      misuseCategory: "destructive_wipe",
      warning:
        "Security Alert: Bulk deletion of workspace entities is restricted to Superadmin and has been logged.",
    };
  }

  // 5. Architecture Probe & Prompt Injection Guard
  const archPatterns = [
    /\bsystem\s*prompt\b/i,
    /\bignore\s+(all\s+|previous\s+|above\s+)?instructions\b/i,
    /\breveal\s+(the\s+|your\s+)?(prompt|architecture|schema|code|keys|secrets|backend|database)\b/i,
    /\b(source\s*code|backend\s*code|controller\s*code|mongoose\s*schema|db\s*schema|mongodb\s*uri)\b/i,
    /\b(how\s+(is|was)\s+(this|the)\s+(website|app|backend|system)\s+built|tech\s*stack|internal\s*architecture)\b/i,
  ];
  if (archPatterns.some((rx) => rx.test(normalized))) {
    return {
      blocked: true,
      misuseCategory: "architecture_probe",
      warning:
        "Security Alert: Requesting system internals, architecture details, prompts, or source code is blocked and logged.",
    };
  }

  // 6. Off-topic Media / Malware / Exploits Guard
  const imageGenPatterns = [
    /\b(generate|create|draw|paint|render|make)\b.{0,25}\b(an?\s+)?(image|picture|photo|logo|wallpaper|illustration|artwork|meme|avatar)\b/i,
    /\b(dall-?e|midjourney|stable\s*diffusion|imagen|nano\s*banana)\b/i,
  ];
  const abusePatterns = [
    /\b(sql\s*injection|xss\s*payload|reverse\s*shell|exploit|brute\s*force|bypass\s*auth|phishing\s*email|keylogger|ransomware|malware|ddos|credential\s*stuffing)\b/i,
  ];
  const offTopicCodePatterns = [
    /\bwrite\s+(me\s+)?(a\s+)?(python|java|c\+\+|rust|golang|php|ruby|bash|shell|html|css|sql)\s+(script|program|code|function|scraper|bot)\b/i,
    /\b(leetcode|binary\s*search|quicksort|fibonacci|regex\s*homework|solve\s+this\s+math|weather\s+today|recipe\s+for|write\s+a\s+poem|essay\s+on)\b/i,
  ];

  const isWorkspaceTaskFraming =
    /\b(task|ticket|bug|project|request|department|sprint|board|chat|dm|message)\b/i.test(p) &&
    /\b(create|assign|open|update|submit|move|review|navigate|show|find|list|status|send|post)\b/i.test(p);

  if (
    imageGenPatterns.some((rx) => rx.test(rawClean)) ||
    abusePatterns.some((rx) => rx.test(normalized)) ||
    (offTopicCodePatterns.some((rx) => rx.test(rawClean)) && !isWorkspaceTaskFraming)
  ) {
    return {
      blocked: true,
      misuseCategory: "off_topic_code_or_image",
      warning:
        "Misuse Blocked: Lira AI only assists with authorized workspace operations — exploit payloads, image generation, and off-topic scripts are prohibited and logged.",
    };
  }

  // 7. RBAC Module Privilege Probes aligned strictly to MODULES_CATALOG & roleRoutes slugs
  if (!isSuper) {
    const hasAny = (perms) => perms.some((perm) => hasPerm(user, perm));
    const privilegeProbes = [
      { rx: /\b(audit\s*logs?|system\s*logs?|online\s*users?\s*sessions?|misuse\s*logs?)\b/i, perms: ["audit.view", "dashboard.logs"] },
      { rx: /\b(superadmin\s*vault|global\s*(ai\s*)?key|ai\s*vault|grant\s*ai\s*access|revoke\s*ai)\b/i, perms: ["ai.manage"] },
      { rx: /\b(create|edit|update|delete|modify)\s+(a\s+|all\s+|new\s+)?(roles?|permissions?|rbac)\b/i, perms: ["__superadmin_only__"] },
      { rx: /\b(assign|change)\s+.{0,20}\brole\b/i, perms: ["team.edit", "rbac.manage"] },
      { rx: /\b(list\s+all\s+roles|all\s+system\s+roles|role\s+permissions?|view\s+roles)\b/i, perms: ["rbac.view", "rbac.manage"] },
      { rx: /\b(approve|reject|decline)\s+(a\s+|the\s+|all\s+)?requests?\b/i, perms: ["requests.approve"] },
      { rx: /\b(delete|remove)\s+(a\s+|the\s+|all\s+)?departments?\b/i, perms: ["departments.delete"] },
      { rx: /\b(create|add|new)\s+(a\s+|new\s+)?departments?\b/i, perms: ["departments.create"] },
      { rx: /\b(edit|update)\s+(a\s+|the\s+)?departments?\b/i, perms: ["departments.edit"] },
      { rx: /\b(delete|remove)\s+(a\s+|the\s+|all\s+)?(projects?|workspaces?)\b/i, perms: ["projects.delete"] },
      { rx: /\b(create|add|new)\s+(a\s+|new\s+)?(projects?|workspaces?)\b/i, perms: ["projects.create"] },
      { rx: /\b(delete|remove|wipe|purge|deactivate)\b.{0,25}\b(users?|members?|accounts?)\b/i, perms: ["team.delete"] },
      { rx: /\b(approve|reject|decline)\b.{0,25}\bjoin\s*requests?\b/i, perms: ["team.join_requests"] },
      { rx: /\b(except|non[\s-]?)\s*superadmins?\b/i, perms: ["__superadmin_only__"] },
    ];
    for (const check of privilegeProbes) {
      if (check.rx.test(normalized) && !hasAny(check.perms)) {
        return {
          blocked: true,
          misuseCategory: "unauthorized_module",
          warning:
            "Access Denied & Logged: Your role does not have permission for that workspace module or action.",
        };
      }
    }
  }

  return { blocked: false };
}

async function recordMisuseAudit({ user, prompt, misuseCategory, warning, moduleKey = "assistant" }) {
  const sanitizedSnippet = String(prompt || "").replace(/\s+/g, " ").trim().slice(0, 220);
  await Promise.all([
    recordAIUsageLog({
      userId: user?._id || null,
      provider: "unknown",
      model: "",
      moduleKey,
      taskType: "module_assistant",
      credentialScope: "none",
      grantTargetType: "denied",
      grantTargetName: misuseCategory,
      status: "misuse",
      misuseCategory,
      promptSnippet: sanitizedSnippet,
      errorMessage: warning,
    }),
    ActionLog.create({
      user: user?._id || null,
      userEmail: user?.email || "",
      userRole: user?.role || "",
      publicId: user?.publicId || "",
      action: "AI_MISUSE_BLOCKED",
      method: "POST",
      path: "/v3/ai/assistant/chat",
      statusCode: 403,
      status: "FAILURE",
      details: { misuseCategory, moduleKey, promptSnippet: sanitizedSnippet, warning },
    }).catch(() => {}),
  ]);

  const payload = {
    misuseCategory,
    warning,
    timestamp: new Date(),
  };

  if (user?._id) {
    await enqueueWebSocketEvent({
      target: "user",
      room: String(user._id),
      event: "ai:misuse-warning",
      data: payload,
    });
  }
  await enqueueWebSocketEvent({
    target: "all",
    event: "ai:usage-logged",
    data: { misuseCategory, timestamp: payload.timestamp },
  });

  const io = getIO();
  if (io) {
    if (user?._id) {
      io.to(`user_${user._id}`).emit("ai:misuse-warning", payload);
    }
    io.emit("ai:usage-logged", { misuseCategory, timestamp: payload.timestamp });
  }
}

/**
 * Build interactive next-step choices for any blocked/denied response so the Copilot UI
 * never leaves the user at a dead-end static warning.
 */
function buildDeniedInteractiveActions(misuseCategory = "", user = null) {
  const isSuper = isSuperAdminUser(user);
  const actions = [];

  if (misuseCategory === "audit_tampering" && (isSuper || hasPerm(user, "audit.view") || hasPerm(user, "dashboard.logs"))) {
    actions.push({
      label: "Open Audit Trail (Read-Only)",
      sublabel: "Inspect audit logs and live sessions safely",
      step: { type: "navigate", label: "Open Audit", prefill: { route: "/audit" } },
    });
  } else if (misuseCategory === "unauthorized_module" || misuseCategory === "privilege_escalation") {
    if (isSuper || hasPerm(user, "requests.create")) {
      actions.push({
        label: "Request Access / Approval",
        sublabel: "Submit an official access request",
        replyText: "Help me submit an access request",
      });
    }
    actions.push({
      label: "Open My Day",
      sublabel: "View your assigned tasks",
      step: { type: "navigate", label: "Open My Day", prefill: { route: "/my-work" } },
    });
  } else if (misuseCategory === "credential_exfiltration" || misuseCategory === "architecture_probe") {
    actions.push({
      label: "Manage My AI Keys",
      sublabel: "Configure your personal API keys safely",
      step: { type: "navigate", label: "Open AI Keys", prefill: { route: "/profile?tab=ai" } },
    });
  }

  if (actions.length < 2) {
    actions.push({
      label: "Open Workspace Projects",
      sublabel: "Browse projects and tasks you can access",
      step: { type: "navigate", label: "Open Projects", prefill: { route: "/projects" } },
    });
  }
  return actions.slice(0, 3);
}

module.exports = {
  escapeRegex,
  escapeHtml,
  hasPerm,
  isPrivateOrReservedIp,
  assertSafeWebUrl,
  sanitizeCopilotHtmlServer,
  sanitizeArtifactsServer,
  classifyPromptSecurity,
  recordMisuseAudit,
  buildDeniedInteractiveActions,
};

