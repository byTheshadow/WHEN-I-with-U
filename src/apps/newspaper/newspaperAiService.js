// src/apps/newspaper/newspaperAiService.js
import db from '../../db';

/**
 * 从数据库中正确读取项目的全局 API 配置与角色
 */
async function getApiAndCharacterContext() {
  // 1. 读取 API 配置 (严格匹配项目的 apiConfig 结构)
  const apiConfigRecord = await db.settings.get('apiConfig');
  const apiConfig = apiConfigRecord?.value || {};

  const apiKey = apiConfig.apiKey || '';
  const apiEndpoint = apiConfig.endpoint || apiConfig.baseUrl || 'https://api.openai.com/v1';
  const model = apiConfig.model || 'gpt-4o-mini';

  // 2. 读取当前活跃角色
  const activeCharSetting = await db.settings.get('activeCharacterId');
  let character = null;
  if (activeCharSetting?.value) {
    character = await db.characters.get(Number(activeCharSetting.value));
  }
  if (!character) {
    character = await db.characters.toCollection().first();
  }

  return {
    character,
    apiEndpoint,
    apiKey,
    model
  };
}

/**
 * 独立生成报纸
 */
export async function generateDailyPost({ topic, rawNews }) {
  const { character, apiEndpoint, apiKey, model } = await getApiAndCharacterContext();

  if (!apiKey || !apiKey.trim()) {
    throw new Error('未检测到有效 API Key，请先在主界面的「Settings」中配置您的 AI 接口密钥。');
  }

  const charName = character?.name || '主编';
  const charPersona = character?.userPersona || character?.bio || '敏锐温和的独立观察家';

  const newsContext = rawNews && rawNews.length > 0 
    ? rawNews.map((n, i) => `[条目 ${i + 1}] 标题: ${n.title}\n摘要: ${n.snippet}\n出处: ${n.source}`).join('\n\n')
    : `（今日暂无外网原始摘要，请围绕主题「${topic}」，以深邃、客观而文学化的视角进行今日观察与阐述）`;

  const systemPrompt = `你正在扮演主编「${charName}」（背景设定: ${charPersona}）。
你要为读者独自排印一份现代极简、排版考究的独立晨刊《THE DAILY POST》。

【铁律规范】
1. 严禁使用任何 Emoji 表情符号。
2. 保持现代独立杂志与极简报刊的克制语调，文学性与客观事实并存。
3. 必须输出纯 JSON 对象，严禁输出任何前言、结语或 Markdown 格式包裹。

【输出 JSON 字段要求】
{
  "editionNumber": "期号（如：ISSUE 108）",
  "headlineLead": "今日主副标题（如：晨光破晓与微小声响）",
  "editorNote": "主编晨间致辞（100-150字，以角色第一人称展开观察，文字温润有力量）",
  "articles": [
    {
      "headline": "新闻简要标题",
      "tag": "领域（如：TECH, ART, ESSAY, WORLD）",
      "content": "基于真实背景提炼出的凝练解读（60-120字）",
      "source": "原始来源"
    }
  ],
  "dailyLexicon": {
    "word": "从今日主题中精选的一个外语词汇或双语名句",
    "phonetic": "音标/假名（可选）",
    "translation": "中文释义与词性",
    "quote": "角色为你写下的双语语境例句或极简批注"
  }
}`;

  const userPrompt = `今日关注主题: ${topic}
检索参考背景:
${newsContext}

请生成纯 JSON 格式的晨报内容。`;

  const cleanEndpoint = apiEndpoint.endsWith('/') ? apiEndpoint.slice(0, -1) : apiEndpoint;
  const targetUrl = cleanEndpoint.endsWith('/chat/completions') 
    ? cleanEndpoint 
    : `${cleanEndpoint}/chat/completions`;

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI 请求响应异常 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || '{}';
  
  try {
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('报纸 JSON 解析异常：', rawText);
    throw new Error('晨报排版解析失败，请稍后重试。');
  }
}
