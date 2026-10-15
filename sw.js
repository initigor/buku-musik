/* Service worker Buku Chart: simpan semua berkas ke cache agar bisa dibuka tanpa internet.
   Naikkan angka versi di bawah setiap kali kamu mengubah index.html. */
const V = 'buku-chart-v4';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './styles.css', './app.js', './vendor/pdf.min.js', './vendor/pdf.worker.min.js'];
const FONT = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin && !FONT.test(r.url)) return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' ? await c.match('./index.html') : undefined);
    const net = fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});
