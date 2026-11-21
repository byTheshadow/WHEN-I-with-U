// src/apps/focus/FocusAfter.jsx
//
// 结束页里"角色的反应"和"给 TA 留几句话"，以及休息页用的台词 hook。
// - 反应：每个被通知的角色一句预设的话（按角色设定粗分口吻），只显示在这一页，不写进聊天。
// - 总结：手写或 AI 起草后发给被通知的角色，发出后他们会回应一次；也可以选"不发了"。

import React, { useEffect, useMemo, useState } from 'react';

import db from '../../db';
import { FOCUS_LINE_KINDS, detectTone, pickFocusLine } from './focusLines';
import { draftFocusSummary, sendFocusSummary } from './focusSummaryService';
import './focusAfter.css';

const loadTones = async (chatOptions, chatIds) => {
  const out = new Map();

  for (const chatId of chatIds) {
    const option = chatOptions.find((item) => item.chatId === chatId);
    if (!option) continue;

    let tone = detectTone('');
    try {
      const character = await db.characters.get(option.characterId);
      tone = detectTone(`${character?.bio || ''}\n${character?.extraNotes || ''}`);
    } catch {
      // 读不到角色设定就用默认口吻。
    }
    out.set(chatId, tone);
  }

  return out;
};

const getReactionKind = (session) => {
  if (session.status === 'abandoned') return FOCUS_LINE_KINDS.ABANDONED;
  const planned = Math.max(1, session.durationMinutes || 1);
  const actual = Math.max(0, session.actualMinutes || 0);
  return actual < planned ? FOCUS_LINE_KINDS.EARLY : FOCUS_LINE_KINDS.COMPLETED;
};

/**
 * 休息页的台词：从被通知的角色里按这一轮的编号挑一位，用他的口吻。
 * 还没读到设定、或这一轮没有通知任何人时，返回空字符串，页面自己用默认的一句话。
 */
export const useRestLines = (session, chatOptions) => {
  const [lines, setLines] = useState({ rest: '', over: '' });
  const sessionId = session?.id ?? 0;
  const chatIdsKey = (session?.chatIds || []).join(',');

  useEffect(() => {
    let active = true;
    const ids = session?.chatIds || [];

    if (!ids.length || !Array.isArray(chatOptions)) {
      setLines({ rest: '', over: '' });
      return undefined;
    }

    const chosen = ids[Math.abs(Number(sessionId) || 0) % ids.length];

    loadTones(chatOptions, [chosen]).then((tones) => {
      if (!active) return;
      const tone = tones.get(chosen);
      if (!tone) return;
      setLines({
        rest: pickFocusLine(tone, FOCUS_LINE_KINDS.REST, sessionId + 1),
        over: pickFocusLine(tone, FOCUS_LINE_KINDS.REST_OVER, sessionId + 1),
      });
    });

    return () => {
      active = false;
    };
    // chatIdsKey 代表 session.chatIds 的内容，避免数组引用变化导致重复读取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, chatIdsKey, chatOptions]);

  return lines;
};

const Avatar = ({ option }) => {
  const initial = String(option?.name || 'TA').slice(0, 1);

  return (
    <span className="focus-react-av" aria-hidden="true">
      {option?.avatar ? <img src={option.avatar} alt="" /> : <span>{initial}</span>}
    </span>
  );
};

const SummaryBox = ({ session, names }) => {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | drafting | sending | sent | skipped
  const [error, setError] = useState('');

  const target = names.length ? names.join('、') : 'TA';

  if (phase === 'skipped') return null;

  if (phase === 'sent') {
    return (
      <p className="focus-hint focus-hint--center focus-after-sent">
        已经发给 {target}，等 TA 回应你吧。
      </p>
    );
  }

  const handleDraft = async () => {
    if (phase !== 'idle') return;
    setPhase('drafting');
    setError('');

    try {
      const draft = await draftFocusSummary(session, names);
      setText(draft);
    } catch (draftError) {
      console.warn('[focus] AI 起草失败:', draftError);
      setError('这次没能起草出来，可以自己写几句。');
    } finally {
      setPhase('idle');
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || phase !== 'idle') return;
    setPhase('sending');
    setError('');

    try {
      const count = await sendFocusSummary(session, content);
      if (count > 0) {
        setPhase('sent');
      } else {
        setError('没能发出去，请再试一次。');
        setPhase('idle');
      }
    } catch (sendError) {
      console.warn('[focus] 发送总结失败:', sendError);
      setError('没能发出去，请再试一次。');
      setPhase('idle');
    }
  };

  const busy = phase === 'drafting' || phase === 'sending';

  return (
    <section className="focus-block focus-summary">
      <div className="focus-label">给 {target} 留几句话</div>
      <textarea
        className="focus-input focus-textarea"
        value={text}
        maxLength={300}
        disabled={busy}
        placeholder="写几句这一轮的感受或收获，发出去后 TA 会回应你。"
        onChange={(event) => setText(event.target.value)}
      />
      {error && <p className="focus-error focus-summary-error" role="alert">{error}</p>}
      <div className="focus-summary-actions">
        <button type="button" className="focus-ghost-btn" disabled={busy} onClick={handleDraft}>
          {phase === 'drafting' ? '起草中…' : 'AI 帮我起草'}
        </button>
        <button
          type="button"
          className="focus-main-btn"
          disabled={busy || !text.trim()}
          onClick={handleSend}
        >
          {phase === 'sending' ? '发送中…' : '发给 TA'}
        </button>
      </div>
      <div className="focus-foot focus-foot--single">
        <button type="button" className="focus-link" disabled={busy} onClick={() => setPhase('skipped')}>
          不发了
        </button>
      </div>
    </section>
  );
};

const FocusAfter = ({ session, chatOptions }) => {
  const [tones, setTones] = useState(() => new Map());
  const chatIds = useMemo(() => session?.chatIds || [], [session]);
  const options = useMemo(
    () =>
      chatIds
        .map((id) => (Array.isArray(chatOptions) ? chatOptions.find((item) => item.chatId === id) : null))
        .filter(Boolean),
    [chatIds, chatOptions],
  );

  useEffect(() => {
    let active = true;

    if (!options.length) return undefined;

    loadTones(chatOptions, chatIds).then((result) => {
      if (active) setTones(result);
    });

    return () => {
      active = false;
    };
  }, [chatOptions, chatIds, options.length]);

  if (!session || !options.length) return null;

  const kind = getReactionKind(session);
  const seed = Number(session.id) || 0;
  const names = options.map((option) => option.name);

  return (
    <div className="focus-after">
      <div className="focus-react-list">
        {options.map((option, index) => {
          const line = pickFocusLine(tones.get(option.chatId) || detectTone(''), kind, seed + index);
          if (!line) return null;

          return (
            <div className="focus-react" key={option.chatId}>
              <Avatar option={option} />
              <div className="focus-react-body">
                <div className="focus-react-name">{option.name}</div>
                <p className="focus-react-line">{line}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!session.summarySent && <SummaryBox session={session} names={names} />}
    </div>
  );
};

export default FocusAfter;
