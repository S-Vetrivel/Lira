const Message = require("../models/messageModel");
const User = require("../models/userModel");
const { enqueueWebSocketEvent } = require("../services/queue");
const { emitToUser, getIO } = require("../config/socket");

// 1. Send / Record Encrypted Message
exports.sendMessage = async (req, res) => {
  try {
    const {
      chatType = "direct",
      roomId,
      recipientId,
      departmentId,
      encryptedPayload,
      iv,
      salt,
      keyId,
      attachments = [],
    } = req.body;

    if (!roomId || !encryptedPayload || !iv) {
      return res.status(400).json({ success: false, message: "Missing required encrypted message payload or room ID" });
    }

    const newMessage = await Message.create({
      chatType,
      roomId,
      sender: req.user._id,
      recipient: recipientId || undefined,
      department: departmentId || undefined,
      encryptedPayload,
      iv,
      salt,
      keyId: keyId || "lira-aes-gcm-256",
      isEncrypted: true,
      attachments,
      readBy: [{ user: req.user._id, readAt: new Date() }],
    });

    const populated = await Message.findById(newMessage._id).populate(
      "sender",
      "name email avatar role department"
    );

    // Broadcast in real-time
    const io = getIO();
    if (io) {
      io.to(`chat_${roomId}`).emit("chat:message", populated);
      if (recipientId) {
        emitToUser(recipientId.toString(), "chat:notification", {
          sender: req.user.name,
          roomId,
          chatType,
        });
      }
    }

    // Also queue for multi-cluster sync
    try {
      await enqueueWebSocketEvent({
        room: `chat_${roomId}`,
        event: "chat:message",
        data: populated,
        target: "chat",
      });
    } catch (err) {
      // non-blocking
    }

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get Messages for a Room
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 100, before } = req.query;

    const query = { roomId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(parseInt(limit, 10))
      .populate("sender", "name email avatar role department");

    res.status(200).json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Mark Room Messages as Read
exports.markRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    await Message.updateMany(
      { roomId, "readBy.user": { $ne: req.user._id } },
      { $addToSet: { readBy: { user: req.user._id, readAt: new Date() } } }
    );
    res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get active chat conversations / colleagues
exports.getConversations = async (req, res) => {
  try {
    const colleagues = await User.find({ _id: { $ne: req.user._id }, isActive: true })
      .select("name email avatar role department")
      .populate("department", "name");

    res.status(200).json({ success: true, colleagues });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
