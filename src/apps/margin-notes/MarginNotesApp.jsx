import React, { useCallback, useEffect, useState } from 'react';
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

  const [pageExportNode, setPageExportNode] = useState(null);

  const refreshArchive = useCallback(async () => {
    try {
      const list = await db.marginNotes
        .orderBy('createdAt')
        .reverse()
        .toArray();

      setArchiveList(list || []);

      return list || [];
    } catch (error) {
      console.error('[MarginNotes] 读取书架失败：', error);
      return [];
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const [characterList, settingRecord, pages] =
          await Promise.all([
            db.characters.toArray(),
            db.settings.get('margin_notes_settings'),
            db.marginNotes
              .orderBy('createdAt')
              .reverse()
              .toArray()
          ]);

        if (!mounted) return;

        const list = characterList || [];
        const savedSettings = settingRecord?.value || DEFAULT_SETTINGS;

        setCharacters(list);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...savedSettings
        });

        if (list.length > 0) {
          setSelectedCharacter(list[0]);
        }

        setArchiveList(pages || []);

        if (pages?.length > 0) {
          setCurrentPage(pages[0]);
        } else if (CURATED_EXCERPTS.length > 0) {
          setCurrentPage({
            ...CURATED_EXCERPTS[0],
            characterId: list[0]?.id || null,
            characterName: list[0]?.name || 'Companion',
            characterAvatar: list[0]?.avatar || '',
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

    void initialize();

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
      console.error('[MarginNotes] 生成新页失败：', error);
      window.alert(
        `翻开新页失败：${error?.message || '请检查 AI 设置'}`
      );
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

    const confirmed = window.confirm(
      '确定要撕下这一页吗？删除后，文章、批注和回注都会被移除。'
    );

    if (!confirmed) return;

    try {
      await db.marginNotes.delete(currentPage.id);

      const pages = await refreshArchive();

      setCurrentPage(pages[0] || null);
      setShowMenu(false);
    } catch (error) {
      console.error('[MarginNotes] 删除书页失败：', error);
    }
  };

  const handleExport = async () => {
    if (!pageExportNode || isExporting) return;

    setIsExporting(true);
    setShowMenu(false);

    try {
      await exportPageToImage(
        pageExportNode,
        `margin-notes-${currentPage?.source?.workTitle || 'page'}.png`
      );
    } catch (error) {
      console.error('[MarginNotes] 导出失败：', error);
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
      <header className="mn-topbar">
        <div className="mn-topbar__side">
          <button
            type="button"
            className="mn-icon-button"
            onClick={onBackHub}
            aria-label="返回主页"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="mn-topbar__title">
          THE MARGIN NOTES
          <small>READING TOGETHER</small>
        </div>

        <div className="mn-topbar__side">
          <button
            type="button"
            className="mn-icon-button"
            onClick={() => setActiveView(
              activeView === 'reading' ? 'archive' : 'reading'
            )}
            aria-label={activeView === 'reading' ? '打开书架' : '返回书页'}
          >
            <Bookmark size={17} />
          </button>

          <button
            type="button"
            className="mn-icon-button"
            onClick={() => setShowMenu((value) => !value)}
            aria-label="打开更多操作"
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
                  disabled={isExporting || !currentPage}
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
                    className="danger"
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
                onClick={() => setShowMenu(false)}
              >
                <Bookmark size={14} />
                <span>正在浏览书架</span>
              </button>
            )}
          </div>
        )}
      </header>

      <main>
        {activeView === 'reading' ? (
          <div
            ref={setPageExportNode}
            className="mn-export-area"
          >
            <MarginNotesPage
              page={currentPage}
              character={selectedCharacter}
              onPageUpdated={handlePageUpdated}
              onOpenCompanionPicker={() => setShowCharacters(true)}
              onOpenMenu={() => setShowMenu(true)}
            />
          </div>
        ) : (
          <div className="mn-content">
            <div className="mn-running-head">
              <span>BOOKSHELF</span>
              <span className="mn-running-head__right">
                {archiveList.length} PAGES
              </span>
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
                className="mn-icon-button"
                onClick={() => setShowCharacters(false)}
                aria-label="关闭角色选择"
              >
                <X size={17} />
              </button>
            </div>

            {characters.length === 0 && (
              <div className="mn-empty">
                <div className="mn-empty__title">
                  角色库还是空的
                </div>
                <div className="mn-empty__text">
                  创建角色后，他们才可以出现在共读页。
                </div>
              </div>
            )}

            {characters.map((character) => {
              const isSelected =
                selectedCharacter?.id === character.id;

              return (
                <button
                  type="button"
                  className="mn-character-option"
                  key={character.id}
                  onClick={() => handleSelectCharacter(character)}
                >
                  {character.avatar ? (
                    <img
                      src={character.avatar}
                      alt=""
                      className="mn-character-option__avatar"
                    />
                  ) : (
                    <span className="mn-character-option__placeholder" />
                  )}

                  <span>
                    <span className="mn-character-option__name">
                      {character.name}
                    </span>

                    <span className="mn-character-option__bio">
                      {character.bio || '安静地共读。'}
                    </span>
                  </span>

                  {isSelected && (
                    <Check
                      size={16}
                      className="mn-character-option__check"
                    />
                  )}
                </button>
              );
            })}
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
