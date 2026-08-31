// src/apps/margin-notes/MarginNotesApp.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  SlidersHorizontal,
  Bookmark,
  Plus,
  RefreshCw,
  Users
} from 'lucide-react';
import db from '../../db';
import { CURATED_EXCERPTS } from './curatedExcerpts';
import { generateMarginNotePage } from './marginNotesAiService';
import MarginNotesPage from './MarginNotesPage';
import MarginNotesArchive from './MarginNotesArchive';
import MarginNotesSettingsModal from './MarginNotesSettingsModal';
import './marginNotes.css';

export default function MarginNotesApp({ onBackHub }) {
  const [activeTab, setActiveTab] = useState('reading'); // 'reading' | 'archive'
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const [archiveList, setArchiveList] = useState([]);
  const [settings, setSettings] = useState({
    targetLang: 'en',
    auxLang: '简体中文',
    themePref: '文学与生活哲思',
    customAuthorHint: ''
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // 加载角色库与配置
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const charList = await db.characters.toArray();
        const settingsRecord = await db.settings.get('margin_notes_settings');
        const archives = await db.marginNotes.reverse().toArray();

        if (isMounted) {
          setCharacters(charList || []);
          if (charList && charList.length > 0) {
            setSelectedCharacter(charList[0]);
          }
          if (settingsRecord?.value) {
            setSettings(settingsRecord.value);
          }
          setArchiveList(archives || []);

          // 如果已有存档，默认打开最新一页；若无，默认载入首篇经典公域典藏
          if (archives && archives.length > 0) {
            setCurrentPage(archives[0]);
          } else {
            const firstCurated = CURATED_EXCERPTS[0];
            setCurrentPage({
              ...firstCurated,
              characterName: charList?.[0]?.name || 'Companion',
              characterAvatar: charList?.[0]?.avatar || '',
              date: new Date().toISOString().slice(0, 10),
              createdAt: Date.now()
            });
          }
        }
      } catch (err) {
        console.error('[MarginNotes] 初始化数据失败:', err);
      }
    };

    void initData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 刷新历史归档列表
  const refreshArchive = useCallback(async () => {
    try {
      const list = await db.marginNotes.reverse().toArray();
      setArchiveList(list || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 触发 AI 寻找并批注新书页
  const handleGenerateNewPage = async () => {
    if (isLoadingAi) return;
    setIsLoadingAi(true);
    try {
      const newPageData = await generateMarginNotePage({
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

      // 存入 Dexie
      const id = await db.marginNotes.add(newPageData);
      const savedPage = { ...newPageData, id };

      setCurrentPage(savedPage);
      setActiveTab('reading');
      await refreshArchive();
    } catch (err) {
      alert(`获取新书页失败: ${err.message || '请检查 API 设置'}`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // 切换伴读角色
  const handleSelectCharacter = (char) => {
    setSelectedCharacter(char);
    if (currentPage) {
      setCurrentPage((prev) => ({
        ...prev,
        characterId: char.id,
        characterName: char.name,
        characterAvatar: char.avatar
      }));
    }
  };

  return (
    <div className="margin-notes-shell">
      {/* 顶部固定导航 */}
      <header
        className="w-full max-w-[440px] px-3.5 pt-3 pb-2 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md"
        style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBackHub}
            className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            title="返回主页"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="font-serif text-sm font-bold tracking-wide">页边注</h2>
            <p className="text-[9px] uppercase tracking-widest opacity-40">The Margin Notes</p>
          </div>
        </div>

        {/* 顶部动作组 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab(activeTab === 'reading' ? 'archive' : 'reading')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: activeTab === 'archive' ? 'var(--control-soft-bg)' : 'transparent',
              border: '1px solid var(--card-border)'
            }}
          >
            <Bookmark className="h-3.5 w-3.5 opacity-70" />
            <span>书架</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            style={{ border: '1px solid var(--card-border)' }}
            title="设置语种与偏好"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* 角色切换条 (如果存在多个角色) */}
      {characters.length > 0 && (
        <div className="w-full max-w-[440px] px-3.5 pt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider opacity-40 shrink-0">
            <Users className="h-3 w-3" />
            <span>伴读</span>
          </div>
          {characters.map((char) => {
            const isSelected = selectedCharacter?.id === char.id;
            return (
              <button
                key={char.id}
                onClick={() => handleSelectCharacter(char)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs shrink-0 transition-all ${
                  isSelected ? 'font-bold shadow-xs' : 'opacity-60 hover:opacity-90'
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--control-soft-bg)' : 'transparent',
                  border: '1px solid var(--card-border)'
                }}
              >
                {char.avatar ? (
                  <img src={char.avatar} alt={char.name} className="h-3.5 w-3.5 rounded-full object-cover" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full bg-current opacity-20" />
                )}
                <span>{char.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* AI 寻找新篇章操作区 */}
      <div className="w-full max-w-[440px] px-3.5 py-2.5 flex justify-between items-center">
        <button
          onClick={handleGenerateNewPage}
          disabled={isLoadingAi}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-medium transition-all shadow-xs"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            border: '1px solid var(--card-border)'
          }}
        >
          {isLoadingAi ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>正在翻阅名著并请 {selectedCharacter?.name || '伴读'} 批注...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 opacity-70" />
              <span>翻开新一页（AI 共读选篇）</span>
            </>
          )}
        </button>
      </div>

      {/* 视图主体 */}
      <main className="w-full flex-1">
        {activeTab === 'reading' ? (
          <MarginNotesPage
            page={currentPage}
            character={selectedCharacter}
            onPageUpdated={(up) => {
              setCurrentPage(up);
              refreshArchive();
            }}
            onDeletePage={(deletedId) => {
              const remaining = archiveList.filter((a) => a.id !== deletedId);
              setArchiveList(remaining);
              if (remaining.length > 0) {
                setCurrentPage(remaining[0]);
              } else {
                setCurrentPage(null);
              }
            }}
          />
        ) : (
          <MarginNotesArchive
            archiveList={archiveList}
            onSelectPage={(page) => {
              setCurrentPage(page);
              setActiveTab('reading');
            }}
            onDeletePage={(deletedId) => {
              const remaining = archiveList.filter((a) => a.id !== deletedId);
              setArchiveList(remaining);
              if (currentPage?.id === deletedId) {
                setCurrentPage(remaining[0] || null);
              }
            }}
          />
        )}
      </main>

      {/* 偏好设置弹窗 */}
      {showSettings && (
        <MarginNotesSettingsModal
          currentSettings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(newSet) => setSettings(newSet)}
        />
      )}
    </div>
  );
}
