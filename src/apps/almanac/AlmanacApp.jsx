import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  RefreshCw,
  Settings,
} from 'lucide-react';

import db from '../../db';

import AlmanacChatSelector from './components/AlmanacChatSelector';
import AlmanacHeatmap from './components/AlmanacHeatmap';
import AlmanacObservation from './components/AlmanacObservation';
import AlmanacMilestones from './components/AlmanacMilestones';
import AlmanacSettingsPanel from './components/AlmanacSettingsPanel';

import {
  getAlmanacConfig,
  getAlmanacRecords,
  getAlmanacStats,
  getHeatmapData,
  saveAlmanacConfig,
} from './services/almanacService';

import { getRhythmObservation } from './services/almanacRhythmService';

import './almanac.css';

export const AlmanacApp = ({ onBackHub }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [config, setConfig] = useState(null);
  const [records, setRecords] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState('record');
  const [rhythmObservation, setRhythmObservation] =
    useState(null);

  const selectedChat = useMemo(
    () =>
      chats.find(
        (chat) =>
          String(chat.id) === String(selectedChatId)
      ),
    [chats, selectedChatId]
  );

  const selectedCharacter = useMemo(
    () =>
      characters.find(
        (character) =>
          String(character.id) ===
          String(selectedChat?.characterId)
      ),
    [characters, selectedChat]
  );

  const loadChats = useCallback(async () => {
    try {
      const [chatList, characterList] = await Promise.all([
        db.chats.orderBy('updatedAt').reverse().toArray(),
        db.characters.toArray(),
      ]);

      const safeChats = Array.isArray(chatList)
        ? chatList
        : [];

      setChats(safeChats);
      setCharacters(
        Array.isArray(characterList) ? characterList : []
      );

      if (!selectedChatId && safeChats[0]?.id) {
        setSelectedChatId(String(safeChats[0].id));
      }
    } catch (error) {
      console.error('[Almanac] 读取聊天窗口失败：', error);
    }
  }, [selectedChatId]);

  const loadAlmanac = useCallback(async () => {
    if (!selectedChatId) {
      setConfig(null);
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [nextConfig, nextRecords] = await Promise.all([
        getAlmanacConfig(selectedChatId),
        getAlmanacRecords(selectedChatId),
      ]);

      setConfig(nextConfig);
      setRecords(
        Array.isArray(nextRecords) ? nextRecords : []
      );
    } catch (error) {
      console.error('[Almanac] 读取相遇记录失败：', error);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChatId]);

  const refreshAlmanac = async () => {
    setIsRefreshing(true);

    try {
      await loadChats();
      await loadAlmanac();
    } finally {
      window.setTimeout(() => {
        setIsRefreshing(false);
      }, 420);
    }
  };

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    void loadAlmanac();
  }, [loadAlmanac]);

  useEffect(() => {
    let active = true;

    if (!selectedChatId) {
      setRhythmObservation(null);
      return undefined;
    }

    getRhythmObservation({
      chatId: selectedChatId,
      records,
    }).then((result) => {
      if (active) {
        setRhythmObservation(result);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedChatId, records]);

  const stats = useMemo(
    () => getAlmanacStats(records),
    [records]
  );

  const heatmapData = useMemo(
    () => getHeatmapData(records),
    [records]
  );

  const handleSaveConfig = async (nextConfig) => {
    const saved = await saveAlmanacConfig(
      selectedChatId,
      nextConfig
    );

    setConfig(saved);
    setShowSettings(false);
  };

  const handleNavigation = (section) => {
    setActiveSection(section);

    if (section === 'settings') {
      setShowSettings(true);
      return;
    }

    const target = document.querySelector(
      `[data-almanac-section="${section}"]`
    );

    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <main className="almanac-app">
      <div className="almanac-grain" aria-hidden="true" />
      <div className="almanac-frame">
        <div className="almanac-corner almanac-corner-top" />
        <div className="almanac-corner almanac-corner-bottom" />

        <header className="almanac-utility-bar">
          <button
            type="button"
            className="almanac-back-button"
            onClick={onBackHub}
            aria-label="返回主页"
            title="返回主页"
          >
            <ArrowLeft size={15} strokeWidth={1.5} />
          </button>

          <span className="almanac-room-code">
            ALMANAC / ROOM 01
          </span>

          <div className="almanac-header-actions">
            <button
              type="button"
              className="almanac-utility-button"
              onClick={() => void refreshAlmanac()}
              aria-label="刷新"
              title="刷新"
            >
              <RefreshCw
                size={13}
                strokeWidth={1.5}
                className={
                  isRefreshing
                    ? 'almanac-refreshing'
                    : ''
                }
              />
              <span>刷新</span>
            </button>

            <button
              type="button"
              className="almanac-utility-button"
              onClick={() => {
                setShowSettings((value) => !value);
                setActiveSection('settings');
              }}
              aria-label="观察设置"
              title="观察设置"
            >
              <Settings size={13} strokeWidth={1.5} />
              <span>设置</span>
            </button>
          </div>
        </header>

        <section className="almanac-masthead">
          <p className="almanac-masthead-kicker">
            A PRIVATE RECORD OF RETURNING
          </p>

          <h1>岁时纪</h1>

          <p className="almanac-masthead-subtitle">
            WHEN I WITH U · OBSERVATION ARCHIVE
          </p>

          <div className="almanac-masthead-rule" />
        </section>

        <section className="almanac-room-selector">
          <p className="almanac-eyebrow">
            OBSERVE ONE ROOM
          </p>

          <div className="almanac-room-row">
            <div className="almanac-room-info">
              <h2>
                {selectedChat?.title || '选择相遇空间'}
              </h2>

              <p>
                与{' '}
                {selectedCharacter?.name || '这位角色'}
                的独立相处记录
              </p>
            </div>

            <AlmanacChatSelector
              chats={chats}
              characters={characters}
              selectedChatId={selectedChatId}
              onChange={setSelectedChatId}
            />
          </div>
        </section>

        {!selectedChatId ? (
          <section className="almanac-empty almanac-reveal">
            还没有可以观察的聊天窗口。
          </section>
        ) : isLoading ? (
          <section className="almanac-empty almanac-loading">
            <span className="almanac-loading-dot" />
            正在显影相遇痕迹
          </section>
        ) : (
          <>
            <section className="almanac-intro">
              <p>
                这里不安排生活，也不替你定义生活。
                这里只留下那些曾经回来过的时间。
              </p>
            </section>

            <section
              className="almanac-record-section almanac-reveal"
              data-almanac-section="record"
            >
              <div className="almanac-record-heading">
                <div>
                  <p className="almanac-eyebrow">
                    A QUIET RECORD
                  </p>
                  <h2>这里留下过</h2>
                </div>

                <span className="almanac-record-index">
                  INDEX{' '}
                  {String(records.length).padStart(5, '0')}
                </span>
              </div>

              <AlmanacObservation
                stats={stats}
                rhythmObservation={rhythmObservation}
              />
            </section>

            <section
              className="almanac-trace-section almanac-reveal"
              data-almanac-section="trace"
            >
              <AlmanacHeatmap data={heatmapData} />
            </section>

            <section
              className="almanac-milestone-section almanac-reveal"
              data-almanac-section="milestone"
            >
              <AlmanacMilestones stats={stats} />
            </section>

            {showSettings && (
              <section
                className="almanac-settings-section almanac-reveal"
                data-almanac-section="settings"
              >
                <AlmanacSettingsPanel
                  config={config}
                  onSave={handleSaveConfig}
                />
              </section>
            )}

            <p className="almanac-footer-note">
              PRIVATE ARCHIVE / ONE ROOM, ONE TRACE
              <br />
              NOTHING HERE IS A SCHEDULE.
            </p>
          </>
        )}
      </div>

      <nav
        className="almanac-bottom-nav"
        aria-label="Almanac 导航"
      >
        <button
          type="button"
          className={
            activeSection === 'record' ? 'active' : ''
          }
          onClick={() => handleNavigation('record')}
        >
          记录
        </button>

        <button
          type="button"
          className={
            activeSection === 'trace' ? 'active' : ''
          }
          onClick={() => handleNavigation('trace')}
        >
          显影
        </button>

        <button
          type="button"
          className={
            activeSection === 'milestone' ? 'active' : ''
          }
          onClick={() => handleNavigation('milestone')}
        >
          时刻
        </button>

        <button
          type="button"
          className={
            activeSection === 'settings' ? 'active' : ''
          }
          onClick={() => handleNavigation('settings')}
        >
          设置
        </button>
      </nav>
    </main>
  );
};

export default AlmanacApp;

