import { generateResponse } from '../../services/aiService';

function normalizeJsonText(text = '') {
  return String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseAiJson(text) {
  const normalized = normalizeJsonText(text);

  try {
    return JSON.parse(normalized);
  } catch {
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');

    if (start < 0 || end <= start) {
      throw new Error('AI 没有返回可解析的 JSON。');
    }

    return JSON.parse(normalized.slice(start, end + 1));
  }
}

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

function normalizeCharacterNotes(notes, originalText) {
  if (!Array.isArray(notes)) return [];

  const text = String(originalText || '').toLowerCase();

  return notes
    .filter((item) => {
      const anchor = String(item?.anchorPhrase || '').trim();
      const note = String(item?.note || '').trim();
      return anchor && note && text.includes(anchor.toLowerCase());
    })
    .slice(0, 4)
    .map((item, index) => ({
      id: item.id || `margin-note-${Date.now()}-${index}`,
      anchorPhrase: String(item.anchorPhrase).trim(),
      note: String(item.note).trim()
    }));
}

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

【角色】
姓名：${characterName}
简介：${characterBio}
补充设定：${extraNotes || '无'}

【任务】
1. 只能选择真实存在且可考的作品。
2. 优先公版作品；不要虚构作者、作品名、章节、年份、来源。
3. 原文必须是 ${targetLanguageLabel}，长度约 90 至 170 个词。
4. 译文使用 ${auxiliaryLanguageLabel}。
5. 只提取 2 至 4 个原文中真实存在的词或短语。
6. 生成 2 至 3 条角色批注：
   - anchorPhrase 必须是原文中完整、连续、可精确匹配的短语；
   - note 20 至 55 字；
   - 像读到一句话时，在附近浮出的私人短句；
   - 不做教学，不复述原文，不说教。
7. 不得使用 Emoji，不要 Markdown，不要解释文字。

【用户偏好】
主题：${themePreference || '文学、生活与细微感受'}
线索：${customWorkHint || '无'}

只输出一个合法 JSON：
{
  "source": {
    "workTitle": "真实作品名",
    "author": "真实作者全名",
    "year": "出版或创作年份",
    "section": "真实章节、篇名或诗节信息",
    "genre": "体裁",
    "sourceUrl": "可核验的公版来源链接"
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
请为今天共读挑选一段 ${targetLanguageLabel} 文学片段。
主题倾向：${themePreference || '文学、生活与细微感受'}。
`.trim();

  const rawText = await generateResponse([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  const parsed = parseAiJson(rawText);

  const originalText = String(parsed?.originalText || '').trim();
  if (!originalText) {
    throw new Error('AI 没有返回原文。');
  }

  const source = parsed?.source || {};
  if (
    !source.workTitle ||
    !source.author ||
    !source.section ||
    !source.sourceUrl
  ) {
    throw new Error('AI 未提供完整可核验出处。');
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
    characterNotes: normalizeCharacterNotes(parsed?.characterNotes, originalText),
    userNotes: [],
    createdAt: Date.now()
  };
}

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

读者写下：
「${userNoteContent}」

请写一句简短回应：
1. 15 至 55 个汉字；
2. 像自然浮出的文字气泡；
3. 不要分析、不要说教、不要 Markdown、不要引号、不要 Emoji。
`.trim();

  const reply = await generateResponse([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请写下这一句页边回应。' }
  ]);

  return String(reply || '').trim();
}
