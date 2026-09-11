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
  if (!serverUrl || !vapidPublicKey) {
    throw new Error('请完整填写服务器地址与 VAPID 公钥');
  }

  // 1. 必须在 iOS PWA (添加到主屏幕) 独立模式下运行
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (!isStandalone) {
    throw new Error('iOS 必须通过 Safari【添加到主屏幕】，并在桌面上打开本应用才能开启离线推送！');
  }

  // 2. 检查并申请权限
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('通知权限已被拒绝，请前往系统设置允许通知');
  }

  // 3. 向苹果 APNs 申请唯一订阅凭据
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey.trim())
    });
  }

  // 4. 从本地 IndexedDB 取出 AI 配置与当前伴侣
  const apiSettings = await db.settings.get('apiConfig');
  const activeChar = (await db.characters.toArray())[0] || {};
  const recentMsgs = (await db.messages.orderBy('timestamp').reverse().limit(3).toArray()).reverse();
  const recentContext = recentMsgs.map(m => m.content).join('；');

  // 5. 上报给云端服务
  const res = await fetch(`${serverUrl.trim().replace(/\/$/, '')}/api/sync-push-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription,
      apiConfig: apiSettings?.value || {},
      character: {
        name: activeChar.name || 'AI伴侣',
        persona: activeChar.persona || ''
      },
      recentContext: recentContext
    })
  });

  if (!res.ok) {
    throw new Error(`服务器响应失败，状态码: ${res.status}`);
  }

  return true;
}
