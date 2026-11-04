// src/apps/messages/secretCode/secretCodePrompt.js
//
// 悄悄话词典拼进系统提示词的纯函数，不碰 DB。
//
// 两段内容，各自独立：
//   1. 词典：已有的暗号和用法。词典是空的就不放。词典太大时只放一部分
//      （切片A先用最简单的规则：常用的优先，其次是最近改动的；切片D再换成
//      真正按使用情况筛选的策略）。
//   2. 提议说明：教角色用 [CODE: 暗号=含义 | 文件夹名] 提议新暗号。默认开启，
//      角色的词典页里可以关；词典满了不放；还有没被用户处理的提议时只放
//      一句"先别再提"，不重复整段说明。
// 两段都没有内容时返回空字符串，对没用到这个功能的聊天零成本。
import {
  SECRET_CODE_LIMITS,
  isSecretCodeProposalEnabled,
  normalizeSecretCodeBook,
  normalizeSecretCodes,
} from './secretCodeService';

// 注入提示词的条数上限。词典本身是为了省 token，不能让词典比省下的还长。
export const SECRET_CODE_PROMPT_MAX_ENTRIES = 20;

export const selectSecretCodesForPrompt = (
  entries,
  maxEntries = SECRET_CODE_PROMPT_MAX_ENTRIES
) =>
  normalizeSecretCodes(entries)
    .slice()
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    })
    .slice(0, maxEntries);

const buildDictionaryBlock = (selected, canPropose) => {
  if (selected.length === 0) return '';

  const lines = selected.map((item) => `- ${item.code} = ${item.meaning}`).join('\n');
  const noInventLine = canPropose
    ? '- 词典里没有的暗号不要直接用在正文里；想新增，只能用下面的提议标签。'
    : '- 不要自己编造词典里没有的暗号。';

  return `
【专属暗号词典（只有你和用户之间的日常约定，跟触发屏幕特效的口令无关）】：
${lines}
- 想表达某个含义时，可以用对应的暗号代替完整的句子。要自然，不要每句话都用，也不要硬塞。
- 暗号要原样书写，不要改字，也不要在后面附带解释；用户没问，就不要解释暗号的意思。
- 用户的消息里出现这些暗号时，按上面的含义理解。
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

export const buildSecretCodePromptBlock = (character, { pendingProposalCount = 0 } = {}) => {
  const { entries, folders } = normalizeSecretCodeBook(character);
  const selected = selectSecretCodesForPrompt(entries);

  const canPropose =
    isSecretCodeProposalEnabled(character) && entries.length < SECRET_CODE_LIMITS.MAX_ENTRIES;

  const dictionaryBlock = buildDictionaryBlock(selected, canPropose);
  const proposalBlock = canPropose ? buildProposalBlock(folders, pendingProposalCount) : '';

  return `${dictionaryBlock}${proposalBlock}`;
};