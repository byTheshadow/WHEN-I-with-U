import db from '../db';

const getFuzzyTimeOfDay = (timestamp) => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (hours >= 0 && hours < 5) return `深夜 ${timeStr}`;
  if (hours >= 5 && hours < 8) return `清晨 ${timeStr}`;
  if (hours >= 8 && hours < 11) return `上午 ${timeStr}`;
  if (hours >= 11 && hours < 13) return `中午 ${timeStr}`;
  if (hours >= 13 && hours < 17) return `下午 ${timeStr}`;
  if (hours >= 17 && hours < 19) return `黄昏 ${timeStr}`;
  return `夜晚 ${timeStr}`;
};

const fetchAiForOrbit = async (systemPrompt, userPrompt) => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    throw new Error('请先在系统设置中配置有效的 API Base URL 与 API Key。');
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');
  const model = apiConfig.model || 'gpt-3.5-turbo';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85
    })
  });

  if (!response.ok) {
    throw new Error(`[API Error ${response.status}]`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

export const checkAndTriggerParallelOrbit = async (chatId, forceGenerate = false) => {
  try {
    const chat = await db.chats.get(chatId);
    if (!chat) return { status: 'no_chat' };

    const character = await db.characters.get(chat.characterId);
    if (!character) return { status: 'no_character' };

    const lastUserMsg = await db.messages
      .where('chatId')
      .equals(chatId)
      .filter(m => m.sender === 'user')
      .reverse()
      .first();

    const now = Date.now();
    const lastUserTime = lastUserMsg ? new Date(lastUserMsg.timestamp).getTime() : 0;
    
    const idleDurationMinutes = (now - lastUserTime) / (1000 * 60);
    if (lastUserTime > 0 && idleDurationMinutes < 10 && !forceGenerate) {
      return { status: 'active_chatting', idleDurationMinutes };
    }

    const lastOrbit = await db.parallelOrbits
      .where('chatId')
      .equals(chatId)
      .reverse()
      .first();

    const hoursSinceLastOrbit = lastOrbit ? (now - lastOrbit.timestamp) / (1000 * 60 * 60) : 999;
    
    if (hoursSinceLastOrbit < 3 && !forceGenerate) {
      return { status: 'cooldown', hoursSinceLastOrbit };
    }

    const timeText = getFuzzyTimeOfDay(now);
    
    const recentMsgs = await db.messages
      .where('chatId')
      .equals(chatId)
      .reverse()
      .limit(10)
      .toArray();
    recentMsgs.reverse();

    const chatContextText = recentMsgs.map(m => {
      const senderName = m.sender === 'user' ? '用户' : character.name;
      return `${senderName}: ${m.content}`;
    }).join('\n');

    const systemPrompt = `你将扮演【${character.name}】。
由于用户目前不在你身边，你正在经历你个人的真实日常（Parallel Orbit）。你要用一段具有高度文学色彩、实体杂志编辑风格（Editorial Zine）的记录来还原这段时间的生活切面。
你是有独立生活、丰富现实经历的人。你有自己的白噪音、感官反应，还会和生活中的 NPC 产生交集。

【角色背景设定】
人设背景：${character.bio || '普通人'}
人设补充：${character.extraNotes || '无'}
用户的人设：${chat.userPersona || character.userPersona || '无'}

【日常记录杂志化规则】
1. **全站零 Emoji 铁律**：严禁包含任何 Emoji。
2. **现代主义视觉速写 (Graphic Cutout)**：请提供一段对你此刻眼前风景的极简文字速写（如：雨打在窗玻璃上的波纹、亮起橘红尾灯的晚班电车），用来构成杂志的极简线框插图。
3. **20-30% 微弱关联**：你的生活独立运转，70% 是你手头的琐事（比如换绿植盆、做三明治、和便利店员抱怨雨天）。仅有 20-30% 的概率，因为眼前的风声、气味或某页书的内容，让你间接联想到用户，这种联想必须是克制、边缘且充满质感的。
4. **NPC 对话剧场**：你可以设计一段有趣的、由其他 NPC（如隔壁领居、流浪猫、收银员等）与你的对话小剧场，以展示真实的社会交往。
5. **手书的缺憾**：偶尔可以加入一些 <s>划掉的文字</s>（被划掉的段落）以表现你记录时的片刻游移或欲言又止。

请严格使用以下键值对格式进行输出，使用 ||| 进行分割：

输出格式：
天气 ||| [此时的天气氛围，如：多云，干燥的微风]
地点 ||| [你此刻所处的具体场景，如：亮着一盏台灯的杂物间、临街咖啡馆的三号桌]
背景音 ||| [你当时听到的周围白噪音，如：指甲剪的清脆声、远处洒水车的风笛]
感官 ||| [你此刻的体表或气味感官，如：24°C / 刚修剪过的草坪气味]
记事 ||| [以第一人称口吻记录你在此处所做的事，融入生活感细节、NPC互动小剧场、笔迹涂抹痕迹。必须有趣、鲜活。零 Emoji。]
独白 ||| [你当下的心流感悟（将作为杂志引言大字显示）。融入20-30%的关于用户的微弱、间接联想，亦或是自我审视。零 Emoji。]
画面 ||| [对当时风景或物体的极简文字速写，用于杂志黑白线画框，如：曝光过度的黄昏街角，电线杆顶有一只驻足的鸽子]`;

    const userPrompt = `【当前时间】: ${timeText}
【最近的聊天上下文（供你提取微弱的记忆关联，不要直接回复聊天内容）】:
${chatContextText || '（暂无最近对话）'}

请写下你此刻的生活轨迹切面。`;

    const rawResponse = await fetchAiForOrbit(systemPrompt, userPrompt);
    
    const lines = rawResponse.split('\n');
    let weather = '多云，起风了';
    let location = '房间';
    let bgSound = '寂静';
    let sensory = '无特殊气味';
    let activity = '整理一些杂物。';
    let thoughts = '日常周而复始。';
    let cutout = '一片空白';

    lines.forEach(line => {
      if (line.includes('天气 |||')) {
        weather = line.split('天气 |||')[1]?.trim() || weather;
      } else if (line.includes('地点 |||')) {
        location = line.split('地点 |||')[1]?.trim() || location;
      } else if (line.includes('背景音 |||')) {
        bgSound = line.split('背景音 |||')[1]?.trim() || bgSound;
      } else if (line.includes('感官 |||')) {
        sensory = line.split('感官 |||')[1]?.trim() || sensory;
      } else if (line.includes('记事 |||')) {
        activity = line.split('记事 |||')[1]?.trim() || activity;
      } else if (line.includes('独白 |||')) {
        thoughts = line.split('独白 |||')[1]?.trim() || thoughts;
      } else if (line.includes('画面 |||')) {
        cutout = line.split('画面 |||')[1]?.trim() || cutout;
      }
    });

    const newLog = {
      chatId,
      characterId: character.id,
      timestamp: now,
      weather,
      location,
      bgSound,
      sensory,
      activity,
      thoughts,
      cutout
    };

    const insertedId = await db.parallelOrbits.add(newLog);
    return {
      status: 'success',
      logId: insertedId,
      data: newLog
    };
  } catch (err) {
    console.error('[parallelOrbitService] failed:', err);
    return { status: 'error', error: err.message };
  }
};

