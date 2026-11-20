// src/apps/fiction/FictionReadingFx.jsx
//
// 阅读主题的动态氛围层（雨夜的细雨、星空的星点）。
// 只负责渲染一层固定数量的小元素，动画全在 fictionReadingFx.css 里，
// 而且只用 transform 和 opacity。
//
// 元素的位置和节奏由固定的种子算出，每次进入游玩页都一样，不会每次渲染都在变。
// 主题没有动态效果、或用户把「动态效果」关了，就什么都不渲染（也就没有任何开销）。

import React, { useMemo } from 'react';

import { getReadingTheme } from './fictionReadingThemes';
import './fictionReadingFx.css';

const RAIN_COUNT = 16;
const STAR_COUNT = 18;

// 小型伪随机：同一个种子永远得到同一串数。
const createRandom = (seed) => {
  let state = seed;

  return () => {
    state = (state * 9301 + 49297) % 233280;

    return state / 233280;
  };
};

const buildItems = (kind) => {
  if (kind === 'rain') {
    const random = createRandom(7);

    return Array.from({ length: RAIN_COUNT }, () => ({
      '--x': `${(random() * 115 - 5).toFixed(1)}%`,
      '--len': `${(16 + random() * 18).toFixed(0)}px`,
      '--o': (0.55 + random() * 0.4).toFixed(2),
      '--d': `${(0.9 + random() * 0.9).toFixed(2)}s`,
      '--delay': `-${(random() * 2).toFixed(2)}s`,
    }));
  }

  if (kind === 'stars') {
    const random = createRandom(21);

    return Array.from({ length: STAR_COUNT }, () => ({
      '--x': `${(random() * 96 + 2).toFixed(1)}%`,
      '--y': `${(random() * 78 + 2).toFixed(1)}%`,
      '--s': `${(1.5 + random() * 1.8).toFixed(1)}px`,
      '--d': `${(2.6 + random() * 3.4).toFixed(1)}s`,
      '--delay': `-${(random() * 5).toFixed(1)}s`,
    }));
  }

  return [];
};

const FictionReadingFx = ({ themeId, motion }) => {
  const kind = getReadingTheme(themeId).fx || '';
  const items = useMemo(() => buildItems(kind), [kind]);

  if (!motion || items.length === 0) return null;

  return (
    <div className="fic-fx" data-kind={kind} aria-hidden="true">
      {items.map((style, index) => (
        <i key={index} className="fic-fx-item" style={style} />
      ))}
    </div>
  );
};

export default FictionReadingFx;