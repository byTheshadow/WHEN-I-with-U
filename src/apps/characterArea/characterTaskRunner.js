// src/apps/characterArea/characterTaskRunner.js
//
// 角色自我任务——到点执行（切片 D1）。
//
// 由 scheduledMessageService.js 现有的 60 秒调度（含切回前台补跑）顺路调用
// runDueCharacterTasks()，不新增 setInterval。检查本身只比较时间戳，不调AI，
// 真正到点的任务才发起请求。
//
// 规则（都是和用户确认过的）：
//   - 一轮最多执行 2 件，避免重新打开 App 时一下子冒出一堆消息。
//   - 错过超过 3 小时的不补跑：重复任务直接排到下一次，一次性任务标记为 missed
//     并释放名额。3 小时以内的照常补跑一次（重复任务只补一次，不会补每一次错过的）。
//   - 需要工具的任务只给"确定是只读"的 MCP 工具（见 characterTaskToolFilter.js），
//     不需要工具的任务一个工具都不给。
//   - 失败连续 3 次才算 failed：一次性任务 30 分钟后重试，重复任务等下一次。
//   - 这个聊天正在通话中就先不动，下一轮再说。
//
// 结果作为一条真正的角色消息写进聊天（metadata.source = 'character-task'），并在
// 允许时显示一条本地通知。结果卡片（用了什么工具、查到了什么）在切片 E 里加。
import db from '../../db';
import { runChatCompletionWithMcpTools } from '../../services/mcp/scheduledMcpToolBridge';
import { hasAnyLiveCall } from '../../services/callService';
import { getRecentHistoryText } from '../challenges/challengeService';
import { filterToolsForTask } from './characterTaskToolFilter';
import { TASK_KINDS } from './characterTaskParse';
import { computeNextTriggerAt, isMissed } from './characterTaskSchedule';
import { TASKS_UPDATED_EVENT } from './characterTaskPlanner';

const MAX_TASKS_PER_TICK = 2;
const MAX_FAIL_COUNT = 3;
const RETRY_DELAY_MS = 30 * 60 * 1000;
const RUNNING_STALE_MS = 10 * 60 * 1000;
const SUMMARY_LENGTH = 80;

let isRunning = false;

const dispatchTasksUpdated = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TASKS_UPDATED_EVENT, { detail: { chatId } }));
};

const extractText = (rawContent) => {
  if (typeof rawContent === 'string') return rawContent.trim();

  if (Array.isArray(rawContent)) {
    return rawContent
      .map((part) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('')
      .trim();
  }

  return '';
};

// 万一模型照着别的功能的习惯写了方括号指令，发出去之前摘掉。
const stripStrayTags = (content) =>
  String(content || '')
    .replace(/\[[A-Z][A-Z_]{2,}(?::[^\]]*)?\]/g, '')
    .trim();

const buildTaskPrompt = ({ character, userName, task, historyText }) => {
  const nowText = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const toolRule = task.needsTools
    ? '这件事需要查外部信息，你可以使用提供给你的工具去查。只做查询，不要做任何会修改、发送或删除外部内容的事。'
    : '这件事不需要查任何外部信息，凭你自己的想法说就好。';

  return `你正在扮演用户专属的数字伴侣：${character.name}。

【角色设定】
- 角色姓名：${character.name}
- 角色人设：${character.bio || '无'}
- 补充设定：${character.extraNotes || '无'}
- 用户称呼：${userName}

【当前时间】
${nowText}

【最近的聊天内容（仅供参考近况）】
${historyText || '（暂时没有聊天记录）'}

【你之前给自己安排的一件事】
${task.content}

现在到时间了。请去做这件事，然后像平时聊天一样，用你自己的口吻把结果告诉${userName}。
${toolRule}

严格要求：
1. 以角色第一人称表达，不自称 AI。
2. 不提及系统、定时器、预约、任务、小本子、API、模型或技术实现，也不要描述"调用工具"这类技术过程。
3. 不使用 Emoji，不使用 Markdown，不加标题，不加发件人前缀。
4. 只输出一条完整、自然的中文消息，控制在 150 字以内。如果查到了具体信息（比如天气），把关键的数字或结论说清楚。
5. 如果实在没查到，坦诚地说没查到，换成一句自然的关心，不要编造查到的结果。
6. 不要输出任何方括号指令。`;
};

const requestTaskMessage = async ({ chat, character, task }) => {
  const apiSetting = await db.settings.get('apiConfig');
  const apiConfig = apiSetting?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return { error: true, message: '接口还没有配置。' };
  }

  let historyText = '';
  try {
    historyText = await getRecentHistoryText(chat.id, character);
  } catch (error) {
    console.warn('[characterTask] 读取最近聊天失败，改用空历史：', error);
  }

  const userName = String(chat.userName || character.userName || '用户').trim();
  const systemPrompt = buildTaskPrompt({ character, userName, task, historyText });

  const sendRequest = async (payload) => {
    try {
      const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          error: true,
          code: `HTTP_${response.status}`,
          message: response.statusText || '请求未成功',
        };
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message;
      const content = extractText(message?.content);
      const hasToolCalls = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;

      if (!content && !hasToolCalls) {
        return { error: true, code: 'EMPTY_RESPONSE', message: 'AI 返回内容为空。' };
      }

      return { error: false, content, rawMessage: message };
    } catch (error) {
      return { error: true, code: 'NETWORK_ERROR', message: error?.message || '网络请求失败' };
    }
  };

  const requestPayload = {
    model: apiConfig.model || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请开始。' },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  };

  const response = task.needsTools
    ? await runChatCompletionWithMcpTools({
        requestPayload,
        sendRequest,
        filterTools: (tools) =>
          filterToolsForTask(tools, { chatId: chat.id, characterId: character.id }),
      })
    : await sendRequest(requestPayload);

  if (response.error) return { error: true, message: response.message || '请求失败。' };

  const content = stripStrayTags(response.content);
  if (!content) return { error: true, message: 'AI 没有给出有效的内容。' };

  return { error: false, content };
};

const deliverTaskMessage = async ({ chat, character, task, content }) => {
  const nowIso = new Date().toISOString();

  const metadata = {
    isAutoGenerated: true,
    source: 'character-task',
    taskId: task.id,
  };

  let messageId = null;

  await db.transaction('rw', db.messages, db.chats, async () => {
    messageId = await db.messages.add({
      chatId: chat.id,
      characterId: character.id,
      sender: 'character',
      type: 'text',
      content,
      metadata,
      versions: [{ type: 'text', content, metadata, timestamp: nowIso }],
      currentVersionIndex: 0,
      isRead: false,
      timestamp: nowIso,
    });

    await db.chats.update(chat.id, { updatedAt: nowIso });
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('new-local-message-inserted', { detail: { chatId: chat.id, messageId } })
    );
  }

  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    navigator.serviceWorker?.controller
  ) {
    try {
      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification(character.name || '消息提醒', {
        body: content.slice(0, 80),
        tag: `character-task-${chat.id}-${messageId}`,
        icon: '/icon-192.png',
      });
    } catch (error) {
      console.warn('[characterTask] 显示本地通知失败：', error);
    }
  }

  return messageId;
};

const recordFailure = async (task, reason, nowMs = Date.now()) => {
  const failCount = (task.failCount || 0) + 1;

  if (failCount >= MAX_FAIL_COUNT) {
    await db.characterTasks.update(task.id, { status: 'failed', failCount, failReason: reason });
  } else if (task.triggerKind === TASK_KINDS.ONCE) {
    await db.characterTasks.update(task.id, {
      status: 'pending',
      triggerAt: new Date(nowMs + RETRY_DELAY_MS).toISOString(),
      failCount,
      failReason: reason,
    });
  } else {
    // 重复任务在开始执行时就已经排好了下一次，这里只记录失败。
    await db.characterTasks.update(task.id, { failCount, failReason: reason });
  }

  dispatchTasksUpdated(task.chatId);
};

const handleMissed = async (task) => {
  if (task.triggerKind === TASK_KINDS.ONCE) {
    await db.characterTasks.update(task.id, {
      status: 'missed',
      lastResultSummary: '到点时没有打开 App，错过了。',
    });
  } else {
    await db.characterTasks.update(task.id, {
      triggerAt: computeNextTriggerAt(task, new Date()),
    });
  }

  dispatchTasksUpdated(task.chatId);
};

const executeTask = async (task) => {
  const [chat, character] = await Promise.all([
    db.chats.get(task.chatId),
    db.characters.get(task.characterId),
  ]);

  if (!chat || !character) {
    // 聊天或角色已经不存在，这个任务没有意义了。
    await db.characterTasks.delete(task.id);
    dispatchTasksUpdated(task.chatId);
    return;
  }

  if (await hasAnyLiveCall(task.chatId)) return;

  const startIso = new Date().toISOString();

  // 先占位再执行：一次性任务标记为正在执行；重复任务立刻排好下一次，
  // 这样即使中途关掉 App，也不会在下次打开时把同一次重复执行。
  if (task.triggerKind === TASK_KINDS.ONCE) {
    await db.characterTasks.update(task.id, { status: 'running', runningAt: startIso });
  } else {
    await db.characterTasks.update(task.id, {
      triggerAt: computeNextTriggerAt(task, new Date()),
    });
  }

  let result;
  try {
    result = await requestTaskMessage({ chat, character, task });
  } catch (error) {
    result = { error: true, message: error?.message || '执行出错。' };
  }

  if (result.error) {
    await recordFailure(task, result.message);
    return;
  }

  try {
    await deliverTaskMessage({ chat, character, task, content: result.content });
  } catch (error) {
    await recordFailure(task, error?.message || '写入聊天失败。');
    return;
  }

  const patch = {
    lastRunAt: startIso,
    lastResultSummary: result.content.slice(0, SUMMARY_LENGTH),
    failCount: 0,
    failReason: '',
  };

  if (task.triggerKind === TASK_KINDS.ONCE) patch.status = 'done';

  await db.characterTasks.update(task.id, patch);
  dispatchTasksUpdated(task.chatId);
};

export const runDueCharacterTasks = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const nowMs = Date.now();
    const candidates = await db.characterTasks.where('status').anyOf('pending', 'running').toArray();

    if (candidates.length === 0) return;

    // 上次执行到一半 App 就被关掉了的一次性任务：按失败处理（会安排重试）。
    for (const task of candidates) {
      if (
        task.status === 'running' &&
        nowMs - Date.parse(task.runningAt || 0) > RUNNING_STALE_MS
      ) {
        // eslint-disable-next-line no-await-in-loop
        await recordFailure(task, '上次执行没有完成。', nowMs);
      }
    }

    const due = candidates
      .filter((task) => task.status === 'pending' && Date.parse(task.triggerAt) <= nowMs)
      .sort((a, b) => Date.parse(a.triggerAt) - Date.parse(b.triggerAt));

    const toRun = [];

    for (const task of due) {
      if (isMissed(task, nowMs)) {
        // eslint-disable-next-line no-await-in-loop
        await handleMissed(task);
      } else {
        toRun.push(task);
      }
    }

    for (const task of toRun.slice(0, MAX_TASKS_PER_TICK)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await executeTask(task);
      } catch (error) {
        console.warn(`[characterTask] 执行任务失败 taskId=${task.id}：`, error);
      }
    }
  } catch (error) {
    console.warn('[characterTask] 检查到期任务失败：', error);
  } finally {
    isRunning = false;
  }
};