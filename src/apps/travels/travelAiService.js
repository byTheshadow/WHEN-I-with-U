import db from '../../db';

const getTravelCharacterContext = (character) => {
  if (!character) return '';

  const stringify = (value) => {
    if (value === null || value === undefined || value === '') {
      return '未设置';
    }

    if (typeof value === 'string') {
      return value.trim() || '未设置';
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  return `【同行伴侣角色库设定】
- 角色 ID：${stringify(character.id)}
- 姓名：${stringify(character.name)}
- 称呼 / Handle：${stringify(character.handle)}
- 角色简介 / Bio：${stringify(character.bio)}
- 补充设定 / Extra Notes：${stringify(character.extraNotes)}
- 状态列表 / Status List：${stringify(character.statusList)}
- 角色专属世界书 / World Book：${stringify(character.worldBook)}

【旅行叙事边界】
- 本次旅行中的用户人设必须且只能使用 travel.userPersona。
- character.userPersona 是旧角色编辑资料，不能作为本次旅行中的用户人设。
- 不得读取、引用、猜测或编造 chats、messages、聊天摘要中的内容。`;
};

const getEnabledTravelWorldBooksText = async () => {
  try {
    const enabledWorldBooks = await db.worldBooks
      .where('isEnabled')
      .equals(1)
      .toArray();

    if (!enabledWorldBooks.length) return '';

    return `【已启用的全局世界书设定】
${enabledWorldBooks
  .map((worldBook, index) => {
    const title = worldBook.title || `世界书 ${index + 1}`;
    return `- ${title}：${worldBook.content || ''}`;
  })
  .join('\n')}`;
  } catch (error) {
    console.error('读取旅行世界书失败：', error);
    return '';
  }
};

const requestTravelJson = async (systemPrompt, userPrompt) => {
  const apiSettings = await db.settings.get('apiConfig');
  const apiConfig = apiSettings?.value || {};

  if (!apiConfig.baseUrl || !apiConfig.apiKey) {
    return null;
  }

  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      console.error(`旅行 AI 请求失败：HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = String(
      data?.choices?.[0]?.message?.content || ''
    ).trim();

    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('旅行 AI 请求失败：', error);
    return null;
  }
};

export const generateCompanionWishlist = async (character) => {
  if (!character) return null;

  const characterContext = getTravelCharacterContext(character);
  const worldBooksText = await getEnabledTravelWorldBooksText();

  const result = await requestTravelJson(
    `你现在正扮演 AI 同行伴侣「${character.name || '未命名角色'}」。

${characterContext}

${worldBooksText}

【任务】
请根据角色性格、身份、偏好、状态设定与世界书背景，
为你和用户下一次共同旅行提议 3 个彼此差异明显的目的地。

【规则】
- 这是用户与你共同开始的双人旅行，用户始终同行。
- 每个地点应具体、有画面感，并与角色设定或世界书有合理联系。
- 不要总是选择热门城市、海岛或固定模板。
- 不得使用 Emoji。
- 不得输出 Markdown。

严格输出 JSON：
{
  "wishlist": [
    {
      "destination": "具体地点名称",
      "reason": "在此处想和用户共同经历的事情或心绪"
    }
  ]
}`,
    '请为我们下一次共同旅行提出三份不同的目的地心愿。'
  );

  if (!Array.isArray(result?.wishlist)) {
    return null;
  }

  const wishlist = result.wishlist
    .filter((item) => item?.destination && item?.reason)
    .slice(0, 3)
    .map((item) => ({
      destination: String(item.destination).trim(),
      reason: String(item.reason).trim()
    }));

  return wishlist.length ? wishlist : null;
};

export const generateCompanionSurpriseBooking = async (character) => {
  if (!character) return null;

  const characterContext = getTravelCharacterContext(character);
  const worldBooksText = await getEnabledTravelWorldBooksText();

  const result = await requestTravelJson(
    `你现在正扮演 AI 同行伴侣「${character.name || '未命名角色'}」。

${characterContext}

${worldBooksText}

【任务】
请为你和用户共同决定一趟具有未知感、符合角色性格与世界观的惊喜旅行。

【规则】
- 这是双人共同旅行，不是角色独自出行。
- 需要给出具体目的地、两人同行的住宿名称与住宿风格。
- 不要总是套用海岛、温泉、星空房等固定模板。
- 不得使用 Emoji。
- 不得输出 Markdown。

严格输出 JSON：
{
  "destination": "具体目的地名称",
  "hotelName": "具体住宿名称",
  "hotelStyle": "住宿风格或氛围描述"
}`,
    '请为我们两人决定一趟共同的惊喜旅行与住宿。'
  );

  if (!result?.destination || !result?.hotelName) {
    return null;
  }

  return {
    destination: String(result.destination).trim(),
    hotelName: String(result.hotelName).trim(),
    hotelStyle: result.hotelStyle
      ? String(result.hotelStyle).trim()
      : '',
    flightNo: `FLIGHT-W${Math.floor(100 + Math.random() * 900)}`
  };
};

export const generateCompanionPostcard = async (
  character,
  travel,
  deliverySlot = 'departure'
) => {
  if (!character || !travel?.destination) {
    return null;
  }

  const characterContext = getTravelCharacterContext(character);
  const worldBooksText = await getEnabledTravelWorldBooksText();

  const existingPostcards = await db.travelPostcards
    .where('travelId')
    .equals(travel.id)
    .sortBy('timestamp');

  const previousEpisodesText = existingPostcards.length
    ? `【本次旅行已经寄出的明信片】
${existingPostcards
  .slice(-12)
  .map(
    (postcard, index) =>
      `${index + 1}. ${postcard.spotName || '旅程片段'}：${
        postcard.letterContent || postcard.metPerson || '已记录'
      }`
  )
  .join('\n')}

【避免重复】
新的地点、共同活动、纪念物、插曲和叙事角度必须避开以上内容。`
    : '【本次旅行已经寄出的明信片】\n暂无。这是你们刚刚出发后的第一段旅程记录。';

  const slotTextMap = {
    departure: '这是刚刚出发后的第一段旅程记录。',
    'hour-8': '这是旅行开始约八小时后寄出的途中明信片。',
  };

  const slotText = slotTextMap[deliverySlot]
    || `这是旅行进行中的第 ${deliverySlot.replace('day-', '')} 天明信片。`;

  const result = await requestTravelJson(
    `你现在正扮演 AI 同行伴侣「${character.name || '未命名角色'}」。

${characterContext}

${worldBooksText}

【本次共同旅行资料】
- 目的地：${String(travel.destination).trim()}
- 用户本次旅行独立人设：${String(travel.userPersona || '').trim() || '未填写'}
- 用户本次旅行行囊备注：${String(travel.luggageNotes || '').trim() || '未填写'}
- 当前寄送节点：${slotText}

${previousEpisodesText}

【绝对边界】
1. 用户与你正在共同进行旅行，用户始终在场。
2. 严禁写成你独自旅行、用户不在场，或你独自买礼物带回给用户。
3. 这是由你写给用户的明信片，但记录的是你们刚刚共同经历的瞬间。
4. 礼物必须是共同发现、共同挑选，或你在两人同行现场为用户选中的当地物件。
5. 禁止使用 Emoji。
6. 不得输出 Markdown 或任何额外说明。

【任务】
请记录你们刚刚共同经历的一个具体旅行瞬间，并生成：
1. 一个目的地下的细分地点；
2. 一封写给用户的手写明信片正文，100 至 200 字；
3. 一个与共同经历有关的实体纪念物；
4. 一个自然发生的路人、动物、天气变化或小插曲；
5. 一个适合此刻照片留档的艺术视觉风格。

严格输出 JSON：
{
  "spotName": "目的地下的具体细分地点名称",
  "letterContent": "写给用户的共同旅行明信片正文",
  "giftItem": "具体纪念物及简短描述",
  "metPerson": "新发生的路人、动物、天气或趣味插曲",
  "photoStyle": "照片艺术视觉风格描述"
}`,
    `请为我们刚刚在「${travel.destination}」共同经历的瞬间写一张旅行明信片。`
  );

  if (!result?.spotName || !result?.letterContent) {
    return null;
  }

  return {
    spotName: String(result.spotName).trim(),
    letterContent: String(result.letterContent).trim(),
    giftItem: result.giftItem ? String(result.giftItem).trim() : '',
    metPerson: result.metPerson ? String(result.metPerson).trim() : '',
    photoStyle: result.photoStyle ? String(result.photoStyle).trim() : ''
  };
};
