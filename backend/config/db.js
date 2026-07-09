/**
 * Pool MySQL compatible XAMPP / Aiven.
 * On expose un `pool` utilisable partout avec await pool.query(...).
 */
const fs = require("fs");
const mysql = require("mysql2/promise");
require("dotenv").config();

function sslConfig() {
  if (process.env.DB_SSL !== "true") return undefined;
  if (process.env.DB_CA_CERT) {
    return { ca: process.env.DB_CA_CERT.replace(/\\n/g, "\n") };
  }
  if (process.env.DB_CA_PATH && fs.existsSync(process.env.DB_CA_PATH)) {
    return { ca: fs.readFileSync(process.env.DB_CA_PATH, "utf8") };
  }
  return { rejectUnauthorized: false };
}

function configFromUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "") || process.env.DB_NAME || "senegram",
  };
}

const urlConfig = process.env.MYSQL_URL || process.env.DATABASE_URL
  ? configFromUrl(process.env.MYSQL_URL || process.env.DATABASE_URL)
  : null;

const pool = mysql.createPool({
  ...(urlConfig || {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "senegram",
  }),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_MAX) || 15,
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: false,
  ssl: sslConfig(),
});

const activeDatabase = (urlConfig || {}).database || process.env.DB_NAME || "senegram";

pool
  .getConnection()
  .then((conn) => {
    console.log(`✅ MySQL connecté (${activeDatabase})`);
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Impossible de se connecter à MySQL :", err.message);
  });

// Exporte le pool directement (controllers font pool.query())
// + compat object pour d'autres usages
module.exports = pool;
module.exports.pool = pool;
