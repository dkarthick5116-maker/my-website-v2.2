const CACHE_NAME = "eduportal-v2-cache-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

// Install Event - cache core app assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - clean up older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - network-first with cache fallback
self.addEventListener("fetch", (event) => {
  // Do not cache API calls or Firebase queries
  if (event.request.method !== "GET" || event.request.url.includes("firestore.googleapis.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
// Push Event Handler
self.addEventListener("push", (event) => {
  let data = {
    title: "School Portal Alert",
    body: "You have a new update in your portal!",
    icon: "https://cdn-icons-png.flaticon.com/512/2997/2997295.png"
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "https://cdn-icons-png.flaticon.com/512/2997/2997295.png",
    badge: "https://cdn-icons-png.flaticon.com/512/2997/2997295.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "./index.html"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click Notification -> Open Portal
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data.url || "./index.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("index.html") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

