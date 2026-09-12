import db from '../db';
import { generateResponse } from './aiService';

export const XINJI_TYPES = {
  ANNIVERSARY: 'anniversary',
  MOMENT: 'moment',
  WISH: 'wish',
};

const XINJI_SCAN_BATCH_SIZE = 120;

function buildReflectionPrompt({ character, recentMessages }) {
  const characterName = character?.name || 'TA';

  const transcript = recentMessages
    .map((m) => {
      const speaker = m.sender === 'user' ? (m.userName || '用户') : characterName;
      return `${speaker}: ${m.content}`;
    })
    .join('\n');

  return `你是「${characterName}」。请回顾你和用户最近的这段对话，看看有没有：

1. moment（重要瞬间）：某个让你印象深刻、想记住的时刻
2. anniversary（纪念日）：对你或用户有特殊意义的日子（比如认识多久、某个约定的日子）
3. wish（心愿）：你希望以后能和用户一起做的事

标准要严格一点，真正打动你的才记，宁可少记也不要硬凑。没有就返回空数组。

只输出 JSON 数组，不要输出任何其他文字或代码块标记，格式：
[
  {
    "type": "moment 或 anniversary 或 wish",
    "title": "一句话标题，不超过 12 个字",
    "content": "用你自己的语气写一两句话",
    "date": "YYYY-MM-DD，这件事对应的日期",
    "isRecurringYearly": false
  }
]

对话内容：
${transcript}`;
}

function safeParseJsonArray(rawText) {
  if (!rawText) return [];

  const cleaned = rawText
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[xinjiService] 解析 AI 返回内容失败:', error, rawText);
    return [];
  }
}

export async function runXinjiReflection({ chatId, characterId, character }) {
  const chat = await db.chats.get(chatId);
  if (!chat) return { added: 0 };

  const allMessages = await db.messages
    .where('chatId')
    .equals(chatId)
    .sortBy('timestamp');

  if (allMessages.length === 0) return { added: 0, reason: 'no-messages' };

  const lastScannedId = chat.lastXinjiScanMessageId || 0;
  const unscanned = allMessages.filter((m) => m.id > lastScannedId);

  if (unscanned.length === 0) {
    return { added: 0, reason: 'no-new-messages' };
  }

  const recentMessages = unscanned.slice(-XINJI_SCAN_BATCH_SIZE);
  const prompt = buildReflectionPrompt({ character, recentMessages });

  let rawText = '';
  try {
    rawText = await generateResponse([{ role: 'user', content: prompt }]);
  } catch (error) {
    console.error('[xinjiService] 回顾对话失败:', error);
    return { added: 0, error };
  }

  const items = safeParseJsonArray(rawText);

  const existing = await db.xinjiEntries.where('chatId').equals(chatId).toArray();
  const existingKeys = new Set(existing.map((item) => `${item.type}|${item.title}|${item.date}`));

  let added = 0;

  for (const item of items) {
    if (!item?.title || !item?.type) continue;

    const key = `${item.type}|${item.title}|${item.date}`;
    if (existingKeys.has(key)) continue;

    await db.xinjiEntries.add({
      chatId,
      characterId,
      type: Object.values(XINJI_TYPES).includes(item.type)
        ? item.type
        : XINJI_TYPES.MOMENT,
      title: String(item.title).slice(0, 30),
      content: String(item.content || '').slice(0, 200),
      date: item.date || new Date().toISOString().slice(0, 10),
      isRecurringYearly: Boolean(item.isRecurringYearly),
      createdAt: Date.now(),
    });

    existingKeys.add(key);
    added += 1;
  }

  await db.chats.update(chatId, {
    lastXinjiScanMessageId: allMessages[allMessages.length - 1].id,
    lastXinjiScanAt: Date.now(),
  });

  return { added };
}

export function getXinjiEntriesForChat(chatId) {
  return db.xinjiEntries.where('chatId').equals(chatId).reverse().sortBy('date');
}

export async function deleteXinjiEntry(entryId) {
  await db.xinjiEntries.delete(entryId);
}

export async function updateXinjiEntry(entryId, patch) {
  await db.xinjiEntries.update(entryId, patch);
}