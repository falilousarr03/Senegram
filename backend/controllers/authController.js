const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const pool   = require("../config/db");

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

function publicUser(u) {
  return {
    id:           u.id,
    username:     u.username,
    email:        u.email,
    display_name: u.display_name,
    avatar_url:   u.avatar_url,
    bio:          u.bio,
    phone:        u.phone,
    status:       u.status,
    last_seen:    u.last_seen,
    created_at:   u.created_at,
  };
}

exports.register = async (req, res, next) => {
  try {
    const { username, email, password, display_name, phone } = req.body;

    if (!username || !email || !password || !display_name) {
      return res.status(400).json({ message: "Champs requis: username, email, password, display_name" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Mot de passe trop court (min 6)" });
    }

    const [rows] = await pool.query(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, email],
    );
    if (rows.length) {
      return res.status(409).json({ message: "Username ou email déjà utilisé" });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [username.toLowerCase(), email.toLowerCase(), hash, display_name, phone || null],
    );

    const [[user]] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);

    res.status(201).json({
      token: signToken(user),
      user:  publicUser(user),
    });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;   // identifier = username OU email
    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier & password requis" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1",
      [identifier.toLowerCase(), identifier.toLowerCase()],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: "Identifiants invalides" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Identifiants invalides" });

    await pool.query(
      "UPDATE users SET status = 'online', is_online = 1, last_seen = NOW() WHERE id = ?",
      [user.id],
    );

    res.json({
      token: signToken(user),
      user:  publicUser({ ...user, status: "online" }),
    });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const [[user]] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE users SET status = 'offline', is_online = 0, last_seen = NOW() WHERE id = ?",
      [req.user.id],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};
