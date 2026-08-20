import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, PenTool, Sparkles, RefreshCw,
  Trash2, Filter, Heart, Mail, Sparkle
} from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import {
  generateCompanionReplyForDiary,
  generateCompanionProactiveDiary
} from '../../services/aiService';

export const DiaryApp = ({ onBackHub }) => {
  const [diaries, setDiaries] = useState([]);
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);

  // 展开信封 ID 集合
  const [openEnvelopeIds, setOpenEnvelopeIds] = useState(new Set());

  // 核心三大分类: 'all' | 'user' | 'character'
  const [authorTab, setAuthorTab] = useState('all');
  const [selectedChatId, setSelectedChatId] = useState('all');
  const [selectedCharId, setSelectedCharId] = useState('all');

  // 新建日记 Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMood, setNewMood] = useState('');
  const [newWeather, setNewWeather] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newChatId, setNewChatId] = useState('random');
  const [requestReply, setRequestReply] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 伴侣主动写信 Loading
  const [isGeneratingProactive, setIsGeneratingProactive] = useState(false);

  // 删除 Modal Target ID
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
      const targetChat = chats.find((chat) => chat.id === boundChatId);

      if (targetChat) {
        boundCharId = targetChat.characterId;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const payload = {
      chatId: boundChatId,
      characterId: boundCharId,
      author: 'user',
      title: newTitle.trim() || '无题心绪信件',
      mood: newMood.trim() || '平静微醺',
      weather: newWeather.trim() || '晴朗',
      content: newContent.trim(),
      companionReply: null,
      images: [],
      date: todayStr,
      timestamp: Date.now()
    };

    delete payload.id;

    const newDiaryId = await db.diaries.add(payload);

    if (requestReply) {
      await generateCompanionReplyForDiary(newDiaryId);
    }

    setNewTitle('');
    setNewMood('');
    setNewWeather('');
    setNewContent('');
    setShowCreateModal(false);
    setIsSubmitting(false);

    setOpenEnvelopeIds((prev) => new Set(prev).add(newDiaryId));
    loadDiaries();
  };

  const handleTriggerProactiveDiary = async () => {
    setIsGeneratingProactive(true);

    const targetChatId = selectedChatId !== 'all'
      ? parseInt(selectedChatId, 10)
      : null;

    const newId = await generateCompanionProactiveDiary(targetChatId);

    setIsGeneratingProactive(false);

    if (newId) {
      setOpenEnvelopeIds((prev) => new Set(prev).add(newId));
      loadDiaries();
    }
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

  // 三大核心分类过滤逻辑
  const filteredDiaries = diaries.filter((item) => {
    if (authorTab === 'user' && item.author !== 'user') return false;
    if (authorTab === 'character' && item.author !== 'character') return false;
    if (selectedChatId !== 'all' && item.chatId?.toString() !== selectedChatId.toString()) return false;
    if (selectedCharId !== 'all' && item.characterId?.toString() !== selectedCharId.toString()) return false;

    return true;
  });

  return (
    <div className="space-y-5 animate-fade-in-up pb-10 text-left">
      <style>{`
        .diary-envelope-shell {
          --envelope-paper: var(--card-bg);
          --envelope-fold: var(--control-soft-bg);
          --envelope-line: var(--card-border);
          --envelope-ink: var(--text-main);
          --envelope-soft-ink: var(--text-sub);
          --envelope-seal: var(--accent-color);
          --envelope-seal-ink: var(--accent-foreground);
          position: relative;
          perspective: 1200px;
          animation:
            diary-envelope-enter 620ms cubic-bezier(0.22, 0.85, 0.31, 1) both,
            diary-envelope-drift 7s ease-in-out var(--envelope-drift-delay) infinite;
        }

        .diary-envelope-clickable {
          position: relative;
          height: 220px;
          cursor: pointer;
          transform-style: preserve-3d;
          outline: none;
          transition: transform 420ms cubic-bezier(0.22, 0.85, 0.31, 1);
        }

        .diary-envelope-clickable:hover {
          transform: translateY(-4px) rotate(var(--envelope-tilt));
        }

        .diary-envelope-clickable:focus-visible {
          border-radius: 0.75rem;
          box-shadow: 0 0 0 2px var(--accent-color);
        }

        .diary-envelope-back,
        .diary-envelope-front,
        .diary-envelope-flap,
        .diary-envelope-fold-left,
        .diary-envelope-fold-right,
        .diary-envelope-fold-bottom {
          position: absolute;
          inset: 0;
        }

        .diary-envelope-back {
          background: var(--envelope-paper);
          border: 1px solid var(--envelope-line);
          border-radius: 0.8rem;
          box-shadow: 0 14px 30px color-mix(in srgb, var(--text-main) 10%, transparent);
        }

        .diary-envelope-front {
          z-index: 4;
          overflow: hidden;
          border: 1px solid var(--envelope-line);
          border-radius: 0.8rem;
          background: var(--envelope-paper);
          clip-path: polygon(0 43%, 50% 76%, 100% 43%, 100% 100%, 0 100%);
          pointer-events: none;
        }

        .diary-envelope-fold-left {
          z-index: 5;
          background: var(--envelope-fold);
          opacity: 0.72;
          clip-path: polygon(0 0, 50% 54%, 0 100%);
          pointer-events: none;
        }

        .diary-envelope-fold-right {
          z-index: 5;
          background: var(--envelope-fold);
          opacity: 0.52;
          clip-path: polygon(100% 0, 50% 54%, 100% 100%);
          pointer-events: none;
        }

        .diary-envelope-fold-bottom {
          z-index: 6;
          background: var(--envelope-paper);
          border-top: 1px solid var(--envelope-line);
          clip-path: polygon(0 100%, 50% 18%, 100% 100%);
          pointer-events: none;
        }

        .diary-envelope-flap {
          z-index: 8;
          height: 57%;
          bottom: auto;
          transform-origin: top center;
          transform-style: preserve-3d;
          transition: transform 760ms cubic-bezier(0.22, 0.85, 0.31, 1);
          background: var(--envelope-fold);
          border: 1px solid var(--envelope-line);
          border-bottom: 0;
          border-radius: 0.8rem 0.8rem 0 0;
          clip-path: polygon(0 0, 100% 0, 50% 100%);
          backface-visibility: hidden;
          pointer-events: none;
        }

        .diary-envelope-flap::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: 13%;
          width: 0.45rem;
          height: 0.45rem;
          border-right: 1px solid var(--envelope-line);
          border-bottom: 1px solid var(--envelope-line);
          transform: translateX(-50%) rotate(45deg);
          opacity: 0.75;
        }

        .diary-envelope-clickable.is-open .diary-envelope-flap {
          transform: rotateX(178deg);
        }

        .diary-envelope-address {
          position: absolute;
          z-index: 7;
          left: 1.35rem;
          right: 1.35rem;
          bottom: 1.2rem;
          display: flex;
          min-width: 0;
          align-items: flex-end;
          justify-content: space-between;
          gap: 0.75rem;
          transition: opacity 240ms ease, transform 240ms ease;
        }

        .diary-envelope-clickable.is-open .diary-envelope-address {
          opacity: 0;
          transform: translateY(0.75rem);
        }

        .diary-envelope-recipient {
          min-width: 0;
        }

        .diary-envelope-recipient-label,
        .diary-envelope-stamp-line,
        .diary-letter-kicker {
          color: var(--envelope-soft-ink);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.56rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .diary-envelope-title {
          margin-top: 0.28rem;
          max-width: 13rem;
          overflow: hidden;
          color: var(--envelope-ink);
          font-family: ui-serif, Georgia, serif;
          font-size: 1rem;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .diary-envelope-meta {
          margin-top: 0.28rem;
          color: var(--envelope-soft-ink);
          font-size: 0.62rem;
          opacity: 0.78;
        }

        .diary-envelope-postmark {
          display: flex;
          width: 3.15rem;
          height: 3.15rem;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px dashed var(--envelope-line);
          color: var(--envelope-soft-ink);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.5rem;
          line-height: 1.35;
          text-align: center;
          transform: rotate(5deg);
          opacity: 0.72;
        }

        .diary-envelope-seal {
          position: absolute;
          z-index: 10;
          top: 49%;
          left: 50%;
          display: flex;
          width: 2.6rem;
          height: 2.6rem;
          align-items: center;
          justify-content: center;
          border: 3px solid var(--envelope-paper);
          border-radius: 9999px;
          background: var(--envelope-seal);
          color: var(--envelope-seal-ink);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--text-main) 18%, transparent);
          transform: translate(-50%, -50%);
          transition: transform 400ms ease, opacity 260ms ease;
          pointer-events: none;
        }

        .diary-envelope-clickable:hover .diary-envelope-seal {
          transform: translate(-50%, -50%) scale(1.08);
        }

        .diary-envelope-clickable.is-open .diary-envelope-seal {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.7);
        }

        .diary-letter-stage {
          position: relative;
          z-index: 12;
          margin: -3.3rem 0.75rem 0;
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transform: translateY(2.5rem);
          transition:
            max-height 920ms cubic-bezier(0.22, 0.85, 0.31, 1),
            opacity 280ms ease 100ms,
            transform 760ms cubic-bezier(0.22, 0.85, 0.31, 1);
        }

        .diary-envelope-shell.is-open .diary-letter-stage {
          max-height: 2400px;
          overflow: visible;
          opacity: 1;
          transform: translateY(0);
        }

        .diary-letter-paper {
          position: relative;
          margin-bottom: 1rem;
          padding: 2.25rem 1.3rem 1.4rem;
          border: 1px solid var(--envelope-line);
          border-radius: 0.35rem;
          background: var(--bg-main);
          box-shadow: 0 16px 34px color-mix(in srgb, var(--text-main) 11%, transparent);
          color: var(--text-main);
        }

        .diary-letter-paper::before,
        .diary-letter-paper::after {
          position: absolute;
          color: var(--divider);
          font-family: ui-serif, Georgia, serif;
          font-size: 2.2rem;
          line-height: 1;
          opacity: 0.7;
        }

        .diary-letter-paper::before {
          content: '“';
          top: 0.58rem;
          left: 0.9rem;
        }

        .diary-letter-paper::after {
          content: '”';
          right: 0.9rem;
          bottom: 0.3rem;
        }

        .diary-letter-reply {
          margin-top: 1.5rem;
          padding-top: 1.15rem;
          border-top: 1px dashed var(--divider);
        }

        .diary-letter-reply-paper {
          margin-top: 0.7rem;
          padding: 1rem;
          border-left: 2px solid var(--accent-color);
          background: var(--control-soft-bg);
          color: var(--text-main);
        }

        @keyframes diary-envelope-enter {
          from {
            opacity: 0;
            transform: translateY(1.4rem) rotate(calc(var(--envelope-tilt) * 2));
          }

          to {
            opacity: 1;
            transform: translateY(0) rotate(var(--envelope-tilt));
          }
        }

        @keyframes diary-envelope-drift {
          0%, 100% {
            transform: translateY(0) rotate(var(--envelope-tilt));
          }

          50% {
            transform: translateY(-0.24rem) rotate(calc(var(--envelope-tilt) + 0.18deg));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .diary-envelope-shell,
          .diary-envelope-clickable,
          .diary-envelope-flap,
          .diary-letter-stage,
          .diary-envelope-address,
          .diary-envelope-seal {
            animation: none;
            transition-duration: 0.01ms;
          }
        }
      `}</style>

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerProactiveDiary}
            disabled={isGeneratingProactive}
            className="px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-transform active:scale-95 disabled:opacity-50"
            style={{
              borderColor: 'var(--card-border)',
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)'
            }}
            title="邀请伴侣主动写下一封信件"
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${isGeneratingProactive ? 'animate-spin' : ''}`}
              style={{ color: 'var(--accent-color)' }}
            />
            <span>伴侣落笔</span>
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
            <span>提笔写信</span>
          </button>
        </div>
      </div>

      {/* Title */}
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

      {/* 三大分类 Tab */}
      <div
        className="flex items-center gap-6 text-xs font-medium border-b pb-2 px-1"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          type="button"
          onClick={() => setAuthorTab('all')}
          className={`relative pb-1.5 transition-all ${
            authorTab === 'all'
              ? 'font-bold opacity-100'
              : 'opacity-40 hover:opacity-70'
          }`}
          style={{ color: 'var(--text-main)' }}
        >
          全部日记 ({diaries.length})
          {authorTab === 'all' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
              style={{ backgroundColor: 'var(--text-main)' }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAuthorTab('user')}
          className={`relative pb-1.5 transition-all ${
            authorTab === 'user'
              ? 'font-bold opacity-100'
              : 'opacity-40 hover:opacity-70'
          }`}
          style={{ color: 'var(--text-main)' }}
        >
          我的日记
          {authorTab === 'user' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
              style={{ backgroundColor: 'var(--text-main)' }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAuthorTab('character')}
          className={`relative pb-1.5 transition-all ${
            authorTab === 'character'
              ? 'font-bold opacity-100'
              : 'opacity-40 hover:opacity-70'
          }`}
          style={{ color: 'var(--text-main)' }}
        >
          伴侣日记
          {authorTab === 'character' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
              style={{ backgroundColor: 'var(--text-main)' }}
            />
          )}
        </button>
      </div>

      {/* 下拉筛选 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <Filter className="w-3.5 h-3.5 opacity-40 shrink-0" />
          <select
            value={selectedChatId}
            onChange={(e) => setSelectedChatId(e.target.value)}
            className="w-full bg-transparent outline-none font-medium truncate"
            style={{ color: 'var(--text-main)' }}
          >
            <option value="all">所有对话窗口</option>
            {chats.map((chat) => {
              const char = characters.find((item) => item.id === chat.characterId);

              return (
                <option key={chat.id} value={chat.id}>
                  {chat.title || `与 ${char?.name || '伴侣'} 的对话`}
                </option>
              );
            })}
          </select>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)'
          }}
        >
          <Heart className="w-3.5 h-3.5 opacity-40 shrink-0" />
          <select
            value={selectedCharId}
            onChange={(e) => setSelectedCharId(e.target.value)}
            className="w-full bg-transparent outline-none font-medium truncate"
            style={{ color: 'var(--text-main)' }}
          >
            <option value="all">所有伴侣对象</option>
            {characters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 独立纸质信封列表：点击信封后才抽出信纸 */}
      <div className="space-y-7 pt-2">
        {filteredDiaries.length === 0 ? (
          <div
            className="py-16 text-center space-y-3 border"
            style={{
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <Mail className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs font-serif italic opacity-45">
              这里还没有封存的信件。
            </p>
          </div>
        ) : (
          filteredDiaries.map((diary, index) => {
            const isOpen = openEnvelopeIds.has(diary.id);
            const isUser = diary.author === 'user';
            const reply = diary.companionReply;

            const char = reply
              ? characters.find((item) => item.id === reply.characterId)
              : (
                diary.characterId
                  ? characters.find((item) => item.id === diary.characterId)
                  : null
              );

            const chat = chats.find((item) => item.id === diary.chatId);

            const senderName = isUser ? '我' : (char?.name || '伴侣');
            const recipientName = isUser
              ? (chat?.title || '一处私密收信地址')
              : '我';

            const envelopeTilt = `${((index % 5) - 2) * 0.38}deg`;
            const motionDelay = `${(index % 6) * 90}ms`;
            const driftDelay = `${(index % 5) * -0.78}s`;

            return (
              <div
                key={diary.id}
                className={`diary-envelope-shell ${isOpen ? 'is-open' : ''}`}
                style={{
                  '--envelope-tilt': envelopeTilt,
                  '--envelope-drift-delay': driftDelay,
                  animationDelay: motionDelay
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? '收起' : '打开'}信件：${diary.title || '无题心绪信件'}`}
                  onClick={() => toggleEnvelope(diary.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleEnvelope(diary.id);
                    }
                  }}
                  className={`diary-envelope-clickable ${isOpen ? 'is-open' : ''}`}
                >
                  <div className="diary-envelope-back" />
                  <div className="diary-envelope-front" />
                  <div className="diary-envelope-fold-left" />
                  <div className="diary-envelope-fold-right" />
                  <div className="diary-envelope-fold-bottom" />
                  <div className="diary-envelope-flap" />

                  <div className="diary-envelope-seal">
                    {isUser ? (
                      <PenTool className="w-3.5 h-3.5" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="diary-envelope-address">
                    <div className="diary-envelope-recipient">
                      <div className="diary-envelope-recipient-label">
                        FROM · {senderName}
                      </div>

                      <h3 className="diary-envelope-title">
                        {diary.title || '无题心绪信件'}
                      </h3>

                      <p className="diary-envelope-meta">
                        TO · {recipientName}
                      </p>
                    </div>

                    <div className="diary-envelope-postmark">
                      <span>{diary.date || '未标日期'}</span>
                      <span>
                        {reply
                          ? 'REPLIED'
                          : (isUser ? 'SEALED' : 'DELIVERED')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="diary-letter-stage">
                  <article className="diary-letter-paper">
                    <div
                      className="flex items-start justify-between gap-3 border-b pb-3"
                      style={{ borderColor: 'var(--divider)' }}
                    >
                      <div className="min-w-0">
                        <p className="diary-letter-kicker">
                          {isUser
                            ? 'MY SEALED LETTER'
                            : 'A LETTER FROM COMPANION'}
                        </p>

                        <h3 className="mt-1 font-serif text-lg font-bold tracking-tight">
                          {diary.title || '无题心绪信件'}
                        </h3>

                        <p className="mt-1 text-[10px] opacity-50">
                          {diary.date} · 心绪：{diary.mood || '未记'} · 天气：{diary.weather || '未记'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTargetId(diary.id);
                        }}
                        className="shrink-0 p-1.5 opacity-45 transition-opacity hover:opacity-100"
                        style={{ color: 'var(--text-main)' }}
                        title="抹去这封信件"
                        aria-label="抹去这封信件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="pt-5">
                      <p className="whitespace-pre-wrap text-xs leading-7 opacity-90">
                        {diary.content}
                      </p>
                    </div>

                    {/* 用户日记下方嵌入伴侣回信 */}
                    {isUser && (
                      <div className="diary-letter-reply">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            {char?.avatar ? (
                              <img
                                src={char.avatar}
                                alt={char.name}
                                className="h-6 w-6 rounded-full object-cover"
                                style={{ border: '1px solid var(--card-border)' }}
                              />
                            ) : (
                              <div
                                className="flex h-6 w-6 items-center justify-center rounded-full"
                                style={{
                                  background: 'var(--control-soft-bg)',
                                  border: '1px solid var(--card-border)'
                                }}
                              >
                                <Mail className="w-3 h-3 opacity-60" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="diary-letter-kicker">REPLY LETTER</p>
                              <p className="truncate text-xs font-semibold">
                                {reply
                                  ? `${reply.characterName || char?.name || '伴侣'} 的信末回执`
                                  : '信末仍留有空白'}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRerollReply(diary.id);
                            }}
                            disabled={isRerollingId === diary.id}
                            className="flex shrink-0 items-center gap-1 border px-2 py-1 text-[10px] transition-transform active:scale-95 disabled:opacity-50"
                            style={{
                              background: 'var(--bg-main)',
                              borderColor: 'var(--card-border)',
                              color: 'var(--text-main)'
                            }}
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                isRerollingId === diary.id ? 'animate-spin' : ''
                              }`}
                            />
                            <span>{reply ? '重写回信' : '邀请回信'}</span>
                          </button>
                        </div>

                        {reply ? (
                          <div className="diary-letter-reply-paper">
                            <p className="whitespace-pre-wrap font-serif text-xs leading-7 italic">
                              {reply.replyText}
                            </p>

                            <p className="mt-3 text-right font-mono text-[9px] opacity-40">
                              {new Date(reply.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ) : (
                          <div
                            className="mt-3 border border-dashed px-4 py-5 text-center font-serif text-[11px] italic opacity-45"
                            style={{ borderColor: 'var(--card-border)' }}
                          >
                            点击「邀请回信」，让伴侣在这张信纸的末尾留下文字。
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 封存新信件 Modal */}
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
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--divider)' }}
            >
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
                  style={{
                    background: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                >
                  <option value="random">
                    不绑定特定消息框 (系统随机匹配一名伴侣倾听与回复)
                  </option>

                  {chats.map((chat) => {
                    const char = characters.find((item) => item.id === chat.characterId);

                    return (
                      <option key={chat.id} value={chat.id}>
                        绑定对话: {chat.title || `与 ${char?.name || '伴侣'} 的对话`}
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
                    style={{
                      background: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)'
                    }}
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
                    style={{
                      background: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)'
                    }}
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
                    style={{
                      background: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)'
                    }}
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
                  style={{
                    background: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-main)'
                  }}
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="requestReplyCheck"
                  checked={requestReply}
                  onChange={(e) => setRequestReply(e.target.checked)}
                  className="rounded w-4 h-4 cursor-pointer"
                  style={{ accentColor: 'var(--accent-color)' }}
                />

                <label
                  htmlFor="requestReplyCheck"
                  className="text-[11px] font-medium cursor-pointer flex items-center gap-1"
                >
                  <Sparkles
                    className="w-3.5 h-3.5"
                    style={{ color: 'var(--accent-color)' }}
                  />
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

      {/* 删除确认 Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="抹去信纸"
        message="确定要彻底抹去这封信件及其伴侣回执吗？此操作不可撤销。"
        confirmText="确认抹去"
        cancelText="取消"
        onConfirm={handleDeleteDiary}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

export default DiaryApp;
