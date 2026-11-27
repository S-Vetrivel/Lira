const User = require("../models/userModel");
const Project = require("../models/projectModel");
const Message = require("../models/messageModel");
const { createNotification } = require("../utils/notificationHelper");
const { enqueueWebSocketEvent } = require("../services/queue");

const CHANNEL_LABELS = {
  dept_general: { label: "#operations (General)", deptMatcher: /operations|general/i },
  dept_engineering: { label: "#engineering", deptMatcher: /engineer/i },
  dept_hr: { label: "#people-culture (HR)", deptMatcher: /human|hr/i },
  dept_finance: { label: "#finance", deptMatcher: /finance|account/i },
};

async function resolveChannelRecipients({ roomId, senderId }) {
  if (!roomId || roomId.startsWith("dm_")) {
    return { roomLabel: "Direct Messages", recipients: [] };
  }

  if (roomId.startsWith("proj_") || roomId.startsWith("project_")) {
    const projectId = roomId.replace(/^proj(?:ect)?_/, "");
    if (/^[a-f0-9]{24}$/i.test(projectId)) {
      const proj = await Project.findById(projectId).select("name prefix members").lean();
      if (proj) {
        const memberIds = (proj.members || [])
          .map((m) => String(m?._id || m))
          .filter((id) => id && id !== String(senderId));
        if (memberIds.length === 0) {
          return { roomLabel: `${proj.prefix || "PRJ"} · ${proj.name}`, recipients: [] };
        }
        const users = await User.find({
          _id: { $in: memberIds },
          isActive: true,
          status: "active",
        })
          .select("_id email fullname")
          .lean();
        return {
          roomLabel: `[${proj.prefix}] ${proj.name} Chat`,
          recipients: users,
        };
      }
    }
  }

  const meta = CHANNEL_LABELS[roomId];
  const deptFilter = meta
    ? {
        _id: { $ne: senderId },
        isActive: true,
        status: "active",
        ...(roomId === "dept_general" ? {} : { departmentName: meta.deptMatcher }),
      }
    : {
        _id: { $ne: senderId },
        isActive: true,
        status: "active",
      };

  const users = await User.find(deptFilter).select("_id email fullname").limit(35).lean();
  return {
    roomLabel: meta?.label || `#${roomId}`,
    recipients: users,
  };
}

/**
 * Dispatch real-time chat alerts, In-App notifications, Browser Web Push, and offline emails
 * uniformly across both WebSocket `chat:send` and REST `POST /v3/chat/messages`.
 */
async function notifyChatMessageRecipients({
  senderUser,
  messageDoc = null,
  chatType = "direct",
  roomId,
  recipientId = null,
  attachments = [],
}) {
  const socketMod = require("../config/socket");
  const senderId = String(senderUser?._id || senderUser || "");
  const senderName = senderUser?.fullname || senderUser?.email || "A teammate";
  const hasAttachment = Array.isArray(attachments) && attachments.length > 0;
  const dispatchWs = async (target, room, event, data) => {
    const io = socketMod.getIO();
    if (io) {
      socketMod.emitTargetEvent(target, room, event, data);
    } else {
      await enqueueWebSocketEvent({ target, room, event, data }).catch(() => {});
    }
  };

  if (recipientId) {
    const rid = String(recipientId);
    if (!rid || rid === senderId) return;

    const recipientUser = await User.findById(rid).select("_id email fullname").lean();
    const online = await socketMod.isUserOnlineAsync(rid);

    if (messageDoc) {
      await dispatchWs("user", rid, "chat:message", messageDoc);
    }

    await dispatchWs("user", rid, "chat:notification", {
      sender: senderName,
      senderId,
      roomId,
      chatType,
    });

    await createNotification({
      recipient: rid,
      sender: senderId,
      type: "chat_message",
      title: hasAttachment ? `File from ${senderName}` : `New DM from ${senderName}`,
      message: hasAttachment
        ? `${senderName} shared a file in Direct Messages.`
        : `${senderName} sent you an encrypted direct message.`,
      alsoEmail: !online && Boolean(recipientUser?.email),
      emailType: "offline_chat_message",
      emailData: {
        senderName,
        roomLabel: "Direct Messages",
        hasAttachment,
      },
      actionUrl: "/",
      recipientEmail: recipientUser?.email,
    });
    return;
  }

  // Channel or Project room notification for teammates (Push + In-App + Offline Email)
  const { roomLabel, recipients } = await resolveChannelRecipients({ roomId, senderId });
  if (!recipients || recipients.length === 0) return;

  const onlineIds = new Set((await socketMod.getOnlineUserIdsAsync()).map(String));
  await Promise.allSettled(
    recipients.map(async (u) => {
      const uid = String(u._id);
      const isOnline = onlineIds.has(uid);

      await dispatchWs("user", uid, "chat:notification", {
        sender: senderName,
        senderId,
        roomId,
        chatType: chatType || "department",
      });

      await createNotification({
        recipient: uid,
        sender: senderId,
        type: "chat_message",
        title: `${roomLabel}`,
        message: hasAttachment
          ? `${senderName} shared a file in ${roomLabel}.`
          : `${senderName} posted a message in ${roomLabel}.`,
        alsoEmail: !isOnline && Boolean(u.email),
        emailType: "offline_chat_message",
        emailData: {
          senderName,
          roomLabel,
          hasAttachment,
        },
        actionUrl: "/",
        recipientEmail: u.email,
      });
    })
  );
}

/**
 * Mark unread messages in a room as read by `readerUser` and broadcast real-time read receipts (`chat:read`)
 * to the room and DM participants so senders see live blue/emerald double-checks immediately.
 */
async function markRoomMessagesRead({ roomId, readerUser }) {
  if (!roomId || !readerUser?._id) {
    return { modifiedCount: 0, messageIds: [], readAt: null };
  }

  const readerId = readerUser._id;
  const unreadDocs = await Message.find({
    roomId,
    "readBy.user": { $ne: readerId },
  })
    .select("_id")
    .lean();

  if (unreadDocs.length === 0) {
    return { modifiedCount: 0, messageIds: [], readAt: null };
  }

  const readAt = new Date();
  const messageIds = unreadDocs.map((d) => String(d._id));

  const res = await Message.updateMany(
    { _id: { $in: messageIds }, "readBy.user": { $ne: readerId } },
    { $addToSet: { readBy: { user: readerId, readAt } } }
  );

  const readerSummary = {
    _id: String(readerId),
    fullname: readerUser.fullname || readerUser.email || "Teammate",
    avatar: readerUser.avatar || "",
    profilePicture: readerUser.profilePicture || "",
    publicId: readerUser.publicId || "",
  };

  const payload = {
    roomId,
    userId: String(readerId),
    reader: readerSummary,
    readAt: readAt.toISOString(),
    messageIds,
  };

  const socketMod = require("../config/socket");
  const io = socketMod.getIO();
  if (io) {
    socketMod.emitTargetEvent("chat", roomId, "chat:read", payload);
  } else {
    await enqueueWebSocketEvent({
      target: "chat",
      room: roomId,
      event: "chat:read",
      data: payload,
    }).catch(() => {});
  }

  // For DMs, also push directly to both user rooms so senders see read receipts even if viewing another room
  if (roomId.startsWith("dm_")) {
    const parts = roomId.slice(3).split("_").filter(Boolean);
    await Promise.allSettled(
      parts.map((uid) =>
        io
          ? Promise.resolve(socketMod.emitTargetEvent("user", uid, "chat:read", payload))
          : enqueueWebSocketEvent({
              target: "user",
              room: uid,
              event: "chat:read",
              data: payload,
            })
      )
    );
  }

  return {
    modifiedCount: res.modifiedCount || messageIds.length,
    messageIds,
    readAt,
  };
}

module.exports = {
  notifyChatMessageRecipients,
  markRoomMessagesRead,
};
