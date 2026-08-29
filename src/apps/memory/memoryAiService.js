import db from '../../db';

import {
  buildMemorySourceBatch
} from './memorySignals';

import {
  buildTemporalDataFromSource,
  extractTemporalExpression
} from './memoryTemporal';

import {
  MEMORY_CANDIDATE_STATUSES,
  MEMORY_CONFIDENCES,
  MEMORY_EMOTION_SUBJECTS,
  MEMORY_RECALL_POLICIES,
  MEMORY_SCOPES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES,
  MEMORY_STABILITIES,
  MEMORY_SUBJECTS
} from './memoryConstants';

const MAX_SOURCE_MESSAGES = 40;
const MAX_MEMORY_ITEMS = 6;
const MAX_CANDIDATE_ITEMS = 4;

const normalizeText = (value) => (
  String(value || '').trim()
);

const stripJsonFence = (value) => (
  normalizeText(value)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
);

const parseJsonObject = (content) => {
  const cleaned = stripJsonFence(content);

  if (!cleaned) {
    throw new Error('记忆整理服务返回了空内容。');
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error('记忆整理服务没有返回 JSON 对象。');
    }

    return parsed;
  } catch (initialError) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (
      firstBrace < 0 ||
      lastBrace <= firstBrace
    ) {
      throw new Error('记忆整理服务没有返回有效 JSON。');
    }

    try {
      const parsed = JSON.parse(
        cleaned.slice(firstBrace, lastBrace + 1)
      );

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        throw new Error('记忆整理服务没有返回 JSON 对象。');
      }

      return parsed;
    } catch {
      throw new Error('记忆整理服务没有返回有效 JSON。');
    }
  }
};

const normalizeImportance = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 3;
  }

  return Math.max(
    1,
    Math.min(5, Math.round(numberValue))
  );
};

const isAllowedMemoryType = (value) => (
  [
    'fact',
    'preference',
    'episode',
    'relationship',
    'character_thought',
    'emotion',
    'expression_rule',
    'reflection'
  ].includes(value)
);

const normalizeSubject = (value, type) => {
  if (Object.values(MEMORY_SUBJECTS).includes(value)) {
    return value;
  }

  if (type === 'character_thought') {
    return MEMORY_SUBJECTS.CHARACTER;
  }

  if (type === 'relationship') {
    return MEMORY_SUBJECTS.RELATIONSHIP;
  }

  if (type === 'episode') {
    return MEMORY_SUBJECTS.SHARED;
  }

  return MEMORY_SUBJECTS.USER;
};

const normalizeEmotionSubject = (value, subject, type) => {
  if (type !== 'emotion') {
    return null;
  }

  if (Object.values(MEMORY_EMOTION_SUBJECTS).includes(value)) {
    return value;
  }

  if (
    subject === MEMORY_SUBJECTS.CHARACTER ||
    subject === MEMORY_SUBJECTS.RELATIONSHIP ||
    subject === MEMORY_SUBJECTS.SHARED
  ) {
    return subject === MEMORY_SUBJECTS.CHARACTER
      ? MEMORY_EMOTION_SUBJECTS.CHARACTER
      : MEMORY_EMOTION_SUBJECTS.SHARED;
  }

  return MEMORY_EMOTION_SUBJECTS.USER;
};

const normalizeTopicKey = (value) => (
  normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .slice(0, 60)
);

const normalizeTopicKeys = (value, topicKey) => {
  const items = Array.isArray(value)
    ? value
    : [];

  const normalized = [
    ...items,
    topicKey
  ]
    .map((item) => normalizeTopicKey(item))
    .filter(Boolean);

  return [...new Set(normalized)].slice(0, 8);
};

const normalizeStability = (value, type) => {
  if (Object.values(MEMORY_STABILITIES).includes(value)) {
    return value;
  }

  if (
    type === 'preference' ||
    type === 'expression_rule' ||
    type === 'relationship'
  ) {
    return MEMORY_STABILITIES.ONGOING;
  }

  if (type === 'character_thought') {
    return MEMORY_STABILITIES.ONGOING;
  }

  if (type === 'emotion' || type === 'episode') {
    return MEMORY_STABILITIES.TEMPORARY;
  }

  return MEMORY_STABILITIES.ONGOING;
};

const normalizeMemoryScope = (value, subject) => {
  if (Object.values(MEMORY_SCOPES).includes(value)) {
    return value;
  }

  if (subject === MEMORY_SUBJECTS.CHARACTER) {
    return MEMORY_SCOPES.CHARACTER_SETTING;
  }

  if (subject === MEMORY_SUBJECTS.RELATIONSHIP) {
    return MEMORY_SCOPES.RELATIONSHIP_SETTING;
  }

  return MEMORY_SCOPES.CONVERSATION;
};

const normalizeRecallPolicy = (value, memoryScope, type) => {
  if (Object.values(MEMORY_RECALL_POLICIES).includes(value)) {
    return value;
  }

  if (memoryScope === MEMORY_SCOPES.CHARACTER_SETTING) {
    return MEMORY_RECALL_POLICIES.LOW_FREQUENCY;
  }

  if (
    type === 'expression_rule' ||
    type === 'emotion'
  ) {
    return MEMORY_RECALL_POLICIES.WHEN_RELEVANT;
  }

  return MEMORY_RECALL_POLICIES.NORMAL;
};

const getSummaryReference = (summary) => {
  if (Array.isArray(summary)) {
    return summary
      .slice(-3)
      .map((item) => (
        normalizeText(
          item?.content ||
          item?.text ||
          item?.summary ||
          item
        )
      ))
      .filter(Boolean)
      .join('\n')
      .slice(0, 1800);
  }

  return normalizeText(summary).slice(0, 1800);
};

const normalizeMessageIds = (
  ids,
  allowedIds
) => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [
    ...new Set(
      ids
        .map(Number)
        .filter((id) => (
          Number.isFinite(id) &&
          allowedIds.has(id)
        ))
    )
  ];
};

const getSourceMessagesForItem = (
  sourceMessageIds,
  sourceMessages
) => {
  const idSet = new Set(sourceMessageIds);

  return sourceMessages.filter((message) => (
    idSet.has(Number(message.id))
  ));
};

const normalizeTemporal = ({
  item,
  sourceMessageIds,
  sourceMessages
}) => {
  /*
   * AI 只提供 temporalExpression，例如“本周五”。
   * 绝对时间必须由本地代码根据来源消息 timestamp 解析。
   */
  const explicitExpression = normalizeText(
    item?.temporalExpression
  );

  const sourceText = getSourceMessagesForItem(
    sourceMessageIds,
    sourceMessages
  )
    .map((message) => normalizeText(message.content))
    .filter(Boolean)
    .join('\n');

  const temporalExpression = explicitExpression ||
    extractTemporalExpression(sourceText);

  if (!temporalExpression) {
    return null;
  }

  return buildTemporalDataFromSource({
    temporalExpression,
    sourceMessageIds,
    sourceMessages
  });
};

const normalizeMoodDelta = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const allowedKeys = [
    'warmth',
    'calm',
    'joy',
    'concern',
    'longing',
    'hurt',
    'fatigue'
  ];

  const result = {};

  for (const key of allowedKeys) {
    const numberValue = Number(value[key]);

    if (!Number.isFinite(numberValue)) {
      continue;
    }

    /*
     * 单次事件不能让角色发生过大跃迁。
     * 最终状态还会由 memoryCharacterState.js 再次限制。
     */
    result[key] = Math.max(
      -0.35,
      Math.min(0.35, numberValue)
    );
  }

  return Object.keys(result).length > 0
    ? result
    : null;
};


const normalizeMemoryItem = (
  item,
  sourceMessages
) => {
  const validMessageIds = new Set(
    sourceMessages
      .map((message) => Number(message.id))
      .filter(Number.isFinite)
  );

  const sourceMessageIds = normalizeMessageIds(
    item?.sourceMessageIds,
    validMessageIds
  );

  const sourceMessageTimestamps = sourceMessages
    .filter((message) => (
      sourceMessageIds.includes(Number(message.id))
    ))
    .map((message) => message.timestamp)
    .filter(Boolean);

  const type = isAllowedMemoryType(item?.type)
    ? item.type
    : 'fact';

  const subject = normalizeSubject(
    item?.subject,
    type
  );

  const memoryScope = normalizeMemoryScope(
    item?.memoryScope,
    subject
  );

  const topicKey = normalizeTopicKey(
    item?.topicKey
  );

  return {
    title: normalizeText(item?.title).slice(0, 80),
    content: normalizeText(item?.content).slice(0, 500),
    type,
    importance: normalizeImportance(item?.importance),
    confidence: item?.confidence === 'confirmed'
      ? MEMORY_CONFIDENCES.CONFIRMED
      : MEMORY_CONFIDENCES.INFERRED,

    subject,
    emotionSubject: normalizeEmotionSubject(
      item?.emotionSubject,
      subject,
      type
    ),

    topicKey,
    topicKeys: normalizeTopicKeys(
      item?.topicKeys,
      topicKey
    ),

    stability: normalizeStability(
      item?.stability,
      type
    ),

    memoryScope,

    recallPolicy: normalizeRecallPolicy(
      item?.recallPolicy,
      memoryScope,
      type
    ),

       temporal: normalizeTemporal({
      item,
      sourceMessageIds,
      sourceMessages
    }),

    /*
     * 只有角色自身或共同关系情绪允许影响角色当前状态。
     * 用户情绪仅作为用户情绪线索保存，不能被错误转化为角色心情。
     */
    moodDelta: (
      type === 'emotion' &&
      [
        MEMORY_EMOTION_SUBJECTS.CHARACTER,
        MEMORY_EMOTION_SUBJECTS.SHARED
      ].includes(
        normalizeEmotionSubject(
          item?.emotionSubject,
          subject,
          type
        )
      )
    )
      ? normalizeMoodDelta(item?.moodDelta)
      : null,

    sourceMessageIds,

    sourceMessageTimestamps,

    sourceState: sourceMessageIds.length > 0
      ? MEMORY_SOURCE_STATES.AVAILABLE
      : MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,

    sourceKind: MEMORY_SOURCE_KINDS.CONVERSATION
  };
};

const normalizeCandidateItem = (
  item,
  sourceMessages
) => {
  const normalized = normalizeMemoryItem(
    item,
    sourceMessages
  );

  return {
    ...normalized,
    priority: normalizeImportance(
      item?.priority || normalized.importance
    ),
    status: MEMORY_CANDIDATE_STATUSES.PENDING
  };
};

const getApiConfig = async () => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error(
      '尚未配置可用的 API Base URL 或 API Key。'
    );
  }

  return apiConfig;
};

const getErrorDetail = async (response) => {
  let detail = response.statusText || '请求未成功';

  try {
    const errorData = await response.json();

    detail = (
      errorData?.error?.message ||
      errorData?.message ||
      detail
    );
  } catch {
    // 部分 API 返回 HTML 或纯文本错误页，保留状态文本。
  }

  return detail;
};

const isResponseFormatUnsupported = ({
  status,
  detail
}) => {
  const normalizedDetail = normalizeText(detail).toLowerCase();

  if (!normalizedDetail) {
    return false;
  }

  return (
    normalizedDetail.includes('response_format') ||
    normalizedDetail.includes('json_object') ||
    (
      status === 400 &&
      (
        normalizedDetail.includes('json mode') ||
        normalizedDetail.includes('unsupported parameter')
      )
    )
  );
};

const requestCompletion = async ({
  apiConfig,
  systemPrompt,
  userPrompt,
  useJsonResponseFormat = true
}) => {
  const baseUrl = String(apiConfig.baseUrl)
    .replace(/\/$/, '');

  const requestBody = {
    model: apiConfig.model || 'gpt-3.5-turbo',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };

  if (useJsonResponseFormat) {
    requestBody.response_format = {
      type: 'json_object'
    };
  }

  const response = await fetch(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const detail = await getErrorDetail(response);

    const error = new Error(
      `[API Error ${response.status}] ${detail}`
    );

    error.status = response.status;
    error.detail = detail;
    error.responseFormatUnsupported = isResponseFormatUnsupported({
      status: response.status,
      detail
    });

    throw error;
  }

  const payload = await response.json();

  const content = normalizeText(
    payload?.choices?.[0]?.message?.content
  );

  if (!content) {
    throw new Error('记忆整理服务返回了空内容。');
  }

  return content;
};

const requestMemoryCompletion = async ({
  systemPrompt,
  userPrompt
}) => {
  const apiConfig = await getApiConfig();

  try {
    const content = await requestCompletion({
      apiConfig,
      systemPrompt,
      userPrompt,
      useJsonResponseFormat: true
    });

    return parseJsonObject(content);
  } catch (error) {
    if (!error?.responseFormatUnsupported) {
      throw error;
    }

    console.warn(
      '[Memory] API does not support response_format; retrying without it.'
    );

    const content = await requestCompletion({
      apiConfig,
      systemPrompt,
      userPrompt,
      useJsonResponseFormat: false
    });

    return parseJsonObject(content);
  }
};

const buildSystemPrompt = () => `
你负责整理私人数字陪伴空间中的长期共同记忆。

你的职责不是写聊天回复。不要使用角色口吻，不要安慰用户，不要添加抒情语言。
只根据提供的对话片段提取适合长期保留、且可能在未来自然改善聊天回应的内容。

规则：
1. 所有记录只属于一个消息框，不能推断到同一角色的其他消息框。
2. 用户当前明确表达的事实、偏好、边界、纠正和约定优先。
3. 不要把一次性寒暄、普通问题、无依据的猜测或角色编造内容写成长期事实。
4. 不要把角色自己的台词或想象内容改写为“用户事实”。
5. 角色的稳定设定、名称、称呼、角色自身背景可以记录，但 subject 必须为 character，memoryScope 必须为 character_setting，recallPolicy 必须为 low_frequency。
6. 阶段性摘要只用于理解语境，不是可独立引用的证据；每一条输出都必须引用本次对话片段中的 sourceMessageIds。
7. 明确、稳定且有充分对话依据的内容放入 memories。
8. 可能变化、含义不完整、存在冲突、计划尚未确认完成或需要用户确认的内容放入 candidates。
9. 当用户明确表示“不是 X，是 Y”“我之前说错了”“更正一下”或要求以新说法为准时，优先将新说法保留为可用于更正旧理解的候选；不要把旧说法与新说法同时写成两个同等确定的长期事实。
10. 每项必须引用至少一个 sourceMessageIds；不能引用的内容不要输出。
11. sourceMessageIds 只能使用本次对话片段中实际提供的数字 ID，不能编造。
12. 若原话存在“今天、明天、本周五、下周五、下午三点”等时间表达，只输出用户原始 temporalExpression，不得自行换算或编造绝对日期。绝对日期由本地程序根据消息 timestamp 计算。
13. “周五”“月底”“过几天”等无法明确对应绝对日期的表达，保留原始 temporalExpression，不要猜测具体日期。
14. 情绪必须区分归属：
    - 用户情绪：subject 和 emotionSubject 都是 user；
    - 角色自身情绪：subject 和 emotionSubject 都是 character；
    - 共同关系中的情绪：subject 为 relationship 或 shared，emotionSubject 为 shared。
15. 用户短暂情绪通常应为 temporary；角色当前感受可以保留线索，但不得写成永久不变的人格事实。
16. 当且仅当 type 为 emotion 且 emotionSubject 为 character 或 shared 时，可以输出 moodDelta，用于轻微调整角色当前情绪状态。
17. moodDelta 只能使用 warmth、calm、joy、concern、longing、hurt、fatigue 这些字段；数值范围必须在 -0.35 到 0.35 之间。
18. 用户情绪的 emotionSubject 为 user，moodDelta 必须为 null；不要把用户难过、疲惫或开心直接等同于角色的失落、疲惫或开心。
19. 角色的情绪变化必须克制：例如用户分享好消息可以提高 joy 或 warmth；用户需要空间时可轻微提高 concern，但不要借此制造角色受伤、委屈或被忽视的叙事。
20. topicKey 使用简短稳定的主题键，例如 coffee、dating、work_stress、character_name；topicKeys 为相关主题键列表，最多 8 项。
21.不要因为角色默认设定已经出现过，就反复输出相同设定。
22. 最多输出 ${MAX_MEMORY_ITEMS} 条 memories 和 ${MAX_CANDIDATE_ITEMS} 条 candidates。
23. 不得使用 Emoji。
24. 只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "memories": [
    {
      "title": "不超过 50 字",
      "content": "客观、克制、可长期使用的一句话或两句话",
      "type": "fact | preference | episode | relationship | character_thought | emotion | expression_rule | reflection",
      "importance": 1,
      "confidence": "confirmed | inferred",
      "subject": "user | character | relationship | shared",
      "emotionSubject": "user | character | shared | null",
      "topicKey": "简短稳定主题键",
      "topicKeys": ["主题键"],
      "stability": "momentary | temporary | ongoing | stable",
      "memoryScope": "conversation | character_setting | relationship_setting",
      "recallPolicy": "normal | low_frequency | when_relevant",
      "temporalExpression": "仅原始时间表达；没有则为空字符串",
"moodDelta": {
  "warmth": 0.1,
  "joy": 0.08
},
"sourceMessageIds": [1, 2]

    }
  ],
  "candidates": [
    {
      "title": "不超过 50 字",
      "content": "需要确认或暂存的理解",
      "type": "fact | preference | episode | relationship | character_thought | emotion | expression_rule | reflection",
      "priority": 1,
      "subject": "user | character | relationship | shared",
      "emotionSubject": "user | character | shared | null",
      "topicKey": "简短稳定主题键",
      "topicKeys": ["主题键"],
      "stability": "momentary | temporary | ongoing | stable",
      "memoryScope": "conversation | character_setting | relationship_setting",
      "recallPolicy": "normal | low_frequency | when_relevant",
     "temporalExpression": "仅原始时间表达；没有则为空字符串",
"moodDelta": {
  "warmth": 0.1
},
"sourceMessageIds": [1]

    }
  ]
}
`;

export const extractMemoryFromConversation = async ({
  chatId,
  messages = []
}) => {
  if (
    chatId === undefined ||
    chatId === null ||
    chatId === ''
  ) {
    throw new Error('缺少消息框标识。');
  }

  const chat = await db.chats.get(chatId);

  if (!chat) {
    throw new Error('目标消息框不存在。');
  }

  const sourceMessages = buildMemorySourceBatch(
    messages,
    MAX_SOURCE_MESSAGES
  );

  if (sourceMessages.length === 0) {
    return {
      memories: [],
      candidates: [],
      sourceMessageIds: []
    };
  }

  const summaryReference = getSummaryReference(chat.summary);

  const systemPrompt = buildSystemPrompt();

  const userPrompt = `
阶段性摘要仅用于理解上下文，不能作为单独证据：
${summaryReference || '无'}

本次需要整理的对话片段：
${JSON.stringify(sourceMessages)}
`;

  const result = await requestMemoryCompletion({
    systemPrompt,
    userPrompt
  });

  const memories = Array.isArray(result?.memories)
    ? result.memories
      .map((item) => normalizeMemoryItem(
        item,
        sourceMessages
      ))
      .filter((item) => (
        item.content &&
        item.sourceMessageIds.length > 0
      ))
      .slice(0, MAX_MEMORY_ITEMS)
    : [];

  const candidates = Array.isArray(result?.candidates)
    ? result.candidates
      .map((item) => normalizeCandidateItem(
        item,
        sourceMessages
      ))
      .filter((item) => (
        item.content &&
        item.sourceMessageIds.length > 0
      ))
      .slice(0, MAX_CANDIDATE_ITEMS)
    : [];

  return {
    memories,
    candidates,

    /*
     * scheduler 仅用于判断明确更正语义；
     * 此字段不会直接写入正式记忆。
     */
    sourceMessages,

    sourceMessageIds: sourceMessages
      .map((message) => Number(message.id))
      .filter(Number.isFinite)
  };
};
