import React from 'react';

export default function AppleHealthCard({ card }) {
  if (!card || card.kind !== 'health') return null;

  const { sleep, cardio, activity, vitals } = card;
  const [section, setSection] = React.useState('overview');

  const hasSleep = !!sleep;
  const hasActivity = !!activity;
  const hasVitals = !!cardio || !!vitals;

  const tabs = [
    ['overview', '概览', true],
    ['sleep', '睡眠', hasSleep],
    ['activity', '活动', hasActivity],
    ['vitals', '体征', hasVitals]
  ].filter(([, , available]) => available);

  React.useEffect(() => {
    if (!tabs.some(([key]) => key === section)) setSection('overview');
  }, [section, tabs.length]);

  const value = (input, suffix = '') =>
    input === undefined || input === null || input === '' ? '—' : `${input}${suffix}`;

  const number = input =>
    input === undefined || input === null || input === ''
      ? '—'
      : Number(input).toLocaleString();

  const ratio = (input, total) => {
    const value = Number(input);
    const max = Number(total);
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(100, value / max * 100));
  };

  const ring = (progress, radius = 34) => {
    const circumference = 2 * Math.PI * radius;
    return {
      strokeDasharray: circumference,
      strokeDashoffset: circumference * (1 - Math.min(1, Math.max(0, progress)))
    };
  };

  const sleepTotal = Number(sleep?.totalHours) || 0;
  const stepsProgress = (Number(activity?.steps) || 0) / 10000;
  const caloriesProgress = (Number(activity?.activeCalories) || 0) / 500;
  const exerciseProgress = (Number(activity?.exerciseMin) || 0) / 30;

  return (
    <div className="my-2.5 w-full max-w-[340px] select-none text-neutral-950 dark:text-white">
      <style>{`
        .ah-shell{overflow:hidden;border-radius:28px;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.08);transition:background .3s ease,box-shadow .3s ease}
        .dark .ah-shell{background:#1c1c1e;box-shadow:0 8px 28px rgba(0,0,0,.28)}
        .ah-tab-content{animation:ah-content-in .28s cubic-bezier(.22,1,.36,1)}
        .ah-ring{transform:rotate(-90deg);transform-origin:50% 50%}
        .ah-ring-progress{animation:ah-ring-in .9s cubic-bezier(.22,1,.36,1) both}
        .ah-heart{animation:ah-heart-breathe 2.8s ease-in-out infinite}
        .ah-sleep-segment{transform-origin:left;animation:ah-segment-in .7s cubic-bezier(.22,1,.36,1) both}
        @keyframes ah-content-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ah-ring-in{from{stroke-dashoffset:220}}
        @keyframes ah-segment-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes ah-heart-breathe{0%,100%{transform:scale(1);opacity:.68}50%{transform:scale(1.08);opacity:1}}
        @media(prefers-reduced-motion:reduce){.ah-tab-content,.ah-ring-progress,.ah-sleep-segment,.ah-heart{animation:none}}
      `}</style>

      <div className="ah-shell">
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg className="h-[19px] w-[19px] text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.8 8.7c0 5.1-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.7A4.5 4.5 0 0 1 12 6.3a4.5 4.5 0 0 1 8.8 2.4Z" />
              </svg>
              <span className="text-[13px] font-semibold tracking-[-.01em]">
                健康状态
              </span>
            </div>
            <span className="font-mono text-[9px] tracking-[.08em] text-neutral-400 dark:text-neutral-500">
              APPLE WATCH
            </span>
          </div>

          <div className="mt-5 flex gap-5 overflow-x-auto border-b border-neutral-200/80 dark:border-white/[.1]">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={`relative shrink-0 pb-2.5 text-[12px] transition-colors duration-200 ${
                  section === key
                    ? 'font-medium text-neutral-950 dark:text-white'
                    : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {label}
                {section === key && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-neutral-950 dark:bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div key={section} className="ah-tab-content px-5 pb-5">
          {section === 'overview' && (
            <div>
              <div className="grid grid-cols-3 divide-x divide-neutral-200 dark:divide-white/[.1]">
                <OverviewMetric
                  label="静息心率"
                  value={value(cardio?.restingHr ?? cardio?.avgHr)}
                  unit="BPM"
                />
                <OverviewMetric
                  label="血氧"
                  value={vitals?.spo2 == null ? '—' : vitals.spo2}
                  unit={vitals?.spo2 == null ? '' : '%'}
                />
                <OverviewMetric
                  label="睡眠"
                  value={value(sleep?.totalHours)}
                  unit={sleep?.totalHours == null ? '' : 'H'}
                />
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-white/[.1]">
                <div>
                  <div className="text-[11px] text-neutral-400 dark:text-neutral-500">今日活动</div>
                  <div className="mt-1 font-mono text-[20px] font-semibold tracking-[-.06em]">
                    {number(activity?.steps)}
                    <span className="ml-1 text-[10px] font-normal tracking-normal text-neutral-400">步</span>
                  </div>
                </div>
                <ActivityRings
                  steps={stepsProgress}
                  calories={caloriesProgress}
                  exercise={exerciseProgress}
                  small
                />
              </div>
            </div>
          )}

          {section === 'sleep' && (
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] text-neutral-400 dark:text-neutral-500">昨晚睡眠</div>
                  <div className="mt-1 font-mono text-[27px] font-semibold tracking-[-.08em]">
                    {value(sleep?.totalHours)}
                    <span className="ml-1 text-[11px] font-normal tracking-normal text-neutral-400">小时</span>
                  </div>
                </div>
                <svg className="mb-1 h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 17V8m0 8h16M7 13h5a2 2 0 0 0 2-2v-1H7v3Zm9-3h4v3h-4z" />
                </svg>
              </div>

              {sleepTotal > 0 && (
                <div className="mt-6 flex h-2 gap-[2px] overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[.08]">
                  <span
                    className="ah-sleep-segment rounded-full bg-indigo-500"
                    style={{ width: `${ratio(sleep?.deep, sleepTotal)}%` }}
                  />
                  <span
                    className="ah-sleep-segment rounded-full bg-indigo-300"
                    style={{ width: `${ratio(sleep?.core, sleepTotal)}%`, animationDelay: '.08s' }}
                  />
                  <span
                    className="ah-sleep-segment rounded-full bg-sky-300"
                    style={{ width: `${ratio(sleep?.rem, sleepTotal)}%`, animationDelay: '.16s' }}
                  />
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <SleepMetric label="深睡" value={sleep?.deep} color="bg-indigo-500" />
                <SleepMetric label="核心" value={sleep?.core} color="bg-indigo-300" />
                <SleepMetric label="REM" value={sleep?.rem} color="bg-sky-300" />
              </div>

              {sleep?.range && (
                <div className="mt-5 text-[10px] text-neutral-400 dark:text-neutral-500">
                  {sleep.range}
                </div>
              )}
            </div>
          )}

          {section === 'activity' && (
            <div>
              <div className="flex items-center gap-6">
                <ActivityRings
                  steps={stepsProgress}
                  calories={caloriesProgress}
                  exercise={exerciseProgress}
                />
                <div>
                  <div className="text-[11px] text-neutral-400 dark:text-neutral-500">今日步数</div>
                  <div className="mt-1 font-mono text-[25px] font-semibold tracking-[-.08em]">
                    {number(activity?.steps)}
                  </div>
                  <div className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">步</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 divide-x divide-neutral-200 dark:divide-white/[.1]">
                <OverviewMetric label="活动能量" value={value(activity?.activeCalories)} unit="KCAL" />
                <OverviewMetric label="锻炼" value={value(activity?.exerciseMin)} unit="MIN" />
                <OverviewMetric label="站立" value={value(activity?.standHours)} unit="H" />
              </div>
            </div>
          )}

          {section === 'vitals' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <VitalMetric
                label="静息心率"
                value={value(cardio?.restingHr ?? cardio?.avgHr)}
                unit="BPM"
                pulse
              />
              <VitalMetric
                label="血氧饱和度"
                value={vitals?.spo2 == null ? '—' : vitals.spo2}
                unit={vitals?.spo2 == null ? '' : '%'}
              />
              <VitalMetric label="平均心率" value={value(cardio?.avgHr)} unit="BPM" />
              <VitalMetric label="最高心率" value={value(cardio?.maxHr)} unit="BPM" />
              <VitalMetric label="最低心率" value={value(cardio?.minHr)} unit="BPM" />
              <VitalMetric label="心率变异性" value={value(cardio?.hrv)} unit="MS" />
              <VitalMetric label="呼吸频率" value={value(vitals?.respRate)} unit="次/分" />
              <VitalMetric label="夜间腕温" value={value(vitals?.wristTemp)} unit="°C" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewMetric({ label, value, unit }) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0">
      <div className="truncate text-[10px] text-neutral-400 dark:text-neutral-500">{label}</div>
      <div className="mt-1 whitespace-nowrap font-mono text-[16px] font-semibold tracking-[-.06em]">
        {value}
        {unit && <span className="ml-1 text-[8px] font-normal tracking-normal text-neutral-400">{unit}</span>}
      </div>
    </div>
  );
}

function SleepMetric({ label, value, color }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-500">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
        {label}
      </div>
      <div className="mt-1 font-mono text-[13px]">
        {value == null ? '—' : `${value}h`}
      </div>
    </div>
  );
}

function VitalMetric({ label, value, unit, pulse = false }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-500">
        {pulse && (
          <span className="ah-heart text-rose-500">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l2-6 4 12 2-6h4" />
            </svg>
          </span>
        )}
        {label}
      </div>
      <div className="mt-1 font-mono text-[16px] font-semibold tracking-[-.05em]">
        {value}
        {unit && <span className="ml-1 text-[8px] font-normal tracking-normal text-neutral-400">{unit}</span>}
      </div>
    </div>
  );
}

function ActivityRings({ steps = 0, calories = 0, exercise = 0, small = false }) {
  const size = small ? 72 : 108;
  const center = 54;
  const rings = [
    { radius: 44, progress: calories, color: '#ff375f' },
    { radius: 35, progress: exercise, color: '#9be564' },
    { radius: 26, progress: steps, color: '#32ade6' }
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 108 108"
      className="ah-ring shrink-0"
      aria-hidden="true"
    >
      {rings.map(({ radius, progress, color }) => {
        const length = 2 * Math.PI * radius;
        const dash = {
          strokeDasharray: length,
          strokeDashoffset: length * (1 - Math.min(1, Math.max(0, progress)))
        };

        return (
          <React.Fragment key={radius}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity=".09"
              strokeWidth="5"
            />
            <circle
              className="ah-ring-progress"
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              style={dash}
            />
          </React.Fragment>
        );
      })}
    </svg>
  );
}
