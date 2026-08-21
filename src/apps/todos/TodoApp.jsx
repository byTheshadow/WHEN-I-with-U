import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FolderOpen,
  MoreHorizontal,
  Pin,
  Plus,
  StickyNote,
  Tag,
  Trash2,
  User,
  X
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';

const UNGROUPED_LABEL = '未分组';

const formatDateTime = (value, fallback = '未记录时间') => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getMemoPreview = (memo) => {
  const content = memo.content?.trim() || '';
  const title = memo.title?.trim() || '';

  if (!title) {
    const [firstLine, ...restLines] = content.split('\n');
    return {
      heading: firstLine || '未命名留存',
      body: restLines.join(' ').trim()
    };
  }

  return {
    heading: title,
    body: content
  };
};

const normalizeMemo = (memo) => ({
  id: memo.id,
  title: memo.title || '',
  content: memo.content || '',
  group: memo.group?.trim() || UNGROUPED_LABEL,
  isPinned: Boolean(memo.isPinned),
  createdAt: memo.createdAt || memo.updatedAt || new Date().toISOString(),
  updatedAt: memo.updatedAt || memo.createdAt || new Date().toISOString()
});

const getPriorityLabel = (priority) => {
  if (priority === 'urgent') return '紧迫';
  if (priority === 'relaxed') return '不急';
  return '普通';
};

export const TodoApp = ({ onBackHub }) => {
  const [activeTab, setActiveTab] = useState('memos');
  const [todos, setTodos] = useState([]);
  const [memos, setMemos] = useState([]);
  const [characters, setCharacters] = useState([]);

  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [newCategory, setNewCategory] = useState('');
  const [newCharacterId, setNewCharacterId] = useState('');

  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [memoGroup, setMemoGroup] = useState('');
  const [editingMemo, setEditingMemo] = useState(null);

  const [deletingItem, setDeletingItem] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [todoList, characterList, memoSettings] = await Promise.all([
        db.todos.toArray(),
        db.characters.toArray(),
        db.settings.get('memos_list')
      ]);

      todoList.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      });

      setTodos(todoList);
      setCharacters(characterList);
      setMemos((memoSettings?.value || []).map(normalizeMemo));
    } catch (error) {
      console.error('Failed to load todo and memo data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const persistMemos = async (nextMemos) => {
    await db.settings.put({
      key: 'memos_list',
      value: nextMemos
    });
    setMemos(nextMemos.map(normalizeMemo));
  };

  const resetMemoForm = () => {
    setMemoTitle('');
    setMemoContent('');
    setMemoGroup('');
  };

  const handleAddTodo = async (event) => {
    event.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await db.todos.add({
        title: newTitle.trim(),
        dueDate: newDueDate || new Date().toISOString().slice(0, 16),
        priority: newPriority,
        category: newCategory.trim() || '未分类',
        characterId: newCharacterId ? Number(newCharacterId) : null,
        isCompleted: false,
        createdAt: new Date().toISOString()
      });

      setNewTitle('');
      setNewDueDate('');
      setNewPriority('normal');
      setNewCategory('');
      setNewCharacterId('');
      loadData();
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const handleToggleComplete = async (todo) => {
    try {
      await db.todos.update(todo.id, {
        isCompleted: !todo.isCompleted
      });
      loadData();
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const handleCreateMemo = async (event) => {
    event.preventDefault();
    if (!memoTitle.trim() && !memoContent.trim()) return;

    try {
      const now = new Date().toISOString();
      const nextMemo = {
        id: `memo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: memoTitle.trim(),
        content: memoContent.trim(),
        group: memoGroup.trim() || UNGROUPED_LABEL,
        isPinned: false,
        createdAt: now,
        updatedAt: now
      };

      await persistMemos([nextMemo, ...memos]);
      resetMemoForm();
    } catch (error) {
      console.error('Failed to create memo:', error);
    }
  };

  const openMemoEditor = (memo) => {
    setEditingMemo(normalizeMemo(memo));
  };

  const handleSaveMemo = async () => {
    if (!editingMemo) return;
    if (!editingMemo.title.trim() && !editingMemo.content.trim()) return;

    try {
      const nextMemos = memos.map((memo) =>
        memo.id === editingMemo.id
          ? {
              ...memo,
              title: editingMemo.title.trim(),
              content: editingMemo.content.trim(),
              group: editingMemo.group.trim() || UNGROUPED_LABEL,
              isPinned: Boolean(editingMemo.isPinned),
              updatedAt: new Date().toISOString()
            }
          : memo
      );

      await persistMemos(nextMemos);
      setEditingMemo(null);
    } catch (error) {
      console.error('Failed to save memo:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    try {
      if (deletingItem.type === 'todo') {
        await db.todos.delete(deletingItem.id);
      }

      if (deletingItem.type === 'memo') {
        const nextMemos = memos.filter((memo) => memo.id !== deletingItem.id);
        await persistMemos(nextMemos);

        if (editingMemo?.id === deletingItem.id) {
          setEditingMemo(null);
        }
      }

      setDeletingItem(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const todoSections = useMemo(() => {
    const activeTodos = todos.filter((todo) => !todo.isCompleted);
    const completedTodos = todos.filter((todo) => todo.isCompleted);
    const groups = new Map();

    activeTodos.forEach((todo) => {
      const groupName = todo.category?.trim() || '未分类';
      groups.set(groupName, [...(groups.get(groupName) || []), todo]);
    });

    return {
      activeGroups: [...groups.entries()],
      completedTodos
    };
  }, [todos]);

  const memoSections = useMemo(() => {
    const pinnedMemos = memos
      .filter((memo) => memo.isPinned)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const groups = new Map();

    memos
      .filter((memo) => !memo.isPinned)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .forEach((memo) => {
        const groupName = memo.group?.trim() || UNGROUPED_LABEL;
        groups.set(groupName, [...(groups.get(groupName) || []), memo]);
      });

    const sortedGroups = [...groups.entries()].sort(([nameA], [nameB]) => {
      if (nameA === UNGROUPED_LABEL) return 1;
      if (nameB === UNGROUPED_LABEL) return -1;
      return nameA.localeCompare(nameB, 'zh-CN');
    });

    return { pinnedMemos, groups: sortedGroups };
  }, [memos]);

  const renderTodoItem = (todo) => {
    const character = characters.find((item) => item.id === todo.characterId);

    return (
      <article
        key={todo.id}
        className="group flex items-start gap-3 border-b py-4 last:border-b-0"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          type="button"
          onClick={() => handleToggleComplete(todo)}
          aria-label={todo.isCompleted ? '标记为未完成' : '标记为已完成'}
          className="mt-0.5 shrink-0 transition-transform active:scale-90"
          style={{ color: 'var(--accent-color)' }}
        >
          {todo.isCompleted ? (
            <CheckCircle2 className="h-5 w-5" strokeWidth={1.8} />
          ) : (
            <Circle className="h-5 w-5" strokeWidth={1.8} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold leading-relaxed ${
              todo.isCompleted ? 'line-through opacity-50' : ''
            }`}
            style={{ color: 'var(--text-main)' }}
          >
            {todo.title}
          </h3>

          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatDateTime(todo.dueDate, '未设时间')}
            </span>

            {character && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {character.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="border px-2 py-1 text-[10px] font-semibold"
            style={{
              color: 'var(--text-sub)',
              borderColor: 'var(--card-border)',
              backgroundColor: 'var(--bg-surface)'
            }}
          >
            {getPriorityLabel(todo.priority)}
          </span>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDeletingItem({ type: 'todo', id: todo.id });
            }}
            aria-label={`删除待办：${todo.title}`}
            className="p-1 opacity-0 transition-opacity group-hover:opacity-60 focus:opacity-100"
            style={{ color: 'var(--text-main)' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </article>
    );
  };

  const renderMemoCard = (memo, index = 0) => {
    const preview = getMemoPreview(memo);
    const shapeClasses = [
      'rounded-[2rem_1.35rem_1.75rem_1.35rem]',
      'rounded-[1.25rem_2rem_1.35rem_1.85rem]',
      'rounded-[1.75rem_1.4rem_2rem_1.2rem]'
    ];

    return (
      <button
        key={memo.id}
        type="button"
        onClick={() => openMemoEditor(memo)}
        className={`group relative w-full border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] ${shapeClasses[index % shapeClasses.length]}`}
        style={{
          color: 'var(--text-main)',
          background: index % 2 === 0 ? 'var(--card-bg-gradient)' : 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <span
            className="inline-flex max-w-[70%] items-center gap-1.5 truncate text-[10px] font-bold tracking-[0.12em]"
            style={{ color: 'var(--text-muted)' }}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            {memo.group || UNGROUPED_LABEL}
          </span>

          <span
            className="shrink-0 text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatDateTime(memo.updatedAt)}
          </span>
        </div>

        <h3 className="pr-7 font-serif text-lg font-semibold leading-snug">
          {preview.heading}
        </h3>

        {preview.body && (
          <p
            className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed"
            style={{ color: 'var(--text-sub)' }}
          >
            {preview.body}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span
            className="text-[10px] font-medium tracking-[0.08em]"
            style={{ color: 'var(--text-muted)' }}
          >
            ARCHIVED NOTE
          </span>

          <MoreHorizontal
            className="h-4 w-4 opacity-45 transition-opacity group-hover:opacity-100"
            strokeWidth={1.7}
          />
        </div>
      </button>
    );
  };

  if (editingMemo) {
    return (
      <section className="animate-fade-in-up pb-8">
        <div className="mb-7 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setEditingMemo(null)}
            className="inline-flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-main)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            返回档案
          </button>

          <span
            className="text-[10px] font-bold tracking-[0.16em]"
            style={{ color: 'var(--text-muted)' }}
          >
            EDIT NOTE
          </span>
        </div>

        <div
          className="rounded-[2.2rem_1.5rem_2rem_1.65rem] border p-5 shadow-sm"
          style={{
            background: 'var(--card-bg-gradient)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <div
            className="mb-5 flex items-center justify-between border-b pb-4"
            style={{ borderColor: 'var(--divider)' }}
          >
            <div>
              <p
                className="text-[10px] font-bold tracking-[0.15em]"
                style={{ color: 'var(--text-muted)' }}
              >
                PRIVATE ARCHIVE
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-sub)' }}>
                最后修改于 {formatDateTime(editingMemo.updatedAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setEditingMemo((current) => ({
                  ...current,
                  isPinned: !current.isPinned
                }))
              }
              className="inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold transition-transform active:scale-95"
              style={{
                color: editingMemo.isPinned
                  ? 'var(--accent-foreground)'
                  : 'var(--text-main)',
                backgroundColor: editingMemo.isPinned
                  ? 'var(--accent-color)'
                  : 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              <Pin className="h-3.5 w-3.5" />
              {editingMemo.isPinned ? '已置顶' : '置顶'}
            </button>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span
                className="mb-2 block text-[10px] font-bold tracking-[0.14em]"
                style={{ color: 'var(--text-muted)' }}
              >
                标题 · 可选
              </span>
              <input
                value={editingMemo.title}
                onChange={(event) =>
                  setEditingMemo((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                placeholder="给这条留存起一个名字"
                className="w-full border-b bg-transparent py-2 font-serif text-xl font-semibold outline-none placeholder:opacity-35"
                style={{
                  color: 'var(--text-main)',
                  borderColor: 'var(--divider)'
                }}
              />
            </label>

            <label className="block">
              <span
                className="mb-2 block text-[10px] font-bold tracking-[0.14em]"
                style={{ color: 'var(--text-muted)' }}
              >
                归档主题
              </span>
              <div
                className="flex items-center gap-2 border-b py-2"
                style={{ borderColor: 'var(--divider)' }}
              >
                <Tag className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={editingMemo.group === UNGROUPED_LABEL ? '' : editingMemo.group}
                  onChange={(event) =>
                    setEditingMemo((current) => ({
                      ...current,
                      group: event.target.value
                    }))
                  }
                  placeholder="例如：灵感、生活、阅读摘录"
                  className="w-full bg-transparent text-sm outline-none placeholder:opacity-35"
                  style={{ color: 'var(--text-main)' }}
                />
              </div>
              <span className="mt-2 block text-[10px]" style={{ color: 'var(--text-muted)' }}>
                留空后将自动归入“未分组”。
              </span>
            </label>

            <label className="block">
              <span
                className="mb-2 block text-[10px] font-bold tracking-[0.14em]"
                style={{ color: 'var(--text-muted)' }}
              >
                内容
              </span>
              <textarea
                value={editingMemo.content}
                onChange={(event) =>
                  setEditingMemo((current) => ({
                    ...current,
                    content: event.target.value
                  }))
                }
                placeholder="写下想留住的事。"
                rows={13}
                className="w-full resize-none bg-transparent text-sm leading-7 outline-none placeholder:opacity-35"
                style={{ color: 'var(--text-main)' }}
              />
            </label>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
          <button
            type="button"
            onClick={handleSaveMemo}
            disabled={!editingMemo.title.trim() && !editingMemo.content.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-40"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <Check className="h-4 w-4" />
            保存修改
          </button>

          <button
            type="button"
            onClick={() => setDeletingItem({ type: 'memo', id: editingMemo.id })}
            aria-label="删除这条备忘录"
            className="rounded-2xl border px-4 transition-transform active:scale-95"
            style={{
              color: 'var(--text-main)',
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)'
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <ConfirmModal
          isOpen={Boolean(deletingItem)}
          title="确认删除这条备忘？"
          message="删除后，这条私人留存将永久从本地清除，无法恢复。"
          confirmText="彻底删除"
          cancelText="保留"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingItem(null)}
        />
      </section>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6 pb-10">
      <header className="flex items-start justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          返回主页
        </button>

        <div className="text-right">
          <p
            className="text-[10px] font-bold tracking-[0.2em]"
            style={{ color: 'var(--text-muted)' }}
          >
            PERSONAL SPACE
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold" style={{ color: 'var(--text-main)' }}>
            Life Notes
          </h2>
        </div>
      </header>

      <div
        className="flex border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('memos')}
          className="relative flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold transition-opacity"
          style={{
            color: activeTab === 'memos' ? 'var(--text-main)' : 'var(--text-muted)'
          }}
        >
          <StickyNote className="h-4 w-4" />
          备忘档案
          {activeTab === 'memos' && (
            <span
              className="absolute inset-x-5 bottom-0 h-0.5"
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('todos')}
          className="relative flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold transition-opacity"
          style={{
            color: activeTab === 'todos' ? 'var(--text-main)' : 'var(--text-muted)'
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          待办清单
          {activeTab === 'todos' && (
            <span
              className="absolute inset-x-5 bottom-0 h-0.5"
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
          )}
        </button>
      </div>

      {activeTab === 'memos' && (
        <section className="space-y-8">
          <form
            onSubmit={handleCreateMemo}
            className="rounded-[2rem_1.35rem_1.8rem_1.45rem] border p-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--card-border)'
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p
                  className="text-[10px] font-bold tracking-[0.16em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  NEW ENTRY
                </p>
                <h3 className="mt-1 font-serif text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
                  收进一则新的留存
                </h3>
              </div>
              <StickyNote className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
            </div>

            <div className="space-y-4">
              <input
                value={memoTitle}
                onChange={(event) => setMemoTitle(event.target.value)}
                placeholder="标题，可留空"
                className="w-full border-b bg-transparent py-2 font-serif text-base font-semibold outline-none placeholder:opacity-35"
                style={{
                  color: 'var(--text-main)',
                  borderColor: 'var(--divider)'
                }}
              />

              <textarea
                value={memoContent}
                onChange={(event) => setMemoContent(event.target.value)}
                rows={4}
                placeholder="写下一句灵感、一段记忆，或任何暂时不想忘记的事。"
                className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:opacity-40"
                style={{ color: 'var(--text-main)' }}
              />

              <div
                className="flex items-center gap-2 border-t pt-4"
                style={{ borderColor: 'var(--divider)' }}
              >
                <FolderOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={memoGroup}
                  onChange={(event) => setMemoGroup(event.target.value)}
                  placeholder="归档主题，例如：灵感、生活、阅读"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-45"
                  style={{ color: 'var(--text-main)' }}
                />
                <button
                  type="submit"
                  disabled={!memoTitle.trim() && !memoContent.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-40"
                  style={{
                    color: 'var(--accent-foreground)',
                    backgroundColor: 'var(--accent-color)'
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  留存
                </button>
              </div>
            </div>
          </form>

          {memos.length === 0 ? (
            <div
              className="rounded-[1.8rem] border px-6 py-14 text-center"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              <StickyNote
                className="mx-auto h-6 w-6"
                style={{ color: 'var(--text-muted)' }}
              />
              <p className="mt-4 font-serif text-base font-semibold" style={{ color: 'var(--text-main)' }}>
                这里还没有留存。
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                从一句闪念开始，把想记住的事放进自己的档案里。
              </p>
            </div>
          ) : (
            <>
              {memoSections.pinnedMemos.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Pin className="h-4 w-4" style={{ color: 'var(--text-main)' }} />
                    <h3 className="font-serif text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
                      置顶留存
                    </h3>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {memoSections.pinnedMemos.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {memoSections.pinnedMemos.map((memo, index) => renderMemoCard(memo, index))}
                  </div>
                </section>
              )}

              {memoSections.groups.map(([groupName, groupMemos]) => (
                <section key={groupName}>
                  <div
                    className="mb-4 flex items-end justify-between border-b pb-2"
                    style={{ borderColor: 'var(--divider)' }}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      <h3 className="font-serif text-lg font-semibold" style={{ color: 'var(--text-main)' }}>
                        {groupName}
                      </h3>
                    </div>

                    <span
                      className="text-[10px] font-bold tracking-[0.12em]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {String(groupMemos.length).padStart(2, '0')} NOTES
                    </span>
                  </div>

                  <div className="space-y-3">
                    {groupMemos.map((memo, index) => renderMemoCard(memo, index))}
                  </div>
                </section>
              ))}
            </>
          )}
        </section>
      )}

      {activeTab === 'todos' && (
        <section className="space-y-7">
          <form
            onSubmit={handleAddTodo}
            className="rounded-[2rem_1.4rem_1.8rem_1.4rem] border p-5"
            style={{
              background: 'var(--card-bg-gradient)',
              borderColor: 'var(--card-border)'
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <p
                className="text-[10px] font-bold tracking-[0.16em]"
                style={{ color: 'var(--text-muted)' }}
              >
                ADD A TASK
              </p>
            </div>

            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="写下一件准备完成的事"
              className="w-full border-b bg-transparent py-2 font-serif text-lg font-semibold outline-none placeholder:opacity-35"
              style={{
                color: 'var(--text-main)',
                borderColor: 'var(--divider)'
              }}
            />

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <label className="min-w-0">
                <span className="mb-1 flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <Clock3 className="h-3 w-3" />
                  时间
                </span>
                <input
                  type="datetime-local"
                  value={newDueDate}
                  onChange={(event) => setNewDueDate(event.target.value)}
                  className="w-full bg-transparent text-[11px] outline-none"
                  style={{ color: 'var(--text-main)' }}
                />
              </label>

              <label className="min-w-0">
                <span className="mb-1 flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <Tag className="h-3 w-3" />
                  分类
                </span>
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="例如：生活"
                  className="w-full border-b bg-transparent py-1 text-[11px] outline-none placeholder:opacity-40"
                  style={{
                    color: 'var(--text-main)',
                    borderColor: 'var(--divider)'
                  }}
                />
              </label>

              <label className="min-w-0">
                <span className="mb-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  紧急程度
                </span>
                <select
                  value={newPriority}
                  onChange={(event) => setNewPriority(event.target.value)}
                  className="w-full bg-transparent text-[11px] outline-none"
                  style={{ color: 'var(--text-main)' }}
                >
                  <option value="normal">普通</option>
                  <option value="urgent">紧迫</option>
                  <option value="relaxed">不急</option>
                </select>
              </label>

              <label className="min-w-0">
                <span className="mb-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  陪伴者
                </span>
                <select
                  value={newCharacterId}
                  onChange={(event) => setNewCharacterId(event.target.value)}
                  className="w-full bg-transparent text-[11px] outline-none"
                  style={{ color: 'var(--text-main)' }}
                >
                  <option value="">不指定</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold transition-transform active:scale-[0.98] disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Plus className="h-4 w-4" />
              收进待办
            </button>
          </form>

          {todos.length === 0 ? (
            <div
              className="rounded-[1.8rem] border px-6 py-14 text-center"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              <CheckCircle2 className="mx-auto h-6 w-6" style={{ color: 'var(--text-muted)' }} />
              <p className="mt-4 font-serif text-base font-semibold" style={{ color: 'var(--text-main)' }}>
                今天还没有待办。
              </p>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                轻轻写下一件，给今天一个开始。
              </p>
            </div>
          ) : (
            <>
              {todoSections.activeGroups.map(([groupName, groupTodos]) => (
                <section
                  key={groupName}
                  className="rounded-[1.75rem] border px-5"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)'
                  }}
                >
                  <div
                    className="flex items-center justify-between border-b py-4"
                    style={{ borderColor: 'var(--divider)' }}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      <h3 className="font-serif text-base font-semibold" style={{ color: 'var(--text-main)' }}>
                        {groupName}
                      </h3>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {groupTodos.length} 项
                    </span>
                  </div>

                  <div>{groupTodos.map(renderTodoItem)}</div>
                </section>
              ))}

              {todoSections.completedTodos.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    <h3 className="font-serif text-base font-semibold" style={{ color: 'var(--text-main)' }}>
                      已完成
                    </h3>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {todoSections.completedTodos.length}
                    </span>
                  </div>

                  <div
                    className="rounded-[1.75rem] border px-5"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--card-border)'
                    }}
                  >
                    {todoSections.completedTodos.map(renderTodoItem)}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title={deletingItem?.type === 'memo' ? '确认删除这条备忘？' : '确认删除待办？'}
        message={
          deletingItem?.type === 'memo'
            ? '删除后，这条私人留存将永久从本地清除，无法恢复。'
            : '删除后，该待办将从清单中彻底移去，无法恢复。'
        }
        confirmText="彻底删除"
        cancelText="保留"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
};

export default TodoApp;
