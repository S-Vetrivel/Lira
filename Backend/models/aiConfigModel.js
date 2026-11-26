const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EncryptedKeySchema = new Schema(
  {
    ciphertext: { type: String },
    iv: { type: String },
    authTag: { type: String },
    keyVersion: { type: String, default: "aes-256-gcm-v1" },
  },
  { _id: false }
);

/**
 * Modular AI Configuration Vault:
 * - scope = "global": Superadmin-managed provider config; encrypted key may ONLY execute global tasks (`globalOnly: true`).
 * - scope = "user": Per-user encrypted BYOK slot scoped optionally to `moduleKey` for future module assistants.
 */
const AIConfigSchema = new Schema(
  {
    scope: {
      type: String,
      enum: ["global", "user"],
      default: "global",
      index: true,
    },
    provider: {
      type: String,
      enum: ["openai", "anthropic", "google"],
      required: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    moduleKey: {
      type: String,
      default: "global",
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    isGlobalDefault: {
      type: Boolean,
      default: false,
    },
    globalOnly: {
      type: Boolean,
      default: true,
    },
    keySource: {
      type: String,
      enum: ["env", "superadmin_vault", "user_byok"],
      default: "env",
    },
    encryptedKey: {
      type: EncryptedKeySchema,
      select: false,
    },
    maskedKey: {
      type: String,
      default: "",
    },
    defaultModel: {
      type: String,
      required: true,
      trim: true,
    },
    allowedModels: {
      type: [String],
      default: [],
    },
    thinkingLevel: {
      type: String,
      enum: ["minimal", "low", "medium", "high", "xhigh"],
      default: "low",
    },
    invokedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastTestedAt: {
      type: Date,
    },
    lastTestResult: {
      ok: Boolean,
      message: String,
      latencyMs: Number,
    },
  },
  { timestamps: true }
);

AIConfigSchema.index({ scope: 1, provider: 1, owner: 1, moduleKey: 1 }, { unique: true });

module.exports = mongoose.model("AIConfig", AIConfigSchema);

