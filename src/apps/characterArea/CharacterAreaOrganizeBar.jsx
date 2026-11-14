import React, { useState } from 'react';
import { runPrivateAreaSession } from './privateAreaSession';

// ============================================================
// 区域页里的"整理一下"按钮（切片 C）：区域已经存在时，用户随时可以手动让
// 角色整理一次。整理的结果直接写进条目列表（列表自己监听更新事件刷新），
// 这里只负责按钮和一行结果提示。
// ============================================================

const softBorder = 'color-mix(in srgb, var(--text-main) 14%, transparent)';

const NOTICE_TEXT = {
  nothing: 'TA 这次没有想写的。',
  failed: '这次没有成功（可能是接口还没配置，或者网络出了问题），可以再试一次。',
};

const getNoticeText = (result) => {
  if (result.status === 'organized' || result.status === 'created') {
    return result.entriesAdded > 0 ? `TA 写了 ${result.entriesAdded} 条新的。` : NOTICE_TEXT.nothing;
  }

  return NOTICE_TEXT[result.status] || NOTICE_TEXT.failed;
};

export default function CharacterAreaOrganizeBar({ chatId, character }) {
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const handleOrganize = async () => {
    if (isBusy) return;

    setIsBusy(true);
    setNotice('');

    const result = await runPrivateAreaSession({ chatId, character, source: 'manual' });

    setNotice(getNoticeText(result));
    setIsBusy(false);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleOrganize}
        disabled={isBusy}
        className="rounded-full border px-5 py-2 text-sm transition-transform active:scale-95 disabled:opacity-60"
        style={{
          color: 'var(--text-main)',
          background: 'var(--card-bg)',
          borderColor: softBorder,
        }}
      >
        {isBusy ? 'TA 正在整理……' : '整理一下'}
      </button>

      {notice ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {notice}
        </p>
      ) : null}
    </div>
  );
}