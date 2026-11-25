const { Worker } = require("bullmq");
const { redisConfig, enqueueWebSocketEvent } = require("../services/queue");
const Notification = require("../models/notificationModel");
const { isUserOnline } = require("../config/socket");

const ts = () => new Date().toISOString();

const notificationWorker = new Worker(
  "notification-queue",
  async (job) => {
    const { recipient, sender, task, publicId, type, title, message } = job.data;
    if (!recipient) return { skipped: true, reason: "No recipient" };

    // 1. Create notification in MongoDB
    const notif = await Notification.create({
      recipient,
      sender,
      task,
      publicId,
      type: type || "system",
      title,
      message,
    });

    const populated = await Notification.findById(notif._id)
      .populate("sender", "fullname email avatar profilePicture publicId")
      .populate("task", "key title status priority")
      .lean();

    const online = isUserOnline(recipient.toString());

    // 2. Dispatch real-time WebSocket event via the websocket queue!
    await enqueueWebSocketEvent({
      target: "user",
      room: recipient.toString(),
      event: "notification:new",
      data: populated,
    });

    console.log(
      `[${ts()}] [NotificationWorker] Processed job=${job.id} notif=${notif._id} recipient=${recipient} publicId=${publicId || "-"} online=${online}`
    );

    return { created: true, id: notif._id, online };
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

notificationWorker.on("failed", (job, err) => {
  console.error(`[${ts()}] [NotificationWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = notificationWorker;
