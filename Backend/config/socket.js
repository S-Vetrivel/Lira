const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const { redisConfig, connection: sharedRedis, enqueueWebSocketEvent } = require("../services/queue");
const { getAppVersionInfo, isUpdateAvailableForClient } = require("../utils/appVersion");

const PRESENCE_SOCKETS_HASH = "lira:presence:sockets";
const PRESENCE_STALE_MS = 12 * 60 * 1000;

let io = null;
const activePeers = new Map(); // socketId -> { userId, name, department, clientIp, joinedAt }
const onlineUsers = new Map(); // local worker userId -> Set<socketId>
let clusterOnlineIds = new Set(); // synced cluster-wide Set<userId>
let presenceTimer = null;
let versionWatchTimer = null;
let lastBroadcastBuildId = "";

function parsePresenceEntry(rawVal = "") {
  const idx = String(rawVal).lastIndexOf(":");
  if (idx === -1) return { userId: String(rawVal), seenAt: Date.now() };
  return {
    userId: String(rawVal).slice(0, idx),
    seenAt: Number(String(rawVal).slice(idx + 1)) || 0,
  };
}

async function getOnlineUserIdsAsync() {
  const combined = new Set(Array.from(onlineUsers.keys()).map(String));
  try {
    if (sharedRedis && sharedRedis.status === "ready") {
      const entries = await sharedRedis.hgetall(PRESENCE_SOCKETS_HASH);
      const now = Date.now();
      const staleFields = [];
      for (const [field, rawVal] of Object.entries(entries || {})) {
        const { userId, seenAt } = parsePresenceEntry(rawVal);
        if (!userId || (seenAt > 0 && now - seenAt > PRESENCE_STALE_MS)) {
          staleFields.push(field);
        } else {
          combined.add(userId);
        }
      }
      if (staleFields.length > 0) {
        sharedRedis.hdel(PRESENCE_SOCKETS_HASH, ...staleFields).catch(() => {});
      }
      clusterOnlineIds = new Set(combined);
    }
  } catch {
    // fallback safely to local worker set
  }
  return Array.from(combined);
}

async function isUserOnlineAsync(userId) {
  if (!userId) return false;
  const uid = String(userId);
  const localSet = onlineUsers.get(uid);
  if (localSet && localSet.size > 0) return true;
  const ids = await getOnlineUserIdsAsync();
  return ids.includes(uid);
}

const isUserOnline = (userId) => {
  if (!userId) return false;
  const uid = String(userId);
  const set = onlineUsers.get(uid);
  return Boolean((set && set.size > 0) || clusterOnlineIds.has(uid));
};

const getOnlineUserIds = () => {
  const merged = new Set([...Array.from(onlineUsers.keys()).map(String), ...Array.from(clusterOnlineIds)]);
  return Array.from(merged);
};

async function registerSocketPresenceInRedis(socketId, userId) {
  if (!socketId || !userId) return;
  try {
    if (sharedRedis && sharedRedis.status === "ready") {
      await sharedRedis.hset(
        PRESENCE_SOCKETS_HASH,
        `${process.pid}:${socketId}`,
        `${String(userId)}:${Date.now()}`
      );
      await sharedRedis.expire(PRESENCE_SOCKETS_HASH, 3600);
    }
  } catch {
    // non-fatal
  }
}

async function removeSocketPresenceInRedis(socketId) {
  if (!socketId) return;
  try {
    if (sharedRedis && sharedRedis.status === "ready") {
      await sharedRedis.hdel(PRESENCE_SOCKETS_HASH, `${process.pid}:${socketId}`);
    }
  } catch {
    // non-fatal
  }
}

async function cleanupStalePidSocketsInRedis() {
  try {
    if (!sharedRedis || sharedRedis.status !== "ready") return;
    const entries = await sharedRedis.hgetall(PRESENCE_SOCKETS_HASH);
    const pidPrefix = `${process.pid}:`;
    const now = Date.now();
    const toRemove = [];
    for (const [field, rawVal] of Object.entries(entries || {})) {
      const { seenAt } = parsePresenceEntry(rawVal);
      if (field.startsWith(pidPrefix) || (seenAt > 0 && now - seenAt > PRESENCE_STALE_MS)) {
        toRemove.push(field);
      }
    }
    if (toRemove.length > 0) {
      await sharedRedis.hdel(PRESENCE_SOCKETS_HASH, ...toRemove);
    }
  } catch {
    // ignore
  }
}

async function recordPresenceEvent({ userId = null, event = "online", ip = "" } = {}) {
  try {
    const PresenceLog = require("../models/presenceLogModel");
    const User = require("../models/userModel");
    let snap = null;
    if (userId) {
      snap = await User.findById(userId)
        .select("fullname email publicId role departmentName")
        .lean()
        .catch(() => null);
    }
    const ids = await getOnlineUserIdsAsync();
    const doc = await PresenceLog.create({
      user: userId || null,
      userName: snap?.fullname || "",
      userEmail: snap?.email || "",
      userPublicId: snap?.publicId || "",
      userRole: snap?.role || "",
      departmentName: snap?.departmentName || "",
      event,
      onlineCount: ids.length,
      onlineUserIds: ids.slice(0, 200),
      ip: ip || "",
      timestamp: new Date(),
    });
    if (io && event !== "heartbeat") {
      io.emit("presence:event", {
        _id: doc._id,
        user: doc.user,
        userName: doc.userName,
        userEmail: doc.userEmail,
        userPublicId: doc.userPublicId,
        userRole: doc.userRole,
        departmentName: doc.departmentName,
        event: doc.event,
        onlineCount: doc.onlineCount,
        timestamp: doc.timestamp,
      });
    }
  } catch (err) {
    console.warn("[PresenceLog] Failed to record presence:", err.message);
  }
}

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

  cleanupStalePidSocketsInRedis();

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
        if (msg.event === "presence:update" && Array.isArray(msg.data?.onlineUserIds)) {
          clusterOnlineIds = new Set(msg.data.onlineUserIds.map(String));
        }
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

  lastBroadcastBuildId = getAppVersionInfo().buildId;

  io.on("connection", (socket) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress;

    // 0. App & PWA Updater Handshake on WebSocket connection initiation
    const serverVersionInfo = getAppVersionInfo();
    const clientBuildId = String(
      socket.handshake?.auth?.clientBuildId || socket.handshake?.query?.clientBuildId || ""
    ).trim();
    const clientVersion = String(
      socket.handshake?.auth?.clientVersion || socket.handshake?.query?.clientVersion || ""
    ).trim();

    socket.emit("app:version", serverVersionInfo);
    if (isUpdateAvailableForClient({ buildId: clientBuildId, version: clientVersion }, serverVersionInfo)) {
      socket.emit("app:update-available", {
        ...serverVersionInfo,
        clientBuildId,
        clientVersion,
      });
    }
    if (serverVersionInfo.source === "web-dist" && lastBroadcastBuildId && serverVersionInfo.buildId !== lastBroadcastBuildId) {
      lastBroadcastBuildId = serverVersionInfo.buildId;
      io.emit("app:update-available", serverVersionInfo);
    }

    socket.on("app:check-update", (clientInfo = {}, ack) => {
      const fresh = getAppVersionInfo();
      const updateAvailable = isUpdateAvailableForClient(clientInfo, fresh);
      const payload = { ...fresh, updateAvailable };
      if (typeof ack === "function") {
        ack(payload);
      } else {
        socket.emit("app:version", fresh);
        if (updateAvailable) socket.emit("app:update-available", payload);
      }
    });

    // 1. Personal Room & Online Presence Tracking (cluster-wide via Redis)
    socket.on("join:user", async (userId) => {
      if (!userId) return;
      const uid = userId.toString();
      socket.data.userId = uid;
      socket.join(`user_${uid}`);

      const wasOffline = !(await isUserOnlineAsync(uid));
      if (!onlineUsers.has(uid)) {
        onlineUsers.set(uid, new Set());
      }
      onlineUsers.get(uid).add(socket.id);
      await registerSocketPresenceInRedis(socket.id, uid);

      const allOnline = await getOnlineUserIdsAsync();
      clusterOnlineIds = new Set(allOnline.map(String));
      io.emit("presence:update", { onlineUserIds: allOnline });
      enqueueWebSocketEvent({ target: "all", event: "presence:update", data: { onlineUserIds: allOnline } }).catch(() => {});

      const User = require("../models/userModel");
      User.updateOne({ _id: uid }, { lastSeenAt: new Date() }).catch(() => {});

      if (wasOffline) {
        recordPresenceEvent({ userId: uid, event: "online", ip: clientIp });
      }
    });

    socket.on("presence:request", async () => {
      const allOnline = await getOnlineUserIdsAsync();
      socket.emit("presence:update", { onlineUserIds: allOnline });
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

    socket.on("chat:read", async ({ roomId } = {}, ack) => {
      try {
        const readerId = socket.data.userId;
        if (!readerId || !roomId) {
          if (typeof ack === "function") ack({ success: false });
          return;
        }
        const User = require("../models/userModel");
        const { markRoomMessagesRead } = require("../services/chatNotificationService");
        const readerUser = await User.findById(readerId).select("_id fullname avatar profilePicture publicId").lean();
        const result = await markRoomMessagesRead({ roomId, readerUser: readerUser || { _id: readerId } });
        if (typeof ack === "function") ack({ success: true, ...result });
      } catch (err) {
        if (typeof ack === "function") ack({ success: false, message: err.message });
      }
    });

    // Direct WebSocket-based chatting (persists to MongoDB, emits real-time, and triggers Push + offline email)
    socket.on("chat:send", async (payload = {}, ack) => {
      try {
        const Message = require("../models/messageModel");
        const { notifyChatMessageRecipients } = require("../services/chatNotificationService");
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
          "fullname email avatar profilePicture role department departmentName publicId jobTitle status lastSeenAt";
        const populated = await Message.findById(newMessage._id)
          .populate("sender", USER_POPULATE_FIELDS)
          .populate("recipient", USER_POPULATE_FIELDS)
          .populate("readBy.user", "fullname avatar profilePicture publicId")
          .lean();

        io.to(`chat_${roomId}`).emit("chat:message", populated);

        await notifyChatMessageRecipients({
          senderUser: populated?.sender || { _id: effectiveSenderId },
          messageDoc: populated,
          chatType,
          roomId,
          recipientId,
          attachments,
        });

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

      const peerList = Array.from(activePeers.values()).filter((p) => p.socketId !== socket.id);
      socket.emit("peer:list", peerList);
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

    socket.on("disconnect", async () => {
      if (socket.data.userId) {
        const uid = socket.data.userId;
        if (onlineUsers.has(uid)) {
          const set = onlineUsers.get(uid);
          set.delete(socket.id);
          if (set.size === 0) onlineUsers.delete(uid);
        }
        await removeSocketPresenceInRedis(socket.id);
        const allOnline = await getOnlineUserIdsAsync();
        clusterOnlineIds = new Set(allOnline.map(String));
        const wentOffline = !allOnline.includes(uid);

        io.emit("presence:update", { onlineUserIds: allOnline });
        enqueueWebSocketEvent({ target: "all", event: "presence:update", data: { onlineUserIds: allOnline } }).catch(() => {});

        if (wentOffline) {
          const User = require("../models/userModel");
          User.updateOne({ _id: uid }, { lastSeenAt: new Date() }).catch(() => {});
          recordPresenceEvent({ userId: uid, event: "offline", ip: clientIp });
        }
      }
      if (activePeers.has(socket.id)) {
        const removed = activePeers.get(socket.id);
        activePeers.delete(socket.id);
        socket.broadcast.emit("peer:left", { socketId: socket.id, userId: removed.userId });
      }
    });
  });

  if (!presenceTimer) {
    presenceTimer = setInterval(async () => {
      try {
        if (sharedRedis && sharedRedis.status === "ready") {
          for (const [uid, set] of onlineUsers.entries()) {
            for (const sid of set) {
              await registerSocketPresenceInRedis(sid, uid);
            }
          }
        }
        const ids = await getOnlineUserIdsAsync();
        if (ids.length > 0) {
          recordPresenceEvent({ event: "heartbeat" });
        }
      } catch {
        // non-fatal
      }
    }, 5 * 60 * 1000);
    presenceTimer.unref?.();
  }

  if (!versionWatchTimer) {
    versionWatchTimer = setInterval(() => {
      const fresh = getAppVersionInfo();
      if (fresh.source !== "server-boot" && lastBroadcastBuildId && fresh.buildId !== lastBroadcastBuildId) {
        lastBroadcastBuildId = fresh.buildId;
        io?.emit("app:update-available", fresh);
      }
    }, 30 * 1000);
    versionWatchTimer.unref?.();
  }

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
  isUserOnlineAsync,
  getOnlineUserIds,
  getOnlineUserIdsAsync,
};
