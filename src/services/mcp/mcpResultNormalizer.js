const MAX_ITEM_TEXT_LENGTH = 6_000;
const MAX_RESULT_TEXT_LENGTH = 12_000;
const MAX_STRUCTURED_CONTENT_LENGTH = 12_000;
const MAX_ACTIVITY_PREVIEW_LENGTH = 240;

/*
 * AI 上下文与手动查看的安全保留内容分别限制。
 * 工具的完整安全结果最多保留 12,000 字符，但传给 AI 的
 * 上下文应更短，避免单次工具输出挤占角色回复的上下文。
 */
const MAX_AI_RESULT_LENGTH = 4_000;

const MAX_URI_PATH_LENGTH = 1_000;

const truncateText = (value, maxLength) => {
  const text = String(value ?? '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}…`;
};

const isTextTruncated = (value, maxLength) => {
  return String(value ?? '').length > maxLength;
};

const getStructuredContentText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  return '';
};

const isPlainObject = (value) => {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
};

const safeJsonStringify = (value, maxLength) => {
  try {
    return truncateText(
      JSON.stringify(value, null, 2),
      maxLength,
    );
  } catch {
    return '';
  }
};

/*
 * MCP resource URI 可能含有：
 * - https://user:password@example.com/...
 * - ?access_token=...
 * - #private-data
 *
 * 此处仅保留协议、主机、端口和路径，绝不在界面、
 * 活动摘要或未来业务上下文中显示认证信息、query、hash。
 */
const sanitizeResourceUri = (value) => {
  const rawUri = String(value || '').trim();

  if (!rawUri) {
    return '';
  }

  try {
    const url = new URL(rawUri);

    const safePathname = truncateText(
      url.pathname || '/',
      MAX_URI_PATH_LENGTH,
    );

    return `${url.protocol}//${url.host}${safePathname}`;
  } catch {
    /*
     * 有些 MCP Resource URI 可能是非 HTTP URI，例如：
     * file://、urn:、custom-scheme。
     *
     * 对无法安全解析的 URI 不回显原文，避免意外暴露参数。
     */
    const schemeMatch = rawUri.match(/^([a-z][a-z\d+.-]*):/i);

    return schemeMatch
      ? `${schemeMatch[1].toLowerCase()}:…`
      : '[资源地址未公开]';
  }
};

const normalizeMimeType = (value) => {
  const mimeType = String(value || '')
    .trim()
    .toLowerCase();

  /*
   * MIME 仅作为界面摘要，不需要保留异常长或异常格式内容。
   */
  if (!mimeType || mimeType.length > 160) {
    return '';
  }

  return mimeType;
};

const normalizeTextItem = (item) => {
  const sourceText = item?.text || '';
  const text = truncateText(
    sourceText,
    MAX_ITEM_TEXT_LENGTH,
  );

  return {
    type: 'text',
    text,
    displayText: text,
    isTruncated: isTextTruncated(
      sourceText,
      MAX_ITEM_TEXT_LENGTH,
    ),
  };
};

const normalizeImageItem = (item) => {
  const hasData = typeof item?.data === 'string' && item.data.length > 0;
  const mimeType = normalizeMimeType(item?.mimeType);

  /*
   * 不保留 data，避免 Base64 图像长期进入 React state、
   * 日志、活动记录或未来的 AI 上下文。
   */
  return {
    type: 'image',
    mimeType,
    hasData,
    displayText: mimeType
      ? `[工具返回了一张图片（${mimeType}）。]`
      : '[工具返回了一张图片。]',
  };
};

const normalizeAudioItem = (item) => {
  const hasData = typeof item?.data === 'string' && item.data.length > 0;
  const mimeType = normalizeMimeType(item?.mimeType);

  /*
   * 不保留 data，不创建 Blob URL，也不自动播放远程或 Base64 音频。
   */
  return {
    type: 'audio',
    mimeType,
    hasData,
    displayText: mimeType
      ? `[工具返回了一段音频（${mimeType}）。]`
      : '[工具返回了一段音频。]',
  };
};

const normalizeResourceItem = (item) => {
  const resource = isPlainObject(item?.resource)
    ? item.resource
    : {};

  const uri = sanitizeResourceUri(resource.uri);
  const mimeType = normalizeMimeType(resource.mimeType);
  const sourceText = typeof resource.text === 'string'
    ? resource.text
    : '';

  /*
   * resource.text 是 MCP 的文本内容；可以作为纯文本摘要显示，
   * 但不会被当作 HTML 或可执行内容处理。
   */
  const text = truncateText(
    sourceText,
    MAX_ITEM_TEXT_LENGTH,
  );

  const resourceSummary = [
    '[工具返回了一项资源。]',
    uri ? `地址：${uri}` : '',
    mimeType ? `类型：${mimeType}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    type: 'resource',
    uri,
    mimeType,
    hasText: Boolean(text),
    isTruncated: isTextTruncated(
      sourceText,
      MAX_ITEM_TEXT_LENGTH,
    ),
    displayText: text
      ? `${resourceSummary}\n\n${text}`
      : resourceSummary,
  };
};

const getUnknownItemSummary = (item) => {
  if (!isPlainObject(item)) {
    return '[工具返回了未识别内容。]';
  }

  const type = typeof item.type === 'string'
    ? truncateText(item.type, 80)
    : '';

  /*
   * 未识别 block 不序列化原对象：
   * 实现扩展字段可能包含 token、二进制数据、私密 URI 或大段内容。
   * 仅显示 type 与顶层字段名，以保留可诊断性。
   */
  const keys = Object.keys(item)
    .filter((key) => key !== 'data' && key !== 'text')
    .slice(0, 12);

  const parts = ['[工具返回了未识别内容。]'];

  if (type) {
    parts.push(`类型：${type}`);
  }

  if (keys.length > 0) {
    parts.push(`字段：${keys.join('、')}`);
  }

  return parts.join('\n');
};

const normalizeUnknownItem = (item) => {
  return {
    type: 'unknown',
    displayText: getUnknownItemSummary(item),
  };
};

const normalizeContentItem = (item) => {
  if (typeof item === 'string') {
    const text = truncateText(
      item,
      MAX_ITEM_TEXT_LENGTH,
    );

    return {
      type: 'text',
      text,
      displayText: text,
      isTruncated: isTextTruncated(
        item,
        MAX_ITEM_TEXT_LENGTH,
      ),
    };
  }

  if (!item || typeof item !== 'object') {
    return normalizeUnknownItem(item);
  }

  switch (item.type) {
    case 'text':
      return normalizeTextItem(item);

    case 'image':
      return normalizeImageItem(item);

    case 'audio':
      return normalizeAudioItem(item);

    case 'resource':
      return normalizeResourceItem(item);

    default:
      return normalizeUnknownItem(item);
  }
};

const normalizeStructuredContent = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return truncateText(
      value,
      MAX_STRUCTURED_CONTENT_LENGTH,
    );
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    const serialized = safeJsonStringify(
      value,
      MAX_STRUCTURED_CONTENT_LENGTH,
    );

    return serialized || '[结构化结果无法安全格式化显示。]';
  }

  return '[结构化结果无法安全格式化显示。]';
};

const getDisplayText = (items, structuredContent) => {
  const itemText = items
    .map((item) => item.displayText)
    .filter(Boolean)
    .join('\n\n')
    .trim();

  const text = itemText || structuredContent ||
    '[工具没有返回可显示的内容。]';

  return truncateText(text, MAX_RESULT_TEXT_LENGTH);
};

export const normalizeMcpToolResult = (toolResult = {}) => {
  const content = Array.isArray(toolResult.content)
    ? toolResult.content
    : [];

  const items = content.map(normalizeContentItem);

  const structuredContent = normalizeStructuredContent(
    toolResult.structuredContent,
  );

  const structuredSourceText = getStructuredContentText(
    toolResult.structuredContent,
  );

  const itemDisplayText = items
    .map((item) => item.displayText)
    .filter(Boolean)
    .join('\n\n')
    .trim();

  const displaySourceText = itemDisplayText
    || structuredContent
    || '[工具没有返回可显示的内容。]';

  const isTruncated = (
    items.some((item) => item.isTruncated === true)
    || isTextTruncated(
      structuredSourceText,
      MAX_STRUCTURED_CONTENT_LENGTH,
    )
    || isTextTruncated(
      displaySourceText,
      MAX_RESULT_TEXT_LENGTH,
    )
  );

  return {
    ok: toolResult.isError !== true,
    isError: toolResult.isError === true,

    /*
     * 此标记表示：界面中保留的是经过安全上限截断的结果，
     * 并不代表工具调用失败。
     */
    isTruncated,

    /*
     * items 内不含 image/audio 原始 data；
     * resource URI 已移除 query、hash、用户名和密码。
     */
    items,

    text: getDisplayText(items, structuredContent),

    /*
     * 始终是安全格式化的字符串或 null，
     * 不将 MCP 原始对象引用交给渲染层。
     */
    structuredContent,

    hasText: items.some((item) => item.type === 'text'),
    hasImage: items.some((item) => item.type === 'image'),
    hasAudio: items.some((item) => item.type === 'audio'),
    hasResource: items.some((item) => item.type === 'resource'),
    hasUnknown: items.some((item) => item.type === 'unknown'),
  };
};

/*
 * 供未来角色编排或 AI 适配层使用。
 *
 * 该函数输出的是已脱敏、截断后的 JSON 字符串，
 * 不是服务端的原始 MCP 返回结果。
 */
export const makeMcpAiToolResult = (toolResult = {}) => {
  const normalized = normalizeMcpToolResult(toolResult);

  return truncateText(
    JSON.stringify({
      isError: normalized.isError,
      content: normalized.text,
      structuredContent: normalized.structuredContent,
      itemTypes: normalized.items.map((item) => item.type),
    }),
    MAX_AI_RESULT_LENGTH,
  );
};

export const getMcpResultPreview = (toolResult = {}) => {
  const normalized = normalizeMcpToolResult(toolResult);

  return {
    text: normalized.text.slice(0, 500),
    itemTypes: normalized.items.map((item) => item.type),
    isError: normalized.isError,
  };
};

/*
 * 活动记录只应使用此摘要，不应写入完整参数、原始结果、
 * 图片 / 音频 Base64 或 resource 的原始 URI。
 */
export const makeMcpActivitySummary = (toolResult = {}) => {
  const normalized = normalizeMcpToolResult(toolResult);

  return {
    ok: normalized.ok,
    isError: normalized.isError,
    itemTypes: normalized.items.map((item) => item.type),
    textPreview: normalized.text.slice(
      0,
      MAX_ACTIVITY_PREVIEW_LENGTH,
    ),
    hasText: normalized.hasText,
    hasImage: normalized.hasImage,
    hasAudio: normalized.hasAudio,
    hasResource: normalized.hasResource,
    hasUnknown: normalized.hasUnknown,
  };
};

