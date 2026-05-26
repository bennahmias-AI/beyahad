// public/sw.js
// ─────────────────────────────────────────────────────────────
// Service Worker בסיסי עבור ה-PWA של "ביחד".
//
// תפקידו: לאפשר התקנת האפליקציה, ולתת חוויה בסיסית גם כשאין
// אינטרנט (cache של מעטפת האפליקציה). לא שומר במטמון קריאות
// LiveKit / Firebase — אלה תמיד צריכים רשת חיה.
// ─────────────────────────────────────────────────────────────

const CACHE_NAME = 'beyahad-v1'
const APP_SHELL = [
  '/',
  '/index.html',
  '/app-icon.svg',
  '/manifest.json',
]

// Install — pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {})
  )
})

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// Fetch — network-first for everything, fall back to cache when offline.
// Never cache Firebase / LiveKit / API calls — those need a live network.
self.addEventListener('fetch', (event) => {
  const url = event.request.url

  // skip non-GET and external realtime services
  if (
    event.request.method !== 'GET' ||
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('livekit') ||
    url.includes('/api/') ||
    url.includes('localhost:8080')
  ) {
    return // let the browser handle it normally
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // cache a copy of successful navigations / static assets
        if (response && response.status === 200) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy).catch(() => {})
          })
        }
        return response
      })
      .catch(() =>
        // offline — serve from cache, or the cached index for navigations
        caches.match(event.request).then(cached =>
          cached || caches.match('/index.html')
        )
      )
  )
})
