const webpush = require("web-push");
const User = require("../models/userModel");

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@incuman.com";

let isVapidConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isVapidConfigured = true;
    console.log("📲 WebPush VAPID service successfully configured");
  } catch (err) {
    console.warn("⚠️ Failed to configure VAPID for WebPush:", err.message);
  }
} else {
  console.log("ℹ️ VAPID keys not set, WebPush will simulate in logs");
}

const ts = () => new Date().toISOString();

function getVapidPublicKey() {
  return vapidPublicKey;
}

/**
 * Send Web Push notification to a specific user with detailed delivery outcome.
 */
async function sendPushToUserDetailed(userId, payload) {
  try {
    const user = await User.findById(userId).select("pushSubscription fullname email publicId").lean();
    if (!user || !user.pushSubscription) {
      console.log(`[${ts()}] [PushService] User=${userId} (${user?.publicId || "-"}) has no browser push subscription; delivered in-app/WS.`);
      return { delivered: false, reason: "no_subscription" };
    }

    if (!isVapidConfigured) {
      console.log(`[${ts()}] [PushService] Simulated push to=${user.email} title="${payload.title}"`);
      return { delivered: true, simulated: true, reason: "simulated_no_vapid" };
    }

    const pushPayload = JSON.stringify({
      title: payload.title || "Lira Workspace",
      body: payload.body || payload.message || "",
      icon: payload.icon || "/lira-icon.svg",
      badge: payload.badge || "/lira-icon.svg",
      tag: payload.tag || undefined,
      data: payload.url || "/",
      url: payload.url || "/",
      timestamp: Date.now(),
    });

    await webpush.sendNotification(user.pushSubscription, pushPayload);
    console.log(`[${ts()}] [PushService] Delivered WebPush to=${user.email} publicId=${user.publicId || "-"}`);
    return { delivered: true, reason: "sent" };
  } catch (err) {
    console.error(`[${ts()}] [PushService] Failed push user=${userId}:`, err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: 1 } }).catch(() => {});
    }
    return { delivered: false, reason: "error", error: err.message };
  }
}

/**
 * Send Web Push notification to a specific user (boolean compatibility wrapper).
 */
async function sendPushToUser(userId, payload) {
  const res = await sendPushToUserDetailed(userId, payload);
  return Boolean(res?.delivered);
}

/**
 * Send Web Push notification to all active Workspace Admins
 */
async function sendPushToAdmins(payload) {
  try {
    const admins = await User.find({ role: { $in: ["admin", "superadmin"] }, isActive: true }).select("_id").lean();
    return await Promise.allSettled(admins.map((admin) => sendPushToUser(admin._id, payload)));
  } catch (err) {
    console.error("❌ [WebPush] Error broadcasting to admins:", err.message);
    return [];
  }
}

module.exports = {
  isVapidConfigured,
  getVapidPublicKey,
  sendPushToUserDetailed,
  sendPushToUser,
  sendPushToAdmins,
};
