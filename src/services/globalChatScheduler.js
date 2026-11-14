// src/services/globalChatScheduler.js
//
// 把 rhythm / call / snapshotGlobal / almanacGreeting / parallelOrbit 这五个
// 原本各自独立 setInterval、各自独立 db.chats.toArray() 的"每隔一段时间
// 遍历全部聊天窗"调度器，合并到同一个共享基准 tick 上。
//
// 只改了"谁负责发起 db.chats.toArray()、按什么节奏叫醒每个检查"这一层
// 调度外壳：每个功能自己多久该检查一次、检查到之后要不要真的触发、怎么
// 判断冷却和概率，仍然完全由各自原来的 runXxxScheduler / checkXxx 函数
// 决定，本文件不重写、不精简它们内部的任何逻辑。
//
// 五个原函数都改成可以接受一个"已经查好的 chats 数组"作为可选参数：
// 本文件调用时传入共享数组；不传时（比如 App.jsx 里 almanac 的
// focus/pageshow/visibilitychange 直接调用 checkAlmanacGreetings()）
// 就还像原来一样自己查一次，行为不变。
//
// 基准 tick 选 3 分钟：rhythm/almanacGreeting 原本就是 3 分钟一次，
// call(6)/snapshotGlobal(15)/parallelOrbit(60) 都是 3 的整数倍，用它
// 判断"这一轮谁到点了"不会改变任何一个功能原来的检查频率。
//
// 启动时的"要不要立刻查一次"完全照抄各自原文件里的设计，不能统一处理：
// - rhythm / snapshotGlobal / almanacGreeting：原来就是"App 一打开就看一眼，
//   之后每隔自己的间隔再查"，这里保留（lastRunAt 初始不设，第一次 tick 即到期）。
// - call：原文件明确说"不在启动瞬间立即检查一次，避免一打开 App 就可能被
//   打电话"，这里保留（lastRunAt 初始设为启动时间，从满一个自己的间隔后才到期）。
// - parallelOrbit：原文件同样明确"不在启动瞬间自动扫描"，这里保留（处理方式同 call）。
//
// 2026-10-04 新增 challengeScheduler（异地任务挑战——角色自己判断要不
// 要完成/布置任务）：没有冷却，比照 call/parallelOrbit 的"不在启动瞬间
// 自动扫描"处理，间隔选跟 almanacPortrait/parallelOrbit 一样的 60 分钟
// ——完全没冷却的动作，靠检查间隔本身来避免太频繁。
import db from '../db';
import { runRhythmScheduler } from './rhythmScheduler';
import { runCallScheduler } from './callScheduler';
import { runParallelOrbitScheduler } from './parallelOrbitScheduler';
import { checkAndTriggerGlobalSnapshotPosts } from '../apps/snapshots/services/snapshotGlobalScheduler';
import { checkAlmanacGreetings } from '../apps/almanac/services/almanacGreetingService';
import { checkAlmanacPortraitAutoGeneration } from '../apps/almanac/services/almanacCharacterPortraitService';
import { runChallengeScheduler } from '../apps/challenges/challengeScheduler';
import { checkCompanionMoods } from '../apps/companion/mood/companionMoodScheduler';
import { checkCompanionStatusAlerts } from '../apps/companion/companionStatusAlertService';
import { runPixelDollScheduler } from '../apps/pixelDoll/pixelDollScheduler';
import { runPrivateAreaNightly } from '../apps/characterArea/privateAreaNightlyScheduler';


const BASE_TICK_MS = 3 * 60 * 1000;

const REGISTRATIONS = [
  { name: 'rhythm', intervalMs: 3 * 60 * 1000, run: runRhythmScheduler },
  { name: 'almanacGreeting', intervalMs: 3 * 60 * 1000, run: checkAlmanacGreetings },
  { name: 'call', intervalMs: 6 * 60 * 1000, run: runCallScheduler },
  { name: 'snapshotGlobal', intervalMs: 15 * 60 * 1000, run: checkAndTriggerGlobalSnapshotPosts },
  { name: 'almanacPortrait', intervalMs: 60 * 60 * 1000, run: checkAlmanacPortraitAutoGeneration },
  { name: 'parallelOrbit', intervalMs: 60 * 60 * 1000, run: runParallelOrbitScheduler },
  { name: 'challenge', intervalMs: 60 * 60 * 1000, run: runChallengeScheduler },
  // 本身是"过了 22 点才真的检查"的一次性日结，检查本身很便宜（没到点
  // 就立刻 return），用跟 rhythm/almanacGreeting 一样的 3 分钟间隔没问题。
  { name: 'companionMood', intervalMs: 3 * 60 * 1000, run: checkCompanionMoods },
  // #4 状态不佳卡片：检查本身也很便宜（没养小伙伴/还在冷却就立刻
  // return），3 分钟间隔足够及时，不会错过状态刚掉下阈值的时机。

  { name: 'companionStatusAlert', intervalMs: 3 * 60 * 1000, run: checkCompanionStatusAlerts },
  // 像素衣橱——角色自主判断要不要主动送一件礼物，没有冷却，跟 challenge
  // 同一个"不在启动瞬间自动扫描"处理，60 分钟一次。
  { name: 'pixelDoll', intervalMs: 60 * 60 * 1000, run: runPixelDollScheduler },
  { name: 'privateAreaNightly', intervalMs: 3 * 60 * 1000, run: runPrivateAreaNightly },
];

// 原本就不在启动瞬间立即检查一次的调度器，见文件顶部说明。
const SKIP_IMMEDIATE_RUN_ON_START = new Set(['call', 'parallelOrbit', 'challenge', 'pixelDoll']);
let baseTimer = null;
let lastRunAt = new Map();

const runDueSchedulers = async () => {
  const now = Date.now();

  const due = REGISTRATIONS.filter((reg) => {
    const last = lastRunAt.get(reg.name) || 0;
    return now - last >= reg.intervalMs;
  });

  if (due.length === 0) return;

  // 没有任何聊天窗时，这五个检查都无事可做，省掉这一轮的 db.chats.toArray()。
  const chatCount = await db.chats.count();

  if (chatCount === 0) {
    // 仍然刷新到期的时间戳，避免"第一次建聊天窗"那一刻，
    // 五个检查因为都还没跑过而一次性堆在同一轮触发。
    due.forEach((reg) => lastRunAt.set(reg.name, now));
    return;
  }

  const chats = await db.chats.toArray();

  // 串行执行，不用 Promise.all：延续 rhythm/call/parallelOrbit 各自原本的
  // 设计初衷——避免多个聊天窗、多个功能同时向 AI 接口发请求。
  for (const reg of due) {
    lastRunAt.set(reg.name, now);

    try {
      await reg.run(chats);
    } catch (error) {
      console.error(`[globalChatScheduler] ${reg.name} 检查失败：`, error);
    }
  }
};

export const startGlobalChatScheduler = () => {
  if (baseTimer) return;

  const now = Date.now();

  SKIP_IMMEDIATE_RUN_ON_START.forEach((name) => {
    lastRunAt.set(name, now);
  });

  void runDueSchedulers();

  baseTimer = window.setInterval(() => {
    void runDueSchedulers();
  }, BASE_TICK_MS);

    console.log('[globalChatScheduler] 已启动，基准 tick 3 分钟，合并 rhythm/call/snapshotGlobal/almanacGreeting/almanacPortrait/parallelOrbit/challenge/companionMood/companionStatusAlert/pixelDoll。');
};

export const stopGlobalChatScheduler = () => {
  if (!baseTimer) return;

  window.clearInterval(baseTimer);
  baseTimer = null;
  lastRunAt = new Map();
};