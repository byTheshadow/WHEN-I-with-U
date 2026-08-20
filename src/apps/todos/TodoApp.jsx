import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Tag,
  User,
  StickyNote,
  AlertCircle,
  ArrowLeft,
  Filter
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';

export const TodoApp = ({ onBackHub }) => {
  const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'memos'
  const [todos, setTodos] = useState([]);
  const [memos, setMemos] = useState([]);
  const [characters, setCharacters] = useState([]);

  // 新增待办 Form 状态
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState('normal'); // 'urgent' | 'normal' | 'relaxed'
  const [newCategory, setNewCategory] = useState('工作');
  const [newCharacterId, setNewCharacterId] = useState('');

  // 新增备忘 Form 状态
  const [newMemoContent, setNewMemoContent] = useState('');

  // 删除二次确认 Modal 状态
  const [deletingItem, setDeletingItem] = useState(null); // { type: 'todo' | 'memo', id }

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const todoList = await db.todos.toArray();
      // 依完成状态与到期时间排序
      todoList.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      });
      setTodos(todoList);

      const charList = await db.characters.toArray();
      setCharacters(charList);

      // 加载备忘录 (存放在 db.settings 或额外扩展字段，这里我们使用 db.diaries / db.todos 的衍生机制或统一存储)
      const memoSettings = await db.settings.get('memos_list');
      setMemos(memoSettings?.value || []);
    } catch (err) {
      console.error('Failed to load todo/memo data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 新增待办
  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const payload = {
        title: newTitle.trim(),
        dueDate: newDueDate || new Date().toISOString().slice(0, 16),
        priority: newPriority,
        category: newCategory,
        characterId: newCharacterId ? Number(newCharacterId) : null,
        isCompleted: false,
        createdAt: new Date().toISOString()
      };

      // 遵循 Dexie 主键规避原则
      delete payload.id;
      await db.todos.add(payload);

      setNewTitle('');
      setNewDueDate('');
      loadData();
    } catch (err) {
      console.error('Failed to add todo:', err);
    }
  };

  // 切换待办打勾完成状态
  const handleToggleComplete = async (todo) => {
    try {
      await db.todos.update(todo.id, { isCompleted: !todo.isCompleted });
      loadData();
    } catch (err) {
      console.error('Failed to toggle todo completion:', err);
    }
  };

  // 新增备忘录
  const handleAddMemo = async (e) => {
    e.preventDefault();
    if (!newMemoContent.trim()) return;

    try {
      const newMemo = {
        id: `memo_${Date.now()}`,
        content: newMemoContent.trim(),
        updatedAt: new Date().toISOString()
      };
      const updatedMemos = [newMemo, ...memos];
      await db.settings.put({ key: 'memos_list', value: updatedMemos });

      setNewMemoContent('');
      loadData();
    } catch (err) {
      console.error('Failed to add memo:', err);
    }
  };

  // 物理删除处理
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    try {
      if (deletingItem.type === 'todo') {
        await db.todos.delete(deletingItem.id);
      } else if (deletingItem.type === 'memo') {
        const updatedMemos = memos.filter((m) => m.id !== deletingItem.id);
        await db.settings.put({ key: 'memos_list', value: updatedMemos });
      }
      setDeletingItem(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  // 快捷紧急度标识与样式解析
  const renderPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <AlertCircle className="w-3 h-3" /> 急迫
          </span>
        );
      case 'relaxed':
        return (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] opacity-70 border"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-sub)' }}
          >
            不急
          </span>
        );
      default:
        return (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] opacity-80 border"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
          >
            普通
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up pb-10">
      {/* 顶部导航与页签切换 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-1.5 text-xs font-semibold p-2 rounded-full border transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回主页</span>
        </button>

        {/* Tab 切换 */}
        <div
          className="flex p-1 rounded-full border text-xs font-semibold"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'todos' ? 'shadow-sm font-bold' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'todos' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>待办清单</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('memos')}
            className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
              activeTab === 'memos' ? 'shadow-sm font-bold' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'memos' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>随手备忘</span>
          </button>
        </div>
      </div>

      {/* 待办事项 TAB */}
      {activeTab === 'todos' && (
        <div className="space-y-4">
          {/* 新增待办输入卡片 */}
          <form
            onSubmit={handleAddTodo}
            className="p-4 rounded-[1.8rem] border space-y-3 shadow-sm text-left"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 opacity-50" />
              <input
                type="text"
                placeholder="添加新待办（例：今晚20:00前完成总结）..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-xs font-semibold placeholder:opacity-40"
                style={{ color: 'var(--text-main)' }}
              />
            </div>

            {/* 参数配置选框 */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]" style={{ borderColor: 'var(--card-border)' }}>
              {/* 截止时间 */}
              <div className="flex items-center gap-1.5 opacity-80">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="datetime-local"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] w-full"
                  style={{ color: 'var(--text-main)' }}
                />
              </div>

              {/* 伴侣绑定 */}
              <div className="flex items-center gap-1.5 opacity-80">
                <User className="w-3.5 h-3.5 shrink-0" />
                <select
                  value={newCharacterId}
                  onChange={(e) => setNewCharacterId(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] w-full truncate"
                  style={{ color: 'var(--text-main)' }}
                >
                  <option value="" style={{ background: 'var(--card-bg)' }}>
                    全员可见/督促
                  </option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id} style={{ background: 'var(--card-bg)' }}>
                      仅由 {c.name} 督促
                    </option>
                  ))}
                </select>
              </div>

              {/* 紧急程度 */}
              <div className="flex items-center gap-1.5 opacity-80">
                <Filter className="w-3.5 h-3.5 shrink-0" />
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] w-full"
                  style={{ color: 'var(--text-main)' }}
                >
                  <option value="normal" style={{ background: 'var(--card-bg)' }}>普通程度</option>
                  <option value="urgent" style={{ background: 'var(--card-bg)' }}>着急/紧迫</option>
                  <option value="relaxed" style={{ background: 'var(--card-bg)' }}>不急/顺便</option>
                </select>
              </div>

              {/* 分类 */}
              <div className="flex items-center gap-1.5 opacity-80">
                <Tag className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  placeholder="标签 (如:工作)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] w-full"
                  style={{ color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="w-full py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              添加入待办清单
            </button>
          </form>

          {/* 待办列表 */}
          <div className="space-y-2.5">
            {todos.length === 0 ? (
              <div
                className="py-10 text-center rounded-[1.5rem] border text-xs"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-sub)'
                }}
              >
                暂无待办事项，快随手记录一件吧。
              </div>
            ) : (
              todos.map((item) => {
                const boundChar = characters.find((c) => c.id === item.characterId);
                const formattedDueDate = item.dueDate
                  ? new Date(item.dueDate).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '无指定时间';

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-[1.5rem] border transition-all flex items-start justify-between gap-3 text-left"
                    style={{
                      backgroundColor: 'var(--control-soft-bg)',
                      borderColor: 'var(--card-border)',
                      opacity: item.isCompleted ? 0.6 : 1
                    }}
                  >
                    {/* 左侧选择框与文字 */}
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(item)}
                        className="mt-0.5 shrink-0 opacity-80 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-main)' }}
                      >
                        {item.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4 opacity-40" />
                        )}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <h4
                          className={`text-xs font-semibold break-words ${
                            item.isCompleted ? 'line-through opacity-70' : ''
                          }`}
                          style={{ color: 'var(--text-main)' }}
                        >
                          {item.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] opacity-60">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formattedDueDate}
                          </span>
                          {item.category && (
                            <span className="px-1.5 py-0.5 rounded border">
                              {item.category}
                            </span>
                          )}
                          {boundChar && (
                            <span className="flex items-center gap-1 font-bold">
                              <User className="w-3 h-3" /> 督促人: {boundChar.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 右侧：优先级与删除 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderPriorityBadge(item.priority)}
                      <button
                        type="button"
                        onClick={() => setDeletingItem({ type: 'todo', id: item.id })}
                        className="p-1 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-main)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 随手备忘录 TAB */}
      {activeTab === 'memos' && (
        <div className="space-y-4">
          {/* 新增备忘便笺 */}
          <form
            onSubmit={handleAddMemo}
            className="p-4 rounded-[1.8rem] border space-y-3 shadow-sm text-left"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <textarea
              rows={3}
              placeholder="随手写下闪念、灵感或记忆留痕..."
              value={newMemoContent}
              onChange={(e) => setNewMemoContent(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs leading-relaxed resize-none placeholder:opacity-40"
              style={{ color: 'var(--text-main)' }}
            />
            <button
              type="submit"
              disabled={!newMemoContent.trim()}
              className="w-full py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 disabled:opacity-40"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              保存随记便笺
            </button>
          </form>

          {/* 备忘便笺列表 */}
          <div className="grid grid-cols-1 gap-3">
            {memos.length === 0 ? (
              <div
                className="py-10 text-center rounded-[1.5rem] border text-xs"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-sub)'
                }}
              >
                便笺盒空空如也，记录第一条备忘吧。
              </div>
            ) : (
              memos.map((memo) => (
                <div
                  key={memo.id}
                  className="p-4 rounded-[1.5rem] border space-y-2 text-left relative group transition-all"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                >
                  <div className="flex items-center justify-between text-[10px] opacity-50">
                    <span>
                      {new Date(memo.updatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeletingItem({ type: 'memo', id: memo.id })}
                      className="p-1 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--text-main)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed font-serif whitespace-pre-wrap break-words">
                    {memo.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 物理销毁二次确认 Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="确认物理彻底删除"
        message={
          deletingItem?.type === 'todo'
            ? '删除后该项待办将从清单中彻底移去，无法恢复。'
            : '删除后该条备忘便笺将永久从本地清除。'
        }
        confirmText="彻底删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
};

export default TodoApp;
