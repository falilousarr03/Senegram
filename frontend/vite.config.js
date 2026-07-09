import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import path from "node:path";

/**
 * Detection automatique du mode HTTPS :
 *   1. Si `backend/certs/cert.pem` existe (genere par `npm run gen-cert`
 *      dans le backend), on active HTTPS ;
 *   2. Sinon on respecte la variable d'env HTTPS=1 (fallback) ;
 *   3. Sinon HTTP.
 *
 * Cette detection par systeme de fichiers est bien plus fiable que
 * la transmission d'une variable d'environnement sur Windows
 * (problematique avec `start cmd /k`).
 *
 * Vite gere son propre certificat auto-signe via @vitejs/plugin-basic-ssl ;
 * le backend, lui, reutilise le certificat de `backend/certs/`.
 */
const certPath = path.resolve(process.cwd(), "..", "backend", "certs", "cert.pem");
const certExists = fs.existsSync(certPath);
const useHttps =
  certExists ||
  process.env.HTTPS === "1" ||
  process.env.HTTPS === "true";
const backendTarget = `${certExists ? "https" : "http"}://127.0.0.1:5000`;
const ignoredProxySocketErrors = new Set([
  "EPIPE",
  "ECONNRESET",
  "ERR_STREAM_WRITE_AFTER_END",
]);

// eslint-disable-next-line no-console
console.log(
  `[vite] Mode ${useHttps ? "HTTPS" : "HTTP"}` +
    (useHttps && certExists ? "  (cert backend detecte)" : ""),
);

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    port: 5173,
    host: true,      // ecoute sur 0.0.0.0, accessible via LAN
    allowedHosts: [
      'localhost',
      '.localhost',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
      '.ngrok.dev',
    ],

    https: useHttps, // plugin-basic-ssl fournit la cle/cert
    strictPort: true,

    // Proxy vers le backend pour eviter les appels directs a un certificat
    // auto-signe depuis le navigateur en developpement.
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: backendTarget,
        ws: true,  // WebSocket support pour Socket.IO
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (ignoredProxySocketErrors.has(err.code)) return;
            // eslint-disable-next-line no-console
            console.error('[vite] socket proxy error:', err);
          });
        },
      },
    },
  },
});
