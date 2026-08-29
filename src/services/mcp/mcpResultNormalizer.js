const MAX_TEXT_LENGTH = 20_000;
const MAX_JSON_LENGTH = 20_000;
const MAX_URI_LENGTH = 2_000;

const truncateText = (value, maxLength = MAX_TEXT_LENGTH) => {
  const text = String(value ?? '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}…`;
};

const isPlainObject = (value) => {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
};

const safeJsonStringify = (value, maxLength = MAX_JSON_LENGTH) => {
  try {
    return truncateText(
      JSON.stringify(value, null, 2),
      maxLength,
    );
  } catch {
    return '';
  }
};

const normalizeTextItem = (item) => {
  const text = truncateText(item?.text || '');

  return {
    type: 'text',
    text,
    displayText: text,
  };
};

const normalizeImageItem = (item) => {
  const data = typeof item?.data === 'string'
    ? item.data
    : '';

  const mimeType = typeof item?.mimeType === 'string'
    ? item.mimeType
    : '';

  return {
    type: 'image',
    mimeType,
    hasData: Boolean(data),
    displayText: '[工具返回了一张图片。]',
  };
};

const normalizeAudioItem = (item) => {
  const data = typeof item?.data === 'string'
    ? item.data
    : '';

  const mimeType = typeof item?.mimeType === 'string'
    ? item.mimeType
    : '';

  return {
    type: 'audio',
    mimeType,
    hasData: Boolean(data),
    displayText: '[工具返回了一段音频。]',
  };
};

const normalizeResourceItem = (item) => {
  const resource = isPlainObject(item?.resource)
    ? item.resource
    : {};

  const uri = typeof resource.uri === 'string'
    ? resource.uri.slice(0, MAX_URI_LENGTH)
    : '';

  const mimeType = typeof resource.mimeType === 'string'
    ? resource.mimeType
    : '';

  const text = typeof resource.text === 'string'
    ? truncateText(resource.text)
    : '';

  return {
    type: 'resource',
    uri,
    mimeType,
    hasText: Boolean(text),
    displayText: text
      ? `[工具返回了一项资源]\n${text}`
      : '[工具返回了一项资源。]',
  };
};

const normalizeUnknownItem = (item) => {
  const serialized = safeJsonStringify(item);

  return {
    type: 'unknown',
    displayText: serialized
      ? `[工具返回了未识别内容]\n${serialized}`
      : '[工具返回了未识别内容。]',
  };
};

const normalizeContentItem = (item) => {
  if (typeof item === 'string') {
    const text = truncateText(item);

    return {
      type: 'text',
      text,
      displayText: text,
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
    return truncateText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object') {
    return safeJsonStringify(value);
  }

  return null;
};

export const normalizeMcpToolResult = (toolResult = {}) => {
  const content = Array.isArray(toolResult.content)
    ? toolResult.content
    : [];

  const items = content.map(normalizeContentItem);

  const text = items
    .map((item) => item.displayText)
    .filter(Boolean)
    .join('\n')
    .trim();

  const structuredContent = normalizeStructuredContent(
    toolResult.structuredContent,
  );

  return {
    ok: toolResult.isError !== true,
    isError: toolResult.isError === true,

    items,

    text: truncateText(
      text || (
        structuredContent
          ? String(structuredContent)
          : '[工具没有返回可显示的内容。]'
      ),
    ),

    structuredContent,

    hasText: items.some((item) => item.type === 'text'),
    hasImage: items.some((item) => item.type === 'image'),
    hasAudio: items.some((item) => item.type === 'audio'),
    hasResource: items.some((item) => item.type === 'resource'),
    hasUnknown: items.some((item) => item.type === 'unknown'),
  };
};

export const makeMcpAiToolResult = (toolResult = {}) => {
  const normalized = normalizeMcpToolResult(toolResult);

  return JSON.stringify({
    isError: normalized.isError,
    content: normalized.text,
    structuredContent: normalized.structuredContent,
  });
};

export const getMcpResultPreview = (toolResult = {}) => {
  const normalized = normalizeMcpToolResult(toolResult);

  return {
    text: normalized.text.slice(0, 500),
    itemTypes: normalized.items.map((item) => item.type),
    isError: normalized.isError,
  };
};
