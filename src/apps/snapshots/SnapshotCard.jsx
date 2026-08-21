import React, { useState, useEffect, useCallback } from 'react';
import { Heart, MessageSquare, Trash2, MapPin, Sparkles, Send, CornerDownRight, Eye } from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';

export const SnapshotCard = ({ snapshot, onDelete, onSummonComment, onReplyComment }) => {
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyTarget, setReplyTarget] = useState(null); // { id, name }
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showSummonModal, setShowSummonModal] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const list = await db.snapshotComments.where('snapshotId').equals(snapshot.id).toArray();
      setComments(list);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }, [snapshot.id]);

  useEffect(() => {
    loadComments();
    loadCharactersAndNpcs();
  }, [loadComments]);

  const loadCharactersAndNpcs = async () => {
    try {
      const charList = await db.characters.toArray();
      setCharacters(charList);
      const savedNpcs = await db.snapshotSettings.get('npcs');
      setNpcs(savedNpcs?.value || []);
    } catch (err) {
      console.error('Failed to load chars/npcs:', err);
    }
  };

  // 快捷点赞
  const handleToggleLike = async () => {
    try {
      const newLikedState = !snapshot.isLiked;
      const newCount = newLikedState ? snapshot.likes + 1 : Math.max(0, snapshot.likes - 1);
      await db.snapshots.update(snapshot.id, { isLiked: newLikedState, likes: newCount });
      snapshot.isLiked = newLikedState;
      snapshot.likes = newCount;
      setComments([...comments]);
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // User 提交评论或嵌套回复
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    try {
      let senderName = 'User';
      let senderAvatar = '';
      if (snapshot.linkedChatId) {
        const chat = await db.chats.get(snapshot.linkedChatId);
        if (chat) {
          const char = await db.characters.get(chat.characterId);
          senderName = char?.userPersona || 'User';
          senderAvatar = char?.userAvatar || '';
        }
      } else {
        const savedPersona = await db.snapshotSettings.get('globalPersona');
        const savedAvatar = await db.snapshotSettings.get('globalAvatar');
        if (savedPersona?.value) senderName = savedPersona.value.split('\n')[0] || 'User';
        if (savedAvatar?.value) senderAvatar = savedAvatar.value;
      }

      const commentData = {
        snapshotId: snapshot.id,
        replyToCommentId: replyTarget ? replyTarget.id : null,
        replyToName: replyTarget ? replyTarget.name : null,
        senderType: 'user',
        senderName,
        senderAvatar,
        content: commentInput.trim(),
        timestamp: Date.now()
      };

      const newId = await db.snapshotComments.add(commentData);
      setCommentInput('');
      const currentReplyTarget = replyTarget;
      setReplyTarget(null);
      await loadComments();

      // 如果回复的是某位角色，触发 AI 追评
      if (currentReplyTarget && onReplyComment) {
        onReplyComment(snapshot, currentReplyTarget, commentInput.trim());
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    }
  };

  // 删除评论
  const handleDeleteComment = async (commentId, e) => {
    e.stopPropagation();
    try {
      await db.snapshotComments.delete(commentId);
      loadComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const formattedTime = new Date(snapshot.timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <>
      <div
        className="rounded-[2.5rem] p-4 space-y-3 border shadow-sm transition-all text-left relative overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* 卡片头部：发布者头像、姓名、时间、删帖 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {snapshot.authorAvatar ? (
              <img
                src={snapshot.authorAvatar}
                alt={snapshot.authorName}
                className="w-8 h-8 rounded-full object-cover shrink-0 border"
                style={{ borderColor: 'var(--card-border)' }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
                style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
              >
                {snapshot.authorName ? snapshot.authorName[0] : 'U'}
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-xs font-bold truncate">{snapshot.authorName}</h4>
              <div className="flex items-center gap-2 text-[10px] opacity-50">
                <span>{formattedTime}</span>
                {snapshot.location && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {snapshot.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsDeleting(true)}
            className="p-1.5 rounded-full opacity-40 hover:opacity-100 transition-opacity"
            title="彻底删除此动态"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 拍立得 1:1 照片/描述主视图 */}
        <div
          className="w-full aspect-square rounded-[1.8rem] overflow-hidden relative border flex items-center justify-center"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          {snapshot.mediaUrl ? (
            <img src={snapshot.mediaUrl} alt="Snapshot media" className="w-full h-full object-cover" />
          ) : (
            <div className="p-6 text-center space-y-3 max-w-[85%]">
              <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center border opacity-40" style={{ borderColor: 'var(--card-border)' }}>
                <Eye className="w-5 h-5" />
              </div>
              <p className="text-xs font-serif italic opacity-80 leading-relaxed break-words">
                "{snapshot.imagePrompt}"
              </p>
              <span className="text-[9px] uppercase tracking-widest opacity-40 block font-semibold">
                POLAROID SNAPSHOT
              </span>
            </div>
          )}

          {/* 图像画面描述浮层微标 */}
          {snapshot.imagePrompt && (
            <button
              onClick={() => setShowPromptModal(true)}
              className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-md border flex items-center gap-1 opacity-80 hover:opacity-100"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            >
              <Eye className="w-3 h-3" />
              <span>查看画面描摹</span>
            </button>
          )}
        </div>

        {/* 动态文字内容 */}
        {snapshot.content && (
          <p className="text-xs leading-relaxed font-serif px-1" style={{ color: 'var(--text-main)' }}>
            {snapshot.content}
          </p>
        )}

        {/* 交互工具条：点赞、召唤 AI 评论 */}
        <div className="flex items-center justify-between pt-1 border-t px-1" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleLike}
              className="flex items-center gap-1 text-xs font-semibold transition-transform active:scale-90"
              style={{ color: snapshot.isLiked ? 'var(--accent-color)' : 'var(--text-main)' }}
            >
              <Heart className={`w-4 h-4 ${snapshot.isLiked ? 'fill-current' : ''}`} />
              <span>{snapshot.likes}</span>
            </button>

            <div className="flex items-center gap-1 text-xs opacity-60">
              <MessageSquare className="w-4 h-4" />
              <span>{comments.length}</span>
            </div>
          </div>

          <button
            onClick={() => setShowSummonModal(true)}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <Sparkles className="w-3 h-3" />
            <span>召唤角色评论</span>
          </button>
        </div>

        {/* 评论区多轮列表 */}
        {comments.length > 0 && (
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
            {comments.map((cm) => (
              <div key={cm.id} className="text-xs space-y-1 group">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="font-bold shrink-0">{cm.senderName}:</span>
                    {cm.replyToName && (
                      <span className="opacity-50 text-[11px] flex items-center gap-0.5 shrink-0">
                        <CornerDownRight className="w-3 h-3" />
                        @{cm.replyToName}
                      </span>
                    )}
                    <span className="break-words opacity-90">{cm.content}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <button
                      onClick={() => setReplyTarget({ id: cm.id, name: cm.senderName, characterId: cm.characterId })}
                      className="text-[10px] underline opacity-70 hover:opacity-100"
                    >
                      回复
                    </button>
                    <button
                      onClick={(e) => handleDeleteComment(cm.id, e)}
                      className="p-0.5 opacity-40 hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 评论输入框 */}
        <form onSubmit={handleSubmitComment} className="flex items-center gap-2 pt-1">
          {replyTarget && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border shrink-0" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
              <span>回复 @{replyTarget.name}</span>
              <button type="button" onClick={() => setReplyTarget(null)}>
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <input
            type="text"
            placeholder={replyTarget ? `回复 ${replyTarget.name}...` : "写下你的评论..."}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            className="flex-1 text-xs p-2 rounded-xl border outline-none"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          />
          <button
            type="submit"
            className="p-2 rounded-xl text-xs font-bold shrink-0"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* 图片描摹查看 Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl p-4 border space-y-3" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--card-border)' }}>
              <h4 className="text-xs font-bold">画面描摹细节</h4>
              <button onClick={() => setShowPromptModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs leading-relaxed opacity-90 font-serif italic">"{snapshot.imagePrompt}"</p>
          </div>
        </div>
      )}

      {/* 召唤 AI 评论选择 Modal */}
      {showSummonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl p-4 border space-y-3" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--card-border)' }}>
              <h4 className="text-xs font-bold">选择召唤互动者</h4>
              <button onClick={() => setShowSummonModal(false)}><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              <span className="text-[10px] font-semibold opacity-50 block">伴侣角色库</span>
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setShowSummonModal(false);
                    onSummonComment(snapshot, { type: 'character', data: c });
                  }}
                  className="w-full text-left p-2 rounded-xl text-xs border flex items-center justify-between hover:opacity-100 opacity-80"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                >
                  <span className="font-bold">{c.name}</span>
                  <Sparkles className="w-3 h-3 opacity-60" />
                </button>
              ))}

              {npcs.length > 0 && (
                <>
                  <span className="text-[10px] font-semibold opacity-50 block pt-2">NPC 列表</span>
                  {npcs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setShowSummonModal(false);
                        onSummonComment(snapshot, { type: 'npc', data: n });
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs border flex items-center justify-between hover:opacity-100 opacity-80"
                      style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                    >
                      <span>{n.name} <strong className="opacity-50 font-normal text-[10px]">({n.roleTag})</strong></span>
                      <Sparkles className="w-3 h-3 opacity-60" />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 Modal */}
      <ConfirmModal
        isOpen={isDeleting}
        title="彻底删除动态"
        message="确认彻底删除这条拍立得动态及其全部评论吗？此操作不可撤销。"
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={() => {
          setIsDeleting(false);
          onDelete(snapshot.id);
        }}
        onCancel={() => setIsDeleting(false)}
      />
    </>
  );
};

export default SnapshotCard;
