const jwt  = require("jsonwebtoken");
const pool = require("../config/db");

const chatSocket = require("./chatSocket");
const callSocket = require("./callSocket");

/**
 * Attache les handlers Socket.IO après authentification JWT.
 * Le frontend envoie le token via `auth: { token }` dans io().
 */
module.exports = function socketHandler(io) {
  io.onlineUsers = io.onlineUsers || new Map();
  io.joinUserConversation = (userId, conversationId) => {
    const sockets = io.onlineUsers.get(Number(userId));
    if (!sockets) return;
    sockets.forEach((socketId) => {
      io.sockets.sockets.get(socketId)?.join(`conv:${conversationId}`);
    });
  };

  // Middleware d'auth
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Token manquant"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch {
      next(new Error("Token invalide"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.id;
    console.log(`🔌 [socket] ${socket.user.username} connecté (${socket.id})`);
    const userSockets = io.onlineUsers.get(userId) || new Set();
    userSockets.add(socket.id);
    io.onlineUsers.set(userId, userSockets);

    // Room personnelle pour les notifications
    socket.join(`user:${userId}`);

    // Joindre automatiquement toutes les conversations dont il est membre
    try {
      const [rows] = await pool.query(
        `SELECT conversation_id FROM conversation_members WHERE user_id = ?`,
        [userId],
      );
      rows.forEach((r) => socket.join(`conv:${r.conversation_id}`));
    } catch (err) {
      console.error("Erreur join rooms:", err.message);
    }

    // Statut = online
    await pool.query(`UPDATE users SET status = 'online', is_online = 1 WHERE id = ?`, [userId]);
    io.emit("user_online", { user_id: userId, status: "online" });
    io.emit("presence:update", { user_id: userId, status: "online" });

    // Handlers
    chatSocket(io, socket);
    callSocket(io, socket);

    socket.on("disconnect", async () => {
      const sockets = io.onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size) {
          io.onlineUsers.set(userId, sockets);
          console.log(`🔌 [socket] ${socket.user.username} onglet fermé (${socket.id})`);
          return;
        }
        io.onlineUsers.delete(userId);
      }
      await pool.query(
        `UPDATE users SET status = 'offline', is_online = 0, last_seen = NOW() WHERE id = ?`,
        [userId],
      );
      const payload = {
        user_id: userId,
        status: "offline",
        last_seen: new Date(),
      };
      io.emit("user_offline", payload);
      io.emit("presence:update", payload);
      console.log(`🔌 [socket] ${socket.user.username} déconnecté`);
    });
  });
};
