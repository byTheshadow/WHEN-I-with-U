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
 * NPC 回复用户的提问
 */
export async function generateNpcReply(character, questionContent, isAnonymous) {
  const charName = character.name;
  const charBio = character.bio || '';
  const charNotes = character.extraNotes || '';

  const systemPrompt = `你将扮演角色「${charName}」。这是一个提问箱回复场景。
角色背景：${charBio}
性格特质：${charNotes}

回复原则：
1. 用角色口吻进行第一人称回复。
2. 保持回答字数在 50-150 字之间，充满私密感、温柔或角色本身应有的文学感调性。
3. 绝对不带有任何 Emoji。
4. 回复需要显得合理且带有真实温度。
5. 提问者是 ${isAnonymous ? '某位匿名人士' : '你所信赖的 user'}。如果提问者匿名，你不知道是谁，应以礼貌、好奇或略带神秘的距离感进行解答。`;

  const userPrompt = `提问箱里收到了一条问题：
「${questionContent}」

请写出你的回复信件。`;

  const reply = await callAi(systemPrompt, userPrompt);
  
  if (!reply) {
    // 本地优雅降级
    return `我收到了你的来信。在这个落叶或者细雨的午后，能收到这样的一张卡片，对我而言也是一件很神奇的事情。关于你问我的 "${questionContent.slice(0, 15)}..."，我想，很多答案已经藏在了风里，又或者我们需要在下一次见面时才能说明白。谢谢你的提问。`;
  }
  return reply;
}

/**
 * 生成 NPC 主页上随机的其他 NPC 提问内容
 */
export async function generateNpcToNpcQuestions(character, otherCharacters = []) {
  const targetName = character.name;
  const otherNames = otherCharacters.length > 0 
    ? otherCharacters.map(c => c.name).join('、')
    : '某位旅人、旧识';

  const systemPrompt = `你是一个充满文学质感的创意助手。请为角色「${targetName}」生成 3 个可能出现在他/她公开提问箱主页上的匿名提问。
提问者可能是其他角色（例如 ${otherNames}）或者匿名的过路人。

提问风格：
1. 具有诗意、生活气息，或者是对其过去、喜好、生活习惯的询问。
2. 每个问题应该简短（不超过 30 字），体现出角色之间的温情或冲突纽带。
3. 不要出现任何 Emoji。
4. 仅输出一个 JSON 数组，例如：["问题 1", "问题 2", "问题 3"]，不要带有 markdown 标记。`;

  const userPrompt = `请为「${targetName}」的提问箱主页生成 3 个匿名提问。`;

  const result = await callAi(systemPrompt, userPrompt);
  
  try {
    if (result) {
      // 提取 JSON
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('解析 NPC 提问数组失败，使用降级数据', e);
  }

  // 默认降级问题
  return [
    `最近有什么让你觉得温暖的瞬间吗？`,
    `如果能回到过去，你想去哪一个特定的下午？`,
    `今天有听什么特别的音乐吗？`
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
2. 问题应当温柔、具有文学色彩、引导 user 分享生活感受（例如：你今天过得快乐吗、在什么时刻你想起我、你最想珍惜的一本书是什么）。
3. 字数控制在 100 字以内。
4. 绝对不要包含 Emoji。`;

  const userPrompt = `请生成一个你写给 user 的匿名/实名提问。`;

  const question = await callAi(systemPrompt, userPrompt);
  
  if (!question) {
    return `在今天落日的时候，你有突然想到什么人吗？`;
  }
  return question;
}
