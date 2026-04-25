/**
 * Lineo Push Notification Module
 *
 * Handles service-worker registration, VAPID subscription, and backend sync.
 * Call `initPushNotifications()` once after login or on dashboard mount.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

/** Convert URL-safe base64 VAPID key → Uint8Array for pushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Fetch the VAPID public key from the backend */
async function fetchVAPIDKey(): Promise<string> {
  const resp = await fetch(`${API_BASE}/push/vapid-key`);
  if (!resp.ok) throw new Error(`Failed to fetch VAPID key: ${resp.status}`);
  const json = await resp.json();
  return json.data.vapid_public_key;
}

/**
 * Resolves the correct JWT token based on the current path.
 * Mirrors the logic in `lib/api.ts`.
 */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return sessionStorage.getItem("admin_token");
  if (path.startsWith("/staff") || path.startsWith("/org")) return sessionStorage.getItem("staff_token");
  return sessionStorage.getItem("token");
}

/**
 * Main entry point — register SW, subscribe to push, POST to backend.
 *
 * Safe to call multiple times; it's idempotent (the backend upserts by endpoint).
 * Returns the PushSubscription on success, or null if unsupported/denied.
 */
export async function initPushNotifications(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Lineo Push] Browser does not support push notifications");
    return null;
  }

  const token = getToken();
  if (!token) {
    console.warn("[Lineo Push] No JWT token found, skipping push registration");
    return null;
  }

  try {
    // 1. Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[Lineo Push] Service worker registered", registration.scope);

    // Wait until the SW is active
    await navigator.serviceWorker.ready;

    // 2. Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      console.log("[Lineo Push] Already subscribed, syncing with backend");
      await syncSubscription(existing, token);
      return existing;
    }

    // 3. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Lineo Push] Notification permission denied");
      return null;
    }

    // 4. Get VAPID key
    const vapidPublicKey = await fetchVAPIDKey();

    // 5. Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
    console.log("[Lineo Push] Subscribed:", subscription.endpoint);

    // 6. Send to backend
    await syncSubscription(subscription, token);

    return subscription;
  } catch (err) {
    console.error("[Lineo Push] Registration failed:", err);
    return null;
  }
}

/** POST the push subscription to the backend */
async function syncSubscription(subscription: PushSubscription, jwt: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!resp.ok) {
    console.error("[Lineo Push] Failed to save subscription:", resp.status);
  } else {
    console.log("[Lineo Push] Subscription synced with server");
  }
}
