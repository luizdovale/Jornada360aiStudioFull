
// service-worker.js
const CACHE_NAME = 'jornada360-v1';
// Lista de arquivos para o cache inicial do "app shell".
const APP_SHELL_URLS = [
    '/',
    '/index.html'
];

// Evento de instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
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

    // Estratégia: Cache first, falling back to network
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Se encontrar no cache, retorna a resposta do cache
                // console.log('[Service Worker] Servindo do cache:', event.request.url);
                return cachedResponse;
            }

            // Se não encontrar no cache, busca na rede
            return fetch(event.request).then((networkResponse) => {
                // console.log('[Service Worker] Buscando na rede:', event.request.url);

                // Evita cache de chamadas para a API do Supabase para não servir dados antigos
                if (event.request.url.includes('supabase.co')) {
                    return networkResponse;
                }

                // Clona a resposta para poder colocar no cache e retornar ao navegador
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Se a rede falhar, para requisições de navegação, retorna a página principal do cache
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }
                // Para outras requisições, a falha de rede será propagada
            });
        })
    );
});
