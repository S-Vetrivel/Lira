const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const { redisConfig, enqueueEmailJob } = require("../services/queue");

let io = null;
const activePeers = new Map(); // socketId -> { userId, name, department, clientIp, joinedAt }
const onlineUsers = new Map(); // userId -> Set<socketId>

const isUserOnline = (userId) => {
  if (!userId) return false;
  const set = onlineUsers.get(userId.toString());
  return Boolean(set && set.size > 0);
};

const getOnlineUserIds = () => Array.from(onlineUsers.keys());

const emitTargetEvent = (target, room, event, data) => {
  if (!io || !event) return;
  if (target === "user" && room) {
    io.to(`user_${room}`).emit(event, data);
  } else if (target === "project" && room) {
    io.to(`project_${room}`).emit(event, data);
  } else if (target === "chat" && room) {
    const chatRoom = room.startsWith("chat_") ? room : `chat_${room}`;
    io.to(chatRoom).emit(event, data);
  } else if (target === "all") {
    io.emit(event, data);
  } else if (room) {
    io.to(room).emit(event, data);
  }
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 10000,
    transports: ["websocket", "polling"],
  });

  // Attach Redis adapter for multi-node cluster synchronization + worker-to-API broadcast relay
  try {
    const pubClient = new Redis(redisConfig);
    const subClient = pubClient.duplicate();
    const clusterSub = new Redis(redisConfig);

    pubClient.on("error", () => {});
    subClient.on("error", () => {});
    clusterSub.on("error", () => {});

    io.adapter(createAdapter(pubClient, subClient));
    console.log("⚡ Socket.IO Redis Cluster Adapter initialized");

    clusterSub.subscribe("CLUSTER_WEBSOCKET_CHANNEL", (err) => {
      if (err) {
        console.warn("⚠️ Failed to subscribe to CLUSTER_WEBSOCKET_CHANNEL:", err.message);
      } else {
        console.log("📡 Subscribed to CLUSTER_WEBSOCKET_CHANNEL for live worker CRUD sync");
      }
    });

    clusterSub.on("message", async (channel, raw) => {
      if (channel !== "CLUSTER_WEBSOCKET_CHANNEL" || !raw) return;
      try {
        const msg = JSON.parse(raw);
        if (msg.fromPid && msg.fromPid === process.pid) return;
        if (msg.deliveryId) {
          const lock = await pubClient.set(`ws:relay:${msg.deliveryId}`, "1", "EX", 30, "NX");
          if (lock !== "OK") return;
        }
        emitTargetEvent(msg.target, msg.room, msg.event, msg.data);
      } catch (err) {
        console.warn("⚠️ CLUSTER_WEBSOCKET_CHANNEL parse error:", err.message);
      }
    });
  } catch (err) {
    console.warn("⚠️ Failed to attach Redis adapter, using standalone adapter:", err.message);
  }

  io.on("connection", (socket) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress;

    // 1. Personal Room & Online Presence Tracking
    socket.on("join:user", (userId) => {
      if (userId) {
        const uid = userId.toString();
        socket.data.userId = uid;
        socket.join(`user_${uid}`);
        if (!onlineUsers.has(uid)) {
          onlineUsers.set(uid, new Set());
        }
        onlineUsers.get(uid).add(socket.id);
        io.emit("presence:update", { onlineUserIds: getOnlineUserIds() });
      }
    });

    socket.on("presence:request", () => {
      socket.emit("presence:update", { onlineUserIds: getOnlineUserIds() });
    });

    // 2. Project Room
    socket.on("join:project", (projectId) => {
      if (projectId) {
        socket.join(`project_${projectId}`);
      }
    });

    socket.on("leave:project", (projectId) => {
      if (projectId) {
        socket.leave(`project_${projectId}`);
      }
    });

    // 3. E2EE Chat Rooms
    socket.on("join:chat", (roomId) => {
      if (roomId) {
        socket.join(`chat_${roomId}`);
      }
    });

    socket.on("leave:chat", (roomId) => {
      if (roomId) {
        socket.leave(`chat_${roomId}`);
      }
    });

    socket.on("chat:typing", ({ roomId, userId, userName, isTyping }) => {
      socket.to(`chat_${roomId}`).emit("chat:typing", { userId, userName, isTyping });
    });

    // Direct WebSocket-based chatting (persists to MongoDB, emits real-time, and triggers offline email)
    socket.on("chat:send", async (payload = {}, ack) => {
      try {
        const Message = require("../models/messageModel");
        const User = require("../models/userModel");
        const { createNotification } = require("../utils/notificationHelper");
        const {
          chatType = "direct",
          roomId,
          senderId,
          recipientId,
          departmentId,
          encryptedPayload,
          iv,
          salt,
          keyId,
          attachments = [],
        } = payload;

        const effectiveSenderId = senderId || socket.data.userId;
        if (!effectiveSenderId || !roomId || !encryptedPayload || !iv) {
          if (typeof ack === "function") {
            ack({ success: false, message: "Missing required WebSocket chat fields" });
          }
          return;
        }

        const newMessage = await Message.create({
          chatType,
          roomId,
          sender: effectiveSenderId,
          recipient: recipientId || undefined,
          department: departmentId || undefined,
          encryptedPayload,
          iv,
          salt,
          keyId: keyId || "lira-aes-gcm-256",
          isEncrypted: true,
          attachments,
          readBy: [{ user: effectiveSenderId, readAt: new Date() }],
        });

        const USER_POPULATE_FIELDS =
          "fullname email avatar profilePicture role department departmentName publicId jobTitle status";
        const populated = await Message.findById(newMessage._id)
          .populate("sender", USER_POPULATE_FIELDS)
          .populate("recipient", USER_POPULATE_FIELDS);

        io.to(`chat_${roomId}`).emit("chat:message", populated);

        const senderName =
          populated?.sender?.fullname || populated?.sender?.email || "A teammate";

        if (recipientId) {
          const rid = recipientId.toString();
          emitToUser(rid, "chat:message", populated);
          emitToUser(rid, "chat:notification", {
            sender: senderName,
            senderId: effectiveSenderId,
            roomId,
            chatType,
          });

          createNotification({
            recipient: rid,
            sender: effectiveSenderId,
            type: "chat_message",
            title: "New Direct Message",
            message:
              Array.isArray(attachments) && attachments.length > 0
                ? `${senderName} shared a file in Direct Messages.`
                : `${senderName} sent you a direct message.`,
          }).catch(() => {});

          if (!isUserOnline(rid)) {
            const recipientUser = await User.findById(rid).select("email fullname").lean();
            if (recipientUser?.email) {
              enqueueEmailJob({
                to: recipientUser.email,
                type: "offline_chat_message",
                data: {
                  senderName,
                  roomLabel: "Direct Messages",
                },
              });
            }
          }
        }

        if (typeof ack === "function") {
          ack({ success: true, message: populated });
        }
      } catch (err) {
        console.error("WebSocket chat:send error:", err.message);
        if (typeof ack === "function") {
          ack({ success: false, message: err.message });
        }
      }
    });

    // 4. Local Peer Discovery & WebRTC Route Finding for Direct File Sharing
    socket.on("peer:announce", (peerData = {}) => {
      const peerInfo = {
        socketId: socket.id,
        userId: peerData.userId,
        name: peerData.name || "Colleague",
        department: peerData.department || "Operations",
        clientIp: peerData.clientIp || clientIp,
        subnet: peerData.clientIp ? peerData.clientIp.split(".").slice(0, 3).join(".") : "local",
        joinedAt: Date.now(),
      };
      activePeers.set(socket.id, peerInfo);

      // Reply with active peer list
      const peerList = Array.from(activePeers.values()).filter((p) => p.socketId !== socket.id);
      socket.emit("peer:list", peerList);

      // Broadcast to other peers
      socket.broadcast.emit("peer:joined", peerInfo);
    });

    // WebRTC Signaling Relay
    socket.on("peer:signal", ({ targetSocketId, signal, metadata }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit("peer:signal", {
          senderSocketId: socket.id,
          signal,
          metadata,
        });
      }
    });

    socket.on("disconnect", () => {
      if (socket.data.userId && onlineUsers.has(socket.data.userId)) {
        const set = onlineUsers.get(socket.data.userId);
        set.delete(socket.id);
        if (set.size === 0) {
          onlineUsers.delete(socket.data.userId);
        }
        io.emit("presence:update", { onlineUserIds: getOnlineUserIds() });
      }
      if (activePeers.has(socket.id)) {
        const removed = activePeers.get(socket.id);
        activePeers.delete(socket.id);
        socket.broadcast.emit("peer:left", { socketId: socket.id, userId: removed.userId });
      }
    });
  });

  return io;
};

const getIO = () => io;

const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

const emitToProject = (projectId, event, data) => {
  if (io && projectId) {
    io.to(`project_${projectId}`).emit(event, data);
  }
};

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitTargetEvent,
  emitToUser,
  emitToProject,
  emitToAll,
  isUserOnline,
  getOnlineUserIds,
};
