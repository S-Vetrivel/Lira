const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ActionLogSchema = new Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    method: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
      index: true,
    },
    durationMs: {
      type: Number,
      required: true,
    },
    ip: {
      type: String,
      default: "127.0.0.1",
    },
    userAgent: {
      type: String,
      default: "Unknown",
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    userEmail: {
      type: String,
      index: true,
    },
    userName: {
      type: String,
    },
    userPublicId: {
      type: String,
      index: true,
    },
    userRole: {
      type: String,
      default: "guest",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "WARNING"],
      default: "SUCCESS",
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    error: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      // Automatic 30-day timed preservation TTL in MongoDB
      expires: 30 * 24 * 60 * 60,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast querying and analytics
ActionLogSchema.index({ timestamp: -1, statusCode: 1 });
ActionLogSchema.index({ user: 1, timestamp: -1 });
ActionLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model("ActionLog", ActionLogSchema);

