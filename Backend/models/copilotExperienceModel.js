const mongoose = require("mongoose");

const CopilotExperienceSchema = new mongoose.Schema(
  {
    tenantScope: { type: String, default: "workspace", index: true },
    role: { type: String, default: "employee", index: true },
    route: { type: String, default: "/", index: true },
    outcome: {
      type: String,
      enum: ["success", "correction", "failure"],
      required: true,
      index: true,
    },
    prompt: { type: String, required: true },
    normalizedIntent: { type: String, default: "" },
    steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
    failureReason: { type: String, default: "" },
    embedding: { type: [Number], required: true },
    hitCount: { type: Number, default: 1 },
    lastUsedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

CopilotExperienceSchema.index({ role: 1, outcome: 1, hitCount: -1 });
CopilotExperienceSchema.index({ createdAt: 1, hitCount: 1 });

module.exports = mongoose.model("CopilotExperience", CopilotExperienceSchema);

