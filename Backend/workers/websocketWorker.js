const { Worker } = require("bullmq");
const { redisConfig } = require("../services/queue");
const { emitToProject, emitToUser, emitToAll, getIO } = require("../config/socket");
const Redis = require("ioredis");

// Redis publisher client for cluster-wide broadcast
const redisPublisher = new Redis(redisConfig);

const ts = () => new Date().toISOString();

const websocketWorker = new Worker(
  "websocket-events-queue",
  async (job) => {
    const { room, event, data, target } = job.data;
    const io = getIO();

    if (target === "user" && room) {
      emitToUser(room, event, data);
    } else if (target === "project" && room) {
      emitToProject(room, event, data);
    } else if (target === "chat" && room) {
      if (io) {
        const chatRoom = room.startsWith("chat_") ? room : `chat_${room}`;
        io.to(chatRoom).emit(event, data);
      }
    } else if (target === "all") {
      emitToAll(event, data);
    } else if (io && room) {
      io.to(room).emit(event, data);
    }

    try {
      await redisPublisher.publish(
        "CLUSTER_WEBSOCKET_CHANNEL",
        JSON.stringify({ room, event, data, target })
      );
    } catch (err) {
      console.warn(`[${ts()}] [WebSocketWorker] Failed to publish to CLUSTER_WEBSOCKET_CHANNEL:`, err.message);
    }

    console.log(
      `[${ts()}] [WebSocketWorker] Dispatched job=${job.id} event=${event} target=${target} room=${room || "*"}`
    );

    return { delivered: true, event, target, room };
  },
  {
    connection: redisConfig,
    concurrency: 10,
  }
);

websocketWorker.on("failed", (job, err) => {
  console.error(`[${ts()}] [WebSocketWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = websocketWorker;
