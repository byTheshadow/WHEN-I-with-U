import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Download,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

import db from '../../db';
import { CURATED_EXCERPTS } from './curatedExcerpts';
import { generateMarginNotePage } from './marginNotesAiService';
import { exportPageToImage } from './marginNotesExportService';

import MarginNotesPage from './MarginNotesPage';
import MarginNotesArchive from './MarginNotesArchive';
import MarginNotesSettingsModal from './MarginNotesSettingsModal';

import './marginNotes.css';

const DEFAULT_SETTINGS = {
  targetLang: 'en',
  auxLang: '简体中文',
  themePref: '文学与生活哲思',
  customAuthorHint: ''
};

const LANGUAGE_LABELS = {
  en: 'English',
  ja: '日本語',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  ru: 'Русский',
  zh: '中文'
};

export default function MarginNotesApp({ onBackHub }) {
  const [activeView, setActiveView] = useState('reading');
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const [archiveList, setArchiveList] = useState([]);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const pageExportRef = useRef(null);

  const refreshArchive = useCallback(async () => {
    const list = await db.marginNotes.orderBy('createdAt').reverse().toArray();
    setArchiveList(list || []);
    return list || [];
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [characterList, settingRecord, pages] = await Promise.all([
          db.characters.toArray(),
          db.settings.get('margin_notes_settings'),
          db.marginNotes.orderBy('createdAt').reverse().toArray()
        ]);

        if (!mounted) return;

        const chars = characterList || [];
        setCharacters(chars);
        setSettings({ ...DEFAULT_SETTINGS, ...(settingRecord?.value || {}) });

        if (chars.length > 0) {
          setSelectedCharacter(chars[0]);
        }

        setArchiveList(pages || []);

        if (pages?.length > 0) {
          setCurrentPage(pages[0]);
        } else if (CURATED_EXCERPTS.length > 0) {
          setCurrentPage({
            ...CURATED_EXCERPTS[0],
            characterId: chars[0]?.id || null,
            characterName: chars[0]?.name || 'Companion',
            characterAvatar: chars[0]?.avatar || '',
            date: new Date().toISOString().slice(0, 10),
            createdAt: Date.now()
          });
        }
      } catch (error) {
        console.error('[MarginNotes] 初始化失败：', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePageUpdated = useCallback(
    async (updatedPage) => {
      setCurrentPage(updatedPage);
      if (updatedPage?.id) {
        await refreshArchive();
      }
    },
    [refreshArchive]
  );

  const handleGeneratePage = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setShowMenu(false);

    try {
      const generated = await generateMarginNotePage({
        character: selectedCharacter,
        targetLanguage: settings.targetLang,
        targetLanguageLabel:
          LANGUAGE_LABELS[settings.targetLang] || settings.targetLang,
        auxiliaryLanguageLabel: settings.auxLang,
        themePreference: settings.themePref,
        customWorkHint: settings.customAuthorHint
      });

      const page = {
        ...generated,
        characterId: selectedCharacter?.id || null,
        characterName: selectedCharacter?.name || 'Companion',
        characterAvatar: selectedCharacter?.avatar || '',
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now()
      };

      const id = await db.marginNotes.add(page);
      const savedPage = { ...page, id };

      setCurrentPage(savedPage);
      setActiveView('reading');
      await refreshArchive();
    } catch (error) {
      window.alert(`翻开新页失败：${error?.message || '请检查 API 设置'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectCharacter = (character) => {
    setSelectedCharacter(character);
    setShowCharacters(false);
  };

  const handleDeleteCurrentPage = async () => {
    if (!currentPage?.id) return;
    const ok = window.confirm('确定要撕下这一页吗？');
    if (!ok) return;

    await db.marginNotes.delete(currentPage.id);
    const pages = await refreshArchive();
    setCurrentPage(pages[0] || null);
    setShowMenu(false);
  };

  const handleExport = async () => {
    if (!pageExportRef.current || isExporting) return;
    setIsExporting(true);
    setShowMenu(false);

    try {
      await exportPageToImage(
        pageExportRef.current,
        `margin-notes-${currentPage?.source?.workTitle || 'page'}.png`
      );
    } catch (error) {
      window.alert('导出失败，请稍后重试。');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="margin-notes-root">
        <div className="mn-empty">
          <RefreshCw size={18} className="animate-spin" />
          <div className="mn-empty__text">正在打开书页……</div>
        </div>
      </div>
    );
  }

  return (
    <div className="margin-notes-root">
      <header className="mn-page">
        <div className="mn-topbar">
          <div>
            <button
              type="button"
              className="mn-edge-action"
              onClick={onBackHub}
              aria-label="返回主页"
            >
              <ArrowLeft size={18} />
            </button>
          </div>

          <div className="mn-page-number">
            THE MARGIN NOTES
          </div>

          <div className="mn-topbar__right">
            <button
              type="button"
              className="mn-edge-action right"
              onClick={() => setShowMenu((v) => !v)}
              aria-label="更多操作"
            >
              <MoreHorizontal size={19} />
            </button>
          </div>

          {showMenu && (
            <div className="mn-menu">
              {activeView === 'reading' && (
                <>
                  <button type="button" onClick={handleGeneratePage} disabled={isGenerating}>
                    {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{isGenerating ? '正在翻阅……' : '翻开新一页'}</span>
                  </button>

                  <button type="button" onClick={handleExport} disabled={isExporting || !currentPage}>
                    <Download size={14} />
                    <span>{isExporting ? '正在保存……' : '保存为书签'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCharacters(true);
                      setShowMenu(false);
                    }}
                  >
                    <Settings2 size={14} />
                    <span>选择共读角色</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(true);
                      setShowMenu(false);
                    }}
                  >
                    <Settings2 size={14} />
                    <span>共读设置</span>
                  </button>

                  {currentPage?.id && (
                    <button type="button" onClick={handleDeleteCurrentPage}>
                      <Trash2 size={14} />
                      <span>撕下这一页</span>
                    </button>
                  )}
                </>
              )}

              {activeView === 'archive' && (
                <button type="button" onClick={() => setActiveView('reading')}>
                  <Bookmark size={14} />
                  <span>返回书页</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main>
        {activeView === 'reading' ? (
          <div ref={pageExportRef}>
            <MarginNotesPage
              page={currentPage}
              character={selectedCharacter}
              onPageUpdated={handlePageUpdated}
              onOpenCompanionPicker={() => setShowCharacters(true)}
              onOpenMenu={() => setShowMenu(true)}
            />
          </div>
        ) : (
          <div className="mn-page">
          <div className="mn-topbar mn-topbar--archive">
              <div className="mn-page-number">BOOKSHELF</div>
              <div />
             <div className="mn-page-number mn-page-number--right">
                {archiveList.length} PAGES
              </div>
            </div>

            <MarginNotesArchive
              archiveList={archiveList}
              onSelectPage={(page) => {
                setCurrentPage(page);
                setActiveView('reading');
              }}
              onDeletePage={async (deletedId) => {
                const pages = await refreshArchive();
                if (currentPage?.id === deletedId) {
                  setCurrentPage(pages[0] || null);
                }
              }}
            />
          </div>
        )}
      </main>

      {showCharacters && (
        <div
          className="mn-drawer-backdrop"
          onClick={() => setShowCharacters(false)}
        >
          <section className="mn-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mn-drawer__head">
              <div>
                <div className="mn-drawer__title">选择今天一起读的人</div>
                <div className="mn-drawer__subtitle">
                  THE NEXT PAGE WILL CARRY THEIR VOICE
                </div>
              </div>

              <button
                type="button"
                className="mn-edge-action"
                onClick={() => setShowCharacters(false)}
                aria-label="关闭"
              >
                <X size={17} />
              </button>
            </div>

            {characters.length === 0 ? (
              <div className="mn-empty">
                <div className="mn-empty__title">角色库还是空的</div>
                <div className="mn-empty__text">先创建角色，再回来共读。</div>
              </div>
            ) : (
              characters.map((character) => {
                const isSelected = selectedCharacter?.id === character.id;

                return (
                  <button
                    type="button"
                    className="mn-character"
                    key={character.id}
                    onClick={() => handleSelectCharacter(character)}
                  >
                    {character.avatar ? (
                      <img src={character.avatar} alt="" className="mn-character__avatar" />
                    ) : (
                      <span className="mn-character__placeholder" />
                    )}

                    <span>
                      <span className="mn-character__name">{character.name}</span>
                      <span className="mn-character__bio">
                        {character.bio || '安静地共读。'}
                      </span>
                    </span>

                    {isSelected && <Check size={16} style={{ marginLeft: 'auto' }} />}
                  </button>
                );
              })
            )}
          </section>
        </div>
      )}

      {showSettings && (
        <MarginNotesSettingsModal
          currentSettings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(nextSettings) => {
            setSettings({ ...DEFAULT_SETTINGS, ...nextSettings });
          }}
        />
      )}
    </div>
  );
}
