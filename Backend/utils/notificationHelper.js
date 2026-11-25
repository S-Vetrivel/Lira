const Notification = require("../models/notificationModel");
const { enqueueNotification, enqueueWebSocketEvent } = require("../services/queue");
const { sendPushToUser } = require("../services/pushService");

const createNotification = async ({
  recipient,
  sender,
  task,
  type = "system",
  title,
  message,
  allowSelf = false,
}) => {
  try {
    if (!recipient) return null;
    if (!allowSelf && sender && recipient.toString() === sender.toString()) return null;

    // Route through Redis notification queue when available
    try {
      const job = await enqueueNotification({
        recipient: recipient.toString(),
        sender: sender ? sender.toString() : undefined,
        task: task ? task.toString() : undefined,
        type,
        title,
        message,
      });

      if (job) {
        sendPushToUser(recipient.toString(), {
          title: title || "Lira Notification",
          message,
          url: "/",
        }).catch(() => {});
        return { queued: true, jobId: job.id };
      }
    } catch (queueErr) {
      // Fall back to direct creation if Redis queue is temporarily unavailable
    }

    const notif = await Notification.create({
      recipient,
      sender,
      task,
      type,
      title,
      message,
    });

    const populated = await Notification.findById(notif._id)
      .populate("sender", "fullname email avatar profilePicture")
      .populate("task", "key title status priority")
      .lean();

    await enqueueWebSocketEvent({
      target: "user",
      room: recipient.toString(),
      event: "notification:new",
      data: populated,
    });

    return populated;
  } catch (error) {
    console.error("Create notification error:", error.message);
    return null;
  }
};

const notifyUsers = async ({ recipients = [], sender, task, type = "system", title, message }) => {
  const uniqueIds = Array.from(
    new Set(
      (recipients || [])
        .filter(Boolean)
        .map((id) => (id._id ? id._id.toString() : id.toString()))
    )
  );
  await Promise.all(
    uniqueIds.map((recipient) =>
      createNotification({ recipient, sender, task, type, title, message })
    )
  );
};

module.exports = { createNotification, notifyUsers };
