import db from '../../db';

/**
 * 获取专属副 API 配置，未配置则降级读取主配置
 */
export const getHabitatApiConfig = async () => {
  const configRecord = await db.settings.get('habitatApiConfig');
  if (configRecord && configRecord.value && configRecord.value.apiKey) {
    return configRecord.value;
  }
  const mainConfig = await db.settings.get('apiConfig');
  if (mainConfig && mainConfig.value && mainConfig.value.apiKey) {
    return mainConfig.value;
  }
  return null;
};

/**
 * 从接口动态拉取可用模型列表
 */
export const fetchAvailableModels = async (baseUrl, apiKey) => {
  if (!apiKey) return [];
  const cleanUrl = `${baseUrl.replace(/\/$/, '')}/models`;
  const response = await fetch(cleanUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    throw new Error('无法连接 API 获取模型列表');
  }

  const data = await response.json();
  if (data && Array.isArray(data.data)) {
    return data.data.map(m => m.id);
  }
  return [];
};

/**
 * 底层通用 LLM 呼叫接口
 */
const callLLM = async (systemPrompt, userPrompt) => {
  const config = await getHabitatApiConfig();
  if (!config || !config.apiKey) {
    throw new Error('未配置 API 密钥，请在主界面右上角设置副 API。');
  }

  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 150
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`副 API 通信失败: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
};

/**
 * 照料操作的即时语言反馈
 */
export const getHabitatActionFeedback = async (habitat, actionType) => {
  const isAnimal = habitat.type === 'animal';
  const actionNames = {
    feed: isAnimal ? '喂食' : '施肥',
    water: isAnimal ? '喷雾' : '浇水',
    clean: '擦拭清洁',
    play: isAnimal ? '玩耍' : '剪枝抚育'
  };
  
  const actionName = actionNames[actionType] || actionType;
  
  const systemPrompt = `你是一只存活在微型数字生态瓶中的生命。
请以它的性格与视角，用极短且具有文学质感的话回应主人的照料操作。
基本信息：
- 名字：${habitat.name}
- 类型：${isAnimal ? '动物' : '植物'}
- 性格人设：${habitat.persona}
- 当前状态：水分 ${habitat.moisture}%，养分 ${habitat.nutrients}%，清洁度 ${habitat.sanitation}%。

请针对主人的“${actionName}”操作做出即时的语言反馈。反馈必须符合性格设定，字数在两句话以内，绝对不要包含任何Emoji，也不要带有任何AI客服痕迹。`;

  const userPrompt = `主人刚刚对你进行了 [${actionName}] 操作，请给出你的即时回应。`;
  
  try {
    return await callLLM(systemPrompt, userPrompt);
  } catch (error) {
    console.error('获取照料反馈失败，启用预设降级文案:', error);
    const fallbacks = {
      feed: ['吸饱了落下的微小颗粒，感觉浑身有了暖意。', '养分在缓缓扩散，感觉舒适了一些。'],
      water: ['空气润泽起来了，每一个角落都在发生细微的呼吸。', '谢谢你带来的这阵湿润微风。'],
      clean: ['外面的视线明亮起来了，能清晰地看见你的轮廓了。', '干净的感觉让呼吸更顺畅。'],
      play: ['有你隔着玻璃陪我，连瓶子里的时光都流动得快了一些。', '和你交流让我觉得很安心。']
    };
    const list = fallbacks[actionType] || ['瓶里泛起了一圈微弱的涟漪。'];
    return list[Math.floor(Math.random() * list.length)];
  }
};

/**
 * 日常聊天文本回复
 */
export const chatWithHabitat = async (habitat, userMsg, recentLogs = []) => {
  const logCtx = recentLogs
    .map(l => `${l.operatorName}: ${l.content}`)
    .join('\n');

  const systemPrompt = `你是一只存活在微型数字生态瓶中的生命。
基本信息：
- 名字：${habitat.name}
- 类型：${habitat.type === 'animal' ? '动物' : '植物'}
- 性格人设：${habitat.persona}
- 当前状态：水分 ${habitat.moisture}%，养分 ${habitat.nutrients}%，清洁度 ${habitat.sanitation}%。

你正在和主人对话。请以你的性格与视角，用极其简短、有诗意且贴近设定的语气回复。
注意：字数严格控制在三句话以内，绝对不要包含任何Emoji，也不要透露你是一个AI模型。

最近的照料与聊天日志：
${logCtx}`;

  try {
    return await callLLM(systemPrompt, userMsg);
  } catch (error) {
    console.error('聊天失败，使用默认反馈:', error);
    return '静静地看着你，在玻璃外壁上留下了一圈雾气。';
  }
};

/**
 * 联合照料生成留言
 */
export const generateGuardianJointCare = async (habitat, character) => {
  const systemPrompt = `你正在扮演角色 [${character.name}]。你和你的主人共同照料一个微型数字生态瓶。
生态瓶里的生命基本信息：
- 名字：${habitat.name}
- 类型：${habitat.type === 'animal' ? '动物' : '植物'}
- 性格设定：${habitat.persona}
- 当前状态：水分 ${habitat.moisture}%，养分 ${habitat.nutrients}%，清洁度 ${habitat.sanitation}%。

你刚刚在后台照顾了这个小家伙。请根据你的角色性格设定 [${character.bio || character.name}]，写下一张留给主人的照料小纸条（留言）。
小纸条需要包含你对它的照料行为（例如：喂了食、松了土、浇了水或陪它说了会儿话）以及你观察到它当时的有趣反馈。
注意：留言字数在三句话以内，必须符合你的角色语气，绝对不要包含任何Emoji。不要署名，末尾统一由系统追加角色名字，你只需写留言内容。`;

  const userPrompt = `请为小家伙写下一张照料留言小纸条。`;
  
  try {
    return await callLLM(systemPrompt, userPrompt);
  } catch (error) {
    console.error('守护者照料生成失败:', error);
    return `我顺便来看了看它，帮它调整了瓶子里的环境。它看起来状态还不错。`;
  }
};
