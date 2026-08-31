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
  topics: [
    'AI 与认知前沿',
    '独立艺术与设计',
    '日常哲学与世界观察'
  ],
  tavilyKey: '',
  autoClean: true
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getSourcesFromIndexes(sourceIndexes, rawNews) {
  if (!Array.isArray(sourceIndexes) || !Array.isArray(rawNews)) {
    return [];
  }

  return [...new Set(sourceIndexes)]
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
  const isObservation =
    article?.sourceType === 'editorial-observation';

  const sources = isObservation
    ? []
    : getSourcesFromIndexes(article?.sourceIndexes, rawNews);

  return {
    id: `article-${Date.now()}-${index}`,
    headline: article?.headline || '未命名报道',
    tag: article?.tag || 'BRIEF',
    excerpt: article?.excerpt || article?.content || '',
    facts: article?.facts || article?.content || '',
    editorComment: article?.editorComment || '',
    limitations: article?.limitations || '',
    sourceType: isObservation
      ? 'editorial-observation'
      : 'web-report',
    sources,
    source: article?.source || sources[0]?.publisher || ''
  };
}

function getSourceLabel(article) {
  if (article?.sourceType === 'editorial-observation') {
    return '主编观察';
  }

  if (article?.sources?.length > 0) {
    return article.sources[0].publisher;
  }

  return article?.source || '来源待核验';
}

function ArticleDetailModal({ article, onClose }) {
  if (!article) return null;

  const sources = article.sources || [];
  const hasSources =
    article.sourceType === 'web-report' &&
    sources.length > 0;

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
          <span>
            {article.tag || 'BRIEF'} · {getSourceLabel(article)}
          </span>

          <button
            type="button"
            className="newspaper-detail-close"
            onClick={onClose}
            aria-label="关闭详情"
          >
            <X size={17} />
          </button>
        </header>

        <div className="newspaper-detail-content">
          <h2 className="newspaper-detail-title">
            {article.headline}
          </h2>

          <section className="newspaper-detail-section">
            <h4>事实梳理</h4>
            <p>
              {article.facts || '该条目暂未保存完整的事实梳理。'}
            </p>
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
                      {source.publishedAt
                        ? ` · ${source.publishedAt}`
                        : ''}
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
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedArticle(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  async function cleanOldPosts() {
    const deadline =
      Date.now() - 2 * 24 * 60 * 60 * 1000;

    const oldPosts = await db.newspapers
      .filter((post) => post.createdAt < deadline)
      .toArray();

    const ids = oldPosts
      .map((post) => post.id)
      .filter((id) => id !== undefined && id !== null);

    if (ids.length > 0) {
      await db.newspapers.bulkDelete(ids);
    }

    return oldPosts.length;
  }

  async function loadData() {
    try {
      const savedSettings = await db.settings.get(
        'newspaper_settings'
      );

      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...(savedSettings?.value || {})
      };

      setSettings(nextSettings);

      if (nextSettings.autoClean) {
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
      } else {
        setCurrentPost(null);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('加载晨报失败：', error);
      setErrorMessage(
        '晨报档案暂时无法读取，请稍后重新进入。'
      );
    }
  }

  async function handleSaveSettings(nextSettings) {
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...nextSettings
    };

    await db.settings.put({
      key: 'newspaper_settings',
      value: mergedSettings
    });

    setSettings(mergedSettings);

    if (mergedSettings.autoClean) {
      await cleanOldPosts();
      await loadData();
    }
  }

  async function handleManualClean() {
    const deletedCount = await cleanOldPosts();
    await loadData();
    return deletedCount;
  }

  async function handleGenerateToday() {
    if (loading) return;

    setLoading(true);
    setErrorMessage('');
    setStatusMessage('正在整理今日可核验的资讯来源…');

    try {
      const topics = Array.isArray(settings.topics)
        ? settings.topics.filter(Boolean)
        : [];

      const activeTopic =
        topics[Math.floor(Math.random() * topics.length)] ||
        '世界观察';

      const rawNews = await searchLatestNews(
        activeTopic,
        settings
      );

      setStatusMessage(
        rawNews.length > 0
          ? '主编正在阅读来源、编撰晨刊…'
          : '外部来源暂不可用，主编正在写下今日观察…'
      );

      const postData = await generateDailyPost({
        topic: activeTopic,
        rawNews
      });

      const activeCharacterSetting =
        await db.settings.get('activeCharacterId');

      const activeCharacter = activeCharacterSetting?.value
        ? await db.characters.get(
          Number(activeCharacterSetting.value)
        )
        : await db.characters.toCollection().first();

      const articles = (postData.articles || [])
        .slice(0, 3)
        .map((article, index) =>
          normalizeArticle(article, index, rawNews)
        );

      const record = {
        date: getTodayKey(),
        characterId: activeCharacter?.id || null,
        characterName: activeCharacter?.name || '主编',
        editionNumber:
          postData.editionNumber ||
          `NO. ${historyList.length + 1}`,
        headlineLead:
          postData.headlineLead ||
          '今天，世界仍在缓慢移动',
        topic: activeTopic,
        editorNote: postData.editorNote || '',
        articles,
        dailyLexicon: postData.dailyLexicon || null,
        createdAt: Date.now()
      };

      const savedId = await db.newspapers.add(record);

      if (settings.autoClean) {
        await cleanOldPosts();
      }

      const refreshedPosts = await db.newspapers
        .orderBy('createdAt')
        .reverse()
        .toArray();

      setHistoryList(refreshedPosts);
      setCurrentPost({
        ...record,
        id: savedId
      });
      setCurrentIndex(0);
    } catch (error) {
      console.error('印发晨报失败：', error);
      setErrorMessage(
        error.message ||
        '本期晨报未能完成印发，请稍后重试。'
      );
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  }

  function showOlderPost() {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= historyList.length) return;

    setCurrentIndex(nextIndex);
    setCurrentPost(historyList[nextIndex]);
  }

  function showNewerPost() {
    const previousIndex = currentIndex - 1;

    if (previousIndex < 0) return;

    setCurrentIndex(previousIndex);
    setCurrentPost(historyList[previousIndex]);
  }

  const articles = currentPost?.articles || [];
  const leadArticle = articles[0] || null;
  const briefArticles = articles.slice(1, 3);

  return (
    <div className="-mx-4 -mt-6 newspaper-shell">
      <button
        type="button"
        className="newspaper-floating-button newspaper-floating-button--left"
        onClick={onClose}
        aria-label="返回主页"
      >
        <ArrowLeft size={19} />
      </button>

      <button
        type="button"
        className="newspaper-floating-button newspaper-floating-button--right"
        onClick={() => setIsSettingsOpen(true)}
        aria-label="报纸设置"
      >
        <SettingsIcon size={17} />
      </button>

      {loading ? (
        <main className="newspaper-loading">
          <RefreshCw size={25} className="animate-spin opacity-50" />
          <p>{statusMessage || '晨刊正在排印中…'}</p>
        </main>
      ) : currentPost ? (
        <main className="newspaper-page">
          <article>
            {/* 正式报头 */}
            <header className="newspaper-masthead">
              <div className="newspaper-edition-line">
                <span>
                  {currentPost.editionNumber || 'NO. 001'}
                </span>
                <span>{currentPost.date}</span>
                <span className="newspaper-edition-topic">
                  {currentPost.topic}
                </span>
              </div>

              <h1 className="newspaper-publication-name">
                THE DAILY POST
              </h1>

              <div className="newspaper-publication-rule">
                朝夕时报 · A private edition of the moving world
              </div>
            </header>

            {/* 今日头版标题 */}
            <section className="newspaper-front-page">
              <div className="newspaper-front-label">
                Today&apos;s Edition
              </div>

              <h2 className="newspaper-front-title">
                {currentPost.headlineLead}
              </h2>

              <p className="newspaper-front-subline">
                一份为你挑选、留有来源与思考边界的今日剪报。
              </p>
            </section>

            {/* 主编按语 */}
            <section className="newspaper-editorial-strip">
              <div className="newspaper-editorial-meta">
                Editor&apos;s<br />
                Note
              </div>

              <div>
                <p className="newspaper-editorial-copy">
                  “{currentPost.editorNote}”
                </p>

                <span className="newspaper-editorial-signature">
                  — {currentPost.characterName || '主编'}
                </span>
              </div>
            </section>

            {/* 第一条作为头版主新闻 */}
            {leadArticle && (
              <button
                type="button"
                className="newspaper-lead-story"
                onClick={() => setSelectedArticle(leadArticle)}
              >
                <div className="newspaper-story-meta">
                  <span>
                    {leadArticle.tag || 'TOP STORY'} · HEADLINE
                  </span>

                  <span className="newspaper-story-meta-source">
                    {getSourceLabel(leadArticle)}
                  </span>
                </div>

                <div className="newspaper-lead-grid">
                  <span className="newspaper-lead-index">01</span>

                  <h2 className="newspaper-lead-title">
                    {leadArticle.headline}
                  </h2>
                </div>

                {leadArticle.excerpt && (
                  <p className="newspaper-lead-excerpt">
                    {leadArticle.excerpt}
                  </p>
                )}

                <span className="newspaper-read-mark">
                  阅读剪报
                  <ChevronRight size={13} />
                </span>
              </button>
            )}

            {/* 第二、三条并列，形成新闻版面感 */}
            {briefArticles.length > 0 && (
              <section
                className="newspaper-briefs-grid"
                aria-label="其他新闻"
              >
                {briefArticles.map((article, index) => (
                  <button
                    type="button"
                    key={article.id || `${article.headline}-${index}`}
                    className="newspaper-brief-story"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <span className="newspaper-brief-index">
                      {String(index + 2).padStart(2, '0')}
                    </span>

                    <span className="newspaper-brief-tag">
                      {article.tag || 'BRIEF'}
                    </span>

                    <h3 className="newspaper-brief-title">
                      {article.headline}
                    </h3>

                    {article.excerpt && (
                      <p className="newspaper-brief-excerpt">
                        {article.excerpt}
                      </p>
                    )}

                    <span className="newspaper-brief-source">
                      {getSourceLabel(article)}
                    </span>
                  </button>
                ))}
              </section>
            )}

            {/* 每日词语剪报 */}
            {currentPost.dailyLexicon && (
              <section className="newspaper-lexicon">
                <div className="newspaper-lexicon-label">
                  Cutout Lexicon · 词语剪报
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
              <nav className="newspaper-pagination">
                <button
                  type="button"
                  className="newspaper-pagination-button"
                  disabled={
                    currentIndex >= historyList.length - 1
                  }
                  onClick={showOlderPost}
                >
                  <ChevronLeft size={15} />
                  往期
                </button>

                <span className="newspaper-pagination-count">
                  {currentIndex + 1} / {historyList.length}
                </span>

                <button
                  type="button"
                  className="newspaper-pagination-button"
                  disabled={currentIndex <= 0}
                  onClick={showNewerPost}
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

          <p>
            今天的晨刊尚未印发。主编会先整理可核验的外部来源，再开始编撰。
          </p>

          {errorMessage && (
            <p className="newspaper-status-error">
              {errorMessage}
            </p>
          )}
        </main>
      )}

      <button
        type="button"
        className="newspaper-print-button"
        onClick={handleGenerateToday}
        disabled={loading}
      >
        <RefreshCw
          size={15}
          className={loading ? 'animate-spin' : ''}
        />
        {currentPost ? '印发新一期' : '印发今日晨刊'}
      </button>

      {errorMessage && currentPost && (
        <div className="fixed bottom-20 left-1/2 z-40 w-[min(calc(100%-32px),420px)] -translate-x-1/2 border border-[var(--text-main)] border-opacity-15 bg-[var(--bg-main)] px-4 py-3 text-center text-[11px] leading-relaxed opacity-90 shadow-sm">
          {errorMessage}
        </div>
      )}

      <ArticleDetailModal
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
