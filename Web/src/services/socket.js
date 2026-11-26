import { io } from "socket.io-client";

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL;
const SOCKET_URL =
  rawSocketUrl === "/"
    ? undefined
    : rawSocketUrl ||
      (typeof window !== "undefined" && window.location.port !== "5173"
        ? window.location.origin
        : "http://localhost:4000");

let socket = null;

export const initSocketClient = (userId) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("⚡ Connected to WebSocket server:", socket.id);
      if (userId) {
        socket.emit("join:user", userId);
      }
    });

    socket.on("disconnect", () => {
      console.log("🔌 Disconnected from WebSocket server");
    });
  } else if (userId) {
    socket.emit("join:user", userId);
  }

  return socket;
};

export const getSocket = () => socket;

export const joinProjectRoom = (projectId) => {
  if (socket && projectId) {
    socket.emit("join:project", projectId);
  }
};

export const leaveProjectRoom = (projectId) => {
  if (socket && projectId) {
    socket.emit("leave:project", projectId);
  }
};

export const joinChatRoom = (roomId) => {
  if (socket && roomId) {
    socket.emit("join:chat", roomId);
  }
};

export const leaveChatRoom = (roomId) => {
  if (socket && roomId) {
    socket.emit("leave:chat", roomId);
  }
};

export const announcePeer = (peerData) => {
  if (socket) {
    socket.emit("peer:announce", peerData);
  }
};

export const sendPeerSignal = (targetSocketId, signal, metadata) => {
  if (socket && targetSocketId) {
    socket.emit("peer:signal", { targetSocketId, signal, metadata });
  }
};

export const sendSocketChatMessage = (payload) =>
  new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new Error("WebSocket not connected"));
    }
    socket.emit("chat:send", payload, (response) => {
      if (response?.success) {
        resolve(response);
      } else {
        reject(new Error(response?.message || "WebSocket chat send failed"));
      }
    });
  });

export const REALTIME_EVENT_NAME = "lira:realtime-event";

export const emitLocalRealtimeEvent = (event, data = {}) => {
  if (typeof window === "undefined" || !event) return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT_NAME, { detail: { event, data } }));
};

/**
 * Subscribe safely to real-time Socket.IO events regardless of child-before-parent mount order.
 * Receives every matching event relayed by AppProvider AND local instant refresh dispatches.
 */
export const subscribeRealtimeEvents = (events = [], handler) => {
  if (typeof window === "undefined" || typeof handler !== "function") return () => {};
  const allowed = new Set(Array.isArray(events) ? events : [events]);
  const onCustom = (e) => {
    const evt = e?.detail?.event;
    if (evt && (allowed.has("*") || allowed.has(evt))) {
      handler(e.detail.data || {}, evt);
    }
  };
  window.addEventListener(REALTIME_EVENT_NAME, onCustom);
  return () => window.removeEventListener(REALTIME_EVENT_NAME, onCustom);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
