// src/apps/focus/focusNoteDescribe.js
//
// 角色在专注开始、结束时留下的"小纸条"（聊天消息 type: 'focus_note'）的纯函数部分：
// 元数据、给角色看的一句话、生成小纸条用的提示词、对生成结果的清洗。
// 不碰数据库，aiService.js、聊天气泡、导出都可以放心引用，避免循环依赖。
//
// metadata 形状：
//   { source: 'focus', kind: 'start' | 'end', sessionId, task, place,
//     plannedMinutes, actualMinutes, status }

export const FOCUS_NOTE_KINDS = Object.freeze({
  START: 'start',
  END: 'end',
});

const MAX_NOTE_LENGTH = 80;

const cleanText = (value, max = 60) => String(value || '').trim().slice(0, max);

const toMinutes = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const buildFocusNoteMeta = (session, kind) => ({
  source: 'focus',
  kind: kind === FOCUS_NOTE_KINDS.END ? FOCUS_NOTE_KINDS.END : FOCUS_NOTE_KINDS.START,
  sessionId: session?.id ?? null,
  task: cleanText(session?.task),
  place: cleanText(session?.place, 12),
  plannedMinutes: toMinutes(session?.durationMinutes),
  actualMinutes: toMinutes(session?.actualMinutes),
  status: String(session?.status || ''),
});

export const getFocusNoteLabel = (kind) =>
  kind === FOCUS_NOTE_KINDS.END ? '专注结束时的小纸条' : '专注开始时的小纸条';

// 导出、列表预览用的一行字。
export const describeFocusNoteForUser = (msg) => {
  const text = String(msg?.content || '').trim();
  const label = getFocusNoteLabel(msg?.metadata?.kind);
  return text ? `${label}：${text}` : label;
};

// 给角色看的一句话：进入系统提示词的聊天记录里，让下一次回复知道这张字条是自己留的。
export const describeFocusNoteForPrompt = (msg) => {
  const text = String(msg?.content || '').trim();
  const kind = msg?.metadata?.kind;
  const when = kind === FOCUS_NOTE_KINDS.END ? '结束时' : '开始时';

  return `[用户专注${when}，你按约定悄悄给TA留了一张小纸条：「${text}」。小纸条不需要TA回复，不用提醒或追问]`;
};

/**
 * 生成小纸条的提示词。
 * kind 为 start：用户刚开始专注。kind 为 end：用户刚完成（含提前结束）一次专注。
 */
export const buildFocusNotePrompt = ({ character, session, kind }) => {
  const name = character?.name || 'TA';
  const task = cleanText(session?.task);
  const place = cleanText(session?.place, 12);
  const planned = toMinutes(session?.durationMinutes);
  const actual = toMinutes(session?.actualMinutes);

  const taskLine = task ? `要做的事：${task}` : '要做的事：没有写（不要追问是什么事）';
  const placeLine = place ? `地点：${place}` : '';

  const situation =
    kind === FOCUS_NOTE_KINDS.END
      ? `用户刚刚结束了这一次专注。
${taskLine}
${placeLine}
实际专注了 ${actual} 分钟（原计划 ${planned} 分钟）。
请写结束时的小纸条：认可TA刚才的投入，可以让TA放松、喝口水、休息一下，但不要问做得怎么样，也不要评判结果。`
      : `用户刚刚开始了一次专注。
${taskLine}
${placeLine}
计划专注 ${planned} 分钟。
请写开始时的小纸条：一句简短的陪伴或祝福，让TA安心去做，你会在这里，不会打扰。`;

  return `你正在扮演角色：${name}。

角色设定：
${character?.bio || '无'}

补充设定：
${character?.extraNotes || '无'}

背景：用户使用"专注"功能，要安静地做一件事。你们之间有个约定：专注期间你不打扰TA，不问TA在做什么，也不会因为TA没有回复而生气。现在你按约定，悄悄给TA留一张小纸条。小纸条像放在桌边的一张字条，不是聊天，TA不需要回复。

${situation}

严格要求：
- 只输出小纸条本身，一到两句话；
- 长度控制在 8 到 45 个汉字之间；
- 以角色第一人称书写，语气符合你的性格；
- 不使用 Emoji；
- 不要提问，不要要求TA回复，不要出现"回我"之类的话；
- 不要责备，不要表现出失落、担心或催促；
- 不要提及 AI、系统、提示词、功能名称或番茄钟；
- 不要输出标题、Markdown、引号或括号说明。`;
};

/**
 * 清洗模型返回的小纸条。不合格（空、带问句）返回空字符串，调用方就安静地不写这条。
 */
export const cleanFocusNoteText = (raw) => {
  let text = String(raw || '')
    .replace(/^["'「『“]+|["'」』”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';
  if (/[?？]/.test(text)) return '';
  if (text.length > MAX_NOTE_LENGTH) text = text.slice(0, MAX_NOTE_LENGTH);

  return text;
};
