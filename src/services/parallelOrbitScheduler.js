import db from '../db';
import {
  checkAndTriggerParallelOrbit,
  cleanupExpiredParallelOrbits
} from './parallelOrbitService';

// 每小时检查一次。
// 注意：这是“检查频率”，实际生成仍受 parallelOrbitService 中的
// 两小时冷却、用户离开十分钟、离开十小时补写等规则控制。
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;

let parallelOrbitSchedulerTimer = null;
let isParallelOrbitChecking = false;

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
 */
export const runParallelOrbitScheduler = async () => {
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

    const chats = await db.chats.toArray();

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

    console.log(
      `[parallelOrbitScheduler] 开始检查 ${validChats.length} 个聊天窗的独处轨迹。`
    );

    // 使用串行而不是 Promise.all：
    // 避免多个聊天窗同时请求 AI，导致 API 突发并发、限流或大量 Token 消耗。
    for (const chat of validChats) {
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
 * 不在启动瞬间自动扫描所有聊天窗：
 * - 避免用户一打开 App，多个聊天窗同时请求 AI；
 * - 用户进入具体 ParallelOrbit 页面时，组件自身会立即进行一次检查；
 * - 应用保持打开后，调度器每小时自动检查一次。
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
