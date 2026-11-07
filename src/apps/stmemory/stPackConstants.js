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

// 注入模式属于"某个包挂在某个聊天上"这条连接（link.injectMode）。
//   full:     M1 的口径。有总结条目就注入总结全文，没有就注入原文块（按各自的范围）。
//   overview: M2 的口径。只注入概览和一段说明，细节靠"翻阅原文"（link.pinnedRange）。
// 旧连接没有 injectMode 字段，按 full 处理，行为和 M1 完全一致。
export const INJECT_MODE_FULL = 'full';
export const INJECT_MODE_OVERVIEW = 'overview';

// 概览模式下，钉住的原文最多占多少估算 token（超过就不让钉，也不会注入）。
export const PINNED_MAX_TOKENS = 4000;

// 概览模式附带的说明。注意：这个切片还没有"自己去查原文"的能力，
// 所以这里只能让角色别编造，不能让它去查。
export const OVERVIEW_MODE_NOTE =
  '以上概览并不完整，只是帮你记住大致的脉络。'
  + '遇到拿不准的具体细节（谁说过什么、事情的先后、某个具体场景），'
  + '不要凭印象编造；可以坦率地说记不清了，或者向{{user}}确认。';

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