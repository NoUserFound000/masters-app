// App-shell cache so the installed app opens with no network. Content lives in IndexedDB, not here.
const V = "masters-a54d88180c", FILES = ["./", "index.html", "app.js", "boot.js", "sync.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"], FONTS = "masters-fonts";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async (c) => { const hit = await c.match(r); const net = fetch(r).then((res) => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; }).catch(() => hit); return hit || net; }));
    return;
  }
  if (u.origin !== location.origin) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).then((res) => { caches.open(V).then((c) => c.put("index.html", res.clone())); return res; }).catch(() => caches.match("index.html"))); return; }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
});
