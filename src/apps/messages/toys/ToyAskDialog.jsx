// src/apps/messages/toys/ToyAskDialog.jsx
//
// 点"让TA做个小玩具"后弹出的小卡：想玩什么（可留空，由角色自己决定）。
// 提交只把用户的想法交给上层（ChatRoom），真正的制作在 toyService.js 里后台进行。

import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { TOY_LIMITS, TOY_QUICK_PICKS } from './toyConstants';
import './toys.css';

const ToyAskDialog = ({ isOpen, characterName = '对方', isBusy = false, onClose, onSubmit }) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (isOpen) setText('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (isBusy) return;
    onSubmit?.(text.trim());
  };

  return (
    <div className="toy-ask" onClick={onClose} role="presentation">
      <div
        className="toy-ask__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="让TA做个小玩具"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="toy-card__kicker">Toy Maker</div>
        <h3 className="toy-ask__title">让TA做个小玩具</h3>
        <p className="toy-ask__desc">
          {characterName}会按自己的想法做一个能在手机上玩的小游戏，做好后放进聊天里。
        </p>

        <textarea
          className="toy-ask__input"
          value={text}
          maxLength={TOY_LIMITS.requestChars}
          placeholder="想玩什么？比如打地鼠、贪吃蛇。留空就让TA自己决定。"
          onChange={(event) => setText(event.target.value)}
        />

        <div className="toy-ask__chips">
          {TOY_QUICK_PICKS.map((pick) => (
            <button
              key={pick}
              type="button"
              className={`toy-ask__chip${text === pick ? ' toy-ask__chip--on' : ''}`}
              onClick={() => setText(pick)}
            >
              {pick}
            </button>
          ))}
          <button
            type="button"
            className={`toy-ask__chip${text === '' ? ' toy-ask__chip--on' : ''}`}
            onClick={() => setText('')}
          >
            随TA决定
          </button>
        </div>

        <div className="toy-ask__hint">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            {isBusy
              ? '这个聊天里已经有一个小玩具在做了，等它做好再来。'
              : '制作需要一次 AI 调用，大约 20 到 60 秒。做的时候你可以先去干别的。'}
          </span>
        </div>

        <div className="toy-ask__actions">
          <button type="button" className="toy-ask__button" onClick={onClose}>取消</button>
          <button
            type="button"
            className="toy-ask__button toy-ask__button--primary"
            disabled={isBusy}
            onClick={handleSubmit}
          >
            开始制作
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToyAskDialog;
