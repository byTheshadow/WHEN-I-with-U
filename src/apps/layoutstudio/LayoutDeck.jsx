// src/apps/layoutstudio/LayoutDeck.jsx
//
// 相机底部操作区：提示语 + 步骤滑轨 + 返回 / 快门 / 相册三个键。
// 步骤滑轨是一条横向的字，当前步骤始终滑到正中间。

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronLeft, Images } from 'lucide-react';

const LayoutDeck = ({
  step,
  stepNames,
  hint,
  hintReady,
  shutterLabel,
  shutterEnabled,
  canGoBack,
  onShutter,
  onBack,
  onAlbum,
  onGoStep,
}) => {
  const boxRef = useRef(null);
  const trackRef = useRef(null);

  const place = useCallback(() => {
    const box = boxRef.current;
    const track = trackRef.current;
    const cur = track?.children[step - 1];
    if (!box || !cur) return;
    track.style.transform = `translateX(${box.clientWidth / 2 - (cur.offsetLeft + cur.offsetWidth / 2)}px)`;
  }, [step]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [place]);

  return (
    <>
      <p className={`ls-hint${hintReady ? ' ls-ready' : ''}`}>{hint}</p>
      <nav className="ls-modes" ref={boxRef}>
        <div className="ls-mtrack" ref={trackRef}>
          {stepNames.map((name, i) => {
            const n = i + 1;
            const cls = n === step ? ' ls-cur ls-can' : n < step ? ' ls-can' : '';
            return (
              <button
                key={name}
                type="button"
                className={`ls-md${cls}`}
                onClick={() => onGoStep(n)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </nav>
      <footer className="ls-deck">
        <button
          type="button"
          className="ls-db"
          disabled={!canGoBack}
          onClick={onBack}
          aria-label="上一步"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className={`ls-shut${shutterEnabled ? ' ls-ready' : ''}`}
          disabled={!shutterEnabled}
          onClick={onShutter}
        >
          <i>{shutterLabel}</i>
        </button>
        <button type="button" className="ls-roll" onClick={onAlbum} aria-label="相册">
          <Images size={18} />
        </button>
      </footer>
    </>
  );
};

export default LayoutDeck;
