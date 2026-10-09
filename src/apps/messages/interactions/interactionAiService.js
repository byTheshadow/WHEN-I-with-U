import db from '../../../db';
import { getInteractionSummary, INTERACTION_TYPES } from './interactionRules';

const removeEmoji = (text = '') => String(text)
  .replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
  .trim();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

/*
 * 取角色/聊天/接口配置这三样，凑不齐（角色不存在、接口没配好）就返回
 * null——调用方拿到 null 就安静放弃，不影响互动结果本身已经落库这件事。
 */
export const getGenerationContext = async (chatId) => {
  const [chat, apiSetting] = await Promise.all([
    db.chats.get(chatId),
    db.settings.get('apiConfig'),
  ]);

  if (!chat) return null;

  const character = await db.characters.get(chat.characterId);
  const apiConfig = apiSetting?.value || {};

  if (!character || !apiConfig.baseUrl || !apiConfig.apiKey) {
    return null;
  }

  return { chat, character, apiConfig };
};

/*
 * 一次性的文本生成请求。
 *
 * 修复说明：原来 messages 里只有一条 role:'system'。某些网关/代理（比如
 * 把 messages 转译成 Gemini 的 contents 字段的那种）会认为"只有 system、
 * 没有 user 消息"不是合法请求，直接返回 400（contents is not specified），
 * 而这里非 2xx 时又静默返回空字符串，表现为"AI 调用不了"。
 *
 * 现在改成标准的 system + user 两条：system 放一句通用的角色扮演说明，
 * 调用方传进来的完整提示词（systemPrompt 参数，名字保持不变以兼容所有
 * 调用方）放在 user 消息里。其他标准的聊天接口对这种写法同样没有问题。
 *
 * 失败时仍然返回空字符串（调用方依赖这个行为），但会在控制台打印状态码
 * 和响应体，方便排查。
 */
export const requestAiText = async ({ apiConfig, systemPrompt }) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个游戏里的角色扮演助手，严格按用户给出的要求生成内容。',
        },
        {
          role: 'user',
          content: systemPrompt,
        },
      ],
      temperature: 0.82,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    console.warn(
      `[InteractionAiService] 接口返回非 2xx（状态码 ${response.status}）。`,
      bodyText.slice(0, 300)
    );
    return '';
  }

  const data = await response.json();
  return removeEmoji(data?.choices?.[0]?.message?.content || '');
};

export const insertCharacterTextMessage = async ({
  chatId,
  character,
  content,
  metadataExtra,
}) => {
  const timestamp = new Date().toISOString();
  const metadata = { source: 'interaction_reaction', ...metadataExtra };

  const messageId = await db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'text',
    content,
    metadata,
    versions: [
      {
        type: 'text',
        content,
        metadata,
        timestamp,
      },
    ],
    currentVersionIndex: 0,
    isRead: false,
    timestamp,
  });

  await db.chats.update(chatId, {
    updatedAt: timestamp,
  });

  dispatchLocalMessageEvent(chatId);

  return messageId;
};

// 剧场签/问答卡跟原来"抛硬币/掷骰子"那种一句话反应不一样，需要角色
// 真的顺着情景演一段、或者认真答一下问题，篇幅上给得更宽松一些。
const buildInteractionSystemPrompt = ({ character, interactionMetadata }) => {
  const interactionType = interactionMetadata.interactionType;
  const interactionSummary = getInteractionSummary(interactionMetadata);
  const baseIdentity = `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}`;

  if (interactionType === INTERACTION_TYPES.LOTTERY) {
    return `${baseIdentity}

用户刚刚在聊天里抽到了一支"剧场签"，抽到的情景是：
${interactionSummary}

请以角色第一人称，顺着这个情景即兴演一小段开场——可以是一句带着情境感的
台词，也可以简单带一点动作/心理描写，让这段小剧场自然地展开。

严格要求：
- 只输出一条可直接发送的聊天消息；
- 长度控制在 20 到 100 个汉字之间；
- 不使用 Emoji；
- 不要输出标题、Markdown、括号说明或额外前言；
- 不要提及 AI、系统、接口、算法、抽签、游戏组件或技术实现；
- 不要复述"抽到了什么情景"这句话本身，直接演。`;
  }

  if (interactionType === INTERACTION_TYPES.INTIMACY_QA) {
    return `${baseIdentity}

用户刚刚在聊天里抽到了一张"亲密问答卡"，题目是：
${interactionSummary}

请以角色第一人称，认真、真诚地回答这个问题——这是真的在回答，不是在
评论或反应，语气要符合你的性格。

严格要求：
- 只输出一条可直接发送的聊天消息，也就是这个问题的回答本身；
- 长度控制在 20 到 120 个汉字之间；
- 不使用 Emoji；
- 不要输出标题、Markdown、括号说明或额外前言；
- 不要提及 AI、系统、接口、算法、问答卡、游戏组件或技术实现；
- 不要重复问题原文，直接给出回答。`;
  }

  return `${baseIdentity}

用户刚刚在聊天里完成了一次小游戏互动：
${interactionSummary}

请以角色第一人称，对这个结果作出一句自然、私密、符合人设的即时反应。

严格要求：
- 只输出一条可直接发送的聊天消息；
- 长度控制在 12 到 60 个汉字之间；
- 不使用 Emoji；
- 不要输出标题、Markdown、括号说明或额外前言；
- 不要提及 AI、系统、接口、算法、游戏组件或技术实现；
- 不要重复说明完整规则或复述全部结果。`;
};

export const generateInteractionReaction = async ({
  chatId,
  interactionMetadata,
}) => {
  if (!chatId || !interactionMetadata) return null;

  try {
    const context = await getGenerationContext(chatId);
    if (!context) return null;

    const { character, apiConfig } = context;

    const systemPrompt = buildInteractionSystemPrompt({
      character,
      interactionMetadata,
    });

    const content = await requestAiText({ apiConfig, systemPrompt });
    if (!content) return null;

    return await insertCharacterTextMessage({
      chatId,
      character,
      content,
      metadataExtra: { interactionType: interactionMetadata.interactionType },
    });
  } catch (error) {
    console.warn(
      '[InteractionAiService] 互动回应未能生成，互动结果已正常保留。',
      error
    );

    return null;
  }
};

/*
 * 真心话大冒险专用：用户是这一局的出题人时，角色需要真的认真回答这道
 * 真心话、或者认领并描述自己会怎么执行这道大冒险，而不是像上面那样
 * 泛泛地"反应一下"。
 */
export const generateTruthOrDareAnswer = async ({ chatId, mode, prompt }) => {
  if (!chatId || !prompt) return null;

  try {
    const context = await getGenerationContext(chatId);
    if (!context) return null;

    const { character, apiConfig } = context;
    const modeText = mode === 'dare' ? '大冒险' : '真心话';

    const systemPrompt = `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

用户刚刚在聊天里对你发起了一局"真心话大冒险"，这一次是「${modeText}」，
题目是：
${prompt}

请以角色第一人称，${
      mode === 'dare'
        ? '认领这个大冒险，并具体描述你会怎么去做（用文字演绎出来，不是拒绝或回避）'
        : '老实、坦诚地回答这道真心话'
    }，语气要符合你的性格，可以带一点点情绪或犹豫，但最终要给出实质内容。

严格要求：
- 只输出一条可直接发送的聊天消息；
- 长度控制在 20 到 120 个汉字之间；
- 不使用 Emoji；
- 不要输出标题、Markdown、括号说明或额外前言；
- 不要提及 AI、系统、接口、算法、真心话大冒险、游戏组件或技术实现；
- 不要用"这是个游戏"之类的话跳出情境，也不要直接拒绝回答/执行。`;

    const content = await requestAiText({ apiConfig, systemPrompt });
    if (!content) return null;

    return await insertCharacterTextMessage({
      chatId,
      character,
      content,
      metadataExtra: {
        interactionType: INTERACTION_TYPES.TRUTH_OR_DARE,
        mode,
      },
    });
  } catch (error) {
    console.warn(
      '[InteractionAiService] 真心话大冒险的角色回应未能生成，题目已正常保留。',
      error
    );

    return null;
  }
};