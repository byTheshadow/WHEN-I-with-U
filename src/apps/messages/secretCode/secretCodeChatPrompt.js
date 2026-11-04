// src/apps/messages/secretCode/secretCodeChatPrompt.js
//
// 聊天请求那边用的一个入口：把"待处理提议数""用户这一轮发的文字""最新的角色
// 设置"都在这里取好，再交给 buildSecretCodePromptBlock 拼提示词。
// aiService.js 只需要调用 buildSecretCodePromptForChat 一个函数。
//
// 所有读取失败都只打警告、按没有处理，不影响聊天请求。
import db from '../../../db';
import { buildSecretCodePromptBlock } from './secretCodePrompt';
import { countPendingSecretCodeProposals } from './secretCodeProposal';

// 往回看多少条消息；以及"这一轮"最多取用户连发的几条
const SCAN_WINDOW = 12;
const MAX_USER_MESSAGES = 6;

/**
 * 取用户这一轮发的文字：从最新一条往回数，连续的用户文字消息拼起来，
 * 碰到角色的消息就停（那是上一轮了）。没有就返回空字符串。
 */
export const getRecentUserTextForSecretCodes = async (chatId) => {
  if (!chatId) return '';

  const recent = await db.messages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(SCAN_WINDOW)
    .toArray();

  const picked = [];
  for (const message of recent) {
    if (message.sender === 'user') {
      if (message.type === 'text' && typeof message.content === 'string' && message.content) {
        picked.push(message.content);
      }
      if (picked.length >= MAX_USER_MESSAGES) break;
      continue;
    }
    if (message.sender === 'character') break;
  }

  return picked.reverse().join('\n');
};

export const buildSecretCodePromptForChat = async (chatId, character) => {
  let pendingProposalCount = 0;
  try {
    pendingProposalCount = await countPendingSecretCodeProposals(chatId);
  } catch (error) {
    console.warn('[secretCodeChatPrompt] 统计未处理的暗号提议失败：', error);
  }

  let userText = '';
  try {
    userText = await getRecentUserTextForSecretCodes(chatId);
  } catch (error) {
    console.warn('[secretCodeChatPrompt] 读取用户这一轮的文字失败：', error);
  }

  // 传进来的 character 可能是聊天窗打开时的旧快照，省着带开关、词典都以 db 里的为准
  let latestCharacter = character;
  try {
    if (character?.id) {
      latestCharacter = (await db.characters.get(character.id)) || character;
    }
  } catch (error) {
    console.warn('[secretCodeChatPrompt] 读取最新角色设置失败：', error);
  }

  return buildSecretCodePromptBlock(latestCharacter, { pendingProposalCount, userText });
};