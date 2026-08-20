import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, BookOpen, PenTool, Sparkles, RefreshCw,
  Trash2, Filter, Calendar, Heart, Mail, ChevronDown, ChevronUp, User, Sparkle
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { generateCompanionReplyForDiary } from '../../services/aiService';

export const DiaryApp = ({ onBackHub }) => {
  const [diaries, setDiaries] = useState([]);
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);

  // 展开信封 ID 集合
  const [openEnvelopeIds, setOpenEnvelopeIds] = useState(new Set());

  // 筛选器状态
  const [authorTab, setAuthorTab] = useState('all'); // 'all' | 'with_reply' | 'user_only'
  const [selectedChatId, setSelectedChatId] = useState('all');
  const [selectedCharId, setSelectedCharId] = useState('all');

  // 新建日记 Modal 状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMood, setNewMood] = useState('');
  const [newWeather, setNewWeather] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newChatId, setNewChatId] = useState('random'); // 'random' 或具体的 chatId
  const [requestReply, setRequestReply] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 操作状态 Modal
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

    loadDiaries();
  };

  const loadDiaries = async () => {
    const list = await db.diaries.reverse().sortBy('timestamp');
    setDiaries(list);
  };

  const toggleEnvelope = (id) => {
    setOpenEnvelopeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateDiary = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsSubmitting(true);

    let boundChatId = null;
    let boundCharId = null;

    if (newChatId !== 'random') {
      boundChatId = parseInt(newChatId, 10);
      const targetChat = chats.find(c => c.id === boundChatId);
      if (targetChat) {
        boundCharId = targetChat.characterId;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const payload = {
      chatId: boundChatId,
      characterId: boundCharId,
      author: 'user',
      title: newTitle.trim() || '无题心绪',
      mood: newMood.trim() || '微醺感',
      weather: newWeather.trim() || '温朗',
      content: newContent.trim(),
      companionReply: null,
      images: [],
      date: todayStr,
      timestamp: Date.now()
    };

    delete payload.id;
    const newDiaryId = await db.diaries.add(payload);

    // 如果勾选了让伴侣即时回复
    if (requestReply) {
      await generateCompanionReplyForDiary(newDiaryId);
    }

    setNewTitle('');
    setNewMood('');
    setNewWeather('');
    setNewContent('');
    setShowCreateModal(false);
    setIsSubmitting(false);

    // 默认展开新创建的信封
    setOpenEnvelopeIds(prev => new Set(prev).add(newDiaryId));
    loadDiaries();
  };

  const handleDeleteDiary = async () => {
    if (!deleteTargetId) return;
    await db.diaries.delete(deleteTargetId);
    setDeleteTargetId(null);
    loadDiaries();
  };

  const handleRerollReply = async (diaryId) => {
    setIsRerollingId(diaryId);
    await generateCompanionReplyForDiary(diaryId);
    setIsRerollingId(null);
    loadDiaries();
  };

  // 过滤逻辑
  const filteredDiaries = diaries.filter(item => {
    if (authorTab === 'with_reply' && !item.companionReply) return false;
    if (authorTab === 'user_only' && item.companionReply) return false;
    if (selectedChatId !== 'all' && item.chatId?.toString() !== selectedChatId.toString()) return false;
    if (selectedCharId !== 'all' && item.characterId?.toString() !== selectedCharId.toString()) return false;
    return true;
  });

  return (
    <div className="space-y-5 animate-fade-in-up pb-10 text-left">
      {/* 顶栏 Header */}
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
          className="px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 shadow-md"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--accent-foreground)'
          }}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>封存新信件</span>
        </button>
      </div>

      {/* 杂志风 Title Header */}
      <div className="space-y-1 border-b pb-4" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 opacity-70" />
          <h2 className="font-serif text-2xl font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>
            Envelope Diaries
          </h2>
        </div>
        <p className="text-xs opacity-50 font-serif italic">
          信封包裹的心绪留痕，每一封信下方嵌入伴侣的深情回执。
        </p>
      </div>

      {/* 极简精致的分栏 Tab (非灰块死板 Pill) */}
      <div className="flex items-center gap-6 text-xs font-medium border-b pb-2 px-1" style={{ borderColor: 'var(--divider)' }}>
        <button
          type="button"
          onClick={() => setAuthorTab('all')}
          className={`relative pb-1.5 transition-all ${authorTab === 'all' ? 'font-bold opacity-100' : 'opacity-40 hover:opacity-70'}`}
          style={{ color: 'var(--text-main)' }}
        >
          全部信件 ({diaries.length})
          {authorTab === 'all' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: 'var(--text-main)' }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAuthorTab('with_reply')}
          className={`relative pb-1.5 transition-all ${authorTab === 'with_reply' ? 'font-bold opacity-100' : 'opacity-40 hover:opacity-70'}`}
          style={{ color: 'var(--text-main)' }}
        >
          含伴侣回执
          {authorTab === 'with_reply' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: 'var(--text-main)' }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAuthorTab('user_only')}
          className={`relative pb-1.5 transition-all ${authorTab === 'user_only' ? 'font-bold opacity-100' : 'opacity-40 hover:opacity-70'}`}
          style={{ color: 'var(--text-main)' }}
        >
          个人独白信
          {authorTab === 'user_only' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: 'var(--text-main)' }} />
          )}
        </button>
      </div>

      {/* 筛选拉框 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <Filter className="w-3.5 h-3.5 opacity-40 shrink-0" />
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

        <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <Heart className="w-3.5 h-3.5 opacity-40 shrink-0" />
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

      {/* 信封流 (Envelope Cards) */}
      <div className="space-y-4 pt-1">
        {filteredDiaries.length === 0 ? (
          <div className="py-16 text-center space-y-3 opacity-40 border rounded-[2.5rem]" style={{ borderColor: 'var(--card-border)' }}>
            <Mail className="w-8 h-8 mx-auto" />
            <p className="text-xs font-serif italic">还没有信件留存... 提笔封存一封心绪信件吧。</p>
          </div>
        ) : (
          filteredDiaries.map((diary) => {
            const isOpen = openEnvelopeIds.has(diary.id);
            const reply = diary.companionReply;
            const char = reply ? characters.find(c => c.id === reply.characterId) : (diary.characterId ? characters.find(c => c.id === diary.characterId) : null);
            const chat = chats.find(c => c.id === diary.chatId);

            return (
              <div
                key={diary.id}
                className="rounded-[2.2rem] border overflow-hidden transition-all duration-500 shadow-sm relative group"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                {/* 信封封面卡片 Header (点击切换展开/折叠) */}
                <div
                  onClick={() => toggleEnvelope(diary.id)}
                  className="p-5 cursor-pointer flex items-center justify-between transition-colors hover:opacity-90"
                >
                  <div className="flex items-center gap-3.5">
                    {/* 火漆印章 / 信封图标 */}
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner shrink-0" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                      {reply ? (
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      ) : (
                        <Mail className="w-5 h-5 opacity-60" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-sm tracking-tight">
                          {diary.title || '无题心绪信件'}
                        </h3>
                        {reply && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono border text-purple-400 border-purple-400/30">
                            已收到回执
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] opacity-40 font-mono flex items-center gap-2">
                        <span>{diary.date}</span>
                        <span>•</span>
                        <span>{chat ? chat.title : '个人心绪信扎'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] opacity-50 font-mono hidden sm:inline">
                      {isOpen ? '收起信纸' : '拆开信封'}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                  </div>
                </div>

                {/* 拆开后展开的完整信纸 (Letter Content Inside) */}
                {isOpen && (
                  <div className="px-6 pb-6 pt-2 border-t space-y-5 animate-fade-in" style={{ borderColor: 'var(--divider)' }}>
                    {/* 顶部信纸信息标语 */}
                    <div className="flex items-center justify-between text-[10px] opacity-60 border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
                      <div className="flex items-center gap-3 font-mono">
                        <span>心绪: {diary.mood}</span>
                        <span>天气: {diary.weather}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(diary.id)}
                        className="opacity-40 hover:opacity-100 hover:text-rose-500 transition-opacity p-1"
                        title="彻底销毁此信"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 我写的信件正文 */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40 block">
                        MY LETTER / 我的心绪
                      </span>
                      <p className="text-xs leading-relaxed opacity-90 whitespace-pre-wrap font-sans">
                        {diary.content}
                      </p>
                    </div>

                    {/* 嵌入在信纸下方的伴侣回执 (Embedded Reply) */}
                    <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--divider)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {char?.avatar ? (
                            <img src={char.avatar} alt={char.name} className="w-6 h-6 rounded-full object-cover border" style={{ borderColor: 'var(--card-border)' }} />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-[9px] text-purple-400">
                              <Sparkle className="w-3 h-3" />
                            </div>
                          )}
                          <span className="font-bold text-xs">
                            {reply ? `${reply.characterName || char?.name || '伴侣'} 的心绪回执` : '邀请伴侣写下回执'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRerollReply(diary.id)}
                          disabled={isRerollingId === diary.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] border transition-transform active:scale-95 disabled:opacity-50"
                          style={{ borderColor: 'var(--card-border)', background: 'var(--control-soft-bg)' }}
                          title="重新生成或邀请回复"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRerollingId === diary.id ? 'animate-spin text-purple-400' : ''}`} />
                          <span>{reply ? '重刷回执 (Re-roll)' : '召唤伴侣回执'}</span>
                        </button>
                      </div>

                      {reply ? (
                        <div className="p-4 rounded-2xl border backdrop-blur-sm text-xs leading-relaxed italic opacity-95 space-y-2" style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
                          <p className="font-serif whitespace-pre-wrap">{reply.replyText}</p>
                          <div className="text-[9px] opacity-40 font-mono text-right pt-1">
                            {new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-[11px] opacity-40 italic font-serif border border-dashed rounded-2xl" style={{ borderColor: 'var(--card-border)' }}>
                          信末尚留白，点击右上角【召唤伴侣回执】听听伴侣的心声。
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 彻底去除冗余灰框的新建日记 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
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
                <h3 className="font-serif font-bold text-base">封存一封心绪信件</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="opacity-50 hover:opacity-100 text-base font-mono"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDiary} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                  选择倾诉的消息框 / 伴侣
                </label>
                <select
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border outline-none font-medium"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                >
                  <option value="random">不绑定特定消息框 (系统随机匹配一名伴侣倾听与回复)</option>
                  {chats.map((c) => {
                    const char = characters.find(ch => ch.id === c.characterId);
                    return (
                      <option key={c.id} value={c.id}>
                        绑定对话: {c.title || `与 ${char?.name || '伴侣'} 的对话`}
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
                    placeholder="如: 清晨微醺"
                    value={newMood}
                    onChange={(e) => setNewMood(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                    当下天气
                  </label>
                  <input
                    type="text"
                    placeholder="如: 细雨 18℃"
                    value={newWeather}
                    onChange={(e) => setNewWeather(e.target.value)}
                    className="w-full p-2 rounded-xl border outline-none"
                    style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                    信件标题
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
                  信件正文
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="requestReplyCheck"
                  checked={requestReply}
                  onChange={(e) => setRequestReply(e.target.checked)}
                  className="rounded accent-purple-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="requestReplyCheck" className="text-[11px] font-medium cursor-pointer flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>在信末即刻附带伴侣的心绪回执</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
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
                  className="px-5 py-2 rounded-full font-semibold transition-transform active:scale-95 disabled:opacity-50 shadow-md"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--accent-foreground)'
                  }}
                >
                  {isSubmitting ? '封存中...' : '封存信件'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 彻底销毁确认 Modal */}
      {deleteTargetId && (
        <ConfirmModal
          title="销毁信件"
          message="确定要彻底销毁这封信件及其伴侣回执吗？此操作不可撤销。"
          confirmText="确认销毁"
          onConfirm={handleDeleteDiary}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
};

export default DiaryApp;
