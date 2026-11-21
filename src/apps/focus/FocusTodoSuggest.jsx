// src/apps/focus/FocusTodoSuggest.jsx
//
// 设置页第二屏里的"待办里的事"：从待办取最多 5 条未完成的，今天到期和已逾期的在前。
// 点一条，把标题填进任务名（仍可修改）；再点一次取消。关联了角色的待办后面标出角色名。
// 没有可用的待办时什么都不显示。

import React, { useEffect, useState } from 'react';

import {
  clearPendingFocusTodo,
  loadFocusTodoSuggestions,
  setPendingFocusTodo,
} from './focusTodoLink';
import './focusTodo.css';

const MAX_TITLE_LENGTH = 40;

const formatDue = (item) => {
  if (item.due === 'overdue') return '已逾期';
  if (item.due === 'today') return '今天';
  if (item.due === 'later' && item.dueTime !== null) {
    const d = new Date(item.dueTime);
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }
  return '';
};

const FocusTodoSuggest = ({ task, onPick }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;

    loadFocusTodoSuggestions().then((list) => {
      if (active) setItems(list);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!items.length) return null;

  const current = String(task || '').trim();

  return (
    <div className="fg-todo">
      <div className="fg-todo-head">待办里的事</div>
      <div className="fg-todo-list">
        {items.map((item) => {
          const title = item.title.slice(0, MAX_TITLE_LENGTH);
          const on = current !== '' && current === title;
          const due = formatDue(item);

          return (
            <button
              key={item.id}
              type="button"
              className={`fg-todo-item${on ? ' is-on' : ''}${item.due === 'overdue' ? ' is-overdue' : ''}`}
              aria-pressed={on}
              onClick={() => {
                if (on) {
                  clearPendingFocusTodo();
                  onPick('');
                } else {
                  setPendingFocusTodo(item.id);
                  onPick(title);
                }
              }}
            >
              <span className="fg-todo-title">{title}</span>
              {(due || item.characterName) && (
                <span className="fg-todo-meta">
                  {[due, item.characterName].filter(Boolean).join(' · ')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FocusTodoSuggest;