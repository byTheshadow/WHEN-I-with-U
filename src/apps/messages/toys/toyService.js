// src/apps/messages/toys/toyService.js
//
// "让TA做个小玩具"的数据层。
//   - 聊天里一条消息（db.messages，type: 'chat_toy'）：只带标题、规则和状态。
//     状态存在 metadata.status：making（制作中）/ ready / failed / deleted。
//   - 代码单独放在 db.chatToys 表里，由 getToy(toyId) 在试玩时才读，
//     所以代码不会出现在聊天列表的数据里，也不会进入任何 AI 上下文。
//
// 制作在后台进行（不阻塞聊天），完成后更新那条消息，并发出 'new-local-message-inserted'
// 事件让 ChatRoom 重新加载（和其他本地插入消息的做法一致）。
// 同一个聊天同一时间只允许制作一个，避免连点出一堆请求。

import db from '../../../db';
import { generateToy } from './toyAiService';
import { TOY_LIMITS, TOY_MESSAGE_TYPE, TOY_STATUS } from './toyConstants';
import { isToyMakingInChat, markToyMaking, unmarkToyMaking } from './toyInflight';

// 转出去，ChatRoom 等已有的导入写法不用改。
export { isToyMakingInChat };

// 制作的来源，记在消息和玩具记录上：
//   user      用户点菜单按钮
//   character 角色自己决定做（toyDirective.js 的 [TOY_WANT] 标签）
//   user_ask  用户在聊天里直接说想要，角色接住后做
export const TOY_SOURCE = {
  USER: 'user',
  CHARACTER: 'character',
  USER_ASK: 'user_ask',
};

const notifyChat = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
};

const patchMessage = async (messageId, { content, metadata }) => {
  const current = await db.messages.get(messageId);
  if (!current) return null;

  const patch = { metadata: { ...(current.metadata || {}), ...metadata } };
  if (typeof content === 'string') patch.content = content;

  await db.messages.update(messageId, patch);
  return { ...current, ...patch };
};

const runMaking = async ({ messageId, chatId, character, request, source }) => {
  try {
    const toy = await generateToy({ character, chatId, request });

    const toyId = await db.chatToys.add({
      chatId,
      characterId: character.id,
      title: toy.title,
      rules: toy.rules,
      html: toy.html,
      request,
      source,
      createdAt: Date.now(),
    });

    await patchMessage(messageId, {
      content: `做了一个小玩具「${toy.title}」`,
      metadata: {
        status: TOY_STATUS.READY,
        toyId,
        title: toy.title,
        rules: toy.rules,
        errorText: '',
      },
    });
  } catch (error) {
    console.warn('小玩具制作失败：', error);

    await patchMessage(messageId, {
      content: '这次没做成小玩具',
      metadata: {
        status: TOY_STATUS.FAILED,
        errorText: String(error?.message || '这次没做成').slice(0, 160),
      },
    }).catch(() => {});
  } finally {
    unmarkToyMaking(chatId);
    notifyChat(chatId);
  }
};

/**
 * 开始制作一个小玩具：立刻往聊天里写一条"制作中"的卡片，真正的生成在后台跑。
 * 返回 { started: true, messageId } 或 { started: false, reason: 'busy' | 'invalid' }。
 */
export const startToyMaking = async ({
  chatId,
  character,
  request = '',
  source = TOY_SOURCE.USER,
}) => {
  if (!chatId || !character?.id) return { started: false, reason: 'invalid' };

  if (isToyMakingInChat(chatId)) return { started: false, reason: 'busy' };
  markToyMaking(chatId);

  const cleanRequest = String(request || '').trim().slice(0, TOY_LIMITS.requestChars);
  const stamp = new Date().toISOString();
  let messageId;

  try {
    messageId = await db.messages.add({
      chatId,
      characterId: character.id,
      sender: 'character',
      type: TOY_MESSAGE_TYPE,
      content: '正在给用户做一个小玩具',
      metadata: {
        status: TOY_STATUS.MAKING,
        request: cleanRequest,
        source,
        startedAt: Date.now(),
      },
      isRead: false,
      timestamp: stamp,
    });

    await db.chats.update(chatId, { updatedAt: stamp });
    notifyChat(chatId);
  } catch (error) {
    unmarkToyMaking(chatId);
    throw error;
  }

  void runMaking({ messageId, chatId, character, request: cleanRequest, source });

  return { started: true, messageId };
};

/** 失败的卡片点"重试"：沿用原来的想法，重新做一份（同一条消息，不新增）。 */
export const retryToyMaking = async ({ messageId }) => {
  const message = await db.messages.get(messageId);
  if (!message || message.type !== TOY_MESSAGE_TYPE) return { started: false, reason: 'invalid' };

  const chatId = message.chatId;
  if (isToyMakingInChat(chatId)) return { started: false, reason: 'busy' };

  const character = await db.characters.get(message.characterId);
  if (!character) return { started: false, reason: 'invalid' };

  markToyMaking(chatId);

  try {
    await patchMessage(messageId, {
      content: '正在给用户做一个小玩具',
      metadata: { status: TOY_STATUS.MAKING, errorText: '', startedAt: Date.now() },
    });
    notifyChat(chatId);
  } catch (error) {
    unmarkToyMaking(chatId);
    throw error;
  }

  void runMaking({
    messageId,
    chatId,
    character,
    request: String(message.metadata?.request || ''),
    source: message.metadata?.source || TOY_SOURCE.USER,
  });

  return { started: true, messageId };
};

/**
 * 卡片渲染时调用：如果这条消息停在"制作中"，但内存里并没有这个聊天的制作任务，
 * 说明是应用被关掉 / 刷新时中断了，把它标成失败，用户可以点重试。
 * 返回是否改动了数据。
 */
export const reconcileInterruptedToy = async (message) => {
  if (!message || message.type !== TOY_MESSAGE_TYPE) return false;
  if (message.metadata?.status !== TOY_STATUS.MAKING) return false;
  if (isToyMakingInChat(message.chatId)) return false;

  await patchMessage(message.id, {
    content: '这次没做成小玩具',
    metadata: { status: TOY_STATUS.FAILED, errorText: '制作被中断了（可能是关掉了页面）' },
  });
  return true;
};

/** 试玩时才读代码。 */
export const getToy = async (toyId) => {
  if (toyId === undefined || toyId === null) return null;
  return (await db.chatToys.get(toyId)) || null;
};

/** 删除一个玩具：代码删掉，聊天里的卡片保留并标成"已删除"，上下文里角色也会知道。 */
export const deleteToy = async (message) => {
  if (!message || message.type !== TOY_MESSAGE_TYPE) return;

  const toyId = message.metadata?.toyId;
  if (toyId !== undefined && toyId !== null) {
    await db.chatToys.delete(toyId);
  }

  await patchMessage(message.id, {
    content: `做过一个小玩具「${message.metadata?.title || ''}」（已删除）`,
    metadata: { status: TOY_STATUS.DELETED },
  });
  notifyChat(message.chatId);
};