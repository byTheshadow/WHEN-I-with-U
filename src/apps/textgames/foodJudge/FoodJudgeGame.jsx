// src/apps/textgames/foodJudge/FoodJudgeGame.jsx
//
// "美食判官"对局界面，从文字游戏大厅内部切换进来（接入方式跟 20个问题/
// 两个真话一个假话相同，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 流程：选角色 -> 生成三个案件 -> 每案：案卷（差评 + 老板回应）-> 用户判决
// （维持差评 / 撤销差评）-> 盖章 + 店铺评分变化 + 案件真相 -> 角色点评
// （对案子的看法 + 对你判决的看法）-> 下一案 -> 三案结案（跟 TA 看法一致
// 几案 + 收庭陈词）-> 写战绩 + 往聊天里回传结果。
//
// 角色点评在用户下完判决的那一刻就开始后台生成，用户看盖章和真相的时候
// 请求已经在跑，点"听听 TA 怎么说"时通常已经好了。
//
// 对局状态只放在 React state 里，中途退出/刷新就是放弃这一局；只有三案
// 全部判完进入结案页时才落库、回传聊天。

import React, { useEffect, useRef, useState } from 'react';

import { getChatIdForCharacter, listCharactersForPicker } from '../textGameSharedService';
import { generateCaseSet, generateClosing, generateCommentary } from './foodJudgeAiService';
import { countAgreement, recordFoodJudgeMatch } from './foodJudgeService';
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
  COMMENT: 'comment', // 角色点评
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

// 角色在每案的立场：点评成功才有，失败/还没出来都是 null。
const getStances = (commentaries) =>
  Array.from({ length: TOTAL_CASES }, (_, index) =>
    commentaries[index]?.status === 'done' ? commentaries[index].stance : null
  );

const getViews = (commentaries) =>
  Array.from({ length: TOTAL_CASES }, (_, index) =>
    commentaries[index]?.status === 'done' ? commentaries[index].caseView : ''
  );

// 收庭陈词请求失败时的兜底文案。
const fallbackClosing = (agreed, stanced) => {
  if (stanced === 0) return '这三案断完了，下次换我来当判官，看你的差评过不过得了我这关。';
  if (agreed === stanced) return '三案的看法全对上了，看来我们对“该不该给差评”挺合拍。';
  if (agreed === 0) return '一个都没对上，我们的口味差得真远，下次再来分个高下。';
  return '有几案我们想法不一样，这才好玩，下次接着审。';
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

  // commentaries[i]: { status: 'loading' | 'done' | 'failed', caseView, stance, reaction }
  const [commentaries, setCommentaries] = useState([]);
  const [closing, setClosing] = useState({ status: 'idle', text: '' });

  const hasRecordedRef = useRef(false);
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
    setCommentaries([]);
    setClosing({ status: 'idle', text: '' });
    hasRecordedRef.current = false;
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

  const updateCommentary = (index, value) => {
    setCommentaries((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // 用户下完判决就开始后台生成这一案的点评，不等用户点"听听 TA 怎么说"。
  const startCommentary = async (index, verdict, caseItem) => {
    const token = roundTokenRef.current;
    updateCommentary(index, { status: 'loading' });

    const outcome = await generateCommentary({ chatId, caseItem, verdict });
    if (token !== roundTokenRef.current) return;

    updateCommentary(
      index,
      outcome.ok
        ? {
            status: 'done',
            caseView: outcome.caseView,
            stance: outcome.stance,
            reaction: outcome.reaction,
          }
        : { status: 'failed' }
    );
  };

  const handleVerdict = (verdict) => {
    if (phase !== PHASE.FILE) return;

    const index = caseIndex;
    setVerdicts((prev) => {
      const next = [...prev];
      next[index] = verdict;
      return next;
    });
    setPhase(PHASE.VERDICT);
    startCommentary(index, verdict, cases[index]);
  };

  // 三案判完：进结案页，写战绩 + 回传聊天，同时生成收庭陈词。
  // 点评按钮在生成中是禁用的，所以走到这里时每案的点评都已经出结果。
  const finishRound = async () => {
    setPhase(PHASE.SUMMARY);

    if (hasRecordedRef.current || !selectedCharacter) return;
    hasRecordedRef.current = true;

    const token = roundTokenRef.current;
    const stances = getStances(commentaries);
    const views = getViews(commentaries);
    const { agreed, stanced } = countAgreement(verdicts, stances);

    setClosing({ status: 'loading', text: '' });
    const closingPromise = generateClosing({ chatId, cases, verdicts, stances });

    try {
      await recordFoodJudgeMatch({
        characterId: selectedCharacter.id,
        cases,
        verdicts,
        stances,
        views,
      });
    } catch (error) {
      console.warn('[FoodJudge] 战绩写回失败。', error);
    }

    const text = await closingPromise;
    if (token !== roundTokenRef.current) return;

    setClosing({ status: 'done', text: text || fallbackClosing(agreed, stanced) });
  };

  const handleNext = () => {
    if (caseIndex < TOTAL_CASES - 1) {
      setCaseIndex((prev) => prev + 1);
      setPhase(PHASE.FILE);
      return;
    }
    finishRound();
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

  const characterName = selectedCharacter?.name || 'TA';

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

  const renderBubble = (tagText, text, extra) => (
    <div className="tgf-bub">
      <div className="tgf-bub-who">
        <AvatarBubble character={selectedCharacter} className="tgf-bub-av" />
        <span className="tgf-bub-tag">{tagText}</span>
      </div>
      <p>{text}</p>
      {extra}
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
            <button
              type="button"
              className="tgf-btn tgf-btn-solid"
              onClick={() => setPhase(PHASE.COMMENT)}
            >
              听听 {characterName} 怎么说
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === PHASE.COMMENT && caseItem) {
    const verdict = verdicts[caseIndex];
    const commentary = commentaries[caseIndex];
    const isLoading = !commentary || commentary.status === 'loading';
    const isLast = caseIndex === TOTAL_CASES - 1;
    const agree = commentary?.status === 'done' && commentary.stance === verdict;

    return (
      <div className="tgh-shared-screen tgf-screen">
        {renderBackButton(handleBackToPicker)}
        {renderMasthead(`第 ${caseIndex + 1} / ${TOTAL_CASES} 案`)}

        <div className="tgf-body">
          <div className="tgf-label">角色点评</div>

          {isLoading && <p className="tgf-wait">{characterName}正在翻案卷……</p>}

          {!isLoading && commentary.status === 'failed' && (
            <p className="tgf-wait">{characterName}这次没想好怎么说，直接看下一案吧。</p>
          )}

          {!isLoading && commentary.status === 'done' && (
            <div className="tgf-chat">
              {renderBubble('对这个案子', commentary.caseView)}
              {renderBubble(
                '对你的判决',
                commentary.reaction,
                <span className={agree ? 'tgf-agree tgf-agree-yes' : 'tgf-agree tgf-agree-no'}>
                  {agree ? `与 ${characterName} 想法一致` : `与 ${characterName} 想法不同`}
                </span>
              )}
            </div>
          )}

          <div className="tgf-actions">
            <button
              type="button"
              className="tgf-btn tgf-btn-solid"
              onClick={handleNext}
              disabled={isLoading}
            >
              {isLast ? '查看本局结案' : '下一案'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PHASE.SUMMARY
  const stances = getStances(commentaries);
  const { agreed, stanced } = countAgreement(verdicts, stances);
  const keepCount = verdicts.filter((item) => item === 'keep').length;
  const voidCount = verdicts.filter((item) => item === 'void').length;

  return (
    <div className="tgh-shared-screen tgf-screen">
      {renderBackButton(handleBackToPicker)}
      {renderMasthead('本局结案')}

      <div className="tgf-body">
        <div className="tgf-label">三案结案</div>

        {stanced > 0 ? (
          <div className="tgf-summary-count">
            {agreed} / {stanced}
            <span> 与 {characterName} 看法一致</span>
          </div>
        ) : (
          <div className="tgf-summary-count">
            {TOTAL_CASES}
            <span> 案已审结</span>
          </div>
        )}
        <div className="tgf-summary-sub">
          维持 {keepCount} · 撤销 {voidCount}
        </div>

        <div className="tgf-rows">
          {cases.map((item, index) => {
            const verdict = verdicts[index] || 'keep';
            const outcome = describeOutcome(item, verdict);
            const stance = stances[index];

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
                  {stance && (
                    <span
                      className={
                        stance === verdict
                          ? 'tgf-truth-tag tgf-truth-ok'
                          : 'tgf-truth-tag tgf-truth-off'
                      }
                    >
                      {stance === verdict ? `与 ${characterName} 一致` : `与 ${characterName} 不同`}
                    </span>
                  )}
                </div>
                <p className="tgf-row-truth">{item.truth}</p>
              </div>
            );
          })}
        </div>

        {closing.status === 'loading' && (
          <p className="tgf-wait">{characterName}正在整理收庭陈词……</p>
        )}
        {closing.status === 'done' && (
          <div className="tgf-chat">{renderBubble('收庭陈词', closing.text)}</div>
        )}

        {closing.status === 'done' && (
          <p className="tgf-footnote">这一局的结果已经让TA知道了，下次聊天可能会提起。</p>
        )}

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