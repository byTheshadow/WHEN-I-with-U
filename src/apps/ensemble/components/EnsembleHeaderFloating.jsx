import React, { useState } from 'react';
import { ArrowLeft, Sliders, BookOpen, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export const EnsembleHeaderFloating = ({
  chat,
  onBack,
  onOpenSettings,
  onTriggerSummary
}) => {
  const [showDrawer, setShowDrawer] = useState(false);

  const charCount = (chat.selectedCharacterIds?.length || 0) + (chat.localCharacters?.length || 0);

  return (
    <div className="relative z-30 w-full p-3 pointer-events-none flex flex-col items-center">
      {/* 无实体顶栏：只有悬浮的圆形按钮与微型中心胶囊 */}
      <div className="w-full flex items-center justify-between pointer-events-auto">
        {/* 返回主页按键 (带独立柔和底色) */}
        <button
          type="button"
          onClick={onBack}
          className="p-2.5 rounded-full shadow-sm transition-transform active:scale-95 border opacity-90 hover:opacity-100"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* 居中大群名字（点击切换抽屉展开） */}
        <button
          type="button"
          onClick={() => setShowDrawer(!showDrawer)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-sm border text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--modal-overlay)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <span className="truncate max-w-[140px]">{chat.title}</span>
          <span className="text-[10px] opacity-50 font-normal">({charCount}位)</span>
          {showDrawer ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-60" />}
        </button>

        {/* 打开剧本档案/设置按钮 */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2.5 rounded-full shadow-sm transition-transform active:scale-95 border opacity-90 hover:opacity-100"
          style={{
            backgroundColor: 'var(--control-soft-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-main)'
          }}
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* 展开的场景描述与总结面板抽屉 */}
      {showDrawer && (
        <div
          className="w-full mt-2.5 p-4 rounded-3xl border shadow-xl backdrop-blur-xl animate-fade-in pointer-events-auto space-y-3"
          style={{
            backgroundColor: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)',
            color: 'var(--text-main)'
          }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--divider)' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
              <BookOpen className="w-3.5 h-3.5" />
              当前剧本与环境描写
            </div>
            <button
              type="button"
              onClick={onTriggerSummary}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Sparkles className="w-3 h-3" />
              提炼剧情与关系变迁
            </button>
          </div>

          <p className="text-xs italic leading-relaxed opacity-85">
            {chat.scenePrompt || '未设定具体环境描述。大家在惬意的群像沙龙中即兴对话。'}
          </p>
        </div>
      )}
    </div>
  );
};
