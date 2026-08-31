// src/apps/newspaper/NewspaperApp.jsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Settings as SettingsIcon, 
  RefreshCw, 
  Scissors, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  BookOpen
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';
import { searchLatestNews } from './newspaperSearchService';
import { generateDailyPost } from './newspaperAiService';
import { NewspaperSettingsModal } from './NewspaperSettingsModal';

export const NewspaperApp = ({ onClose }) => {
  const [currentPost, setCurrentPost] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newspaperSettings, setNewspaperSettings] = useState({
    topics: ['AI 与认知前沿', '独立艺术与设计', '日常哲学与世界观察'],
    tavilyKey: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const savedConfig = await db.settings.get('newspaper_settings');
      if (savedConfig?.value) {
        setNewspaperSettings(savedConfig.value);
      }

      const posts = await db.newspapers.orderBy('createdAt').reverse().toArray();
      setHistoryList(posts);
      if (posts.length > 0) {
        setCurrentPost(posts[0]);
        setCurrentIndex(0);
      }
    } catch (e) {
      console.error('加载报刊历史失败：', e);
    }
  };

  const handleSaveSettings = async (newCfg) => {
    setNewspaperSettings(newCfg);
    await db.settings.put({ key: 'newspaper_settings', value: newCfg });
  };

  const handleGenerateToday = async () => {
    setLoading(true);
    setStatusMessage('正在检索今日网络资讯...');
    try {
      const activeTopic = newspaperSettings.topics[
        Math.floor(Math.random() * newspaperSettings.topics.length)
      ] || '科技与当代生活';

      // 快速检索（带超时熔断）
      const rawNews = await searchLatestNews(activeTopic, newspaperSettings);
      
      setStatusMessage('主编正在编撰与排版...');
      const postData = await generateDailyPost({
        topic: activeTopic,
        rawNews
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      const activeChar = await db.characters.toCollection().first();

      const newRecord = {
        date: todayStr,
        characterId: activeChar?.id || 1,
        characterName: activeChar?.name || '主编',
        editionNumber: postData.editionNumber || `ISSUE ${historyList.length + 1}`,
        headlineLead: postData.headlineLead,
        topic: activeTopic,
        editorNote: postData.editorNote,
        articles: postData.articles || [],
        dailyLexicon: postData.dailyLexicon,
        createdAt: Date.now()
      };

      const savedId = await db.newspapers.add(newRecord);
      newRecord.id = savedId;

      setHistoryList([newRecord, ...historyList]);
      setCurrentPost(newRecord);
      setCurrentIndex(0);
    } catch (err) {
      console.error('印报失败：', err);
      alert('印发失败: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  return (
    // 关键修正：使用 -mx-4 -mt-6 抵消 App.jsx 的外层内边距，实现无缝贴顶
    <div className="-mx-4 -mt-6 flex min-h-[100dvh] flex-col bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-500">
      
      {/* 1. 顶格贴边导航栏 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--text-main)] border-opacity-10 bg-[var(--bg-main)]/90 px-4 py-3.5 backdrop-blur-md">
        <button 
          onClick={onClose} 
          className="p-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center select-none">
          <h2 className="text-[11px] font-mono font-bold tracking-[0.3em] uppercase opacity-90">
            THE DAILY POST
          </h2>
          <p className="text-[8px] font-mono uppercase tracking-widest opacity-40">
            Morning Dispatch
          </p>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)} 
          className="p-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="设置"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </header>

      {/* 2. 报纸主体内容区 */}
      <main className="flex-1 px-5 py-6 flex flex-col items-center">
        {loading ? (
          <div className="my-auto flex flex-col items-center gap-4 py-20 text-center">
            <RefreshCw className="w-6 h-6 animate-spin opacity-40" />
            <div className="space-y-1">
              <p className="text-xs font-mono tracking-wider opacity-80">{statusMessage}</p>
              <p className="text-[10px] font-mono opacity-40">Morning Press in Progress</p>
            </div>
          </div>
        ) : currentPost ? (
          <article className="w-full max-w-[400px] space-y-7 pb-16 select-text animate-fade-in">
            
            {/* 报头区域 (Masthead) */}
            <div className="space-y-2.5 border-b-2 border-[var(--text-main)] pb-4 text-center">
              <div className="flex justify-between items-center text-[9px] font-mono tracking-widest uppercase opacity-40 border-b border-[var(--text-main)] border-opacity-10 pb-1.5">
                <span>{currentPost.editionNumber || 'ISSUE 01'}</span>
                <span>{currentPost.date}</span>
                <span className="truncate max-w-[120px] text-right">{currentPost.topic}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight leading-snug pt-1 text-[var(--text-main)]">
                {currentPost.headlineLead}
              </h1>
            </div>

            {/* 主编寄语 (Editor's Dispatch) */}
            <section className="relative p-5 rounded-2xl bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-40">
                  Editorial Dispatch
                </span>
                <span className="text-[10px] font-serif italic opacity-60">
                  by {currentPost.characterName}
                </span>
              </div>
              <p className="text-xs font-serif leading-relaxed italic opacity-90 tracking-wide">
                “{currentPost.editorNote}”
              </p>
            </section>

            {/* 要闻区块 (Observatories) */}
            <section className="space-y-5">
              <div className="flex items-center gap-2 border-b border-[var(--text-main)] border-opacity-15 pb-1">
                <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                  Global Observatories
                </span>
                <div className="h-[1px] flex-1 bg-[var(--text-main)] opacity-10" />
              </div>

              {(currentPost.articles || []).map((art, idx) => (
                <div 
                  key={idx} 
                  className="space-y-2 border-b border-[var(--text-main)] border-opacity-10 pb-4 last:border-none text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10 opacity-70">
                      {art.tag || 'BRIEF'}
                    </span>
                    <span className="text-[9px] font-mono opacity-40 truncate">
                      {art.source}
                    </span>
                  </div>
                  <h3 className="text-sm font-serif font-bold tracking-tight leading-snug">
                    {art.headline}
                  </h3>
                  <p className="text-xs font-sans opacity-75 leading-relaxed">
                    {art.content}
                  </p>
                </div>
              ))}
            </section>

            {/* 每日生词角 (Cutout Lexicon) */}
            {currentPost.dailyLexicon && (
              <section className="relative p-4 rounded-xl border border-dashed border-[var(--text-main)] border-opacity-30 bg-[var(--control-soft-bg)] space-y-2 text-left">
                <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest opacity-40">
                  <span className="flex items-center gap-1">
                    <Scissors className="w-3 h-3" /> Cutout Lexicon
                  </span>
                  <span>Daily Word</span>
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="font-serif font-bold text-sm tracking-tight">
                    {currentPost.dailyLexicon.word}
                  </span>
                  {currentPost.dailyLexicon.phonetic && (
                    <span className="text-[10px] font-mono opacity-50">
                      {currentPost.dailyLexicon.phonetic}
                    </span>
                  )}
                </div>
                <p className="text-xs font-sans opacity-80">
                  {currentPost.dailyLexicon.translation}
                </p>
                {currentPost.dailyLexicon.quote && (
                  <p className="text-[11px] font-serif italic opacity-60 leading-relaxed pt-1 border-t border-[var(--text-main)] border-opacity-10">
                    “{currentPost.dailyLexicon.quote}”
                  </p>
                )}
              </section>
            )}

            {/* 往期报纸翻阅 (Pagination) */}
            {historyList.length > 1 && (
              <footer className="flex items-center justify-between pt-4 border-t border-[var(--text-main)] border-opacity-15 text-[11px] font-mono">
                <button
                  disabled={currentIndex >= historyList.length - 1}
                  onClick={() => {
                    const next = currentIndex + 1;
                    setCurrentIndex(next);
                    setCurrentPost(historyList[next]);
                  }}
                  className="flex items-center gap-1 opacity-60 disabled:opacity-20 hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4" /> 往期回顾
                </button>
                <span className="opacity-40">{currentIndex + 1} / {historyList.length}</span>
                <button
                  disabled={currentIndex <= 0}
                  onClick={() => {
                    const prev = currentIndex - 1;
                    setCurrentIndex(prev);
                    setCurrentPost(historyList[prev]);
                  }}
                  className="flex items-center gap-1 opacity-60 disabled:opacity-20 hover:opacity-100 transition-opacity"
                >
                  近期晨报 <ChevronRight className="w-4 h-4" />
                </button>
              </footer>
            )}
          </article>
        ) : (
          <div className="my-auto flex flex-col items-center gap-4 py-20 text-center max-w-xs">
            <div className="w-12 h-12 rounded-2xl bg-[var(--control-soft-bg)] flex items-center justify-center border border-[var(--text-main)] border-opacity-10">
              <BookOpen className="w-5 h-5 opacity-60" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold tracking-tight">今日晨刊尚未排印</h4>
              <p className="text-[11px] opacity-50 leading-relaxed">
                主编已就绪，点击下方按钮检索并编撰属于今天的独立早报。
              </p>
            </div>
            <button
              onClick={handleGenerateToday}
              className="mt-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 transition-opacity shadow-sm"
            >
              印发今日晨报
            </button>
          </div>
        )}
      </main>

      {/* 3. 底部重印常驻栏 */}
      {currentPost && !loading && (
        <footer className="sticky bottom-0 z-20 p-3 border-t border-[var(--text-main)] border-opacity-10 flex justify-center bg-[var(--bg-main)]/90 backdrop-blur-md">
          <button
            onClick={handleGenerateToday}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 opacity-60" /> 重新编撰今日刊
          </button>
        </footer>
      )}

      {/* 设置弹窗 */}
      <NewspaperSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={newspaperSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default NewspaperApp;
