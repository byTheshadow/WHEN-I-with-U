// src/apps/stmemory/Snowflake.jsx
//
// 前尘的雪花：一片往事沉在冰下的样子。全 app 共用这一个组件，不要每页复制 svg。
//
//   <Snowflake size={76} arm="b" lit={3} />
//   <Snowflake size={210} arm="b" lit={3} hero />      主角：多一圈六边形环 + 模糊发光副本
//   <Snowflake size={76} arm="c" lit={0} deep />       纯文本往事：不亮、略模糊、沉得更深
//
// 需要页面里先渲染一次 <SnowflakeDefs />（QianchenBackdrop 已经带了）。
//
// 三层叠加：
//   .sh 底影（6 臂全画）   .dm 暗臂（未亮）   .lt 亮臂（已亮）   .co 中心六边形核心
import React from 'react';

const ARM_PATHS = {
  a: 'M0 0V-42M0 -14L-10 -25M0 -14L10 -25M0 -27L-7 -35M0 -27L7 -35',
  b: 'M0 0V-42M0 -12L-8 -20M0 -12L8 -20M0 -22L-12 -32M0 -22L12 -32M0 -34L-5 -39M0 -34L5 -39',
  c: 'M0 0V-42M0 -18L-11 -29M0 -18L11 -29M0 -30L-5 -36M0 -30L5 -36',
};

const CORE_RADIUS = { a: 6, b: 8, c: 5 };
const RING_RADIUS = 17;
const ARM_COUNT = 6;

// 亮几条臂时，具体亮哪几条（0 到 6 条）。臂 i 旋转 i x 60 度。
const LIT_SETS = [
  [],
  [0],
  [0, 3],
  [0, 2, 4],
  [0, 1, 3, 4],
  [0, 1, 2, 3, 4],
  [0, 1, 2, 3, 4, 5],
];

const ALL_ARMS = [0, 1, 2, 3, 4, 5];

const hexPoints = (r) => {
  const x = (r * 0.8660254).toFixed(1);
  const h = (r / 2).toFixed(1);
  return `0,${-r} ${x},${-h} ${x},${h} 0,${r} -${x},${h} -${x},-${h}`;
};

/** 按往事 id 做稳定哈希，挑一种雪花。同一个 id 永远是同一种。 */
export const pickArm = (id) => {
  const text = String(id ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return ['a', 'b', 'c'][hash % 3];
};

/** 总结进度 -> 亮几条臂：round(已总结 / 总批数 x 6)。没有总批数就一条不亮。 */
export const litArmsFor = (done, total) => {
  if (!(total > 0) || !(done > 0)) return 0;
  return Math.max(0, Math.min(ARM_COUNT, Math.round((done / total) * ARM_COUNT)));
};

export const SnowflakeDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
    <defs>
      {Object.entries(ARM_PATHS).map(([key, d]) => (
        <path key={key} id={`qc-arm-${key}`} d={d} />
      ))}
    </defs>
  </svg>
);

const Arms = ({ arm, indexes }) => indexes.map((i) => (
  <use
    key={i}
    href={`#qc-arm-${arm}`}
    transform={i === 0 ? undefined : `rotate(${i * 60})`}
  />
));

const Snowflake = ({
  size = 76,
  arm = 'b',
  lit = ARM_COUNT,
  hero = false,
  ringLit = false, // 封存页：只有中心那圈六边形环亮着
  deep = false,
  className = '',
}) => {
  const litCount = Math.max(0, Math.min(ARM_COUNT, Math.round(lit)));
  const litIdx = LIT_SETS[litCount];
  const dimIdx = ALL_ARMS.filter((i) => !litIdx.includes(i));

  // 线宽随尺寸自适应
  const lw = ((1.6 + size / 110) * 100) / size;
  const sw = lw * 1.8;
  const dw = lw * 0.75;
  const vars = { '--lw': lw, '--sw': sw, '--dw': dw };

  const ring = hero ? hexPoints(RING_RADIUS) : null;
  const wrapClass = ['flk-wrap', deep ? 'flk-deep' : '', className].filter(Boolean).join(' ');

  return (
    <span className={wrapClass} style={{ width: size, height: size }} aria-hidden="true">
      {hero && (litCount > 0 || ringLit) && (
        <svg
          className="flk flk-gl"
          width={size}
          height={size}
          viewBox="-50 -50 100 100"
          style={{ '--lw': 5 }}
        >
          <g className="lt">
            <Arms arm={arm} indexes={litIdx} />
            <polygon points={ring} />
          </g>
        </svg>
      )}
      <svg
        className="flk"
        width={size}
        height={size}
        viewBox="-50 -50 100 100"
        style={{ ...vars, position: 'relative' }}
      >
        <g className="sh">
          <Arms arm={arm} indexes={ALL_ARMS} />
          {ring && <polygon points={ring} />}
        </g>
        {dimIdx.length > 0 && (
          <g className="dm">
            <Arms arm={arm} indexes={dimIdx} />
            {ring && litCount === 0 && !ringLit && <polygon points={ring} />}
          </g>
        )}
        {litIdx.length > 0 && (
          <g className="lt">
            <Arms arm={arm} indexes={litIdx} />
            {ring && <polygon points={ring} />}
          </g>
        )}
        {ring && litIdx.length === 0 && ringLit && (
          <g className="lt"><polygon points={ring} /></g>
        )}
        <polygon className="co" points={hexPoints(CORE_RADIUS[arm] || CORE_RADIUS.b)} />
      </svg>
    </span>
  );
};

export default Snowflake;