import React, { useEffect, useState } from 'react';
import { Check, Ticket, Plane, X } from 'lucide-react';

export const BoardingTicketModal = ({
  isOpen,
  character,
  destination,
  flightNo,
  hotelName,
  userPassportName,
  onFinishTuckIn
}) => {
  const [stage, setStage] = useState('idle');

  useEffect(() => {
    if (!isOpen) {
      setStage('idle');
      return undefined;
    }

    const companionTimer = window.setTimeout(() => {
      setStage('companion-issued');
    }, 260);

    const userTimer = window.setTimeout(() => {
      setStage('user-issued');
    }, 920);

    const readyTimer = window.setTimeout(() => {
      setStage('ready');
    }, 1450);

    return () => {
      window.clearTimeout(companionTimer);
      window.clearTimeout(userTimer);
      window.clearTimeout(readyTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBoarding = () => {
    if (stage !== 'ready') return;

    setStage('tucking');

    window.setTimeout(() => {
      onFinishTuckIn?.();
    }, 980);
  };

  const ticketSharedStyle = {
    background: 'var(--card-bg-gradient)',
    border: '1px solid var(--card-border)',
    boxShadow: 'var(--card-shadow)',
    color: 'var(--text-main)'
  };

  const companionVisible = ['companion-issued', 'user-issued', 'ready', 'tucking'].includes(stage);
  const userVisible = ['user-issued', 'ready', 'tucking'].includes(stage);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
    >
      <style>
        {`
          @keyframes travelTicketPrint {
            0% {
              opacity: 0;
              transform: translateY(-42px) scale(0.96);
            }
            65% {
              opacity: 1;
              transform: translateY(6px) scale(1.01);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes travelTicketTuckCompanion {
            0% {
              opacity: 1;
              transform: translateY(0) rotate(0deg) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-34px, 120px) rotate(-7deg) scale(0.88);
            }
          }

          @keyframes travelTicketTuckUser {
            0% {
              opacity: 1;
              transform: translateY(0) rotate(0deg) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(34px, 120px) rotate(7deg) scale(0.88);
            }
          }

          @keyframes travelPassportFolderAppear {
            0% {
              opacity: 0;
              transform: translateY(14px) scale(0.96);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .travel-ticket-print {
            animation: travelTicketPrint 0.72s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .travel-ticket-tuck-companion {
            animation: travelTicketTuckCompanion 0.8s cubic-bezier(0.55, 0, 1, 0.45) forwards;
          }

          .travel-ticket-tuck-user {
            animation: travelTicketTuckUser 0.8s cubic-bezier(0.55, 0, 1, 0.45) forwards;
          }

          .travel-passport-folder {
            animation: travelPassportFolderAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          @media (prefers-reduced-motion: reduce) {
            .travel-ticket-print,
            .travel-ticket-tuck-companion,
            .travel-ticket-tuck-user,
            .travel-passport-folder {
              animation: none;
            }
          }
        `}
      </style>

      <section
        className="relative w-full max-w-[390px] overflow-hidden rounded-[2rem] p-5"
        style={{
          backgroundColor: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--modal-shadow)',
          color: 'var(--text-main)'
        }}
        aria-label="双人旅行机票"
      >
        <div
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{ backgroundColor: 'var(--divider)' }}
        />

        <header className="mb-5 text-center">
          <div
            className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)'
            }}
          >
            <Ticket className="h-4 w-4" strokeWidth={1.6} />
          </div>

          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: 'var(--text-muted)' }}
          >
            DUAL BOARDING PASSES
          </p>

          <h2 className="mt-2 font-serif text-xl font-semibold">
            前往 {destination || '远方'} 的两张机票
          </h2>

          <p
            className="mt-2 text-[11px] leading-relaxed"
            style={{ color: 'var(--text-sub)' }}
          >
            这是你与 {character?.name || '伴侣'} 共同启程的凭证。
          </p>
        </header>

        <div className="relative space-y-3">
          {stage === 'tucking' && (
            <div
              className="travel-passport-folder pointer-events-none absolute inset-x-10 bottom-2 z-0 rounded-2xl px-4 py-6 text-center"
              style={{
                backgroundColor: 'var(--control-soft-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-muted)'
              }}
            >
              <Plane className="mx-auto h-4 w-4" />
              <p className="mt-2 text-[10px] font-semibold tracking-wide">
                正在收好两张机票
              </p>
            </div>
          )}

          <article
            className={[
              'relative z-10 overflow-hidden rounded-2xl',
              companionVisible ? 'travel-ticket-print' : 'pointer-events-none opacity-0',
              stage === 'tucking' ? 'travel-ticket-tuck-companion' : ''
            ].join(' ')}
            style={ticketSharedStyle}
          >
            <div className="flex">
              <div className="min-w-0 flex-1 p-4">
                <div
                  className="flex items-center justify-between border-b pb-2 text-[9px] font-medium tracking-[0.14em]"
                  style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}
                >
                  <span>PASSENGER 01</span>
                  <span>SEAT 01A</span>
                </div>

                <div className="py-4">
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    COMPANION NAME
                  </p>
                  <h3 className="mt-1 truncate font-serif text-lg font-semibold">
                    {character?.name || '伴侣'}
                  </h3>

                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      DEPARTURE
                    </span>
                    <span className="h-px flex-1" style={{ backgroundColor: 'var(--divider)' }} />
                    <Plane className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span className="h-px flex-1" style={{ backgroundColor: 'var(--divider)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      ARRIVAL
                    </span>
                  </div>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-xs font-medium">WITH U</span>
                    <span className="max-w-[170px] text-right font-serif text-base font-semibold">
                      {destination || '目的地待定'}
                    </span>
                  </div>
                </div>

                <div
                  className="border-t border-dashed pt-2 text-[9px] font-mono tracking-wide"
                  style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}
                >
                  {flightNo || 'FLIGHT-W000'} · GATE A-02 · BOARDING TOGETHER
                </div>
              </div>

              <aside
                className="flex w-[74px] flex-col justify-between border-l p-3"
                style={{
                  borderColor: 'var(--divider)',
                  backgroundColor: 'var(--control-soft-bg)'
                }}
              >
                <span
                  className="text-[8px] font-medium tracking-[0.12em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  STUB
                </span>
                <div
                  className="h-14 w-full opacity-60"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, var(--text-main) 0 2px, transparent 2px 4px)'
                  }}
                />
                <span
                  className="text-[8px] font-mono"
                  style={{ color: 'var(--text-muted)' }}
                >
                  01A
                </span>
              </aside>
            </div>
          </article>

          <article
            className={[
              'relative z-10 overflow-hidden rounded-2xl',
              userVisible ? 'travel-ticket-print' : 'pointer-events-none opacity-0',
              stage === 'tucking' ? 'travel-ticket-tuck-user' : ''
            ].join(' ')}
            style={ticketSharedStyle}
          >
            <div className="flex">
              <div className="min-w-0 flex-1 p-4">
                <div
                  className="flex items-center justify-between border-b pb-2 text-[9px] font-medium tracking-[0.14em]"
                  style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}
                >
                  <span>PASSENGER 02</span>
                  <span>SEAT 01B</span>
                </div>

                <div className="py-4">
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    USER NAME
                  </p>
                  <h3 className="mt-1 truncate font-serif text-lg font-semibold">
                    {userPassportName || 'User'}
                  </h3>

                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      DEPARTURE
                    </span>
                    <span className="h-px flex-1" style={{ backgroundColor: 'var(--divider)' }} />
                    <Plane className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span className="h-px flex-1" style={{ backgroundColor: 'var(--divider)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      ARRIVAL
                    </span>
                  </div>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-xs font-medium">WITH {character?.name || 'U'}</span>
                    <span className="max-w-[170px] text-right font-serif text-base font-semibold">
                      {destination || '目的地待定'}
                    </span>
                  </div>
                </div>

                <div
                  className="border-t border-dashed pt-2 text-[9px] font-mono tracking-wide"
                  style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}
                >
                  {flightNo || 'FLIGHT-W000'} · GATE A-02 · BOARDING TOGETHER
                </div>
              </div>

              <aside
                className="flex w-[74px] flex-col justify-between border-l p-3"
                style={{
                  borderColor: 'var(--divider)',
                  backgroundColor: 'var(--control-soft-bg)'
                }}
              >
                <span
                  className="text-[8px] font-medium tracking-[0.12em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  STUB
                </span>
                <div
                  className="h-14 w-full opacity-60"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, var(--text-main) 0 2px, transparent 2px 4px)'
                  }}
                />
                <span
                  className="text-[8px] font-mono"
                  style={{ color: 'var(--text-muted)' }}
                >
                  01B
                </span>
              </aside>
            </div>
          </article>
        </div>

        <div className="mt-5">
          {stage === 'ready' && (
            <button
              type="button"
              onClick={handleBoarding}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold transition-transform active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Check className="h-4 w-4" strokeWidth={1.8} />
              收好两张机票 · 正式登机
            </button>
          )}

          {stage !== 'ready' && stage !== 'tucking' && (
            <p
              className="py-3 text-center text-[11px]"
              style={{ color: 'var(--text-muted)' }}
            >
              正在为你们依次打印双人机票
            </p>
          )}

          {stage === 'tucking' && (
            <p
              className="py-3 text-center text-[11px] font-medium"
              style={{ color: 'var(--text-main)' }}
            >
              你们即将正式踏上这段旅程。
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default BoardingTicketModal;
