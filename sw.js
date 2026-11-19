/* Dividend Tracker service worker.
   The app's own files and the libraries load from cache when offline;
   Firebase, Finnhub, Massive and analytics traffic is never touched, so it
   always goes to the network (and Firestore's own offline cache handles data). */
const VERSION = "dt-v1";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Hosts whose libraries we may cache. Everything else is left to the network.
const LIB_HOSTS = ["www.gstatic.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                       // never touch writes to Firebase
  let url; try { url = new URL(req.url); } catch { return; }
  const sameOrigin = url.origin === self.location.origin;

  // Page navigations: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { cache(req, r); return r; }).catch(() => caches.match("./index.html").then(m => m || caches.match("./"))));
    return;
  }
  // The app's own static files and the allowed libraries: serve cached, refresh in the background.
  if (sameOrigin || LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { cache(req, r); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
  // Anything else (Firebase, Finnhub, Massive, analytics): untouched, straight to network.
});

function cache(req, res) {
  if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
  }
}

// Focus or open the app when a reminder notification is clicked.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow ? self.clients.openWindow("./index.html") : null;
  }));
});
