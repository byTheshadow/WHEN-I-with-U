import db from '../../db';

/**
 * 安全接入 API 调用（适配各种环境导出）
 */
/**
 * 与全局 Settings 中 apiConfig 配置兼容的 AI 调用引擎。
 *
 * settings 表记录结构：
 * {
 *   key: 'apiConfig',
 *   value: {
 *     baseUrl: 'https://...',
 *     apiKey: 'sk-...',
 *     model: 'gpt-4o'
 *   }
 * }
 */
const callAiAPI = async (systemPrompt, messagesHistory) => {
  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      throw new Error('请先在系统 Settings 页面配置有效的 API Base URL 与 API Key。');
    }

    const baseUrl = String(apiConfig.baseUrl).replace(/\/+$/, '');
    const model = apiConfig.model || 'gpt-3.5-turbo';

    const formattedMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messagesHistory.map((message) => ({
        role: message.senderType === 'user' ? 'user' : 'assistant',
        content: `[${message.senderName}]: ${message.content}`
      }))
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 响应错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || '';

    if (!resultText.trim()) {
      throw new Error('API 未返回有效的文本内容。');
    }

    return resultText.trim();
  } catch (error) {
    console.error('Imaginarium AI Call Error:', error);
    throw error;
  }
};


/**
 * 格式化多角色与总结的 System Prompt
 */
const buildSystemPrompt = (chat, targetNpcId = null, summaries = []) => {
  const members = chat.members || [];
  const membersDesc = members
    .map((m) => `【角色ID: ${m.id}】姓名: ${m.name}\n人设设定: ${m.bio || '无'}`)
    .join('\n\n');

  const summariesText = summaries.length > 0
    ? summaries.map((s, idx) => `阶段总结 ${idx + 1}: ${s.content}`).join('\n')
    : '暂无历史梗概';

  let prompt = `你是一个充满浪漫拟物艺术感的虚拟沙龙故事演绎者。
当前沙龙主题为：《${chat.title || '未命名沙龙'}》
沙龙叙述说明: ${chat.description || '无'}

【用户身份 (User Identity)】
姓名: ${chat.userName || '我'}
人设: ${chat.userPersona || '普通参与者'}

【沙龙历史总结梗概】
${summariesText}

【沙龙虚拟成员列表】
${membersDesc}

你将扮演上述虚拟成员中的角色。
回复规则：
1. 绝对不要使用原生 Emoji 符号。
2. 保持与说话人设相契合的语言风格。
3. 请以 JSON 格式输出你的回复，包含 selectedSenderId (发言角色的ID) 和 content (发言文本)，格式如下：
\`\`\`json
{
  "selectedSenderId": "选中的角色ID",
  "content": "角色回复的文本..."
}
\`\`\`
`;

  if (targetNpcId) {
    const target = members.find((m) => m.id === targetNpcId);
    if (target) {
      prompt += `\n【强制指令】本次回复必须由角色《${target.name}》(ID: ${target.id}) 发言回应！`;
    }
  } else {
    prompt += `\n【智能指令】请根据聊天脉络，自主选择一个最适合接话的角色发言，并在 selectedSenderId 中返回该角色的 ID。`;
  }

  return prompt;
};

// =====================================
// 数据库操作函数
// =====================================

export const getImaginariumChats = async () => {
  return await db.imaginariumChats.orderBy('updatedAt').reverse().toArray();
};

export const getImaginariumChatById = async (chatId) => {
  return await db.imaginariumChats.get(Number(chatId));
};

export const createImaginariumChat = async (chatData) => {
  const cleanData = { ...chatData };
  if (cleanData.id === null) delete cleanData.id;
  const now = Date.now();
  cleanData.createdAt = cleanData.createdAt || now;
  cleanData.updatedAt = now;
  cleanData.members = cleanData.members || [];
  cleanData.userName = cleanData.userName || '我';
  cleanData.userPersona = cleanData.userPersona || '沙龙的主人';
  cleanData.userAvatar = cleanData.userAvatar || '';
  cleanData.bgOpacity = cleanData.bgOpacity ?? 0.3;
  cleanData.customCss = cleanData.customCss || '';

  const newId = await db.imaginariumChats.add(cleanData);
  return newId;
};

export const updateImaginariumChat = async (chatId, updates) => {
  const cleanUpdates = { ...updates, updatedAt: Date.now() };
  if (cleanUpdates.id) delete cleanUpdates.id;
  await db.imaginariumChats.update(Number(chatId), cleanUpdates);
};

export const deleteImaginariumChat = async (chatId) => {
  const idNum = Number(chatId);
  await db.imaginariumChats.delete(idNum);
  await db.imaginariumMessages.where('chatId').equals(idNum).delete();
  await db.imaginariumSummaries.where('chatId').equals(idNum).delete();
};

export const getImaginariumMessages = async (chatId) => {
  return await db.imaginariumMessages
    .where('chatId')
    .equals(Number(chatId))
    .sortBy('timestamp');
};

export const addImaginariumMessage = async (msgData) => {
  const cleanData = { ...msgData };
  if (cleanData.id === null) delete cleanData.id;
  cleanData.timestamp = cleanData.timestamp || Date.now();
  cleanData.versions = cleanData.versions || [cleanData.content];
  cleanData.currentVersionIndex = cleanData.currentVersionIndex || 0;

  const id = await db.imaginariumMessages.add(cleanData);
  await db.imaginariumChats.update(cleanData.chatId, { updatedAt: Date.now() });
  return { ...cleanData, id };
};

export const updateImaginariumMessage = async (msgId, updates) => {
  await db.imaginariumMessages.update(Number(msgId), updates);
};

export const deleteImaginariumMessage = async (msgId) => {
  await db.imaginariumMessages.delete(Number(msgId));
};

// 总结表 CRUD
export const getImaginariumSummaries = async (chatId) => {
  return await db.imaginariumSummaries
    .where('chatId')
    .equals(Number(chatId))
    .sortBy('createdAt');
};

export const addImaginariumSummary = async (chatId, content) => {
  const clean = { chatId: Number(chatId), content, createdAt: Date.now() };
  const id = await db.imaginariumSummaries.add(clean);
  return { ...clean, id };
};

export const updateImaginariumSummary = async (summaryId, content) => {
  await db.imaginariumSummaries.update(Number(summaryId), { content });
};

export const deleteImaginariumSummary = async (summaryId) => {
  await db.imaginariumSummaries.delete(Number(summaryId));
};

// 生成 AI 总结
export const generateSummaryForChat = async (chatId) => {
  const chat = await getImaginariumChatById(chatId);
  const messages = await getImaginariumMessages(chatId);
  if (!messages || messages.length === 0) {
    throw new Error('当前群聊尚无消息，无法生成总结');
  }

  const historyText = messages
    .slice(-30)
    .map((m) => `${m.senderName}: ${m.content}`)
    .join('\n');

  const systemPrompt = `你是一个文学散文风的故事速记员。
请对以下《${chat.title}》沙龙近期的对话历史做一个简短精炼、充满艺术氛围的阶段总结（100字以内）。
绝对不要使用原生 Emoji。`;

  const summaryResult = await callAiAPI(systemPrompt, [
    { senderType: 'user', senderName: '记录员', content: `请根据以下对话做阶段梗概:\n${historyText}` }
  ]);

  const cleanContent = summaryResult.replace(/^```json/g, '').replace(/```$/g, '').trim();
  return await addImaginariumSummary(chatId, cleanContent);
};

// =====================================
// AI 触发响应核心逻辑
// =====================================

export const triggerImaginariumAI = async (chatId, targetNpcId = null) => {
  const chat = await getImaginariumChatById(chatId);
  const messages = await getImaginariumMessages(chatId);
  const summaries = await getImaginariumSummaries(chatId);

  const systemPrompt = buildSystemPrompt(chat, targetNpcId, summaries);
  const recentHistory = messages.slice(-15);

  const rawAiResult = await callAiAPI(systemPrompt, recentHistory);

  // 解析返回的 JSON 格式
  let selectedSenderId = targetNpcId;
  let content = rawAiResult;

  try {
    const jsonMatch = rawAiResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.selectedSenderId) selectedSenderId = parsed.selectedSenderId;
      if (parsed.content) content = parsed.content;
    }
  } catch (e) {
    console.warn('AI Response was not strictly JSON, fallback to raw text parsing');
  }

  const members = chat.members || [];
  const matchedMember = members.find((m) => m.id === selectedSenderId) || members[0] || {
    id: 'npc_unknown',
    name: '沙龙成员',
    avatar: ''
  };

  const newMsg = {
    chatId: Number(chatId),
    senderId: matchedMember.id,
    senderName: matchedMember.name,
    senderAvatar: matchedMember.avatar,
    senderType: 'ai',
    type: 'text',
    content: content,
    versions: [content],
    currentVersionIndex: 0,
    timestamp: Date.now()
  };

  return await addImaginariumMessage(newMsg);
};
