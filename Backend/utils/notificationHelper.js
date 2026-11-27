const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const Role = require("../models/roleModel");
const {
  enqueueNotification,
  enqueueWebSocketEvent,
  enqueueEmailJob,
} = require("../services/queue");
const { sendPushToUser } = require("../services/pushService");
const { isUserOnline } = require("../config/socket");
const { isSuperAdminEmail, hasWildcardPermission } = require("./roles");

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
  alsoEmail = false,
  emailType = "workspace_event",
  emailData,
  actionUrl = "/",
  recipientEmail,
}) => {
  try {
    if (!recipient) return null;
    if (!allowSelf && sender && recipient.toString() === sender.toString()) return null;

    const recipientId = recipient.toString();
    const online = isUserOnline(recipientId);

    // Optional guaranteed email queue dispatch alongside notification + WebSocket + WebPush
    if (alsoEmail) {
      Promise.resolve()
        .then(async () => {
          let toEmail = recipientEmail;
          if (!toEmail) {
            const uDoc = await User.findById(recipientId).select("email").lean();
            toEmail = uDoc?.email;
          }
          if (toEmail) {
            const emailJob = await enqueueEmailJob({
              to: toEmail,
              type: emailType,
              data: emailData || { title, message, publicId, actionUrl },
            });
            if (emailJob) {
              console.log(
                `[${ts()}] [EmailQueue] Enqueued job=${emailJob.id} to=${toEmail} type=${emailType} publicId=${publicId || "-"}`
              );
            }
          }
        })
        .catch(() => {});
    }

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
          title: publicId ? `${title || "Lira Notification"} (${publicId})` : title || "Lira Notification",
          message,
          url: actionUrl,
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
    }).catch(() => {});

    sendPushToUser(recipientId, {
      title: publicId ? `${title || "Lira Notification"} (${publicId})` : title || "Lira Notification",
      message,
      url: actionUrl,
    }).catch(() => {});

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
  alsoEmail = false,
  emailType = "workspace_event",
  emailData,
  actionUrl = "/",
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
      createNotification({
        recipient,
        sender,
        task,
        publicId,
        type,
        title,
        message,
        alsoEmail,
        emailType,
        emailData,
        actionUrl,
      })
    )
  );
};

/**
 * Notify all active users who hold a given dynamic permission (e.g. `requests.approve`, `team.join_requests`)
 * PLUS Superadmins — ensures custom dynamic roles always receive WebSocket, Push, and Email notifications.
 */
const notifyPermissionHolders = async ({
  permissionSlug,
  sender,
  publicId,
  type = "approval_request",
  title,
  message,
  emailType = "workspace_event",
  emailData,
  actionUrl = "/",
}) => {
  try {
    const allRoles = await Role.find().select("name permissions isSystem").lean();
    const eligibleRoleNames = allRoles
      .filter(
        (r) =>
          r.isSystem ||
          r.name === "superadmin" ||
          hasWildcardPermission(r.permissions, permissionSlug)
      )
      .map((r) => r.name);

    const activeUsers = await User.find({
      isActive: true,
      status: { $ne: "rejected" },
    })
      .select("_id email fullname role customPermissions")
      .lean();

    const targets = activeUsers.filter((u) => {
      if (sender && u._id.toString() === sender.toString()) return false;
      if (isSuperAdminEmail(u.email) || u.role === "superadmin") return true;
      if (eligibleRoleNames.includes(String(u.role || "").toLowerCase())) return true;
      if (Array.isArray(u.customPermissions) && hasWildcardPermission(u.customPermissions, permissionSlug)) {
        return true;
      }
      return false;
    });

    console.log(
      `[${ts()}] [NotifyPerm] perm=${permissionSlug} recipients=${targets.length} publicId=${publicId || "-"}`
    );

    await Promise.allSettled(
      targets.map((target) =>
        createNotification({
          recipient: target._id,
          sender,
          publicId,
          type,
          title,
          message,
          alsoEmail: Boolean(emailType),
          emailType,
          emailData,
          actionUrl,
          recipientEmail: target.email,
        })
      )
    );

    return targets.length;
  } catch (err) {
    console.error(`[${ts()}] [NotifyPerm] Failed:`, err.message);
    return 0;
  }
};

/**
 * Notify all active Workspace Admins & dynamic `team.join_requests` approvers via:
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
  return await notifyPermissionHolders({
    permissionSlug: "team.join_requests",
    sender,
    publicId,
    type,
    title,
    message,
    emailType: emailType || "workspace_event",
    emailData,
    actionUrl: "/team?tab=join-requests",
  });
};

module.exports = { createNotification, notifyUsers, notifyPermissionHolders, notifyAdmins };
