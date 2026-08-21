import React from 'react';
import { Utensils, Clock, MapPin, CheckCircle2 } from 'lucide-react';

export const FoodDeliveryCard = ({ metadata, isUser = false }) => {
  // 解析: [FOOD: 饮品/餐品名称 | 商家名称 | 预计送达时间 | 专属备注]
  const item = metadata?.item || '美团外卖爱心餐';
  const store = metadata?.store || '精选品质商家';
  const eta = metadata?.eta || '约 30 分钟内送达';
  const note = metadata?.note || '记得按时吃饭，趁热吃。';

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
        {/* 头部：模拟外卖单号风格 */}
        <div className="flex items-center justify-between pb-2.5 border-b border-dashed" style={{ borderColor: 'var(--card-border, rgba(0, 0, 0, 0.1))' }}>
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.05))',
                color: 'var(--accent-color, #7c3aed)'
              }}
            >
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block">{store}</span>
              <span className="text-[10px] opacity-60 block">专属代点外卖</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium opacity-80">
            <Clock className="w-3.5 h-3.5" />
            <span>{eta}</span>
          </div>
        </div>

        {/* 内容区 */}
        <div className="py-3">
          <div className="flex items-start justify-between">
            <h4 className="text-sm font-bold">{item}</h4>
            <span className="text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium" style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.06))' }}>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              已下单
            </span>
          </div>
          {note && (
            <div 
              className="mt-2.5 p-2.5 rounded-xl text-xs leading-relaxed"
              style={{ backgroundColor: 'var(--control-soft-bg, rgba(0, 0, 0, 0.04))' }}
            >
              <span className="font-semibold opacity-70">备注：</span>
              <span className="opacity-90">{note}</span>
            </div>
          )}
        </div>

        {/* 脚部状态线 */}
        <div className="pt-2 flex items-center justify-between text-[11px] opacity-60">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>正在为你快速配送中...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodDeliveryCard;
