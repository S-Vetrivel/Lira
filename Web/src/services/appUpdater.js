import {
  CLIENT_APP_META,
  isStandalonePwa,
  subscribeRealtimeEvents,
  checkSocketAppUpdate,
} from "./socket";

const SNOOZE_STORAGE_KEY = "lira_snoozed_build_id";

let state = {
  available: false,
  modalOpen: false,
  updating: false,
  source: "", // "websocket" | "pwa" | "manifest"
  isPwa: isStandalonePwa(),
  swWaiting: false,
  currentVersion: CLIENT_APP_META.version,
  currentBuildId: CLIENT_APP_META.buildId,
  newVersion: "",
  newBuildId: "",
  builtAt: "",
};

const listeners = new Set();
let swRegistration = null;
let initialized = false;
let lastCheckAt = 0;

function notify() {
  for (const fn of listeners) {
    fn(state);
  }
}

function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

function isRemoteBuildNewer(serverInfo = {}) {
  const remoteId = String(serverInfo?.buildId || "").trim();
  const localId = String(CLIENT_APP_META.buildId || "dev").trim();
  if (!remoteId || localId === "dev" || remoteId.startsWith("srv-")) {
    return false;
  }
  return remoteId !== localId;
}

function readSnoozedBuildId() {
  try {
    return sessionStorage.getItem(SNOOZE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeSnoozedBuildId(buildId) {
  try {
    if (buildId) sessionStorage.setItem(SNOOZE_STORAGE_KEY, buildId);
    else sessionStorage.removeItem(SNOOZE_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

function raiseUpdate({ source, version, buildId, builtAt, swWaiting = false }) {
  const targetBuildId = String(buildId || swRegistration?.waiting?.scriptURL || "pwa-waiting").trim();
  const snoozedId = readSnoozedBuildId();
  const shouldOpenModal = !snoozedId || snoozedId !== targetBuildId;

  setState({
    available: true,
    modalOpen: state.modalOpen || shouldOpenModal,
    source: swWaiting ? "pwa" : source || state.source || "websocket",
    isPwa: isStandalonePwa(),
    swWaiting: Boolean(swWaiting || state.swWaiting),
    newVersion: version || state.newVersion || CLIENT_APP_META.version,
    newBuildId: targetBuildId,
    builtAt: builtAt || state.builtAt || "",
  });
}

function handleServerVersionPayload(payload = {}, explicitSource = "websocket") {
  if (!payload || !isRemoteBuildNewer(payload)) return;
  if (swRegistration && typeof swRegistration.update === "function") {
    swRegistration.update().catch(() => {});
  }
  raiseUpdate({
    source: explicitSource,
    version: payload.version,
    buildId: payload.buildId,
    builtAt: payload.builtAt,
    swWaiting: Boolean(swRegistration?.waiting),
  });
}

async function fetchVersionManifestFallback() {
  if (import.meta.env.DEV || CLIENT_APP_META.buildId === "dev") return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    handleServerVersionPayload(data, "manifest");
  } catch {
    // ignore offline/network errors
  }
}

function bindRegistrationListeners(reg) {
  if (!reg) return;
  if (reg.waiting && navigator.serviceWorker?.controller) {
    raiseUpdate({
      source: "pwa",
      version: state.newVersion || CLIENT_APP_META.version,
      buildId: state.newBuildId || `pwa-${Date.now().toString(36)}`,
      swWaiting: true,
    });
  }

  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker?.controller) {
        raiseUpdate({
          source: "pwa",
          version: state.newVersion || CLIENT_APP_META.version,
          buildId: state.newBuildId || `pwa-${Date.now().toString(36)}`,
          swWaiting: true,
        });
      }
    });
  });
}

export function initAppUpdater() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  // 1. WebSocket connection initiation + live rollout notifications
  subscribeRealtimeEvents(["app:version", "app:update-available"], (payload, eventName) => {
    handleServerVersionPayload(payload, eventName === "app:update-available" ? "websocket" : "websocket");
  });

  // 2. Service Worker registration & PWA lifecycle tracking
  if ("serviceWorker" in navigator && !import.meta.env.DEV) {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        swRegistration = reg;
        bindRegistrationListeners(reg);
      })
      .catch(() => {
        // ignore SW registration failure in unsupported contexts
      });
  }

  // 3. Re-check on tab focus/reconnect (throttled to once per 60s)
  const runThrottledCheck = () => {
    const now = Date.now();
    if (now - lastCheckAt < 60_000) return;
    lastCheckAt = now;
    if (swRegistration?.update) swRegistration.update().catch(() => {});
    checkSocketAppUpdate().then((res) => {
      if (res) handleServerVersionPayload(res, "websocket");
    });
    fetchVersionManifestFallback();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") runThrottledCheck();
  });
  window.addEventListener("online", runThrottledCheck);
}

export async function checkForAppUpdatesNow() {
  if (swRegistration?.update) {
    await swRegistration.update().catch(() => {});
  }
  const wsRes = await checkSocketAppUpdate();
  if (wsRes) {
    handleServerVersionPayload(wsRes, "websocket");
    if (isRemoteBuildNewer(wsRes)) return true;
  }
  await fetchVersionManifestFallback();
  return state.available;
}

export function dismissAppUpdate() {
  writeSnoozedBuildId(state.newBuildId || "snoozed");
  setState({ modalOpen: false });
}

export function reopenAppUpdateModal() {
  setState({ modalOpen: true });
}

export async function applyAppUpdate() {
  if (state.updating) return;
  setState({ updating: true });
  writeSnoozedBuildId("");

  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("lira-")).map((k) => caches.delete(k)));
    }
  } catch {
    // ignore cache clear errors
  }

  const waiting = swRegistration?.waiting;
  if (waiting && "serviceWorker" in navigator) {
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
      waiting.postMessage({ type: "SKIP_WAITING" });
      setTimeout(done, 1500);
    });
  }

  window.location.reload();
}

export function subscribeAppUpdater(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getAppUpdaterSnapshot() {
  return state;
}

