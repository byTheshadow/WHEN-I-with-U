// src/apps/badges/BadgeExchangeApp.jsx
//
// 每月限定聊天成就图标——兑换 / 佩戴页面。
//
// 页面结构照抄 hourglass/memory 那一套（根容器 min-height: 100vh +
// 内容居中限宽），按聊天窗口切换（跟 Almanac 一样，这些条件本来就是
// "单个角色/会话内"累计的，不是全局的）。
//
// 流程：
// 1. 选一个聊天窗口 -> 读取当前月份的赛季定义（没有就提示"这个月没有
//    限定图标"）。
// 2. 如果这个赛季还没解锁，第一次打开就顺带触发一次 AI 自定条件生成
//    （已经生成过就不会重复调用）。
// 3. 每次重新检查三个条件，任意一个满足就整套解锁，并播放一次解锁动画。
// 4. 已经解锁的图标可以自由切换佩戴；没解锁的灰显，角色"想要"的那个会
//    高亮标出来。

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Medal, RefreshCw } from 'lucide-react';

import db from '../../db';
import { getActiveSeason } from './monthlyBadgeCatalog';
import {
  checkAndUnlockSeason,
  equipBadge,
  getBadgeBoardForChat,
  getOrCreateSeasonUnlockRow,
  markUnlockAnimationSeen,
} from './monthlyBadgeService';
import { ensureMonthlyAiCondition } from './monthlyBadgeAiService';
import BadgeDancingLineBoard from './BadgeDancingLineBoard';
import BadgeArchivedSeasonCard from './BadgeArchivedSeasonCard';
import BadgeRegularPlaceholder from './BadgeRegularPlaceholder';
import './badges.css';

const TABS = [
  { id: 'current', label: '本月' },
  { id: 'past', label: '往期' },
  { id: 'regular', label: '常规' },
];

export const BadgeExchangeApp = ({ onBackHub }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [board, setBoard] = useState({ seasons: [], equippedBadgeId: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);
  const [equipError, setEquipError] = useState('');
  const [activeTab, setActiveTab] = useState('current');

  const activeSeason = useMemo(() => getActiveSeason(), []);

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(selectedChatId)),
    [chats, selectedChatId]
  );
  const numericChatId = selectedChat?.id ?? null;

  const selectedCharacter = useMemo(
    () => characters.find((character) => String(character.id) === String(selectedChat?.characterId)),
    [characters, selectedChat]
  );

  const loadChats = useCallback(async () => {
    try {
      const [chatList, characterList] = await Promise.all([
        db.chats.orderBy('updatedAt').reverse().toArray(),
        db.characters.toArray(),
      ]);

      const safeChats = Array.isArray(chatList) ? chatList : [];
      setChats(safeChats);
      setCharacters(Array.isArray(characterList) ? characterList : []);

      if (!selectedChatId && safeChats[0]?.id) {
        setSelectedChatId(String(safeChats[0].id));
      }
    } catch (error) {
      console.error('[BadgeExchange] 读取聊天窗口失败：', error);
      setChats([]);
      setCharacters([]);
    }
  }, [selectedChatId]);

  const refreshBoard = useCallback(async ({ silent = false } = {}) => {
    if (!numericChatId) {
      setBoard({ seasons: [], equippedBadgeId: null });
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    setEquipError('');

    try {
      if (activeSeason) {
        const { seasonKey, def } = activeSeason;
        const unlockRow = await getOrCreateSeasonUnlockRow(numericChatId, seasonKey);

        if (!unlockRow.unlocked && !unlockRow.aiCondition) {
          // 生成结果直接落库，下面 checkAndUnlockSeason 会重新读取最新的那一行。
          await ensureMonthlyAiCondition({
            chatId: numericChatId,
            seasonKey,
            seasonDef: def,
            unlockRow,
          });
        }

        const result = await checkAndUnlockSeason(numericChatId, seasonKey);

        if (result?.justUnlocked) {
          setShowUnlockCelebration(true);
        }
      }

      const nextBoard = await getBadgeBoardForChat(numericChatId, activeSeason?.seasonKey || null);
      setBoard(nextBoard);
    } catch (error) {
      console.error('[BadgeExchange] 刷新兑换面板失败：', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [numericChatId, activeSeason]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshBoard({ silent: true });
    setTimeout(() => setIsRefreshing(false), 420);
  };

  const handleDismissCelebration = async () => {
    setShowUnlockCelebration(false);
    if (activeSeason) {
      await markUnlockAnimationSeen(numericChatId, activeSeason.seasonKey);
    }
  };

  const handleEquip = async (badgeId) => {
    if (!numericChatId) return;
    const nextBadgeId = board.equippedBadgeId === badgeId ? null : badgeId;

    try {
      await equipBadge(numericChatId, nextBadgeId);
      setBoard((prev) => ({ ...prev, equippedBadgeId: nextBadgeId }));
    } catch (error) {
      setEquipError(error?.message || '佩戴失败');
    }
  };

  return (
    <main className="badge-app">
      <div className="badge-section">
        <header className="badge-header">
          <button
            type="button"
            className="badge-back-button"
            onClick={onBackHub}
            aria-label="返回主页"
          >
            <ArrowLeft size={15} strokeWidth={1.5} />
            <span>返回</span>
          </button>

          <div className="badge-header-mark">
            <Medal size={14} strokeWidth={1.5} />
            <span className="badge-kicker">BADGES</span>
          </div>
        </header>

        <section className="badge-intro">
          <p className="badge-eyebrow">A CHANGING SET OF ICONS, EARNED TOGETHER</p>
          <h1>限定图标</h1>
          <p className="badge-subtitle">达成这个月的全部条件，解锁整套图标，随时切换佩戴。</p>
        </section>

        <nav className="badge-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`badge-tab ${activeTab === tab.id ? 'badge-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="badge-room-row">
          <div className="badge-room-info">
            <h2>{selectedChat?.title || '选择一个聊天窗口'}</h2>
            <p>与 {selectedCharacter?.name || '这位角色'} 的专属兑换记录</p>
          </div>

          <label className="badge-chat-selector">
            <select
              value={selectedChatId || ''}
              onChange={(event) => setSelectedChatId(event.target.value)}
            >
              <option value="">选择一个聊天窗口</option>
              {chats.map((chat) => {
                const character = characters.find((item) => item.id === chat.characterId);
                return (
                  <option value={chat.id} key={chat.id}>
                    {chat.title || character?.name || '未命名聊天'}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              className="badge-refresh-button"
              onClick={handleManualRefresh}
              disabled={isRefreshing || !numericChatId}
              aria-label="刷新"
              title="刷新"
            >
              <RefreshCw size={13} strokeWidth={1.5} className={isRefreshing ? 'badge-refreshing' : ''} />
            </button>
          </label>
        </section>

        {!numericChatId ? (
          <section className="badge-empty">还没有可以兑换的聊天窗口。</section>
        ) : isLoading ? (
          <section className="badge-empty">正在读取兑换记录…</section>
        ) : activeTab === 'regular' ? (
          <BadgeRegularPlaceholder />
        ) : activeTab === 'past' ? (
          board.seasons.filter((season) => !season.isCurrent).length === 0 ? (
            <section className="badge-empty">还没有往期徽章，这个月过去之后会出现在这里。</section>
          ) : (
            board.seasons
              .filter((season) => !season.isCurrent)
              .map((season) => (
                <BadgeArchivedSeasonCard
                  key={season.seasonKey}
                  season={season}
                  equippedBadgeId={board.equippedBadgeId}
                  onEquip={handleEquip}
                />
              ))
          )
        ) : !activeSeason ? (
          <section className="badge-empty">这个月还没有限定图标，下一个限定季节到了再来看看。</section>
        ) : (
          <BadgeDancingLineBoard
            board={board}
            activeSeasonKey={activeSeason.seasonKey}
            equipError={equipError}
            onEquip={handleEquip}
          />
        )}
      </div>

      {showUnlockCelebration && (
        <div className="badge-celebration" role="dialog" aria-modal="true">
          <div className="badge-celebration-card">
            <div className="badge-celebration-glow" aria-hidden="true" />
            <Medal size={28} strokeWidth={1.3} className="badge-celebration-icon" />
            <h3>整套图标已解锁</h3>
            <p>这个月的 {activeSeason?.def?.badges?.length || ''} 个限定图标现在都可以自由佩戴了。</p>
            <button type="button" onClick={handleDismissCelebration}>
              好的
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default BadgeExchangeApp;