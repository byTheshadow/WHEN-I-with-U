// src/services/cloudCallService.js
import db from '../db';
import { startIncomingCall, recordMissedCloudCall } from './callService';
import { isChatIdFocusMuted } from '../apps/focus/focusMuteGuard';

// 复用 cloudPushService.js 里 getEffectiveServerUrl() 完全一样的读取
// 逻辑，但不从那边 import——cloudPushService.js 反过来要 import 这个
// 文件的 syncPendingCalls，为了不引入一段循环 import，这里就地放一份
// 独立的小函数，代价是两处各留一份同样的十行逻辑，换来这个新文件不
// 依赖任何人、谁都能安全地 import 它。
async function getCallServerUrl() {
  const cloudPushSetting = await db.settings.get('cloudPushConfig');
  const savedUrl = cloudPushSetting?.value?.serverUrl;

  if (savedUrl && typeof savedUrl === 'string') {
    return savedUrl.trim().replace(/\/$/, '');
  }

  return '';
}

// 跟 callScheduler.js 用的是同一把 key（`lastCallAttemptTime_${chatId}`），
// 云端来电邀请一旦被处理（不管是变成响铃还是记成未接），本地这把冷却
// 也跟着刷新一遍，避免这条来电邀请刚处理完，本地 callScheduler.js 下
// 一轮检查又立刻覆盖判断一次同一个聊天框。
async function refreshLocalCallCooldown(chatId) {
  try {
    await db.settings.put({
      key: `lastCallAttemptTime_${chatId}`,
      value: String(Date.now()),
    });
  } catch (err) {
    // 冷却时间戳写入失败不影响这次来电邀请本身的处理结果
    console.warn('[CloudCall] 刷新本地来电冷却失败:', err);
  }
}

/**
 * 拉取云端在客户端离线期间积压的后台来电邀请。跟
 * syncPendingHomeBoard/syncPendingDiaries 走同一套"待取池 + fetch/ack"
 * 节奏，只是多一层"这条邀请是否已经过期"的判断——服务端的
 * ringUntil 只是这条系统通知的有效期，不是真的持续响铃，过期了就只
 * 留一条未接来电记录，不再弹响铃界面。
 *
 * 一批里如果攒了好几条邀请（比如好几天没打开过 App），最终最多只有
 * 一条真的变成响铃——跟服务端"一次巡检最多发起一通"的约束保持一致，
 * 其余的要么判定过期记未接，要么因为已经有一通在响/进行中而暂不
 * 处理，留到下一次同步再试（不 ack，避免被静默丢弃）。
 */
export async function syncPendingCalls() {
  try {
    const cleanServerUrl = await getCallServerUrl();
    if (!cleanServerUrl) return;

    const res = await fetch(`${cleanServerUrl}/api/fetch-pending-calls`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;

    const data = await res.json();
    const invites = Array.isArray(data.calls) ? data.calls : [];
    if (invites.length === 0) return;

    const now = Date.now();
    const ackedIds = [];

    const orderedInvites = invites
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    for (const invite of orderedInvites) {
      const chatId = Number(invite.chatId);
      const characterId = Number(invite.characterId || 1);
      const ringUntil = Number(invite.ringUntil || 0);
      const isExpired = ringUntil > 0 && ringUntil <= now;

      // 用户正在专注：这条邀请不响铃、不补发、不留未接来电，直接确认掉。
      if (await isChatIdFocusMuted(chatId)) {
        ackedIds.push(invite.id);
        continue;
      }

      if (isExpired) {
        await recordMissedCloudCall({
          chatId,
          characterId,
          characterName: invite.characterName,
          inviteId: invite.id,
        });

        ackedIds.push(invite.id);
        await refreshLocalCallCooldown(chatId);
        continue;
      }

      const createdMessageId = await startIncomingCall({
        chatId,
        characterId,
        inviteId: invite.id,
        ringUntil,
      });

      if (createdMessageId) {
        ackedIds.push(invite.id);
        await refreshLocalCallCooldown(chatId);
        continue;
      }

      // 没能创建响铃记录，原因只可能是两种：
      // 1. 本地已经有另一通电话在响/进行中——留到下一次同步再试，
      //    不 ack，这样只要还在 ringUntil 有效期内就还有机会补响铃；
      // 2. 这条邀请之前已经处理过（startIncomingCall / recordMissedCloudCall
      //    内部都按 inviteId 查重）——这种直接确认掉，不用再重试。
      const alreadyHandled = await db.messages
        .where('type')
        .equals('call')
        .filter((message) => message.metadata?.inviteId === invite.id)
        .first();

      if (alreadyHandled) {
        ackedIds.push(invite.id);
      }
    }

    if (ackedIds.length > 0) {
      await fetch(`${cleanServerUrl}/api/ack-pending-calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ackedIds }),
      }).catch(() => {});
    }
  } catch (e) {
    // 纯离线或网络波动时静默跳过，跟其余 syncPending* 保持一致
  }
}

export default syncPendingCalls;