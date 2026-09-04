// public/sw.js

// 每次发布一个需要用户更新的版本时，都应递增此版本号。
// 例如：v4 → v5。否则已缓存的静态资源可能继续沿用旧版本。
const CACHE_NAME = 'when-i-with-u-v8';

// 由 Service Worker 的注册 scope 自动确定实际部署路径。
// 本地示例：       http://localhost:5173/
// GitHub Pages 示例：https://用户名.github.io/WHEN-I-with-U/
const APP_SCOPE = self.registration.scope;
const APP_INDEX_URL = new URL('index.html', APP_SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        try {
          // 不使用 cache.addAll，避免任一资源失败导致 SW 整体安装失败。
          const response = await fetch(APP_INDEX_URL, {
            cache: 'reload',
          });

          if (response.ok) {
            await cache.put(APP_INDEX_URL, response.clone());
          } else {
            console.warn(
              '[SW] index.html 预缓存失败，状态码：',
              response.status,
              APP_INDEX_URL,
            );
          }
        } catch (error) {
          // 首次离线打开时可能无法预缓存；不应因此导致 SW 安装失败。
          console.warn('[SW] index.html 预缓存失败：', error);
        }
      }),
  );

  /*
   * 不要在这里调用 self.skipWaiting()。
   *
   * 新 SW 安装完成后应停留在 waiting 状态，
   * 由页面发现更新、展示更新弹窗，并在用户确认后
   * 通过 SKIP_WAITING 消息主动激活。
   */
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
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // 不接管跨域请求，例如 AI API、第三方图片、CDN 等。
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // 页面导航请求：网络优先；离线时返回已缓存的 SPA 入口页。
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();

            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => {
                return cache.put(APP_INDEX_URL, responseCopy);
              }),
            );
          }

          return response;
        })
        .catch(async () => {
          const cachedIndex = await caches.match(APP_INDEX_URL);

          if (cachedIndex) {
            return cachedIndex;
          }

          return new Response(
            '当前处于离线状态，且应用入口尚未缓存。',
            {
              status: 503,
              statusText: 'Offline',
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
              },
            },
          );
        }),
    );

    return;
  }

  // 静态资源：缓存优先；缓存未命中后请求网络并写入当前版本缓存。
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const canCache =
            networkResponse &&
            networkResponse.ok &&
            networkResponse.type === 'basic';

          if (canCache) {
            const responseCopy = networkResponse.clone();

            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => {
                return cache.put(event.request, responseCopy);
              }),
            );
          }

          return networkResponse;
        })
        .catch(() => Response.error());
    }),
  );
});

// 页面确认更新后，向 waiting 状态的 SW 发送此消息。
// 收到后，新 SW 会跳过 waiting 并进入 activate。
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 后台离线同步事件。
self.addEventListener('sync', (event) => {
  if (event.tag !== 'sync-offline-messages') {
    return;
  }

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_OFFLINE_MESSAGES',
          });
        });
      }),
  );
});

// 点击系统通知时，尝试聚焦已打开的窗口，否则新开一个 App 入口。
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }

        return self.clients.openWindow(APP_INDEX_URL);
      }),
  );
});