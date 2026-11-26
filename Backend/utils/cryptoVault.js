const crypto = require("crypto");
const { getJwtSecret } = require("./envSecrets");

/**
 * Derive a deterministic 32-byte AES-256 master key from environment configuration.
 */
function getMasterKeyBuffer() {
  const seed = process.env.AI_MASTER_KEY || getJwtSecret();
  return crypto.createHash("sha256").update(`lira-ai-vault-v1:${seed}`).digest();
}

/**
 * Mask a secret key safely for UI display (never exposes plaintext middle characters).
 */
function maskSecret(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
}

/**
 * Encrypt any plaintext API key or secret using AES-256-GCM.
 * Returns { ciphertext, iv, authTag, keyVersion, maskedKey }.
 */
function encryptSecret(plaintext) {
  if (!plaintext || typeof plaintext !== "string" || !plaintext.trim()) {
    throw new Error("Cannot encrypt an empty secret");
  }
  const clean = plaintext.trim();
  const key = getMasterKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(clean, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    authTag,
    keyVersion: "aes-256-gcm-v1",
    maskedKey: maskSecret(clean),
  };
}

/**
 * Decrypt an AES-256-GCM payload encrypted by encryptSecret().
 */
function decryptSecret(payload) {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.authTag) {
    throw new Error("Invalid encrypted secret payload");
  }
  const key = getMasterKeyBuffer();
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = {
  encryptSecret,
  decryptSecret,
  maskSecret,
};

