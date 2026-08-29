import db from '../../../db';
import { getInteractionSummary } from './interactionRules';

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

export const generateInteractionReaction = async ({
  chatId,
  interactionMetadata,
}) => {
  if (!chatId || !interactionMetadata) return null;

  try {
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

    const interactionSummary = getInteractionSummary(interactionMetadata);
    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const systemPrompt = `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

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
            content: systemPrompt,
          },
        ],
        temperature: 0.82,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = removeEmoji(
      data?.choices?.[0]?.message?.content || ''
    );

    if (!content) return null;

    const timestamp = new Date().toISOString();

    const messageId = await db.messages.add({
      chatId,
      characterId: character.id,
      sender: 'character',
      type: 'text',
      content,
      metadata: {
        source: 'interaction_reaction',
        interactionType: interactionMetadata.interactionType,
      },
      versions: [
        {
          type: 'text',
          content,
          metadata: {
            source: 'interaction_reaction',
            interactionType: interactionMetadata.interactionType,
          },
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
  } catch (error) {
    console.warn(
      '[InteractionAiService] 互动回应未能生成，互动结果已正常保留。',
      error
    );

    return null;
  }
};
