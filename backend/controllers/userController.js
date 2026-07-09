const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const SELECT_PUBLIC = `
  id, username, email, display_name, avatar_url, bio, phone, status, is_online, last_seen, created_at
`;

exports.search = async (req, res, next) => {
  try {
    const q = `%${(req.query.q || "").toLowerCase()}%`;
    const [rows] = await pool.query(
      `SELECT ${SELECT_PUBLIC}
       FROM users
       WHERE (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ? OR LOWER(email) LIKE ?)
         AND id <> ?
       ORDER BY display_name
       LIMIT 25`,
      [q, q, q, req.user.id],
    );
    res.json({ users: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      `SELECT ${SELECT_PUBLIC} FROM users WHERE id = ?`,
      [req.params.id],
    );
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json({ user });
  } catch (err) { next(err); }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { display_name, bio, phone, avatar_url } = req.body;
    await pool.query(
      `UPDATE users
       SET display_name = COALESCE(?, display_name),
           bio          = COALESCE(?, bio),
           phone        = COALESCE(?, phone),
           avatar_url   = COALESCE(?, avatar_url)
       WHERE id = ?`,
      [display_name || null, bio || null, phone || null, avatar_url || null, req.user.id],
    );
    const [[user]] = await pool.query(
      `SELECT ${SELECT_PUBLIC} FROM users WHERE id = ?`,
      [req.user.id],
    );
    res.json({ user });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || new_password.length < 6) {
      return res.status(400).json({ message: "Mot de passe invalide (min 6)" });
    }
    const [[user]] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Mot de passe actuel incorrect" });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.listContacts = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.status, u.last_seen
       FROM contacts c
       JOIN users u ON u.id = c.contact_user_id
       WHERE c.user_id = ? AND c.is_blocked = 0
       ORDER BY u.display_name`,
      [req.user.id],
    );
    res.json({ contacts: rows });
  } catch (err) { next(err); }
};

exports.addContact = async (req, res, next) => {
  try {
    const contactUserId = Number(req.params.id);
    if (contactUserId === req.user.id) {
      return res.status(400).json({ message: "Impossible de s'ajouter soi-même" });
    }
    const [[target]] = await pool.query("SELECT id FROM users WHERE id = ?", [contactUserId]);
    if (!target) return res.status(404).json({ message: "Utilisateur introuvable" });

    await pool.query(
      `INSERT IGNORE INTO contacts (user_id, contact_user_id) VALUES (?, ?)`,
      [req.user.id, contactUserId],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.updateContact = async (req, res, next) => {
  try {
    const contactUserId = Number(req.params.id);
    if (contactUserId === req.user.id) {
      return res.status(400).json({ message: "Contact invalide" });
    }
    const alias = typeof req.body.alias === "string" ? req.body.alias.trim() : null;
    await pool.query(
      `INSERT INTO contacts (user_id, contact_user_id, alias)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE alias = VALUES(alias)`,
      [req.user.id, contactUserId, alias || null],
    );
    res.json({ ok: true, alias: alias || null });
  } catch (err) { next(err); }
};

exports.removeContact = async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM contacts WHERE user_id = ? AND contact_user_id = ?`,
      [req.user.id, req.params.id],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};
