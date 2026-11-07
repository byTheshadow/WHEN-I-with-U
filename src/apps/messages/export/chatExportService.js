// src/apps/messages/export/chatExportService.js
//
// 聊天记录导出（2026-11 新增）。
//
// 两个入口共用这一个文件：
// 1. ChatSettingsModal 里的"导出聊天记录"——导出还在聊天里的消息（db.messages）。
// 2. 存档室（ArchiveCabinetView）里的"导出存档记录"——导出已经归档的
//    消息（db.archivedMessages）。
// 两边靠 source 参数区分：'live' / 'archived'，其余逻辑完全一样。
//
// 导出格式：Markdown（给人读）和 JSON（保留完整结构，以后想做"导入
// 聊天记录"可以直接用）。
//
// 非纯文字消息（图片、语音、转账、卡片、系统通知条等）一律转成文字
// 标注，不打包图片/语音本体——文件小、手机上不会卡。JSON 里的 metadata
// 也会把 Blob 和超长的内嵌 data URL 去掉，只留一句"已省略"。
//
// 日期范围按"用户本地时区的自然日"算，起止日期都是包含的；两个日期都
// 留空就是导出全部。

import db from '../../../db';

export const EXPORT_SOURCES = {
  LIVE: 'live',
  ARCHIVED: 'archived',
};

const MEDIA_OMITTED_TEXT = '[内嵌媒体数据已省略]';
const MAX_INLINE_STRING_LENGTH = 1000;
const MAX_SANITIZE_DEPTH = 6;

/* ------------------------------------------------------------------
 * 小工具
 * ------------------------------------------------------------------ */

const toTimeMs = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  return new Date(value).getTime();
};

const pad2 = (n) => String(n).padStart(2, '0');

export const toLocalDayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const formatClock = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const formatFullDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${toLocalDayKey(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const buildRangeBounds = (startDate, endDate) => {
  const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
  const endMs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

  return {
    startMs: Number.isNaN(startMs) ? null : startMs,
    endMs: Number.isNaN(endMs) ? null : endMs,
  };
};

const sanitizeFilenamePart = (value) => (
  String(value || '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
);

/* ------------------------------------------------------------------
 * 读取聊天上下文（角色名 / 用户名）
 * ------------------------------------------------------------------ */

export const getExportContext = async (chatId) => {
  const chat = chatId ? await db.chats.get(chatId) : null;
  const character = chat?.characterId
    ? await db.characters.get(chat.characterId)
    : null;

  return {
    chatId,
    characterName: character?.name || chat?.title || '角色',
    userName: chat?.userName || character?.userName || '我',
  };
};

/* ------------------------------------------------------------------
 * 读取并筛选消息
 * ------------------------------------------------------------------ */

const getSourceTable = (source) => (
  source === EXPORT_SOURCES.ARCHIVED ? db.archivedMessages : db.messages
);

// timestamp 的具体类型（ISO 字符串 / 数字 / Date）在项目里没有完全统一，
// 所以这里不用 [chatId+timestamp] 复合索引做范围查询，而是按 chatId 取出
// 后在 JS 里统一转毫秒筛选——更稳，代价只是多读一点，导出是低频操作，可接受。
export const getMessagesForExport = async ({
  chatId,
  source = EXPORT_SOURCES.LIVE,
  startDate = '',
  endDate = '',
}) => {
  if (!chatId) return [];

  const table = getSourceTable(source);
  if (!table) return [];

  const { startMs, endMs } = buildRangeBounds(startDate, endDate);

  const rows = await table.where('chatId').equals(chatId).toArray();

  return rows
    .filter((message) => {
      if (!message || message.type === 'error') return false;

      const time = toTimeMs(message.timestamp);
      if (Number.isNaN(time)) return false;
      if (startMs !== null && time < startMs) return false;
      if (endMs !== null && time > endMs) return false;

      return true;
    })
    .sort((a, b) => toTimeMs(a.timestamp) - toTimeMs(b.timestamp));
};

/* ------------------------------------------------------------------
 * 消息 -> 文字
 * ------------------------------------------------------------------ */

const getCurrentVersion = (message) => {
  const versions = Array.isArray(message.versions) ? message.versions : [];
  if (versions.length === 0) return null;

  // 跟 MessageRow.jsx 的取法保持一致：没记录当前版本下标时，多版取最后
  // 一版，单版取第一版。
  const rawIndex = message.currentVersionIndex;
  const hasIndex = rawIndex !== null
    && rawIndex !== undefined
    && Number.isInteger(Number(rawIndex));
  const index = hasIndex
    ? Number(rawIndex)
    : (versions.length > 1 ? versions.length - 1 : 0);

  return versions[index] ?? null;
};

const versionToText = (version) => {
  if (version === null || version === undefined) return '';
  if (typeof version === 'string') return version;
  return String(version.content ?? version.text ?? version.message ?? '');
};

// 当前正在显示的那一版的原始文字（跟聊天界面看到的一致）。
export const getCurrentRawText = (message) => {
  const version = getCurrentVersion(message);
  const fromVersion = versionToText(version).trim();
  if (fromVersion) return fromVersion;
  return String(message?.content ?? '').trim();
};

// 当前版本的 metadata（版本里有就用版本的，没有退回消息本身的）。
const getCurrentMetadata = (message) => {
  const version = getCurrentVersion(message);
  if (version && typeof version === 'object' && version.metadata) {
    return { ...(message.metadata || {}), ...version.metadata };
  }
  return message.metadata || {};
};

const withNote = (label, note) => (
  note ? `[${label}：${note}]` : `[${label}]`
);

/**
 * 把一条消息转成"可读的文字"。纯文字消息原样返回；其余类型转成方括号
 * 标注。没有专门处理的类型（以后新增的卡片/系统条）会走兜底：有正文
 * 就用 "[type] 正文"，没有正文就只留 "[type]"，不会丢消息。
 */
export const describeMessageForExport = (message) => {
  const type = message?.type || 'text';
  const raw = getCurrentRawText(message);
  const meta = getCurrentMetadata(message);

  // 文字消息：学习模式下正文是外语，翻译存在 metadata.translationText，
  // 两个都留着，翻译放在后面，不丢信息。
  if (type === 'text') {
    if (meta.translationText && meta.translationText !== raw) {
      return `${raw}\n（翻译：${meta.translationText}）`;
    }
    return raw;
  }

  switch (type) {
    case 'sticker':
      return withNote('表情包', meta.name || raw);
    case 'image':
      return withNote('图片', raw);
    case 'image_generated':
      return withNote('生成的图片', raw);
    case 'photo': {
      const description = meta.visionStatus === 'done' ? meta.visionDescription : '';
      return withNote('照片', description || (meta.mediaCleared ? '原图已清理' : ''));
    }
    case 'voice':
      return withNote('语音', raw);
    case 'realVoice':
      return withNote('语音', raw || meta.transcript || '');
    case 'transfer':
      return withNote(
        `转账 ${meta.amount ?? ''} 元`.trim(),
        raw,
      );
    case 'gift':
      return withNote(`礼物 ${meta.name || ''}`.trim(), raw);
    case 'food':
      return withNote(`外卖 ${meta.item || ''}`.trim(), meta.note || raw);
    case 'kinship':
      return withNote('亲属卡', meta.amount ? `${meta.amount} 元额度` : raw);
    case 'location':
      return withNote('位置', meta.name || raw);
    case 'call':
      return withNote('通话', raw);
    case 'poke':
      return raw ? `[${raw}]` : '[戳了戳]';
    case 'interaction':
    case 'challenge_complete':
    case 'text_game_result':
      return raw ? `[${raw}]` : `[${type}]`;
    default:
      return raw ? `[${type}] ${raw}` : `[${type}]`;
  }
};

const getSenderName = (message, context) => {
  if (message.sender === 'user') return context.userName;
  if (message.sender === 'system') return '系统';
  return context.characterName;
};

/* ------------------------------------------------------------------
 * JSON 清洗：去掉 Blob 和超长内嵌数据
 * ------------------------------------------------------------------ */

const sanitizeForJson = (value, depth = 0) => {
  if (value === null || value === undefined) return value;

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return MEDIA_OMITTED_TEXT;
  }

  if (typeof value === 'string') {
    if (value.length > MAX_INLINE_STRING_LENGTH && value.startsWith('data:')) {
      return MEDIA_OMITTED_TEXT;
    }
    return value;
  }

  if (typeof value !== 'object') return value;

  if (value instanceof Date) return value.toISOString();

  if (depth >= MAX_SANITIZE_DEPTH) return '[层级过深已省略]';

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJson(item, depth + 1));
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = sanitizeForJson(item, depth + 1);
  }
  return result;
};

/* ------------------------------------------------------------------
 * 构建文件内容
 * ------------------------------------------------------------------ */

const buildRangeLabel = (startDate, endDate) => {
  if (!startDate && !endDate) return '全部';
  return `${startDate || '最早'} 至 ${endDate || '最新'}`;
};

const sourceLabel = (source) => (
  source === EXPORT_SOURCES.ARCHIVED ? '存档室' : '聊天'
);

export const buildMarkdown = ({
  messages,
  context,
  source,
  startDate,
  endDate,
}) => {
  const lines = [
    `# 与 ${context.characterName} 的${sourceLabel(source)}记录`,
    '',
    `- 导出时间：${formatFullDateTime(new Date())}`,
    `- 范围：${buildRangeLabel(startDate, endDate)}`,
    `- 消息数：${messages.length}`,
    '',
  ];

  const messageById = new Map(messages.map((message) => [message.id, message]));
  let currentDay = '';

  for (const message of messages) {
    const dayKey = toLocalDayKey(message.timestamp);

    if (dayKey !== currentDay) {
      currentDay = dayKey;
      lines.push(`## ${dayKey}`, '');
    }

    const name = getSenderName(message, context);
    const clock = formatClock(message.timestamp);
    const autoReplyPrefix = message.metadata?.autoReply ? '[自动回复] ' : '';
    const text = describeMessageForExport(message);

    lines.push(`**${name}** ${clock}`);

    const quoted = message.quotedMessageId
      ? messageById.get(message.quotedMessageId)
      : null;

    if (quoted) {
      const quotedText = describeMessageForExport(quoted).replace(/\s+/g, ' ');
      const clipped = quotedText.length > 60
        ? `${quotedText.slice(0, 60)}...`
        : quotedText;
      // 引用块后面空一行，不然 Markdown 会把下一行正文也吞进引用里。
      lines.push(`> 引用 ${getSenderName(quoted, context)}：${clipped}`, '');
    }

    lines.push(`${autoReplyPrefix}${text || '[空消息]'}`, '');
  }

  return lines.join('\n');
};

export const buildJson = ({
  messages,
  context,
  source,
  startDate,
  endDate,
}) => {
  const payload = {
    formatVersion: 1,
    app: 'WHEN I with U',
    source,
    exportedAt: new Date().toISOString(),
    range: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    chatId: context.chatId,
    characterName: context.characterName,
    userName: context.userName,
    messageCount: messages.length,
    messages: messages.map((message) => {
      const versions = Array.isArray(message.versions) ? message.versions : [];

      return {
        id: message.id,
        timestamp: message.timestamp,
        sender: message.sender,
        senderName: getSenderName(message, context),
        type: message.type || 'text',
        mode: message.mode || null,
        text: describeMessageForExport(message),
        rawContent: getCurrentRawText(message),
        quotedMessageId: message.quotedMessageId || null,
        reactions: Array.isArray(message.reactions) ? message.reactions : [],
        autoReply: Boolean(message.metadata?.autoReply),
        metadata: sanitizeForJson(getCurrentMetadata(message)),
        // 多版本（重roll 出来的备选回复）：只有真的有多版时才带上，
        // 并且只带文字，不带每一版的 metadata，避免文件膨胀。
        versions: versions.length > 1
          ? versions.map((version) => versionToText(version))
          : undefined,
      };
    }),
  };

  return JSON.stringify(payload, null, 2);
};

/* ------------------------------------------------------------------
 * 下载
 * ------------------------------------------------------------------ */

const downloadTextFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 按选定的格式导出并触发下载。formats 是 ['markdown', 'json'] 的子集。
 * 返回 { messageCount, files }；没有消息时不下载，messageCount 为 0。
 */
export const exportChatRecords = async ({
  chatId,
  source = EXPORT_SOURCES.LIVE,
  startDate = '',
  endDate = '',
  formats = ['markdown'],
}) => {
  const [context, messages] = await Promise.all([
    getExportContext(chatId),
    getMessagesForExport({ chatId, source, startDate, endDate }),
  ]);

  if (messages.length === 0) {
    return { messageCount: 0, files: [] };
  }

  const buildArgs = { messages, context, source, startDate, endDate };
  const baseName = [
    source === EXPORT_SOURCES.ARCHIVED ? '存档记录' : '聊天记录',
    sanitizeFilenamePart(context.characterName),
    startDate || endDate
      ? `${startDate || 'start'}_${endDate || 'end'}`
      : toLocalDayKey(new Date()),
  ].filter(Boolean).join('_');

  const files = [];

  if (formats.includes('markdown')) {
    downloadTextFile(buildMarkdown(buildArgs), `${baseName}.md`, 'text/markdown');
    files.push(`${baseName}.md`);
  }

  if (formats.includes('json')) {
    if (files.length > 0) {
      // 连续触发两个下载时错开一下，部分手机浏览器会吞掉紧挨着的第二个。
      await wait(400);
    }
    downloadTextFile(buildJson(buildArgs), `${baseName}.json`, 'application/json');
    files.push(`${baseName}.json`);
  }

  return { messageCount: messages.length, files };
};

export default {
  EXPORT_SOURCES,
  toLocalDayKey,
  getExportContext,
  getMessagesForExport,
  getCurrentRawText,
  describeMessageForExport,
  buildMarkdown,
  buildJson,
  exportChatRecords,
};