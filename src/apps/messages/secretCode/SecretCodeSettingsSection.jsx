// src/apps/messages/secretCode/SecretCodeSettingsSection.jsx
//
// 聊天设置里的"专属暗号词典"区块：列出当前角色的所有暗号，可以手动
// 添加、编辑、删除。词典存在角色记录上（character.secretCodes），同一个
// 角色的所有聊天窗共用，所以界面上明确写了"所有聊天窗共用"。
//
// 写法照抄 LearningModeSettingsSection.jsx：自己持有状态、自己读写 db，
// 通过 onUpdated 通知外层 ChatSettingsModal 刷新（外层传的是
// onUpdatedUserPersona，它会自己重新拉取数据，不需要这里关心参数）。
// 删除按钮始终可见（不依赖鼠标悬停），并且有确认弹窗。
import React, { useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import {
  SECRET_CODE_LIMITS,
  getSecretCodes,
  addSecretCode,
  updateSecretCode,
  deleteSecretCode,
} from './secretCodeService';

const inputStyle = {
  background: 'var(--bg-main)',
  borderColor: 'var(--divider)',
  color: 'var(--text-main)',
};

export const SecretCodeSettingsSection = ({ character, onUpdated }) => {
  const characterId = character?.id;

  const [entries, setEntries] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [newCode, setNewCode] = useState('');
  const [newMeaning, setNewMeaning] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editCode, setEditCode] = useState('');
  const [editMeaning, setEditMeaning] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const list = await getSecretCodes(characterId);
      if (!cancelled) setEntries(list);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const applyResult = (result) => {
    setEntries(result.entries);
    if (onUpdated) onUpdated({ secretCodes: result.entries });
  };

  const handleAdd = async () => {
    if (!characterId || isBusy) return;

    setIsBusy(true);
    setErrorText('');

    try {
      const result = await addSecretCode(characterId, {
        code: newCode,
        meaning: newMeaning,
      });

      if (!result.ok) {
        setErrorText(result.reason);
        return;
      }

      applyResult(result);
      setNewCode('');
      setNewMeaning('');
    } finally {
      setIsBusy(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditCode(item.code);
    setEditMeaning(item.meaning);
    setErrorText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setErrorText('');
  };

  const handleSaveEdit = async () => {
    if (!characterId || !editingId || isBusy) return;

    setIsBusy(true);
    setErrorText('');

    try {
      const result = await updateSecretCode(characterId, editingId, {
        code: editCode,
        meaning: editMeaning,
      });

      if (!result.ok) {
        setErrorText(result.reason);
        return;
      }

      applyResult(result);
      setEditingId(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!characterId || !deleteTarget || isBusy) return;

    setIsBusy(true);

    try {
      const result = await deleteSecretCode(characterId, deleteTarget.id);
      applyResult(result);
      if (editingId === deleteTarget.id) setEditingId(null);
      setDeleteTarget(null);
    } finally {
      setIsBusy(false);
    }
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
          <span>专属暗号词典</span>
        </div>
        <span className="font-mono text-[9px] opacity-45">
          {entries.length}/{SECRET_CODE_LIMITS.MAX_ENTRIES}
        </span>
      </div>

      <p className="text-[10px] opacity-55 leading-relaxed">
        你和{character?.name || '角色'}之间的专属约定：一个很短的暗号，对应一句话的含义。
        {character?.name || '角色'}会在合适的时候用暗号代替长句，历史越长越省。
        这本词典属于这个角色，TA 的所有聊天窗共用。
      </p>

      {entries.length === 0 && (
        <p className="text-[10px] opacity-45">还没有暗号，在下面添加第一个吧。</p>
      )}

      <div className="space-y-1.5">
        {entries.map((item) =>
          editingId === item.id ? (
            <div
              key={item.id}
              className="space-y-1.5 p-2 rounded-xl border"
              style={{ borderColor: 'var(--divider)', background: 'var(--bg-main)' }}
            >
              <input
                value={editCode}
                disabled={isBusy}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="暗号"
                className="w-full p-2 rounded-lg border text-[12px] font-mono"
                style={inputStyle}
              />
              <input
                value={editMeaning}
                disabled={isBusy}
                onChange={(e) => setEditMeaning(e.target.value)}
                placeholder="含义"
                className="w-full p-2 rounded-lg border text-[12px]"
                style={inputStyle}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleSaveEdit}
                  className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg border text-[11px] font-medium active:scale-95"
                  style={{
                    background: 'var(--accent-color)',
                    borderColor: 'var(--accent-color)',
                    color: 'var(--accent-foreground)',
                  }}
                >
                  <Check className="w-3 h-3" />
                  保存
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={cancelEdit}
                  className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg border text-[11px] font-medium active:scale-95"
                  style={inputStyle}
                >
                  <X className="w-3 h-3" />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-xl border"
              style={{ borderColor: 'var(--divider)', background: 'var(--bg-main)' }}
            >
              <span
                className="shrink-0 min-w-[2rem] px-2 py-1 rounded-lg text-center font-mono text-[12px] font-bold"
                style={{
                  background: 'var(--accent-color)',
                  color: 'var(--accent-foreground)',
                }}
              >
                {item.code}
              </span>
              <span className="flex-1 min-w-0 text-[11px] leading-snug break-words">
                {item.meaning}
              </span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => startEdit(item)}
                aria-label="编辑暗号"
                className="shrink-0 p-1.5 rounded-lg opacity-60 active:opacity-100"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setDeleteTarget(item)}
                aria-label="删除暗号"
                className="shrink-0 p-1.5 rounded-lg opacity-60 active:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        )}
      </div>

      <div className="space-y-1.5 pt-1">
        <p className="text-[10px] opacity-55">添加新暗号</p>
        <div className="flex items-center gap-2">
          <input
            value={newCode}
            disabled={isBusy}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="暗号"
            className="w-20 shrink-0 p-2 rounded-lg border text-[12px] font-mono"
            style={inputStyle}
          />
          <input
            value={newMeaning}
            disabled={isBusy}
            onChange={(e) => setNewMeaning(e.target.value)}
            placeholder="含义，比如：我想你了"
            className="flex-1 min-w-0 p-2 rounded-lg border text-[12px]"
            style={inputStyle}
          />
          <button
            type="button"
            disabled={isBusy || !newCode.trim() || !newMeaning.trim()}
            onClick={handleAdd}
            aria-label="添加暗号"
            className="shrink-0 p-2 rounded-lg border active:scale-95 disabled:opacity-40"
            style={{
              background: 'var(--accent-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] opacity-45 leading-relaxed">
          暗号最多 {SECRET_CODE_LIMITS.MAX_CODE_LENGTH} 个字符，用符号或文字都行，越短越省；
          不能有空格、方括号、竖线和 emoji。含义最多 {SECRET_CODE_LIMITS.MAX_MEANING_LENGTH} 个字。
        </p>
      </div>

      {errorText && (
        <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>
          {errorText}
        </p>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="删除暗号"
        message={
          deleteTarget
            ? `确定删除暗号「${deleteTarget.code}」吗？删除后不可恢复，角色之后也不会再用它。`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default SecretCodeSettingsSection;