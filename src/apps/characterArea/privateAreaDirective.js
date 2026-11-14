// src/apps/characterArea/privateAreaDirective.js
//
// 角色专属区域——主聊天里的 [PRIVATE_WANT] 标签（切片 C）。
//
// 完全套用气泡风格的 [BUBBLE_WANT] 做法（见 apps/messages/bubbleStyleDirective.js）：
// 主聊天提示词里只放很短的一小段说明；角色想往小本子里记点什么（或者还没有
// 小本子、想现在拥有一个），就在回复末尾单独一行写一个不带内容的 [PRIVATE_WANT]；
// aiService.js 把标签从正文里摘掉，回复写入之后，再单独调用一次
// privateAreaSession.js 完成真正的整理。完整的整理规则只在那一次里给，不放进每次
// 都带的主聊天提示词。
//
// 为了让这一小段说明不变成每次回复的固定开销，只按概率带（约 15%）——抽不中的
// 回复里完全没有这段说明，角色也就不会想到要写。标签本身不管有没有带说明，
// 只要出现就一律摘掉，也不加冷却（跟气泡风格、戳一戳同一个"相信角色自己判断"
// 的约定）。
import { getAreaForChat } from './characterAreaService';

export const PRIVATE_AREA_NOTE_PROBABILITY = 0.15;

const PRIVATE_WANT_TAG_PATTERN = /\s*\[PRIVATE_WANT\]\s*/i;
const PRIVATE_WANT_TAG_PATTERN_ALL = /\s*\[PRIVATE_WANT\]\s*/gi;

const buildNoteWithArea = (area) => {
  const intro = area.intro ? `（${area.intro}）` : '';

  return `【可选行为：往你的专属小本子里记一笔】
你有一个只属于自己的小本子「${area.name}」${intro}。如果这次聊天让你想往里记点什么，就在回复正文最后单独一行写 [PRIVATE_WANT]（用户看不到这行，系统会马上单独问你具体想记什么）。不想记就不要写，也不要在这次回复里提到这件事。`;
};

const NOTE_WITHOUT_AREA = `【可选行为：留一个只属于自己的小秘密】
你可以拥有一个只属于自己的小本子，里面记什么由你按自己的性格来定。如果你现在就想拥有它，就在回复正文最后单独一行写 [PRIVATE_WANT]（用户看不到这行，系统会马上单独问你）。不想就不要写，也不要在这次回复里提到这件事。`;

// 抽不中概率，或者出任何错，都返回空字符串，跟这个功能不存在时完全一致。
export const buildPrivateAreaPromptNote = async (chatId, { random = Math.random } = {}) => {
  if (random() >= PRIVATE_AREA_NOTE_PROBABILITY) return '';

  try {
    const area = await getAreaForChat(chatId);
    return area ? buildNoteWithArea(area) : NOTE_WITHOUT_AREA;
  } catch (error) {
    console.warn('[characterArea] 拼接小本子说明失败，本轮跳过：', error);
    return '';
  }
};

// 同步纯函数：一律把 [PRIVATE_WANT] 从正文里去掉，并告诉调用方"角色想整理一下"。
export const applyPrivateAreaDirective = ({ content }) => {
  const rawContent = String(content || '');
  const wantsPrivateArea = PRIVATE_WANT_TAG_PATTERN.test(rawContent);

  return {
    content: rawContent.replace(PRIVATE_WANT_TAG_PATTERN_ALL, ' ').trim(),
    wantsPrivateArea,
  };
};