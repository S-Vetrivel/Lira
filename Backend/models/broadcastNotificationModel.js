const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BroadcastNotificationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    category: {
      type: String,
      enum: ["info", "announcement", "urgent", "maintenance", "release_update"],
      default: "announcement",
    },
    actionUrl: { type: String, default: "/", trim: true },
    audienceType: {
      type: String,
      enum: ["all", "department", "role", "users", "online_only", "offline_only"],
      default: "all",
    },
    targetDepartments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    targetRoles: [{ type: String, trim: true, lowercase: true }],
    targetUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    channels: {
      inApp: { type: Boolean, default: true },
      webPush: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      offlineOnlyEmail: { type: Boolean, default: false },
    },
    aiGenerated: { type: Boolean, default: false },
    aiPrompt: { type: String, default: "" },
    stats: {
      totalRecipients: { type: Number, default: 0 },
      onlineAtSend: { type: Number, default: 0 },
      offlineAtSend: { type: Number, default: 0 },
      inAppDelivered: { type: Number, default: 0 },
      webPushSent: { type: Number, default: 0 },
      webPushNoSubscription: { type: Number, default: 0 },
      webPushFailed: { type: Number, default: 0 },
      emailsQueued: { type: Number, default: 0 },
    },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

BroadcastNotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("BroadcastNotification", BroadcastNotificationSchema);

