import React, { useState } from 'react';
import {
  Plane,
  Sparkles,
  MapPin,
  Ticket,
  Building2,
  X,
  RotateCw,
  CheckCircle2
} from 'lucide-react';

import {
  generateCompanionWishlist,
  generateCompanionSurpriseBooking
} from '../travelAiService';


export const WishlistBookingModal = ({
  isOpen,
  onClose,
  character,
  setupData,
  onConfirmTrip
}) => {
  const [mode, setMode] = useState('match');
  const [destination, setDestination] = useState('');
  const [companionWishlist, setCompanionWishlist] = useState([]);
  const [isLoadingWishlist, setIsLoadingWishlist] = useState(false);
  const [hotelStyle, setHotelStyle] = useState('靠近街角与晨光的安静栖宿');

  if (!isOpen) return null;

  const handleFetchCompanionWishlist = async () => {
    setIsLoadingWishlist(true);

    try {
      const wishlist = await generateCompanionWishlist(character);
      setCompanionWishlist(Array.isArray(wishlist) ? wishlist : []);
    } catch (err) {
      console.error('生成伴侣心愿失败:', err);
      setCompanionWishlist([]);
    } finally {
      setIsLoadingWishlist(false);
    }
  };

  const handleCompanionSurprise = async () => {
    setIsLoadingWishlist(true);

    try {
      const surprise = await generateCompanionSurpriseBooking(character);

if (!surprise) {
  return;
}

onConfirmTrip({
  destination: surprise.destination,
  hotelName: surprise.hotelName,
  flightNo: surprise.flightNo,
  ...setupData
});

    } catch (err) {
      console.error('生成伴侣惊喜行程失败:', err);
    } finally {
      setIsLoadingWishlist(false);
    }
  };

  const handleStartJourney = () => {
    if (!destination.trim()) return;

    const flightNo = `FLIGHT-W${Math.floor(100 + Math.random() * 900)}`;

    onConfirmTrip({
      destination: destination.trim(),
      hotelName: hotelStyle.trim() || '安静栖宿',
      flightNo,
      ...setupData
    });
  };

  const tabBaseStyle = {
    border: '1px solid var(--card-border)'
  };

  const activeTabStyle = {
    backgroundColor: 'var(--accent-color)',
    color: 'var(--accent-foreground)',
    border: '1px solid var(--accent-color)'
  };

  const inactiveTabStyle = {
    backgroundColor: 'transparent',
    color: 'var(--text-sub)',
    border: '1px solid transparent'
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
    >
      <section
        className="w-full max-w-[390px] overflow-hidden rounded-[2rem] shadow-2xl"
        style={{
          backgroundColor: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
          color: 'var(--text-main)'
        }}
        aria-label="机票签发与行程策划"
      >
        <header
          className="flex items-start justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--divider)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-main)'
              }}
            >
              <Ticket className="h-4 w-4" strokeWidth={1.6} />
            </div>

            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--text-muted)' }}
              >
                ROUTE PLANNING
              </p>
              <h2 className="mt-1 font-serif text-lg font-semibold">
                机票签发与行程策划
              </h2>
              <p
                className="mt-1 text-[11px] leading-relaxed"
                style={{ color: 'var(--text-sub)' }}
              >
                这是一趟你与 {character?.name || '伴侣'} 共同启程的双人旅行。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            aria-label="关闭"
          >
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          <div
            className="grid grid-cols-2 gap-2 rounded-2xl p-1"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              border: '1px solid var(--card-border)'
            }}
          >
            <button
              type="button"
              onClick={() => setMode('match')}
              className="rounded-xl px-3 py-2 text-[11px] font-semibold transition-all active:scale-[0.98]"
              style={mode === 'match' ? activeTabStyle : inactiveTabStyle}
            >
              共同挑选
            </button>

            <button
              type="button"
              onClick={() => setMode('companion_choice')}
              className="rounded-xl px-3 py-2 text-[11px] font-semibold transition-all active:scale-[0.98]"
              style={mode === 'companion_choice' ? activeTabStyle : inactiveTabStyle}
            >
              交给伴侣决定
            </button>
          </div>

          {mode === 'match' ? (
            <div className="space-y-5">
              <section
                className="rounded-3xl p-4"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  boxShadow: 'var(--card-shadow)'
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" strokeWidth={1.6} />
                    <span
                      className="text-xs font-semibold"
                      style={{ color: 'var(--text-main)' }}
                    >
                      伴侣的目的地心愿
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleFetchCompanionWishlist}
                    disabled={isLoadingWishlist}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--control-soft-bg)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--card-border)'
                    }}
                  >
                    <RotateCw
                      className={`h-3 w-3 ${isLoadingWishlist ? 'animate-spin' : ''}`}
                      strokeWidth={1.7}
                    />
                    <span>
                      {companionWishlist.length > 0 ? '再听一组' : '询问心愿'}
                    </span>
                  </button>
                </div>

                {companionWishlist.length === 0 ? (
                  <p
                    className="text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-sub)' }}
                  >
                    你可以先听听伴侣想和你一起去哪里，也可以直接写下你心里的目的地。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {companionWishlist.map((item, index) => {
                      const isSelected = destination === item.destination;

                      return (
                        <button
                          key={`${item.destination}-${index}`}
                          type="button"
                          onClick={() => setDestination(item.destination)}
                          className="w-full rounded-2xl p-3 text-left transition-transform active:scale-[0.99]"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--accent-color)'
                              : 'var(--control-soft-bg)',
                            color: isSelected
                              ? 'var(--accent-foreground)'
                              : 'var(--text-main)',
                            border: `1px solid ${
                              isSelected ? 'var(--accent-color)' : 'var(--card-border)'
                            }`
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold">
                              {item.destination}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            )}
                          </div>

                          <p
                            className="mt-1 text-[11px] leading-relaxed"
                            style={{
                              color: isSelected
                                ? 'var(--accent-foreground)'
                                : 'var(--text-sub)',
                              opacity: isSelected ? 0.86 : 1
                            }}
                          >
                            {item.reason}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div>
                  <label
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.7} />
                    <span>最终双人目的地</span>
                  </label>

                  <input
                    type="text"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="例如：京都岚山、海边旧书店、山谷温泉小镇"
                    className="w-full rounded-2xl border px-3 py-3 text-sm outline-none transition-opacity focus:opacity-90"
                    style={{
                      backgroundColor: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)'
                    }}
                  />
                </div>

                <div>
                  <label
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <Building2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                    <span>双人住宿与停留风格</span>
                  </label>

                  <input
                    type="text"
                    value={hotelStyle}
                    onChange={(event) => setHotelStyle(event.target.value)}
                    placeholder="例如：靠海木屋、旧城区旅馆、温泉客栈"
                    className="w-full rounded-2xl border px-3 py-3 text-sm outline-none transition-opacity focus:opacity-90"
                    style={{
                      backgroundColor: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)'
                    }}
                  />
                </div>
              </section>
            </div>
          ) : (
            <section
              className="rounded-3xl p-5 text-center"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                boxShadow: 'var(--card-shadow)'
              }}
            >
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: 'var(--control-soft-bg)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-main)'
                }}
              >
                <Plane className="h-5 w-5" strokeWidth={1.6} />
              </div>

              <h3 className="mt-4 font-serif text-base font-semibold">
                让 {character?.name || '伴侣'} 安排这趟旅行
              </h3>

              <p
                className="mt-2 text-[11px] leading-relaxed"
                style={{ color: 'var(--text-sub)' }}
              >
                伴侣会根据自己的完整角色设定，为你们共同决定目的地、停留方式与这趟旅程的第一张机票。
              </p>

              <button
                type="button"
                onClick={handleCompanionSurprise}
                disabled={isLoadingWishlist}
                className="mt-5 w-full rounded-2xl px-4 py-3 text-xs font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-foreground)'
                }}
              >
                {isLoadingWishlist ? '正在安排行程' : '生成伴侣安排的双人旅程'}
              </button>
            </section>
          )}
        </div>

        {mode === 'match' && (
          <footer
            className="flex items-center gap-2 border-t px-5 py-4"
            style={{ borderColor: 'var(--divider)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl px-4 py-3 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
                border: '1px solid var(--card-border)'
              }}
            >
              暂时不出票
            </button>

            <button
              type="button"
              onClick={handleStartJourney}
              disabled={!destination.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Ticket className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span>确认出票</span>
            </button>
          </footer>
        )}
      </section>
    </div>
  );
};

export default WishlistBookingModal;
