const crypto = require("crypto");
const { Worker } = require("bullmq");
const { redisConfig } = require("../services/queue");
const { emitTargetEvent, getIO } = require("../config/socket");
const Redis = require("ioredis");

// Redis publisher client for cluster-wide worker -> API Socket.IO broadcast relay
const redisPublisher = new Redis(redisConfig);
redisPublisher.on("error", () => {});

const ts = () => new Date().toISOString();

const websocketWorker = new Worker(
  "websocket-events-queue",
  async (job) => {
    const { room, event, data, target } = job.data;
    const io = getIO();

    if (io) {
      // Same-process mode (local dev without WORKER_ROLE): emit directly via io + Redis adapter
      emitTargetEvent(target, room, event, data);
    } else {
      // Dedicated worker process: relay once through Redis Pub/Sub to live API Socket.IO server(s)
      const deliveryId = job.id || crypto.randomUUID();
      await redisPublisher.publish(
        "CLUSTER_WEBSOCKET_CHANNEL",
        JSON.stringify({ deliveryId, room, event, data, target })
      );
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
