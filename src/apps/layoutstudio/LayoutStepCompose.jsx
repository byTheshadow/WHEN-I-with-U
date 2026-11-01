// src/apps/layoutstudio/LayoutStepCompose.jsx
// 第 3 步：出图。让角色决定 / 自己选模板，出图后可微调文字。

import React from 'react';
import { LayoutTemplate, Sparkles } from 'lucide-react';

import LayoutCanvas from './LayoutCanvas';
import LayoutTweakPanel from './LayoutTweakPanel';
import { TEMPLATES } from './templates';

const LayoutStepCompose = ({
  canvasRef,
  photos,
  spec,
  playKey,
  busy,
  thinking,
  thinkText,
  charName,
  onDecide,
  onPick,
  onPlayEnd,
  onSpecChange,
  onReroll,
}) => {
  const hasResult = Boolean(spec);
  return (
    <>
      <h2 className="ls-q">开始修图</h2>
      <p className="ls-g">
        让 {charName} 自己决定，或者你自己挑一个模板。出图之后还可以改字。
      </p>

      <div className="ls-pills">
        {TEMPLATES.map((tpl) => (
          <span
            key={tpl.id}
            className={`ls-pill${hasResult && spec.templateId === tpl.id ? ' ls-on' : ''}`}
          >
            {tpl.label}
          </span>
        ))}
      </div>

      <div className={`ls-pw${hasResult ? '' : ' ls-idle'}${thinking ? ' ls-thinking' : ''}`}>
        <div className="ls-paper">
          <LayoutCanvas
            ref={canvasRef}
            photos={photos}
            spec={spec}
            playKey={playKey}
            onPlayEnd={onPlayEnd}
          />
          <div className="ls-ov ls-empty">
            还没出图<small>点下面的按钮开始</small>
          </div>
          <div className="ls-ov ls-think">
            <span>{thinkText || `${charName} 正在想`}</span>
            <span className="ls-dots">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </div>

      <div className="ls-row2">
        <button type="button" className="ls-big ls-main" disabled={busy} onClick={onDecide}>
          <Sparkles size={17} />
          <span>{hasResult ? `让 ${charName} 重来` : `让 ${charName} 决定`}</span>
        </button>
        <button type="button" className="ls-big ls-sub" disabled={busy} onClick={onPick}>
          <LayoutTemplate size={16} />
          我自己选
        </button>
      </div>

      {hasResult && (
        <LayoutTweakPanel
          spec={spec}
          disabled={busy}
          onChange={onSpecChange}
          onReroll={onReroll}
        />
      )}
    </>
  );
};

export default LayoutStepCompose;