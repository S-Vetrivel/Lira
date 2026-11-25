const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const {
  enqueueNotification,
  enqueueWebSocketEvent,
  enqueueEmailJob,
} = require("../services/queue");
const { sendPushToUser } = require("../services/pushService");
const { isUserOnline } = require("../config/socket");

const ts = () => new Date().toISOString();

const createNotification = async ({
  recipient,
  sender,
  task,
  publicId,
  type = "system",
  title,
  message,
  allowSelf = false,
}) => {
  try {
    if (!recipient) return null;
    if (!allowSelf && sender && recipient.toString() === sender.toString()) return null;

    const recipientId = recipient.toString();
    const online = isUserOnline(recipientId);

    // Route through Redis notification queue
    try {
      const job = await enqueueNotification({
        recipient: recipientId,
        sender: sender ? sender.toString() : undefined,
        task: task ? task.toString() : undefined,
        publicId,
        type,
        title,
        message,
        createdAt: ts(),
      });

      if (job) {
        console.log(
          `[${ts()}] [NotificationQueue] Enqueued job=${job.id} recipient=${recipientId} publicId=${publicId || "-"} online=${online} type=${type}`
        );

        sendPushToUser(recipientId, {
          title: title || "Lira Notification",
          message,
          url: "/",
        }).catch(() => {});

        return { queued: true, jobId: job.id };
      }
    } catch (queueErr) {
      console.warn(`[${ts()}] [NotificationQueue] Fallback to direct DB create:`, queueErr.message);
    }

    const notif = await Notification.create({
      recipient: recipientId,
      sender,
      task,
      publicId,
      type,
      title,
      message,
    });

    const populated = await Notification.findById(notif._id)
      .populate("sender", "fullname email avatar profilePicture publicId")
      .populate("task", "key title status priority")
      .lean();

    await enqueueWebSocketEvent({
      target: "user",
      room: recipientId,
      event: "notification:new",
      data: populated,
    });

    console.log(
      `[${ts()}] [Notification] Created direct notif=${notif._id} recipient=${recipientId} publicId=${publicId || "-"}`
    );

    return populated;
  } catch (error) {
    console.error(`[${ts()}] [Notification] Create error:`, error.message);
    return null;
  }
};

const notifyUsers = async ({
  recipients = [],
  sender,
  task,
  publicId,
  type = "system",
  title,
  message,
}) => {
  const uniqueIds = Array.from(
    new Set(
      (recipients || [])
        .filter(Boolean)
        .map((id) => (id._id ? id._id.toString() : id.toString()))
    )
  );
  await Promise.all(
    uniqueIds.map((recipient) =>
      createNotification({ recipient, sender, task, publicId, type, title, message })
    )
  );
};

/**
 * Notify all active Workspace Admins via:
 * 1. Notification Queue (DB persist + WebSocket push to online user room + WebPush)
 * 2. Email Queue (Custom SMTP if configured)
 * 3. Timestamped backend logs
 */
const notifyAdmins = async ({
  sender,
  publicId,
  type = "approval_request",
  title,
  message,
  emailType,
  emailData,
}) => {
  try {
    const admins = await User.find({
      role: "admin",
      isActive: true,
      status: { $ne: "rejected" },
    })
      .select("_id email fullname")
      .lean();

    console.log(
      `[${ts()}] [NotifyAdmins] Dispatching alerts to ${admins.length} admin(s) | publicId=${publicId || "-"} | title="${title}"`
    );

    await Promise.allSettled(
      admins.map(async (admin) => {
        await createNotification({
          recipient: admin._id,
          sender,
          publicId,
          type,
          title,
          message,
        });

        if (emailType && admin.email) {
          const emailJob = await enqueueEmailJob({
            to: admin.email,
            type: emailType,
            data: emailData || { title, message, publicId },
          });
          if (emailJob) {
            console.log(
              `[${ts()}] [EmailQueue] Enqueued admin email job=${emailJob.id} to=${admin.email} type=${emailType} publicId=${publicId || "-"}`
            );
          }
        }
      })
    );

    return admins.length;
  } catch (err) {
    console.error(`[${ts()}] [NotifyAdmins] Failed:`, err.message);
    return 0;
  }
};

module.exports = { createNotification, notifyUsers, notifyAdmins };
