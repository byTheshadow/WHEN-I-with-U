import db from '../db';
import { isFocusMuted } from '../apps/focus/focusMuteState';
import {
  checkAndTriggerParallelOrbit,
  cleanupExpiredParallelOrbits
} from './parallelOrbitService';
import {
  generateDailyPlanIfNeeded,
  maybeGenerateCharacterMurmur
} from './characterDailyPlanService';

// 每小时检查一次。
// 注意：这是"检查频率"，实际生成仍受 parallelOrbitService 中的
// 两小时冷却、用户离开十分钟、离开十小时补写等规则控制。
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;

let parallelOrbitSchedulerTimer = null;
let isParallelOrbitChecking = false;

// 2026-10 新增：平行轨迹本身的后台静默扫描是否开启。
// 默认关闭——平行轨迹改成"只在用户打开 ParallelOrbit 页面时才检查/生成
// 这一次"（ParallelOrbit.jsx 自己的 useEffect 负责，不受这个开关影响），
// 用户如果想要回到"App 开着就会在背后自动帮忙补写独处记录"的旧行为，
// 可以在设置里把这个开关打开。
// 注意：这个开关只管"平行轨迹"这一件事本身；同一个调度器里顺路挂着的
// "今日安排 / 碎碎念"检查不受这个开关影响，见下面 runParallelOrbitScheduler
// 里的说明。
const PARALLEL_ORBIT_AUTO_SCHEDULE_SETTING_KEY = 'parallelOrbitAutoScheduleEnabled';

export const isParallelOrbitAutoScheduleEnabled = async () => {
  try {
    const setting = await db.settings.get(PARALLEL_ORBIT_AUTO_SCHEDULE_SETTING_KEY);
    return setting?.value === true;
  } catch (err) {
    console.error('[parallelOrbitScheduler] 读取后台静默扫描开关失败:', err);
    return false;
  }
};

export const setParallelOrbitAutoScheduleEnabled = async (enabled) => {
  await db.settings.put({
    key: PARALLEL_ORBIT_AUTO_SCHEDULE_SETTING_KEY,
    value: Boolean(enabled)
  });
};

/**
 * 清理过期的平行轨迹。
 *
 * 清理失败时不阻止后续正常的轨迹检查与生成。
 */
const cleanupExpiredOrbitsSafely = async () => {
  try {
    const cleanupResult = await cleanupExpiredParallelOrbits();

    if (cleanupResult.deletedCount > 0) {
      console.log(
        `[parallelOrbitScheduler] 已清理 ${cleanupResult.deletedCount} 条过期平行轨迹。`
      );
    }
  } catch (err) {
    console.error(
      '[parallelOrbitScheduler] 清理过期平行轨迹失败：',
      err
    );
  }
};

/**
 * 检查所有实际存在的聊天窗。
 *
 * 每个聊天窗的生成条件由 parallelOrbitService.js 决定：
 * 1. 用户最后消息不足 10 分钟：不生成；
 * 2. 上一条平行轨迹不足 2 小时：不生成；
 * 3. 用户离开超过 10 小时：有限补写最多 3 条；
 * 4. 普通独处状态：生成当前时刻的一条轨迹。
 *
 * 每次调度检查开始前，会先清理十个自然日以前的旧轨迹。
 *
 * 2026-10 改动：是否要在这里"静默"检查/生成平行轨迹本身，现在受
 * `parallelOrbitAutoScheduleEnabled` 这个开关控制，默认关闭——平行轨迹
 * 只在用户真正打开 ParallelOrbit 页面时才生成（那次检查在 ParallelOrbit.jsx
 * 里，不走这个函数）。但"今日安排"和"碎碎念"两件事，用户明确要求
 * 继续跟着这个每小时的基准 tick 走，不受这个开关影响——所以这两步
 * 挪到了循环里"始终执行"的部分，跟平行轨迹本身的检查分开判断。
 */
export const runParallelOrbitScheduler = async (providedChats = null) => {
  if (isParallelOrbitChecking) {
    console.log(
      '[parallelOrbitScheduler] 上一次检查尚未结束，跳过本次。'
    );
    return;
  }

  isParallelOrbitChecking = true;

  try {
    // 清理失败不能阻止后续聊天窗检查。
    await cleanupExpiredOrbitsSafely();

    // globalChatScheduler.js 会传入已经查好的 chats 数组；单独调用时
    // 不传，还是自己查一次，行为不变。
    const chats = providedChats || (await db.chats.toArray());

    // 过滤异常或不完整的聊天数据。
    const validChats = chats.filter(
      (chat) => chat?.id != null && chat?.characterId != null
    );

    if (validChats.length === 0) {
      console.log(
        '[parallelOrbitScheduler] 当前没有可检查的聊天窗。'
      );
      return;
    }

    const autoScheduleEnabled = await isParallelOrbitAutoScheduleEnabled();

    console.log(
      `[parallelOrbitScheduler] 开始检查 ${validChats.length} 个聊天窗（平行轨迹后台扫描：${
        autoScheduleEnabled ? '开启' : '关闭，仅"今日安排/碎碎念"跟着走'
      }）。`
    );

    // 使用串行而不是 Promise.all：
    // 避免多个聊天窗同时请求 AI，导致 API 突发并发、限流或大量 Token 消耗。
    for (const chat of validChats) {
      // 用户正在专注：这个聊天窗的轨迹、今日安排和碎碎念都先不生成，不补发。
      if (isFocusMuted(chat)) continue;
      if (autoScheduleEnabled) {
        try {
          const result = await checkAndTriggerParallelOrbit(chat.id, {
            forceGenerate: false,
            source: 'scheduler'
          });

          console.log(
            `[parallelOrbitScheduler] chatId=${chat.id}，结果：${result.status}`,
            result
          );
        } catch (err) {
          // 单个聊天窗失败不能终止其余聊天窗的检查。
          console.error(
            `[parallelOrbitScheduler] chatId=${chat.id} 检查失败：`,
            err
          );
        }
      }

      // "今日安排"和它的碎碎念按聊天窗维度存储，跟平行轨迹是同一个
      // "这个聊天窗里的角色有自己独立生活"的精神，顺路挂在同一个
      // 小时级调度器上检查，不需要单独再起一个定时器；用户明确要求
      // 这两步不受上面那个开关影响，始终跟着这个基准 tick 走。
      // 已存在当天安排时这两步都只是轻量读取。
      try {
        await generateDailyPlanIfNeeded(chat.id);
        await maybeGenerateCharacterMurmur(chat.id);
      } catch (dailyPlanErr) {
        console.error(
          `[parallelOrbitScheduler] chatId=${chat.id} 今日安排检查失败：`,
          dailyPlanErr
        );
      }
    }
  } catch (err) {
    console.error(
      '[parallelOrbitScheduler] 调度检查失败：',
      err
    );
  } finally {
    isParallelOrbitChecking = false;
  }
};

/**
 * 启动平行轨迹独立调度器。
 *
 * 不在启动瞬间立即展开所有聊天窗的平行轨迹生成：
 * - 平行轨迹本身默认不再后台静默扫描（见上面的开关说明）；
 * - 用户进入具体 ParallelOrbit 页面时，组件自身会立即进行一次检查；
 * - "今日安排/碎碎念"不受开关影响，应用保持打开后，依然每小时自动检查一次。
 */
export const startParallelOrbitScheduler = () => {
  if (parallelOrbitSchedulerTimer) {
    console.log('[parallelOrbitScheduler] 调度器已启动。');
    return;
  }

  console.log('[parallelOrbitScheduler] 已启动，每小时检查一次。');

  parallelOrbitSchedulerTimer = window.setInterval(() => {
    void runParallelOrbitScheduler();
  }, SCHEDULER_INTERVAL_MS);
};

/**
 * 停止调度器，避免 App 卸载后残留定时器。
 */
export const stopParallelOrbitScheduler = () => {
  if (!parallelOrbitSchedulerTimer) {
    return;
  }

  window.clearInterval(parallelOrbitSchedulerTimer);
  parallelOrbitSchedulerTimer = null;
  isParallelOrbitChecking = false;

  console.log('[parallelOrbitScheduler] 已停止。');
};