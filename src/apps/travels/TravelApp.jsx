import React, { useState, useEffect } from 'react';
import { Plane, Plus, Compass, Sparkles, MapPin } from 'lucide-react';
import { db } from '../../db';
import { TravelCard } from './components/TravelCard';
import { PassportModal } from './components/PassportModal';
import { WishlistBookingModal } from './components/WishlistBookingModal';
import { InTransitDashboard } from './components/InTransitDashboard';
import { PostcardDetailModal } from './components/PostcardDetailModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { generateCompanionPostcard } from '../../services/aiService';

export const TravelApp = () => {
  const [travels, setTravels] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [postcardsMap, setPostcardsMap] = useState({});
  const [activeTravel, setActiveTravel] = useState(null);

  // Modals 控制
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [setupData, setSetupData] = useState(null);

  // 选中的明信片 Modal
  const [activePostcard, setActivePostcard] = useState(null);

  // 删除销毁 Modal
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allTravels = await db.travels.orderBy('createdAt').reverse().toArray();
    const allChars = await db.characters.toArray();

    setTravels(allTravels);
    setCharacters(allChars);

    // 载入每趟旅行的明信片
    const map = {};
    for (const travel of allTravels) {
      const cards = await db.travelPostcards
        .where('travelId')
        .equals(travel.id)
        .toArray();

      map[travel.id] = cards;
    }

    setPostcardsMap(map);
  };

  // 发起新旅行 - 选伴侣
  const handleStartNewJourney = (char) => {
    setSelectedCharacter(char);
    setIsPassportOpen(true);
  };

  // 完成护照人设填写
  const handlePassportNext = (data) => {
    setSetupData(data);
    setIsPassportOpen(false);
    setIsBookingOpen(true);
  };

  // 确认行程并开启旅程
  const handleConfirmTrip = async (finalData) => {
    setIsBookingOpen(false);

    const payload = {
      characterId: selectedCharacter.id,
      destination: finalData.destination,
      status: 'in_transit',
      userPersona: finalData.userPersona,
      luggageNotes: finalData.luggageNotes,
      durationHours: finalData.durationHours,
      flightNo: finalData.flightNo,
      hotelName: finalData.hotelName,
      startTime: Date.now(),
      endTime: Date.now() + finalData.durationHours * 3600 * 1000,
      createdAt: Date.now()
    };

    delete payload.id; // 防止 Dexie ++id 报错

    const newId = await db.travels.add(payload);
    const createdTravel = await db.travels.get(newId);

    // 生成初始第一张旅途明信片：将完整 travel 对象传入 AI
    await triggerNewPostcard(createdTravel, selectedCharacter);

    await loadData();
    setActiveTravel(createdTravel);
  };

  // 生成明信片
  const triggerNewPostcard = async (travel, char) => {
    if (!travel || !char) return;

    // 将完整旅行对象 travel 传入 AI 服务
    const postcard = await generateCompanionPostcard(char, travel);

    const payload = {
      travelId: travel.id,
      characterId: char.id,
      ...postcard,
      timestamp: Date.now(),
      isRead: false
    };

    delete payload.id;

    await db.travelPostcards.add(payload);
    await loadData();
  };

  // Re-roll 重刷明信片感悟
  const handleRerollPostcard = async (postcardId) => {
    const pc = await db.travelPostcards.get(postcardId);
    if (!pc) return;

    const char = characters.find((character) => character.id === pc.characterId);
    const travel = await db.travels.get(pc.travelId);

    if (!char || !travel) return;

    // 将完整旅行对象 travel 传入 AI 服务
    const newPc = await generateCompanionPostcard(char, travel);

    await db.travelPostcards.update(postcardId, {
      letterContent: newPc.letterContent,
      giftItem: newPc.giftItem,
      metPerson: newPc.metPerson
    });

    await loadData();

    const updated = await db.travelPostcards.get(postcardId);
    setActivePostcard(updated);
  };

  // 确认彻底销毁删除
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    await db.travels.delete(deleteTargetId);
    await db.travelPostcards.where('travelId').equals(deleteTargetId).delete();

    setDeleteTargetId(null);

    if (activeTravel?.id === deleteTargetId) {
      setActiveTravel(null);
    }

    await loadData();
  };

  const getCharacter = (id) => characters.find((character) => character.id === id);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* 头部标题与面包屑 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Compass className="w-6 h-6" />
          </div>

          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: 'var(--text-main)' }}
            >
              打卡足迹与旅行手帐
            </h1>

            <p
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              每一次游历都是一张拟真卡片 · 伴侣离线托管漫游
            </p>
          </div>
        </div>

        {activeTravel && (
          <button
            onClick={() => setActiveTravel(null)}
            className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-neutral-500/10"
            style={{
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            返回旅行卡片列表
          </button>
        )}
      </div>

      {/* 视图分发：特定旅行的仪表盘 vs 全部旅行卡片矩阵 */}
      {activeTravel ? (
        <InTransitDashboard
          travel={activeTravel}
          character={getCharacter(activeTravel.characterId)}
          postcards={postcardsMap[activeTravel.id] || []}
          onOpenPostcard={(card) => setActivePostcard(card)}
          onGenerateNewPostcard={() =>
            triggerNewPostcard(
              activeTravel,
              getCharacter(activeTravel.characterId)
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {/* 发起新旅行伴侣选择栏 */}
          <div
            className="p-5 rounded-3xl border"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)'
            }}
          >
            <h3
              className="text-xs font-bold mb-3 flex items-center gap-1.5"
              style={{ color: 'var(--text-main)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>选择伴侣，准备一场新旅行</span>
            </h3>

            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => handleStartNewJourney(char)}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border hover:border-amber-500 transition-all shrink-0"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-border)'
                  }}
                >
                  <img
                    src={char.avatar}
                    alt={char.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />

                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-main)' }}
                  >
                    与 {char.name} 启程
                  </span>

                  <Plus className="w-3.5 h-3.5 text-amber-500" />
                </button>
              ))}
            </div>
          </div>

          {/* 旅行小卡片 Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {travels.map((travel) => (
              <TravelCard
                key={travel.id}
                travel={travel}
                character={getCharacter(travel.characterId)}
                postcardCount={(postcardsMap[travel.id] || []).length}
                onClick={() => setActiveTravel(travel)}
                onDelete={(id) => setDeleteTargetId(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 拟真护照 Modal */}
      <PassportModal
        isOpen={isPassportOpen}
        onClose={() => setIsPassportOpen(false)}
        character={selectedCharacter}
        onNext={handlePassportNext}
      />

      {/* 机票策划 Modal */}
      <WishlistBookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        character={selectedCharacter}
        setupData={setupData}
        onConfirmTrip={handleConfirmTrip}
      />

      {/* 明信片 3D Modal */}
      <PostcardDetailModal
        isOpen={Boolean(activePostcard)}
        onClose={() => setActivePostcard(null)}
        postcard={activePostcard}
        character={getCharacter(activePostcard?.characterId)}
        onReroll={handleRerollPostcard}
      />

      {/* 二次确认删除 Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="彻底销毁旅行记录"
        message="确定要彻底删除该趟旅行记录及其搜集的所有明信片与伴手礼吗？该操作不可撤销。"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

export default TravelApp;

