// src/apps/layoutstudio/LayoutStepFinish.jsx
// 第 4 步：成品。切片 A 只有"保存到设备"；
// 角色的话、存相册、摘要发回聊天室会在后续切片接上。

import React from 'react';
import { Download, Images, RotateCcw, Send } from 'lucide-react';

const LayoutStepFinish = ({ resultUrl, charName, saved, onSave, onRestart }) => (
  <>
    <h2 className="ls-q">修好了</h2>
    <p className="ls-g">先保存下来。{charName} 的想法、相册和发回聊天室，会在后面的版本里接上。</p>

    <div className="ls-res">{resultUrl && <img src={resultUrl} alt="修好的图片" />}</div>

    <div className="ls-sect">接下来</div>
    <button
      type="button"
      className={`ls-card ls-act ls-hl${saved ? ' ls-done' : ''}`}
      onClick={onSave}
    >
      <span className="ls-ic">
        <Download size={19} />
      </span>
      <span>
        <b>{saved ? '已保存，可以再存一次' : '保存到设备'}</b>
        <small>导出为一张 PNG 图片</small>
      </span>
    </button>
    <button type="button" className="ls-card ls-act" disabled>
      <span className="ls-ic">
        <Images size={19} />
      </span>
      <span>
        <b>存进相册</b>
        <small>稍后开放</small>
      </span>
    </button>
    <button type="button" className="ls-card ls-act" disabled>
      <span className="ls-ic">
        <Send size={19} />
      </span>
      <span>
        <b>把摘要发回聊天室</b>
        <small>稍后开放</small>
      </span>
    </button>
    <button type="button" className="ls-card ls-act" onClick={onRestart}>
      <span className="ls-ic">
        <RotateCcw size={19} />
      </span>
      <span>
        <b>再修一张</b>
        <small>回到第一步，换照片或换角色</small>
      </span>
    </button>
  </>
);

export default LayoutStepFinish;
