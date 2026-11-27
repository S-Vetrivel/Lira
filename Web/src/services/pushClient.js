import { getVapidPublicKeyAPI, registerPushSubscription } from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function resolveVapidKey() {
  const envKey = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
  if (envKey) return envKey;
  const res = await getVapidPublicKeyAPI();
  return String(res?.vapidPublicKey || "").trim();
}

export async function enableBrowserPush({ interactive = true } = {}) {
  if (typeof window === "undefined") {
    return { supported: false, subscribed: false, reason: "ssr" };
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { supported: false, subscribed: false, permission: "unsupported", reason: "unsupported" };
  }
  if (
    !window.isSecureContext &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return { supported: false, subscribed: false, permission: Notification.permission, reason: "insecure_origin" };
  }

  let permission = Notification.permission;
  if (permission === "default" && interactive) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { supported: true, subscribed: false, permission, reason: permission };
  }

  try {
    const vapidKey = await resolveVapidKey();
    if (!vapidKey) {
      return { supported: true, subscribed: false, permission, reason: "missing_vapid_key" };
    }

    const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const res = await registerPushSubscription(subscription);
    return {
      supported: true,
      permission,
      subscribed: Boolean(res?.success),
      reason: res?.success ? "subscribed" : "api_failed",
    };
  } catch (err) {
    return {
      supported: true,
      permission,
      subscribed: false,
      reason: "error",
      error: err.message,
    };
  }
}

export async function syncExistingPushSubscription() {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  return enableBrowserPush({ interactive: false });
}

