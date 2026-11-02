import React from 'react';

import { CUSTODY_DAILY_BUY_CAP, CUSTODY_SHORT_HEARTS_TEXT } from './companionCustodyService';
import './companionCustodyNote.css';

/*
 * 托管面板："给TA的小纸条"。
 *
 * 不是设置页，是一张贴在页面上的便利贴：用户（写纸条的人）拜托角色
 * 搭把手，两个人一起照顾小伙伴。纯展示组件——开关状态和切换逻辑都在
 * CompanionPage.jsx 里，这里只负责样子。
 *
 * 排版约定：纸条里每一行文案都是单行（white-space: nowrap），字号随
 * 视口宽度在 css 里 clamp，保证窄屏也不会掉成"一行拆两行、字挤成一团"。
 */
const CompanionCustodyNote = ({ enabled, busy, characterName, onToggle, onClose }) => {
  const name = characterName || 'TA';

  return (
    <div className="cp-overlay center ccn-overlay">
      <div className="cp-backdrop" onClick={onClose} />

      <div className="ccn-stage">
        <div className={`ccn-note ${enabled ? 'is-on' : ''}`}>
          <i className="ccn-tape" aria-hidden="true" />
          <button type="button" onClick={onClose} className="ccn-close" aria-label="收起小纸条">×</button>

          <h3 className="ccn-title">{`给${name}的小纸条`}</h3>
          <p className="ccn-line">小伙伴是<b>我们俩</b>一起养的</p>
          <p className="ccn-line">我忙的时候，想拜托你搭把手~</p>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={onToggle}
            className="ccn-ask"
          >
            <span className="ccn-box" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 13l5 5L20 6" />
              </svg>
            </span>
            <span className="ccn-ask-text">
              拜托你帮忙照顾
              <small>{enabled ? '已经拜托啦' : '还没有拜托'}</small>
            </span>
            <span className="ccn-stamp" aria-hidden="true">拜托啦</span>
          </button>

          <ul className="ccn-rules">
            <li>每天帮忙做完没做的喂食、清洁、玩耍</li>
            <li>{`数值还低就挑够用的补上，一天最多${CUSTODY_DAILY_BUY_CAP}次`}</li>
            <li>你平时自己来照顾小伙伴，一样照常</li>
          </ul>

          <div className="ccn-hint">
            <span>心心不够的时候，会写：</span>
            <b>{`「${CUSTODY_SHORT_HEARTS_TEXT}」`}</b>
          </div>

          <p className="ccn-sign">谢谢你~</p>
        </div>
      </div>
    </div>
  );
};

export default CompanionCustodyNote;