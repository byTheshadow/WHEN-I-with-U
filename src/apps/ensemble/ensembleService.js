import db from '../../db';

// 获取全局 API 配置 (读取 db.settings 中 key="apiConfig" 的记录)
export const getApiConfig = async () => {
  try {
    const settingDoc = await db.settings.get('apiConfig');
    if (!settingDoc || !settingDoc.value) {
      throw new Error('未配置 API Key，请前往全局设置页面配置');
    }
    const { baseUrl, apiKey, model } = settingDoc.value;
    if (!apiKey) {
      throw new Error('API Key 为空，请前往设置页面配置');
    }
    return {
      baseUrl: baseUrl || 'https://api.openai.com/v1',
      apiKey,
      model: model || 'gpt-4o'
    };
  } catch (err) {
    console.error('getApiConfig Error:', err);
    throw err;
  }
};

// 通用 AI API 调用
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

// 拼装多角色系统 Prompt
export const buildEnsembleSystemPrompt = async (chat, targetCharacterId = null) => {
  // 1. 全局角色
  const globalIds = chat.selectedCharacterIds || [];
  const globalChars = globalIds.length > 0
    ? await db.characters.where('id').anyOf(globalIds).toArray()
    : [];

  // 2. 本群专属角色
  const localChars = chat.localCharacters || [];

  // 合并全部出场 AI 角色 (最多 8 位)
  const allMembers = [
    ...globalChars.map(c => ({
      id: `global_${c.id}`,
      rawId: c.id,
      name: c.name,
      bio: c.bio || '无',
      extraNotes: (chat.characterOverrides?.[c.id]?.notes) || c.extraNotes || '遵循原人设'
    })),
    ...localChars.map(c => ({
      id: `local_${c.id}`,
      rawId: c.id,
      name: c.name,
      bio: c.bio || '本群专属角色',
      extraNotes: c.extraNotes || '无'
    }))
  ].slice(0, 8);

  const memberPrompt = allMembers.map(m => 
    `- 【角色 ID: ${m.id} | 名称: ${m.name}】
  人设基底: ${m.bio}
  当前场景行为规则/补充: ${m.extraNotes}`
  ).join('\n\n');

  // 3. 关系矩阵
  const relations = chat.relations || [];
  const relationPrompt = relations.length > 0
    ? relations.map(r => `- [${r.sourceName}] 对 [${r.targetName}] 的看法/关系: ${r.relation}`).join('\n')
    : '角色间维持自然的朋友/同伴关系';

  // 4. User 多身份列表
  const userIdentities = chat.userIdentities || [];
  const userPrompt = userIdentities.map(u => 
    `- 【User视角身份: ${u.name}】 人设/立场: ${u.persona || '普通视角'}`
  ).join('\n');

  // 5. 历史有效总结 (全部保留且持续有效)
  const summaries = await db.ensembleSummaries.where('chatId').equals(chat.id).toArray();
  const summaryPrompt = summaries.length > 0
    ? summaries.map((s, idx) => `[剧情阶段 ${idx + 1} 总结]: ${s.summaryText}\n[关系演变]: ${s.relationChangesText}`).join('\n\n')
    : '无历史剧情总结';

  return `你是一个擅长多角色群像戏剧演绎的顶级 AI 剧场导演。
你正处于羁绊大群【${chat.title}】中。

【当前大群场景/环境设定 (Scene Prompt)】:
${chat.scenePrompt || '大家在惬意、自然的沉浸空间里聊天'}

【群内参与的 AI 角色档案 (上限 8 位)】:
${memberPrompt}

【定向角色关系矩阵】:
${relationPrompt}

【场景内可能出现的 User 视角身份】:
${userPrompt}

【截至目前的全部历史剧情与关系总结 (持续生效)】:
${summaryPrompt}

【核心输出规则】:
1. 绝对严禁包含任何 Emoji 表情！
2. 保持极致的沉浸感与角色性格鲜明性。
3. 必须输出合法的 JSON 格式，其中包含 \`responses\` 数组。
   格式样例：
   {
     "responses": [
       {
         "characterId": "角色ID(如 global_1 或 local_172...)",
         "characterName": "角色名字",
         "content": "发出的对话或动作描写",
         "typingStyle": "paw" // 可选: "paw" | "sparkle" | "jelly" | "gem"
       }
     ]
   }
4. 一次请求中，由你根据剧情走向自决由 1 个或多个适合的角色接话回应。单次链式回复最多产生 10 条角色消息。如果指定了【召唤角色】，该角色必须优先发言。`;
};

// 触发 AI 生成回复
export const generateEnsembleAiResponse = async (chatId, options = {}) => {
  const { targetCharacterId = null, onTypingStart } = options;
  const chat = await db.ensembleChats.get(chatId);
  if (!chat) throw new Error('找不到大群数据');

  const historyMsgs = await db.ensembleMessages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(30)
    .toArray();
  historyMsgs.reverse();

  const systemPrompt = await buildEnsembleSystemPrompt(chat, targetCharacterId);

  const formattedHistory = historyMsgs.map((m) => {
    const prefix = m.senderType === 'user' ? `[User:${m.senderName}]` : `[AI角色:${m.senderName}]`;
    if (m.type === 'sticker') return `${prefix}: [发送了表情包: ${m.metadata?.name || '表情'}]`;
    if (m.type === 'image') return `${prefix}: [发送了图片: ${m.content}]`;
    if (m.type === 'voice') return `${prefix}: [发送了语音: ${m.content}]`;
    return `${prefix}: ${m.content}`;
  });

  const promptMessages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory.map(h => ({ role: 'user', content: h }))
  ];

  if (targetCharacterId) {
    promptMessages.push({
      role: 'user',
      content: `[系统指令]: 请强制让角色 ID 为【${targetCharacterId}】的角色优先做出回应。`
    });
  }

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
    // 限制单次链式回复最多 10 条
    const responsesList = parsed.responses.slice(0, 10);

    for (const item of responsesList) {
      if (!item.content) continue;

      // 过滤 Emoji
      const cleanContent = item.content.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

      const newMsg = {
        chatId,
        senderId: item.characterId || `char_${Date.now()}`,
        senderName: item.characterName || 'AI角色',
        senderAvatar: item.avatar || '',
        senderType: 'character',
        characterId: item.characterId,
        type: 'text',
        content: cleanContent,
        metadata: {},
        quotedMessageId: null,
        timestamp: Date.now()
      };

      const insertedId = await db.ensembleMessages.add(newMsg);
      newMsg.id = insertedId;
      generatedMessages.push(newMsg);
    }
  }

  // 更新链式回复计数器与活跃时间
  const newChainCount = (chat.aiChainCount || 0) + 1;
  const autoFreq = chat.summaryFrequencyRounds || 5;

  await db.ensembleChats.update(chatId, {
    aiChainCount: newChainCount,
    updatedAt: Date.now()
  });

  // 达到规定的链式轮数后，自动触发总结
  if (newChainCount % autoFreq === 0) {
    void generateEnsembleSummary(chatId);
  }

  return generatedMessages;
};

// 自动/手动生成剧情与关系总结 (默认追加，全量有效)
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

  if (msgs.length < 4) return;

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

  try {
    const raw = await callAiAPI(prompt, { jsonMode: true });
    const data = JSON.parse(raw);
    await db.ensembleSummaries.add({
      chatId,
      summaryText: data.summaryText || '剧情顺畅推进中',
      relationChangesText: data.relationChangesText || '关系保持稳定',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  } catch (e) {
    console.error('自动总结生成失败', e);
  }
};
