import React, { useState } from 'react';
import { Mail, Gift, Camera, Users, RotateCw, X } from 'lucide-react';

export const PostcardDetailModal = ({ isOpen, onClose, postcard, character, onReroll }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!isOpen || !postcard) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
    >
      <div 
        className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col border animate-fade-in-up"
        style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--modal-border)', color: 'var(--text-main)' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" style={{ color: 'var(--text-main)' }} />
            <h2 className="text-base font-bold font-serif">{postcard.spotName} · 双人同游明信片</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-sub)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="p-6 rounded-2xl border min-h-[220px] flex flex-col justify-between cursor-pointer transition-all hover:shadow-md relative"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold opacity-70" style={{ color: 'var(--text-muted)' }}>
                  POSTCARD FROM {postcard.spotName}
                </span>
                <span className="text-[10px] opacity-60" style={{ color: 'var(--text-muted)' }}>
                  点击翻面 ({isFlipped ? '同游感语' : '插曲与画面'})
                </span>
              </div>
              
              {!isFlipped ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-serif tracking-wide" style={{ color: 'var(--text-main)' }}>
                  "{postcard.letterContent}"
                </p>
              ) : (
                <div className="space-y-3 text-xs leading-relaxed" style={{ color: 'var(--text-sub)' }}>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-main)' }} />
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--text-main)' }}>共同遇到的路人与插曲：</span>
                      <span>{postcard.metPerson || '在小巷偶遇了一位手艺人。'}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Camera className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-main)' }} />
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--text-main)' }}>画面视觉风格：</span>
                      <span>{postcard.photoStyle || '拍立得色调的浪漫风景'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div 
              className="pt-3 border-t flex items-center justify-between text-xs opacity-75"
              style={{ borderColor: 'var(--divider)', color: 'var(--text-muted)' }}
            >
              <span>Together with: {character?.name || '伴侣'}</span>
              <span>{new Date(postcard.timestamp).toLocaleDateString()}</span>
            </div>
          </div>

          {postcard.giftItem && (
            <div 
              className="p-4 rounded-2xl border flex items-center gap-3.5"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div 
                className="p-2.5 rounded-xl border shrink-0"
                style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
              >
                <Gift className="w-5 h-5" style={{ color: 'var(--text-main)' }} />
              </div>
              <div>
                <div className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>同游搜集到的伴手礼</div>
                <div className="text-xs opacity-80 pt-0.5" style={{ color: 'var(--text-sub)' }}>{postcard.giftItem}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--divider)' }}>
          <button
            onClick={() => onReroll(postcard.id)}
            className="px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80 flex items-center gap-1.5 active:scale-95 transition-transform"
            style={{ color: 'var(--text-sub)', backgroundColor: 'var(--control-soft-bg)' }}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Re-roll 重新生成同游寄语</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            收入手帐
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostcardDetailModal;
