const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const { redisConfig } = require("../services/queue");

let io = null;
const activePeers = new Map(); // socketId -> { userId, name, department, clientIp, joinedAt }

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    },
    pingTimeout: 60000,
    transports: ["websocket", "polling"],
  });

  // Attach Redis adapter for multi-node cluster synchronization
  try {
    const pubClient = new Redis(redisConfig);
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    console.log("⚡ Socket.IO Redis Cluster Adapter initialized");
  } catch (err) {
    console.warn("⚠️ Failed to attach Redis adapter, using standalone adapter:", err.message);
  }

  io.on("connection", (socket) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress;

    // 1. Personal Room
    socket.on("join:user", (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
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
  emitToUser,
  emitToProject,
  emitToAll,
};
