// src/apps/characterArea/privateAreaSession.js
//
// 角色专属区域——"整理"这一次单独的AI调用（切片 C）。三个入口共用这一个函数：
//   - 'tag'     主聊天里角色写了 [PRIVATE_WANT]（aiService.js 在回复写入后触发）
//   - 'manual'  用户在区域页点"整理一下"/"请 TA 整理一下"
//   - 'nightly' 夜间自动整理（privateAreaNightlyScheduler.js）
//
// 整理做的事：
//   1. 这个聊天还没有区域：先让角色按人设决定要不要创建（允许角色这次先不创建，
//      手动、夜间、标签三个入口都一样）；创建成功就接着往下写条目。
//   2. 已经有区域：回顾最近聊天，写 0 到 3 条新条目（写不写、写什么都由角色定）。
//
// 写进去的每一条条目都自带 2 到 4 个关键词，注入聊天时拿来匹配最近的聊天文字
// （见 characterAreaInjection.js）。整个过程不弹窗、不打断，写完发一个
// 'character-area-updated' 事件，区域页如果开着就自己刷新。
//
// 同一个聊天同一时刻只跑一个整理，重复触发直接返回 busy。
import db from '../../db';
import { callSingleCompletion, getRecentHistoryText } from '../challenges/challengeService';
import { getAreaForChat, requestAreaCreation } from './characterAreaService';
import { getAreaEntries } from './characterAreaEntryService';
import { parseOrganizeOutput, MAX_ENTRIES_PER_ORGANIZE } from './characterAreaOrganizeParse';
import { buildTaskPromptSection, applyTaskOutput } from './characterTaskPlanner';

export const AREA_UPDATED_EVENT = 'character-area-updated';

const EXISTING_TITLES_FOR_PROMPT = 12;

const runningChatIds = new Set();

const nowIso = () => new Date().toISOString();

const dispatchAreaUpdated = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AREA_UPDATED_EVENT, { detail: { chatId } }));
};

const buildOrganizePrompt = ({ character, area, historyText, existingTitles }) => {
  const existingText = existingTitles.length
    ? existingTitles.map((title) => `- ${title}`).join('\n')
    : '（目前一条都还没有）';

  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你有一个只属于自己的小本子「${area.name}」${area.intro ? `（${area.intro}）` : ''}。这里面记的是你自己的小心思：用户只能看到每一条的标题，想翻开正文得你同意，所以你可以写真实的想法。

最近的聊天内容：
${historyText || '（暂时没有聊天记录）'}

你已经记下的条目标题（不要重复写同样的内容）：
${existingText}

现在请回顾一下最近的相处，想想有没有什么是你想私下记进小本子里的，要符合这个小本子的性格。大多数时候不需要每次都写，没有想写的就不写。

如果这次没有想写的，只输出这一行，不要输出别的：
[NO_ACTION]

如果想写，写 1 到 ${MAX_ENTRIES_PER_ORGANIZE} 条，严格按下面的格式输出，每条之间空一行，不要输出格式以外的任何文字：
[ENTRY]
标题：（不超过12个字，用户会直接看到这个标题）
关于：（这条主要是关于谁或什么事，不超过8个字，可以留空）
关键词：（2到4个词，用逗号隔开。以后聊天里出现这些词时，你会想起这一条）
正文：（用第一人称，像真的随手记下来的一样，不超过150字，可以换行）
[/ENTRY]

要求：
- 全程使用你的人设口吻，不要提到"系统""设定""AI""概率"这类词。
- 不要使用任何emoji或颜文字。`;
};

const organizeArea = async ({ chatId, character, area }) => {
  let historyText = '';
  try {
    historyText = await getRecentHistoryText(chatId, character);
  } catch (error) {
    console.warn('[characterArea] 读取最近聊天失败，改用空历史：', error);
  }

  const existingEntries = await getAreaEntries(chatId);
  const existingTitles = existingEntries.slice(0, EXISTING_TITLES_FOR_PROMPT).map((e) => e.title);

   let taskSection = '';
  try {
    taskSection = await buildTaskPromptSection({ chatId, character });
  } catch (error) {
    console.warn('[privateAreaSession] build task section failed', error);
  }
  const prompt = `${buildOrganizePrompt({ character, area, historyText, existingTitles })}${taskSection}`;
  const rawText = await callSingleCompletion(prompt, { temperature: 0.9 });

  if (!rawText) return { ok: false, entriesAdded: 0 };

  const parsed = parseOrganizeOutput(rawText);

  let taskResult = { applied: 0 };
  try {
    taskResult = await applyTaskOutput({ chatId, character, rawText });
  } catch (error) {
    console.warn('[privateAreaSession] apply task output failed', error);
  }
  if (parsed.kind === 'invalid' && taskResult.applied === 0) return { ok: false, entriesAdded: 0 };

  await db.characterAreas.update(area.id, { lastOrganizedAt: nowIso() });

  if (parsed.kind !== 'entries') return { ok: true, entriesAdded: 0 };

  const knownTitles = new Set(existingEntries.map((entry) => entry.title.trim().toLowerCase()));
  const baseTime = Date.now();

  const rows = parsed.entries
    .filter((entry) => !knownTitles.has(entry.title.trim().toLowerCase()))
    .map((entry, index) => ({
      chatId,
      areaId: area.id,
      title: entry.title,
      aboutWho: entry.aboutWho,
      keywords: entry.keywords,
      content: entry.content,
      // 同一批里后写的略晚一点，保证"最新的在前"的排序稳定。
      createdAt: new Date(baseTime + index).toISOString(),
    }));

  if (rows.length > 0) {
    await db.characterAreaEntries.bulkAdd(rows);
    dispatchAreaUpdated(chatId);
  }

  return { ok: true, entriesAdded: rows.length };
};

// 返回 { status, area?, entriesAdded }：
//   'created'   这个聊天原本没有区域，这次新建了（可能顺带写了条目，看 entriesAdded）
//   'organized' 已有区域，这次写了 entriesAdded 条新条目
//   'nothing'   已有区域，角色这次没有想写的
//   'declined'  还没有区域，角色这次选择先不创建
//   'busy'      这个聊天已经有一次整理在跑了
//   'failed'    接口没配置/网络出错/AI输出格式不对，没有写入任何东西，可以再试
export const runPrivateAreaSession = async ({ chatId, character, source = 'manual' }) => {
  if (!chatId || !character) return { status: 'failed', entriesAdded: 0 };

  if (runningChatIds.has(chatId)) return { status: 'busy', entriesAdded: 0 };
  runningChatIds.add(chatId);

  try {
    let area = await getAreaForChat(chatId);
    let justCreated = false;

    if (!area) {
      const creation = await requestAreaCreation({ chatId, character, allowSkip: true });

      if (creation.status === 'declined') return { status: 'declined', entriesAdded: 0 };

      if (creation.status !== 'created' && creation.status !== 'exists') {
        return { status: 'failed', entriesAdded: 0 };
      }

      area = creation.area;
      justCreated = creation.status === 'created';
    }

    const organized = await organizeArea({ chatId, character, area });

    if (justCreated) {
      // 区域已经建好了，整理这一步失败也不算整体失败，条目下次再写。
      dispatchAreaUpdated(chatId);
      return { status: 'created', area, entriesAdded: organized.entriesAdded };
    }

    if (!organized.ok) return { status: 'failed', area, entriesAdded: 0 };

    return {
      status: organized.entriesAdded > 0 ? 'organized' : 'nothing',
      area,
      entriesAdded: organized.entriesAdded,
    };
  } catch (error) {
    console.warn(`[characterArea] 整理失败（来源：${source}）：`, error);
    return { status: 'failed', entriesAdded: 0 };
  } finally {
    runningChatIds.delete(chatId);
  }
};