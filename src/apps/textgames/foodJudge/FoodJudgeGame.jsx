// src/apps/textgames/foodJudge/FoodJudgeGame.jsx
//
// "美食判官"对局界面，从文字游戏大厅内部切换进来（接入方式跟 20个问题/
// 两个真话一个假话相同，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 流程：选角色 -> 生成三个案件 -> 每案：案卷（差评 + 老板回应）-> 用户判决
// （维持差评 / 撤销差评）-> 盖章 + 店铺评分变化 + 案件真相 -> 下一案 ->
// 三案结案。
//
// 这是 Slice A：角色在这一版里只是头像和名字，还不会点评案件或判决，
// 战绩也不落库、不往聊天里写消息——这两样是 Slice B。对局状态只放在
// React state 里，中途退出/刷新就是放弃这一局。

import React, { useEffect, useRef, useState } from 'react';

import { getChatIdForCharacter, listCharactersForPicker } from '../textGameSharedService';
import { generateCaseSet } from './foodJudgeAiService';
import '../textGameShared.css';
import './foodJudge.css';

const BackIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const AvatarBubble = ({ character, className }) => {
  const name = character?.name || '';
  const initial = name.trim().charAt(0) || '?';

  if (character?.avatar) {
    return <img src={character.avatar} alt={name} className={className} />;
  }

  return <div className={className}>{initial}</div>;
};

const PHASE = {
  PICK_CHARACTER: 'pick-character',
  LOADING: 'loading', // 等三个案件生成
  ERROR: 'error',
  FILE: 'file', // 案卷：用户阅读并判决
  VERDICT: 'verdict', // 盖章 + 真相
  SUMMARY: 'summary', // 三案结案
};

const VERDICT_LABEL = { keep: '维持', void: '撤销' };
const TOTAL_CASES = 3;

const starText = (count) => '★'.repeat(count) + '☆'.repeat(Math.max(0, 5 - count));

const formatRating = (value) => Number(value).toFixed(1);

// 判决后的评分：维持差评，店铺评分掉 0.1；撤销则不变。只是这一局里的
// 展示效果，不存档（每案的店都是虚构的）。
const ratingAfterVerdict = (caseItem, verdict) =>
  verdict === 'keep' ? Math.max(3, caseItem.shopRating - 0.1) : caseItem.shopRating;

const describeOutcome = (caseItem, verdict) => {
  if (caseItem.truthVerdict === 'gray') return { label: '这案有争议', tone: 'gray' };
  if (caseItem.truthVerdict === verdict) return { label: '判得准', tone: 'ok' };
  return { label: '这案另有隐情', tone: 'off' };
};

const ReviewCard = ({ caseItem }) => (
  <div className="tgf-review">
    <div className="tgf-review-head">
      <div className="tgf-review-avatar">{caseItem.cust.charAt(0)}</div>
      <div className="tgf-review-who">
        <div className="tgf-review-name">{caseItem.cust}</div>
        <div className="tgf-review-meta">
          {[caseItem.time, caseItem.shop].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="tgf-review-stars" aria-label={`${caseItem.stars} 星`}>
        {starText(caseItem.stars)}
      </div>
    </div>

    <p className="tgf-review-text">{caseItem.text}</p>

    {caseItem.tags.length > 0 && (
      <div className="tgf-chips">
        {caseItem.tags.map((tag) => (
          <span key={tag} className="tgf-chip">
            {tag}
          </span>
        ))}
      </div>
    )}
  </div>
);

const ReceiptCard = ({ caseItem }) => (
  <div className="tgf-receipt">
    <div className="tgf-receipt-top">
      <span>{caseItem.boss}</span>
      <span>申诉单 #{caseItem.no}</span>
    </div>

    <p className="tgf-receipt-text">{caseItem.reply}</p>

    {caseItem.evidence.length > 0 && (
      <div className="tgf-receipt-evidence">
        {caseItem.evidence.map((item, index) => (
          <div key={index}>
            <span>{item.name}</span>
            <b>{item.value}</b>
          </div>
        ))}
      </div>
    )}
  </div>
);

const FoodJudgeGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [chatId, setChatId] = useState(null);

  const [phase, setPhase] = useState(PHASE.PICK_CHARACTER);
  const [errorKind, setErrorKind] = useState(null); // 'unavailable' | 'parse'

  const [cases, setCases] = useState([]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [verdicts, setVerdicts] = useState([]); // ('keep' | 'void')[]

  // 每次重置一局就 +1：异步请求回来之后比对一下，对不上就说明用户已经
  // 退出/重开了，这次回来的结果直接丢掉，不去改新一局的状态。
  const roundTokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await listCharactersForPicker();
        if (!cancelled) setCharacters(list);
      } finally {
        if (!cancelled) setLoadingCharacters(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const resetRoundState = () => {
    roundTokenRef.current += 1;
    setErrorKind(null);
    setCases([]);
    setCaseIndex(0);
    setVerdicts([]);
  };

  const beginRound = async (id) => {
    resetRoundState();
    const token = roundTokenRef.current;
    setPhase(PHASE.LOADING);

    const outcome = await generateCaseSet({ chatId: id, count: TOTAL_CASES });
    if (token !== roundTokenRef.current) return;

    if (!outcome.ok) {
      setErrorKind(outcome.reason);
      setPhase(PHASE.ERROR);
      return;
    }

    setCases(outcome.cases);
    setPhase(PHASE.FILE);
  };

  const handlePickCharacter = async (character) => {
    setSelectedCharacter(character);
    const id = await getChatIdForCharacter(character.id);
    setChatId(id);
    await beginRound(id);
  };

  const handleVerdict = (verdict) => {
    if (phase !== PHASE.FILE) return;
    setVerdicts((prev) => {
      const next = [...prev];
      next[caseIndex] = verdict;
      return next;
    });
    setPhase(PHASE.VERDICT);
  };

  const handleNext = () => {
    if (caseIndex < TOTAL_CASES - 1) {
      setCaseIndex((prev) => prev + 1);
      setPhase(PHASE.FILE);
      return;
    }
    setPhase(PHASE.SUMMARY);
  };

  const handlePlayAgain = () => {
    beginRound(chatId);
  };

  const handleBackToPicker = () => {
    resetRoundState();
    setSelectedCharacter(null);
    setChatId(null);
    setPhase(PHASE.PICK_CHARACTER);
  };

  // ================= 渲染 =================

  const renderBackButton = (onClick) => (
    <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onClick}>
      <BackIcon />
    </button>
  );

  const renderMasthead = (rightText) => (
    <div className="tgf-masthead">
      <div className="tgf-mast-row">
        <span>FOOD COURT</span>
        <span>{rightText}</span>
      </div>
      <h1 className="tgf-mast-title">
        <span>美食</span>判官
      </h1>
      <div className="tgf-ticks" aria-hidden="true">
        {Array.from({ length: TOTAL_CASES }, (_, index) => {
          let className = 'tgf-tick';
          if (phase === PHASE.SUMMARY || index < caseIndex) className += ' tgf-tick-done';
          else if (index === caseIndex) className += ' tgf-tick-now';
          return <span key={index} className={className} />;
        })}
      </div>
    </div>
  );

  if (phase === PHASE.PICK_CHARACTER) {
    return (
      <div className="tgh-shared-screen tgf-screen">
        {renderBackButton(onExitToHall)}

        <div className="tgh-shared-picker-head">
          <h2>找谁一起当判官</h2>
          <p>Pick your fellow judge</p>
        </div>

        {loadingCharacters && <p className="tgh-shared-empty">正在加载角色列表……</p>}

        {!loadingCharacters && characters.length === 0 && (
          <p className="tgh-shared-empty">还没有可以玩的角色，先去创建一个角色吧。</p>
        )}

        {!loadingCharacters && characters.length > 0 && (
          <div className="tgh-shared-picker-grid">
            {characters.map((character) => (
              <button
                key={character.id}
                type="button"
                className="tgh-shared-picker-item"
                onClick={() => handlePickCharacter(character)}
              >
                <AvatarBubble character={character} className="tgh-shared-picker-avatar" />
                <span className="tgh-shared-picker-name">{character.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === PHASE.LOADING) {
    return (
      <div className="tgh-shared-screen tgf-screen">
        {renderBackButton(handleBackToPicker)}
        <p className="tgh-shared-empty" style={{ marginTop: 100 }}>
          三份案卷正在送到你桌上……
        </p>
      </div>
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <div className="tgh-shared-screen tgf-screen">
        {renderBackButton(handleBackToPicker)}
        <p className="tgh-shared-empty" style={{ marginTop: 100 }}>
          {errorKind === 'unavailable'
            ? '还没配置好AI接口，这个游戏需要AI才能玩——去设置里配置聊天接口后再来吧。'
            : '这次的案卷没能整理好，再试一次吧。'}
        </p>
        <div className="tgh-shared-actions">
          {errorKind !== 'unavailable' && (
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              onClick={handlePlayAgain}
            >
              再试一次
            </button>
          )}
          <button type="button" className="tgh-shared-btn" onClick={handleBackToPicker}>
            换个人玩
          </button>
        </div>
      </div>
    );
  }

  const caseItem = cases[caseIndex];

  if (phase === PHASE.FILE && caseItem) {
    return (
      <div className="tgh-shared-screen tgf-screen">
        {renderBackButton(handleBackToPicker)}
        {renderMasthead(`第 ${caseIndex + 1} / ${TOTAL_CASES} 案`)}

        <div className="tgf-body">
          <div className="tgf-label">案卷 No.{caseItem.no} · {caseItem.shop}</div>

          <div className="tgf-label">原告 · 差评</div>
          <ReviewCard caseItem={caseItem} />

          <div className="tgf-label">被告 · 老板回应</div>
          <ReceiptCard caseItem={caseItem} />

          <div className="tgf-label">你的判决</div>
          <div className="tgf-actions">
            <button
              type="button"
              className="tgf-btn tgf-btn-keep"
              onClick={() => handleVerdict('keep')}
            >
              维持差评
              <small>顾客说得对</small>
            </button>
            <button
              type="button"
              className="tgf-btn tgf-btn-void"
              onClick={() => handleVerdict('void')}
            >
              撤销差评
              <small>这条不该展示</small>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === PHASE.VERDICT && caseItem) {
    const verdict = verdicts[caseIndex];
    const outcome = describeOutcome(caseItem, verdict);
    const after = ratingAfterVerdict(caseItem, verdict);
    const isLast = caseIndex === TOTAL_CASES - 1;

    return (
      <div className="tgh-shared-screen tgf-screen">
        {renderBackButton(handleBackToPicker)}
        {renderMasthead(`第 ${caseIndex + 1} / ${TOTAL_CASES} 案`)}

        <div className="tgf-body">
          <div className="tgf-label">判决已下达</div>

          <div className="tgf-stage">
            <ReviewCard caseItem={caseItem} />
            <div className={`tgf-stamp tgf-stamp-${verdict}`}>{VERDICT_LABEL[verdict]}</div>
          </div>

          <div className="tgf-rating">
            <span className="tgf-rating-shop">{caseItem.shop}</span>
            <span className="tgf-rating-num">
              {formatRating(caseItem.shopRating)} → {formatRating(after)}
            </span>
            <span
              className={
                verdict === 'keep' ? 'tgf-rating-delta tgf-rating-down' : 'tgf-rating-delta'
              }
            >
              {verdict === 'keep' ? '差评展示，评分下滑' : '差评撤下，评分不变'}
            </span>
          </div>

          <div className="tgf-label">案件真相</div>
          <div className="tgf-truth">
            <span className={`tgf-truth-tag tgf-truth-${outcome.tone}`}>{outcome.label}</span>
            <p>{caseItem.truth}</p>
          </div>

          <div className="tgf-actions">
            <button type="button" className="tgf-btn tgf-btn-solid" onClick={handleNext}>
              {isLast ? '查看本局结案' : '下一案'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PHASE.SUMMARY
  const keepCount = verdicts.filter((item) => item === 'keep').length;
  const voidCount = verdicts.filter((item) => item === 'void').length;

  return (
    <div className="tgh-shared-screen tgf-screen">
      {renderBackButton(handleBackToPicker)}
      {renderMasthead('本局结案')}

      <div className="tgf-body">
        <div className="tgf-label">三案结案</div>

        <div className="tgf-summary-count">
          维持 {keepCount}<span> · </span>撤销 {voidCount}
        </div>

        <div className="tgf-rows">
          {cases.map((item, index) => {
            const verdict = verdicts[index] || 'keep';
            const outcome = describeOutcome(item, verdict);

            return (
              <div className="tgf-row" key={item.no}>
                <div className="tgf-row-main">
                  <div className="tgf-row-no">案 {item.no}</div>
                  <div className="tgf-row-name">{item.shop}</div>
                </div>
                <div className={`tgf-row-stamp tgf-stamp-${verdict}`}>{VERDICT_LABEL[verdict]}</div>
                <div className="tgf-row-sub">
                  <span>
                    {item.cust} · {item.stars} 星
                  </span>
                  <span className={`tgf-truth-tag tgf-truth-${outcome.tone}`}>{outcome.label}</span>
                </div>
                <p className="tgf-row-truth">{item.truth}</p>
              </div>
            );
          })}
        </div>

        <div className="tgh-shared-actions">
          <button
            type="button"
            className="tgh-shared-btn tgh-shared-btn-primary"
            onClick={handlePlayAgain}
          >
            再来一局
          </button>
          <button type="button" className="tgh-shared-btn" onClick={handleBackToPicker}>
            换个人玩
          </button>
        </div>
      </div>
    </div>
  );
};

export default FoodJudgeGame;