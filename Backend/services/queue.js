const { Queue } = require("bullmq");
const Redis = require("ioredis");

// 1. Setup Redis Connection
const connection = new Redis({
  host: "127.0.0.1", // Your Redis Host
  port: 6379, // Your Redis Port
  maxRetriesPerRequest: null,
});

// 2. Create the Queue
const mediaQueue = new Queue("media-processing", { connection });
const notificationQueue = new Queue("notification-queue", { connection });
const orderProcessingQueue = new Queue("order-processing-queue", {
  connection,
});
module.exports = {
  mediaQueue,
  notificationQueue,
  connection,
  orderProcessingQueue,
};
