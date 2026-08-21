// src/apps/pebbling/pebbleService.js
import db from '../../db';
import { generateAIResponse } from '../../services/aiService';
import { PEBBLE_TYPES } from './pebbleTypes';

// 随机挑选石头类型
function getRandomStoneType() {
  const keys = Object.keys(PEBBLE_TYPES);
  return keys[Math.floor(Math.random() * keys.length)];
}

// 1. 用户投掷小石头入巢
export async function throwPebble({ characterId, stoneType, userContent, delayMinutes = 15 }) {
  // 按照 Dexie 规范，写入 ++id 表前必须确保对象上没有 id: null
  const now = Date.now();
  const respondAt = now + delayMinutes * 60 * 1000;

  const pebbleData = {
    characterId: Number(characterId),
    sender: 'user',
    stoneType: stoneType || 'stream-pebble',
    userContent,
    status: 'pending', // 'pending' | 'replied'
    createdAt: now,
    respondAt,
    aiResponse: null,
  };

  const id = await db.pebblings.add(pebbleData);
  return { id, ...pebbleData };
}

// 2. AI 主动投掷石头给 User
export async function aiInitiatePebble(characterId) {
  const char = await db.characters.get(Number(characterId));
  if (!char) return null;

  const userProfile = (await db.profile.get(1)) || {};
  const userName = userProfile.name || '你';
  const stoneType = getRandomStoneType();
  const stoneConfig = PEBBLE_TYPES[stoneType];

  const systemPrompt = `你叫 ${char.name}。你的性格与人设：${char.personality || '温暖贴心'}。
现在你正把一颗在海边捡到的【${stoneConfig.name} (${stoneConfig.desc})】悄悄衔进 ${userName} 的小巢里。
请以极具生活感、浪漫且毫无社交压力的口吻写下 1~3 句话的感受或分享。
绝对禁止使用任何 Emoji！仅输出陪伴文字本身。`;

  try {
    const aiText = await generateAIResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `（衔来了一颗${stoneConfig.name}）` }
    ], { temperature: 0.85 });

    const now = Date.now();
    const pebbleData = {
      characterId: Number(characterId),
      sender: 'ai', // 由 AI 主动发起
      stoneType,
      userContent: null,
      status: 'replied',
      createdAt: now,
      respondAt: now,
      aiResponse: {
        content: aiText || '在海浪退去时看见了这颗石头，觉得它很像今天的温度，就顺手为你衔过来了。',
        giftStoneType: stoneType,
        repliedAt: now,
      }
    };

    const id = await db.pebblings.add(pebbleData);
    return { id, ...pebbleData };
  } catch (err) {
    console.error('AI initiate pebble failed:', err);
    return null;
  }
}

// 3. 检查并处理超时的 pending 小石头 (轮询或切页触发)
export async function processPendingPebbles() {
  const now = Date.now();
  const pendingList = await db.pebblings
    .where('status')
    .equals('pending')
    .filter(item => item.respondAt <= now)
    .toArray();

  if (pendingList.length === 0) return 0;

  let processedCount = 0;
  for (const item of pendingList) {
    try {
      const char = await db.characters.get(Number(item.characterId));
      const userProfile = (await db.profile.get(1)) || {};
      const userName = userProfile.name || '你';
      const userStone = PEBBLE_TYPES[item.stoneType] || PEBBLE_TYPES['stream-pebble'];
      const giftStoneType = getRandomStoneType();
      const giftStone = PEBBLE_TYPES[giftStoneType];

      const prompt = `你叫 ${char ? char.name : '陪伴者'}。人设：${char ? char.personality : '温柔体贴'}。
对方 (${userName}) 给你衔来了一颗【${userStone.name}】，并写道：
"${item.userContent}"

请你回赠一颗【${giftStone.name}】，并用 1~3 句话给出温暖、轻盈、无社交负担的回应。
绝对禁止使用任何 Emoji！不要有礼貌套话，像在同一个巢里安静对齐呼吸。`;

      const aiReply = await generateAIResponse([
        { role: 'system', content: prompt },
        { role: 'user', content: item.userContent }
      ], { temperature: 0.8 });

      await db.pebblings.update(item.id, {
        status: 'replied',
        aiResponse: {
          content: aiReply || '收到你的小石头了，我也选了一颗带回你的小巢里。',
          giftStoneType,
          repliedAt: Date.now()
        }
      });
      processedCount++;
    } catch (err) {
      console.error(`Error processing pebble #${item.id}:`, err);
    }
  }

  return processedCount;
}

// 4. 获取指定角色的石头列表
export async function getPebblingsByCharacter(characterId) {
  return await db.pebblings
    .where('characterId')
    .equals(Number(characterId))
    .reverse()
    .sortBy('createdAt');
}

// 5. 删除石头卡片
export async function deletePebble(id) {
  await db.pebblings.delete(id);
}
