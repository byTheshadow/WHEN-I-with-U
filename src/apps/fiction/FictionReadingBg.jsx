// src/apps/fiction/FictionReadingBg.jsx
//
// 游玩页的上传背景层：图 -> 模糊 -> 盖一层阅读主题的纸色（压暗）。
// 文字颜色仍由阅读主题决定，这一层只管背景。
// 没有背景图时什么都不渲染。

import React from 'react';

import './fictionReadingBg.css';

const FictionReadingBg = ({ background }) => {
  if (!background) return null;

  return (
    <div
      className="fic-bg"
      aria-hidden="true"
      style={{
        '--fic-bg-dim': background.dim / 100,
        '--fic-bg-blur': `${background.blur}px`,
      }}
    >
      <div className="fic-bg-img" style={{ backgroundImage: `url("${background.url}")` }} />
      <div className="fic-bg-dim" />
    </div>
  );
};

export default FictionReadingBg;