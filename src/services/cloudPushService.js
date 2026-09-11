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
    alert('【检查】请完整填写服务器地址与 VAPID 公钥');
    return;
  }

  // 步骤 1：检查是否是 iOS 桌面独立模式
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (!isStandalone) {
    alert('【步骤1失败】iOS 必须通过 Safari【添加到主屏幕】后在桌面打开！');
    return;
  }

  // 步骤 2：检查通知权限
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    alert('【步骤2失败】系统通知权限被拒绝，请去 iPhone 设置开启本 App 的通知');
    return;
  }

  // 步骤 3：向苹果 APNs 申请凭据
  let subscription;
  try {
    const registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cleanVapidKey)
      });
    }
  } catch (pushErr) {
    alert(`【步骤3失败 - 苹果推送服务报错】:\n${pushErr.name}: ${pushErr.message}`);
    return;
  }

  // 步骤 4：测试你的宝塔服务器网络连通性
  try {
    // 先发一个简单的测试请求
    const testRes = await fetch(`${cleanServerUrl}/api/sync-push-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription,
        apiConfig: {},
        character: { name: '测试伴侣' },
        recentContext: '测试连通'
      })
    });

    if (!testRes.ok) {
      alert(`【步骤4失败 - 服务器返回错误码】: ${testRes.status} ${testRes.statusText}`);
      return;
    }

    alert('🎉 全部通了！绑定成功！');
    return true;

  } catch (fetchErr) {
    alert(`【步骤4失败 - 连不上宝塔域名】:\n${fetchErr.name}: ${fetchErr.message}\n请检查域名证书或网络`);
  }
}
