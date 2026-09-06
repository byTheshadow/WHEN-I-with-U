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
import AlmanacInitialization from './components/AlmanacInitialization';

import {
  clearAlmanacRecords,
  filterAlmanacRecordsByConfig,
  getAlmanacConfig,
  getAlmanacRecords,
  getAlmanacStats,
  getHeatmapData,
  saveAlmanacConfig,
} from './services/almanacService';

import {
  createAlmanacMilestone,
  deleteAlmanacMilestone,
  getAlmanacMilestones,
  updateAlmanacMilestone,
} from './services/almanacMilestoneService';

import {
  getRhythmObservation,
} from './services/almanacRhythmService';

import './almanac.css';

export const AlmanacApp = ({ onBackHub }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [config, setConfig] = useState(null);
  const [records, setRecords] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [showInitialization, setShowInitialization] =
    useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStatsLoading, setIsStatsLoading] =
    useState(false);
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
      setChats([]);
      setCharacters([]);
    }
  }, [selectedChatId]);

  const loadAlmanac = useCallback(async () => {
    if (!selectedChatId) {
      setConfig(null);
      setRecords([]);
      setMilestones([]);
      setShowInitialization(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [nextConfig, nextMilestones] =
        await Promise.all([
          getAlmanacConfig(selectedChatId),
          getAlmanacMilestones(selectedChatId),
        ]);

      setConfig(nextConfig);

      setMilestones(
        Array.isArray(nextMilestones)
          ? nextMilestones
          : []
      );

      /*
       * 尚未选择数据模式时，不读取历史记录参与首屏统计。
       */
      if (!nextConfig?.initializationCompleted) {
        setRecords([]);
        setShowInitialization(true);
        return;
      }

      setShowInitialization(false);

      const allRecords = await getAlmanacRecords(
        selectedChatId
      );

      const filteredRecords =
        filterAlmanacRecordsByConfig(
          allRecords,
          nextConfig
        );

      setRecords(
        Array.isArray(filteredRecords)
          ? filteredRecords
          : []
      );
    } catch (error) {
      console.error('[Almanac] 读取相遇记录失败：', error);
      setRecords([]);
      setMilestones([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChatId]);

  const refreshAlmanac = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await loadChats();
      await loadAlmanac();
    } catch (error) {
      console.error('[Almanac] 刷新失败：', error);
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
    })
      .then((result) => {
        if (active) {
          setRhythmObservation(result);
        }
      })
      .catch((error) => {
        console.error('[Almanac] 获取节律观察失败：', error);

        if (active) {
          setRhythmObservation(null);
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

  const handleInitializationComplete = async ({
    dataMode,
    firstMeetingDate = null,
  }) => {
    if (!selectedChatId || !dataMode) {
      return;
    }

    const now = new Date().toISOString();

    const savedConfig = await saveAlmanacConfig(
      selectedChatId,
      {
        initializationCompleted: true,
        dataMode,
        observationStartedAt:
          dataMode === 'all_history'
            ? null
            : now,
        observationResetAt:
          dataMode === 'all_history'
            ? null
            : now,
        preserveMilestones:
          dataMode === 'milestones_only',
      }
    );

    if (
      dataMode === 'milestones_only' &&
      firstMeetingDate
    ) {
      await createAlmanacMilestone({
        chatId: selectedChatId,
        type: 'first_meeting',
        title: '第一次相遇',
        date: firstMeetingDate,
        isRecurring: false,
        showCountdown: true,
        allowNaturalReminder: false,
      });
    }

    const nextMilestones =
      await getAlmanacMilestones(selectedChatId);

    setConfig(savedConfig);
    setMilestones(
      Array.isArray(nextMilestones)
        ? nextMilestones
        : []
    );
    setShowInitialization(false);

    const allRecords = await getAlmanacRecords(
      selectedChatId
    );

    const filteredRecords =
      filterAlmanacRecordsByConfig(
        allRecords,
        savedConfig
      );

    setRecords(
      Array.isArray(filteredRecords)
        ? filteredRecords
        : []
    );
  };

  const handleRestartAlmanac = async () => {
    if (!selectedChatId) {
      return;
    }

    const confirmed = window.confirm(
      '确定从今天重新开始 Almanac 吗？\n\n旧记录会保留，但不会继续参与统计。'
    );

    if (!confirmed) {
      return;
    }

    const now = new Date().toISOString();

    const savedConfig = await saveAlmanacConfig(
      selectedChatId,
      {
        initializationCompleted: true,
        dataMode: 'fresh_start',
        observationStartedAt: now,
        observationResetAt: now,
        preserveMilestones: false,
      }
    );

    setConfig(savedConfig);

    const allRecords = await getAlmanacRecords(
      selectedChatId
    );

    const filteredRecords =
      filterAlmanacRecordsByConfig(
        allRecords,
        savedConfig
      );

    setRecords(
      Array.isArray(filteredRecords)
        ? filteredRecords
        : []
    );

    setShowInitialization(false);
  };

  const handleClearAlmanacRecords = async () => {
    if (!selectedChatId) {
      return;
    }

    const confirmed = window.confirm(
      '确定清空当前聊天的 Almanac 相处记录吗？\n\n聊天消息、长期记忆、角色资料和纪念日不会受到影响。'
    );

    if (!confirmed) {
      return;
    }

    await clearAlmanacRecords(selectedChatId);

    setRecords([]);
    setRhythmObservation(null);
  };

  const handleCreateMilestone = async (
    milestone
  ) => {
    if (!selectedChatId || !milestone) {
      return;
    }

    const createdId = await createAlmanacMilestone({
      chatId: selectedChatId,
      type: milestone.isRecurring
        ? 'anniversary'
        : 'countdown',
      ...milestone,
    });

    if (!createdId) {
      return;
    }

    const nextMilestones =
      await getAlmanacMilestones(selectedChatId);

    setMilestones(
      Array.isArray(nextMilestones)
        ? nextMilestones
        : []
    );
  };

  const handleUpdateMilestone = async (
    id,
    patch
  ) => {
    if (!id || !patch) {
      return;
    }

    const updated = await updateAlmanacMilestone(
      id,
      patch
    );

    if (!updated) {
      return;
    }

    const nextMilestones =
      await getAlmanacMilestones(selectedChatId);

    setMilestones(
      Array.isArray(nextMilestones)
        ? nextMilestones
        : []
    );
  };

  const handleDeleteMilestone = async (id) => {
    if (!id) {
      return;
    }

    await deleteAlmanacMilestone(id);

    setMilestones((current) =>
      current.filter(
        (milestone) => milestone.id !== id
      )
    );
  };

  /**
   * 保存 Almanac 设置。
   *
   * 默认行为：
   * - 保存成功
   * - 更新当前配置
   * - 关闭整个设置区域
   *
   * 当 options.close === false 时：
   * - 保存成功
   * - 更新当前配置
   * - 不关闭整个设置区域
   *
   * 用于时区确认弹窗，避免确认时区后整个设置页面消失。
   */
  const handleSaveConfig = async (
    nextConfig,
    options = {}
  ) => {
    if (!selectedChatId || !nextConfig) {
      return null;
    }

    const saved = await saveAlmanacConfig(
      selectedChatId,
      nextConfig
    );

    setConfig(saved);

    if (options.close !== false) {
      setShowSettings(false);
      setActiveSection('record');
    }

    return saved;
  };

  const handleNavigation = (section) => {
    setActiveSection(section);

    if (section === 'settings') {
      setShowSettings(true);

      window.setTimeout(() => {
        document
          .querySelector(
            '[data-almanac-section="settings"]'
          )
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
      }, 30);

      return;
    }

    document
      .querySelector(
        `[data-almanac-section="${section}"]`
      )
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
  };

  return (
    <main className="almanac-app">
      <div
        className="almanac-grain"
        aria-hidden="true"
      />

      <div className="almanac-content">
        <div
          className="almanac-corner almanac-corner-top"
          aria-hidden="true"
        />

        <div
          className="almanac-corner almanac-corner-bottom"
          aria-hidden="true"
        />

        <header className="almanac-utility-bar">
          <button
            type="button"
            className="almanac-back-button"
            onClick={onBackHub}
            aria-label="返回主页"
            title="返回主页"
          >
            <ArrowLeft
              size={15}
              strokeWidth={1.5}
            />
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
              disabled={isRefreshing}
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
              <Settings
                size={13}
                strokeWidth={1.5}
              />

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
        ) : showInitialization ? (
          <AlmanacInitialization
            onComplete={handleInitializationComplete}
          />
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
                isLoading={isStatsLoading}
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
              <AlmanacMilestones
                stats={stats}
                milestones={milestones}
                onCreate={handleCreateMilestone}
                onUpdate={handleUpdateMilestone}
                onDelete={handleDeleteMilestone}
              />
            </section>

            {showSettings && (
              <section
                className="almanac-settings-section almanac-reveal"
                data-almanac-section="settings"
              >
                <AlmanacSettingsPanel
                  config={config}
                  onSave={handleSaveConfig}
                  onRestart={handleRestartAlmanac}
                  onClearRecords={
                    handleClearAlmanacRecords
                  }
                  onOpenMilestones={() => {
                    setShowSettings(false);
                    setActiveSection('milestone');

                    window.setTimeout(() => {
                      document
                        .querySelector(
                          '[data-almanac-section="milestone"]'
                        )
                        ?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                    }, 30);
                  }}
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
