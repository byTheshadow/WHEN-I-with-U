// src/apps/stmemory/StSourcePicker.jsx
//
// 选择导入来源：底部抽屉。推荐 SillyTavern 聊天记录（.jsonl），文本 / Markdown 是次要项。
// 放在 QianchenBackdrop 里面渲染，盖在库首页上面。
import React, { useEffect, useRef } from 'react';

import Snowflake from './Snowflake';

const Check = () => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

const StSourcePicker = ({ onClose, onPickJsonl, onPickText }) => {
  const fileInputRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    drawerRef.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFile = (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (picked) onPickJsonl(picked);
  };

  return (
    <>
      <button type="button" className="qc-scrim" aria-label="关闭" onClick={onClose} tabIndex={-1} />
      <div
        ref={drawerRef}
        className="qc-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qc-src-title"
      >
        <div className="grip" aria-hidden="true" />
        <h2 id="qc-src-title" className="hd serif">导入往事</h2>
        <p className="mute" style={{ margin: '4px 0 16px' }}>先选一下，你手上的是哪种记录。</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="glass qc-src main">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Snowflake size={56} arm="b" lit={6} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>SillyTavern 聊天记录</div>
                <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>.jsonl 文件</div>
              </div>
              <span className="chip chip-ink">推荐</span>
            </div>
            <div className="list">
              <div><Check />导入前可以清洗掉状态栏、思维链等多余内容</div>
              <div><Check />之后能分批生成总结，大幅节省 token</div>
              <div><Check />同一份聊天更新后，可以只追加新增部分</div>
            </div>
            <button
              type="button"
              className="btn btn-pri"
              style={{ width: '100%', marginTop: 14, minHeight: 48 }}
              onClick={() => fileInputRef.current?.click()}
            >
              选择 .jsonl 文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl,application/jsonl,application/x-ndjson,text/plain"
              className="vh"
              tabIndex={-1}
              onChange={handleFile}
            />
          </div>

          <button type="button" className="glass qc-src" onClick={onPickText}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Snowflake size={56} arm="c" lit={0} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>文本 / Markdown</div>
                <div className="mute" style={{ fontSize: 12, marginTop: 2 }}>粘贴文字，或选 .txt / .md 文件</div>
              </div>
              <svg className="ico mute" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, fontSize: 12, color: 'var(--sub)' }}>
              <svg className="ico" style={{ width: 14, height: 14 }} viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
              原文分块保存，暂不支持生成总结
            </div>
          </button>
        </div>

        <button type="button" className="btn-text" style={{ marginTop: 8 }} onClick={onClose}>取消</button>
      </div>
    </>
  );
};

export default StSourcePicker;
