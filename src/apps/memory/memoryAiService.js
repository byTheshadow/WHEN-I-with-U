import db from '../../db';
import { buildMemorySourceBatch } from './memorySignals';
import {
  MEMORY_CANDIDATE_STATUSES,
  MEMORY_CONFIDENCES,
  MEMORY_SOURCE_KINDS,
  MEMORY_SOURCE_STATES
} from './memoryConstants';

const MAX_SOURCE_MESSAGES = 40;
const MAX_MEMORY_ITEMS = 6;
const MAX_CANDIDATE_ITEMS = 4;

const normalizeText = (value) => String(value || '').trim();

const stripJsonFence = (value) => (
  normalizeText(value)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
);

const parseJsonObject = (content) => {
  const cleaned = stripJsonFence(content);

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('记忆整理服务没有返回有效 JSON。');
    }

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  }
};

const normalizeImportance = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return 3;

  return Math.max(1, Math.min(5, Math.round(numberValue)));
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

const getSummaryReference = (summary) => {
  if (Array.isArray(summary)) {
    return summary
      .slice(-3)
      .map((item) => (
        normalizeText(item?.content || item?.text || item?.summary || item)
      ))
      .filter(Boolean)
      .join('\n')
      .slice(0, 1800);
  }

  return normalizeText(summary).slice(0, 1800);
};

const normalizeMessageIds = (ids, allowedIds) => {
  if (!Array.isArray(ids)) return [];

  return ids
    .map(Number)
    .filter((id) => Number.isFinite(id) && allowedIds.has(id));
};

const normalizeMemoryItem = (item, sourceMessages) => {
  const validMessageIds = new Set(
    sourceMessages.map((message) => message.id)
  );

  const sourceMessageIds = normalizeMessageIds(
    item?.sourceMessageIds,
    validMessageIds
  );

  const sourceMessageTimestamps = sourceMessages
    .filter((message) => sourceMessageIds.includes(message.id))
    .map((message) => message.timestamp)
    .filter(Boolean);

  return {
    title: normalizeText(item?.title).slice(0, 80),
    content: normalizeText(item?.content).slice(0, 500),
    type: isAllowedMemoryType(item?.type) ? item.type : 'fact',
    importance: normalizeImportance(item?.importance),
    confidence: item?.confidence === 'confirmed'
      ? MEMORY_CONFIDENCES.CONFIRMED
      : MEMORY_CONFIDENCES.INFERRED,
    sourceMessageIds,
    sourceMessageTimestamps,
    sourceState: sourceMessageIds.length > 0
      ? MEMORY_SOURCE_STATES.AVAILABLE
      : MEMORY_SOURCE_STATES.IMPORTED_WITHOUT_SOURCE,
    sourceKind: MEMORY_SOURCE_KINDS.CONVERSATION
  };
};

const normalizeCandidateItem = (item, sourceMessages) => {
  const normalized = normalizeMemoryItem(item, sourceMessages);

  return {
    ...normalized,
    priority: normalizeImportance(item?.priority || normalized.importance),
    status: MEMORY_CANDIDATE_STATUSES.PENDING
  };
};

const getApiConfig = async () => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error('尚未配置可用的 API Base URL 或 API Key。');
  }

  return apiConfig;
};

const requestMemoryCompletion = async ({
  systemPrompt,
  userPrompt
}) => {
  const apiConfig = await getApiConfig();
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      temperature: 0.2,
      response_format: {
        type: 'json_object'
      },
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
    })
  });

  if (!response.ok) {
    let detail = response.statusText || '请求未成功';

    try {
      const errorData = await response.json();
      detail = errorData?.error?.message || errorData?.message || detail;
    } catch {
      // 保留 HTTP 状态文本。
    }

    throw new Error(`[API Error ${response.status}] ${detail}`);
  }

  const payload = await response.json();
  const content = normalizeText(
    payload?.choices?.[0]?.message?.content
  );

  if (!content) {
    throw new Error('记忆整理服务返回了空内容。');
  }

  return parseJsonObject(content);
};

export const extractMemoryFromConversation = async ({
  chatId,
  messages = []
}) => {
  if (chatId === undefined || chatId === null) {
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

  const systemPrompt = `
你负责整理私人数字陪伴空间中的长期共同记忆。

你的职责不是写聊天回复。不要使用角色口吻，不要安慰用户，不要添加抒情语言。
只根据提供的对话片段提取适合长期保留、且可能在未来自然改善聊天回应的内容。

规则：
1. 所有记录只属于一个消息框，不能推断到同一角色的其他消息框。
2. 用户当前明确表达的事实、偏好、边界、纠正和约定优先。
3. 不要把一次性寒暄、普通问题、无依据的猜测或角色编造内容写成长期事实。
4. 不要记录敏感隐私细节，除非用户明确要求记住，且内容对持续陪伴确实必要。
5. 明确、稳定且有充分对话依据的内容放入 memories。
6. 可能变化、含义不完整、存在冲突或需要用户确认的内容放入 candidates。
7. 每项必须引用 sourceMessageIds；不能引用的内容不要输出。
8. 最多输出 ${MAX_MEMORY_ITEMS} 条 memories 和 ${MAX_CANDIDATE_ITEMS} 条 candidates。
9. 不得使用 Emoji。
10. 只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "memories": [
    {
      "title": "不超过 20 字",
      "content": "客观、克制、可长期使用的一句话或两句话",
      "type": "fact | preference | episode | relationship | character_thought | emotion | expression_rule | reflection",
      "importance": 1,
      "confidence": "confirmed | inferred",
      "sourceMessageIds": [1, 2]
    }
  ],
  "candidates": [
    {
      "title": "不超过 20 字",
      "content": "需要确认或暂存的理解",
      "type": "fact | preference | episode | relationship | character_thought | emotion | expression_rule | reflection",
      "priority": 1,
      "sourceMessageIds": [1]
    }
  ]
}
`;

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

  return {
    memories: Array.isArray(result?.memories)
      ? result.memories
        .map((item) => normalizeMemoryItem(item, sourceMessages))
        .filter((item) => (
          item.content &&
          item.sourceMessageIds.length > 0
        ))
        .slice(0, MAX_MEMORY_ITEMS)
      : [],

    candidates: Array.isArray(result?.candidates)
      ? result.candidates
        .map((item) => normalizeCandidateItem(item, sourceMessages))
        .filter((item) => (
          item.content &&
          item.sourceMessageIds.length > 0
        ))
        .slice(0, MAX_CANDIDATE_ITEMS)
      : [],

    sourceMessageIds: sourceMessages.map((message) => message.id)
  };
};
