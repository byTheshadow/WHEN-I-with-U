// src/apps/fiction/fictionImageDescribe.js
//
// 手动配图时，让 AI 读一遍这一段正文，写出一句「画面描述」。
// 走文游自己的接口（和续写同一套 API 配置，含备用 API 回退），不走生图室。
//
// 人物长相由存档里的角色设定决定：这里把重点角色、其他角色、NPC 和「我的设定」
// 的名字与简介一起交给 AI，让它写画面时对得上人。
//
// 生图后端是 NovelAI 时，生图接口吃的是英文逗号标签，所以让 AI 输出标签；
// 其他后端（OpenAI 兼容）适合自然语言，让 AI 写一两句中文描述。
// 提示词来自「配图要求」设置（fictionImagePrompts.js），用户没改过就用默认文本。

import { callFictionApi } from './fictionAiService';
import { loadResolvedImagePrompts } from './fictionImagePrompts';
import { resolveCast } from './fictionPromptAssembler';

export const DESCRIBE_MAX_TOKENS = 800;

const SEGMENT_MAX_CHARS = 6000;
const CHARACTER_MAX_CHARS = 300;
const DESCRIPTION_LIMIT = 2000;

const str = (value) => String(value ?? '').trim();

const clipText = (text, max) => {
  const value = str(text);

  return value.length > max ? `${value.slice(0, max)}…` : value;
};

const renderCharacter = (name, detail) => {
  const lines = [`【${str(name) || '（未命名）'}】`];
  const text = clipText(detail, CHARACTER_MAX_CHARS);

  if (text) lines.push(text);

  return lines.join('\n');
};

// 把存档里的角色整理成一段「人物设定」。没有任何设定时返回空字符串。
export const buildCharacterBlock = (save) => {
  const cast = resolveCast(save);
  const lines = [];

  const pushCharacter = (character) => {
    lines.push(renderCharacter(character.name, [character.bio, character.extraNotes].filter(Boolean).join('\n')));
  };

  if (cast.main) pushCharacter(cast.main);
  cast.others.forEach(pushCharacter);
  cast.npcs.forEach((npc) => lines.push(renderCharacter(npc.name, npc.desc)));

  const persona = save?.persona;

  if (persona && (str(persona.name) || str(persona.identity))) {
    lines.push(renderCharacter(`${str(persona.name) || '玩家'}（玩家扮演的角色）`, persona.identity));
  }

  return lines.join('\n\n');
};

// AI 有时会带代码块、[IMAGE] 标签、思考标签或多余的引号，统一洗掉，只留描述本身。
export const cleanDescription = (raw) => {
  let text = String(raw ?? '');

  text = text.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
  text = text.replace(/\[\/?IMAGE\]/gi, '');
  text = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
  text = text.trim();
  text = text.replace(/^(?:画面描述|描述|prompt|tags?)\s*[:：]\s*/i, '');
  text = text.replace(/^["“「『'`]+|["”」』'`]+$/g, '');

  return text.trim().slice(0, DESCRIPTION_LIMIT);
};

/**
 * 读一段正文，返回一句画面描述。失败（没配置接口、网络错误、AI 没写出东西）会抛错，
 * 调用方应该让用户自己写。
 */
export const describeSegment = async ({ save, node, signal }) => {
  const segment = str(node?.text);

  if (!segment) throw new Error('这一段没有正文，没法总结画面。');

  const { manual: systemPrompt } = await loadResolvedImagePrompts();

  const characters = buildCharacterBlock(save);
  const tail = segment.length > SEGMENT_MAX_CHARS ? segment.slice(-SEGMENT_MAX_CHARS) : segment;

  const userMessage = [
    characters ? `## 人物设定\n${characters}` : '',
    `## 这一段正文\n${tail}`,
    '请按要求写出这一幕的画面描述。',
  ].filter(Boolean).join('\n\n');

  const result = await callFictionApi({
    systemPrompt,
    userMessage,
    maxTokens: DESCRIBE_MAX_TOKENS,
    signal,
  });

  const description = cleanDescription(result?.content);

  if (!description) throw new Error('AI 没有写出画面描述。');

  return description;
};

export default {
  describeSegment,
  buildCharacterBlock,
  cleanDescription,
};