import React, { useState } from 'react';
import { requestAreaStyle, STYLE_SOURCE_USER } from './characterAreaStyleSession';

// ============================================================
// 角色专属区域的外观相关小组件（切片 F1）。三个都很小，放在一个文件里：
//   - CharacterAreaThemeStyle：把主题生成的一小段作用域样式放进页面
//   - CharacterAreaCover：渲染封面。传进来的 html 必须是已经过
//     characterAreaCoverSanitizer 的结果（页面里用 resolveAreaCover 取）
//   - CharacterAreaStyleBar："请 TA 装饰/重新装饰"按钮。设计完成后
//     characterAreaStyleSession 会发事件，区域页自己重新读区域，所以这里
//     不需要把结果传回去
// ============================================================

const softBorder = 'color-mix(in srgb, var(--text-main) 14%, transparent)';

const NOTICE_TEXT = {
  styled: 'TA 换好了。',
  partial: '配色换好了，封面这次没画好，可以再试一次。',
  failed: '这次没有成功（可能是接口还没配置，或者网络出了问题），可以再试一次。',
};

export function CharacterAreaThemeStyle({ cssText }) {
  return cssText ? <style>{cssText}</style> : null;
}

export function CharacterAreaCover({ html }) {
  if (!html) return null;

  return (
    <section
      className="char-area-cover overflow-hidden rounded-3xl border"
      style={{
        position: 'relative',
        isolation: 'isolate',
        maxHeight: 320,
        background: 'var(--card-bg)',
        borderColor: softBorder,
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

export function CharacterAreaStyleBar({ chatId, character, area }) {
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const hasStyle = Boolean(area?.theme);

  const handleRestyle = async () => {
    if (isBusy) return;

    setIsBusy(true);
    setNotice('');

    const result = await requestAreaStyle({
      chatId,
      character,
      area,
      source: STYLE_SOURCE_USER,
    });

    if (result.status !== 'busy') setNotice(NOTICE_TEXT[result.status] || NOTICE_TEXT.failed);
    setIsBusy(false);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleRestyle}
        disabled={isBusy}
        className="rounded-full border px-5 py-2 text-sm transition-transform active:scale-95 disabled:opacity-60"
        style={{
          color: 'var(--text-main)',
          background: 'var(--card-bg)',
          borderColor: softBorder,
        }}
      >
        {isBusy ? 'TA 正在设计……' : hasStyle ? '请 TA 重新装饰' : '请 TA 装饰一下'}
      </button>

      {notice ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {notice}
        </p>
      ) : null}
    </div>
  );
}