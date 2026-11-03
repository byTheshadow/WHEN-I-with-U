import db from '../db';
import { buildRhythmPersonaBrief } from './rhythmReminderService';
import {
  getChatMemoryContext,
  getCharacterEmotionContext,
  scheduleMemoryProcessing,
} from './memoryProvider';

import {
  hasUsableMiniMaxVoiceProfile,
  normalizeVoiceProfile,
} from '../features/real-voice/realVoiceDefaults';

import { resolveVideoCallApiConfig } from './videoCallApiService';
import {
  buildVisionUserContent,
  clearTurnFrames,
  getTurnFrames,
  rememberTurnFrames,
  stopCamera,
} from '../apps/messages/call/videoCameraService';

import { synthesizeMiniMaxSpeech } from '../features/real-voice/minimaxClient';
import { getAwayState } from '../apps/messages/away/awayState';
import {
  getActiveUserAutoReply,
  maybeSendUserAutoReply,
} from '../apps/messages/userCard/userAutoReplyService';
import {
  VOICEMAIL_AUDIO_SAFETY_MS,
  estimateVoicemailReadMs,
  getVoicemail,
} from './voicemailService';

// 语音通话是消息流里的一种特殊消息类型（type: 'call'），跟拍一拍/
// 石头剪刀布互动是同一个思路：不新建 Dexie 表、不做 schema 升级，
// 只是往 metadata 里塞一个会不断被原地更新的 turns 数组。
//
// 之所以不像"离线场景"那样整屏替换，是因为用户明确要求通话进行时
// 依然要能在 ChatRoom 里正常打字——既然通话只是消息流里的一条消息，
// 它天然不会挡住下面的输入框，这个约束就自动满足了。

const makeTurnId = () => (
  `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

const sleep = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

// 标记写法放宽：方括号可能是 [ ] 也可能是全角的 【 】 ［ ］，冒号可能是
// 半角 : 也可能是全角 ：，标签名也可能被写成中文（动作 / 状态 / 心情）。
// 模型偶尔不按格式来，标记没被摘掉就会让颜文字混进台词、还被拿去合成语音。
const VIDEO_ACTION_TAG_RE = /[\[【［]\s*(?:ACTION|动作)\s*[:：]\s*([^\]】］]*)[\]】］]/gi;
const VIDEO_MOOD_TAG_RE = /[\[【［]\s*(?:MOOD|状态|心情)\s*[:：]\s*([^\]】］]*)[\]】］]/gi;

// 对整段回复（拆 "|||" 之前）一次性摘标记：标记可能单独占一段、
// 也可能出现在不同段里，按段摘会把只有标记的段整个丢掉，状态就丢了。
// 动作描写取第一个，状态颜文字取最后一个（最新的状态）。
const extractVideoTags = (rawText) => {
  let text = String(rawText || '');
  let actionText = null;
  let moodText = null;

  text = text.replace(VIDEO_ACTION_TAG_RE, (_, inner) => {
    const value = String(inner || '').trim();
    if (value && !actionText) actionText = value;
    return '';
  });

  text = text.replace(VIDEO_MOOD_TAG_RE, (_, inner) => {
    const value = String(inner || '').trim();
    if (value) moodText = value;
    return '';
  });

  // 回复被截断时可能留下没闭合的标记（比如 "[MOOD: (*/ω"），把结尾那段
  // 残缺的方括号内容去掉，免得被当成台词显示和朗读。
  text = text.replace(/[\[【［][^\]】］]*$/, '');

  return { text: text.trim(), actionText, moodText };
};

// 朗读用的文字：把台词里残留的括号内容（动作、颜文字、舞台说明）去掉，
// 只留真正要说出口的话。只用于视频通话，其他通话模式不动。
const toSpeechText = (text) => (
  String(text || '')
    .replace(/[\[【［][^\]】］]*[\]】］]/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\*[^*]+\*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
);

// AI 一次回复里如果想连着说好几句短话，用主聊天室同款的 "|||" 分隔符
// 隔开——parseAiResponseToMessages 里对普通文字消息就是这么拆的，
// 这里复用同一个约定，拆出来的每一段各自变成一条独立的通话轮次。
const splitCallReplySegments = (text) => (
  String(text || '')
    .split(/\s*\|\|\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
);

// 连发多条时，让"上一句"有足够时间在屏幕上把字打完，再出现下一句，
// 不然歌词流动区会因为"最新轮次"瞬间切换而把上一句直接截断显示。
// 这里只是按字数估个大概时长，不需要跟 CallScreen.jsx 里打字机的
// 速度精确对齐。
const CALL_TURN_READ_MS_PER_CHAR = 70;
const CALL_TURN_MIN_READ_DELAY_MS = 900;
const CALL_TURN_MAX_READ_DELAY_MS = 4200;
const CALL_TURN_BREATH_PAUSE_MS = 550;

// 视频模式一次回复要装动作描写 + 台词 + 状态颜文字三段，比语音通话的
// 一两句话长得多，沿用默认的 160 会被截断（截在方括号标记中间，残缺
// 标记会混进台词被朗读出来）。只对视频模式放大，语音通话不变。
const VIDEO_CALL_REPLY_MAX_TOKENS = 360;

const estimateCallTurnReadDelay = (text) => {
  const length = String(text || '').length;

  return Math.min(
    CALL_TURN_MAX_READ_DELAY_MS,
    Math.max(CALL_TURN_MIN_READ_DELAY_MS, length * CALL_TURN_READ_MS_PER_CHAR),
  );
};

const dispatchCallStateChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('call-state-changed'));
};

// 复用现有"伴侣发来新东西"事件：App.jsx 已经监听这个事件来播放
// 提示音，来电这里搭一趟顺风车，不用再额外接一套通知机制。
const dispatchCompanionArrival = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', {
    detail: { chatId, sender: 'character' },
  }));
};

// aiService.js 里已经有一份一模一样的 isDocumentVisible / 系统通知逻辑，
// 但那个文件已经很大了，为了不在两个互相 import 的文件之间绕圈子
// （aiService.js 本身会 import callService.js 的 getActiveCallAwarenessNote），
// 这里就地放一份精简版，只管"来电"这一种通知，不需要抽公共模块。
const isCallDocumentVisible = () => {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible';
};

// App 还活着但标签页不在前台（切到别的应用、锁屏、最小化）时，
// 单靠一段循环铃声用户很可能听不见/看不见，补一条系统通知横幅。
// 注意：这只在浏览器 / PWA 进程本身还存活的前提下有效——App 被系统
// 彻底杀掉之后，是没有任何本地代码能再运行的，那种情况需要云端
// 推送服务器主动推送，不是这里能解决的。
const triggerIncomingCallNotification = async (character, chatId) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    // data.chatId 是 sw.js 的 notificationclick 处理器认的字段——跟
    // 现有的普通消息通知走的是同一套跳转逻辑，点开就直接定位到这个
    // 聊天窗（这个聊天窗一打开，来电全屏界面会跟平时一样自动弹出）。
    await registration.showNotification(`${character?.name || '对方'} 来电`, {
      body: '点开 App 接听这通语音通话',
      icon: character?.avatar || '/favicon.ico',
      tag: 'incoming-call',
      requireInteraction: true,
      data: { chatId },
    });
  } catch (err) {
    console.warn('[callService] 来电系统通知触发失败：', err);
  }
};

export const isRealVoiceAvailableForCharacter = (character) => (
  hasUsableMiniMaxVoiceProfile(character?.voiceProfile)
);

/**
 * 当前是否已经存在一通"响铃中/进行中"的通话。
 * UI 一次只承载一通通话，来电调度器和用户手动拨打之前都要先检查这个。
 *
 * 不传 chatId：全局检查（是否任意聊天窗正在通话）——保持原有调用方行为不变。
 * 传入 chatId：只检查这一个聊天窗是否正在通话——供"通话期间暂停该聊天窗的
 * 主动消息/寄语"这类按聊天窗区分的场景使用（checkAndTriggerAutoMessage、
 * generateAndDeliverProactiveMessage、triggerRhythmActiveReminder）。
 */
export const hasAnyLiveCall = async (chatId = null) => {
  const liveCalls = await db.messages
    .where('type')
    .equals('call')
    .filter((message) => (
      (message.metadata?.status === 'ringing' || message.metadata?.status === 'active')
      && (chatId == null || message.chatId === chatId)
    ))
    .toArray();

  return liveCalls.length > 0;
};

/**
 * 供 aiService.js 在组装主聊天系统提示词时调用：如果这个聊天窗当前
 * 正在通话（响铃中或进行中），给 AI 一句简短的处境提示，让它知道
 * "我们正在通话"，但不强制它每次都提起——具体怎么表现交给它自己判断。
 */
export const getActiveCallAwarenessNote = async (chatId) => {
  if (!chatId) return '';

  const liveCalls = await db.messages
    .where('type')
    .equals('call')
    .filter((message) => (
      message.chatId === chatId
      && (message.metadata?.status === 'ringing' || message.metadata?.status === 'active')
    ))
    .toArray();

  const liveCall = liveCalls[0];
  if (!liveCall) return '';

  if (liveCall.metadata.status === 'ringing') {
    return '\n\n【通话状态】：你刚刚拨打/发起了一通电话，对方还没有接起，此刻仍在等待接通。这条文字消息和那通电话是两件平行发生的事，不必特意解释。';
  }

  return '\n\n【通话状态】：你和对方此刻正在语音通话中（一场独立、正在进行的通话）。这条文字消息是通话之外额外发来的一条消息，可以自然地提到你们正在通话，也可以完全不提。';
};

const appendTurn = async ({ messageId, turn }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns)
      ? message.metadata.turns
      : [];

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, turns: [...turns, turn] },
    });
  });

  dispatchCallStateChanged();
};

const updateTurn = async ({ messageId, turnId, patch }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns)
      ? message.metadata.turns
      : [];

    const nextTurns = turns.map((turn) => (
      turn.id === turnId ? { ...turn, ...patch } : turn
    ));

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, turns: nextTurns },
    });
  });

  dispatchCallStateChanged();
};

// 显式的"对方正在想怎么回"标记，写进 metadata 里，而不是让 UI 自己
// 猜（比如"最后一条是用户轮次就当作在思考"）——开场白、用户发言之后
// 都要经过这里，单一出口，UI 不用关心是哪种情况触发的。
const setAiThinking = async ({ messageId, aiThinking }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, aiThinking },
    });
  });

  dispatchCallStateChanged();
};

const fetchAiChatCompletion = async (apiConfig, chatMessages, maxTokens = 160) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: chatMessages,
      temperature: 0.85,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败：${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

// 通话默认只知道"这通电话自己说了什么"（message.metadata.turns），对
// 通话开始前、平时打字聊天里刚说过的事完全不知道——这就是"打字聊天
// 说吃过饭了，接起电话又被问吃了没"的根源。这里补上：取这个聊天框
// 最近几条消息（不限于文字类型，通话记录挂断后的 content 也是一段
// 可读文字），拼成一小段"最近聊天记录"塞进通话的 system prompt，跟
// 主聊天室/cloudPushService.js 里"最近聊天片段"是同一个惯例。
const CALL_CONTEXT_MAX_MESSAGES = 10;

const getMessageDisplayText = (message) => {
  if (Array.isArray(message?.versions) && message.versions.length > 0) {
    const index = Number.isInteger(message.currentVersionIndex)
      ? message.currentVersionIndex
      : 0;

    return (
      message.versions[index]?.content ||
      message.versions[index]?.text ||
      message.content ||
      ''
    );
  }

  return message?.content || '';
};

// 取原始的"最近几条消息"数组——buildRecentChatContextText（拼给通话
// 系统提示词看的一小段文字）和 getSafeChatMemoryContext（喂给长期
// 记忆检索用的 recentMessages 参数）共用同一份数据，不用各查一次库。
const getRecentCallChatMessages = async ({ chatId, excludeMessageId }) => {
  try {
    const allMessages = await db.messages.where('chatId').equals(chatId).toArray();

    return allMessages
      .filter((message) => message.id !== excludeMessageId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, CALL_CONTEXT_MAX_MESSAGES)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch (error) {
    console.warn('[callService] 读取最近聊天记录失败：', error);
    return [];
  }
};

const buildRecentChatContextText = ({ recentMessages, characterName, userName }) => {
  const lines = (recentMessages || [])
    .map((message) => {
      const text = getMessageDisplayText(message).trim();
      if (!text) return '';

      const label = message.sender === 'user' ? (userName || '我') : (characterName || 'TA');
      return `${label}：${text}`;
    })
    .filter(Boolean);

  return lines.join('\n');
};

// aiService.js 组装主聊天系统提示词时，除了"最近几条消息"，还会另外
// 拼上长期记忆检索结果（getChatMemoryContext）和角色情绪/状态块
// （getCharacterEmotionContext）——这两块之前的通话上下文修改漏掉了，
// 导致通话里只知道"最近 10 条消息"，想不起更早以前就已经建立好的
// 长期记忆（比如用户提过的偏好、角色对用户的印象）。这里补上，跟
// aiService.js 用同一套安全包装：任何一步读取失败都退化成空字符串，
// 不影响通话本身正常进行。
const getSafeChatMemoryContext = async ({ chatId, userText, recentMessages }) => {
  try {
    return await getChatMemoryContext({ chatId, userText, recentMessages });
  } catch (error) {
    console.warn('[callService] 读取长期记忆上下文失败：', error);
    return '';
  }
};

const getSafeCharacterEmotionContext = async ({ chatId, characterId }) => {
  try {
    return await getCharacterEmotionContext({ chatId, characterId });
  } catch (error) {
    console.warn('[callService] 读取角色情绪上下文失败：', error);
    return '';
  }
};

const findLatestUserMessageText = (recentMessages) => {
  const latest = [...(recentMessages || [])]
    .reverse()
    .find((message) => (
      message.sender === 'user'
      && message.type !== 'error'
      && typeof message.content === 'string'
      && message.content.trim()
    ));

  return latest?.content || '';
};

// 通话接通时如果用户选了"由TA自己决定"接听方式，用这个很小的判断
// 请求先问一次 real/text，再照常走 generateCallReply 生成第一句——
// 跟 callScheduler.js 里"要不要主动打电话"的 yes/no 判断是同一个
// 思路：小提示词、只要一个词的回答、失败就安全回退成文字。
// 没配置可用的 MiniMax 语音时直接跳过判断——这种情况下 UI 本来就不会
// 展示"由TA决定"这个选项，这里只是双重保险。
const buildVoiceModeDecisionPrompt = ({ character }) => `
你正在扮演角色「${character.name}」，这通电话马上就要开始说话。

人设背景：${character.bio || '普通人'}。

请你决定这通电话想用什么方式说话：
- 如果这一刻你更想让对方直接"听到"你的声音，输出 real
- 如果你更想用你自己的措辞和语气风格打字表达，输出 text

只输出 real 或 text，不要输出任何其他内容。
`;

const decideCallVoiceMode = async (character) => {
  if (!isRealVoiceAvailableForCharacter(character)) return 'text';

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    if (!apiConfig.baseUrl || !apiConfig.apiKey) return 'text';

    const decisionPrompt = buildVoiceModeDecisionPrompt({ character });
    const reply = await fetchAiChatCompletion(apiConfig, [
      { role: 'user', content: decisionPrompt },
    ]);

    const cleaned = reply.toLowerCase().trim();
    if (cleaned.includes('real')) return 'real';
    if (cleaned.includes('text')) return 'text';
    return 'text';
  } catch (error) {
    console.warn('[callService] 接听方式自决判断失败，退回文字模式：', error);
    return 'text';
  }
};

const synthesizeTurnAudio = async (character, rawText, { video = false } = {}) => {
  const profile = normalizeVoiceProfile(character?.voiceProfile);
  const text = video ? toSpeechText(rawText) : rawText;

  if (!hasUsableMiniMaxVoiceProfile(profile)) {
    console.warn('[callService] 通话语音没有生成：这个角色没有可用的 MiniMax 音色配置');
    return null;
  }

  if (!text?.trim()) {
    return null;
  }

  try {
    const result = await synthesizeMiniMaxSpeech({ text, voiceProfile: profile });

    if (!result?.audioBlob) return null;

    return {
      audioBlob: result.audioBlob,
      mimeType: result.mimeType || result.audioBlob.type || 'audio/mpeg',
    };
  } catch (error) {
    console.warn('[callService] 轮次语音合成失败：', error);
    return null;
  }
};

const buildCallSystemPrompt = ({ character, worldBookText, extraNotesText, recentContextText, mode }) => {
  const parts = [];

  parts.push(`你正在扮演角色「${character.name}」，现在你正在和对方进行实时${mode === 'video' ? '视频' : '语音'}通话。`);

  if (character.bio) {
    parts.push(`【角色设定】\n${character.bio}`);
  }

  if (worldBookText) {
    parts.push(`【世界观背景】\n${worldBookText}`);
  }

  if (extraNotesText) {
    parts.push(`【对话要求】\n${extraNotesText}`);
  }

  if (recentContextText) {
    parts.push(`【通话前的最近聊天记录（你们平时在打字聊天里刚说过的话，请自然承接，不要装作没发生过）】\n${recentContextText}`);
  }

  if (mode === 'video') {
    parts.push(`【实时视频通话规则】
- 这是双向视频通话。你的摄像头开启着，对方能看到你的实时画面；如果对方开启了摄像头，你也能看到对方当前画面的实时截图。
- 你的一句回复包含三个部分，按以下固定格式输出：
  [ACTION: 此时你在画面里的动作/神态描写] [MOOD: 一个契合当下心情的颜文字] 你的台词
- 格式示例：
  [ACTION: 凑近镜头眨了眨眼，嘴角带着笑] [MOOD: (*/ω＼*)] 终于接通啦，能看清我吗？
  [ACTION: 把镜头转过去照了一下桌上的咖啡杯] [MOOD: ☕] 你看，刚泡好的。
- 规则约束：
  1. [ACTION: ...] 必须是画面里能"被肉眼看到"的动作、神态、肢体语言或你在做的事，简短精炼（15~30字），不要长篇大论。
  2. [MOOD: ...] 必须是一个简短的心情颜文字（如 (*´∀\`*)、(｡•ˇ‸ˇ•｡)、(*/ω＼*) 等），用来表达你此刻在视频画面里的情绪。
  3. 台词部分要口语化，像真人视频通话时随口说出的话，1~3 句话即可，不要背书，不要书面腔。
  4. 绝不要把动作描写用括号（）写在台词里，所有画面描写必须且只能写在 [ACTION: ...] 标记内。
  5. 如果对方发来了画面截图，请自然地对画面内容做出反应（比如看到对方的表情、环境、动作等）；如果没有看到画面，就专注你自己的状态。
  6. 想连续说几句不同情绪/动作的话，可以用 ||| 分隔，每一句都要带自己的 [ACTION: ...] 和 [MOOD: ...] 标记。`);
  } else {
    parts.push(`【语音通话规则】
- 这是实时电话交流，不是文字聊天：请使用极其口语化、生活化、自然的说话方式。
- 回答要短小精炼，像真实打电话一样，通常 1~2 句话即可，不要长篇大论，不要罗列要点。
- 绝对不要输出任何动作描写、心理活动或旁白（例如不要出现"（笑了笑）""*叹了口气*"这类文字），你输出的每一个字都会被文字转语音引擎直接念出来。
- 表达情绪请通过口气词、语气词、标点符号自然流露（比如"嗯……"、"啊！"、"真的假的？"）。
- 如果你一次想说几句短话（比如先应一声再接着说），可以用 "|||" 分隔开，系统会按顺序一句一句说出来。最多不要超过 3 句。`);
  }

  return parts.join('\n\n');
};

const buildCallChatMessages = ({ systemPrompt, contextTurns, frames = [] }) => {
  const messages = [{ role: 'system', content: systemPrompt }];

  // contextTurns 里的轮次必须只把纯台词喂给后续对话——视频模式下
  // 的 actionText / moodText 是历史呈现层面的东西，如果把带标记的
  // 原始文本再塞回上下文，很容易让模型在后面的轮次里格式混乱或复读。
  const turnsToReplay = contextTurns.slice(-12);

  turnsToReplay.forEach((turn, index) => {
    const isLatestTurn = index === turnsToReplay.length - 1;
    const isUserTurn = turn.by === 'user';

    // 只有"最近的一条用户轮次"才附带视觉截帧（即刚发过来的这句）。
    // 较早轮次的截帧不再重复发送，避免上下文 token 爆炸和多轮视觉混淆。
    if (isLatestTurn && isUserTurn && Array.isArray(frames) && frames.length > 0) {
      messages.push({
        role: 'user',
        content: buildVisionUserContent(turn.content, frames),
      });
      return;
    }

    messages.push({
      role: turn.by === 'user' ? 'user' : 'assistant',
      content: turn.content,
    });
  });

  return messages;
};

/**
 * 核心：为指定通话生成 AI 的下一句（或开场白）。
 * 既被通话接通时调用（如果对方打进来，对方先开口），也被用户发送一轮后调用。
 *
 * 真实语音模式下：为了不让用户对着"思考中"死等 MiniMax 合成完几秒钟，先发
 * 一条 pending 的文字轮次，再异步补上语音。
 */
const generateCallReply = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.type !== 'call' || message.metadata?.status !== 'active') {
    return;
  }

  await setAiThinking({ messageId, aiThinking: true });

  try {
    const character = await db.characters.get(message.characterId);
    if (!character) return;

    const apiSettings = await db.settings.get('apiConfig');
    let apiConfig = apiSettings?.value || {};

    // 视频通话优先用设置里单独配的视频 API，没配就退回主 API。
    if (message.metadata?.mode === 'video') {
      apiConfig = await resolveVideoCallApiConfig();
    }

    if (!apiConfig.baseUrl || !apiConfig.apiKey) return;

    const chat = await db.chats.get(message.chatId);
    const userName = chat?.userName || character?.userName || '';

    const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
    const recentMessages = await getRecentCallChatMessages({
      chatId: message.chatId,
      excludeMessageId: messageId,
    });
    const recentContextText = buildRecentChatContextText({
      recentMessages,
      characterName: character.name,
      userName,
    });
    const memoryContext = await getSafeChatMemoryContext({
      chatId: message.chatId,
      userText: findLatestUserMessageText(recentMessages),
      recentMessages,
    });
    const characterEmotionContext = await getSafeCharacterEmotionContext({
      chatId: message.chatId,
      characterId: character.id,
    });
    const turns = Array.isArray(message.metadata.turns) ? message.metadata.turns : [];
    const isOpeningLine = turns.length === 0;
    const mode = message.metadata.mode;

    let systemPrompt = buildCallSystemPrompt({ character, worldBookText, extraNotesText, recentContextText, mode });
    systemPrompt += memoryContext + characterEmotionContext;

    if (isOpeningLine) {
           systemPrompt += '\n\n现在电话刚刚接通，请你先开口说第一句话（比如打招呼，或者说明这通电话想说的事）。';

      // 来电理由:有的话让第一句话自然带出来,没有就保持原来的开场方式。
      const callReason = String(message.metadata?.reason || '').trim();
      if (callReason) {
        systemPrompt += `\n你打这通电话的原因是：${callReason}。第一句话要自然地带出这个原因，不要原样照念。`;
      }
    }

    // 视频模式：从最新的用户轮次里取截帧，注入视觉上下文。
    // 截帧在 sendCallTurn 里只放进内存，不写数据库，这里按轮次 id 取。
    const latestUserTurn = [...turns].reverse().find((turn) => turn.by === 'user');
    const frames = mode === 'video' && latestUserTurn ? getTurnFrames(latestUserTurn.id) : [];

    const chatMessages = buildCallChatMessages({ systemPrompt, contextTurns: turns, frames });

    let replyText = '';

    try {
      replyText = await fetchAiChatCompletion(
        apiConfig,
        chatMessages,
        mode === 'video' ? VIDEO_CALL_REPLY_MAX_TOKENS : undefined,
      );
    } catch (error) {
      console.error('[callService] 生成通话回复失败：', error);
      return;
    }

    // 视频模式：先对整段回复摘掉 [ACTION] / [MOOD] 标记，再拆 "|||"。
    const videoTags = mode === 'video' ? extractVideoTags(replyText) : null;
    const segments = splitCallReplySegments(videoTags ? videoTags.text : replyText);
    if (segments.length === 0) return;

    // 一次回复可能被 "|||" 拆成好几句——依次追加成独立的轮次，句间
    // 留一小段"喘气"停顿和按字数估算的阅读时长，让歌词流动区一句
    // 一句地浮现，而不是一次性全部糊在一起。"思考中"三个点只在等第一句
    // 话的时候用；同一次回复里后面几句之间只是安静地停顿一下，不再
    // 重新亮起三个点——那样在歌词界面上看起来像句子中间插了个奇怪的
    // 连接件，不像真人说话中间的停顿。
    for (let index = 0; index < segments.length; index += 1) {
      if (index > 0) {
        await sleep(CALL_TURN_BREATH_PAUSE_MS);
      }

      const rawSegment = segments[index];
      // 视频模式：动作描写挂在第一句，状态颜文字挂在最后一句。
      const parsed = videoTags
        ? {
          content: rawSegment,
          actionText: index === 0 ? videoTags.actionText : null,
          moodText: index === segments.length - 1 ? videoTags.moodText : null,
        }
        : { content: rawSegment, actionText: null, moodText: null };
      const segment = parsed.content;

      // 整句都是标记、摘完没剩下台词的话，没什么好显示/朗读的，跳过这一段。
      if (!segment) continue;

      const hasSpeechAudio = mode === 'real' || mode === 'video';

      const aiTurn = {
        id: makeTurnId(),
        by: 'ai',
        content: segment,
        actionText: parsed.actionText,
        moodText: parsed.moodText,
        mode,
        audioStatus: hasSpeechAudio ? 'pending' : null,
        audio: null,
        at: new Date().toISOString(),
      };

      await appendTurn({ messageId, turn: aiTurn });

      // 如果有下一句，按当前句子的字数等一小会儿，给上一句留出在歌词
      // 区域打字打完的时间。
      const hasNextSegment = index < segments.length - 1;
      const readingDelayPromise = hasNextSegment
        ? sleep(estimateCallTurnReadDelay(segment))
        : Promise.resolve();

      // 真实语音 / 视频模式：异步合成当前轮次的音频，合成好就原地 patch 进去。
      // 阅读时长的等待与语音合成并行，互不阻塞。
      if (hasSpeechAudio) {
        void (async () => {
          const synthesized = await synthesizeTurnAudio(character, segment, { video: mode === 'video' });
          await updateTurn({
            messageId,
            turnId: aiTurn.id,
            patch: {
              audioStatus: synthesized ? 'ready' : 'failed',
              audio: synthesized || null,
            },
          });
        })();
      }

      await readingDelayPromise;
    }
  } finally {
    await setAiThinking({ messageId, aiThinking: false });
  }
};

/**
 * 用户在通话中说了一句话（点发送或语音识别完成）。
 *
 * 视频模式下可传入 frames（来自 videoCameraService.captureRecentFrames 的截帧数组）。
 * 截帧只暂存在内存里，用 turnId 建立索引供 generateCallReply 取用；绝对不把 base64
 * 写入 IndexedDB，避免把数据库撑爆。
 */
export const sendCallTurn = async ({ messageId, text, frames = [] }) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;

  const message = await db.messages.get(messageId);
  if (!message || message.type !== 'call' || message.metadata?.status !== 'active') {
    return;
  }

  const turnId = makeTurnId();
  const mode = message.metadata.mode;

  // 视频模式下：如果带了截帧，把截帧和这个 turnId 绑定缓存在内存中，
  // 供 generateCallReply 构建多模态消息时使用。
  if (mode === 'video' && Array.isArray(frames) && frames.length > 0) {
    rememberTurnFrames(turnId, frames);
  }

  const userTurn = {
    id: turnId,
    by: 'user',
    content: trimmed,
    mode,
    audioStatus: null,
    audio: null,
    at: new Date().toISOString(),
  };

  await appendTurn({ messageId, turn: userTurn });

  // 触发 AI 回复（异步，UI 不需要等它）
  void generateCallReply({ messageId });
};

/**
 * 重新生成（重 roll）某一句 AI 的回复轮次。
 * 类似主聊天室 aiService.js 里的 regenerateAiResponse，但粒度在一句通话轮次：
 * - 找到这句轮次在 turns 里的位置；
 * - 截取它之前的所有轮次作为上下文重新请求模型；
 * - 新生成的一句作为新版本 push 进 versions 数组，顶层字段切换成最新版；
 * - 真实语音模式下异步合成新版本的音频；
 * - 重 roll 期间不打扰其它轮次，也不会把这句后面的轮次直接粗暴抹掉。
 */
export const rerollCallTurn = async ({ messageId, turnId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.type !== 'call') return;

  const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];
  const turnIndex = turns.findIndex((turn) => turn.id === turnId);
  const targetTurn = turns[turnIndex];

  if (!targetTurn || targetTurn.by !== 'ai') return;

  const character = await db.characters.get(message.characterId);
  if (!character) return;

  const apiSettings = await db.settings.get('apiConfig');
  let apiConfig = apiSettings?.value || {};

  // 视频通话优先用设置里单独配的视频 API，没配就退回主 API。
  if (message.metadata?.mode === 'video') {
    apiConfig = await resolveVideoCallApiConfig();
  }

  if (!apiConfig.baseUrl || !apiConfig.apiKey) return;

  const chat = await db.chats.get(message.chatId);
  const userName = chat?.userName || character?.userName || '';

  const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
  const recentMessages = await getRecentCallChatMessages({
    chatId: message.chatId,
    excludeMessageId: messageId,
  });
  const recentContextText = buildRecentChatContextText({
    recentMessages,
    characterName: character.name,
    userName,
  });
  const memoryContext = await getSafeChatMemoryContext({
    chatId: message.chatId,
    userText: findLatestUserMessageText(recentMessages),
    recentMessages,
  });
  const characterEmotionContext = await getSafeCharacterEmotionContext({
    chatId: message.chatId,
    characterId: character.id,
  });
  const isOpeningLine = turnIndex === 0;
  const rerollMode = message.metadata.mode;

  let systemPrompt = buildCallSystemPrompt({ character, worldBookText, extraNotesText, recentContextText, mode: rerollMode });
  systemPrompt += memoryContext + characterEmotionContext;

  if (isOpeningLine) {
    systemPrompt += '\n\n现在电话刚刚接通，请你先开口说第一句话（比如打招呼，或者说明这通电话想说的事）。';
  }

  const contextTurns = turns.slice(0, turnIndex);
  // reroll 不重新截帧，沿用被 reroll 这句之前最近的用户截帧（如有）
  const latestUserTurnBeforeReroll = [...contextTurns].reverse().find((turn) => turn.by === 'user');
  const rerollFrames = rerollMode === 'video' && latestUserTurnBeforeReroll ? getTurnFrames(latestUserTurnBeforeReroll.id) : [];
  const chatMessages = buildCallChatMessages({ systemPrompt, contextTurns, frames: rerollFrames });

  let replyText = '';

  try {
    replyText = await fetchAiChatCompletion(
      apiConfig,
      chatMessages,
      rerollMode === 'video' ? VIDEO_CALL_REPLY_MAX_TOKENS : undefined,
    );
  } catch (error) {
    console.error('[callService] 重 roll 通话轮次失败：', error);
    return;
  }

  // 重 roll 只针对这一句轮次本身，就算模型这次又用 "|||" 说了好几句，
  // 也只取第一句——真想让它连着说好几句，应该重 roll 之后再手动继续
  // 通话，而不是让一次重 roll 意外多出好几条新轮次。
  const mode = targetTurn.mode;
  // 视频模式：reroll 出来的这句也要摘出 [ACTION: ...] / [MOOD: ...]。
  const rerollTags = mode === 'video' ? extractVideoTags(replyText) : null;
  const [rawNewContent] = splitCallReplySegments(rerollTags ? rerollTags.text : replyText);
  if (!rawNewContent) return;

  const parsedReroll = rerollTags
    ? { content: rawNewContent, actionText: rerollTags.actionText, moodText: rerollTags.moodText }
    : { content: rawNewContent, actionText: null, moodText: null };
  const newContent = parsedReroll.content;
  if (!newContent) return;

  const hasSpeechAudio = mode === 'real' || mode === 'video';
  const nowIso = new Date().toISOString();

  const existingVersions = Array.isArray(targetTurn.versions) && targetTurn.versions.length > 0
    ? targetTurn.versions
    : [{
      content: targetTurn.content,
      actionText: targetTurn.actionText || null,
      moodText: targetTurn.moodText || null,
      mode: targetTurn.mode,
      audioStatus: targetTurn.audioStatus,
      audio: targetTurn.audio,
      at: targetTurn.at,
    }];

  const newVersion = {
    content: newContent,
    actionText: parsedReroll.actionText,
    moodText: parsedReroll.moodText,
    mode,
    audioStatus: hasSpeechAudio ? 'pending' : null,
    audio: null,
    at: nowIso,
  };

  const nextVersions = [...existingVersions, newVersion];
  const nextIndex = nextVersions.length - 1;

  await updateTurn({
    messageId,
    turnId,
    patch: {
      content: newVersion.content,
      actionText: newVersion.actionText,
      moodText: newVersion.moodText,
      audioStatus: newVersion.audioStatus,
      audio: newVersion.audio,
      versions: nextVersions,
      currentVersionIndex: nextIndex,
    },
  });

  if (hasSpeechAudio) {
    const synthesized = await synthesizeTurnAudio(character, newContent, { video: mode === 'video' });

    await db.transaction('rw', db.messages, async () => {
      const latestMessage = await db.messages.get(messageId);
      if (!latestMessage) return;

      const latestTurns = Array.isArray(latestMessage.metadata?.turns)
        ? latestMessage.metadata.turns
        : [];

      const nextTurns = latestTurns.map((turn) => {
        if (turn.id !== turnId) return turn;

        const versions = Array.isArray(turn.versions) ? [...turn.versions] : [];

        if (versions[nextIndex]) {
          versions[nextIndex] = {
            ...versions[nextIndex],
            audioStatus: synthesized ? 'ready' : 'failed',
            audio: synthesized || null,
          };
        }

        // 只有用户这段时间里没有手动切换到别的版本，才把顶层（当前
        // 展示用）字段也一起补上语音——不然合成慢一点，用户已经翻回
        // 旧版本了，语音反而会安错地方。
        const isStillOnThisVersion = (
          (turn.currentVersionIndex ?? versions.length - 1) === nextIndex
        );

        return {
          ...turn,
          versions,
          ...(isStillOnThisVersion
            ? { audioStatus: synthesized ? 'ready' : 'failed', audio: synthesized || null }
            : {}),
        };
      });

      await db.messages.update(messageId, {
        metadata: { ...latestMessage.metadata, turns: nextTurns },
      });
    });

    dispatchCallStateChanged();
  }
};

/**
 * 在某一句轮次已经有的多个版本之间切换（上一条 / 下一条），跟主聊天室
 * 的 handleSwitchVersion 是同一个思路。
 */
export const switchCallTurnVersion = async ({ messageId, turnId, direction }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];

    const nextTurns = turns.map((turn) => {
      if (turn.id !== turnId) return turn;

      const versions = Array.isArray(turn.versions) ? turn.versions : [];
      if (versions.length <= 1) return turn;

      const currentIndex = turn.currentVersionIndex ?? (versions.length - 1);
      const nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= versions.length) return turn;

      const targetVersion = versions[nextIndex];

      return {
        ...turn,
        content: targetVersion.content,
        actionText: targetVersion.actionText || null,
        moodText: targetVersion.moodText || null,
        mode: targetVersion.mode,
        audioStatus: targetVersion.audioStatus,
        audio: targetVersion.audio,
        currentVersionIndex: nextIndex,
      };
    });

    await db.messages.update(messageId, {
      metadata: { ...message.metadata, turns: nextTurns },
    });
  });

  dispatchCallStateChanged();
};

const connectOutgoingCall = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.metadata?.status !== 'ringing') return;

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      status: 'active',
      connectedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();
  void generateCallReply({ messageId });
};

/**
 * 把一通"对方无法接听"的呼出电话正式结束。
 * 兜底计时到点、语音信箱播完（VoicemailStage）都会走这里；
 * 电话已经不在响铃状态（比如用户自己挂断了）就什么都不做，重复调用也没有副作用。
 */
export const finishUnavailableCall = async ({ messageId }) => {
  const latest = await db.messages.get(messageId);
  if (!latest || latest.metadata?.status !== 'ringing') return;

  await db.messages.update(messageId, {
    metadata: {
      ...latest.metadata,
      status: 'ended',
      declined: true,
      unavailable: true,
      endedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();
};

/**
 * 角色暂时不在线：通话界面显示"对方暂时无法接听"。
 * 角色设置了语音信箱的话，接着显示留言文字，并播放已经合成好的语音（没有语音就只显示文字），
 * 播完再结束；没设置语音信箱就和以前一样，稍等一下就结束。
 * 用户在响铃期间已经自己挂断的话，什么都不做。
 */
const markOutgoingCallUnavailable = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.metadata?.status !== 'ringing') return;

  const character = await db.characters.get(message.characterId);
  const voicemail = getVoicemail(character);

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      unavailable: true,
      ...(voicemail
        ? { voicemail: { text: voicemail.text, hasAudio: Boolean(voicemail.audioBlob) } }
        : {}),
    },
  });

  dispatchCallStateChanged();

  // 有语音时，正常情况下由 VoicemailStage 在播完后结束通话，这里只是兜底。
  const holdMs = !voicemail
    ? 2400
    : (voicemail.audioBlob ? VOICEMAIL_AUDIO_SAFETY_MS : estimateVoicemailReadMs(voicemail.text));

  window.setTimeout(() => {
    void finishUnavailableCall({ messageId });
  }, holdMs);
};

/**
 * 用户主动拨打电话。mode 在拨打前就已经选好（'real' | 'text'）。
 */
export const startOutgoingCall = async ({ chatId, characterId, mode }) => {
  if (await hasAnyLiveCall()) return null;

  // 角色处于"暂时不在线"的时段：正常响铃，但不会接通。
  const chatRecord = await db.chats.get(chatId);
  const isUnavailable = getAwayState(chatRecord).away;

  const timestamp = new Date().toISOString();

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'user',
    type: 'call',
    content: '',
    metadata: {
      status: 'ringing',
      direction: 'outgoing',
      mode,
      startedAt: timestamp,
      connectedAt: null,
      endedAt: null,
      declined: false,
      aiThinking: false,
      audioRetentionDecided: false,
      audioRetained: null,
      turns: [],
    },
    isRead: true,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });
  dispatchCallStateChanged();

  if (isUnavailable) {
    // 多响一会儿，然后显示"暂时无法接听"，不会接通。
    window.setTimeout(() => {
      void markOutgoingCallUnavailable({ messageId });
    }, 6000 + Math.random() * 3000);

    return messageId;
  }

  // 短暂"拨打中"再接通，营造一点真实电话的接通感。
  window.setTimeout(() => {
    void connectOutgoingCall({ messageId });
  }, 1400 + Math.random() * 900);

  return messageId;
};

/**
 * 角色主动打进来（由 callScheduler.js 调用）。这里只负责"响铃"，
 * 接听方式（mode）要等用户接听时才选。
 */
export const startIncomingCall = async ({ chatId, characterId, inviteId = null, ringUntil = null, reason = '' }) => {
  if (await hasAnyLiveCall()) return null;

  // inviteId 来自云端后台来电邀请（cloudCallService.js），本地调度器
  // callScheduler.js 发起的来电不带这个字段。带了就先查重——同一条
  // 云端邀请可能因为网络问题被同步两次，不能建出两通重复的来电。
  if (inviteId) {
    const existing = await db.messages
      .where('type')
      .equals('call')
      .filter((message) => message.metadata?.inviteId === inviteId)
      .first();

    if (existing) return null;
  }

    // 用户把状态设为"暂时不在线"、开着自动回复、并且对这个角色可见时：
  // 不让电话响铃，直接记成一通未接来电，再补发一条自动回复。
  if (await getActiveUserAutoReply(characterId)) {
    const awayCharacter = await db.characters.get(characterId);
    const missedId = await recordMissedCloudCall({
      chatId,
      characterId,
      characterName: awayCharacter?.name,
      inviteId,
    });

    void maybeSendUserAutoReply({ chatId, characterId });

    return missedId;
  }

  const timestamp = new Date().toISOString();

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'character',
    type: 'call',
    content: '',
    metadata: {
      status: 'ringing',
      direction: 'incoming',
      mode: null,
      startedAt: timestamp,
      connectedAt: null,
      endedAt: null,
      declined: false,
      aiThinking: false,
      audioRetentionDecided: false,
      audioRetained: null,
           turns: [],
      inviteId,
      ringUntil,
      // 角色为什么打来(callScheduler.js 概率命中后生成;云端邀请和
      // 用户手动拨出的通话没有这个字段,读取方要按空串处理)。
      reason: String(reason || ''),
    },
    isRead: false,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });
  dispatchCallStateChanged();
  dispatchCompanionArrival(chatId);

  if (!isCallDocumentVisible()) {
    const character = await db.characters.get(characterId);
    void triggerIncomingCallNotification(character, chatId);
  }

  return messageId;
};

/**
 * 云端后台来电邀请过期、用户没能在有效期内点开时，补一条"未接来电"
 * 记录。数据形状跟正常的未接来电（declined: true, direction: 'incoming'）
 * 完全一致，CallLogEntry.jsx 不用改一行就能正确显示"未接听的来电"。
 * content 写一句中性描述，非空 content 会让这条记录自动被现有记忆
 * 管线收进去，跟 endCall() 写通话记录是同一条路径。
 */
export const recordMissedCloudCall = async ({ chatId, characterId, characterName, inviteId }) => {
  if (inviteId) {
    const existing = await db.messages
      .where('type')
      .equals('call')
      .filter((message) => message.metadata?.inviteId === inviteId)
      .first();

    if (existing) return null;
  }

  const timestamp = new Date().toISOString();
  const content = `${characterName || '对方'}给你打了电话，你没有接。`;

  const messageId = await db.messages.add({
    chatId,
    characterId,
    sender: 'character',
    type: 'call',
    content,
    metadata: {
      status: 'ended',
      direction: 'incoming',
      mode: null,
      startedAt: timestamp,
      connectedAt: null,
      endedAt: timestamp,
      declined: true,
      aiThinking: false,
      audioRetentionDecided: false,
      audioRetained: null,
      turns: [],
      inviteId,
      ringUntil: null,
    },
    isRead: false,
    timestamp,
  });

  await db.chats.update(chatId, { updatedAt: timestamp });
  dispatchCallStateChanged();

  void scheduleMemoryProcessing(chatId);

  return messageId;
};

export const acceptCall = async ({ messageId, mode }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.metadata?.status !== 'ringing') return;

  // mode === 'auto' 表示用户选了"由TA决定"——这里先问一次，再把解析出
  // 的真实模式（'real' | 'text'）写进 metadata，其余逻辑
  // （generateCallReply、CallLogEntry.jsx 的图标判断等）完全不用关心
  // 'auto' 这个中间态，看到的永远是最终落地的模式。
  let resolvedMode = mode;

  if (mode === 'auto') {
    const character = await db.characters.get(message.characterId);
    resolvedMode = await decideCallVoiceMode(character);
  }

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      status: 'active',
      mode: resolvedMode,
      connectedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();

  if (message.metadata.direction === 'incoming') {
    void generateCallReply({ messageId });
  }
};

export const declineCall = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message) return;

  await db.messages.update(messageId, {
    metadata: {
      ...message.metadata,
      status: 'ended',
      declined: true,
      endedAt: new Date().toISOString(),
    },
  });

  dispatchCallStateChanged();
};

// 把通话轮次拼成一段可读文字，写进这条 call 消息自己的 content 字段。
// memorySignals.js 的 isUsableMessage 只要求 type !== 'error'、非空
// content、sender 在支持列表里——call 消息本来就满足后两条，只要把
// content 填上，现有的记忆提炼流程（memoryScheduler.js）就会像扫普通
// 文字消息一样自动扫到它，完全不用改记忆系统本身。
const buildCallTranscript = ({ character, userName, turns, mode }) => {
  const safeTurns = Array.isArray(turns) ? turns : [];
  const aiLabel = character?.name || 'TA';
  const userLabel = userName || '我';

  const lines = safeTurns
    .filter((turn) => String(turn?.content || '').trim())
    .map((turn) => {
      const speaker = turn.by === 'ai' ? aiLabel : userLabel;
      // 视频模式下，动作描写也写进记忆用的文字记录里，让后续记忆/
      // 回顾能看到"做了什么"，不只是"说了什么"；状态颜文字只是界面
      // 装饰，不写进去，免得记忆里全是颜文字。
      const action = turn.actionText ? `（${turn.actionText}）` : '';
      return `${speaker}：${action}${turn.content.trim()}`;
    });

  if (lines.length === 0) return '';

  const label = mode === 'video' ? '视频通话' : '语音通话';
  return `[${label}记录]\n${lines.join('\n')}`;
};

/**
 * 挂断通话。按照约定，通话只能由用户手动挂断，没有不活动自动超时。
 * 挂断的同时把这通电话的文字记录写进 content，并入记忆提炼队列——
 * 跟普通消息触发记忆扫描是同一条路径，参考 aiService.js 里的用法。
 */
export const endCall = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message) return;

  const [chat, character] = await Promise.all([
    db.chats.get(message.chatId),
    db.characters.get(message.characterId),
  ]);

  const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];
  const userName = chat?.userName || character?.userName || '';
  const transcript = buildCallTranscript({ character, userName, turns, mode: message.metadata?.mode });

  await db.messages.update(messageId, {
    content: transcript,
    metadata: {
      ...message.metadata,
      status: 'ended',
      endedAt: new Date().toISOString(),
    },
  });

  // 视频模式：释放摄像头资源
  stopCamera();
  clearTurnFrames();

  dispatchCallStateChanged();

  if (transcript) {
    void scheduleMemoryProcessing(message.chatId);
  }
};

/**
 * 真实语音通话结束后，询问用户要不要把合成出来的语音留在本地——
 * 音频 Blob 直接存在 IndexedDB 里，通话越多、语音越长，占用的本地
 * 空间也会越涨，所以给用户一个"只留文字、删掉语音"的选项。
 * 这个决定只需要做一次，做过之后 CallReviewModal 就不会再追问。
 */
export const setAudioRetention = async ({ messageId, keepAudio }) => {
  await db.transaction('rw', db.messages, async () => {
    const message = await db.messages.get(messageId);
    if (!message) return;

    const turns = Array.isArray(message.metadata?.turns) ? message.metadata.turns : [];

    // 重 roll 之后一句轮次可能带着好几个版本，每个版本都可能各自
    // 合成过语音——"只留文字、删掉语音"要把每个版本里的音频都清掉，
    // 不能只清当前显示的这一个，不然切回旧版本时语音又冒出来了。
    const stripTurnAudio = (turn) => {
      const strippedVersions = Array.isArray(turn.versions)
        ? turn.versions.map((version) => (
          version.audio
            ? {
              ...version,
              audio: null,
              audioStatus: version.audioStatus === 'ready' ? 'removed' : version.audioStatus,
            }
            : version
        ))
        : turn.versions;

      if (!turn.audio && strippedVersions === turn.versions) return turn;

      return {
        ...turn,
        audio: null,
        audioStatus: turn.audioStatus === 'ready' ? 'removed' : turn.audioStatus,
        ...(strippedVersions ? { versions: strippedVersions } : {}),
      };
    };

    const nextTurns = keepAudio
      ? turns
      : turns.map(stripTurnAudio);

    await db.messages.update(messageId, {
      metadata: {
        ...message.metadata,
        turns: nextTurns,
        audioRetentionDecided: true,
        audioRetained: keepAudio,
      },
    });
  });

  dispatchCallStateChanged();
};
