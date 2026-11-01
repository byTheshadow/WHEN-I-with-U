// src/apps/layoutstudio/layoutSpec.js
//
// "版面清单"（spec）：一张成品图的完整描述，纯 JSON，可存、可传、可让 AI 写。
//
//   {
//     v: 1,
//     templateId: 'bracket' | 'bigtype' | 'scatter' | 'sticker',
//     params: { ...模板参数，见各模板的 paramSpec },
//     items: [ text / row / shape / sticker 元素，坐标全部 0~1 ]
//   }
//
// 这个文件负责两件事：
//   1. createDefaultSpec：给定模板，生成一份默认排布（切片A里"随机出一版"用）；
//   2. sanitizeSpec：把任意来源（以后是 AI 的输出、数据库里的旧数据）的 JSON
//      清洗成安全、合法、可直接渲染的 spec。非法字段回退默认值，不会抛错。

import { MAX_ITEMS, STICKER_KINDS, TEXT_ALIGNS, TEXT_FONTS, DEFAULT_GLYPHS } from './layoutConstants';
import { createRng } from './layoutDraw';
import { TEMPLATES, getTemplate } from './templates';
import { toChoice, toColor, toInt, toNumber, toText } from './layoutSpecUtils';

export const SPEC_VERSION = 1;

const buildDefaultParams = (tpl) =>
  Object.fromEntries(
    Object.entries(tpl.paramSpec).map(([key, def]) => [key, def.default])
  );

export const createDefaultSpec = (templateId, { photoCount = 1, seed = 7 } = {}) => {
  const tpl = getTemplate(templateId) || TEMPLATES[0];
  const params = buildDefaultParams(tpl);
  const items = tpl.buildItems({
    rand: createRng(seed),
    photoCount: Math.max(1, photoCount),
    params,
  });
  return { v: SPEC_VERSION, templateId: tpl.id, params, items };
};

// 随机挑一个模板（尽量不和 excludeId 重复）。
export const pickTemplateId = (excludeId) => {
  const pool = TEMPLATES.filter((tpl) => tpl.id !== excludeId);
  const list = pool.length ? pool : TEMPLATES;
  return list[Math.floor(Math.random() * list.length)].id;
};

const cleanParams = (tpl, raw) => {
  const input = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  Object.entries(tpl.paramSpec).forEach(([key, def]) => {
    const value = input[key];
    if (def.type === 'number') out[key] = toNumber(value, def.default, def.min, def.max);
    else if (def.type === 'color') out[key] = toColor(value, def.default);
    else if (def.type === 'choice') out[key] = toChoice(value, def.options, def.default);
    else if (def.type === 'bool') out[key] = typeof value === 'boolean' ? value : def.default;
  });
  return out;
};

const cleanItem = (raw, index, photoCount) => {
  const id = toText(raw.id, `i${index}`).slice(0, 12) || `i${index}`;
  const x = toNumber(raw.x, 0.5, 0, 1);
  const y = toNumber(raw.y, 0.5, 0, 1);
  const lastPhoto = Math.max(0, photoCount - 1);

  if (raw.kind === 'text') {
    return {
      kind: 'text',
      id,
      text: toText(raw.text),
      x,
      y,
      size: toNumber(raw.size, 0.05, 0.015, 0.3),
      color: toColor(raw.color, '#ffffff'),
      font: toChoice(raw.font, TEXT_FONTS, 'sans'),
      weight: toInt(raw.weight, 700, 300, 900),
      align: toChoice(raw.align, TEXT_ALIGNS, 'center'),
      rot: toNumber(raw.rot, 0, -45, 45),
      shadow: Boolean(raw.shadow),
    };
  }
  if (raw.kind === 'row') {
    return {
      kind: 'row',
      id,
      text: toText(raw.text),
      x,
      y,
      size: toNumber(raw.size, 0.052, 0.025, 0.09),
      side: toChoice(raw.side, ['left', 'right'], 'left'),
      photo: toInt(raw.photo, 0, 0, lastPhoto),
      color: toColor(raw.color, '#ffffff'),
    };
  }
  if (raw.kind === 'shape') {
    return {
      kind: 'shape',
      id,
      x,
      y,
      size: toNumber(raw.size, 0.03, 0.01, 0.18),
      rot: toNumber(raw.rot, 0, -360, 360),
      shape: toChoice(raw.shape, ['circle', 'square', 'star', 'petal'], 'circle'),
      fill: toChoice(raw.fill, ['photo', 'white', 'color'], 'white'),
      color: toColor(raw.color, '#ffffff'),
      photo: toInt(raw.photo, 0, 0, lastPhoto),
      text: toText(raw.text),
      textColor: toColor(raw.textColor, '#ffffff'),
    };
  }
  if (raw.kind === 'sticker') {
    return {
      kind: 'sticker',
      id,
      sticker: toChoice(raw.sticker, STICKER_KINDS, 'sparkle'),
      glyph: [...toText(raw.glyph, DEFAULT_GLYPHS[0])].slice(0, 4).join('') || DEFAULT_GLYPHS[0],
      x,
      y,
      size: toNumber(raw.size, 0.06, 0.02, 0.16),
      rot: toNumber(raw.rot, 0, -180, 180),
      color: toColor(raw.color, '#e4eeff'),
      color2: toColor(raw.color2, '#4a4a50'),
      mode: toChoice(raw.mode, ['duo', 'solid'], 'solid'),
    };
  }
  return null;
};

/**
 * 清洗任意输入为合法 spec。模板 id 无效时返回 null（调用方应回退到默认版面）。
 * photoCount 用来把元素里引用的"第几张照片"限制在有效范围内。
 */
export const sanitizeSpec = (raw, photoCount = 1) => {
  if (!raw || typeof raw !== 'object') return null;
  const tpl = getTemplate(raw.templateId);
  if (!tpl) return null;

  const source = Array.isArray(raw.items) ? raw.items.slice(0, MAX_ITEMS) : [];
  const items = [];
  source.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    if (!tpl.kinds.includes(item.kind)) return;
    const cleaned = cleanItem(item, index, Math.max(1, photoCount));
    if (cleaned) items.push(cleaned);
  });

  return {
    v: SPEC_VERSION,
    templateId: tpl.id,
    params: cleanParams(tpl, raw.params),
    items,
  };
};
