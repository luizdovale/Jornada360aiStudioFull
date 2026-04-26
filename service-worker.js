// service-worker.js
const CACHE_NAME = 'jornada360-v1';
// Lista de arquivos para o cache inicial do "app shell".
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Evento de instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    self.skipWaiting(); // Força o SW a se tornar ativo imediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Adicionando App Shell ao cache:', APP_SHELL_URLS);
            return cache.addAll(APP_SHELL_URLS);
        })
    );
});

// Evento de ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    // Remove caches antigos para manter tudo limpo
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Evento de fetch (intercepta as requisições de rede)
self.addEventListener('fetch', (event) => {
    // Ignora requisições que não são GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Nova Estratégia: Network First, falling back to cache
    // Isso garante que se houver internet, ele sempre pegue o site novo da Vercel
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Se a rede funcionar, atualiza o cache e retorna a resposta
                if (networkResponse.status === 200) {
                    // Evita cache de chamadas para a API do Supabase
                    if (!event.request.url.includes('supabase.co')) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                }
                return networkResponse;
            })
            .catch(() => {
                // Se a rede falhar, tenta buscar no cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Se não tiver no cache e for navegação, manda para o index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});