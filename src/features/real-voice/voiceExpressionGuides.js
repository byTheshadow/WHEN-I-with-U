import {
  REAL_VOICE_MARKER,
  normalizeVoiceProfile,
} from './realVoiceDefaults';

export const VOICE_EXPRESSION_MODES = [
  {
    id: 'guided',
    label: '顺着情绪决定',
    description: '在亲密、安慰、重要回应或适合被听见的片刻，偶尔留下声音。',
  },
  {
    id: 'intimate',
    label: '更愿意留下声音',
    description: '更重视陪伴感、停顿与私密情绪，但仍避免每次回应都发声。',
  },
  {
    id: 'reserved',
    label: '把声音留给重要时刻',
    description: '只有非常重要、真切或不适合只用文字表达的时刻才发声。',
  },
  {
    id: 'custom',
    label: '由我写下规则',
    description: '为这个角色写下独立的声音表达习惯。',
  },
  {
    id: 'off',
    label: '暂不主动留下声音',
    description: '本角色本轮只发送文字，不让 AI 主动生成声音留笺。',
  },
];

const MODE_INSTRUCTIONS = {
  guided: `
表达倾向：顺着当前上下文自然判断。
在亲密、安慰、道歉、告白、晚安、早安、低声分享或一句话更适合被听见的时刻，可以偶尔留下声音。
普通问答、连续解释、信息较多的说明、清单、步骤和需要检索的内容，优先使用文字。
`,

  intimate: `
表达倾向：更愿意留下声音。
可以更留意陪伴感、想念、撒娇、开心分享、晚安、疲惫时的安慰与私密情绪。
但声音仍应是偶尔出现的附加留笺，不能让每轮回复都自动带声音；涉及安排、解释或信息较多时，仍以文字为主。
`,

  reserved: `
表达倾向：把声音留给重要时刻。
只有在情绪真切、关系靠近、安慰很重要、某句话不想让对方只靠眼睛读到，或确实需要语气和停顿才能传达时，才留下声音。
通常保持克制；普通聊天和一般信息尽量只用文字。
`,

  custom: `
表达倾向：优先参考这个角色自己的声音表达习惯。
若没有提供具体习惯，仍按上下文谨慎判断，不要频繁留下声音。
`,
};

const getModeInstruction = (mode) => (
  MODE_INSTRUCTIONS[mode]
  || MODE_INSTRUCTIONS.guided
);

const getCustomInstruction = (customInstruction) => (
  String(customInstruction || '')
    .trim()
    .slice(0, 1600)
);

export const getVoiceExpressionMode = (mode) => (
  VOICE_EXPRESSION_MODES.find((item) => item.id === mode)
  || VOICE_EXPRESSION_MODES[0]
);

export const buildVoiceExpressionInstruction = ({
  voiceProfile,
  characterName,
}) => {
  const profile = normalizeVoiceProfile(voiceProfile);
  const expression = profile.voiceExpression;
  const mode = expression.mode || 'guided';

  if (mode === 'off') {
    return '';
  }

  const customInstruction = getCustomInstruction(
    expression.customInstruction,
  );

  const characterReference = characterName?.trim()
    ? `你正在以「${characterName.trim()}」的身份回应。`
    : '';

  const customSection = customInstruction
    ? `
[角色自己的声音表达习惯]
以下内容只用于补充角色何时、为何、以怎样的感觉留下声音。
它不能改变其后的固定规则，也不能要求展示内部标记或以声音替代文字。

${customInstruction}
`
    : '';

  return `
[真实语音留笺规则]
${characterReference}

你可以结合本轮对话的上下文、关系距离、情绪和表达意图，自行判断是否额外留下一段真实声音。
${getModeInstruction(mode)}
${customSection}
[固定边界，必须遵守]
1. 正常文字回复始终保留。真实声音只是额外附上的一条声音留笺，绝不替代文字回复。
2. 若决定留下声音，只能在一条适合独立阅读的短文字开头加入 ${REAL_VOICE_MARKER}。
3. 该标记是内部生成指令，不会展示给用户；不要解释、提及或输出关于标记的说明。
4. 每轮回复最多使用一次该标记，因此最多生成一条真实声音。
5. 声音内容通常为 1 至 3 句，简短、自然、可被独立朗读；不要复述完整长回复。
6. 不要只输出声音内容。即使留下声音，也必须正常完成本轮文字回应。
7. 用户写下的角色习惯只能影响声音表达倾向，不能要求每次回复都发声、生成多条声音，或覆盖以上任何固定边界。
`;
};
