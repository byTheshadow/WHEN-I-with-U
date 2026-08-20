import React, { useState, useEffect, useCallback } from 'react';
import { Mail, ChevronDown, ChevronUp, Trash2, CheckCircle2, MessageSquare } from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { subscribeAiEvents } from '../../services/aiService';

export const QuickBoard = ({ delay = 300 }) => {
  const [messages, setMessages] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // 从 db.homeBoard 实时加载按时间倒序排列的留言
  const loadMessages = useCallback(async () => {
    try {
      const list = await db.homeBoard.orderBy('timestamp').reverse().toArray();
      setMessages(list);
    } catch (err) {
      console.error('Failed to load homeBoard messages:', err);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    // 监听 AI 发送的主页新留言事件
    const unsubscribe = subscribeAiEvents((event) => {
      if (event.type === 'NEW_HOME_BOARD_MESSAGE') {
        loadMessages();
      }
    });
    return () => unsubscribe();
  }, [loadMessages]);

  // 标记为已读
  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await db.homeBoard.update(id, { isRead: true });
      loadMessages();
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };

  // 确认彻底删除留言
  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await db.homeBoard.delete(deletingId);
      setDeletingId(null);
      loadMessages();
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;

  if (!messages || messages.length === 0) return null;

  return (
    <>
      <div
        className="w-full rounded-[2rem] p-4 transition-all duration-300 shadow-sm border space-y-3"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
          animationDelay: `${delay}ms`
        }}
      >
        {/* 信箱头部栏 */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between cursor-pointer select-none px-1"
        >
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                color: 'var(--text-main)'
              }}
            >
              <Mail className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">
              伴侣信盒 ({messages.length})
            </span>
            {unreadCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
              >
                {unreadCount} 条新留言
              </span>
            )}
          </div>
          <button
            type="button"
            className="p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-main)' }}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* 留言卡片展开列表 */}
        {isExpanded && (
          <div className="space-y-3 pt-1">
            {messages.map((item) => {
              const isLong = item.content && item.content.length > 90;
              const isCardOpen = expandedCardId === item.id;
              const formattedTime = item.timestamp
                ? new Date(item.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '刚刚';

              return (
                <div
                  key={item.id}
                  className="rounded-[1.5rem] p-4 space-y-2.5 transition-all border text-left relative group"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: item.isRead ? 'var(--card-border)' : 'var(--text-main)',
                    opacity: item.isRead ? 0.85 : 1
                  }}
                >
                  {/* 未读醒目标示微指示 */}
                  {!item.isRead && (
                    <div
                      className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--accent-color)' }}
                    />
                  )}

                  {/* 卡片头部：角色头像、姓名、时间 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 pr-6">
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt={item.characterName}
                          className="w-7 h-7 rounded-full object-cover shrink-0 border"
                          style={{ borderColor: 'var(--card-border)' }}
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            color: 'var(--text-main)'
                          }}
                        >
                          {item.characterName ? item.characterName[0] : 'C'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4
                          className="text-xs font-bold truncate"
                          style={{ color: 'var(--text-main)' }}
                        >
                          {item.characterName}
                        </h4>
                        <span
                          className="text-[10px] block opacity-50"
                          style={{ color: 'var(--text-sub)' }}
                        >
                          {formattedTime}
                        </span>
                      </div>
                    </div>

                    {/* 操作控制区 */}
                    <div className="flex items-center gap-1">
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          title="标记为已读"
                          className="p-1.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-main)' }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        title="删除留言"
                        className="p-1.5 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-main)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 留言主体内容 */}
                  <p
                    className="text-xs leading-relaxed font-serif italic break-words"
                    style={{ color: 'var(--text-main)' }}
                  >
                    "{isLong && !isCardOpen ? `${item.content.slice(0, 90)}...` : item.content}"
                  </p>

                  {/* 展开/收起长文本 */}
                  {isLong && (
                    <button
                      type="button"
                      onClick={() => setExpandedCardId(isCardOpen ? null : item.id)}
                      className="text-[10px] font-semibold opacity-70 underline hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--text-main)' }}
                    >
                      {isCardOpen ? '收起全文' : '查看完整随笔'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 删除旧留言二次确认高透 Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingId)}
        title="彻底删除随笔"
        message="确认要彻底删除这条伴侣留言吗？此操作无法撤销。"
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
};

export default QuickBoard;
