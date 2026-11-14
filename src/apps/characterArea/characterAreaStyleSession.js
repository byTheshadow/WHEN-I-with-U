// src/apps/characterArea/characterAreaStyleSession.js
//
// 角色专属区域——"设计外观"这一次单独的AI调用（切片 F1）。三个入口共用：
//   - 'initial' 区域刚创建完，角色第一次给它设计样子（privateAreaSession.js 里接）
//   - 'user'    用户在区域页点"请 TA 重新装饰"（CharacterAreaStyleParts.jsx）
//   - 'self'    整理时角色自己写了 [RESTYLE]，想换换样子（同样在 privateAreaSession.js）
//
// 设计结果存在 characterAreas 那一行的三个无索引追加字段上（不需要升数据库版本）：
//   theme（配色/字体/圆角/边框）、coverHtml（过滤过的封面）、styleUpdatedAt。
// 名称、图标、简介、护食程度、拒绝话术都不动：区域"是什么"一旦定下就固定，
// 能换的只有"长什么样"。
//
// 角色自己想换（'self'）有 24 小时的间隔，免得每次整理都在换；用户主动点
// 按钮没有任何限制。单次AI调用走 challengeService 的 callSingleCompletion，
// 不经过 aiService.js。设计只看人设，不读聊天记录，省 token。
import db from '../../db';
import { callSingleCompletion } from '../challenges/challengeService';
import { getAreaForChat } from './characterAreaService';
import { parseStyleOutput } from './characterAreaStyleParse';
import {
  COVER_ANIMATION_NAMES,
  THEME_BORDER_KEYS,
  THEME_FONT_KEYS,
  THEME_RADIUS_KEYS,
  describeTheme,
} from './characterAreaTheme';

export const AREA_STYLE_UPDATED_EVENT = 'character-area-style-updated';

export const STYLE_SOURCE_INITIAL = 'initial';
export const STYLE_SOURCE_USER = 'user';
export const STYLE_SOURCE_SELF = 'self';

// 角色整理时，提示词里提到"可以写 [RESTYLE]"的概率，和自己重新装饰的最短间隔。
export const RESTYLE_HINT_PROBABILITY = 0.15;
export const SELF_RESTYLE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

const stylingChatIds = new Set();

const nowIso = () => new Date().toISOString();

const dispatchStyleUpdated = (chatId) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AREA_STYLE_UPDATED_EVENT, { detail: { chatId } }));
};

// ---------------- 整理时的 [RESTYLE] ----------------

export const canSelfRestyle = (area, now = Date.now()) => {
  if (!area?.styleUpdatedAt) return true;

  const last = Date.parse(area.styleUpdatedAt);
  if (!Number.isFinite(last)) return true;

  return now - last >= SELF_RESTYLE_MIN_INTERVAL_MS;
};

// 追加到整理提示词末尾的一小段。大多数时候返回空字符串（不撑大提示词）。
export const buildRestyleHint = (area, { random = Math.random } = {}) => {
  if (!canSelfRestyle(area)) return '';
  if (random() >= RESTYLE_HINT_PROBABILITY) return '';

  const lead = area?.theme
    ? '另外：如果你想换换这本小本子的外观（配色和封面）'
    : '另外：这本小本子还没有被你装饰过。如果你想给它设计个样子（配色和封面）';

  return `\n\n${lead}，可以在输出的最后另起一行写 [RESTYLE]。大多数时候不需要，只有真的想换的时候才写。`;
};

export const hasRestyleTag = (rawText) => /\[RESTYLE\]/i.test(String(rawText || ''));

// ---------------- 提示词 ----------------

const SITUATION_TEXT = {
  [STYLE_SOURCE_INITIAL]: '这是它第一次有自己的样子。',
  [STYLE_SOURCE_USER]: '用户请你重新设计一下它的外观。',
  [STYLE_SOURCE_SELF]: '你自己想换换它的样子。',
};

const buildStylePrompt = ({ character, area, source }) => {
  const currentLook = describeTheme(area.theme);
  const currentText = currentLook
    ? `\n它现在的样子：${currentLook}。这次请做出和现在明显不同的设计。`
    : '';

  return `你正在扮演角色：${character.name}。

角色设定：
${character.bio || '无'}

补充设定：
${character.extraNotes || '无'}

你有一个只属于自己的小本子「${area.name}」${area.intro ? `（${area.intro}）` : ''}。现在请你按自己的性格，给它设计外观：配色、字体风格，以及一张封面。${SITUATION_TEXT[source] || ''}${currentText}

严格按下面的格式输出，不要输出格式以外的任何文字：
[STYLE]
背景：（页面底色，#rrggbb）
卡片：（卡片底色，#rrggbb）
正文：（正文文字色，#rrggbb）
次要文字：（次要文字色，#rrggbb）
强调色：（点缀色，#rrggbb）
字体：（只能选一个：${THEME_FONT_KEYS.join(' / ')}。sans 黑体，serif 宋体，kai 楷体，mono 等宽，round 圆体，hand 手写）
圆角：（只能选一个：${THEME_RADIUS_KEYS.join(' / ')}。sharp 直角，soft 柔和，round 很圆）
边框：（只能选一个：${THEME_BORDER_KEYS.join(' / ')}。实线 / 虚线 / 点线）
封面：
（一小段 HTML，规则见下）
[/STYLE]

封面的规则：
- 用一个最外层的 div 包住全部内容，它要自带背景和内边距。宽度会撑满一张卡片（大约 340 像素宽），高度不要超过 260 像素。
- 封面里必须用文字写出小本子的名字「${area.name}」。文字总共不超过 60 个字，不要写成长篇。
- 只能用这些标签：div span p h1 h2 h3 br hr b strong i em small u s sub sup。样式全部写在标签的 style 属性里，不能用 class 和 style 标签。
- 不能用图片、链接、脚本、emoji。想装饰就用渐变、边框、阴影、圆角、旋转、小色块、细线、错落的排版。
- 颜色可以直接写色值，也可以引用上面你选的五个颜色：var(--area-bg) var(--area-card) var(--area-text) var(--area-sub) var(--area-accent)。
- 想让某个装饰轻轻动起来，animation 只能用这些名字：${COVER_ANIMATION_NAMES.join(', ')}，写法像 animation: area-float 4s ease-in-out infinite。可以完全不用。
- 格式示例（只示范写法，别照抄内容和配色）：
<div style="padding:28px 20px;text-align:center;background:linear-gradient(160deg,var(--area-card),var(--area-bg));">
  <div style="width:48px;height:2px;margin:0 auto 14px;background:var(--area-accent);"></div>
  <h1 style="font-size:26px;letter-spacing:6px;color:var(--area-text);">小本子的名字</h1>
  <p style="margin-top:8px;font-size:12px;color:var(--area-sub);">一句话</p>
</div>

要求：
- 配色、字体和封面的气质都要符合你的性格，别人看一眼就觉得"这是 ${character.name} 的本子"。不要默认选粉色或黑色。
- 正文色和背景、卡片之间要有足够的对比，保证文字看得清。
- 全程使用你的人设口吻，不要提到"系统""设定""AI"这类词。
- 不要使用任何emoji或颜文字。`;
};

// ---------------- 主函数 ----------------

// 返回 { status, area }：
//   'styled'   主题和封面都换好了，area 是更新后的那一行
//   'partial'  主题换好了，但封面这次没写好（没写，或者没通过过滤），封面已清空
//   'busy'     这个聊天已经有一次设计在跑了
//   'failed'   接口没配置/网络出错/AI输出格式不对，什么都没改，可以再试
export const requestAreaStyle = async ({ chatId, character, area, source = STYLE_SOURCE_USER }) => {
  if (!chatId || !character) return { status: 'failed' };

  const current = area?.id ? area : await getAreaForChat(chatId);
  if (!current) return { status: 'failed' };

  if (stylingChatIds.has(chatId)) return { status: 'busy', area: current };
  stylingChatIds.add(chatId);

  try {
    const prompt = buildStylePrompt({ character, area: current, source });
    const rawText = await callSingleCompletion(prompt, { temperature: 1 });

    if (!rawText) return { status: 'failed', area: current };

    const parsed = parseStyleOutput(rawText);
    if (parsed.kind !== 'style') return { status: 'failed', area: current };

    const patch = {
      theme: parsed.theme,
      coverHtml: parsed.coverHtml,
      styleUpdatedAt: nowIso(),
    };

    await db.characterAreas.update(current.id, patch);

    dispatchStyleUpdated(chatId);

    return {
      status: parsed.coverStatus === 'ok' ? 'styled' : 'partial',
      area: { ...current, ...patch },
    };
  } catch (error) {
    console.warn(`[characterArea] 设计外观失败（来源：${source}）：`, error);
    return { status: 'failed', area: current };
  } finally {
    stylingChatIds.delete(chatId);
  }
};