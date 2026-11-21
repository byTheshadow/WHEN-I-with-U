// src/apps/focus/FocusNoteNotice.jsx
//
// 聊天里的角色小纸条：居中一张小字条，和专注记录的小药丸同一个视觉语言，
// 但多一行标题和正文。不可点击，不需要回复。

import React from 'react';
import { getFocusNoteLabel } from './focusNoteDescribe';

const FocusNoteNotice = ({ message }) => {
  const label = getFocusNoteLabel(message?.metadata?.kind);
  const text = String(message?.content || '');

  return (
    <div className="my-2 flex justify-center px-6">
      <div
        className="max-w-[78%] rounded-2xl px-4 py-3 text-center"
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
          border: '1px solid var(--divider)',
        }}
      >
        <div className="mb-1 text-[10.5px]" style={{ opacity: 0.55, letterSpacing: '0.12em' }}>
          {label}
        </div>
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ opacity: 0.88 }}>
          {text}
        </div>
      </div>
    </div>
  );
};

export default FocusNoteNotice;
