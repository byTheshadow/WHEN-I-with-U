import db from '../../db';
import {
  getDiaryTimeContext
} from './diaryTimeContext';
import {
  buildDiaryPrompt
} from './diaryPromptBuilder';

const DEFAULT_DIARY_CONTENT = (
  '提笔落墨的时刻，忽然想起了与你相处的片段。'
  + '在属于现实世界的静谧时空中，愿这份文字能给你带来陪伴。'
);

const getRandomItem = (items) => {
  if (!items || items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
};

const resolveDiaryTarget = async (chatId) => {
  let chat = null;
  let character = null;

  if (chatId) {
    chat = await db.chats.get(chatId);

    if (chat) {
      character = await db.characters.get(chat.characterId);
    }
  }

  if (character) {
    return { chat, character };
  }

  const allChats = await db.chats.toArray();

  if (allChats.length > 0) {
    chat = getRandomItem(allChats);
    character = await db.characters.get(chat.characterId);

    if (character) {
      return { chat, character };
    }
  }

  const allCharacters = await db.characters.toArray();

  return {
    chat: null,
    character: getRandomItem(allCharacters)
  };
};

const parseDiaryResponse = (rawText, defaults) => {
  if (!rawText || typeof rawText !== 'string') {
    return defaults;
  }

  const cleanedText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);

    return {
      title: parsed.title || defaults.title,
      mood: parsed.mood || defaults.mood,
      weather: parsed.weather || defaults.weather,
      content: parsed.content || defaults.content
    };
  } catch (error) {
    return {
      ...defaults,
      content: cleanedText || defaults.content
    };
  }
};

const requestDiaryFromAi = async ({
  apiConfig,
  prompt
}) => {
  const baseUrl = apiConfig.baseUrl.replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      response_format: {
        type: 'json_object'
      },
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: '请撰写一封属于你的伴侣主动日记。'
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(
      `Diary AI request failed with status ${response.status}`
    );
  }

  const data = await response.json();

  return data.choices?.[0]?.message?.content?.trim() || '';
};

const getDefaultDiaryData = (character) => ({
  title: `${character.name} 的独立心绪留痕`,
  mood: '静谧关怀',
  weather: '月色温柔 19℃',
  content: DEFAULT_DIARY_CONTENT
});

export const generateCompanionProactiveDiary = async (
  chatId = null,
  options = {}
) => {
  const {
    notify = () => {},
    notifySystem = () => {}
  } = options;

  let target;

  try {
    target = await resolveDiaryTarget(chatId);
  } catch (error) {
    console.error(
      'Failed to resolve diary target:',
      error
    );

    return null;
  }

  const {
    chat,
    character
  } = target;

  if (!character) {
    return null;
  }

  try {
    const apiSettings = await db.settings.get('apiConfig');
    const apiConfig = apiSettings?.value || {};

    const defaults = getDefaultDiaryData(character);

    let diaryData = defaults;

    if (apiConfig.baseUrl && apiConfig.apiKey) {
      const timeContext = await getDiaryTimeContext(
        chat?.id || null
      );

      const prompt = buildDiaryPrompt({
        character,
        recentMessages: timeContext.recentMessages || [],
        timeContext
      });

      try {
        const rawText = await requestDiaryFromAi({
          apiConfig,
          prompt
        });

        diaryData = parseDiaryResponse(rawText, defaults);
      } catch (error) {
        console.error(
          'Diary AI generation failed, using fallback diary:',
          error
        );
      }
    }

    const now = Date.now();
    const today = new Date(now)
      .toISOString()
      .split('T')[0];

    const payload = {
      chatId: chat?.id || null,
      characterId: character.id,
      author: 'character',
      title: diaryData.title,
      mood: diaryData.mood,
      weather: diaryData.weather,
      content: diaryData.content,
      companionReply: null,
      images: [],
      date: today,
      timestamp: now
    };

    const diaryId = await db.diaries.add(payload);

    notify({
      type: 'NEW_DIARY_ENTRY',
      chatId: chat?.id || null,
      characterId: character.id,
      diaryId
    });

    await notifySystem(
      `${character.name} 写下了一篇伴侣日记`,
      `《${diaryData.title}》: ${
        diaryData.content.substring(0, 40)
      }...`,
      character.avatar
    );

    return diaryId;
  } catch (error) {
    console.error(
      'Failed to generate companion proactive diary:',
      error
    );

    return null;
  }
};
