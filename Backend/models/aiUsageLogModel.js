const mongoose = require("mongoose");

const AIUsageLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userName: { type: String, default: "System" },
    userEmail: { type: String, default: "" },
    userPublicId: { type: String, default: "" },
    userRole: { type: String, default: "" },
    departmentName: { type: String, default: "" },

    provider: {
      type: String,
      enum: ["google", "openai", "anthropic", "unknown"],
      default: "unknown",
      index: true,
    },
    model: { type: String, default: "", index: true },
    moduleKey: { type: String, default: "global", index: true },
    taskType: { type: String, default: "module_assistant" },

    credentialScope: {
      type: String,
      enum: ["global_env", "global_vault", "user_byok", "none"],
      default: "none",
      index: true,
    },
    keyId: { type: String, default: "" },
    keyLabel: { type: String, default: "" },
    maskedKey: { type: String, default: "" },

    grantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIGlobalGrant",
      default: null,
    },
    grantTargetType: {
      type: String,
      enum: ["superadmin", "user", "department", "project", "self_byok", "system", "denied"],
      default: "system",
    },
    grantTargetName: { type: String, default: "" },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

    status: {
      type: String,
      enum: ["success", "failed", "denied", "misuse"],
      default: "success",
      index: true,
    },
    misuseCategory: {
      type: String,
      enum: ["", "off_topic_code_or_image", "architecture_probe", "unauthorized_module"],
      default: "",
    },
    promptSnippet: { type: String, default: "" },
    latencyMs: { type: Number, default: 0 },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

AIUsageLogSchema.index({ createdAt: -1 });
AIUsageLogSchema.index({ provider: 1, credentialScope: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("AIUsageLog", AIUsageLogSchema);

