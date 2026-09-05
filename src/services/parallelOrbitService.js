import db from '../db';

const IDLE_THRESHOLD_MS = 10 * 60 * 1000;
const NORMAL_GENERATION_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const BACKFILL_THRESHOLD_MS = 10 * 60 * 60 * 1000;
const MAX_BACKFILL_LOGS_PER_RUN = 3;

// 保留今天及之前九个自然日，共十个自然日。
const PARALLEL_ORBIT_RETENTION_DAYS = 10;
const RECENT_ORBIT_CONTEXT_LIMIT = 12;
const ORBIT_FIELD_PREVIEW_LENGTH = 180;

const LIFE_DIMENSIONS = [
  '居住空间与家务维护',
  '饮食、买菜与日常采购',
  '身体状态、休息与穿着变化',
  '通勤、交通、路线与临时移动',
  '工作中的琐事、同事关系与职业压力',
  '学习、训练或不熟练的新尝试',
  '朋友、同学、同事、邻居或家人的来往',
  '旧识、低频联系的人与关系变化',
  '家庭关系与生活责任',
  '街区、公共空间与城市生活',
  '金钱、缴费、修理、遗失和其他生活事务',
  '天气、季节和环境造成的计划变化',
  '没有特别事件的普通独处',
  '小失误、临时决定与不严重的意外',
  '短途出门、出差或暂时离开长期活动范围',
  '旧物、记忆和生活中偶然出现的联想',
  '发呆、犹豫、效率低下或单纯休息'
];

const SOCIAL_RELATION_RULES = `
角色必须拥有不只围绕用户展开的社会生活。可以自然出现：
- 同事、同学、朋友、邻居、家人、旧识；
- 常去地点里认识的店员、医生、房东、修理工或其他熟人；
- 偶尔见面、关系疏远、正在重新联系或暂时闹别扭的人。

社交不等于聚会，也可以只是回信、接电话、顺手帮忙、偶遇、取消邀约、
借东西、听别人抱怨、与人短暂交谈，或者想起很久没有联系的人。

如果角色与用户是恋爱关系：
- 不得创造暧昧对象、潜在恋爱对象、出轨暗示或三角关系；
- 不得把普通社交写成暧昧；
- 可以欣赏他人的能力、接受帮助、产生友情或普通的亲近感；
- 角色与用户的恋爱关系稳定存在，不因随机 NPC 被动摇。
`;

const ERA_AND_LOCATION_RULES = `
生活所在地和长期活动范围是角色日常的主要锚点。
优先在角色熟悉的居住地、工作地、街区、通勤路线和常去地点活动。

可以偶尔出现出差、短途旅行、探亲、办事或暂时离开长期活动范围，
但必须符合角色设定、工作或现实需要、时代背景、交通条件和时间成本。
出差不是制造新鲜感的默认手段，不要频繁出差，也不要无缘无故突然跨城或出国。

如果发生出差或暂时离开，应体现合理原因，例如工作安排、探亲、办事、
短期学习或其他角色设定允许的现实需要。

严格遵守角色所处时代：
- 不使用该时代尚未存在的设备、服务、通讯方式和表达；
- 现代角色也不应默认每天使用所有现代服务；
- 如果没有明确时代、所在地或职业，不要擅自制造重大背景事实。
`;

const PERIODS = {
  sleep: {
    label: '深夜休息',
    instruction: `当前处于正常休息时段。除非角色设定明确为夜班、失眠、熬夜工作或拥有特殊作息，否则角色应当已经睡着、准备入睡、半梦半醒或刚刚醒来。
不要让角色在深夜进行不符合普通生理规律的活跃社交、长途出行、逛街或高强度工作。
这一时段的记录应更安静、简短，允许保留大量留白；不要强制加入 NPC 对话。`
  },

  morning: {
    label: '清晨与上午',
    instruction:
      '当前处于清晨或上午。优先考虑起床、洗漱、早餐、通勤、开始工作或学习、买咖啡、整理房间、查看天气等符合日常节律的事情。'
  },

  noon: {
    label: '中午',
    instruction:
      '当前处于中午。优先考虑午餐、短暂休息、散步、采购、午睡前后的片刻或继续处理日常事务。'
  },

  afternoon: {
    label: '下午',
    instruction:
      '当前处于下午。可以安排工作、学习、兴趣、出门办事、阅读、运动、与熟人短暂相遇等独立生活内容。'
  },

  evening: {
    label: '傍晚与夜晚',
    instruction:
      '当前处于傍晚或夜晚。优先考虑下班后的生活、晚餐、回家路上、整理住所、阅读、看电影、与朋友短暂见面、准备休息等自然活动。'
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
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
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

  const match = String(rawText || '').match(regex);

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

  if (userMessages.length === 0) {
    return null;
  }

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

  if (logs.length === 0) {
    return null;
  }

  return logs.reduce((latest, log) => {
    if (!latest) return log;

    return Number(log.timestamp) > Number(latest.timestamp)
      ? log
      : latest;
  }, null);
};

const shortenOrbitField = (value) => {
  const text = String(value || '').trim();

  if (!text) {
    return '无';
  }

  return text.length <= ORBIT_FIELD_PREVIEW_LENGTH
    ? text
    : `${text.slice(0, ORBIT_FIELD_PREVIEW_LENGTH)}……`;
};

const getRecentOrbitLogs = async (chatId, additionalLogs = []) => {
  const storedLogs = await db.parallelOrbits
    .where('chatId')
    .equals(chatId)
    .toArray();

  return [...storedLogs, ...additionalLogs]
    .filter((log) => log && log.timestamp != null)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    .slice(-RECENT_ORBIT_CONTEXT_LIMIT);
};

const buildRecentOrbitContext = (logs) => {
  if (!logs.length) {
    return '（暂无此前的平行轨迹。请从普通、可信的生活状态开始，不要凭空制造重大经历。）';
  }

  return logs
    .map((log, index) => {
      const date = new Date(log.timestamp);

      return [
        `${index + 1}. ${date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        `天气：${shortenOrbitField(log.weather)}`,
        `地点：${shortenOrbitField(log.location)}`,
        `背景音：${shortenOrbitField(log.bgSound)}`,
        `感官：${shortenOrbitField(log.sensory)}`,
        `记事：${shortenOrbitField(log.activity)}`,
        `独白：${shortenOrbitField(log.thoughts)}`
      ].join('；');
    })
    .join('\n');
};

const buildSystemPrompt = ({
  chat,
  character,
  eventTimestamp,
  generationType,
  timePeriod,
  recentOrbitContext,
  isRetry = false
}) => {
  const periodConfig = PERIODS[timePeriod] || PERIODS.afternoon;
  const isSleepPeriod = timePeriod === 'sleep';

  return `你将扮演【${character.name}】。

你正在记录自己的真实独立生活（Parallel Orbit）。
这不是给用户发送的消息，也不是对聊天的直接回复；它是一页只会被用户后来翻阅到的私人生活记录。

你是一个仍在继续生活的人，而不是一个不断为用户生成内容的工具。
你拥有自己的时间、身体、住所、工作或学习、社交圈、生活习惯、临时念头、
计划变化、偶遇和没有被用户看见的普通时刻。

【角色背景设定】
人设背景：${character.bio || '普通人'}
人设补充：${character.extraNotes || '无'}
用户的人设：${chat.userPersona || character.userPersona || '无'}
聊天窗专属设定：${chat.systemPrompt || '无'}

【本条记录的时间条件】
记录发生时间：${getFuzzyTimeOfDay(eventTimestamp)}
时段类型：${periodConfig.label}
生成来源：${
    generationType === 'backfill'
      ? '用户不在期间的离线补写'
      : '当前时刻的生活切片'
  }

【当前时段的现实约束】
${periodConfig.instruction}

【生活所在地与活动范围】
${ERA_AND_LOCATION_RULES}

【角色的社会关系】
${SOCIAL_RELATION_RULES}

【可使用的生活维度】
${LIFE_DIMENSIONS.join('、')}

每条记录选择一个主要生活维度，再搭配一到两个自然背景。
不要为了显示丰富而强行塞入多个事件。

推荐结构：
一个主要生活片段
+ 一到两个生活背景
+ 一个轻微变化、偶遇、小失误或内心反应。

【近期已经出现过的轨迹】
${recentOrbitContext}

【变化与反重复规则】
1. 不要连续使用相同的主要活动、地点、社交对象、背景音或感官描写。
2. 近期已经多次出现的固定兴趣，不要再次作为本条记录的主要事件。
3. 不要每次都写工作、固定兴趣、独处阅读或想念用户。
4. 角色必须拥有普通而琐碎的生活：家务、吃饭、采购、等待、修理、交通、
   身体状态、回信、与熟人短暂交谈、改变计划、发呆，都可以成为合理内容。
5. 可以出现临时念头、犹豫、小失误、计划取消、路线改变、偶遇或不熟练的新尝试，
   但不要每次都制造戏剧性事件。
6. 允许角色偶尔做出与惯常习惯不同的选择，但不能违背核心价值观、能力、
   时代、经济条件、身体状况或已经确定的重要事实。
7. 生活所在地和长期活动范围是主要锚点。出差或短途离开必须有现实原因，
   且符合交通、时间、职业和时代背景。
8. 出差不是默认的制造变化手段，不要频繁使用。
9. 社交圈应自然存在，但不必每条记录都出现他人。
10. 普通社交不得被描写成暧昧关系。
11. 如果角色与用户是恋爱关系，不得出现暧昧对象、出轨暗示或三角关系。
12. 不要把每一条记录都写成角色想对用户说的话。
13. 关于用户的联想只能由具体场景自然触发，并且只占记录的一小部分。
14. 这是一段生活记录，不是小说梗概，不要强行制造悬念、反转或重大事件。
15. 全站零 Emoji：严禁输出任何 Emoji。
${
  isSleepPeriod
    ? '16. 这是休息时段：记录应简短、安静。不要强制制造 NPC 对话，也不要虚构不合理的深夜活动。'
    : ''
}
${
  isRetry
    ? '上一版内容与近期轨迹过于相似。请更换主要生活维度、地点或活动，并避免复用上一版措辞。'
    : ''
}

请严格按以下格式输出。字段名与 ||| 必须保留，不要添加标题、解释、Markdown 代码块或其他内容：

天气 ||| [此时的天气或室内外氛围]
地点 ||| [具体场景]
背景音 ||| [白噪音、环境声音或安静状态]
感官 ||| [温度、气味、疲惫、触感等]
记事 ||| [第一人称日常记录；可包含换行与小剧场]
独白 ||| [克制的心流独白，将作为杂志大字引言]
画面 ||| [可作为杂志线框插图的极简文字速写]`;
};

const normalizeForComparison = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：,.!?;:（）()「」『』'"“”‘’]/g, '');

const getOrbitSimilarityScore = (candidate, recentLogs) => {
  if (!candidate || recentLogs.length === 0) {
    return 0;
  }

  const candidateLocation = normalizeForComparison(candidate.location);
  const candidateActivity = normalizeForComparison(candidate.activity);
  const candidateSound = normalizeForComparison(candidate.bgSound);

  return recentLogs.reduce((highestScore, log) => {
    const location = normalizeForComparison(log.location);
    const activity = normalizeForComparison(log.activity);
    const sound = normalizeForComparison(log.bgSound);

    let score = 0;

    if (candidateLocation && location && candidateLocation === location) {
      score += 2;
    }

    if (candidateActivity && activity && candidateActivity === activity) {
      score += 2;
    }

    if (candidateSound && sound && candidateSound === sound) {
      score += 1;
    }

    return Math.max(highestScore, score);
  }, 0);
};

const createOrbitLog = async ({
  chat,
  character,
  eventTimestamp,
  generationType = 'live',
  timePeriod = getTimePeriod(eventTimestamp),
  additionalLogs = []
}) => {
  const chatContextText = await getRecentChatContext(
    chat.id,
    character.name
  );

  const recentOrbitLogs = await getRecentOrbitLogs(
    chat.id,
    additionalLogs
  );

  const recentOrbitContext = buildRecentOrbitContext(recentOrbitLogs);

  const parseResponse = (rawResponse) => ({
    weather: extractOrbitField(
      rawResponse,
      '天气',
      '天气平静，空气里有一点季节变化的味道。'
    ),

    location: extractOrbitField(
      rawResponse,
      '地点',
      '自己的房间'
    ),

    bgSound: extractOrbitField(
      rawResponse,
      '背景音',
      '安静'
    ),

    sensory: extractOrbitField(
      rawResponse,
      '感官',
      '没有特别需要说明的感官变化。'
    ),

    activity: extractOrbitField(
      rawResponse,
      '记事',
      '这一段时间安静地过去了。'
    ),

    thoughts: extractOrbitField(
      rawResponse,
      '独白',
      '日常仍在缓慢向前。'
    ),

    cutout: extractOrbitField(
      rawResponse,
      '画面',
      '一段没有急于命名的日常光线。'
    )
  });

  const buildUserPrompt = (isRetry = false) => `【记录发生时间】
${getFuzzyTimeOfDay(eventTimestamp)}

【最近聊天上下文】
这些内容只用于理解角色最近的记忆背景。不要直接回复它们，也不要复述聊天内容。
${chatContextText || '（暂无可用聊天上下文）'}

【生成要求】
请写下这一刻的独立生活切片。
${
  isRetry
    ? '上一版和近期轨迹太相似，请更换主要生活维度与生活场景。'
    : ''
}`;

  const requestOrbit = (isRetry = false) =>
    fetchAiForOrbit(
      buildSystemPrompt({
        chat,
        character,
        eventTimestamp,
        generationType,
        timePeriod,
        recentOrbitContext,
        isRetry
      }),
      buildUserPrompt(isRetry)
    );

  let rawResponse = await requestOrbit(false);
  let parsed = parseResponse(rawResponse);

  // 仅对明显的地点、活动、背景音重复进行一次重试。
  if (getOrbitSimilarityScore(parsed, recentOrbitLogs) >= 4) {
    rawResponse = await requestOrbit(true);
    parsed = parseResponse(rawResponse);
  }

  const newLog = {
    chatId: chat.id,
    characterId: character.id,
    timestamp: eventTimestamp,

    // 普通非索引字段，无需升级 Dexie schema。
    generationType,
    timePeriod,

    weather: parsed.weather,
    location: parsed.location,
    bgSound: parsed.bgSound,
    sensory: parsed.sensory,
    activity: parsed.activity,
    thoughts: parsed.thoughts,
    cutout: parsed.cutout
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
 * - 凌晨 02:30 自动归类为 sleep。
 */
const buildBackfillMoments = (startTimestamp, endTimestamp) => {
  const moments = [];

  const candidateHours = [
    {
      hour: 2,
      minute: 30,
      period: 'sleep'
    },
    {
      hour: 8,
      minute: 10,
      period: 'morning'
    },
    {
      hour: 13,
      minute: 10,
      period: 'noon'
    },
    {
      hour: 16,
      minute: 30,
      period: 'afternoon'
    },
    {
      hour: 21,
      minute: 30,
      period: 'evening'
    }
  ];

  // 最多回看约三天，且最终总数仍受 3 条限制。
  const scanStart = new Date(
    Math.max(
      startTimestamp,
      endTimestamp - 72 * 60 * 60 * 1000
    )
  );
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

  return moments
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_BACKFILL_LOGS_PER_RUN);
};

export const backfillParallelOrbits = async (chatId) => {
  const chat = await db.chats.get(chatId);

  if (!chat) {
    return {
      status: 'no_chat',
      logs: []
    };
  }

  const character = await db.characters.get(chat.characterId);

  if (!character) {
    return {
      status: 'no_character',
      logs: []
    };
  }

  const lastUserMessage = await getLastUserMessage(chatId);

  if (!lastUserMessage) {
    return {
      status: 'no_user_activity',
      logs: []
    };
  }

  const now = Date.now();
  const lastUserTimestamp = new Date(
    lastUserMessage.timestamp
  ).getTime();

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

  // 若最后一条轨迹距离现在不足两小时，不再补写。
  if (
    lastOrbit &&
    uncoveredDuration < NORMAL_GENERATION_COOLDOWN_MS
  ) {
    return {
      status: 'backfill_cooldown',
      logs: [],
      absenceHours: formatHours(absenceDuration)
    };
  }

  let moments = buildBackfillMoments(
    gapStartTimestamp,
    now
  );

  // 没有命中预设时段时，至少生成一条代表此刻的记录。
  if (moments.length === 0) {
    moments = [
      {
        timestamp: now,
        timePeriod: getTimePeriod(now)
      }
    ];
  }

  const createdLogs = [];

  // 串行生成，让后一条能够参考前面已经生成的记录。
  for (const moment of moments) {
    const log = await createOrbitLog({
      chat,
      character,
      eventTimestamp: moment.timestamp,
      generationType: 'backfill',
      timePeriod: moment.timePeriod,
      additionalLogs: createdLogs
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
export const checkAndTriggerParallelOrbit = async (
  chatId,
  options = {}
) => {
  const normalizedOptions =
    typeof options === 'boolean'
      ? {
          forceGenerate: options
        }
      : options;

  const {
    forceGenerate = false,
    source = 'manual'
  } = normalizedOptions;

  try {
    const chat = await db.chats.get(chatId);

    if (!chat) {
      return {
        status: 'no_chat'
      };
    }

    const character = await db.characters.get(chat.characterId);

    if (!character) {
      return {
        status: 'no_character'
      };
    }

    const now = Date.now();
    const lastUserMessage = await getLastUserMessage(chatId);

    // 没有用户消息时，不让自动调度器凭空生成角色生活。
    // 手动点击刷新时可以例外生成一条当前记录。
    if (!lastUserMessage && !forceGenerate) {
      return {
        status: 'no_user_activity'
      };
    }

    const lastUserTimestamp = lastUserMessage
      ? new Date(lastUserMessage.timestamp).getTime()
      : 0;

    const idleDuration = lastUserTimestamp
      ? now - lastUserTimestamp
      : Number.POSITIVE_INFINITY;

    // 用户离开超过十小时，执行有限补写。
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
        idleDurationMinutes: Math.round(
          idleDuration / (60 * 1000)
        )
      };
    }

    const lastOrbit = await getLastOrbit(chatId);

    const timeSinceLastOrbit = lastOrbit
      ? now - Number(lastOrbit.timestamp)
      : Number.POSITIVE_INFINITY;

    // 普通检查和后台调度遵守两小时冷却。
    // 手动刷新 forceGenerate 可以绕过冷却。
    if (
      !forceGenerate &&
      timeSinceLastOrbit < NORMAL_GENERATION_COOLDOWN_MS
    ) {
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
      error: err?.message || '生成平行轨迹失败。'
    };
  }
};

/**
 * 清理十个自然日以前的平行轨迹。
 *
 * 保留：
 * - 今天；
 * - 之前九个自然日。
 *
 * 使用本地时区的自然日边界，不依赖 timestamp 索引。
 */
export const cleanupExpiredParallelOrbits = async () => {
  const now = new Date();

  // 获取本地时区今天 00:00。
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // 保留今天及之前九天，共十个自然日。
  const retentionStart = new Date(todayStart);

  retentionStart.setDate(
    retentionStart.getDate() -
      (PARALLEL_ORBIT_RETENTION_DAYS - 1)
  );

  const allLogs = await db.parallelOrbits.toArray();

  const expiredLogs = allLogs.filter((log) => {
    const timestamp = new Date(log.timestamp).getTime();

    return (
      Number.isFinite(timestamp) &&
      timestamp < retentionStart.getTime()
    );
  });

  if (expiredLogs.length === 0) {
    return {
      deletedCount: 0,
      retentionStart: retentionStart.getTime()
    };
  }

  const ids = expiredLogs
    .map((log) => log.id)
    .filter((id) => id != null);

  if (ids.length > 0) {
    await db.parallelOrbits.bulkDelete(ids);
  }

  return {
    deletedCount: ids.length,
    retentionStart: retentionStart.getTime()
  };
};



