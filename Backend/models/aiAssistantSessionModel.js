const mongoose = require("mongoose");

const AssistantMessageSchema = new mongoose.Schema(
  {
    jobId: { type: String, default: "", index: true },
    role: {
      type: String,
      enum: ["user", "assistant", "system_warning"],
      required: true,
    },
    content: { type: String, default: "" },
    status: {
      type: String,
      enum: ["processing", "completed", "blocked", "denied", "no_key", "stopped", "failed"],
      default: "completed",
    },
    mode: {
      type: String,
      enum: ["review", "auto"],
      default: "review",
    },
    needsKey: { type: Boolean, default: false },
    interruptedPrompt: { type: String, default: "" },
    moduleKey: { type: String, default: "dashboard" },
    navigateTo: { type: String, default: null },
    intent: { type: mongoose.Schema.Types.Mixed, default: null },
    steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
    executedResult: { type: mongoose.Schema.Types.Mixed, default: null },
    misuseCategory: { type: String, default: "" },
    warning: { type: String, default: "" },
    error: { type: String, default: "" },
    provider: { type: String, default: "" },
    model: { type: String, default: "" },
    keySource: { type: String, default: "" },
    actionApplied: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { _id: true }
);

const AIAssistantSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["review", "auto"],
      default: "review",
    },
    selectedModelKey: { type: String, default: "auto" },
    activeJobId: { type: String, default: "" },
    lastUndonePrompt: { type: String, default: "" },
    lastJobMeta: { type: mongoose.Schema.Types.Mixed, default: null },
    messages: {
      type: [AssistantMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AIAssistantSession", AIAssistantSessionSchema);

