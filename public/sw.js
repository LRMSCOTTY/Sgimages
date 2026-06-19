const CACHE = 'providai-v1'
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return
  // Never cache API or SSE calls
  if (request.url.includes('/api/')) return

  e.respondWith(
    caches.match(request).then(cached => {
      const fromNetwork = fetch(request).then(res => {
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      }).catch(() => cached)
      return cached || fromNetwork
    })
  )
})
