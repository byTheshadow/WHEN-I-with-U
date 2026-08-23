import React, { useState } from 'react';
import { ChevronLeft, Sliders, Users, BookOpen, Sparkles } from 'lucide-react';

export const EnsembleHeaderBanner = ({
  chat,
  onBack,
  onOpenSettings,
  onTriggerSummary
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative z-30 w-full shrink-0">
      {/* 紧凑顶框 */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--divider)',
          backgroundColor: 'var(--modal-overlay)'
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-full transition-transform active:scale-95 opacity-80 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* 点击居中名字，展开背景/详细 */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-col items-center max-w-[200px]"
        >
          <h2 className="text-xs font-semibold tracking-wide truncate" style={{ color: 'var(--text-main)' }}>
            {chat.title}
          </h2>
          <span className="text-[9px] opacity-50 truncate">
            {chat.selectedCharacterIds?.length || 0} 位角色羁绊 • 点击展开设定
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-full transition-transform active:scale-95 opacity-80 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* 可展开的环境描述与剧本控制抽屉 */}
      {isExpanded && (
        <div
          className="p-3.5 space-y-2 border-b text-xs animate-fade-in"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--divider)',
            color: 'var(--text-main)'
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] opacity-70 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              场景环境 (Scene Prompt)
            </span>
            <button
              type="button"
              onClick={onTriggerSummary}
              className="flex items-center gap-1 px-2 text-[10px] py-1 rounded-full font-medium active:scale-95 transition-transform"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              <Sparkles className="w-3 h-3" />
              总结当前剧情
            </button>
          </div>
          <p className="text-[11px] leading-relaxed opacity-80 italic">
            {chat.scenePrompt || '未设定具体环境描述。大家在惬意的随感沙龙中聊天。'}
          </p>
        </div>
      )}
    </div>
  );
};
