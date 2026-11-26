const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema(
  {
    chatType: {
      type: String,
      enum: ["direct", "department"],
      default: "direct",
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
    },
    // End-to-End Encrypted Ciphertext + Metadata
    encryptedPayload: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
    },
    keyId: {
      type: String,
      default: "lira-aes-gcm-256",
    },
    isEncrypted: {
      type: Boolean,
      default: true,
    },
    attachments: [
      {
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number, default: 0 },
        mimetype: { type: String },
        encryptedKey: { type: String },
      },
    ],
    readBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    isPinned: { type: Boolean, default: false, index: true },
    pinnedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    pinnedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
