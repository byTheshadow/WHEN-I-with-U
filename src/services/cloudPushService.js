// src/services/cloudPushService.js
import db from '../db';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 🛠️ 开屏/切回前台对齐兜底（即使忽略了通知，直接从桌面点开 App 也能 100% 补齐消息）
 */
export async function syncPendingPushMessages() {
  try {
    const cloudPushSetting = await db.settings.get('cloudPushConfig');
    const serverUrl =
      cloudPushSetting?.value?.serverUrl ||
      localStorage.getItem('push_server_url') ||
      '';

    const cleanServerUrl = (serverUrl || '').trim().replace(/\/$/, '');
    if (!cleanServerUrl) return;

    const res = await fetch(`${cleanServerUrl}/api/fetch-pending-messages`);
    if (!res.ok) return;

    const data = await res.json();
    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      return;
    }

    const syncedIds = [];
    const affectedChatIds = new Set();

    for (const msg of data.messages) {
      const targetChatId = Number(msg.chatId || 1);
      const rawTimestamp = msg.timestamp || Date.now();
      const numTimestamp = typeof rawTimestamp === 'number' ? rawTimestamp : new Date(rawTimestamp).getTime();

      // 基于 [chatId+timestamp] 复合索引或内容查重
      let exists = false;
      try {
        exists = await db.messages
          .where('[chatId+timestamp]')
          .equals([targetChatId, numTimestamp])
          .first();
      } catch (err) {
        exists = await db.messages
          .where('chatId')
          .equals(targetChatId)
          .and((m) => m.timestamp === numTimestamp || (m.content === msg.content && Math.abs((m.timestamp || 0) - numTimestamp) < 2000))
          .first();
      }

      if (!exists) {
        // 去除可能的字符串 id，确保 Dexie 采用主键自增（++id）
        const { id, ...recordToSave } = msg;
        const nowIso = new Date(numTimestamp).toISOString();

        const messageRecord = {
          chatId: targetChatId,
          characterId: Number(recordToSave.characterId || 1),
          sender: recordToSave.sender || 'character',
          type: recordToSave.type || 'text',
          content: recordToSave.content || '',
          metadata: {
            isOfflinePush: true,
            source: 'cloud-pending-sync',
            ...(recordToSave.metadata || {}),
          },
          quotedMessageId: recordToSave.quotedMessageId ?? null,
          isRead: recordToSave.isRead ?? 0,
          timestamp: numTimestamp,
          versions: recordToSave.versions || [
            {
              text: recordToSave.content || '',
              timestamp: numTimestamp,
              model: 'cloud-push-ai',
            },
          ],
          currentVersionIndex: recordToSave.currentVersionIndex ?? 0,
        };

        const newMsgId = await db.messages.add(messageRecord);

        // 同步更新对应 chats 表的最后更新时间和摘要预览
        await db.chats.where('id').equals(targetChatId).modify({
          updatedAt: nowIso,
          summary: (messageRecord.content || '').slice(0, 30),
        });

        affectedChatIds.add(targetChatId);

        // 派发本地消息写入事件，使前端当前处于该会话的界面立刻响应渲染
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('new-local-message-inserted', {
              detail: {
                chatId: targetChatId,
                messageId: newMsgId,
              },
            })
          );
        }
      }

      if (msg.id) {
        syncedIds.push(msg.id);
      }
    }

    // 告知云端这些消息已经安全落地本地，可以从待取池清理
    if (syncedIds.length > 0) {
      await fetch(`${cleanServerUrl}/api/ack-pending-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: syncedIds }),
      }).catch(() => {});
    }
  } catch (e) {
    // 纯离线或网络波动时静默跳过，保证体验平滑
  }
}

/**
 * 注册并向云端同步推送配置（支持多 Chat、多角色）
 */
export async function registerCloudPush({
  serverUrl,
  vapidPublicKey,
  currentChatId = null,
  currentCharacterId = null,
} = {}) {
  const cleanServerUrl = (serverUrl || '').trim().replace(/\/$/, '');
  const cleanVapidKey = (vapidPublicKey || '').trim();

  if (!cleanServerUrl || !cleanVapidKey) {
    throw new Error('请完整填写服务器地址与 VAPID 公钥');
  }

  // 1. 跨平台 PWA 环境检测（iOS 要求 standalone，安卓/PC 则只要支持 ServiceWorker 即可）
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone =
    window.navigator.standalone ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    throw new Error('iOS 设备必须通过 Safari【添加到主屏幕】并在桌面上打开本应用！');
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('当前浏览器不支持 Web Push 推送功能');
  }

  // 2. 检查并申请通知权限
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('系统通知权限被拒绝，无法开启主动推送');
  }

  // 3. 向 APNs (iOS) 或 FCM (安卓) 申请设备凭证
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cleanVapidKey),
      });
    } catch (subErr) {
      throw new Error(`申请系统推送凭证失败: ${subErr.message}`);
    }
  }

  // 4. 读取当前本地伴侣数据、全量聊天框列表与当前活跃会话
  const apiSettings = await db.settings.get('apiConfig');
  const allCharacters = await db.characters.toArray();
  const allChats = await db.chats.toArray();

  // 确定当前使用的角色
  let activeChar = null;
  if (currentCharacterId) {
    activeChar = allCharacters.find((c) => c.id === currentCharacterId);
  }
  if (!activeChar) {
    activeChar = allCharacters[0] || {};
  }

  // 确定当前激活的目标会话
  let activeChat = null;
  if (currentChatId) {
    activeChat = allChats.find((c) => c.id === currentChatId);
  }
  if (!activeChat && activeChar.id) {
    activeChat = allChats.find((c) => c.characterId === activeChar.id);
  }
  if (!activeChat) {
    activeChat = allChats[0] || {};
  }

  const targetChatId = Number(activeChat.id || currentChatId || 1);
  const targetCharId = Number(activeChar.id || currentCharacterId || 1);

  // 提取对应聊天框最近的上下文片段（优先使用该 targetChatId 的历史记录）
  const recentMsgs = await db.messages
    .where('chatId')
    .equals(targetChatId)
    .reverse()
    .limit(5)
    .toArray();

  const recentContext = recentMsgs
    .reverse()
    .map((m) => {
      if (m.versions && m.versions.length > 0) {
        const idx = m.currentVersionIndex || 0;
        return m.versions[idx]?.text || m.content || '';
      }
      return m.content || '';
    })
    .filter(Boolean)
    .join('；');

  // 构建支持多角色、多聊天框的同步数据包
  const payloadData = {
    subscription: subscription.toJSON(),
    apiConfig: apiSettings?.value || {},
    character: {
      id: targetCharId,
      chatId: targetChatId,
      name: activeChar.name || 'AI伴侣',
      persona:
        activeChar.userPersona ||
        activeChar.bio ||
        activeChar.persona ||
        activeChar.extraNotes ||
        '',
      userName: activeChat.userName || activeChar.userName || '你',
    },
    targetChatId: targetChatId,
    // 传给服务端所有用户可发信/激活的聊天框列表
    allowedChatIds: allChats.map((c) => c.id),
    activeChats: allChats.map((c) => ({
      id: c.id,
      characterId: c.characterId,
      userName: c.userName || '',
      summary: c.summary || '',
    })),
    recentContext: recentContext,
  };

  // 5. 真正向宝塔推送服务器发送配置
  let response;
  try {
    response = await fetch(`${cleanServerUrl}/api/sync-push-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payloadData),
    });
  } catch (networkErr) {
    throw new Error(`连接服务器网络失败: ${networkErr.message}（请检查域名证书或反向代理）`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`服务器拒绝接收 (状态码 ${response.status}): ${errorText}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`服务器保存失败: ${result.error || '未知错误'}`);
  }

  // 成功后在本地保存已验证有效的推送服务器地址
  try {
    localStorage.setItem('push_server_url', cleanServerUrl);
  } catch (e) {
    // 忽略静默异常
  }

  // 注册成功后，顺手执行一次拉齐补漏
  syncPendingPushMessages();

  return true;
}

