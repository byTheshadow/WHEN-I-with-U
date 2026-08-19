import React from 'react';
import { GlassCard } from '../../components/GlassCard';
import { SvgIcon } from '../../components/SvgIcon';

export const ProfileHeader = ({ theme, onThemeToggle }) => {
  return (
    <GlassCard className="relative overflow-hidden p-0 mb-6 border border-white/10">
      {/* 封面图片 Banner */}
      <div className="h-48 md:h-64 w-full relative bg-gradient-to-r from-purple-900/40 via-slate-900 to-indigo-900/40 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent"></div>
        {/* 顶部主题控制按钮 */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            onClick={onThemeToggle}
            className="p-2.5 rounded-2xl glass-panel text-white/80 hover:text-white transition-colors"
            title="切换主题"
          >
            <SvgIcon name="palette" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 个人档案详情信息 */}
      <div className="px-6 md:px-8 pb-6 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between -mt-16 md:-mt-20 mb-4 gap-4">
          {/* 头像 */}
          <div className="relative inline-block">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full ring-4 ring-[var(--bg-primary)] overflow-hidden glass-panel relative z-10">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-2 right-2 z-20 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-[var(--bg-primary)]"></div>
          </div>

          {/* 状态徽章与操作 */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl glass-panel text-xs font-medium flex items-center gap-1.5 border border-purple-500/20">
              <SvgIcon name="sparkles" className="w-3.5 h-3.5 text-purple-400" />
              <span>现实陪伴模式 ON</span>
            </div>
          </div>
        </div>

        {/* 名字 & Handle & Bio */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Evelyn Vance</h1>
          <p className="text-xs text-muted font-mono mb-3">@evelyn_vance</p>
          <p className="text-sm leading-relaxed max-w-2xl font-light">
            “极简主义设计爱好者，正在与 AI 伙伴构建属于我们的独家灵感数据库。记录生活、日记与星空。”
          </p>
        </div>

        {/* 元数据标签卡片 */}
        <div className="flex flex-wrap gap-4 text-xs text-muted pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <SvgIcon name="location" className="w-3.5 h-3.5" />
            <span>Seoul / Digital Space</span>
          </div>
          <div className="flex items-center gap-1.5">
            <SvgIcon name="calendar" className="w-3.5 h-3.5" />
            <span>加入于 2026 年 3 月</span>
          </div>
          <div className="flex items-center gap-1.5">
            <SvgIcon name="link" className="w-3.5 h-3.5" />
            <a href="#" className="hover:underline opacity-80">vance.digital</a>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
