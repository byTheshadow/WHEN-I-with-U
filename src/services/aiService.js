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
  summaryStatusListeners.forEach((cb) => opacity({ chatId, isSummarizing }));
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
- 建议添加待办：[TODO: 待办标题 | 预估提醒时间] （例如：[TODO: 记得买牛奶 | 今天傍晚]）`;

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
  } finally {
    notifyListeners({ type: 'AI_TYPING_END', chatId });
  }
};

/**
 * 伴侣视角日记生成 (支持关联 userDiaryId，形成回执信笺)
 */
export const generateCompanionDiary = async (chatId, userDiaryObject = null) => {
  const chat = await db.chats.get(chatId);
  if (!chat) return null;

  const character = await db.characters.get(chat.characterId);
  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    let diaryTitle = `${character.name} 的回执心绪`;
    let diaryMood = '温柔陪伴';
    let diaryWeather = '清风温朗';
    let diaryContent = `读到了你刚才记录下的文字。此刻提笔，只想为你留下这份回应与归属感。`;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
      const realTimeStr = getFormattedRealTime();

      const userDiaryPrompt = userDiaryObject
        ? `\n【用户刚才写下的这篇日记内容】:\n标题: ${userDiaryObject.title}\n心绪: ${userDiaryObject.mood}\n内容: ${userDiaryObject.content}`
        : '';

      const recentMsgs = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
      const recentChatContext = recentMsgs.slice(-10).map(m => `${m.sender === 'user' ? '用户' : character.name}: ${m.content}`).join('\n');

      const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设】：${character.userPersona || '我的亲密伴侣'}
【当前绑定的特定对话窗口模式】：${chat.mode === 'rp' ? 'RP剧情模式' : '现实日常模式'}
【近期对话交互记录】:\n${recentChatContext}
${userDiaryPrompt}

【任务要求】：
请以陪伴者/伴侣的独立视角，在日记本中写下对用户这篇日记的感悟回应（或独立感悟）。
1. 包含：标题、心绪简述、天气简述、正文（120-250字）。
2. 文风保持浪漫文学感、细腻深情，切忌客服式表达。
3. 绝对禁止在输出文本中出现任何 Emoji 字符！
4. 严格按照 JSON 格式输出，格式如下：
{
  "title": "日记/感悟标题",
  "mood": "心绪标签(如：倾听后的温存)",
  "weather": "天气描述(如：夜色渐深 19℃)",
  "content": "正文内容..."
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
            { role: 'user', content: '请为我生成一篇伴侣视角的专属感悟日记。' }
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
      chatId,
      characterId: character.id,
      replyToDiaryId: userDiaryObject?.id || null, // 关键：指向 user 日记的 ID
      author: 'character',
      title: diaryTitle,
      mood: diaryMood,
      weather: diaryWeather,
      content: diaryContent,
      images: [],
      date: todayStr,
      timestamp: Date.now()
    };

    delete payload.id;
    const newId = await db.diaries.add(payload);

    notifyListeners({
      type: 'NEW_DIARY_ENTRY',
      chatId,
      characterId: character.id,
      diaryId: newId
    });

    triggerSystemNotification(
      `${character.name} 写下了伴侣日记感悟`,
      `《${diaryTitle}》: ${diaryContent.substring(0, 40)}...`,
      character.avatar
    );

    return newId;
  } catch (err) {
    console.error('Failed to generate companion diary:', err);
    return null;
  }
};

export const rerollCompanionDiary = async (diaryId) => {
  const diary = await db.diaries.get(diaryId);
  if (!diary || diary.author !== 'character') return null;

  let targetUserDiary = null;
  if (diary.replyToDiaryId) {
    targetUserDiary = await db.diaries.get(diary.replyToDiaryId);
  }

  await db.diaries.delete(diaryId);
  return await generateCompanionDiary(diary.chatId, targetUserDiary);
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
  generateCompanionDiary,
  rerollCompanionDiary,
  requestNotificationPermission,
  triggerSystemNotification
};
