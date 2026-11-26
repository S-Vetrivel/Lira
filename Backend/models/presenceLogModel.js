const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PresenceLogSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    userPublicId: { type: String, default: "" },
    userRole: { type: String, default: "" },
    departmentName: { type: String, default: "" },
    event: {
      type: String,
      enum: ["online", "offline", "heartbeat"],
      default: "online",
      index: true,
    },
    onlineCount: { type: Number, default: 0 },
    onlineUserIds: { type: [String], default: [] },
    ip: { type: String, default: "" },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 30 * 24 * 60 * 60,
    },
  },
  { timestamps: false }
);

PresenceLogSchema.index({ event: 1, timestamp: -1 });
PresenceLogSchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model("PresenceLog", PresenceLogSchema);

