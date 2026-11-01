// src/apps/layoutstudio/layoutAiService.js
//
// 修图室里"角色"的那部分：
//   - describePhotos      用视觉模型把照片读成文字（没配置视觉模型时返回空）；
//   - composeWithCharacter 角色挑模板、写图上的字、定位置，并写"为什么这样修"
//                          和对照片的评价，返回清洗过的 spec；
//   - writeNotes          用户自己选了模板时，让角色只补写这两句话；
//   - buildSummaryText    发回聊天室的摘要文字（写进消息 content，记忆能读到）；
//   - sendResultToChat    把成品图和摘要发进角色的聊天室。
// 出图和补写话时，会带上和这位角色最近的 12 条聊天（layoutChatContext.js，只读）。
//
// AI 的输出一律走 sanitizeSpec 清洗，坏数据只会退回默认排布，不会让页面报错。

import db from '../../db';
import { generateResponse } from '../../services/aiService';
import { describeImageWithVision, getVisionApiConfig, isVisionConfigured } from '../../services/visionService';
import { sendPhotoMessage } from '../messages/photoMessageService';
import { loadRecentChatContext, resolveChatFor } from './layoutChatContext';
import { createDefaultSpec, pickTemplateId, sanitizeSpec } from './layoutSpec';
import { TEMPLATES, getTemplate } from './templates';

const VISION_SIDE = 768;
const MAX_VISION_PHOTOS = 3;
const NOTE_MAX = 80;

// 提示词里的 emoji 只允许出现在图上的字里，聊天用的话一律去掉。
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
const stripEmoji = (text) => String(text || '').replace(EMOJI_PATTERN, '').trim();

const cleanNote = (value) => {
  const text = stripEmoji(value).replace(/\s+/g, ' ');
  return [...text].slice(0, NOTE_MAX).join('');
};

/* ---------- 视觉 ---------- */

const photoToDataUrl = (photo) => {
  const scale = Math.min(1, VISION_SIDE / Math.max(photo.width, photo.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(photo.width * scale));
  canvas.height = Math.max(1, Math.round(photo.height * scale));
  canvas.getContext('2d').drawImage(photo.el, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
};

export const isVisionReady = async () => {
  try {
    return isVisionConfigured(await getVisionApiConfig());
  } catch {
    return false;
  }
};

/** 返回 string[]（和 photos 前几张一一对应，识别失败的位置是空串）。 */
export const describePhotos = async (photos) => {
  if (!(await isVisionReady())) return [];
  const out = [];
  for (const photo of photos.slice(0, MAX_VISION_PHOTOS)) {
    try {
      const result = await describeImageWithVision(photoToDataUrl(photo));
      out.push(result && !result.error ? String(result.description || '').slice(0, 400) : '');
    } catch (error) {
      console.warn('[LayoutStudio] 视觉识别失败：', error);
      out.push('');
    }
  }
  return out.some(Boolean) ? out : [];
};

/* ---------- 提示词 ---------- */

const round2 = (value) => (typeof value === 'number' ? Math.round(value * 100) / 100 : value);

const compactExample = (templateId, photoCount) => {
  const spec = createDefaultSpec(templateId, { photoCount, seed: 7 });
  const items = spec.items.slice(0, 6).map((item) =>
    Object.fromEntries(Object.entries(item).map(([key, value]) => [key, round2(value)]))
  );
  return JSON.stringify({ templateId, params: spec.params, items });
};

const templateCatalogue = (photoCount) =>
  TEMPLATES.map(
    (tpl) =>
      `- ${tpl.id}（${tpl.label}）：${tpl.desc}。${tpl.fits}。允许的元素 kind：${tpl.kinds.join('、')}。\n  示例：${compactExample(tpl.id, photoCount)}`
  ).join('\n');

const describeCharacter = (character) => {
  const name = character?.name || '对方';
  const bio = String(character?.bio || '').slice(0, 800) || '暂无明确角色背景。';
  const notes = String(character?.extraNotes || '').slice(0, 600) || '暂无补充设定。';
  return { name, text: `你正在扮演角色「${name}」。\n角色背景：${bio}\n补充设定：${notes}` };
};

const photoBlock = (photoCount, descriptions) => {
  const lines = [`User 给了你 ${photoCount} 张照片，第 1 张（索引 0）是主图。`];
  if (descriptions.some(Boolean)) {
    descriptions.forEach((text, i) => text && lines.push(`第 ${i + 1} 张的内容：${text}`));
  } else {
    lines.push('你看不到照片的具体内容，只能按自己的性格来排版和写字，点评要含蓄、不要编造画面细节。');
  }
  return lines.join('\n');
};

// 最近聊天记录：只用来把握你们的关系和说话口吻，没有记录时整段省略。
const chatBlock = (chatContext) =>
  chatContext
    ? `\n你和 User 最近的聊天（只用来把握你们的关系和说话口吻，不要复述，也不要在输出里提到这段记录）：\n${chatContext}\n`
    : '';

const buildComposePrompt = ({ character, photoCount, descriptions, excludeId, chatContext }) => {
  const who = describeCharacter(character);
  return `${who.text}
${chatBlock(chatContext)}
现在你在「修图室」里帮 User 修一张图：从下面的模板里挑一个，写上图上的字，并决定字和贴纸摆在哪里。

${photoBlock(photoCount, descriptions)}

可选模板：
${templateCatalogue(photoCount)}
${excludeId ? `\n上一版用了 ${excludeId}，这次尽量换一个别的。\n` : ''}
输出要求：只输出一个 JSON 对象，不要代码块，不要解释。字段：
{"templateId":"模板id","params":{可选，模板参数},"items":[元素列表，可参考示例改字、位置、颜色],"why":"你为什么这样修，第一人称，一句话","praise":"你对 User 这张照片的评价，第一人称，一句话"}
规则：
1. 元素的 x、y 是 0 到 1 的相对位置，size 是相对画布宽度的比例，只能用该模板允许的 kind。
2. 图上的字要短（单行不超过 12 个字），符合你的性格和这张照片的气氛。图上的字里可以带 emoji 装饰。
3. why 和 praise 各不超过 60 字，不要使用 emoji，不要声称自己是 AI，不要出现"模板""JSON"等字眼。
4. 如果拿不准元素怎么写，items 可以省略，系统会用默认排布。`;
};

const buildNotesPrompt = ({ character, photoCount, descriptions, spec, chatContext }) => {
  const who = describeCharacter(character);
  const tpl = getTemplate(spec.templateId);
  const texts = spec.items.map((item) => item.text || (item.sticker === 'glyph' ? item.glyph : '')).filter(Boolean);
  return `${who.text}
${chatBlock(chatContext)}
User 在「修图室」里选了「${tpl?.label || spec.templateId}」这个版式，把照片修成了一张图，图上写着：${texts.join(' / ') || '（没有文字）'}。

${photoBlock(photoCount, descriptions)}

请用你的口吻说两句话。只输出 JSON：{"why":"你觉得这样修好在哪里，一句话","praise":"你对 User 这张照片的评价，一句话"}
每句不超过 60 字，不要使用 emoji，不要声称自己是 AI，不要出现"模板""JSON"等字眼。`;
};

/* ---------- 解析 ---------- */

const parseJsonObject = (text) => {
  const raw = String(text || '').replace(/```(?:json)?/gi, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};

/* ---------- 对外接口 ---------- */

/**
 * 角色挑模板、写字、写话。永远返回可用结果：AI 失败时 usedAi=false，
 * spec 退回一个随机默认排布，why/praise 为空串。
 */
export const composeWithCharacter = async ({ character, photos, descriptions = [], excludeId }) => {
  const photoCount = Math.max(1, photos.length);
  const fallbackSpec = () =>
    createDefaultSpec(pickTemplateId(excludeId), { photoCount, seed: 1 + Math.floor(Math.random() * 99999) });

  try {
    const chatContext = await loadRecentChatContext({ character });
    const reply = await generateResponse([
      { role: 'system', content: buildComposePrompt({ character, photoCount, descriptions, excludeId, chatContext }) },
      { role: 'user', content: '请开始修这张图，直接输出 JSON。' },
    ]);
    const data = parseJsonObject(reply);
    if (!data) return { spec: fallbackSpec(), why: '', praise: '', usedAi: false };

    let spec = sanitizeSpec(data, photoCount);
    if (!spec) {
      return { spec: fallbackSpec(), why: cleanNote(data.why), praise: cleanNote(data.praise), usedAi: false };
    }
    if (spec.items.length === 0) {
      const base = createDefaultSpec(spec.templateId, { photoCount, seed: 1 + Math.floor(Math.random() * 99999) });
      spec = { ...base, params: { ...base.params, ...spec.params } };
    }
    return { spec, why: cleanNote(data.why), praise: cleanNote(data.praise), usedAi: true };
  } catch (error) {
    console.warn('[LayoutStudio] 角色出图失败：', error);
    return { spec: fallbackSpec(), why: '', praise: '', usedAi: false };
  }
};

/** 用户自己选了版式时，让角色补两句话。失败返回 null。 */
export const writeNotes = async ({ character, photos, descriptions = [], spec }) => {
  try {
    const chatContext = await loadRecentChatContext({ character });
    const reply = await generateResponse([
      { role: 'system', content: buildNotesPrompt({ character, photoCount: Math.max(1, photos.length), descriptions, spec, chatContext }) },
      { role: 'user', content: '请说你的两句话，直接输出 JSON。' },
    ]);
    const data = parseJsonObject(reply);
    if (!data) return null;
    const why = cleanNote(data.why);
    const praise = cleanNote(data.praise);
    return why || praise ? { why, praise } : null;
  } catch (error) {
    console.warn('[LayoutStudio] 角色写话失败：', error);
    return null;
  }
};

/* ---------- 发回聊天室 ---------- */

const specTexts = (spec) =>
  spec.items.map((item) => item.text || (item.sticker === 'glyph' ? item.glyph : '')).filter(Boolean);

/** 摘要放进消息 content：聊天记忆只读 content，所以关键信息都写在这里。 */
export const buildSummaryText = ({ spec, notes, descriptions, photoCount }) => {
  const tpl = getTemplate(spec.templateId);
  const parts = [`我把${photoCount > 1 ? ` ${photoCount} 张` : '一张'}照片交给你在修图室修了一下，用的是「${tpl?.label || spec.templateId}」。`];
  const texts = specTexts(spec);
  if (texts.length) parts.push(`图上写着：${texts.join('、')}。`);
  if (notes?.why) parts.push(`你说你这样修是因为：${notes.why}`);
  if (notes?.praise) parts.push(`你对照片的评价是：${notes.praise}`);
  const seen = descriptions.filter(Boolean);
  if (seen.length) parts.push(`照片的内容大概是：${seen.join('；')}`);
  return parts.join('\n');
};

/**
 * 把成品图 + 摘要发进角色的聊天室。成功返回 true；找不到聊天室返回 false。
 * 图片复用聊天室自己的照片消息（会自动做视觉识别）；摘要是另一条文字消息。
 */
export const sendResultToChat = async ({ characterId, blob, summary }) => {
  const chat = await resolveChatFor(characterId);
  if (!chat) return false;

  const file = new File([blob], 'layout-studio.png', { type: 'image/png' });
  await sendPhotoMessage({ chatId: chat.id, characterId, file });

  const stamp = new Date().toISOString();
  await db.messages.add({
    chatId: chat.id,
    characterId,
    sender: 'user',
    type: 'text',
    content: summary,
    metadata: { source: 'layout-studio' },
    isRead: true,
    timestamp: stamp,
  });
  await db.chats.update(chat.id, { updatedAt: stamp });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('new-local-message-inserted', { detail: { chatId: chat.id } }));
  }
  return true;
};