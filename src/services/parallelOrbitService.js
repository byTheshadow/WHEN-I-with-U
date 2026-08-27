import db from '../db';

/**
 * 格式化时间，转为具有温度的文字表述，如“深夜 02:40”、“黄昏 17:15”
 */
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

/**
 * 独立请求大模型的方法
 */
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
      temperature: 0.8
    })
  });

  if (!response.ok) {
    throw new Error(`[API Error ${response.status}]`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

/**
 * 判定并触发平行轨迹生成
 * @param {number} chatId 
 * @param {boolean} forceGenerate 是否无视时间间隔强制生成（可用于用户点击手动刷新/补齐）
 */
export const checkAndTriggerParallelOrbit = async (chatId, forceGenerate = false) => {
  try {
    const chat = await db.chats.get(chatId);
    if (!chat) return { status: 'no_chat' };

    const character = await db.characters.get(chat.characterId);
    if (!character) return { status: 'no_character' };

    // 1. 查找用户发送的最后一条消息时间
    const lastUserMsg = await db.messages
      .where('chatId')
      .equals(chatId)
      .filter(m => m.sender === 'user')
      .reverse()
      .first();

    const now = Date.now();
    const lastUserTime = lastUserMsg ? new Date(lastUserMsg.timestamp).getTime() : 0;
    
    // 如果从来没有发过消息，或者距离最后一次活跃小于10分钟，且非强制，则判定为正在热烈交流中，不生成独处记录
    const idleDurationMinutes = (now - lastUserTime) / (1000 * 60);
    if (lastUserTime > 0 && idleDurationMinutes < 10 && !forceGenerate) {
      return { status: 'active_chatting', idleDurationMinutes };
    }

    // 2. 检查上一次平行轨迹生成的时间，避免高频刷新
    const lastOrbit = await db.parallelOrbits
      .where('chatId')
      .equals(chatId)
      .reverse()
      .first();

    const hoursSinceLastOrbit = lastOrbit ? (now - lastOrbit.timestamp) / (1000 * 60 * 60) : 999;
    
    // 默认如果距离上一条日常轨迹未满 3 小时，且不是强制请求，就不做新生成
    if (hoursSinceLastOrbit < 3 && !forceGenerate) {
      return { status: 'cooldown', hoursSinceLastOrbit };
    }

    // 3. 构建 Prompt 实时生成角色的平行生活
    const timeText = getFuzzyTimeOfDay(now);
    
    // 提取最近10条聊天上下文，供 AI 了解最近和用户在聊什么，从而能够在独处时产生 20-30% 的间接关联
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

    const systemPrompt = `你将扮演一个活生生的人，名字是【${character.name}】。
我们要记录你不在用户身边、享受自己独立生活时的日记本轨迹（Parallel Orbit）。
你绝对是一个活在现实世界中、有自己独立日常的活人，绝对不是只会围绕用户转的 AI 挂件。
你的生活有很多面：个人的日常安排、琐碎的爱好、天气变化、去过的店、遇到的路人或小动物，甚至和其他NPC（如朋友、店员、隔壁邻居）的互动小剧场。

【角色背景设定】
人设背景：${character.bio || '普通人'}
人设补充：${character.extraNotes || '无'}
我（用户）的人设：${chat.userPersona || character.userPersona || '无'}

【日记本记录规则】
1. **全站零 Emoji 铁律**：严禁在输出的任何段落里使用任何 Emoji 字符。
2. **20-30% 情感偏向**：你有独立的生活，70% 以上的内容关于你自己的日常（比如自己换花盆、去便利店买冰咖啡、在路边听野琴、被猫抓破手指、与NPC对话的趣味小剧场等）。只有 20-30% 的篇幅，会因为当下的情景、天气、声音间接引发关于用户的联想或思念，不可过度深情、不可主动写信，要克制、文学化和纸笔般的温度。
3. **真实的人性细节**：
   - 适当加入一些涂抹划掉的文字（比如用 <s>双划线</s> 或被划掉的痕迹展现内心纠结或临时改主意），例如：“<s>突然觉得有点寂寞</s> ……算了，还是看书吧。”
   - 融入具体的对话框，用台词感表现NPC互动。例如：
     隔壁王叔：“又在阳台倒腾你的薄荷呢？”
     我：“是啊，前阵子雨水太多，烂根了。”
4. **格式控制**：请严格按照以下键值对格式进行输出，使用 ||| 进行分割，不要包含任何多余的前缀和后缀。

输出格式：
天气 ||| [当地此时的天气或氛围描述，如：微雨，空气有湿泥的气味]
地点 ||| [你此刻所处的具体场景，如：亮着一盏台灯的杂物间、临街咖啡馆的三号桌]
记事 ||| [以第一人称口吻，记录你在此处所做的事。融入生活感细节、NPC互动小剧场、笔迹涂抹痕迹。必须有趣、鲜活。零 Emoji。]
独白 ||| [你当下的心流感悟。融入20-30%的关于用户的微弱、间接联想，亦或是自我审视。零 Emoji。]`;

    const userPrompt = `【当前时间】: ${timeText}
【最近的聊天简要上下文（供提取微弱的记忆关联，不要直接回复聊天内容，而是作为你独处时记忆的引子）】:
${chatContextText || '（暂无最近对话）'}

请根据这些信息，在你的平行生活里写下新的一页。`;

    const rawResponse = await fetchAiForOrbit(systemPrompt, userPrompt);
    
    // 解析返回格式
    const lines = rawResponse.split('\n');
    let weather = '多云，起风了';
    let location = '房间';
    let activity = '整理一些杂物。';
    let thoughts = '风很大，听得见窗户在轻微抖动。';

    lines.forEach(line => {
      if (line.includes('天气 |||')) {
        weather = line.split('天气 |||')[1]?.trim() || weather;
      } else if (line.includes('地点 |||')) {
        location = line.split('地点 |||')[1]?.trim() || location;
      } else if (line.includes('记事 |||')) {
        activity = line.split('记事 |||')[1]?.trim() || activity;
      } else if (line.includes('独白 |||')) {
        thoughts = line.split('独白 |||')[1]?.trim() || thoughts;
      }
    });

    // 存入数据库
    const newLog = {
      chatId,
      characterId: character.id,
      timestamp: now,
      weather,
      location,
      activity,
      thoughts
    };

    const insertedId = await db.parallelOrbits.add(newLog);
    return {
      status: 'success',
      logId: insertedId,
      data: newLog
    };
  } catch (err) {
    console.error('[parallelOrbitService] failed to check or trigger:', err);
    return { status: 'error', error: err.message };
  }
};
