const webpush = require("web-push");
const User = require("../models/userModel");

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@incuman.com";

let isVapidConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey.trim(), vapidPrivateKey.trim());
    isVapidConfigured = true;
    console.log("📲 WebPush VAPID service successfully configured");
  } catch (err) {
    console.warn("⚠️ Failed to configure VAPID for WebPush:", err.message);
  }
} else {
  console.log("ℹ️ VAPID keys not set, WebPush will simulate in logs");
}

const ts = () => new Date().toISOString();

/**
 * Send Web Push notification to a specific user
 */
async function sendPushToUser(userId, payload) {
  try {
    const user = await User.findById(userId).select("pushSubscription fullname email publicId");
    if (!user || !user.pushSubscription) {
      console.log(`[${ts()}] [PushService] User=${userId} (${user?.publicId || "-"}) has no browser push subscription; delivered in-app/WS.`);
      return false;
    }

    if (!isVapidConfigured) {
      console.log(`[${ts()}] [PushService] Simulated push to=${user.email} title="${payload.title}"`);
      return true;
    }

    const pushPayload = JSON.stringify({
      title: payload.title || "Lira Workspace",
      body: payload.body || payload.message || "",
      icon: payload.icon || "/logo.jpeg",
      data: payload.url || "/",
      timestamp: Date.now(),
    });

    await webpush.sendNotification(user.pushSubscription, pushPayload);
    console.log(`[${ts()}] [PushService] Delivered WebPush to=${user.email} publicId=${user.publicId || "-"}`);
    return true;
  } catch (err) {
    console.error(`[${ts()}] [PushService] Failed push user=${userId}:`, err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Clean up stale subscription
      await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: 1 } });
    }
    return false;
  }
}

/**
 * Send Web Push notification to all active Workspace Admins
 */
async function sendPushToAdmins(payload) {
  try {
    const admins = await User.find({ role: "admin", isActive: true }).select("_id pushSubscription email");
    const results = await Promise.allSettled(
      admins.map((admin) => sendPushToUser(admin._id, payload))
    );
    return results;
  } catch (err) {
    console.error("❌ [WebPush] Error broadcasting to admins:", err.message);
  }
}

module.exports = {
  isVapidConfigured,
  sendPushToUser,
  sendPushToAdmins,
};

