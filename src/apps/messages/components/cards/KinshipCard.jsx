import React, { useState } from 'react';
import { CreditCard, Heart, ShieldCheck } from 'lucide-react';

export const KinshipCard = ({ metadata, isUser = false }) => {
  const [isBound, setIsBound] = useState(true);

  // 解析: [KINSHIP: 额度金额 | 周期(如:月度) | 赠言]
  const amount = metadata?.amount || '5200';
  const cycle = metadata?.cycle || '月度额度';
  const quote = metadata?.quote || '拿去随便刷，我的就是你的。';

  return (
    <div className="w-full max-w-sm my-2 select-none">
      <div 
        className="rounded-[1.5rem] p-4 transition-all duration-300 relative backdrop-blur-md"
        style={{
          backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.75))',
          borderColor: 'var(--card-border, rgba(0, 0, 0, 0.08))',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
          color: 'var(--text-main, #1a1a1a)',
        }}
      >
        {/* 卡面芯片与标题 */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: 'var(--accent-color, #7c3aed)',
                color: '#ffffff'
              }}
            >
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block tracking-wider">专属亲属卡</span>
              <span className="text-[10px] opacity-60 block">{cycle}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold">
            <Heart className="w-3.5 h-3.5 fill-current opacity-80" />
            <span>KINSHIP</span>
          </div>
        </div>

        {/* 额度展示 */}
        <div className="py-2 my-1">
          <span className="text-[10px] uppercase tracking-widest opacity-60 block mb-0.5">可用额度 (CNY)</span>
          <div className="text-2xl font-extrabold font-mono tracking-tight">
            ¥{amount}
          </div>
          <p className="text-xs mt-2 italic opacity-85 leading-relaxed font-serif">
            “{quote}”
          </p>
        </div>

        {/* 底部绑定标记 */}
        <div className="pt-3 border-t border-dashed flex items-center justify-between text-xs" style={{ borderColor: 'var(--card-border, rgba(0, 0, 0, 0.1))' }}>
          <div className="flex items-center gap-1.5 opacity-80">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isBound ? '已自动关联至全站支付' : '未关联'}</span>
          </div>
          <span className="text-[10px] font-mono opacity-50">WHEN I WITH U</span>
        </div>
      </div>
    </div>
  );
};

export default KinshipCard;
