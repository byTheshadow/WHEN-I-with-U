import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Settings,
  RefreshCw,
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

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(selectedChatId)),
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

      setChats(Array.isArray(chatList) ? chatList : []);
      setCharacters(Array.isArray(characterList) ? characterList : []);

      if (!selectedChatId && chatList?.[0]?.id) {
        setSelectedChatId(String(chatList[0].id));
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
      setRecords(nextRecords);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    void loadAlmanac();
  }, [loadAlmanac]);

  const stats = useMemo(
    () => getAlmanacStats(records),
    [records]
  );

  const heatmapData = useMemo(
    () => getHeatmapData(records),
    [records]
  );

  const [rhythmObservation, setRhythmObservation] = useState(null);

  useEffect(() => {
    let active = true;

    getRhythmObservation({
      chatId: selectedChatId,
      records,
    }).then((result) => {
      if (active) setRhythmObservation(result);
    });

    return () => {
      active = false;
    };
  }, [selectedChatId, records]);

  const handleSaveConfig = async (nextConfig) => {
    const saved = await saveAlmanacConfig(
      selectedChatId,
      nextConfig
    );

    setConfig(saved);
    setShowSettings(false);
  };

  return (
    <main className="almanac-app">
      <header className="almanac-header">
        <button
          type="button"
          className="almanac-icon-button"
          onClick={onBackHub}
          aria-label="返回主页"
          title="返回主页"
        >
          <ArrowLeft size={16} />
        </button>

        <div>
          <p className="almanac-eyebrow">WHEN I with U</p>
          <h1>岁时纪</h1>
          <span>Almanac / a record of returning</span>
        </div>

        <div className="almanac-header-actions">
          <button
            type="button"
            className="almanac-icon-button"
            onClick={() => void loadAlmanac()}
            aria-label="刷新"
            title="刷新"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            className="almanac-icon-button"
            onClick={() => setShowSettings((value) => !value)}
            aria-label="观察设置"
            title="观察设置"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      <section className="almanac-intro">
        <p>
          这里不安排生活，也不替你定义生活。
          这里只留下那些曾经回来过的时间。
        </p>
      </section>

      <AlmanacChatSelector
        chats={chats}
        characters={characters}
        selectedChatId={selectedChatId}
        onChange={setSelectedChatId}
      />

      {!selectedChatId ? (
        <section className="almanac-panel almanac-empty">
          还没有可以观察的聊天窗口。
        </section>
      ) : isLoading ? (
        <section className="almanac-panel almanac-empty">
          正在显影相遇痕迹。
        </section>
      ) : (
        <>
          <section className="almanac-identity">
            <div>
              <p className="almanac-eyebrow">One room, one trace</p>
              <h2>{selectedChat?.title || '未命名聊天'}</h2>
              <p>
                与 {selectedCharacter?.name || '这位角色'} 的独立相处空间
              </p>
            </div>
          </section>

          <AlmanacObservation
            stats={stats}
            rhythmObservation={rhythmObservation}
          />

          <AlmanacHeatmap data={heatmapData} />

          <AlmanacMilestones stats={stats} />

          {showSettings && (
            <AlmanacSettingsPanel
              config={config}
              onSave={handleSaveConfig}
            />
          )}
        </>
      )}
    </main>
  );
};

export default AlmanacApp;
