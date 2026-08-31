// src/apps/margin-notes/MarginNotesApp.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  MoreHorizontal,
  Bookmark,
  Sparkles,
  Download,
  Trash2,
  SlidersHorizontal,
  RefreshCw,
  X,
  Check
} from 'lucide-react';
import db from '../../db';
import { CURATED_EXCERPTS } from './curatedExcerpts';
import { generateMarginNotePage } from './marginNotesAiService';
import { exportPageToImage } from './marginNotesExportService';
import MarginNotesPage from './MarginNotesPage';
import MarginNotesArchive from './MarginNotesArchive';
import MarginNotesSettingsModal from './MarginNotesSettingsModal';
import './marginNotes.css';

export default function MarginNotesApp({ onBackHub }) {
  const [activeView, setActiveView] = useState('reading'); // 'reading' | 'archive'
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const [archiveList, setArchiveList] = useState([]);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [settings, setSettings] = useState({
    targetLang: 'en',
    auxLang: '简体中文',
    themePref: '文学与生活哲思',
    customAuthorHint: ''
  });

  const pageExportRef = useRef(null);

  // 初始化加载
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const charList = await db.characters.toArray();
        const settingsRecord = await db.settings.get('margin_notes_settings');
        const archives = await db.marginNotes.reverse().toArray();

        if (!isMounted) return;

        setCharacters(charList || []);
        if (charList && charList.length > 0) {
          setSelectedCharacter(charList[0]);
        }
        if (settingsRecord?.value) {
          setSettings(settingsRecord.value);
        }
        setArchiveList(archives || []);

        if (archives && archives.length > 0) {
          setCurrentPage(archives[0]);
        } else {
          // 预载公域名著首篇
          const defaultEx = CURATED_EXCERPTS[0];
          setCurrentPage({
            ...defaultEx,
            characterName: charList?.[0]?.name || 'Companion',
            characterAvatar: charList?.[0]?.avatar || '',
            date: new Date().toISOString().slice(0, 10),
            createdAt: Date.now()
          });
        }
      } catch (err) {
        console.error('初始化页边注失败:', err);
      }
    };

    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshArchive = useCallback(async () => {
    const list = await db.marginNotes.reverse().toArray();
    setArchiveList(list || []);
  }, []);

  // AI 翻开新一页
  const handleTurnNewPage = async () => {
    if (isLoadingAi) return;
    setIsLoadingAi(true);
    try {
      const pageData = await generateMarginNotePage({
        character: selectedCharacter,
        targetLanguage: settings.targetLang,
        targetLanguageLabel:
          settings.targetLang === 'ja'
            ? '日本語'
            : settings.targetLang === 'fr'
            ? 'Français'
            : settings.targetLang === 'de'
            ? 'Deutsch'
            : 'English',
        auxiliaryLanguageLabel: settings.auxLang,
        themePreference: settings.themePref,
        customWorkHint: settings.customAuthorHint
      });

      const id = await db.marginNotes.add(pageData);
      const saved = { ...pageData, id };
      setCurrentPage(saved);
      setActiveView('reading');
      await refreshArchive();
    } catch (err) {
      alert(`无法翻开新页: ${err.message}`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // 导出书签
  const handleExportImage = async () => {
    if (!pageExportRef.current || isExporting) return;
    try {
      setIsExporting(true);
      setShowMoreMenu(false);
      await exportPageToImage(
        pageExportRef.current,
        `margin-notes-${currentPage?.source?.workTitle || 'page'}.png`
      );
    } catch (err) {
      alert('导出图片失败');
    } finally {
      setIsExporting(false);
    }
  };

  // 删除当前书页
  const handleDeleteCurrentPage = async () => {
    if (!currentPage?.id) return;
    if (window.confirm('撕下并移出此书页？')) {
      await db.marginNotes.delete(currentPage.id);
      setShowMoreMenu(false);
      const remaining = archiveList.filter((a) => a.id !== currentPage.id);
      setArchiveList(remaining);
      setCurrentPage(remaining[0] || null);
    }
  };

  return (
    <div className="margin-notes-root">
      {/* 顶部极简透明导航 */}
      <header className="w-full flex items-center justify-between px-4 py-3 sticky top-0 z-30 backdrop-blur-xs bg-[var(--bg-main)]/80">
        <button
          onClick={onBackHub}
          className="p-1.5 opacity-60 hover:opacity-100 transition-opacity"
          title="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <span className="font-serif text-xs font-semibold tracking-wider opacity-60">
          THE MARGIN NOTES
        </span>

        {/* 右上角 ⋯ 菜单 */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1.5 opacity-60 hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showMoreMenu && (
            <div
              className="absolute right-0 mt-1 w-36 rounded-xl py-1.5 shadow-xl text-xs z-50 animate-in fade-in duration-100 text-left"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)'
              }}
            >
              <button
                onClick={handleExportImage}
                className="w-full px-3 py-2 flex items-center gap-2 opacity-80 hover:opacity-100 hover:bg-[var(--control-soft-bg)]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>存为书签</span>
              </button>
              <button
                onClick={() => {
                  setShowSettings(true);
                  setShowMoreMenu(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 opacity-80 hover:opacity-100 hover:bg-[var(--control-soft-bg)]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>共读设置</span>
              </button>
              {currentPage?.id && (
                <button
                  onClick={handleDeleteCurrentPage}
                  className="w-full px-3 py-2 flex items-center gap-2 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>撕下此页</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 主视图 */}
      <main className="w-full flex-1">
        {activeView === 'reading' ? (
          <MarginNotesPage
            page={currentPage}
            character={selectedCharacter}
            pageRef={pageExportRef}
            onPageUpdated={(up) => {
              setCurrentPage(up);
              refreshArchive();
            }}
            onOpenCompanionPicker={() => setShowCompanionPicker(true)}
          />
        ) : (
          <div className="pt-4">
            <MarginNotesArchive
              archiveList={archiveList}
              onSelectPage={(page) => {
                setCurrentPage(page);
                setActiveView('reading');
              }}
              onDeletePage={(delId) => {
                const remaining = archiveList.filter((a) => a.id !== delId);
                setArchiveList(remaining);
                if (currentPage?.id === delId) {
                  setCurrentPage(remaining[0] || null);
                }
              }}
            />
          </div>
        )}
      </main>

      {/* 底部悬浮控制岛（书架切换与翻页） */}
      <div className="mn-bottom-island">
        <button
          onClick={() => setActiveView(activeView === 'reading' ? 'archive' : 'reading')}
          className="flex items-center gap-1.5 text-xs opacity-75 hover:opacity-100 font-serif"
        >
          <Bookmark className="h-3.5 w-3.5" />
          <span>{activeView === 'reading' ? '书架' : '书页'}</span>
        </button>

        <div className="h-3 w-px bg-[var(--card-border)]" />

        <button
          onClick={handleTurnNewPage}
          disabled={isLoadingAi}
          className="flex items-center gap-1.5 text-xs font-serif opacity-90 hover:opacity-100 disabled:opacity-40"
        >
          {isLoadingAi ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span>{isLoadingAi ? '翻阅中...' : '翻开新一页'}</span>
        </button>
      </div>

      {/* 伴读角色选择抽屉 */}
      {showCompanionPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md rounded-t-2xl p-5 shadow-2xl text-left space-y-4"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
              <div>
                <h4 className="font-serif text-sm font-bold">选择共读伴侣</h4>
                <p className="text-[10px] opacity-40">此后的新页批注将由其写下</p>
              </div>
              <button
                onClick={() => setShowCompanionPicker(false)}
                className="p-1 opacity-50 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {characters.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCharacter(c);
                    setShowCompanionPicker(false);
                  }}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                    selectedCharacter?.id === c.id ? 'font-bold' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: 'var(--control-soft-bg)' }}
                >
                  <div className="flex items-center gap-3">
                    {c.avatar ? (
                      <img src={c.avatar} alt={c.name} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-current opacity-20" />
                    )}
                    <div>
                      <div className="text-xs">{c.name}</div>
                      <div className="text-[10px] opacity-50 font-normal line-clamp-1">
                        {c.bio || '安静地共读'}
                      </div>
                    </div>
                  </div>
                  {selectedCharacter?.id === c.id && <Check className="h-3.5 w-3.5" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 偏好设置弹窗 */}
      {showSettings && (
        <MarginNotesSettingsModal
          currentSettings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => setSettings(s)}
        />
      )}
    </div>
  );
}
