// Minimal service worker — required for PWA install prompt
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', e => {
  // Always go to network for API calls and Next.js internals
  const url = e.request.url
  if (
    url.includes('/api/') ||
    url.includes('/_next/') ||
    url.includes('/__nextjs')
  ) {
    e.respondWith(fetch(e.request))
    return
  }
  // Network-first for everything else
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
