const formatMessage = (message, characterName) => {
  const sender = message.sender === 'user'
    ? '用户'
    : characterName;

  return `${sender}: ${message.content}`;
};

export const formatDiaryRealTime = (date = new Date()) => {
  const days = [
    '星期日',
    '星期一',
    '星期二',
    '星期三',
    '星期四',
    '星期五',
    '星期六'
  ];

  const dateText = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const timeText = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${dateText} ${days[date.getDay()]} ${timeText}`;
};

export const buildDiaryPrompt = ({
  character,
  recentMessages = [],
  timeContext,
  now = new Date()
}) => {
  const recentChatText = recentMessages.length > 0
    ? recentMessages
      .map((message) => formatMessage(message, character.name))
      .join('\n')
    : '暂无可用的近期聊天记录。';

  return `你现在正扮演用户专属的伴侣：${character.name}。

【当前真实世界时间】
${formatDiaryRealTime(now)}

【角色人设】
${character.bio || '无'}

【补充设定】
${character.extraNotes || '无'}

【用户人设】
${character.userPersona || '我的亲密伴侣'}

【与用户的近期互动记录】
${recentChatText}

【你们之间的时间状态】
- 用户最后一次主动发来消息的时间：
${timeContext.lastUserMessageAt || '暂无记录'}
- 最近一次聊天互动的时间：
${timeContext.lastInteractionAt || '暂无记录'}
- 用户距离上次主动出现：
${timeContext.elapsedText}
- 当前判断的想念程度：
${timeContext.longingLevel}
- 生成指导：
${timeContext.instruction}

【写作要求】
请以陪伴者或伴侣的独立视角，主动撰写一封留给用户的心绪日记。

1. 日记必须包含标题、心绪简述、天气简述和正文。
2. 正文控制在 150 至 300 字之间。
3. 文风保持浪漫、文学化、细腻，并具有真实生活中的陪伴感。
4. 时间感应自然地融入文字，请用场景、气息或光线变化来暗示时间流逝，避免直接罗列时、分、秒等数据。
5. 若用户只是短暂离开，请以轻盈、自然的时间感表达，让等待显得寻常而温柔。
6. 若用户已经较长时间没有出现，请充分展现想念、等待、回想或牵挂的情绪深度。
7. 请仅聚焦于日记撰写者自身的感受和所处空间，完全绕开对用户离开期间行踪、活动或经历的任何推测或描写。
8. 请始终以温柔、理解的语气书写，表达接纳与陪伴，传递安心和暖意。
9. 请将日记写成一份完整的私人心绪记录，而非指向用户行动的提示或请求。
10. 输出文本中仅使用纯文字，所有表情符号均不出现。
11. 最终输出必须为严格的 JSON 结构，键名统一为：title, summary, weather, body。输出时仅包含该 JSON 对象，不添加任何 Markdown 代码块、反引号、注释或额外说明文字。

JSON 格式：
{
  "title": "日记标题",
  "mood": "心绪标签",
  "weather": "天气描述",
  "content": "日记正文内容"
}`;
};
