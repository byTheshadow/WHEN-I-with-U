import React, { useState } from 'react';
import { Ticket, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export const BoardingTicketModal = ({ isOpen, character, destination, flightNo, hotelName, userPassportName, onFinishTuckIn }) => {
  const [ticketState, setTicketState] = useState('issuing'); // 'issuing' -> 'ready' -> 'tucking'

  if (!isOpen) return null;

  const handleTuckInTickets = () => {
    setTicketState('tucking');
    setTimeout(() => {
      onFinishTuckIn();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60">
      <div 
        className="w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col items-center space-y-6 text-center"
        style={{ backgroundColor: 'var(--modal-bg)', border: '1px solid var(--modal-border)', color: 'var(--text-main)' }}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold tracking-widest uppercase opacity-70" style={{ color: 'var(--text-muted)' }}>
            <Ticket className="w-4 h-4" />
            <span>DUAL BOARDING PASS ISSUANCE</span>
          </div>
          <h2 className="text-xl font-serif font-bold">前往 {destination} 的双人机票已出票</h2>
        </div>

        {/* 拟真双机票展示区域 (带有出票与收票动画) */}
        <div className="w-full space-y-4 overflow-hidden py-2">
          {/* 机票 1：伴侣机票 */}
          <div 
            className={`p-5 rounded-2xl border text-left shadow-md transform transition-all duration-700 ${
              ticketState === 'tucking' ? '-translate-y-40 opacity-0 scale-95' : 'translate-y-0 opacity-100'
            }`}
            style={{ background: 'var(--card-bg-gradient)', borderColor: 'var(--card-border)' }}
          >
            <div className="flex items-center justify-between border-b pb-2 text-[10px] font-mono" style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}>
              <span>PASSENGER 01: COMPANION</span>
              <span>SEAT: 01A (WINDOW)</span>
            </div>
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>乘客姓名</div>
                <div className="text-base font-serif font-bold">{character?.name || '伴侣'}</div>
              </div>
              <ArrowRight className="w-5 h-5 opacity-40" />
              <div className="text-right">
                <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>航班号</div>
                <div className="text-sm font-mono font-bold">{flightNo || 'FLIGHT-W88'}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-dashed flex justify-between text-[11px] font-mono opacity-80" style={{ borderColor: 'var(--divider)' }}>
              <span>DEST: {destination}</span>
              <span>STAY: {hotelName}</span>
            </div>
          </div>

          {/* 机票 2：User 机票 */}
          <div 
            className={`p-5 rounded-2xl border text-left shadow-md transform transition-all duration-700 delay-150 ${
              ticketState === 'tucking' ? 'translate-y-40 opacity-0 scale-95' : 'translate-y-0 opacity-100'
            }`}
            style={{ background: 'var(--card-bg-gradient)', borderColor: 'var(--card-border)' }}
          >
            <div className="flex items-center justify-between border-b pb-2 text-[10px] font-mono" style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}>
              <span>PASSENGER 02: USER</span>
              <span>SEAT: 01B (TOGETHER)</span>
            </div>
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>乘客姓名</div>
                <div className="text-base font-serif font-bold">{userPassportName || 'User'}</div>
              </div>
              <ArrowRight className="w-5 h-5 opacity-40" />
              <div className="text-right">
                <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>登机口</div>
                <div className="text-sm font-mono font-bold">GATE A-02</div>
              </div>
            </div>
            <div className="pt-2 border-t border-dashed flex justify-between text-[11px] font-mono opacity-80" style={{ borderColor: 'var(--divider)' }}>
              <span>DEST: {destination}</span>
              <span>BARCODE: ||||||||||||||</span>
            </div>
          </div>
        </div>

        {/* 确认按钮 */}
        <button
          onClick={handleTuckInTickets}
          disabled={ticketState === 'tucking'}
          className="w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>收好两张机票 · 正式登机启程</span>
        </button>
      </div>
    </div>
  );
};

export default BoardingTicketModal;
