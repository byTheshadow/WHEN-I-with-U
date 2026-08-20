import React, { useState } from 'react';
import { Calendar, Check, Plus, AlertCircle } from 'lucide-react';
import db from '../../../../db';

export const TodoProposalCard = ({ content, metadata, characterId }) => {
  const [isAdded, setIsAdded] = useState(false);

  // 解析 content/metadata
  const title = content || '未命名待办事项';
  const dueDateStr = metadata?.dueDate || '未定时间';
  const priority = metadata?.priority || 'normal';

  const handleConfirmAddTodo = async () => {
    try {
      const payload = {
        title,
        dueDate: new Date().toISOString().slice(0, 16),
        priority,
        category: 'AI建议',
        characterId: characterId || null,
        isCompleted: false,
        createdAt: new Date().toISOString()
      };

      delete payload.id;
      await db.todos.add(payload);
      setIsAdded(true);
    } catch (err) {
      console.error('Failed to add suggested todo:', err);
    }
  };

  return (
    <div
      className="rounded-2xl p-3.5 space-y-2 border text-left my-1 transition-all"
      style={{
        backgroundColor: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
          <Calendar className="w-3.5 h-3.5" />
          <span>伴侣建议的待办事项</span>
        </div>
        {priority === 'urgent' && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <AlertCircle className="w-2.5 h-2.5" /> 着急
          </span>
        )}
      </div>

      <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--text-main)' }}>
        {title}
      </p>

      <div className="flex items-center justify-between pt-1 border-t text-[10px] opacity-70" style={{ borderColor: 'var(--card-border)' }}>
        <span>预计提醒: {dueDateStr}</span>

        {isAdded ? (
          <span className="flex items-center gap-1 font-bold text-emerald-500">
            <Check className="w-3 h-3" /> 已加入待办
          </span>
        ) : (
          <button
            type="button"
            onClick={handleConfirmAddTodo}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold transition-transform active:scale-95 shadow-sm"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <Plus className="w-3 h-3" /> 添加至我的待办
          </button>
        )}
      </div>
    </div>
  );
};

export default TodoProposalCard;
