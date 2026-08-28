const normalizeText = (value) => (
  String(value || '').trim()
);

const getCurrentMessageContent = (message) => {
  if (!message) {
    return '';
  }

  const versions = Array.isArray(message.versions)
    ? message.versions
    : [];

  const currentVersionIndex = Number(
    message.currentVersionIndex
  );

  if (
    versions.length > 0 &&
    Number.isInteger(currentVersionIndex) &&
    versions[currentVersionIndex]
  ) {
    const currentVersion = versions[currentVersionIndex];

    if (typeof currentVersion === 'string') {
      return normalizeText(currentVersion);
    }

    return normalizeText(
      currentVersion.content ||
      currentVersion.text ||
      currentVersion.message
    );
  }

  return normalizeText(message.content);
};

const isSupportedSender = (sender) => (
  [
    'user',
    'character',
    'ai',
    'assistant'
  ].includes(sender)
);

const isUsableMessage = (message) => {
  const content = getCurrentMessageContent(message);

  return Boolean(
    message &&
    message.type !== 'error' &&
    content &&
    isSupportedSender(message.sender)
  );
};

const HIGH_PRIORITY_PATTERNS = [
  {
    type: 'expression_rule',
    priority: 5,
    pattern: /(记住|请记得|别忘了|不要忘记).{0,80}/i
  },
  {
    type: 'expression_rule',
    priority: 5,
    pattern: /(不要再|别再|不要这样|别这样|不喜欢你).{0,80}/i
  },
  {
    type: 'preference',
    priority: 4,
    pattern: /(我喜欢|我不喜欢|我讨厌|我更希望|我习惯).{0,100}/i
  },
  {
    type: 'relationship',
    priority: 4,
    pattern: /(我们的关系|我们现在是|从今天起|以后我们|叫我).{0,100}/i
  },
  {
    type: 'fact',
    priority: 4,
    pattern: /(我已经|我决定|我辞职|我搬家|我毕业|我生病|我确诊|我失业).{0,100}/i
  },
  {
    type: 'episode',
    priority: 4,
    pattern: /(约好了|答应你|说定了|下次我们|我们约定).{0,100}/i
  },
  {
    type: 'emotion',
    priority: 4,
    pattern: /(我很难过|我很害怕|我很崩溃|我撑不住了|我好累|我很开心).{0,100}/i
  }
];

export const getUsableMessages = (messages = []) => (
  (Array.isArray(messages) ? messages : [])
    .filter(isUsableMessage)
);

export const inspectMemorySignals = (messages = []) => {
  const usableMessages = getUsableMessages(messages);
  const signals = [];
  const signalKeys = new Set();

  for (const message of usableMessages) {
    const content = getCurrentMessageContent(message);

    for (const rule of HIGH_PRIORITY_PATTERNS) {
      const matched = content.match(rule.pattern);

      if (!matched) {
        continue;
      }

      const excerpt = normalizeText(
        matched[0] || content.slice(0, 180)
      ).slice(0, 180);

      const signalKey = [
        message.id,
        rule.type,
        excerpt
      ].join('|');

      if (signalKeys.has(signalKey)) {
        continue;
      }

      signalKeys.add(signalKey);

      signals.push({
        messageId: message.id,
        sender: message.sender,
        type: rule.type,
        priority: rule.priority,
        excerpt
      });
    }
  }

  const highestPriority = signals.reduce(
    (highest, signal) => Math.max(
      highest,
      Number(signal.priority) || 0
    ),
    0
  );

  return {
    usableMessages,
    signals,
    highestPriority,
    hasHighPrioritySignal: highestPriority >= 4
  };
};

const getMessageOrder = (message, fallbackIndex) => {
  const numericId = Number(message?.id);

  if (Number.isFinite(numericId)) {
    return numericId;
  }

  return fallbackIndex;
};

export const buildMemorySourceBatch = (
  messages = [],
  maxMessages = 40
) => {
  const safeMaxMessages = Math.max(
    1,
    Math.floor(Number(maxMessages) || 40)
  );

  const usableMessages = getUsableMessages(messages)
    .map((message, index) => ({
      message,
      index,
      order: getMessageOrder(message, index)
    }))
    .sort((a, b) => a.order - b.order)
    // 关键：cursor 模式下必须从最早的未处理消息开始。
    // 不能使用 slice(-safeMaxMessages)，否则会跳过较早消息。
    .slice(0, safeMaxMessages)
    .map(({ message }) => message);

  return usableMessages
    .map((message) => ({
      id: message.id,
      sender: message.sender,
      type: message.type || 'text',
      timestamp: message.timestamp || '',
      content: getCurrentMessageContent(message)
        .slice(0, 1200)
    }))
    .filter((message) => (
      message.id !== undefined &&
      message.id !== null &&
      message.content
    ));
};
