// src/apps/messages/secretCode/secretCodeLook.js
//
// 暗号墙上方块的外观：颜色沿用文件夹的 colorIndex，材质也跟着 colorIndex 走，
// 所以每个文件夹固定一种材质，新建文件夹时 colorIndex 本来就按没被占用的序号轮换，
// 前四个文件夹的材质各不相同：
//   colorIndex 0 → 邮票   1 → 毛玻璃   2 → 票根   3 → 磁带（深色，字是反白的）
// 只存了序号，换主题不用迁移数据。
import { getFolderColorVar } from './secretCodeFolderStyle';

const MATERIALS = ['stamp', 'glass', 'ticket', 'tape'];

export const getFolderLook = (folder) => {
  const index = Number.isInteger(folder?.colorIndex) ? folder.colorIndex : 0;
  const color = getFolderColorVar(folder);
  return {
    mat: MATERIALS[((index % MATERIALS.length) + MATERIALS.length) % MATERIALS.length],
    color,
    ink: color === 'var(--accent-color)' ? 'var(--accent-foreground)' : 'var(--text-main)',
  };
};