const mongoose = require("mongoose");

const AIGlobalGrantSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["user", "department", "project"],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetModel",
      index: true,
    },
    targetModel: {
      type: String,
      enum: ["User", "Department", "Project"],
      required: true,
    },
    targetName: {
      type: String,
      default: "",
    },
    provider: {
      type: String,
      enum: ["all", "google", "openai", "anthropic"],
      default: "all",
    },
    // e.g. ["*"] or ["tasks", "chat", "projects", "analytics", "requests", "dashboard"]
    allowedModules: {
      type: [String],
      default: ["*"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

AIGlobalGrantSchema.index({ targetType: 1, targetId: 1, isActive: 1 });

module.exports = mongoose.model("AIGlobalGrant", AIGlobalGrantSchema);

