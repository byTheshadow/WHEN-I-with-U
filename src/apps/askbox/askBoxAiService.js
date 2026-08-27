import db from '../../db';

/**
 * 封装通用 AI 通信
 */
async function callAi(systemPrompt, userPrompt) {
  try {
    const config = await db.settings.get('apiConfig');
    if (!config || !config.value) {
      throw new Error('未配置 API');
    }
    const { apiKey, baseURL, model } = config.value;
    if (!apiKey) {
      throw new Error('API Key 为空');
    }

    const response = await fetch(`${baseURL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`API HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content || '';
    
    // 清除可能含有的 emoji (全站零 emoji 规则)
    text = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]/gu, '');
    
    return text.trim();
  } catch (error) {
    console.error('AskBox AI 请求失败:', error);
    return null;
  }
}

/**
 * NPC 回复用户的提问（支持传入消息上下文）
 */
export async function generateNpcReply(character, questionContent, isAnonymous, contextMessages = []) {
  const charName = character.name;
  const charBio = character.bio || '';
  const charNotes = character.extraNotes || '';

  // 格式化上下文
  const formattedContext = contextMessages.length > 0 
    ? contextMessages.map(m => `${m.sender === 'user' ? 'User' : charName}: ${m.content}`).join('\n')
    : '暂无前文聊天记录';

  const systemPrompt = `你将扮演角色「${charName}」。这是一个匿名提问箱回复场景。
角色背景：${charBio}
性格特质：${charNotes}

你们最近在聊天对话框中的一部分聊天记忆如下（用于辅助理解你们之间的氛围和关系纽带，不要生硬地把这些话搬进去）：
"""
${formattedContext}
"""

回复原则：
1. 用角色口吻进行第一人称回复。
2. 保持回答字数在 50-120 字之间，充满私密感、温柔或角色本身应有的文学感调性。
3. 绝对不带有任何 Emoji。
4. 提问者是 ${isAnonymous ? '某位匿名人士' : '你所信赖的 user'}。如果是匿名人士，你表面上应该感到一丝好奇与猜测，如果是署名的 user，你的语气可以更亲昵。`;

  const userPrompt = `提问箱里收到了一条问题：
「${questionContent}」

请写出你的回复。不要加任何问候或结尾落款的客套话，以信纸正文语气开始。`;

  const reply = await callAi(systemPrompt, userPrompt);
  
  if (!reply) {
    return `我收到了你在提问箱里的来信。关于你提到的 “${questionContent.slice(0, 15)}...”，其实在这个雨天或者晴朗的午后，我的答案一直都很简单。我们之间已经历了许多对话，或许这也是我们无言默契的一部分吧。谢谢你。`;
  }
  return reply;
}

/**
 * 生成 NPC 主页上随机的其他 NPC 提问及该角色的公开回答（问答配对）
 */
export async function generateNpcToNpcQAPairs(character, otherCharacters = []) {
  const targetName = character.name;
  const charBio = character.bio || '';
  const charNotes = character.extraNotes || '';
  const otherNames = otherCharacters.length > 0 
    ? otherCharacters.map(c => c.name).join('、')
    : '某位旧识、路人';

  const systemPrompt = `你是一个充满文学质感的创意助手。请为角色「${targetName}」生成 2 个出现在他/她提问箱上的公开问答对。
提问者可能是匿名的路人或者其他角色（如：${otherNames}）。
回答者是「${targetName}」（背景：${charBio}，特质：${charNotes}）。

要求：
1. 提问应有生活感、哲思或对过去的追问。回答应深刻地体现出「${targetName}」的第一人称性格，温柔克制或略显疏离。
2. 问题 30 字以内，回答 80 字以内。
3. 绝对不要带有任何 Emoji。
4. 仅输出一个 JSON 数组格式，不要带有 markdown 标记。格式如下：
[
  { "question": "问题内容", "reply": "回答内容", "from": "匿名人士" },
  { "question": "问题内容", "reply": "回答内容", "from": "匿名人士" }
]`;

  const userPrompt = `请为「${targetName}」生成 2 组提问箱上的公开问答对。`;

  const result = await callAi(systemPrompt, userPrompt);
  
  try {
    if (result) {
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('解析 NPC 问答对失败，使用降级数据', e);
  }

  // 默认降级数据
  return [
    {
      question: `你经常提及的那个遥远的下午，对你而言代表着什么？`,
      reply: `那是一段被时间妥善封存的光线，风里有樟脑和陈旧信封的香气。它不再属于现在，但却让我在此刻能平静地与你写信。`,
      from: `匿名人士`
    },
    {
      question: `如果可以选择，你会想变成森林里的一棵冷杉还是深海的礁石？`,
      reply: `冷杉会看到冬天的雪，礁石会听到潮汐的歌。如果可以，我想做冷杉旁落下的一粒尘埃，至少它是自由的。`,
      from: `匿名人士`
    }
  ];
}

/**
 * 随机生成其他角色向 user 提问
 */
export async function generateNpcToUserQuestion(character) {
  const charName = character.name;
  const charBio = character.bio || '';

  const systemPrompt = `你将扮演角色「${charName}」。你现在想要在匿名提问箱里悄悄向 user 提问。
角色背景：${charBio}

提问要求：
1. 以你的身份或者隐蔽的匿名身份写一个给 user 的问题。
2. 问题应当温柔、具有文学色彩、引导 user 分享生活感受。
3. 字数控制在 100 字以内。
4. 绝对不要包含 Emoji。`;

  const userPrompt = `请生成一个你写给 user 的匿名/实名提问。`;

  const question = await callAi(systemPrompt, userPrompt);
  
  if (!question) {
    return `在今天落日的时候，你有突然想到什么人吗？`;
  }
  return question;
}
