const { Worker } = require("bullmq");
const { redisConfig } = require("../services/queue");
const { emitToProject, emitToUser, emitToAll } = require("../config/socket");
const Redis = require("ioredis");

// Redis publisher client for cluster-wide broadcast
const redisPublisher = new Redis(redisConfig);

const websocketWorker = new Worker(
  "websocket-events-queue",
  async (job) => {
    const { room, event, data, target } = job.data;
    // console.log(`[WebSocket Worker] Processing job ${job.id}: ${event} for ${target} (${room})`);

    // 1. Direct Socket.IO emit in current process
    const { getIO } = require("../config/socket");
    const io = getIO();
    if (io && room) {
      io.to(room).emit(event, data);
    } else if (target === "project") {
      emitToProject(room, event, data);
    } else if (target === "user") {
      emitToUser(room, event, data);
    } else {
      emitToAll(event, data);
    }

    // 2. Publish to Redis channel for multi-node cluster awareness
    try {
      await redisPublisher.publish(
        "CLUSTER_WEBSOCKET_CHANNEL",
        JSON.stringify({ room, event, data, target })
      );
    } catch (err) {
      console.warn("Failed to publish to CLUSTER_WEBSOCKET_CHANNEL:", err.message);
    }

    return { delivered: true, event, target, room };
  },
  {
    connection: redisConfig,
    concurrency: 10, // High throughput concurrency
  }
);

websocketWorker.on("completed", (job) => {
  // console.log(`[WebSocket Worker] Job ${job.id} completed`);
});

websocketWorker.on("failed", (job, err) => {
  console.error(`[WebSocket Worker] Job ${job?.id} failed:`, err.message);
});

module.exports = websocketWorker;
