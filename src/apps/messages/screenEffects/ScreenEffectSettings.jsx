// src/apps/messages/screenEffects/ScreenEffectSettings.jsx
//
// 设置页里的"全屏特效"卡片：列出全部七种特效，每种可以单独开关"底色"，
// 并有"预览"按钮即时看效果。底色偏好存在 db.settings（screenEffectPrefs.js）。

import React, { useEffect, useState } from 'react';
import { Play, Sparkles } from 'lucide-react';

import GlassCard from '../../../components/GlassCard';
import FullscreenEffectLayer from './FullscreenEffectLayer';
import {
  ALL_EFFECT_CARDS,
  FOCUS_PRESET_ID,
  SCREEN_EFFECT_EVENT,
} from './screenEffectPresets';
import { getBackdropPrefs, setBackdropPref } from './screenEffectPrefs';

const SAMPLE_FOCUS_LINES = [
  { text: '你', emphasis: false },
  { text: '现在', emphasis: false },
  { text: '只需要', emphasis: true },
  { text: '好好', emphasis: false },
  { text: '呼吸', emphasis: true },
  { text: '就好。', emphasis: false },
];

export const ScreenEffectSettings = () => {
  const [prefs, setPrefs] = useState({});

  useEffect(() => {
    let cancelled = false;

    getBackdropPrefs().then((loaded) => {
      if (!cancelled) setPrefs(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (cardId) => {
    const next = prefs[cardId] === false;
    setPrefs((prev) => ({ ...prev, [cardId]: next }));

    try {
      await setBackdropPref(cardId, next);
    } catch (error) {
      console.error('[ScreenEffect] 保存底色偏好失败:', error);
      setPrefs((prev) => ({ ...prev, [cardId]: !next }));
    }
  };

  const handlePreview = (card) => {
    const backdrop = prefs[card.id] !== false;

    const detail = card.id === FOCUS_PRESET_ID
      ? { kind: 'focus', lines: SAMPLE_FOCUS_LINES }
      : { kind: 'preset', presetId: card.id, caption: card.defaultCaption || '' };

    window.dispatchEvent(new CustomEvent(SCREEN_EFFECT_EVENT, {
      detail: { ...detail, preview: true, backdrop },
    }));
  };

  return (
    <GlassCard className="space-y-4 text-left">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4" />
        <span>聊天室全屏特效</span>
      </div>

      <p className="text-[11px] leading-relaxed opacity-60">
        角色可以在聊天时自己决定触发全屏特效：氛围动画需要你们两个人都说出同一句暗号才会出现，专注文字则由角色在需要时直接发出。这里可以选择每种特效是否带底色，关闭后只保留动画本身，叠在聊天界面上。
      </p>

      <div className="space-y-2.5">
        {ALL_EFFECT_CARDS.map((card) => {
          const backdropOn = prefs[card.id] !== false;

          return (
            <div
              key={card.id}
              className="flex items-center gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5"
            >
              <div
                className="h-12 w-12 shrink-0 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${card.swatch[0]} 0%, ${card.swatch[1]} 100%)`,
                }}
              />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{card.name}</p>
                <p className="mt-0.5 text-[10px] leading-snug opacity-55">{card.desc}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={backdropOn}
                  aria-label={`${card.name}底色`}
                  onClick={() => handleToggle(card.id)}
                  className="flex items-center gap-1.5 text-[10px] font-medium"
                >
                  <span className="opacity-60">底色</span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      backdropOn ? 'bg-emerald-500' : 'bg-black/20 dark:bg-white/25'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        backdropOn ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePreview(card)}
                  className="flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1 text-[10px] font-semibold transition-transform active:scale-95 dark:bg-white/10"
                >
                  <Play className="h-3 w-3" />
                  预览
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <FullscreenEffectLayer preview />
    </GlassCard>
  );
};

export default ScreenEffectSettings;