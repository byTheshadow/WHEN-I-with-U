// src/components/WinterMirrorLoader.jsx
//
// 十一月限定加载页（冬日镜子小屋）。一面起雾的镜子，雾像烟一样慢慢沉下去，
// 露出镜中一间亮灯的小木屋和初雪；镜子周围浮着几行歌词式的字。
// 固定的深冬夜配色（见 winter-mirror-loader.css 顶部说明），外层深色背景由
// Preloader.jsx 的 LOADER_MAP 提供。整段动画约 8 秒，Preloader 对这一款单独
// 延长了淡出时间（fadeMs / finishMs）。

import React from 'react';
import './winter-mirror-loader.css';

// 镜子周围慢慢浮起的光斑
const MOTES = [
  { x: '6%', y: '30%', s: '1.6rem', b: '3px', c: 'iris', dur: '9s', delay: '1.2s', sway: '1rem', o: '.5' },
  { x: '86%', y: '22%', s: '1rem', b: '2px', c: 'ice', dur: '8s', delay: '2.4s', sway: '-0.8rem' },
  { x: '90%', y: '58%', s: '2.2rem', b: '5px', c: 'rose', dur: '11s', delay: '1.8s', sway: '-1.2rem', o: '.45' },
  { x: '10%', y: '66%', s: '0.7rem', b: '1px', c: 'snow', dur: '7s', delay: '3.1s', sway: '0.6rem' },
  { x: '78%', y: '78%', s: '0.9rem', b: '1px', c: 'accent', dur: '8.5s', delay: '4s', sway: '0.9rem', z: 12 },
  { x: '16%', y: '84%', s: '2.8rem', b: '8px', c: 'ice', dur: '12s', delay: '2.8s', sway: '1.4rem', o: '.35', z: 12 },
  { x: '50%', y: '6%', s: '0.6rem', b: '1px', c: 'snow', dur: '7.5s', delay: '3.6s', sway: '-0.5rem' },
];

// 镜子外面几缕往下落的烟
const WISPS = [
  { x: '2%', w: '8rem', dur: '12s', delay: '0.6s', sway: '1.5rem', o: '.55' },
  { x: '58%', w: '9rem', dur: '14s', delay: '3.2s', sway: '-1.8rem', o: '.5' },
  { x: '28%', w: '11rem', dur: '16s', delay: '6.5s', sway: '1rem', o: '.35', z: 12 },
];

const STARS = [
  { x: '22%', y: '16%', delay: '1.3s' },
  { x: '36%', y: '9%', delay: '1.9s' },
  { x: '50%', y: '21%', delay: '1.6s' },
  { x: '28%', y: '30%', delay: '2.3s' },
  { x: '60%', y: '8%', delay: '2.0s' },
  { x: '42%', y: '36%', delay: '2.6s' },
];

const BACK_TREES = [
  { x: '14%', y: '29%', k: 0.62, delay: '1.35s' },
  { x: '22%', y: '31%', k: 0.48, delay: '1.45s' },
  { x: '76%', y: '30%', k: 0.55, delay: '1.5s' },
];

const FRONT_TREES = [
  { x: '19%', y: '13%', k: 1.05, delay: '1.6s' },
  { x: '73%', y: '15%', k: 0.9, delay: '1.7s' },
  { x: '82%', y: '11%', k: 1.15, delay: '1.8s' },
];

const FLAKES = [
  { x: '8%', size: '0.22rem', delay: '2.0s', dur: '6.4s', drift: '0.9rem' },
  { x: '16%', size: '0.16rem', delay: '3.1s', dur: '7.2s', drift: '-0.6rem' },
  { x: '24%', size: '0.28rem', delay: '2.4s', dur: '5.6s', drift: '0.7rem' },
  { x: '31%', size: '0.14rem', delay: '3.8s', dur: '7.8s', drift: '1.1rem' },
  { x: '39%', size: '0.2rem', delay: '2.2s', dur: '6.1s', drift: '-0.8rem' },
  { x: '47%', size: '0.32rem', delay: '3.4s', dur: '5.2s', drift: '0.5rem' },
  { x: '54%', size: '0.17rem', delay: '2.7s', dur: '7.0s', drift: '-1.0rem' },
  { x: '61%', size: '0.24rem', delay: '4.1s', dur: '6.3s', drift: '0.8rem' },
  { x: '68%', size: '0.15rem', delay: '2.1s', dur: '7.5s', drift: '-0.5rem' },
  { x: '75%', size: '0.27rem', delay: '3.0s', dur: '5.8s', drift: '0.6rem' },
  { x: '82%', size: '0.18rem', delay: '3.6s', dur: '6.8s', drift: '-0.9rem' },
  { x: '89%', size: '0.22rem', delay: '2.5s', dur: '6.0s', drift: '-0.4rem' },
  { x: '35%', size: '0.12rem', delay: '4.6s', dur: '8.2s', drift: '0.4rem' },
  { x: '71%', size: '0.13rem', delay: '4.9s', dur: '8.0s', drift: '-0.7rem' },
];

// 歌词式文字：每个字母从 start 起每隔 0.08s 凝结出来
const LYRICS = [
  { id: 'when', text: 'When', start: 2.9, floatDelay: '4.4s' },
  { id: 'snow', text: 'the first snow', start: 3.45, floatDelay: '4.95s' },
  { id: 'falls', text: 'falls,', start: 4.05, floatDelay: '5.55s' },
  { id: 'i', text: 'I', start: 4.65, floatDelay: '6.15s' },
  { id: 'am', text: 'am', start: 5.05, floatDelay: '6.55s' },
  { id: 'with', text: 'with U.', start: 5.5, floatDelay: '7.0s', underline: true },
];

const CHAR_STEP = 0.08;

const toStyle = (vars) => {
  const style = {};
  Object.entries(vars).forEach(([key, value]) => {
    if (value !== undefined) style[`--${key}`] = value;
  });
  return style;
};

export const WinterMirrorLoader = () => {
  return (
    <section
      className="winter-loader"
      role="img"
      aria-label="薄雾沿着起雾的镜面缓缓下沉，露出一间亮着灯的小木屋，窗外落下初雪"
    >
      <div className="winter-loader__aura" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      {MOTES.map((mote, index) => (
        <span
          key={`mote-${index}`}
          className="winter-loader__mote"
          style={toStyle({
            x: mote.x,
            y: mote.y,
            s: mote.s,
            b: mote.b,
            c: `var(--wl-${mote.c})`,
            dur: mote.dur,
            delay: mote.delay,
            sway: mote.sway,
            o: mote.o,
            z: mote.z,
          })}
        />
      ))}

      {WISPS.map((wisp, index) => (
        <span
          key={`wisp-${index}`}
          className="winter-loader__wisp"
          style={toStyle({
            x: wisp.x,
            w: wisp.w,
            dur: wisp.dur,
            delay: wisp.delay,
            sway: wisp.sway,
            o: wisp.o,
            z: wisp.z,
          })}
        />
      ))}

      <div className="winter-loader__stage">
        <div className="winter-loader__pool" />

        <div className="winter-loader__float">
          <div className="winter-loader__mirror">
            <div className="winter-loader__rim" />

            <div className="winter-loader__glass">
              <div className="winter-loader__veil winter-loader__veil--a" />
              <div className="winter-loader__veil winter-loader__veil--b" />

              {STARS.map((star, index) => (
                <span
                  key={`star-${index}`}
                  className="winter-loader__star"
                  style={toStyle(star)}
                />
              ))}

              <div className="winter-loader__moon" />
              <div className="winter-loader__hills" />

              {BACK_TREES.map((tree, index) => (
                <span
                  key={`back-tree-${index}`}
                  className="winter-loader__tree winter-loader__tree--back"
                  style={toStyle(tree)}
                />
              ))}

              <div className="winter-loader__ground" />
              <div className="winter-loader__fence" />

              <div className="winter-loader__cabin">
                <span className="winter-loader__chimney" />
                <span className="winter-loader__smoke">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="winter-loader__roof" />
                <span className="winter-loader__roof-snow" />
                <span className="winter-loader__attic" />
                <span className="winter-loader__body">
                  <span className="winter-loader__window" />
                  <span className="winter-loader__door" />
                  <span className="winter-loader__window winter-loader__window--b" />
                </span>
                <span className="winter-loader__lantern" />
                <span className="winter-loader__glow" />
              </div>

              {FRONT_TREES.map((tree, index) => (
                <span
                  key={`front-tree-${index}`}
                  className="winter-loader__tree winter-loader__tree--front"
                  style={toStyle(tree)}
                />
              ))}

              {FLAKES.map((flake, index) => (
                <span
                  key={`flake-${index}`}
                  className="winter-loader__flake"
                  style={toStyle(flake)}
                />
              ))}

              <div className="winter-loader__lowmist" />
              <div className="winter-loader__fog" />
              <div className="winter-loader__frost" />
              <div className="winter-loader__mist">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="winter-loader__breath" />

              <div className="winter-loader__grain" />
              <div className="winter-loader__sheen" />
              <div className="winter-loader__shine" />
            </div>
          </div>
        </div>
      </div>

      <div className="winter-loader__lyrics" aria-hidden="true">
        {LYRICS.map((line) => (
          <p
            key={line.id}
            className={`winter-loader__lyric winter-loader__lyric--${line.id}`}
            style={toStyle({ 'float-delay': line.floatDelay })}
          >
            {Array.from(line.text).map((char, index) => (
              <span
                key={index}
                className="winter-loader__char"
                style={toStyle({ d: `${(line.start + index * CHAR_STEP).toFixed(2)}s` })}
              >
                {char === ' ' ? ' ' : char}
              </span>
            ))}
            {line.underline && (
              <svg
                className="winter-loader__underline"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M2 6 C 22 2, 38 9, 58 5 S 88 3, 98 6" />
              </svg>
            )}
          </p>
        ))}
      </div>
    </section>
  );
};

export default WinterMirrorLoader;