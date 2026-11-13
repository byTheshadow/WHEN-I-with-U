/*
 * "小伙伴"（#6 聊天窗宠物）核心逻辑：领养、状态衰减、喂食/清洁/玩耍、
 * ❤️ 计算、商店购买/穿戴、角色自主互动。
 *
 * 完全新建的一套，不 import、不修改 src/apps/pet/、src/apps/habitat/
 * 的任何代码和数据；写法借鉴 habitatService.js（衰减、共同照料）和
 * petWidgetService.js（AI 反应、图片压缩），细节见下方注释。
 */

import db from '../../db';
import { generateAutonomousCareNote } from './companionAiService';
import { findShopItem, FOOD_TIERS } from './companionShopData';
import { checkCompanionEvents, getActiveEvents } from './companionEventService';
import { addToBackpack } from './backpack/companionBackpackService';
import { recordTaskEvent } from './tasks/companionTaskService';
import {
  SLEEP_MOOD_GAIN_PER_HOUR,
  SLEEP_POKE_REPLIES,
  SLEEP_SATIETY_DECAY_FACTOR,
  buildSleepBookkeepingPatch,
  computeSleepHours,
  isCompanionSleeping,
  pickWokenUpPrefix,
  wakeCompanionIfSleeping,
} from './companionSleepService';

// ---- 数值状态衰减（参照 habitatService.js 的 applyTimeDecay）----
const DECAY_PER_HOUR = { satiety: 4, mood: 2, cleanliness: 1 };
const MIN_DECAY_HOURS = 0.25; // 不到 15 分钟不结算，省计算

// ---- 直接互动（喂食/清洁/玩耍）的即时加成，含 ❤️ ----
const FREE_ACTION_EFFECT = {
  feed: { satiety: 25, mood: 5, hearts: 2, cleanliness: -2 },
  clean: { satiety: 0, mood: 12, hearts: 2, cleanliness: 30 },
  play: { satiety: -5, mood: 18, hearts: 2, cleanliness: -5 },
};

// 从数组里随机挑一条，戳一戳和喂食/清洁/玩耍的反馈文案共用这一个小工具。
const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];

// ---- 喂食/清洁/玩耍的即时反馈：纯本地文案池，不调用 AI ----
// （2026-10 从"调 AI、复用整个 buildChatSystemPrompt 生成一句话"改成纯
// 兜底——这三个按键点击频率高，之前每点一次都要带上世界书/待办/日记等
// 一整套大提示词去换一句旁白式反应，用户觉得不值这个 token/API 成本；
// 而且这些反应本来就是"小伙伴自己的反应"，不依赖角色人设，思路跟下面
// 戳一戳的 POKE_REPLIES 一致）
const FEED_FALLBACKS = [
  '吃得挺香的，尾巴都在晃。',
  '心满意足地舔了舔嘴。',
  '吃得一粒不剩，还眼巴巴地看着空碗。',
  '小口小口地吃着，看起来很享受。',
  '吃到一半停下来蹭了蹭你的手。',
  '两颊鼓鼓的，像是在偷偷藏粮食。',
  '吃完打了个满足的小哈欠。',
  '围着食盆转了两圈才开始吃。',
  '吃得专注极了，耳朵都竖了起来。',
  '吃完舒舒服服地趴下了。',
];
const CLEAN_FALLBACKS = [
  '干干净净，整个精神了不少。',
  '被打理过后，蹭了蹭你的手。',
  '浑身毛茸茸的，抖了抖身子。',
  '闻起来香香的，心情也变好了。',
  '梳理完毛发，舒服地眯起了眼睛。',
  '干净利落，走起路来都轻快了几分。',
  '收拾完后一直围着你打转。',
  '整理好之后，自己蹭了蹭墙角像是在确认。',
  '清爽多了，趴在你身边不想动。',
  '收拾得整整齐齐，像是换了一只新的一样。',
];
const PLAY_FALLBACKS = [
  '玩得很开心，眼睛亮亮的。',
  '扑腾了几下，看起来很满足。',
  '围着你转圈圈，怎么都玩不腻。',
  '玩累了，呼哧呼哧地喘着气。',
  '蹦蹦跳跳的，心情好得不行。',
  '玩到一半突然扑向你，像是在撒娇。',
  '尾巴甩得飞快，根本停不下来。',
  '兴奋地跑来跑去，一刻也不闲着。',
  '玩具都被它折腾了个遍。',
  '玩累了，直接窝进你怀里不走了。',
];
const FREE_ACTION_FALLBACKS = { feed: FEED_FALLBACKS, clean: CLEAN_FALLBACKS, play: PLAY_FALLBACKS };

// ---- 戳一戳：小伙伴自己"说话"，纯固定文案池，不调用 AI、不写日志 ----
// （用户确认过：说话的是小伙伴自己，不是角色替它转述，思路照抄
// petWidgetService.js 的 CANNED_REACTIONS，但这里不 import 那份代码）
const POKE_REPLIES = [
  '喵呜～蹭了蹭你的手。',
  '被戳到了，甩了甩尾巴。',
  '汪！开心地摇了摇尾巴。',
  '眯着眼睛，看起来很舒服。',
  '打了个哈欠，慢悠悠地看向你。',
  '往你身边凑近了一点点。',
  '歪着头看着你，好像在等什么。',
  '吓了一跳，耳朵抖了抖。',
  '回头看了你一眼，又低下头假装没事。',
  '小声哼唧了一下，往后缩了缩。',
  '忽然来了精神，蹭了蹭你的胳膊。',
  '翻了个身，露出了肚皮。',
  '愣了一下，然后凑过来蹭蹭。',
  '尾巴摇得更欢了。',
  '被戳得有点痒，扭了扭身子。',
];

/*
 * 戳一戳：只是个好玩的轻互动，不产生 ❤️（避免变成无限刷心的漏洞），
 * 给心情一点点微小的加成即可；不写 companionLogs，太琐碎，
 * 会把"最近的动态"刷屏。
 */
export const pokeCompanion = async (companionId) => {
  const companion = await db.companions.get(companionId);
  if (!companion) return null;

  const now = Date.now();
    // 睡觉时被戳：不会吵醒，但会被嫌弃（心情小幅下降）。
  if (isCompanionSleeping(companion, now)) {
    const grumpy = { ...companion, mood: clamp100(companion.mood - 2), updatedAt: now };
    await db.companions.put(grumpy);
    return { companion: grumpy, line: pickRandom(SLEEP_POKE_REPLIES), sleeping: true };
  }
  const updated = {
    ...companion,
    mood: clamp100(companion.mood + 2),
    lastInteractionAt: now,
    updatedAt: now,
    totalInteractionCount: (companion.totalInteractionCount || 0) + 1,
  };

  await db.companions.put(updated);

  const line = pickRandom(POKE_REPLIES);

  // 每日任务：戳一戳累计次数（见 companionTaskData.js 的 'poke-times'）。
  await recordTaskEvent(companionId, 'poke', 1);
  const latestCompanion = await db.companions.get(companionId);

  return { companion: latestCompanion || updated, line };
};

// ---- 聊天回应换 ❤️（同一聊天窗、按天计算）----
// 前 10 次回应 = 1 心；此后每 20 次 = 0.5 心；当天通过聊天获得的心封顶 5。
const CHAT_HEART_FIRST_TIER_EVERY = 10;
const CHAT_HEART_FIRST_TIER_AMOUNT = 1;
const CHAT_HEART_LATER_TIER_EVERY = 20;
const CHAT_HEART_LATER_TIER_AMOUNT = 0.5;
const CHAT_HEART_DAILY_CAP = 5;

// ---- 用户不在时，角色自主互动小伙伴（见启动包第 9.2 节问题 7：b+c）----
// b：用户点"回应"时，角色顺便去看一眼的概率。
const AUTO_CARE_CHAT_TRIGGER_PROBABILITY = 0.25;
// c：定时巡检——多久没人（含角色）互动算"冷落"，冷落之后每次巡检的触发概率。
const AUTO_CARE_NEGLECT_HOURS = 6;
const AUTO_CARE_NEGLECT_PROBABILITY = 0.3;
// 不管哪种触发方式，两次自主互动之间至少间隔这么久，避免刷屏。
const AUTO_CARE_MIN_GAP_HOURS = 2;
// 定时巡检本身也不必每 60 秒都掷一次骰子，同一只宠物这么久才重新掷一次。
const AUTO_CARE_ROLL_COOLDOWN_HOURS = 1;
const AUTO_CARE_EFFECT = { satiety: 10, mood: 15, hearts: 2 };

const clamp100 = (value) => Math.max(0, Math.min(100, Math.round(value)));

const todayDateStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const hoursSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return Infinity;
  return (now - timestamp) / 3600000;
};

// ---- 领养 ----

/*
 * 给邀请卡片（CompanionOfferCard）用的轻量判断：这个聊天窗现在
 * 是不是已经有小伙伴了（不需要衰减计算，纯粹判断有没有）。
 */
export const hasCompanionForChat = async (chatId) => {
  if (chatId === null || chatId === undefined) return false;
  const existing = await db.companions.where('chatId').equals(chatId).first();
  return Boolean(existing);
};

export const getCompanionByChat = async (chatId) => {
  if (chatId === null || chatId === undefined) return null;
  const companion = await db.companions.where('chatId').equals(chatId).first();
  if (!companion) return null;
  return await applyTimeDecay(companion);
};

// ---- 日志自动清理：超过 7 天的照顾日记直接删掉 ----
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const pruneOldCompanionLogs = async (companionId) => {
  const cutoff = Date.now() - LOG_RETENTION_MS;
  const staleIds = await db.companionLogs
    .where('companionId')
    .equals(companionId)
    .filter((log) => log.timestamp < cutoff)
    .primaryKeys();

  if (staleIds.length > 0) {
    await db.companionLogs.bulkDelete(staleIds);
  }
};

/*
 * 打开小伙伴页面时调用一次（只在挂载时调用，不要在每次 reload() 都调用，
 * 否则事件判定的冷却/"最近打开时间"会被互动动作误触发）：
 *   1. 正常拿一次衰减后的 companion（跟 getCompanionByChat 一样）。
 *   2. 清理超过 7 天的照顾日记。
 *   3. 判定一次特殊事件（命中的话会顺带插入一条聊天消息）。
 *   4. 把"最近一次打开"的时间戳更新成现在——放在事件判定*之后*，
 *      因为"好久没见好想你"这个传说事件要用的是"这次打开之前"
 *      已经过去了多久，不能被这次打开自己覆盖掉。
 *
 * 返回 { companion, newEvents }：companion 是最终状态（衰减 + 事件
 * 判定都应用之后的），newEvents 是这次新出现的事件，供页面决定要不要
 * 自动弹一个详情弹窗。
 */
export const openCompanionSession = async (chatId) => {
  const companion = await getCompanionByChat(chatId);
  if (!companion) return { companion: null, newEvents: [] };

  await pruneOldCompanionLogs(companion.id);

  const { companion: afterEvents, newEvents } = await checkCompanionEvents(companion.id);
  const finalCompanion = afterEvents || companion;

  await db.companions.update(finalCompanion.id, { lastPageOpenAt: Date.now() });

  return {
    companion: { ...finalCompanion, lastPageOpenAt: Date.now() },
    newEvents,
  };
};

export { getActiveEvents };
export { claimCompanionEvent, resolveCompanionChoiceEvent } from './companionEventService';
export { getBackpack, useBackpackItem } from './backpack/companionBackpackService';
export { getDiaries, toggleDiaryLike, commentOnDiary } from './diary/companionDiaryService';

export const adoptCompanion = async ({ chatId, characterId, name, avatarUrl }) => {
  const existing = await db.companions.where('chatId').equals(chatId).first();
  if (existing) return existing;

  const now = Date.now();
  const record = {
    chatId,
    characterId,
    name: String(name || '小伙伴').slice(0, 20),
    avatarUrl: avatarUrl || null,
     mood: 80,
    satiety: 80,
    cleanliness: 100,
    hearts: 0,
    freeActionDaily: { dateStr: todayDateStr(), feed: 0, clean: 0, play: 0 },
    equippedOutfit: null,
    background: null,
    lastInteractionAt: now,
    lastDecayedAt: now,
    lastAutoCareAt: null,
    lastAutoCareRollAt: null,
    chatHeartProgress: { dateStr: todayDateStr(), responseCount: 0, heartsAwardedToday: 0 },
    // ---- 事件/食物分级系统用到的计数与状态（见 companionEventService.js）----
    feedCount: 0,
    cleanActionCount: 0,
    totalInteractionCount: 0,
    moodFullStreak: 0,
    lastPageOpenAt: now,
    lastEventRollAt: null,
    lastLegendaryGrantAt: null,
    unlockedRareFoodIds: [],
    unlockedRareCleanIds: [],
    unlockedRareToyIds: [],
    legendaryStock: {},
    firedMilestoneEventIds: [],
    activeEvents: [],
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.companions.add(record);
  record.id = id;

  await db.companionLogs.add({
    companionId: id,
    logType: 'user_action',
    actionType: 'adopt',
    content: `${record.name} 从今天开始加入了你们。`,
    timestamp: now,
  });

  return record;
};

/*
 * "一张图不定终身"（用户在 9.2 第 3 条改了主意）：领养之后，
 * 宠物页面里随时可以重新上传/更换形态图，这里就是那个更换入口。
 */
export const updateCompanionAvatar = async (companionId, avatarUrl) => {
  const now = Date.now();
  await db.companions.update(companionId, { avatarUrl, updatedAt: now });
  return await db.companions.get(companionId);
};

/*
 * 改名：用户本轮要求支持重新改名字（之前只能领养时定一次）。
 * 跟换形态图一样轻量，不留历史记录，直接覆盖，写一条日志留痕即可。
 */
export const renameCompanion = async (companionId, newName) => {
  const trimmed = String(newName || '').trim().slice(0, 20);
  if (!trimmed) throw new Error('名字不能为空');

  const companion = await db.companions.get(companionId);
  if (!companion) throw new Error('小伙伴不存在');
  if (trimmed === companion.name) return companion;

  const now = Date.now();
  const previousName = companion.name;
  await db.companions.update(companionId, { name: trimmed, updatedAt: now });

  await db.companionLogs.add({
    companionId,
    logType: 'user_action',
    actionType: 'rename',
    content: `把它的名字从「${previousName}」改成了「${trimmed}」。`,
    timestamp: now,
  });

  return await db.companions.get(companionId);
};

/*
 * 场景/背景：用户本轮要求"像装修房间"一样四选一，选哪个就一直是哪个，
 * 不随心情/时间自动变化（已跟用户确认）。
 */
export const setCompanionScene = async (companionId, sceneId) => {
  await db.companions.update(companionId, {
    background: sceneId,
    updatedAt: Date.now(),
  });
  return await db.companions.get(companionId);
};

// ---- 状态衰减 ----

export const applyTimeDecay = async (companion) => {
  const now = Date.now();
  const lastDecayed = companion.lastDecayedAt || companion.createdAt || now;
  const hoursElapsed = hoursSince(lastDecayed, now);

  if (hoursElapsed < MIN_DECAY_HOURS) {
    return companion;
  }

  const sleepHours = Math.min(hoursElapsed, computeSleepHours(companion, lastDecayed, now));
  const awakeHours = hoursElapsed - sleepHours;

  const updated = {
    ...companion,
    satiety: clamp100(
      companion.satiety
      - awakeHours * DECAY_PER_HOUR.satiety
      - sleepHours * DECAY_PER_HOUR.satiety * SLEEP_SATIETY_DECAY_FACTOR
    ),
    mood: clamp100(
      companion.mood
      - awakeHours * DECAY_PER_HOUR.mood
      + sleepHours * SLEEP_MOOD_GAIN_PER_HOUR
    ),
    cleanliness: clamp100((companion.cleanliness ?? 100) - hoursElapsed * DECAY_PER_HOUR.cleanliness),
    lastDecayedAt: now,
    ...buildSleepBookkeepingPatch(companion, sleepHours, now),
  };

  await db.companions.put(updated);
  return updated;
};

// ---- 直接互动：喂食 / 清洁 / 玩耍 ----

// 免费互动（喂食/清洁/玩耍）每天各限 1 次的文案，用户点超额时提示用。
const FREE_ACTION_EXHAUSTED_MESSAGE = {
  feed: '今天的免费喂食已经用过啦，明天再来吧，或者去背包里看看有没有吃的。',
  clean: '今天已经免费清洁过啦，明天再来吧。',
  play: '今天已经免费玩耍过啦，明天再来吧。',
};

export const performFreeAction = async (companionId, actionType) => {
  const effect = FREE_ACTION_EFFECT[actionType];
  if (!effect) return null;

  let companion = await db.companions.get(companionId);
  if (!companion) return null;
  companion = await applyTimeDecay(companion);

  const dateStr = todayDateStr();
  const dailyProgress = companion.freeActionDaily?.dateStr === dateStr
    ? companion.freeActionDaily
    : { dateStr, feed: 0, clean: 0, play: 0 };

  if ((dailyProgress[actionType] || 0) >= 1) {
    throw new Error(FREE_ACTION_EXHAUSTED_MESSAGE[actionType] || '今天这个互动已经用过啦，明天再来吧。');
  }

  const newDailyProgress = { ...dailyProgress, [actionType]: (dailyProgress[actionType] || 0) + 1 };

  
  const wasWoken = await wakeCompanionIfSleeping(companionId);
  if (wasWoken) {
    companion = { ...companion, sleepWokenAt: Date.now(), sleepAccumHours: 0, pendingWakeTip: null };
  }

  const now = Date.now();
  const newMood = clamp100(companion.mood + effect.mood);
  const updated = {
    ...companion,
    satiety: clamp100(companion.satiety + effect.satiety),
    mood: newMood,
    cleanliness: clamp100((companion.cleanliness ?? 100) + (effect.cleanliness || 0)),
    hearts: Math.round((companion.hearts + effect.hearts) * 10) / 10,
    lastInteractionAt: now,
    updatedAt: now,
    totalInteractionCount: (companion.totalInteractionCount || 0) + 1,
    feedCount: (companion.feedCount || 0) + (actionType === 'feed' ? 1 : 0),
    cleanActionCount: (companion.cleanActionCount || 0) + (actionType === 'clean' ? 1 : 0),
    // 心情"连续满格"计数：这次也满格就+1，否则清零（见稀有解锁事件 2）。
    moodFullStreak: newMood >= 100 ? (companion.moodFullStreak || 0) + 1 : 0,
    freeActionDaily: newDailyProgress,
  };

  await db.companions.put(updated);

  const baseFeedback = pickRandom(FREE_ACTION_FALLBACKS[actionType] || FEED_FALLBACKS);
  const feedbackText = wasWoken ? `${pickWokenUpPrefix()}${baseFeedback}` : baseFeedback;

  await db.companionLogs.add({
    companionId,
    logType: 'user_action',
    actionType,
    content: feedbackText,
    timestamp: now,
  });

  // 每日任务：actionType 正好就是 'feed'/'clean'/'play'，跟任务池的
  // eventKey 完全一致，可以直接传进去。
  await recordTaskEvent(companionId, actionType);
  const latestCompanion = await db.companions.get(companionId);

  return { companion: latestCompanion || updated, feedbackText };
};

// ---- 聊天回应换 ❤️ + 顺带触发角色自主互动（b） ----

const computeChatHeartDelta = (previousCount, newCount) => {
  let delta = 0;

  for (let count = previousCount + 1; count <= newCount; count += 1) {
    if (count <= CHAT_HEART_FIRST_TIER_EVERY) {
      if (count === CHAT_HEART_FIRST_TIER_EVERY) {
        delta += CHAT_HEART_FIRST_TIER_AMOUNT;
      }
    } else if ((count - CHAT_HEART_FIRST_TIER_EVERY) % CHAT_HEART_LATER_TIER_EVERY === 0) {
      delta += CHAT_HEART_LATER_TIER_AMOUNT;
    }
  }

  return delta;
};

/*
 * 从 ChatRoom.jsx 的 handleTriggerAi 里调用（用户点"触发伴侣回应"时）。
 * 找不到这个聊天窗的小伙伴时直接跳过，不影响正常聊天流程。
 */
export const recordChatResponseForCompanion = async (chatId) => {
  try {
    const companion = await db.companions.where('chatId').equals(chatId).first();
    if (!companion) return;

    const dateStr = todayDateStr();
    const progress = companion.chatHeartProgress?.dateStr === dateStr
      ? companion.chatHeartProgress
      : { dateStr, responseCount: 0, heartsAwardedToday: 0 };

    const newCount = progress.responseCount + 1;
    const rawDelta = computeChatHeartDelta(progress.responseCount, newCount);
    const remainingCap = Math.max(0, CHAT_HEART_DAILY_CAP - progress.heartsAwardedToday);
    const delta = Math.min(rawDelta, remainingCap);

    const newProgress = {
      dateStr,
      responseCount: newCount,
      heartsAwardedToday: Math.round((progress.heartsAwardedToday + delta) * 10) / 10,
    };

    await db.companions.update(companion.id, {
      hearts: Math.round((companion.hearts + delta) * 10) / 10,
      chatHeartProgress: newProgress,
      updatedAt: Date.now(),
    });

    // 每日任务："跟TA聊满 N 句"——跟聊天回应共用同一个触发点。
    await recordTaskEvent(companion.id, 'chat_message', 1);

    // b：聊天回应触发角色顺便去看一眼小伙伴（轻量、独立日志，不进聊天记录）。
    if (
      Math.random() < AUTO_CARE_CHAT_TRIGGER_PROBABILITY
      && hoursSince(companion.lastAutoCareAt) >= AUTO_CARE_MIN_GAP_HOURS
    ) {
      setTimeout(() => {
        triggerCompanionAutonomousCare(companion.id);
      }, 2000);
    }
  } catch (error) {
    console.error('[Companion] 记录聊天回应失败:', error);
  }
};

// ---- 角色自主照顾（b 的执行体 + c 的执行体共用）----

export const triggerCompanionAutonomousCare = async (companionId) => {
  const companion = await db.companions.get(companionId);
  if (!companion) return;

    if (isCompanionSleeping(companion)) return;
  const chat = await db.chats.get(companion.chatId);
  const character = chat ? await db.characters.get(chat.characterId) : null;
  if (!chat || !character) return;

  const now = Date.now();
  const updated = {
    ...companion,
    satiety: clamp100(companion.satiety + AUTO_CARE_EFFECT.satiety),
    mood: clamp100(companion.mood + AUTO_CARE_EFFECT.mood),
    hearts: Math.round((companion.hearts + AUTO_CARE_EFFECT.hearts) * 10) / 10,
    lastInteractionAt: now,
    lastAutoCareAt: now,
    updatedAt: now,
  };

  await db.companions.put(updated);

  try {
    const note = await generateAutonomousCareNote({
      chatId: companion.chatId,
      chat,
      character,
      companion: updated,
    });

    await db.companionLogs.add({
      companionId,
      logType: 'co_care',
      actionType: 'co_care',
      content: note,
      timestamp: now,
    });
  } catch (error) {
    console.error('[Companion] 自主照顾日志生成失败:', error);
  }
};

/*
 * c：定时巡检，多久没人互动就有概率让角色自己去看看。
 *
 * 刻意复用已有的调度器（scheduledMessageService.js 里"每 60 秒 + 切回
 * 前台"那一个），不新增 setInterval/监听器——见启动包第 1 节的要求。
 * 全程 try/catch，任何一步失败都不应该影响预约消息本身的处理。
 */
export const checkCompanionsForNeglect = async () => {
  try {
    const companions = await db.companions.toArray();
    const now = Date.now();

    for (const companion of companions) {
            if (isCompanionSleeping(companion, now)) continue;
      if (hoursSince(companion.lastInteractionAt, now) < AUTO_CARE_NEGLECT_HOURS) continue;
      if (hoursSince(companion.lastAutoCareRollAt, now) < AUTO_CARE_ROLL_COOLDOWN_HOURS) continue;
      if (hoursSince(companion.lastAutoCareAt, now) < AUTO_CARE_MIN_GAP_HOURS) continue;

      await db.companions.update(companion.id, { lastAutoCareRollAt: now });

      if (Math.random() < AUTO_CARE_NEGLECT_PROBABILITY) {
        await triggerCompanionAutonomousCare(companion.id);
      }
    }
  } catch (error) {
    console.error('[Companion] 定时巡检失败:', error);
  }
};

// ---- 商店：购买食物（买 = 立即喂）/ 购买衣服（永久拥有，可穿脱）----

export const getInventory = async (companionId) => (
  db.companionInventory.where('companionId').equals(companionId).toArray()
);

export const buyShopItem = async (companionId, itemId) => {
  const item = findShopItem(itemId);
  if (!item) throw new Error('商品不存在');

  const companion = await db.companions.get(companionId);
  if (!companion) throw new Error('小伙伴不存在');

  const now = Date.now();

  if (item.category === 'food') {
    if (item.tier === FOOD_TIERS.LEGENDARY) {
      // 传说食物不能用心心买，只能靠事件获得——走 useLegendaryFood。
      throw new Error('这是传说食物，只能靠特殊事件获得，不能直接购买哦。');
    }
    if (item.tier === FOOD_TIERS.RARE && !(companion.unlockedRareFoodIds || []).includes(item.id)) {
      throw new Error('这件稀有食物还没解锁，先触发对应的特殊事件吧。');
    }
    if (companion.hearts < item.price) {
      throw new Error('心心不够啦');
    }

    await db.companions.update(companionId, {
      hearts: Math.round((companion.hearts - item.price) * 10) / 10,
      updatedAt: now,
    });
    await addToBackpack(companionId, item.id, 'food');
    await db.companionLogs.add({
      companionId,
      logType: 'user_action',
      actionType: 'shop_food',
      content: `在商店买了「${item.name}」，放进了背包。`,
      timestamp: now,
    });
    await recordTaskEvent(companionId, 'shop_buy'); // 每日任务：去商店买一件东西
    return await db.companions.get(companionId);
  }

  if (item.category === 'clean' || item.category === 'toy') {
    const unlockedField = item.category === 'clean' ? 'unlockedRareCleanIds' : 'unlockedRareToyIds';
    if (item.tier === FOOD_TIERS.RARE && !(companion[unlockedField] || []).includes(item.id)) {
      throw new Error('这件稀有道具还没解锁，先触发对应的特殊事件吧。');
    }
    if (companion.hearts < item.price) {
      throw new Error('心心不够啦');
    }

    await db.companions.update(companionId, {
      hearts: Math.round((companion.hearts - item.price) * 10) / 10,
      updatedAt: now,
    });
    await addToBackpack(companionId, item.id, item.category);
    await db.companionLogs.add({
      companionId,
      logType: 'user_action',
      actionType: item.category === 'clean' ? 'shop_clean' : 'shop_toy',
      content: `在商店买了「${item.name}」，放进了背包。`,
      timestamp: now,
    });
    await recordTaskEvent(companionId, 'shop_buy'); // 每日任务：去商店买一件东西
    return await db.companions.get(companionId);
  }

  if (item.category === 'scene') {
    const owned = await db.companionInventory.where({ companionId, category: 'scene' }).toArray();
    if (owned.some((row) => row.itemId === itemId)) {
      throw new Error('这个场景已经解锁了');
    }
    if (companion.hearts < item.price) {
      throw new Error('心心不够啦');
    }

    await db.companions.update(companionId, {
      hearts: Math.round((companion.hearts - item.price) * 10) / 10,
      updatedAt: now,
    });
    await db.companionInventory.add({
      companionId,
      itemId,
      category: 'scene',
      acquiredAt: now,
    });
    await db.companionLogs.add({
      companionId,
      logType: 'user_action',
      actionType: 'shop_scene',
      content: `解锁了新场景「${item.label}」。`,
      timestamp: now,
    });
    await recordTaskEvent(companionId, 'shop_buy'); // 每日任务：去商店买一件东西
    return await db.companions.get(companionId);
  }

  // 衣服：先查是否已拥有，拥有就不重复购买/扣费。
  if (companion.hearts < item.price) {
    throw new Error('心心不够啦');
  }

  const owned = await db.companionInventory
    .where({ companionId, category: 'clothing' })
    .toArray();

  if (owned.some((row) => row.itemId === itemId)) {
    throw new Error('已经拥有这件了');
  }

  await db.companions.update(companionId, {
    hearts: Math.round((companion.hearts - item.price) * 10) / 10,
    updatedAt: now,
  });

  await db.companionInventory.add({
    companionId,
    itemId,
    category: 'clothing',
    acquiredAt: now,
  });

  await db.companionLogs.add({
    companionId,
    logType: 'user_action',
    actionType: 'shop_clothing',
    content: `在商店买了「${item.name}」。`,
    timestamp: now,
  });

  await recordTaskEvent(companionId, 'shop_buy'); // 每日任务：去商店买一件东西
  return await db.companions.get(companionId);
};

/*
 * 吃一份传说食物：只能从 companion.legendaryStock 里消耗（不扣心心），
 * 存量不够就报错。grantHearts/triggersRandomEvent 是两个特殊食物
 * （彩虹蜂蜜蛋糕、幸运饼干）的额外效果，见 companionShopData.js 里的注释。
 */
export const useLegendaryFood = async (companionId, foodId) => {
  const item = findShopItem(foodId);
  if (!item || item.tier !== FOOD_TIERS.LEGENDARY) throw new Error('这不是传说食物');

  const companion = await db.companions.get(companionId);
  if (!companion) throw new Error('小伙伴不存在');

  const stock = companion.legendaryStock || {};
  if (!stock[foodId] || stock[foodId] <= 0) {
    throw new Error('这份传说食物还没有，等事件触发吧。');
  }

  const now = Date.now();
  const effects = item.effects || {};
  const nextStock = { ...stock, [foodId]: stock[foodId] - 1 };

  const updated = {
    ...companion,
    legendaryStock: nextStock,
    satiety: clamp100(companion.satiety + (effects.satiety || 0)),
    mood: clamp100(companion.mood + (effects.mood || 0)),
    hearts: Math.round(((companion.hearts || 0) + (item.grantHearts || 0)) * 10) / 10,
    lastInteractionAt: now,
    updatedAt: now,
    feedCount: (companion.feedCount || 0) + 1,
    totalInteractionCount: (companion.totalInteractionCount || 0) + 1,
  };

  await db.companions.put(updated);
  await db.companionLogs.add({
    companionId,
    logType: 'user_action',
    actionType: 'use_legendary_food',
    content: `吃掉了传说食物「${item.name}」！`,
    timestamp: now,
  });

  return updated;
};

export const equipOutfit = async (companionId, itemNameOrNull) => {
  await db.companions.update(companionId, {
    equippedOutfit: itemNameOrNull,
    updatedAt: Date.now(),
  });
  return await db.companions.get(companionId);
};

// ---- 日志 ----

export const getRecentLogs = async (companionId, limit = 30) => (
  db.companionLogs
    .where('companionId')
    .equals(companionId)
    .reverse()
    .sortBy('timestamp')
    .then((rows) => rows.slice(0, limit))
);