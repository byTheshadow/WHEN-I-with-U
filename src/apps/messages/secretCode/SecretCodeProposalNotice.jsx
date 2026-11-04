// src/apps/messages/secretCode/SecretCodeProposalNotice.jsx
//
// 聊天里"TA 想和你约定一个新暗号"的电报票卡片（type: 'secret_code_proposal'）。
//   - 待处理：电报票，上面有暗号、含义和"归入"哪个文件夹的小标签（点一下
//     换文件夹），两个按钮"算了"和"收下"。
//   - 收下：先真的写进词典，成功才盖章；写不进去（词典满了、暗号重复）
//     就在卡片上说明原因，卡片保持待处理，不静默失败。
//   - 处理完：盖章/揉皱的动画播完，缩成一行记录留在聊天里，角色在历史里
//     也能看到结果（见 secretCodeProposal.js 的 formatSecretCodeProposalForPrompt）。
//
// 状态存在这条消息自己的 metadata 里，卡片拿 messageId 自己读写。结果先落库、
// 再播动画：中途退出聊天也不会出现"词典里已经有了、卡片却还是待处理"。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './secretCode.css';
import {
  SECRET_CODE_LIMITS,
  UNCATEGORIZED_FOLDER_ID,
  addSecretCode,
  getSecretCodeFolders,
} from './secretCodeService';
import { FOLDER_COLOR_VARS, getFolderColorVar } from './secretCodeFolderStyle';
import { PROPOSAL_STATUS, resolveSecretCodeProposalMessage } from './secretCodeProposal';

const ACCEPT_ANIMATION_MS = 1900;
const DECLINE_ANIMATION_MS = 850;

const sameName = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

export const SecretCodeProposalNotice = ({ message, character }) => {
  const meta = message?.metadata || {};
  const messageId = message?.id;
  const characterId = message?.characterId;
  const characterName = character?.name || 'TA';

  const code = meta.code || '';
  const meaning = meta.meaning || '';
  const proposedFolderName = String(meta.folderName || '').trim();

  const [status, setStatus] = useState(meta.status || PROPOSAL_STATUS.PENDING);
  const [resolvedFolderName, setResolvedFolderName] = useState(meta.resolvedFolderName || '');
  const [phase, setPhase] = useState('');
  const [folders, setFolders] = useState([]);
  const [choiceKey, setChoiceKey] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  // 外部改了 metadata（比如别处处理了同一张卡）时跟着同步
  useEffect(() => {
    setStatus(meta.status || PROPOSAL_STATUS.PENDING);
    setResolvedFolderName(meta.resolvedFolderName || '');
  }, [meta.status, meta.resolvedFolderName]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // 只有待处理的卡片才需要文件夹列表
  const isPending = status === PROPOSAL_STATUS.PENDING;
  useEffect(() => {
    if (!isPending || !characterId) return undefined;
    let cancelled = false;
    const load = async () => {
      const list = await getSecretCodeFolders(characterId);
      if (!cancelled) setFolders(list);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isPending, characterId]);

  // 候选文件夹：角色起的新名字（还不存在时，排第一）+ 已有的所有文件夹
  const candidates = useMemo(() => {
    const list = folders.map((folder) => ({
      key: folder.id,
      id: folder.id,
      name: folder.name,
      colorVar: getFolderColorVar(folder),
      isNew: false,
    }));

    const exists = proposedFolderName && folders.some((folder) => sameName(folder.name, proposedFolderName));
    if (proposedFolderName && !exists && folders.length < SECRET_CODE_LIMITS.MAX_FOLDERS) {
      const userFolderCount = folders.filter((folder) => !folder.uncat).length;
      list.unshift({
        key: '__new__',
        id: null,
        name: proposedFolderName,
        colorVar: FOLDER_COLOR_VARS[userFolderCount % FOLDER_COLOR_VARS.length],
        isNew: true,
      });
    }
    return list;
  }, [folders, proposedFolderName]);

  // 默认选中：角色起的名字对应的文件夹 > 未分类
  const defaultKey = useMemo(() => {
    if (proposedFolderName) {
      const hit = candidates.find((item) => sameName(item.name, proposedFolderName));
      if (hit) return hit.key;
    }
    return candidates.find((item) => item.id === UNCATEGORIZED_FOLDER_ID)?.key || candidates[0]?.key || null;
  }, [candidates, proposedFolderName]);

  const chosen = candidates.find((item) => item.key === (choiceKey ?? defaultKey)) || candidates[0] || null;

  const cycleFolder = () => {
    if (candidates.length < 2 || busy) return;
    const current = candidates.findIndex((item) => item.key === (chosen?.key ?? null));
    const next = candidates[(current + 1) % candidates.length];
    setChoiceKey(next.key);
    setError('');
  };

  const handleAccept = async () => {
    if (busy || !isPending || !characterId) return;
    setBusy(true);
    setError('');

    try {
      const result = await addSecretCode(characterId, {
        code,
        meaning,
        source: 'ai',
        ...(chosen?.isNew ? { folderName: chosen.name } : { folderId: chosen?.id || UNCATEGORIZED_FOLDER_ID }),
      });

      if (!result.ok) {
        setError(result.reason || '没能收进词典，请稍后再试。');
        return;
      }

      const usedFolder = result.folders.find((folder) => folder.id === result.entry.folderId);
      const usedName = usedFolder?.name || chosen?.name || '';

      // 先进入动画状态再落库：落库后实时查询可能比这里更早把新状态推下来，
      // 要是那时还没进动画状态，卡片会先闪成记录行，动画就丢了。
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([18, 40, 10]);
      setResolvedFolderName(usedName);
      setPhase('accepting');
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setPhase(''), ACCEPT_ANIMATION_MS);

      try {
        await resolveSecretCodeProposalMessage(messageId, {
          status: PROPOSAL_STATUS.ACCEPTED,
          resolvedFolderName: usedName,
        });
        setStatus(PROPOSAL_STATUS.ACCEPTED);
      } catch (saveError) {
        // 暗号已经写进词典了，只是卡片状态没存上：回到待处理，说清楚
        console.warn('[SecretCodeProposalNotice] 卡片状态没存上：', saveError);
        window.clearTimeout(timerRef.current);
        setPhase('');
        setError('暗号已经收进词典了，但这张卡片的状态没能保存。');
      }
    } catch (accepError) {
      console.warn('[SecretCodeProposalNotice] 收下暗号失败：', accepError);
      setError('没能收进词典，请稍后再试。');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (busy || !isPending) return;
    setBusy(true);
    setError('');

    try {
      setPhase('declining');
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setPhase(''), DECLINE_ANIMATION_MS);

      await resolveSecretCodeProposalMessage(messageId, {
        status: PROPOSAL_STATUS.DECLINED,
      });
      setStatus(PROPOSAL_STATUS.DECLINED);
    } catch (declineError) {
      console.warn('[SecretCodeProposalNotice] 婉拒暗号失败：', declineError);
      window.clearTimeout(timerRef.current);
      setPhase('');
      setError('没能保存，请稍后再试。');
    } finally {
      setBusy(false);
    }
  };

  // 处理完、动画也播完：缩成一行记录
  if (!isPending && !phase) {
    const accepted = status === PROPOSAL_STATUS.ACCEPTED;
    return (
      <div className="secret-code-scope sc-record-row">
        <div className="sc-record">
          <span className="sc-tlabel">暗号</span>
          <span className="sc-record__code">{code}</span>
          <span className="sc-record__meaning">{meaning}</span>
          <span className="sc-record__state">
            {accepted
              ? `已收下${resolvedFolderName ? ` · ${resolvedFolderName}` : ''}`
              : '已婉拒'}
          </span>
        </div>
      </div>
    );
  }

  const ticketNo = String(messageId ?? '').slice(-4).padStart(4, '0');

  return (
    <div className="secret-code-scope sc-ticket-row">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="scRough">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
        </filter>
      </svg>

      <div
        className={`sc-ticket${phase === 'accepting' ? ' sc-accepting' : ''}${phase === 'declining' ? ' sc-declining' : ''}`}
      >
        <div className="sc-ticket__sheet sc-paper">
          <div className="sc-ticket__no">
            <span>TELEGRAM</span>
            <span>NO. {ticketNo}</span>
          </div>
          <p className="sc-ticket__line">{characterName}想和你约定一个新暗号</p>
          <span className="sc-oval">{code}</span>
          <p className="sc-ticket__meaning">{meaning}</p>
          {chosen && (
            <p className="sc-ticket__folder">
              归入
              <button
                type="button"
                className="sc-ftag"
                style={{ '--fc': chosen.colorVar }}
                onClick={cycleFolder}
                aria-label={`归入文件夹 ${chosen.name}，点一下换一个`}
              >
                {chosen.name}
              </button>
            </p>
          )}
          <div className="sc-ticket__btns">
            <button type="button" className="sc-btn" disabled={busy} onClick={() => void handleDecline()}>
              算了
            </button>
            <button
              type="button"
              className="sc-btn sc-btn--solid"
              disabled={busy}
              onClick={() => void handleAccept()}
            >
              收下
            </button>
          </div>
          {error && <p className="sc-ticket__error">{error}</p>}
        </div>

        <svg
          className="sc-ticket__pin"
          viewBox="0 0 60 28"
          fill="none"
          stroke="var(--sc-sub)"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 20c-6-6 4-16 14-12l30 8c6 2 6 10 0 10-6 0-26-6-30-8" />
          <circle cx="48" cy="19" r="2.4" fill="var(--sc-sub)" />
        </svg>
        <div className="sc-stampmark">已收录</div>
      </div>
    </div>
  );
};

export default SecretCodeProposalNotice;