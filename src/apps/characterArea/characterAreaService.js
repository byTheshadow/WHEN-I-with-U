// src/apps/characterArea/characterAreaService.js
//
// 角色专属区域——数据层 + "创建区域"的单次AI调用。
//
// 每个聊天窗口最多一个区域（characterAreas.chatId 是唯一索引）。区域由角色
// 按人设自己发明（名称/图标/简介），一旦创建，在这个聊天窗口里永久固定。
// 创建时同时一次性生成两样东西，之后都不再重新生成：
//   - refusalLines：一批符合人设的拒绝话术（用户点标题、角色不同意时随机取一句）
//   - refuseProb：这个角色的"护食程度"（0.05 到 0.85），每个角色不同
//
// 跟 challengeService.js / diyAreaService.js 同一个做法：直接对 apiConfig
// 发一次 fetch（复用 challengeService.js 导出的 callSingleCompletion），不经过
// aiService.js——避免循环依赖，也避免撑大主聊天链路。
//
// "每晚自动整理 / 仅手动"开关存在 chats 表上的无索引追加字段
// privateAreaAutoOrganize（不放在 characterAreas 里：区域还没创建时用户就
// 要能先选）。默认 'manual'。
//
// 本文件只做切片 A 的内容：读区域、读写开关、创建区域。写条目、整理、注入
// 聊天、自我任务都在后面的切片，这里不预先实现。
import db from '../../db';
import { callSingleCompletion, getRecentHistoryText } from '../challenges/challengeService';
import { AREA_ICON_NAMES, parseAreaCreationOutput } from './characterAreaParse';

export { AREA_ICON_NAMES };

export const AUTO_ORGANIZE_MANUAL = 'manual';
export const AUTO_ORGANIZE_NIGHTLY = 'nightly';

const nowIso = () => new Date().toISOString();

// 防止用户连点两次按钮同时发起两次创建。
const creatingChatIds = new Set();

export const getAreaForChat = async (chatId) => {
  if (!chatId) return null;
  return (await db.characterAreas.where('chatId').equals(chatId).first()) || null;
};

export const getAutoOrganizeMode = async (chatId) => {
  const chat = await db.chats.get(chatId);
  return chat?.privateAreaAutoOrganize === AUTO_ORGANIZE_NIGHTLY
    ? AUTO_ORGANIZE_NIGHTLY
    : AUTO_ORGANIZE_MANUAL;
};

export const setAutoOrganizeMode = async (chatId, mode) => {
  const next = mode === AUTO_ORGANIZE_NIGHTLY ? AUTO_ORGANIZE_NIGHTLY : AUTO_ORGANIZE_MANUAL;
  await db.chats.update(chatId, { privateAreaAutoOrganize: next });
  return next;
};

const buildCreationPrompt = ({ character, historyText, allowSkip }) => {
  const skipRule = allowSkip
    ? `你也可以决定这次先不创建（比如你觉得现在还不到时候）。如果不创建，只输出这一行，不要输出别的：
[AREA_SKIP]

如果决定创建，`
    : '你这次必须创建，';

  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

最近的聊天内容（仅供参考你和用户的相处近况）：
${historyText || '（暂时没有聊天记录）'}

背景：每个角色都可以拥有一个只属于自己的小区域，一本只有你自己能往里写的小本子，用户只能看到里面的条目标题，想翻开正文还得你同意。这个小本子是什么，由你按自己的性格来决定（比如爱记仇的人，可能是一本记仇本；爱收集东西的人，可能是收藏册；嘴硬心软的人，可能是一本不肯让人看的小日记）。一旦定下，就不会再改。

${skipRule}严格按下面的格式输出，不要输出格式以外的任何文字：
[AREA_CREATE]
名称：（不超过8个字，是这本小本子的名字）
图标：（只能从这个列表里选一个：${AREA_ICON_NAMES.join(', ')}）
简介：（一句话，不超过30个字，用你自己的口吻说这是什么）
护食程度：（0到100的整数。数值越高，越不愿意让用户翻开看。按你的性格如实给，比如嘴硬爱面子的人给得高，坦率温柔的人给得低）
拒绝话术：
1. （用户想翻开正文、而你这次不同意时，你会说的一句话）
2. ...
（一共写8条，每条一句，每条不超过30个字，语气各不相同但都符合你的性格）

要求：
- 全程使用你的人设口吻，不要提到"系统""设定""AI""概率"这类词。
- 不要使用任何emoji或颜文字。`;
};

// 让角色按人设发明区域并落库。
// 返回 { status }：
//   'created'  area 是新建好的那一行
//   'exists'   这个聊天已经有区域了（返回已有的那一行，不会重复创建）
//   'declined' 角色这次选择先不创建
//   'failed'   接口没配置/网络出错/AI输出格式不对，什么都没写入，可以再试
export const requestAreaCreation = async ({ chatId, character, allowSkip = true }) => {
  if (!chatId || !character) return { status: 'failed' };

  const existing = await getAreaForChat(chatId);
  if (existing) return { status: 'exists', area: existing };

  if (creatingChatIds.has(chatId)) return { status: 'failed' };
  creatingChatIds.add(chatId);

  try {
    let historyText = '';
    try {
      historyText = await getRecentHistoryText(chatId, character);
    } catch (error) {
      console.warn('[characterArea] 读取最近聊天失败，改用空历史：', error);
    }

    const prompt = buildCreationPrompt({ character, historyText, allowSkip });
    const rawText = await callSingleCompletion(prompt, { temperature: 0.95 });

    if (!rawText) return { status: 'failed' };

    const parsed = parseAreaCreationOutput(rawText, { allowSkip });

    if (parsed.kind === 'skip') return { status: 'declined' };
    if (parsed.kind !== 'create') return { status: 'failed' };

    const row = {
      chatId,
      characterId: character.id,
      name: parsed.area.name,
      icon: parsed.area.icon,
      intro: parsed.area.intro,
      refuseProb: parsed.area.refuseProb,
      refusalLines: parsed.area.refusalLines,
      lastOrganizedAt: null,
      createdAt: nowIso(),
    };

    try {
      const id = await db.characterAreas.add(row);
      return { status: 'created', area: { ...row, id } };
    } catch (error) {
      // chatId 是唯一索引：万一别处刚好同时建好了，就返回那一行。
      const again = await getAreaForChat(chatId);
      if (again) return { status: 'exists', area: again };
      throw error;
    }
  } catch (error) {
    console.warn('[characterArea] 创建区域失败：', error);
    return { status: 'failed' };
  } finally {
    creatingChatIds.delete(chatId);
  }
};