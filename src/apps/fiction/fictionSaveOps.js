// src/apps/fiction/fictionSaveOps.js
//
// 互动文游的两个「瘦身 / 复制」操作，单独放一个文件，不往 fictionService.js 里堆：
//
// 1. deleteLeafVersion：删掉重 roll 出来的、还没有后续的旧版本。
//    - 只能删「没有后续剧情」的版本，被接着玩过的版本不能删（那是真正走过的路）。
//    - 同一个行动下至少要留一个版本。
//    - 版本只是同父同 actionKey 的兄弟节点，所以删掉它不影响分支数和段数。
//    - 同时删掉挂在这个节点上的配图元数据和配图本体。
//    - 如果删的正是存档当前所在的节点，当前节点切到相邻的版本。
//
// 2. duplicateSave：复制存档。
//    - mode = 'full'：设定 + 整棵剧情树（所有分支、旧版本、总结、存档点）。
//    - mode = 'settings'：只复制设定（背景、大纲、文风、角色、NPC、数值定义、规则），从头开始。
//    - 两种都不复制配图：副本里节点的 imageIds 清空，封面清空。
//    - 全部在一个事务里，要么都复制成功，要么什么都不留下。

import db from '../../db';
import { ROOT_PARENT_ID, hasChildren, listChildren } from './fictionService';
import { copyBackground } from './fictionBackground';

const now = () => Date.now();

const sameAction = (a, b) => (a.actionKey || '') === (b.actionKey || '');

const clone = (value) => {
  if (value === undefined || value === null) return value;

  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
};

// ---------- 删除旧版本 ----------

// 返回删除之后存档应该停在的那个节点（完整节点对象）。
export const deleteLeafVersion = (saveId, nodeId) => (
  db.transaction(
    'rw',
    db.fictionSaves,
    db.fictionNodes,
    db.fictionImages,
    db.fictionImageFiles,
    db.fictionBackgrounds,
    async () => {
      const node = await db.fictionNodes.get(nodeId);

      if (!node || node.saveId !== saveId) throw new Error('这一段找不到了。');

      if (await hasChildren(saveId, nodeId)) {
        throw new Error('这个版本后面已经有剧情了，不能删除。');
      }

      const others = (await listChildren(saveId, node.parentId))
        .filter((item) => item.id !== nodeId && sameAction(item, node))
        .sort((a, b) => a.id - b.id);

      if (others.length === 0) throw new Error('至少要留下一个版本。');

      const hasKids = await Promise.all(others.map((item) => hasChildren(saveId, item.id)));
      const leaves = others.filter((item, index) => !hasKids[index]);

      // 优先停在前一个没有后续的版本，没有就停在后一个；
      // 剩下的全是被接着玩过的版本时，停在其中最新的一个。
      let target = null;

      if (leaves.length > 0) {
        const before = leaves.filter((item) => item.id < nodeId);

        target = before.length > 0 ? before[before.length - 1] : leaves[0];
      } else {
        target = others[others.length - 1];
      }

      const images = await db.fictionImages.where('nodeId').equals(nodeId).toArray();
      const fileIds = images.map((image) => image.fileId).filter((id) => id != null);

      if (fileIds.length > 0) await db.fictionImageFiles.bulkDelete(fileIds);
      if (images.length > 0) await db.fictionImages.where('nodeId').equals(nodeId).delete();

      await db.fictionNodes.delete(nodeId);

      const save = await db.fictionSaves.get(saveId);

      if (save) {
        const patch = { updatedAt: now() };

        if (save.currentNodeId === nodeId) patch.currentNodeId = target.id;
        if (images.some((image) => image.id === save.coverImageId)) patch.coverImageId = null;

        await db.fictionSaves.update(saveId, patch);
      }

      return db.fictionNodes.get(target.id);
    },
  )
);

// ---------- 复制存档 ----------

export const DUPLICATE_MODES = {
  FULL: 'full',
  SETTINGS: 'settings',
};

// 返回新存档的 id。
export const duplicateSave = (saveId, { mode = DUPLICATE_MODES.FULL } = {}) => (
  db.transaction('rw', db.fictionSaves, db.fictionNodes, db.fictionBackgrounds, async () => {
    const source = await db.fictionSaves.get(saveId);

    if (!source) throw new Error('存档不存在。');

    const timestamp = now();
    const { id: _sourceId, ...rest } = clone(source);
    const copyAll = mode === DUPLICATE_MODES.FULL;

    const nextSave = {
      ...rest,
      title: `${String(source.title || '未命名故事').trim()}（副本）`,
      currentNodeId: null,
      coverImageId: null,
      segmentCount: 0,
      branchCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

   const newSaveId = await db.fictionSaves.add(nextSave);
    await copyBackground(saveId, newSaveId);

    if (!copyAll) return newSaveId;

    // 从开场往下一层一层复制：保证父节点先有新 id，子节点才能指过去。
    // 不在这棵树上的孤儿节点不会被复制。
    const nodes = await db.fictionNodes.where('saveId').equals(saveId).toArray();
    const byParent = new Map();

    nodes
      .sort((a, b) => a.id - b.id)
      .forEach((node) => {
        const key = node.parentId ?? ROOT_PARENT_ID;

        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(node);
      });

    const idMap = new Map();
    let level = byParent.get(ROOT_PARENT_ID) || [];

    while (level.length > 0) {
      const nextLevel = [];

      // 同一层按原来的创建顺序依次写入，新 id 的先后顺序和原来一致，
      // 版本切换（按 id 排序）的顺序也就一致。
      for (const node of level) {
        const { id: oldId, ...fields } = clone(node);

        const newId = await db.fictionNodes.add({
          ...fields,
          saveId: newSaveId,
          parentId: node.parentId === ROOT_PARENT_ID ? ROOT_PARENT_ID : idMap.get(node.parentId),
          imageIds: [],
        });

        idMap.set(oldId, newId);
        nextLevel.push(...(byParent.get(oldId) || []));
      }

      level = nextLevel;
    }

    await db.fictionSaves.update(newSaveId, {
      currentNodeId: source.currentNodeId != null ? (idMap.get(source.currentNodeId) ?? null) : null,
      segmentCount: source.segmentCount || 0,
      branchCount: source.branchCount || 0,
    });

    return newSaveId;
  })
);