// src/apps/focus/FocusRecordNotice.jsx
//
// 聊天里的专注记录：居中一条小药丸，和戳一戳、游戏结果提示是同一个视觉语言，
// 纯公告，不可点击。

import React from 'react';
import { describeFocusRecordForUser } from './focusRecordDescribe';

const FocusRecordNotice = ({ message }) => {
  const meta = message?.metadata;
  const text = meta ? describeFocusRecordForUser(meta) : String(message?.content || '');

  return (
    <div className="my-2 flex justify-center">
      <div
        className="rounded-full px-3 py-1 text-center text-[11px]"
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
          opacity: 0.75,
        }}
      >
        <span>{text}</span>
      </div>
    </div>
  );
};

export default FocusRecordNotice;
