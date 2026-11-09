// src/apps/layoutstudio/LayoutPolaroid.jsx
//
// 第 4 步的拍立得：正面是成品，背面是角色写的两句话（逐字打出来）。
// 进入第 4 步时弹出相纸，停一会儿自动翻面，点相纸可以再翻。
// 文字内容（notes）由外面传入，这里只负责展示，不碰 AI 和数据库。

import React, { useEffect, useState } from 'react';

import useTypewriter from './useTypewriter';

const fmtDate = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

const LayoutPolaroid = ({ active, resultUrl, charName, templateLabel, notes, notesLoading }) => {
  const [flipped, setFlipped] = useState(false);
  const [round, setRound] = useState(0);

  // 每次进入第 4 步（或成品图换了）：重新弹出相纸，1.7 秒后自动翻面。
  useEffect(() => {
    if (!active || !resultUrl) return undefined;
    setRound((r) => r + 1);
    setFlipped(false);
    const timer = window.setTimeout(() => setFlipped(true), 1700);
    return () => window.clearTimeout(timer);
  }, [active, resultUrl]);

  const hasNotes = Boolean(notes && (notes.why || notes.praise));
  const why = useTypewriter(notes?.why || '', { speed: 40, active: flipped && hasNotes });
  const whyDone = !notes?.why || why.done;
  const praise = useTypewriter(notes?.praise || '', {
    speed: 44,
    active: flipped && hasNotes && whyDone,
  });
  const allDone = hasNotes && whyDone && (!notes?.praise || praise.done);

  if (!resultUrl) return null;

  let sys = '';
  if (notesLoading) sys = `${charName} 正在写下想法...`;
  else if (!hasNotes) sys = `${charName} 这次没留下话，不影响保存和发送。`;

  return (
    <div
      key={round}
      className="ls-pola"
      onClick={() => setFlipped((f) => !f)}
      role="button"
      tabIndex={0}
      aria-label="点一下翻面"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
    >
      <div className={`ls-pin4${flipped ? ' ls-flip' : ''}`}>
        <div className="ls-face ls-pfront">
          <img src={resultUrl} alt="修好的照片" />
          <div className="ls-cap">
            <b>{`${charName} 修的${templateLabel || '图'}`}</b>
            <span>{fmtDate()}</span>
          </div>
        </div>
        <div className="ls-face ls-pback">
          <h4>为什么这样修</h4>
          <p className={why.typing ? 'ls-caret' : ''}>{why.shown}</p>
          <h4>对你照片的评价</h4>
          <p className={praise.typing ? 'ls-caret' : ''}>{praise.shown}</p>
          {allDone ? <div className="ls-sig">{`—— ${charName}`}</div> : null}
          {sys ? <div className="ls-sys">{sys}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default LayoutPolaroid;
