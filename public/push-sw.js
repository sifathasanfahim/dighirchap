/* Dighir Chap — dedicated push service worker.
   Handles ONLY `push` and `notificationclick`. Does NOT cache app shell,
   so it is safe alongside the app's normal delivery. Guarded on the client
   side against Lovable preview/dev origins. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Dighir Chap", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Dighir Chap";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.png",
    badge: payload.badge || "/favicon.png",
    image: payload.image || undefined,
    tag: payload.tag || "dighir-chap",
    renotify: true,
    requireInteraction: !!payload.requireInteraction,
    vibrate: payload.vibrate || [120, 60, 120],
    data: { url: payload.url || "/", ...(payload.data || {}) },
    actions: payload.actions || [
      { action: "open", title: "View" },
      { action: "close", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        try {
          const u = new URL(client.url);
          if (u.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) await client.navigate(targetUrl);
            return;
          }
        } catch {}
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })(),
  );
});
