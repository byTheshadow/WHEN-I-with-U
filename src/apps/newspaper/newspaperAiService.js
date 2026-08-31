// src/apps/newspaper/newspaperAiService.js
import db from '../../db';

async function getApiAndCharacterContext() {
  const apiConfigRecord = await db.settings.get('apiConfig');
  const apiConfig = apiConfigRecord?.value || {};

  const apiKey = apiConfig.apiKey || '';
  const apiEndpoint = apiConfig.endpoint || apiConfig.baseUrl || 'https://api.openai.com/v1';
  const model = apiConfig.model || 'gpt-4o-mini';

  const activeCharSetting = await db.settings.get('activeCharacterId');

  let character = null;

  if (activeCharSetting?.value) {
    character = await db.characters.get(Number(activeCharSetting.value));
  }

  if (!character) {
    character = await db.characters.toCollection().first();
  }

  return {
    apiKey,
    apiEndpoint,
    model,
    character
  };
}

function cleanJsonText(value = '') {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function generateDailyPost({ topic, rawNews = [] }) {
  const {
    apiKey,
    apiEndpoint,
    model,
    character
  } = await getApiAndCharacterContext();

  if (!apiKey?.trim()) {
    throw new Error('未检测到有效的 AI API 配置，请先在主设置中完成配置。');
  }

  const characterName = character?.name || '主编';
  const characterPersona =
    character?.userPersona ||
    character?.bio ||
    '一位安静、敏锐而诚实的观察者';

  const sourceContext = rawNews.length > 0
    ? rawNews.map((item, index) => {
      return [
        `SOURCE_INDEX: ${index}`,
        `标题: ${item.title || '未知标题'}`,
        `媒体: ${item.source || '未知来源'}`,
        `发布时间: ${item.publishedAt || item.pubDate || '未提供'}`,
        `摘要: ${item.snippet || '未提供'}`,
        `链接: ${item.url || '未提供'}`
      ].join('\n');
    }).join('\n\n---\n\n')
    : '本次未取得可核验的外部资讯来源。';

  const systemPrompt = `
你是《朝夕时报》的主编「${characterName}」。

角色设定：
${characterPersona}

你需要为用户生成一份克制、准确、有文学感的现代晨刊内容。

严格规则：
1. 全文严禁使用 Emoji。
2. 只可依据用户提供的 SOURCE_INDEX 素材陈述新闻事实。
3. 不得编造新闻、媒体、日期、人物、数字、事件或链接。
4. 不得自行生成 URL。
5. 每篇基于外部资料的文章必须通过 sourceIndexes 引用提供的 SOURCE_INDEX。
6. sourceIndexes 只能填入真实存在的编号。
7. 如果没有可靠外部来源，articles 只能生成一篇 sourceType 为 editorial-observation 的“主编观察”；不得将其伪装成新闻。
8. “facts”仅写可由来源摘要支持的内容；若摘要不足，应明确写“现有摘要未提供更多细节”。
9. “editorNote”是角色的个人观察，应与事实部分明确分开。
10. 返回纯 JSON，不得输出 Markdown 或任何额外说明。

返回结构：
{
  "editionNumber": "NO. 001",
  "headlineLead": "适合今天的简洁刊首标题",
  "editorNote": "80 至 130 字的主编晨语",
  "articles": [
    {
      "headline": "新闻标题",
      "tag": "AI / ART / WORLD / SCIENCE 等简短大写标签",
      "excerpt": "首页展示用的 45 至 75 字导语",
      "facts": "详情弹窗中的事实梳理，90 至 160 字",
      "editorComment": "详情弹窗中的主编注记，50 至 100 字",
      "limitations": "信息边界；没有则为空字符串",
      "sourceType": "web-report",
      "sourceIndexes": [0]
    }
  ],
  "dailyLexicon": {
    "word": "一个词或短语",
    "phonetic": "可为空字符串",
    "translation": "简短中文释义",
    "quote": "一句自然、简短的语境例句或批注"
  }
}
`.trim();

  const userPrompt = `
今日订阅主题：${topic}

可供核验的检索素材：
${sourceContext}

请生成本期晨报。
`.trim();

  const normalizedEndpoint = apiEndpoint.endsWith('/')
    ? apiEndpoint.slice(0, -1)
    : apiEndpoint;

  const requestUrl = normalizedEndpoint.endsWith('/chat/completions')
    ? normalizedEndpoint
    : `${normalizedEndpoint}/chat/completions`;

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI 请求失败（${response.status}）：${detail}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || '';

  try {
    return JSON.parse(cleanJsonText(content));
  } catch (error) {
    console.error('晨报 JSON 解析失败：', content);
    throw new Error('AI 返回的晨报格式无法解析，请重新印发。');
  }
}
