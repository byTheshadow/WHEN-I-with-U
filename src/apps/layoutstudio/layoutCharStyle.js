// src/apps/layoutstudio/layoutCharStyle.js
//
// 相机版界面里和"角色"有关的装饰数据。
// 角色记录里没有颜色和镜头参数，这里用角色 id + 名字算一个稳定的哈希，
// 同一个角色永远得到同一枚镜头的颜色和同一行曝光参数，纯装饰，不写库。

export const charInitial = (character) =>
  String(character?.name || '?').trim().slice(0, 1).toUpperCase() || '?';

const hashOf = (character) => {
  const text = `${character?.id ?? ''}|${character?.name ?? ''}`;
  let h = 7;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
};

const LENSES = ['24MM', '35MM', '50MM', '85MM'];
const ISOS = [100, 200, 400, 800];
const APERTURES = ['F1.8', 'F2', 'F2.8', 'F8'];
const SHUTTERS = ['1/30', '1/60', '1/250', '1/500'];

// 镜头的主色，柔和的 HSL。
export const charTint = (character) => `hsl(${hashOf(character) % 360} 60% 72%)`;

export const charExif = (character) => {
  const h = hashOf(character);
  return {
    lens: LENSES[h % 4],
    iso: ISOS[(h >>> 3) % 4],
    f: APERTURES[(h >>> 5) % 4],
    ss: SHUTTERS[(h >>> 7) % 4],
  };
};

export const charExifLine = (character) => {
  if (!character) return 'ISO -- F-- 1/-- ----';
  const e = charExif(character);
  return `ISO ${e.iso} ${e.f} ${e.ss} ${e.lens}`;
};
