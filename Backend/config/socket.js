const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const { redisConfig } = require("../services/queue");

let io = null;

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
    // console.log(`⚡ Socket connected: ${socket.id} (PID: ${process.pid})`);

    // User personal room
    socket.on("join:user", (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    // Project workspace room (Kanban boards)
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

    socket.on("disconnect", () => {
      // Clean disconnect
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
