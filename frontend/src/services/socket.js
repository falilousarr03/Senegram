import { io } from "socket.io-client";
import { API_URL } from "./api";

let socket = null;
let disconnectTimer = null;
let socketToken = null;

export function connectSocket(token) {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (socket && socketToken === token) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token;
  socket = io(API_URL, {
    auth: { token },
    transports: ["polling", "websocket"],
    reconnection: true,
    upgrade: false,
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
    socketToken = null;
    disconnectTimer = null;
  };

  disconnectTimer = setTimeout(closeSocket, 500);
}
