import db from '../db';
import { hasAnyLiveCall, startIncomingCall } from './callService';
import { getAwayState } from '../apps/messages/away/awayState';
import {
  generateCallReason,
  getCallChanceForSilence,
  getUserSilenceMs,
} from './callReasonService';

// 角色主动打电话过来,应该是偶尔的意外,不是准点报时,所以频率要比
// 寄语/反应这类小动作低得多。每 6 分钟才检查一次,冷却期 6 小时起步,
// 冷却过了也只有一定概率真的打过来——留一点"不确定什么时候会响"的
// 真实感,而不是掐着表来电话。
//
// 要不要打不再问 AI:概率只看用户已经多久没在这个聊天室发过消息,
// 沉默越久越容易打进来(档位表见 callReasonService.js)。概率命中、电话
// 确定要响之后,才会用一次小调用写"为什么打来"的理由,理由失败不影响来电。
const SCHEDULER_INTERVAL_MS = 6 * 60 * 1000;
const CALL_ATTEMPT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

let callSchedulerTimer = null;
let isCallChecking = false;

/**
 * 扫描所有开启了 rhythmEnabled 的聊天窗（复用"角色可以主动联系我"
 * 这个既有开关,没有再单独加一个"允许来电"的设置项),逐个按沉默时长
 * 掷一次概率,决定这次醒来要不要真的打一通电话进来。
 *
 * 串行执行、一次最多打进一通,避免多个角色同时抢着打电话。
 */
export const runCallScheduler = async (providedChats = null) => {
  if (isCallChecking) return;
  isCallChecking = true;

  try {
    if (await hasAnyLiveCall()) {
      return;
    }

    // globalChatScheduler.js 会传入已经查好的 chats 数组；单独调用时
    // 不传，还是自己查一次，行为不变。
    const chats = providedChats || (await db.chats.toArray());

    const eligibleChats = chats.filter(
      (chat) =>
        chat?.id != null &&
        chat?.characterId != null &&
        chat?.rhythmEnabled !== false &&
        // 角色暂时不在线时不主动来电。
        !getAwayState(chat).away
    );

    for (const chat of eligibleChats) {
      try {
        if (await hasAnyLiveCall()) {
          break;
        }

        const now = Date.now();
        const cooldownKey = `lastCallAttemptTime_${chat.id}`;
        const lastAttemptSetting = await db.settings.get(cooldownKey);
        const lastAttempt = Number(lastAttemptSetting?.value || 0);

        if (now - lastAttempt < CALL_ATTEMPT_COOLDOWN_MS) {
          continue;
        }

        // 沉默时长 -> 概率。用户从没发过消息的聊天窗(silentMs 为 null)不打。
        const silentMs = await getUserSilenceMs(chat.id, now);
        const chance = silentMs == null ? 0 : getCallChanceForSilence(silentMs);

        if (chance <= 0 || Math.random() >= chance) {
          continue;
        }

        const character = await db.characters.get(chat.characterId);
        if (!character) continue;

        // 没配 API 的话接起来也说不了话,干脆不打。
        const apiSettings = await db.settings.get('apiConfig');
        const apiConfig = apiSettings?.value || {};
        if (!apiConfig.baseUrl || !apiConfig.apiKey) continue;

        // 概率命中就先刷新冷却时间,避免理由生成或响铃失败后
        // 下一轮检查（6 分钟后）又立刻重试。
        await db.settings.put({ key: cooldownKey, value: String(now) });

        const reason = await generateCallReason({ chat, character, apiConfig, silentMs });

        const messageId = await startIncomingCall({
          chatId: chat.id,
          characterId: character.id,
          reason,
        });

        if (messageId) {
          console.log(
            `[callScheduler] chatId=${chat.id} 发起来电(沉默 ${Math.round(silentMs / 60000)} 分钟,概率 ${chance})`
          );
          break;
        }
      } catch (err) {
        console.error(`[callScheduler] chatId=${chat.id} 检查失败:`, err);
      }
    }
  } catch (err) {
    console.error('[callScheduler] 调度检查失败：', err);
  } finally {
    isCallChecking = false;
  }
};

/**
 * 启动来电调度器。跟 rhythmScheduler 不同,这里不在启动时立即检查一次
 * ——不希望每次打开 App 都可能被劈头盖脸打一通电话,第一次检查要等
 * 满一个 SCHEDULER_INTERVAL_MS 之后。
 */
export const startCallScheduler = () => {
  if (callSchedulerTimer) {
    return;
  }

  console.log(
    `[callScheduler] 已启动，每 ${SCHEDULER_INTERVAL_MS / 60000} 分钟检查一次。`
  );

  callSchedulerTimer = window.setInterval(() => {
    void runCallScheduler();
  }, SCHEDULER_INTERVAL_MS);
};

export const stopCallScheduler = () => {
  if (!callSchedulerTimer) {
    return;
  }

  window.clearInterval(callSchedulerTimer);
  callSchedulerTimer = null;
  isCallChecking = false;

  console.log('[callScheduler] 已停止。');
};