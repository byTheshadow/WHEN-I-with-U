// src/apps/messages/components/cards/AppleHealthCard.jsx
import React from 'react';

export default function AppleHealthCard({ card }) {
  if (!card || card.kind !== 'health') return null;

  const { sleep, cardio, activity, vitals } = card;

  return (
    <div className="my-2.5 max-w-[320px] rounded-3xl bg-stone-900/80 p-4 text-stone-100 shadow-2xl backdrop-blur-xl transition-all select-none">
      {/* 顶部：伴侣关怀氛围小徽标 */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-xs text-rose-400 animate-pulse">
            ❤️
          </span>
          <span className="text-[12px] font-semibold tracking-wide text-stone-300">
            体征与健康状态
          </span>
        </div>
        <span className="text-[10px] font-mono text-stone-400 bg-stone-800/80 px-2 py-0.5 rounded-full">
          Apple Watch
        </span>
      </div>

      {/* 核心第一块：今日活动三维 (步数 / 卡路里 / 锻炼) */}
      {activity && (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.04] p-2.5 text-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-stone-400">今日步数</span>
            <span className="font-mono text-base font-bold text-rose-400">
              {activity.steps?.toLocaleString() ?? '—'}
            </span>
            <span className="text-[9px] text-stone-400">目标 10,000</span>
          </div>

          <div className="flex flex-col border-x border-white/[0.06]">
            <span className="text-[10px] text-stone-400">活动能量</span>
            <span className="font-mono text-base font-bold text-orange-400">
              {activity.activeCalories ?? '—'}
              <span className="text-[9px] font-normal text-stone-400 ml-0.5">kcal</span>
            </span>
            <span className="text-[9px] text-stone-400">消耗千卡</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-stone-400">锻炼时长</span>
            <span className="font-mono text-base font-bold text-emerald-400">
              {activity.exerciseMin ?? '—'}
              <span className="text-[9px] font-normal text-stone-400 ml-0.5">m</span>
            </span>
            <span className="text-[9px] text-stone-400">日常运动</span>
          </div>
        </div>
      )}

      {/* 核心第二块：睡眠深浅分期条 (Sleep Stages) */}
      {sleep && (
        <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
          <div className="flex items-center justify-between text-xs pb-1.5">
            <span className="flex items-center gap-1 text-indigo-300 font-medium">
              <span>🛌</span> 昨晚睡眠
            </span>
            <span className="font-mono font-bold text-indigo-200">
              {sleep.totalHours} <span className="text-[10px] font-normal text-stone-400">小时</span>
            </span>
          </div>

          {/* 睡眠分期比例胶囊条 */}
          {sleep.totalHours > 0 && (
            <div className="my-1.5 flex h-2 w-full overflow-hidden rounded-full bg-stone-800">
              <div
                style={{ width: `${(sleep.deep / sleep.totalHours) * 100}%` }}
                className="bg-indigo-600 transition-all"
                title={`深睡 ${sleep.deep}h`}
              />
              <div
                style={{ width: `${(sleep.core / sleep.totalHours) * 100}%` }}
                className="bg-indigo-400 transition-all"
                title={`核心 ${sleep.core}h`}
              />
              <div
                style={{ width: `${(sleep.rem / sleep.totalHours) * 100}%` }}
                className="bg-sky-300 transition-all"
                title={`REM ${sleep.rem}h`}
              />
            </div>
          )}

          <div className="flex justify-between text-[10px] text-stone-400 pt-0.5 font-mono">
            <span>深睡 {sleep.deep}h</span>
            <span>核心 {sleep.core}h</span>
            <span>REM {sleep.rem}h</span>
          </div>
        </div>
      )}

      {/* 核心第三块：心血管与血氧指标 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* 心率 */}
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5 px-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-stone-400">静息 / 均率</span>
            <span className="font-mono text-sm font-bold text-rose-400">
              {cardio.restingHr ?? cardio.avgHr ?? '—'}
              <span className="text-[9px] font-normal text-stone-400 ml-1">bpm</span>
            </span>
          </div>
          <span className="text-lg opacity-80 animate-pulse">💓</span>
        </div>

        {/* 血氧或 HRV */}
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-2.5 px-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-stone-400">血氧饱和度</span>
            <span className="font-mono text-sm font-bold text-sky-400">
              {vitals?.spo2 ? `${vitals.spo2}%` : (cardio?.hrv ? `${cardio.hrv} ms` : '98%')}
            </span>
          </div>
          <span className="text-lg opacity-80">🫁</span>
        </div>
      </div>
    </div>
  );
}
