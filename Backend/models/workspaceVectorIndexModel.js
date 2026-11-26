const mongoose = require("mongoose");

const WorkspaceVectorIndexSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["task", "project", "request"],
      required: true,
      index: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    key: { type: String, default: "" },
    title: { type: String, default: "" },
    summaryText: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

WorkspaceVectorIndexSchema.index({ entityType: 1, entityId: 1 }, { unique: true });

module.exports = mongoose.model("WorkspaceVectorIndex", WorkspaceVectorIndexSchema);

