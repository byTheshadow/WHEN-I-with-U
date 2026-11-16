// src/apps/fiction/FictionThinkingFold.jsx
//
// 游玩页每一段正文上方的「思考过程」折叠块。
//
// 默认折叠；点标题行平滑展开（高度 + 透明度一起缓动，系统开了「减少动态效果」
// 就直接切换）。展开后限制最大高度，内容多了在块内部滚动，不会把正文顶得很远。
// 没有思考内容的段落（没开思维链的存档、旧存档）不渲染任何东西，不占版面。
//
// 正文渲染直接复用 FictionSegmentBody，所以字号、行距、阅读主题、引号高亮
// 都和正文走同一套设置。内容在第一次展开时才渲染，路径很长时不拖慢页面。

import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import FictionSegmentBody from './FictionSegmentBody';
import './fictionThinking.css';

const FictionThinkingFold = ({ text, highlightQuotes = true }) => {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const bodyId = useId();
  const content = String(text || '').trim();

  if (!content) return null;

  const toggle = () => {
    setEverOpened(true);
    setOpen((value) => !value);
  };

  return (
    <div className={`fic-p-think ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="fic-btn-reset fic-p-think-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span className="fic-p-think-dot" aria-hidden="true" />
        <span className="fic-p-think-label">思考过程</span>
        <span className="fic-p-think-count">{content.length} 字</span>
        <ChevronDown className="fic-p-think-arrow" size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <div className="fic-p-think-wrap" id={bodyId} aria-hidden={!open}>
        <div className="fic-p-think-clip">
          <div className="fic-p-think-body">
            {everOpened
              ? <FictionSegmentBody text={content} highlightQuotes={highlightQuotes} />
              : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FictionThinkingFold;