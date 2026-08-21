// src/apps/pebbling/PebblingApp.jsx
import React, { useState, useEffect, useCallback } from 'react';
import db from '../../db';
import PebbleNestCompass from './PebbleNestCompass';
import PebblePairCard from './PebblePairCard';
import ThrowPebbleModal from './ThrowPebbleModal';
import ConfirmModal from '../../components/ConfirmModal';
import NotificationToast from '../../components/NotificationToast';
import { 
  throwPebble, 
  processPendingPebbles, 
  getPebblingsByCharacter, 
  aiInitiatePebble, 
  deletePebble 
} from './pebbleService';
import { Waves, Sparkles, Inbox } from 'lucide-react';

export default function PebblingApp() {
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);
  const [pebblings, setPebblings] = useState([]);
  const [countsMap, setCountsMap] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 删除确认弹窗
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // 1. 初始化数据
  const loadData = useCallback(async () => {
    const chars = await db.characters.toArray();
    setCharacters(chars);
    if (chars.length > 0 && !activeCharId) {
      setActiveCharId(chars[0].id);
    }

    // 统计各个角色的石头总数
    const allPebbles = await db.pebblings.toArray();
    const map = {};
    allPebbles.forEach(p => {
      map[p.characterId] = (map[p.characterId] || 0) + 1;
    });
    setCountsMap(map);

    if (activeCharId) {
      const list = await getPebblingsByCharacter(activeCharId);
      setPebblings(list);
    }
  }, [activeCharId]);

  // 2. 轮询检查是否有到达时间戳的 pending 小石头
  useEffect(() => {
    loadData();

    const interval = setInterval(async () => {
      const updated = await processPendingPebbles();
      if (updated > 0) {
        loadData();
        setToastMessage('海浪带回了一颗温暖的小石头');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loadData]);

  // 投掷 handler
  const handleThrow = async (data) => {
    await throwPebble(data);
    setToastMessage('小石头已悄悄落入巢中');
    loadData();
  };

  // 召唤 AI 漫步主动发石头
  const handleAiInitiate = async (charId) => {
    setToastMessage('对方正在海滩漫步寻找石头...');
    const res = await aiInitiatePebble(charId);
    if (res) {
      setToastMessage('对方从海滩带回了一颗石头放入巢中');
      loadData();
    }
  };

  // 删除处理
  const handleDeleteConfirm = async () => {
    if (deleteTargetId) {
      await deletePebble(deleteTargetId);
      setDeleteTargetId(null);
      setToastMessage('记录已悄悄抹去');
      loadData();
    }
  };

  const activeChar = characters.find(c => c.id === activeCharId);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Toast 提示 */}
      {toastMessage && (
        <NotificationToast 
          message={toastMessage} 
          onClose={() => setToastMessage(null)} 
        />
      )}

      {/* 确认删除弹窗 */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="确认清理石头"
        message="确定要把这颗小石头从巢穴中清理掉吗？此操作无法撤销。"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* 投掷弹窗 */}
      <ThrowPebbleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        characters={characters}
        defaultCharId={activeCharId}
        onThrow={handleThrow}
      />

      {/* 顶部标题区 */}
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Waves className="w-5 h-5 opacity-80" style={{ color: 'var(--text-main)' }} />
          <h1 className="text-xl font-medium tracking-wide" style={{ color: 'var(--text-main)' }}>
            PEBBLING · 企鹅小石
          </h1>
        </div>
        <p className="text-xs opacity-70" style={{ color: 'var(--text-sub)' }}>
          毫无压力的延迟投递，像企鹅把打磨光滑的小石头悄悄衔进对方的巢穴里。
        </p>
      </div>

      {/* 拟物巢穴罗盘控制器 */}
      <PebbleNestCompass
        characters={characters}
        activeCharId={activeCharId}
        onSelectChar={setActiveCharId}
        countsMap={countsMap}
        onOpenThrowModal={() => setIsModalOpen(true)}
        onAiInitiate={handleAiInitiate}
      />

      {/* 小石头列表 */}
      <div className="w-full min-h-[300px]">
        {pebblings.length === 0 ? (
          <div 
            className="w-full py-16 rounded-2xl border flex flex-col items-center justify-center text-center p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-sub)'
            }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 border opacity-60" style={{ borderColor: 'var(--card-border)' }}>
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>
              {activeChar?.name || '此'} 的小巢里还是空的
            </h3>
            <p className="text-xs max-w-sm mb-4 opacity-75">
              衔一颗润石或者让对方在海滩漫步，开启一段毫无社交负担的微光陪伴吧。
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>丢入第一颗小石头</span>
            </button>
          </div>
        ) : (
          pebblings.map(pebble => (
            <PebblePairCard
              key={pebble.id}
              pebble={pebble}
              character={activeChar}
              onDelete={(id) => setDeleteTargetId(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
