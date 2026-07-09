import { io } from "socket.io-client";
import { API_URL } from "./api";

let socket = null;
let disconnectTimer = null;

export function connectSocket(token) {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (socket) return socket;

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;

  const closeSocket = () => {
    if (!socket) return;
    socket.disconnect();
    socket = null;
    disconnectTimer = null;
  };

  if (import.meta.env.DEV) {
    disconnectTimer = setTimeout(closeSocket, 0);
  } else {
    closeSocket();
  }
}
