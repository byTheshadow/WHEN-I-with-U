import db from '../../db';
import { generateCompanionPostcard } from './travelAiService';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

let schedulerTimer = null;
let isChecking = false;

const getNotificationPreview = (content = '') => {
  const normalized = String(content)
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= 52) {
    return normalized;
  }

  return `${normalized.slice(0, 52)}…`;
};

const notifyTravelPostcard = (character, travel, postcard) => {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  try {
    new Notification(
      `${character.name || '伴侣'} 从 ${travel.destination || '远方'} 寄来一张明信片`,
      {
        body: getNotificationPreview(postcard.letterContent),
        icon: character.avatar || '/favicon.ico',
        tag: `travel-postcard-${travel.id}-${postcard.deliverySlot}`
      }
    );
  } catch (error) {
    console.warn('旅行明信片通知未能显示：', error);
  }
};

const getDeliverySlots = (travel, now) => {
  const startTime = Number(travel?.startTime || 0);
  const endTime = Number(travel?.endTime || 0);

  if (!startTime || !endTime || endTime <= startTime) {
    return [];
  }

  const hour = 60 * 60 * 1000;
  const slots = [];

  const eightHourTimestamp = startTime + 8 * hour;

  if (eightHourTimestamp < endTime && now >= eightHourTimestamp) {
    slots.push({
      key: 'hour-8',
      dueAt: eightHourTimestamp
    });
  }

  let day = 1;

  while (true) {
    const dueAt = startTime + day * 24 * hour;

    if (dueAt >= endTime || dueAt > now) {
      break;
    }

    slots.push({
      key: `day-${day}`,
      dueAt
    });

    day += 1;
  }

  return slots;
};

const createPostcardForSlot = async (
  travel,
  character,
  deliverySlot,
  shouldNotify = true
) => {
  const existing = await db.travelPostcards
    .where('travelId')
    .equals(travel.id)
    .and((postcard) => postcard.deliverySlot === deliverySlot)
    .first();

  if (existing) {
    return {
      postcard: existing,
      created: false
    };
  }

  const generated = await generateCompanionPostcard(
    character,
    travel,
    deliverySlot
  );

  if (!generated) {
    return {
      postcard: null,
      created: false
    };
  }

  const currentDuplicate = await db.travelPostcards
    .where('travelId')
    .equals(travel.id)
    .and((postcard) => postcard.deliverySlot === deliverySlot)
    .first();

  if (currentDuplicate) {
    return {
      postcard: currentDuplicate,
      created: false
    };
  }

  const postcard = {
    travelId: travel.id,
    characterId: character.id,
    deliverySlot,
    ...generated,
    timestamp: Date.now(),
    isRead: false
  };

  const postcardId = await db.travelPostcards.add(postcard);
  const savedPostcard = {
    ...postcard,
    id: postcardId
  };

  if (shouldNotify) {
    notifyTravelPostcard(character, travel, savedPostcard);
  }

  return {
    postcard: savedPostcard,
    created: true
  };
};

export const createDeparturePostcard = async (travel, character) => {
  if (!travel?.id || !character?.id) {
    return null;
  }

  const result = await createPostcardForSlot(
    travel,
    character,
    'departure',
    false
  );

  return result.postcard;
};

const processTravel = async (travel, now) => {
  const endTime = Number(travel.endTime || 0);

  if (!endTime) {
    return [];
  }

  const character = await db.characters.get(travel.characterId);

  if (!character) {
    return [];
  }

  const delivered = [];

  // 旅行已经结束：更新归档状态后不再补寄新的旅途明信片。
  if (now >= endTime) {
    if (travel.status === 'in_transit') {
      await db.travels.update(travel.id, {
        status: 'completed'
      });
    }

    return delivered;
  }

  // 补偿检查：旅行仍在进行中，但出发明信片曾因 API、网络或
  // 返回格式异常而未成功保存时，在后续调度中重新尝试寄出。
  const departureResult = await createPostcardForSlot(
    travel,
    character,
    'departure',
    true
  );

  if (departureResult.created && departureResult.postcard) {
    delivered.push(departureResult.postcard);
  }

  // 检查旅行开始八小时后、以及每满二十四小时应抵达的明信片。
  const dueSlots = getDeliverySlots(travel, now);

  for (const slot of dueSlots) {
    const result = await createPostcardForSlot(
      travel,
      character,
      slot.key,
      true
    );

    if (result.created && result.postcard) {
      delivered.push(result.postcard);
    }
  }

  return delivered;
};


export const checkAndDeliverTravelPostcards = async () => {
  if (isChecking) {
    return [];
  }

  isChecking = true;

  try {
    const now = Date.now();

    const activeTravels = await db.travels
      .where('status')
      .equals('in_transit')
      .toArray();

    const delivered = [];

    for (const travel of activeTravels) {
      const travelPostcards = await processTravel(travel, now);
      delivered.push(...travelPostcards);
    }

    return delivered;
  } catch (error) {
    console.error('旅行明信片调度检查失败：', error);
    return [];
  } finally {
    isChecking = false;
  }
};

export const startTravelPostcardScheduler = () => {
  if (schedulerTimer) {
    return;
  }

  void checkAndDeliverTravelPostcards();

  schedulerTimer = window.setInterval(() => {
    void checkAndDeliverTravelPostcards();
  }, CHECK_INTERVAL_MS);
};

export const stopTravelPostcardScheduler = () => {
  if (!schedulerTimer) {
    return;
  }

  window.clearInterval(schedulerTimer);
  schedulerTimer = null;
};
