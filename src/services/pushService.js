// src/services/pushService.js
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

export async function setupProactivePush(serverBaseUrl, vapidPublicKey) {
  // 1. 检查是否在 iOS PWA 模式下运行
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (!isStandalone) {
    alert('请点击浏览器底部的分享按钮，选择【添加到主屏幕】，并在桌面上打开本应用！');
    return false;
  }

  // 2. 请求系统级通知权限
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('系统通知权限被拒绝，无法开启主动推送');
    return false;
  }

  // 3. 向苹果 APNs 申请属于本台手机的订阅凭据
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }

  // 4. 从本地 Dexie 提取当前的 AI 设定
  const apiSettings = await db.settings.get('apiConfig');
  const activeChar = (await db.characters.toArray())[0] || {};
  const recentMsgs = (await db.messages.orderBy('timestamp').reverse().limit(3).toArray()).reverse();
  const recentContext = recentMsgs.map(m => m.content).join('；');

  // 5. 将这些配置同步到指定的服务器
  const response = await fetch(`${serverBaseUrl.replace(/\/$/, '')}/api/sync-push-config`, {
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

  if (response.ok) {
    alert('主动唤醒推送已成功绑定！');
    return true;
  } else {
    alert('同步配置到服务器失败，请检查服务器地址是否正确');
    return false;
  }
}
