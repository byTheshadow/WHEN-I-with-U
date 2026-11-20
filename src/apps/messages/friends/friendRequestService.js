// src/apps/messages/friends/friendRequestService.js
//
// 【新建文件说明】好友申请（角色的朋友来加你）· 切片 A：数据读写、计数、名额判断。
//
// 数据放哪（都不建索引、不升 db 版本，跟小伙伴的 friendInbox 同一种写法）：
//   - 角色介绍来的申请：挂在介绍人角色那条记录上
//       characters.friendRequests      申请数组
//       characters.friendRequestMeta   { dailyDate, dailyCount, blockedUntil }
//       characters.friendIntroEnabled  这位角色能不能介绍朋友（没设置过按"能"算，受总开关约束）
//   - 朋友自己来的申请（没有介绍人）：存在 db.settings 里一条记录，键名见 GLOBAL_STATE_KEY，
//       结构 { requests: [], meta: { dailyDate, dailyCount, blockedUntil } }
//   - 总开关"允许角色介绍朋友"：db.settings 的 FRIEND_SWITCH_KEY，默认关
//
// 申请一项：id、alias、openingLine、introReason、hidden{realName,relation,personality,speechStyle}、
//   avatarId、status(pending/accepted/declined/expired)、sourceMessageId、createdAt、decidedAt
//
// 这个文件只依赖 db，不 import 任何 aiService，避免循环引用。
// 切片 A 不含：AI 生成（B）、自来的触发（B2）、通过/拒绝后的聊天回写、拒绝冷却、好友名片落库（C）。
//
import db from '../../../db';

// ====== 数值常量（以后想调手感，只改这里） ======
export const FRIEND_OPEN_MAX = 3; // 每个来源同时最多挂几封未处理
export const FRIEND_DAILY_CAP = 3; // 每个来源每天最多来几封（按本地日期换天）
export const FRIEND_DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 被拒绝后多久不再来（C 切片才会写入）
export const FRIEND_HISTORY_LIMIT = 12; // 已处理的申请保留多少条
export const FRIEND_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 未处理超过多久变「错过」

const GLOBAL_STATE_KEY = 'friendRequestsGlobal';
export const FRIEND_SWITCH_KEY = 'friendIntroEnabled';

// ====== 小工具 ======
const pad2 = (n) => String(n).padStart(2, '0');

const localDateKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const makeId = () => `fr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const emptyMeta = () => ({ dailyDate: '', dailyCount: 0, blockedUntil: 0 });

/**
 * 申请此刻的"有效状态"：pending 超过 FRIEND_EXPIRE_MS 就当作 expired（不用定时器，读的时候算）。
 */
export const getRequestStatus = (req, now = Date.now()) => {
  const status = req?.status || 'pending';
  if (status === 'pending' && now - (req?.createdAt || 0) > FRIEND_EXPIRE_MS) return 'expired';
  return status;
};

const countOpen = (list, now) =>
  (Array.isArray(list) ? list : []).filter((r) => getRequestStatus(r, now) === 'pending').length;

/**
 * 红点用：从已经加载好的角色数组 + 全局状态里数 pending（已过期的不算）。
 * 纯计算，不查库。
 */
export const countPendingFriendRequests = (characters, globalState, now = Date.now()) => {
  let total = 0;
  for (const c of Array.isArray(characters) ? characters : []) {
    total += countOpen(c?.friendRequests, now);
  }
  total += countOpen(globalState?.requests, now);
  return total;
};

// ====== 自来的申请：全局存放 ======
export const getGlobalFriendState = async () => {
  try {
    const row = await db.settings.get(GLOBAL_STATE_KEY);
    const v = row?.value;
    return {
      requests: Array.isArray(v?.requests) ? v.requests : [],
      meta: { ...emptyMeta(), ...(v?.meta || {}) }
    };
  } catch (err) {
    console.error('[friendRequestService] 读取自来的申请失败:', err);
    return { requests: [], meta: emptyMeta() };
  }
};

const saveGlobalFriendState = async (state) => {
  await db.settings.put({ key: GLOBAL_STATE_KEY, value: state });
};

// ====== 开关 ======
/** 总开关"允许角色介绍朋友"，没设置过按关闭算。 */
export const isFriendIntroEnabled = async () => {
  try {
    const row = await db.settings.get(FRIEND_SWITCH_KEY);
    return row?.value === true;
  } catch (err) {
    console.error('[friendRequestService] 读取总开关失败:', err);
    return false;
  }
};

export const setFriendIntroEnabled = async (on) => {
  await db.settings.put({ key: FRIEND_SWITCH_KEY, value: !!on });
};

export const setCharacterFriendIntro = async (characterId, on) => {
  await db.characters.update(Number(characterId), { friendIntroEnabled: !!on });
};

// ====== 名额判断（切片 B 会在提示词里用它决定"FRIEND_INTRO 这段话在不在"） ======
/**
 * owner: { requests, meta }。名额够不够：未处理不满上限、今天没到上限、不在拒绝冷却内。
 */
export const hasFriendQuota = (owner, now = Date.now()) => {
  if (countOpen(owner?.requests, now) >= FRIEND_OPEN_MAX) return false;

  const meta = owner?.meta || {};
  const todayCount = meta.dailyDate === localDateKey(now) ? meta.dailyCount || 0 : 0;
  if (todayCount >= FRIEND_DAILY_CAP) return false;

  if ((meta.blockedUntil || 0) > now) return false;
  return true;
};

/**
 * 这位角色现在能不能介绍朋友：总开关开、这位角色没被单独关掉、名额够。
 */
export const canCharacterIntroduce = (character, globalEnabled, now = Date.now()) => {
  if (!globalEnabled) return false;
  if (character?.friendIntroEnabled === false) return false;
  return hasFriendQuota(
    { requests: character?.friendRequests, meta: character?.friendRequestMeta },
    now
  );
};

// ====== 写入 ======
// 已处理的只留最近 FRIEND_HISTORY_LIMIT 条，未处理的全部保留。
const trimHistory = (list, now) => {
  const pending = [];
  const done = [];
  for (const r of list) {
    (getRequestStatus(r, now) === 'pending' ? pending : done).push(r);
  }
  done.sort((a, b) => (b.decidedAt || b.createdAt || 0) - (a.decidedAt || a.createdAt || 0));
  return [...pending, ...done.slice(0, FRIEND_HISTORY_LIMIT)].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
};

const buildRequest = (draft, now) => ({
  id: makeId(),
  alias: String(draft?.alias || '').trim() || '陌生人',
  openingLine: String(draft?.openingLine || '').trim(),
  introReason: String(draft?.introReason || '').trim(),
  source: String(draft?.source || '').trim(),
  hidden: {
    realName: String(draft?.hidden?.realName || '').trim(),
    relation: String(draft?.hidden?.relation || '').trim(),
    personality: String(draft?.hidden?.personality || '').trim(),
    speechStyle: String(draft?.hidden?.speechStyle || '').trim()
  },
  avatarId: draft?.avatarId ?? null,
  status: 'pending',
  sourceMessageId: draft?.sourceMessageId ?? null,
  createdAt: now,
  decidedAt: null
});

const bumpDaily = (meta, now) => {
  const today = localDateKey(now);
  const base = { ...emptyMeta(), ...(meta || {}) };
  const count = base.dailyDate === today ? base.dailyCount || 0 : 0;
  return { ...base, dailyDate: today, dailyCount: count + 1 };
};

/**
 * 新增一封申请。owner: { type: 'character', id } 或 { type: 'global' }。
 * 这里只负责写入，不判断名额——名额由调用方先用 hasFriendQuota / canCharacterIntroduce 判断。
 */
export const createFriendRequest = async (owner, draft, now = Date.now()) => {
  const req = buildRequest(draft, now);

  if (owner?.type === 'character') {
    const char = await db.characters.get(Number(owner.id));
    if (!char) return null;
    await db.characters.update(Number(owner.id), {
      friendRequests: trimHistory([req, ...(char.friendRequests || [])], now),
      friendRequestMeta: bumpDaily(char.friendRequestMeta, now)
    });
    return req;
  }

  const state = await getGlobalFriendState();
  await saveGlobalFriendState({
    requests: trimHistory([req, ...state.requests], now),
    meta: bumpDaily(state.meta, now)
  });
  return req;
};

/**
 * 通过 / 拒绝一封申请（切片 A 只改状态；身份揭晓后的聊天回写、拒绝冷却、名片落库是切片 C）。
 * item: loadFriendRequestItems 返回的一项。只有此刻仍是 pending 的才会改。
 */
export const decideFriendRequest = async (item, nextStatus, now = Date.now()) => {
  if (!item || (nextStatus !== 'accepted' && nextStatus !== 'declined')) return false;

  const apply = (list) => {
    let changed = false;
    const next = (Array.isArray(list) ? list : []).map((r) => {
      if (r.id === item.id && getRequestStatus(r, now) === 'pending') {
        changed = true;
        return { ...r, status: nextStatus, decidedAt: now };
      }
      return r;
    });
    return { changed, next: trimHistory(next, now) };
  };

  if (item.ownerType === 'character') {
    const char = await db.characters.get(Number(item.ownerId));
    if (!char) return false;
    const { changed, next } = apply(char.friendRequests);
    if (!changed) return false;
    await db.characters.update(Number(item.ownerId), { friendRequests: next });
    return true;
  }

  const state = await getGlobalFriendState();
  const { changed, next } = apply(state.requests);
  if (!changed) return false;
  await saveGlobalFriendState({ ...state, requests: next });
  return true;
};

// ====== 读取（申请页用） ======
/**
 * 读出所有申请（角色身上的 + 自来的），按时间新到旧。
 * 打开申请页时顺手把"超过 7 天还没处理"的写成 expired。
 * 每项在原申请字段之外多带 ownerType('character'|'global')、ownerId、ownerName。
 */
export const loadFriendRequestItems = async (now = Date.now()) => {
  const items = [];
  const jobs = [];

  const markExpired = (list) => {
    let changed = false;
    const next = list.map((r) => {
      if ((r.status || 'pending') === 'pending' && getRequestStatus(r, now) === 'expired') {
        changed = true;
        return { ...r, status: 'expired' };
      }
      return r;
    });
    return { changed, next };
  };

  try {
    const chars = await db.characters.toArray();
    for (const c of chars) {
      if (!Array.isArray(c.friendRequests) || c.friendRequests.length === 0) continue;
      const { changed, next } = markExpired(c.friendRequests);
      if (changed) jobs.push(db.characters.update(c.id, { friendRequests: next }));
      next.forEach((r) =>
        items.push({ ...r, ownerType: 'character', ownerId: c.id, ownerName: c.name || '某位角色' })
      );
    }

    const state = await getGlobalFriendState();
    if (state.requests.length > 0) {
      const { changed, next } = markExpired(state.requests);
      if (changed) jobs.push(saveGlobalFriendState({ ...state, requests: next }));
      next.forEach((r) => items.push({ ...r, ownerType: 'global', ownerId: null, ownerName: '' }));
    }

    await Promise.all(jobs);
  } catch (err) {
    console.error('[friendRequestService] 读取申请失败:', err);
  }

  return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

/**
 * 设置区用：总开关 + 每个角色的开关状态（工作助理不列出来）。
 */
export const loadFriendSettings = async () => {
  const globalEnabled = await isFriendIntroEnabled();
  let characters = [];
  try {
    const list = await db.characters.toArray();
    characters = list
      .filter((c) => c.isWorkAssistant !== true)
      .map((c) => ({ id: c.id, name: c.name || '未命名角色', enabled: c.friendIntroEnabled !== false }));
  } catch (err) {
    console.error('[friendRequestService] 读取角色开关失败:', err);
  }
  return { globalEnabled, characters };
};

// ====== 临时测试入口（切片 B 做完 AI 生成后可以删掉） ======
const TEST_POOL = [
  {
    alias: '阿遥',
    openingLine: '听说你，想认识一下。',
    introReason: '觉得你们应该聊得来。',
    hidden: { realName: '周遥', relation: '大学室友，毕业后一直保持联系。', personality: '话不多，但很会观察，嘴上不饶人。', speechStyle: '短句、爱用反问，偶尔冒出一句冷幽默。' }
  },
  {
    alias: '何老师',
    openingLine: '常听人提起你，我也想打个招呼。',
    introReason: '想让你认识一下。',
    hidden: { realName: '何柏', relation: '以前的同事，现在偶尔一起吃饭。', personality: '稳重，爱照顾人，有点爱操心。', speechStyle: '说话慢，爱用"嗯，我想想"开头。' }
  },
  {
    alias: '岚',
    openingLine: '路过这里，觉得你应该是个有趣的人。',
    introReason: '',
    hidden: { realName: '岚', relation: '在街角认识的陌生人。', personality: '随性，好奇心重，坐不住。', speechStyle: '口语化，爱用感叹句，语速很快。' }
  }
];

/**
 * 写入一封测试申请。owner: { type: 'character', id } 或 { type: 'global' }。
 * 不检查名额（方便反复测试）。
 */
export const createTestFriendRequest = async (owner) => {
  const pick = TEST_POOL[Math.floor(Math.random() * TEST_POOL.length)];
  const draft = owner?.type === 'global' ? { ...pick, introReason: '' } : pick;
  return createFriendRequest(owner, draft);
};

export default {
  getRequestStatus,
  countPendingFriendRequests,
  getGlobalFriendState,
  isFriendIntroEnabled,
  setFriendIntroEnabled,
  setCharacterFriendIntro,
  hasFriendQuota,
  canCharacterIntroduce,
  createFriendRequest,
  decideFriendRequest,
  loadFriendRequestItems,
  loadFriendSettings,
  createTestFriendRequest
};