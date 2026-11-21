import db from '../db';
import { isInQuietHours } from './aiService';
import { isFocusMuted } from '../apps/focus/focusMuteState';
import { buildRhythmChatContext } from './rhythmContextService';
import { hasAnyLiveCall } from './callService';
import { maybeSendUserAutoReply } from '../apps/messages/userCard/userAutoReplyService';

// 距离上一条消息（不论发送方）多久以内，视为"用户正在这个对话里"，
// 此时不主动插入提醒消息，避免打断正在进行的对话。
const ACTIVE_CHAT_WINDOW_MS = 10 * 60 * 1000;

// 日程"刚结束"的判定窗口：结束时间在这个窗口内，就当作"刚结束"来写寄语，
// 而不是笼统地说"目前空闲"。跟本地调度器 3 分钟一次的扫描频率相比留了
// 足够余量，避免因为扫描没扫准而错过这个窗口。
const RECENTLY_ENDED_WINDOW_MINUTES = 15;

/**
 * 把 "HH:MM" 转成从 0 点开始的分钟数，方便算"距离结束过去了几分钟"。
 * 解析失败时返回 null，调用方需要自行判断。
 */
const toMinutes = (hhmm) => {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) {
    return null;
  }

  const [h, m] = hhmm.split(':').map(Number);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }

  return h * 60 + m;
};

/**
 * 拼一段轻量的"完整人设"补充文本：世界书 + 角色补充设定 + 角色眼中的用户。
 * 不复用 aiService.js 里那个面向正式回复的大 Prompt（里面混了表情包语法等
 * 跟寄语无关的指令），这里只取跟"这个人是谁、TA怎么看用户"相关的部分。
 */
export const buildRhythmPersonaBrief = async (character) => {
  const enabledWorldBooks = await db.worldBooks
    .where('isEnabled')
    .equals(1)
    .toArray();

  const worldBookPieces = enabledWorldBooks
    .map((wb) => wb.content)
    .filter((content) => typeof content === 'string' && content.trim());

  if (character?.worldBook && character.worldBook.trim()) {
    worldBookPieces.push(character.worldBook.trim());
  }

  const worldBookText = worldBookPieces.length > 0
    ? `\n【世界背景设定】：${worldBookPieces.join('；')}`
    : '';

  const extraNotesText = character?.extraNotes && character.extraNotes.trim()
    ? `\n【角色补充设定】：${character.extraNotes.trim()}`
    : '';

  return { worldBookText, extraNotesText };
};

/**
 * 取角色最近一条"平行轨迹"记录，仅提炼成一句背景氛围参考，
 * 不做具体引用——寄语只应该"带着这份心情"，不应该"复述这件事"。
 */
const buildOrbitFlavorContext = async (chatId) => {
  try {
    const orbitLogs = await db.parallelOrbits
      .where('chatId')
      .equals(chatId)
      .toArray();

    if (orbitLogs.length === 0) {
      return '';
    }

    const latest = orbitLogs.reduce((a, b) => {
      const aTime = new Date(a?.timestamp || 0).getTime();
      const bTime = new Date(b?.timestamp || 0).getTime();
      return bTime > aTime ? b : a;
    });

    const pieces = [
      latest?.activity,
      latest?.thoughts,
      latest?.weather,
      latest?.location
    ].filter((value) => typeof value === 'string' && value.trim());

    return pieces.join('；');
  } catch (err) {
    console.warn('[RhythmReminder] 读取平行轨迹背景失败:', err);
    return '';
  }
};

const getDayPeriod = (hours) => {
  if (hours >= 5 && hours < 8) return '清晨';
  if (hours >= 8 && hours < 11) return '上午';
  if (hours >= 11 && hours < 13) return '中午午饭时间';
  if (hours >= 13 && hours < 17) return '下午工作学习时间';
  if (hours >= 17 && hours < 19) return '傍晚黄昏';
  if (hours >= 19 && hours < 22) return '晚上';
  return '深夜';
};

export const getCurrentWeekNum = async () => {
  const saved = await db.settings.get('term_start_date');

  if (!saved?.value) {
    return 1;
  }

  try {
    const now = new Date();
    const start = new Date(saved.value);

    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffTime = now - start;

    if (diffTime < 0) {
      return 1;
    }

    const diffDays = Math.floor(
      diffTime / (1000 * 60 * 60 * 24)
    );

    return Math.floor(diffDays / 7) + 1;
  } catch {
    return 1;
  }
};

/**
 * 基于日程和 Todo 触发 AI 主动提醒。
 */
export async function triggerRhythmActiveReminder(
  chatId,
  character,
  force = false
) {
  if (!character || !chatId) {
    return {
      status: 'no_character_or_chat'
    };
  }

  const now = Date.now();
  const cooldownMs = 4 * 60 * 60 * 1000;

  try {
    const chat = await db.chats.get(chatId);

    // 寄语现在是每个聊天窗独立的开关，跟角色的其他 AI 主动行为
    // （平行轨迹独白、快照等共用的 isAutoMessageActive）解耦。
    // 未设置时默认视为开启，避免老用户升级后被无声关闭。
    // 用户正在专注（或刚结束的缓冲期）：不发寄语。
    if (isFocusMuted(chat)) {
      return {
        status: 'focus_muted'
      };
    }

    if (chat?.rhythmEnabled === false) {
      return {
        status: 'rhythm_disabled_for_chat'
      };
    }

    // 这个聊天窗正在通话中（响铃/进行中）时，不要在 chatroom 里插入寄语，
    // 只暂停这一个聊天窗，不影响其他聊天窗的寄语调度。
    if (await hasAnyLiveCall(chatId)) {
      return {
        status: 'chat_on_live_call'
      };
    }

       const cooldownKey = `lastRhythmReminderTime_${character.id}`;
    const lastTimeSetting = await db.settings.get(cooldownKey);
    const lastTime = Number(lastTimeSetting?.value || 0);

    if (!force && now - lastTime < cooldownMs) {
      return {
        status: 'cooldown'
      };
    }

    // 用户设定的全局勿扰时段：命中则不主动发送。
    const quietHoursSetting = await db.settings.get('quietHours');

    if (isInQuietHours(quietHoursSetting?.value)) {
      return {
        status: 'quiet_hours'
      };
    }

    // 用户最近仍在这个对话里活动（不论是谁发的最后一条），
    // 此时插入一条不相关的主动提醒会显得很突兀，先跳过。
    const recentMessages = await db.messages
      .where('chatId')
      .equals(chatId)
      .toArray();

    let lastMessage = null;

    for (const msg of recentMessages) {
      const msgTime = new Date(msg?.timestamp || 0).getTime();

      if (
        Number.isFinite(msgTime) &&
        (!lastMessage || msgTime > lastMessage.time)
      ) {
        lastMessage = { time: msgTime };
      }
    }

    if (lastMessage && now - lastMessage.time < ACTIVE_CHAT_WINDOW_MS) {
      return {
        status: 'chat_recently_active'
      };
    }

    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return {
        status: 'no_api_config'
      };
    }

        // 兼容 isCompleted 为 0 或 false 的情况
    const allTodos = await db.todos.toArray();
    const pendingTodos = allTodos.filter((todo) => {
      const isDone = todo?.isCompleted === true || todo?.isCompleted === 1;
      if (isDone || !todo?.dueDate) return false;
      const dueDate = new Date(todo.dueDate);
      return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() <= now;
    });

    const currentDate = new Date();
    const todayDayOfWeek = currentDate.getDay() || 7;
    const currentWeek = await getCurrentWeekNum();

    const pad = (n) => String(n).padStart(2, '0');
    // 本地安全 YYYY-MM-DD
    const todayDateStr = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(currentDate.getDate())}`;
    const currentHHMM = `${pad(currentDate.getHours())}:${pad(currentDate.getMinutes())}`;

    const allSchedules = await db.schedules
      .where('characterId')
      .equals(character.id)
      .toArray();

    const activeSchedules = allSchedules.filter((schedule) => {
      if (!schedule) return false;

      // 1. 每周重复日程
      if (schedule.isRepeating) {
        const dayMatches = Number(schedule.dayOfWeek) === todayDayOfWeek;
        if (!dayMatches) return false;

        // 如果是学生课程，必须同时满足当前学周匹配
        if (schedule.category === 'course') {
          return Array.isArray(schedule.weeks) && schedule.weeks.includes(currentWeek);
        }
        return true;
      }

      // 2. 单次日程：必须严格等于今天的本地自然日，绝不允许跨周或过期提醒
      return schedule.date === todayDateStr;
    });


    let currentSchedule = null;
    let upcomingSchedule = null;

    // "刚结束"的日程：不是正在进行、也不是接下来的，而是结束时间
    // 落在 RECENTLY_ENDED_WINDOW_MINUTES 分钟以内的那一项。
    // 只在没有 currentSchedule 时才有意义，用来把寄语从"目前空闲"
    // 变成"哦你刚下课/下班啦"这种更贴合当下的反应。
    let recentlyEndedSchedule = null;
    let recentlyEndedMinutesAgo = null;

    const currentMinutes = toMinutes(currentHHMM);

    activeSchedules.forEach((schedule) => {
      if (!schedule.startTime || !schedule.endTime) {
        return;
      }

      if (
        currentHHMM >= schedule.startTime &&
        currentHHMM <= schedule.endTime
      ) {
        currentSchedule = schedule;
        return;
      }

      if (schedule.startTime > currentHHMM) {
        if (
          !upcomingSchedule ||
          schedule.startTime < upcomingSchedule.startTime
        ) {
          upcomingSchedule = schedule;
        }
        return;
      }

      // 走到这里说明这项日程今天已经结束了，判断是不是"刚刚"结束。
      const endMinutes = toMinutes(schedule.endTime);

      if (currentMinutes == null || endMinutes == null) {
        return;
      }

      const minutesSinceEnd = currentMinutes - endMinutes;

      if (
        minutesSinceEnd >= 0 &&
        minutesSinceEnd <= RECENTLY_ENDED_WINDOW_MINUTES &&
        (recentlyEndedMinutesAgo === null ||
          minutesSinceEnd < recentlyEndedMinutesAgo)
      ) {
        recentlyEndedSchedule = schedule;
        recentlyEndedMinutesAgo = minutesSinceEnd;
      }
    });

    const periodStr = getDayPeriod(currentDate.getHours());

    let todoContext = '';

    if (pendingTodos.length > 0) {
      todoContext =
        '用户有待办：\n' +
        pendingTodos
          .slice(0, 2)
          .map((todo) => `- ${todo.title || '未命名待办'}`)
          .join('\n');
    }

    let scheduleContext = '';
    let isRecentlyEndedEvent = false;

    if (currentSchedule) {
      const typeText =
        currentSchedule.category === 'course'
          ? '课程'
          : '安排';

      scheduleContext =
        `用户当前正在进行《${
          currentSchedule.title || '一项安排'
        }》这一${typeText}` +
        (currentSchedule.location
          ? `，地点在 ${currentSchedule.location}`
          : '') +
        '。';
    } else if (recentlyEndedSchedule) {
      const typeText =
        recentlyEndedSchedule.category === 'course'
          ? '课程'
          : '安排';

      isRecentlyEndedEvent = true;

      scheduleContext =
        `用户大概 ${recentlyEndedMinutesAgo} 分钟前刚结束《${
          recentlyEndedSchedule.title || '一项安排'
        }》这一${typeText}，现在应该刚脱身出来。`;
    } else if (upcomingSchedule) {
      const typeText =
        upcomingSchedule.category === 'course'
          ? '课程'
          : '安排';

      scheduleContext =
        `用户预计在 ${upcomingSchedule.startTime} 开始《${
          upcomingSchedule.title || '一项安排'
        }》这一${typeText}。`;
    }

    const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);

    const userPersonaText = (chat?.userPersona || character.userPersona || '').trim();
    const userPersonaContext = userPersonaText
      ? `\n【角色眼中的用户】：${userPersonaText}`
      : '';

    const orbitFlavor = await buildOrbitFlavorContext(chatId);
    const orbitContext = orbitFlavor
      ? `\n【角色近期私下生活的一点心情底色，只用来感受氛围，绝不能在寄语里直接提及、复述或暗示具体内容】：${orbitFlavor}`
      : '';

       // 最近的对话、阶段摘要、记忆：让寄语能和刚刚的聊天接上，不再割裂
    const chatContext = await buildRhythmChatContext({ chatId, chat, character });

    const systemPrompt = `你是一个深爱并陪伴用户的虚拟角色「${character.name}」。
性格人设：${character.bio || '体贴细腻'}。${worldBookText}${extraNotesText}${userPersonaContext}${orbitContext}${chatContext}

现在是 ${periodStr} 的 ${currentHHMM}。
${
  scheduleContext
    ? `【用户当前日程】：${scheduleContext}`
    : '【用户当前日程】：目前没有特定安排，属于空闲时段。'
}
${todoContext ? `【用户待办提醒】：${todoContext}` : ''}

以第一人称口吻写一段简短暖心的日常寄语，控制在 50 字以内。

要求：
- 严禁使用任何 Emoji。
- 充满生活气与浪漫感，不能表现得像系统日程弹窗。
- 如果用户处于工作、通勤或课程中，送上温和叮咛或表达你在等他或她。
${
  isRecentlyEndedEvent
    ? '- 用户刚从上面提到的安排里出来，写得像"啊你出来啦"这种自然反应——可以问问累不累、顺不顺利，不要用"提醒"的语气复述这件事本身。'
    : ''
}
${
  chatContext
    ? '- 上面有你们最近的对话，寄语要像接着刚才聊的说下去，和它自然衔接，不要复述聊天原文，也不要表现得像忘了刚才发生的事。\n- 如果最近聊的是沉重、具体或情绪明显的事，请顺着那份情绪说话，不要硬转成日程叮咛或日常客套；日程和待办只在确实自然时带一句，也可以完全不提。'
    : ''
}
- 你自己也有独立的生活，语气里可以自然带一点"我这边也在过我的日子，同时想着你"的味道，但不要具体交代自己在做什么、在哪、和谁在一起。
- 不要提及系统、日程表、提醒、API、模型、定时器或任何技术实现。
- 直接输出完整寄语内容，不要带格式、标题、发件人标签或 Markdown。`;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ai-typing-status', {
          detail: {
            chatId,
            typing: true
          }
        })
      );
    }

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ],
        temperature: 0.85,

        // 给兼容 API 足够输出空间，避免中文句子中途截断。
        // 实际字数仍由 Prompt 限制在 50 字以内。
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(
        `API 请求失败：${response.status} ${response.statusText}`
      );
    }

    const responseData = await response.json();
    const choice = responseData?.choices?.[0];
    const finishReason = choice?.finish_reason;

    let replyText = String(
      choice?.message?.content || ''
    ).trim();

    if (finishReason === 'length') {
      console.warn(
        '[RhythmScheduler] AI 输出达到长度限制，可能是不完整内容。',
        {
          finishReason,
          replyText
        }
      );
    }

    console.log('[RhythmScheduler] AI 原始回复：', {
      replyText,
      finishReason
    });

    replyText = replyText.replace(/["'“”]/g, '').trim();

    if (!replyText) {
      return {
        status: 'empty_response'
      };
    }

    const nowIso = new Date().toISOString();

    const metadata = {
      isAutoGenerated: true,
      source: 'rhythm-reminder'
    };

    const messagePayload = {
      chatId,
      characterId: character.id,
      sender: 'character',
      type: 'text',

      // ChatRoom 使用 message.content 渲染文本。
      // 缺少此字段会导致出现空气泡。
      content: replyText,

      metadata,

      // 与普通 AI 回复使用一致的版本结构。
      versions: [
        {
          type: 'text',
          content: replyText,
          metadata,
          timestamp: nowIso
        }
      ],
      currentVersionIndex: 0,

      isRead: false,
      timestamp: nowIso
    };

    let messageId = null;

    await db.transaction(
      'rw',
      db.messages,
      db.settings,
      db.chats,
      async () => {
        messageId = await db.messages.add(messagePayload);

               await db.settings.put({
          key: `lastRhythmReminderTime_${character.id}`,
          value: String(now)
        });


        await db.chats.update(chatId, {
          updatedAt: nowIso
        });
      }
    );

    // 记忆整理是独立、延迟、非阻塞的后台任务，跟普通 AI 回复走同一套流程，
    // 这样寄语也会被记住，而不是发完就飘走。
    void scheduleMemoryProcessing(chatId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('new-local-message-inserted', {
          detail: {
            chatId,
            messageId
          }
        })
      );
    }

        // 用户把状态设为"暂时不在线"并开着自动回复时，寄语之后补发一条自动回复。
    void maybeSendUserAutoReply({ chatId, characterId: character.id });

    return {
      status: 'success',
      messageId,
      text: replyText
    };
  } catch (error) {
    console.error('[RhythmReminder] 触发失败：', error);

    return {
      status: 'error',
      error: error?.message || 'unknown_error'
    };
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ai-typing-status', {
          detail: {
            chatId,
            typing: false
          }
        })
      );
    }
  }
}