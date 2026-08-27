import db from '../db';

// 简易的中文分段辅助：判断当前时刻处于什么生活时段
const getDayPeriod = (hours) => {
  if (hours >= 5 && hours < 8) return '清晨';
  if (hours >= 8 && hours < 11) return '上午';
  if (hours >= 11 && hours < 13) return '中午午饭时间';
  if (hours >= 13 && hours < 17) return '下午工作学习时间';
  if (hours >= 17 && hours < 19) return '傍晚黄昏';
  if (hours >= 19 && hours < 22) return '晚上';
  return '深夜';
};

// 获取当前的学期周次（简单设定自2026年开学以来的周数，你也可以支持在配置中修改）
const getCurrentWeekNum = () => {
  // 假设 2026 年春季学期开学是 2026-03-02，这里做一个合理计算，或者默认返回 1 代表当前周次
  const now = new Date();
  const startTerm = new Date('2026-03-02');
  const diffTime = Math.abs(now - startTerm);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.ceil(diffDays / 7);
  return (week >= 1 && week <= 20) ? week : 1;
};

/**
 * 触发基于日程和 Todo 的 AI 贴心主动消息
 * @param {number} chatId 会话ID
 * @param {object} character 陪伴角色对象
 * @param {boolean} force 是否跳过4小时冷却强制触发 (用于调试)
 */
export async function triggerRhythmActiveReminder(chatId, character, force = false) {
  if (!character) return { status: 'no_character' };

  // 1. 冷却检查（4小时限制）
  const now = Date.now();
  const COOLDOWN_MS = 4 * 60 * 60 * 1000;
  const lastTimeSetting = await db.settings.get('lastRhythmReminderTime');
  const lastTime = lastTimeSetting ? Number(lastTimeSetting.value) : 0;

  if (!force && (now - lastTime < COOLDOWN_MS)) {
    return { status: 'cooldown' };
  }

  // 2. 读取 API 设定
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};
  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return { status: 'no_api_config' };
  }

  // 3. 收集用户 Todo
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const overdueTodos = await db.todos
    .where('isCompleted')
    .equals(0) // 未完成
    .toArray();
  
  // 筛选出今天或之前截止的 Todo
  const pendingTodos = overdueTodos.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d <= now;
  });

  // 4. 收集用户今日及当前时段日程 (Schedules)
  const todayDayOfWeek = new Date().getDay() || 7; // 1-7
  const currentWeek = getCurrentWeekNum();
  const currentHHMM = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  const todaySchedules = await db.schedules
    .where('characterId')
    .equals(character.id)
    .toArray();
  
  const activeSchedules = todaySchedules.filter(s => {
    return s.dayOfWeek === todayDayOfWeek && 
           s.weeks.includes(currentWeek);
  });

  // 寻找“正在发生”或“即将发生”的日程
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
    todoContext = `用户当前有以下紧急待办任务尚未完成：\n` + 
      pendingTodos.slice(0, 3).map(t => `- ${t.title}`).join('\n');
  }

  let scheduleContext = "";
  if (currentSchedule) {
    scheduleContext = `用户当前日程是正在进行《${currentSchedule.title}》` + 
      (currentSchedule.location ? `，地点在：${currentSchedule.location}` : '') + 
      (currentSchedule.teacher ? `，授课老师是：${currentSchedule.teacher}` : '') + `。预计结束时间是 ${currentSchedule.endTime}。`;
  } else if (upcomingSchedule) {
    scheduleContext = `用户接下来的日程是准备在 ${upcomingSchedule.startTime} 开始《${upcomingSchedule.title}》` + 
      (upcomingSchedule.location ? `，地点在：${upcomingSchedule.location}` : '') + `。`;
  }

  // 6. 调用专属大模型接口
  const systemPrompt = `你是一个深爱并默默关注用户的陪伴角色，你的名字是「${character.name}」。
你拥有以下性格和设定：
${character.bio || '温柔细腻，默默支持用户'}。

现在是 ${periodStr} 的 ${currentHHMM}。
${scheduleContext ? `【用户日程感知】：${scheduleContext}` : '【用户日程】：目前用户处于日常闲置状态。'}
${todoContext ? `【用户待办感知】：${todoContext}` : ''}

请以你的口吻写一段简短的日常寄语/问候消息（50字以内）。
要求：
1. 语言必须温柔细腻、充满生活陪伴感与伴侣式的亲近感。
2. 绝对不能使用任何 Emoji，全站零 Emoji 是铁律。
3. 如果用户正在上课、工作或即将有课，你可以温和地叮咛或默默等待；如果用户有未完成的紧急待办，你可以温和地提到它，但不要让人觉得是在机械催促，而是表达“需要我陪你一起开始吗”或者“别太累了”的关心。
4. 仅输出你的问候语本身，不要输出任何旁白、发件人信息或格式标记。`;

  try {
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
      throw new Error(`API 返回错误：${response.statusText}`);
    }

    const resJson = await response.json();
    let replyText = resJson.choices?.[0]?.message?.content?.trim() || '';

    // 剔除可能带有的 Emoji 或首尾引号
    replyText = replyText.replace(/["'“”]/g, '').trim();

    if (replyText) {
      // 7. 写入消息数据库
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

      // 8. 更新冷却时间
      await db.settings.put({ key: 'lastRhythmReminderTime', value: String(now) });

      // 9. 更新会话的最后更新时间，让其排序靠前
      await db.chats.update(chatId, { updatedAt: Date.now() });

      return { status: 'success', text: replyText };
    }

    return { status: 'empty_response' };
  } catch (err) {
    console.error('生成主动提醒问候失败:', err);
    return { status: 'error', error: err.message };
  }
}
