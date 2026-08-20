import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, PenTool, Sparkles, RefreshCw,
  Trash2, Filter, Calendar, Heart, User, CornerDownRight, Shuffle
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { generateCompanionDiary, rerollCompanionDiary } from '../../services/aiService';

export const DiaryApp = ({ onBackHub }) => {
  const [diaries, setDiaries] = useState([]);
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);

  // 极简 Tab: 'all' | 'user' | 'character'
  const [authorTab, setAuthorTab] = useState('all');
  const [selectedChatId, setSelectedChatId] = useState('all');

  // 新建日记状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMood, setNewMood] = useState('');
  const [newWeather, setNewWeather] = useState('');
  const [newContent, setNewContent] = useState('');
  
  // 关键：绑定的消息框 / 伴侣策略 ('random' | 'none' | chatId)
  const [bindStrategy, setBindStrategy] = useState('random'); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isRerollingId, setIsRerollingId] = useState(null);

  useEffect(() => {
    loadInitData();
  }, []);

  const loadInitData = async () => {
    const allChats = await db.chats.toArray();
    setChats(allChats);

    const allChars = await db.characters.toArray();
    setCharacters(allChars);

    if (allChats.length > 0) {
      setBindStrategy(allChats[0].id.toString());
    }

    loadDiaries();
  };

  const loadDiaries = async () => {
    const list = await db.diaries.reverse().sortBy('timestamp');
    setDiaries(list);
  };

  const handleCreateDiary = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsSubmitting(true);
    const todayStr = new Date().toISOString().split('T')[0];

    let targetChatId = null;
    let targetCharId = null;

    if (bindStrategy === 'random') {
      if (chats.length > 0) {
        const randomChat = chats[Math.floor(Math.random() * chats.length)];
        targetChatId = randomChat.id;
        targetCharId = randomChat.characterId;
      }
    } else if (bindStrategy !== 'none') {
      const selectedChat = chats.find(c => c.id.toString() === bindStrategy.toString());
      if (selectedChat) {
        targetChatId = selectedChat.id;
        targetCharId = selectedChat.characterId;
      }
    }

    const payload = {
      chatId: targetChatId,
      characterId: targetCharId,
      replyToDiaryId: null,
      author: 'user',
      title: newTitle.trim() || '无题心绪',
      mood: newMood.trim() || '平静',
      weather: newWeather.trim() || '温朗',
      content: newContent.trim(),
      images: [],
      date: todayStr,
      timestamp: Date.now()
    };

    delete payload.id;
    const createdId = await db.diaries.add(payload);
    payload.id = createdId;

    // 如果绑定了特定/随机消息框，立刻触发伴侣回执
    if (targetChatId) {
      await generateCompanionDiary(targetChatId, payload);
    }

    setNewTitle('');
    setNewMood('');
    setNewWeather('');
    setNewContent('');
    setShowCreateModal(false);
    setIsSubmitting(false);
    loadDiaries();
  };

  const handleDeleteDiary = async () => {
    if (!deleteTargetId) return;
    // 如果删除的是 User 日记，连带删除其下面的伴侣回执日记
    const companionReply = diaries.find(d => d.replyToDiaryId === deleteTargetId);
    if (companionReply) {
      await db.diaries.delete(companionReply.id);
    }
    await db.diaries.delete(deleteTargetId);
    setDeleteTargetId(null);
    loadDiaries();
  };

  const handleReroll = async (diaryId) => {
    setIsRerollingId(diaryId);
    await rerollCompanionDiary(diaryId);
    setIsRerollingId(null);
    loadDiaries();
  };

  // 分离出独立伴侣日记与 User 日记
  // 注意：如果是作为回执的伴侣日记 (has replyToDiaryId)，直接合并在 user 日记底部
  const userDiaries = diaries.filter(d => d.author === 'user');
  const standaloneCompanionDiaries = diaries.filter(d => d.author === 'character' && !d.replyToDiaryId);

  return (
    <div className="space-y-6 animate-fade-in-up pb-10 text-left">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-1 font-semibold opacity-70 hover:opacity-100 transition-opacity text-xs"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回 Hub</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 shadow-md"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--accent-foreground)'
          }}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>提笔记心绪</span>
        </button>
      </div>

      {/* Title Section */}
      <div className="space-y-1 border-b pb-4" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 opacity-70" />
          <h2 className="font-serif text-2xl font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>
            Dual Diaries
          </h2>
        </div>
        <p className="text-xs opacity-50 font-serif italic">
          每一页都是沉淀在消息框里的双向纸页。
        </p>
      </div>

      {/* 极简无灰块下划线 Segment Tab */}
      <div className="flex items-center justify-between border-b pb-1" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-6 text-xs font-serif">
          <button
            type="button"
            onClick={() => setAuthorTab('all')}
            className={`pb-2 relative transition-all ${authorTab === 'all' ? 'font-bold opacity-100' : 'opacity-40'}`}
            style={{ color: 'var(--text-main)' }}
          >
            全部手记 ({userDiaries.length + standaloneCompanionDiaries.length})
            {authorTab === 'all' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: 'var(--text-main)' }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setAuthorTab('user')}
            className={`pb-2 relative transition-all ${authorTab === 'user' ? 'font-bold opacity-100' : 'opacity-40'}`}
            style={{ color: 'var(--text-main)' }}
          >
            我的日记本
            {authorTab === 'user' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: 'var(--text-main)' }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setAuthorTab('character')}
            className={`pb-2 relative transition-all ${authorTab === 'character' ? 'font-bold opacity-100' : 'opacity-40'}`}
            style={{ color: 'var(--text-main)' }}
          >
            伴侣独立感悟
            {authorTab === 'character' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: 'var(--text-main)' }} />
            )}
          </button>
        </div>

        {/* 消息框筛选下拉 */}
        <div className="flex items-center gap-1 opacity-70 text-[11px]">
          <Filter className="w-3 h-3" />
          <select
            value={selectedChatId}
            onChange={(e) => setSelectedChatId(e.target.value)}
            className="bg-transparent outline-none font-medium"
            style={{ color: 'var(--text-main)' }}
          >
            <option value="all">所有消息框</option>
            {chats.map((c) => {
              const char = characters.find(ch => ch.id === c.characterId);
              return (
                <option key={c.id} value={c.id}>
                  {c.title || `与 ${char?.name || '伴侣'} 的对话 (${c.mode === 'rp' ? 'RP' : '现实'})`}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* 日记流展示 */}
      <div className="space-y-6 pt-2">
        {userDiaries.length === 0 && standaloneCompanionDiaries.length === 0 ? (
          <div className="py-20 text-center space-y-3 opacity-40">
            <BookOpen className="w-8 h-8 mx-auto" />
            <p className="text-xs font-serif italic">还没有写下日记，点击右上角提笔记心绪吧...</p>
          </div>
        ) : (
          <>
            {/* 1. 展示 User 日记卡片（自动内嵌伴侣回执） */}
            {(authorTab === 'all' || authorTab === 'user') &&
              userDiaries
                .filter(ud => selectedChatId === 'all' || ud.chatId?.toString() === selectedChatId.toString())
                .map((diary) => {
                  const replyCompanionDiary = diaries.find(d => d.replyToDiaryId === diary.id);
                  const char = characters.find(c => c.id === diary.characterId);
                  const chat = chats.find(c => c.id === diary.chatId);

                  return (
                    <div
                      key={diary.id}
                      className="p-6 rounded-[2.5rem] border shadow-sm relative space-y-4 transition-all duration-300"
                      style={{
                        backgroundColor: 'var(--card-bg)',
                        borderColor: 'var(--card-border)',
                        color: 'var(--text-main)'
                      }}
                    >
                      {/* User 日记顶栏 */}
                      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--divider)' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[10px]">
                            <User className="w-3.5 h-3.5 opacity-70" />
                          </div>
                          <div>
                            <span className="font-bold text-xs">我的心绪日记</span>
                            <p className="text-[10px] opacity-40 font-mono">
                              {chat ? `${chat.title || '专属消息框'} (${chat.mode === 'rp' ? 'RP' : '现实模式'})` : '未绑定消息框'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] opacity-40 font-mono">{diary.date}</span>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(diary.id)}
                            className="p-1 opacity-30 hover:opacity-100 hover:text-rose-500 transition-opacity"
                            title="抹去"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 标题 & 简评 */}
                      <div className="space-y-1">
                        <h3 className="font-serif font-bold text-base tracking-tight">{diary.title}</h3>
                        <div className="flex gap-2 text-[10px] opacity-60">
                          <span>心绪: {diary.mood}</span>
                          <span>•</span>
                          <span>天气: {diary.weather}</span>
                        </div>
                      </div>

                      {/* 正文 */}
                      <p className="text-xs leading-relaxed opacity-90 whitespace-pre-wrap font-sans">
                        {diary.content}
                      </p>

                      {/* 关键：伴侣回执感悟（直接包含在日记本底部） */}
                      {replyCompanionDiary && (
                        <div
                          className="mt-4 p-4 rounded-2xl border border-dashed relative space-y-2 animate-fade-in"
                          style={{
                            backgroundColor: 'var(--control-soft-bg)',
                            borderColor: 'var(--card-border)'
                          }}
                        >
                          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--divider)' }}>
                            <div className="flex items-center gap-2">
                              <CornerDownRight className="w-3.5 h-3.5 text-purple-400" />
                              {char?.avatar ? (
                                <img src={char.avatar} alt={char.name} className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <Heart className="w-3.5 h-3.5 text-rose-400" />
                              )}
                              <span className="font-bold text-xs">{char?.name || '伴侣'} 的信笺回执</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleReroll(replyCompanionDiary.id)}
                              disabled={isRerollingId === replyCompanionDiary.id}
                              className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity"
                              title="重刷/重新抽卡伴侣回复"
                            >
                              <RefreshCw className={`w-3 h-3 ${isRerollingId === replyCompanionDiary.id ? 'animate-spin' : ''}`} />
                              <span>Re-roll</span>
                            </button>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-serif font-semibold text-xs text-purple-300">
                              《{replyCompanionDiary.title}》
                            </h4>
                            <p className="text-[11px] leading-relaxed opacity-85 font-serif italic">
                              "{replyCompanionDiary.content}"
                            </p>
                          </div>

                          <div className="flex justify-between items-center text-[9px] opacity-40 font-mono pt-1">
                            <span>心绪: {replyCompanionDiary.mood}</span>
                            <span>{new Date(replyCompanionDiary.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

            {/* 2. 展示伴侣独立日记（非回执类） */}
            {(authorTab === 'all' || authorTab === 'character') &&
              standaloneCompanionDiaries
                .filter(sd => selectedChatId === 'all' || sd.chatId?.toString() === selectedChatId.toString())
                .map((diary) => {
                  const char = characters.find(c => c.id === diary.characterId);
                  const chat = chats.find(c => c.id === diary.chatId);

                  return (
                    <div
                      key={diary.id}
                      className="p-6 rounded-[2.5rem] border shadow-sm relative space-y-4 transition-all duration-300"
                      style={{
                        backgroundColor: 'var(--control-soft-bg)',
                        borderColor: 'var(--card-border)',
                        color: 'var(--text-main)'
                      }}
                    >
                      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--divider)' }}>
                        <div className="flex items-center gap-2">
                          {char?.avatar ? (
                            <img src={char.avatar} alt={char.name} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <Heart className="w-4 h-4 text-rose-400" />
                          )}
                          <div>
                            <span className="font-bold text-xs">{char?.name || '伴侣'} 的独立心绪</span>
                            <p className="text-[10px] opacity-40 font-mono">
                              {chat ? `消息框: ${chat.title}` : '静谧随笔'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleReroll(diary.id)}
                            disabled={isRerollingId === diary.id}
                            className="p-1 opacity-50 hover:opacity-100"
                            title="重新抽卡"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRerollingId === diary.id ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(diary.id)}
                            className="p-1 opacity-30 hover:opacity-100 hover:text-rose-500"
                            title="抹去"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-serif font-bold text-base tracking-tight">{diary.title}</h3>
                        <div className="flex gap-2 text-[10px] opacity-60">
                          <span>心绪: {diary.mood}</span>
                          <span>•</span>
                          <span>天气: {diary.weather}</span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed opacity-90 whitespace-pre-wrap font-serif italic">
                        {diary.content}
                      </p>
                    </div>
                  );
                })}
          </>
        )}
      </div>

      {/* 新建日记高透 Modal (彻底去除了深灰方块遮罩) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-md p-6 rounded-[2.5rem] border shadow-2xl space-y-4 text-left"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--divider)' }}>
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 opacity-70" />
                <h3 className="font-serif font-bold text-base">落笔心绪手记</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="opacity-50 hover:opacity-100 text-sm font-mono"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDiary} className="space-y-3 text-xs">
              {/* 关键：选择绑定的【特定消息框】或【随机伴侣】 */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                  选择感悟绑定的消息框 (独立日记本)
                </label>
                <select
                  value={bindStrategy}
                  onChange={(e) => setBindStrategy(e.target.value)}
                  className="w-full p-2.5 rounded-xl border outline-none font-medium"
                  style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                >
                  <option value="random">系统随机挑选伴侣即时感悟</option>
                  <option value="none">暂不绑定 (仅存为个人私人日记)</option>
                  {chats.map((c) => {
                    const char = characters.find(ch => ch.id === c.characterId);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.title || `与 ${char?.name || '伴侣'} 的对话`} ({c.mode === 'rp' ? 'RP剧情' : '现实陪伴'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">心绪主题</label>
                  <input
                    type="text"
                    placeholder="如：清晨微醺"
                    value={newMood}
                    onChange={(e) => setNewMood(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none"
                    style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">当下的天气</label>
                  <input
                    type="text"
                    placeholder="如：细雨 18℃"
                    value={newWeather}
                    onChange={(e) => setNewWeather(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none"
                    style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">日记标题</label>
                  <input
                    type="text"
                    placeholder="标题"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none font-bold"
                    style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">日记正文</label>
                <textarea
                  rows={5}
                  placeholder="倾诉你的现实生活、今日情绪与记忆..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-3 rounded-2xl border outline-none resize-none leading-relaxed"
                  style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-full font-medium opacity-70 hover:opacity-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full font-semibold transition-transform active:scale-95 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--accent-foreground)'
                  }}
                >
                  {isSubmitting ? '落笔联络中...' : '落笔封存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <ConfirmModal
          title="抹去日记"
          message="确定要彻底抹去这篇心绪手记吗？此操作无法撤销。"
          confirmText="确认抹去"
          onConfirm={handleDeleteDiary}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
};

export default DiaryApp;
