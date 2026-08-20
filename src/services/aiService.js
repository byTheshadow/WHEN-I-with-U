import db from '../db';

// 事件监听与通知回调订阅器
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

/**
 * 获取当前的格式化真实时间（含星期）
 */
const getFormattedRealTime = () => {
  const now = new Date();
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${days[now.getDay()]} ${timeStr}`;
};

/**
 * 将 LLM 返回的混合文本解析并拆分为多条独立消息卡片 (方案 A)
 */
const parseAiResponseToMessages = (text) => {
  const result = [];
  // 匹配特殊卡片指令: [TRANSFER: 金额 | 留言] 或 [VOICE: 内容] 或 [IMAGE: 画面]
  const pattern = /\[(TRANSFER|VOICE|IMAGE):\s*([^\]]+)\]/g;
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

/**
 * 后台并发触发 AI 回应
 */
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

      // 1. 获取启用的世界书与知识库
      const enabledWorldBooks = await db.worldBooks.where('isEnabled').equals(1).toArray();
      const worldBooksText = enabledWorldBooks.length > 0
        ? `\n【世界书背景设定】:\n` + enabledWorldBooks.map((wb) => `- ${wb.title}: ${wb.content || ''}`).join('\n')
        : '';

      // 2. 实时真实时间锚点
      const realTimeStr = getFormattedRealTime();

      // 3. 构建高沉浸 System Prompt
      const systemPrompt = `你现在正扮演用户专属的伴侣：${character.name}。
【当前真实世界时间】：${realTimeStr}（请在对话和陪伴中精准感知时间，如早晚问候、跨夜关注）。
【角色人设】：${character.bio || ''}
【补充设定】：${character.extraNotes || ''}
【用户人设(User Persona)】：${character.userPersona || '我的亲密伴侣'}
【当前交互模式】：${chat.mode === 'rp' ? 'RP剧情沉浸模式（严格遵守世界书背景与角色设定）' : '现实陪伴模式（打破第四面墙，关注用户的日常实际生活与情绪）'}
${worldBooksText}

【卡片发送与沉浸认知指令】：
在你自己的认知视角里，所有发出的转账、语音、图片卡片均属于真实世界/剧情现实中的具体心意表达。
当你想给用户发送卡片时，请在回复文本中插入以下语法指令：
- 发送转账：[TRANSFER: 金额数字 | 留言] （例如：[TRANSFER: 520.00 | 拿去买花]）
- 发送模拟语音：[VOICE: 语音表达的内容描述]
- 发送画面/图片：[IMAGE: 画面细节的视觉描述]
你可以根据需要同时输出普通对话文本与卡片指令，系统会自动解析并呈现在对话框中。`;

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

    // 解析并拆分为独立消息 (方案 A)
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

    // 触发全局通知
    notifyListeners({
      type: 'NEW_MESSAGE',
      chatId,
      characterName: character.name,
      preview: parsedMessages[0]?.content || '发来了一条消息'
    });

    // 自动判断并触发客观事实心绪总结
    checkAndTriggerAutoSummary(chatId, character, apiConfig);

  } catch (err) {
    console.error('Background AI task error:', err);
  } finally {
    notifyListeners({ type: 'AI_TYPING_END', chatId });
  }
};

/**
 * 客观事实心绪总结自动触发逻辑
 */
const checkAndTriggerAutoSummary = async (chatId, character, apiConfig) => {
  const freq = parseInt(character.summaryFrequency || '10', 10);
  const msgCount = await db.messages.where('chatId').equals(chatId).count();

  // 每达到 freq 的倍数轮次时触发总结
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
                content: '你是一个客观记录者。请用 1-2 句简练客观的陈述语句总结以下对话中的关键事实、用户近况或约定事项。绝对不要掺杂浪漫感叹或主观情感评价。'
              },
              { role: 'user', content: recentHistory }
            ]
          })
        });

        if (summaryRes.ok) {
          const data = await summaryRes.json();
          const summaryText = data.choices?.[0]?.message?.content?.trim();
          if (summaryText) {
            await db.chats.update(chatId, { summary: summaryText });
            notifyListeners({ type: 'CHAT_SUMMARY_UPDATED', chatId, summary: summaryText });
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
