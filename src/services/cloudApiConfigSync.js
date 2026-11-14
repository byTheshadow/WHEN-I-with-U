// src/services/cloudApiConfigSync.js
//
// 把 App 里的大模型 API 配置（地址 / 令牌 / 模型）同步给云端推送服务器。
//
// 为什么需要：云端主动发信、预约单、留言板、日记都是服务器自己去调大模型，
// 用的是它存下来的那一份配置。以前这份配置只在设置页手动点「绑定/更新」时才会
// 更新，之后在 App 里换了令牌或中转站，云端不知道，就会一直拿旧令牌去调，
// 每分钟都被拒绝（401），消息永远发不出来，而且界面上看不到任何报错。
//
// 做法：设置页「保存」时调用 syncApiConfigToCloud。只有同时满足下面几条才会真的发请求：
//   1. 配置了云端服务器地址（没配的用户完全不受影响，直接跳过）
//   2. 地址和令牌都不是空的（绝不把空配置覆盖到云端）
//   3. 和上一次成功同步的配置不一样（用指纹比较，不在本地再存一份明文令牌）
// 请求只带 apiConfig 一个字段：服务器的 /api/sync-push-config 在没带订阅、
// 聊天框、预约字段时会原样保留已有的那些，不会动到别的东西。
// 失败不抛错，返回 { status: 'failed', message }，由调用方决定怎么提示；
// 失败时不更新指纹，下一次保存会自动重试。

import db from '../db';
import { getEffectiveServerUrl } from './cloudPushService';

const FINGERPRINT_KEY = 'cloudApiConfigSyncedFingerprint';
const REQUEST_TIMEOUT_MS = 10 * 1000;

export const CLOUD_API_SYNC_STATUS = {
  SKIPPED: 'skipped',
  UNCHANGED: 'unchanged',
  SYNCED: 'synced',
  FAILED: 'failed',
};

// 服务器只会用到这三项，其他字段不往云端送。
const pickCloudApiConfig = (config) => ({
  baseUrl: String(config?.baseUrl || '').trim(),
  apiKey: String(config?.apiKey || '').trim(),
  model: String(config?.model || '').trim(),
});

// 简单的非加密哈希，只用来判断「配置有没有变」，不是为了保密。
const fingerprintOf = (picked) => {
  const text = `${picked.baseUrl}\n${picked.model}\n${picked.apiKey}`;
  let hash = 5381;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }

  return `${hash.toString(36)}_${text.length}`;
};

const describeFailure = (error) => {
  if (error?.name === 'AbortError') return '连接服务器超时';

  return error?.message || '网络错误';
};

/**
 * @param {Object} apiConfig 设置页里当前的 API 配置
 * @param {Object} [options]
 * @param {boolean} [options.force] 忽略指纹，强制同步一次
 * @returns {Promise<{status: string, message?: string}>}
 */
export async function syncApiConfigToCloud(apiConfig, { force = false } = {}) {
  try {
    const serverUrl = await getEffectiveServerUrl();

    if (!serverUrl) return { status: CLOUD_API_SYNC_STATUS.SKIPPED };

    const picked = pickCloudApiConfig(apiConfig);

    if (!picked.baseUrl || !picked.apiKey) return { status: CLOUD_API_SYNC_STATUS.SKIPPED };

    const fingerprint = fingerprintOf(picked);

    if (!force) {
      const saved = await db.settings.get(FINGERPRINT_KEY);

      if (saved?.value === fingerprint) return { status: CLOUD_API_SYNC_STATUS.UNCHANGED };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;

    try {
      response = await fetch(`${serverUrl}/api/sync-push-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ apiConfig: picked }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // 400 = 服务器还没有这台设备的推送订阅，也就是还没在设置页绑定过。
      return {
        status: CLOUD_API_SYNC_STATUS.FAILED,
        message: response.status === 400
          ? '云端还没有绑定这台设备，请先点「绑定/更新」'
          : `服务器返回 ${response.status}`,
      };
    }

    await db.settings.put({ key: FINGERPRINT_KEY, value: fingerprint });

    return { status: CLOUD_API_SYNC_STATUS.SYNCED };
  } catch (error) {
    console.warn('[CloudApiSync] 同步 API 配置到云端失败：', error);

    return { status: CLOUD_API_SYNC_STATUS.FAILED, message: describeFailure(error) };
  }
}

export default syncApiConfigToCloud;