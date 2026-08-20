import React, { useState, useEffect } from 'react';
import { Plus, Compass, Sparkles } from 'lucide-react';
import { db } from '../../db';
import { TravelCard } from './components/TravelCard';
import { PassportModal } from './components/PassportModal';
import { WishlistBookingModal } from './components/WishlistBookingModal';
import { BoardingTicketModal } from './components/BoardingTicketModal';
import { InTransitDashboard } from './components/InTransitDashboard';
import { PostcardDetailModal } from './components/PostcardDetailModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { generateCompanionPostcard } from '../../services/aiService';

export const TravelApp = ({ onBackHub }) => {
  const [travels, setTravels] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [postcardsMap, setPostcardsMap] = useState({});
  const [activeTravel, setActiveTravel] = useState(null);

  // Modals 状态控制
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isBoardingTicketOpen, setIsBoardingTicketOpen] = useState(false);

  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [passportSetupData, setPassportSetupData] = useState(null);
  const [finalTripData, setFinalTripData] = useState(null);

  // 选中的明信片 Modal
  const [activePostcard, setActivePostcard] = useState(null);
  // 删除销毁 Modal
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  // 成功进入托管旅程的提示
  const [enterNotification, setEnterNotification] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allTravels = await db.travels.orderBy('createdAt').reverse().toArray();
    const allChars = await db.characters.toArray();
    setTravels(allTravels);
    setCharacters(allChars);

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

  // 1. 发起新旅行
  const handleStartNewJourney = (char) => {
    setSelectedCharacter(char);
    setIsPassportOpen(true);
  };

  // 2. 护照填写完成 -> 进入订票 Modal
  const handlePassportNext = (data) => {
    setPassportSetupData(data);
    setIsPassportOpen(false);
    setIsBookingOpen(true);
  };

  // 3. 订票完成 -> 弹出双机票 Modal (出票动画)
  const handleBookingConfirm = (tripDetails) => {
    setIsBookingOpen(false);
    setFinalTripData(tripDetails);
    setIsBoardingTicketOpen(true);
  };

  // 4. 用户点击收好机票 -> 存库并正式进入漫游
  const handleFinishTuckInTickets = async () => {
    setIsBoardingTicketOpen(false);

    const payload = {
      characterId: selectedCharacter.id,
      destination: finalTripData.destination,
      status: 'in_transit',
      userPassportName: passportSetupData.userPassportName,
      userPersona: passportSetupData.userPersona,
      luggageNotes: passportSetupData.luggageNotes,
      durationHours: passportSetupData.durationHours,
      flightNo: finalTripData.flightNo,
      hotelName: finalTripData.hotelName,
      startTime: Date.now(),
      endTime: Date.now() + passportSetupData.durationHours * 3600 * 1000,
      createdAt: Date.now()
    };

    delete payload.id;
    const newId = await db.travels.add(payload);
    const createdTravel = await db.travels.get(newId);

    // 自动生成第一张动态双人明信片
    await triggerNewPostcard(createdTravel, selectedCharacter);

    await loadData();
    setActiveTravel(createdTravel);

    // 显式提示
    setEnterNotification(`你与 ${selectedCharacter.name} 已正式踏上前往 [${finalTripData.destination}] 的双人漫游之旅！`);
    setTimeout(() => setEnterNotification(''), 4000);
  };

  const triggerNewPostcard = async (travel, char) => {
    if (!travel || !char) return;
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

  const handleRerollPostcard = async (postcardId) => {
    const pc = await db.travelPostcards.get(postcardId);
    if (!pc) return;
    const char = characters.find(c => c.id === pc.characterId);
    const travel = await db.travels.get(pc.travelId);
    if (!char || !travel) return;

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

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    await db.travels.delete(deleteTargetId);
    await db.travelPostcards.where('travelId').equals(deleteTargetId).delete();
    setDeleteTargetId(null);
    if (activeTravel?.id === deleteTargetId) setActiveTravel(null);
    await loadData();
  };

  const getCharacter = (id) => characters.find(c => c.id === id);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* 极简顶栏 */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--divider)' }}>
        <div className="flex items-center gap-2.5">
          <Compass className="w-5 h-5" style={{ color: 'var(--text-main)' }} />
          <span className="font-serif font-bold text-base" style={{ color: 'var(--text-main)' }}>
            双人漫游足迹
          </span>
        </div>

        {activeTravel ? (
          <button
            onClick={() => setActiveTravel(null)}
            className="px-4 py-2 rounded-xl text-xs font-semibold border hover:opacity-70"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
          >
            返回旅程卡片列表
          </button>
        ) : (
          characters.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => handleStartNewJourney(char)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-80 active:scale-95 transition-transform shrink-0"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                >
                  {char.avatar && <img src={char.avatar} alt={char.name} className="w-4 h-4 rounded-full object-cover" />}
                  <span>签发与 {char.name} 的旅程</span>
                  <Plus className="w-3 h-3" />
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* 成功踏上旅程的弹窗提示 */}
      {enterNotification && (
        <div 
          className="p-4 rounded-2xl border text-xs font-semibold font-serif animate-fade-in-up text-center shadow-md"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
        >
          {enterNotification}
        </div>
      )}

      {/* 视图分发 */}
      {activeTravel ? (
        <InTransitDashboard
          travel={activeTravel}
          character={getCharacter(activeTravel.characterId)}
          postcards={postcardsMap[activeTravel.id] || []}
          onOpenPostcard={(card) => setActivePostcard(card)}
          onCheckNewPostcard={() => triggerNewPostcard(activeTravel, getCharacter(activeTravel.characterId))}
        />
      ) : (
        <div className="space-y-6">
          {/* 无旅行卡片时的温馨诗意提示 */}
          {travels.length === 0 ? (
            <div 
              className="py-16 px-6 rounded-3xl border border-dashed text-center space-y-4"
              style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
            >
              <Compass className="w-10 h-10 mx-auto opacity-30" />
              <div className="space-y-1 font-serif">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                  还没有一起寄往远方的旅程。
                </p>
                <p className="text-xs opacity-70" style={{ color: 'var(--text-sub)' }}>
                  也许今天，可以为你们签发第一张目的地机票。
                </p>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* 1. 拟真双护照 Modal */}
      <PassportModal
        isOpen={isPassportOpen}
        onClose={() => setIsPassportOpen(false)}
        character={selectedCharacter}
        onNext={handlePassportNext}
      />

      {/* 2. 机票与行程策划 Modal */}
      <WishlistBookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        character={selectedCharacter}
        setupData={passportSetupData}
        onConfirmTrip={handleBookingConfirm}
      />

      {/* 3. 双机票出票与收票 Modal */}
      <BoardingTicketModal
        isOpen={isBoardingTicketOpen}
        character={selectedCharacter}
        destination={finalTripData?.destination}
        flightNo={finalTripData?.flightNo}
        hotelName={finalTripData?.hotelName}
        userPassportName={passportSetupData?.userPassportName}
        onFinishTuckIn={handleFinishTuckInTickets}
      />

      {/* 4. 明信片 3D 详情 Modal */}
      <PostcardDetailModal
        isOpen={Boolean(activePostcard)}
        onClose={() => setActivePostcard(null)}
        postcard={activePostcard}
        character={getCharacter(activePostcard?.characterId)}
        onReroll={handleRerollPostcard}
      />

      {/* 5. 安全销毁二次确认 Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="彻底销毁旅行记录"
        message="确定要彻底删除该趟双人旅行记录及其搜集的所有明信片与伴手礼吗？该操作不可撤销。"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};

export default TravelApp;
