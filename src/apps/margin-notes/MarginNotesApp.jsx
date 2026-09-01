// src/apps/margin-notes/MarginNotesApp.jsx

import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  ArrowLeft,
  BookOpen,
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

import MarginNotesArchive from './MarginNotesArchive';
import MarginNotesPage from './MarginNotesPage';
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

function createFallbackPage(character) {
  if (!CURATED_EXCERPTS.length) {
    return null;
  }

  return {
    ...CURATED_EXCERPTS[0],
    characterId: character?.id || null,
    characterName: character?.name || 'Companion',
    characterAvatar: character?.avatar || '',
    date: new Date().toISOString().slice(0, 10),
    createdAt: Date.now()
  };
}

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
  const menuRef = useRef(null);

  /**
   * 从数据库刷新书架。
   */
  const refreshArchive = useCallback(async () => {
    const list = await db.marginNotes
      .orderBy('createdAt')
      .reverse()
      .toArray();

    const pages = list || [];

    setArchiveList(pages);

    return pages;
  }, []);

  /**
   * 初始化：角色、设置、阅读记录并行读取。
   */
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

        const nextCharacters = characterList || [];
        const nextPages = pages || [];
        const firstCharacter = nextCharacters[0] || null;

        setCharacters(nextCharacters);
        setSelectedCharacter(firstCharacter);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(settingRecord?.value || {})
        });

        setArchiveList(nextPages);

        if (nextPages.length > 0) {
          setCurrentPage(nextPages[0]);
        } else {
          setCurrentPage(createFallbackPage(firstCharacter));
        }
      } catch (error) {
        console.error('[MarginNotes] 初始化失败：', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * 点击菜单外部或按 Esc 时关闭菜单。
   */
  useEffect(() => {
    if (!showMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setShowMenu(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

  /**
   * 页面内回注更新时，同步当前书页和书架。
   */
  const handlePageUpdated = useCallback(
    async (updatedPage) => {
      if (!updatedPage) return;

      setCurrentPage(updatedPage);

      if (updatedPage.id) {
        await refreshArchive();
      }
    },
    [refreshArchive]
  );

  /**
   * 生成一张新的共读页面。
   */
  const handleGeneratePage = async () => {
    if (isGenerating) return;

    if (!selectedCharacter) {
      setShowMenu(false);
      setShowCharacters(true);
      return;
    }

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
        characterId: selectedCharacter.id,
        characterName: selectedCharacter.name || 'Companion',
        characterAvatar: selectedCharacter.avatar || '',
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now()
      };

      const id = await db.marginNotes.add(page);

      const savedPage = {
        ...page,
        id
      };

      setCurrentPage(savedPage);
      setActiveView('reading');

      await refreshArchive();
    } catch (error) {
      console.error('[MarginNotes] 翻开新页失败：', error);

      window.alert(
        `翻开新页失败：${error?.message || '请检查 API 设置后重试。'}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 选择角色。
   * 新角色将在下一次生成新页面时使用，不覆盖已保存书页的原始共读角色。
   */
  const handleSelectCharacter = (character) => {
    setSelectedCharacter(character);
    setShowCharacters(false);
  };

  /**
   * 删除当前页面。
   */
  const handleDeleteCurrentPage = async () => {
    if (!currentPage?.id) {
      setShowMenu(false);
      return;
    }

    const confirmed = window.confirm(
      '确定要撕下这一页吗？该书页及其批注将被永久删除。'
    );

    if (!confirmed) return;

    try {
      await db.marginNotes.delete(currentPage.id);

      const pages = await refreshArchive();
      const nextPage = pages[0] || createFallbackPage(selectedCharacter);

      setCurrentPage(nextPage);
      setShowMenu(false);

      if (pages.length === 0) {
        setActiveView('reading');
      }
    } catch (error) {
      console.error('[MarginNotes] 删除书页失败：', error);
      window.alert('删除失败，请稍后再试。');
    }
  };

  /**
   * 将当前阅读页导出为图片。
   */
  const handleExport = async () => {
    if (!pageExportRef.current || isExporting || !currentPage) {
      return;
    }

    setIsExporting(true);
    setShowMenu(false);

    try {
      const rawTitle = currentPage.source?.workTitle || 'page';

      const safeTitle = rawTitle
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '-')
        .slice(0, 80);

      await exportPageToImage(
        pageExportRef.current,
        `margin-notes-${safeTitle}.png`
      );
    } catch (error) {
      console.error('[MarginNotes] 导出失败：', error);
      window.alert('导出失败，请稍后重试。');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 打开书架。
   */
  const handleOpenArchive = () => {
    setShowMenu(false);
    setActiveView('archive');
  };

  /**
   * 从书架选择某一页。
   */
  const handleSelectArchivePage = (page) => {
    setCurrentPage(page);

    const pageCharacter = characters.find(
      (character) => character.id === page.characterId
    );

    if (pageCharacter) {
      setSelectedCharacter(pageCharacter);
    }

    setActiveView('reading');
  };

  /**
   * 从书架中删除页面后，处理当前页面状态。
   */
  const handleArchivePageDeleted = async (deletedId) => {
    const pages = await refreshArchive();

    if (currentPage?.id === deletedId) {
      setCurrentPage(pages[0] || createFallbackPage(selectedCharacter));
    }
  };

  /**
   * 统一打开角色选择抽屉。
   */
  const handleOpenCharacterPicker = () => {
    setShowMenu(false);
    setShowSettings(false);
    setShowCharacters(true);
  };

  /**
   * 统一打开设置弹窗。
   */
  const handleOpenSettings = () => {
    setShowMenu(false);
    setShowCharacters(false);
    setShowSettings(true);
  };

  if (isLoading) {
    return (
      <div className="margin-notes-root">
        <div className="mn-empty">
          <RefreshCw
            size={18}
            className="animate-spin"
            aria-hidden="true"
          />

          <div className="mn-empty__text">
            正在打开书页……
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="margin-notes-root">
      <header className="mn-app-header">
        <div className="mn-topbar">
          <div className="mn-topbar__left">
            <button
              type="button"
              className="mn-edge-action"
              onClick={onBackHub}
              aria-label="返回主页"
            >
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mn-page-number">
            {activeView === 'archive'
              ? 'THE MARGIN NOTES · ARCHIVE'
              : 'THE MARGIN NOTES'}
          </div>

          <div
            className="mn-topbar__right"
            ref={menuRef}
          >
            <button
              type="button"
              className="mn-edge-action mn-edge-action--menu"
              onClick={() => setShowMenu((value) => !value)}
              aria-label="打开更多操作"
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              <MoreHorizontal size={19} strokeWidth={1.5} />
            </button>

            {showMenu && (
              <nav
                className="mn-menu"
                aria-label="书页操作菜单"
              >
                {activeView === 'reading' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleGeneratePage}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <RefreshCw
                          size={14}
                          className="animate-spin"
                        />
                      ) : (
                        <Sparkles size={14} strokeWidth={1.5} />
                      )}

                      <span>
                        {isGenerating
                          ? '正在翻阅……'
                          : selectedCharacter
                            ? '翻开新一页'
                            : '选择共读角色'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenArchive}
                    >
                      <BookOpen size={14} strokeWidth={1.5} />
                      <span>阅读书架</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={isExporting || !currentPage}
                    >
                      <Download size={14} strokeWidth={1.5} />
                      <span>
                        {isExporting
                          ? '正在保存……'
                          : '保存为书签'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenCharacterPicker}
                    >
                      <Bookmark size={14} strokeWidth={1.5} />
                      <span>选择共读角色</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenSettings}
                    >
                      <Settings2 size={14} strokeWidth={1.5} />
                      <span>共读设置</span>
                    </button>

                    {currentPage?.id && (
                      <button
                        type="button"
                        onClick={handleDeleteCurrentPage}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                        <span>撕下这一页</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setActiveView('reading');
                      }}
                    >
                      <Bookmark size={14} strokeWidth={1.5} />
                      <span>返回书页</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenCharacterPicker}
                    >
                      <BookOpen size={14} strokeWidth={1.5} />
                      <span>选择共读角色</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenSettings}
                    >
                      <Settings2 size={14} strokeWidth={1.5} />
                      <span>共读设置</span>
                    </button>
                  </>
                )}
              </nav>
            )}
          </div>
        </div>
      </header>

      <main className="mn-app-main">
        {activeView === 'reading' ? (
          <div ref={pageExportRef}>
            <MarginNotesPage
              page={currentPage}
              character={selectedCharacter}
              onPageUpdated={handlePageUpdated}
              onOpenCompanionPicker={handleOpenCharacterPicker}
              onOpenMenu={() => setShowMenu(true)}
            />
          </div>
        ) : (
          <section className="mn-archive-page">
            <div className="mn-archive-page__head">
              <span className="mn-archive-page__label">
                Bookshelf
              </span>

              <span className="mn-archive-page__total">
                {archiveList.length}{' '}
                {archiveList.length === 1 ? 'PAGE' : 'PAGES'}
              </span>
            </div>

            <MarginNotesArchive
              archiveList={archiveList}
              onSelectPage={handleSelectArchivePage}
              onDeletePage={handleArchivePageDeleted}
            />
          </section>
        )}
      </main>

      {showCharacters && (
        <div
          className="mn-drawer-backdrop"
          onClick={() => setShowCharacters(false)}
          role="presentation"
        >
          <section
            className="mn-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mn-character-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mn-drawer__head">
              <div>
                <h2
                  id="mn-character-picker-title"
                  className="mn-drawer__title"
                >
                  选择今天一起读的人
                </h2>

                <p className="mn-drawer__subtitle">
                  THE NEXT PAGE WILL CARRY THEIR VOICE
                </p>
              </div>

              <button
                type="button"
                className="mn-edge-action"
                onClick={() => setShowCharacters(false)}
                aria-label="关闭角色选择"
              >
                <X size={17} strokeWidth={1.5} />
              </button>
            </header>

            {characters.length === 0 ? (
              <div className="mn-empty mn-empty--drawer">
                <div className="mn-empty__title">
                  角色库还是空的
                </div>

                <div className="mn-empty__text">
                  先创建角色，再回来一起读。
                </div>
              </div>
            ) : (
              <div className="mn-character-list">
                {characters.map((character) => {
                  const isSelected =
                    selectedCharacter?.id === character.id;

                  return (
                    <button
                      type="button"
                      className={`mn-character ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      key={character.id}
                      onClick={() => handleSelectCharacter(character)}
                      aria-pressed={isSelected}
                    >
                      {character.avatar ? (
                        <img
                          src={character.avatar}
                          alt=""
                          className="mn-character__avatar"
                        />
                      ) : (
                        <span
                          className="mn-character__placeholder"
                          aria-hidden="true"
                        />
                      )}

                      <span className="mn-character__content">
                        <span className="mn-character__name">
                          {character.name || 'Unnamed companion'}
                        </span>

                        <span className="mn-character__bio">
                          {character.bio || '安静地共读。'}
                        </span>
                      </span>

                      {isSelected && (
                        <Check
                          className="mn-character__check"
                          size={16}
                          strokeWidth={1.7}
                          aria-label="当前已选择"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {showSettings && (
        <MarginNotesSettingsModal
          currentSettings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(nextSettings) => {
            setSettings({
              ...DEFAULT_SETTINGS,
              ...nextSettings
            });
          }}
        />
      )}
    </div>
  );
}
