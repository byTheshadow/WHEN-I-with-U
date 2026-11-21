// src/apps/focus/FocusTodoDone.jsx
//
// 结束页：这一轮如果是从待办里选的事，且是完成或提前结束（放弃不问），就问一句
// "要把这条待办标记为完成吗"。用户点了才改待办；不点就什么都不动。

import React, { useEffect, useState } from 'react';

import { getTodoToConfirm, markTodoCompleted } from './focusTodoLink';
import './focusTodo.css';

const FocusTodoDone = ({ session }) => {
  const [todo, setTodo] = useState(null);
  const [phase, setPhase] = useState('ask'); // ask | done | skipped
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    getTodoToConfirm(session).then((found) => {
      if (active) setTodo(found);
    });

    return () => {
      active = false;
    };
  }, [session]);

  if (!todo || phase === 'skipped') return null;

  if (phase === 'done') {
    return <p className="focus-hint focus-hint--center fg-todo-done">待办「{todo.title}」已标记完成。</p>;
  }

  const handleDone = async () => {
    setError('');
    try {
      await markTodoCompleted(todo.id);
      setPhase('done');
    } catch (markError) {
      console.warn('[focus] 标记待办完成失败:', markError);
      setError('没能标记成功，请到待办里手动勾选。');
    }
  };

  return (
    <section className="focus-block fg-todo-ask">
      <p className="fg-todo-ask-text">这一轮做的是待办「{todo.title}」，要把它标记为完成吗？</p>
      {error && <p className="focus-error" role="alert">{error}</p>}
      <div className="fg-todo-ask-actions">
        <button type="button" className="focus-main-btn" onClick={handleDone}>
          标记完成
        </button>
        <button type="button" className="focus-link" onClick={() => setPhase('skipped')}>
          还没做完
        </button>
      </div>
    </section>
  );
};

export default FocusTodoDone;