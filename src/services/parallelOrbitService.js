import db from '../db';

const IDLE_THRESHOLD_MS = 10 * 60 * 1000;
const NORMAL_GENERATION_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const BACKFILL_THRESHOLD_MS = 10 * 60 * 60 * 1000;
const MAX_BACKFILL_LOGS_PER_RUN = 3;

const PERIODS = {
  sleep: {
    label: '深夜休息',
    instruction: `当前处于正常休息时段。除非角色设定明确为夜班、失眠、熬夜工作或拥有特殊作息，否则角色应当已经睡着、准备入睡、半梦半醒或刚刚醒来。
不要让角色在深夜进行不符合普通生理规律的活跃社交、长途出行、逛街或高强度工作。
这一时段的记录应更安静、简短，允许保留大量留白；不要强制加入 NPC 对话。`
  },
  morning: {
    label: '清晨与上午',
    instruction: `当前处于清晨或上午。优先考虑起床、洗漱、早餐、通勤、开始工作或学习、买咖啡、整理房间、查看天气等符合日常节律的事情。`
  },
  noon: {
    label: '中午',
    instruction: `当前处于中午。优先考虑午餐、短暂休息、散步、采购、午睡前后的片刻或继续处理日常事务。`
  },
  afternoon: {
    label: '下午',
    instruction: `当前处于下午。可以安排工作、学习、兴趣、出门办事、阅读、运动、与熟人短暂相遇等独立生活内容。`
  },
  evening: {
    label: '傍晚与夜晚',
    instruction: `当前处于傍晚或夜晚。优先考虑下班后的生活、晚餐、回家路上、整理住所、阅读、看电影、与朋友短暂见面、准备休息等自然活动。`
  }
};

const getTimePeriod = (timestamp) => {
  const hour = new Date(timestamp).getHours();

  if (hour >= 0 && hour < 7) return 'sleep';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 18) return 'afternoon';
  return 'evening';
};

const getFuzzyTimeOfDay = (timestamp) => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (hours >= 0 && hours < 5) return `深夜 ${timeStr}`;
  if (hours >= 5 && hours < 8) return `清晨 ${timeStr}`;
  if (hours >= 8 && hours < 11) return `上午 ${timeStr}`;
  if (hours >= 11 && hours < 13) return `中午 ${timeStr}`;
  if (hours >= 13 && hours < 17) return `下午 ${timeStr}`;
  if (hours >= 17 && hours < 19) return `黄昏 ${timeStr}`;
  return `夜晚 ${timeStr}`;
};

const formatHours = (milliseconds) => {
  const hours = milliseconds / (60 * 60 * 1000);
  return Math.max(0, Math.round(hours * 10) / 10);
};

const fetchAiForOrbit = async (systemPrompt, userPrompt) => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error('请先在系统设置中配置有效的 API Base URL 与 API Key。');
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
  const model = apiConfig.model || 'gpt-3.5-turbo';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
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
    throw new Error(`[API Error ${response.status}]`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

/**
 * 提取 AI 以「字段 ||| 内容」格式返回的字段。
 * 支持记事、独白等字段中的换行内容。
 */
const extractOrbitField = (rawText, fieldName, fallback) => {
  const fieldNames = [
    '天气',
    '地点',
    '背景音',
    '感官',
    '记事',
    '独白',
    '画面'
  ];

  const nextFieldPattern = fieldNames
    .filter((name) => name !== fieldName)
    .join('|');

  const regex = new RegExp(
    `(?:^|\\n)${fieldName}\\s*\\|\\|\\|\\s*([\\s\\S]*?)(?=\\n(?:${nextFieldPattern})\\s*\\|\\|\\||$)`,
    'i'
  );

  const match = rawText.match(regex);
  return match?.[1]?.trim() || fallback;
};

const getRecentChatContext = async (chatId, characterName) => {
  const recentMessages = await db.messages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(10)
    .toArray();

  recentMessages.reverse();

  return recentMessages
    .map((message) => {
      const senderName = message.sender === 'user' ? '用户' : characterName;
      const content = String(message.content || '').trim();

      if (!content) return null;
      return `${senderName}: ${content}`;
    })
    .filter(Boolean)
    .join('\n');
};

const getLastUserMessage = async (chatId) => {
  const userMessages = await db.messages
    .where('chatId')
    .equals(chatId)
    .filter((message) => message.sender === 'user')
    .toArray();

  if (userMessages.length === 0) return null;

  return userMessages.reduce((latest, message) => {
    if (!latest) return message;

    const latestTime = new Date(latest.timestamp).getTime();
    const currentTime = new Date(message.timestamp).getTime();

    return currentTime > latestTime ? message : latest;
  }, null);
};

const getLastOrbit = async (chatId) => {
  const logs = await db.parallelOrbits
    .where('chatId')
    .equals(chatId)
    .toArray();

  if (logs.length === 0) return null;

  return logs.reduce((latest, log) => {
    if (!latest) return log;
    return log.timestamp > latest.timestamp ? log : latest;
  }, null);
};

const buildSystemPrompt = ({
  chat,
  character,
  eventTimestamp,
  generationType,
  timePeriod
}) => {
  const periodConfig = PERIODS[timePeriod] || PERIODS.afternoon;
  const isSleepPeriod = timePeriod === 'sleep';

  return `你将扮演【${character.name}】。

你正在记录自己的真实独立生活（Parallel Orbit）。这不是给用户发送的消息，也不是对聊天的直接回复；它是一页只会被用户在后来翻阅到的私人生活记录。

【角色背景设定】
人设背景：${character.bio || '普通人'}
人设补充：${character.extraNotes || '无'}
用户的人设：${chat.userPersona || character.userPersona || '无'}
聊天窗专属设定：${chat.systemPrompt || '无'}

【本条记录的时间条件】
记录发生时间：${getFuzzyTimeOfDay(eventTimestamp)}
时段类型：${periodConfig.label}
生成来源：${generationType === 'backfill' ? '用户不在期间的离线补写' : '当前时刻的生活切片'}

【当前时段的现实约束】
${periodConfig.instruction}

【日常记录原则】
1. 全站零 Emoji 铁律：严禁输出任何 Emoji。
2. 你是独立生活的人，不是只围绕用户运转的陪伴工具。至少 70% 的内容必须关于你的个人生活、安排、兴趣、身体状态、现实环境或与其他人的交集。
3. 关于用户的联想最多占 20-30%，而且只能是被天气、气味、声音、书页、场景偶然触发的克制联想。不要把它写成直接给用户的情书或聊天回复。
4. 可以偶尔出现 NPC、小动物、店员、朋友或邻居，但不应每一页都刻意热闹。
5. 可以偶尔使用 <s>被划掉的文字</s> 表达游移、改主意或欲言又止。
6. 画面需要具体、自然、具备生活质地，不要使用抽象空泛的套话。
${isSleepPeriod ? '7. 这是休息时段：记录应简短、安静。不要强制制造 NPC 对话，不要虚构不合理的深夜活动。' : ''}

请严格按以下格式输出。字段名与 ||| 必须保留，不要添加标题、解释、Markdown 代码块或其他内容：

天气 ||| [此时的天气或室内外氛围]
地点 ||| [具体场景]
背景音 ||| [白噪音、环境声音或安静状态]
感官 ||| [温度、气味、疲惫、触感等]
记事 ||| [第一人称日常记录；可包含换行与小剧场]
独白 ||| [克制的心流独白，将作为杂志大字引言]
画面 ||| [可作为杂志线框插图的极简文字速写]`;
};

const createOrbitLog = async ({
  chat,
  character,
  eventTimestamp,
  generationType = 'live',
  timePeriod = getTimePeriod(eventTimestamp)
}) => {
  const chatContextText = await getRecentChatContext(chat.id, character.name);

  const systemPrompt = buildSystemPrompt({
    chat,
    character,
    eventTimestamp,
    generationType,
    timePeriod
  });

  const userPrompt = `【记录发生时间】
${getFuzzyTimeOfDay(eventTimestamp)}

【最近聊天上下文】
这些内容只用于理解角色最近的记忆背景。不要直接回复它们，不要复述聊天内容。
${chatContextText || '（暂无可用聊天上下文）'}

请写下这一刻的独立生活切片。`;

  const rawResponse = await fetchAiForOrbit(systemPrompt, userPrompt);

  const weather = extractOrbitField(rawResponse, '天气', '天气平静，空气里有一点季节变化的味道。');
  const location = extractOrbitField(rawResponse, '地点', '自己的房间');
  const bgSound = extractOrbitField(rawResponse, '背景音', '安静');
  const sensory = extractOrbitField(rawResponse, '感官', '没有特别需要说明的感官变化。');
  const activity = extractOrbitField(rawResponse, '记事', '这一段时间安静地过去了。');
  const thoughts = extractOrbitField(rawResponse, '独白', '日常仍在缓慢向前。');
  const cutout = extractOrbitField(rawResponse, '画面', '一段没有急于命名的日常光线。');

  const newLog = {
    chatId: chat.id,
    characterId: character.id,
    timestamp: eventTimestamp,

    // 普通非索引字段，无需为了它们再次升级 Dexie schema。
    generationType,
    timePeriod,

    weather,
    location,
    bgSound,
    sensory,
    activity,
    thoughts,
    cutout
  };

  const insertedId = await db.parallelOrbits.add(newLog);

  return {
    id: insertedId,
    ...newLog
  };
};

/**
 * 为长时间离开生成有限的时间切片。
 *
 * 规则：
 * - 仅在用户超过 10 小时未发言时使用；
 * - 一次最多生成 3 条；
 * - 只补写合理的时段锚点，避免变成逐小时监控；
 * - 凌晨 02:30 自动归类为 sleep，不会要求角色做不合理的夜间活动。
 */
const buildBackfillMoments = (startTimestamp, endTimestamp) => {
  const moments = [];
  const candidateHours = [
    { hour: 2, minute: 30, period: 'sleep' },
    { hour: 8, minute: 10, period: 'morning' },
    { hour: 13, minute: 10, period: 'noon' },
    { hour: 16, minute: 30, period: 'afternoon' },
    { hour: 21, minute: 30, period: 'evening' }
  ];

  // 最多回看约三天，且最终总数仍受 3 条限制。
  const scanStart = new Date(Math.max(startTimestamp, endTimestamp - 72 * 60 * 60 * 1000));
  scanStart.setHours(0, 0, 0, 0);

  const scanEnd = new Date(endTimestamp);
  scanEnd.setHours(0, 0, 0, 0);

  for (
    let dayCursor = new Date(scanStart);
    dayCursor <= scanEnd;
    dayCursor.setDate(dayCursor.getDate() + 1)
  ) {
    candidateHours.forEach(({ hour, minute, period }) => {
      const candidate = new Date(dayCursor);
      candidate.setHours(hour, minute, 0, 0);

      const candidateTimestamp = candidate.getTime();

      if (
        candidateTimestamp > startTimestamp &&
        candidateTimestamp <= endTimestamp
      ) {
        moments.push({
          timestamp: candidateTimestamp,
          timePeriod: period
        });
      }
    });
  }

  // 保留最近的有限生活片段，避免一次调用生成大量日志。
  return moments.slice(-MAX_BACKFILL_LOGS_PER_RUN);
};

export const backfillParallelOrbits = async (chatId) => {
  const chat = await db.chats.get(chatId);
  if (!chat) return { status: 'no_chat', logs: [] };

  const character = await db.characters.get(chat.characterId);
  if (!character) return { status: 'no_character', logs: [] };

  const lastUserMessage = await getLastUserMessage(chatId);
  if (!lastUserMessage) return { status: 'no_user_activity', logs: [] };

  const now = Date.now();
  const lastUserTimestamp = new Date(lastUserMessage.timestamp).getTime();
  const lastOrbit = await getLastOrbit(chatId);

  const gapStartTimestamp = Math.max(
    lastUserTimestamp,
    lastOrbit?.timestamp || 0
  );

  const absenceDuration = now - lastUserTimestamp;
  const uncoveredDuration = now - gapStartTimestamp;

  if (absenceDuration < BACKFILL_THRESHOLD_MS) {
    return {
      status: 'backfill_not_needed',
      logs: [],
      absenceHours: formatHours(absenceDuration)
    };
  }

  // 若最后一条轨迹距离现在不足两小时，不再补写，避免重复。
  if (lastOrbit && uncoveredDuration < NORMAL_GENERATION_COOLDOWN_MS) {
    return {
      status: 'backfill_cooldown',
      logs: [],
      absenceHours: formatHours(absenceDuration)
    };
  }

  let moments = buildBackfillMoments(gapStartTimestamp, now);

  // 例如用户从上午离开到深夜，而中间没有正好经过预设锚点时，
  // 至少生成一条代表“此刻”的记录。
  if (moments.length === 0) {
    moments = [{
      timestamp: now,
      timePeriod: getTimePeriod(now)
    }];
  }

  const createdLogs = [];

  for (const moment of moments) {
    const log = await createOrbitLog({
      chat,
      character,
      eventTimestamp: moment.timestamp,
      generationType: 'backfill',
      timePeriod: moment.timePeriod
    });

    createdLogs.push(log);
  }

  return {
    status: 'backfill_success',
    logs: createdLogs,
    absenceHours: formatHours(absenceDuration)
  };
};

/**
 * 生成或检查一条平行轨迹。
 *
 * 兼容旧调用方式：
 * checkAndTriggerParallelOrbit(chatId, true)
 *
 * 推荐新调用方式：
 * checkAndTriggerParallelOrbit(chatId, {
 *   forceGenerate: false,
 *   source: 'scheduler'
 * })
 */
export const checkAndTriggerParallelOrbit = async (chatId, options = {}) => {
  const normalizedOptions =
    typeof options === 'boolean'
      ? { forceGenerate: options }
      : options;

  const {
    forceGenerate = false,
    source = 'manual'
  } = normalizedOptions;

  try {
    const chat = await db.chats.get(chatId);
    if (!chat) return { status: 'no_chat' };

    const character = await db.characters.get(chat.characterId);
    if (!character) return { status: 'no_character' };

    const now = Date.now();
    const lastUserMessage = await getLastUserMessage(chatId);

    // 没有用户消息时，不让自动调度器凭空生成角色生活。
    // 手动点击刷新时可以例外生成一条当前记录。
    if (!lastUserMessage && !forceGenerate) {
      return { status: 'no_user_activity' };
    }

    const lastUserTimestamp = lastUserMessage
      ? new Date(lastUserMessage.timestamp).getTime()
      : 0;

    const idleDuration = lastUserTimestamp
      ? now - lastUserTimestamp
      : Number.POSITIVE_INFINITY;

    // 用户离开超过 10 小时：优先走符合时间段的有限补写。
    // forceGenerate 不走补写，因为用户手动点击时想要的是“此刻”记录。
    if (
      !forceGenerate &&
      lastUserTimestamp > 0 &&
      idleDuration >= BACKFILL_THRESHOLD_MS
    ) {
      return backfillParallelOrbits(chatId);
    }

    // 正在高频聊天时，不自动生成独处轨迹。
    if (
      !forceGenerate &&
      lastUserTimestamp > 0 &&
      idleDuration < IDLE_THRESHOLD_MS
    ) {
      return {
        status: 'active_chatting',
        idleDurationMinutes: Math.round(idleDuration / (60 * 1000))
      };
    }

    const lastOrbit = await getLastOrbit(chatId);
    const timeSinceLastOrbit = lastOrbit
      ? now - lastOrbit.timestamp
      : Number.POSITIVE_INFINITY;

    // 页面打开的普通检查、后台调度都遵守两小时冷却。
    // 右上角手动刷新 forceGenerate 才可以绕过。
    if (!forceGenerate && timeSinceLastOrbit < NORMAL_GENERATION_COOLDOWN_MS) {
      return {
        status: 'cooldown',
        hoursSinceLastOrbit: formatHours(timeSinceLastOrbit)
      };
    }

    const log = await createOrbitLog({
      chat,
      character,
      eventTimestamp: now,
      generationType: source === 'scheduler' ? 'live' : 'manual',
      timePeriod: getTimePeriod(now)
    });

    return {
      status: 'success',
      logId: log.id,
      data: log
    };
  } catch (err) {
    console.error('[parallelOrbitService] failed:', err);

    return {
      status: 'error',
      error: err.message
    };
  }
};

