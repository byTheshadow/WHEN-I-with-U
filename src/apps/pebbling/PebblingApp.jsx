import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Inbox } from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import NotificationToast from '../../components/NotificationToast';
import PebbleNestCompass from './PebbleNestCompass';
import PebblePairCard from './PebblePairCard';
import ThrowPebbleModal from './ThrowPebbleModal';
import {
  aiInitiatePebble,
  deletePebble,
  getPebblingsByCharacter,
  processPendingPebbles,
  throwPebble,
} from './pebbleService';
import './pebbling.css';

export default function PebblingApp({ onBack }) {
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);
  const [pebblings, setPebblings] = useState([]);
  const [countsMap, setCountsMap] = useState({});
  const [isThrowOpen, setIsThrowOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const loadData = useCallback(async () => {
    const loadedCharacters = await db.characters.toArray();
    const allPebbles = await db.pebblings.toArray();

    setCharacters(loadedCharacters);

    setActiveCharId((currentId) => {
      const exists = loadedCharacters.some((character) => character.id === currentId);
      return exists ? currentId : loadedCharacters[0]?.id || null;
    });

    const nextCounts = allPebbles.reduce((result, pebble) => {
      result[pebble.characterId] = (result[pebble.characterId] || 0) + 1;
      return result;
    }, {});

    setCountsMap(nextCounts);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!activeCharId) {
      setPebblings([]);
      return;
    }

    getPebblingsByCharacter(activeCharId).then(setPebblings);
  }, [activeCharId, countsMap]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const completedCount = await processPendingPebbles();

      if (completedCount > 0) {
        setToastMessage('潮水带回了一颗温暖的小石头');
        await loadData();
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [loadData]);

  const pendingCount = useMemo(
    () => pebblings.filter((pebble) => pebble.status === 'pending').length,
    [pebblings]
  );

  const handleThrow = async (payload) => {
    await throwPebble(payload);
    setToastMessage('小石头已悄悄落入巢中');
    await loadData();
  };

  const handleAiInitiate = async (characterId) => {
    setToastMessage('对方正在安静地寻找一颗石头');

    const result = await aiInitiatePebble(characterId);

    if (result) {
      setToastMessage('一颗石头已经被悄悄带回');
      await loadData();
    } else {
      setToastMessage('这次没有找到合适的石头，稍后再试试');
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;

    await deletePebble(deleteTargetId);
    setDeleteTargetId(null);
    setToastMessage('这颗石头已从巢穴中取走');
    await loadData();
  };

  return (
    <div className="pebbling-app">
      {toastMessage && (
        <NotificationToast
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="取走这颗石头"
        message="确定要将这颗石头从巢穴中取走吗？这段记录不会恢复。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      <ThrowPebbleModal
        isOpen={isThrowOpen}
        onClose={() => setIsThrowOpen(false)}
        characters={characters}
        defaultCharId={activeCharId}
        onThrow={handleThrow}
      />

      <div className="pebbling-topline">
        <button type="button" className="pebbling-back-button" onClick={onBack}>
          <ArrowLeft size={15} strokeWidth={1.7} />
          返回
        </button>

        <span className="pebbling-edition">FIELD NOTES / 001</span>
      </div>

      <section className="pebbling-intro">
        <p className="pebbling-intro__eyebrow">AN UNHURRIED EXCHANGE</p>
        <h1 className="pebbling-intro__title">
          Pebbling <em>with U.</em>
        </h1>
        <p className="pebbling-intro__copy">
          那些不必立刻回答，也仍然会被好好收下的事。
        </p>
      </section>

      {characters.length > 0 ? (
        <div key={activeCharId} className="pebbling-nest-content">
          <PebbleNestCompass
            characters={characters}
            activeCharId={activeCharId}
            countsMap={countsMap}
            pendingCount={pendingCount}
            onSelectChar={setActiveCharId}
            onOpenThrowModal={() => setIsThrowOpen(true)}
            onAiInitiate={handleAiInitiate}
          />

          <div className="pebbling-section-label">
            RECENTLY RESTING IN THIS NEST
          </div>

          <section className="pebbling-field">
            {pebblings.length > 0 ? (
              pebblings.map((pebble, index) => (
                <PebblePairCard
                  key={pebble.id}
                  pebble={pebble}
                  character={characters.find(
                    (character) => character.id === pebble.characterId
                  )}
                  index={index}
                  onDelete={setDeleteTargetId}
                />
              ))
            ) : (
              <div className="pebbling-empty">
                <Inbox size={25} strokeWidth={1.35} />
                <h3>这个巢穴还留着空白</h3>
                <p>衔一颗石头回来，或者等对方在漫步时想起你。</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="pebbling-empty">
          <Inbox size={25} strokeWidth={1.35} />
          <h3>还没有可以安放石头的巢穴</h3>
          <p>请先在角色资料中创建一位陪伴者，再回来放下第一颗石头。</p>
        </section>
      )}
    </div>
  );
}
