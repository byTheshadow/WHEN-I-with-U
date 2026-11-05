// src/apps/textgames/TextGameHallApp.jsx
//
// “文字游戏大厅”——顶层 app，跟长RP/泡泡模式同级，主页宫格里一个独立
// 入口，不跟任何具体角色/对话绑定。这是 Slice A：只做大厅骨架本身
// （目录数据 + 选择界面），12 个游戏目前都还没有真实玩法，点进去统一
// 弹一条“即将开放”的提示，不跳转到任何页面——真正的游戏逻辑留到轮到
// 每一个具体游戏时再单独排期建造。
//
// 视觉是用户自己确认过的黑白弥散杂志风预览（封面墨卡 + 目录条目），这
// 里原样照搬排版，只是从裸 HTML 换成 React 组件，类名见 textGameHall.css。

import React, { useEffect, useRef, useState } from 'react';

import { TEXT_GAME_CATALOG, TEXT_GAME_STATUS } from './textGameCatalog';
import TicTacToeGame from './ticTacToe/TicTacToeGame';
import TwentyQuestionsGame from './twentyQuestions/TwentyQuestionsGame';
import WitchsPoisonGame from './witchsPoison/WitchsPoisonGame';
import UnoGame from './uno/UnoGame';
import TexasHoldemGame from './texas/TexasHoldemGame';   // 新增
import UndercoverGame from './undercover/UndercoverGame';
import LiarsDiceGame from './liarsDice/LiarsDiceGame';
import SkullGame from './skull/SkullGame';
import TwoTruthsOneLieGame from './twoTruthsOneLie/TwoTruthsOneLieGame';
import FoodJudgeGame from './foodJudge/FoodJudgeGame';
import './textGameHall.css';

const GAME_COMPONENTS = {
  'tic-tac-toe': TicTacToeGame,
  'twenty-questions': TwentyQuestionsGame,
  'witchs-poison': WitchsPoisonGame,
  'uno': UnoGame,
  'texas-holdem': TexasHoldemGame,
  'undercover': UndercoverGame,
    'liars-dice': LiarsDiceGame,
  'skull': SkullGame,
  'two-truths-one-lie': TwoTruthsOneLieGame,
  'food-judge': FoodJudgeGame,
};

const ChevronIcon = () => (
  <svg
    className="tgh-chevron"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

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

const TextGameHallApp = ({ onBackHub }) => {
  const [toastMessage, setToastMessage] = useState('');
  const [activeGameId, setActiveGameId] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const handleEntryClick = (game) => {
    const GameComponent = GAME_COMPONENTS[game.id];

    if (game.status === TEXT_GAME_STATUS.AVAILABLE && GameComponent) {
      setActiveGameId(game.id);
      return;
    }

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToastMessage(`《${game.title}》还在准备中，之后会在这里开放`);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 2200);
  };

  // activeGameId 分支和大厅目录分支都要包在同一个 .tgh-app 根节点下面
  // ——ticTacToe.css 用的 --tgh-ink/--tgh-paper 这些颜色变量是定义在
  // .tgh-app 这个类选择器上的（不是 :root），具体对局界面不自带一份
  // .tgh-app 外壳的话，这些变量在那边全都解析不到。
  return (
       <div className="tgh-app">
      {activeGameId ? (
        (() => {
          const ActiveGame = GAME_COMPONENTS[activeGameId];
          return <ActiveGame onExitToHall={() => setActiveGameId(null)} />;
        })()
      ) : (
        <div className="tgh-container">
          <section className="tgh-masthead">
            <button
              type="button"
              className="tgh-back-btn"
              aria-label="返回"
              onClick={onBackHub}
            >
              <BackIcon />
            </button>

            <div className="tgh-blob tgh-blob-a" aria-hidden="true" />
            <div className="tgh-blob tgh-blob-b" aria-hidden="true" />
            <div className="tgh-blob tgh-blob-c" aria-hidden="true" />

            <div className="tgh-masthead-inner">
              <div className="tgh-kicker">
                <span>VOL. 01</span>
                <span className="tgh-rule" />
                <span>TEXT GAME HALL</span>
              </div>

              <h1>文字游戏大厅</h1>
              <p className="tgh-sub">Twelve small games, one shared door</p>
              <p className="tgh-blurb">
                打发时间的方法，有的要跟TA一起玩，有的是你一个人也能
                上手。挑一条目录往下看，点进去就能开局。
              </p>

              <div className="tgh-count-row">
                <div>
                  <div className="tgh-count">{TEXT_GAME_CATALOG.length}</div>
                  <div className="tgh-count-label">款游戏</div>
                </div>
                <div>
                  <div className="tgh-count">02</div>
                  <div className="tgh-count-label">人机 / 双人</div>
                </div>
              </div>
            </div>
          </section>

          <div className="tgh-index-head">
            <h2>游戏目录</h2>
            <span className="tgh-en">Issue Index</span>
          </div>

          <div className="tgh-index-list">
            {TEXT_GAME_CATALOG.map((game, index) => (
              <button
                key={game.id}
                type="button"
                className="tgh-entry"
                onClick={() => handleEntryClick(game)}
              >
                <div className="tgh-num">
                  {String(index + 1).padStart(2, '0')}
                </div>

                <div className="tgh-body-col">
                  <div className="tgh-title-row">
                    <span className="tgh-title">{game.title}</span>
                    <span className="tgh-byline">{game.titleEn}</span>
                  </div>
                  <div className="tgh-desc">{game.desc}</div>
                </div>

                <div className="tgh-tag-col">
                  <span
                    className={
                      game.modeEmphasis ? 'tgh-tag tgh-tag-ink' : 'tgh-tag'
                    }
                  >
                    {game.mode}
                  </span>
                  <ChevronIcon />
                </div>
              </button>
            ))}
          </div>

          <p className="tgh-footer-note">点击任意一条，马上开局</p>
        </div>
      )}

      {toastMessage && <div className="tgh-toast">{toastMessage}</div>}
    </div>
  );
};
export default TextGameHallApp;