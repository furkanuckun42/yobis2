const CACHE_NAME = 'yobi-cache-v2.3'
const urlsToCache = [
  '/',
  '/favicon.ico'
]

self.addEventListener('install', event => {
  // Eski cache'leri hemen temizlemek için claim/skipWaiting
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache)
      })
  )
})

self.addEventListener('activate', event => {
  // Eski cache versiyonlarını temizle
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Eski cache temizleniyor:', cache)
            return caches.delete(cache)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  // Sadece GET istekleri önbelleklenir
  if (event.request.method !== 'GET') return
  
  // API veya Google Config url'lerini önbelleğe alma
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api')) {
    return // Doğrudan networke gitsin
  }

  // HTML ve Statik dosyalar için Network-First (Ağ Öncelikli) Strateji
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // İstek başarılıysa cache'i güncelle
        if (response && response.status === 200 && response.type === 'basic') {
          const responseCopy = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseCopy)
          })
        }
        return response
      })
      .catch(() => {
        // Ağ yoksa önbellekten döndür
        return caches.match(event.request)
      })
  )
})
