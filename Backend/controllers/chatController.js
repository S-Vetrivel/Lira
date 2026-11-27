const Message = require("../models/messageModel");
const User = require("../models/userModel");
const { enqueueWebSocketEvent } = require("../services/queue");
const { getIO, getOnlineUserIdsAsync } = require("../config/socket");
const { notifyChatMessageRecipients, markRoomMessagesRead } = require("../services/chatNotificationService");

const USER_POPULATE_FIELDS =
  "fullname email avatar profilePicture role department departmentName publicId jobTitle status lastSeenAt";

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
      .populate("pinnedBy", "fullname email avatar publicId")
      .populate("readBy.user", "fullname avatar profilePicture publicId")
      .lean();

    // Broadcast to active room + notify offline/online targets uniformly (In-App + WebPush + Offline Email)
    const io = getIO();
    if (io) {
      io.to(`chat_${roomId}`).emit("chat:message", populated);
    }
    await enqueueWebSocketEvent({
      room: `chat_${roomId}`,
      event: "chat:message",
      data: populated,
      target: "chat",
    }).catch(() => {});

    await notifyChatMessageRecipients({
      senderUser: req.user,
      messageDoc: populated,
      chatType,
      roomId,
      recipientId,
      attachments,
    });

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
      .populate("pinnedBy", "fullname email avatar publicId")
      .populate("readBy.user", "fullname avatar profilePicture publicId")
      .lean();

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
      .populate("pinnedBy", "fullname email avatar publicId")
      .populate("readBy.user", "fullname avatar profilePicture publicId")
      .lean();

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

// 3. Mark Room Messages as Read (+ emit real-time read receipt)
exports.markRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const result = await markRoomMessagesRead({ roomId, readerUser: req.user });
    res.status(200).json({ success: true, message: "Marked as read", ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get active chat conversations / colleagues with real DM metadata, online status & unread counts
exports.getConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const onlineSet = new Set((await getOnlineUserIdsAsync()).map(String));

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
            .select("createdAt attachments sender readBy")
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
          isOnline: onlineSet.has(colleague._id.toString()),
          lastMessageAt: lastMessage?.createdAt || null,
          lastMessageReadCount: Array.isArray(lastMessage?.readBy) ? lastMessage.readBy.length : 0,
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
