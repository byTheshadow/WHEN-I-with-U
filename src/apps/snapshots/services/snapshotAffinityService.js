// src/apps/snapshots/services/snapshotAffinityService.js
//
// 【新建文件说明】
// snapshot 里 NPC 对用户的「友谊向好感值」。
//
// 设计要点（都是跟用户确认过的）：
// 1. 好感值完全隐藏，用户看不到数字也看不到档位，只能从 NPC 的态度变化里感觉出来。
// 2. 数据直接挂在 db.snapshotNpcs 记录上，用「不建索引」的普通新字段，
//    不升级 db 版本（跟 personaSummary 是同一种写法）：
//      affinity        当前好感值（0-99，没有这个字段的老 NPC 按初始值 10 算）
//      affinityLastAt  最后一次用户互动的时间戳（用来算冷落回落）
//      affinityDayKey  当前"每日计数"所属的本地日期（YYYY-MM-DD）
//      affinityDayGain 这一天这个 NPC 已经涨了多少（用来卡每日上限）
// 3. 冷落回落不用定时器：读取/写入时按"距上次互动过了几天"惰性计算。
// 4. 这个文件只依赖 db，不要 import snapshotAiService / snapshotNpcService，
//    否则会跟它们形成循环引用（snapshotAiService 会反过来 import 这个文件）。
//
import db from '../../../db';

// ====== 数值常量（以后想调手感，只改这里） ======
export const AFFINITY_MIN = 0;
export const AFFINITY_MAX = 99;
export const AFFINITY_INITIAL = 10;

// 一次互动涨多少
export const AFFINITY_GAIN = { like: 1, comment: 3 };
// 每个 NPC 每天靠互动最多涨多少（连续互动奖励不占这个额度）
export const AFFINITY_DAILY_CAP = 8;
// 昨天也互动过、今天第一次互动时，额外 +1
export const AFFINITY_STREAK_BONUS = 1;
// 超过几天不理开始回落、每天掉多少、最低掉到哪（不会变回完全陌生）
export const AFFINITY_IDLE_DAYS = 7;
export const AFFINITY_DECAY_PER_DAY = 1;
export const AFFINITY_DECAY_FLOOR = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

// 档位：只用于给 AI 写态度提示、决定 @ 概率，不会展示给用户。
// max 是该档位的上限（含）。mentionChance 是 NPC 发动态时 @用户 的概率。
const TIERS = [
  {
    key: 'stranger',
    label: '陌生',
    max: 19,
    mentionChance: 0,
    hint: '你们只是点头之交，你对TA还不太熟。语气礼貌、克制、略带距离，不主动热络，不使用昵称或亲昵称呼，回应偏简短。'
  },
  {
    key: 'familiar',
    label: '眼熟',
    max: 39,
    mentionChance: 0,
    hint: '你对TA有点眼熟，偶尔会打个照面。语气友善但仍有分寸，可以随口接话，不会主动打听私事。'
  },
  {
    key: 'acquaintance',
    label: '熟人',
    max: 59,
    mentionChance: 0.15,
    hint: '你们已经算熟人，聊得来。语气自然放松，可以开轻松的玩笑，偶尔会问候TA的近况。'
  },
  {
    key: 'friend',
    label: '朋友',
    max: 79,
    mentionChance: 0.35,
    hint: '你们是相处不错的朋友。语气亲切随意，会主动打趣、关心TA的近况，记得TA的一些小习惯。'
  },
  {
    key: 'bestie',
    label: '好友',
    max: AFFINITY_MAX,
    mentionChance: 0.5,
    hint: '你们是很要好的朋友。语气亲近自然、不拘束，会惦记TA、愿意主动搭话，可以用熟络的称呼。'
  }
];

export const getAffinityTier = (value) => {
  const v = Number.isFinite(value) ? value : AFFINITY_INITIAL;
  return TIERS.find((t) => v <= t.max) || TIERS[TIERS.length - 1];
};

// ====== 日期工具（按本地日期换天） ======
const pad2 = (n) => String(n).padStart(2, '0');

const dayKeyOf = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const todayKey = (now) => dayKeyOf(new Date(now));

const yesterdayKey = (now) => {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return dayKeyOf(d);
};

const clamp = (v) => Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, v));

/**
 * 算出"此刻"这个 NPC 的有效好感值（已经扣掉冷落回落）。纯计算，不写库。
 * 没有 affinityLastAt（用户从没互动过）时不回落。
 * 已经低于回落下限的值不会被回落进一步拉低。
 */
export const getEffectiveAffinity = (npc, now = Date.now()) => {
  const base = Number.isFinite(npc?.affinity) ? npc.affinity : AFFINITY_INITIAL;
  if (!npc?.affinityLastAt) return base;

  const idleDays = Math.floor((now - npc.affinityLastAt) / DAY_MS) - AFFINITY_IDLE_DAYS;
  if (idleDays <= 0 || base <= AFFINITY_DECAY_FLOOR) return base;

  return Math.max(AFFINITY_DECAY_FLOOR, base - idleDays * AFFINITY_DECAY_PER_DAY);
};

/**
 * 用户对某个 NPC 做了一次互动（点赞它的动态 / 评论或回复它），涨好感。
 * kind: 'like' | 'comment'
 * 失败只打日志、不抛错——好感值是锦上添花，绝不能影响点赞/评论本身。
 */
export const addNpcAffinity = async (npcId, kind, now = Date.now()) => {
  if (npcId === null || npcId === undefined) return null;
  const gain = AFFINITY_GAIN[kind];
  if (!gain) return null;

  try {
    const npc = await db.snapshotNpcs.get(Number(npcId));
    if (!npc) return null;

    const today = todayKey(now);
    const before = getEffectiveAffinity(npc, now);

    const isNewDay = npc.affinityDayKey !== today;
    const gainedToday = isNewDay ? 0 : npc.affinityDayGain || 0;
    const streakBonus = isNewDay && npc.affinityDayKey === yesterdayKey(now) ? AFFINITY_STREAK_BONUS : 0;

    const room = Math.max(0, AFFINITY_DAILY_CAP - gainedToday);
    const applied = Math.min(gain, room);
    const after = clamp(before + applied + streakBonus);

    await db.snapshotNpcs.update(Number(npc.id), {
      affinity: after,
      affinityLastAt: now,
      affinityDayKey: today,
      affinityDayGain: gainedToday + applied
    });

    // 临时调试日志：用户界面里看不到好感值，验收时靠这行在控制台确认。
    // 调好手感之后可以直接删掉这一行。
    console.log(
      `[SnapshotAffinity] NPC(${npc.name}) ${kind}: ${before} -> ${after}（${getAffinityTier(after).label}）`
    );

    return { before, after, tier: getAffinityTier(after).key };
  } catch (err) {
    console.error('[snapshotAffinityService] 更新好感值失败:', err);
    return null;
  }
};

/**
 * 生成一小段"态度提示"，供 snapshotAiService 里 NPC 发帖/评论/回复的提示词使用。
 * 只写档位对应的态度，绝不写数字；并明确这是友谊，不带暧昧。
 * npcId 为空或查不到 NPC 时返回空字符串（提示词里就不多这一段）。
 */
export const buildAffinityHint = async (npcId) => {
  if (npcId === null || npcId === undefined) return '';
  try {
    const npc = await db.snapshotNpcs.get(Number(npcId));
    if (!npc) return '';
    const tier = getAffinityTier(getEffectiveAffinity(npc));
    return `【你与这位用户目前的熟络程度（内部设定，绝对不要在文字里提到"好感""等级""档位"之类的字眼）】
${tier.hint}
这只是朋友之间的亲疏，不要带恋爱或暧昧的暗示；仍然保持你自己的性格和说话风格，只是态度的亲疏随之变化。`;
  } catch (err) {
    console.error('[snapshotAffinityService] 生成态度提示失败:', err);
    return '';
  }
};

/**
 * NPC 发动态时，这一次要不要 @用户？按当前档位的概率掷一次。
 * 陌生/眼熟档概率为 0。
 */
export const rollMentionUser = async (npcId) => {
  if (npcId === null || npcId === undefined) return false;
  try {
    const npc = await db.snapshotNpcs.get(Number(npcId));
    if (!npc) return false;
    const { mentionChance } = getAffinityTier(getEffectiveAffinity(npc));
    return Math.random() < mentionChance;
  } catch (err) {
    console.error('[snapshotAffinityService] 判定 @用户 失败:', err);
    return false;
  }
};

export default {
  getAffinityTier,
  getEffectiveAffinity,
  addNpcAffinity,
  buildAffinityHint,
  rollMentionUser
};