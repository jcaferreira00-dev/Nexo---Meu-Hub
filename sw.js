// bump this whenever the offline app-shell list below changes
const CACHE_VERSION = 'nexo-v3';
const CACHE_NAME = `nexo-hub-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('nexo-hub-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // only handle GET requests on our own origin — everything else (Google Fonts,
  // Material Symbols CDN, Firebase, etc.) goes straight to the network
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // HTML/navigation requests: network-first. Sempre tenta buscar a versão
  // mais nova primeiro — só cai pro cache se estiver offline. Isso evita o
  // efeito "preciso recarregar duas vezes pra ver a atualização", que
  // acontecia com o cache-first de antes.
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Outros arquivos (ícones, manifest): cache-first com atualização em
  // segundo plano — raramente mudam, então prioriza velocidade/offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
