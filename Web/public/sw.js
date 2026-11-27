// Service Worker for Lira Workspace PWA Updates & Web Push Notifications
const SW_VERSION = "__LIRA_SW_VERSION__";
const CACHE_PREFIX = "lira-pwa-";
const CURRENT_CACHE = `${CACHE_PREFIX}${SW_VERSION}`;
const DEFAULT_ICON = "/lira-icon.svg";

self.addEventListener("install", (event) => {
  // Activate immediately only on initial install (no active controller yet).
  // On upgrades, wait cleanly until the user confirms the update popup ("SKIP_WAITING").
  if (!self.registration.active) {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("lira-") && k !== CURRENT_CACHE)
            .map((k) => caches.delete(k))
        );
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Lira Workspace", message: event.data.text() };
    }
  }

  const title = data.title || "Lira Workspace Update";
  const targetUrl = data.data || data.url || "/";
  const options = {
    body: data.body || data.message || "New activity in your workspace",
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
    tag: data.tag || "lira-workspace-notif",
    vibrate: [100, 50, 100],
    data: { url: targetUrl },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/";
  const resolvedUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(resolvedUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(resolvedUrl);
      }
      return undefined;
    })
  );
});
