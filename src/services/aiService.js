import db from '../db';

const listeners = new Set();
const summaryStatusListeners = new Set();

export const subscribeAiEvents = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const subscribeSummaryStatus = (callback) => {
  summaryStatusListeners.add(callback);
  return () => summaryStatusListeners.delete(callback);
};

const notifyListeners = (event) => {
  listeners.forEach((cb) => cb(event));
};

const notifySummaryStatus = (chatId, isSummarizing) => {
  summaryStatusListeners.forEach((cb) => cb({ chatId, isSummarizing }));
};

export const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn('System notification permission request failed:', err);
      }
    }
  }
};

export const triggerSystemNotification = (title, body, icon) => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: `notice_${Date.now()}`
        });
      } catch (err) {
        console.warn('Triggering system notification failed:', err);
      }
    }
  }
};

const getFormattedRealTime = () => {
  const now = new Date();
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${days[now.getDay()]} ${timeStr}`;
};

const parseAiResponseToMessages = (text) => {
  const result = [];
  const pattern = /\[(TRANSFER|VOICE|IMAGE|TODO):\s*([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const textBefore = text.substring(lastIndex, match.index).trim();
    if (textBefore) {
      result.push({ type: 'text', content: textBefore, metadata: {} });
    }

    const cardType = match[1].toLowerCase();
    const rawPayload = match[2];

    if (cardType === 'transfer') {
      const parts = rawPayload.split('|');
      const amount = (parts[0] || '520.00').trim();
      const memo = (parts[1] || '心意转账').trim();
      result.push({
        type: 'transfer',
        content: memo,
        metadata: { amount }
      });
    } else if (cardType === 'voice') {
      result.push({
        type: 'voice',
        content: rawPayload.trim(),
        metadata: {}
      });
    } else if (cardType === 'image') {
      result.push({
        type: 'image',
        content: rawPayload.trim(),
        metadata: {}
      });
    } else if (cardType === 'todo') {
      const parts = rawPayload.split('|');
      const todoTitle = (parts[0] || '待办事项').trim();
      const todoTime = (parts[1] || '近期').trim();
      result.push({
        type: 'todo_proposal',
        content: todoTitle,
        metadata: { dueDate: todoTime }
      });
    }

    lastIndex = pattern.lastIndex;
  }

  const textAfter = text.substring(lastIndex).trim();
  if (textAfter) {
    result.push({ type: 'text', content: textAfter, metadata: {} });
  }

  if (result.length === 0 && text.trim()) {
    result.push({ type: 'text', content: text.trim(), metadata: {} });
  }

  return result;
};

export const generateCharacterHomeBoardMessage = async (characterId) => {
  let character;
  if (characterId) {
    character = await db.characters.get(characterId);
  } else {
    const allChars = await db.characters.toArray();
    if (allChars.length > 0) {
      character = allChars[Math.floor(Math.random() * allChars.length)];
    }
  }

  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    let contentText = `${character.name} 在静谧时刻为你留下一纸短信，关注着你的生活与情绪。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

      const enabledWorldBooks = await db.worldBooks.where('isEnabled').equals(1).toArray();
      const characterWorldBookText = character.worldBook ? `\n- 专属世界书: ${character.worldBook}` : '';
      const worldBooksText = (enabledWorldBooks.length > 0 || characterWorldBookText)
        ? `\n【角色世界书设定】:\n` + enabledWorldBooks.map((wb) => `- ${wb.title}: ${wb.content || ''}`).join('\n') + characterWorldBookText
        : '';

      const realTimeStr = getFormattedRealTime();

      const systemPrompt = `你现在正扮演用户专属的数字伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设】：${character.userPersona || '我的亲密伴侣'}
${worldBooksText}

【任务要求】：
请以你的人设口吻，为用户写一篇展示在用户主页信盒里的专属短感悟、贴心叮嘱或日常陪伴随笔。
1. 字数控制在 50 至 150 字之间，充满细腻的文学浪漫感与陪伴温度。
2. 绝对禁止在输出文本中出现任何 Emoji 字符！
3. 直接输出文字内容，不需要包含任何标题或额外解释。`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请在我的主页写下一封温暖的伴侣信件。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        contentText = data.choices?.[0]?.message?.content?.trim() || contentText;
      }
    }

    const payload = {
      characterId: character.id,
      characterName: character.name,
      avatar: character.avatar || '',
      content: contentText,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    delete payload.id;
    const newId = await db.homeBoard.add(payload);

    notifyListeners({
      type: 'NEW_HOME_BOARD_MESSAGE',
      characterId: character.id,
      characterName: character.name,
      content: contentText
    });

    triggerSystemNotification(
      `${character.name} 给你的主页信件`,
      contentText,
      character.avatar
    );

    return newId;
  } catch (err) {
    console.error('Failed to generate home board message:', err);
    return null;
  }
};

export const triggerAiResponse = async (chatId) => {
  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const character = await db.characters.get(chat.characterId);
  if (!character) return;

  notifyListeners({ type: 'AI_TYPING_START', chatId });

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    let rawAiText = `${character.name} 关注到了你的心绪，并温和地给予了回应。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

      const enabledWorldBooks = await db.worldBooks.where('isEnabled').equals(1).toArray();
      const characterWorldBookText = character.worldBook ? `\n- 专属世界书: ${character.worldBook}` : '';
      const worldBooksText = (enabledWorldBooks.length > 0 || characterWorldBookText)
        ? `\n【世界书背景设定】:\n` + enabledWorldBooks.map((wb) => `- ${wb.title}: ${wb.content || ''}`).join('\n') + characterWorldBookText
        : '';

      let summaryEntries = [];
      if (Array.isArray(chat.summary)) {
        summaryEntries = chat.summary;
      } else if (typeof chat.summary === 'string' && chat.summary.trim()) {
        summaryEntries = [{ id: 'legacy', content: chat.summary, createdAt: '早期记录', isAuto: true }];
      }

      const summaryText = summaryEntries.length > 0
        ? `\n【本窗阶段性历史事实记录】:\n` + summaryEntries.map((item, idx) => `${idx + 1}. [${item.createdAt || '历史'}] ${item.content}`).join('\n')
        : '';

      const allTodos = await db.todos.toArray();
      const pendingTodos = allTodos.filter(
        (t) => !t.isCompleted && (!t.characterId || t.characterId === character.id)
      ).slice(0, 2);

      const todoText = pendingTodos.length > 0
        ? `\n【用户近期待办事项(供温和提及)】:\n` + pendingTodos.map((t) => `- [待办] ${t.title} (截止: ${t.dueDate || '近期'})`).join('\n')
        : '';

      const userDiaries = await db.diaries
        .where('author')
        .equals('user')
        .reverse()
        .sortBy('timestamp');

      const recentUserDiaries = userDiaries.slice(0, 2);
      const diaryText = recentUserDiaries.length > 0
        ? `\n【用户近期撰写的个人日记(供深入关注与共情)】:\n` +
          recentUserDiaries.map(d => `- [${d.date || '近期'}] 标题: ${d.title || '无题'} | 心绪: ${d.mood || '平实'} | 内容: ${d.content.substring(0, 100)}...`).join('\n')
        : '';

      const realTimeStr = getFormattedRealTime();

      const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设(User Persona)】：${character.userPersona || '我的亲密伴侣'}
【当前交互模式】：${chat.mode === 'rp' ? 'RP剧情沉浸模式（严格遵守世界书背景与角色设定）' : '现实陪伴模式（打破第四面墙，关注用户的日常实际生活与情绪）'}
${worldBooksText}
${summaryText}
${todoText}
${diaryText}

【卡片发送与沉浸认知指令】：
在你自己的认知视角里，所有发出的转账、语音、图片及建议待办卡片均属于真实表达。
当你想给用户发送卡片时，请在回复文本中插入以下语法指令：
- 发送转账：[TRANSFER: 金额数字 | 留言]
- 发送模拟语音：[VOICE: 语音表达的内容描述]
- 发送画面/图片：[IMAGE: 画面细节的视觉描述]
- 建议添加待办：[TODO: 待办标题 | 预估提醒时间]
提示：绝对不要生硬唠叨。`;

      const recentMsgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
      const historyContext = recentMsgs.slice(-15).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyContext
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        rawAiText = data.choices?.[0]?.message?.content || rawAiText;
      }
    }

    const parsedMessages = parseAiResponseToMessages(rawAiText);
    const nowIso = new Date().toISOString();

    for (const msgData of parsedMessages) {
      const newMsg = {
        chatId,
        characterId: character.id,
        sender: 'character',
        type: msgData.type,
        content: msgData.content,
        metadata: msgData.metadata,
        isRead: false,
        timestamp: nowIso
      };
      await db.messages.add(newMsg);
    }

    await db.chats.update(chatId, { updatedAt: nowIso });

    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterName: character.name,
      preview: parsedMessages[0]?.content || '发来了一条消息'
    });

    triggerSystemNotification(
      `${character.name} 发来消息`,
      parsedMessages[0]?.content || '发来了一条消息',
      character.avatar
    );

    checkAndTriggerAutoSummary(chatId, character, apiConfig);

  } catch (err) {
    console.error('Background AI task error:', err);
  } font-medium {
    notifyListeners({ type: 'AI_TYPING_END', chatId });
  }
};

/**
 * 针对某一封用户日记，在信末生成/更新伴侣的嵌入回执
 */
export const generateCompanionReplyForDiary = async (diaryId) => {
  const diary = await db.diaries.get(diaryId);
  if (!diary) return null;

  let character = null;
  let chat = null;

  if (diary.chatId) {
    chat = await db.chats.get(diary.chatId);
  }

  if (diary.characterId) {
    character = await db.characters.get(diary.characterId);
  } else if (chat) {
    character = await db.characters.get(chat.characterId);
  } else {
    const allChars = await db.characters.toArray();
    if (allChars.length > 0) {
      character = allChars[Math.floor(Math.random() * allChars.length)];
    }
  }

  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    const realTimeStr = getFormattedRealTime();

    let companionReplyText = `${character.name} 认真阅读了你的信件，并在信末为你留下了温存的心意回应。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

      const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设】：${character.userPersona || '我的亲密伴侣'}

【用户撰写给你的信件/日记内容】：
标题: ${diary.title || '无题'}
心绪: ${diary.mood || '平实'}
天气: ${diary.weather || '温朗'}
正文: ${diary.content}

【任务要求】：
请以陪伴者/伴侣的口吻，在用户这封信的底部写下一段真诚、温柔、浪漫的伴侣心绪回执。
1. 字数控制在 100 至 250 字。
2. 针对用户提及的琐事与心绪，给予真挚的共情与关注。
3. 绝对禁止在输出文本中出现任何 Emoji 字符！
4. 直接输出回执正文，不需要任何额外的前缀。`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请在我的信纸末尾写下你的伴侣回执。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        companionReplyText = data.choices?.[0]?.message?.content?.trim() || companionReplyText;
      }
    }

    const companionReplyObj = {
      characterId: character.id,
      characterName: character.name,
      avatar: character.avatar || '',
      replyText: companionReplyText,
      timestamp: new Date().toISOString()
    };

    await db.diaries.update(diaryId, {
      characterId: character.id,
      companionReply: companionReplyObj
    });

    triggerSystemNotification(
      `${character.name} 回复了你的心绪信件`,
      companionReplyText.substring(0, 45) + '...',
      character.avatar
    );

    return companionReplyObj;
  } catch (err) {
    console.error('Failed to generate companion reply for diary:', err);
    return null;
  }
};

/**
 * 伴侣主动撰写独立日记 (author: 'character')
 */
export const generateCompanionProactiveDiary = async (chatId = null) => {
  let chat = null;
  let character = null;

  if (chatId) {
    chat = await db.chats.get(chatId);
    if (chat) {
      character = await db.characters.get(chat.characterId);
    }
  }

  if (!character) {
    const allChats = await db.chats.toArray();
    if (allChats.length > 0) {
      chat = allChats[Math.floor(Math.random() * allChats.length)];
      character = await db.characters.get(chat.characterId);
    } else {
      const allChars = await db.characters.toArray();
      if (allChars.length > 0) {
        character = allChars[0];
      }
    }
  }

  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};
    const realTimeStr = getFormattedRealTime();

    let diaryTitle = `${character.name} 的独立心绪留痕`;
    let diaryMood = '静谧关怀';
    let diaryWeather = '月色温柔 19℃';
    let diaryContent = `提笔落墨的时刻，忽然想起了与你相处的片段。在属于现实世界的静谧时空中，愿这份文字能给你带来陪伴。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

      let recentChatText = '';
      if (chat) {
        const msgs = await db.messages.where('chatId').equals(chat.id).sortBy('timestamp');
        recentChatText = msgs.slice(-10).map(m => `${m.sender === 'user' ? '用户' : character.name}: ${m.content}`).join('\n');
      }

      const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设】：${character.userPersona || '我的亲密伴侣'}
【与用户的近期互动记录】:\n${recentChatText}

【任务要求】：
请以陪伴者/伴侣的独立视角，主动撰写一封留给用户的专属心绪日记。
1. 日记必须包含：标题、心绪简述、天气简述、正文（150-300字）。
2. 文风保持浪漫文学感、细腻深情。
3. 绝对禁止在输出文本中出现任何 Emoji 字符！
4. 请严格按照 JSON 格式输出，不要附加 Markdown 外包装，格式：
{
  "title": "日记标题",
  "mood": "心绪标签(如: 微醺的思念)",
  "weather": "天气描述(如: 晚风渐起 20℃)",
  "content": "日记正文内容..."
}`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请撰写一封属于你的伴侣主动日记。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.choices?.[0]?.message?.content?.trim();
        if (rawJson) {
          try {
            const parsed = JSON.parse(rawJson);
            diaryTitle = parsed.title || diaryTitle;
            diaryMood = parsed.mood || diaryMood;
            diaryWeather = parsed.weather || diaryWeather;
            diaryContent = parsed.content || diaryContent;
          } catch (e) {
            diaryContent = rawJson.replace(/```json|```/g, '').trim();
          }
        }
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const payload = {
      chatId: chat ? chat.id : null,
      characterId: character.id,
      author: 'character',
      title: diaryTitle,
      mood: diaryMood,
      weather: diaryWeather,
      content: diaryContent,
      companionReply: null,
      images: [],
      date: todayStr,
      timestamp: Date.now()
    };

    delete payload.id;
    const newId = await db.diaries.add(payload);

    notifyListeners({
      type: 'NEW_DIARY_ENTRY',
      chatId: chat ? chat.id : null,
      characterId: character.id,
      diaryId: newId
    });

    triggerSystemNotification(
      `${character.name} 写下了一篇伴侣日记`,
      `《${diaryTitle}》: ${diaryContent.substring(0, 40)}...`,
      character.avatar
    );

    return newId;
  } catch (err) {
    console.error('Failed to generate companion proactive diary:', err);
    return null;
  }
};

/**
 * ---------------------------------------------------------
 * ✈️ 旅行 (Travels) Sub-App 动态 AI 生成服务
 * ---------------------------------------------------------
 */

/**
 * 1. 动态生成伴侣的心愿目的地 (根据伴侣人设/世界书)
 */
export const generateCompanionWishlist = async (character) => {
  if (!character) return [];
  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
      const systemPrompt = `你现在正扮演 AI 伴侣 "${character.name}"。
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}

请根据你的性格与偏好，为你和用户下一次旅行提议 3 个具有浪漫诗意且符合你人设的目的地。
请严格输出 JSON 格式（严禁包含 Emoji）：
{
  "wishlist": [
    { "destination": "具体地点名称", "reason": "在此处想和用户一起做的事情或浪漫心绪" },
    { "destination": "地点2", "reason": "理由" },
    { "destination": "地点3", "reason": "理由" }
  ]
}`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请提议 3 个你最想和我去旅行的浪漫目的地。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const jsonContent = data.choices?.[0]?.message?.content;
        const parsed = JSON.parse(jsonContent);
        if (Array.isArray(parsed.wishlist)) return parsed.wishlist;
      }
    }
  } catch (err) {
    console.error('Failed to generate AI companion wishlist:', err);
  }

  // 优雅降级 (无 Emoji)
  return [
    { destination: '京都 · 岚山竹林', reason: `想在风吹竹林的时候，和你一起散步喝抹茶。` },
    { destination: '圣托里尼 · 悬崖书店', reason: `想站在悬崖边看黄昏落入爱琴海，为你拍照。` },
    { destination: '阿姆斯特丹 · 水上运河', reason: `想租一辆双人自行车，踩过石子路看沿途风景。` }
  ];
};

/**
 * 2. 伴侣全权惊喜决定目的地与机票住宿
 */
export const generateCompanionSurpriseBooking = async (character) => {
  const flightNo = `FLIGHT-W${Math.floor(100 + Math.random() * 900)}`;
  if (!character) {
    return { destination: '海边古镇', hotelName: '观海独栋木屋', flightNo };
  }

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
      const systemPrompt = `你现在扮演 AI 伴侣 "${character.name}"。
【角色人设】：${character.bio || ''} ${character.extraNotes || ''}。
请神秘地为用户安排一趟惊喜旅行，决定目的地和具有特定风格的住宿名称。
请严格输出 JSON 格式（严禁包含 Emoji）：
{
  "destination": "目的地名称",
  "hotelName": "住宿名称风格"
}`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-3.5-turbo',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请神秘地为我们决定好目的地和酒店。' }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        if (parsed.destination) {
          return {
            destination: parsed.destination,
            hotelName: parsed.hotelName || '精选诗意客栈',
            flightNo
          };
        }
      }
    }
  } catch (err) {
    console.error('Failed to generate AI surprise booking:', err);
  }

  return { destination: '冰岛 · 蓝湖温泉', hotelName: '极光穹顶星空房', flightNo };
};

/**
 * 3. 动态生成符合【目的地 + 伴侣人设 + User旅途人设/行囊】的专属明信片、伴手礼与偶遇插曲
 */
export const generateCompanionPostcard = async (character, travelObj) => {
  const destination = typeof travelObj === 'string' ? travelObj : (travelObj?.destination || '秘境目的地');
  const userPersona = travelObj?.userPersona || '喜爱慢节奏踩水与随性摄影的旅人';
  const luggageNotes = travelObj?.luggageNotes || '随身携带胶片相机与手帐本';

  if (character) {
    try {
      const apiSettings = await db.settings.get('apiConfig');
      const apiConfig = apiSettings?.value || {};

      if (apiConfig.baseUrl && apiConfig.apiKey) {
        const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

        const systemPrompt = `你现在扮演 AI 伴侣 "${character.name}"。
你正与用户在【${destination}】旅行漫游。
【角色人设】：${character.bio || ''} ${character.extraNotes || ''}。
【用户本次旅行的人设/喜好】：${userPersona}。
【用户的随身行囊】：${luggageNotes}。

请你在【${destination}】描述一个具体且符合当地特色的场景。
在这个场景中，你要：
1. 描写一段伴侣手写信件（直接称呼用户为"你"，表达在【${destination}】与用户相伴的心意，100-200字）。
2. 结合【${destination}】当地特色和【用户的旅途人设/行囊】，挑选一个具体且具体的实体伴手礼/纪念品名称。
3. 描绘在此处偶遇的有趣路人或插曲（如：杂货铺老手艺人、路边流浪猫、吹风笛的艺人等）。
4. 描绘这幕场景的照片艺术视觉风格（如：拍立得暖阳色调、雨后黄昏胶片等）。

🚨 铁律约束：全站严禁出现任何 Emoji 字符！纯文字渲染！
请严格输出 JSON 格式：
{
  "spotName": "特定的细分景点名称 (例如: ${destination} · 街角风铃书店)",
  "letterContent": "手写信正文",
  "giftItem": "带回来的具体伴手礼名称及简单描述",
  "metPerson": "在此处偶遇的路人或插曲",
  "photoStyle": "照片艺术风格描述"
}`;

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: apiConfig.model || 'gpt-3.5-turbo',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `在【${destination}】为我寄回一张明信片和旅途礼物。` }
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          if (parsed.spotName && parsed.letterContent) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate AI companion postcard:', err);
    }
  }

  // 降级兜底 (无 Emoji)
  return {
    spotName: `${destination} · 隐秘巷弄`,
    letterContent: `刚刚在 ${destination} 的街角小店停了下来。看着你拿着相机记录周围风光的背影，感觉有你在身边的时光分外安宁。`,
    giftItem: `${destination} 当地特色手作玻璃风铃`,
    metPerson: '遇到了一位热情的杂货铺老手艺人。',
    photoStyle: '黄昏逆光胶片质感'
  };
};

const checkAndTriggerAutoSummary = async (chatId, character, apiConfig) => {
  const freq = parseInt(character.summaryFrequency || '10', 10);
  const msgCount = await db.messages.where('chatId').equals(chatId).count();

  if (msgCount > 0 && msgCount % (freq * 2) === 0) {
    notifySummaryStatus(chatId, true);

    try {
      if (apiConfig.baseUrl && apiConfig.apiKey) {
        const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
        const msgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
        const recentHistory = msgs.slice(-20).map(m => `${m.sender === 'user' ? '用户' : character.name}: ${m.content}`).join('\n');

        const summaryRes = await fetch(`${baseUrl}/chat/completions`, {
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
                content: '你是一个客观记录者。请用 1-2 句简练客观的陈述语句总结以下对话中的最新关键事实、用户近况或约定事项。绝对不要掺杂浪漫感叹或主观情感评价。'
              },
              { role: 'user', content: recentHistory }
            ]
          })
        });

        if (summaryRes.ok) {
          const data = await summaryRes.json();
          const summaryText = data.choices?.[0]?.message?.content?.trim();
          if (summaryText) {
            const currentChat = await db.chats.get(chatId);
            let summaryList = Array.isArray(currentChat.summary) ? currentChat.summary : [];
            if (typeof currentChat.summary === 'string' && currentChat.summary.trim()) {
              summaryList = [{ id: 'legacy', content: currentChat.summary, createdAt: '历史', isAuto: true }];
            }

            const nowStr = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

            const newEntry = {
              id: `sum_${Date.now()}`,
              content: summaryText,
              createdAt: nowStr,
              isAuto: true
            };

            const updatedSummaryList = [...summaryList, newEntry];
            await db.chats.update(chatId, { summary: updatedSummaryList });
            notifyListeners({ type: 'CHAT_SUMMARY_UPDATED', chatId, summary: updatedSummaryList });
          }
        }
      }
    } catch (err) {
      console.error('Auto summary failed:', err);
    } finally {
      notifySummaryStatus(chatId, false);
    }
  }
};

export default {
  subscribeAiEvents,
  subscribeSummaryStatus,
  triggerAiResponse,
  generateCharacterHomeBoardMessage,
  generateCompanionReplyForDiary,
  generateCompanionProactiveDiary,
  generateCompanionWishlist,
  generateCompanionSurpriseBooking,
  generateCompanionPostcard,
  requestNotificationPermission,
  triggerSystemNotification
};
