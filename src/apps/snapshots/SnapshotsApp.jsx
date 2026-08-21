import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, SlidersHorizontal, Camera, RefreshCw } from 'lucide-react';
import db from '../../db';
import SnapshotCard from './components/SnapshotCard';
import CreateSnapshotModal from './components/CreateSnapshotModal';
import SnapshotSettingsModal from './components/SnapshotSettingsModal';

export const SnapshotsApp = ({ onBackHub }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadSnapshots = useCallback(async () => {
    try {
      const list = await db.snapshots.orderBy('timestamp').reverse().toArray();
      setSnapshots(list);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // 删除动态
  const handleDeleteSnapshot = async (id) => {
    try {
      await db.snapshots.delete(id);
      await db.snapshotComments.where('snapshotId').equals(id).delete();
      loadSnapshots();
    } catch (err) {
      console.error('Failed to delete snapshot:', err);
    }
  };

  // 手动/自动召唤角色或 NPC 进行评论
  const handleSummonComment = async (snapshot, target) => {
    setIsLoading(true);
    try {
      let senderName = '';
      let senderAvatar = '';
      let charId = null;
      let npcId = null;

      if (target.type === 'character') {
        senderName = target.data.name;
        senderAvatar = target.data.avatar || '';
        charId = target.data.id;
      } else {
        senderName = target.data.name;
        senderAvatar = target.data.avatar || '';
        npcId = target.data.id;
      }

      // 模拟根据关系与画面描述生成的真实互动文本
      const mockCommentContent = target.type === 'character'
        ? `在这张照片里看懂了属于你的浪漫。`
        : `真是个有趣的照片视角！`;

      await db.snapshotComments.add({
        snapshotId: snapshot.id,
        replyToCommentId: null,
        replyToName: null,
        senderType: target.type,
        characterId: charId,
        npcId: npcId,
        senderName,
        senderAvatar,
        content: mockCommentContent,
        timestamp: Date.now()
      });

      loadSnapshots();
    } catch (err) {
      console.error('Failed to summon comment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 追评多轮机制
  const handleReplyComment = async (snapshot, replyTarget, userReplyText) => {
    if (!replyTarget.characterId) return;
    try {
      const char = await db.characters.get(replyTarget.characterId);
      if (!char) return;

      const aiReplyText = `回复 @User: ${userReplyText ? '我也这么觉得，这就是我们生活里的细枝末节呀。' : '很高兴你懂我的感受。'}`;

      await db.snapshotComments.add({
        snapshotId: snapshot.id,
        replyToCommentId: replyTarget.id,
        replyToName: replyTarget.name,
        senderType: 'character',
        characterId: char.id,
        senderName: char.name,
        senderAvatar: char.avatar || '',
        content: aiReplyText,
        timestamp: Date.now()
      });

      loadSnapshots();
    } catch (err) {
      console.error('Failed to process AI reply comment:', err);
    }
  };

  // 邀约 AI 主动发布动态
  const handleInviteAiPost = async (characterId, topicHint, linkedChatId) => {
    setIsLoading(true);
    try {
      const char = await db.characters.get(characterId);
      if (!char) return;

      const titlePrompt = topicHint || '下班后的温情角落';

      await db.snapshots.add({
        authorType: 'character',
        characterId: char.id,
        authorName: char.name,
        authorAvatar: char.avatar || '',
        mediaUrl: '',
        imagePrompt: `[视觉描摹: ${char.name} 记录的 ${titlePrompt} 光影]`,
        content: `今天也想把这份温度分享记录下来。${titlePrompt}`,
        location: '日常陪伴角落',
        likes: 1,
        isLiked: false,
        linkedChatId,
        timestamp: Date.now()
      });

      loadSnapshots();
    } catch (err) {
      console.error('Failed to generate AI snapshot:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in text-left">
      {/* 顶部导航控制条 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackHub}
            className="p-2 rounded-full border transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>
              Snapshots 朋友圈
            </h2>
            <p className="text-[10px] opacity-50 uppercase tracking-widest">
              Polaroid Moments Feed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full border opacity-80 hover:opacity-100"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <Plus className="w-4 h-4" />
            <span>发动态</span>
          </button>
        </div>
      </div>

      {/* 动态 Feed 流 */}
      {snapshots.length === 0 ? (
        <div
          className="rounded-[2.5rem] p-10 text-center space-y-3 border"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <Camera className="w-10 h-10 mx-auto opacity-30" />
          <h3 className="text-sm font-bold">还没有拍立得动态</h3>
          <p className="text-xs opacity-50 max-w-xs mx-auto leading-relaxed">
            点击右上角发动态，或邀约伴侣 AI 为你分享即时生活的温情时刻。
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-bold mt-2"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            发布第一条动态
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {snapshots.map((item) => (
            <SnapshotCard
              key={item.id}
              snapshot={item}
              onDelete={handleDeleteSnapshot}
              onSummonComment={handleSummonComment}
              onReplyComment={handleReplyComment}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateSnapshotModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPostCreated={loadSnapshots}
        onInviteAiPost={handleInviteAiPost}
      />

      <SnapshotSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default SnapshotsApp;
