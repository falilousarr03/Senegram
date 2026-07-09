import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./useSocket";
import api from "../services/api";

const PushContext = createContext(null);

export function PushProvider({ children }) {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [permission, setPermission] = useState(Notification.permission);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);

  // VAPID public key (generate with: npx web-push generate-vapid-keys)
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  // Convert base64 string to Uint8Array for push subscription
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("[Push] SW registered:", reg.scope);
      }).catch((err) => {
        console.error("[Push] SW registration failed:", err);
      });
    }
  }, []);

  // Update permission state
  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn("[Push] VAPID_PUBLIC_KEY not configured");
      return;
    }
    if (!user || !token) return;
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      console.log("[Push] Permission requested:", perm);
      if (perm !== "granted") return;
    }

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      console.log("[Push] SW ready:", reg.scope);
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        console.log("[Push] Existing subscription found:", existingSub.endpoint);
        setSubscription(existingSub);
        await sendSubscriptionToServer(existingSub);
        return;
      }

      console.log("[Push] Creating new subscription...");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[Push] New subscription created:", sub.endpoint);
      setSubscription(sub);
      await sendSubscriptionToServer(sub);
    } catch (err) {
      console.error("[Push] Subscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user, token, VAPID_PUBLIC_KEY]);

  // Send subscription to backend
  async function sendSubscriptionToServer(sub) {
    try {
      await api.post("/push/subscribe", {
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
          auth: arrayBufferToBase64(sub.getKey("auth")),
        },
      });
    } catch (err) {
      console.error("[Push] Failed to send subscription to server:", err);
    }
  }

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    try {
      await subscription.unsubscribe();
      await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });
      setSubscription(null);
    } catch (err) {
      console.error("[Push] Unsubscribe failed:", err);
    }
  }, [subscription]);

  // Listen for socket events to trigger local notifications (when app is open)
  useEffect(() => {
    if (!socket) return;
    
    const onMessage = (data) => {
      // Only show notification if document is not focused
      if (document.visibilityState === "visible") return;
      
      const { message, conversation_id, from } = data;
      if (message?.sender_id === user?.id) return; // Don't notify for own messages
      
      if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(`${from?.display_name || from?.username}`, {
            body: message?.content || "Nouveau message",
            icon: "/favicon.svg",
            badge: "/favicon.svg",
            tag: `msg-${conversation_id}`,
            data: { url: `/conversation/${conversation_id}`, conversation_id },
            requireInteraction: true,
          });
        });
      }
    };

    socket.on("message:new", onMessage);
    return () => socket.off("message:new", onMessage);
  }, [socket, user?.id]);

  // Handle notification click from service worker
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === "NOTIFICATION_CLICK") {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  function arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  return (
    <PushContext.Provider value={{ permission, subscription, loading, subscribe, unsubscribe }}>
      {children}
    </PushContext.Provider>
  );
}

export function usePush() {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error("usePush must be used within PushProvider");
  return ctx;
}