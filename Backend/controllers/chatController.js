const Message = require("../models/messageModel");
const User = require("../models/userModel");
const { enqueueWebSocketEvent, enqueueEmailJob } = require("../services/queue");
const { emitToUser, getIO, isUserOnline } = require("../config/socket");
const { createNotification } = require("../utils/notificationHelper");

const USER_POPULATE_FIELDS =
  "fullname email avatar profilePicture role department departmentName publicId jobTitle status";

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
      return res.status(400).json({
        success: false,
        message: "Missing required encrypted message payload or room ID",
      });
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

    const populated = await Message.findById(newMessage._id)
      .populate("sender", USER_POPULATE_FIELDS)
      .populate("recipient", USER_POPULATE_FIELDS)
      .populate("pinnedBy", "fullname email avatar publicId");

    // Broadcast in real-time
    const io = getIO();
    if (io) {
      io.to(`chat_${roomId}`).emit("chat:message", populated);
      if (recipientId) {
        emitToUser(recipientId.toString(), "chat:message", populated);
        emitToUser(recipientId.toString(), "chat:notification", {
          sender: req.user.fullname || req.user.email,
          senderId: req.user._id,
          roomId,
          chatType,
        });
        createNotification({
          recipient: recipientId.toString(),
          sender: req.user._id,
          type: "chat_message",
          title: "New Direct Message",
          message:
            Array.isArray(attachments) && attachments.length > 0
              ? `${req.user.fullname || req.user.email} shared a file in Direct Messages.`
              : `${req.user.fullname || req.user.email} sent you a direct message.`,
        }).catch(() => {});

        // Trigger SMTP Email Worker if recipient is currently offline
        if (!isUserOnline(recipientId.toString())) {
          const recipientUser = await User.findById(recipientId).select("email fullname").lean();
          if (recipientUser?.email) {
            enqueueEmailJob({
              to: recipientUser.email,
              type: "offline_chat_message",
              data: {
                senderName: req.user.fullname || req.user.email,
                roomLabel: "Direct Messages",
              },
            });
          }
        }
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
      .populate("sender", USER_POPULATE_FIELDS)
      .populate("recipient", USER_POPULATE_FIELDS)
      .populate("pinnedBy", "fullname email avatar publicId");

    res.status(200).json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Pin or Unpin a message in a room/project chat
exports.togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const msg = await Message.findById(messageId);
    if (!msg) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    msg.isPinned = !msg.isPinned;
    msg.pinnedBy = msg.isPinned ? req.user._id : null;
    msg.pinnedAt = msg.isPinned ? new Date() : null;
    await msg.save();

    const populated = await Message.findById(msg._id)
      .populate("sender", USER_POPULATE_FIELDS)
      .populate("recipient", USER_POPULATE_FIELDS)
      .populate("pinnedBy", "fullname email avatar publicId");

    const io = getIO();
    if (io) {
      io.to(`chat_${msg.roomId}`).emit("chat:pinned", {
        roomId: msg.roomId,
        messageId: msg._id.toString(),
        isPinned: populated.isPinned,
        message: populated,
      });
    }

    res.status(200).json({
      success: true,
      isPinned: populated.isPinned,
      message: populated,
    });
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

// 4. Get active chat conversations / colleagues with real DM metadata & unread counts
exports.getConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();

    const colleagues = await User.find({
      _id: { $ne: req.user._id },
      isActive: true,
      status: "active",
    })
      .select(USER_POPULATE_FIELDS)
      .populate("department", "name code color")
      .sort({ fullname: 1 })
      .lean();

    const enrichedColleagues = await Promise.all(
      colleagues.map(async (colleague) => {
        const sortedIds = [currentUserId, colleague._id.toString()].sort();
        const dmRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

        const [lastMessage, unreadCount] = await Promise.all([
          Message.findOne({ roomId: dmRoomId })
            .sort({ createdAt: -1 })
            .select("createdAt attachments sender")
            .lean(),
          Message.countDocuments({
            roomId: dmRoomId,
            sender: { $ne: req.user._id },
            "readBy.user": { $ne: req.user._id },
          }),
        ]);

        return {
          ...colleague,
          departmentName: colleague.department?.name || colleague.departmentName || "General",
          dmRoomId,
          lastMessageAt: lastMessage?.createdAt || null,
          unreadCount,
        };
      })
    );

    // Sort colleagues with recent DMs first, then alphabetically
    enrichedColleagues.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) {
        return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      }
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return (a.fullname || "").localeCompare(b.fullname || "");
    });

    // Also compute unread counts for department channels
    const channelIds = ["dept_general", "dept_engineering", "dept_hr", "dept_finance"];
    const channelUnread = {};
    await Promise.all(
      channelIds.map(async (roomId) => {
        channelUnread[roomId] = await Message.countDocuments({
          roomId,
          sender: { $ne: req.user._id },
          "readBy.user": { $ne: req.user._id },
        });
      })
    );

    const dmUnreadTotal = enrichedColleagues.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const channelUnreadTotal = Object.values(channelUnread).reduce((sum, n) => sum + (n || 0), 0);

    res.status(200).json({
      success: true,
      colleagues: enrichedColleagues,
      channelUnread,
      totalUnread: dmUnreadTotal + channelUnreadTotal,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
