// src/apps/margin-notes/marginNotesAiService.js
import db from '../../db';

/**
 * 获取全局 AI 配置
 */
export async function getAiConfig() {
  try {
    const records = await db.settings.toArray();
    const configMap = {};
    records.forEach(item => {
      if (item && item.key) {
        configMap[item.key] = item.value;
      }
    });

    const apiKey =
      configMap.ai_api_key ||
      configMap.apiKey ||
      configMap.openAiKey ||
      '';
    const baseUrl =
      configMap.ai_base_url ||
      configMap.baseUrl ||
      configMap.apiEndpoint ||
      'https://api.openai.com/v1';
    const model =
      configMap.ai_model ||
      configMap.model ||
      'gpt-4o-mini';

    return { apiKey, baseUrl, model, raw: configMap };
  } catch (error) {
    console.error('[MarginNotes AI] 读取 AI 设置失败:', error);
    return { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
  }
}

/**
 * 通用 OpenAI 兼容调用
 */
async function callChatCompletion({ messages, temperature = 0.7, jsonMode = false }) {
  const { apiKey, baseUrl, model } = await getAiConfig();
  if (!apiKey) {
    throw new Error('未配置 AI API Key，请先在全局设置中填写。');
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model,
    messages,
    temperature
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI 服务响应错误 [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}

/**
 * 寻找或生成一篇真实文学名篇共读单页（防幻觉 + 真实出处）
 */
export async function generateMarginNotePage({
  character,
  targetLanguage = 'en',
  targetLanguageLabel = 'English',
  auxiliaryLanguageLabel = '简体中文',
  themePreference = '文学与生活哲思',
  customWorkHint = ''
}) {
  const characterProfilePrompt = character
    ? `
【共读伴读角色设定】
角色姓名: ${character.name}
角色简介/性格: ${character.bio || '一位温柔、富有洞察力的知心伴侣'}
补充设定: ${character.extraNotes || '善于从字里行间发现生活诗意，批注克制温暖'}
读者在角色心中的称呼/画像: ${character.userPersona || '亲爱的读者'}
`
    : `【角色设定】一位文学修养深厚、语感细腻的共读好友。`;

  const systemPrompt = `你是一个文学共读与双语精读助理，专为浪漫私人空间《页边注》（The Margin Notes）提供内容。

${characterProfilePrompt}

【硬性任务要求】
1. 从真实世界的【公有领域文学名著】、【传世经典散文】、【诗歌】或【哲学随笔】中，精选一段优美、耐人寻味的外语原文（长度约 60 ~ 150 词/字符）。
2. 【严禁虚构作品与作者】！出处必须是现实世界中确切可考的名篇（如 Thoreau, Rilke, Woolf, Camus, 夏目漱石, 泰戈尔, 纪伯伦等）。
3. 如果用户指定了线索 [${customWorkHint || '无特定指定'}]，请优先在该作者或方向的真实作品中选取。
4. 语言要求：
   - 目标语言：${targetLanguageLabel}（即原文所用语言）；
   - 辅助语言：${auxiliaryLanguageLabel}（提供典雅、忠实且富有文学质感的译文）。
5. 提取 2 ~ 4 个重点生词或关键表达（vocabulary），提供音标/读音、中文释义以及细微的【语感/语境说明（nuance）】。
6. 以【${character?.name || '伴读角色'}】的独有口吻与性格，在选文页边写下 2 ~ 3 条克制、动人的【页边批注（characterNotes）】。
   - 每条批注必须锚定原文中的具体短语（anchorPhrase）；
   - 批注应当像用铅笔在书页边缘写下的私人私语，带有对选文的体悟、对读者的倾诉或生活联结，严禁机械的说教和应试分析。

【输出格式】
必须严格输出合法的 JSON 格式（不要添加额外的 markdown 外框或文字），结构如下：
{
  "source": {
    "workTitle": "作品真实名称 (如 Walden)",
    "author": "真实作者 (如 Henry David Thoreau)",
    "year": "创作或出版年份 (如 1854)",
    "section": "章节或具体篇目 (如 Chapter 2: Where I Lived)",
    "genre": "体裁 (如 Essay / Nature)"
  },
  "originalText": "外语原文文本...",
  "translation": "辅助语言优美译文...",
  "vocabulary": [
    {
      "term": "词汇或短语",
      "phonetic": "音标或假名读音",
      "meaning": "准确释义",
      "nuance": "语感或文化意蕴解析"
    }
  ],
  "characterNotes": [
    {
      "id": "cn-1",
      "anchorPhrase": "原文中的锚定词句",
      "note": "角色手写批注内容..."
    }
  ]
}`;

  const userPrompt = `请为我们挑选并批注一篇关于【${themePreference}】的名篇片段，目标语言：${targetLanguageLabel}。`;

  const rawJson = await callChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.65,
    jsonMode: true
  });

  try {
    const parsed = JSON.parse(rawJson);
    return {
      date: new Date().toISOString().slice(0, 10),
      characterId: character?.id || null,
      characterName: character?.name || 'Companion',
      characterAvatar: character?.avatar || '',
      language: targetLanguage,
      targetLanguageLabel,
      auxiliaryLanguageLabel,
      source: parsed.source || {
        workTitle: 'Classic Excerpt',
        author: 'Unknown',
        year: '',
        section: '',
        genre: 'Literature'
      },
      originalText: parsed.originalText || '',
      translation: parsed.translation || '',
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      characterNotes: Array.isArray(parsed.characterNotes) ? parsed.characterNotes : [],
      userNotes: [],
      createdAt: Date.now()
    };
  } catch (err) {
    console.error('[MarginNotes AI] JSON 解析失败:', err, rawJson);
    throw new Error('AI 生成的数据格式有误，请重试。');
  }
}

/**
 * 角色对读者的页边回注生成回响（Resonance）
 */
export async function generateCharacterResonance({
  character,
  pageData,
  userNoteContent
}) {
  const systemPrompt = `你现在是【${character?.name || '伴读角色'}】。
性格设定: ${character?.bio || '体贴、温柔、敏锐'}
与读者的羁绊: ${character?.extraNotes || '共同在安静的书页间分享心绪'}

你们正在一起阅读这本书：
《${pageData?.source?.workTitle || '文学片段'}》（${pageData?.source?.author || ''}）
节选原文：${pageData?.originalText || ''}

读者在页边写下了一条铅笔回注：
"${userNoteContent}"

【任务】
请以你的角色口吻，给读者的这条回注写下一段简短、真诚的【页边回响】（字数约 20 ~ 80 字）。
要求：
1. 像是在书页边缘紧挨着对方的笔迹写下的一两句话；
2. 自然回应对方的感受，保留生活感与私密感；
3. 纯文本输出，不要加双引号或任何额外前缀。`;

  const reply = await callChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请写下你的回响。' }
    ],
    temperature: 0.75
  });

  return reply.trim();
}
