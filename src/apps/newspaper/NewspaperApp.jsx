// src/apps/newspaper/NewspaperApp.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Settings as SettingsIcon, 
  RefreshCw, 
  Share2, 
  Calendar, 
  BookMarked, 
  Layers,
  ChevronLeft,
  ChevronRight
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
    topics: ['AI 科技与前沿', '文学与艺术', '世界观察'],
    tavilyKey: ''
  });

  const newspaperRef = useRef(null);

  // 加载设置与历史
  useEffect(() => {
    loadSettingsAndHistory();
  }, []);

  const loadSettingsAndHistory = async () => {
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
      console.error('加载报纸失败：', e);
    }
  };

  const handleSaveSettings = async (newCfg) => {
    setNewspaperSettings(newCfg);
    await db.settings.put({ key: 'newspaper_settings', value: newCfg });
  };

  // 生成今日晨报
  const handleGenerateToday = async () => {
    setLoading(true);
    setStatusMessage('正在检索今日真实资讯...');
    try {
      const activeTopic = newspaperSettings.topics[
        Math.floor(Math.random() * newspaperSettings.topics.length)
      ] || '科技与生活';

      const rawNews = await searchLatestNews(activeTopic, newspaperSettings);
      
      setStatusMessage('主编正在排版并撰写晨语...');
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
        editionTitle: postData.editionTitle,
        topic: postData.topic,
        editorNote: postData.editorNote,
        articles: postData.articles,
        dailyWord: postData.dailyWord,
        createdAt: Date.now()
      };

      const savedId = await db.newspapers.add(newRecord);
      newRecord.id = savedId;

      setHistoryList([newRecord, ...historyList]);
      setCurrentPost(newRecord);
      setCurrentIndex(0);
    } catch (err) {
      console.error('生成失败：', err);
      alert('生成失败: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  // 简易图片导出（绘制现代极简卡片）
  const handleExportImage = () => {
    if (!currentPost) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 800;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;

    // 背景
    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(0, 0, width, height);

    // 边框
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // 报头
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 36px serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE DAILY POST', width / 2, 90);

    ctx.font = '12px monospace';
    ctx.fillText(`${currentPost.date} · ${currentPost.editionTitle || 'EDITION'}`, width / 2, 120);

    // 分割线
    ctx.beginPath();
    ctx.moveTo(50, 140);
    ctx.lineTo(width - 50, 140);
    ctx.stroke();

    // 主编晨语
    ctx.font = 'italic 16px serif';
    ctx.fillStyle = '#444444';
    ctx.textAlign = 'left';
    const note = `“ ${currentPost.editorNote} ” —— ${currentPost.characterName || '主编'}`;
    ctx.fillText(note.slice(0, 42), 60, 180);
    if (note.length > 42) ctx.fillText(note.slice(42, 85), 60, 205);

    // 文章列表
    let y = 260;
    (currentPost.articles || []).slice(0, 3).forEach((art, idx) => {
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`[${art.category || 'TOPIC'}] ${art.headline}`, 60, y);
      
      ctx.fillStyle = '#555555';
      ctx.font = '14px sans-serif';
      ctx.fillText((art.summary || '').slice(0, 48), 60, y + 30);
      if ((art.summary || '').length > 48) {
        ctx.fillText((art.summary || '').slice(48, 96), 60, y + 55);
      }
      y += 110;
    });

    // 词角
    if (currentPost.dailyWord) {
      ctx.fillStyle = '#222222';
      ctx.strokeRect(50, height - 180, width - 100, 110);
      ctx.font = 'bold 18px serif';
      ctx.fillText(`每日词角: ${currentPost.dailyWord.word} ${currentPost.dailyWord.phonetic || ''}`, 70, height - 140);
      ctx.font = '14px sans-serif';
      ctx.fillText(`释义: ${currentPost.dailyWord.definition}`, 70, height - 110);
      ctx.font = 'italic 12px serif';
      ctx.fillText(`“${currentPost.dailyWord.contextSentence}”`, 70, height - 85);
    }

    const link = document.createElement('a');
    link.download = `daily-post-${currentPost.date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between border-b border-[var(--text-main)] border-opacity-10 px-4 py-3">
        <button onClick={onClose} className="p-1 opacity-70 hover:opacity-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-xs font-mono font-bold tracking-[0.25em] uppercase">THE DAILY POST</h2>
          <p className="text-[9px] opacity-40 font-mono">朝夕时报 · 极简独立刊</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportImage} title="导出报纸" className="p-1.5 opacity-70 hover:opacity-100">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 opacity-70 hover:opacity-100">
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 核心报纸区域 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        {loading ? (
          <div className="my-auto flex flex-col items-center gap-3 p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin opacity-50" />
            <p className="text-xs font-mono tracking-wider opacity-60">{statusMessage}</p>
          </div>
        ) : currentPost ? (
          <div ref={newspaperRef} className="w-full max-w-[420px] space-y-6 pb-8">
            {/* 极简报头 */}
            <div className="border-b-2 border-[var(--text-main)] pb-3 text-center space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono opacity-50 border-b border-[var(--text-main)] border-opacity-20 pb-1">
                <span>VOL. {historyList.length - currentIndex}</span>
                <span>{currentPost.date}</span>
                <span>{currentPost.topic}</span>
              </div>
              <h1 className="text-lg font-serif font-bold tracking-tight pt-2">
                {currentPost.editionTitle}
              </h1>
            </div>

            {/* 主编晨语 */}
            <div className="p-4 rounded-xl bg-[var(--control-soft-bg)] border border-[var(--text-main)] border-opacity-10 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest opacity-40">
                Editor's Note · {currentPost.characterName || '主编'}
              </div>
              <p className="text-xs font-serif leading-relaxed italic opacity-90">
                “{currentPost.editorNote}”
              </p>
            </div>

            {/* 要闻区块 */}
            <div className="space-y-4">
              {(currentPost.articles || []).map((art, idx) => (
                <div key={idx} className="border-b border-[var(--text-main)] border-opacity-10 pb-4 space-y-1.5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--control-soft-bg)] opacity-60">
                      {art.category || 'NEWS'}
                    </span>
                    <span className="text-[10px] opacity-40 font-mono">{art.source}</span>
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">{art.headline}</h3>
                  <p className="text-xs opacity-75 leading-relaxed font-sans">{art.summary}</p>
                </div>
              ))}
            </div>

            {/* 每日词角 */}
            {currentPost.dailyWord && (
              <div className="p-4 rounded-xl border border-dashed border-[var(--text-main)] border-opacity-20 space-y-2 text-left bg-[var(--control-soft-bg)]">
                <div className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                  Corner Vocabulary · 每日词角
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif font-bold text-sm">{currentPost.dailyWord.word}</span>
                  {currentPost.dailyWord.phonetic && (
                    <span className="text-[10px] font-mono opacity-50">{currentPost.dailyWord.phonetic}</span>
                  )}
                </div>
                <p className="text-xs font-sans opacity-80">{currentPost.dailyWord.definition}</p>
                <p className="text-[11px] font-serif italic opacity-60">
                  “{currentPost.dailyWord.contextSentence}”
                </p>
              </div>
            )}

            {/* 历史翻页控制器 */}
            {historyList.length > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-[var(--text-main)] border-opacity-10 text-xs font-mono">
                <button
                  disabled={currentIndex >= historyList.length - 1}
                  onClick={() => {
                    const next = currentIndex + 1;
                    setCurrentIndex(next);
                    setCurrentPost(historyList[next]);
                  }}
                  className="flex items-center gap-1 opacity-60 disabled:opacity-20 hover:opacity-100"
                >
                  <ChevronLeft className="w-4 h-4" /> 往期报纸
                </button>
                <span className="opacity-40">{currentIndex + 1} / {historyList.length}</span>
                <button
                  disabled={currentIndex <= 0}
                  onClick={() => {
                    const prev = currentIndex - 1;
                    setCurrentIndex(prev);
                    setCurrentPost(historyList[prev]);
                  }}
                  className="flex items-center gap-1 opacity-60 disabled:opacity-20 hover:opacity-100"
                >
                  近期待报 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="my-auto flex flex-col items-center gap-3 p-8 text-center">
            <BookMarked className="w-8 h-8 opacity-30" />
            <p className="text-xs opacity-50">今日报纸尚未印发</p>
            <button
              onClick={handleGenerateToday}
              className="mt-2 px-4 py-2 text-xs font-bold rounded-xl bg-black dark:bg-white text-white dark:text-black"
            >
              印发今日晨报
            </button>
          </div>
        )}
      </div>

      {/* 底部快捷生成按钮 */}
      {currentPost && !loading && (
        <div className="p-3 border-t border-[var(--text-main)] border-opacity-10 flex justify-center bg-[var(--bg-main)]">
          <button
            onClick={handleGenerateToday}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-full bg-[var(--control-soft-bg)] hover:bg-black/10 dark:hover:bg-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 重新编撰今日刊
          </button>
        </div>
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
