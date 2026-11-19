const { Worker } = require("bullmq");
const { redisConfig, enqueueWebSocketEvent } = require("../services/queue");
const Notification = require("../models/notificationModel");

const notificationWorker = new Worker(
  "notification-queue",
  async (job) => {
    const { recipient, sender, task, type, message } = job.data;
    if (!recipient) return { skipped: true, reason: "No recipient" };

    // 1. Create notification in MongoDB
    const notif = await Notification.create({
      recipient,
      sender,
      task,
      type,
      message,
    });

    const populated = await Notification.findById(notif._id)
      .populate("sender", "fullname email avatar profilePicture")
      .populate("task", "key title status priority")
      .lean();

    // 2. Dispatch real-time WebSocket event via the websocket queue!
    await enqueueWebSocketEvent({
      target: "user",
      room: recipient.toString(),
      event: "notification:new",
      data: populated,
    });

    return { created: true, id: notif._id };
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

notificationWorker.on("failed", (job, err) => {
  console.error(`[Notification Worker] Job ${job?.id} failed:`, err.message);
});

module.exports = notificationWorker;
