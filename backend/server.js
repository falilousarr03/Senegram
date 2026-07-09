/**
 * Senegram - serveur Express + Socket.IO.
 *
 * Expose:
 *   REST     : /api/auth, /api/users, /api/conversations, /api/messages,
 *              /api/groups, /api/upload, /api/calls
 *   Socket   : chat temps-réel, présence, typing, signaling WebRTC.
 */
require("dotenv").config();

const fs      = require("fs");
const path    = require("path");
const http    = require("http");
const https   = require("https");
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const { Server: SocketServer } = require("socket.io");

const authRoutes         = require("./routes/authRoutes");
const userRoutes         = require("./routes/userRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes      = require("./routes/messageRoutes");
const groupRoutes        = require("./routes/groupRoutes");
const uploadRoutes       = require("./routes/uploadRoutes");
const callRoutes         = require("./routes/callRoutes");

const socketHandler = require("./sockets");

const app = express();

/**
 * HTTPS automatique si on trouve `certs/cert.pem` + `certs/key.pem`.
 * Indispensable pour que les téléphones Android puissent acceder au micro
 * et à la camera en WebRTC (contexte sécurisé exigé).
 *
 * Pour (re)générer les certs :
 *     cd backend && npm run gen-cert
 */
const CERT_DIR = path.join(__dirname, "certs");
const certPath = path.join(CERT_DIR, "cert.pem");
const keyPath  = path.join(CERT_DIR, "key.pem");
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

const server = useHttps
  ? https.createServer({
      cert: fs.readFileSync(certPath),
      key:  fs.readFileSync(keyPath),
    }, app)
  : http.createServer(app);

/**
 * Stratégie CORS :
 *   - en développement on autorise *toute* origine (pratique pour accéder
 *     depuis un autre PC du LAN via http://<ip>:5173 sans config manuelle) ;
 *   - en production on restreint à CLIENT_URL (liste séparée par virgules).
 *
 * Support ngrok : on accepte aussi dynamiquement les sous-domaines ngrok-free.app
 * et ngrok.io pour permettre l'accès distant sans configuration supplémentaire.
 */
const allowed = (process.env.CLIENT_URL || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const isNgrokDomain = (origin) => {
  if (!origin) return false;
  return origin.includes(".ngrok-free.app") || origin.includes(".ngrok.io");
};

const corsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true);
  // En dev, on autorise tout (LAN + ngrok)
  if (process.env.NODE_ENV !== "production") return cb(null, true);
  // En prod, on accepte les domaines ngrok dynamiquement
  if (isNgrokDomain(origin)) return cb(null, true);
  if (allowed.includes(origin)) return cb(null, true);
  cb(new Error(`Origine non autorisée : ${origin}`));
};

// ---------- Socket.IO ----------
const io = new SocketServer(server, {
  cors: { origin: corsOrigin, credentials: true },
  maxHttpBufferSize: 1e8, // 100 Mo (pour les petits fichiers)
});
socketHandler(io);
app.set("io", io);

// ---------- Middlewares globaux ----------
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(morgan("dev"));

// Fichiers statiques (uploads)
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Accept-Ranges", "bytes");
    next();
  },
  express.static(path.join(__dirname, process.env.UPLOAD_DIR || "uploads")),
);

// ---------- Routes ----------
app.get("/", (_req, res) =>
  res.json({
    app: "🇸🇳 Senegram API",
    version: "1.0.0",
    status: "ok",
    docs: "/api",
  }),
);

app.use("/api/auth",          authRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages",      messageRoutes);
app.use("/api/groups",        groupRoutes);
app.use("/api/upload",        uploadRoutes);
app.use("/api/calls",         callRoutes);

// ---------- 404 + handler global ----------
app.use((req, res) =>
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.originalUrl}` }),
);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("Erreur serveur :", err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Erreur interne",
    code:    err.code    || "SERVER_ERROR",
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  const proto = useHttps ? "https" : "http";
  console.log(`Senegram API lancée sur ${proto}://localhost:${PORT}`);
  if (useHttps) {
    console.log("   HTTPS actif (certificat auto-signé). Accepte l'alerte du");
    console.log("      navigateur la 1re fois en visitant directement l'URL du backend.");
  } else {
    console.log("   HTTP seulement. Pour activer HTTPS (appels depuis mobile) :");
    console.log("      npm run gen-cert");
  }
});
