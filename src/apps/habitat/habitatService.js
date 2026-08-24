import db from '../../db';
import { getHabitatActionFeedback, generateGuardianJointCare } from './habitatAiService';

const DECAY_RATES = {
  animal: { moisture: 3.0, nutrients: 4.0, sanitation: 2.0 },
  plant: { moisture: 2.0, nutrients: 2.0, sanitation: 1.0 }
};

const applyTimeDecay = async (habitat) => {
  const now = Date.now();
  const lastDecayed = habitat.lastDecayedAt || habitat.createdAt || now;
  const hoursElapsed = (now - lastDecayed) / 3600000;
  
  if (hoursElapsed < 0.25) {
    return habitat;
  }
  
  const rates = DECAY_RATES[habitat.type] || DECAY_RATES.plant;
  
  const updatedHabitat = {
    ...habitat,
    moisture: Math.max(0, Math.round(habitat.moisture - hoursElapsed * rates.moisture)),
    nutrients: Math.max(0, Math.round(habitat.nutrients - hoursElapsed * rates.nutrients)),
    sanitation: Math.max(0, Math.round(habitat.sanitation - hoursElapsed * rates.sanitation)),
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
    delete toSave.id;
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
 * 清空指定类别的照料日志
 * type: 'user_action' | 'co_care'
 */
export const clearLogsByType = async (habitatId, logType) => {
  await db.habitatLogs
    .where({ habitatId: Number(habitatId), logType })
    .delete();
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
    water: isAnimal ? '喷雾' : '浇水',
    clean: '擦拭清洁',
    play: isAnimal ? '玩耍' : '剪枝抚育'
  };
  
  const logId = await db.habitatLogs.add({
    habitatId: Number(habitatId),
    logType: 'user_action',
    operatorName: '我',
    avatar: '',
    actionType,
    content: `正在为它进行 [${actionNames[actionType]}] 照料...`,
    timestamp: Date.now()
  });
  
  try {
    const feedback = await getHabitatActionFeedback(updatedHabitat, actionType);
    await db.habitatLogs.update(logId, { content: feedback });
  } catch (err) {
    console.error(err);
  }
  
  if (habitat.guardianCharacterId && Math.random() < 0.4) {
    setTimeout(() => {
      triggerGuardianCare(habitatId);
    }, 2000);
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
      content: textNote,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error(err);
  }
};
