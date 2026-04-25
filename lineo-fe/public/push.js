// ─── Lineo Push Notification Registration ───────────────────────────────────
// Vanilla JS — no framework dependencies.
// Usage: import and call `initPushNotifications(jwtToken)` after user login.

/**
 * Converts a URL-safe base64 VAPID key to a Uint8Array for
 * pushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String) {
  var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Fetches the VAPID public key from the backend.
 * @param {string} apiBase – e.g. "https://api.lineo.ai" or "" for same-origin
 * @returns {Promise<string>}
 */
async function fetchVAPIDKey(apiBase) {
  var resp = await fetch(apiBase + "/api/v1/push/vapid-key");
  if (!resp.ok) throw new Error("Failed to fetch VAPID key: " + resp.status);
  var json = await resp.json();
  return json.data.vapid_public_key;
}

/**
 * Registers the service worker, subscribes to push, and POSTs the
 * subscription to the backend.
 *
 * @param {string} jwtToken – Bearer token from login
 * @param {string} [apiBase=""] – API base URL (empty for same-origin)
 * @returns {Promise<PushSubscription|null>}
 */
async function initPushNotifications(jwtToken, apiBase) {
  if (typeof apiBase === "undefined") apiBase = "";

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Lineo Push] Browser does not support push notifications");
    return null;
  }

  try {
    // 1. Register the service worker
    var registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("[Lineo Push] Service worker registered", registration.scope);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    // 2. Request notification permission
    var permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Lineo Push] Notification permission denied");
      return null;
    }

    // 3. Get VAPID key from backend
    var vapidPublicKey = await fetchVAPIDKey(apiBase);

    // 4. Subscribe to push
    var subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    console.log("[Lineo Push] Subscribed:", subscription.endpoint);

    // 5. Send subscription to backend
    var resp = await fetch(apiBase + "/api/v1/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + jwtToken,
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!resp.ok) {
      console.error("[Lineo Push] Failed to save subscription:", resp.status);
      return null;
    }

    console.log("[Lineo Push] Subscription saved to server");
    return subscription;
  } catch (err) {
    console.error("[Lineo Push] Registration failed:", err);
    return null;
  }
}

// Export for module usage (Next.js / Vite / ESM)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { initPushNotifications, urlBase64ToUint8Array };
}
