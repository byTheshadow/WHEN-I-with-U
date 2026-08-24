import db from '../../db';
import { getHabitatActionFeedback, generateGuardianJointCare, chatWithHabitat } from './habitatAiService';

// 衰减率配置 (每小时扣减值)
const DECAY_RATES = {
  animal: { moisture: 3.0, nutrients: 4.0, sanitation: 2.0 }, // 动物消耗快
  plant: { moisture: 2.0, nutrients: 2.0, sanitation: 1.0 }   // 植物消耗慢
};

/**
 * 定时衰减计算
 */
const applyTimeDecay = async (habitat) => {
  const now = Date.now();
  const lastDecayed = habitat.lastDecayedAt || habitat.createdAt || now;
  const hoursElapsed = (now - lastDecayed) / 3600000;
  
  if (hoursElapsed < 0.25) {
    return habitat;
  }
  
  const rates = DECAY_RATES[habitat.type] || DECAY_RATES.plant;
  
  const decMoisture = hoursElapsed * rates.moisture;
  const decNutrients = hoursElapsed * rates.nutrients;
  const decSanitation = hoursElapsed * rates.sanitation;
  
  const updatedHabitat = {
    ...habitat,
    moisture: Math.max(0, Math.round(habitat.moisture - decMoisture)),
    nutrients: Math.max(0, Math.round(habitat.nutrients - decNutrients)),
    sanitation: Math.max(0, Math.round(habitat.sanitation - decSanitation)),
    lastDecayedAt: now
  };
  
  await db.habitats.put(updatedHabitat);
  return updatedHabitat;
};

export const getHabitats = async () => {
  const list = await db.habitats.toArray();
  const processed = [];
  for (let h of list) {
    const updated = await applyTimeDecay(h);
    processed.push(updated);
  }
  return processed;
};

export const getHabitatById = async (id) => {
  const habitat = await db.habitats.get(Number(id));
  if (!habitat) return null;
  return await applyTimeDecay(habitat);
};

export const saveHabitat = async (habitat) => {
  const toSave = { ...habitat };
  if (toSave.id === null || toSave.id === undefined) {
    delete toSave.id; // 清理 Dexie 必须的自增主键空字段
    toSave.createdAt = Date.now();
    toSave.lastCaredAt = Date.now();
    toSave.lastDecayedAt = Date.now();
    toSave.moisture = 80;
    toSave.nutrients = 80;
    toSave.sanitation = 80;
    toSave.bondPoints = 0;
    const newId = await db.habitats.add(toSave);
    return newId;
  } else {
    await db.habitats.put(toSave);
    return toSave.id;
  }
};

export const deleteHabitat = async (id) => {
  await db.habitats.delete(Number(id));
  await db.habitatLogs.where({ habitatId: Number(id) }).delete();
};

export const getLogs = async (habitatId) => {
  return await db.habitatLogs
    .where('habitatId')
    .equals(Number(habitatId))
    .reverse()
    .sortBy('timestamp');
};

/**
 * 触发用户照顾动作
 */
export const performUserCare = async (habitatId, actionType) => {
  const habitat = await db.habitats.get(Number(habitatId));
  if (!habitat) return null;
  
  let valMoisture = habitat.moisture;
  let valNutrients = habitat.nutrients;
  let valSanitation = habitat.sanitation;
  let valBond = habitat.bondPoints || 0;
  
  if (actionType === 'feed') {
    valNutrients = Math.min(100, valNutrients + 30);
    valBond += 5;
  } else if (actionType === 'water') {
    valMoisture = Math.min(100, valMoisture + 30);
    valBond += 5;
  } else if (actionType === 'clean') {
    valSanitation = Math.min(100, valSanitation + 30);
    valBond += 5;
  } else if (actionType === 'play') {
    valBond += 15;
    valMoisture = Math.max(0, valMoisture - 5);
    valNutrients = Math.max(0, valNutrients - 5);
  }
  
  const updatedHabitat = {
    ...habitat,
    moisture: valMoisture,
    nutrients: valNutrients,
    sanitation: valSanitation,
    bondPoints: valBond,
    lastCaredAt: Date.now(),
    lastDecayedAt: Date.now()
  };
  
  await db.habitats.put(updatedHabitat);
  
  const isAnimal = habitat.type === 'animal';
  const actionNames = {
    feed: isAnimal ? '喂食' : '施肥',
    water: isAnimal ? '喷水' : '浇水',
    clean: '擦拭清洁',
    play: isAnimal ? '玩耍' : '剪枝抚育'
  };
  
  // 1. 写入用户操作日志
  const logId = await db.habitatLogs.add({
    habitatId: Number(habitatId),
    logType: 'user_action',
    operatorName: '我',
    avatar: '',
    actionType,
    content: `正在为它进行 [${actionNames[actionType]}] 照料...`,
    timestamp: Date.now()
  });
  
  // 2. 异步生成小生命对该动作的即时吐槽/感谢，覆盖操作日志的内容
  try {
    const feedback = await getHabitatActionFeedback(updatedHabitat, actionType);
    await db.habitatLogs.update(logId, { content: feedback });
  } catch (err) {
    console.error(err);
  }
  
  // 30% 几率触发绑定的 AI 角色前来联合照顾
  if (habitat.guardianCharacterId && Math.random() < 0.3) {
    setTimeout(() => {
      triggerGuardianCare(habitatId);
    }, 2500);
  }
  
  return updatedHabitat;
};

/**
 * 触发绑定角色的共同照料
 */
export const triggerGuardianCare = async (habitatId) => {
  const habitat = await db.habitats.get(Number(habitatId));
  if (!habitat || !habitat.guardianCharacterId) return;
  
  const character = await db.characters.get(Number(habitat.guardianCharacterId));
  if (!character) return;
  
  const updatedHabitat = {
    ...habitat,
    moisture: Math.min(100, habitat.moisture + 15),
    nutrients: Math.min(100, habitat.nutrients + 15),
    sanitation: Math.min(100, habitat.sanitation + 10),
    bondPoints: (habitat.bondPoints || 0) + 10,
    lastDecayedAt: Date.now()
  };
  
  await db.habitats.put(updatedHabitat);
  
  try {
    const textNote = await generateGuardianJointCare(updatedHabitat, character);
    await db.habitatLogs.add({
      habitatId: Number(habitatId),
      logType: 'co_care',
      operatorName: character.name,
      avatar: character.avatar || '',
      actionType: 'co_care',
      content: `${textNote} — ${character.name}`,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error(err);
  }
};

/**
 * 重 Roll 对话消息或照料反馈
 */
export const rerollMessage = async (habitatId, logId) => {
  const log = await db.habitatLogs.get(Number(logId));
  if (!log) return null;

  const habitat = await db.habitats.get(Number(habitatId));
  if (!habitat) return null;

  let newContent = '';

  if (log.actionType === 'chat') {
    // 聊天重 Roll：获取该时间戳之前的所有交互日志作为上下文
    const allLogs = await db.habitatLogs
      .where('habitatId')
      .equals(Number(habitatId))
      .sortBy('timestamp');

    const previousLogs = allLogs
      .filter(l => l.timestamp < log.timestamp)
      .slice(-5);

    newContent = await chatWithHabitat(habitat, log.content, previousLogs);
  } else {
    // 照料动作反馈重 Roll
    newContent = await getHabitatActionFeedback(habitat, log.actionType);
  }

  if (newContent) {
    await db.habitatLogs.update(Number(logId), { content: newContent });
    return newContent;
  }
  return null;
};
