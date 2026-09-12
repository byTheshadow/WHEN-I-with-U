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

export async function registerCloudPush({ serverUrl, vapidPublicKey }) {
  const cleanServerUrl = (serverUrl || '').trim().replace(/\/$/, '');
  const cleanVapidKey = (vapidPublicKey || '').trim();

  if (!cleanServerUrl || !cleanVapidKey) {
    throw new Error('请完整填写服务器地址与 VAPID 公钥');
  }

  // 1. 跨平台 PWA 环境检测（iOS 要求 standalone，安卓/PC 则只要支持 ServiceWorker 即可）
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

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
        applicationServerKey: urlBase64ToUint8Array(cleanVapidKey)
      });
    } catch (subErr) {
      throw new Error(`申请系统推送凭证失败: ${subErr.message}`);
    }
  }

  // 4. 读取当前本地伴侣数据、匹配真实的 chatId 与 API Key
  const apiSettings = await db.settings.get('apiConfig');
  const activeChar = (await db.characters.toArray())[0] || {};
  
  // 查询与当前伴侣关联的活跃聊天会话
  let activeChat = null;
  if (activeChar.id) {
    activeChat = await db.chats.where('characterId').equals(activeChar.id).first();
  }
  if (!activeChat) {
    activeChat = (await db.chats.toArray())[0] || {};
  }

  // 提取最近的聊天片段，兼容普通 content 字段与 Dexie versions 结构
  const recentMsgs = await db.messages.orderBy('timestamp').reverse().limit(3).toArray();
  const recentContext = recentMsgs.reverse().map(m => {
    if (m.versions && m.versions.length > 0) {
      const idx = m.currentVersionIndex || 0;
      return m.versions[idx]?.text || m.content || '';
    }
    return m.content || '';
  }).filter(Boolean).join('；');

  // 5. 真正向宝塔服务器发送数据
  let response;
  try {
    response = await fetch(`${cleanServerUrl}/api/sync-push-config`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        apiConfig: apiSettings?.value || {},
        character: {
          id: activeChar.id || 1,
          chatId: activeChat.id || 1, // 核心：下发真实关联的 chatId
          name: activeChar.name || 'AI伴侣',
          persona: activeChar.userPersona || activeChar.bio || activeChar.persona || ''
        },
        recentContext: recentContext
      })
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

  return true;
}

