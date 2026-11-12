/* Service worker : l'app fonctionne hors ligne.
   Pour publier une mise à jour, change simplement le numéro de version ci-dessous. */
const VERSION = 'carnet-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './db.js', './ui.js', './exercises.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* Réseau d'abord (pour recevoir les mises à jour), cache en secours (hors ligne). */
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('./index.html')))
  );
});
