import React from 'react';

export default function McdOrderCard({ card }) {
  if (!card || card.kind !== 'mcd') return null;

  const { phase } = card;

  return (
    <div className="my-2.5 max-w-[310px] overflow-hidden rounded-2xl bg-amber-50/70 p-3.5 text-stone-800 shadow-sm backdrop-blur-md transition-all dark:bg-stone-900/60 dark:text-stone-200">
      {/* 头部微标：去边框扁平感 */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="text-base">🍟</span>
          <span className="text-xs font-semibold tracking-wide text-amber-900/80 dark:text-amber-300/80">
            {card.storeName || '麦当劳'}
          </span>
        </div>
        <StatusBadge phase={phase} />
      </div>

      {/* 1. 门店列表展示 */}
      {phase === 'store_list' && (
        <div className="space-y-1.5 pt-1">
          {card.stores?.map((st, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-xs dark:bg-stone-800/40">
              <div>
                <p className="font-semibold">{st.name}</p>
                <p className="text-[10px] opacity-60 truncate max-w-[190px]">{st.address}</p>
              </div>
              <span className="text-[10px] font-mono opacity-70">{st.distance || st.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* 2. 下单待支付 */}
      {phase === 'order_created' && (
        <div className="space-y-2 pt-1">
          <div className="rounded-xl bg-white/70 p-2.5 text-xs dark:bg-stone-800/50">
            <div className="text-[11px] opacity-60">订单号：{card.orderNo || '生成中'}</div>
            <div className="my-1.5 divide-y divide-stone-200/40 dark:divide-stone-700/40">
              {card.items?.map((it, idx) => (
                <div key={idx} className="flex justify-between py-1 text-xs">
                  <span>{it.name} <span className="opacity-60">×{it.qty}</span></span>
                  <span>¥{it.price > 0 ? it.price.toFixed(2) : '-'}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-semibold pt-1 text-red-600 dark:text-red-400">
              <span>合计</span>
              <span>¥{card.total?.toFixed(2)}</span>
            </div>
          </div>
          {card.payUrl && (
            <a
              href={card.payUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-xl bg-amber-500 py-2 text-center text-xs font-bold text-white shadow transition-transform active:scale-95"
            >
              前往支付
            </a>
          )}
        </div>
      )}

      {/* 3. 正在制作中 */}
      {phase === 'cooking' && (
        <div className="relative overflow-hidden rounded-xl bg-white/70 p-3 text-center dark:bg-stone-800/50">
          <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 animate-pulse">
            🍔 厨房备餐中，请稍候…
          </div>
          {card.pickupCode && (
            <div className="my-2">
              <span className="text-[10px] opacity-60 block">取餐号</span>
              <span className="font-mono text-2xl font-black tracking-wider text-amber-600 dark:text-amber-400">
                {card.pickupCode}
              </span>
            </div>
          )}
          {card.etaMinutes && (
            <div className="text-[10px] opacity-60">预计还需约 {card.etaMinutes} 分钟</div>
          )}
        </div>
      )}

      {/* 4. 可取餐叫号 */}
      {phase === 'ready' && (
        <div className="rounded-xl bg-emerald-500/10 p-3 text-center text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="text-xs font-bold">🎉 餐品已备好，请到柜台取餐</div>
          <div className="my-1.5 font-mono text-3xl font-black tracking-widest text-emerald-600 dark:text-emerald-400">
            {card.pickupCode || card.orderNo}
          </div>
        </div>
      )}

      {/* 5. 已取消 / 已失效 */}
      {phase === 'cancelled' && (
        <div className="rounded-xl bg-stone-200/50 p-2.5 text-center text-xs text-stone-500 dark:bg-stone-800/50">
          订单已取消或关闭
        </div>
      )}
    </div>
  );
}

function StatusBadge({ phase }) {
  const map = {
    store_list: { label: '附近门店', color: 'text-amber-700 bg-amber-100/70' },
    order_created: { label: '已下单', color: 'text-orange-700 bg-orange-100/70' },
    cooking: { label: '制作中', color: 'text-amber-600 bg-amber-100/80' },
    ready: { label: '可取餐', color: 'text-emerald-700 bg-emerald-100/80' },
    completed: { label: '已完成', color: 'text-stone-600 bg-stone-100' },
    cancelled: { label: '已取消', color: 'text-red-600 bg-red-100/60' },
  };
  const current = map[phase] || { label: '麦当劳', color: 'text-stone-500' };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${current.color}`}>
      {current.label}
    </span>
  );
}
