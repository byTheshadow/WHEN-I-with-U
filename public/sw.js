// public/sw.js

// 每次发布一个需要用户更新的版本时，递增此版本号以激活新 SW
const CACHE_NAME = 'when-i-with-u-v12';

// 由 Service Worker 的注册 scope 自动确定实际部署路径
const APP_SCOPE = self.registration.scope;
const APP_INDEX_URL = new URL('index.html', APP_SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        try {
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
          console.warn('[SW] index.html 预缓存失败：', error);
        }
      }),
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

  // 不接管跨域请求，例如 AI API、第三方图片、CDN 等
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // 页面导航请求：网络优先；离线时返回已缓存的 SPA 入口页
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

  // 静态资源：缓存优先；缓存未命中后请求网络并写入当前版本缓存
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

// 页面确认更新后，向 waiting 状态的 SW 发送此消息
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 后台离线同步事件
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

// ==========================================================
// 🛠️ 原生 IndexedDB 直写（严格对齐 WhenIWithUDatabase v39）
// ==========================================================
function savePushMessageToIndexedDB(payload) {
  return new Promise((resolve) => {
    const DB_NAME = 'WhenIWithUDatabase';
    // 明确对齐 Dexie 版本 39
    const request = indexedDB.open(DB_NAME, 39);

    request.onerror = (e) => {
      console.warn('[SW-IDB] 打开数据库失败:', e);
      resolve(false);
    };

    request.onblocked = () => {
      console.warn('[SW-IDB] 数据库打开被阻塞 (blocked)');
      resolve(false);
    };

    request.onsuccess = (event) => {
      const idb = event.target.result;
      try {
        if (!idb.objectStoreNames.contains('messages')) {
          idb.close();
          return resolve(false);
        }

        const storeNames = ['messages'];
        if (idb.objectStoreNames.contains('chats')) {
          storeNames.push('chats');
        }

        const tx = idb.transaction(storeNames, 'readwrite');
        const messageStore = tx.objectStore('messages');

        const entity = payload.messageEntity || {};
        const contentText = entity.content || payload.body || '';

        // 1. 严格统一为 ISO 8601 字符串格式
        const rawTimestamp = entity.timestamp || payload.timestamp || Date.now();
        const nowIso =
          typeof rawTimestamp === 'string' && rawTimestamp.includes('T')
            ? rawTimestamp
            : new Date(rawTimestamp).toISOString();

        const targetChatId = Number(entity.chatId || payload.chatId || 1);
        const targetCharId = Number(entity.characterId || payload.characterId || 1);

        // 2. 彻底剥离可能携带的外部 id，确保 messages 表 ++id 自增
        const { id, ...cleanEntity } = entity;

        // 3. 严格对齐真实前端数据结构
        const newMessage = {
          chatId: targetChatId,
          characterId: targetCharId,
          sender: 'character', // ⚠️ 绝不能是 assistant，必须是 character
          type: cleanEntity.type || payload.msgType || 'text',
          content: contentText,
          metadata: {
            isOfflinePush: true,
            pushType: payload.type || 'message',
            source: 'sw-push-direct',
            ...(cleanEntity.metadata || {}),
          },
          quotedMessageId: cleanEntity.quotedMessageId ?? null,
          isRead: false,       // ⚠️ 布尔值 false
          timestamp: nowIso,   // ⚠️ ISO 字符串
          // ⚠️ versions 内部必须是 type, content, timestamp
          versions: cleanEntity.versions || [
            {
              type: 'text',
              content: contentText,
              timestamp: nowIso,
              metadata: {
                isOfflinePush: true,
                model: 'cloud-push-ai',
              },
            },
          ],
          currentVersionIndex: cleanEntity.currentVersionIndex ?? 0,
        };

        const addReq = messageStore.add(newMessage);

        addReq.onerror = (err) => {
          console.warn('[SW-IDB] 消息写入失败:', err);
        };

        // 4. 联动更新对应 chats 表的最后修改时间与摘要预览
        if (idb.objectStoreNames.contains('chats')) {
          const chatStore = tx.objectStore('chats');
          const chatReq = chatStore.get(targetChatId);
          chatReq.onsuccess = (e) => {
            const chatData = e.target.result;
            if (chatData) {
              chatData.updatedAt = nowIso;
              chatData.summary = (contentText || '').slice(0, 30);
              chatStore.put(chatData);
            }
          };
        }

        tx.oncomplete = () => {
          idb.close();
          resolve(true);
        };
        tx.onerror = () => {
          idb.close();
          resolve(false);
        };
      } catch (err) {
        console.warn('[SW-IDB] 事务执行发生异常:', err);
        idb.close();
        resolve(false);
      }
    };
  });
}

// ==========================================================
// 监听苹果 APNs / Web Push 远程主动唤醒推送
// ==========================================================
self.addEventListener('push', (event) => {
  let payload = {
    title: 'WHEN I with U',
    body: '伴侣给你发了一条新消息...',
    type: 'message',
    characterName: '',
    url: APP_INDEX_URL,
    chatId: 1,
    characterId: 1,
    timestamp: new Date().toISOString(),
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const targetChatId = Number(
    payload.messageEntity?.chatId || payload.chatId || 1
  );

  // 1. 如果是聊天消息或携带 messageEntity，立即在后台写入本地数据库，并向所有窗口广播
  const shouldSave =
    (payload.type === 'message' && Boolean(payload.body)) || Boolean(payload.messageEntity);

  const saveTask = shouldSave
    ? savePushMessageToIndexedDB(payload).then(() => {
        return self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SYNC_OFFLINE_MESSAGES',
                action: 'new_message',
                chatId: targetChatId,
              });
            });
          });
      })
    : Promise.resolve();

  // 2. 根据伴侣名称与推送类型动态决定通知标题
  let displayTitle = payload.characterName || payload.title;
  if (payload.type === 'diary') {
    displayTitle = `${payload.characterName || '伴侣'} · 写了新日记`;
  } else if (payload.type === 'snapshot') {
    displayTitle = `${payload.characterName || '伴侣'} · 发布了新动态`;
  }

  const options = {
    body: payload.body || payload.messageEntity?.content || '',
    icon: 'https://s1.eisite.cn/autoupload/amqnh/20260821/dHbf/1280X1280/00-d55fd7352057ecab338faca8.png/webp',
    badge: 'https://s1.eisite.cn/autoupload/amqnh/20260821/dHbf/1280X1280/00-d55fd7352057ecab338faca8.png/webp',
    tag: `companion_${targetChatId}_${Date.now()}`,
    renotify: true,
    data: {
      url: payload.url || APP_INDEX_URL,
      chatId: targetChatId,
    },
  };

  // 等待数据落库与通知展示全部完成后再结束 push 事件生命周期
  event.waitUntil(
    Promise.all([
      saveTask,
      self.registration.showNotification(displayTitle, options),
    ]),
  );
});

// 点击系统通知时，尝试聚焦已打开的窗口并导航至对应 chat，否则新开 App 入口。
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || APP_INDEX_URL;
  const targetChatId = event.notification.data?.chatId;

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (let client of clientList) {
          if (client.url.includes(APP_SCOPE) && 'focus' in client) {
            if (targetChatId) {
              client.postMessage({
                type: 'NAVIGATE_TO_CHAT',
                chatId: targetChatId,
              });
            }
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          const openUrl = targetChatId ? `${targetUrl}?chatId=${targetChatId}` : targetUrl;
          return self.clients.openWindow(openUrl);
        }
      }),
  );
});
