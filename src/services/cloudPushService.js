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

  // 如果已有订阅但公钥变更，先退订重新订
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

  // 4. 读取当前本地伴侣数据与 API Key
  const apiSettings = await db.settings.get('apiConfig');
  const activeChar = (await db.characters.toArray())[0] || {};
  const recentMsgs = (await db.messages.orderBy('timestamp').reverse().limit(3).toArray()).reverse();
  const recentContext = recentMsgs.map(m => m.content).join('；');

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
        subscription: subscription.toJSON(), // 使用标准的 toJSON 导出，避免原生对象丢失字段
        apiConfig: apiSettings?.value || {},
        character: {
          name: activeChar.name || 'AI伴侣',
          persona: activeChar.persona || ''
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

  return true;
}
