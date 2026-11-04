// src/apps/messages/secretCode/secretCodePrompt.js
//
// 悄悄话词典拼进系统提示词的纯函数，不碰 DB。
//
// 两段内容，各自独立：
//   1. 词典：已有的暗号和用法。词典是空的就不放。
//      放哪些（切片D）：
//        - 平时：按使用情况取最常用的 SECRET_CODE_PROMPT_MAX_ENTRIES 条，
//          再把用户这一轮消息里出现过的暗号强制补进来（不占上面的名额）。
//        - 省着带模式（character.secretCodeLightInjection === true）：
//          只放用户这一轮用到的暗号，没有就只留一句很短的提示。
//   2. 提议说明：教角色用 [CODE: 暗号=含义 | 文件夹名] 提议新暗号。默认开启，
//      角色的词典页里可以关；词典满了不放；还有没被用户处理的提议时只放
//      一句"先别再提"，不重复整段说明。
// 两段都没有内容时返回空字符串，对没用到这个功能的聊天零成本。
import {
  SECRET_CODE_LIMITS,
  isSecretCodeLightInjection,
  isSecretCodeProposalEnabled,
  normalizeSecretCodeBook,
  normalizeSecretCodes,
} from './secretCodeService';
import { isSymbolOnlyCode } from './secretCodeMarks';

// 平时固定放进提示词的条数。词典本身占的是每一次请求的输入，宁少勿多。
export const SECRET_CODE_PROMPT_MAX_ENTRIES = 8;

const byUsageDesc = (a, b) => {
  if (b.useCount !== a.useCount) return b.useCount - a.useCount;
  return String(b.updatedAt).localeCompare(String(a.updatedAt));
};

/** 词典里哪些暗号出现在这段文字里（用户的消息按整本词典匹配）。 */
export const findSecretCodesInText = (entries, text) => {
  const source = typeof text === 'string' ? text : '';
  if (!source) return [];
  return normalizeSecretCodes(entries).filter((entry) => source.includes(entry.code));
};

/**
 * 挑要放进提示词的暗号。
 *   - 平时：最常用的 maxEntries 条 + 用户文字里出现的（去重）
 *   - lightMode：只要用户文字里出现的
 * 返回的数组里，常用的排在前面，补进来的排在后面。
 */
export const selectSecretCodesForPrompt = (
  entries,
  { maxEntries = SECRET_CODE_PROMPT_MAX_ENTRIES, userText = '', lightMode = false } = {}
) => {
  const all = normalizeSecretCodes(entries).slice().sort(byUsageDesc);
  const matched = findSecretCodesInText(all, userText).sort(byUsageDesc);

  if (lightMode) return matched;

  const top = all.slice(0, maxEntries);
  const topCodes = new Set(top.map((item) => item.code));
  return [...top, ...matched.filter((item) => !topCodes.has(item.code))];
};

const buildMarkLine = (selected) => {
  // 只有放进来的暗号里确实有词语型时才说明标记写法，纯符号词典不多花 token
  const wordCodes = selected.filter((item) => !isSymbolOnlyCode(item.code));
  if (wordCodes.length === 0) return '';
  return `- 符号型暗号直接写；词语型暗号（${wordCodes
    .slice(0, 3)
    .map((item) => item.code)
    .join('、')}这类）在作为暗号使用时写成 [C:词语]，例如 [C:${wordCodes[0].code}]，系统会自动去掉方括号；只是普通说话碰巧用到这个词时不要加。\n`;
};

const buildDictionaryBlock = ({ selected, totalCount, canPropose, lightMode }) => {
  if (totalCount === 0) return '';

  if (lightMode) {
    if (selected.length === 0) {
      return `
【专属暗号词典（省着带模式）】：你们有一本专属暗号词典，这一轮用户没有用到其中的暗号，所以没有展开。不要自己编造暗号，也不要用词典外的暗号。
`;
    }
    const lines = selected.map((item) => `- ${item.code} = ${item.meaning}`).join('\n');
    return `
【专属暗号词典（省着带模式；只有你和用户之间的日常约定，跟触发屏幕特效的口令无关）】：用户这一轮用到了这些暗号，按含义理解：
${lines}
- 你可以顺着用同一个暗号回应；不要主动用这里没列出的暗号，也不要自己编造。
- 暗号要原样书写，不要改字，也不要附带解释；用户没问，就不要解释暗号的意思。
${buildMarkLine(selected)}`;
  }

  const lines = selected.map((item) => `- ${item.code} = ${item.meaning}`).join('\n');
  const omitted = totalCount - selected.length;
  const omittedLine =
    omitted > 0 ? `- 词典里另有 ${omitted} 条暗号没有列在这里，用户用到时会自动补上含义。\n` : '';
  const noInventLine = canPropose
    ? '- 词典里没有的暗号不要直接用在正文里；想新增，只能用下面的提议标签。'
    : '- 不要自己编造词典里没有的暗号。';

  return `
【专属暗号词典（只有你和用户之间的日常约定，跟触发屏幕特效的口令无关）】：
${lines}
${omittedLine}- 想表达某个含义时，可以用对应的暗号代替完整的句子。要自然，不要每句话都用，也不要硬塞。
- 暗号要原样书写，不要改字，也不要在后面附带解释；用户没问，就不要解释暗号的意思。
${buildMarkLine(selected)}- 用户的消息里出现这些暗号时，按上面的含义理解。
${noInventLine}
`;
};

const buildProposalBlock = (folders, pendingProposalCount) => {
  if (pendingProposalCount > 0) {
    return `
【暗号提议】：你之前提议的暗号还有 ${pendingProposalCount} 张没被用户处理，先不要再提新的，等 TA 收下或婉拒了再说。
`;
  }

  const folderNames = folders.filter((folder) => !folder.uncat).map((folder) => folder.name);
  const folderLine =
    folderNames.length > 0
      ? `现有的文件夹：${folderNames.join('、')}。尽量沿用已有的，实在没有合适的再起一个新名字（最多 ${SECRET_CODE_LIMITS.MAX_FOLDER_NAME_LENGTH} 个字）。`
      : `目前还没有文件夹，可以顺手起一个（最多 ${SECRET_CODE_LIMITS.MAX_FOLDER_NAME_LENGTH} 个字）。`;

  return `
【你可以向用户提议一个新的专属暗号】：
- 聊着聊着，如果有一句话你们常说、想简化，可以提议把它变成一个很短的暗号。提议时在回复正文里写这个标签：[CODE: 暗号=含义 | 文件夹名]（文件夹名可以省略）。
- 暗号最多 ${SECRET_CODE_LIMITS.MAX_CODE_LENGTH} 个字符，不能有空格、方括号、竖线，不要用 emoji；含义写成一句短话。${folderLine}
- 标签会变成一张提议卡片，由用户决定收不收。用户收下之前，不要把它当成已经约定好的暗号来用；被婉拒的暗号不要再提。
- 时机你自己判断，不用每次聊天都提，不要硬塞；一次最多提一个。不用另外说"我想提议一个暗号"之类的话，更不要解释这个标签。
`;
};

/**
 * 分开返回两段内容，方便界面单独估算每一段的开销。
 *   - userText：用户这一轮发的文字（可以是好几条拼起来的），用来把用到的暗号带上；
 *     界面估算"平时一轮多带多少"时不传。
 */
export const buildSecretCodePromptParts = (
  character,
  { pendingProposalCount = 0, userText = '' } = {}
) => {
  const { entries, folders } = normalizeSecretCodeBook(character);
  const lightMode = isSecretCodeLightInjection(character);
  const selected = selectSecretCodesForPrompt(entries, { userText, lightMode });

  const canPropose =
    isSecretCodeProposalEnabled(character) && entries.length < SECRET_CODE_LIMITS.MAX_ENTRIES;

  const dictionaryBlock = buildDictionaryBlock({
    selected,
    totalCount: entries.length,
    canPropose,
    lightMode,
  });
  const proposalBlock = canPropose ? buildProposalBlock(folders, pendingProposalCount) : '';

  return { dictionaryBlock, proposalBlock, selectedCount: selected.length, lightMode };
};

export const buildSecretCodePromptBlock = (character, options = {}) => {
  const { dictionaryBlock, proposalBlock } = buildSecretCodePromptParts(character, options);
  return `${dictionaryBlock}${proposalBlock}`;
};