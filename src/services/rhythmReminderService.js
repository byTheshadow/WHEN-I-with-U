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
  if (!saved?.value) return 1;

  try {
    const now = new Date();
    const start = new Date(saved.value);
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffTime = now - start;
    if (diffTime < 0) return 1;

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  } catch {
    return 1;
  }
};

/**
 * 触发基于日程和 Todo 的 AI 贴心主动提醒与问候
 */
export async function triggerRhythmActiveReminder(chatId, character, force = false) {
  if (!character || !chatId) {
    return { status: 'no_character_or_chat' };
  }

  // 1. 冷却检查（4小时冷却限制）
  const now = Date.now();
  const COOLDOWN_MS = 4 * 60 * 60 * 1000;
  const lastTimeSetting = await db.settings.get('lastRhythmReminderTime');
  const lastTime = lastTimeSetting ? Number(lastTimeSetting.value) : 0;

  if (!force && now - lastTime < COOLDOWN_MS) {
    return { status: 'cooldown' };
  }

  // 2. 读取 API 配置
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return { status: 'no_api_config' };
  }

  // 3. 收集未完成待办
  const overdueTodos = await db.todos
    .where('isCompleted')
    .equals(0)
    .toArray();

  const pendingTodos = overdueTodos.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d <= now;
  });

  // 4. 收集用户日程
  const todayDayOfWeek = new Date().getDay() || 7;
  const currentWeek = await getCurrentWeekNum();
  const currentHHMM = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const todayDateStr = new Date().toISOString().split('T')[0];

  const allSchedules = await db.schedules
    .where('characterId')
    .equals(character.id)
    .toArray();

  const activeSchedules = allSchedules.filter((s) => {
    if (s.isRepeating) {
      const dowMatches = Number(s.dayOfWeek) === todayDayOfWeek;

      if (s.category === 'course') {
        return (
          dowMatches &&
          Array.isArray(s.weeks) &&
          s.weeks.includes(currentWeek)
        );
      }

      return dowMatches;
    }

    return s.date === todayDateStr;
  });

  let currentSchedule = null;
  let upcomingSchedule = null;

  activeSchedules.forEach((s) => {
    if (currentHHMM >= s.startTime && currentHHMM <= s.endTime) {
      currentSchedule = s;
    } else if (s.startTime > currentHHMM) {
      if (!upcomingSchedule || s.startTime < upcomingSchedule.startTime) {
        upcomingSchedule = s;
      }
    }
  });

  // 5. 组装 AI 上下文
  const hours = new Date().getHours();
  const periodStr = getDayPeriod(hours);

  let todoContext = '';
  if (pendingTodos.length > 0) {
    todoContext =
      '用户有待办：\n' +
      pendingTodos
        .slice(0, 2)
        .map((t) => `- ${t.title}`)
        .join('\n');
  }

  let scheduleContext = '';
  if (currentSchedule) {
    const typeTxt = currentSchedule.category === 'course' ? '课程' : '安排';

    scheduleContext =
      `用户当前正在进行《${currentSchedule.title}》这一${typeTxt}` +
      (currentSchedule.location
        ? `，地点在 ${currentSchedule.location}`
        : '') +
      '。';
  } else if (upcomingSchedule) {
    const typeTxt = upcomingSchedule.category === 'course' ? '课程' : '安排';

    scheduleContext =
      `用户预计在 ${upcomingSchedule.startTime} 开始《${upcomingSchedule.title}》这一${typeTxt}。`;
  }

  // 6. 调用 AI 接口构建 prompt
  const systemPrompt = `你是一个深爱并陪伴用户的虚拟角色「${character.name}」。
性格人设：${character.bio || '体贴细腻'}。

现在是 ${periodStr} 的 ${currentHHMM}。
${scheduleContext ? `【用户当前日程】：${scheduleContext}` : '【用户当前日程】：目前没有特定安排，属于空闲时段。'}
${todoContext ? `【用户待办提醒】：${todoContext}` : ''}

以第一人称口吻写一段简短暖心的日常寄语（50字以内）。
要求：
- 严禁使用任何 Emoji。
- 充满生活气与浪漫感，不能表现得像系统日程弹窗。
- 如果用户处于工作、通勤或课程中，送上温和叮咛或表达你在等他/她；如果有未完成待办，可以用生活化的方式关切地提起它（例如：“看见便利贴上还有事情没勾掉呢，要我陪你吗”）。
- 直接输出寄语内容，不要带有任何格式和发件人标签。`;

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ai-typing-status', {
          detail: { chatId, typing: true }
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
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.85,

        // 给兼容接口足够的输出空间，避免在句子中间结束。
        // 实际文案仍由 prompt 限制在 50 字以内。
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

       const resJson = await response.json();

    const choice = resJson?.choices?.[0];
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

    console.log('[RhythmScheduler] AI 原始回复:', {
      replyText,
      finishReason
    });

    replyText = replyText.replace(/["'“”]/g, '').trim();


      if (replyText) {
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

        // ChatRoom 实际读取的是 content。
        content: replyText,

        metadata,

        // 与普通 AI 消息保持一致。
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
    }


      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('new-local-message-inserted', {
            detail: { chatId }
          })
        );
      }

      return {
        status: 'success',
        text: replyText
      };
    }

    return {
      status: 'empty_response'
    };
  } catch (err) {
    console.error('[RhythmReminder] 触发失败:', err);

    return {
      status: 'error',
      error: err.message
    };
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ai-typing-status', {
          detail: { chatId, typing: false }
        })
      );
    }
  }
}
