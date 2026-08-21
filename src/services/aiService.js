import db from '../db';

const listeners = new Set();
const summaryStatusListeners = new Set();

const activeAiRequests = new Set();
// 基于 Web Audio API 的零依赖消息音效合成器
export const playMessageSound = (type = 'receive') => {
  if (typeof window === 'undefined') return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'send') {
      // 柔和气泡发送音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        880,
        ctx.currentTime + 0.08
      );

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.08
      );

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // 浪漫高雅水滴/金铃接收音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.25
      );

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    console.warn('Audio sound play prevented:', err);
  }
};


const isDocumentVisible = () => {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible';
};


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

export const parseAiResponseToMessages = (text = '') => {
  const result = [];
  const pattern = /\[(TRANSFER|VOICE|IMAGE|TODO):\s*([^\]]+)\]/g;

  let lastIndex = 0;
  let match;

  /**
   * 将普通文本拆分为多个独立气泡。
   *
   * 约定：
   * - 使用 ||| 分隔多个气泡
   * - 空气泡自动忽略
   * - 不影响卡片消息
   */
  const pushTextMessages = (content) => {
    if (!content || typeof content !== 'string') {
      return;
    }

    content
      .split(/\s*\|\|\|\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        result.push({
          type: 'text',
          content: part,
          metadata: {}
        });
      });
  };

  while ((match = pattern.exec(text)) !== null) {
    const textBefore = text
      .slice(lastIndex, match.index)
      .trim();

    if (textBefore) {
      pushTextMessages(textBefore);
    }

    const cardType = match[1].toLowerCase();
    const rawPayload = match[2].trim();

    if (cardType === 'transfer') {
      const parts = rawPayload.split('|');

      result.push({
        type: 'transfer',
        content: (parts[1] || '心意转账').trim(),
        metadata: {
          amount: (parts[0] || '520.00').trim()
        }
      });
    } else if (cardType === 'voice') {
      result.push({
        type: 'voice',
        content: rawPayload,
        metadata: {}
      });
    } else if (cardType === 'image') {
      result.push({
        type: 'image',
        content: rawPayload,
        metadata: {}
      });
    } else if (cardType === 'todo') {
      const parts = rawPayload.split('|');

      result.push({
        type: 'todo_proposal',
        content: (parts[0] || '待办事项').trim(),
        metadata: {
          dueDate: (parts[1] || '近期').trim()
        }
      });
    }

    lastIndex = pattern.lastIndex;
  }

  const textAfter = text
    .slice(lastIndex)
    .trim();

  if (textAfter) {
    pushTextMessages(textAfter);
  }

  // 没有卡片、没有分隔符，但有普通文本时，至少生成一个文本气泡。
  if (result.length === 0 && text.trim()) {
    pushTextMessages(text.trim());
  }

  return result;
};

const buildHistoryContext = (messages) => {
  const historyContext = [];

  for (const message of messages) {
    if (!message || message.type === 'error') {
      continue;
    }

    let role;

    if (message.sender === 'user') {
      role = 'user';
    } else if (message.sender === 'character') {
      role = 'assistant';
    } else {
      continue;
    }

    const content = String(message.content || '').trim();

    if (!content) {
      continue;
    }

    const previousMessage =
      historyContext[historyContext.length - 1];

    if (previousMessage && previousMessage.role === role) {
      previousMessage.content += `|||${content}`;
    } else {
      historyContext.push({
        role,
        content
      });
    }
  }

  return historyContext;
};


// ==============================
// AI 统一请求 / 错误处理引擎
// ==============================

const fetchAiCompletion = async (systemPrompt, historyContext = [], configOverride = null) => {
  const apiSettings = configOverride ? null : await db.settings.get('apiConfig');
  const apiConfig = configOverride || apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return {
      error: true,
      code: 'CONFIG_MISSING',
      message: '请先在系统设置中配置有效的 API Base URL 与 API Key。'
    };
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
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

    if (!response.ok) {
      let errorDetail = response.statusText || '请求未成功';

      try {
        const errorData = await response.json();
        errorDetail = errorData?.error?.message || errorData?.message || errorDetail;
      } catch (err) {
        // 某些 API 会返回 HTML 或纯文本错误页，此时保留 statusText。
      }

      return {
        error: true,
        code: `HTTP_${response.status}`,
        message: `[API Error ${response.status}] ${errorDetail}`
      };
    }

    const data = await response.json();
    const content = String(data?.choices?.[0]?.message?.content || '').trim();

    if (!content) {
      return {
        error: true,
        code: 'EMPTY_RESPONSE',
        message: 'AI 返回内容为空，请检查当前模型或 API 服务状态。'
      };
    }

    return {
      error: false,
      content
    };
  } catch (err) {
    return {
      error: true,
      code: 'NETWORK_ERROR',
      message: `网络请求失败: ${err?.message || '未知错误'}`
    };
  }
};

const saveAiErrorMessage = async (chatId, character, result) => {
  const nowIso = new Date().toISOString();

  return db.messages.add({
    chatId,
    characterId: character.id,
    sender: 'character',
    type: 'error',
    content: result.message,
    metadata: {
      errorCode: result.code,
      errorMessage: result.message
    },
    versions: [
      {
        type: 'error',
        content: result.message,
        metadata: {
          errorCode: result.code,
          errorMessage: result.message
        },
        errorCode: result.code,
        errorMessage: result.message,
        timestamp: nowIso
      }
    ],
    currentVersionIndex: 0,
    isRead: true,
    timestamp: nowIso
  });
};

const buildChatSystemPrompt = async (chatId, chat, character) => {
  const enabledWorldBooks = await db.worldBooks
    .where('isEnabled')
    .equals(1)
    .toArray();

  const characterWorldBookText = character.worldBook
    ? `\n- 专属世界书: ${character.worldBook}`
    : '';

  const worldBooksText = (enabledWorldBooks.length > 0 || characterWorldBookText)
    ? `\n【世界书背景设定】:\n${enabledWorldBooks
        .map((wb) => `- ${wb.title}: ${wb.content || ''}`)
        .join('\n')}${characterWorldBookText}`
    : '';

  let summaryEntries = [];

  if (Array.isArray(chat.summary)) {
    summaryEntries = chat.summary;
  } else if (typeof chat.summary === 'string' && chat.summary.trim()) {
    summaryEntries = [
      {
        id: 'legacy',
        content: chat.summary,
        createdAt: '早期记录',
        isAuto: true
      }
    ];
  }

  const summaryText = summaryEntries.length > 0
    ? `\n【本窗阶段性历史事实记录】:\n${summaryEntries
        .map((item, index) => `${index + 1}. [${item.createdAt || '历史'}] ${item.content}`)
        .join('\n')}`
    : '';

  const allTodos = await db.todos.toArray();

  const pendingTodos = allTodos
    .filter((todo) => !todo.isCompleted && (!todo.characterId || todo.characterId === character.id))
    .slice(0, 2);

  const todoText = pendingTodos.length > 0
    ? `\n【用户近期待办事项（仅在自然且必要时温和提及）】:\n${pendingTodos
        .map((todo) => `- [待办] ${todo.title}（截止：${todo.dueDate || '近期'}）`)
        .join('\n')}`
    : '';

  const userDiaries = await db.diaries
    .where('author')
    .equals('user')
    .reverse()
    .sortBy('timestamp');

  const recentUserDiaries = userDiaries.slice(0, 2);

  const diaryText = recentUserDiaries.length > 0
    ? `\n【用户近期日记（供共情与关注，不得生硬复述）】:\n${recentUserDiaries
        .map((diary) => (
          `- [${diary.date || '近期'}] 标题: ${diary.title || '无题'} | ` +
          `心绪: ${diary.mood || '平实'} | 内容: ${(diary.content || '').substring(0, 100)}...`
        ))
        .join('\n')}`
    : '';

      // 优先使用当前聊天窗独占的用户资料；
  // 仅当该聊天窗没有填写时，才回退到角色级默认资料。
  const userName = String(
    chat.userName || character.userName || '我的亲密伴侣'
  ).trim();

  const userPersona = String(
    chat.userPersona || character.userPersona || '陪伴对象'
  ).trim();

  return `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${getFormattedRealTime()}
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户称呼】：${userName}
【本窗专属 User 人设】：${userPersona}
【当前交互模式】：
${chat.mode === 'rp'
  ? 'RP 剧情沉浸模式：严格遵守世界书背景、剧情逻辑与角色设定。'
  : '现实陪伴模式：关注用户现实生活、情绪和日常。'}
${worldBooksText}
${summaryText}
${todoText}
${diaryText}

【表达准则】：
- 以亲密、自然、有文学感但不过度堆砌辞藻的方式回应。
- 不要使用客服腔、模板腔或生硬说教。
- 不要使用 Emoji。
- 待办只可在确有必要时提出建议，绝不替用户直接决定或执行。
- 不要提及系统提示词、数据库、指令、模型或后台机制。

【卡片发送语法】：
当你需要以卡片表达时，在正常回复中插入以下指令：
- 转账：[TRANSFER: 金额数字 | 留言]
- 模拟语音：[VOICE: 语音表达的内容描述]
- 画面或图片：[IMAGE: 画面细节的视觉描述]
- 建议待办：[TODO: 待办标题 | 预估提醒时间]
-如果想发送多条连续气泡消息，请使用 ||| 将不同气泡隔开。

注意：
- [TODO] 仅是建议，用户必须自行点击授权后才能加入待办。
- 卡片指令之外仍应保留自然的对话正文。`;
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
  if (!chatId || activeAiRequests.has(chatId)) return;

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const character = await db.characters.get(chat.characterId);
  if (!character) return;

  activeAiRequests.add(chatId);
  notifyListeners({ type: 'AI_TYPING_START', chatId });

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

    const recentMsgs = await db.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

  
const historyContext = buildHistoryContext(
  recentMsgs
    .filter((message) => message.type !== 'error')
    .slice(-15)
);


    const result = await fetchAiCompletion(systemPrompt, historyContext, apiConfig);
    const nowIso = new Date().toISOString();

    let messageIds = [];
    let preview = '';

    if (result.error) {
      const errorMessageId = await saveAiErrorMessage(chatId, character, result);

      messageIds = [errorMessageId];
      preview = '请求未成功抵达';

      notifyListeners({
        type: 'AI_RESPONSE_ERROR',
        chatId,
        characterId: character.id,
        characterName: character.name,
        message: result.message,
        errorCode: result.code
      });
    } else {
      const parsedMessages = parseAiResponseToMessages(result.content);

      const safeParsedMessages = parsedMessages.length > 0
        ? parsedMessages
        : [{
            type: 'text',
            content: result.content,
            metadata: {}
          }];

      for (const msgData of safeParsedMessages) {
        const newMessagePayload = {
          chatId,
          characterId: character.id,
          sender: 'character',
          type: msgData.type || 'text',
          content: msgData.content || '',
          metadata: msgData.metadata || {},
          versions: [
            {
              type: msgData.type || 'text',
              content: msgData.content || '',
              metadata: msgData.metadata || {},
              timestamp: nowIso
            }
          ],
          currentVersionIndex: 0,
          isRead: false,
          timestamp: nowIso
        };

        const newMessageId = await db.messages.add(newMessagePayload);
        messageIds.push(newMessageId);
      }

      preview = safeParsedMessages.find((message) => message.type === 'text')?.content
        || safeParsedMessages[0]?.content
        || '发来了一条消息';
    }

    await db.chats.update(chatId, {
      updatedAt: nowIso
    });
    // AI 回复成功后播放接收消息音效
if (!result.error) {
  playMessageSound('receive');
}


    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.avatar || '',
      preview,
      messageIds,
      timestamp: nowIso,
      isCurrentPageVisible: isDocumentVisible()
    });

    if (!isDocumentVisible()) {
      triggerSystemNotification(
        `${character.name} 发来消息`,
        preview,
        character.avatar
      );
    }

    // 只有真实 AI 回复成功时，才触发自动总结。
    if (!result.error) {
      void checkAndTriggerAutoSummary(chatId, character, apiConfig);
    }
  } catch (err) {
    console.error('Background AI task error:', err);

    notifyListeners({
      type: 'AI_RESPONSE_ERROR',
      chatId,
      characterId: character.id,
      characterName: character.name,
      message: '这一次回应没有顺利抵达，请稍后再试。'
    });
  } finally {
    activeAiRequests.delete(chatId);
    notifyListeners({ type: 'AI_TYPING_END', chatId });
  }
};

// 重新生成（重 roll）指定角色消息。
// 每次重 roll 会保留旧版本，并将新版本设为当前展示版本。
export const rerollAiResponse = async (chatId, messageId) => {
  if (!chatId || !messageId || activeAiRequests.has(chatId)) return;

  const targetMsg = await db.messages.get(messageId);

  if (!targetMsg || targetMsg.sender !== 'character') {
    return;
  }

  const chat = await db.chats.get(chatId);
  if (!chat) return;

  const character = await db.characters.get(chat.characterId);
  if (!character) return;

  activeAiRequests.add(chatId);
  notifyListeners({ type: 'AI_TYPING_START', chatId });

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    const systemPrompt = await buildChatSystemPrompt(chatId, chat, character);

    const allMessages = await db.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');

    const targetIndex = allMessages.findIndex((message) => message.id === messageId);

    // 重 roll 时只使用该消息之前的上下文，不带入原回复及后续内容。
    const historyMessages = targetIndex >= 0
      ? allMessages.slice(0, targetIndex)
      : allMessages;

    const historyContext = buildHistoryContext(
  historyMessages
    .filter((message) => message.type !== 'error')
    .slice(-15)
);


    const result = await fetchAiCompletion(systemPrompt, historyContext, apiConfig);
    const nowIso = new Date().toISOString();

    const currentVersions = Array.isArray(targetMsg.versions) && targetMsg.versions.length > 0
      ? [...targetMsg.versions]
      : [{
          type: targetMsg.type || 'text',
          content: targetMsg.content || '',
          metadata: targetMsg.metadata || {},
          timestamp: targetMsg.timestamp || nowIso
        }];

    let newVersion;

    if (result.error) {
      newVersion = {
        type: 'error',
        content: result.message,
        metadata: {
          errorCode: result.code,
          errorMessage: result.message
        },
        errorCode: result.code,
        errorMessage: result.message,
        timestamp: nowIso
      };
    } else {
      const parsed = parseAiResponseToMessages(result.content);
      const firstMessage = parsed[0] || {
        type: 'text',
        content: result.content,
        metadata: {}
      };

      newVersion = {
        type: firstMessage.type || 'text',
        content: firstMessage.content || '',
        metadata: firstMessage.metadata || {},
        timestamp: nowIso
      };
    }

    currentVersions.push(newVersion);

    await db.messages.update(messageId, {
      type: newVersion.type,
      content: newVersion.content,
      metadata: newVersion.metadata || {},
      versions: currentVersions,
      currentVersionIndex: currentVersions.length - 1,
      timestamp: nowIso
    });

    await db.chats.update(chatId, {
      updatedAt: nowIso
    });

    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.avatar || '',
      preview: newVersion.type === 'error'
        ? '重新生成未成功'
        : newVersion.content || '已重新生成回复',
      messageIds: [messageId],
      timestamp: nowIso,
      isReroll: true,
      isCurrentPageVisible: isDocumentVisible()
    });

    if (result.error) {
      notifyListeners({
        type: 'AI_RESPONSE_ERROR',
        chatId,
        characterId: character.id,
        characterName: character.name,
        message: result.message,
        errorCode: result.code,
        isReroll: true
      });
    }
  } catch (err) {
    console.error('Reroll failed:', err);

    notifyListeners({
      type: 'AI_RESPONSE_ERROR',
      chatId,
      characterId: character.id,
      characterName: character.name,
      message: '重新生成失败，请稍后再试。',
      isReroll: true
    });
  } finally {
    activeAiRequests.delete(chatId);
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
 * ---------------------------------------------------------
 * 旅行 (Travels) Sub-App 动态 AI 生成服务
 * ---------------------------------------------------------
 */

/**
 * 旅行专用：从角色库对象整理可用于旅行生成的完整角色设定。
 *
 * 注意：
 * - 不读取 chats、messages、summary 或任何聊天记录；
 * - character.userPersona 是角色编辑器历史保存的人设，
 *   不能作为本次旅行中的 User 人设使用；
 * - avatar 保留在返回快照中，供护照、机票、卡片等 UI 使用，
 *   但不会直接发送给 AI；
 * - summaryFrequency、isAutoMessageActive 是功能配置，不发送给 AI。
 */
const getTravelCharacterContext = (character) => {
  if (!character) {
    return {
      promptText: '',
      snapshot: null
    };
  }

  const serializeValue = (value) => {
    if (value === null || value === undefined || value === '') return '未设置';

    if (typeof value === 'string') return value.trim() || '未设置';

    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return String(value);
    }
  };

  const snapshot = {
    id: character.id ?? null,
    name: character.name || '',
    handle: character.handle || '',
    avatar: character.avatar || '',
    bio: character.bio || '',
    extraNotes: character.extraNotes || '',
    statusList: character.statusList ?? [],
    worldBook: character.worldBook || ''
  };

  const promptText = `【同行伴侣角色库设定】
- 角色 ID：${serializeValue(character.id)}
- 姓名：${serializeValue(character.name)}
- 称呼 / Handle：${serializeValue(character.handle)}
- 角色简介 / Bio：${serializeValue(character.bio)}
- 补充设定 / Extra Notes：${serializeValue(character.extraNotes)}
- 状态列表 / Status List：${serializeValue(character.statusList)}
- 角色专属世界书 / World Book：${serializeValue(character.worldBook)}

【仅供旅行系统识别，不作为角色剧情设定】
- 角色头像已由 UI 保存，不需要向用户描述头像文件。
- summaryFrequency 与 isAutoMessageActive 属于功能配置，不纳入旅行叙事。
- character.userPersona 是旧角色编辑资料，严禁将其当作本次旅行中用户的人设。
- 本次旅行中的用户人设必须且只能使用 travel.userPersona。`;

  return {
    promptText,
    snapshot
  };
};

/**
 * 旅行专用：读取所有已启用的全局世界书。
 *
 * 旅行允许使用角色库与启用世界书，
 * 但绝不读取 chats、messages、聊天摘要或聊天窗口内容。
 */
const getEnabledTravelWorldBooksText = async () => {
  try {
    const enabledWorldBooks = await db.worldBooks
      .where('isEnabled')
      .equals(1)
      .toArray();

    if (!enabledWorldBooks.length) return '';

    const content = enabledWorldBooks
      .map((worldBook, index) => {
        const title = worldBook.title || `世界书 ${index + 1}`;
        const text = worldBook.content || '';
        return `- ${title}：${text}`;
      })
      .join('\n');

    return `【已启用的全局世界书设定】\n${content}`;
  } catch (err) {
    console.error('Failed to load enabled travel world books:', err);
    return '';
  }
};

/**
 * 1. 动态生成伴侣的心愿目的地。
 *
 * 仅使用：
 * - 当前角色库中的角色资料；
 * - 启用世界书；
 *
 * 不使用：
 * - chats；
 * - messages；
 * - 聊天摘要；
 * - character.userPersona。
 */
export const generateCompanionWishlist = async (character) => {
  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      console.warn('Cannot generate companion wishlist: API is not configured.');
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
    const { promptText: characterContext } = getTravelCharacterContext(character);
    const worldBooksText = await getEnabledTravelWorldBooksText();

    const systemPrompt = `你现在正扮演 AI 同行伴侣「${character.name || '未命名角色'}」。

${characterContext}

${worldBooksText}

【旅行上下文规则】
1. 这是你与用户即将共同开始的双人旅行，不是你独自出行。
2. 不得假设用户未同行，不得写成你替用户单独规划人生。
3. 不得引用、猜测或编造任何聊天记录、消息内容、聊天总结。
4. 只可依据上方角色库设定及启用世界书生成内容。

【任务】
请根据你的角色性格、身份、偏好、状态设定与世界书背景，
为你和用户的下一次共同旅行提议 3 个彼此差异明显的目的地。

每个目的地必须：
- 具体而有画面感；
- 与角色设定或世界书有合理联系；
- 体现两人同行时想共同经历的事情；
- 避免总是选择同一类热门城市、海岛或固定模板。

【输出规则】
严格输出 JSON 对象，不得包含 Markdown，不得包含 Emoji：
{
  "wishlist": [
    {
      "destination": "具体地点名称",
      "reason": "在此处想和用户共同经历的事情或心绪"
    },
    {
      "destination": "具体地点名称",
      "reason": "在此处想和用户共同经历的事情或心绪"
    },
    {
      "destination": "具体地点名称",
      "reason": "在此处想和用户共同经历的事情或心绪"
    }
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
          {
            role: 'user',
            content: '请为我们下一次共同旅行提出三份不同的目的地心愿。'
          }
        ]
      })
    });

    if (!res.ok) {
      console.error(`Failed to generate companion wishlist: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('Failed to generate companion wishlist: empty AI response.');
      return null;
    }

    const parsed = JSON.parse(rawContent);

    if (!Array.isArray(parsed.wishlist) || parsed.wishlist.length === 0) {
      console.error('Failed to generate companion wishlist: invalid JSON structure.');
      return null;
    }

    const wishlist = parsed.wishlist
      .filter((item) => item && item.destination && item.reason)
      .slice(0, 3)
      .map((item) => ({
        destination: String(item.destination).trim(),
        reason: String(item.reason).trim()
      }));

    return wishlist.length > 0 ? wishlist : null;
  } catch (err) {
    console.error('Failed to generate AI companion wishlist:', err);
    return null;
  }
};

/**
 * 2. 伴侣全权决定双人惊喜旅行的目的地、住宿与航班编号。
 *
 * 不使用任何聊天记录；仅使用角色库和启用世界书。
 */
export const generateCompanionSurpriseBooking = async (character) => {
  if (!character) return null;

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      console.warn('Cannot generate surprise booking: API is not configured.');
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
    const { promptText: characterContext } = getTravelCharacterContext(character);
    const worldBooksText = await getEnabledTravelWorldBooksText();

    const systemPrompt = `你现在正扮演 AI 同行伴侣「${character.name || '未命名角色'}」。

${characterContext}

${worldBooksText}

【旅行上下文规则】
1. 你正在为你和用户两人安排一段共同的惊喜旅行。
2. 这不是你独自旅行，也不是你替不在场的用户单方面买票。
3. 不得读取、引用、猜测或编造聊天记录、消息或聊天总结。
4. 只能根据角色库设定、启用世界书和本任务要求做决定。

【任务】
请为你和用户共同决定一趟具有未知感、符合角色性格与世界观的惊喜旅行。
需要决定：
- 一个具体目的地；
- 一处有独特风格、适合两人同行入住的住宿；
- 一种简短明确的住宿风格。

目的地与住宿不能总是套用海岛、温泉、星空房等固定模板，
请优先选择最贴合当前角色设定的体验。

【输出规则】
严格输出 JSON 对象，不得包含 Markdown，不得包含 Emoji：
{
  "destination": "具体目的地名称",
  "hotelName": "具体住宿名称",
  "hotelStyle": "住宿风格或氛围描述"
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
          {
            role: 'user',
            content: '请为我们两人决定一趟共同的惊喜旅行与住宿。'
          }
        ]
      })
    });

    if (!res.ok) {
      console.error(`Failed to generate surprise booking: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('Failed to generate surprise booking: empty AI response.');
      return null;
    }

    const parsed = JSON.parse(rawContent);

    if (!parsed.destination || !parsed.hotelName) {
      console.error('Failed to generate surprise booking: invalid JSON structure.');
      return null;
    }

    return {
      destination: String(parsed.destination).trim(),
      hotelName: String(parsed.hotelName).trim(),
      hotelStyle: parsed.hotelStyle ? String(parsed.hotelStyle).trim() : '',
      flightNo: `FLIGHT-W${Math.floor(100 + Math.random() * 900)}`
    };
  } catch (err) {
    console.error('Failed to generate AI surprise booking:', err);
    return null;
  }
};

/**
 * 3. 根据「目的地 + 完整角色库设定 + 启用世界书 +
 *    本次旅行独立 User 人设 + 行囊 + 已发生旅程事件」
 * 生成共同旅行的明信片、纪念物与新插曲。
 *
 * 注意：
 * - User 人设只读取 travelObj.userPersona；
 * - 不读取 character.userPersona；
 * - 不读取 chats、messages 或聊天摘要；
 * - API 失败时返回 null，不伪造固定旅行记忆。
 */
export const generateCompanionPostcard = async (character, travelObj) => {
  if (!character || !travelObj || typeof travelObj === 'string') {
    console.warn('Cannot generate companion postcard: character or travel object is missing.');
    return null;
  }

  const destination = String(travelObj.destination || '').trim();

  if (!destination) {
    console.warn('Cannot generate companion postcard: destination is missing.');
    return null;
  }

  // 严格以本次 travel 记录为准，不使用 character.userPersona。
  const userPersona = String(travelObj.userPersona || '').trim() || '未填写';
  const luggageNotes = String(travelObj.luggageNotes || '').trim() || '未填写';

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      console.warn('Cannot generate companion postcard: API is not configured.');
      return null;
    }

    const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');
    const { promptText: characterContext } = getTravelCharacterContext(character);
    const worldBooksText = await getEnabledTravelWorldBooksText();

    const journeyEpisodes = Array.isArray(travelObj.journeyEpisodes)
      ? travelObj.journeyEpisodes
      : [];

    const previousEpisodesText = journeyEpisodes.length > 0
      ? `【本次旅行已经发生的事件】\n${journeyEpisodes
          .slice(-12)
          .map((episode, index) => {
            if (typeof episode === 'string') {
              return `${index + 1}. ${episode}`;
            }

            return `${index + 1}. ${episode?.title || episode?.spotName || '旅程片段'}：${
              episode?.content ||
              episode?.description ||
              episode?.metPerson ||
              episode?.letterContent ||
              JSON.stringify(episode)
            }`;
          })
          .join('\n')}

【避免重复要求】
新的场景、偶遇对象、共同活动、礼物和叙事角度必须尽量避开以上已发生事件。`
      : '【本次旅行已经发生的事件】\n暂无。这是本次旅行的第一段可记录片段。';

    const systemPrompt = `你现在正扮演 AI 同行伴侣「${character.name || '未命名角色'}」。

${characterContext}

${worldBooksText}

【本次共同旅行资料】
- 目的地：${destination}
- 用户本次旅行独立人设：${userPersona}
- 用户本次旅行行囊备注：${luggageNotes}

${previousEpisodesText}

【绝对边界】
1. 这是用户与你正在共同进行的旅行；用户始终在场。
2. 严禁写成你独自去旅行、用户不在场、你独自买完礼物再带回给用户。
3. 明信片是共同旅程的留档：由你写给用户，但记录的是你们刚刚一起经历的瞬间。
4. 礼物必须是你们共同发现、共同挑选并留作纪念的当地物件；
   也可以是你悄悄为用户选中的礼物，但必须发生在两人同行的现场。
5. 只能使用角色库、启用世界书和本次 travel 数据。
6. 不得读取、引用、猜测或编造 chats、messages、聊天摘要或旧角色 User Persona。
7. 禁止输出任何 Emoji。

【任务】
请记录你们刚刚在「${destination}」共同经历的一个具体瞬间，并生成：
1. 一个当地细分地点；
2. 一封写给“你”的手写明信片正文，100 至 200 字；
3. 一个具有当地特色、与共同经历有关的实体纪念物；
4. 一个自然发生的路人、动物、天气变化或小插曲；
5. 一个适合此刻照片留档的艺术视觉风格。

【输出规则】
严格输出 JSON 对象，不得包含 Markdown：
{
  "spotName": "目的地下的具体细分地点名称",
  "letterContent": "写给你的共同旅行明信片正文",
  "giftItem": "两人共同发现、共同挑选或在同行现场为用户挑选的具体纪念物及简短描述",
  "metPerson": "本次新发生的路人、动物、天气或趣味插曲",
  "photoStyle": "照片艺术视觉风格描述"
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
          {
            role: 'user',
            content: `请记录我们刚刚在「${destination}」共同经历的一个旅行瞬间，并生成这段旅程的明信片留档。`
          }
        ]
      })
    });

    if (!res.ok) {
      console.error(`Failed to generate companion postcard: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('Failed to generate companion postcard: empty AI response.');
      return null;
    }

    const parsed = JSON.parse(rawContent);

    if (!parsed.spotName || !parsed.letterContent) {
      console.error('Failed to generate companion postcard: invalid JSON structure.');
      return null;
    }

    return {
      spotName: String(parsed.spotName).trim(),
      letterContent: String(parsed.letterContent).trim(),
      giftItem: parsed.giftItem ? String(parsed.giftItem).trim() : '',
      metPerson: parsed.metPerson ? String(parsed.metPerson).trim() : '',
      photoStyle: parsed.photoStyle ? String(parsed.photoStyle).trim() : ''
    };
  } catch (err) {
    console.error('Failed to generate AI companion postcard:', err);
    return null;
  }
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

/**
 * Snapshots AI 主动 / 邀约发动态 API 真实生成
 */
export const generateSnapshotPostByAi = async (
  characterId,
  topicHint = '',
  linkedChatId = null
) => {
  try {
    const character = await db.characters.get(characterId);
    if (!character) throw new Error('Character not found');

    const apiKeySetting = await db.settings.get('apiKey');
    const baseUrlSetting = await db.settings.get('baseUrl');
    const modelSetting = await db.settings.get('model');

    const apiKey = apiKeySetting?.value;
    const baseUrl = (baseUrlSetting?.value || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = modelSetting?.value || 'gpt-4o-mini';

    if (!apiKey) {
      console.warn('API Key is missing, falling back to static prompt');

      return {
        imagePrompt: `[画面描摹: ${character.name} 在桌前记录下 ${topicHint || '落日余晖'} 的定格瞬间]`,
        content: `今天也想把这份温度分享记录下来。${topicHint || '生活里的细枝末节也很美。'}`,
        location: '日常陪伴角落'
      };
    }

    let characterContext = [
      `角色姓名: ${character.name}`,
      `角色简介: ${character.bio || '无'}`,
      `扩展设定: ${character.extraNotes || '无'}`
    ].join('\n');

    if (character.statusList && character.statusList.length > 0) {
      characterContext += `\n当前状态: ${JSON.stringify(character.statusList)}`;
    }

    const enabledWorldBooks = await db.worldBooks
      .where('isEnabled')
      .equals(1)
      .toArray();

    if (enabledWorldBooks.length > 0) {
      characterContext += `\n世界观背景: ${enabledWorldBooks
        .map((worldBook) => worldBook.title)
        .join('; ')}`;
    }

    let chatMemory = '';

    if (linkedChatId) {
      const recentMessages = await db.messages
        .where('chatId')
        .equals(linkedChatId)
        .reverse()
        .limit(6)
        .toArray();

      if (recentMessages.length > 0) {
        chatMemory =
          '\n最近聊天记忆:\n' +
          recentMessages
            .reverse()
            .map((message) => `${message.sender}: ${message.content}`)
            .join('\n');
      }
    }

    const savedPersona = await db.snapshotSettings.get('globalPersona');
    const globalPersonaText = savedPersona?.value || '未设置全局User人设';

    const systemPrompt = `你正在扮演角色 [${character.name}]。你需要在类似 Instagram / 拍立得动态圈中发布一条生活快照动态。

绝对规则：
1. 输出必须是严格的 JSON 格式，包含三个字段：
   - "imagePrompt": 照片画面的细节描摹，包含光影、物件、微观视觉，写得极其有生活触感与文学感，80字以内；
   - "content": 配合照片写下的随感短句，温情、留白、浪漫或幽默，不超过120字；
   - "location": 简短的打卡地点名称，例如：午后书房、街角咖啡馆、晴空下；
2. 绝不包含任何 Emoji 字符；
3. 严格符合你的角色设定。

【当前真实时间】: ${getFormattedRealTime()}

【角色人设信息】:
${characterContext}

【全局 User 人设】:
${globalPersonaText}

${chatMemory
  ? `【近期互动记忆】:\n${chatMemory}`
  : '【注意】: 未关联聊天框，绝对禁止使用聊天历史！仅凭个人设定发布动态。'}`;

    const userPrompt = topicHint
      ? `请围绕主题灵感 “[${topicHint}]” 创作一条拍立得动态。`
      : '请根据你此刻的心境，创作一条拍立得生活动态。';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
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
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        imagePrompt: parsed.imagePrompt || '',
        content: parsed.content || '',
        location: parsed.location || ''
      };
    }

    return {
      imagePrompt: `[画面描摹: ${character.name} 记录的日常镜头]`,
      content: rawText.replace(
        /[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]/g,
        ''
      ),
      location: '某处空间'
    };
  } catch (err) {
    console.error('Failed to generate snapshot by AI:', err);

    return {
      imagePrompt: '[画面描摹: 静谧阳光洒在复古桌面上]',
      content: '这一刻的安宁值得被记录。',
      location: '日常生活'
    };
  }
};


/**
 * Snapshots AI 智能生成评论 API
 */
export const generateSnapshotCommentByAi = async (snapshot, commenter) => {
  try {
    const apiKeySetting = await db.settings.get('apiKey');
    const baseUrlSetting = await db.settings.get('baseUrl');
    const modelSetting = await db.settings.get('model');

    const apiKey = apiKeySetting?.value;
    const baseUrl = (baseUrlSetting?.value || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = modelSetting?.value || 'gpt-4o-mini';

    let commenterInfo = '';
    let relationInfo = '常规社交好友/路人';

    if (commenter.type === 'character') {
      const character = await db.characters.get(commenter.data.id);

      if (!character) {
        throw new Error('Commenter character not found');
      }

      commenterInfo = [
        `角色姓名: ${character.name}`,
        `角色简介: ${character.bio || '无'}`,
        `性格扩展: ${character.extraNotes || '无'}`
      ].join('\n');

      if (
        snapshot.characterId &&
        snapshot.characterId !== character.id
      ) {
        const relation = await db.snapshotRelations
          .where('characterId')
          .equals(snapshot.characterId)
          .and((item) => item.targetCharacterId === character.id)
          .first();

        if (relation) {
          relationInfo = `你与动态作者的关系描述为: [${relation.relation}]`;
        }
      }
    } else {
      commenterInfo = `NPC 姓名: ${commenter.data.name}\n身份标签: ${
        commenter.data.roleTag || '路人'
      }`;
    }

    if (!apiKey) {
      return '照片里的光影真的很棒！';
    }

    const systemPrompt = `你正在社交动态圈里为一条拍立得动态撰写评论。

【动态作者】:
${snapshot.authorName}

【动态画面描摹】:
${snapshot.imagePrompt || '无'}

【动态正文】:
${snapshot.content || '无'}

【你的身份/评论者人设】:
${commenterInfo}

【你与作者的关系约束】:
${relationInfo}

绝对规则：
1. 生成一段自然的短评，20至60字以内；
2. 语气可温情、打趣、吐槽、调侃，但绝对不能越界；
3. 非情侣关系的各角色之间严禁出现亲密暧昧语言；
4. 严格禁止出现任何 Emoji 字符；
5. 直接返回评论文本，不要附带引号或额外说明。`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    return text.replace(
      /[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]/g,
      ''
    );
  } catch (err) {
    console.error('Failed to generate snapshot comment by AI:', err);
    return '记录得很有味道。';
  }
};


export default {
  subscribeAiEvents,
  subscribeSummaryStatus,
  triggerAiResponse,
  rerollAiResponse,
  generateCharacterHomeBoardMessage,
  generateCompanionReplyForDiary,
  generateCompanionProactiveDiary,
  generateCompanionWishlist,
  generateCompanionSurpriseBooking,
  generateCompanionPostcard,
  generateSnapshotPostByAi,
  generateSnapshotCommentByAi,
  requestNotificationPermission,
  triggerSystemNotification,
  playMessageSound
};
