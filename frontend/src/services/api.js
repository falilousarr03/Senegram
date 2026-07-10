import axios from "axios";

/**
 * Détermine l'URL du backend (sans /api à la fin).
 */
function resolveApiUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, "").replace(/\/api(?:\/api)*$/, "");
  }
  if (import.meta.env.DEV) return "";
  if (typeof window !== "undefined" && window.location) {
    const proto = window.location.protocol;
    const host  = window.location.hostname;
    const port  = import.meta.env.VITE_API_PORT || "5000";
    return `${proto}//${host}:${port}`;
  }
  return "http://localhost:5000";
}

export const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (config.baseURL) {
    config.baseURL = config.baseURL
      .replace(/\/+$/, "")
      .replace(/\/api\/api$/, "/api");
  }
  if (typeof config.url === "string") {
    config.url = config.url.replace(/^\/api\/api\//, "/").replace(/^\/api\//, "/");
  }
  const token = localStorage.getItem("senegram_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && location.pathname !== "/login") {
      localStorage.removeItem("senegram_token");
      localStorage.removeItem("senegram_user");
      location.href = "/login";
    }
    return Promise.reject(err);
  },
);

/** Transforme un `/uploads/...` relatif en URL absolue. */
export function fileUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default api;
