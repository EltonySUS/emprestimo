const CACHE_NAME = 'sistema-v1';
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js'
];

// Instala o service worker e guarda os arquivos básicos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Responde as requisições
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});