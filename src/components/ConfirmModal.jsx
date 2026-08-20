import React from 'react';
import { AlertCircle } from 'lucide-react';

export const ConfirmModal = ({ isOpen, title, message, confirmText = '确定', cancelText = '取消', onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      {/* 极简高透蒙层，无灰块遮罩 */}
      <div className="fixed inset-0 backdrop-blur-md bg-white/5 dark:bg-black/5" onClick={onCancel} />

      <div
        className="relative w-full max-w-xs rounded-[2rem] p-5 space-y-4 shadow-2xl text-xs text-left z-10"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center gap-2 text-rose-500">
          <AlertCircle className="w-4 h-4" />
          <h4 className="font-bold text-sm font-serif">{title || '操作确认'}</h4>
        </div>

        <p className="opacity-80 leading-relaxed text-[11px]">{message}</p>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border text-center font-medium opacity-80 hover:opacity-100 transition-all"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--divider)'
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-rose-500 text-white font-semibold text-center hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
