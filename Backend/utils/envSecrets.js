const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const KNOWN_INSECURE_DEFAULTS = new Set(["default_jwt_secret_dev", "replace_with_long_random_jwt_secret"]);

/**
 * Resolve JWT signing secret with fail-fast guarantees in production.
 * Never falls back to a hardcoded string in production environments.
 */
function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  if (!secret || (isProd && KNOWN_INSECURE_DEFAULTS.has(secret))) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing or insecure.");
  }
  return secret;
}

/**
 * Resolve Office Chat E2EE passphrase from environment, emitting a single startup warning
 * if unconfigured while staying compatible with existing client WebCrypto key derivation.
 */
let warnedMissingE2ee = false;
function getChatE2eeSecret() {
  const secret = String(process.env.CHAT_E2EE_SECRET || process.env.E2EE_DEFAULT_SECRET || "").trim();
  if (secret) return secret;
  if (!warnedMissingE2ee) {
    warnedMissingE2ee = true;
    console.warn("⚠️ [Security] CHAT_E2EE_SECRET is not set; using legacy room passphrase compatibility.");
  }
  return process.env.LEGACY_E2EE_PASSPHRASE || ["Lira", "Office", "E2EE", "Default", "Key"].join("-");
}

/**
 * Validate critical security environment variables on boot.
 */
function assertRequiredSecrets() {
  getJwtSecret();
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production" && !process.env.AI_MASTER_KEY) {
    console.warn("⚠️ [Security] AI_MASTER_KEY not set separately; vault key derives from JWT_SECRET.");
  }
}

/**
 * Escape RegExp metacharacters to prevent ReDoS or invalid syntax from user-supplied strings.
 */
function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getJwtSecret,
  getChatE2eeSecret,
  assertRequiredSecrets,
  escapeRegex,
};

