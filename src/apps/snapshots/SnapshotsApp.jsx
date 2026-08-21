import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, SlidersHorizontal, Camera } from 'lucide-react';
import db from '../../db';
import SnapshotCard from './SnapshotCard';
import CreateSnapshotModal from './CreateSnapshotModal';
import SnapshotSettingsModal from './SnapshotSettingsModal';

export const SnapshotsApp = ({ onBackHub }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

    // 启动 AI 自主主动发动态的后台轮询调度器 (支持 isAutoMessageActive 互通)
    const interval = setInterval(async () => {
      try {
        const activeChars = await db.characters.filter(c => c.isAutoMessageActive === true).toArray();
        if (!activeChars || activeChars.length === 0) return;

        // 随机挑选一位开启了主动消息的角色
        const randomChar = activeChars[Math.floor(Math.random() * activeChars.length)];
        const lastPost = await db.snapshots.where('characterId').equals(randomChar.id).last();
        
        // 如果距离上一次发帖超过 4 小时 (演示环境设为随机概率触发)
        const now = Date.now();
        if (!lastPost || (now - lastPost.timestamp > 4 * 60 * 60 * 1000)) {
          await db.snapshots.add({
            authorType: 'character',
            characterId: randomChar.id,
            authorName: randomChar.name,
            authorAvatar: randomChar.avatar || '',
            mediaUrl: '',
            imagePrompt: `[视觉描摹: ${randomChar.name} 在日常空间捕捉到的光影]`,
            content: `记录下这个安静的片段。`,
            location: '日常空间',
            likes: 1,
            isLiked: false,
            timestamp: now
          });
          loadSnapshots();
        }
      } catch (err) {
        console.error('Auto snapshot generation failed:', err);
      }
    }, 60000); // 每 1 分钟检测一次触发条件

    return () => clearInterval(interval);
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

  // 智能无门槛召唤评论 (根据角色库与关系矩阵自动匹配，无需手动选人)
  const handleAutoSummonComment = async (snapshot) => {
    try {
      const characters = await db.characters.toArray();
      const savedNpcs = await db.snapshotSettings.get('npcs');
      const npcs = savedNpcs?.value || [];

      // 剔除发帖者本人
      const candidateChars = characters.filter(c => c.id !== snapshot.characterId);
      const candidatePool = [...candidateChars.map(c => ({ type: 'character', data: c })), ...npcs.map(n => ({ type: 'npc', data: n }))];

      if (candidatePool.length === 0) {
        // 如果没有其他角色，由通用 NPC 身份发言
        await db.snapshotComments.add({
          snapshotId: snapshot.id,
          senderType: 'npc',
          senderName: '街角光影客',
          senderAvatar: '',
          content: '照片里抓取的定格时刻真美！',
          timestamp: Date.now()
        });
      } else {
        // 随机匹配 1 个最合适的角色/NPC 留下互动
        const picked = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        let senderName = picked.type === 'character' ? picked.data.name : picked.data.name;
        let senderAvatar = picked.type === 'character' ? (picked.data.avatar || '') : '';
        let charId = picked.type === 'character' ? picked.data.id : null;
        let npcId = picked.type === 'npc' ? picked.data.id : null;

        // 根据关系矩阵获取描述
        let relationNote = '';
        if (picked.type === 'character' && snapshot.characterId) {
          const rel = await db.snapshotRelations
            .where('characterId').equals(snapshot.characterId)
            .and(r => r.targetCharacterId === picked.data.id)
            .first();
          if (rel) relationNote = rel.relation;
        }

        const commentText = relationNote
          ? `作为你的${relationNote}，不得不说这一张拍得挺有味道。`
          : `记录得真好，照片里的氛围很动人。`;

        await db.snapshotComments.add({
          snapshotId: snapshot.id,
          senderType: picked.type,
          characterId: charId,
          npcId: npcId,
          senderName,
          senderAvatar,
          content: commentText,
          timestamp: Date.now()
        });
      }

      loadSnapshots();
    } catch (err) {
      console.error('Failed to auto summon comment:', err);
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
            type="button"
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
            type="button"
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
            点击右上角发动态，或开启伴侣主动发帖自动分享即时生活的温情时刻。
          </p>
          <button
            type="button"
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
              onAutoSummonComment={handleAutoSummonComment}
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
