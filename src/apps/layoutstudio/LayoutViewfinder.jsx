// src/apps/layoutstudio/LayoutViewfinder.jsx
//
// 相机取景框：四层内容叠在一起，按当前步骤显示其中一层。
//   1 镜头头像 + 角色的话   2 主图预览   3 出图画布   4 拍立得
// 画布（LayoutCanvas）始终挂载，外面要随时能用 canvasRef 取到真实 canvas。
// 这个组件只负责展示，所有数据和操作都从外面传进来。

import React, { useState } from 'react';
import { Plus, Shuffle } from 'lucide-react';

import LayoutCanvas from './LayoutCanvas';
import LayoutMainPreview from './LayoutMainPreview';
import LayoutPolaroid from './LayoutPolaroid';
import { MAX_PHOTOS } from './layoutConstants';
import { charExif, charExifLine, charInitial } from './layoutCharStyle';
import useTypewriter from './useTypewriter';

const MODE_NAMES = ['选人', '装片', '拍摄', '回看'];
const pad2 = (n) => String(n).padStart(2, '0');

const LayoutViewfinder = ({
  step,
  character,
  charName,
  tint,
  photos,
  spec,
  templateLabel,
  canvasRef,
  playKey,
  onPlayEnd,
  busy,
  thinking,
  thinkText,
  snap,
  visionReady,
  onVisionClick,
  onPickFile,
  onAddFiles,
  onEdit,
  onReroll,
  onFinish,
  resultUrl,
  notes,
  notesLoading,
}) => {
  const [focus, setFocus] = useState(null);
  const [over, setOver] = useState(false);

  const hasResult = Boolean(spec);
  const greet = character
    ? `好，就让 ${charName} 来修。按快门继续。`
    : '在下面挑一枚镜头。每枚镜头是一位修图师，口味不一样。';
  const typed = useTypewriter(greet, { speed: 32, active: step === 1 });

  let hudFrame = '';
  if (step === 1) hudFrame = character ? charExif(character).lens : '';
  else if (step === 2) hudFrame = `${pad2(photos.length)}/${pad2(MAX_PHOTOS)}`;
  else if (step === 3) {
    if (thinking) hudFrame = 'AF...';
    else if (busy) hudFrame = '显影中';
    else hudFrame = hasResult ? templateLabel : 'READY';
  } else hudFrame = 'PRINT';

  const handlePointerDown = (e) => {
    if (step === 4 || e.target.closest('button,.ls-pola')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setFocus({ x: e.clientX - rect.left, y: e.clientY - rect.top, k: Date.now() });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (step === 2) setOver(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setOver(false);
    if (step === 2 && e.dataTransfer?.files?.length) onAddFiles(e.dataTransfer.files);
  };

  const sideVisible = step === 3 && hasResult && !busy;

  return (
    <section
      className={`ls-vf${busy ? ' ls-busy' : ''}${over ? ' ls-over' : ''}${snap ? ' ls-snap' : ''}${
        hasResult ? ' ls-done' : ''
      }`}
      data-step={step}
      onPointerDown={handlePointerDown}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      {/* 第 1 层：镜头头像 */}
      <div className={`ls-ly${step === 1 ? ' ls-on' : ''}`} data-step="1">
        <div className="ls-l1">
          <div
            key={character ? character.id : 'none'}
            className={`ls-portrait${character ? ' ls-pull' : ' ls-empty'}`}
            style={{ '--tint': tint }}
          >
            <div className="ls-ring" />
            <div className="ls-pin">{character ? charInitial(character) : '?'}</div>
          </div>
          <div className="ls-say">
            <small>{character ? charName : '修图师'}</small>
            <span className={typed.typing ? 'ls-caret' : ''}>{typed.shown}</span>
          </div>
        </div>
      </div>

      {/* 第 2 层：主图预览 */}
      <div className={`ls-ly${step === 2 ? ' ls-on' : ''}`} data-step="2">
        {photos[0] ? (
          <div className="ls-pw2" key={photos[0].id}>
            <LayoutMainPreview photo={photos[0]} />
            <span className="ls-maintag">主图</span>
          </div>
        ) : (
          <button type="button" className="ls-empty2" disabled={busy} onClick={onPickFile}>
            <Plus size={40} />
            <b>装入照片</b>
            <span>
              点这里，或者把照片拖进取景框
              <br />
              最多 {MAX_PHOTOS} 张，第一张是主图
            </span>
          </button>
        )}
      </div>

      {/* 第 3 层：出图画布 */}
      <div
        className={`ls-ly${step === 3 ? ' ls-on' : ''}${hasResult ? '' : ' ls-idle'}${
          thinking ? ' ls-thinking' : ''
        }`}
        data-step="3"
      >
        <div className="ls-shot">
          <LayoutCanvas
            ref={canvasRef}
            photos={photos}
            spec={spec}
            playKey={playKey}
            onPlayEnd={onPlayEnd}
          />
          <div className="ls-ov3 ls-ov-idle">
            <div className="ls-cross" />
            <b>对准了</b>
            <span>按下快门，让 {charName} 来修</span>
          </div>
          <div className="ls-ov3 ls-ov-think">
            <b>{thinkText || `${charName} 正在想`}</b>
            <span className="ls-dots">
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="ls-fbox" />
        </div>
      </div>

      {/* 第 4 层：拍立得 */}
      <div className={`ls-ly${step === 4 ? ' ls-on' : ''}`} data-step="4">
        <LayoutPolaroid
          active={step === 4}
          resultUrl={resultUrl}
          charName={charName}
          templateLabel={templateLabel}
          notes={notes}
          notesLoading={notesLoading}
        />
      </div>

      {/* 取景框装饰 */}
      <div className="ls-grid" />
      <i className="ls-bk ls-bk-a" />
      <i className="ls-bk ls-bk-b" />
      <i className="ls-bk ls-bk-c" />
      <i className="ls-bk ls-bk-d" />
      <div className="ls-grain" />

      <div className="ls-hud">
        <div className="ls-hud-l">
          <i className="ls-rec" />
          <span>{MODE_NAMES[step - 1]}</span>
        </div>
        <div className="ls-hud-r">
          <span>{hudFrame}</span>
          <button
            type="button"
            className={`ls-vis${visionReady ? '' : ' ls-off'}`}
            onClick={onVisionClick}
          >
            {`视觉 ${visionReady ? 'ON' : 'OFF'}`}
          </button>
        </div>
      </div>
      <div className="ls-hudb">{charExifLine(character)}</div>

      <div className="ls-side">
        <button type="button" disabled={!sideVisible} onClick={onEdit} aria-label="改字和排布">
          Aa
        </button>
        <button type="button" disabled={!sideVisible} onClick={onReroll} aria-label="重新排布">
          <Shuffle size={17} />
        </button>
      </div>
      <button type="button" className="ls-pill" disabled={!sideVisible} onClick={onFinish}>
        {`冲洗好了，听 ${charName} 怎么说`}
      </button>

      {focus ? (
        <div key={focus.k} className="ls-focus" style={{ left: focus.x, top: focus.y }} />
      ) : null}
      <div className="ls-iris" />
      <div className="ls-flash" />
    </section>
  );
};

export default LayoutViewfinder;
