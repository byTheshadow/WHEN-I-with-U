import db from '../../db';

export const getApiConfig = async () => {
  const settingDoc = await db.settings.get('apiConfig');
  if (!settingDoc || !settingDoc.value) {
    throw new Error('未配置 API Key，请前往设置配置');
  }
  const { baseUrl, apiKey, model } = settingDoc.value;
  if (!apiKey) throw new Error('API Key 为空');
  return {
    baseUrl: baseUrl || 'https://api.openai.com/v1',
    apiKey,
    model: model || 'gpt-4o'
  };
};

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

// 拼接多角色 + 本群独占角色 + 方向性关系 + 全量历史总结 Prompt
export const buildEnsembleSystemPrompt = async (chat) => {
  // 1. 全局角色
  const selectedCharIds = chat.selectedCharacterIds || [];
  const globalChars = await db.characters.where('id').anyOf(selectedCharIds).toArray();
  
  // 2. 本群独占角色
  const localChars = chat.localCharacters || [];

  const allMembers = [
    ...globalChars.map(c => ({ id: `global_${c.id}`, rawId: c.id, name: c.name, bio: c.bio, isLocal: false })),
    ...localChars.map(c => ({ id: c.id, rawId: c.id, name: c.name, bio: c.bio, isLocal: true }))
  ];

  // 关系矩阵
  const relations = chat.relationsMatrix || [];
  const relationText = relations.length > 0
    ? relations.map(r => `- 【${r.sourceName}】对【${r.targetName}】的关系看法: ${r.relation}`).join('\n')
    : '暂未特别指定方向性关系，按常识与性格自然互动。';

  // 场景与补充
  const overrides = chat.characterOverrides || {};
  const charDetails = allMembers.map(c => {
    const ov = overrides[c.rawId] || {};
    return `- 【角色名称】: ${c.name}
  【性格/人设】: ${c.bio || '无'}
  【本群特别设定】: ${ov.notes || '无'}`;
  }).join('\n\n');

  // User 身份
  const userIdentities = chat.userIdentities || [];
  const userDetails = userIdentities.map(u => 
    `- 【User 身份】"${u.name}" (人设: ${u.persona || '视角用户'})`
  ).join('\n');

  // 全量历史总结 (全部有效)
  const summaries = await db.ensembleSummaries.where('chatId').equals(chat.id).toArray();
  const summaryText = summaries.length > 0
    ? summaries.map((s, idx) => `[剧情阶段 ${idx + 1} (${s.source === 'manual' ? '手动记录' : '自动生成'})]: ${s.summaryText}\n[关系变化]: ${s.relationChangesText}`).join('\n\n')
    : '暂无历史总结记录';

  return `你是一个具有沉浸物化审美与极佳戏剧感的多角色大群 AI 引擎。
你正处于羁绊群聊【${chat.title}】中。

【场景环境 (Scene Prompt)】:
${chat.scenePrompt || '无特殊环境，角色在群聊中自然互动'}

【出场 AI 角色列表】:
${charDetails}

【方向性关系认知矩阵】:
${relationText}

【当前存在的 User 视角身份】:
${userDetails}

【全量历史剧情与关系总结 (均有效)】:
${summaryText}

【绝对规则】:
1. 绝对严禁 Emoji 表情！图标由 Lucide 矢量图标承担。
2. 保持深刻的角色沉浸度，切勿破壁。
3. 必须输出合法的 JSON 格式，其中 \`responses\` 数组最多可包含 10 条连续的 AI 角色回应，格式如下：
{
  "responses": [
    {
      "senderName": "角色名字",
      "content": "角色回复内容",
      "type": "text"
    }
  ]
}
4. 你可以自决由 1 个或多个角色轮流接话（单次最多 10 条），形成连贯剧情流。`;
};

// 执行 AI 链式生成
export const generateEnsembleAiResponse = async (chatId, options = {}, onTypingUpdate) => {
  const { targetCharacterName = null } = options;
  const chat = await db.ensembleChats.get(chatId);
  if (!chat) throw new Error('大群不存在');

  const historyMsgs = await db.ensembleMessages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(30)
    .toArray();
  historyMsgs.reverse();

  const systemPrompt = await buildEnsembleSystemPrompt(chat);

  const formattedHistory = historyMsgs.map((m) => {
    const prefix = m.senderType === 'user' ? `[User:${m.senderName}]` : `[AI:${m.senderName}]`;
    if (m.type === 'sticker') return `${prefix}: [发送了表情包: ${m.metadata?.name || 'Sticker'}]`;
    if (m.type === 'image') return `${prefix}: [发送了图片叙事卡: "${m.content}"]`;
    if (m.type === 'voice') return `${prefix}: [发送了语音: "${m.content}"]`;
    return `${prefix}: ${m.content}`;
  });

  const promptMessages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory.map(h => ({ role: 'user', content: h }))
  ];

  if (targetCharacterName) {
    promptMessages.push({
      role: 'user',
      content: `[系统指令]: 请让角色【${targetCharacterName}】优先发言回应。`
    });
  }

  if (onTypingUpdate) onTypingUpdate({ isTyping: true, characterName: targetCharacterName || '角色们' });

  const rawResult = await callAiAPI(promptMessages, { jsonMode: true });

  let parsed = { responses: [] };
  try {
    parsed = JSON.parse(rawResult);
  } catch (e) {
    const match = rawResult.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }

  const generatedMessages = [];
  if (Array.isArray(parsed.responses)) {
    // 限制单次最高 10 条
    const sliceResponses = parsed.responses.slice(0, 10);
    
    for (const item of sliceResponses) {
      if (!item.content || !item.senderName) continue;

      if (onTypingUpdate) onTypingUpdate({ isTyping: true, characterName: item.senderName });
      
      const cleanContent = item.content.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

      const newMsg = {
        chatId,
        senderId: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderName: item.senderName,
        senderAvatar: '',
        senderType: 'character',
        type: 'text',
        content: cleanContent,
        metadata: {},
        quotedMessageId: null,
        timestamp: Date.now()
      };

      const insertedId = await db.ensembleMessages.add(newMsg);
      newMsg.id = insertedId;
      generatedMessages.push(newMsg);
      
      // 短暂延迟产生轮流说话打字节奏
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // 累积完成一次 AI 链式回复
  const newChainCount = (chat.aiChainCount || 0) + 1;
  const summaryFreq = chat.autoSummaryFrequency || 5;

  await db.ensembleChats.update(chatId, {
    aiChainCount: newChainCount,
    updatedAt: Date.now()
  });

  // 判断是否达到了总结频率
  if (newChainCount % summaryFreq === 0) {
    await generateEnsembleSummary(chatId, 'auto');
  }

  if (onTypingUpdate) onTypingUpdate({ isTyping: false, characterName: '' });

  return generatedMessages;
};

// 剧情与关系总结 (可手动触发或自动触发)
export const generateEnsembleSummary = async (chatId, source = 'manual') => {
  const chat = await db.ensembleChats.get(chatId);
  if (!chat) return;

  const msgs = await db.ensembleMessages.where('chatId').equals(chatId).reverse().limit(35).toArray();
  msgs.reverse();

  if (msgs.length < 4) return;

  const conversationText = msgs.map(m => `${m.senderName}: ${m.content}`).join('\n');

  const prompt = [
    {
      role: 'system',
      content: `总结以下大群对话的阶段性剧情发展与角色关系演化。
零 Emoji！请以 JSON 格式输出：
{
  "summaryText": "关键剧情发展...",
  "relationChangesText": "角色之间的互动与关系微妙变迁..."
}`
    },
    { role: 'user', content: conversationText }
  ];

  const raw = await callAiAPI(prompt, { jsonMode: true });
  try {
    const data = JSON.parse(raw);
    await db.ensembleSummaries.add({
      chatId,
      summaryText: data.summaryText || '无重大变化',
      relationChangesText: data.relationChangesText || '关系保持现状',
      source, // 'auto' | 'manual'
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  } catch (e) {
    console.error('总结生成解析失败', e);
  }
};
