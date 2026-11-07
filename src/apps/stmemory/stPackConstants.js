// src/apps/stmemory/stPackConstants.js
//
// ST 记忆桥的常量。纯数据，不 import 任何东西。
//
// 定位（framing）属于"某个包挂在某个聊天上"这条连接，不属于包本身：
// 同一份记录挂到聊天 A 可以是背景故事，挂到聊天 B 可以是演出来的故事。
// 文案里的 {{user}} / {{char}} 在注入时才替换成当前聊天的名字。

export const FRAMING_BACKGROUND = 'background';
export const FRAMING_PARALLEL = 'parallel';

export const DEFAULT_FRAMING = FRAMING_BACKGROUND;

export const FRAMING_OPTIONS = [
  {
    id: FRAMING_BACKGROUND,
    label: '背景故事',
    hint: '当作你们真实经历过的事',
  },
  {
    id: FRAMING_PARALLEL,
    label: '平行世界',
    hint: '演出来的故事，不代表真实发生',
  },
];

export const FRAMING_TEXTS = {
  [FRAMING_BACKGROUND]:
    '以下内容是你与{{user}}真实经历过的往事，属于你们共同的背景故事。'
    + '你自然地记得这些事，但不必逐条复述，也不要在不相关时主动提起；'
    + '只有当眼前的对话用得上时，再自然地提到。',
  [FRAMING_PARALLEL]:
    '以下内容是一段演出来的故事（平行世界），并不代表真实发生过。'
    + '它不改变你本来的设定：你依旧是你自己，只是知道有这样一段被演绎过的故事。'
    + '聊到相关话题时可以当作彼此都知道的故事来谈，'
    + '但不要把故事里的设定、关系或事件当成现实。',
};

// 每个聊天默认的记忆包总预算（估算 token）。存在 chat.stPackBudgetTokens 上，用户可改。
export const DEFAULT_BUDGET_TOKENS = 8000;

// 原文切块的目标字数。块太小行数多，块太大选范围时不够细。
export const CHUNK_TARGET_CHARS = 2000;

// 读文件时每次读多少字节（分块流式读，不整份读进内存）。
export const FILE_READ_PIECE_BYTES = 512 * 1024;

// 占位符：导入时把角色名/用户名换成它们，注入时再换回当前聊天的名字。
export const PLACEHOLDER_CHAR = '{{char}}';
export const PLACEHOLDER_USER = '{{user}}';

export const SOURCE_TYPE_TEXT = 'text';
export const SOURCE_TYPE_ST_JSONL = 'st-jsonl';

// 清洗规则存在 db.settings 的这个 key 下（全局共用，导入哪个包都带着）。
export const CLEANING_RULES_SETTING_KEY = 'stMemoryCleaningRules';