import React, { useState } from 'react';
import { Mail, Plane, RefreshCw, MapPin, Clock, Gift, ArrowUpRight } from 'lucide-react';

const formatDate = (timestamp) => {
  if (!timestamp) return '尚未签发';

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(timestamp));
};

export const InTransitDashboard = ({
  travel,
  character,
  postcards = [],
  onOpenPostcard,
  onCheckNewPostcard
}) => {
  const [isChecking, setIsChecking] = useState(false);

  const companionName = character?.name || '同行伴侣';
  const userName = travel?.userPassportName || '你';



  const handleCheckClick = async () => {
    setIsChecking(true);

    try {
      await onCheckNewPostcard?.();
    } finally {
      setIsChecking(false);
    }
  };

 const unreadPostcardCount = postcards.filter(
  (postcard) => !postcard.isRead
).length;


  return (
    <div className="animate-fade-in-up space-y-8">
      {/* 展开的航空信笺 */}
      <section
        className="relative overflow-hidden border px-5 py-6 shadow-sm"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-2"
          style={{
            background:
              'repeating-linear-gradient(90deg, var(--accent-color) 0 16px, var(--card-bg) 16px 28px, var(--text-muted) 28px 44px, var(--card-bg) 44px 56px)'
          }}
        />

        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-mono tracking-[0.18em]"
              style={{ color: 'var(--text-muted)' }}
            >
              OPEN TRAVEL LETTER
            </p>
            <h2
              className="mt-2 font-serif text-2xl font-bold leading-tight"
              style={{ color: 'var(--text-main)' }}
            >
              写给正在
              <br />
              {travel.destination || '远方'} 一起漫游的你们
            </h2>
          </div>

          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed"
            style={{
              borderColor: 'var(--text-muted)',
              color: 'var(--text-muted)'
            }}
          >
            <Plane className="h-5 w-5 -rotate-45" />
          </div>
        </div>

        <div
          className="my-6 border-y py-4"
          style={{ borderColor: 'var(--divider)' }}
        >
          <p
            className="font-serif text-sm leading-7"
            style={{ color: 'var(--text-sub)' }}
          >
            {companionName} 与 {userName} 的行李已经安放妥当。这趟旅程不急着抵达；
            沿路的光线、偶然绕进的小巷，以及彼此停下来等待对方的片刻，都会被好好收进这封信里。
          </p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{travel.destination || '未命名目的地'}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDate(travel.startTime || travel.createdAt)} 签发 · {travel.durationHours || 12} 小时</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleCheckClick}
            disabled={isChecking}
            className="shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition-transform active:scale-95 disabled:opacity-60"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-foreground)'
            }}
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              查看邮件
            </span>
          </button>
        </div>
      </section>

      {/* 夹在旅行信笺中的明信片 */}
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-mono tracking-[0.16em]"
              style={{ color: 'var(--text-muted)' }}
            >
              FOUND ALONG THE WAY
            </p>
            <h3
              className="mt-1 font-serif text-lg font-bold"
              style={{ color: 'var(--text-main)' }}
            >
              夹在信里的旅行片段
            </h3>
          </div>
          <div
  className="text-right text-xs"
  style={{ color: 'var(--text-muted)' }}
>
  <p>{postcards.length} 枚</p>
  {unreadPostcardCount > 0 && (
    <p className="mt-0.5 text-[10px]">
      {unreadPostcardCount} 封新抵达
    </p>
  )}
</div>

        </div>

        {postcards.length === 0 ? (
          <div
            className="mt-4 border border-dashed px-6 py-14 text-center"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)'
            }}
          >
            <Mail
              className="mx-auto h-8 w-8"
              style={{ color: 'var(--text-muted)' }}
            />
            <p className="mt-3 font-serif text-sm font-semibold">邮袋暂时还是空的</p>
            <p
              className="mx-auto mt-1 max-w-xs text-xs leading-relaxed"
              style={{ color: 'var(--text-sub)' }}
            >
              你们在路上遇见的风景、人物与小小的收获，会慢慢被寄回这里。
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {postcards.map((card, index) => {
              const rotateClass = index % 3 === 0
                ? 'rotate-[-1deg]'
                : index % 3 === 1
                  ? 'rotate-[1deg]'
                  : 'rotate-0';

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onOpenPostcard(card)}
                  className={`block w-full border p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${rotateClass}`}
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)'
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                     <div className="flex items-start justify-between gap-2">
  <p
    className="font-serif text-base font-bold"
    style={{ color: 'var(--text-main)' }}
  >
    {card.spotName || '旅途片段'}
  </p>

  {!card.isRead && (
    <span
      className="shrink-0 border px-1.5 py-0.5 text-[9px]"
      style={{
        borderColor: 'var(--card-border)',
        color: 'var(--text-muted)'
      }}
    >
      新抵达
    </span>
  )}
</div>

                      <p
                        className="mt-2 line-clamp-3 text-xs leading-6"
                        style={{ color: 'var(--text-sub)' }}
                      >
                        {card.letterContent}
                      </p>
                    </div>

                    <ArrowUpRight
                      className="mt-1 h-4 w-4 shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </div>

                  <div
                    className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-[10px]"
                    style={{
                      borderColor: 'var(--divider)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <span>
                      {new Date(card.timestamp).toLocaleDateString('zh-CN')}
                    </span>

                    {card.giftItem && (
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <Gift className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{card.giftItem}</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default InTransitDashboard;
