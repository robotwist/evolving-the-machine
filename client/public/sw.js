const CACHE_NAME = (self && self.location && new URL(self.location).searchParams.get('cv')) ? 'arcade-cache-' + new URL(self.location).searchParams.get('cv') : 'arcade-cache-v5';

// Critical assets for offline gameplay
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/generated-icon.png'
];

// Game assets that should be cached for offline play
const GAME_ASSETS = [
  '/textures/asphalt.png',
  '/textures/grass.png',
  '/textures/sand.jpg',
  '/textures/sky.png',
  '/textures/wood.jpg',
  '/sounds/background.mp3',
  '/sounds/hit.mp3',
  '/sounds/success.mp3',
  '/sounds/ui-click.mp3',
  '/geometries/heart.gltf'
];

// Runtime caching patterns
const CACHE_STRATEGIES = {
  images: 'cache-first',
  audio: 'cache-first',
  scripts: 'network-first',
  styles: 'network-first',
  fonts: 'cache-first',
  documents: 'network-first'
};

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(CRITICAL_ASSETS)),
      caches.open(CACHE_NAME).then((cache) => cache.addAll(GAME_ASSETS))
    ]).then(() => {
      console.log('Service Worker: All assets cached');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      console.log('Service Worker: Cleaning up old caches');
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients');
      return self.clients.claim();
    })
  );
});
// Allow the page to ask for immediate activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper function to determine caching strategy
function getCacheStrategy(request) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) return 'network-first';
  if (request.destination === 'script') return 'network-first';
  if (request.destination === 'style') return 'network-first';
  if (request.destination === 'image') return 'cache-first';
  if (request.destination === 'audio') return 'cache-first';
  if (request.destination === 'font') return 'cache-first';
  if (request.mode === 'navigate') return 'network-first';

  return 'cache-first';
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Offline and no cached version available');
  }
}

// Cache-first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    throw new Error('Offline and no cached version available');
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const strategy = getCacheStrategy(request);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    (strategy === 'network-first' ? networkFirst(request) : cacheFirst(request))
      .catch((error) => {
        console.warn('Service Worker: Failed to serve request', request.url, error);

        // For navigation requests, return offline page
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }

        // For other requests, let them fail
        throw error;
      })
  );
});


