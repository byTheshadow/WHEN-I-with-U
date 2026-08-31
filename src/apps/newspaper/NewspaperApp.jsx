// src/apps/newspaper/NewspaperApp.jsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Settings as SettingsIcon, 
  RefreshCw, 
  Scissors, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  Feather
} from 'lucide-react';
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
    tavilyKey: '',
    autoClean: true
  });

  useEffect(() => {
    loadData();
  }, []);

  // 清除两天前的旧报纸 (48小时以前)
  const cleanOldPosts = async () => {
    try {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const oldPosts = await db.newspapers.filter(p => p.createdAt < twoDaysAgo).toArray();
      if (oldPosts.length > 0) {
        const idsToDelete = oldPosts.map(p => p.id).filter(Boolean);
        await db.newspapers.bulkDelete(idsToDelete);
        const remaining = await db.newspapers.orderBy('createdAt').reverse().toArray();
        setHistoryList(remaining);
        if (remaining.length > 0) {
          setCurrentPost(remaining[0]);
          setCurrentIndex(0);
        } else {
          setCurrentPost(null);
        }
      }
      return oldPosts.length;
    } catch (e) {
      console.error('清理旧报纸失败：', e);
      return 0;
    }
  };

  const loadData = async () => {
    try {
      const savedConfig = await db.settings.get('newspaper_settings');
      let currentCfg = {
        topics: ['AI 与认知前沿', '独立艺术与设计', '日常哲学与世界观察'],
        tavilyKey: '',
        autoClean: true
      };

      if (savedConfig?.value) {
        currentCfg = { ...currentCfg, ...savedConfig.value };
        setNewspaperSettings(currentCfg);
      }

      // 如果开启了自动清理，先清扫 2 天前数据
      if (currentCfg.autoClean) {
        const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
        const oldPosts = await db.newspapers.filter(p => p.createdAt < twoDaysAgo).toArray();
        if (oldPosts.length > 0) {
          const ids = oldPosts.map(p => p.id).filter(Boolean);
          await db.newspapers.bulkDelete(ids);
        }
      }

      const posts = await db.newspapers.orderBy('createdAt').reverse().toArray();
      setHistoryList(posts);
      if (posts.length > 0) {
        setCurrentPost(posts[0]);
        setCurrentIndex(0);
      }
    } catch (e) {
      console.error('加载报刊数据失败：', e);
    }
  };

  const handleSaveSettings = async (newCfg) => {
    setNewspaperSettings(newCfg);
    await db.settings.put({ key: 'newspaper_settings', value: newCfg });
    if (newCfg.autoClean) {
      await cleanOldPosts();
    }
  };

  const handleGenerateToday = async () => {
    setLoading(true);
    setStatusMessage('正在检索今日网络资讯...');
    try {
      const activeTopic = newspaperSettings.topics[
        Math.floor(Math.random() * newspaperSettings.topics.length)
      ] || '科技与当代生活';

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
        editionNumber: postData.editionNumber || `NO. ${historyList.length + 1}`,
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
    <div className="-mx-4 -mt-6 flex min-h-[100dvh] flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
      
      {/* 顶部极简操作条 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--text-main)] border-opacity-15 bg-[var(--bg-main)]/95 px-4 py-2.5 backdrop-blur-md">
        <button 
          onClick={onClose} 
          className="p-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center font-serif">
          <span className="text-[10px] tracking-[0.25em] font-bold uppercase opacity-80">
            THE MORNING PRESS
          </span>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)} 
          className="p-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="设置"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </header>

      {/* 核心报纸展卷区 */}
      <main className="flex-1 px-3 py-4 flex flex-col items-center">
        {loading ? (
          <div className="my-auto flex flex-col items-center gap-4 py-24 text-center">
            <RefreshCw className="w-6 h-6 animate-spin opacity-40" />
            <div className="space-y-1">
              <p className="text-xs font-serif tracking-wider opacity-80">{statusMessage}</p>
              <p className="text-[10px] font-mono opacity-40 uppercase">Printing Edition...</p>
            </div>
          </div>
        ) : currentPost ? (
          /* 经典纸张容器：具有轻微内阴影与纸感边缘 */
          <article className="relative w-full max-w-[420px] rounded-lg border border-[var(--text-main)] border-opacity-20 bg-[var(--control-soft-bg)] p-5 shadow-sm space-y-5 pb-12 select-text">
            
            {/* 1. 经典复古大报头 (Broadsheet Masthead) */}
            <header className="text-center space-y-2">
              <div className="flex justify-between items-center text-[8px] font-mono uppercase tracking-widest opacity-60 border-b border-[var(--text-main)] border-opacity-20 pb-1">
                <span>{currentPost.editionNumber}</span>
                <span>{currentPost.date}</span>
                <span className="truncate max-w-[120px]">{currentPost.topic}</span>
              </div>

              {/* 经典报纸衬线大标题 */}
              <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight uppercase leading-none py-1">
                NEWS PAPER
              </h1>

              {/* 报纸次标题横幅 */}
              <div className="border-y-2 border-[var(--text-main)] border-opacity-80 py-1 flex items-center justify-between text-[9px] font-serif italic tracking-wide">
                <span>“Informed Today, Empowered Tomorrow”</span>
                <span className="font-mono text-[8px] uppercase not-italic font-bold tracking-widest">
                  SPECIAL EDITION
                </span>
              </div>
            </header>

            {/* 2. 头版主头条 (Lead Story Banner) */}
            <section className="space-y-2 border-b border-[var(--text-main)] border-opacity-20 pb-4">
              <h2 className="text-lg sm:text-xl font-serif font-bold leading-tight tracking-tight text-left">
                {currentPost.headlineLead}
              </h2>

              {/* 主编手记：经典双排引用栏 */}
              <div className="relative border-l-2 border-[var(--text-main)] border-opacity-40 pl-3 py-1 space-y-1 text-left bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider opacity-60">
                  <Feather className="w-3 h-3" />
                  <span>Editor's Note · {currentPost.characterName}</span>
                </div>
                <p className="text-xs font-serif leading-relaxed italic opacity-90">
                  <span className="float-left text-2xl font-serif font-bold leading-none pr-1.5 pt-0.5 opacity-90">
                    {currentPost.editorNote?.charAt(0) || '“'}
                  </span>
                  {currentPost.editorNote?.slice(1)}
                </p>
              </div>
            </section>

            {/* 3. 经典双栏要闻排版 (Two-Column Broadsheet Layout) */}
            <section className="grid grid-cols-2 gap-3 text-left">
              {(currentPost.articles || []).map((art, idx) => (
                <div 
                  key={idx} 
                  className={`space-y-1.5 ${
                    idx % 2 === 0 
                      ? 'border-r border-[var(--text-main)] border-opacity-15 pr-3' 
                      : 'pl-1'
                  } ${idx >= 2 ? 'border-t border-[var(--text-main)] border-opacity-15 pt-3' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[7px] font-mono font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-[var(--text-main)] text-[var(--bg-main)]">
                      {art.tag || 'TOPIC'}
                    </span>
                    <span className="text-[8px] font-mono opacity-40 truncate max-w-[70px]">
                      {art.source}
                    </span>
                  </div>
                  <h3 className="text-xs font-serif font-bold leading-snug line-clamp-2">
                    {art.headline}
                  </h3>
                  <p className="text-[11px] font-serif opacity-75 leading-relaxed line-clamp-4 text-justify">
                    {art.content}
                  </p>
                </div>
              ))}
            </section>

            {/* 4. 每日生词撕角 (Daily Lexicon Cutout Box) */}
            {currentPost.dailyLexicon && (
              <section className="relative rounded border border-dashed border-[var(--text-main)] border-opacity-40 p-3 space-y-1.5 text-left bg-black/[0.015] dark:bg-white/[0.015]">
                <div className="flex items-center justify-between text-[8px] font-mono uppercase tracking-widest opacity-50 border-b border-dashed border-[var(--text-main)] border-opacity-20 pb-1">
                  <span className="flex items-center gap-1">
                    <Scissors className="w-3 h-3" /> Cutout Lexicon
                  </span>
                  <span>Daily Word</span>
                </div>
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="font-serif font-bold text-sm">
                    {currentPost.dailyLexicon.word}
                  </span>
                  {currentPost.dailyLexicon.phonetic && (
                    <span className="text-[9px] font-mono opacity-50">
                      {currentPost.dailyLexicon.phonetic}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-serif opacity-80 leading-snug">
                  {currentPost.dailyLexicon.translation}
                </p>
                {currentPost.dailyLexicon.quote && (
                  <p className="text-[10px] font-serif italic opacity-60 leading-relaxed border-t border-[var(--text-main)] border-opacity-10 pt-1">
                    “{currentPost.dailyLexicon.quote}”
                  </p>
                )}
              </section>
            )}

            {/* 5. 报刊底部双线与往期翻阅 (Broadsheet Footer & Pagination) */}
            <footer className="border-t-2 border-[var(--text-main)] border-opacity-80 pt-3 flex items-center justify-between text-[10px] font-mono opacity-70">
              {historyList.length > 1 ? (
                <>
                  <button
                    disabled={currentIndex >= historyList.length - 1}
                    onClick={() => {
                      const next = currentIndex + 1;
                      setCurrentIndex(next);
                      setCurrentPost(historyList[next]);
                    }}
                    className="flex items-center gap-0.5 hover:opacity-100 disabled:opacity-20 transition-opacity"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> 往期
                  </button>
                  <span className="opacity-50 font-serif">
                    PAGE {currentIndex + 1} OF {historyList.length}
                  </span>
                  <button
                    disabled={currentIndex <= 0}
                    onClick={() => {
                      const prev = currentIndex - 1;
                      setCurrentIndex(prev);
                      setCurrentPost(historyList[prev]);
                    }}
                    className="flex items-center gap-0.5 hover:opacity-100 disabled:opacity-20 transition-opacity"
                  >
                    近期 <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="w-full text-center font-serif text-[9px] uppercase tracking-widest opacity-50">
                  First Issue · Complete Archive
                </div>
              )}
            </footer>
          </article>
        ) : (
          <div className="my-auto flex flex-col items-center gap-4 py-20 text-center max-w-xs">
            <div className="w-12 h-12 rounded-2xl bg-[var(--control-soft-bg)] flex items-center justify-center border border-[var(--text-main)] border-opacity-15">
              <BookOpen className="w-5 h-5 opacity-60" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-serif font-bold tracking-tight">今日晨刊尚未排印</h4>
              <p className="text-[11px] font-serif opacity-50 leading-relaxed">
                主编已就绪，点击下方按钮检索并编撰属于今天的独立早报。
              </p>
            </div>
            <button
              onClick={handleGenerateToday}
              className="mt-2 px-5 py-2.5 text-xs font-serif font-bold rounded-xl bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 transition-opacity shadow-sm"
            >
              印发今日晨报
            </button>
          </div>
        )}
      </main>

      {/* 底部重印常驻栏 */}
      {currentPost && !loading && (
        <footer className="sticky bottom-0 z-20 p-2.5 border-t border-[var(--text-main)] border-opacity-10 flex justify-center bg-[var(--bg-main)]/90 backdrop-blur-md">
          <button
            onClick={handleGenerateToday}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-serif font-bold rounded-full bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-15 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
        onCleanOldPosts={cleanOldPosts}
      />
    </div>
  );
};

export default NewspaperApp;
