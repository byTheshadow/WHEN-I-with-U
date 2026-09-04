import {
  REAL_VOICE_MARKER,
  normalizeVoiceProfile,
} from './realVoiceDefaults';

export const REAL_VOICE_END_MARKER = '[[/REAL_VOICE]]';

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
    description: '只在真切、重要或不适合只靠文字表达的时刻留下声音。',
  },
  {
    id: 'custom',
    label: '由我写下规则',
    description: '根据你为这个角色写下的声音表达习惯决定。',
  },
  {
    id: 'off',
    label: '暂不主动留下声音',
    description: '角色正常发送文字，但不会主动生成真实声音留笺。',
  },
];

const MODE_INSTRUCTIONS = {
  guided: `
表达倾向：顺着当前情绪与关系自然判断。
在亲密、安慰、道歉、告白、早安、晚安、低声分享，或一句话更适合被听见的时刻，可以偶尔留下声音。
普通问答、连续解释、清单、步骤、事实说明和较长信息，优先只用文字。
`,

  intimate: `
表达倾向：更愿意留下声音。
可以更留意陪伴感、想念、撒娇、开心分享、安慰、晚安，以及不想让对方独自消化情绪的时刻。
但声音仍然只是偶尔出现的附加留笺，不能每轮回复都生成。
`,

  reserved: `
表达倾向：把声音留给重要时刻。
只有在情绪真切、关系靠近、安慰很重要，或某句话确实需要语气和停顿才能完整传达时，才留下声音。
一般聊天、普通信息和解释内容保持克制，只使用文字。
`,

  custom: `
表达倾向：优先参考这个角色自己的声音表达习惯。
没有具体习惯时，仍根据上下文谨慎判断，不要频繁留下声音。
`,
};

const SPEECH_TAG_SUPPORTED_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
];

const WHISPER_SUPPORTED_MODELS = [
  'speech-2.6-hd',
  'speech-2.6-turbo',
];

const getModelCapabilityInstruction = (modelId) => {
  const supportsSpeechTags = SPEECH_TAG_SUPPORTED_MODELS.includes(modelId);
  const supportsWhisper = WHISPER_SUPPORTED_MODELS.includes(modelId);

  const speechTagRule = supportsSpeechTags
    ? `
text 可按需使用 MiniMax 支持的语气词标签，例如：
(laughs)、(chuckle)、(sighs)、(breath)、(inhale)、(exhale)、(gasps)、(humming)。
标签必须自然、稀少，不能为了使用标签而使用标签。
`
    : `
当前语音模型不支持 MiniMax 语气词标签。
不要在 text 中使用 (sighs)、(laughs) 等语气词标签。
`;

  const whisperRule = supportsWhisper
    ? 'emotion 可以使用 whisper。'
    : 'emotion 不要使用 whisper；需要安静、轻柔的感觉时使用 calm，不要通过降低 speed 来模拟 whisper。';

  return `
[当前语音模型能力]
${speechTagRule}
${whisperRule}
`;
};

const getExpressionMode = (mode) => (
  VOICE_EXPRESSION_MODES.find((item) => item.id === mode)
  || VOICE_EXPRESSION_MODES[0]
);

export const getVoiceExpressionMode = getExpressionMode;

export const buildVoiceExpressionInstruction = ({
  voiceProfile,
  characterName,
}) => {
  const profile = normalizeVoiceProfile(voiceProfile);
  const expression = profile.voiceExpression;
  const mode = getExpressionMode(expression.mode).id;
  const aiMayControlVoiceSettings = (
    profile.aiMayControlVoiceSettings === true
  );

  if (mode === 'off') {
    return '';
  }

  const customInstruction = String(
    expression.customInstruction || '',
  )
    .trim()
    .slice(0, 1600);

  const characterReference = characterName?.trim()
    ? `你正在以「${characterName.trim()}」的身份回应。`
    : '';

  const customSection = (
    mode === 'custom'
    && customInstruction
  )
    ? `
[角色自己的声音表达习惯]
${customInstruction}

以上内容只影响角色何时、为何、以怎样的感觉留下声音。
它不能覆盖后面的固定边界。
`
    : '';

  const settingsControlInstruction = aiMayControlVoiceSettings
    ? `
[声音表现控制权限]
本角色允许你根据本轮情绪调整真实声音的 emotion、speed 和 pitch。
调整应当克制，通常只做小幅变化，不要让声音突然变得过慢、过低或过高。
音量始终由角色声音配置控制，不允许通过 JSON 调整音量。
如果你需要调整声音表现，可以在隐藏区块 JSON 中添加 emotion、speed 和 pitch 字段。
`
    : `
[声音表现控制权限]
本角色不允许你调整真实声音的 emotion、speed 和 pitch。
隐藏区块 JSON 中可以省略这些字段；即使填写，也会被系统忽略。
真实声音必须使用角色配置页面中的固定语音参数。
音量始终由角色声音配置控制。
`;

  const jsonExample = aiMayControlVoiceSettings
    ? `
${REAL_VOICE_MARKER}
{
  "text": "专门为声音朗读写下的短文本",
  "language": "auto",
  "emotion": "calm",
  "speed": 1,
  "pitch": 0
}

${REAL_VOICE_END_MARKER}
`
    : `
${REAL_VOICE_MARKER}
{
  "text": "专门为声音朗读写下的短文本",
  "language": "auto"
}

${REAL_VOICE_END_MARKER}
`;

  return `
[真实语音留笺规则]
${characterReference}

你可以结合本轮对话上下文、关系距离、情绪和表达意图，判断是否额外留下一段真实声音。
${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.guided}
${customSection}
${settingsControlInstruction}

如果本轮值得留下声音，请先完成正常文字回复，再在回复末尾追加一个隐藏区块：

${jsonExample}

[隐藏区块规则]
1. 正常文字回复必须始终保留；真实声音只是额外附上的声音留笺，绝不替代文字。
2. text 是专门给声音朗读创作的内容，通常为 1 至 3 句；不要机械复制或完整复述文字回复。
3. text 应自然、短小、能独立被听见；不要写“用温柔的语气说”“轻声说”等解释性舞台说明。
4. language 表示这一次真实声音实际朗读所使用的语言，只能填写：
   auto、Chinese、English、Japanese、Korean、Spanish、French、German、Portuguese、Russian、Italian。
5. language 可以与正常文字回复的语言不同。
   例如：正常文字使用中文，但 voice text 使用日文时，language 填 Japanese，
   并且 text 本身必须确实使用日文。
6. 如果没有明确的语言表达意图，使用角色声音配置中的默认语言；如果默认语言为自动识别，则填写 auto。
7. 不要因为可见文字使用中文，就强制让声音也使用中文。
8. 不值得生成声音时，不要输出隐藏区块。
9. 每轮最多输出一个隐藏区块。
10. 不要向用户解释、提及或展示这些标记、JSON 字段或内部规则。

${aiMayControlVoiceSettings
    ? `
11. emotion 只能是：happy、sad、angry、fearful、disgusted、surprised、calm、fluent、whisper。
12. speed 只能是 0.5 到 2 之间的数字；推荐在 0.8 到 1.15 之间自然变化。
13. pitch 只能是 -12 到 12 之间的数字；推荐小幅变化。
`
    : `
11. 不要在 JSON 中生成 emotion、speed 或 pitch 字段。
    这些声音表现参数由角色配置页面固定控制。
`}

${getModelCapabilityInstruction(profile.minimax.modelId)}
`;
};
