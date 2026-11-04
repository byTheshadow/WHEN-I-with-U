// src/apps/messages/secretCode/secretCodeProposal.js
//
// 角色提议新暗号（切片B）：标签解析、消息结构、给 AI 看的历史描述、
// 未处理提议计数、处理结果落库。
//
// 在线聊天里"AI 自己决定做某事"一律用方括号标签（项目约定）：
//   [CODE: 暗号=含义 | 文件夹名]      文件夹名可以省略
// 由 aiService.js 的 parseAiResponseToMessages 调用 parseSecretCodeProposalTag
// 解析，变成一条 type: 'secret_code_proposal' 的消息（电报票卡片）；
// 用户点"收下"才真的写进词典，点"算了"就丢弃。
//
// 提议卡片的状态存在这条消息自己的 metadata 里（跟和好券一样，卡片拿
// messageId 自己读写，不往 ChatRoom 多穿一层回调）：
//   { code, meaning, folderName, status, resolvedAt, resolvedFolderName }
//   status: 'pending' | 'accepted' | 'declined'
import db from '../../../db';
import { validateSecretCode, validateSecretCodeFolder } from './secretCodeService';

export const SECRET_CODE_PROPOSAL_TYPE = 'secret_code_proposal';

export const PROPOSAL_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};

// 数"有没有没处理的提议"时往回看多少条消息：只是防止角色堆卡片，
// 更早的未处理提议不再计入，也避免每次请求都扫整个聊天记录。
const PENDING_SCAN_WINDOW = 200;

/**
 * 解析 [CODE: ...] 标签里冒号后面的内容。返回 { code, meaning, folderName }，
 * 格式不对或暗号不合规则时返回 null（标签照常从正文里摘掉，只是不出卡片，
 * 不让用户看到一张注定收不下的卡）。词典已满、暗号重复这类取决于当前词典
 * 的情况在用户点"收下"时再提示。
 */
export const parseSecretCodeProposalTag = (rawPayload) => {
  const raw = String(rawPayload || '').trim();
  if (!raw) return null;

  // 模型偶尔会写全角的 ＝ 和 ｜，一起认
  const eqIndex = raw.search(/[=＝]/);
  if (eqIndex <= 0) return null;

  const code = raw.slice(0, eqIndex).trim();
  let rest = raw.slice(eqIndex + 1);
  let folderName = '';

  const barIndex = Math.max(rest.lastIndexOf('|'), rest.lastIndexOf('｜'));
  if (barIndex >= 0) {
    folderName = rest.slice(barIndex + 1).trim();
    rest = rest.slice(0, barIndex);
  }
  const meaning = rest.trim();

  if (!validateSecretCode({ code, meaning }, []).ok) return null;

  // 文件夹名不合规就当没写，放进"未分类"，不因此丢掉整个提议
  if (folderName && !validateSecretCodeFolder({ name: folderName }).ok) {
    folderName = '';
  }

  return { code, meaning, folderName };
};

/** 把解析结果变成一条可以直接写进 db.messages 的消息骨架（调用方补 sender 等）。 */
export const buildSecretCodeProposalMessage = ({ code, meaning, folderName = '' }) => ({
  type: SECRET_CODE_PROPOSAL_TYPE,
  // content 非空，这样它也能进记忆流水线（和和好券同样的做法）
  content: `提议了一个新暗号：${code} = ${meaning}`,
  metadata: {
    code,
    meaning,
    folderName,
    status: PROPOSAL_STATUS.PENDING,
    resolvedAt: null,
    resolvedFolderName: '',
  },
});

/**
 * 历史记录里这条提议给 AI 看的样子：让角色知道结果，被婉拒的不会再提，
 * 收下的知道以后可以用。
 */
export const formatSecretCodeProposalForPrompt = (msg) => {
  const meta = msg?.metadata || {};
  const code = meta.code || '';
  const meaning = meta.meaning || '';

  if (meta.status === PROPOSAL_STATUS.ACCEPTED) {
    return `[你提议的暗号「${code}」（${meaning}）用户已经收下，写进词典了，以后可以用]`;
  }
  if (meta.status === PROPOSAL_STATUS.DECLINED) {
    return `[你提议的暗号「${code}」（${meaning}）用户婉拒了，不要再提这个暗号]`;
  }
  return `[你向用户提议了一个新暗号「${code}」，意思是：${meaning}。用户还没有回应]`;
};

/** 这个聊天里还有几张没被处理的提议（最近 PENDING_SCAN_WINDOW 条消息内）。 */
export const countPendingSecretCodeProposals = async (chatId) => {
  if (!chatId) return 0;

  const recent = await db.messages
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(PENDING_SCAN_WINDOW)
    .toArray();

  return recent.filter(
    (message) =>
      message.type === SECRET_CODE_PROPOSAL_TYPE &&
      (message.metadata?.status || PROPOSAL_STATUS.PENDING) === PROPOSAL_STATUS.PENDING
  ).length;
};

/** 把处理结果写回这条消息自己的 metadata（合并，不覆盖别的字段）。 */
export const resolveSecretCodeProposalMessage = async (messageId, { status, resolvedFolderName = '' }) => {
  if (!messageId) return false;

  const message = await db.messages.get(messageId);
  if (!message) return false;

  await db.messages.update(messageId, {
    metadata: {
      ...(message.metadata || {}),
      status,
      resolvedAt: new Date().toISOString(),
      resolvedFolderName,
    },
  });

  return true;
};