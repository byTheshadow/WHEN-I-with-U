// src/apps/fiction/fictionService.js
//
// 互动文游的数据层：存档（fictionSaves）、剧情节点（fictionNodes）的增删改查。
// 配图相关的两张表（fictionImages 元数据 / fictionImageFiles Blob 本体）
// 这一轮只在删除存档时用到，读写图片留到第 7 轮。
//
// 两条约定，写代码时容易忘：
// 1. 开场节点的 parentId 用 ROOT_PARENT_ID（0），不用 null。
//    IndexedDB 的索引键不能是 null，parentId 为 null 的记录不会进
//    parentId 索引，也不会进 [saveId+parentId] 复合索引，按父节点查子节点时会漏掉开场。
// 2. 所有时间戳都存毫秒数（Date.now()），updatedAt 要拿来排序。
//
// 第 3 轮起：存档上冗余 segmentCount（当前路径长度）和 branchCount（分支数）
// 两个数字，书架直接读它们，不再把全部节点读出来现算。凡是改动节点结构的
// 操作（新增节点、切换当前节点）都要在同一个事务里更新这两个数字。
// 分支数算法：同一父节点下「不同 actionKey」的个数减一，累加；
// actionKey 相同的是重 roll 版本，不算分支。
//
// 第 4B 轮：存档点（setSavePoint / clearSavePoint）只改节点上的标记。
//
// 第 5A 轮：总结（summaryText）也只是挂在节点上的一段文本，不新建表、
// 不用动 db 版本号——节点早就带着这个字段（见 createNode），只是一直是空的。

import db from '../../db';
import { collectSummaryBatches, findPendingSummaryBatch } from './fictionPromptAssembler';
import { PARSE_WARNING } from './fictionParser';

export const FICTION_MODES = {
  CHOICE: 'choice',
  NOVEL: 'novel',
};

export const FICTION_IMAGE_MODES = {
  OFF: 'off',
  MANUAL: 'manual',
  AUTO: 'auto',
};

export const ROOT_PARENT_ID = 0;

const now = () => Date.now();

// ---------- 存档 ----------

export const buildBlankSave = (overrides = {}) => ({
  mode: FICTION_MODES.CHOICE,
  title: '未命名故事',
  background: '',
  outline: '',
  style: { presetId: '', custom: '' },
  wordMin: 2000,
  optionMin: 3,
  allowFreeInput: true,
  showDeltas: false,
  imageMode: FICTION_IMAGE_MODES.OFF,
  worldBookIds: [],
  localEntries: [],
  persona: null,
  mainCharacter: null,
  importedCharacters: [],
  npcs: [],
  stats: [],
  currentNodeId: null,
  coverImageId: null,
  segmentCount: 0,
  branchCount: 0,
  ...overrides,
});

export const createSave = async (data = {}) => {
  const timestamp = now();

  return db.fictionSaves.add({
    ...buildBlankSave(data),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
};

export const getSave = (saveId) => db.fictionSaves.get(saveId);

export const updateSave = async (saveId, patch) => {
  await db.fictionSaves.update(saveId, { ...patch, updatedAt: now() });
};

// 只刷新「最近游玩」时间，不改别的字段。
export const touchSave = (saveId) => updateSave(saveId, {});

export const listSaves = () => db.fictionSaves.orderBy('updatedAt').reverse().toArray();

// 删除存档：节点、配图元数据、配图本体一起删，放在同一个事务里，
// 要么全删要么都不动，不会留下找不到存档的孤儿节点。
export const deleteSave = async (saveId) => {
  await db.transaction(
    'rw',
    db.fictionSaves,
    db.fictionNodes,
    db.fictionImages,
    db.fictionImageFiles,
    async () => {
      const images = await db.fictionImages.where('saveId').equals(saveId).toArray();
      const fileIds = images.map((image) => image.fileId).filter((id) => id != null);

      if (fileIds.length > 0) await db.fictionImageFiles.bulkDelete(fileIds);

      await db.fictionImages.where('saveId').equals(saveId).delete();
      await db.fictionNodes.where('saveId').equals(saveId).delete();
      await db.fictionSaves.delete(saveId);
    },
  );
};

// ---------- 节点 ----------

export const createNode = async (saveId, data) => {
  const timestamp = now();

  return db.fictionNodes.add({
    parentId: ROOT_PARENT_ID,
    userAction: null,
    actionKey: '',
    text: '',
    options: [],
    statsSnapshot: {},
    imageIds: [],
    isSavePoint: false,
    savePointName: '',
    chapter: 1,
    summaryText: '',
    ...data,
    saveId,
    createdAt: timestamp,
  });
};

export const getNode = (nodeId) => db.fictionNodes.get(nodeId);

export const updateNode = (nodeId, patch) => db.fictionNodes.update(nodeId, patch);

// 手动改某一段的正文：只改 text，选项、数值快照、总结、分支关系都不动，也不重新生成。
// 打上 userEdited / editedAt 标记（新增的非索引字段，不用动 db 版本号）。
// 如果这一段之前被判定为「输出被截断」，手动改过就不再提示截断。
// 返回更新后的完整节点，调用方直接拿去替换界面里的旧节点。
export const updateNodeText = async (nodeId, text) => {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();

  if (!clean) throw new Error('正文不能为空');

  const node = await db.fictionNodes.get(nodeId);

  if (!node) throw new Error('这一段找不到了');

  const patch = { text: clean, userEdited: true, editedAt: now() };

  if (Array.isArray(node.parseWarnings)) {
    patch.parseWarnings = node.parseWarnings.filter((warning) => warning?.code !== PARSE_WARNING.TRUNCATED);
  }

  await db.fictionNodes.update(nodeId, patch);

  return { ...node, ...patch };
};

export const listNodesBySave = (saveId) => db.fictionNodes.where('saveId').equals(saveId).toArray();

export const listChildren = (saveId, parentId) => (
  db.fictionNodes.where('[saveId+parentId]').equals([saveId, parentId]).toArray()
);

export const hasChildren = async (saveId, nodeId) => (
  (await db.fictionNodes.where('[saveId+parentId]').equals([saveId, nodeId]).count()) > 0
);

// 开场节点（可能有多个，那是重 roll 出来的版本，取最早的一个）。
export const getRootNode = async (saveId) => {
  const roots = await listChildren(saveId, ROOT_PARENT_ID);

  return roots.sort((a, b) => a.id - b.id)[0] || null;
};

// ---------- 版本（重 roll） ----------
//
// 同一个父节点下 actionKey 相同的节点互为「版本」：重 roll 就是在原节点旁边
// 新增一个同父同 actionKey 的节点，旧版本原样保留。

const sameAction = (a, b) => (a.actionKey || '') === (b.actionKey || '');

// 这个节点的所有「还没有后续」的版本，按创建顺序排。节点自己即使有后续
// 也会留在列表里，这样调用方总能找到自己的位置。
// 有后续的版本是已经被接着玩过的，它们属于另一条分支，在故事线里看，不进这个列表。
export const listLeafVersions = async (node) => {
  const siblings = await listChildren(node.saveId, node.parentId);
  const versions = siblings.filter((item) => sameAction(item, node)).sort((a, b) => a.id - b.id);
  const hasKids = await Promise.all(versions.map((item) => hasChildren(item.saveId, item.id)));

  return versions.filter((item, index) => !hasKids[index] || item.id === node.id);
};

// 在 parentId 下找「已经走过的这个行动」对应的节点。有好几个版本时，
// 优先取被接着玩过的那个（那才是玩家真正走过的路），否则取最新的版本。
export const findExistingChild = async (saveId, parentId, actionKey) => {
  const siblings = (await listChildren(saveId, parentId))
    .filter((item) => (item.actionKey || '') === (actionKey || ''))
    .sort((a, b) => a.id - b.id);

  if (siblings.length === 0) return null;

  const hasKids = await Promise.all(siblings.map((item) => hasChildren(item.saveId, item.id)));
  const played = siblings.filter((item, index) => hasKids[index]);

  return played.length > 0 ? played[played.length - 1] : siblings[siblings.length - 1];
};

// 从某个节点一路往上走到开场，返回从开场到该节点的顺序数组。
// 提示词组装、故事线、回看都靠它取「当前路径」。
export const getPathToNode = async (nodeId) => {
  const path = [];
  const seen = new Set();
  let cursor = nodeId ? await db.fictionNodes.get(nodeId) : null;

  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.push(cursor);
    cursor = cursor.parentId === ROOT_PARENT_ID ? null : await db.fictionNodes.get(cursor.parentId);
  }

  return path.reverse();
};

// 路径长度（只数节点个数，不把正文读出来之外的东西带走）。
const countPathLength = async (nodeId) => (await getPathToNode(nodeId)).length;

/**
 * 新增一个节点，并把它设为存档的当前节点。节点写入和存档上
 * currentNodeId / segmentCount / branchCount 的更新在同一个事务里，
 * 要么都成功要么都不动。返回新节点的 id。
 *
 * data 里至少要有 parentId（开场用 ROOT_PARENT_ID）和 actionKey。
 */
export const appendNode = (saveId, data) => (
  db.transaction('rw', db.fictionSaves, db.fictionNodes, async () => {
    const save = await db.fictionSaves.get(saveId);

    if (!save) throw new Error('存档不存在');

    const parentId = data.parentId ?? ROOT_PARENT_ID;
    const actionKey = data.actionKey || '';

    const siblings = await listChildren(saveId, parentId);
    const isNewBranch = siblings.length > 0 && !siblings.some((node) => (node.actionKey || '') === actionKey);

    const depth = parentId === ROOT_PARENT_ID ? 1 : (await countPathLength(parentId)) + 1;

    const nodeId = await createNode(saveId, { ...data, parentId, actionKey });

    await db.fictionSaves.update(saveId, {
      currentNodeId: nodeId,
      segmentCount: depth,
      branchCount: (save.branchCount || 0) + (isNewBranch ? 1 : 0),
      updatedAt: now(),
    });

    return nodeId;
  })
);

// 回退 / 切换到某个节点：更新当前节点和段数。分支数不变（节点都还在）。
export const setCurrentNode = (saveId, nodeId) => (
  db.transaction('rw', db.fictionSaves, db.fictionNodes, async () => {
    const node = await db.fictionNodes.get(nodeId);

    if (!node || node.saveId !== saveId) throw new Error('节点不存在');

    await db.fictionSaves.update(saveId, {
      currentNodeId: nodeId,
      segmentCount: await countPathLength(nodeId),
      updatedAt: now(),
    });
  })
);

// ---------- 存档点（第 4B 轮） ----------
//
// 存档点只是节点上的一个标记（isSavePoint + savePointName），故事线里会插一面小旗。
// 不复制任何数据：回到存档点就是 setCurrentNode 到那个节点。

export const SAVE_POINT_NAME_MAX = 12;

export const setSavePoint = async (nodeId, name) => {
  const clean = String(name || '').trim().slice(0, SAVE_POINT_NAME_MAX);

  if (!clean) throw new Error('存档点要有个名字');

  await db.fictionNodes.update(nodeId, { isSavePoint: true, savePointName: clean });

  return clean;
};

export const clearSavePoint = (nodeId) => (
  db.fictionNodes.update(nodeId, { isSavePoint: false, savePointName: '' })
);

// ---------- 总结（第 5A 轮） ----------
//
// 总结挂在「这一批最后一段」对应的节点上（算法见 fictionPromptAssembler.js
// 的 collectSummaryBatches / findPendingSummaryBatch）。这两个函数只读，
// 这里的 getSummaryStatus 把「当前路径」取出来喂给它们，saveSummary /
// clearSummary 负责写。

// 当前存档的总结情况：已经做好的总结（按顺序）+ 当前待总结的区间（没有就是
// null）。总结总览页和游玩页右上角的提示入口都读这个。
export const getSummaryStatus = async (saveId) => {
  const save = await getSave(saveId);

  if (!save?.currentNodeId) return { pathNodes: [], batches: [], pending: null };

  const pathNodes = await getPathToNode(save.currentNodeId);

  return {
    pathNodes,
    batches: collectSummaryBatches(pathNodes),
    pending: findPendingSummaryBatch(pathNodes),
  };
};

export const saveSummary = async (nodeId, text) => {
  const clean = String(text || '').trim();

  if (!clean) throw new Error('总结内容不能为空');

  await db.fictionNodes.update(nodeId, { summaryText: clean });

  return clean;
};

export const clearSummary = (nodeId) => db.fictionNodes.update(nodeId, { summaryText: '' });

// 兜底：把存档的 segmentCount / branchCount 按全部节点重新算一遍。
// 平时不用调用（增量更新就够了）；删除节点或数据对不上时用。
export const recomputeSaveCounters = (saveId) => (
  db.transaction('rw', db.fictionSaves, db.fictionNodes, async () => {
    const save = await db.fictionSaves.get(saveId);

    if (!save) return;

    const nodes = await listNodesBySave(saveId);
    const keysByParent = new Map();

    nodes.forEach((node) => {
      const keys = keysByParent.get(node.parentId) || new Set();

      keys.add(node.actionKey || `#${node.id}`);
      keysByParent.set(node.parentId, keys);
    });

    let branchCount = 0;

    keysByParent.forEach((keys) => {
      branchCount += Math.max(0, keys.size - 1);
    });

    await db.fictionSaves.update(saveId, {
      segmentCount: save.currentNodeId ? await countPathLength(save.currentNodeId) : 0,
      branchCount,
    });
  })
);

// ---------- 书架用的汇总 ----------

// 段数、分支数都直接读存档上的冗余字段；第 2 轮之前建的存档没有这两个字段，补 0。
export const listSaveSummaries = async () => {
  const saves = await listSaves();

  return saves.map((save) => ({
    ...save,
    segmentCount: save.segmentCount || 0,
    branchCount: save.branchCount || 0,
  }));
};

export default {
  FICTION_MODES,
  FICTION_IMAGE_MODES,
  ROOT_PARENT_ID,
  buildBlankSave,
  createSave,
  getSave,
  updateSave,
  touchSave,
  listSaves,
  deleteSave,
  createNode,
  getNode,
  updateNode,
  updateNodeText,
  listNodesBySave,
  listChildren,
  hasChildren,
  getRootNode,
  listLeafVersions,
  findExistingChild,
  getPathToNode,
  appendNode,
  setCurrentNode,
  SAVE_POINT_NAME_MAX,
  setSavePoint,
  clearSavePoint,
  getSummaryStatus,
  saveSummary,
  clearSummary,
  recomputeSaveCounters,
  listSaveSummaries,
};