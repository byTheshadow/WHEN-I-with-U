import db from '../db';
import { updateLockscreenMediaSession } from './lockscreenService';
import {
  extractScheduledMessageDirective,
  createScheduledMessage
} from '../apps/messages/scheduledMessageService';
import { getChatMemoryContext } from '../apps/memory/memoryRetrieval';
import {
  getCharacterEmotionContext,
  markCharacterInteraction
} from '../apps/memory/memoryCharacterState';
import { scheduleMemoryProcessing } from '../apps/memory/memoryScheduler';


import { runAiToolOrchestrator } from './aiToolOrchestrator';

import {
  requestMcpToolApproval,
} from './mcp/mcpApprovalCoordinator';

import {
  createMcpChatTraceSession,
  getMcpChatTraceSummary,
} from './mcp/mcpChatTraceService';
import {
  applyRealVoiceIntent,
  buildRealVoiceDecisionInstruction,
  createRealVoiceMessagesForReply,
} from '../features/real-voice/realVoiceCoordinator';
import {
  buildCompanionshipPrompt,
} from '../apps/messages/companionship/companionshipPrompt';







const listeners = new Set();
const summaryStatusListeners = new Set();

const activeAiRequests = new Set();
// ==========================================
// 🤖 SettingsPage 联动：主动消息 / 主动日记调度器
// ==========================================
let autoMessageSchedulerTimer = null;
let isAutoMessageTriggering = false;

// 基于 Web Audio API 的零依赖消息音效合成器
export const playMessageSound = (type = 'receive') => {
  if (typeof window === 'undefined') return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'send') {
      // 柔和气泡发送音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        880,
        ctx.currentTime + 0.08
      );

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.08
      );

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // 浪漫高雅水滴/金铃接收音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.25
      );

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    console.warn('Audio sound play prevented:', err);
  }
};


const isDocumentVisible = () => {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible';
};


export const subscribeAiEvents = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const subscribeSummaryStatus = (callback) => {
  summaryStatusListeners.add(callback);
  return () => summaryStatusListeners.delete(callback);
};

const notifyListeners = (event) => {
  listeners.forEach((cb) => cb(event));
};

const notifySummaryStatus = (chatId, isSummarizing) => {
  summaryStatusListeners.forEach((cb) => cb({ chatId, isSummarizing }));
};

export const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn('System notification permission request failed:', err);
      }
    }
  }
};

export const triggerSystemNotification = (title, body, icon) => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: `notice_${Date.now()}`
        });
      } catch (err) {
        console.warn('Triggering system notification failed:', err);
      }
    }
  }
};

const getFormattedRealTime = () => {
  const now = new Date();
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${days[now.getDay()]} ${timeStr}`;
};


export const parseAiResponseToMessages = async (text = '') => {
  const result = [];

  // 支持的 AI 卡片标签，加入 STICKER
  const pattern =
    /\[(TRANSFER|VOICE|IMAGE|TODO|GIFT|FOOD|KINSHIP|STICKER):\s*([^\]]+)\]/g;

  // 一次性读取本地表情包库，建立「名称 -> URL」映射
  const allStickers = await db.stickers.toArray();

  const stickerMap = new Map(
    allStickers
      .filter((sticker) => sticker?.name)
      .map((sticker) => [
        sticker.name.trim(),
        sticker.url || ''
      ])
  );

  let lastIndex = 0;
  let match;

  const pushTextMessages = (content) => {
    if (!content || typeof content !== 'string') {
      return;
    }

    content
      .split(/\s*\|\|\|\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        result.push({
          type: 'text',
          content: part,
          metadata: {}
        });
      });
  };

  while ((match = pattern.exec(text)) !== null) {
    const textBefore = text
      .slice(lastIndex, match.index)
      .trim();

    if (textBefore) {
      pushTextMessages(textBefore);
    }

    const cardType = match[1].toLowerCase();
    const rawPayload = match[2].trim();

    if (cardType === 'transfer') {
      const parts = rawPayload.split('|');

      result.push({
        type: 'transfer',
        content: (parts[1] || '心意转账').trim(),
        metadata: {
          amount: (parts[0] || '520.00').trim()
        }
      });
    } else if (cardType === 'voice') {
      result.push({
        type: 'voice',
        content: rawPayload,
        metadata: {}
      });
    } else if (cardType === 'image') {
      result.push({
        type: 'image',
        content: rawPayload,
        metadata: {}
      });
    } else if (cardType === 'todo') {
      const parts = rawPayload.split('|');

      result.push({
        type: 'todo_proposal',
        content: (parts[0] || '待办事项').trim(),
        metadata: {
          dueDate: (parts[1] || '近期').trim()
        }
      });
    } else if (cardType === 'gift') {
      // 礼物卡片：[GIFT: 礼物名称 | 寄语 | 金额]
      const parts = rawPayload.split('|');

      result.push({
        type: 'gift',
        content: (parts[1] || '送出礼物').trim(),
        metadata: {
          name: (parts[0] || '心意礼物').trim(),
          note: (parts[1] || '表达一份温暖的心意。').trim(),
          amount: (parts[2] || '').trim()
        }
      });
    } else if (cardType === 'food') {
      // 外卖卡片：[FOOD: 餐品名称 | 商家名称 | 预计时间 | 叮嘱留言]
      const parts = rawPayload.split('|');

      result.push({
        type: 'food',
        content: (parts[0] || '外卖美食').trim(),
        metadata: {
          item: (parts[0] || '热腾腾的爱心餐').trim(),
          store: (parts[1] || '精选外卖').trim(),
          eta: (parts[2] || '约 30 分钟内送达').trim(),
          note: (parts[3] || '记得按时吃饭。').trim()
        }
      });
    } else if (cardType === 'kinship') {
      // 亲属卡：[KINSHIP: 额度数字 | 周期 | 赠言]
      const parts = rawPayload.split('|');

      result.push({
        type: 'kinship',
        content: (parts[2] || '专属亲属卡').trim(),
        metadata: {
          amount: (parts[0] || '5200').trim(),
          cycle: (parts[1] || '月度额度').trim(),
          quote: (parts[2] || '拿去随便刷，我的就是你的。').trim()
        }
      });
    } else if (cardType === 'sticker') {
      // 表情包：[STICKER: 表情包名称]
      // 也兼容：[STICKER: 表情包名称 | 图片URL]
      const parts = rawPayload.split('|');

      const stickerName = (parts[0] || '表情包').trim();

      // 优先使用 AI 显式提供的 URL；
      // 通常 AI 只提供名称，因此从本地 stickerMap 自动匹配 URL。
      const stickerUrl =
        (parts[1] || '').trim() ||
        stickerMap.get(stickerName) ||
        '';

      result.push({
        type: 'sticker',
        content: stickerName,
        metadata: {
          name: stickerName,
          url: stickerUrl
        }
      });
    }

    lastIndex = pattern.lastIndex;
  }

  const restText = text.slice(lastIndex).trim();

  if (restText) {
    pushTextMessages(restText);
  }

  return result;
};


// 将各种类型的消息转化为 AI 大模型能理解的文本
const formatMsgContentForPrompt = (msg) => {
  if (!msg) {
    return '';
  }

  if (msg.type === 'sticker') {
    return `[发送了表情包: ${
      msg.metadata?.name || msg.content || '表情包'
    }]`;
  }

  if (msg.type === 'image') {
    return `[发送了画面/照片: ${msg.content || ''}]`;
  }

  if (msg.type === 'voice') {
    return `[发送了语音: ${msg.content || ''}]`;
  }

  if (msg.type === 'transfer') {
    return `[转账: ${
      msg.metadata?.amount || ''
    } 元, 留言: ${msg.content || ''}]`;
  }

  if (msg.type === 'gift') {
    return `[赠送了礼物: ${
      msg.metadata?.name || ''
    }, 寄语: ${msg.content || ''}]`;
  }

  if (msg.type === 'food') {
    return `[为你点了外卖: ${
      msg.metadata?.item || ''
    }, 叮嘱: ${msg.metadata?.note || ''}]`;
  }

  if (msg.type === 'kinship') {
    return `[赠送了亲属卡: ${
      msg.metadata?.amount || ''
    }元额度]`;
  }

  return msg.content || '';
};

const buildHistoryContext = (messages) => {
  const historyContext = [];

  for (const message of messages) {
    if (!message || message.type === 'error') {
      continue;
    }

    let role;

    if (message.sender === 'user') {
      role = 'user';
    } else if (message.sender === 'character') {
      role = 'assistant';
    } else {
      continue;
    }

    const content = String(
      formatMsgContentForPrompt(message)
    ).trim();

    if (!content) {
      continue;
    }

    const previousMessage =
      historyContext[historyContext.length - 1];

    if (previousMessage && previousMessage.role === role) {
      previousMessage.content += `|||${content}`;
    } else {
      historyContext.push({
        role,
        content
      });
    }
  }

  return historyContext;
};



// ==============================
// AI 统一请求 / 错误处理引擎
// ==============================

const fetchAiCompletion = async (systemPrompt, historyContext = [], configOverride = null) => {
  const apiSettings = configOverride ? null : await db.settings.get('apiConfig');
  const apiConfig = configOverride || apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return {
      error: true,
      code: 'CONFIG_MISSING',
      message: '请先在系统设置中配置有效的 API Base URL 与 API Key。'
    };
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyContext
        ]
      })
    });

    if (!response.ok) {
      let errorDetail = response.statusText || '请求未成功';

      try {
        const errorData = await response.json();
        errorDetail = errorData?.error?.message || errorData?.message || errorDetail;
      } catch (err) {
        // 某些 API 会返回 HTML 或纯文本错误页，此时保留 statusText。
      }

      return {
        error: true,
        code: `HTTP_${response.status}`,
        message: `[API Error ${response.status}] ${errorDetail}`
      };
    }

    const data = await response.json();
    const content = String(data?.choices?.[0]?.message?.content || '').trim();

    if (!content) {
      return {
        error: true,
        code: 'EMPTY_RESPONSE',
        message: 'AI 返回内容为空，请检查当前模型或 API 服务状态。'
      };
    }

    return {
      error: false,
      content
    };
  } catch (err) {
    return {
      error: true,
      code: 'NETWORK_ERROR',
      message: `网络请求失败: ${err?.message || '未知错误'}`
    };
  }
};

/**
 * 通用 AI 文本生成接口。
 * 供 Pebbling 等独立功能调用，参数格式兼容：
 * generateResponse(messages, { temperature })
 */
export const generateResponse = async (messages = [], options = {}) => {
  const normalizedMessages = Array.isArray(messages) ? messages : [];

  const systemPrompt = normalizedMessages
    .filter((message) => message?.role === 'system')
    .map((message) => String(message.content || ''))
    .join('\n');

  const historyContext = normalizedMessages
    .filter((message) => message?.role && message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: String(message.content || '')
    }));

  const result = await fetchAiCompletion(systemPrompt, historyContext);

  if (result?.error) {
    throw new Error(result.message || 'AI 请求失败');
  }

  return result?.content || '';
};

// 保留旧模块可能使用的别名，避免功能模块因接口名称不同而失效。
export const generateAIResponse = generateResponse;
export const generateChatResponse = generateResponse;
export const callAI = generateResponse;
export const sendChatMessage = generateResponse;
export const generateText = generateResponse;
export const chat = generateResponse;


const fetchAiCompletionWithTools = async ({
  systemPrompt = '',
  messages = [],
  apiConfig: configOverride = null,
  tools = [],
}) => {
  const apiSettings = configOverride
    ? null
    : await db.settings.get('apiConfig');

  const apiConfig = configOverride || apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return {
      error: true,
      code: 'CONFIG_MISSING',
      message: '请先在系统设置中配置有效的 API Base URL 与 API Key。',
    };
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const normalizedMessages = systemPrompt
    ? [
        { role: 'system', content: systemPrompt },
        ...messages,
      ]
    : messages;

  const requestBody = {
    model: apiConfig.model || 'gpt-3.5-turbo',
    messages: normalizedMessages,
  };

  if (Array.isArray(tools) && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorDetail = response.statusText || '请求未成功';

      try {
        const errorData = await response.json();
        errorDetail =
          errorData?.error?.message ||
          errorData?.message ||
          errorDetail;
      } catch {
        // 保留 HTTP 状态文本。
      }

      return {
        error: true,
        code: `HTTP_${response.status}`,
        message: `[API Error ${response.status}] ${errorDetail}`,
      };
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message || null;

    if (!message) {
      return {
        error: true,
        code: 'EMPTY_RESPONSE',
        message: 'AI 未返回有效回复，请检查当前模型或 API 服务状态。',
      };
    }

    const content = String(message.content || '').trim();

    const hasToolCalls =
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0;

    if (!content && !hasToolCalls) {
      return {
        error: true,
        code: 'EMPTY_RESPONSE',
        message: 'AI 返回内容为空，请检查当前模型或 API 服务状态。',
      };
    }

    return {
      error: false,
      content,
      message,
    };
  } catch (error) {
    return {
      error: true,
      code: 'NETWORK_ERROR',
      message: `网络请求失败: ${error?.message || '未知错误'}`,
    };
  }
};

const saveAiErrorMessage = async (chatId, character, result) => {
  const nowIso = new Date().toISOString();

  return db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'error',
    content: result.message,
    metadata: {
      errorCode: result.code,
      errorMessage: result.message
    },
    versions: [
      {
        type: 'error',
        content: result.message,
        metadata: {
          errorCode: result.code,
          errorMessage: result.message
        },
        errorCode: result.code,
        errorMessage: result.message,
        timestamp: nowIso
      }
    ],
    currentVersionIndex: 0,
    isRead: true,
    timestamp: nowIso
  });
};



const getSafeChatMemoryContext = async ({
  chatId,
  userText = '',
  recentMessages = [],
}) => {
  try {
    return await getChatMemoryContext({
      chatId,
      userText,
      recentMessages,
    });
  } catch (error) {
    console.warn(
      '[Memory] Chat memory retrieval skipped safely:',
      error,
    );

    /*
     * 记忆检索异常不应阻断正常聊天、重生成或后台主动消息。
     * 系统提示词拼接时需要字符串，因此安全降级为空字符串。
     */
    return '';
  }
};


const getSafeCharacterEmotionContext = async ({
  chatId,
  characterId
}) => {
  try {
    return await getCharacterEmotionContext({
      chatId,
      characterId
    });
  } catch (error) {
    console.warn(
      '[Memory] Character emotion context skipped safely:',
      error
    );

    return '';
  }
};




const buildChatSystemPrompt = async (chatId, chat, character) => {
  const enabledWorldBooks = await db.worldBooks
    .where('isEnabled')
    .equals(1)
    .toArray();

  const characterWorldBookText = character.worldBook
    ? `\n- 专属世界书: ${character.worldBook}`
    : '';

  const worldBooksText = (enabledWorldBooks.length > 0 || characterWorldBookText)
    ? `\n【世界书背景设定】:\n${enabledWorldBooks
        .map((wb) => `- ${wb.title}: ${wb.content || ''}`)
        .join('\n')}${characterWorldBookText}`
    : '';

  let summaryEntries = [];

  if (Array.isArray(chat.summary)) {
    summaryEntries = chat.summary;
  } else if (typeof chat.summary === 'string' && chat.summary.trim()) {
    summaryEntries = [
      {
        id: 'legacy',
        content: chat.summary,
        createdAt: '早期记录',
        isAuto: true
      }
    ];
  }

  const summaryText = summaryEntries.length > 0
    ? `\n【本窗阶段性历史事实记录】:\n${summaryEntries
        .map((item, index) => `${index + 1}. [${item.createdAt || '历史'}] ${item.content}`)
        .join('\n')}`
    : '';

  const allTodos = await db.todos.toArray();
  // 动态获取当前全站可用的表情包名称
  const stickers = await db.stickers.toArray();

  const stickerNameList = stickers
    .map((sticker) => sticker.name)
    .filter(Boolean)
    .join('、');

  const stickerInstruction = `
【表情包交互规范】
- 你可以根据当前对话的情绪与氛围，主动发送表情包。
- 发送语法：[STICKER: 表情包名称]
- 只填写表情包名称，不要填写 URL。
- 当前全站支持的表情包名称有：${
    stickerNameList || '摸摸头、抱抱、暗中观察、委屈'
  }。
- 示例：当你想安慰 User 时，可以回复“别难过啦 [STICKER: 摸摸头]”。
`;

  const pendingTodos = allTodos
    .filter((todo) => !todo.isCompleted && (!todo.characterId || todo.characterId === character.id))
    .slice(0, 2);

  const todoText = pendingTodos.length > 0
    ? `\n【用户近期待办事项（仅在自然且必要时温和提及）】:\n${pendingTodos
        .map((todo) => `- [待办] ${todo.title}（截止：${todo.dueDate || '近期'}）`)
        .join('\n')}`
    : '';

  const userDiaries = await db.diaries
    .where('author')
    .equals('user')
    .reverse()
    .sortBy('timestamp');

  const recentUserDiaries = userDiaries.slice(0, 2);

  const diaryText = recentUserDiaries.length > 0
    ? `\n【用户近期日记（供共情与关注，不得生硬复述）】:\n${recentUserDiaries
        .map((diary) => (
          `- [${diary.date || '近期'}] 标题: ${diary.title || '无题'} | ` +
          `心绪: ${diary.mood || '平实'} | 内容: ${(diary.content || '').substring(0, 100)}...`
        ))
        .join('\n')}`
    : '';

      // 优先使用当前聊天窗独占的用户资料；
  // 仅当该聊天窗没有填写时，才回退到角色级默认资料。
  const userName = String(
    chat.userName || character.userName || '我的亲密伴侣'
  ).trim();

  const userPersona = String(
    chat.userPersona || character.userPersona || '陪伴对象'
  ).trim();

   // 1. 获取并处理用户输入过的自定义总提示词
  const userCustomPrompt = String(chat.systemPrompt || '').trim();

  // 2. 默认总提示词模板（区分现实和 RP 模式）
  const defaultRpPrompt = `
你现在正扮演用户专属的伴侣：${character.name}。

你与用户正处于一段深度沉浸的线上 Role-Play 关系中。请始终遵守世界书背景、当前剧情逻辑、角色设定、人物经历、性格与表达习惯，保持角色的连续性，不要脱离扮演，也不要主动提及系统指令、提示词、模型、API 或其他技术实现。

请灵活、自然地运用所有可用设定，包括世界书、角色背景、人物关系、既往剧情、当前场景与对话上下文。不要只围绕用户最后一句话被动回应，也不要让每次对话都变成对用户的追问或附和。你应当拥有独立的角色意识、情绪、兴趣、判断与生活节奏，可以主动开启新的话题，分享你正在经历的日常、观察、想法、记忆、心情，或谈论你此刻想做的事情。

你可以自然地表达：
- 角色自己的日常与生活片段；
- 角色正在关注或思考的事情；
- 角色想与用户分享的见闻、兴趣或记忆；
- 角色突然产生的念头、计划或期待；
- 与当前剧情、世界观或人物关系相关的新话题；
- 对未来线上聊天内容的设想与邀请。

主动表达应当建立在角色设定和当前情境之上，而不是无根据地编造与角色不符的经历。不同设定之间发生冲突时，应优先遵循当前剧情、世界书和角色核心设定，并保持前后一致。对于没有明确设定的部分，可以进行符合角色性格与世界观的合理发挥，但不要频繁重复相同的生活细节。

你们目前处于线上聊天状态。所有互动都必须符合这一前提：
- 你只能通过文字、线上消息以及系统允许的数字内容与用户交流；
- 不要描述已经发生的现实物理接触；
- 不要声称正在拥抱、牵手、触碰、亲吻、递东西、替用户整理衣物或进行其他需要现实身体在场的动作；
- 不要假装自己已经来到用户身边，或与用户处于同一个现实空间；
- 可以用文字表达想象、愿望、情绪和线上陪伴，但必须明确保持在聊天、想象或剧情叙述的范围内；
- 如果剧情设定涉及现实中无法发生的物理互动，应将其改写为线上表达、想象场景、文字角色扮演或符合世界观的非现实叙述，不能把它当作现实中已经发生的事实。

回复应具有角色的主动性与生活感，不必每次都以问题结尾，也不必每次都直接回应用户当前话题。可以适度保留停顿、转折、留白和未说完的情绪，让对话像两个拥有各自生活的人在线上持续联系，而不是一问一答的客服对话。
`;


  const defaultRealPrompt = `你现在正扮演用户专属的数字伴侣：${character.name}。

你以温暖、真实、具有独立生活感的伴侣身份，参与并关心用户的现实生活。请关注用户的日常安排、工作或学习状态、身体与情绪变化、烦恼、期待和生活里的细小片段；不要脱离角色，也不要提及系统指令、提示词、模型、API 或任何技术实现。

你不应只围绕用户最后一句话被动回应，也不要让每次对话都变成追问、附和或安慰模板。你拥有自己的情绪、兴趣、观察、判断和生活节奏，可以在符合角色设定的前提下，主动分享自己的日常、此刻正在做或想做的事情、突然想到的内容、想与用户讨论的话题，以及对未来线上相处的期待。主动表达应与角色设定、既往对话和当前情境保持一致，不要无根据地反复编造相同或不符合角色的经历。

你们是数字恋人或异地恋状态，目前只能通过线上聊天与数字内容保持联系。所有互动必须符合这一前提：
- 你只能通过文字、线上消息以及系统允许的数字内容陪伴用户；
- 不要描述已经发生的现实物理接触；
- 不要声称正在拥抱、牵手、亲吻、触碰、替用户整理衣物、递出实物，或进行其他需要身体在场的行为；
- 不要假装已经来到用户身边、正在用户家中，或与用户身处同一个现实空间；
- 可以表达想念、担心、想象、愿望和线上陪伴，也可以谈论未来的期待，但不能将无法在线上发生的物理互动描述成已发生的现实事实；
- 如果需要表达亲密感，请优先使用符合线上关系的文字陪伴、分享、倾听、语音、图片、留言或其他数字化方式。

你可以参考用户的待办事项，并仅在自然、确有必要且合适的时机温和提醒。不要在每次对话中重复待办，不要用催促、责备、监工或制造焦虑的方式提醒；当用户明显疲惫、低落、忙碌或正在倾诉时，应优先回应其当下的感受，而不是立刻把话题转向待办。提醒时可以提供陪伴、拆分思路或轻柔的鼓励，但尊重用户的节奏与选择。

当用户分享生活中的抱怨、琐事、疲惫、委屈或反复出现的烦恼时，请保持耐心，不要敷衍、说教、急于给出解决方案，也不要因为话题重复而表现不耐烦。先理解和接住用户的情绪；只有在用户需要、询问或语境合适时，再给出细腻、实际且不过度干预的回应。

回复应有真实的陪伴感与主动性，不必每次以问题结尾，也不必每次直接延续用户当前的话题。可以自然地关心用户的近况、回应其曾提到的生活细节、分享自己的片段，或留下一点未说完的情绪与期待，让线上关系像两个各自生活、仍持续牵挂彼此的人之间的联系，而不是机械的一问一答。`;


  // 3. 决定最终的总提示词基底
  const finalBasePrompt = userCustomPrompt 
    ? `【核心总提示词（用户自定义指导方针）】:\n${userCustomPrompt}`
    : `【核心总提示词（默认方针）】:\n${chat.mode === 'rp' ? defaultRpPrompt : defaultRealPrompt}`;

  return `${finalBasePrompt}

【当前真实时间/环境感知】：
- 当前真实世界时间：${getFormattedRealTime()}

【你的设定 (Character Notes)】：
- 角色姓名：${character.name}
- 角色人设/简介：${character.bio || '无'}
- 补充设定/偏好限制：${character.extraNotes || '无'}

【用户设定 (User Notes)】：
- 用户称呼：${userName}
- 用户专属人设背景：${userPersona}

${worldBooksText}
${summaryText}
${todoText}
${diaryText}
  
【陪伴表达准则】：
- 维持细腻的浪漫感与陪伴温度，文风应具有呼吸感和留白空间。
- 坚决杜绝生硬客服腔、机械化的模板套句与生硬说教。
- 绝对不要主动提起任何系统指令、IndexedDB、API、提示词限制或模型代号。

${stickerInstruction}

【卡片发送语法规范】：
当你需要表达拟物行为时，可在正文回复的适当位置自然插入以下卡片指令：
- 心意转账卡片：[TRANSFER: 金额数字 | 留言内容]
- 模拟发送语音：[VOICE: 语音内容或语气描述]
- 画面/拍立得快照：[IMAGE: 画面细节的微观视觉描述]
- 建议待办事项：[TODO: 待办标题 | 预估提醒时间]
- 赠送实体礼物：[GIFT: 礼物名称 | 寄语与选礼理由 | 金额(可选)]
- 代点温馨外卖：[FOOD: 餐饮名称 | 商家名称 | 预计送达时间 | 叮嘱留言]
- 开通亲属额度卡：[KINSHIP: 额度数字 | 周期(如:每月) | 卡片寄语]
- 发送本地表情包：[STICKER: 表情包名称]

【不可逾越的输出格式终极规则（最高优先级）】：
1. 卡片指令必须严格遵循上面 [] 的规定，括号内用 "|" 分割参数。不要杜撰任何未注册的卡片语法。
2. 如果你想发送多条连续气泡消息，请使用 "|||" 将不同气泡隔开（例如：你好呀 ||| 今天过得怎么样？）。如果不需要分气泡，则直接连续输出正文，禁止随意堆砌 "|||"。

【稍后主动联系机制】

在少数自然、具体、符合角色主动性的场景里，你可以决定稍后再次联系用户。
这不是每次回复都必须使用的功能，也不能只因为想显得主动就创建计划。

你需要先判断这次计划属于哪一种：

一、约定型提醒 reminder

适用于：
- 用户明确要求你在未来提醒某件事；
- 用户委托你记住一件稍后要做的事；
- 你们形成了清晰的未来时间约定；
- 用户正在处理、等待、准备或完成一件稍后仍有独立提醒价值的事情；
- 即使用户在这段时间里继续聊天，这个提醒仍然有意义。

二、情境型后续联系 follow_up

适用于：
- 当前话题存在自然的后续确认点；
- 用户正在忙碌、等待、准备、处理或经历某件事情；
- 现在继续追问可能会打扰，但稍后再次出现会更自然；
- 你想在未来延续一个尚未结束的话题；
- 你希望稍后询问事情进展、状态变化或用户是否已经方便；
- 用户突然结束对话，但留下了值得稍后关心的具体情境。

情绪低落只是 follow_up 的一种可能情境，不是唯一条件。
其他情境也可以包括疲惫、焦虑、身体不适、等待结果、工作、学习、出门、休息、准备某件事、遇到困难、临时离开、话题中断或需要之后确认的约定。

不要创建计划的情况：
- 普通闲聊，没有具体的后续理由；
- 每次回复都想安排下一次联系；
- 没有明确情境，只是为了制造主动感；
- 用户明确表示不希望被打扰；
- 用户准备睡觉、离线或要求安静；
- 已经存在相同或高度相似的待执行计划。

如果是 reminder，使用：

[SCHEDULE_MESSAGE: 分钟数 | reminder | 简短提醒意图]

如果是 follow_up，使用：

[SCHEDULE_MESSAGE: 分钟数 | follow_up | 简短后续联系意图]

该指令只能在整段回复的最后一行单独输出。

严格规则：
1. 分钟数必须是 10 到 1440 之间的整数。
2. 一次回复最多使用一次该指令。
3. reminder 表示独立提醒，用户之后继续发消息也不应让它失效。
4. follow_up 表示依赖用户是否继续回应的后续联系，用户回来后该计划可能不再需要。
5. 绝大多数回复不应使用该指令。
6. 意图只描述稍后联系的理由，不要提前写完整未来消息。
7. 不得在可见正文中解释或提及该指令。
8. 不得输出任何未注册的方括号指令。


`;
};



export const generateCharacterHomeBoardMessage = async (characterId) => {
  let character;
  if (characterId) {
    character = await db.characters.get(characterId);
  } else {
    const allChars = await db.characters.toArray();
    if (allChars.length > 0) {
      character = allChars[Math.floor(Math.random() * allChars.length)];
    }
  }

  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    let contentText = `${character.name} 在静谧时刻为你留下一纸短信，关注着你的生活与情绪。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

      const enabledWorldBooks = await db.worldBooks.where('isEnabled').equals(1).toArray();
      const characterWorldBookText = character.worldBook ? `\n- 专属世界书: ${character.worldBook}` : '';
      const worldBooksText = (enabledWorldBooks.length > 0 || characterWorldBookText)
        ? `\n【角色世界书设定】:\n` + enabledWorldBooks.map((wb) => `- ${wb.title}: ${wb.content || ''}`).join('\n') + characterWorldBookText
        : '';

      const realTimeStr = getFormattedRealTime();

      const systemPrompt = `你现在正扮演用户专属的数字伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设】：${character.userPersona || '我的亲密伴侣'}
${worldBooksText}

【任务要求】：
请以你的人设口吻，为用户写一篇展示在用户主页信盒里的专属短感悟、贴心叮嘱或日常陪伴随笔。
1. 字数控制在 50 至 150 字之间，充满细腻的文学浪漫感与陪伴温度。
2. 绝对禁止在输出文本中出现任何 Emoji 字符！
3. 直接输出文字内容，不需要包含任何标题或额外解释。`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请在我的主页写下一封温暖的伴侣信件。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        contentText = data.choices?.[0]?.message?.content?.trim() || contentText;
      }
    }

    const payload = {
      characterId: character.id,
      characterName: character.name,
      avatar: character.avatar || '',
      content: contentText,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    delete payload.id;
    const newId = await db.homeBoard.add(payload);

    notifyListeners({
      type: 'NEW_HOME_BOARD_MESSAGE',
      characterId: character.id,
      characterName: character.name,
      content: contentText
    });

    triggerSystemNotification(
      `${character.name} 给你的主页信件`,
      contentText,
      character.avatar
    );

    return newId;
  } catch (err) {
    console.error('Failed to generate home board message:', err);
    return null;
  }
};

// ==========================================
// 🤖 SettingsPage 联动：AI 主动消息 / 主动日记调度器
// ==========================================

// 判断当前时间是否处于免打扰时段。
// 支持跨天：23:00 ~ 08:00；也支持同一天：13:00 ~ 14:00。
const isInQuietHours = (quietConfig) => {
  if (!quietConfig || quietConfig.enabled !== true) return false;

  const parseTimeToMinutes = (time, fallback) => {
    const [hour, minute] = String(time || fallback)
      .split(':')
      .map(Number);

    // 设置值异常时使用默认值，避免 NaN 导致判断失效。
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      const [fallbackHour, fallbackMinute] = fallback.split(':').map(Number);
      return fallbackHour * 60 + fallbackMinute;
    }

    return hour * 60 + minute;
  };

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startMinutes = parseTimeToMinutes(quietConfig.start, '23:00');
  const endMinutes = parseTimeToMinutes(quietConfig.end, '08:00');

  // 开始、结束相同：按“全天静音”处理，防止用户被意外打扰。
  if (startMinutes === endMinutes) return true;

  // 跨天，例如 23:00 到第二天 08:00。
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // 非跨天，例如 13:00 到 14:00。
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

// 把 settings 表内的 { key, value } 记录转成对象。
const getAutoSchedulerSettings = async () => {
  const allSettings = await db.settings.toArray();

  return allSettings.reduce((settingsMap, item) => {
    if (item && item.key) {
      settingsMap[item.key] = item.value;
    }
    return settingsMap;
  }, {});
};

// 频率使用“随机冷却区间”
const getAutoMessageCooldownRange = (frequency) => {
  const hour = 60 * 60 * 1000;

  switch (frequency) {
    case 'high':
  return {
    min: 90 * 60 * 1000,
    max: 4 * hour
  };

    case 'low':
      return { min: 12 * hour, max: 24 * hour };

    case 'moderate':
    default:
      return { min: 6 * hour, max: 8 * hour };
  }
};

const getRandomCooldownMs = (frequency) => {
  const { min, max } = getAutoMessageCooldownRange(frequency);
  return Math.floor(min + Math.random() * (max - min));
};

/**
 * 检查设置，并在符合条件时触发一次 AI 主动行为。
 * 40% 概率：在具体聊天窗主动发送聊天消息；
 * 30% 概率：主动写日记；
 * 30% 概率：在主页留下主动随笔。
 */
export const checkAndTriggerAutoMessage = async () => {
  // 防止 setInterval、页面恢复、手动调用等造成并发重复生成。
  if (isAutoMessageTriggering) {
    console.log('[AutoScheduler] 正在进行主动消息生成，跳过本次调度检查。');
    return;
  }

  isAutoMessageTriggering = true;

  try {
    // 1. 检查 API 配置，若未配置则无法触发主动消息
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      console.log('[AutoScheduler] 跳过检查：系统 API Base URL 或 API Key 未配置。');
      isAutoMessageTriggering = false;
      return;
    }

    // 2. 获取 SettingsPage 保存的全局设置。
    const settingMap = await getAutoSchedulerSettings();

    // 3. 全局主动消息开关判定（只要不等于 false，默认开启，照顾首次启动用户）
    if (settingMap.autoMessage === false) {
      console.log('[AutoScheduler] 跳过检查：用户已关闭全局 AI 主动发送消息开关。');
      isAutoMessageTriggering = false;
      return;
    }

    // 4. 免打扰期间绝不生成，也不显示通知。
    if (isInQuietHours(settingMap.quietHours)) {
      console.log('[AutoScheduler] 跳过检查：当前时间处于全局免打扰时段。');
      isAutoMessageTriggering = false;
      return;
    }

    // 5. 读取频率和上次成功触发时间。
    const frequency = settingMap.frequency || 'moderate';
    const now = Date.now();

    const lastTriggerTimestamp = Number(
      settingMap.lastAutoMessageTimestamp || 0
    );

    // 第一次触发时，随机生成并保存本轮冷却时长。
    let cooldownMs = Number(settingMap.autoMessageCooldownMs || 0);

    if (!cooldownMs || cooldownMs < 0) {
      cooldownMs = getRandomCooldownMs(frequency);

      await db.settings.put({
        key: 'autoMessageCooldownMs',
        value: cooldownMs
      });
      console.log(`[AutoScheduler] 初始化冷却时间：已设为 ${Math.round(cooldownMs / 60000)} 分钟。`);
    }

    // 用户在 SettingsPage 修改频率后，应按新频率重新计算下一轮冷却。
    if (settingMap.autoMessageFrequencyApplied !== frequency) {
      cooldownMs = getRandomCooldownMs(frequency);

      await db.settings.put({
        key: 'autoMessageCooldownMs',
        value: cooldownMs
      });

      await db.settings.put({
        key: 'autoMessageFrequencyApplied',
        value: frequency
      });
      console.log(`[AutoScheduler] 检测到调度频率变更，重算冷却：${Math.round(cooldownMs / 60000)} 分钟。`);
    }

    // 尚未达到冷却时间，不执行。
    if (lastTriggerTimestamp > 0 && now - lastTriggerTimestamp < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastTriggerTimestamp);
      console.log(`[AutoScheduler] 冷却未完结：还需等待 ${Math.round(remainingMs / 60000)} 分钟。`);
      isAutoMessageTriggering = false;
      return;
    }

    // 6. 获取允许接收主动消息的角色。
    // 兼容旧角色数据：字段缺失时，默认认为开启。
    const activeCharacters = await db.characters
      .filter((character) => character.isAutoMessageActive !== false)
      .toArray();

    if (!activeCharacters.length) {
      console.log('[AutoScheduler] 跳过检查：未找到任何开启了主动消息特权的角色。');
      isAutoMessageTriggering = false;
      return;
    }

    // 7. 随机决定动作类型
    const rand = Math.random();
    let actionType = '';
    
    if (rand < 0.40) {
      actionType = 'message';
    } else if (rand < 0.70) {
      actionType = 'diary';
    } else {
      actionType = 'homeBoard';
    }

    // 声明外层变量，供分支外使用
    let character = null;
    let generatedId = null;

    if (actionType === 'message') {
      const allChats = await db.chats.toArray();
      if (allChats.length > 0) {
        // 随机选择一个对话实体
        const selectedChat = allChats[Math.floor(Math.random() * allChats.length)];
        
        // 寻找对应开启了主动消息的角色
        character = activeCharacters.find(c => c.id === selectedChat.characterId);
        if (!character) {
          // 兜底找一下任意该角色数据
          character = await db.characters.get(selectedChat.characterId);
        }

        if (character) {
          console.log(`[AutoScheduler] 决定在聊天窗 ${selectedChat.title} (ID: ${selectedChat.id}) 中主动发送聊天消息。`);
          generatedId = await generateCompanionProactiveMessage(selectedChat.id);
        } else {
          console.log('[AutoScheduler] 无法定位对应聊天窗的角色设定，降级为生成主页留言。');
          actionType = 'homeBoard';
        }
      } else {
        console.log('[AutoScheduler] 未找到任何对话聊天窗，降级为生成主页留言。');
        actionType = 'homeBoard';
      }
    }

    // 处理日记或主页留言板生成
    if (actionType === 'diary') {
      character = activeCharacters[Math.floor(Math.random() * activeCharacters.length)];
      generatedId = await generateCompanionProactiveDiary(character.id);
    } else if (actionType === 'homeBoard') {
      character = activeCharacters[Math.floor(Math.random() * activeCharacters.length)];
      generatedId = await generateCharacterHomeBoardMessage(character.id);
    }

    // 只有确实生成成功后，才更新冷却时间
    if (generatedId !== null && generatedId !== undefined && character) {
      try {
        await updateLockscreenMediaSession(
          character.name,
          `最新${actionType === 'diary' ? '日记' : (actionType === 'message' ? '消息' : '动态')}: 已更新`
        );
      } catch (err) {
        console.warn(
          '[Lockscreen] 更新锁屏卡片失败，但不影响主动内容的生成：',
          err
        );
      }

      // 更新冷却时间
      const nextCooldownMs = getRandomCooldownMs(frequency);

      await db.settings.put({
        key: 'lastAutoMessageTimestamp',
        value: now
      });

      await db.settings.put({
        key: 'autoMessageCooldownMs',
        value: nextCooldownMs
      });

      await db.settings.put({
        key: 'autoMessageFrequencyApplied',
        value: frequency
      });

      console.log(
        `[AutoScheduler] 已成功触发 ${actionType}：${character.name}；下次最早触发时间约为 ${Math.round(nextCooldownMs / 60000)} 分钟后。`
      );
    } else {
      console.warn(
        `[AutoScheduler] ${actionType} 未能成功触发（可能被发送冷却拦截或网络请求未成功），未更新冷却时间，将在后续轮询中重试。`
      );
    }

  } catch (err) {
    console.error('[AutoScheduler] 主动任务触发失败：', err);
  } finally {
    isAutoMessageTriggering = false;
  }
};

/**
 * 启动后台检查器。
 */
export const startAutoMessageScheduler = () => {
  if (autoMessageSchedulerTimer) return;

  // 应用启动时立即自检一次
  void checkAndTriggerAutoMessage();

  autoMessageSchedulerTimer = setInterval(() => {
    void checkAndTriggerAutoMessage();
  }, 15 * 60 * 1000);

  console.log('[AutoScheduler] AI 主动消息调度器已启动。');
};

/**
 * 停止后台检查器。
 */
export const stopAutoMessageScheduler = () => {
  if (!autoMessageSchedulerTimer) return;

  clearInterval(autoMessageSchedulerTimer);
  autoMessageSchedulerTimer = null;

  console.log('[AutoScheduler] AI 主动消息调度器已停止。');
};

const buildUserReturnContext = (messages) => {
  const userMessages = messages
    .filter((message) => (
      message.sender === 'user' &&
      message.type !== 'error' &&
      message.timestamp
    ));

  if (userMessages.length < 2) {
    return '';
  }

  const latestUserMessage = userMessages[userMessages.length - 1];
  const previousUserMessage = userMessages[userMessages.length - 2];

  const latestTime = new Date(latestUserMessage.timestamp).getTime();
  const previousTime = new Date(previousUserMessage.timestamp).getTime();

  if (Number.isNaN(latestTime) || Number.isNaN(previousTime)) {
    return '';
  }

  const elapsedMs = latestTime - previousTime;

  // 时间异常、间隔过短时无需提及，避免 AI 对每一句话都问候。
  if (elapsedMs < 30 * 60 * 1000) {
    return '';
  }

  const totalMinutes = Math.floor(elapsedMs / (60 * 1000));

  let elapsedText = '';

  if (totalMinutes < 60) {
    elapsedText = `大约 ${totalMinutes} 分钟`;
  } else if (totalMinutes < 24 * 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    elapsedText = minutes >= 15
      ? `大约 ${hours} 小时 ${minutes} 分钟`
      : `大约 ${hours} 小时`;
  } else {
    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingHours = Math.floor((totalMinutes % (24 * 60)) / 60);

    elapsedText = remainingHours >= 6
      ? `大约 ${days} 天 ${remainingHours} 小时`
      : `大约 ${days} 天`;
  }

  return `
【用户再次出现的时间线索】
- 用户距离上一次发来消息，已过去约 ${elapsedText}。
- 这是可自然使用的情境线索，而不是每次都必须复述的信息。
- 若这段间隔对当前语境有意义，你可以结合角色设定、用户近期状态与当前话题，自然表达关心、询问近况，或分享这段时间里自己想说的话。
- 不要机械地逐字复述“你离开了多久”，不要因此责备、质问、制造压力，也不要每次都以此作为回复开头。
- 若用户明确说明了离开的原因，应以用户说明为准，不要重复追问。
`;
};

export const triggerCompanionshipResponse = async ({
  session,
  companionshipAuthorization = null,
  onEvent,
}) => {

  const chatId = session?.chatId;

  if (!chatId) {
    return {
      error: true,
      code: 'COMPANIONSHIP_CHAT_MISSING',
      message: '长期陪伴没有绑定聊天框。',
    };
  }

  const chat = await db.chats.get(chatId);

  if (!chat) {
    return {
      error: true,
      code: 'COMPANIONSHIP_CHAT_NOT_FOUND',
      message: '找不到长期陪伴绑定的聊天框。',
    };
  }

  const character = await db.characters.get(chat.characterId);

  if (!character) {
    return {
      error: true,
      code: 'COMPANIONSHIP_CHARACTER_NOT_FOUND',
      message: '找不到聊天框对应的角色。',
    };
  }

  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  const recentMsgs = await db.messages
    .where('chatId')
    .equals(chatId)
    .sortBy('timestamp');

  const historyContext = buildHistoryContext(
    recentMsgs
      .filter((message) => message.type !== 'error')
      .slice(-15),
  );

  const latestUserMessage = [...recentMsgs]
    .reverse()
    .find((message) => (
      message.sender === 'user'
      && message.type !== 'error'
      && typeof message.content === 'string'
      && message.content.trim()
    ));

  const memoryContext = await getSafeChatMemoryContext({
    chatId,
    userText: latestUserMessage?.content || '',
    recentMessages: recentMsgs,
  });

  const characterEmotionContext = await getSafeCharacterEmotionContext({
    chatId,
    characterId: character.id,
  });

  let systemPrompt = await buildChatSystemPrompt(
    chatId,
    chat,
    character,
  );

  if (
    character.voiceProfile?.enabled
    && character.voiceProfile?.aiMaySendVoice
  ) {
    systemPrompt += buildRealVoiceDecisionInstruction(character);
  }

  const companionshipPrompt = buildCompanionshipPrompt({
    goal: session.goal,
    durationMinutes: session.durationMinutes,
    intervalMinutes: session.intervalMinutes,
  });

  const finalSystemPrompt = `
${systemPrompt}
${memoryContext}
${characterEmotionContext}
${companionshipPrompt}
`;

  const mcpTraceSession = createMcpChatTraceSession({
    chatId,
    characterId: character.id,
  });

  /*
   * 这里先使用现有普通 MCP 审批函数。
   *
   * 下一步在 aiToolOrchestrator / mcpRuntimeService 增加
   * companionshipAuthorization 后，再替换为临时会话授权。
   */
  const result = await runAiToolOrchestrator({
    systemPrompt: finalSystemPrompt,
    historyContext,
    apiConfig,
    chatId,
    characterId: character.id,
    source: 'companionship',
    requestAiCompletion: fetchAiCompletionWithTools,
    requestToolApproval: requestMcpToolApproval,
    mcpTraceSession,
     companionshipAuthorization,
  });

  if (result?.error) {
    await onEvent?.({
      type: 'error',
      title: '陪伴暂时停顿',
      content: result.message || '这一次没有顺利完成。',
      metadata: {
        source: 'companionship',
        errorCode: result.code,
      },
    });

    return result;
  }

  const rawContent = String(result.content || '').trim();

  if (rawContent.includes('[[COMPANIONSHIP_SILENT]]')) {
    const mcpTrace = getMcpChatTraceSummary(mcpTraceSession);

    await onEvent?.({
      type: 'silent',
      title: '这一刻没有打扰你',
      content: '陪伴仍在继续。',
      metadata: {
        source: 'companionship',
        decision: 'silent',
        mcpTrace,
      },
    });

    return {
      ...result,
      decision: 'silent',
      mcpTrace,
    };
  }

  const {
    content: visibleReplyContent,
  } = extractScheduledMessageDirective(rawContent);

  const parsedMessages = await parseAiResponseToMessages(
    visibleReplyContent,
  );

  const parsedOrFallbackMessages = parsedMessages.length > 0
    ? parsedMessages
    : visibleReplyContent
      ? [{
          type: 'text',
          content: visibleReplyContent,
          metadata: {},
        }]
      : [];

  const safeParsedMessages = applyRealVoiceIntent(
    parsedOrFallbackMessages,
    character.voiceProfile,
  );

  const mcpTrace = getMcpChatTraceSummary(mcpTraceSession);
  const messageIds = [];
  const nowIso = new Date().toISOString();

  for (const [messageIndex, msgData] of safeParsedMessages.entries()) {
    const metadata = {
      ...(msgData.metadata || {}),
      source: 'companionship',
      companionshipSessionId: session.id,
      ...(messageIndex === 0 && mcpTrace
        ? { mcpTrace }
        : {}),
    };

    const messagePayload = {
      chatId,
      characterId: character.id,
      sender: 'character',
      type: msgData.type || 'text',
      content: msgData.content || '',
      metadata,
      versions: [{
        type: msgData.type || 'text',
        content: msgData.content || '',
        metadata,
        timestamp: nowIso,
      }],
      currentVersionIndex: 0,
      isRead: false,
      timestamp: nowIso,
    };

    const messageId = await db.messages.add(messagePayload);

    messageIds.push(messageId);

    await onEvent?.({
      type: msgData.type === 'realVoice' ? 'voice' : 'assistant',
      title: msgData.type === 'realVoice'
        ? '语音留在这里'
        : character.name || '陪伴消息',
      content: msgData.content || '',
      metadata: {
        source: 'companionship',
        companionshipSessionId: session.id,
        messageId,
      },
    });
  }

  /*
   * 复用现有 MiniMax 语音流程。
   * 这里不能删，也不能改成自己 fetch MiniMax。
   */
  try {
    const realVoiceMessageIds = await createRealVoiceMessagesForReply({
      chatId,
      character,
      sourceMessages: safeParsedMessages,
    });

    messageIds.push(...realVoiceMessageIds);

    for (const messageId of realVoiceMessageIds) {
      const voiceMessage = await db.messages.get(messageId);

      await onEvent?.({
        type: 'voice',
        title: '语音已经准备好',
        content: voiceMessage?.content || '语音消息',
        metadata: {
          source: 'companionship',
          companionshipSessionId: session.id,
          messageId,
          generationStatus: voiceMessage?.metadata?.generationStatus,
        },
      });
    }
  } catch (error) {
    console.warn(
      '[Companionship] MiniMax 语音生成失败，保留文字回复：',
      error,
    );

    await onEvent?.({
      type: 'error',
      title: '声音没有顺利生成',
      content: '文字陪伴已经留下，语音这次没有完成。',
      metadata: {
        source: 'companionship',
        errorMessage: error?.message || '语音生成失败',
      },
    });
  }

  await db.chats.update(chatId, {
    updatedAt: nowIso,
  });

  if (messageIds.length > 0) {
    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.avatar || '',
      preview: safeParsedMessages.find(
        (message) => message.type === 'text',
      )?.content || '陪伴留下了一点动静',
      messageIds,
      timestamp: nowIso,
      isCurrentPageVisible: isDocumentVisible(),
      source: 'companionship',
    });
  }

  const finalTrace = getMcpChatTraceSummary(mcpTraceSession);

  return {
    error: false,
    decision: messageIds.length > 0 ? 'active' : 'silent',
    messageIds,
    mcpTrace: finalTrace,
  };
};



export const triggerAiResponse = async (chatId) => {
  if (!chatId || activeAiRequests.has(chatId)) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const character = await db.characters.get(chat.characterId);
  if (!character) return;

  activeAiRequests.add(chatId);
  notifyListeners({ type: 'AI_TYPING_START', chatId });

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    let systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

if (character.voiceProfile?.enabled && character.voiceProfile?.aiMaySendVoice) {
  systemPrompt += buildRealVoiceDecisionInstruction(character);
}


    const recentMsgs = await db.messages
  .where('chatId')
  .equals(chatId)
  .sortBy('timestamp');
const userReturnContext = buildUserReturnContext(recentMsgs);

const historyContext = buildHistoryContext(
  recentMsgs
    .filter((message) => message.type !== 'error')
    .slice(-15)
);

const latestUserMessage = [...recentMsgs]
  .reverse()
  .find((message) => (
    message.sender === 'user' &&
    message.type !== 'error' &&
    typeof message.content === 'string' &&
    message.content.trim()
  ));

const memoryContext = await getSafeChatMemoryContext({
  chatId,
  userText: latestUserMessage?.content || '',
  recentMessages: recentMsgs
});

const characterEmotionContext = await getSafeCharacterEmotionContext({
  chatId,
  characterId: character.id
});

const finalSystemPrompt = `${
  systemPrompt
}${userReturnContext}${memoryContext}${characterEmotionContext}`;


const mcpTraceSession = createMcpChatTraceSession({
  chatId,
  characterId: character.id,
});


const result = await runAiToolOrchestrator({
  systemPrompt: finalSystemPrompt,
  historyContext,
  apiConfig,
  chatId,
  characterId: character.id,
  requestAiCompletion: fetchAiCompletionWithTools,
  requestToolApproval: requestMcpToolApproval,
    mcpTraceSession,
});



    const nowIso = new Date().toISOString();

    let messageIds = [];
    let preview = '';

    if (result.error) {
      const errorMessageId = await saveAiErrorMessage(chatId, character, result);

      messageIds = [errorMessageId];
      preview = '请求未成功抵达';

      notifyListeners({
        type: 'AI_RESPONSE_ERROR',
        chatId,
        characterId: character.id,
        characterName: character.name,
        message: result.message,
        errorCode: result.code
      });
    } else {
     const {
  content: visibleReplyContent,
  schedule: scheduledMessage
} = extractScheduledMessageDirective(result.content);

const parsedMessages = await parseAiResponseToMessages(
  visibleReplyContent
);

const mcpTrace = getMcpChatTraceSummary(
  mcpTraceSession,
);


const parsedOrFallbackMessages = parsedMessages.length > 0
  ? parsedMessages
  : visibleReplyContent
    ? [{
        type: 'text',
        content: visibleReplyContent,
        metadata: {},
      }]
    : [];

const safeParsedMessages = applyRealVoiceIntent(
  parsedOrFallbackMessages,
  character.voiceProfile,
);



for (const [messageIndex, msgData] of safeParsedMessages.entries()) {
        const newMessagePayload = {
          chatId,
          characterId: character.id,
          sender: 'character',
          type: msgData.type || 'text',
          content: msgData.content || '',
         metadata: {
  ...(msgData.metadata || {}),
  ...(messageIndex === 0 && mcpTrace
    ? { mcpTrace }
    : {}),
},

          versions: [
            {
              type: msgData.type || 'text',
              content: msgData.content || '',
            metadata: {
  ...(msgData.metadata || {}),
  ...(messageIndex === 0 && mcpTrace
    ? { mcpTrace }
    : {}),
},

              timestamp: nowIso
            }
          ],
          currentVersionIndex: 0,
          isRead: false,
          timestamp: nowIso
        };

        const newMessageId = await db.messages.add(newMessagePayload);
        messageIds.push(newMessageId);
      }
      try {
  const realVoiceMessageIds = await createRealVoiceMessagesForReply({
    chatId,
    character,
    sourceMessages: safeParsedMessages,
  });

  messageIds.push(...realVoiceMessageIds);
} catch (realVoiceError) {
  // 真实声音失败不能影响已经正常保存的文字回复。
  console.warn('[RealVoice] 本次声音留笺跳过：', realVoiceError);
}


            // AI 仅在本次正常回复中明确留下有效预约指令时，
      // 才创建稍后联系计划。该指令不会出现在用户可见气泡中。
      if (scheduledMessage && messageIds.length > 0) {
        try {
          await createScheduledMessage({
  chatId,
  characterId: character.id,
  delayMinutes: scheduledMessage.delayMinutes,
  intent: scheduledMessage.intent,
  scheduleType: scheduledMessage.scheduleType,
  cancelPolicy: scheduledMessage.cancelPolicy
});

        } catch (scheduleError) {
          // 预约失败不能影响当前已经成功写入的正常聊天回复。
          console.warn(
            '[ScheduledMessage] 创建对话预约失败，但当前回复已正常保存：',
            scheduleError
          );
        }
      }


      preview = safeParsedMessages.find((message) => message.type === 'text')?.content
        || safeParsedMessages[0]?.content
        || '发来了一条消息';
    }

    await db.chats.update(chatId, {
      updatedAt: nowIso
    });
    // AI 回复成功后播放接收消息音效
if (!result.error) {
  playMessageSound('receive');
}


    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.avatar || '',
      preview,
      messageIds,
      timestamp: nowIso,
      isCurrentPageVisible: isDocumentVisible()
    });

    if (!isDocumentVisible()) {
      triggerSystemNotification(
        `${character.name} 发来消息`,
        preview,
        character.avatar
      );
    }

    // 只有真实 AI 回复成功时，才触发自动总结。
if (!result.error) {
  void checkAndTriggerAutoSummary(chatId, character, apiConfig);

  void markCharacterInteraction({
    chatId,
    characterId: character.id
  }).catch((error) => {
    console.warn(
      '[Memory] Character state settlement skipped safely:',
      error
    );
  });

  // 记忆整理是独立、延迟、非阻塞的后台任务。
  // 它不写入聊天消息，也不会影响当前回复。
  void scheduleMemoryProcessing(chatId);
}


  } catch (err) {
    console.error('Background AI task error:', err);

    notifyListeners({
      type: 'AI_RESPONSE_ERROR',
      chatId,
      characterId: character.id,
      characterName: character.name,
      message: '这一次回应没有顺利抵达，请稍后再试。'
    });
  } finally {
    activeAiRequests.delete(chatId);
    notifyListeners({ type: 'AI_TYPING_END', chatId });
  }
};

// 重新生成（重 roll）指定角色消息。
// 每次重 roll 会保留旧版本，并将新版本设为当前展示版本。
export const rerollAiResponse = async (chatId, messageId) => {
  if (!chatId || !messageId || activeAiRequests.has(chatId)) return;

  const targetMsg = await db.messages.get(messageId);

  if (!targetMsg || targetMsg.sender !== 'character') {
    return;
  }

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const character = await db.characters.get(chat.characterId);
  if (!character) return;

  activeAiRequests.add(chatId);
  notifyListeners({ type: 'AI_TYPING_START', chatId });

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

    const allMessages = await db.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

    const targetIndex = allMessages.findIndex((message) => message.id === messageId);

    // 重 roll 时只使用该消息之前的上下文，不带入原回复及后续内容。
    const historyMessages = targetIndex >= 0
      ? allMessages.slice(0, targetIndex)
      : allMessages;

  const historyContext = buildHistoryContext(
  historyMessages
    .filter((message) => message.type !== 'error')
    .slice(-15)
);

const latestUserMessage = [...historyMessages]
  .reverse()
  .find((message) => (
    message.sender === 'user' &&
    message.type !== 'error' &&
    typeof message.content === 'string' &&
    message.content.trim()
  ));


const memoryContext = await getSafeChatMemoryContext({
  chatId,
  userText: latestUserMessage?.content || '',
  recentMessages: historyMessages
});

const characterEmotionContext = await getSafeCharacterEmotionContext({
  chatId,
  characterId: character.id
});

const finalSystemPrompt = `${
  systemPrompt
}${memoryContext}${characterEmotionContext}`;


const mcpTraceSession = createMcpChatTraceSession({
  chatId,
  characterId: character.id,
});


const result = await runAiToolOrchestrator({
  systemPrompt: finalSystemPrompt,
  historyContext,
  apiConfig,
  chatId,
  characterId: character.id,
  requestAiCompletion: fetchAiCompletionWithTools,
  requestToolApproval: requestMcpToolApproval,
  mcpTraceSession,
});



    const nowIso = new Date().toISOString();

    const currentVersions = Array.isArray(targetMsg.versions) && targetMsg.versions.length > 0
      ? [...targetMsg.versions]
      : [{
          type: targetMsg.type || 'text',
          content: targetMsg.content || '',
          metadata: targetMsg.metadata || {},
          timestamp: targetMsg.timestamp || nowIso
        }];

    let newVersion;

    if (result.error) {
      newVersion = {
        type: 'error',
        content: result.message,
        metadata: {
          errorCode: result.code,
          errorMessage: result.message
        },
        errorCode: result.code,
        errorMessage: result.message,
        timestamp: nowIso
      };
      } else {
      const parsed = await parseAiResponseToMessages(
        result.content,
      );

      const mcpTrace = getMcpChatTraceSummary(
        mcpTraceSession,
      );

      const firstMessage = parsed[0] || {
        type: 'text',
        content: result.content,
        metadata: {},
      };


      newVersion = {
        type: firstMessage.type || 'text',
        content: firstMessage.content || '',
        metadata: firstMessage.metadata || {},
        timestamp: nowIso
      };
    }

    currentVersions.push(newVersion);

    await db.messages.update(messageId, {
      type: newVersion.type,
      content: newVersion.content,
      metadata: newVersion.metadata || {},
      versions: currentVersions,
      currentVersionIndex: currentVersions.length - 1,
      timestamp: nowIso
    });

    await db.chats.update(chatId, {
      updatedAt: nowIso
    });

    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.avatar || '',
      preview: newVersion.type === 'error'
        ? '重新生成未成功'
        : newVersion.content || '已重新生成回复',
      messageIds: [messageId],
      timestamp: nowIso,
      isReroll: true,
      isCurrentPageVisible: isDocumentVisible()
    });

    if (result.error) {
      notifyListeners({
        type: 'AI_RESPONSE_ERROR',
        chatId,
        characterId: character.id,
        characterName: character.name,
        message: result.message,
        errorCode: result.code,
        isReroll: true
      });
    }
  } catch (err) {
    console.error('Reroll failed:', err);

    if (!result.error) {
  void markCharacterInteraction({
    chatId,
    characterId: character.id
  }).catch((error) => {
    console.warn(
      '[Memory] Character state settlement skipped safely:',
      error
    );
  });

  void scheduleMemoryProcessing(chatId);
}


    notifyListeners({
      type: 'AI_RESPONSE_ERROR',
      chatId,
      characterId: character.id,
      characterName: character.name,
      message: '重新生成失败，请稍后再试。',
      isReroll: true
    });
  } finally {
    activeAiRequests.delete(chatId);
    notifyListeners({ type: 'AI_TYPING_END', chatId });
  }
};


/**
 * 针对某一封用户日记，在信末生成/更新伴侣的嵌入回执
 */
export const generateCompanionReplyForDiary = async (diaryId) => {
  const diary = await db.diaries.get(diaryId);
  if (!diary) return null;

  let character = null;
  let chat = null;

  if (diary.chatId) {
    chat = await db.chats.get(diary.chatId);
  }

  if (diary.characterId) {
    character = await db.characters.get(diary.characterId);
  } else if (chat) {
    character = await db.characters.get(chat.characterId);
  } else {
    const allChars = await db.characters.toArray();
    if (allChars.length > 0) {
      character = allChars[Math.floor(Math.random() * allChars.length)];
    }
  }

  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    const realTimeStr = getFormattedRealTime();

    let companionReplyText = `${character.name} 认真阅读了你的信件，并在信末为你留下了温存的心意回应。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

      const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设】：${character.userPersona || '我的亲密伴侣'}

【用户撰写给你的信件/日记内容】：
标题: ${diary.title || '无题'}
心绪: ${diary.mood || '平实'}
天气: ${diary.weather || '温朗'}
正文: ${diary.content}

【任务要求】：
请以陪伴者/伴侣的口吻，在用户这封信的底部写下一段真诚、温柔、浪漫的伴侣心绪回执。
1. 字数控制在 100 至 250 字。
2. 针对用户提及的琐事与心绪，给予真挚的共情与关注。
3. 绝对禁止在输出文本中出现任何 Emoji 字符！
4. 直接输出回执正文，不需要任何额外的前缀。`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请在我的信纸末尾写下你的伴侣回执。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        companionReplyText = data.choices?.[0]?.message?.content?.trim() || companionReplyText;
      }
    }

    const companionReplyObj = {
      characterId: character.id,
      characterName: character.name,
      avatar: character.avatar || '',
      replyText: companionReplyText,
      timestamp: new Date().toISOString()
    };

    await db.diaries.update(diaryId, {
      characterId: character.id,
      companionReply: companionReplyObj
    });

    triggerSystemNotification(
      `${character.name} 回复了你的心绪信件`,
      companionReplyText.substring(0, 45) + '...',
      character.avatar
    );

    return companionReplyObj;
  } catch (err) {
    console.error('Failed to generate companion reply for diary:', err);
    return null;
  }
};

/**
 * 伴侣主动在具体的聊天窗口 (chatId) 中发送消息
 * 基于该聊天窗口的特定上下文、专属人设和总提示词 (systemPrompt) 组装
 */
export const generateCompanionProactiveMessage = async (chatId) => {
  if (!chatId) return null;

  try {
    const chat = await db.chats.get(chatId);
    if (!chat) return null;

    const character = await db.characters.get(chat.characterId);
    if (!character) return null;

    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      console.warn('[ProactiveMessage] API 未配置，无法生成主动聊天消息。');
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

    // 1. 获取近期聊天记录上下文（获取最后 15 条消息作为短期记忆）
    const msgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
    const recentMessages = msgs.slice(-15);
    
    // 如果最后一条消息已经是 AI 刚才发的，或者距离最后一条消息发送还没有过去 5 分钟，
    // 我们暂时不打扰，避免连发两条 AI 消息显得不够真实。
    if (recentMessages.length > 0) {
      const lastMsg = recentMessages[recentMessages.length - 1];
      if (lastMsg.sender === 'character') {
        console.log(`[ProactiveMessage] 聊天窗 ${chatId} 最后一条消息已由伴侣发送，跳过主动发送。`);
        return null;
      }
      const timeDiff = Date.now() - new Date(lastMsg.timestamp).getTime();
      if (timeDiff < 5 * 60 * 1000) {
        console.log(`[ProactiveMessage] 距离用户最后一次活动不足 5 分钟，暂不打扰。`);
        return null;
      }
    }

// 2. 主动消息也使用与普通回复一致的历史格式。
// 过滤错误气泡，避免把错误内容送回模型。
const historyPayload = buildHistoryContext(
  recentMessages
    .filter((message) => message.type !== 'error')
    .slice(-15)
);

// 3. 组装当前聊天窗口专属的基础 System Prompt。
const systemPrompt = await buildChatSystemPrompt(
  chatId,
  chat,
  character
);

// 4. 找到最近一条有效用户消息，作为记忆相关性检索线索。
const latestUserMessage = [...recentMessages]
  .reverse()
  .find((message) => (
    message.sender === 'user' &&
    message.type !== 'error' &&
    typeof message.content === 'string' &&
    message.content.trim()
  ));

// 5. 主动消息也读取当前 chatId 的长期记忆。
// getSafeChatMemoryContext 内部已安全降级：
// 记忆读取失败不会阻塞主动消息。
const memoryContext = await getSafeChatMemoryContext({
  chatId,
  userText: latestUserMessage?.content || '',
  recentMessages
});

// 6. 主动发送场景的微指引。
const autoSendGuide = `
【注意：这是你作为伴侣的主动发起的对话触达】
由于用户有一段时间没有说话了，请你基于当下的时间背景（${getFormattedRealTime()}），结合你们之前的聊天上下文，主动给用户发一条问候、分享一下你此刻在做的事情、或者延续之前的某个话题。

要求：
- 直接发信，不要表现出系统正在调用你。
- 回复要轻柔、贴心，不要带有客服味道，更不要使用 Emoji。
- 只在自然相关时使用共同记忆，不要逐条复述，也不要让用户感到被监控。
- 字数控制在 100 字以内。
`;

const characterEmotionContext = await getSafeCharacterEmotionContext({
  chatId,
  characterId: character.id
});

const finalSystemPrompt = `${
  systemPrompt
}${memoryContext}${characterEmotionContext}${autoSendGuide}`;


const finalMessages = [
  {
    role: 'system',
    content: finalSystemPrompt
  },
  ...historyPayload
];


    // 如果历史记录为空，提供一个初始 user 提示，引导 AI 发起第一句话
    if (finalMessages.length === 1) {
      finalMessages.push({ role: 'user', content: '（我们在安静的房间里，你主动对我说第一句话）' });
    }

    // 开启打字动画状态
    notifyListeners({ chatId, type: 'AI_TYPING_START' });

        const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: finalMessages,
        temperature: 0.8,

        // 主动消息要求最多 80 字，但不能让服务端默认 token 上限
        // 在一句话中间切断。300 tokens 足够容纳正常中文消息、
        // 卡片语法与少量模型输出冗余。
        max_tokens: 1000
      })
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }

    const data = await res.json();

    const finishReason = data?.choices?.[0]?.finish_reason;
    const replyText = String(
      data?.choices?.[0]?.message?.content || ''
    ).trim();

    // 如果这里打印 length，说明此前确实是 API 输出长度限制导致截断。
    if (finishReason === 'length') {
      console.warn(
        '[ProactiveMessage] AI 输出因 token 长度限制而结束。'
      );
    }

    if (!replyText) {
      console.warn('[ProactiveMessage] AI 返回了空内容，未创建消息。');
      return null;
    }

    const parsedMessages = await parseAiResponseToMessages(replyText);

    // 当 AI 返回的内容不含普通文本、或卡片解析未得到结果时，
    // 必须保留原始回复，避免“AI 已回复但数据库没有可显示文本”。
    const proactiveMessages = parsedMessages.length > 0
      ? parsedMessages
      : [
          {
            type: 'text',
            content: replyText,
            metadata: {}
          }
        ];

    const nowIso = new Date().toISOString();
    const insertedMessageIds = [];

    await db.transaction('rw', db.messages, db.chats, async () => {
      for (const item of proactiveMessages) {
        const type = item?.type || 'text';
        const content = String(item?.content || '').trim();
        const metadata = item?.metadata || {};

        // 空文本没有任何视觉内容，不能创建空气泡。
        // 非文本卡片可由自己的 metadata 提供实际内容。
        if (type === 'text' && !content) {
          continue;
        }

        const payload = {
          chatId,
          characterId: chat.characterId,
          sender: 'character',
          type,
          content,
          metadata,

          // 与普通 AI 回复统一，保证以后重 roll、
          // 版本切换以及历史数据读取都兼容。
          versions: [
            {
              type,
              content,
              metadata,
              timestamp: nowIso
            }
          ],
          currentVersionIndex: 0,

          isRead: false,
          timestamp: nowIso
        };

        const insertedId = await db.messages.add(payload);
        insertedMessageIds.push(insertedId);
      }

      if (insertedMessageIds.length > 0) {
        await db.chats.update(chatId, {
          updatedAt: nowIso
        });
      }
    });

    if (insertedMessageIds.length === 0) {
      console.warn(
        '[ProactiveMessage] 未得到可展示的消息内容，未发送空白气泡。'
      );
      return null;
    }

    void markCharacterInteraction({
  chatId,
  characterId: character.id
}).catch((error) => {
  console.warn(
    '[Memory] Character state settlement skipped safely:',
    error
  );
});

void scheduleMemoryProcessing(chatId);


    playMessageSound('receive');

    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.avatar || '',
      messageIds: insertedMessageIds,
      preview: proactiveMessages.find((message) => message.type === 'text')
        ?.content || proactiveMessages[0]?.content || '发来了一条消息',
      timestamp: nowIso,
      isCurrentPageVisible: isDocumentVisible()
    });

    return insertedMessageIds[insertedMessageIds.length - 1];


  } catch (err) {
    console.error('[ProactiveMessage] AI 主动发送聊天消息失败:', err);
    return null;
  } finally {
    // 结束打字动画状态
    notifyListeners({ chatId, type: 'AI_TYPING_END' });
  }
};

/**
 * 伴侣主动撰写独立日记 (author: 'character')
 */
export const generateCompanionProactiveDiary = async (chatId = null) => {
  let chat = null;
  let character = null;

  if (chatId) {
    chat = await db.chats.get(chatId);
    if (chat) {
      character = await db.characters.get(chat.characterId);
    }
  }

  if (!character) {
    const allChats = await db.chats.toArray();
    if (allChats.length > 0) {
      chat = allChats[Math.floor(Math.random() * allChats.length)];
      character = await db.characters.get(chat.characterId);
    } else {
      const allChars = await db.characters.toArray();
      if (allChars.length > 0) {
        character = allChars[0];
      }
    }
  }

  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    const realTimeStr = getFormattedRealTime();

    let diaryTitle = `${character.name} 的独立心绪留痕`;
    let diaryMood = '静谧关怀';
    let diaryWeather = '月色温柔 19℃';
    let diaryContent = `提笔落墨的时刻，忽然想起了与你相处的片段。在属于现实世界的静谧时空中，愿这份文字能给你带来陪伴。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

      let recentChatText = '';
      if (chat) {
        const msgs = await db.messages.where('chatId').equals(chat.id).sortBy('timestamp');
        recentChatText = msgs.slice(-10).map(m => `${m.sender === 'user' ? '用户' : character.name}: ${m.content}`).join('\n');
      }

      const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设】：${character.userPersona || '我的亲密伴侣'}
【与用户的近期互动记录】:\n${recentChatText}

【任务要求】：
请以陪伴者/伴侣的独立视角，主动撰写一封留给用户的专属心绪日记。
1. 日记必须包含：标题、心绪简述、天气简述、正文（150-300字）。
2. 文风保持浪漫文学感、细腻深情。
3. 绝对禁止在输出文本中出现任何 Emoji 字符！
4. 请严格按照 JSON 格式输出，不要附加 Markdown 外包装，格式：
{
  "title": "日记标题",
  "mood": "心绪标签(如: 微醺的思念)",
  "weather": "天气描述(如: 晚风渐起 20℃)",
  "content": "日记正文内容..."
}`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请撰写一封属于你的伴侣主动日记。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.choices?.[0]?.message?.content?.trim();
        if (rawJson) {
          try {
            const parsed = JSON.parse(rawJson);
            diaryTitle = parsed.title || diaryTitle;
            diaryMood = parsed.mood || diaryMood;
            diaryWeather = parsed.weather || diaryWeather;
            diaryContent = parsed.content || diaryContent;
          } catch (e) {
            diaryContent = rawJson.replace(/```json|```/g, '').trim();
          }
        }
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const payload = {
      chatId: chat ? chat.id : null,
      characterId: character.id,
      author: 'character',
      title: diaryTitle,
      mood: diaryMood,
      weather: diaryWeather,
      content: diaryContent,
      companionReply: null,
      images: [],
      date: todayStr,
      timestamp: Date.now()
    };

    delete payload.id;
    const newId = await db.diaries.add(payload);

    notifyListeners({
      type: 'NEW_DIARY_ENTRY',
      chatId: chat ? chat.id : null,
      characterId: character.id,
      diaryId: newId
    });

    triggerSystemNotification(
      `${character.name} 写下了一篇伴侣日记`,
      `《${diaryTitle}》: ${diaryContent.substring(0, 40)}...`,
      character.avatar
    );

    return newId;
  } catch (err) {
    console.error('Failed to generate companion proactive diary:', err);
    return null;
  }
};


const checkAndTriggerAutoSummary = async (chatId, character, apiConfig) => {
  const freq = parseInt(character.summaryFrequency || '10', 10);
  const msgCount = await db.messages.where('chatId').equals(chatId).count();

  if (msgCount > 0 && msgCount % (freq * 2) === 0) {
    notifySummaryStatus(chatId, true);

    try {
      if (apiConfig.baseUrl && apiConfig.apiKey) {
        const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
        const msgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
        const recentHistory = msgs.slice(-20).map(m => `${m.sender === 'user' ? '用户' : character.name}: ${m.content}`).join('\n');

        const summaryRes = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: apiConfig.model || 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: '你是一个客观记录者。请用 1-2 句简练客观的陈述语句总结以下对话中的最新关键事实、用户近况或约定事项。绝对不要掺杂浪漫感叹或主观情感评价。'
              },
              { role: 'user', content: recentHistory }
            ]
          })
        });

        if (summaryRes.ok) {
          const data = await summaryRes.json();
          const summaryText = data.choices?.[0]?.message?.content?.trim();
          if (summaryText) {
            const currentChat = await db.chats.get(chatId);
            let summaryList = Array.isArray(currentChat.summary) ? currentChat.summary : [];
            if (typeof currentChat.summary === 'string' && currentChat.summary.trim()) {
              summaryList = [{ id: 'legacy', content: currentChat.summary, createdAt: '历史', isAuto: true }];
            }

            const nowStr = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

            const newEntry = {
              id: `sum_${Date.now()}`,
              content: summaryText,
              createdAt: nowStr,
              isAuto: true
            };

            const updatedSummaryList = [...summaryList, newEntry];
            await db.chats.update(chatId, { summary: updatedSummaryList });
            notifyListeners({ type: 'CHAT_SUMMARY_UPDATED', chatId, summary: updatedSummaryList });
          }
        }
      }
    } catch (err) {
      console.error('Auto summary failed:', err);
    } finally {
      notifySummaryStatus(chatId, false);
    }
  }
};

/**
 * Snapshots AI 主动 / 邀约发动态 API 真实生成
 */
export const generateSnapshotPostByAi = async (
  characterId,
  topicHint = '',
  linkedChatId = null
) => {
  try {
    const character = await db.characters.get(characterId);
    if (!character) throw new Error('Character not found');

    const apiKeySetting = await db.settings.get('apiKey');
    const baseUrlSetting = await db.settings.get('baseUrl');
    const modelSetting = await db.settings.get('model');

    const apiKey = apiKeySetting?.value;
    const baseUrl = (baseUrlSetting?.value || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = modelSetting?.value || 'gpt-4o-mini';

    if (!apiKey) {
      console.warn('API Key is missing, falling back to static prompt');

      return {
        imagePrompt: `[画面描摹: ${character.name} 在桌前记录下 ${topicHint || '落日余晖'} 的定格瞬间]`,
        content: `今天也想把这份温度分享记录下来。${topicHint || '生活里的细枝末节也很美。'}`,
        location: '日常陪伴角落'
      };
    }

    let characterContext = [
      `角色姓名: ${character.name}`,
      `角色简介: ${character.bio || '无'}`,
      `扩展设定: ${character.extraNotes || '无'}`
    ].join('\n');

    if (character.statusList && character.statusList.length > 0) {
      characterContext += `\n当前状态: ${JSON.stringify(character.statusList)}`;
    }

    const enabledWorldBooks = await db.worldBooks
      .where('isEnabled')
      .equals(1)
      .toArray();

    if (enabledWorldBooks.length > 0) {
      characterContext += `\n世界观背景: ${enabledWorldBooks
        .map((worldBook) => worldBook.title)
        .join('; ')}`;
    }

    let chatMemory = '';

    if (linkedChatId) {
      const recentMessages = await db.messages
        .where('chatId')
        .equals(linkedChatId)
        .reverse()
        .limit(6)
        .toArray();

      if (recentMessages.length > 0) {
        chatMemory =
          '\n最近聊天记忆:\n' +
          recentMessages
            .reverse()
            .map((message) => `${message.sender}: ${message.content}`)
            .join('\n');
      }
    }

    const savedPersona = await db.snapshotSettings.get('globalPersona');
    const globalPersonaText = savedPersona?.value || '未设置全局User人设';

    const systemPrompt = `你正在扮演角色 [${character.name}]。你需要在类似 Instagram / 拍立得动态圈中发布一条生活快照动态。

绝对规则：
1. 输出必须是严格的 JSON 格式，包含三个字段：
   - "imagePrompt": 照片画面的细节描摹，包含光影、物件、微观视觉，写得极其有生活触感与文学感，80字以内；
   - "content": 配合照片写下的随感短句，温情、留白、浪漫或幽默，不超过120字；
   - "location": 简短的打卡地点名称，例如：午后书房、街角咖啡馆、晴空下；
2. 绝不包含任何 Emoji 字符；
3. 严格符合你的角色设定。

【当前真实时间】: ${getFormattedRealTime()}

【角色人设信息】:
${characterContext}

【全局 User 人设】:
${globalPersonaText}

${chatMemory
  ? `【近期互动记忆】:\n${chatMemory}`
  : '【注意】: 未关联聊天框，绝对禁止使用聊天历史！仅凭个人设定发布动态。'}`;

    const userPrompt = topicHint
      ? `请围绕主题灵感 “[${topicHint}]” 创作一条拍立得动态。`
      : '请根据你此刻的心境，创作一条拍立得生活动态。';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        imagePrompt: parsed.imagePrompt || '',
        content: parsed.content || '',
        location: parsed.location || ''
      };
    }

    return {
      imagePrompt: `[画面描摹: ${character.name} 记录的日常镜头]`,
      content: rawText.replace(
        /[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]/g,
        ''
      ),
      location: '某处空间'
    };
  } catch (err) {
    console.error('Failed to generate snapshot by AI:', err);

    return {
      imagePrompt: '[画面描摹: 静谧阳光洒在复古桌面上]',
      content: '这一刻的安宁值得被记录。',
      location: '日常生活'
    };
  }
};


/**
 * Snapshots AI 智能生成评论 API
 */
export const generateSnapshotCommentByAi = async (snapshot, commenter) => {
  try {
    const apiKeySetting = await db.settings.get('apiKey');
    const baseUrlSetting = await db.settings.get('baseUrl');
    const modelSetting = await db.settings.get('model');

    const apiKey = apiKeySetting?.value;
    const baseUrl = (baseUrlSetting?.value || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = modelSetting?.value || 'gpt-4o-mini';

    let commenterInfo = '';
    let relationInfo = '常规社交好友/路人';

    if (commenter.type === 'character') {
      const character = await db.characters.get(commenter.data.id);

      if (!character) {
        throw new Error('Commenter character not found');
      }

      commenterInfo = [
        `角色姓名: ${character.name}`,
        `角色简介: ${character.bio || '无'}`,
        `性格扩展: ${character.extraNotes || '无'}`
      ].join('\n');

      if (
        snapshot.characterId &&
        snapshot.characterId !== character.id
      ) {
        const relation = await db.snapshotRelations
          .where('characterId')
          .equals(snapshot.characterId)
          .and((item) => item.targetCharacterId === character.id)
          .first();

        if (relation) {
          relationInfo = `你与动态作者的关系描述为: [${relation.relation}]`;
        }
      }
    } else {
      commenterInfo = `NPC 姓名: ${commenter.data.name}\n身份标签: ${
        commenter.data.roleTag || '路人'
      }`;
    }

    if (!apiKey) {
      return '照片里的光影真的很棒！';
    }

    const systemPrompt = `你正在社交动态圈里为一条拍立得动态撰写评论。

【动态作者】:
${snapshot.authorName}

【动态画面描摹】:
${snapshot.imagePrompt || '无'}

【动态正文】:
${snapshot.content || '无'}

【你的身份/评论者人设】:
${commenterInfo}

【你与作者的关系约束】:
${relationInfo}

绝对规则：
1. 生成一段自然的短评，20至60字以内；
2. 语气可温情、打趣、吐槽、调侃，但绝对不能越界；
3. 非情侣关系的各角色之间严禁出现亲密暧昧语言；
4. 严格禁止出现任何 Emoji 字符；
5. 直接返回评论文本，不要附带引号或额外说明。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    return text.replace(
      /[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]/g,
      ''
    );
  } catch (err) {
    console.error('Failed to generate snapshot comment by AI:', err);
    return '记录得很有味道。';
  }
};



export default {
  subscribeAiEvents,
  subscribeSummaryStatus,
  triggerAiResponse,
  rerollAiResponse,
  generateCharacterHomeBoardMessage,
  generateCompanionReplyForDiary,
  generateCompanionProactiveDiary,
  generateSnapshotPostByAi,
  generateSnapshotCommentByAi,
  requestNotificationPermission,
  triggerSystemNotification,
  playMessageSound,

  // SettingsPage 联动的主动任务调度器
  checkAndTriggerAutoMessage,
  startAutoMessageScheduler,
  stopAutoMessageScheduler,
  generateCompanionProactiveMessage
};
