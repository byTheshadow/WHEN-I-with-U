import React, { useState } from 'react';
import { Plane, Sparkles, MapPin, Ticket, Building2, Check, X, RotateCw } from 'lucide-react';
import { generateCompanionWishlist, generateCompanionSurpriseBooking } from '../../../services/aiService';

export const WishlistBookingModal = ({ isOpen, onClose, character, setupData, onConfirmTrip }) => {
  const [mode, setMode] = useState('match'); // 'match' | 'companion_choice'
  const [destination, setDestination] = useState('');
  const [companionWishlist, setCompanionWishlist] = useState([]);
  const [isLoadingWishlist, setIsLoadingWishlist] = useState(false);
  const [hotelStyle, setHotelStyle] = useState('法式复古老洋房民宿');

  if (!isOpen) return null;

  // 生成伴侣建议心愿
  const handleFetchCompanionWishlist = async () => {
    setIsLoadingWishlist(true);
    try {
      const wishs = await generateCompanionWishlist(character);
      setCompanionWishlist(wishs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingWishlist(false);
    }
  };

  // 全权交给伴侣惊喜决定
  const handleCompanionSurprise = async () => {
    setIsLoadingWishlist(true);
    try {
      const surprise = await generateCompanionSurpriseBooking(character);
      onConfirmTrip({
        destination: surprise.destination,
        hotelName: surprise.hotelName,
        flightNo: surprise.flightNo,
        ...setupData
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingWishlist(false);
    }
  };

  const handleStartJourney = () => {
    if (!destination.trim()) return;
    const flightNo = `FLIGHT-W${Math.floor(100 + Math.random() * 900)}`;
    onConfirmTrip({
      destination: destination.trim(),
      hotelName: hotelStyle,
      flightNo,
      ...setupData
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div 
        className="w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold">机票签发与行程策划</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-500/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 模式选择：双向心愿 vs 伴侣全权决定 */}
          <div className="flex gap-2 p-1 rounded-xl" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
            <button
              onClick={() => setMode('match')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'match' ? 'bg-amber-500 text-white shadow-sm' : ''
              }`}
              style={{ color: mode === 'match' ? '#fff' : 'var(--text-muted)' }}
            >
              共同挑选目的地
            </button>
            <button
              onClick={() => setMode('companion_choice')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'companion_choice' ? 'bg-amber-500 text-white shadow-sm' : ''
              }`}
              style={{ color: mode === 'companion_choice' ? '#fff' : 'var(--text-muted)' }}
            >
              全权交给伴侣惊喜决定
            </button>
          </div>

          {mode === 'match' ? (
            <div className="space-y-4">
              {/* 伴侣提议生成按钮 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>询问伴侣想去的心愿目的地</span>
                  </span>
                  <button
                    onClick={handleFetchCompanionWishlist}
                    disabled={isLoadingWishlist}
                    className="text-xs text-amber-500 hover:underline flex items-center gap-1"
                  >
                    <RotateCw className={`w-3 h-3 ${isLoadingWishlist ? 'animate-spin' : ''}`} />
                    <span>{companionWishlist.length > 0 ? '重新换一批' : '获取伴侣心愿'}</span>
                  </button>
                </div>

                {companionWishlist.length > 0 && (
                  <div className="space-y-2">
                    {companionWishlist.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setDestination(item.destination)}
                        className="p-3 rounded-xl border cursor-pointer hover:border-amber-500 transition-all text-xs"
                        style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: destination === item.destination ? 'var(--primary-color, #e0a96d)' : 'var(--card-border)' }}
                      >
                        <div className="font-bold mb-0.5">{item.destination}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{item.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 手动填写或选定的目的地 */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>敲定最终目的地</span>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="例如：京都·岚山 / 圣托里尼海岸..."
                  className="w-full p-3 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>

              {/* 住宿偏好 */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>住宿酒店类型</span>
                </label>
                <input
                  type="text"
                  value={hotelStyle}
                  onChange={(e) => setHotelStyle(e.target.value)}
                  placeholder="例如：海边独栋木屋、古城温泉客栈..."
                  className="w-full p-3 rounded-xl text-sm border focus:outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
                />
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl text-center space-y-4 border" style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}>
              <Plane className="w-10 h-10 mx-auto text-amber-500 animate-bounce" />
              <div>
                <h4 className="font-bold text-base mb-1">把选择权全权交给 {character?.name}</h4>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  伴侣将基于自身世界书与浪漫灵感，为你神秘预订机票与惊喜住宿！
                </p>
              </div>
              <button
                onClick={handleCompanionSurprise}
                disabled={isLoadingWishlist}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-md"
              >
                {isLoadingWishlist ? '正在神秘订票中...' : '生成伴侣的神秘安排'}
              </button>
            </div>
          )}
        </div>

        {mode === 'match' && (
          <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-medium hover:bg-neutral-500/10"
              style={{ color: 'var(--text-muted)' }}
            >
              取消
            </button>
            <button
              onClick={handleStartJourney}
              disabled={!destination.trim()}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5 shadow-md"
            >
              <Ticket className="w-4 h-4" />
              <span>撕票登机 · 开启托管旅程</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistBookingModal;
