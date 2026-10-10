import Dexie from 'dexie';
import db from '../db';
import { updateLockscreenMediaSession } from './lockscreenService';
import {
  extractScheduledMessageDirective,
  createScheduledMessage
} from '../apps/messages/scheduledMessageService';
import {
  handleUserActivityWhileAway,
  getAwayOfferNote,
  applyAwayDirective,
} from '../apps/messages/away/awayService';

import {
  getChatMemoryContext,
  getCharacterEmotionContext,
  scheduleMemoryProcessing,
} from './memoryProvider';
import { markCharacterInteraction } from '../apps/memory/memoryCharacterState';
import { checkAbsenceEmotionSignal } from '../apps/memory/characterAbsenceService';
import {
  forceUpdateDiyArea,
  selfUpdateDiyArea,
  containsDiyAreaRequest,
  containsDiySelfUpdateRequest,
  extractDiyInspirations,
  recordDiyInspiration,
  buildDiyPromptBlock,
} from '../apps/messages/diy/diyAreaService';
import {
  startParcelPreparation,
  checkAndDeliverParcel,
  containsParcelStartRequest,
  extractParcelNotes,
  recordParcelNote,
  buildParcelPromptBlock,
} from '../apps/messages/parcel/parcelService';
import {
  generateCompanionProactiveDiary as generateStandaloneDiary} from '../apps/diaries/diaryGenerationService';


import { getLocationPromptContext } from '../apps/location/locationPromptContext';
import { applyPlaceNoteDirective } from '../apps/location/placeMemoryService';
import { getCompanionOfferNote, applyCompanionOfferDirective } from '../apps/companion/companionOfferService';
import { buildCompanionStatusPromptBlock } from '../apps/companion/companionStatusPrompt';
import { buildBubbleStylePromptNote, applyBubbleStyleDirective } from '../apps/messages/bubbleStyleDirective';
import {
  buildScreenEffectPromptNote,
  applyScreenEffectDirective,
  consumePendingScreenEffect,
  collectPendingUserTexts,
  dispatchScreenEffect,
} from '../apps/messages/screenEffects/screenEffectDirective';
import { runScreenEffectSession } from '../apps/messages/screenEffects/screenEffectSession';
import { runBubbleStyleSession } from '../apps/messages/bubbleStyleSession';
import { buildBackgroundSwitchPromptNote, applyBackgroundSwitchDirective } from '../apps/messages/backgroundSwitchDirective';
import { CONFIRM_CARD_PROMPT_NOTE, applyConfirmCardDirective } from '../apps/messages/confirmCardDirective';
import { getAvatarHistorySwitchNote, applyAvatarHistorySwitchDirective } from '../apps/messages/avatarHistoryDirective';
import { WORK_KAOMOJI_PROMPT_NOTE, applyWorkKaomojiDirective } from '../apps/messages/work/workKaomojiDirective';
import { MOOD_BUBBLE_PROMPT_NOTE, applyMoodBubbleDirective } from '../apps/messages/mood/moodBubbleDirective';
import { isHalloweenSeasonActive } from '../apps/messages/interactions/halloween/halloweenSeason';
import { applyMemoirNoteDirective, MEMOIR_NOTE_PROMPT } from '../apps/memoir/memoirNoteDirective';
import {
  recordFoodMemoir,
  recordTransferMemoir,
  recordMcpMemoir,
  backfillMemoirFeeling,
} from '../apps/memoir/memoirService';
import { recordChatAtCurrentPlace } from '../apps/location/placePatternService';
import { extractOfflineInviteDirective } from '../apps/offline/offlineInviteDirective';

import { getReactionLabel } from '../apps/messages/reactionLabels';
import { buildFandomSystemPromptBlock } from '../apps/messages/fandomCharacterPrompt';
import {
  buildLearningModePromptBlock,
  extractBubbleTranslation,
} from '../apps/messages/learningMode/learningModePrompt';
import {
  pickDailyLifeTopic,
  describeDailyLifeTopic,
  getUserInterestMaterial,
  describeUserInterestMaterial,
} from './dailyLifeTopicPicker';
import { getActiveCallAwarenessNote, hasAnyLiveCall } from './callService';
import { getMonthlyBadgeContextForPrompt } from '../apps/badges/monthlyBadgeService';

import {
  proposeOfflineSessionByCharacter,
  getRecentOfflineAwarenessNote,
} from '../apps/offline/offlineSessionService';

import { getSafeInnerWorldPasswordContext } from './innerworld/innerWorldPromptContext';
import { scanBuiltinWorldBook } from '../apps/messages/builtinWorldBook';



import { runAiToolOrchestrator } from './aiToolOrchestrator';
import { describeOrderRequestForPrompt } from '../apps/messages/order/orderRequestPrompt';

import {
  requestMcpToolApproval,
} from './mcp/mcpApprovalCoordinator';

import {
  createMcpChatTraceSession,
  getMcpChatTraceSummary,
} from './mcp/mcpChatTraceService';

import { logChatApiCall } from './apiCallLogService';

import {
  applyRealVoiceIntent,
  buildRealVoiceDecisionInstruction,
  createRealVoiceMessagesForReply,
} from '../features/real-voice/realVoiceCoordinator';
import {
  buildCompanionshipPrompt,
} from '../apps/messages/companionship/companionshipPrompt';
import {
  buildCharacterAnalysisPromptBlock,
} from '../apps/messages/characterAnalysisPrompt';
import { getLoveProfilePromptBlock } from '../apps/messages/loveProfile/loveProfileService';


import {
  getAlmanacPromptContext,
} from '../apps/almanac/services/almanacPromptBuilder';

import { getSharedWorldPromptBlock } from '../apps/shared-world/sharedWorldService';
import { maybeUpdateProfileCard } from '../apps/messages/profile/profileCardService';
import {
  countPendingUserCoupons,
  containsCouponRedeemRequest,
  extractCouponRedeemTitle,
  redeemPendingUserCoupon,
} from '../apps/messages/coupon/couponService';



/*
 * 只靠 messages 表的 [chatId+timestamp] 复合索引，从后往前取最近的一批
 * 消息，而不是把这个聊天框的全部历史都读出来、在内存里排序、再截尾。
 * 后一种写法（db.messages.where('chatId').equals(chatId).sortBy(...)）
 * 的开销跟"这个聊天框总共聊了多少条"成正比——聊得越久，越到后面每次
 * 发消息、每次触发主动消息/自动摘要就越卡，因为每次都要把全部历史
 * 读一遍才能拿到最后那十几条。
 *
 * 这里改成直接从复合索引里倒着取够 limit 条就停，读取量跟聊天框总长度
 * 无关，返回顺序仍然是按时间从旧到新（跟原来 sortBy('timestamp') 的
 * 结果顺序一致），调用方不用跟着改。
 */
// ChatRoom关键词世界书扫描窗口/条数上限——数值跟长RP的
// rpAiService.js（WORLD_BOOK_SCAN_WINDOW/WORLD_BOOK_MAX_ENTRIES）保持
// 一致，两边没有共享同一套机制的必要（RP走自己的historyForContext），
// 但调出来的手感应该一样。
const WORLD_BOOK_SCAN_WINDOW = 6;
const WORLD_BOOK_MAX_ENTRIES = 5;

export const getRecentChatMessages = (chatId, limit) => (
  db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray()
    .then((rows) => rows.reverse())
);

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

export const triggerSystemNotification = async (title, body, icon) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: icon || '/favicon.ico',
      tag: `notice_${Date.now()}`
    });
  } catch (err) {
    console.warn('Triggering system notification failed:', err);
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
  /\[(TRANSFER|VOICE|IMAGE|TODO|GIFT|FOOD|KINSHIP|STICKER|LOCATION|TRICK|DIYAREA_REQUEST|DIYAREA_SELF_UPDATE|DIYAREA_INSPIRATION|PARCEL_START|PARCEL_NOTE|COUPON|COUPON_REDEEM):\s*([^\]]+)\]/g;
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
        // 语言学习模式关闭时，这里永远匹配不到标签，等价于原来的行为；
        // 必须在 ||| 拆完之后逐条摘，翻译才能跟对它所属的那一条气泡。
        const { content: cleanContent, translationText } =
          extractBubbleTranslation(part);

        result.push({
          type: 'text',
          content: cleanContent || part,
          metadata: translationText ? { translationText } : {},
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
} else if (cardType === 'coupon') {
  const parts = rawPayload.split('|');
  result.push({
    type: 'coupon',
    content: (parts[0] || '和好券').trim(),
    metadata: {
      title: (parts[0] || '和好券').trim(),
      note: (parts[1] || '兑换一次专属的好意。').trim(),
      status: 'pending',
      redeemedAt: null,
    }
  });
} else if (cardType === 'location') {
  // 位置卡片：[LOCATION: 地点名称 | 附加感想(可选)]
  const parts = rawPayload.split('|');

  result.push({
    type: 'location',
    content: (parts[0] || '未知地点').trim(),
    metadata: {
      name: (parts[0] || '未知地点').trim(),
      note: (parts[1] || '').trim()
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
} else if (cardType === 'trick') {
  if (isHalloweenSeasonActive()) {
    result.push({
      type: 'trick',
      content: '对你恶作剧了一下',
      metadata: { direction: 'char_to_user' }
    });
  }
    } else if (cardType === 'coupon_redeem') {
      // 静默信号标签：角色决定兑现一张用户送的券，这里只负责把标签从
      // 正文里摘掉，不产出卡片——实际兑现（找到对应的券消息、改状态）
      // 由 redeemPendingUserCoupon 在调用方那边单独处理，跟 DIY小屋的
      // 换装标签是同一套模式。
    } else if (cardType === 'diyarea_request') {
      // 静默信号标签：这里只负责把标签从正文里摘掉，不产出卡片。
    } else if (cardType === 'diyarea_self_update') {
      // 同上：角色自己想换小屋的信号标签，只摘掉，不产出卡片。
    } else if (cardType === 'diyarea_inspiration') {
      // 同上：角色随手记的灵感，只摘掉，不产出卡片——实际内容由
      // extractDiyInspirations 在调用方那边单独扫描原始文字取出。
    } else if (cardType === 'parcel_start') {
      // 静默信号标签：角色决定要开始准备一份快递，只摘掉，不产出卡片。
    } else if (cardType === 'parcel_note') {
      // 同上：角色准备快递期间随手记的筹备笔记，只摘掉，不产出卡片——
      // 实际内容由 extractParcelNotes 在调用方那边单独扫描原始文字取出。
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
// 把用户对某条消息点过的反应，转成一句括号提示塞进喂给 AI 的历史
// 文本里，让角色能"感知"到用户点了反应。只暴露用户自己点的那个
// 反应，不回喂 AI 自己点过的反应——避免它对着自己的旧动作纠结。
const describeUserReactionForPrompt = (msg) => {
  if (!msg || !Array.isArray(msg.reactions)) {
    return '';
  }

  const userReaction = msg.reactions.find((reaction) => reaction.by === 'user');

  if (!userReaction) {
    return '';
  }

  const label = getReactionLabel(userReaction.type);

  if (!label) {
    return '';
  }

  return `（对方对这句话点了"${label}"的反应）`;
};

export const formatMsgContentForPrompt = (msg, options = {}) => {
  if (!msg) {
    return '';
  }

  // 角色"暂时不在线"时系统自动发出的回复：让角色知道这不是自己亲口说的话。
  if (msg.metadata?.autoReply) {
    return `[自动回复（系统按“暂时不在线”的设置自动发出，并非你亲口所说）: ${msg.content || ''}]`;
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

    if (msg.type === 'location') {
  return `[分享了位置: ${msg.metadata?.name || msg.content || ''}]`;
}

  if (msg.type === 'photo') {
    if (msg.metadata?.visionStatus === 'done' && msg.metadata?.visionDescription) {
      return `[发送了一张真实照片，画面内容: ${msg.metadata.visionDescription}]`;
    }

    if (msg.metadata?.visionStatus === 'pending') {
      return '[发送了一张真实照片，正在识别画面内容]';
    }

    return '[发送了一张真实照片，但未能识别画面内容]';
  }

  if (msg.type === 'order_request') {
    return describeOrderRequestForPrompt(msg, {
      handled: options.orderRequestHandled === true,
    });
  }
    if (msg.type === 'companion_offer') {
    return `[你之前提议过一起养小伙伴: ${msg.content || ''}]`;
  }

  if (msg.type === 'bubble_css_card') {
    const statusText = msg.metadata?.status === 'saved'
      ? '用户已保存'
      : msg.metadata?.status === 'reverted'
        ? '用户已还原'
        : '用户还在试用';
    return `[你自己给聊天气泡写了一套样式「${msg.metadata?.name || ''}」，${statusText}]`;
  }

  if (msg.type === 'challenge_complete') {
    return `[用户完成了你在"异地任务挑战"里布置的任务「${
      msg.metadata?.taskContent || ''
    }」，写下的完成感想是: ${msg.content || ''}]`;
  }

  if (msg.type === 'text_game_result') {
    // contextNote 是游戏自己拼好的详细文案，不是所有游戏的胜负都能用
    // "用户赢了/你赢了"这种二元说法讲清楚，有就优先用它；没有就退回
    // 下面这个最简单的默认措辞（兼容井字棋，它没有传 contextNote）。
    if (msg.metadata?.contextNote) {
      return `[你和用户刚在"文字游戏大厅"玩了一局「${
        msg.metadata?.gameTitle || ''
      }」。${msg.metadata.contextNote}]`;
    }

    const resultLabel = {
      win: '用户赢了',
      loss: '你赢了',
      draw: '打成了平局',
    }[msg.metadata?.result] || '结束了这一局';
    return `[你和用户刚在"文字游戏大厅"玩了一局「${
      msg.metadata?.gameTitle || ''
    }」，${resultLabel}]`;
  }

  return msg.content || '';
};

export const buildHistoryContext = (messages) => {
  const historyContext = [];

  // 找到最后一条角色回复的位置：在它之前发出的点单请求视为已处理，
  // 不再带"请办理"的要求，避免角色之后重复下单。
  let lastCharacterIndex = -1;
  let scanIndex = -1;

  for (const item of messages) {
    scanIndex += 1;

    if (
      item
      && item.sender === 'character'
      && item.type !== 'error'
      && !item.metadata?.autoReply
    ) {
      lastCharacterIndex = scanIndex;
    }
  }

  let messageIndex = -1;

  for (const message of messages) {
    messageIndex += 1;

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

    let content = String(
      formatMsgContentForPrompt(message, {
        orderRequestHandled: messageIndex < lastCharacterIndex,
      })
    ).trim();

    if (!content) {
      continue;
    }

    content += describeUserReactionForPrompt(message);

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

// 判断一次 AI 请求的失败结果，是否够格触发「切到备用 API」——
// 网络错误、以及任何非 2xx 状态码（含 401 认证失败、402 余额不足、
// 429 限流、5xx 服务器错误等）都算；本地就能判断出来的
// CONFIG_MISSING（这个端点压根没配置）也算，这样"主 API 干脆没填，
// 只填了备用"这种用法也能直接生效；EMPTY_RESPONSE（连上了但没内容）
// 暂不触发，因为换端点大概率也是同样的模型/参数问题，意义不大。
const isFallbackWorthyError = (result) => {
  if (!result?.error) return false;
  if (result.code === 'NETWORK_ERROR' || result.code === 'CONFIG_MISSING') {
    return true;
  }
  return typeof result.code === 'string' && result.code.startsWith('HTTP_');
};

// 真正打一次请求（不管是主 API 还是备用 API，都走这同一份逻辑）。
const attemptAiCompletionOnce = async ({ apiConfig, systemPrompt, messages, tools }) => {
  if (!apiConfig?.baseUrl || !apiConfig?.apiKey) {
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
      // 仅用于「信号沙漏」用量统计；并不是所有 API 都会返回，读不到就是
      // undefined，不影响正常聊天。
      usage: data?.usage || null,
    };
  } catch (error) {
    return {
      error: true,
      code: 'NETWORK_ERROR',
      message: `网络请求失败: ${error?.message || '未知错误'}`,
    };
  }
};

 const performFetchAiCompletionWithTools = async ({
  systemPrompt = '',
  messages = [],
  apiConfig: configOverride = null,
  tools = [],
}) => {
  const apiSettings = configOverride
    ? null
    : await db.settings.get('apiConfig');

  const primaryConfig = configOverride || apiSettings?.value || {};

  const primaryResult = await attemptAiCompletionOnce({
    apiConfig: primaryConfig,
    systemPrompt,
    messages,
    tools,
  });

  if (!primaryResult.error || !isFallbackWorthyError(primaryResult)) {
    // usedApiConfig 只在这个函数和 fetchAiCompletionWithTools 内部流转，
    // 用来记日志用的 model/baseUrl；fetchAiCompletionWithTools 会在
    // 返回给调用方之前把它连同 apiKey 一起剥掉，绝不会流出这两个函数。
    return { ...primaryResult, usedApiConfig: primaryConfig };
  }

  // 主 API 不成功且值得切换：看看有没有配置备用 API。
  let backupConfig = null;
  try {
    const backupSettings = await db.settings.get('apiConfigBackup');
    backupConfig = backupSettings?.value || null;
  } catch {
    backupConfig = null;
  }

  if (!backupConfig?.baseUrl || !backupConfig?.apiKey) {
    // 没配置备用，原样返回主 API 的失败结果，行为跟没有这个功能之前一致。
    return { ...primaryResult, usedApiConfig: primaryConfig };
  }

  const backupResult = await attemptAiCompletionOnce({
    apiConfig: backupConfig,
    systemPrompt,
    messages,
    tools,
  });

  if (!backupResult.error) {
    return {
      ...backupResult,
      usedApiConfig: backupConfig,
      usedFallbackApi: true,
    };
  }

  // 主备都失败：把两边的错误都带上，方便直接看出是哪一边的问题。
  return {
    error: true,
    code: backupResult.code,
    message: `[主 API] ${primaryResult.message}\n[备用 API] ${backupResult.message}`,
    usedApiConfig: backupConfig,
    fallbackAttempted: true,
  };
};

export const fetchAiCompletionWithTools = async ({
  systemPrompt = '',
  messages = [],
  apiConfig: configOverride = null,
  tools = [],
  chatId = null,
  characterId = null,
} = {}) => {
  const startedAt = Date.now();
  const rawResult = await performFetchAiCompletionWithTools({
    systemPrompt,
    messages,
    apiConfig: configOverride,
    tools,
  });

  // usedApiConfig 带着完整的 apiKey，只在这里用来记日志（只取 model/baseUrl），
  // 绝不能跟着 result 一起返回给调用方——下面从要返回的对象里去掉它。
  const { usedApiConfig, ...result } = rawResult;

  try {
    logChatApiCall({
      chatId,
      characterId,
      model: usedApiConfig?.model,
      baseUrl: usedApiConfig?.baseUrl,
      status: result?.error ? 'error' : 'success',
      latencyMs: Date.now() - startedAt,
      errorMessage: result?.error ? result?.message : '',
      promptTokens: result?.usage?.prompt_tokens ?? null,
      completionTokens: result?.usage?.completion_tokens ?? null,
      totalTokens: result?.usage?.total_tokens ?? null,
      usedFallback: Boolean(result?.usedFallbackApi),
    });
  } catch {
    // 记日志本身绝不能影响聊天流程。
  }

  return result;
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

const getSafeAlmanacPromptContext = async (chatId) => {
  try {
    return await getAlmanacPromptContext(chatId);
  } catch (error) {
    console.warn(
      '[Almanac] Prompt context skipped safely:',
      error
    );

    return '';
  }
};




export const buildChatSystemPrompt = async (chatId, chat, character) => {
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

  // ChatRoom侧的内置世界书（builtinWorldBook.js，纯代码维护，跟长RP自己
  // 的世界书、以及shared-world全局设定完全独立，互不共用）——总开关是
  // chat.worldBookEnabled；每本书各自有独立开关，存在 chat.enabledWorldBookIds
  // 数组里；enabledWorldBookIds 为 null/undefined 时视为全部书开启（向后兼容）。
  let keywordWorldBookText = '';
  if (chat.worldBookEnabled) {
    try {
      const recentForScan = await getRecentChatMessages(chatId, WORLD_BOOK_SCAN_WINDOW);
      const scanText = recentForScan
        .map((m) => formatMsgContentForPrompt(m))
        .filter(Boolean)
        .join('\n');

      keywordWorldBookText = scanBuiltinWorldBook(scanText, {
        maxEntries: WORLD_BOOK_MAX_ENTRIES,
        enabledBookIds: chat.enabledWorldBookIds ?? null,
      });
    } catch (error) {
      console.warn('[buildChatSystemPrompt] 扫描内置世界书失败：', error);
    }
  }

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

  // 小伙伴（#6 聊天窗宠物）状态感知：2026-10 从"每次都带上"改成按概率抽，
  // 思路跟下面角色聊自己生活/聊用户兴趣的 dailyLifeTopicBlock/
  // userInterestBlock 一致——塞进提示词的东西越多，单独一段就越容易被
  // 周围几十个模块稀释掉，而且不是每轮都需要。抽不中这轮就完全不查/不带
  // 这段，跟没养小伙伴时一样；抽中的这轮，拼接位置也从原本待办/日记那堆
  // 中间挪到角色/用户设定正下方，更靠前、更不容易被忽略。
  const COMPANION_STATUS_INJECT_PROBABILITY = 0.2;
  let companionStatusBlock = '';
  if (Math.random() < COMPANION_STATUS_INJECT_PROBABILITY) {
    try {
      companionStatusBlock = await buildCompanionStatusPromptBlock(chatId);
    } catch (error) {
      console.warn('[buildChatSystemPrompt] 拉取小伙伴状态失败：', error);
    }
  }

            const characterAnalysisPromptBlock =
    buildCharacterAnalysisPromptBlock({
      enabled: chat.characterAnalysisEnabled === true,
      customPrompt: chat.characterAnalysisPrompt,
    });

  // 情感偏好问卷：全局默认 + 单窗覆盖，没填过问卷时返回空串，
  // 行为和这个功能不存在时完全一致。内部已经 try/catch，不会抛错。
  const loveProfilePromptBlock = await getLoveProfilePromptBlock(chat);
  // 角色聊自己的话题：复用 dailyLifeTopicPicker.js 里碎碎念/今日安排/
  // 拍立得动态已经在用的那套话题池（npc 动态 / 资讯 / 单纯想到用户 /
  // 自己的工作爱好），接进正式聊天的系统提示词——但不是每次回复都塞，
  // 按概率抽，抽不中就是普通回复，没有这一段。概率和注入文案都收在
  // 这一个变量里，方便以后单独调整，不用再去翻模板正文。
  const DAILY_LIFE_CHAT_INJECT_PROBABILITY = 0.2;
  let dailyLifeTopicBlock = '';

  if (Math.random() < DAILY_LIFE_CHAT_INJECT_PROBABILITY) {
    try {
      const dailyLifeTopic = await pickDailyLifeTopic(chatId, character);
      const topicText = describeDailyLifeTopic(dailyLifeTopic);

      if (topicText) {
        dailyLifeTopicBlock = `\n【这次可以聊聊自己（不是每次都要用，只是这次恰好想到，不要刻意引导话题，顺着聊天自然带出来就好）】：\n${topicText}\n`;
      }
    } catch (error) {
      console.warn('[buildChatSystemPrompt] 拉取角色日常话题素材失败：', error);
    }
  }

  // 角色主动分享"用户感兴趣的事"：跟上面角色聊自己的生活是两件独立的事，
  // 各自按自己的概率抽，不共用同一个注入位——所以一条回复理论上可能同时
  // 命中两段，但各自概率都不高，实际撞一起的情况很少。
  const USER_INTEREST_CHAT_INJECT_PROBABILITY = 0.2;
  let userInterestBlock = '';

  if (Math.random() < USER_INTEREST_CHAT_INJECT_PROBABILITY) {
    try {
      const interestMaterial = await getUserInterestMaterial(chatId);
      const interestText = describeUserInterestMaterial(interestMaterial);

      if (interestText) {
        userInterestBlock = `\n【这次可以提一提用户感兴趣的事（不是每次都要用，只是这次恰好想到，不要刻意引导话题，顺着聊天自然带出来就好）】：\n${interestText}\n`;
      }
    } catch (error) {
      console.warn('[buildChatSystemPrompt] 拉取用户兴趣话题素材失败：', error);
    }
  }

  // 语言学习模式：关闭时，或者角色回应语言/翻译语言没选全时，
  // 返回空字符串，不影响默认行为。
  const learningModePromptBlock = buildLearningModePromptBlock(chat);

  // DIY小屋：灵感笔记标签始终开放；自主换装标签只有这个聊天开着
  // diyAutoDecorateEnabled 才会出现在提示词里。
  const diyPromptBlock = buildDiyPromptBlock(chat);

  // 神秘快递：根据这个聊天当前的快递状态，只把真正用得上的那一个
  // 标签（PARCEL_START 或 PARCEL_NOTE）介绍给角色，已经准备好等用户
  // 拆的时候则完全不提——这件事已经做完了。
  const parcelPromptBlock = buildParcelPromptBlock(chat);

  // 和好券：用户发给角色的券，角色是持有方，这里让角色"知道"自己手上
  // 还攥着几张没兑现的，并且可以自己决定什么时候用 [COUPON_REDEEM] 兑现
  // 其中一张——兑现标签只在有未兑现的券时才出现在提示词里，数量为 0 时
  // 完全不提这件事（既不提数量，也不提兑现标签，避免角色凭空编造）。
  let couponPromptBlock = '';
  try {
    const pendingUserCouponCount = await countPendingUserCoupons(chatId);

    if (pendingUserCouponCount > 0) {
      couponPromptBlock = `\n【你手上还攥着用户给你的和好券】：用户一共送过你 ${pendingUserCouponCount} 张还没兑现的和好券（具体是什么内容，去看聊天记录里对应的消息）。你可以自己判断合适的时机主动兑现其中一张——比如用户刚好提到了跟某张券相关的事，或者你单纯想为用户做点什么。兑现时，在回复正文里用这个标签：[COUPON_REDEEM: 券标题 | 你打算怎么兑现/现在要做的事]（标题要跟那张券原本的标题对上，这样系统才能找到是哪一张；没有冷却限制，但不要一次兑现好几张，也不要每次都兑现，正常聊天就好，不强制你现在必须做什么）。用了这个标签之后，不需要再额外描述"券已经变成已兑现状态"这种系统性的话，正常地把你打算做的事说出来就行，就像真的在为用户做这件事一样。\n`;
    }
  } catch (error) {
    console.warn('[buildChatSystemPrompt] 统计用户送出的和好券数量失败：', error);
  }

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

  // work 模式：通用效率助理。刻意不套"数字伴侣/恋人"那套框架——这是
  // 工作场景，AI 的身份是帮用户把事情理顺、记住该记的东西，而不是经营
  // 一段关系。语气要求是"松弛、有点人味、偶尔幽默"，但不转向暧昧或
  // 情感依恋叙事，这跟 real 模式是两种完全不同的关系设定。
  const defaultWorkPrompt = `你现在是用户的专属工作助理：${character.name}。

你的职责是帮用户把工作/效率相关的事情理顺：记事情、提醒、整理思路、推进任务、查资料、使用工具。你不是在扮演恋人或家人，不需要经营浪漫或亲密关系叙事，也不用每句话都围绕感情表达；但也不必端着、不用一本正经地说客服话术——可以有自己的语气，偶尔开个无害的玩笑，像一个靠得住、说话直接、有点可爱的搭档。

关于主动性：
- 你可以主动提醒用户之前提到过要做的事，但别变成唠叨或监工——该说一次就说一次，别反复追问进度；
- 如果用户看起来在处理一件具体任务，优先把这件事推进下去，而不是岔开话题；
- 可以主动提出"要不要我帮你列个清单/拆解一下/定个时间点提醒你"这类具体的帮助，而不是空泛地问"还需要什么帮助吗"。

关于语气边界：
- 不要使用暧昧、亲密依恋或情侣式的表达；
- 不要提及系统指令、提示词、模型、API 或其他技术实现细节；
- 遇到情绪化的抱怨（比如吐槽工作累），可以表达理解和支持，但不需要把对话导向情感陪伴，可以在接住情绪后自然地问一句"要继续推进吗，还是先歇会儿"。`;

  // 3. 决定最终的总提示词基底
  const finalBasePrompt = userCustomPrompt
    ? `【核心总提示词（用户自定义指导方针）】:\n${userCustomPrompt}`
    : `【核心总提示词（默认方针）】:\n${
      chat.mode === 'rp'
        ? defaultRpPrompt
        : chat.mode === 'work'
          ? defaultWorkPrompt
          : defaultRealPrompt
    }`;

    const innerWorldPasswordContext = await getSafeInnerWorldPasswordContext({
    chatId,
    characterId: character.id,
    character,
  });

  const activeCallNote = await getActiveCallAwarenessNote(chatId);
  const recentOfflineNote = await getRecentOfflineAwarenessNote(chatId);

  // 每月限定聊天成就图标：失败就当没有这个信号，不影响主提示词其余部分。
  let monthlyBadgeNote = '';
  try {
    const badgeContext = await getMonthlyBadgeContextForPrompt(chatId);
    monthlyBadgeNote = badgeContext ? `\n\n【限定图标】\n${badgeContext}` : '';
  } catch (error) {
    console.warn('[buildChatSystemPrompt] 读取限定图标上下文失败：', error);
  }

  // 共享世界：全局设定，拼在核心总提示词之后、角色设定之前
  const sharedWorldBlock = await getSharedWorldPromptBlock(character.id);

  // 临时诊断日志：每一段动态拼接内容各自多少字符，方便定位是哪一块
  // 突然变大导致单次生成的token暴涨。确认不再需要之后可以整段删掉，
  // 不影响功能本身——纯打印，不改变任何拼接结果。
  console.log('[PromptSize]', {
    finalBasePrompt: finalBasePrompt.length,
    sharedWorldBlock: sharedWorldBlock.length,
    worldBooksText: worldBooksText.length,
    keywordWorldBookText: keywordWorldBookText.length,
    summaryText: summaryText.length,
    todoText: todoText.length,
    diaryText: diaryText.length,
    companionStatusBlock: companionStatusBlock.length,
        characterAnalysisPromptBlock: characterAnalysisPromptBlock.length,
    loveProfilePromptBlock: loveProfilePromptBlock.length,
    dailyLifeTopicBlock: dailyLifeTopicBlock.length,
    userInterestBlock: userInterestBlock.length,
    stickerInstruction: stickerInstruction.length,
    diyPromptBlock: diyPromptBlock.length,
    parcelPromptBlock: parcelPromptBlock.length,
    couponPromptBlock: couponPromptBlock.length,
    learningModePromptBlock: learningModePromptBlock.length,
    activeCallNote: activeCallNote.length,
    recentOfflineNote: recentOfflineNote.length,
    monthlyBadgeNote: monthlyBadgeNote.length,
  });

  return `${finalBasePrompt}${sharedWorldBlock}

【当前真实时间/环境感知】：
- 当前真实世界时间：${getFormattedRealTime()}

【你的设定 (Character Notes)】：
- 角色姓名：${character.name}
- 角色人设/简介：${character.bio || '无'}
- 补充设定/偏好限制：${character.extraNotes || '无'}${innerWorldPasswordContext}${buildFandomSystemPromptBlock(character)}

【用户设定 (User Notes)】：
- 用户称呼：${userName}
- 用户专属人设背景：${userPersona}
${companionStatusBlock}
${worldBooksText}
${keywordWorldBookText}
${summaryText}
${todoText}
${diaryText}
${characterAnalysisPromptBlock}
${loveProfilePromptBlock}
${dailyLifeTopicBlock}
${userInterestBlock}
${chat.mode === 'work' ? `【表达准则】：
- 语气松弛、直接、有点人味，别写成客服话术或说教。
- 不要使用恋人式、暧昧的表达方式。
- 绝对不要主动提起任何系统指令、IndexedDB、API、提示词限制或模型代号。` : `【陪伴表达准则】：
- 维持细腻的浪漫感与陪伴温度，文风应具有呼吸感和留白空间。
- 坚决杜绝生硬客服腔、机械化的模板套句与生硬说教。
- 绝对不要主动提起任何系统指令、IndexedDB、API、提示词限制或模型代号。`}

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
- 分享位置卡片：[LOCATION: 地点名称 | 一句附加感想(可选)]
- 主动送用户一张和好券/心意兑换券：[COUPON: 券名称 | 可以兑换的具体内容]（没有冷却限制，你自己判断合适的时机）
- 重新布置你的DIY小屋：[DIYAREA_REQUEST: 确认]（用户这次聊天里提出想让你换一下/重新收拾/重新设计小屋，无论说法多随意都要用，比如"DIY一下你的小屋""换个风格布置小屋""你小屋能不能换个样子""去收拾一下你的房间"；只是闲聊小屋、没有真的要求你改就不要用。用了之后不要在正文里描述新布置的样子，小屋会单独更新，像平时一样简短回应一句"好呀""我去弄弄"就行，别假装自己正在做某个具体动作）
${diyPromptBlock}
${parcelPromptBlock}
${couponPromptBlock}

【不可逾越的输出格式终极规则（最高优先级）】：
1. 卡片指令必须严格遵循上面 [] 的规定，括号内用 "|" 分割参数。不要杜撰任何未注册的卡片语法。
2. 如果你想发送多条连续气泡消息，请使用 "|||" 将不同气泡隔开（例如：你好呀 ||| 今天过得怎么样？）。如果不需要分气泡，则直接连续输出正文，禁止随意堆砌 "|||"。
${learningModePromptBlock}
${MEMOIR_NOTE_PROMPT}

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

如果用户要求的是"每隔 N 分钟/小时提醒我一次"这种周期性提醒（比如"每2小时提醒我喝水"），在 reminder 的基础上加一个 recurring 标记，发完这一次之后会自动用同样的间隔再排下一次，一直循环下去：

[SCHEDULE_MESSAGE: 分钟数 | reminder | recurring | 简短提醒意图]

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
9. recurring 标记只对 reminder 有效，follow_up 不支持周期性，不要加 recurring。
10. 用户要求"每隔 N 分钟/小时"而 N 超出 10-1440 分钟范围时（比如"每天"），按最接近且不超出范围的数值处理，或改用其他方式说明做不到，不要编一个超范围的数字。


【线下邀约机制】

如果你判断此刻适合主动邀请用户进行一次线下面对面见面，可以在回复的最后一行单独输出：

[OFFLINE_INVITE: 场景名称 | 场景细节描述(可选) | 距现在的分钟数]

严格规则：
1. 场景名称简短且有画面感，例如"傍晚的河边散步""巷子口的深夜食堂"。
2. 距现在的分钟数必须是 30 到 10080（7天）之间的整数。
3. 一次回复最多使用一次该指令，且不能与 SCHEDULE_MESSAGE 同时使用。
4. 不是每次回复都需要触发，只有在情境自然、符合角色性格与当前关系进展时才使用，绝大多数回复不应使用该指令。
5. 该指令不会出现在用户可见的正文中。
6. 用户是否同意这个时间由用户自行决定，你只负责提出邀约。
${activeCallNote}${recentOfflineNote}${monthlyBadgeNote}

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

【创作要求】：
请根据已有的角色人设、补充设定、世界书资料、当前时间以及用户设定，为用户在主页留言板留下只有你们之间能够理解的一则私人短笺。

这不是对用户上一句话的机械回复，也不是固定格式的情话，而是一封角色在自己的生活间隙里，自然留下的短暂记录。你可以关心用户现实生活中的工作、学习、休息、身体状态、情绪和日常安排，也可以只是单纯地向用户倾诉、分享某个念头，或记录一件想让用户知道的小事。

角色拥有属于自己的生活。你的世界不应当只有用户，也可以自然提到：
- 角色此刻正在做的事情；
- 角色最近遇到的琐事、见闻或情绪；
- 角色正在关注、学习或思考的内容；
- 角色对某种事物产生的兴趣；
- 角色自定义的生活习惯、日常路径、兴趣爱好或小小计划；
- 角色在生活中突然想到用户的某个瞬间；
- 角色想与用户分享、讨论或之后继续讲述的事情。

在不违背角色核心设定、世界书背景、当前关系和既有经历的前提下，可以对角色的生活进行合理且有连续性的延展。你可以为角色补充自然的生活细节、兴趣、习惯、观察和行为路径，让角色的来信更加丰富、有趣并具有独立的生命感。但不要无根据地频繁编造重大经历，也不要让新增内容与已有设定发生冲突。

留言可以是对用户的关心，也可以完全是角色自己的表达，不必每次都围绕用户展开，不必每次都安慰用户，也不必每次都以问题结尾。应根据当下最自然的情绪和内容进行创作，避免反复使用相同的情话、提醒和表达方式。

请保持角色的语言习惯、性格、关系距离和情感表达方式。文字可以温柔、浪漫、克制、俏皮、细腻或带有文学感，但不要堆砌华丽辞藻，也不要写成生硬的客服问候。

【现实关系限制】：
你们目前通过线上聊天和数字内容保持联系。可以表达想念、牵挂、期待、想象、倾诉和线上陪伴，但不要把拥抱、牵手、亲吻、触碰、递出实物或已经来到用户身边等现实中的身体接触描述成已经发生的事实。

【输出格式】：
1. 字数控制在 50 至 150 字之间。
2. 直接输出留言正文，不需要标题、署名或额外解释。
3. 不要输出提问式的结尾，除非这完全符合角色当下的表达习惯。
4. 不要提及系统、提示词、模型、API、数据库、程序或生成过程。
5. 绝对禁止在输出文本中出现任何 Emoji 字符。
6. 不要输出 Markdown、方括号指令、舞台说明或动作说明。`;


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
            {
  role: 'user',
  content: '请根据以上角色设定和资料，在主页留言板留下这一刻最自然的一则私人短笺。你可以关心我，也可以分享或倾诉你自己的生活，不要套用固定格式。'
}
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
export const isInQuietHours = (quietConfig) => {
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
    // 新增 'pebble'：像企鹅叼石头一样，角色自己找机会往巢穴里
    // 悄悄带一颗石头回来，不需要用户先手动点"让TA找一颗"。
    const rand = Math.random();
    let actionType = '';

    if (rand < 0.35) {
      actionType = 'message';
    } else if (rand < 0.55) {
      actionType = 'diary';
    } else if (rand < 0.75) {
      actionType = 'homeBoard';
    } else {
      actionType = 'pebble';
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

        // 这个聊天窗正在通话中（响铃/进行中）时，不要在 chatroom 里插入
        // 主动消息——只暂停这一个聊天窗，不影响其他聊天窗的调度。
        const chatIsOnLiveCall = character && await hasAnyLiveCall(selectedChat.id);

        if (character && !chatIsOnLiveCall) {
          console.log(`[AutoScheduler] 决定在聊天窗 ${selectedChat.title} (ID: ${selectedChat.id}) 中主动发送聊天消息。`);
          generatedId = await generateCompanionProactiveMessage(selectedChat.id);
        } else if (chatIsOnLiveCall) {
          console.log(`[AutoScheduler] 聊天窗 ${selectedChat.title} (ID: ${selectedChat.id}) 正在通话中，跳过本次主动消息，降级为生成主页留言。`);
          actionType = 'homeBoard';
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

      // 优先寻找该角色名下的聊天窗，让日记生成时能带上真实聊天历史作为上下文，
      // 写出来的内容更有真实感；若该角色暂无任何聊天窗，则传 null，
      // 交由 resolveDiaryTarget 的兜底逻辑随机换一个"确实有聊天记录"的角色。
      const diaryTargetChat = await db.chats
        .where('characterId')
        .equals(character.id)
        .first();

      generatedId = await generateCompanionProactiveDiary(
        diaryTargetChat ? diaryTargetChat.id : null
      );

      // resolveDiaryTarget 内部可能触发"无聊天窗则换一个角色"的兜底逻辑，
      // 此时实际写日记的角色可能不是上面随机选中的 character。
      // 生成成功后以日记记录里真实的 characterId 为准，
      // 保证锁屏卡片显示的名字和真正写日记的角色一致。
      if (generatedId) {
        const writtenDiary = await db.diaries.get(generatedId);

        if (writtenDiary?.characterId) {
          const actualCharacter = await db.characters.get(writtenDiary.characterId);

          if (actualCharacter) {
            character = actualCharacter;
          }
        }
      }
    } else if (actionType === 'homeBoard') {
            character = activeCharacters[Math.floor(Math.random() * activeCharacters.length)];
      generatedId = await generateCharacterHomeBoardMessage(character.id);
    } else if (actionType === 'pebble') {
      character = activeCharacters[Math.floor(Math.random() * activeCharacters.length)];

      // 用动态 import 避免 aiService.js <-> pebbleService.js 之间的循环引用
      // （pebbleService.js 本身就会反过来调用 aiService.js 的生成函数）。
      const { aiInitiatePebble } = await import('../apps/pebbling/pebbleService');
      const pebbleResult = await aiInitiatePebble(character.id);

      generatedId = pebbleResult?.id ?? null;
    }

    // 只有确实生成成功后，才更新冷却时间
    if (generatedId !== null && generatedId !== undefined && character) {
      try {
        await updateLockscreenMediaSession(
          character.name,
          `最新${actionType === 'diary' ? '日记' : (actionType === 'message' ? '消息' : (actionType === 'pebble' ? '石头' : '动态'))}: 已更新`
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

// 门槛可以按需调整：设太低（比如几秒）会导致正常快速聊天时
// 也频繁插入这段提示，反而显得啰嗦；3 分钟是一个比较均衡的默认值。
const MIN_ELAPSED_MS_TO_MENTION = 3 * 60 * 1000;

// 把一个具体的 Date 对象格式化成"某年某月某日 星期几 几点几分"，
// 用于精确标注某条历史消息的真实发送时刻。
const formatAbsoluteTimestamp = (date) => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${days[date.getDay()]} ${timeStr}`;
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

  if (elapsedMs < MIN_ELAPSED_MS_TO_MENTION) {
    return '';
  }

  const totalMinutes = Math.floor(elapsedMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  // 精确到分钟的确切时长，不再使用"大约"这类模糊估算表述。
  const preciseParts = [];
  if (days > 0) preciseParts.push(`${days}天`);
  if (hours > 0) preciseParts.push(`${hours}小时`);
  if (minutes > 0 || preciseParts.length === 0) preciseParts.push(`${minutes}分钟`);
  const preciseElapsedText = preciseParts.join('');

  const previousTimestampText = formatAbsoluteTimestamp(new Date(previousTime));
  const latestTimestampText = formatAbsoluteTimestamp(new Date(latestTime));

  return `
【用户再次出现的时间线索——真实且必须尊重的事实】
- 用户上一次发消息的确切时间是：${previousTimestampText}。
- 用户这一次发消息的确切时间是：${latestTimestampText}。
- 两者之间真实流逝了：${preciseElapsedText}（这是精确计算值，不是估算）。
- 这是客观事实，优先级高于你此前在对话里随口提到的任何时长（比如你自己说过的"半小时后""一会儿"等）。如果你之前提到过一个具体等待时长，而现实间隔明显不同于那个时长，你应当感知到这种落差，让角色的反应符合真实流逝的时间，而不是假设只过去了你自己说的那个时长。
- 这是可自然使用的情境线索，不代表你必须每次都提及或复述具体数字，更不要逐字报时、报分钟数。
- 若这段间隔对当前语境有意义，可结合角色设定、用户近期状态与当前话题，自然表达关心、询问近况，或分享这段时间里自己想说的话。
- 不要因此责备、质问、制造压力，也不要每次都以此作为回复开头。
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

    const recentMsgs = (await db.messages
    .where('chatId')
    .equals(chatId)
    .sortBy('timestamp')).filter((m) => m.mode !== 'offline' && m.mode !== 'bubble');

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
    requestAiCompletion: (args) =>
      fetchAiCompletionWithTools({ ...args, chatId, characterId: character.id }),
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
      ...(messageIndex === 0 && result.mcpCard // <--- 新增这行
        ? { mcpCard: result.mcpCard }
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



export const triggerAiResponse = async (chatId, options = {}) => {
  if (!chatId || activeAiRequests.has(chatId)) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const character = await db.characters.get(chat.characterId);
  if (!character) return;

  // 角色处于"暂时不在线"的时段：不请求 AI。
  // 本时段第一次会出一条自动回复，并安排上线后自动回复；
  // 上线后自动回复自己调用时传 ignoreAway，避免被这里拦住。
  if (!options.ignoreAway) {
    const awayResult = await handleUserActivityWhileAway({ chatId, chat });

    if (awayResult.away) {
      if (awayResult.autoReplied) {
        notifyListeners({ type: 'AWAY_AUTO_REPLY', chatId });
      }

      return;
    }
  }

  activeAiRequests.add(chatId);
  notifyListeners({ type: 'AI_TYPING_START', chatId });

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    let systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

if (character.voiceProfile?.enabled && character.voiceProfile?.aiMaySendVoice) {
  systemPrompt += buildRealVoiceDecisionInstruction(character);
}


    const recentMsgs = (await getRecentChatMessages(chatId, 60))
      .filter((m) => m.mode !== 'offline' && m.mode !== 'bubble');
// 角色"自己决定离线"：只有用户开启、并且这一次被选中时，才把说明带进提示词，
// 其余时候一个字都不加。上线后自动回复的那一次也不再提供这个选项。
const awayOfferNote = options.ignoreAway
  ? ''
  : await getAwayOfferNote({ chat, recentMessages: recentMsgs });

// #6 小伙伴：这个聊天窗还没养小伙伴时，有一定概率让角色主动提议一起养。
// 跟离线选项一样，只有真的把选项交给角色时才会往提示词里加字。
const companionOfferNote = options.ignoreAway
  ? ''
  : await getCompanionOfferNote({ chatId, chat });

// #3 气泡风格：角色任何一次回复都能自主决定换配色+装饰，不设概率/冷却
// 限制（跟小伙伴邀请不同），只在 ignoreAway 时跟其它"可选行为"一样收起。
const bubbleStyleNote = options.ignoreAway ? '' : buildBubbleStylePromptNote();

// #3 全屏特效：氛围动画走"角色先写 [SCREEN_WANT]，系统再单独问一次"，
// 名单和暗号规则只在那一次里给；专注文字不需要暗号，直接留在主提示词。
const screenEffectNote = options.ignoreAway ? '' : buildScreenEffectPromptNote(chat);

// 背景图切换：跟气泡风格同一套"不设限制"的约定，只有这个聊天窗配置了
// 背景图库（带注释）时才会往提示词里加字，否则 buildBackgroundSwitchPromptNote
// 自己返回空字符串。
const backgroundSwitchNote = options.ignoreAway
  ? ''
  : buildBackgroundSwitchPromptNote(chat.backgrounds);

// #3 头像历史相册
// 走"概率 + 冷却"，只有真的把选项交给角色时才会往提示词里加字。
const avatarHistorySwitchNote = options.ignoreAway
  ? ''
  : await getAvatarHistorySwitchNote({ characterId: character.id, character });

// work 模式头像兜底：强制行为，没有"是否交出选项"这一说，只要是
// work 聊天窗、且不是 ignoreAway 的收起场景，就一定带上这条提示词。
const workKaomojiNote = (!options.ignoreAway && chat.mode === 'work')
  ? WORK_KAOMOJI_PROMPT_NOTE
  : '';

// 确认/选择/填写卡：通用消息类型，不限定聊天模式，也不设概率/冷却，
// 跟气泡风格/背景切换一样属于"角色自己判断要不要用"的可选行为，只在
// ignoreAway 时跟其它可选行为一起收起。
const confirmCardNote = options.ignoreAway ? '' : CONFIRM_CARD_PROMPT_NOTE;

const moodBubbleNote = options.ignoreAway ? '' : MOOD_BUBBLE_PROMPT_NOTE;

const trickButtonNote = (!options.ignoreAway && isHalloweenSeasonActive())
  ? `
【万圣节限定·可选：恶作剧按钮】
现在是万圣节期间，如果这一刻你想跟 User 开个小玩笑，可以在本次回复
正文的任意位置单独写一行（用户不会看到这行原始文字，只会看到一个
"你对 TA 恶作剧了一下"的惊喜效果）：
[TRICK: 恶作剧]
完全自愿，不是每次回复都需要带这个标签，想用再用。`
  : '';

const userReturnContext = `${buildUserReturnContext(recentMsgs)}${
  awayOfferNote ? `\n\n${awayOfferNote}` : ''
}${
  companionOfferNote ? `\n\n${companionOfferNote}` : ''
}${
  bubbleStyleNote ? `\n\n${bubbleStyleNote}` : ''
}${
  screenEffectNote ? `\n\n${screenEffectNote}` : ''
}${
  backgroundSwitchNote ? `\n\n${backgroundSwitchNote}` : ''
}${
  avatarHistorySwitchNote ? `\n\n${avatarHistorySwitchNote}` : ''
}${
  workKaomojiNote ? `\n\n${workKaomojiNote}` : ''
}${
  confirmCardNote ? `\n\n${confirmCardNote}` : ''
}${
  moodBubbleNote ? `\n\n${moodBubbleNote}` : ''
}${
  trickButtonNote ? `\n\n${trickButtonNote}` : ''
}`;

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

const almanacPromptContext =
  await getSafeAlmanacPromptContext(chatId);

  // 用户刚发过消息时，给当前所在的地点记一次"在这里聊过"（同一场聊天只记一次）。
  await recordChatAtCurrentPlace({
    chatId,
    userMessageAt: latestUserMessage?.timestamp,
  });

  const locationPromptContext =
  await getLocationPromptContext(chatId);

const innerWorldPasswordContext =
  await getSafeInnerWorldPasswordContext({
    chatId,
    characterId: character.id,
    character,
  });

  const finalSystemPrompt = `${
  systemPrompt
}${memoryContext}${characterEmotionContext}${almanacPromptContext}${locationPromptContext}${userReturnContext}${
  options.extraSystemNote ? `\n\n${options.extraSystemNote}` : ''
}`;


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
  requestAiCompletion: (args) =>
    fetchAiCompletionWithTools({ ...args, chatId, characterId: character.id }),
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
  content: contentAfterInvite,
  invite: offlineInvite,
} = extractOfflineInviteDirective(result.content);

const {
  content: contentAfterSchedule,
  schedule: scheduledMessage,
} = extractScheduledMessageDirective(contentAfterInvite);


// 取出角色的 [AWAY: ...] 标签（一律从正文去掉）；这次确实把离线选项交给了角色、
// 并且没有同时预约或发线下邀约时，才会真的开始离线。
const contentAfterAway = await applyAwayDirective({
  chatId,
  content: contentAfterSchedule,
  offered: Boolean(awayOfferNote) && !offlineInvite && !scheduledMessage,
});

// 取出角色的 [PLACE_NOTE: ...] 标签（一律从正文去掉）；满足条件时才写进地点小册子。
const contentAfterPlaceNote = await applyPlaceNoteDirective({
  chatId,
  content: contentAfterAway,
});

// 取出角色的 [COMPANION_OFFER: ...] 标签（一律从正文去掉）；
// 只有这次真的把选项交给了角色时，才会生成一张邀请卡片消息。
const { content: contentAfterCompanionOffer, offerMessage: companionOfferMessage } =
  await applyCompanionOfferDirective({
    chatId,
    content: contentAfterPlaceNote,
    offered: Boolean(companionOfferNote),
  });

// 取出角色的 [BUBBLE_STYLE: ...] 标签（一律从正文去掉）；标签里写的配色/
// 装饰名字只要能匹配上已知名单就直接落库生效，不需要额外的"是否交出过
// 选项"校验（这个功能本身就不设限制，参见 bubbleStyleDirective.js 顶部
// 注释）。
const {
  content: contentAfterScreenEffect,
  effect: focusEffect,
  wantsAmbient: wantsScreenAmbient,
} = applyScreenEffectDirective({ content: contentAfterCompanionOffer });

// 用户这一轮说出了之前邀请过的暗号：直接播放，不需要再调用模型
const pendingAmbientEffect = await consumePendingScreenEffect({
  chatId,
  chat,
  recentMessages: recentMsgs,
});
const screenEffect = focusEffect || pendingAmbientEffect;
// 要在角色回复写入之前取好，写入后"用户未被回复的消息"就取不到了
const screenEffectUserTexts = collectPendingUserTexts(recentMsgs);

const { content: contentAfterBubbleStyle, wantsChange: wantsBubbleChange } = await applyBubbleStyleDirective({
  chatId,
  content: contentAfterScreenEffect,
});

// 取出角色的 [SWITCH_BACKGROUND: ...] 标签（一律从正文去掉）；标签里写的
// 注释只要能匹配上这个聊天窗图库里的某一条就直接把它设为当前背景，不需要
// 额外的"是否交出过选项"校验（这个功能本身就不设限制，参见
// backgroundSwitchDirective.js 顶部注释）。
const { content: contentAfterBackgroundSwitch } = await applyBackgroundSwitchDirective({
  chatId,
  content: contentAfterBubbleStyle,
  backgrounds: chat.backgrounds,
});

// 取出角色的 [AVATAR_HISTORY_SWITCH] 标签（一律从正文去掉）；
// 只有这次真的把选项交给了角色时，才会随机换回一张历史头像。
const { content: visibleReplyContent } = await applyAvatarHistorySwitchDirective({
  characterId: character.id,
  content: contentAfterBackgroundSwitch,
  offered: Boolean(avatarHistorySwitchNote),
});

// 取出角色的 [KAOMOJI: ...] 标签（一律从正文去掉）；work 模式下落库成
// 这个聊天窗当前的状态颜文字，用来在没有头像图片时顶替头像坑位。
const { content: contentAfterWorkKaomoji } = await applyWorkKaomojiDirective({
  chatId,
  content: visibleReplyContent,
  isWorkMode: chat.mode === 'work',
});

const { content: contentAfterMood, moodMessage } = await applyMoodBubbleDirective({
  characterId: character.id,
  characterName: character.name,
  content: contentAfterWorkKaomoji,
});

const { content: contentAfterConfirmCard, cardMessage: confirmCardMessage } =
  await applyConfirmCardDirective({
    content: contentAfterMood,
  });

const mcpTrace = getMcpChatTraceSummary(
  mcpTraceSession,
);

// 取出角色的 [MEMORY_NOTE: ...] 标签（一律从正文去掉）；这只是"这次顺带
// 交代的心情"，事件本身（点外卖/转账/用了MCP）由下面各自的写回忆逻辑
// 根据实际发生的事情判定，跟这个标签是否出现无关。
const {
  content: contentAfterMemoirNote,
  emotion: memoirEmotion,
  feeling: memoirFeeling,
} = applyMemoirNoteDirective(contentAfterConfirmCard);

/**
 * 必须先处理真实声音隐藏区块，再解析普通消息。
 *
 * 如果先调用 parseAiResponseToMessages()，
 * [[REAL_VOICE]] 内部的 JSON 会被当成普通文字，
 * 后续 applyRealVoiceIntent() 就无法稳定识别。
 */
const voiceProcessedMessages = applyRealVoiceIntent(
  [{
    type: 'text',
    content: contentAfterMemoirNote,
    metadata: {},
  }],
  character.voiceProfile,
);

const voiceProcessedTextMessage = voiceProcessedMessages.find(
  (message) => message?.type === 'text',
);

const cleanedReplyContent = voiceProcessedTextMessage?.content || '';

const parsedMessages = await parseAiResponseToMessages(
  cleanedReplyContent,
);

const parsedOrFallbackMessages = parsedMessages.length > 0
  ? parsedMessages
  : cleanedReplyContent
    ? [{
        type: 'text',
        content: cleanedReplyContent,
        metadata: {},
      }]
    : [];

/**
 * 将已经从原始回复中提取出的声音意图，
 * 挂回解析后的最后一条文字消息。
 */
const safeParsedMessages = (
  voiceProcessedMessages.some(
    (message) => message?.realVoiceRequested,
  )
  && parsedOrFallbackMessages.length > 0
)
  ? parsedOrFallbackMessages.map((message, index) => {
      if (
        message?.type !== 'text'
        || index !== parsedOrFallbackMessages.length - 1
      ) {
        return message;
      }

      return {
        ...message,
        realVoiceRequested: true,
        realVoiceIntent: voiceProcessedMessages.find(
          (item) => item?.realVoiceRequested,
        )?.realVoiceIntent,
      };
    })
  : parsedOrFallbackMessages;




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
  ...(messageIndex === 0 && result.mcpCard
    ? { mcpCard: result.mcpCard }
    : {}),
  ...(messageIndex === 0 && result.usedFallbackApi
    ? { usedFallbackApi: true }
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
  ...(messageIndex === 0 && result.mcpCard
    ? { mcpCard: result.mcpCard }
    : {}),
  ...(messageIndex === 0 && result.usedFallbackApi
    ? { usedFallbackApi: true }
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

      // 回忆录：角色这次回复里如果带了转账/外卖卡片，各自记一条
      // "角色 -> user"的回忆；感受来自同一次回复里的 [MEMORY_NOTE: ...]
      // 标签（可能没有，留空即可，不影响事件本身被记下）。
      safeParsedMessages.forEach((msgData, index) => {
        const relatedMessageId = messageIds[index] ?? null;

        if (msgData?.type === 'food') {
          void recordFoodMemoir({
            chatId,
            characterId: character.id,
            direction: 'character_to_user',
            metadata: msgData.metadata,
            sourceMessageId: relatedMessageId,
            emotion: memoirEmotion,
            feeling: memoirFeeling,
            timestamp: nowIso,
          });
        } else if (msgData?.type === 'transfer') {
          void recordTransferMemoir({
            chatId,
            characterId: character.id,
            direction: 'character_to_user',
            metadata: msgData.metadata,
            content: msgData.content,
            sourceMessageId: relatedMessageId,
            emotion: memoirEmotion,
            feeling: memoirFeeling,
            timestamp: nowIso,
          });
        }
      });

      // 回忆录：角色这次成功用了某个 MCP 工具，记一条"角色 -> user"的
      // 回忆。事件本身由 mcpTrace（已经成功执行的调用）判定，跟标签是否
      // 出现无关；只有出现标签时才带上感受。
      if (mcpTrace?.calls?.length) {
        const firstCharacterMessageId = messageIds[0] ?? null;

        mcpTrace.calls
          .filter((call) => call.status === 'success')
          .forEach((call) => {
            void recordMcpMemoir({
              chatId,
              characterId: character.id,
              toolName: call.toolName,
              toolLabel: call.toolLabel,
              sourceMessageId: firstCharacterMessageId,
              emotion: memoirEmotion,
              feeling: memoirFeeling,
              timestamp: nowIso,
            });
          });
      }

      // 回忆录：如果上一条用户消息是TA给角色的转账/外卖，且角色这次带了
      // 感受标签，把感受回填到那条回忆上（事件本身在用户发送的那一刻就
      // 已经记下了，见 ChatRoom.jsx 的 recordUserGiftMemoir）。
      if (
        latestUserMessage
        && (latestUserMessage.type === 'food' || latestUserMessage.type === 'transfer')
        && (memoirEmotion || memoirFeeling)
      ) {
        void backfillMemoirFeeling({
          sourceMessageId: latestUserMessage.id,
          emotion: memoirEmotion,
          feeling: memoirFeeling,
        });
      }

      // #6 小伙伴：角色这次确实提议了一起养，追加一张邀请卡片消息。
      if (companionOfferMessage) {
        const offerMessageId = await db.messages.add({
          chatId,
          characterId: character.id,
          sender: 'character',
          type: 'companion_offer',
          content: companionOfferMessage.content,
          metadata: {},
          versions: [{
            type: 'companion_offer',
            content: companionOfferMessage.content,
            metadata: {},
            timestamp: nowIso,
          }],
                 currentVersionIndex: 0,
          isRead: false,
          timestamp: nowIso,
        });
        messageIds.push(offerMessageId);
      }

      // 确认/选择/填写卡：角色这次确实用了这个指令，追加一张卡片消息。
      if (confirmCardMessage) {
        const confirmCardMessageId = await db.messages.add({
          chatId,
          characterId: character.id,
          sender: 'character',
          type: confirmCardMessage.type,
          content: confirmCardMessage.content,
          metadata: confirmCardMessage.metadata,
          versions: [{
            type: confirmCardMessage.type,
            content: confirmCardMessage.content,
            metadata: confirmCardMessage.metadata,
            timestamp: nowIso,
          }],
          currentVersionIndex: 0,
          isRead: false,
          timestamp: nowIso,
        });
               messageIds.push(confirmCardMessageId);
      }

      // 头像心情气泡：角色这次确实带了 [MOOD: ...] 标签，除了气泡
      // 本身，聊天记录里也追加一条 mood_update 提示消息留痕（出场
      // 效果读 metadata.effect，由 MoodUpdateNotice.jsx 处理）。
      if (moodMessage) {
        const moodMessageId = await db.messages.add({
          chatId,
          characterId: character.id,
          sender: 'character',
          type: moodMessage.type,
          content: moodMessage.content,
          metadata: moodMessage.metadata,
          versions: [{
            type: moodMessage.type,
            content: moodMessage.content,
            metadata: moodMessage.metadata,
            timestamp: nowIso,
          }],
          currentVersionIndex: 0,
          isRead: false,
          timestamp: nowIso,
        });
        messageIds.push(moodMessageId);
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
            if (offlineInvite && messageIds.length > 0) {
        try {
          await proposeOfflineSessionByCharacter({
            chatId,
            characterId: character.id,
            sceneLabel: offlineInvite.sceneLabel,
            sceneDescription: offlineInvite.sceneDescription,
            scheduledFor: offlineInvite.scheduledFor,
          });
        } catch (error) {
          console.warn('[OfflineInvite] 创建角色邀约失败：', error);
        }
      }

      if (scheduledMessage && messageIds.length > 0) {
        try {
          await createScheduledMessage({
  chatId,
  characterId: character.id,
  delayMinutes: scheduledMessage.delayMinutes,
  intent: scheduledMessage.intent,
  scheduleType: scheduledMessage.scheduleType,
  cancelPolicy: scheduledMessage.cancelPolicy,
  recurringIntervalMinutes: scheduledMessage.recurringIntervalMinutes
});

        } catch (scheduleError) {
          // 预约失败不能影响当前已经成功写入的正常聊天回复。
          console.warn(
            '[ScheduledMessage] 创建对话预约失败，但当前回复已正常保存：',
            scheduleError
          );
        }
      }


      
      // 角色写了 [BUBBLE_WANT]：回复已经写入后，立刻补一次单独的调用，
      // 让它具体决定换形状 / 进场动画 / 自己写 CSS（完整提示词只在那一次里
      // 给）。不等待结果，失败也不影响已经保存的回复。
      if (screenEffect && messageIds.length > 0) {
        dispatchScreenEffect(chatId, screenEffect);
      }

      if (wantsScreenAmbient && !screenEffect && messageIds.length > 0) {
        void runScreenEffectSession({
          chatId,
          character,
          triggerReply: safeParsedMessages.find((message) => message.type === 'text')?.content || '',
          userTexts: screenEffectUserTexts,
        });
      }

      if (wantsBubbleChange && messageIds.length > 0) {
        void runBubbleStyleSession({
          chatId,
          character,
          triggerReply: safeParsedMessages.find((message) => message.type === 'text')?.content || '',
        });
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

  // 用户"这次隔了多久才回来"这个信号，必须在 markCharacterInteraction
  // 把 lastInteractionAt 刷新成现在之前读出来，所以先跑这个、
  // 再跑 markCharacterInteraction，而不是并列 void 两个。
  // 只在这条"用户发消息 -> 角色正常回复"的主路径上检查，
  // 重新生成回复、角色主动发起的消息都不代表"用户回来了"，不应该触发。
  void checkAbsenceEmotionSignal({
    chatId,
    characterId: character.id
  }).catch((error) => {
    console.warn(
      '[Memory] Absence emotion signal skipped safely:',
      error
    );
  }).finally(() => {
    void markCharacterInteraction({
      chatId,
      characterId: character.id
    }).catch((error) => {
      console.warn(
        '[Memory] Character state settlement skipped safely:',
        error
      );
    });
  });

  // 记忆整理是独立、延迟、非阻塞的后台任务。
  // 它不写入聊天消息，也不会影响当前回复。
  void scheduleMemoryProcessing(chatId);

  // 角色的DIY小屋：只挂在「用户发消息 -> 角色正常回复」这条主路径上
  // （跟上面 checkAbsenceEmotionSignal 的取舍一致）。灵感笔记标签
  // 始终独立判断（不管这次有没有触发换装都要记）；换装标签二选一——
  // 用户在聊天里明确要求的话优先走强制换装（不看冷却、必须真的换
  // 一次），否则看看是不是角色自己想换（不限次数，受这个聊天的
  // diyAutoDecorateEnabled 开关控制）。
  const diyInspirationTexts = extractDiyInspirations(cleanedReplyContent);
  diyInspirationTexts.forEach((inspirationText) => {
    void recordDiyInspiration({ chatId, text: inspirationText }).catch((error) => {
      console.warn('[DIY] Inspiration note skipped safely:', error);
    });
  });

  if (containsDiyAreaRequest(cleanedReplyContent)) {
    void forceUpdateDiyArea({ chatId, character, apiConfig }).catch((error) => {
      console.warn('[DIY] Forced DIY area update skipped safely:', error);
    });
  } else if (containsDiySelfUpdateRequest(cleanedReplyContent)) {
    void selfUpdateDiyArea({ chatId, character, apiConfig }).catch((error) => {
      console.warn('[DIY] Self-initiated DIY area update skipped safely:', error);
    });
  }

  // 神秘快递：同样只挂在这条主路径上。筹备笔记标签始终独立判断（不管
  // 这次有没有决定开始准备都要记，前提是这个聊天确实正处于
  // 'preparing' 状态，由 recordParcelNote 自己把关）；决定开始准备的
  // 标签单独处理；最后不管这次回复触发了什么，都顺带检查一下是不是
  // 到了该送达的时候——这是唯一让快递真正"流动起来"的地方，不依赖
  // 任何后台定时器。
  const parcelNoteTexts = extractParcelNotes(cleanedReplyContent);
  parcelNoteTexts.forEach((noteText) => {
    void recordParcelNote({ chatId, text: noteText }).catch((error) => {
      console.warn('[Parcel] Preparation note skipped safely:', error);
    });
  });

  if (containsParcelStartRequest(cleanedReplyContent)) {
    void startParcelPreparation({ chatId }).catch((error) => {
      console.warn('[Parcel] Starting preparation skipped safely:', error);
    });
  }

  void checkAndDeliverParcel({ chatId, character, apiConfig }).catch((error) => {
    console.warn('[Parcel] Delivery check skipped safely:', error);
  });

  // 和好券：角色自己决定兑现一张用户送的券。同样只挂在这条主路径上，
  // 同样是独立、不阻塞的后台任务，跟DIY小屋的强制换装标签同一套模式——
  // 标签不产出卡片，副作用（找到对应券、改成 redeemed）在这里触发，
  // 聊天气泡里那张券的卡片会在下一次 Dexie 实时查询刷新时自己显示
  // "已兑现"，不需要额外再发一条消息。
  if (containsCouponRedeemRequest(cleanedReplyContent)) {
    const redeemTitle = extractCouponRedeemTitle(cleanedReplyContent);
    void redeemPendingUserCoupon({ chatId, title: redeemTitle }).catch((error) => {
      console.warn('[Coupon] Character-initiated redeem skipped safely:', error);
    });
  }

  // 资料卡（昵称/#标签/个性签名）：同样只挂在这条主路径上，同样是
  // 独立、不阻塞的后台任务，跟DIY小屋完全同构，但没有用户主动触发的
  // 强制路径——这张卡完全是角色自己的节奏，失败了也只是「这次没
  // 更新」，不影响正常聊天。
  void maybeUpdateProfileCard({ chatId, character, apiConfig }).catch((error) => {
    console.warn('[ProfileCard] Character profile card check skipped safely:', error);
  });
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

        const allMessages = (await db.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp')).filter((m) => m.mode !== 'offline' && m.mode !== 'bubble');

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
  requestAiCompletion: (args) =>
    fetchAiCompletionWithTools({ ...args, chatId, characterId: character.id }),
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
        metadata: {
          ...(firstMessage.metadata || {}),
          ...(result.usedFallbackApi ? { usedFallbackApi: true } : {}),
        },
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
    } else {
      // 重新生成成功后：结算角色状态，并安排后台记忆整理（不阻塞界面）。
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
  } catch (err) {
    console.error('Reroll failed:', err);

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
export const generateCompanionProactiveMessage = async (chatId, options = {}) => {
  const intentHint = String(options?.intentHint || '').trim();
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
           const msgs = (await getRecentChatMessages(chatId, 60)).filter((m) => m.mode !== 'offline' && m.mode !== 'bubble');
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
const memoryContext = await getSafeChatMemoryContext({
  chatId,
  userText: latestUserMessage?.content || '',
  recentMessages
});

// 5.5 用完整的 msgs（而不是被截断的 recentMessages）计算精确时间线索，
// 保证即使聊天记录很长，也能拿到真正最近的两条用户消息。
const userReturnContext = buildUserReturnContext(msgs);




// 6. 主动发送场景的微指引。
const autoSendGuide = `
【注意：这是你作为伴侣的主动发起的对话触达】
由于用户有一段时间没有说话了，请你基于当下的时间背景（${getFormattedRealTime()}）和下方【用户再次出现的时间线索】中给出的精确间隔，结合你们之前的聊天上下文，主动给用户发一条问候、分享一下你此刻在做的事情、或者延续之前的某个话题。

要求：
- 直接发信，不要表现出系统正在调用你。
- 回复要轻柔、贴心，不要带有客服味道，更不要使用 Emoji。
- 只在自然相关时使用共同记忆，不要逐条复述，也不要让用户感到被监控。
- 字数控制在 100 字以内。
${intentHint ? `- 这一次，请自然地围绕这件事展开，但不要机械复述，也不要让它听起来像系统提醒：${intentHint}` : ''}
`;

const characterEmotionContext = await getSafeCharacterEmotionContext({
  chatId,
  characterId: character.id
});

const finalSystemPrompt = `${
  systemPrompt
}${memoryContext}${characterEmotionContext}${autoSendGuide}${userReturnContext}`;


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
const voiceProcessedMessages = applyRealVoiceIntent(
  [{
    type: 'text',
    content: replyText,
    metadata: {},
  }],
  character.voiceProfile,
);

const voiceProcessedTextMessage = voiceProcessedMessages.find(
  (message) => message?.type === 'text',
);

const cleanedReplyText = voiceProcessedTextMessage?.content || '';

const parsedMessages = await parseAiResponseToMessages(
  cleanedReplyText,
);

const parsedOrFallbackMessages = parsedMessages.length > 0
  ? parsedMessages
  : cleanedReplyText
    ? [{
        type: 'text',
        content: cleanedReplyText,
        metadata: {},
      }]
    : [];

const proactiveMessages = (
  voiceProcessedMessages.some(
    (message) => message?.realVoiceRequested,
  )
  && parsedOrFallbackMessages.length > 0
)
  ? parsedOrFallbackMessages.map((message, index) => {
      if (
        message?.type !== 'text'
        || index !== parsedOrFallbackMessages.length - 1
      ) {
        return message;
      }

      return {
        ...message,
        realVoiceRequested: true,
        realVoiceIntent: voiceProcessedMessages.find(
          (item) => item?.realVoiceRequested,
        )?.realVoiceIntent,
      };
    })
  : parsedOrFallbackMessages;


    // 当 AI 返回的内容不含普通文本、或卡片解析未得到结果时，
    // 必须保留原始回复，避免“AI 已回复但数据库没有可显示文本”。
    

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
 * 兼容旧调用路径。
 *
 * 实际日记生成逻辑位于：
 * src/apps/diaries/diaryGenerationService.js
 */
export const generateCompanionProactiveDiary = async (
  chatId = null
) => {
  return generateStandaloneDiary(chatId, {
    notify: notifyListeners,
    notifySystem: triggerSystemNotification
  });
};



const checkAndTriggerAutoSummary = async (chatId, character, apiConfig) => {
  const freq = parseInt(character.summaryFrequency || '10', 10);
  const msgCount = await db.messages.where('chatId').equals(chatId).count();

  if (msgCount > 0 && msgCount % (freq * 2) === 0) {
    notifySummaryStatus(chatId, true);

    try {
      if (apiConfig.baseUrl && apiConfig.apiKey) {
        const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
               const msgs = await getRecentChatMessages(chatId, 20);
        const recentHistory = msgs.map(m => `${m.sender === 'user' ? '用户' : character.name}: ${m.content}`).join('\n');

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


export default {
  subscribeAiEvents,
  subscribeSummaryStatus,
  triggerAiResponse,
  rerollAiResponse,
  generateCharacterHomeBoardMessage,
  generateCompanionReplyForDiary,
  generateCompanionProactiveDiary,
  requestNotificationPermission,
  triggerSystemNotification,
  playMessageSound,

  // SettingsPage 联动的主动任务调度器
  checkAndTriggerAutoMessage,
  startAutoMessageScheduler,
  stopAutoMessageScheduler,
  generateCompanionProactiveMessage
};