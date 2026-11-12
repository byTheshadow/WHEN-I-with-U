// src/apps/messages/toys/toyAiService.js
//
// 让角色亲手做一个小玩具：一次独立的 AI 调用（generateResponse），不经过聊天主回复的解析器。
// 之所以不用方括号标签：现有标签解析的正则不允许内容里出现 "]"，而 JS 代码里到处是 "]"。
// 返回用三个自定义标签分段（标题 / 规则 / 代码），不用 JSON——代码放进 JSON 转义太容易写坏。
//
// 来自模型的内容都当不可信数据：整理 / 检查 / 隐藏沙箱试跑都在 toySandbox.js 里；
// 不合格的就把原因喂回给角色，让它完整重写，最多 TOY_LIMITS.attempts 次。

import db from '../../../db';
import { generateResponse } from '../../../services/aiService';
import { TOY_LIMITS } from './toyConstants';
import { dryRunToy, prepareToyHtml, stripEmoji } from './toySandbox';

const CONTEXT_MESSAGES = 10;
const CONTEXT_MESSAGE_CHARS = 80;

const cleanText = (value, maxChars) =>
  stripEmoji(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);

const grabTag = (text, tag) => {
  const match = String(text || '').match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
};

const show = (value) => {
  const text = String(value ?? '').trim();
  return text || '（未设置）';
};

// 最近几句普通文字消息，只是让小玩具的口吻和内容贴合当下的气氛，不是必需品。
const loadRecentContext = async (chatId, characterName) => {
  try {
    const rows = await db.messages.where('chatId').equals(chatId).reverse().limit(40).toArray();

    return rows
      .filter((row) => (
        (!row.type || row.type === 'text')
        && row.mode !== 'offline'
        && row.mode !== 'bubble'
        && String(row.content || '').trim()
      ))
      .slice(0, CONTEXT_MESSAGES)
      .reverse()
      .map((row) => `${row.sender === 'user' ? '用户' : characterName}: ${cleanText(row.content, CONTEXT_MESSAGE_CHARS)}`)
      .join('\n');
  } catch (error) {
    console.warn('读取小玩具的聊天背景失败（会继续，只是少一段背景）：', error);
    return '';
  }
};

const buildSystemPrompt = ({ character, recentText, request }) => {
  const want = request
    ? `用户想玩的是：${request}。请尽量照这个做；如果这个想法没法在一个小页面里做出来，就做最接近的简化版。`
    : '用户没有指定想玩什么，请你自己想一个简单、好玩、几十秒就能玩一局的小游戏。';

  return [
    `你是「${show(character?.name)}」，下面是你的角色设定。`,
    '',
    '【你的角色设定】',
    `- 姓名：${show(character?.name)}`,
    `- 角色简介：${show(character?.bio)}`,
    `- 补充设定：${show(character?.extraNotes)}`,
    `- 你对用户的了解：${show(character?.userPersona)}`,
    recentText ? `\n【你们最近的聊天（只用来把握气氛）】\n${recentText}` : '',
    '',
    '【这次的任务】',
    '你想亲手给用户做一个能在手机上直接玩的小玩具（小游戏）。' + want,
    '',
    '【输出格式，严格照做，标签之外不要写任何别的话】',
    `<toy_title>小玩具的名字，不超过 ${TOY_LIMITS.titleChars} 个字</toy_title>`,
    `<toy_rules>用你自己的口吻，写两三句玩法说明，不超过 ${TOY_LIMITS.rulesChars} 个字</toy_rules>`,
    '<toy_code>这里写网页代码</toy_code>',
    '',
    '【代码要求】',
    '1. 只写 body 里面的内容：需要的 <style>、元素、<script> 都写在这一份里。不要写 <html>、<head>、<body>、<!doctype>。',
    '2. 必须有内联的 <script>，游戏逻辑全部用原生 JavaScript，不用任何库。',
    '3. 所有东西都写在这一份代码里：不能引用外部脚本、外部图片、外部字体，没有网络，也不能联网。',
    '4. 不能使用 fetch、XMLHttpRequest、WebSocket、localStorage、sessionStorage、indexedDB、eval、new Function、window.open、window.parent、window.top，也不能跳转页面。',
    '5. 画面要铺满页面（宽高 100%），竖屏手机优先，用触摸点击操作，按钮和点击区域至少 40 像素。不要依赖键盘。',
    '6. 动画和计时用 requestAnimationFrame 或 setInterval，不要写 while(true) 这样的死循环。',
    '7. 一局要有明确的开始和结束，结束后显示得分或结果，并有"再来一局"的按钮。',
    '8. 页面里的文字用中文，不要使用 Emoji。图形请用 CSS、纯色块或内联 SVG 画。',
    '9. 配色和气质可以带上你自己的审美，但文字必须清晰易读。',
    `10. 整份代码不要超过 ${TOY_LIMITS.htmlChars} 个字符，宁可简单，也要保证点开就能玩、不出错。`,
  ].filter((line) => line !== undefined).join('\n');
};

const parseToyReply = (raw) => {
  const title = cleanText(grabTag(raw, 'toy_title'), TOY_LIMITS.titleChars);
  const rules = cleanText(grabTag(raw, 'toy_rules'), TOY_LIMITS.rulesChars);
  const code = grabTag(raw, 'toy_code');

  if (!title) return { problem: '缺少 <toy_title> 标签或名字是空的。' };
  if (!rules) return { problem: '缺少 <toy_rules> 标签或玩法说明是空的。' };
  if (!code) return { problem: '缺少 <toy_code> 标签或代码是空的（可能是写到一半被截断了，请做得更精简）。' };

  const { html, problem } = prepareToyHtml(code);
  if (problem) return { problem };

  return { title, rules, html, problem: '' };
};

/**
 * 生成一个小玩具。成功返回 { title, rules, html }；失败抛出 Error（message 可以直接显示给用户）。
 * 网络 / API 报错直接抛出，不重试；只有"内容不合格"才会带着原因让角色重写。
 */
export const generateToy = async ({ character, chatId, request = '' }) => {
  const cleanRequest = cleanText(request, TOY_LIMITS.requestChars);
  const recentText = await loadRecentContext(chatId, show(character?.name));

  const messages = [
    { role: 'system', content: buildSystemPrompt({ character, recentText, request: cleanRequest }) },
    { role: 'user', content: '请开始制作。' },
  ];

  let lastProblem = '';

  for (let attempt = 1; attempt <= TOY_LIMITS.attempts; attempt += 1) {
    const raw = await generateResponse(messages);
    const parsed = parseToyReply(raw);
    let problem = parsed.problem;

    if (!problem) {
      const dry = await dryRunToy(parsed.html);
      if (!dry.ok) problem = `代码一加载就报错了：${dry.error}`;
    }

    if (!problem) {
      return { title: parsed.title, rules: parsed.rules, html: parsed.html };
    }

    lastProblem = problem;
    messages.push(
      { role: 'assistant', content: String(raw || '').slice(0, 40000) },
      {
        role: 'user',
        content: `上一份不能用：${problem}\n请按同样的格式，完整重写一份（三个标签都要有），修好这个问题，不要解释。`,
      },
    );
  }

  throw new Error(lastProblem || '这次没做出来');
};
