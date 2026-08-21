import React from 'react';
import { Mail, Plane, Trash2 } from 'lucide-react';

const buildDate = (timestamp) => {
  if (!timestamp) return 'UNDATED';

  return new Intl.DateTimeFormat('en-GB', {
    year: '2-digit',
    month: 'short',
    day: '2-digit'
  })
    .format(new Date(timestamp))
    .replace(/ /g, '.')
    .toUpperCase();
};

export const TravelStampCard = ({
  travel,
  character,
  postcardCount = 0,
  onClick,
  onDelete
}) => {
  const destination = travel.destination || '未命名旅途';
  const userName = travel.userPassportName || 'User';
  const isInTransit = travel.status === 'in_transit';
  const isCompleted = travel.status === 'completed';
  const stampDate = buildDate(travel.createdAt);
  const destinationCode = destination.slice(0, 3).toUpperCase();

  const handleDelete = (event) => {
    event.stopPropagation();
    onDelete?.(travel.id);
  };

  return (
    <article className="group relative min-w-0">
      {/* 收藏册固定邮票的透明插角 */}
      <span
        className="absolute left-1 top-1 z-10 h-7 w-7 border-l border-t"
        style={{ borderColor: 'var(--card-border)' }}
      />
      <span
        className="absolute right-1 top-1 z-10 h-7 w-7 border-r border-t"
        style={{ borderColor: 'var(--card-border)' }}
      />
      <span
        className="absolute bottom-1 left-1 z-10 h-7 w-7 border-b border-l"
        style={{ borderColor: 'var(--card-border)' }}
      />
      <span
        className="absolute bottom-1 right-1 z-10 h-7 w-7 border-b border-r"
        style={{ borderColor: 'var(--card-border)' }}
      />

      <button
        type="button"
        onClick={onClick}
        className="relative block w-full p-2 text-left transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:rotate-[-1deg] group-hover:drop-shadow-xl focus:outline-none"
        aria-label={`打开你与 ${character?.name || '伴侣'} 前往 ${destination} 的旅程`}
      >
        {/* 邮票纸张。外部露出的底色成为真实齿孔的镂空区域。 */}
        <div
          className="relative aspect-[3/4] overflow-hidden"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          {/* 左右齿孔 */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 flex w-2 flex-col justify-around"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={`left-notch-${index}`}
                className="-ml-1 block h-3 w-3 rounded-full"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 flex w-2 flex-col justify-around"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={`right-notch-${index}`}
                className="-mr-1 block h-3 w-3 rounded-full"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              />
            ))}
          </div>

          {/* 上下齿孔 */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex h-2 justify-around"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={`top-notch-${index}`}
                className="-mt-1 block h-3 w-3 rounded-full"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex h-2 justify-around"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={`bottom-notch-${index}`}
                className="-mb-1 block h-3 w-3 rounded-full"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              />
            ))}
          </div>

          {/* 邮票内侧细线 */}
          <div
            className="pointer-events-none absolute inset-3 z-10 border"
            style={{ borderColor: 'var(--card-border)' }}
          />

          {/* 邮票主画面 */}
          <div
            className="relative mx-4 mt-4 flex h-[57%] flex-col justify-between overflow-hidden p-3"
            style={{ background: 'var(--card-bg-gradient)' }}
          >
            <div
              className="absolute -right-7 -top-8 h-24 w-24 rounded-full opacity-40 blur-2xl"
              style={{ backgroundColor: 'var(--bg-blob-1)' }}
            />
            <div
              className="absolute -bottom-9 -left-7 h-28 w-28 rounded-full opacity-50 blur-2xl"
              style={{ backgroundColor: 'var(--bg-blob-2)' }}
            />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <span
                className="text-[8px] font-mono tracking-[0.18em]"
                style={{ color: 'var(--text-muted)' }}
              >
                WHEN I WITH U
              </span>
              <span
                className="border px-1.5 py-0.5 text-[8px] font-mono"
                style={{
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-sub)'
                }}
              >
                {isInTransit ? 'AIR MAIL' : 'ARCHIVE'}
              </span>
            </div>

            <div className="relative z-10">
              <p
                className="line-clamp-2 font-serif text-xl font-bold leading-tight"
                style={{ color: 'var(--text-main)' }}
              >
                {destination}
              </p>
              <p
                className="mt-1 text-[9px] tracking-[0.12em]"
                style={{ color: 'var(--text-sub)' }}
              >
                A PLACE FOR TWO
              </p>
            </div>

            <div className="relative z-10 flex items-end justify-between">
              <div className="flex -space-x-2">
                <div
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 text-[10px] font-bold"
                  style={{
                    backgroundColor: 'var(--control-soft-bg)',
                    borderColor: 'var(--card-bg)',
                    color: 'var(--text-main)'
                  }}
                >
                  {userName.slice(0, 1)}
                </div>

                {character?.avatar ? (
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="h-8 w-8 rounded-full border-2 object-cover"
                    style={{ borderColor: 'var(--card-bg)' }}
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      borderColor: 'var(--card-bg)',
                      color: 'var(--accent-foreground)'
                    }}
                  >
                    {character?.name?.slice(0, 1) || 'C'}
                  </div>
                )}
              </div>

              <div
                className="flex h-10 w-10 rotate-[-10deg] flex-col items-center justify-center rounded-full border border-dashed"
                style={{
                  borderColor: 'var(--text-muted)',
                  color: 'var(--text-muted)'
                }}
              >
                <span className="text-[8px] font-bold">{destinationCode}</span>
                <span className="text-[7px]">{stampDate.slice(-5)}</span>
              </div>
            </div>
          </div>

          {/* 邮票铭牌 */}
          <div className="relative z-10 px-5 pb-4 pt-3">
            <p
              className="truncate text-xs font-bold"
              style={{ color: 'var(--text-main)' }}
            >
              {character?.name || '伴侣'} × {userName}
            </p>

            <div
              className="mt-1 flex items-center justify-between gap-2 text-[9px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="truncate">{stampDate}</span>
              <span className="shrink-0">
                {isCompleted ? '已归档' : `${travel.durationHours || 12}H`}
              </span>
            </div>

            <div
              className="mt-3 flex items-center justify-between border-t pt-2 text-[9px]"
              style={{ borderColor: 'var(--divider)', color: 'var(--text-sub)' }}
            >
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {postcardCount}
              </span>
              {isInTransit && (
                <span className="flex items-center gap-1">
                  <Plane className="h-3 w-3 animate-pulse" />
                  同游中
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="absolute right-3 top-3 z-30 rounded-full p-1.5 opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
        style={{
          backgroundColor: 'var(--modal-bg)',
          color: 'var(--text-muted)',
          border: '1px solid var(--card-border)'
        }}
        title="彻底删除这趟旅程"
        aria-label="彻底删除这趟旅程"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </article>
  );
};

export default TravelStampCard;
