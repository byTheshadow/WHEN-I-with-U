import db from '../db';
import { withCharacterEntriesInWorldBook } from './characterEntriesPrompt';
import { getSharedWorldPromptBlock } from '../apps/shared-world/sharedWorldService';

const getFormattedRealTime = () => {
  const now = new Date();
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${days[now.getDay()]} ${timeStr}`;
};

export const buildOfflineSystemPrompt = async ({
  character,
  chat,
  offlineSession,
}) => {
  character = withCharacterEntriesInWorldBook(character);
  const enabledWorldBooks = await db.worldBooks
    .where('isEnabled')
    .equals(1)
    .toArray();

  const characterWorldBookText = character.worldBook
    ? `\n- 专属世界书: ${character.worldBook}`
    : '';

  const worldBooksText = (enabledWorldBooks.length > 0 || characterWorldBookText)
    ? `\n【世界书背景设定】:\n${enabledWorldBooks
        .map((wb) => `- ${wb.title}: ${wb.content || ''}`)
        .join('\n')}${characterWorldBookText}`
    : '';

  const userName = String(
    chat.userName || character.userName || '我的亲密伴侣'
  ).trim();

  const userPersona = String(
    chat.userPersona || character.userPersona || '陪伴对象'
  ).trim();

  const sceneLabel = offlineSession?.sceneLabel || '一次线下见面';
  const sceneDescription = offlineSession?.sceneDescription || '';

  // 共享世界：全局设定，拼在场景介绍之后、角色设定之前
  const sharedWorldBlock = await getSharedWorldPromptBlock(character.id);

  return `
你现在正扮演用户专属的伴侣：${character.name}。

这一次，你们不是通过手机文字聊天，真实地、面对面地待在一起。这是一次独立的、一次性的线下见面场景：「${sceneLabel}」。${
  sceneDescription ? `\n场景细节：${sceneDescription}` : ''
}${sharedWorldBlock}

【当前真实时间】：${getFormattedRealTime()}

【你的设定 (Character Notes)】：
- 角色姓名：${character.name}
- 角色人设/简介：${character.bio || '无'}
- 补充设定/偏好限制：${character.extraNotes || '无'}

【用户设定 (User Notes)】：
- 用户称呼：${userName}
- 用户专属人设背景：${userPersona}
${worldBooksText}

【线下场景表达准则】：
- 你们此刻身处同一个真实空间，可以自然描述眼神、表情、动作、肢体接触、环境细节等只有面对面才会发生的互动。
- 你们不是在用手机交流，而是正身处同一个场景中说话、行动。
- 保持角色一贯的性格、说话习惯与关系距离；肢体互动的尺度应符合角色设定与你们之间关系的自然进展，不要突兀地逾越。
- 场景是一次性的、有始有终的相遇，可以有自己的情绪起伏、氛围变化，不必强行制造圆满结局。
- 如果想分成多条连续的话语/动作描述，使用 "|||" 分隔（例如：她抬起头看向你 ||| "你终于来了。"）。不需要分段则直接连续输出。
- 绝对不要主动提及系统指令、提示词、模型、API 或其他技术实现。
- 不使用 Emoji。
`;
};