import db from '../../db';
import { generateDailyOfferingDecision } from './dailyOfferingAiService';
import { searchItunesTrack } from './musicSearchService';
import { searchOpenLandscapeImage } from './imageSearchService';

const DAILY_OFFERING_CONFIG_KEY = 'dailyOfferingConfig';
const MAX_IMAGE_COUNT = 20;

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const getDailyOfferingConfig = async () => {
  const record = await db.settings.get(DAILY_OFFERING_CONFIG_KEY);

  return {
    characterId: record?.value?.characterId ?? null
  };
};

export const saveDailyOfferingConfig = async ({ characterId }) => {
  await db.settings.put({
    key: DAILY_OFFERING_CONFIG_KEY,
    value: {
      characterId: characterId ?? null
    }
  });
};

export const getOfferingCharacters = async () =>
  db.characters
    .filter((character) => character?.isNpc !== true)
    .toArray();

export const getDailyOfferingImages = async () =>
  db.dailyOfferingImages.orderBy('createdAt').reverse().toArray();

const isSupportedImageValue = (value = '') =>
  /^(https?:\/\/|data:image\/)/i.test(String(value).trim());

export const addDailyOfferingImage = async ({
  description,
  url,
  sourceType = 'url'
}) => {
  const cleanDescription = String(description || '').trim();
  const cleanUrl = String(url || '').trim();

  if (!cleanDescription) {
    throw new Error('请为这张图片写下一句描述。');
  }

  if (!isSupportedImageValue(cleanUrl)) {
    throw new Error('请填写有效图片 URL，或选择一张本地图片。');
  }

  const count = await db.dailyOfferingImages.count();

  if (count >= MAX_IMAGE_COUNT) {
    throw new Error('图片盒最多保留 20 张图片。');
  }

  const timestamp = Date.now();

  const payload = {
    description: cleanDescription.slice(0, 180),
    url: cleanUrl,
    sourceType: sourceType === 'local' ? 'local' : 'url',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  delete payload.id;

  return db.dailyOfferingImages.add(payload);
};

export const deleteDailyOfferingImage = async (id) => {
  if (id === null || id === undefined) return;
  await db.dailyOfferingImages.delete(id);
};

export const compressLocalImage = (file) =>
  new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('请选择有效的图片文件。'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('图片读取失败，请重新选择。'));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error('图片无法处理，请尝试其他文件。'));
      };

      image.onload = () => {
        const maxEdge = 1600;
        const longestEdge = Math.max(image.width, image.height);
        const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;

        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('当前浏览器无法压缩图片。'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };

      image.src = String(reader.result || '');
    };

    reader.readAsDataURL(file);
  });

export const getTodayDailyOffering = async () => {
  const date = getLocalDateKey();
  return db.dailyOfferings.get(date);
};

const getFallbackOffering = ({ character, imageEntries }) => {
  const shouldUseImage = imageEntries.length > 0 && Math.random() > 0.5;

  if (shouldUseImage) {
    const image =
      imageEntries[Math.floor(Math.random() * imageEntries.length)];

    return {
      mediaType: 'image',
      message: '今天想把这一页安静地递给你。别急着解释什么，只要看一会儿也很好。',
      image: {
        source: 'userPool',
        imageId: image.id,
        query: ''
      }
    };
  }

  return {
    mediaType: 'music',
    message: '我想把这一小段旋律放在你身边，等你有空时再慢慢听。',
    music: {
      title: 'Clair de Lune',
      artist: 'Claude Debussy'
    }
  };
};

const normalizeOfferingDecision = (decision, imageEntries, character) => {
  if (!decision || typeof decision !== 'object') {
    return getFallbackOffering({ character, imageEntries });
  }

  const message = String(decision.message || '').trim().slice(0, 160);

  if (decision.mediaType === 'image') {
    const selectedImage = imageEntries.find(
      (image) => Number(image.id) === Number(decision?.image?.imageId)
    );

    if (decision?.image?.source === 'userPool' && selectedImage) {
      return {
        mediaType: 'image',
        message:
          message ||
          '今天想把这张画面重新放到你手边，像把一段没说完的话轻轻折好。',
        image: {
          source: 'userPool',
          imageId: selectedImage.id,
          query: ''
        }
      };
    }

    return {
      mediaType: 'image',
      message:
        message ||
        '我想让你看看这一刻的光。也许它会替我先在你身边停一会儿。',
      image: {
        source: 'externalLandscape',
        imageId: null,
        query: String(decision?.image?.query || 'quiet landscape soft light')
          .trim()
          .slice(0, 120)
      }
    };
  }

  return {
    mediaType: 'music',
    message:
      message ||
      '今天想留一段旋律给你。它不需要被解释，只要在你身边响一会儿。',
    music: {
      title: String(decision?.music?.title || 'Clair de Lune').trim().slice(0, 100),
      artist: String(decision?.music?.artist || 'Claude Debussy').trim().slice(0, 100)
    }
  };
};

const resolveOfferingMedia = async (decision, imageEntries) => {
  if (decision.mediaType === 'music') {
    const track = await searchItunesTrack(
      decision.music?.title,
      decision.music?.artist
    );

    return {
      ...decision,
      media: {
        kind: 'music',
        requestedTitle: decision.music?.title || '',
        requestedArtist: decision.music?.artist || '',
        track
      }
    };
  }

  const selectedImage = imageEntries.find(
    (image) => Number(image.id) === Number(decision?.image?.imageId)
  );

  if (decision.image?.source === 'userPool' && selectedImage) {
    return {
      ...decision,
      media: {
        kind: 'image',
        source: 'userPool',
        imageUrl: selectedImage.url,
        description: selectedImage.description,
        attribution: null
      }
    };
  }

  const externalImage = await searchOpenLandscapeImage(
    decision.image?.query || 'quiet landscape soft light'
  );

  return {
    ...decision,
    media: {
      kind: 'image',
      source: 'externalLandscape',
      imageUrl: externalImage?.imageUrl || '',
      description: externalImage?.description || decision.image?.query || '',
      attribution: externalImage?.attribution || null
    }
  };
};

export const prepareTodayDailyOffering = async () => {
  const existingOffering = await getTodayDailyOffering();

  if (existingOffering) {
    return existingOffering;
  }

  const config = await getDailyOfferingConfig();

  if (!config.characterId) {
    return null;
  }

  const character = await db.characters.get(config.characterId);

  if (!character || character.isNpc === true) {
    return null;
  }

  const imageEntries = await getDailyOfferingImages();

  let aiDecision;

  try {
    aiDecision = await generateDailyOfferingDecision({
      character,
      imageEntries
    });
  } catch (error) {
    console.warn('Daily offering AI decision failed:', error);
  }

  const decision = normalizeOfferingDecision(
    aiDecision,
    imageEntries,
    character
  );

  let resolvedOffering;

  try {
    resolvedOffering = await resolveOfferingMedia(decision, imageEntries);
    } catch (error) {
    console.warn('Daily offering media lookup failed:', error);

    resolvedOffering = {
      ...decision,
      media: decision.mediaType === 'music'
        ? {
            kind: 'music',
            source: 'fallback',
            requestedTitle: decision.music?.title || '一段旋律',
            requestedArtist: decision.music?.artist || '未署名的演奏者',
            track: null
          }
        : {
            kind: 'image',
            source: 'fallback',
            imageUrl: '',
            description: decision.image?.query || '',
            attribution: null
          }
    };
  }


  const date = getLocalDateKey();
  const now = Date.now();

  await db.dailyOfferings
    .where('date')
    .notEqual(date)
    .delete();

  const offering = {
    date,
    characterId: character.id,
    characterName: character.name || '未署名的角色',
    characterAvatar: character.avatar || '',
    mediaType: resolvedOffering.mediaType,
    message: resolvedOffering.message,
    media: resolvedOffering.media,
    isDismissedByUser: false,
    createdAt: now,
    updatedAt: now
  };

  await db.dailyOfferings.put(offering);

  return offering;
};

export const dismissTodayDailyOffering = async () => {
  const date = getLocalDateKey();
  const offering = await db.dailyOfferings.get(date);

  if (!offering) return;

  await db.dailyOfferings.put({
    ...offering,
    isDismissedByUser: true,
    updatedAt: Date.now()
  });
};
