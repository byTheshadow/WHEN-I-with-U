import React, { useState, useEffect } from 'react';
import { Plus, Compass, ArrowLeft, BookOpen } from 'lucide-react';
import { db } from '../../db';
import { TravelStampCard } from './components/TravelStampCard';
import { CharacterSelectModal } from './components/CharacterSelectModal';
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
  const [isCharacterSelectOpen, setIsCharacterSelectOpen] = useState(false);
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
    setIsCharacterSelectOpen(false);
    setIsPassportOpen(true);
  };

  // 2. 护照填写完成 -> 进入订票 Modal
  const handlePassportNext = (data) => {
    setPassportSetupData(data);
    setIsPassportOpen(false);
    setIsBookingOpen(true);
  };

  // 3. 订票完成 -> 弹出双机票 Modal
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
      endTime:
        Date.now() + passportSetupData.durationHours * 3600 * 1000,
      createdAt: Date.now()
    };

    delete payload.id;

    const newId = await db.travels.add(payload);
    const createdTravel = await db.travels.get(newId);

    // 自动生成第一张动态双人明信片
    await triggerNewPostcard(createdTravel, selectedCharacter);

    await loadData();
    setActiveTravel(createdTravel);

    setEnterNotification(
      `你与 ${selectedCharacter.name} 已正式踏上前往 [${finalTripData.destination}] 的双人漫游之旅！`
    );

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

    const char = characters.find((c) => c.id === pc.characterId);
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
    await db.travelPostcards
      .where('travelId')
      .equals(deleteTargetId)
      .delete();

    setDeleteTargetId(null);

    if (activeTravel?.id === deleteTargetId) {
      setActiveTravel(null);
    }

    await loadData();
  };

  const getCharacter = (id) => characters.find((c) => c.id === id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      {/* 顶栏导航 */}
      <div
        className="flex items-center justify-between gap-3 border-b pb-4"
        style={{ borderColor: 'var(--divider)' }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {onBackHub && (
            <button
              type="button"
              onClick={onBackHub}
              className="rounded-full p-2 transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-main)' }}
              title="返回主界面"
              aria-label="返回主界面"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <BookOpen
                className="h-4 w-4"
                style={{ color: 'var(--text-main)' }}
              />

              <span
                className="truncate font-serif text-base font-bold"
                style={{ color: 'var(--text-main)' }}
              >
                你们的集邮册
              </span>
            </div>

            <p
              className="mt-0.5 text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              每一枚邮票，都是一起抵达过的远方。
            </p>
          </div>
        </div>

        {activeTravel ? (
          <button
            type="button"
            onClick={() => setActiveTravel(null)}
            className="shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            返回集邮册
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsCharacterSelectOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            签发旅程
          </button>
        )}
      </div>

      {/* 成功踏上旅程的弹窗提示 */}
      {enterNotification && (
        <div
          className="animate-fade-in-up rounded-2xl border p-4 text-center font-serif text-xs font-semibold shadow-md"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
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
          onCheckNewPostcard={() =>
            triggerNewPostcard(
              activeTravel,
              getCharacter(activeTravel.characterId)
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {/* 无旅行卡片时的温馨提示 */}
          {travels.length === 0 ? (
            <div
              className="space-y-4 rounded-3xl border border-dashed px-6 py-20 text-center shadow-sm"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                borderColor: 'var(--card-border)'
              }}
            >
              <Compass
                className="mx-auto h-12 w-12 opacity-30"
                style={{ color: 'var(--text-muted)' }}
              />

              <div className="space-y-2 font-serif">
                <p
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-main)' }}
                >
                  还没有一起寄往远方的旅程
                </p>

                <p
                  className="mx-auto max-w-sm text-xs leading-relaxed opacity-70"
                  style={{ color: 'var(--text-sub)' }}
                >
                  挑选一位陪伴你的伴侣，为你们签发第一份旅行护照与双人机票，开启一段只有彼此的动态漫游。
                </p>
              </div>
            </div>
          ) : (
            <div
              className="relative overflow-hidden border px-3 py-6 sm:px-5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--card-border)'
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'linear-gradient(var(--divider) 1px, transparent 1px), linear-gradient(90deg, var(--divider) 1px, transparent 1px)',
                  backgroundSize: '18px 18px'
                }}
              />

              <div className="relative mb-5 text-center">
                <Compass
                  className="mx-auto h-4 w-4"
                  style={{ color: 'var(--text-muted)' }}
                />

                <p
                  className="mt-1 font-serif text-sm font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  远方收藏页
                </p>

                <p
                  className="mt-0.5 text-[10px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  轻触一枚邮票，抽出你们那趟旅程。
                </p>
              </div>

              <div className="relative grid grid-cols-2 gap-x-2 gap-y-5">
                {travels.map((travel) => (
                  <TravelStampCard
                    key={travel.id}
                    travel={travel}
                    character={getCharacter(travel.characterId)}
                    postcardCount={
                      (postcardsMap[travel.id] || []).length
                    }
                    onClick={() => setActiveTravel(travel)}
                    onDelete={(id) => setDeleteTargetId(id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 伴侣选择 Modal */}
      <CharacterSelectModal
        isOpen={isCharacterSelectOpen}
        onClose={() => setIsCharacterSelectOpen(false)}
        characters={characters}
        onSelect={handleStartNewJourney}
      />

      {/* 1. 拟真双护照 Modal */}
      <PassportModal
        key={selectedCharacter?.id || 'no-character'}
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

      {/* 4. 明信片 Modal */}
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
