// src/apps/margin-notes/marginNotesAiService.js
import { generateResponse } from '../../services/aiService';

/**
 * 去除部分模型偶尔附带的 Markdown JSON 包围栏。
 */
function normalizeJsonText(text = '') {
  return String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * 从模型返回中解析 JSON。
 * 部分 OpenAI-compatible 服务即使要求 JSON，也可能在前后附带解释文字；
 * 因此依次尝试：完整文本、提取首尾 JSON 对象。
 */
function parseAiJson(text) {
  const normalized = normalizeJsonText(text);

  try {
    return JSON.parse(normalized);
  } catch {
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');

    if (start < 0 || end <= start) {
      throw new Error('AI 没有返回可解析的 JSON 内容。');
    }

    try {
      return JSON.parse(normalized.slice(start, end + 1));
    } catch {
      throw new Error('AI 返回的 JSON 格式不完整，请重试。');
    }
  }
}

/**
 * 校验角色批注锚点确实存在于原文中。
 * 不存在的批注不进入页面，避免“批注漂浮但没有对应原句”。
 */
function normalizeCharacterNotes(notes, originalText) {
  if (!Array.isArray(notes)) return [];

  const text = String(originalText || '').toLocaleLowerCase();

  return notes
    .filter((item) => {
      const anchor = String(item?.anchorPhrase || '').trim();
      const note = String(item?.note || '').trim();

      return Boolean(
        anchor &&
        note &&
        text.includes(anchor.toLocaleLowerCase())
      );
    })
    .slice(0, 4)
    .map((item, index) => ({
      id: item.id || `margin-note-${Date.now()}-${index}`,
      anchorPhrase: String(item.anchorPhrase).trim(),
      note: String(item.note).trim()
    }));
}

/**
 * 校验词汇结构。
 */
function normalizeVocabulary(vocabulary) {
  if (!Array.isArray(vocabulary)) return [];

  return vocabulary
    .filter((item) => item?.term && item?.meaning)
    .slice(0, 5)
    .map((item) => ({
      term: String(item.term).trim(),
      phonetic: String(item.phonetic || '').trim(),
      meaning: String(item.meaning).trim(),
      nuance: String(item.nuance || '').trim()
    }));
}

/**
 * AI 生成一页新的共读内容。
 *
 * 注意：
 * - API 请求完全复用全局 generateResponse；
 * - 不自行读取 apiKey / baseUrl / model；
 * - 因此会使用 db.settings.get('apiConfig').value；
 * - 该函数仍要求 AI 给出出处，但“AI 自由找文章”无法做到绝对可验证。
 *   后续要彻底杜绝假出处，应改为 AI 从本地已核验 excerptId 清单中选择。
 */
export async function generateMarginNotePage({
  character,
  targetLanguage = 'en',
  targetLanguageLabel = 'English',
  auxiliaryLanguageLabel = '简体中文',
  themePreference = '文学、生活与细微感受',
  customWorkHint = ''
}) {
  const characterName = character?.name || 'Companion';
  const characterBio = character?.bio || '细腻、克制，善于从字句中发现情绪。';
  const extraNotes = character?.extraNotes || '';

  const systemPrompt = `
你是《页边注 The Margin Notes》的文学共读编辑。

任务：为读者找出一段确有出处的文学作品原文，并由共读角色留下少量私人批注。

【共读角色】
姓名：${characterName}
角色简介：${characterBio}
补充设定：${extraNotes || '无'}

【内容边界】
1. 只能选择现实中真实存在、明确可考的作品。
2. 优先选择公版作品（public domain），例如 Project Gutenberg、Wikisource 可查的作品。
3. 不得虚构作者、作品名、章节、年份、引文、来源网址。
4. 如果不能确认作品、章节、年份或来源链接，就不要选择该作品。
5. 原文必须是 ${targetLanguageLabel}，长度约 90 至 170 个词；诗歌可按合理诗节长度处理。
6. 译文使用 ${auxiliaryLanguageLabel}，自然、忠实，不要加入原文没有的解释。
7. 只提取 2 至 4 个真正出现在原文中的词或短语。
8. 生成 2 至 3 条角色批注：
   - 每条 anchorPhrase 必须是原文中完整、连续、可精确匹配的短语；
   - 每条 note 20 至 55 字；
   - 像读到一句话时，在附近浮出的私人短句；
   - 不做语法教学，不复述原文，不说教；
   - 要贴合 ${characterName} 的角色设定。
9. 不得使用 Emoji。
10. 不要生成任何 Markdown 标记或解释文字。

【用户此次偏好】
主题：${themePreference || '文学、生活与细微感受'}
指定线索：${customWorkHint || '无'}

仅输出一个合法 JSON 对象，结构必须严格如下：

{
  "source": {
    "workTitle": "真实作品名",
    "author": "真实作者全名",
    "year": "出版或创作年份",
    "section": "真实章节、篇名或诗节信息",
    "genre": "体裁",
    "sourceUrl": "可核验的公版来源链接，例如 Project Gutenberg 或 Wikisource"
  },
  "originalText": "真实原文",
  "translation": "参考译文",
  "vocabulary": [
    {
      "term": "原文中真实出现的词或短语",
      "phonetic": "音标、读音或假名",
      "meaning": "中文释义",
      "nuance": "简短语感说明"
    }
  ],
  "characterNotes": [
    {
      "id": "note-1",
      "anchorPhrase": "原文中连续出现的准确短语",
      "note": "角色留下的短批注"
    }
  ]
}
`.trim();

  const userPrompt = `
请根据以上规则，找出一段适合今天共读的 ${targetLanguageLabel} 文学片段。
主题倾向：${themePreference || '文学、生活与细微感受'}。
`.trim();

  // 这里直接复用全局 aiService.js：
  // generateResponse -> db.settings.get('apiConfig') -> baseUrl/apiKey/model
  const rawText = await generateResponse([
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userPrompt
    }
  ]);

  const parsed = parseAiJson(rawText);

  const originalText = String(parsed?.originalText || '').trim();

  if (!originalText) {
    throw new Error('AI 没有返回原文，请重试。');
  }

  const source = parsed?.source || {};

  if (
    !source.workTitle ||
    !source.author ||
    !source.section ||
    !source.sourceUrl
  ) {
    throw new Error(
      'AI 未提供完整可核验出处。本次内容未保存，请重新翻开一页。'
    );
  }

  return {
    date: new Date().toISOString().slice(0, 10),

    characterId: character?.id || null,
    characterName,
    characterAvatar: character?.avatar || '',

    language: targetLanguage,
    targetLanguageLabel,
    auxiliaryLanguageLabel,

    source: {
      workTitle: String(source.workTitle).trim(),
      author: String(source.author).trim(),
      year: String(source.year || '').trim(),
      section: String(source.section).trim(),
      genre: String(source.genre || '').trim(),
      sourceUrl: String(source.sourceUrl).trim()
    },

    originalText,
    translation: String(parsed?.translation || '').trim(),

    vocabulary: normalizeVocabulary(parsed?.vocabulary),

    characterNotes: normalizeCharacterNotes(
      parsed?.characterNotes,
      originalText
    ),

    userNotes: [],
    createdAt: Date.now()
  };
}

/**
 * 用户写下页边回注后，由当前选中的角色作出简短回应。
 * 同样复用全局 generateResponse，因此不再自行读取 API 配置。
 */
export async function generateCharacterResonance({
  character,
  pageData,
  userNoteContent
}) {
  const characterName = character?.name || pageData?.characterName || 'Companion';
  const characterBio = character?.bio || '温柔、克制、善于倾听。';
  const extraNotes = character?.extraNotes || '';

  const systemPrompt = `
你正在扮演 ${characterName}，与读者共读一页文学作品。

【角色简介】
${characterBio}

【补充设定】
${extraNotes || '无'}

【正在共读】
作品：${pageData?.source?.workTitle || '未命名作品'}
作者：${pageData?.source?.author || '未知作者'}
节选：
${pageData?.originalText || ''}

读者刚在页边写下：
「${userNoteContent}」

请在其文字附近写一句简短回应。

要求：
1. 使用 ${characterName} 的角色口吻；
2. 15 至 55 个汉字；
3. 像自然浮出的文字气泡，而不是正式回复、分析或心理咨询；
4. 可以温柔、安静、稍带私人感，但不能空泛；
5. 不要称呼前缀、不要引号、不要 Emoji、不要 Markdown。
`.trim();

  const reply = await generateResponse([
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: '请写下这一句页边回应。'
    }
  ]);

  return String(reply || '').trim();
}
