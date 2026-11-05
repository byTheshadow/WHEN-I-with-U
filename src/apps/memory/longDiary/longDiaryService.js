// src/apps/memory/longDiary/longDiaryService.js
//
// 长期日记：用户指定一个聊天 + 一段日期范围，让角色以自己的视角写一篇连续长文，
// 既写角色观察到的用户，也写角色自己。
//
// 素材三路（只读，不改动任何已有数据）：
//   1. 聊天记录：db.messages + db.archivedMessages（归档是物理搬走，所以两张表都要查）
//   2. 记忆条目：db.memories 里这段时间内生成的生效中/暂时记录条目
//   3. 心情打卡：只借用心情日历的数据（db.companionMoods）。心情日历的记录是按小伙伴 id
//      存的，所以要先通过 db.companions 的 chatId 查到这个聊天对应的 id 才能取到，仅此而已；
//      小伙伴的日记、状态、喂养记录、事件等其它内容一概不读，也不会写进日记。
//      这个聊天没有打过心情卡，就直接略过，不影响生成。
//
// 流程：先逐天压缩（每天一次小调用，把当天素材压成几行要点），再把所有天的要点
// 一次性写成长文。某一天的压缩失败不会中断整个流程，退回用截断后的原始素材。
//
// 结果存进 db.longDiaries（db.version(109)）。paragraphs 是
// [{ who: 'char' | 'user', text }]，who 只用于排版时区分"角色自己"和"角色观察到的你"。

import db from '../../../db';
import { generateResponse } from '../../../services/aiService';

export const MAX_RANGE_DAYS = 31;

const MAX_MESSAGES_PER_DAY = 120;
const MAX_MESSAGE_CHARS = 120;
const MAX_MEMORIES_PER_DAY = 12;
const CHARS_PER_DAY = 200;
const MIN_TARGET_CHARS = 400;
const MAX_TARGET_CHARS = 3000;

const MOOD_LABELS = {
  happy: '开心',
  calm: '平静',
  sad: '难过',
  surprised: '惊讶',
  angry: '生气',
};

const pad2 = (value) => String(value).padStart(2, '0');

export const toDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// 'YYYY-MM-DD' -> 本地时区当天 00:00
const parseDateStr = (dateStr) => {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};

export const listDatesInRange = (startDate, endDate) => {
  const result = [];
  const cursor = parseDateStr(startDate);
  const end = parseDateStr(endDate);

  while (cursor.getTime() <= end.getTime() && result.length <= MAX_RANGE_DAYS + 1) {
    result.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
};

export const validateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return '请先选好开始和结束日期。';

  const start = parseDateStr(startDate);
  const end = parseDateStr(endDate);

  if (end.getTime() < start.getTime()) return '结束日期不能早于开始日期。';

  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  if (days > MAX_RANGE_DAYS) {
    return `一次最多 ${MAX_RANGE_DAYS} 天，请分段生成。`;
  }

  if (end.getTime() > Date.now()) return '结束日期不能是未来。';

  return '';
};

/* ------------------------------------------------------------------
 * 存取
 * ------------------------------------------------------------------ */

export const listLongDiaries = async (chatId) => {
  if (!chatId) return [];

  const rows = await db.longDiaries.where('chatId').equals(chatId).toArray();
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const deleteLongDiary = async (id) => {
  if (!id) return;
  await db.longDiaries.delete(id);
};

/* ------------------------------------------------------------------
 * 素材
 * ------------------------------------------------------------------ */

const getMessageText = (message) => {
  if (!message) return '';

  const versions = Array.isArray(message.versions) ? message.versions : null;
  const index = Number.isInteger(message.currentVersionIndex) ? message.currentVersionIndex : 0;
  const fromVersion = versions && versions[index] ? versions[index].content : '';
  const raw = fromVersion || message.content || '';

  return String(raw).replace(/\s+/g, ' ').trim();
};

const isUsableMessage = (message, text) => {
  if (!text) return false;
  if (message.type === 'error') return false;

  // 小伙伴（宠物）功能会往聊天里插几类消息：事件开场白/结果（metadata.companionEventId）、
  // 状态提醒、领养邀请（type 以 companion_ 开头）。这些属于小伙伴，不是角色和用户之间的
  // 对话，长期日记不收。
  if (typeof message.type === 'string' && message.type.startsWith('companion_')) return false;
  if (message.metadata && message.metadata.companionEventId) return false;

  return ['user', 'character', 'ai', 'assistant'].includes(message.sender);
};

const sampleEvenly = (items, limit) => {
  if (items.length <= limit) return items;

  const picked = [];
  const step = items.length / limit;

  for (let i = 0; i < limit; i += 1) {
    picked.push(items[Math.floor(i * step)]);
  }

  return picked;
};

const loadMessagesInRange = async (chatId, startDate, endDate) => {
  const from = parseDateStr(startDate).toISOString();
  const endExclusive = parseDateStr(endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const to = endExclusive.toISOString();

  const range = (table) => table
    .where('[chatId+timestamp]')
    .between([chatId, from], [chatId, to], true, false)
    .toArray();

  const [live, archived] = await Promise.all([
    range(db.messages),
    db.archivedMessages ? range(db.archivedMessages) : Promise.resolve([]),
  ]);

  return [...live, ...archived].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
};

const loadMemoriesInRange = async (chatId, startDate, endDate) => {
  const start = parseDateStr(startDate).getTime();
  const endExclusive = parseDateStr(endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const end = endExclusive.getTime();

  const rows = await db.memories.where('chatId').equals(chatId).toArray();

  return rows.filter((memory) => {
    if (memory.status !== 'active' && memory.status !== 'temporary') return false;
    const time = new Date(memory.createdAt || 0).getTime();
    return time >= start && time < end;
  });
};

const loadMoodsInRange = async (chatId, startDate, endDate) => {
  const companion = await db.companions.where('chatId').equals(chatId).first();

  if (!companion) return {};

  const rows = await db.companionMoods
    .where('companionId')
    .equals(companion.id)
    .filter((row) => row.date >= startDate && row.date <= endDate)
    .toArray();

  const byDate = {};
  rows.forEach((row) => { byDate[row.date] = row; });
  return byDate;
};

const buildDayMaterial = ({ date, messages, memories, mood, userName, charName }) => {
  const lines = [];

  if (mood && (mood.userMood || mood.charMood)) {
    const parts = [];
    if (mood.userMood) parts.push(`${userName}自己打卡的心情：${MOOD_LABELS[mood.userMood] || mood.userMood}`);
    if (mood.charMood) parts.push(`${charName}当天的心情：${MOOD_LABELS[mood.charMood] || mood.charMood}`);
    lines.push(`[心情打卡] ${parts.join('；')}`);
  }

  memories.slice(0, MAX_MEMORIES_PER_DAY).forEach((memory) => {
    const text = String(memory.content || '').replace(/\s+/g, ' ').trim();
    if (text) lines.push(`[记忆] ${text.slice(0, 160)}`);
  });

  const usable = messages
    .map((message) => ({ message, text: getMessageText(message) }))
    .filter(({ message, text }) => isUsableMessage(message, text));

  const sampled = sampleEvenly(usable, MAX_MESSAGES_PER_DAY);

  sampled.forEach(({ message, text }) => {
    const time = new Date(message.timestamp);
    const clock = `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
    const who = message.sender === 'user' ? userName : charName;
    lines.push(`[${clock}] ${who}：${text.slice(0, MAX_MESSAGE_CHARS)}`);
  });

  return {
    date,
    messageCount: usable.length,
    hasMaterial: lines.length > 0,
    text: lines.join('\n'),
  };
};

/* ------------------------------------------------------------------
 * 生成
 * ------------------------------------------------------------------ */

const DIGEST_SYSTEM = [
  '你是一个整理素材的助手。下面是某一天里，一位角色和用户之间的聊天片段、记忆条目和心情打卡。',
  '请用 4 到 8 行要点概括这一天：用户做了什么、说了什么、情绪怎样；角色自己做了什么、想了什么；两人之间有哪些值得记住的小细节或原话。',
  '只写素材里有的内容，不要编造；保留有代表性的原话片段；不要使用表情符号。每行以“- ”开头，直接输出要点，不要写前言。',
].join('\n');

const buildDiarySystem = ({ character, charName, userName, targetChars }) => {
  const persona = String(character?.bio || '').trim().slice(0, 600);

  return [
    `你就是${charName}。现在要以你自己的口吻，写一篇回顾这段时间的日记，记录你眼中的${userName}，也记录你自己。`,
    persona ? `你的人物设定：\n${persona}` : '',
    '写作要求：',
    `- 用第一人称“我”，称呼对方为“你”。全文是一篇连续的散文，不要按天分小标题，不要出现“第几天”“某月某日”这样的流水账开头，需要时可以在行文中自然带出日期或星期。`,
    '- 一部分段落写“我观察到的你”：你那些天做了什么、情绪怎样、哪些细节被你悄悄记在心里。另一部分段落写“我自己”：你当时的心思、犹豫、没说出口的话。两类段落自然交替出现。',
    '- 只依据给出的素材写，素材里没有的事不要编造；可以对心情和动机做合理的感受性描写，但不要写成确凿的事实。',
    '- 不要使用表情符号，不要使用 markdown 符号。',
    `- 篇幅约 ${targetChars} 字。`,
    '- 排版格式：每个段落单独占一行，段落之间空一行。每个段落最前面加一个标记：写“我观察到的你”的段落以 [U] 开头，写“我自己”的段落以 [C] 开头。标记之后直接接正文。',
    '直接输出日记正文，不要写标题和前后说明。',
  ].filter(Boolean).join('\n');
};

export const parseDiaryParagraphs = (rawText) => {
  const blocks = String(rawText || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const match = block.match(/^\[(U|C)\]\s*/i);
    const who = match && match[1].toUpperCase() === 'U' ? 'user' : 'char';
    const text = block.replace(/^\[(U|C)\]\s*/i, '').replace(/\[(U|C)\]/gi, '').trim();
    return { who, text };
  }).filter((paragraph) => paragraph.text);
};

const callWithRetry = async (messages) => {
  try {
    return await generateResponse(messages);
  } catch (firstError) {
    return generateResponse(messages);
  }
};

/**
 * 生成并保存一篇长期日记。
 * onProgress(text) 用来给界面显示进度；shouldCancel() 返回 true 时在两次调用之间停下。
 */
export const generateLongDiary = async ({
  chatId,
  startDate,
  endDate,
  onProgress,
  shouldCancel,
}) => {
  const rangeError = validateRange(startDate, endDate);
  if (rangeError) throw new Error(rangeError);

  const chat = await db.chats.get(chatId);
  if (!chat) throw new Error('找不到这个聊天。');

  const character = chat.characterId ? await db.characters.get(chat.characterId) : null;
  const profile = await db.profile.toCollection().first();

  const charName = character?.name || '我';
  const userName = chat.userName || character?.userName || profile?.name || '你';

  onProgress?.('正在整理素材……');

  const [allMessages, memories, moods] = await Promise.all([
    loadMessagesInRange(chatId, startDate, endDate),
    loadMemoriesInRange(chatId, startDate, endDate),
    loadMoodsInRange(chatId, startDate, endDate),
  ]);

  const dates = listDatesInRange(startDate, endDate);

  const messagesByDate = {};
  allMessages.forEach((message) => {
    const key = toDateStr(message.timestamp);
    (messagesByDate[key] = messagesByDate[key] || []).push(message);
  });

  const memoriesByDate = {};
  memories.forEach((memory) => {
    const key = toDateStr(memory.createdAt);
    (memoriesByDate[key] = memoriesByDate[key] || []).push(memory);
  });

  const dayMaterials = dates
    .map((date) => buildDayMaterial({
      date,
      messages: messagesByDate[date] || [],
      memories: memoriesByDate[date] || [],
      mood: moods[date],
      userName,
      charName,
    }))
    .filter((day) => day.hasMaterial);

  if (dayMaterials.length === 0) {
    throw new Error('这段日期里没有找到聊天记录、记忆或心情打卡，换一个范围试试。');
  }

  // 1. 逐天压缩
  const digests = [];

  for (let i = 0; i < dayMaterials.length; i += 1) {
    if (shouldCancel?.()) throw new Error('已取消。');

    const day = dayMaterials[i];
    onProgress?.(`正在回顾 ${day.date}（${i + 1}/${dayMaterials.length}）……`);

    let digest = '';

    try {
      digest = await callWithRetry([
        { role: 'system', content: DIGEST_SYSTEM },
        { role: 'user', content: `日期：${day.date}\n\n${day.text}` },
      ]);
    } catch (error) {
      console.warn('[LongDiary] 单日压缩失败，退回使用截断后的原始素材:', day.date, error);
    }

    digests.push({
      date: day.date,
      text: String(digest || '').trim() || day.text.slice(0, 900),
    });
  }

  if (shouldCancel?.()) throw new Error('已取消。');

  // 2. 统一成文
  onProgress?.('正在落笔……');

  const targetChars = Math.max(
    MIN_TARGET_CHARS,
    Math.min(MAX_TARGET_CHARS, dates.length * CHARS_PER_DAY),
  );

  const digestText = digests
    .map((item) => `【${item.date}】\n${item.text}`)
    .join('\n\n');

  const raw = await callWithRetry([
    { role: 'system', content: buildDiarySystem({ character, charName, userName, targetChars }) },
    {
      role: 'user',
      content: `以下是 ${startDate} 到 ${endDate} 每天的要点，请据此写日记：\n\n${digestText}`,
    },
  ]);

  const paragraphs = parseDiaryParagraphs(raw);

  if (paragraphs.length === 0) throw new Error('这次没有生成出内容，请再试一次。');

  const text = paragraphs.map((paragraph) => paragraph.text).join('\n\n');

  const record = {
    chatId,
    characterId: chat.characterId || null,
    characterName: charName,
    userName,
    startDate,
    endDate,
    dayCount: dates.length,
    activeDayCount: dayMaterials.length,
    paragraphs,
    text,
    charCount: Array.from(text).length,
    createdAt: new Date().toISOString(),
  };

  const id = await db.longDiaries.add(record);

  return { ...record, id };
};

/* ------------------------------------------------------------------
 * 导出 txt
 * ------------------------------------------------------------------ */

export const buildDiaryTxt = (diary) => {
  const head = [
    `${diary.characterName} 的日记`,
    `${diary.startDate} 至 ${diary.endDate}`,
    '',
  ];

  return `${head.join('\n')}\n${diary.text}\n`;
};

export const downloadDiaryTxt = (diary) => {
  const blob = new Blob([buildDiaryTxt(diary)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `日记_${diary.characterName}_${diary.startDate}_${diary.endDate}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};