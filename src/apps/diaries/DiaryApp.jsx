import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, PenTool, Sparkles, RefreshCw,
  Trash2, Filter, Calendar, Heart, Sun, User, Check, Plus
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { generateCompanionDiary, rerollCompanionDiary } from '../../services/aiService';

export const DiaryApp = ({ onBackHub }) => {
  const [diaries, setDiaries] = useState([]);
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);

  // 筛选器状态
  const [authorTab, setAuthorTab] = useState('all'); // 'all' | 'user' | 'character'
  const [selectedChatId, setSelectedChatId] = useState('all');
  const [selectedCharId, setSelectedCharId] = useState('all');

  // 新建日记 Modal 状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMood, setNewMood] = useState('');
  const [newWeather, setNewWeather] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newChatId, setNewChatId] = useState('');
  const [shareWithCompanion, setShareWithCompanion] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 删除确认 Modal 状态
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

    if (allChats.length > 0 && !newChatId) {
      setNewChatId(allChats[0].id.toString());
    }

    loadDiaries();
  };

  const loadDiaries = async () => {
    const list = await db.diaries.reverse().sortBy('timestamp');
    setDiaries(list);
  };

  const handleCreateDiary = async (e) => {
    e.preventDefault();
    if (!newContent.trim() || !newChatId) return;

    setIsSubmitting(true);
    const targetChat = chats.find(c => c.id.toString() === newChatId.toString());
    const charId = targetChat ? targetChat.characterId : (characters[0]?.id || 1);
    const todayStr = new Date().toISOString().split('T')[0];

    const payload = {
      chatId: parseInt(newChatId, 10),
      characterId: charId,
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
    await db.diaries.add(payload);

    if (shareWithCompanion && targetChat) {
      // 触发伴侣回执日记生成
      await generateCompanionDiary(targetChat.id, payload);
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

  const handleManualTriggerCompanionDiary = async (chatId) => {
    setIsRerollingId('new');
    await generateCompanionDiary(chatId);
    setIsRerollingId(null);
    loadDiaries();
  };

  // 根据 Tab 和 Filter 过滤日记
  const filteredDiaries = diaries.filter(item => {
    if (authorTab !== 'all' && item.author !== authorTab) return false;
    if (selectedChatId !== 'all' && item.chatId?.toString() !== selectedChatId.toString()) return false;
    if (selectedCharId !== 'all' && item.characterId?.toString() !== selectedCharId.toString()) return false;
    return true;
  });

  return (
    <div className="space-y-5 animate-fade-in-up pb-10 text-left">
      {/* 顶部 Main Header Bar */}
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
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--accent-foreground)'
          }}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>提笔记心绪</span>
        </button>
      </div>

      {/* 杂志风 Page Title & Subtitle */}
      <div className="space-y-1 border-b pb-4" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 opacity-70" />
          <h2 className="font-serif text-2xl font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>
            Dual Diaries
          </h2>
        </div>
        <p className="text-xs opacity-50 font-serif italic">
          两束时空的汇合，每个消息框沉淀一本专属的双向日记本。
        </p>
      </div>

      {/* 顶部 Tab Pill 切卡 */}
      <div className="flex items-center gap-1 p-1 rounded-2xl border backdrop-blur-md" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
        <button
          type="button"
          onClick={() => setAuthorTab('all')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${authorTab === 'all' ? 'shadow-sm font-bold' : 'opacity-60'}`}
          style={{
            backgroundColor: authorTab === 'all' ? 'var(--card-bg)' : 'transparent',
            color: 'var(--text-main)'
          }}
        >
          全部日记 ({diaries.length})
        </button>
        <button
          type="button"
          onClick={() => setAuthorTab('user')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${authorTab === 'user' ? 'shadow-sm font-bold' : 'opacity-60'}`}
          style={{
            backgroundColor: authorTab === 'user' ? 'var(--card-bg)' : 'transparent',
            color: 'var(--text-main)'
          }}
        >
          我的日记
        </button>
        <button
          type="button"
          onClick={() => setAuthorTab('character')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${authorTab === 'character' ? 'shadow-sm font-bold' : 'opacity-60'}`}
          style={{
            backgroundColor: authorTab === 'character' ? 'var(--card-bg)' : 'transparent',
            color: 'var(--text-main)'
          }}
        >
          伴侣日记
        </button>
      </div>

      {/* 下拉高级筛选 (按特定对话 / 特定伴侣) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 p-2 rounded-2xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <Filter className="w-3.5 h-3.5 opacity-50 shrink-0" />
          <select
            value={selectedChatId}
            onChange={(e) => setSelectedChatId(e.target.value)}
            className="w-full bg-transparent outline-none font-medium truncate"
            style={{ color: 'var(--text-main)' }}
          >
            <option value="all">所有对话窗口</option>
            {chats.map((c) => {
              const char = characters.find(ch => ch.id === c.characterId);
              return (
                <option key={c.id} value={c.id}>
                  {c.title || `与 ${char?.name || '伴侣'} 的对话`}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-1.5 p-2 rounded-2xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <Heart className="w-3.5 h-3.5 opacity-50 shrink-0" />
          <select
            value={selectedCharId}
            onChange={(e) => setSelectedCharId(e.target.value)}
            className="w-full bg-transparent outline-none font-medium truncate"
            style={{ color: 'var(--text-main)' }}
          >
            <option value="all">所有伴侣对象</option>
            {characters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 日记卡片流 Timeline / Web Zine Masonry */}
      <div className="space-y-4 pt-1">
        {filteredDiaries.length === 0 ? (
          <div className="py-16 text-center space-y-3 opacity-40 border rounded-[2rem]" style={{ borderColor: 'var(--card-border)' }}>
            <BookOpen className="w-8 h-8 mx-auto" />
            <p className="text-xs font-serif italic">这里还没有记录... 提笔写下一记，或邀请伴侣为你留下一章。</p>
          </div>
        ) : (
          filteredDiaries.map((diary) => {
            const isUser = diary.author === 'user';
            const char = characters.find(c => c.id === diary.characterId);
            const chat = chats.find(c => c.id === diary.chatId);

            return (
              <div
                key={diary.id}
                className={`p-5 rounded-[2rem] border transition-all duration-300 relative group shadow-sm ${
                  isUser ? 'user-diary-card' : 'companion-diary-card'
                }`}
                style={{
                  backgroundColor: isUser ? 'var(--card-bg)' : 'var(--control-soft-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                {/* 顶部卡片 Header (作者信息与格式印章) */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: 'var(--divider)' }}>
                  <div className="flex items-center gap-2.5">
                    {isUser ? (
                      <div className="w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center font-bold text-[10px]">
                        <User className="w-3.5 h-3.5 opacity-70" />
                      </div>
                    ) : (
                      char?.avatar ? (
                        <img src={char.avatar} alt={char.name} className="w-7 h-7 rounded-full object-cover border border-white/30" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-[10px] text-purple-400">
                          {char?.name?.[0] || 'A'}
                        </div>
                      )
                    )}

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs">
                          {isUser ? '我写下的心绪' : (char?.name ? `${char.name} 的感悟` : '伴侣视角')}
                        </span>
                        {!isUser && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono border" style={{ borderColor: 'var(--card-border)', opacity: 0.7 }}>
                            伴侣印章
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] opacity-40 font-mono">
                        {chat?.title ? `绑定: ${chat.title}` : '专属消息框'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] opacity-50 font-mono">
                    <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {diary.date}</span>
                  </div>
                </div>

                {/* 标题 & 极简心绪标签 */}
                <div className="space-y-1 mb-3">
                  <h3 className="font-serif font-bold text-base tracking-tight">
                    {diary.title || '无题心绪'}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] opacity-70">
                    <span className="px-2 py-0.5 rounded-md font-medium" style={{ background: 'var(--control-soft-bg)' }}>
                      心绪: {diary.mood}
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-medium" style={{ background: 'var(--control-soft-bg)' }}>
                      天气: {diary.weather}
                    </span>
                  </div>
                </div>

                {/* 日记正文 */}
                <p className="text-xs leading-relaxed opacity-90 whitespace-pre-wrap font-sans">
                  {diary.content}
                </p>

                {/* 卡片底栏操作 (Re-roll / 抹去) */}
                <div className="mt-4 pt-3 flex items-center justify-between border-t text-[10px]" style={{ borderColor: 'var(--divider)' }}>
                  <span className="opacity-40 font-mono">
                    {new Date(diary.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-2">
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleReroll(diary.id)}
                        disabled={isRerollingId === diary.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all active:scale-95 disabled:opacity-50"
                        style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}
                        title="重新抽卡/重写伴侣日记"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRerollingId === diary.id ? 'animate-spin' : ''}`} />
                        <span>重新抽卡 (Re-roll)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(diary.id)}
                      className="p-1.5 rounded-full opacity-40 hover:opacity-100 hover:text-rose-500 transition-opacity"
                      title="抹去此页"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 新建日记 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md p-6 rounded-[2.5rem] border shadow-2xl space-y-4 text-left"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--divider)' }}>
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 opacity-70" />
                <h3 className="font-serif font-bold text-base">撰写我的专属日记</h3>
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
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                  选择绑定的消息框 (专属日记本)
                </label>
                <select
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border outline-none font-medium"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  required
                >
                  {chats.map((c) => {
                    const char = characters.find(ch => ch.id === c.characterId);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.title || `与 ${char?.name || '伴侣'} 的对话`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                    心绪主题
                  </label>
                  <input
                    type="text"
                    placeholder="如：清晨微醺"
                    value={newMood}
                    onChange={(e) => setNewMood(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                    当下的天气
                  </label>
                  <input
                    type="text"
                    placeholder="如：细雨 18℃"
                    value={newWeather}
                    onChange={(e) => setNewWeather(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                    日记标题
                  </label>
                  <input
                    type="text"
                    placeholder="标题"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none font-bold"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                  日记正文
                </label>
                <textarea
                  rows={5}
                  placeholder="倾诉你的现实生活、今日情绪与记忆..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-3 rounded-2xl border outline-none resize-none leading-relaxed"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  required
                />
              </div>

              {/* 勾选：生成伴侣感悟回执 */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                <input
                  type="checkbox"
                  id="shareCompanion"
                  checked={shareWithCompanion}
                  onChange={(e) => setShareWithCompanion(e.target.checked)}
                  className="rounded accent-purple-500 w-4 h-4"
                />
                <label htmlFor="shareCompanion" className="text-[11px] font-medium cursor-pointer flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>同步心绪给伴侣（自动生成伴侣视角感悟回执）</span>
                </label>
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
                  {isSubmitting ? '保存并联络伴侣中...' : '落笔封存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 彻底抹去确认 Modal */}
      {deleteTargetId && (
        <ConfirmModal
          title="抹去日记"
          message="确定要彻底抹去这篇心绪记录吗？此操作无法撤销。"
          confirmText="确认抹去"
          onConfirm={handleDeleteDiary}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
};

export default DiaryApp;
