import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, SlidersHorizontal, Camera } from 'lucide-react';
import db from '../../db';
import {
  generateSnapshotPostByAi,
  generateSnapshotCommentByAi
} from '../../services/aiService';
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
        const activeChars = await db.characters
          .filter((c) => c.isAutoMessageActive === true)
          .toArray();

        if (!activeChars || activeChars.length === 0) return;

        // 随机挑选一位开启了主动消息的角色
        const randomChar = activeChars[Math.floor(Math.random() * activeChars.length)];
        const lastPost = await db.snapshots.where('characterId').equals(randomChar.id).last();

        // 如果距离上一次发帖超过 4 小时
        const now = Date.now();
        if (!lastPost || now - lastPost.timestamp > 4 * 60 * 60 * 1000) {
          const generatedPost = await generateSnapshotPostByAi(randomChar.id);

          await db.snapshots.add({
            authorType: 'character',
            characterId: randomChar.id,
            authorName: randomChar.name,
            authorAvatar: randomChar.avatar || '',
            mediaUrl: '',
            imagePrompt: generatedPost.imagePrompt,
            content: generatedPost.content,
            location: generatedPost.location,
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

  // 智能无门槛召唤评论：根据角色库与关系矩阵匹配评论者，并调用 AI 生成评论。
  const handleAutoSummonComment = async (snapshot) => {
    try {
      const characters = await db.characters.toArray();
      const savedNpcs = await db.snapshotSettings.get('npcs');
      const npcs = savedNpcs?.value || [];

      // 剔除发帖者本人
      const candidateChars = characters.filter((character) => character.id !== snapshot.characterId);
      const candidatePool = [
        ...candidateChars.map((character) => ({ type: 'character', data: character })),
        ...npcs.map((npc) => ({ type: 'npc', data: npc }))
      ];

      // 没有已配置的角色或 NPC 时，也交由 AI 以通用 NPC 身份生成评论。
      const picked =
        candidatePool.length > 0
          ? candidatePool[Math.floor(Math.random() * candidatePool.length)]
          : {
              type: 'npc',
              data: {
                id: null,
                name: '街角光影客',
                roleTag: '路人'
              }
            };

      const commentText = await generateSnapshotCommentByAi(snapshot, picked);

      await db.snapshotComments.add({
        snapshotId: snapshot.id,
        senderType: picked.type,
        characterId: picked.type === 'character' ? picked.data.id : null,
        npcId: picked.type === 'npc' ? picked.data.id || null : null,
        senderName: picked.data.name || '匿名访客',
        senderAvatar: picked.type === 'character' ? picked.data.avatar || '' : '',
        content: commentText,
        timestamp: Date.now()
      });

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

      const aiReplyText = `回复 @User: ${
        userReplyText
          ? '我也这么觉得，这就是我们生活里的细枝末节呀。'
          : '很高兴你懂我的感受。'
      }`;

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

  // 邀约 AI 主动发布动态：调用真实 AI API 生成动态正文、图片提示词及地点。
  const handleInviteAiPost = async (characterId, topicHint, linkedChatId) => {
    try {
      const char = await db.characters.get(characterId);
      if (!char) return;

      const generatedPost = await generateSnapshotPostByAi(
        characterId,
        topicHint,
        linkedChatId
      );

      await db.snapshots.add({
        authorType: 'character',
        characterId: char.id,
        authorName: char.name,
        authorAvatar: char.avatar || '',
        mediaUrl: '',
        imagePrompt: generatedPost.imagePrompt,
        content: generatedPost.content,
        location: generatedPost.location,
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
