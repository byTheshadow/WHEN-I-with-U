// src/apps/stmemory/stJsonlParser.js
//
// SillyTavern 聊天存档（.jsonl）的流式解析。只负责"读"，不清洗、不写库。
//
// 格式（对照用户的真实导出文件核对过）：
//   第 1 行是聊天头：新版是 { chat_metadata, user_name: "unused", character_name: "unused" }，
//                    老版本顶层直接带真实的 user_name / character_name / create_date。
//   第 2 行起每行一条消息：{ name, is_user, is_system, send_date, mes, swipes, swipe_id, extra, ... }
//
// 取舍：
//   - 说话人看 is_user，不看 name（用户消息的 name 可能是没展开的 {{user}}）。
//   - is_system 为 true 的跳过；只取 mes（等于当前选中的那条候选回复），swipes 里其余
//     候选是被放弃的回复，不要；extra（含推理内容、内嵌图片等大字段）整个丢掉。
//   - 换行统一成 \n。
//   - 文件按块读取，一行一行交给回调，整份文件不会进内存。
import { FILE_READ_PIECE_BYTES } from './stPackConstants';

const yieldToMainThread = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * 流式按行读文件。回调返回 false 表示提前结束。
 */
export const readJsonlLines = async (file, onLine) => {
  const decoder = new TextDecoder('utf-8');
  let offset = 0;
  let carry = '';
  let isFirst = true;

  const emit = async (rawLine) => {
    let line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (isFirst) {
      line = line.replace(/^﻿/, '');
      isFirst = false;
    }
    if (!line.trim()) return true;
    return (await onLine(line)) !== false;
  };

  while (offset < file.size) {
    const end = Math.min(offset + FILE_READ_PIECE_BYTES, file.size);
    const buffer = await file.slice(offset, end).arrayBuffer();
    offset = end;
    carry += decoder.decode(buffer, { stream: offset < file.size });

    let start = 0;
    let newline = carry.indexOf('\n', start);
    while (newline !== -1) {
      const keepGoing = await emit(carry.slice(start, newline));
      if (!keepGoing) return;
      start = newline + 1;
      newline = carry.indexOf('\n', start);
    }
    carry = carry.slice(start);
    await yieldToMainThread();
  }

  if (carry) await emit(carry);
};

export const isHeaderObject = (obj) => (
  Boolean(obj)
  && typeof obj === 'object'
  && typeof obj.mes !== 'string'
  && ('chat_metadata' in obj || 'user_name' in obj || 'character_name' in obj)
);

const cleanHeaderName = (value) => {
  const name = String(value || '').trim();
  return name && name !== 'unused' ? name : '';
};

export const extractHeaderInfo = (obj) => ({
  integrity: String(obj?.chat_metadata?.integrity || ''),
  userName: cleanHeaderName(obj?.user_name),
  charName: cleanHeaderName(obj?.character_name),
});

/** 把一行消息对象整理成我们要的形状；不要的（系统消息、空消息、不是消息）返回 null。 */
export const normalizeStMessage = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.mes !== 'string') return null;
  if (obj.is_system === true) return null;

  const raw = obj.mes.replace(/\r\n?/g, '\n');
  if (!raw.trim()) return null;

  return {
    isUser: obj.is_user === true,
    name: String(obj.name || '').trim(),
    date: String(obj.send_date || ''),
    raw,
  };
};

/** 简单的字符串哈希，用来在增量导入时确认"前面的内容没被改过"。 */
export const hashMessage = (message) => {
  const text = `${message.isUser ? 'u' : 'c'}|${message.raw}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
};

/**
 * 滚动摘要：把"到目前为止所有消息"的哈希一路叠起来。增量导入时比较的是
 * "已导入的那么多条"的整体摘要，前面任何一条被改、被删、被换位置都会发现，
 * 而不是只检查最后一条。
 */
export const rollHash = (previous, messageHash) => {
  const text = `${previous}|${messageHash}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
};

/**
 * 整个文件按顺序走一遍。
 *   onHeader(info)            读到聊天头时调用（没有头的文件不会调用）
 *   onMessage(message, index) 每条保留下来的消息；index 是在保留消息里的序号（从 0 开始）
 * 任何一个回调返回 false 都会提前结束。无法解析的行会被跳过并计数。
 * 返回 { skippedLines }。
 */
export const streamStChat = async (file, { onHeader, onMessage }) => {
  let lineNumber = 0;
  let keptIndex = 0;
  let skippedLines = 0;

  await readJsonlLines(file, async (line) => {
    lineNumber += 1;

    let obj;
    try {
      obj = JSON.parse(line);
    } catch (error) {
      skippedLines += 1;
      return true;
    }

    if (lineNumber === 1 && isHeaderObject(obj)) {
      if (onHeader) return onHeader(extractHeaderInfo(obj));
      return true;
    }

    const message = normalizeStMessage(obj);
    if (!message) return true;

    const result = await onMessage(message, keptIndex);
    keptIndex += 1;
    return result;
  });

  return { skippedLines };
};

/**
 * 只读到第一条消息为止，拿到"这是哪一份聊天"的标识。
 * 有 integrity 就用它（同一份聊天重新导出应该不变）；没有就退回"首条消息时间 + 内容哈希"。
 */
export const readChatIdentity = async (file) => {
  let header = null;
  let first = null;

  await streamStChat(file, {
    onHeader: (info) => {
      header = info;
      return true;
    },
    onMessage: (message) => {
      first = message;
      return false;
    },
  });

  const identityKey = header?.integrity
    ? `int:${header.integrity}`
    : (first ? `first:${first.date}|${hashMessage(first)}` : '');

  return { header, identityKey };
};

/** 一条消息在记忆包原文里的样子。说话人用占位符，注入时再换成当前聊天的名字。 */
export const formatMessageLine = (message, cleanedText) => (
  `${message.isUser ? '{{user}}' : '{{char}}'}: ${cleanedText}\n\n`
);
