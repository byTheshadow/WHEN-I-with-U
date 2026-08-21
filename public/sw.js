// public/sw.js

const CACHE_NAME = 'when-i-with-u-v2';

/**
 * 例如：
 * 本地：      http://localhost:5173/
 * GitHub Pages: https://bytheshadow.github.io/WHEN-I-with-U/
 */
const APP_SCOPE = self.registration.scope;

const APP_SHELL_URLS = [
  new URL('./', APP_SCOPE).href,
  new URL('index.html', APP_SCOPE).href,
  new URL('manifest.json', APP_SCOPE).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('when-i-with-u-') &&
                key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // 只处理当前站点资源，避免干预第三方 API、AI 请求及跨域资源。
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // 页面导航：优先网络，网络不可用时回退到已缓存的应用入口。
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(new URL('index.html', APP_SCOPE).href)
      )
    );
    return;
  }

  // 静态资源：缓存优先；未命中时走网络，并缓存成功的同源响应。
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const isCacheable =
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic';

          if (isCacheable) {
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch(() => Response.error());
    })
  );
});

// 后台离线同步事件
self.addEventListener('sync', (event) => {
  if (event.tag !== 'sync-offline-messages') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'SYNC_OFFLINE_MESSAGES' });
      });
    })
  );
});
