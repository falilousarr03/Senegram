import { createContext, useEffect, useState } from "react";
import { connectSocket, disconnectSocket } from "../services/socket";
import { useAuth } from "./AuthContext";

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({}); // { userId: 'online' | 'offline' }

  useEffect(() => {
    if (!token || !user) return;
    const s = connectSocket(token);
    setSocket(s);

    s.on("connect",    () => console.log("🟢 socket connected", s.id));
    s.on("disconnect", () => console.log("🔴 socket disconnected"));

    const onPresence = ({ user_id, status }) => {
      setOnlineUsers((prev) => ({ ...prev, [user_id]: status }));
    };

    s.on("presence:update", onPresence);
    s.on("user_online", onPresence);
    s.on("user_offline", onPresence);

    return () => {
      s.off("presence:update", onPresence);
      s.off("user_online", onPresence);
      s.off("user_offline", onPresence);
      disconnectSocket();
      setSocket(null);
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}
