// src/apps/messages/secretCode/SecretCodeSettingsSection.jsx
//
// 聊天设置里的"悄悄话词典"入口卡片：只显示条数和文件夹数，点"打开"进入
// 全屏的文件夹柜（SecretCodeCabinet）。词典存在角色记录上，同一个角色的
// 所有聊天窗共用，所以卡片上明确写了"所有聊天窗共用"。
//
// 通过 onUpdated 通知外层 ChatSettingsModal 刷新（外层传的是
// onUpdatedUserPersona，它会自己重新拉取数据，不需要这里关心参数）。
import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { SECRET_CODE_LIMITS, getSecretCodeBook } from './secretCodeService';
import SecretCodeCabinet from './SecretCodeCabinet';

export const SecretCodeSettingsSection = ({ character, onUpdated }) => {
  const characterId = character?.id;
  const characterName = character?.name || '角色';

  const [stats, setStats] = useState({ entries: 0, folders: 0 });
  const [isOpen, setIsOpen] = useState(false);

  const refreshStats = useCallback(async () => {
    const book = await getSecretCodeBook(characterId);
    // "未分类"是自动存在的，不算用户建的文件夹
    setStats({
      entries: book.entries.length,
      folders: book.folders.filter((folder) => !folder.uncat).length,
    });
  }, [characterId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const book = await getSecretCodeBook(characterId);
      if (cancelled) return;
      setStats({
        entries: book.entries.length,
        folders: book.folders.filter((folder) => !folder.uncat).length,
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const handleCabinetUpdated = (patch) => {
    if (patch && Array.isArray(patch.secretCodes)) {
      setStats({
        entries: patch.secretCodes.length,
        folders: Array.isArray(patch.secretCodeFolders)
          ? patch.secretCodeFolders.filter((folder) => !folder.uncat).length
          : 0,
      });
    }
    if (onUpdated) onUpdated(patch);
  };

  const handleClose = () => {
    setIsOpen(false);
    void refreshStats();
  };

  return (
    <div
      className="space-y-2.5 p-3.5 rounded-2xl border w-full"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold">
          <KeyRound className="w-3.5 h-3.5" />
          <span>悄悄话词典</span>
        </div>
        <span className="font-mono text-[9px] opacity-45">
          {stats.entries}/{SECRET_CODE_LIMITS.MAX_ENTRIES}
        </span>
      </div>

      <p className="text-[10px] opacity-55 leading-relaxed">
        你和{characterName}之间的专属约定：一个很短的暗号，对应一句话的含义。
        {characterName}会在合适的时候用暗号代替长句，历史越长越省。
        这本词典属于这个角色，TA 的所有聊天窗共用。
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] opacity-45">
          {stats.entries === 0
            ? '还没有暗号'
            : `${stats.entries} 条暗号 · ${stats.folders} 个文件夹`}
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="shrink-0 px-3.5 py-2 rounded-lg border text-[11px] font-medium active:scale-95"
          style={{
            background: 'var(--accent-color)',
            borderColor: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
          }}
        >
          打开词典
        </button>
      </div>

      {isOpen && (
        <SecretCodeCabinet
          character={character}
          onClose={handleClose}
          onUpdated={handleCabinetUpdated}
        />
      )}
    </div>
  );
};

export default SecretCodeSettingsSection;
