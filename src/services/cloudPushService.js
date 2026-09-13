// src/services/cloudPushService.js
import Dexie from 'dexie';
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
 * 🛠️ 开屏/切回前台对齐兜底（全聊天框通用）
 * 从 cloudPushConfig.serverUrl 拉取未写入本地的消息，不使用任何硬编码服务器兜底
 */
export async function syncPendingPushMessages() {
  try {
    const cloudPushSetting = await db.settings.get('cloudPushConfig');
    const rawServerUrl = cloudPushSetting?.value?.serverUrl;
    const cleanServerUrl = (rawServerUrl || '').trim().replace(/\/$/, '');

    if (!cleanServerUrl) {
      return; // 用户未配置推送服务器，静默退出
    }

    const res = await fetch(`${cleanServerUrl}/api/fetch-pending-messages`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;

    const data = await res.json();
    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      return;
    }

    const syncedIds = [];

    for (const msg of data.messages) {
      const targetChatId = Number(msg.chatId || 1);
      const rawTimestamp = msg.timestamp || Date.now();
      const numTimestamp = typeof rawTimestamp === 'number' ? rawTimestamp : new Date(rawTimestamp).getTime();

      // 基于 [chatId+timestamp] 索引精准查重
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
          .filter((m) => m.timestamp === numTimestamp)
          .first();
      }

      if (!exists) {
        const { id, ...recordToSave } = msg;
        const nowIso = new Date(numTimestamp).toISOString();

        const messageRecord = {
          ...recordToSave,
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

        // 联动更新具体聊天框的 updatedAt 与预览摘要
        await db.chats.where('id').equals(targetChatId).modify({
          updatedAt: nowIso,
          summary: (messageRecord.content || '').slice(0, 30),
        });

        // 派发本地消息通知，前端当前如果正打开着该聊天框，UI 立即刷新出气泡
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

    // 回执确认，服务端清理已同步消息
    if (syncedIds.length > 0) {
      await fetch(`${cleanServerUrl}/api/ack-pending-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: syncedIds }),
      }).catch(() => {});
    }
  } catch (e) {
    // 纯离线时静默跳过
  }
}

/**
 * 注册并向云端同步推送配置
 * 收集用户存在/聊过的所有消息框，使其全部具备云端独立主动发信的能力
 */
export async function registerCloudPush({
  serverUrl,
  vapidPublicKey,
} = {}) {
  // 1. 优先从参数取，没传则从 db.settings 取，绝不硬编码
  let targetServerUrl = serverUrl;
  let targetVapidKey = vapidPublicKey;

  if (!targetServerUrl || !targetVapidKey) {
    const cloudPushSetting = await db.settings.get('cloudPushConfig');
    targetServerUrl = targetServerUrl || cloudPushSetting?.value?.serverUrl;
    targetVapidKey = targetVapidKey || cloudPushSetting?.value?.vapidPublicKey;
  }

  const cleanServerUrl = (targetServerUrl || '').trim().replace(/\/$/, '');
  const cleanVapidKey = (targetVapidKey || '').trim();

  if (!cleanServerUrl || !cleanVapidKey) {
    throw new Error('请完整配置推送服务器地址与 VAPID 公钥');
  }

  // 2. 跨平台 PWA 环境检测
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

  // 3. 申请系统通知权限
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('系统通知权限被拒绝，无法开启主动推送');
  }

  // 4. 获取 APNs / FCM 订阅凭据
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

  // 5. 🎯 核心升级：遍历所有存在的消息框，全部具备主动发信能力
  const allChats = await db.chats.toArray();
  if (!allChats || allChats.length === 0) {
    throw new Error('本地尚未创建任何聊天框');
  }

  const allCharacters = await db.characters.toArray();
  const characterMap = new Map(allCharacters.map((c) => [c.id, c]));

  // 为每一个聊天框独立抽取专属的上下文与人设信息
  const chatTargets = [];

  for (const chat of allChats) {
    const chatId = Number(chat.id);
    const charId = Number(chat.characterId || 1);
    const charObj = characterMap.get(charId) || {};

    // 提取该聊天框专属的最近 5 条对话记录，杜绝多框串戏
    let recentContext = '';
    try {
      const recentMsgs = await db.messages
        .where('[chatId+timestamp]')
        .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
        .reverse()
        .limit(5)
        .toArray();

      recentContext = recentMsgs
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
    } catch (err) {
      const fallbackMsgs = await db.messages
        .where('chatId')
        .equals(chatId)
        .reverse()
        .limit(5)
        .toArray();

      recentContext = fallbackMsgs
        .reverse()
        .map((m) => m.content || '')
        .filter(Boolean)
        .join('；');
    }

    chatTargets.push({
      chatId: chatId,
      characterId: charId,
      characterName: charObj.name || chat.title || '伴侣',
      persona:
        charObj.bio ||
        charObj.persona ||
        charObj.extraNotes ||
        charObj.userPersona ||
        '',
      userName: chat.userName || charObj.userName || '你',
      recentContext: recentContext,
      updatedAt: chat.updatedAt || new Date().toISOString(),
    });
  }

  // 6. 读取系统 API 设置
  const apiSettings = await db.settings.get('apiConfig');

  // 7. 发送包含全部可用消息框的配置数据包
  const payloadData = {
    subscription: subscription.toJSON(),
    apiConfig: apiSettings?.value || {},
    // 全量激活的消息框列表，每个都有独立人设和上下文
    chatTargets: chatTargets,
    // 兼容老版本后端的单对象字段（默认取最近更新的那个）
    character: chatTargets[0]
      ? {
          id: chatTargets[0].characterId,
          chatId: chatTargets[0].chatId,
          name: chatTargets[0].characterName,
          persona: chatTargets[0].persona,
          userName: chatTargets[0].userName,
        }
      : { id: 1, chatId: 1, name: '伴侣', persona: '' },
    recentContext: chatTargets[0]?.recentContext || '',
  };

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

  // 8. 顺带执行一次开屏拉齐补漏
  void syncPendingPushMessages();

  console.log(`[CloudPush] 已成功同步所有激活的消息框 (${chatTargets.length} 个) 至云端推送服务！`);
  return true;
}
