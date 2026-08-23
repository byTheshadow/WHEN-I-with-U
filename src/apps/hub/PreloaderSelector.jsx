// src/apps/hub/PreloaderSelector.jsx
import React, { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';
import { Eye, HelpCircle, Sparkles, Camera, Disc, Mail, Layers } from 'lucide-react';
import Preloader from '../../components/Preloader';

const ANIMATION_OPTIONS = [
  { id: 'astrology', name: 'Astrology Dice', icon: Sparkles, desc: 'Aligning cosmic paths' },
  { id: 'polaroid', name: 'Polaroid Grain', icon: Camera, desc: 'Analog chemical develop' },
  { id: 'vinyl', name: 'Vinyl Groove', icon: Disc, desc: 'Mechanical retro warmth' },
  { id: 'letter', name: 'Airmail Seal', icon: Mail, desc: 'StAMP of wanderlust thoughts' },
  { id: 'pebble', name: 'Pebble Stack', icon: Layers, desc: 'Quiet physical balance' }
];

export const PreloaderSelector = ({ delay = 150 }) => {
  const [currentType, setCurrentType] = useState('astrology');
  const [isPreviewing, setIsPreviewing] = useState(false);

  // 初始化加载配置
  useEffect(() => {
    const initSetting = async () => {
      // 1. 优先快读 localStorage
      const localValue = localStorage.getItem('preloader_type');
      if (localValue) {
        setCurrentType(localValue);
      }
      
      // 2. 异步同步 db.settings
      try {
        const dbSetting = await db.settings.get('preloaderConfig');
        if (dbSetting?.value?.type) {
          setCurrentType(dbSetting.value.type);
          if (localValue !== dbSetting.value.type) {
            localStorage.setItem('preloader_type', dbSetting.value.type);
          }
        }
      } catch (err) {
        console.warn('Failed to load preloader from Dexie:', err);
      }
    };
    initSetting();
  }, []);

  // 写入配置
  const handleSelect = async (type) => {
    setCurrentType(type);
    localStorage.setItem('preloader_type', type);
    try {
      await db.settings.put({
        key: 'preloaderConfig',
        value: { type }
      });
    } catch (err) {
      console.error('Failed to save preloader config to Dexie:', err);
    }
  };

  return (
    <>
      <GlassCard
        delay={delay}
        className="flex flex-col p-4 text-left relative overflow-hidden transition-all duration-300"
        style={{
          border: '1px solid var(--card-border)',
          backgroundColor: 'var(--card-bg)'
        }}
      >
        {/* 顶部修饰线与标签 (营造手帐/杂志风排版) */}
        <div className="flex items-center justify-between border-b border-solid border-[var(--divider)] pb-2 mb-3">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
              Aesthetic Calibration
            </span>
            <h4 className="text-xs font-bold text-[var(--text-main)]">
              BOOT SCREEN ATMOSPHERE
            </h4>
          </div>
          <button
            onClick={() => setIsPreviewing(true)}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md hover:bg-[var(--control-soft-hover)] text-[var(--text-sub)] transition-colors border border-solid border-[var(--divider)]"
            title="Preview current animation"
          >
            <Eye className="h-3 w-3" />
            <span>PREVIEW</span>
          </button>
        </div>

        {/* 动画选择排版 */}
        <div className="space-y-1.5">
          {ANIMATION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentType === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-[var(--control-soft-bg)] border border-solid border-[var(--text-muted)]/20'
                    : 'hover:bg-[var(--control-soft-hover)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-3.5 w-3.5 transition-transform duration-300 ${
                      isSelected ? 'scale-110 text-[var(--accent-color)] opacity-100' : 'opacity-40 text-[var(--text-main)]'
                    }`}
                  />
                  <div>
                    <p className={`text-[11px] font-medium leading-none ${
                      isSelected ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-sub)]'
                    }`}>
                      {opt.name}
                    </p>
                    <p className="text-[9px] text-[var(--text-muted)] mt-0.5 uppercase tracking-wider font-light">
                      {opt.desc}
                    </p>
                  </div>
                </div>

                {/* 指示符：纯文字物理刻度感 */}
                {isSelected && (
                  <span className="text-[8px] tracking-wider text-[var(--accent-color)] font-bold px-1.5 py-0.5 border border-solid border-[var(--accent-color)]/20 rounded">
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 底部杂志感注脚 */}
        <div className="mt-3 pt-2 border-t border-dashed border-[var(--divider)] flex justify-between items-center text-[9px] text-[var(--text-muted)] tracking-wider">
          <span>ATMOSPHERE SELECTOR v1.0</span>
          <span>WHEN I WITH U</span>
        </div>
      </GlassCard>

      {/* 实时预览挂载 */}
      {isPreviewing && (
        <Preloader
          isPreview={true}
          previewType={currentType}
          onFinish={() => setIsPreviewing(false)}
        />
      )}
    </>
  );
};

export default PreloaderSelector;
