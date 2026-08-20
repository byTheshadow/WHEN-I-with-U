import React, { useState } from 'react';
import { Mail, Gift, Camera, Palette, Users, RotateCw, X } from 'lucide-react';

export const PostcardDetailModal = ({ isOpen, onClose, postcard, character, onReroll }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!isOpen || !postcard) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div 
        className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold">{postcard.spotName} · 旅途明信片</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-500/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 明信片正面/背面体验 */}
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="p-6 rounded-2xl border min-h-[220px] flex flex-col justify-between cursor-pointer transition-all hover:shadow-lg relative"
            style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono tracking-widest uppercase text-amber-500 font-bold">
                  POSTCARD FROM {postcard.spotName}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  点击切换视角 ({isFlipped ? '伴侣寄语' : '插曲与画面'})
                </span>
              </div>
              
              {!isFlipped ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-serif" style={{ color: 'var(--text-main)' }}>
                  "{postcard.letterContent}"
                </p>
              ) : (
                <div className="space-y-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">景点偶遇与插曲：</span>
                      <span>{postcard.metPerson || '在小巷偶遇了一位手艺人。'}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Camera className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">照片艺术质感：</span>
                      <span>{postcard.photoStyle || '拍立得色调的浪漫风景'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
              <span>From: {character?.name || '伴侣'}</span>
              <span>{new Date(postcard.timestamp).toLocaleDateString()}</span>
            </div>
          </div>

          {/* 伴手礼对象小插曲 */}
          {postcard.giftItem && (
            <div className="p-4 rounded-xl border flex items-center gap-3" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400">结合景点与人设搜集到的伴手礼</div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{postcard.giftItem}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <button
            onClick={() => onReroll(postcard.id)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-500 hover:bg-amber-500/10 flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Re-roll 重新感悟寄语与礼物</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
          >
            收入手帐
          </button>
        </div>
      </div>
    </div>
  );
};

export const PostcardDetailModalDefault = PostcardDetailModal;
export default PostcardDetailModal;
