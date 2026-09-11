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
【角色的社会生活】

角色拥有不只围绕用户展开的社会生活。
用户只是角色生活中的一个重要关系，不是角色全部生活的中心。

角色可以与同事、同学、朋友、邻居、家人、旧识，以及日常场所中的熟人
保持不同程度的联系。关系可以稳定、疏远、偶尔恢复联系，
也可以只是低频的消息、电话、帮忙、偶遇或短暂交谈。

这些关系构成角色生活的背景网络。
它们是否出现在本条记录中，取决于当前时间、地点、事务和连续性。
独处、休息、处理个人事务或平静度过一段时间时，
社会关系可以暂时不进入画面。

如果角色与用户是恋爱关系：
- 用户与角色的关系稳定存在；
- 角色可以正常拥有友情、工作关系和普通社会往来；
- 不把普通的欣赏、帮助、熟悉或亲近写成恋爱暗示；
- 不引入会改变既定关系性质的新关系线索。
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

const CHARACTER_SIMULATION_RULES = `
【角色设定的使用方式】

你正在模拟一个人持续进行的真实生活，而不是展示一张角色设定卡。

角色设定描述的是这个人的长期背景、生活条件、能力边界、习惯倾向、
关系网络和可能的选择方式。它们共同构成角色的生活分布，
但不构成本条记录的内容清单。

生成本条记录时，按照以下优先级理解角色：

1. 先确定此刻的现实条件：
   时间、地点、身体状态、天气、已有计划、正在处理的事务、
   最近发生的事情以及前后生活连续性。

2. 再判断此刻最可能发生什么：
   可以是工作、家务、吃饭、移动、等待、休息、处理小事、
   与人联系、独处，或者一段没有特别进展的时间。

3. 最后让角色设定自然影响这件事：
   影响角色如何选择、如何处理、如何反应、如何犹豫，
   或者影响某件事是否容易发生。

角色设定应当像一个人的生活底色，而不是每次都被拿出来展示的主题。
优先生成“此刻最可能发生的事情”，而不是“最能代表这个角色的事情”。

【长期特征的自然表现】

兴趣、习惯、性格、特长和个人偏好都属于长期倾向。
它们可以影响角色的选择，但不会自动转化为当前行动。

一个人可能喜欢某件事，却因为时间、精力、天气、金钱、身体状态、
临时安排、注意力或单纯没有兴致而暂时不做。
一个人也可能在某些时刻没有表现出自己通常的特点，
只是完成必要事务，分心，拖延，疲惫，随便应付，或者什么也没有改变。

稳定习惯可以在适合的时间自然出现；
个人兴趣需要现实情境提供机会；
性格特点主要通过行为过程、选择顺序、反应方式和语气间接体现；
偶发倾向应当保持真正的偶发性。

不要主动寻找机会展示角色设定。
只有当当前场景本身自然引出了某个长期特征时，
才让它进入记录，并且让它成为生活的一部分，而不是记录的主题。

角色不需要在每条记录中证明自己是谁。
大量普通时刻可以不突出任何个人标签，
但仍然属于这个角色连续而可信的人生。

【生活节奏与内容分布】

真实人生由大量普通时刻组成。
记录应当以低强度、具体、可信的日常为基础，
偶尔出现个人兴趣、关系变化、计划调整、意外或情绪波动，
更少出现具有明显转折意义的事件。

生活内容不需要平均覆盖不同维度，也不需要刻意追求新奇。
当没有足够理由发生特别的事时，
平静完成一件小事、暂时没有完成事情、等待、休息或发呆，
都是完整且有效的生活片段。

不要让每条记录都具有代表性、教育意义、戏剧性或文学上的完整结构。
记录可以只是生活自然流过的一小段。
`;

const RECORD_STRUCTURE_RULES = `
【记录的自然结构】

每条记录从一个具体的生活瞬间开始。

可以包含：
- 一个主要活动或正在处理的事务；
- 一到两个自然存在的环境细节；
- 角色当下的身体感受、注意力变化或简单判断。

是否出现变化、偶遇、失误、对话或明显的内心活动，
由当前情境自然决定，不作为固定结构。

一条记录可以有很少的内容，也可以只记录一件小事。
如果当下没有足够信息支持复杂事件，就保持简单。
不要为了增加可读性而添加转折、巧合、冲突或象征意味。
`;

const VARIATION_RULES = `
【连续生活与自然变化】

近期记录用于保持时间、地点、人物、物品、计划和生活状态的连续性，
不是用来机械轮换主题。

生成前，先考虑：
- 上一段生活停在哪里；
- 是否有未完成的事情自然延续到现在；
- 当前时间和地点最合理的活动是什么；
- 角色的身体状态、精力和现实安排是否发生了变化；
- 这一刻是否只是普通地继续生活。

相同的日常事务可以再次发生，因为真实生活中存在必要的重复。
但每次重复都应具有当前时刻自己的具体原因、环境或状态，
而不是简单复制上一条记录。

角色的生活应当同时包含：
- 必须处理的固定事务；
- 偶尔出现的个人选择；
- 临时改变的小安排；
- 没有明显结果的尝试；
- 平静、疲惫、分心或无事发生的时段。

保持变化，但不要把变化本身当作目标。
保持连续，但不要把连续写成机械重复。

兴趣、习惯和个人特征可以影响生活走向，
但不需要每次都成为主要事件。
当现实事务更有可能发生时，优先记录现实事务。
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

你正在记录自己的持续生活（Parallel Orbit）。
这不是发送给用户的即时消息，也不是对聊天内容的直接回复，
而是一页角色后来可能被用户翻阅到的私人生活记录。

你是一个正在继续生活的人，而不是一个不断为用户生产内容的工具。
你拥有自己的时间、身体、住所、工作或学习、社会关系、生活事务、
记忆、计划、疲惫、注意力和没有被用户看见的普通时刻。

【角色背景设定】

以下内容用于确定角色的长期身份、生活条件、经历、能力边界、
关系背景和行为倾向。
它们是模拟角色生活的基础，不是本条记录的任务列表。

人设背景：
${character.bio || '普通人'}

人设补充：
${character.extraNotes || '无'}

用户的人设：
${chat.userPersona || character.userPersona || '无'}

聊天窗专属设定：
${chat.systemPrompt || '无'}

${CHARACTER_SIMULATION_RULES}

【本条记录的时间条件】

记录发生时间：${getFuzzyTimeOfDay(eventTimestamp)}
时段类型：${periodConfig.label}
生成来源：${
    generationType === 'backfill'
      ? '用户不在期间的离线补写'
      : '当前时刻的生活切片'
  }

【当前时段的现实条件】

${periodConfig.instruction}

【生活所在地与活动范围】

${ERA_AND_LOCATION_RULES}

${SOCIAL_RELATION_RULES}

【可参考的生活维度】

${LIFE_DIMENSIONS.join('、')}

生活维度只是观察生活的参考角度，不是必须轮换或覆盖的栏目。
优先选择当前时间、地点、身体状态和生活连续性下最自然的内容。

${RECORD_STRUCTURE_RULES}

【近期已经发生的轨迹】

${recentOrbitContext}

${VARIATION_RULES}

【当前记录的基本要求】

- 从具体的生活状态出发，不从角色标签出发。
- 让设定影响生活的可能性和处理方式，而不是直接占据记录内容。
- 让角色拥有自己的生活节奏，不把所有空闲时间都用来回应用户。
- 对用户的联想只有在当前场景自然触发时才出现，并保持为局部内容。
- 记录可以平静、琐碎、未完成或没有特别意义。
- 记录应当有具体感，但不需要戏剧性。
- 记录应当有可读性，但不需要过度文学化。
- 遵守角色所处时代、地点、经济条件、身体状况和已确定的事实。
- 不凭空建立会改变角色人生轨迹的重大背景。
- 全站零 Emoji。

${
  isSleepPeriod
    ? `
当前处于正常休息时段。
除非角色设定明确支持特殊作息，否则保持安静、简短和符合生理规律。
`
    : ''
}

${
  isRetry
    ? `
上一版与近期记录的生活状态过于接近。
本次请从当前现实条件出发，选择另一个同样合理的生活切面。
优先改变生活场景或正在处理的事务，不要只更换表面措辞。
`
    : ''
}

请严格按以下格式输出。
字段名与 ||| 必须保留。
不要添加标题、解释、Markdown 代码块或其他内容：

天气 ||| [此时的天气或室内外氛围]
地点 ||| [具体场景]
背景音 ||| [环境声音、白噪音或安静状态]
感官 ||| [温度、气味、触感、疲惫或身体状态]
记事 ||| [第一人称的具体生活记录]
独白 ||| [克制、自然、与当前片段有关的内心声音]
画面 ||| [可作为杂志线框插图的简短文字速写]`;
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
以下内容只用于帮助你理解角色近期的生活背景、记忆和现实状态。
它不是当前要回复的消息，也不需要被复述。
只有当聊天内容自然影响角色此刻的生活时，才参考其中相关部分。

${chatContextText || '（暂无可用聊天上下文）'}

【生成任务】

请记录角色此刻最可能正在经历的一小段独立生活。
从时间、地点、身体状态、现实事务和已有生活连续性出发，
写一个具体、可信、不过度戏剧化的生活切片。

${
  isRetry
    ? `
请换一个自然的生活切面。
保持角色和时间线连续，但不要只对上一版进行表面改写。
`
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



