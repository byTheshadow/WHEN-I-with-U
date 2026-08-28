const normalizeText = (value) => String(value || '').trim();

const getCurrentMessageContent = (message) => {
  if (!message) return '';

  const versions = Array.isArray(message.versions)
    ? message.versions
    : [];

  const currentVersionIndex = Number(message.currentVersionIndex);

  if (
    Number.isInteger(currentVersionIndex) &&
    versions[currentVersionIndex] &&
    typeof versions[currentVersionIndex].content === 'string'
  ) {
    return normalizeText(versions[currentVersionIndex].content);
  }

  return normalizeText(message.content);
};

const isUsableMessage = (message) => {
  const content = getCurrentMessageContent(message);

  return Boolean(
    message &&
    message.type !== 'error' &&
    content &&
    ['user', 'character'].includes(message.sender)
  );
};

const HIGH_PRIORITY_PATTERNS = [
  {
    type: 'expression_rule',
    priority: 5,
    pattern: /(记住|请记得|别忘了|不要忘记).{0,60}/i
  },
  {
    type: 'expression_rule',
    priority: 5,
    pattern: /(不要再|别再|不要这样|别这样|不喜欢你).{0,60}/i
  },
  {
    type: 'preference',
    priority: 4,
    pattern: /(我喜欢|我不喜欢|我讨厌|我更希望|我习惯).{0,80}/i
  },
  {
    type: 'relationship',
    priority: 4,
    pattern: /(我们现在是|我们的关系|从今天起|以后我们).{0,80}/i
  },
  {
    type: 'fact',
    priority: 4,
    pattern: /(我已经|我决定|我辞职|我搬家|我毕业|我生病|我确诊|我失业).{0,80}/i
  },
  {
    type: 'episode',
    priority: 4,
    pattern: /(约好了|答应你|说定了|下次我们|我们约定).{0,80}/i
  },
  {
    type: 'emotion',
    priority: 4,
    pattern: /(我很难过|我很害怕|我很崩溃|我撑不住了|我好累|我很开心).{0,80}/i
  }
];

export const getUsableMessages = (messages = []) => (
  messages.filter(isUsableMessage)
);

export const inspectMemorySignals = (messages = []) => {
  const usableMessages = getUsableMessages(messages);
  const signals = [];

  for (const message of usableMessages) {
    const content = getCurrentMessageContent(message);

    for (const rule of HIGH_PRIORITY_PATTERNS) {
      if (!rule.pattern.test(content)) continue;

      signals.push({
        messageId: message.id,
        sender: message.sender,
        type: rule.type,
        priority: rule.priority,
        excerpt: content.slice(0, 180)
      });
    }
  }

  const highestPriority = signals.reduce(
    (currentHighest, signal) => Math.max(currentHighest, signal.priority),
    0
  );

  return {
    usableMessages,
    signals,
    highestPriority,
    hasHighPrioritySignal: highestPriority >= 4
  };
};

export const buildMemorySourceBatch = (
  messages = [],
  maxMessages = 40
) => {
  const usableMessages = getUsableMessages(messages)
    .slice(-maxMessages);

  return usableMessages.map((message) => ({
    id: message.id,
    sender: message.sender,
    type: message.type || 'text',
    timestamp: message.timestamp || '',
    content: getCurrentMessageContent(message).slice(0, 1200)
  }));
};
