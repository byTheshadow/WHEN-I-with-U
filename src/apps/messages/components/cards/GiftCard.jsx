import React, { useState } from 'react';
import { Gift, PackageCheck, Sparkles } from 'lucide-react';

export const GiftCard = ({ metadata, isUser = false }) => {
  const [isOpened, setIsOpened] = useState(false);
  
  // 解析: [GIFT: 礼物名称 | 礼物描述/寄语 | 金额(可选)]
  const name = metadata?.name || '心意礼物';
  const note = metadata?.note || '愿这份小礼物能带给你好心情。';
  const amount = metadata?.amount || '';

  return (
    <div className="w-full max-w-sm my-2 select-none">
      <div 
        className="rounded-[1.5rem] p-4 transition-all duration-300 relative overflow-hidden backdrop-blur-md"
        style={{
          backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.75))',
          borderColor: 'var(--card-border, rgba(0, 0, 0, 0.08))',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
          color: 'var(--text-main, #1a1a1a)',
        }}
      >
        {/* 卡片头部 */}
        <div className="flex items-center justify-between pb-3 border-b border-dashed" style={{ borderColor: 'var(--card-border, rgba(0, 0, 0, 0.1))' }}>
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.05))',
                color: 'var(--accent-color, #7c3aed)'
              }}
            >
              <Gift className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase opacity-70">
              {isUser ? '送出的礼物' : '收到惊喜礼物'}
            </span>
          </div>
          {amount && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium" style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.05))' }}>
              ¥{amount}
            </span>
          )}
        </div>

        {/* 卡片主体 */}
        <div className="py-3">
          <h4 className="text-base font-bold tracking-tight mb-1">{name}</h4>
          <p className="text-xs leading-relaxed opacity-80">{note}</p>
        </div>

        {/* 交互展开逻辑 */}
        {!isUser && (
          <button
            onClick={() => setIsOpened(!isOpened)}
            className="w-full mt-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            style={{
              backgroundColor: isOpened ? 'var(--control-soft-bg, rgba(0, 0, 0, 0.05))' : 'var(--accent-color, #7c3aed)',
              color: isOpened ? 'var(--text-main, #1a1a1a)' : '#ffffff',
            }}
          >
            {isOpened ? (
              <>
                <PackageCheck className="w-3.5 h-3.5" />
                <span>礼物已收下</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>拆开礼物</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default GiftCard;
