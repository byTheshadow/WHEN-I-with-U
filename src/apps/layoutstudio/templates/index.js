// src/apps/layoutstudio/templates/index.js
//
// 模板注册表。加一个新模板 = 新建一个模板文件 + 在下面登记一行，
// 其余代码（清洗、渲染、选择面板、微调面板）都是通用的，不用改。
//
// 每个模板对象的约定：
//   id / label / desc / fits         展示用
//   kinds                            这个模板允许出现的元素种类
//   paramSpec                        模板参数的类型、范围和默认值（清洗时用）
//   paramOptions                     需要在微调面板里露出来的参数选项
//   splitY(params)                   分栏位置（像素），没有分栏返回 0
//   drawBackground(ctx, photos, params)  画底图
//   buildItems({ rand, photoCount, params })  生成一份默认的元素清单

import bracketTemplate from './bracketTemplate';
import bigTypeTemplate from './bigTypeTemplate';
import scatterTemplate from './scatterTemplate';
import stickerTemplate from './stickerTemplate';
import filmTemplate from './filmTemplate';
import playerTemplate from './playerTemplate';
import capsuleTemplate from './capsuleTemplate';
import stripsTemplate from './stripsTemplate';

export const TEMPLATES = [
  bracketTemplate,
  bigTypeTemplate,
  scatterTemplate,
  stickerTemplate,
  filmTemplate,
  playerTemplate,
  capsuleTemplate,
  stripsTemplate,
];

export const getTemplate = (id) => TEMPLATES.find((tpl) => tpl.id === id) || null;