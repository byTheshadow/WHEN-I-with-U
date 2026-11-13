/*
 * 日常正式聊天里，让角色"感知"到小伙伴（#6 聊天窗宠物）现在的大致状态——
 * 单独拆成这一个文件，只 import db，不 import companionService.js /
 * companionAiService.js 的任何代码。
 *
 * 之所以要单独拆开：companionAiService.js 本身要 import aiService.js 的
 * buildChatSystemPrompt（角色自主照顾小伙伴留日志时用，见
 * generateAutonomousCareNote）；如果反过来又让 aiService.js 去 import
 * companionService.js，就会绕出一圈循环引用
 * （aiService -> companionService -> companionAiService -> aiService）。
 * 这个文件只负责"读小伙伴当前状态、拼一段描述性文字"，没有这层依赖，
 * aiService.js 直接 import 它是安全的。
 *
 * 只给"大概状态"的描述性文字（心情不错/有点低落、吃得饱/有点饿），
 * 不把 0-100 的具体数值告诉角色——角色不该知道这是个数值游戏。
 *
 * 这段是否出现在提示词里由调用方（aiService.js）按概率决定，不是每轮
 * 都带上——减少对主提示词其他内容的稀释，也省一点不需要的 token；
 * 抽中的那轮，措辞上也允许角色借机自然提一句（不强制），不再是
 * "只有被问起才能提"的纯被动口径。
 */

import db from '../../db';
import { describeSleepForPrompt } from './companionSleepService';

const pad2 = (n) => String(n).padStart(2, '0');
const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const describeMood = (mood) => {
  if (mood >= 80) return '心情很好';
  if (mood >= 50) return '心情还不错';
  if (mood >= 30) return '最近有点闷闷的';
  return '心情不太好';
};

const describeSatiety = (satiety) => {
  if (satiety >= 80) return '吃得很饱';
  if (satiety >= 40) return '不饥不饱';
  return '有点饿了';
};

const daysSince = (timestamp, now = Date.now()) => {
  if (!timestamp) return null;
  return Math.floor((now - timestamp) / 86400000);
};

/*
 * 返回拼好的提示词片段（没有养小伙伴、或任何一步出错就返回空字符串，
 * 行为和这个功能不存在时完全一致）。
 */
export const buildCompanionStatusPromptBlock = async (chatId) => {
  if (chatId === null || chatId === undefined) return '';

  try {
    const companion = await db.companions.where('chatId').equals(chatId).first();
    if (!companion) return '';

    const now = Date.now();
    const moodText = describeMood(companion.mood ?? 80);
    const satietyText = describeSatiety(companion.satiety ?? 80);

    const idleDays = daysSince(companion.lastInteractionAt, now);
    const idleText = idleDays !== null && idleDays >= 2
      ? `，已经有 ${idleDays} 天没人去看它了`
      : '';

    let recentLogText = '';
    try {
      const recentLogs = await db.companionLogs
        .where('companionId')
        .equals(companion.id)
        .reverse()
        .sortBy('timestamp');
      const latest = recentLogs[0];
      if (latest?.content && now - latest.timestamp < 3 * 86400000) {
        recentLogText = `\n最近一次动态：${latest.content}`;
      }
    } catch (error) {
      console.warn('[CompanionStatus] 拉取最近动态失败：', error);
    }

    // 最近一篇日记（含用户有没有点赞/留言）——日记本身是"重要事件触发"写的，
    // 比普通动态更值得被角色感知到、甚至主动提起，所以单独拎出来一段，
    // 不跟上面的 recentLogText 合并。同样只在 3 天以内才带上，太旧的日记
    // 角色去聊它会显得很奇怪（"事后很久才提起"）。
    let recentDiaryText = '';
    try {
      const recentDiaries = await db.companionDiaries
        .where('companionId')
        .equals(companion.id)
        .reverse()
        .sortBy('timestamp');
      const latestDiary = recentDiaries[0];
      if (latestDiary?.content && now - latestDiary.timestamp < 3 * 86400000) {
        let userReactionText = '';
        if (latestDiary.liked) userReactionText += '，用户点了赞';
        if (latestDiary.userComment) userReactionText += `，用户留言说"${latestDiary.userComment}"`;
        recentDiaryText = `\n${companion.name}最近写了一篇日记：「${latestDiary.content}」${userReactionText}。`;
      }
    } catch (error) {
      console.warn('[CompanionStatus] 拉取最近日记失败：', error);
    }

    // 每日问答——严格只在 char 和 user 今天都回答了之后才带上这一段；
    // 只要有一边没答（甚至今天根本还没出题），dailyQaText 就保持空字符串，
    // 不会多占一个字的 token，也不会主动提醒"还没回答"去催用户。
    let dailyQaText = '';
    try {
      const todayStr = getTodayDateStr();
      const todayQa = await db.companionDailyQA
        .where('[companionId+date]')
        .equals([companion.id, todayStr])
        .first();
      if (todayQa?.charAnswer && todayQa?.userAnswer) {
        dailyQaText = `\n今天的每日问答都答完了——问${companion.name}的问题是"${todayQa.questionForChar}"，TA 答的是"${todayQa.charAnswer}"；问用户的问题是"${todayQa.questionForUser}"，用户答的是"${todayQa.userAnswer}"。`;
      }
    } catch (error) {
      console.warn('[CompanionStatus] 拉取每日问答失败：', error);
    }

        const sleepText = describeSleepForPrompt(companion, now);
    const sleepLine = sleepText ? `\n${sleepText}` : '';
    return `\n【你们共同养的小伙伴"${companion.name}"目前的状态（这次恰好想到/感知到了，不是每次都要提，用户问起它、聊天里自然聊到它、或者你单纯想随口提一句都可以，不要生硬地汇报数值，也别刻意为了提而提）】：\n${moodText}，${satietyText}${idleText}。${sleepLine}${recentLogText}${recentDiaryText}${dailyQaText}\n`;
  } catch (error) {
    console.warn('[CompanionStatus] 生成小伙伴状态提示词失败：', error);
    return '';
  }
};