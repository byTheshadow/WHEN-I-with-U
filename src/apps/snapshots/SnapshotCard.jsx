// src/apps/snapshots/SnapshotCard.jsx
//
// 【整体替换说明】这轮是 feed 卡片的视觉与功能升级：
// 1. 参考图片主导的信息卡风格：有图的动态做成 hero 图卡（图片全出血、底部渐变、
//    文字悬浮在图上、左上角悬浮"作者类型+时间"徽章），没有图的动态保留原来的
//    诗意卡片（Polaroid Vision Frame），不强行套图片卡。
// 2. 新增"编辑已发布动态"功能（仅 User 自己发的动态可编辑）：可以修改文字、
//    光影描摹、地点、更换图片，保存后立即持久化到数据库。
// 3. 加入几处真实 App 常见的微动效：点赞的"跳一下"反馈、新评论淡入、
//    卡片自身淡入（配合父级的错位延迟）。
// 4. 沿用上一轮已修复的追评 bug 与按 chatId 查询 NPC 的逻辑，未做回退。
//
import React, { useState, useEffect, useCallback, useRef } from 'react';
import db from '../../db';
import { generateSnapshotComment, generateSnapshotReply } from './services/snapshotAiService';
import { getNpcsByChatId, ensureNpcPersona } from './services/snapshotNpcService';
import { addNpcAffinity } from './services/snapshotAffinityService';
import { compressImageFile } from './services/snapshotMediaService';

export const SnapshotCard = ({
  snapshot,
  currentChatId,
  initialComments = [],
  onDelete,
  onOpenUserProfile,
  onOpenCharProfile
}) => {
  // 本地可编辑字段用 localSnapshot 承载，点赞/编辑都先更新这里，
  // 保证卡片自身即时反馈，不必等父级整份列表重新拉取。
  const [localSnapshot, setLocalSnapshot] = useState(snapshot);
  useEffect(() => {
    setLocalSnapshot(snapshot);
  }, [snapshot]);

  // 评论初始值由父级 SnapshotsApp 批量查好、按 snapshotId 分组后传进来
  // （见 SnapshotsApp.jsx 的 loadSnapshots），这里只是拿来做初始 state，
  // 不再在挂载时自己单独发一次查询——同一屏最多同时挂载 30 张卡片时，
  // 30 个并发的小查询叠加起来是进入页面卡顿的主因之一。
  // loadComments 仍然保留，供本卡片自己后续的动作（发评论、AI 回复）
  // 用来刷新"这一条动态"自己的评论，那属于单次、按需的查询，不在此列。
  const [comments, setComments] = useState(initialComments);
  const [commentInput, setCommentInput] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [isSummoning, setIsSummoning] = useState(false);
  // 用户发完评论后，等待角色/NPC追评生成期间的一个可见提示——
  // 之前这段等待完全是"暗地里"的（setTimeout+异步生成，UI上什么都不显示），
  // 用户会以为对方压根不回复。只在真的会触发追评时才置 true。
  const [isWaitingReply, setIsWaitingReply] = useState(false);
  const [showPromptDetail, setShowPromptDetail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLikePopping, setIsLikePopping] = useState(false);

  // 编辑已发布动态
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editImagePrompt, setEditImagePrompt] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editFileInputRef = useRef(null);

  const loadComments = useCallback(async () => {
    try {
      const list = await db.snapshotComments
        .where('snapshotId')
        .equals(snapshot.id)
        .sortBy('createdAt');
      setComments(list);
    } catch (err) {
      console.error('加载评论失败:', err);
    }
  }, [snapshot.id]);

  // 注意：这里不再有"挂载时自动 loadComments()"的 effect——评论已经由
  // initialComments 带进来了。loadComments 只在发评论 / AI 回复之后按需调用。

  // 点赞切换（带一个短促的"跳一下"反馈）
  const handleToggleLike = async () => {
    try {
      const nextState = !localSnapshot.isLiked;
      const nextCount = nextState
        ? (localSnapshot.likes || 0) + 1
        : Math.max(0, (localSnapshot.likes || 1) - 1);

      await db.snapshots.update(localSnapshot.id, { isLiked: nextState, likes: nextCount });
      setLocalSnapshot((prev) => ({ ...prev, isLiked: nextState, likes: nextCount }));

      if (nextState) {
        setIsLikePopping(true);
        setTimeout(() => setIsLikePopping(false), 220);

        // 给 NPC 的动态点赞：涨一点友谊好感（取消点赞不扣）
        if (localSnapshot.authorType === 'npc' && localSnapshot.npcId) {
          void addNpcAffinity(localSnapshot.npcId, 'like');
        }
      }
    } catch (err) {
      console.error('点赞失败:', err);
    }
  };

  // 用户发表评论或回复
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text) return;

    try {
      const profileKey = `user_${currentChatId}`;
      const customProfile = await db.snapshotProfiles.get(profileKey);
      const chat = await db.chats.get(Number(currentChatId));

      const senderName = customProfile?.name || chat?.userName || '我';
      const senderAvatar = customProfile?.avatar || chat?.userAvatar || '';

      const newComment = {
        snapshotId: localSnapshot.id,
        chatId: Number(currentChatId),
        senderType: 'user',
        senderName,
        senderAvatar,
        replyToCommentId: replyTarget ? replyTarget.id : null,
        replyToName: replyTarget ? replyTarget.name : null,
        content: text,
        createdAt: Date.now()
      };

      await db.snapshotComments.add(newComment);
      setCommentInput('');
      let target = replyTarget;
      setReplyTarget(null);
      await loadComments();

      // 没有明确"回复谁"（比如第一次直接在动态下面写一句，而不是点了
      // 某条已有评论的"回复"）时，之前这里直接跳过、没人接话。改成默认
      // 由这条动态本身的作者（如果是角色/NPC）来接住这条评论，行为上更
      // 像真实社交动态的评论区——用户发的原帖(authorType==='user')和
      // 本地生活速报(authorType==='news')没有可以接话的虚拟身份，维持
      // 不接话。
      if (!target) {
        if (localSnapshot.authorType === 'character' && localSnapshot.characterId) {
          target = {
            id: localSnapshot.characterId,
            name: localSnapshot.authorName,
            type: 'character',
            avatar: localSnapshot.authorAvatar || ''
          };
        } else if (localSnapshot.authorType === 'npc' && localSnapshot.npcId) {
          const npcRecord = await db.snapshotNpcs.get(Number(localSnapshot.npcId));
          if (npcRecord) {
            target = {
              id: npcRecord.id,
              name: npcRecord.name,
              type: 'npc',
              roleTag: npcRecord.roleTag || '街区邻里',
              avatar: npcRecord.avatar || '',
              personaSummary: npcRecord.personaSummary || ''
            };
          }
        }
      }

      // 用户评论/回复的对象是 NPC：涨一点友谊好感
      if (target?.type === 'npc' && target.id !== null && target.id !== undefined) {
        void addNpcAffinity(target.id, 'comment');
      }

      if (target && (target.type === 'character' || target.type === 'npc')) {
        setIsWaitingReply(true);
        setTimeout(async () => {
          try {
            let responder = target;
            if (target.type === 'npc') {
              const chat = await db.chats.get(Number(currentChatId));
              const character = chat?.characterId ? await db.characters.get(chat.characterId) : null;
              responder = await ensureNpcPersona(target, character);
            }

            const replyText = await generateSnapshotReply(
              localSnapshot,
              responder,
              { senderName, content: text },
              text,
              Number(currentChatId)
            );
            if (replyText) {
              await db.snapshotComments.add({
                snapshotId: localSnapshot.id,
                chatId: Number(currentChatId),
                senderType: target.type,
                characterId: target.type === 'character' ? target.id : null,
                npcId: target.type === 'npc' ? target.id : null,
                senderName: target.name,
                roleTag: target.type === 'npc' ? (target.roleTag || '街区邻里') : '',
                senderAvatar: target.avatar || '',
                content: replyText,
                createdAt: Date.now()
              });
              await loadComments();
            }
          } catch (replyErr) {
            console.error('追评生成失败:', replyErr);
          } finally {
            setIsWaitingReply(false);
          }
        }, 1200);
      }
    } catch (err) {
      console.error('提交评论失败:', err);
    }
  };

  // 智能召唤首评
  const handleAutoSummon = async () => {
    if (isSummoning) return;
    setIsSummoning(true);
    try {
      const chat = await db.chats.get(Number(currentChatId));
      const character = chat?.characterId ? await db.characters.get(chat.characterId) : null;
      const pool = [];

      if (character && String(localSnapshot.characterId) !== String(character.id)) {
        pool.push({ type: 'character', id: character.id, name: character.name, avatar: character.avatar });
      }

      const npcs = await getNpcsByChatId(Number(currentChatId));
      npcs.forEach((n) => {
        if (String(localSnapshot.npcId) !== String(n.id)) {
          pool.push({ type: 'npc', id: n.id, name: n.name, roleTag: n.roleTag, avatar: '', personaSummary: n.personaSummary });
        }
      });

      let chosen = pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : { type: 'npc', id: null, name: '街角常客', roleTag: '路人', avatar: '' };

      if (chosen.type === 'npc' && chosen.id !== null) {
        chosen = await ensureNpcPersona(chosen, character);
      }

      const commentText = await generateSnapshotComment(localSnapshot, chosen, Number(currentChatId));

      if (commentText) {
        await db.snapshotComments.add({
          snapshotId: localSnapshot.id,
          chatId: Number(currentChatId),
          senderType: chosen.type,
          characterId: chosen.type === 'character' ? chosen.id : null,
          npcId: chosen.type === 'npc' ? chosen.id : null,
          senderName: chosen.name,
          roleTag: chosen.type === 'npc' ? (chosen.roleTag || '街区邻里') : '',
          senderAvatar: chosen.avatar || '',
          content: commentText,
          createdAt: Date.now()
        });
        await loadComments();
      }
    } catch (err) {
      console.error('智能召唤失败:', err);
    } finally {
      setIsSummoning(false);
    }
  };

  const handleAuthorClick = () => {
    if (localSnapshot.authorType === 'user') {
      onOpenUserProfile && onOpenUserProfile();
    } else if (localSnapshot.authorType === 'character' && localSnapshot.characterId) {
      onOpenCharProfile && onOpenCharProfile(localSnapshot.characterId);
    }
  };

  // ============ 编辑已发布动态 ============
  const handleStartEdit = () => {
    setEditContent(localSnapshot.content || '');
    setEditImagePrompt(localSnapshot.imagePrompt || '');
    setEditLocation(localSnapshot.location || '');
    setEditMediaUrl(localSnapshot.mediaUrl || '');
    setIsEditingPost(true);
  };

  const handleCancelEdit = () => {
    setIsEditingPost(false);
  };

  const handleEditFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1200, 1200, 0.82);
      setEditMediaUrl(compressed);
    } catch (err) {
      console.error('压缩图片失败:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() && !editImagePrompt.trim() && !editMediaUrl) return;
    setIsSavingEdit(true);
    try {
      const updates = {
        content: editContent.trim(),
        imagePrompt: editImagePrompt.trim(),
        location: editLocation.trim() || '某处日常',
        mediaUrl: editMediaUrl || ''
      };
      await db.snapshots.update(localSnapshot.id, updates);
      setLocalSnapshot((prev) => ({ ...prev, ...updates }));
      setIsEditingPost(false);
    } catch (err) {
      console.error('保存编辑失败:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formattedTime = new Date(localSnapshot.timestamp || localSnapshot.createdAt).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const authorBadgeLabel = localSnapshot.authorType === 'character'
    ? '伴侣'
    : localSnapshot.authorType === 'npc'
      ? '邻里'
      : localSnapshot.authorType === 'news'
        ? '资讯'
        : '我';

  const canEdit = localSnapshot.authorType === 'user';

  return (
    <div className="w-full bg-white/80 backdrop-blur-2xl rounded-[32px] p-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-white/60 space-y-4 text-left transition-all duration-300 hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.08)] animate-fade-in">
      {/* 头部：作者与时间 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleAuthorClick}>
          <div className="w-10 h-10 rounded-2xl overflow-hidden p-[2px] bg-gradient-to-tr from-neutral-200 to-neutral-400 shadow-sm transition-transform active:scale-95">
            {localSnapshot.authorAvatar ? (
              <img src={localSnapshot.authorAvatar} alt={localSnapshot.authorName} className="w-full h-full object-cover rounded-[14px]" loading="lazy" decoding="async" />
            ) : (
              <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600 rounded-[14px]">
                {(localSnapshot.authorName || 'U')[0]}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold tracking-tight text-neutral-900 group-hover:opacity-75 transition-opacity">
                {localSnapshot.authorName}
              </h4>
              {localSnapshot.authorType === 'character' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-neutral-900 text-white font-medium">伴侣</span>
              )}
              {localSnapshot.authorType === 'npc' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-medium">邻里</span>
              )}
              {localSnapshot.authorType === 'news' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 font-medium">资讯</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
              <span>{formattedTime}</span>
              {localSnapshot.location && (
                <span className="flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {localSnapshot.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {canEdit && !isEditingPost && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100/60 transition-colors"
              title="编辑动态"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsDeleting(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100/60 transition-colors"
            title="删除动态"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      {isEditingPost ? (
        /* ============ 编辑面板 ============ */
        <div className="space-y-3 animate-fade-in">
          <button
            type="button"
            onClick={() => editFileInputRef.current?.click()}
            className="relative w-full h-40 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center group"
          >
            {editMediaUrl ? (
              <img src={editMediaUrl} alt="预览" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span className="text-neutral-400 text-xs">点击选择照片（可选）</span>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-neutral-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </span>
            </div>
            {editMediaUrl && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditMediaUrl(''); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </button>
          <input ref={editFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditFileChange} />

          <input
            type="text"
            placeholder="画面光影描摹（可选）"
            value={editImagePrompt}
            onChange={(e) => setEditImagePrompt(e.target.value)}
            className="w-full text-xs italic p-2.5 rounded-xl bg-neutral-100/80 outline-none placeholder-neutral-400"
          />
          <textarea
            placeholder="随感文字"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full text-xs p-2.5 rounded-xl bg-neutral-100/80 outline-none h-20 resize-none placeholder-neutral-400"
          />
          <input
            type="text"
            placeholder="打卡地点"
            value={editLocation}
            onChange={(e) => setEditLocation(e.target.value)}
            className="w-full text-xs p-2.5 rounded-xl bg-neutral-100/80 outline-none placeholder-neutral-400"
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSavingEdit || (!editContent.trim() && !editImagePrompt.trim() && !editMediaUrl)}
              className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-sm active:scale-95 disabled:opacity-30 transition-all"
            >
              {isSavingEdit ? '保存中...' : '保存修改'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 视觉主图：有图时做成图片主导的 hero 卡，悬浮徽章 + 底部渐变文字 */}
          {localSnapshot.mediaUrl ? (
            <div className="w-full aspect-square rounded-[24px] overflow-hidden bg-neutral-100 shadow-inner relative group">
              <img src={localSnapshot.mediaUrl} alt="Moment snapshot" className="w-full h-full object-cover" loading="lazy" decoding="async" />

              {/* 左上角：作者类型 + 时间 悬浮徽章 */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-medium text-white/90 border border-white/10">
                {authorBadgeLabel} · {formattedTime}
              </div>

              {/* 右上角：获赞数悬浮徽章 */}
              {localSnapshot.likes > 0 && (
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold text-neutral-800 shadow-sm flex items-center gap-1">
                  <svg className="w-2.5 h-2.5 fill-red-500 text-red-500" viewBox="0 0 24 24" strokeWidth="0"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  {localSnapshot.likes}
                </div>
              )}

              {/* 底部渐变 + 悬浮正文（有正文时） */}
              {localSnapshot.content && (
                <div className="absolute bottom-0 left-0 right-0 p-4 pt-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                  <p className="text-xs leading-relaxed text-white font-medium">
                    {localSnapshot.content}
                  </p>
                </div>
              )}

              {localSnapshot.imagePrompt && (
                <button
                  type="button"
                  onClick={() => setShowPromptDetail(!showPromptDetail)}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-medium text-white/90 border border-white/20 hover:bg-black/60 transition-all"
                  style={localSnapshot.content ? { bottom: 'auto', top: '3rem' } : undefined}
                >
                  画面定格描摹
                </button>
              )}
            </div>
          ) : localSnapshot.imagePrompt ? (
            <div className="w-full aspect-[4/3] rounded-[24px] bg-gradient-to-br from-neutral-50 to-neutral-100/80 p-6 flex flex-col justify-between border border-neutral-200/50 shadow-inner">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-[9px] uppercase tracking-widest font-semibold">Polaroid Vision Frame</span>
                <svg className="w-4 h-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/></svg>
              </div>
              <p className="text-xs leading-relaxed text-neutral-700 font-serif italic text-center px-2">
                "{localSnapshot.imagePrompt}"
              </p>
              <div className="text-center text-[10px] text-neutral-400">光影捕捉与意象留白</div>
            </div>
          ) : null}

          {/* 意境抽屉浮层（仅在有图但点开描摹详情时使用） */}
          {showPromptDetail && localSnapshot.mediaUrl && localSnapshot.imagePrompt && (
            <div className="p-3 bg-neutral-50/90 backdrop-blur-md rounded-2xl border border-neutral-200/60 text-[11px] text-neutral-600 leading-relaxed font-serif italic animate-fade-in">
              "{localSnapshot.imagePrompt}"
            </div>
          )}

          {/* 没有图片时，正文单独展示在卡片里（有图时正文已悬浮在图上） */}
          {!localSnapshot.mediaUrl && localSnapshot.content && (
            <p className="text-xs leading-relaxed text-neutral-800 font-sans tracking-wide px-1">
              {localSnapshot.content}
            </p>
          )}
        </>
      )}

      {/* 交互操作栏 */}
      {!isEditingPost && (
        <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                localSnapshot.isLiked
                  ? 'bg-red-50 text-red-500'
                  : 'bg-neutral-100/70 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${isLikePopping ? 'scale-125' : 'scale-100'} ${localSnapshot.isLiked ? 'fill-current text-red-500' : 'stroke-current'}`}
                viewBox="0 0 24 24" fill="none" strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>{localSnapshot.likes || 0}</span>
            </button>

            <div className="flex items-center gap-1 text-xs text-neutral-400 font-medium px-2 py-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>{comments.length}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoSummon}
            disabled={isSummoning}
            className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <svg className={`w-3 h-3 ${isSummoning ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>{isSummoning ? '呼唤中...' : '邀约评论'}</span>
          </button>
        </div>
      )}

      {/* 评论流 */}
      {!isEditingPost && comments.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-100/80">
          {comments.map((c) => (
            <div key={c.id} className="text-xs group flex items-start justify-between gap-2 p-1.5 rounded-xl hover:bg-neutral-50/60 transition-colors animate-fade-in">
              <div className="min-w-0 flex-1 leading-relaxed">
                <span className="font-bold text-neutral-900 mr-1.5">{c.senderName}:</span>
                {c.replyToName && (
                  <span className="text-neutral-400 text-[11px] mr-1">
                    @{c.replyToName}
                  </span>
                )}
                <span className="text-neutral-700">{c.content}</span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setReplyTarget({
                    id: c.characterId || c.npcId || c.id,
                    name: c.senderName,
                    type: c.senderType,
                    roleTag: c.roleTag || (c.senderType === 'npc' ? '街区邻里' : ''),
                    avatar: c.senderAvatar
                  })}
                  className="text-[10px] font-bold text-neutral-500 hover:text-neutral-900"
                >
                  回复
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await db.snapshotComments.delete(c.id);
                    loadComments();
                  }}
                  className="text-neutral-300 hover:text-red-500 p-0.5"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 对方正在回复中：只在真的排了追评队列时出现，回复写入或失败后即消失 */}
      {!isEditingPost && isWaitingReply && (
        <div className="flex items-center gap-1.5 px-1.5 pt-1 text-[10px] text-neutral-400 animate-fade-in">
          <span className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="w-1 h-1 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '240ms' }} />
          </span>
          <span>对方正在回复中...</span>
        </div>
      )}

      {/* 输入框 */}
      {!isEditingPost && (
        <form onSubmit={handleSubmitComment} className="flex items-center gap-2 pt-1">
          {replyTarget && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-neutral-100 text-[10px] text-neutral-700 font-semibold shrink-0 animate-fade-in">
              <span>@{replyTarget.name}</span>
              <button type="button" onClick={() => setReplyTarget(null)}>
                <svg className="w-3 h-3 text-neutral-400 hover:text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}
          <input
            type="text"
            placeholder={replyTarget ? `回复 ${replyTarget.name}...` : '写下一笔短语...'}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            className="flex-1 text-xs px-3.5 py-2.5 rounded-2xl bg-neutral-100/80 border-none outline-none text-neutral-800 placeholder-neutral-400 focus:bg-white focus:ring-1 focus:ring-neutral-300 transition-all"
          />
          <button
            type="submit"
            disabled={!commentInput.trim()}
            className="w-8 h-8 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition-transform active:scale-95 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </form>
      )}

      {/* 彻底删除确认弹窗 */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xs bg-white rounded-[28px] p-6 space-y-4 shadow-2xl text-center">
            <h4 className="text-sm font-bold text-neutral-900">撕下这一页动态？</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              彻底删除此条拍立得记录及所有留言，此操作无法撤回。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700"
              >
                保留
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeleting(false);
                  onDelete && onDelete(localSnapshot.id);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-xs font-bold text-white shadow-sm"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapshotCard;