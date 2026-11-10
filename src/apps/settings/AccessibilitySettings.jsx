// src/apps/settings/AccessibilitySettings.jsx
//
// 设置页里的「无障碍（低视力）」面板：文字大小四档、更明显的焦点框。
// 高对比度配色是一个独立主题，在上方「视觉美学」的主题列表里选择。
//
// 和设置页里其他项不同：这里点一下就立刻生效并保存，不依赖页面底部的
// 保存按钮。原因是这些设置本来就是为了让界面马上变得好读，如果要先找到
// 保存按钮才生效，对看不清的人反而是多一道门槛。

import React, { useEffect, useState } from 'react';
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  FONT_SCALE_OPTIONS,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
} from '../../services/accessibilityService';

const activeButtonClass = 'bg-black text-white dark:bg-white dark:text-black font-semibold';
const idleButtonClass = 'bg-black/5 dark:bg-white/10 hover:bg-black/10';

export const AccessibilitySettings = () => {
  const [settings, setSettings] = useState(DEFAULT_ACCESSIBILITY_SETTINGS);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;

    loadAccessibilitySettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((error) => {
        console.warn('[AccessibilitySettings] 读取失败:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const commit = async (patch) => {
    const previous = settings;
    const optimistic = { ...settings, ...patch };

    setSettings(optimistic);
    setErrorText('');

    try {
      const saved = await saveAccessibilitySettings(optimistic);
      setSettings(saved);
    } catch (error) {
      console.warn('[AccessibilitySettings] 保存失败:', error);
      setSettings(previous);
      setErrorText('保存失败，请再试一次。');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">文字大小 (Text Size)</p>
        <p
          className="mt-1 text-[11px] leading-relaxed"
          style={{ color: 'var(--text-sub)' }}
        >
          点击后立即生效。会放大应用里绝大部分文字，图标和按钮大小不变。
        </p>
      </div>

      <div
        role="group"
        aria-label="文字大小"
        className="grid grid-cols-4 gap-2 text-xs"
      >
        {FONT_SCALE_OPTIONS.map((option) => {
          const selected = settings.fontScale === option.scale;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => commit({ fontScale: option.scale })}
              className={`rounded-xl py-3 font-medium transition-all ${
                selected ? activeButtonClass : idleButtonClass
              }`}
            >
              <span className="block">{option.label}</span>
              <span className="block text-[10px]">{option.hint}</span>
            </button>
          );
        })}
      </div>

      <div
        className="rounded-xl p-3"
        style={{ background: 'var(--control-soft-bg)' }}
      >
        <p className="text-xs font-medium">预览 (Preview)</p>
        <p
          className="mt-1 text-[11px] leading-relaxed"
          style={{ color: 'var(--text-sub)' }}
        >
          这是一行说明文字，用来对比当前的文字大小。
        </p>
        <p
          className="mt-1 text-[10px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          这是最小的一档辅助文字。
        </p>
      </div>

      <div className="border-t border-black/5 pt-4 dark:border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">更明显的焦点框 (Focus Outline)</p>
            <p
              className="mt-1 text-[11px] leading-relaxed"
              style={{ color: 'var(--text-sub)' }}
            >
              用键盘或外接设备操作时，当前选中的按钮会有醒目的蓝色描边。
              触屏点按不受影响。
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.focusRing}
            aria-label="更明显的焦点框"
            onClick={() => commit({ focusRing: !settings.focusRing })}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
              settings.focusRing ? activeButtonClass : idleButtonClass
            }`}
          >
            {settings.focusRing ? '已开启' : '已关闭'}
          </button>
        </div>
      </div>

      <p
        className="text-[11px] leading-relaxed"
        style={{ color: 'var(--text-sub)' }}
      >
        需要更高的对比度：在上方「空间底色」里选择 High Contrast (高对比度)，
        选好后点页面底部的保存。
      </p>

      {errorText ? (
        <p role="alert" className="text-xs font-medium">
          {errorText}
        </p>
      ) : null}
    </div>
  );
};

export default AccessibilitySettings;