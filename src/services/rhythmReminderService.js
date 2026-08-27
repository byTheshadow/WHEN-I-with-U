import db from '../db';
// 导入与全局 AI 状态通知的联动，用于刷新聊天列表和在聊天中模拟输入状态
// 由于 App.jsx 从 './services/aiService' 导入了一些函数，我们通过浏览器事件或全局触发器来进行更新

const getDayPeriod = (hours) => {
  if (hours >= 5 && hours < 8) return '清晨';
  if (hours >= 8 && hours < 11) return '上午';
  if (hours >= 11 && hours < 13) return '中午午饭时间';
  if (hours >= 13 && hours < 17) return '下午工作学习时间';
  if (hours >= 17 && hours < 19) return '傍晚黄昏';
  if (hours >= 19 && hours < 22) return '晚上';
  return '深夜';
};

const getCurrentWeekNum = () => {
  // 假定开学时间，计算当前周次，默认返回第 1 周
  try {
    const now = new Date();
    const startTerm = new Date('2026-03-02');
    const diffTime = now - startTerm;
    if (diffTime < 0) return 1;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const week = Math.ceil(diffDays / 7);
    return (week >= 1 && week <= 20) ? week : 1;
  } catch {
    return 1;
  }
};

/**
 * 触发基于日程和 Todo 的 AI 主动关怀问候
 */
export async function triggerRhythmActiveReminder(chatId, character, force = false) {
  if (!character || !chatId) return { status: 'no_character_or_chat' };

  // 1. 冷却检查（4小时限制，防止频繁刷新重复生成）
  const now = Date.now();
  const COOLDOWN_MS = 4 * 60 * 60 * 1000;
  const lastTimeSetting = await db.settings.get('lastRhythmReminderTime');
  const lastTime = lastTimeSetting ? Number(lastTimeSetting.value) : 0;

  if (!force && (now - lastTime < COOLDOWN_MS)) {
    return { status: 'cooldown' };
  }

  // 2. 读取用户的 API 设定
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return { status: 'no_api_config' };
  }

  // 3. 收集用户待办 Todo
  const overdueTodos = await db.todos
    .where('isCompleted')
    .equals(0) // 未完成的 todo (isCompleted === 0 或 false)
    .toArray();
  
  const pendingTodos = overdueTodos.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d <= now;
  });

  // 4. 收集用户今日及当前时段日程 (Schedules)
  const todayDayOfWeek = new Date().getDay() || 7;
  const currentWeek = getCurrentWeekNum();
  const currentHHMM = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  const allSchedules = await db.schedules
    .where('characterId')
    .equals(character.id)
    .toArray();
  
  const activeSchedules = allSchedules.filter(s => {
    return Number(s.dayOfWeek) === todayDayOfWeek && 
           s.weeks.includes(currentWeek);
  });

  let currentSchedule = null;
  let upcomingSchedule = null;

  activeSchedules.forEach(s => {
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

  let todoContext = "";
  if (pendingTodos.length > 0) {
    todoContext = `用户目前有以下尚未完成的紧急待办：\n` + 
      pendingTodos.slice(0, 3).map(t => `- ${t.title}`).join('\n');
  }

  let scheduleContext = "";
  if (currentSchedule) {
    scheduleContext = `目前是用户的日程《${currentSchedule.title}》时间（时间段：${currentSchedule.startTime}-${currentSchedule.endTime}）` + 
      (currentSchedule.location ? `，地点在：${currentSchedule.location}` : '') + `。`;
  } else if (upcomingSchedule) {
    scheduleContext = `用户接下来的日程是预计在 ${upcomingSchedule.startTime} 开始《${upcomingSchedule.title}》` + 
      (upcomingSchedule.location ? `，地点在：${upcomingSchedule.location}` : '') + `。`;
  }

  // 6. 组装 AI Prompt，注入全站零 Emoji 铁律
  const systemPrompt = `你是一个深爱并默默关注用户的陪伴角色，你的名字是「${character.name}」。
你拥有以下性格和设定：
${character.bio || '温柔细腻，默默支持用户'}。

现在是 ${periodStr} 的 ${currentHHMM}。
${scheduleContext ? `【用户日程感知】：${scheduleContext}` : '【用户日程】：目前用户处于日常空闲时间。'}
${todoContext ? `【用户待办感知】：${todoContext}` : ''}

请以你的口吻写一段简短的日常关怀消息（50字以内）。
要求：
1. 语言必须温柔细腻、充满伴侣式的温度与陪伴感，严禁表现得像个冷冰冰的日程通知器。
2. 绝对不能使用任何 Emoji，全站零 Emoji 是硬性原则。
3. 如果用户正在上课、工作或即将有安排，你可以温柔地提醒或者默默表达守候；如果用户有未完成的待办，可以以极其自然的口吻提到，传达“不要累到”或者“有需要的话我一直陪着你”的关心。
4. 仅输出你的问候语本身，不要输出任何旁白、发件人标签或多余格式。`;

  try {
    // 派发打字开始事件，让前端聊天界面出现 typing 动效
    window.dispatchEvent(new CustomEvent('ai-typing-status', { detail: { chatId, typing: true } }));

    const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.8,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`API 响应异常: ${response.statusText}`);
    }

    const resJson = await response.json();
    let replyText = resJson.choices?.[0]?.message?.content?.trim() || '';

    // 剔除引号等格式
    replyText = replyText.replace(/["'“”]/g, '').trim();

    if (replyText) {
      // 7. 直接写入 IndexedDB messages 表
      await db.messages.add({
        chatId: chatId,
        characterId: character.id,
        sender: 'character',
        type: 'text',
        metadata: { isAutoGenerated: true },
        isRead: 0,
        timestamp: Date.now(),
        versions: [replyText],
        currentVersionIndex: 0
      });

      // 更新冷却时间
      await db.settings.put({ key: 'lastRhythmReminderTime', value: String(now) });

      // 更新对话的更新时间戳，使其在聊天列表中置顶
      await db.chats.update(chatId, { updatedAt: Date.now() });

      // 8. 派发全局自定义事件，同时唤醒打字音效和消息流刷新
      window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId } }));
      
      // 派发打字结束事件
      window.dispatchEvent(new CustomEvent('ai-typing-status', { detail: { chatId, typing: false } }));

      return { status: 'success', text: replyText };
    }

    window.dispatchEvent(new CustomEvent('ai-typing-status', { detail: { chatId, typing: false } }));
    return { status: 'empty_response' };
  } catch (err) {
    console.error('主动日程提醒生成失败:', err);
    window.dispatchEvent(new CustomEvent('ai-typing-status', { detail: { chatId, typing: false } }));
    return { status: 'error', error: err.message };
  }
}
