import React, { useState, useEffect } from 'react';
import { Palette, Cpu, ToggleLeft, ToggleRight, Database, RefreshCw, Trash2, ArrowLeft, Check, Shield } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import { estimateStorageUsage } from '../../db/storageUtils';

export const SettingsApp = ({ onBack, currentTheme, onChangeTheme }) => {
  const [storageInfo, setStorageInfo] = useState({ usedMB: '...', quotaMB: '...' });
  const [isGlobalAutoActive, setIsGlobalAutoActive] = useState(false);
  const [triggerFrequency, setTriggerFrequency] = useState('gentle'); // gentle, balanced, immersive
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [githubPat, setGithubPat] = useState('');

  useEffect(() => {
    estimateStorageUsage().then(setStorageInfo);
  }, []);

  const themes = [
    { id: 'mono-mist', name: 'Mono Mist (白黑弥散)' },
    { id: 'cream-latte', name: 'Cream Latte (燕麦拿铁)' },
    { id: 'obsidian-dark', name: 'Obsidian Dark (黑曜石)' },
    { id: 'cyber-velvet', name: 'Cyber Velvet (赛博紫)' }
  ];

  return (
    <div className="space-y-6 text-left pb-12">
      {/* 顶栏 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回主页</span>
        </button>
        <h2 className="font-bold text-base">Settings</h2>
      </div>

      {/* 1. 外观与主题 */}
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider opacity-80">
          <Palette className="w-4 h-4" />
          <span>外观与主题 (Theme Engine)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => onChangeTheme(t.id)}
              className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                currentTheme === t.id
                  ? 'bg-black/10 dark:bg-white/15 border-current font-bold'
                  : 'bg-black/5 dark:bg-white/5 border-transparent opacity-70'
              }`}
            >
              <span>{t.name}</span>
              {currentTheme === t.id && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 2. 角色主动触发管理 */}
      <GlassCard className="space-y-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider opacity-80">
          <Cpu className="w-4 h-4" />
          <span>角色主动触发设置</span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
          <div>
            <div className="text-xs font-semibold">允许角色主动发消息 / 留言</div>
            <div className="text-[10px] opacity-60">总开关开启后角色方可主动推送消息</div>
          </div>
          <button onClick={() => setIsGlobalAutoActive(!isGlobalAutoActive)}>
            {isGlobalAutoActive ? (
              <ToggleRight className="w-7 h-7 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-7 h-7 opacity-40" />
            )}
          </button>
        </div>

        {/* 抽象频率 */}
        <div className="space-y-2">
          <label className="block text-[11px] opacity-60 font-medium">主动关注节奏频率</label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { id: 'gentle', label: '静谧 (Gentle)' },
              { id: 'balanced', label: '随性 (Casual)' },
              { id: 'immersive', label: '沉浸 (Focused)' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTriggerFrequency(f.id)}
                className={`py-2 rounded-xl text-center text-xs border ${
                  triggerFrequency === f.id
                    ? 'bg-black/10 dark:bg-white/15 border-current font-semibold'
                    : 'bg-black/5 dark:bg-white/5 border-transparent opacity-60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* 3. API 配置 */}
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider opacity-80">
          <Shield className="w-4 h-4" />
          <span>OpenAI 兼容 API 配置</span>
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <label className="block text-[10px] opacity-60 mb-1">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full p-2 rounded-xl bg-black/5 dark:bg-white/5 outline-none font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] opacity-60 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full p-2 rounded-xl bg-black/5 dark:bg-white/5 outline-none font-mono text-xs"
            />
          </div>
        </div>
      </GlassCard>

      {/* 4. 数据备份与本地容量管理 */}
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider opacity-80">
          <Database className="w-4 h-4" />
          <span>数据备份与存储</span>
        </div>

        <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="opacity-60">本地已用空间:</span>
            <span className="font-mono">{storageInfo.usedMB} MB</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">可配额估算:</span>
            <span className="font-mono">{storageInfo.quotaMB} MB</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <button className="p-2.5 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center gap-1.5 font-medium">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>导出全量 JSON</span>
          </button>
          <button className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center gap-1.5 font-medium">
            <Trash2 className="w-3.5 h-3.5" />
            <span>重置 / 格式化</span>
          </button>
        </div>
      </GlassCard>

      {/* 水印 Logo */}
      <div className="pt-6 text-center space-y-1 select-none">
        <div className="text-[11px] font-mono opacity-40 uppercase tracking-widest">
          WHEN I with U · v1.0.0
        </div>
        <div className="text-[10px] font-mono opacity-30 italic">
          by shadow
        </div>
      </div>
    </div>
  );
};

export default SettingsApp;
