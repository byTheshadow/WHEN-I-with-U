// src/services/callPromptFormat.js
//
// 把一条 type:'call' 的消息，描述成放进聊天历史提示词里的一段话。
//
// 为什么需要这个文件：buildHistoryContext 给 AI 的聊天历史只有 role + 内容，
// 没有每条消息的时间。通话记录又是在打字聊天之外发生的，如果只把通话文字
// 原样塞进历史，AI 只能根据它在历史里的位置推断"这通电话发生在最后几句
// 打字聊天的前后"，于是隔了一天还觉得电话是刚刚、或者就是最后一次打字聊天
// 的那个时间打的。这里给每通电话明确写上发生的日期、时段和钟点（用 AI 本来
// 就能看懂的"昨天晚上"这类说法 + 具体日期），让它不用再猜。
//
// 纯函数，只依赖 memoryTimeContext.js 的日期工具，不读写数据库，也不 import
// aiService.js，避免循环依赖。

import {
  formatRelativeDayLabel,
  getDayPeriodLabel,
} from '../apps/memory/memoryTimeContext';

// 通话文字进历史时的字数上限。历史只取最近 15 条左右，一通长电话的整段
// 文字会把名额占满，所以超长时保留开头和结尾，中间省略。
const MAX_TRANSCRIPT_CHARS = 600;

const clipTranscript = (text) => {
  const chars = [...text];
  if (chars.length <= MAX_TRANSCRIPT_CHARS) return text;

  const head = chars.slice(0, 250).join('');
  const tail = chars.slice(-350).join('');
  return `${head}\n……（中间省略）……\n${tail}`;
};

// 挂断超过这么久，才在提示里强调"不是刚刚发生的"。刚挂断就继续聊时不加，
// 免得把"刚刚的电话"误导成很久以前。
const NOT_RECENT_AFTER_MS = 30 * 60 * 1000;

const pad2 = (value) => String(value).padStart(2, '0');

const describeWhen = (value, now) => {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return '';

  const relative = formatRelativeDayLabel(date, now);
  const period = getDayPeriodLabel(date.getHours());
  const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;

  return `${relative}${period} ${clock}（${monthDay}）`;
};

export const formatCallForPrompt = (msg, now = new Date()) => {
  const metadata = msg?.metadata || {};
  const status = metadata.status;

  // 正在响铃/通话中的电话还没有结果，不放进历史。
  if (status === 'ringing' || status === 'active') return '';

  const when = describeWhen(metadata.startedAt || msg.timestamp, now);
  const whenText = when ? `发生在${when}` : '';
  const isIncoming = metadata.direction === 'incoming';
  const mediaLabel = metadata.mode === 'video' ? '视频通话' : '语音通话';
  const transcript = String(msg.content || '').trim();

  // 未接来电的记录也会带一句文字("某某给你打了电话，你没有接。")，必须先于
  // transcript 判断，否则会被当成"用户接听了"。
  if (isIncoming && metadata.declined) {
    const outcome = metadata.unavailable ? '用户当时不方便接' : '用户没有接听或拒接了';
    return `[你主动给用户打过一通${mediaLabel}，${whenText}，${outcome}。]`;
  }

  if (transcript) {
    const who = isIncoming ? '你主动打给用户的' : '用户打给你的';
    const reasonText = isIncoming && metadata.reason
      ? `你当时打来的理由是：${metadata.reason}。`
      : '';
    const endedAt = new Date(metadata.endedAt || metadata.startedAt || msg.timestamp).getTime();
    const isStale = Number.isFinite(endedAt) && now.getTime() - endedAt > NOT_RECENT_AFTER_MS;
    const staleText = isStale ? '这通电话不是刚刚发生的，请以这里写明的时间为准。' : '';
    const body = clipTranscript(transcript.replace(/^\[(?:语音|视频)通话记录\]\s*/, ''));

    return `[一通${who}${mediaLabel}，${whenText}，用户接听了，已经挂断。${reasonText}${staleText}通话内容：\n${body}]`;
  }

  if (isIncoming) {
    const outcome = metadata.declined ? '用户拒接了' : '用户没有接听';
    return `[你主动给用户打过一通${mediaLabel}，${whenText}，${outcome}。]`;
  }

  return `[用户给你打过一通${mediaLabel}，${whenText}，但没有接通。]`;
};

export default { formatCallForPrompt };