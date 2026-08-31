// src/apps/newspaper/newspaperAiService.js
import db from '../../db';

/**
 * 获取当前活跃 AI 配置与主编角色
 */
async function getActiveContext() {
  const activeCharSetting = await db.settings.get('activeCharacterId');
  let character = null;
  if (activeCharSetting?.value) {
    character = await db.characters.get(Number(activeCharSetting.value));
  }
  if (!character) {
    character = await db.characters.toCollection().first();
  }

  const apiEndpoint = await db.settings.get('apiEndpoint');
  const apiKey = await db.settings.get('apiKey');
  const model = await db.settings.get('model');

  return {
    character,
    apiEndpoint: apiEndpoint?.value || 'https://api.openai.com/v1',
    apiKey: apiKey?.value || '',
    model: model?.value || 'gpt-4o-mini'
  };
}

/**
 * 生成今日极简报纸
 */
export async function generateDailyPost({ topic, rawNews }) {
  const { character, apiEndpoint, apiKey, model } = await getActiveContext();

  if (!apiKey) {
    throw new Error('未配置 API Key，请在空间设置中配置。');
  }

  const charName = character?.name || '主编';
  const charPersona = character?.userPersona || character?.bio || '温柔敏锐的观察者';

  const newsContext = rawNews && rawNews.length > 0 
    ? rawNews.map((n, i) => `[${i + 1}] 标题: ${n.title}\n摘要: ${n.snippet}\n来源: ${n.source}`).join('\n\n')
    : '（今日检索源未返回具体摘要，请基于今日主题进行观察与思考）';

  const systemPrompt = `你将扮演主编「${charName}」（人设背景: ${charPersona}）。
今天你要为读者编写一份现代极简主义风格的独立晨报《朝夕时报》。

【硬性要求】
1. 全文绝对严禁使用任何 Emoji 表情符号。
2. 保持现代极简、文学化、内省而客观的语调。
3. 新闻部分必须基于提供的真实素材提炼，严禁凭空捏造假新闻，若信息有限则做深度解读与观察。
4. 必须输出标准的 JSON 格式，不得包含任何 Markdown 代码块标签以外的多余文本。

【输出 JSON 规范】
{
  "editionTitle": "主标题（如：第 42 期 · 雾气消散时的世界声响）",
  "topic": "${topic}",
  "editorNote": "主编晨语（120-180字，以角色口吻，文学化地分享晨间观察与致读者的问候）",
  "articles": [
    {
      "headline": "新闻标题（凝练克制）",
      "category": "领域标签（如：TECH, ART, SOCIETY）",
      "summary": "文学化与客观结合的提炼解读（80-140字）",
      "source": "原始来源名称"
    }
  ],
  "dailyWord": {
    "word": "从今日内容中提炼的一个外语优质生词或名句短语",
    "phonetic": "音标或假名（若有）",
    "definition": "简短释义",
    "contextSentence": "在今日语境中的例句或角色的一句短评"
  }
}`;

  const userPrompt = `今日订阅主题: ${topic}
检索到的真实新闻背景:
${newsContext}

请生成今天的结构化极简晨报 JSON。`;

  const url = apiEndpoint.endsWith('/') ? `${apiEndpoint}chat/completions` : `${apiEndpoint}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawContent = json.choices?.[0]?.message?.content || '{}';
  
  try {
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('报纸 JSON 解析失败：', rawContent);
    throw new Error('报纸数据排版解析失败');
  }
}
