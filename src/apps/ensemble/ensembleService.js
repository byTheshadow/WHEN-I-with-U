import db from '../../db';

// 1. 获取全局 API 配置
export const getApiConfig = async () => {
  try {
    const settingDoc = await db.settings.get('apiConfig');
    if (!settingDoc || !settingDoc.value) {
      throw new Error('未配置 API Key 或 Base URL，请前往全局设置页面配置');
    }
    const { baseUrl, apiKey, model } = settingDoc.value;
    if (!apiKey) {
      throw new Error('API Key 为空，请前往设置中填写');
    }
    return {
      baseUrl: baseUrl || 'https://api.openai.com/v1',
      apiKey,
      model: model || 'gpt-4o'
    };
  } catch (err) {
    console.error('getApiConfig error:', err);
    throw err;
  }
};

// 2. 发起 OpenAI 通用请求
export const callAiAPI = async (messages, options = {}) => {
  const { baseUrl, apiKey, model } = await getApiConfig();
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const targetUrl = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.85,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI 请求失败 [${response.status}]: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

// 3. 构建多角色大群系统 Prompt
export const buildEnsembleSystemPrompt = async (chat, targetCharacterId = null) => {
  // 读取已选关联角色的原有人设信息
  const selectedCharIds = chat.selectedCharacterIds || [];
  const charDocs = await db.characters.where('id').anyOf(selectedCharIds).toArray();
  
  const charDetails = charDocs.map((c) => {
    const override = chat.characterOverrides?.[c.id] || {};
    return `- 【角色名称】: ${c.name}
  【原始人设】: ${c.bio || '无'}
  【在当前场景的角色特定行为规则/补充】: ${override.notes || '遵循原人设'}
  【与其他角色的关系认知】: ${override.relations || '正常朋友/同伴'}`;
  }).join('\n\n');

  // 读取 User 身份列表
  const userIdentities = chat.userIdentities || [];
  const userDetails = userIdentities.map(u => 
    `- 【用户身份卡】名称: "${u.name}", 人设: ${u.persona || '主视角用户'}`
  ).join('\n');

  // 读取已有的剧情/关系总结
  const summaries = await db.ensembleSummaries.where('chatId').equals(chat.id).toArray();
  const summaryText = summaries.length > 0 
    ? summaries.map((s, idx) => `[剧情总结阶段 ${idx + 1}]: ${s.summaryText}\n[关系变化]: ${s.relationChangesText}`).join('\n')
    : '暂无历史总结';

  const systemContent = `你是一个充满戏剧张力与真实感的多角色沙龙剧场 AI。
你正处于羁绊群聊【${chat.title}】中。

【当前大群场景/环境设定 (Scene Prompt)】:
${chat.scenePrompt || '无特殊环境，大家在群里聊天'}

【群内参与的 AI 角色列表及其人设与关系】:
${charDetails}

【场景内可能出现的 User 身份视角】:
${userDetails}

【截至目前的剧情历史与关系演变总结】:
${summaryText}

【绝对规则】:
1. 严禁在输出中包含任何 Emoji 表情！
2. 严禁打破第四面墙，必须深度沉浸在角色性格与语调中。
3. 你的输出必须是合法的 JSON 格式，包含一个 \`responses\` 数组。格式如下：
{
  "responses": [
    {
      "characterId": 角色ID(数字),
      "characterName": "角色名字",
      "content": "角色说的对话内容"
    }
  ]
}
4. 如果指定了特定的【召唤角色】，请必须至少让该角色发言。如果未指定，请由你根据剧情走向自决由 1 个或最多 2 个适合的角色接话回应。`;

  return systemContent;
};

// 4. 触发 AI 生成回复 (支持指定召唤或 AI 自决，支持 Chain Dialogue 串行)
export const generateEnsembleAiResponse = async (chatId, options = {}) => {
  const { targetCharacterId = null, maxRounds = 1 } = options;
  const chat = await db.ensembleChats.get(chatId);
  if (!chat) throw new Error('找不到该群聊');

  // 读取近 30 条消息作为上下文
  const historyMsgs = await db.ensembleMessages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(30)
    .toArray();
  
  historyMsgs.reverse();

  const systemPrompt = await buildEnsembleSystemPrompt(chat, targetCharacterId);

  const formattedHistory = historyMsgs.map((m) => {
    let prefix = '';
    if (m.senderType === 'user') {
      prefix = `[User视角:${m.senderName}]`;
    } else {
      prefix = `[AI角色:${m.senderName}]`;
    }

    if (m.type === 'sticker') {
      return `${prefix}: [发送了表情包: ${m.content}]`;
    }
    if (m.type === 'voice') {
      return `${prefix}: [发送了语音卡片: "${m.content}"]`;
    }
    if (m.type === 'image') {
      return `${prefix}: [发送了图片]`;
    }
    return `${prefix}: ${m.content}`;
  });

  const promptMessages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory.map(h => ({ role: 'user', content: h }))
  ];

  if (targetCharacterId) {
    const charDocs = await db.characters.where('id').equals(Number(targetCharacterId)).toArray();
    const charName = charDocs[0]?.name || '指定角色';
    promptMessages.push({
      role: 'user',
      content: `[系统指令]: 请强制让角色【${charName}】对上一条消息做出回应。`
    });
  }

  const rawResult = await callAiAPI(promptMessages, { jsonMode: true });

  let parsed = { responses: [] };
  try {
    parsed = JSON.parse(rawResult);
  } catch (e) {
    // 兜底提取
    const match = rawResult.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    }
  }

  const generatedMessages = [];
  if (Array.isArray(parsed.responses)) {
    const selectedCharIds = chat.selectedCharacterIds || [];
    const charDocs = await db.characters.where('id').anyOf(selectedCharIds).toArray();
    const charMap = new Map(charDocs.map(c => [c.id, c]));

    for (const item of parsed.responses) {
      const charObj = charMap.get(Number(item.characterId)) || charDocs.find(c => c.name === item.characterName);
      if (charObj && item.content) {
        // 清除任何可能遗留的 Emoji
        const cleanContent = item.content.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
        
        const newMsg = {
          chatId,
          senderId: `char_${charObj.id}`,
          senderName: charObj.name,
          senderAvatar: charObj.avatar || '',
          senderType: 'character',
          characterId: charObj.id,
          type: 'text',
          content: cleanContent,
          quotedMessageId: null,
          versions: [cleanContent],
          currentVersionIndex: 0,
          timestamp: Date.now()
        };
        const insertedId = await db.ensembleMessages.add(newMsg);
        newMsg.id = insertedId;
        generatedMessages.push(newMsg);
      }
    }
  }

  // 更新大群最后活跃时间
  await db.ensembleChats.update(chatId, { updatedAt: Date.now() });

  return generatedMessages;
};

// 5. 剧情与角色关系变化自动总结
export const generateEnsembleSummary = async (chatId) => {
  const chat = await db.ensembleChats.get(chatId);
  if (!chat) return;

  const msgs = await db.ensembleMessages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(40)
    .toArray();
  msgs.reverse();

  if (msgs.length < 5) return;

  const conversationText = msgs.map(m => `${m.senderName}: ${m.content}`).join('\n');

  const prompt = [
    {
      role: 'system',
      content: `你是一个剧场剧情记录员。请总结以下群聊对话的主要剧情发展以及角色之间关系的变化（如有）。
绝对零 Emoji！请以 JSON 格式输出：
{
  "summaryText": "关键剧情发展总结...",
  "relationChangesText": "角色之间的互动与关系微妙变化..."
}`
    },
    { role: 'user', content: conversationText }
  ];

  const raw = await callAiAPI(prompt, { jsonMode: true });
  try {
    const data = JSON.parse(raw);
    await db.ensembleSummaries.add({
      chatId,
      summaryText: data.summaryText || '无重大剧情变更',
      relationChangesText: data.relationChangesText || '关系保持稳定',
      createdAt: Date.now()
    });
  } catch (e) {
    console.error('生成总结解析失败', e);
  }
};
