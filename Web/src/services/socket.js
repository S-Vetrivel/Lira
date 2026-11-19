import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

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

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
