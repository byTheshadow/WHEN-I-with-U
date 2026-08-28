import db from '../db';

const getDayPeriod = (hours) => {
  if (hours >= 5 && hours < 8) return '清晨';
  if (hours >= 8 && hours < 11) return '上午';
  if (hours >= 11 && hours < 13) return '中午午饭时间';
  if (hours >= 13 && hours < 17) return '下午工作学习时间';
  if (hours >= 17 && hours < 19) return '傍晚黄昏';
  if (hours >= 19 && hours < 22) return '晚上';
  return '深夜';
};

const getCurrentWeekNum = async () => {
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
    const lastTimeSetting = await db.settings.get(
      'lastRhythmReminderTime'
    );

    const lastTime = Number(lastTimeSetting?.value || 0);

    if (!force && now - lastTime < cooldownMs) {
      return {
        status: 'cooldown'
      };
    }

    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      return {
        status: 'no_api_config'
      };
    }

    const overdueTodos = await db.todos
      .where('isCompleted')
      .equals(0)
      .toArray();

    const pendingTodos = overdueTodos.filter((todo) => {
      if (!todo?.dueDate) {
        return false;
      }

      const dueDate = new Date(todo.dueDate);

      return !Number.isNaN(dueDate.getTime()) && dueDate <= now;
    });

    const currentDate = new Date();
    const todayDayOfWeek = currentDate.getDay() || 7;
    const currentWeek = await getCurrentWeekNum();

    const currentHHMM = currentDate.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const todayDateStr = currentDate.toISOString().split('T')[0];

    const allSchedules = await db.schedules
      .where('characterId')
      .equals(character.id)
      .toArray();

    const activeSchedules = allSchedules.filter((schedule) => {
      if (!schedule) {
        return false;
      }

      if (schedule.isRepeating) {
        const dayMatches =
          Number(schedule.dayOfWeek) === todayDayOfWeek;

        if (schedule.category === 'course') {
          return (
            dayMatches &&
            Array.isArray(schedule.weeks) &&
            schedule.weeks.includes(currentWeek)
          );
        }

        return dayMatches;
      }

      return schedule.date === todayDateStr;
    });

    let currentSchedule = null;
    let upcomingSchedule = null;

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

    const systemPrompt = `你是一个深爱并陪伴用户的虚拟角色「${character.name}」。
性格人设：${character.bio || '体贴细腻'}。

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
- 如果有未完成待办，可以用生活化的方式自然关切地提起它。
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
          key: 'lastRhythmReminderTime',
          value: String(now)
        });

        await db.chats.update(chatId, {
          updatedAt: nowIso
        });
      }
    );

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
