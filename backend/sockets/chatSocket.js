const pool = require("../config/db");

/**
 * Events côté chat :
 *   conversation:join          { conversation_id }
 *   conversation:leave         { conversation_id }
 *   typing_start               { conversation_id }
 *   typing_stop                { conversation_id }
 *   typing                     { conversation_id, is_typing } legacy
 *   message:read               { conversation_id, message_id }
 *
 * Les events "message:new / edited / deleted" sont émis depuis le controller
 * REST pour que la source de vérité reste la DB.
 */
module.exports = function chatSocket(io, socket) {
  const userId = socket.user.id;

  socket.on("conversation:join", ({ conversation_id }) => {
    if (!conversation_id) return;
    socket.join(`conv:${conversation_id}`);
  });

  socket.on("conversation:leave", ({ conversation_id }) => {
    if (!conversation_id) return;
    socket.leave(`conv:${conversation_id}`);
  });

  socket.on("typing", ({ conversation_id, is_typing }) => {
    if (!conversation_id) return;
    const payload = {
      conversation_id,
      user_id: userId,
      username: socket.user.username,
      is_typing: !!is_typing,
    };
    socket.to(`conv:${conversation_id}`).emit("typing", payload);
    socket.to(`conv:${conversation_id}`).emit(is_typing ? "typing_start" : "typing_stop", payload);
  });

  socket.on("typing_start", async ({ conversation_id }) => {
    if (!conversation_id) return;
    try {
      const [[member]] = await pool.query(
        `SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
        [conversation_id, userId],
      );
      if (!member) return;
      socket.to(`conv:${conversation_id}`).emit("typing_start", {
        conversation_id,
        user_id: userId,
        username: socket.user.username,
        is_typing: true,
      });
    } catch (err) {
      console.error("typing_start error", err.message);
    }
  });

  socket.on("typing_stop", async ({ conversation_id }) => {
    if (!conversation_id) return;
    try {
      const [[member]] = await pool.query(
        `SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
        [conversation_id, userId],
      );
      if (!member) return;
      socket.to(`conv:${conversation_id}`).emit("typing_stop", {
        conversation_id,
        user_id: userId,
        username: socket.user.username,
        is_typing: false,
      });
    } catch (err) {
      console.error("typing_stop error", err.message);
    }
  });

  socket.on("message:read", async ({ conversation_id, message_id }) => {
    if (!conversation_id || !message_id) return;
    try {
      await pool.query(
        `UPDATE conversation_members
         SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?)
         WHERE conversation_id = ? AND user_id = ?`,
        [message_id, conversation_id, userId],
      );
      await pool.query(
        `INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)`,
        [message_id, userId],
      );
      await pool.query(
        `UPDATE messages
         SET delivered_at = COALESCE(delivered_at, NOW())
         WHERE id = ? AND sender_id <> ?`,
        [message_id, userId],
      );
      await pool.query(
        `UPDATE messages m
         SET m.read_at = NOW()
         WHERE m.id = ?
           AND m.read_at IS NULL
           AND NOT EXISTS (
             SELECT 1
             FROM conversation_members cm
             WHERE cm.conversation_id = m.conversation_id
               AND cm.user_id <> m.sender_id
               AND NOT EXISTS (
                 SELECT 1
                 FROM message_reads mr
                 WHERE mr.message_id = m.id AND mr.user_id = cm.user_id
               )
           )`,
        [message_id],
      );
      const [[msg]] = await pool.query(
        `SELECT delivered_at, read_at FROM messages WHERE id = ?`,
        [message_id],
      );
      io.to(`conv:${conversation_id}`).emit("message_delivered", {
        conversation_id,
        message_id,
        delivered_at: msg?.delivered_at || new Date(),
      });
      io.to(`conv:${conversation_id}`).emit("message:read", {
        conversation_id,
        message_id,
        user_id: userId,
      });
      io.to(`conv:${conversation_id}`).emit("message_read", {
        conversation_id,
        message_id,
        user_id: userId,
        read_at: msg?.read_at || new Date(),
      });
    } catch (err) {
      console.error("message:read error", err.message);
    }
  });
};
