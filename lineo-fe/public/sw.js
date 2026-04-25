// ─── Lineo PWA Service Worker ───────────────────────────────────────────────
// Handles web push notifications, in-app sync, and offline basics.

// ─── Push Event ─────────────────────────────────────────────────────────────
self.addEventListener("push", function (event) {
  let data = { title: "Lineo", body: "You have a new notification", url: "/" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) { // eslint-disable-line @typescript-eslint/no-unused-vars
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || "You have a new notification",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    vibrate: [200, 100, 200],
    tag: data.tag || "lineo-" + Date.now(),
    renotify: true,
    data: {
      url: data.url || "/",
    },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  // Show native push notification
  event.waitUntil(
    self.registration.showNotification(data.title || "Lineo", options).then(function () {
      // Forward push data to all open app windows so the in-app
      // NotificationCenter stays in sync.
      return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
        clientList.forEach(function (client) {
          client.postMessage({
            type: "PUSH_RECEIVED",
            title: data.title || "Lineo",
            body: data.body || "You have a new notification",
            url: data.url || "/",
            notifType: data.notifType || "info",
          });
        });
      });
    })
  );
});

// ─── Notification Click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // If a Lineo tab is already open, focus it and navigate.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new tab.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Service Worker Install & Activate ──────────────────────────────────────
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
