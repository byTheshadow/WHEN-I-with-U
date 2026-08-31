import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

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
    try {
      const pages = await db.marginNotes
        .orderBy('createdAt')
        .reverse()
        .toArray();

      setArchiveList(pages || []);

      return pages || [];
    } catch (error) {
      console.error('[MarginNotes] 刷新书架失败：', error);
      return [];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const [characterList, settingRecord, pages] = await Promise.all([
          db.characters.toArray(),
          db.settings.get('margin_notes_settings'),
          db.marginNotes.orderBy('createdAt').reverse().toArray()
        ]);

        if (!isMounted) return;

        const availableCharacters = characterList || [];
        const savedSettings = settingRecord?.value || {};

        setCharacters(availableCharacters);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...savedSettings
        });

        /*
         * 如果当前书页有记录的角色，优先选中它。
         * 否则才选择角色库中的第一位。
         */
        const newestPage = pages?.[0] || null;

        const pageCharacter = newestPage?.characterId
          ? availableCharacters.find(
              (character) => character.id === newestPage.characterId
            )
          : null;

        setSelectedCharacter(
          pageCharacter || availableCharacters[0] || null
        );

        setArchiveList(pages || []);

        if (newestPage) {
          setCurrentPage(newestPage);
          return;
        }

        if (CURATED_EXCERPTS.length > 0) {
          const fallback = CURATED_EXCERPTS[0];

          setCurrentPage({
            ...fallback,
            characterId: availableCharacters[0]?.id || null,
            characterName: availableCharacters[0]?.name || 'Companion',
            characterAvatar: availableCharacters[0]?.avatar || '',
            date: new Date().toISOString().slice(0, 10),
            createdAt: Date.now()
          });
        }
      } catch (error) {
        console.error('[MarginNotes] 初始化失败：', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
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

  const handleOpenArchive = () => {
    setShowMenu(false);
    setActiveView((current) =>
      current === 'reading' ? 'archive' : 'reading'
    );
  };

  const handleGeneratePage = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setShowMenu(false);

    try {
      const generatedPage = await generateMarginNotePage({
        character: selectedCharacter,
        targetLanguage: settings.targetLang,
        targetLanguageLabel:
          LANGUAGE_LABELS[settings.targetLang] || settings.targetLang,
        auxiliaryLanguageLabel: settings.auxLang,
        themePreference: settings.themePref,
        customWorkHint: settings.customAuthorHint
      });

      const pageToSave = {
        ...generatedPage,
        characterId: selectedCharacter?.id || null,
        characterName: selectedCharacter?.name || 'Companion',
        characterAvatar: selectedCharacter?.avatar || '',
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now()
      };

      const pageId = await db.marginNotes.add(pageToSave);
      const savedPage = {
        ...pageToSave,
        id: pageId
      };

      setCurrentPage(savedPage);
      setActiveView('reading');

      await refreshArchive();
    } catch (error) {
      console.error('[MarginNotes] 生成书页失败：', error);

      window.alert(
        `翻开新页失败：${error?.message || '请检查 AI 设置'}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!pageExportRef.current || isExporting) return;

    setIsExporting(true);
    setShowMenu(false);

    try {
      const rawTitle = currentPage?.source?.workTitle || 'page';

      const safeTitle = rawTitle
        .replace(/[\\/:*?"<>|]/g, '-')
        .slice(0, 60);

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

  const handleDeleteCurrentPage = async () => {
    if (!currentPage?.id) return;

    const confirmed = window.confirm(
      '确定要撕下这一页吗？文章、角色批注和你的回注都会被永久删除。'
    );

    if (!confirmed) return;

    try {
      await db.marginNotes.delete(currentPage.id);

      const remainingPages = await refreshArchive();

      setCurrentPage(remainingPages[0] || null);
      setShowMenu(false);
    } catch (error) {
      console.error('[MarginNotes] 删除书页失败：', error);
      window.alert('删除失败，请稍后重试。');
    }
  };

  const handleChooseCharacter = (character) => {
    /*
     * 选择角色只影响下一次 AI 翻开新页与新的回注回应。
     * 不覆盖当前已存书页的 characterName / characterId 快照。
     */
    setSelectedCharacter(character);
    setShowCharacters(false);
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
      {/* 唯一顶栏：不再使用 mn-page，避免制造第二层页面内边距 */}
      <header className="mn-app-topbar" data-export-ignore="true">
        <button
          type="button"
          className="mn-edge-action"
          onClick={onBackHub}
          aria-label="返回主页"
        >
          <ArrowLeft size={18} />
        </button>

        <span className="mn-page-number">
          {activeView === 'archive'
            ? 'BOOKSHELF'
            : 'THE MARGIN NOTES'}
        </span>

        <div className="mn-app-topbar__right">
          <button
            type="button"
            className="mn-edge-action"
            onClick={handleOpenArchive}
            aria-label={
              activeView === 'reading' ? '打开书架' : '返回阅读页'
            }
          >
            <Bookmark size={17} />
          </button>

          <button
            type="button"
            className="mn-edge-action right"
            onClick={() => setShowMenu((value) => !value)}
            aria-label="更多操作"
          >
            <MoreHorizontal size={19} />
          </button>
        </div>

        {showMenu && (
          <div className="mn-menu">
            {activeView === 'reading' && (
              <>
                <button
                  type="button"
                  onClick={handleGeneratePage}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>
                    {isGenerating ? '正在翻阅……' : '翻开新一页'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!currentPage || isExporting}
                >
                  <Download size={14} />
                  <span>
                    {isExporting ? '正在保存……' : '保存为书签'}
                  </span>
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
                  <button
                    type="button"
                    onClick={handleDeleteCurrentPage}
                  >
                    <Trash2 size={14} />
                    <span>撕下这一页</span>
                  </button>
                )}
              </>
            )}

            {activeView === 'archive' && (
              <button
                type="button"
                onClick={() => {
                  setActiveView('reading');
                  setShowMenu(false);
                }}
              >
                <Bookmark size={14} />
                <span>回到当前书页</span>
              </button>
            )}
          </div>
        )}
      </header>

      {activeView === 'reading' ? (
        <main ref={pageExportRef}>
          <MarginNotesPage
            page={currentPage}
            character={selectedCharacter}
            onPageUpdated={handlePageUpdated}
            onOpenCompanionPicker={() => setShowCharacters(true)}
            onOpenMenu={() => setShowMenu(true)}
          />
        </main>
      ) : (
        <main className="mn-reading-page">
          <div className="mn-rule" />

          <div style={{ paddingTop: '2rem' }}>
            <MarginNotesArchive
              archiveList={archiveList}
              onSelectPage={(page) => {
                const pageCharacter = characters.find(
                  (character) => character.id === page.characterId
                );

                if (pageCharacter) {
                  setSelectedCharacter(pageCharacter);
                }

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
        </main>
      )}

      {showCharacters && (
        <div
          className="mn-drawer-backdrop"
          onClick={() => setShowCharacters(false)}
        >
          <section
            className="mn-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mn-drawer__head">
              <div>
                <div className="mn-drawer__title">
                  选择今天一起读的人
                </div>

                <div className="mn-drawer__subtitle">
                  THE NEXT PAGE WILL CARRY THEIR VOICE
                </div>
              </div>

              <button
                type="button"
                className="mn-edge-action"
                onClick={() => setShowCharacters(false)}
                aria-label="关闭角色选择"
              >
                <X size={17} />
              </button>
            </div>

            {characters.length === 0 ? (
              <div className="mn-empty">
                <div className="mn-empty__title">
                  角色库还是空的
                </div>
                <div className="mn-empty__text">
                  先创建角色，再回来一起读。
                </div>
              </div>
            ) : (
              characters.map((character) => {
                const isSelected =
                  selectedCharacter?.id === character.id;

                return (
                  <button
                    type="button"
                    className="mn-character"
                    key={character.id}
                    onClick={() => handleChooseCharacter(character)}
                  >
                    {character.avatar ? (
                      <img
                        src={character.avatar}
                        alt=""
                        className="mn-character__avatar"
                      />
                    ) : (
                      <span className="mn-character__placeholder" />
                    )}

                    <span>
                      <span className="mn-character__name">
                        {character.name}
                      </span>

                      <span className="mn-character__bio">
                        {character.bio || '安静地共读。'}
                      </span>
                    </span>

                    {isSelected && (
                      <Check
                        size={16}
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
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
