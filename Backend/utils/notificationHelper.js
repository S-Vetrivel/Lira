const Notification = require("../models/notificationModel");
const { enqueueWebSocketEvent } = require("../services/queue");

const createNotification = async ({ recipient, sender, task, type, message }) => {
  try {
    if (!recipient || recipient.toString() === sender?.toString()) return null;

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

    // Enqueue real-time notification update to user's personal WebSocket channel via Redis queue
    await enqueueWebSocketEvent({
      target: "user",
      room: recipient.toString(),
      event: "notification:new",
      data: populated,
    });

    return populated;
  } catch (error) {
    console.error("Create notification error:", error.message);
  }
};

module.exports = { createNotification };
