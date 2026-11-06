// src/apps/hub/hubPageLayouts/dial/ScrambleTitle.jsx
//
// 转盘版式的大标题：逐字显示当前电台的名字。换台时英文字母先乱跳再依次定住
// （「调频」效果），定住之后字母随声波轻轻起伏。动效都直接改 DOM（textContent
// 和 transform），不经过 React 状态，所以每帧不会触发重新渲染。
//
//   text      要显示的文字（空格分词，词不会被拆行）
//   motionOn  false 时直接显示定住的文字，没有任何动画
//   waving    true 时字母起伏（比如保活播放中幅度更大）
//   active    false 时暂停起伏（标题不在视野里），不耗电

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const WAVE_FRAME_MS = 33;

export const ScrambleTitle = ({ text, motionOn, waving, active }) => {
  const rootRef = useRef(null);

  const words = useMemo(
    () => String(text || '').split(' ').map((word) => word.split('')),
    [text]
  );

  // 先把每个字写进对应的 span。span 里不放 React 子节点，后面动画才能直接改 textContent。
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const flat = words.reduce((all, word) => all.concat(word), []);
    root.querySelectorAll('.dl-ch').forEach((node, index) => {
      node.textContent = flat[index] || '';
      node.classList.remove('noise');
      node.style.transform = '';
    });
  }, [words]);

  // 换台时的乱码定格动画。
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !motionOn) return undefined;

    const flat = words.reduce((all, word) => all.concat(word), []);
    const nodes = Array.from(root.querySelectorAll('.dl-ch'));
    const startedAt = performance.now();
    let frame = 0;
    let rafId = 0;

    const step = (now) => {
      const elapsed = now - startedAt;
      let done = true;
      frame += 1;

      nodes.forEach((node, index) => {
        const letter = flat[index] || '';
        if (elapsed > 90 + index * 32 || !/[A-Za-z]/.test(letter)) {
          if (node.textContent !== letter) node.textContent = letter;
          node.classList.remove('noise');
        } else {
          done = false;
          if (frame % 3 === 0) {
            node.textContent = ALPHA[Math.floor(Math.random() * 26)];
          }
          node.classList.add('noise');
        }
      });

      if (!done) rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      nodes.forEach((node, index) => {
        node.textContent = flat[index] || '';
        node.classList.remove('noise');
      });
    };
  }, [words, motionOn]);

  // 定住之后的起伏：限制在每秒约 30 帧，不在视野里或动效关闭时完全停掉。
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const nodes = Array.from(root.querySelectorAll('.dl-ch'));

    if (!motionOn || !active) {
      nodes.forEach((node) => {
        node.style.transform = '';
      });
      return undefined;
    }

    const amplitude = waving ? 1.8 : 0.7;
    let lastPaint = 0;
    let rafId = 0;

    const step = (now) => {
      if (now - lastPaint >= WAVE_FRAME_MS) {
        lastPaint = now;
        const t = now / 1000;
        nodes.forEach((node, index) => {
          node.style.transform = `translateY(${(Math.sin(t * 2.3 + index * 0.6) * amplitude).toFixed(2)}px)`;
        });
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      nodes.forEach((node) => {
        node.style.transform = '';
      });
    };
  }, [words, motionOn, waving, active]);

  return (
    <h1 ref={rootRef} className="dl-name" aria-label={text} aria-live="off">
      {words.map((word, wordIndex) => (
        // eslint-disable-next-line react/no-array-index-key
        <span className="dl-word" key={`${text}-${wordIndex}`} aria-hidden="true">
          {word.map((_, charIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <span className="dl-ch" key={charIndex} />
          ))}
        </span>
      ))}
    </h1>
  );
};

export default ScrambleTitle;
