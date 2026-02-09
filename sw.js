const CACHE_NAME = 'mc-electronics-v2';
const STATIC_ASSETS = [
  './index.html',
  './about.html',
  './service.html',
  './why.html',
  './team.html',
  './catalogue.html',
  './pay-us.html',
  './auth/login.html',
  './repairing.html',
  './recharge.html',
  './why_us.html',
  './css/bootstrap.css',
  './css/style.css',
  './css/responsive.css',
  './css/font-awesome.min.css',
  './js/jquery-3.4.1.min.js',
  './js/bootstrap.js',
  './js/custom.js',
  './js/animations.js',
  './js/navbar-auth.js',
  './images/logo-mc-electronics.png',
  './images/hero-bg.png',
  './images/favcon.jpeg'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  // For HTML requests, try the network first, fall back to cache
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request).then(response => {
          // Fallback to home page if not found and network fails
          return response || caches.match('./index.html');
        }))
    );
  } else {
    // For other requests (CSS, JS, Images), try cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request).then(response => {
            return response;
          }).catch(error => {
            // Log the error but don't throw - prevents console errors
            console.log('Fetch failed for:', event.request.url, error);
            // Return a basic response to prevent errors
            return new Response('', { status: 404, statusText: 'Not Found' });
          });
        })
    );
  }
});
