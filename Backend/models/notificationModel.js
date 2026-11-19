const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },
    type: {
      type: String,
      enum: ["assigned", "mention", "status_change", "comment", "approval_request"],
      required: true,
    },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", NotificationSchema);
