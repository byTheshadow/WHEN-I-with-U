// src/apps/newspaper/NewspaperApp.jsx
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  RefreshCw,
  Settings as SettingsIcon,
  X
} from 'lucide-react';

import db from '../../db';
import { searchLatestNews } from './newspaperSearchService';
import { generateDailyPost } from './newspaperAiService';
import { NewspaperSettingsModal } from './NewspaperSettingsModal';
import './newspaper.css';

const DEFAULT_SETTINGS = {
  topics: ['AI 与认知前沿', '独立艺术与设计', '日常哲学与世界观察'],
  tavilyKey: '',
  autoClean: true
};

function toDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getSourcesFromIndexes(sourceIndexes, rawNews) {
  if (!Array.isArray(sourceIndexes) || !Array.isArray(rawNews)) {
    return [];
  }

  const uniqueIndexes = [...new Set(sourceIndexes)];

  return uniqueIndexes
    .map((index) => rawNews[index])
    .filter((source) => source?.url)
    .map((source) => ({
      title: source.title || '原始报道',
      publisher: source.source || '外部资讯来源',
      url: source.url,
      publishedAt: source.publishedAt || source.pubDate || ''
    }));
}

function normalizeArticle(article, index, rawNews) {
  const sourceType = article?.sourceType === 'editorial-observation'
    ? 'editorial-observation'
    : 'web-report';

  const sources = sourceType === 'web-report'
    ? getSourcesFromIndexes(article?.sourceIndexes, rawNews)
    : [];

  return {
    id: `article-${Date.now()}-${index}`,
    headline: article?.headline || '未命名报道',
    tag: article?.tag || 'BRIEF',
    excerpt: article?.excerpt || article?.content || '',
    facts: article?.facts || article?.content || '',
    editorComment: article?.editorComment || '',
    limitations: article?.limitations || '',
    sourceType,
    sources,

    // 兼容旧版已保存晨报
    source: article?.source || sources[0]?.publisher || ''
  };
}

function getArticleSourceLabel(article) {
  if (article?.sourceType === 'editorial-observation') {
    return '主编观察';
  }

  if (article?.sources?.length > 0) {
    return article.sources[0].publisher;
  }

  return article?.source || '来源待核验';
}

function DetailModal({ article, onClose }) {
  if (!article) return null;

  const sources = article.sources || [];
  const hasSources = article.sourceType === 'web-report' && sources.length > 0;

  return (
    <div
      className="newspaper-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="newspaper-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="新闻详情"
      >
        <header className="newspaper-detail-head">
          <span>{article.tag || 'BRIEF'} · {getArticleSourceLabel(article)}</span>
          <button
            type="button"
            className="newspaper-icon-button"
            onClick={onClose}
            aria-label="关闭详情"
          >
            <X size={18} />
          </button>
        </header>

        <div className="newspaper-detail-content">
          <h3 className="newspaper-detail-title">{article.headline}</h3>

          <section className="newspaper-detail-section">
            <h4>事实梳理</h4>
            <p>{article.facts || '该条目暂未保存完整事实梳理。'}</p>
          </section>

          {article.limitations && (
            <section className="newspaper-detail-section">
              <h4>信息边界</h4>
              <p>{article.limitations}</p>
            </section>
          )}

          {article.editorComment && (
            <section className="newspaper-detail-section newspaper-detail-editor-note">
              <h4>主编注记</h4>
              <p>“{article.editorComment}”</p>
            </section>
          )}

          <section className="newspaper-detail-section">
            <h4>原始报道</h4>

            {hasSources ? (
              sources.map((source, index) => (
                <a
                  key={`${source.url}-${index}`}
                  className="newspaper-source-link"
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    <span className="newspaper-source-publisher">
                      {source.publisher}
                    </span>
                    <span className="newspaper-source-title">
                      {source.title}
                      {source.publishedAt ? ` · ${source.publishedAt}` : ''}
                    </span>
                  </span>
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              ))
            ) : (
              <p className="newspaper-no-source">
                {article.sourceType === 'editorial-observation'
                  ? '本条为主编围绕订阅主题写下的观察，不对应外部新闻报道。'
                  : '这份旧报纸未保存可用的原始链接，因此无法跳转原文。'}
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

export const NewspaperApp = ({ onClose }) => {
  const [currentPost, setCurrentPost] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedArticle(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const cleanOldPosts = async () => {
    const deadline = Date.now() - (2 * 24 * 60 * 60 * 1000);

    const outdatedPosts = await db.newspapers
      .filter((post) => post.createdAt < deadline)
      .toArray();

    if (outdatedPosts.length > 0) {
      await db.newspapers.bulkDelete(
        outdatedPosts
          .map((post) => post.id)
          .filter((id) => id !== undefined && id !== null)
      );
    }

    return outdatedPosts.length;
  };

  const loadData = async () => {
    try {
      const savedSettings = await db.settings.get('newspaper_settings');
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...(savedSettings?.value || {})
      };

      setSettings(mergedSettings);

      if (mergedSettings.autoClean) {
        await cleanOldPosts();
      }

      const posts = await db.newspapers
        .orderBy('createdAt')
        .reverse()
        .toArray();

      setHistoryList(posts);

      if (posts.length > 0) {
        setCurrentPost(posts[0]);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('加载晨报失败：', error);
      setErrorMessage('晨报档案暂时无法读取，请稍后重新进入。');
    }
  };

  const handleSaveSettings = async (nextSettings) => {
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...nextSettings
    };

    setSettings(mergedSettings);

    await db.settings.put({
      key: 'newspaper_settings',
      value: mergedSettings
    });

    if (mergedSettings.autoClean) {
      const deletedCount = await cleanOldPosts();

      if (deletedCount > 0) {
        await loadData();
      }
    }
  };

  const handleManualClean = async () => {
    const deletedCount = await cleanOldPosts();
    await loadData();
    return deletedCount;
  };

  const handleGenerateToday = async () => {
    if (loading) return;

    setLoading(true);
    setErrorMessage('');
    setStatusMessage('正在整理今日可核验的资讯来源…');

    try {
      const topics = settings.topics?.filter(Boolean) || [];
      const activeTopic = topics[
        Math.floor(Math.random() * Math.max(topics.length, 1))
      ] || '世界观察';

      const rawNews = await searchLatestNews(activeTopic, settings);

      setStatusMessage(
        rawNews.length > 0
          ? '主编正在阅读来源、编撰晨刊…'
          : '外部来源暂不可用，主编正在写下今日观察…'
      );

      const postData = await generateDailyPost({
        topic: activeTopic,
        rawNews
      });

      const activeCharacterSetting = await db.settings.get('activeCharacterId');
      const activeCharacter = activeCharacterSetting?.value
        ? await db.characters.get(Number(activeCharacterSetting.value))
        : await db.characters.toCollection().first();

      const articles = (postData.articles || [])
        .slice(0, 3)
        .map((article, index) => normalizeArticle(article, index, rawNews));

      const record = {
        date: toDateKey(),
        characterId: activeCharacter?.id || null,
        characterName: activeCharacter?.name || '主编',
        editionNumber: postData.editionNumber || `NO. ${historyList.length + 1}`,
        headlineLead: postData.headlineLead || '今天，世界仍在缓慢移动',
        topic: activeTopic,
        editorNote: postData.editorNote || '',
        articles,
        dailyLexicon: postData.dailyLexicon || null,
        createdAt: Date.now()
      };

      const savedId = await db.newspapers.add(record);
      const savedRecord = { ...record, id: savedId };

      if (settings.autoClean) {
        await cleanOldPosts();
      }

      const refreshedPosts = await db.newspapers
        .orderBy('createdAt')
        .reverse()
        .toArray();

      setHistoryList(refreshedPosts);
      setCurrentPost(savedRecord);
      setCurrentIndex(0);
    } catch (error) {
      console.error('印发晨报失败：', error);
      setErrorMessage(error.message || '本期晨报未能完成印发，请稍后重试。');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  const showOlderPost = () => {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= historyList.length) return;

    setCurrentIndex(nextIndex);
    setCurrentPost(historyList[nextIndex]);
  };

  const showNewerPost = () => {
    const previousIndex = currentIndex - 1;

    if (previousIndex < 0) return;

    setCurrentIndex(previousIndex);
    setCurrentPost(historyList[previousIndex]);
  };

  return (
    <div className="-mx-4 -mt-6 newspaper-shell">
      <header className="newspaper-topbar">
        <button
          type="button"
          className="newspaper-icon-button"
          onClick={onClose}
          aria-label="返回主页"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="newspaper-brand">
          <div className="newspaper-brand-title">朝夕时报</div>
          <div className="newspaper-brand-subtitle">The Daily Post</div>
        </div>

        <button
          type="button"
          className="newspaper-icon-button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="报纸设置"
        >
          <SettingsIcon size={17} />
        </button>
      </header>

      {loading ? (
        <main className="newspaper-loading">
          <RefreshCw size={25} className="animate-spin opacity-50" />
          <p>{statusMessage || '晨刊正在排印中…'}</p>
        </main>
      ) : currentPost ? (
        <main className="newspaper-page">
          <article>
            <header className="newspaper-masthead">
              <div className="newspaper-meta-row">
                <span>{currentPost.editionNumber || 'NO. 001'}</span>
                <span>{currentPost.date}</span>
                <span className="newspaper-meta-topic">{currentPost.topic}</span>
              </div>

              <h1 className="newspaper-title">
                {currentPost.headlineLead}
              </h1>

              <div className="newspaper-kicker">
                A quiet selection from the moving world
              </div>
            </header>

            <section className="newspaper-editorial">
              <div className="newspaper-section-label">
                <span>主编晨语</span>
              </div>

              <p className="newspaper-editorial-copy">
                “{currentPost.editorNote}”
              </p>

              <span className="newspaper-editorial-signature">
                — {currentPost.characterName || '主编'}
              </span>
            </section>

            <section className="newspaper-list" aria-label="本期新闻">
              {(currentPost.articles || []).map((article, index) => (
                <button
                  type="button"
                  key={article.id || `${article.headline}-${index}`}
                  className="newspaper-story"
                  onClick={() => setSelectedArticle(article)}
                >
                  <div className="newspaper-story-topline">
                    <span>
                      <span className="newspaper-story-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {' · '}
                      {article.tag || 'BRIEF'}
                    </span>

                    <span className="newspaper-story-source">
                      {getArticleSourceLabel(article)}
                    </span>
                  </div>

                  <h2 className="newspaper-story-title">{article.headline}</h2>

                  {article.excerpt && (
                    <p className="newspaper-story-excerpt">{article.excerpt}</p>
                  )}

                  <span className="newspaper-story-read">
                    阅读剪报 <ChevronRight size={13} />
                  </span>
                </button>
              ))}
            </section>

            {currentPost.dailyLexicon && (
              <section className="newspaper-lexicon">
                <div className="newspaper-section-label">
                  <span>词语剪报</span>
                </div>

                <p className="newspaper-lexicon-word">
                  {currentPost.dailyLexicon.word}
                  {currentPost.dailyLexicon.phonetic && (
                    <span className="newspaper-lexicon-phonetic">
                      {currentPost.dailyLexicon.phonetic}
                    </span>
                  )}
                </p>

                <p className="newspaper-lexicon-translation">
                  {currentPost.dailyLexicon.translation}
                </p>

                {currentPost.dailyLexicon.quote && (
                  <p className="newspaper-lexicon-quote">
                    “{currentPost.dailyLexicon.quote}”
                  </p>
                )}
              </section>
            )}

            {historyList.length > 1 && (
              <nav className="mt-8 flex items-center justify-between border-t border-[color-mix(in_srgb,var(--text-main)_18%,transparent)] pt-4 text-[11px]">
                <button
                  type="button"
                  disabled={currentIndex >= historyList.length - 1}
                  onClick={showOlderPost}
                  className="flex items-center gap-1 opacity-60 disabled:opacity-20"
                >
                  <ChevronLeft size={15} />
                  往期
                </button>

                <span className="font-mono text-[9px] opacity-40">
                  {currentIndex + 1} / {historyList.length}
                </span>

                <button
                  type="button"
                  disabled={currentIndex <= 0}
                  onClick={showNewerPost}
                  className="flex items-center gap-1 opacity-60 disabled:opacity-20"
                >
                  近期
                  <ChevronRight size={15} />
                </button>
              </nav>
            )}
          </article>
        </main>
      ) : (
        <main className="newspaper-empty">
          <FileText size={26} className="opacity-45" />
          <p>今天的晨刊尚未印发。主编会先整理可核验的外部来源，再开始编撰。</p>

          {errorMessage && (
            <p className="newspaper-status-error">{errorMessage}</p>
          )}
        </main>
      )}

      <footer className="newspaper-bottom-actions">
        <button
          type="button"
          className="newspaper-print-button"
          onClick={handleGenerateToday}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {currentPost ? '印发新一期' : '印发今日晨刊'}
        </button>
      </footer>

      {errorMessage && currentPost && (
        <div className="fixed bottom-20 left-1/2 z-30 w-[min(calc(100%-32px),420px)] -translate-x-1/2 border border-[var(--text-main)] border-opacity-15 bg-[var(--bg-main)] px-4 py-3 text-center text-[11px] leading-relaxed opacity-90 shadow-sm">
          {errorMessage}
        </div>
      )}

      <DetailModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

      <NewspaperSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        onCleanOldPosts={handleManualClean}
      />
    </div>
  );
};

export default NewspaperApp;
