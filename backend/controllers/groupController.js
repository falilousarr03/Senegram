const pool = require("../config/db");
const { buildConversation, ensureMember } = require("./conversationController");

async function isGroupAdmin(convId, userId) {
  const [[row]] = await pool.query(
    `SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?`,
    [convId, userId],
  );
  return row && (row.role === "owner" || row.role === "admin");
}

exports.create = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { name, description, avatar_url, member_ids = [] } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "name requis" });

    const members = Array.from(new Set([...member_ids, req.user.id].map(Number)));
    if (members.length < 2) {
      return res.status(400).json({ message: "Au moins 1 autre membre requis" });
    }

    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO conversations (type, name, description, avatar_url, created_by)
       VALUES ('group', ?, ?, ?, ?)`,
      [name.trim(), description || null, avatar_url || null, req.user.id],
    );
    const convId = r.insertId;

    const rows = members.map((uid) => [convId, uid, uid === req.user.id ? "owner" : "member"]);
    await conn.query(
      `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ?`,
      [rows],
    );

    // Message système
    await conn.query(
      `INSERT INTO messages (conversation_id, sender_id, content, type)
       VALUES (?, ?, ?, 'system')`,
      [convId, req.user.id, `Groupe "${name}" créé`],
    );

    await conn.commit();
    const conversation = await buildConversation(convId, req.user.id);
    const io = req.app.get("io");
    members.forEach((uid) => io.joinUserConversation?.(uid, convId));
    members
      .filter((uid) => uid !== req.user.id)
      .forEach((uid) => io.to(`user:${uid}`).emit("group:added", { conversation }));
    res.status(201).json({ conversation });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

exports.update = async (req, res, next) => {
  try {
    if (!(await isGroupAdmin(req.params.id, req.user.id))) {
      return res.status(403).json({ message: "Admin requis" });
    }
    const { name, description, avatar_url } = req.body;
    await pool.query(
      `UPDATE conversations
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           avatar_url = COALESCE(?, avatar_url)
       WHERE id = ? AND type = 'group'`,
      [name || null, description || null, avatar_url || null, req.params.id],
    );
    const conversation = await buildConversation(req.params.id, req.user.id);
    req.app.get("io").to(`conv:${req.params.id}`).emit("group:updated", { conversation });
    res.json({ conversation });
  } catch (err) { next(err); }
};

exports.addMembers = async (req, res, next) => {
  try {
    if (!(await isGroupAdmin(req.params.id, req.user.id))) {
      return res.status(403).json({ message: "Admin requis" });
    }
    const ids = (req.body.member_ids || []).map(Number).filter(Boolean);
    if (!ids.length) return res.status(400).json({ message: "member_ids vide" });

    const rows = ids.map((uid) => [req.params.id, uid, "member"]);
    await pool.query(
      `INSERT IGNORE INTO conversation_members (conversation_id, user_id, role) VALUES ?`,
      [rows],
    );
    const conversation = await buildConversation(req.params.id, req.user.id);
    const io = req.app.get("io");
    ids.forEach((uid) => io.joinUserConversation?.(uid, req.params.id));
    ids.forEach((uid) => io.to(`user:${uid}`).emit("group:added", { conversation }));
    io.to(`conv:${req.params.id}`).emit("group:updated", { conversation });
    res.json({ conversation });
  } catch (err) { next(err); }
};

exports.removeMember = async (req, res, next) => {
  try {
    const self = req.user.id === Number(req.params.userId);
    if (!self && !(await isGroupAdmin(req.params.id, req.user.id))) {
      return res.status(403).json({ message: "Admin requis" });
    }
    await pool.query(
      `DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?`,
      [req.params.id, req.params.userId],
    );
    const conversation = await buildConversation(req.params.id, req.user.id);
    req.app.get("io").to(`conv:${req.params.id}`).emit("group:updated", { conversation });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    if (!(await isGroupAdmin(req.params.id, req.user.id))) {
      return res.status(403).json({ message: "Admin requis" });
    }
    const role = req.body.role;
    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }
    if (Number(req.params.userId) === req.user.id) {
      return res.status(400).json({ message: "Impossible de modifier son propre rôle" });
    }

    const [[target]] = await pool.query(
      `SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?`,
      [req.params.id, req.params.userId],
    );
    if (!target) return res.status(404).json({ message: "Membre introuvable" });
    if (target.role === "owner") {
      return res.status(403).json({ message: "Impossible de modifier le propriétaire" });
    }

    await pool.query(
      `UPDATE conversation_members SET role = ? WHERE conversation_id = ? AND user_id = ?`,
      [role, req.params.id, req.params.userId],
    );
    const conversation = await buildConversation(req.params.id, req.user.id);
    req.app.get("io").to(`conv:${req.params.id}`).emit("group:updated", { conversation });
    res.json({ conversation });
  } catch (err) { next(err); }
};

exports.leave = async (req, res, next) => {
  try {
    const member = await ensureMember(req.params.id, req.user.id);
    if (!member) return res.status(404).json({ message: "Non membre" });
    await pool.query(
      `DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?`,
      [req.params.id, req.user.id],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!(await isGroupAdmin(req.params.id, req.user.id))) {
      return res.status(403).json({ message: "Admin requis" });
    }
    const [[conv]] = await pool.query(
      `SELECT id, type FROM conversations WHERE id = ?`,
      [req.params.id],
    );
    if (!conv || conv.type !== "group") {
      return res.status(404).json({ message: "Groupe introuvable" });
    }

    const io = req.app.get("io");
    io.to(`conv:${req.params.id}`).emit("group:deleted", {
      conversation_id: Number(req.params.id),
    });
    await pool.query(`DELETE FROM conversations WHERE id = ? AND type = 'group'`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.isGroupAdmin = isGroupAdmin;
