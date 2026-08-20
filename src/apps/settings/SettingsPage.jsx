import React, { useState } from 'react';
import {
  ArrowLeft, Palette, Sliders, Moon, Key, RefreshCw,
  Database, AlertTriangle, Cpu, CheckCircle2, XCircle
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';

export const SettingsPage = ({ onBack, currentTheme, onChangeTheme, showTitle, onToggleTitle }) => {
  const [autoMessage, setAutoMessage] = useState(false);
  const [frequency, setFrequency] = useState('moderate');
  const [quietHours, setQuietHours] = useState({ enabled: true, start: "23:00", end: "08:00" });
  const [apiConfig, setApiConfig] = useState({ baseUrl: '', apiKey: '', model: '' });
  const [models, setModels] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle'); // idle | testing | success | error

  const testApiConnection = async () => {
    if (!apiConfig.baseUrl) return;
    setApiStatus('testing');
    try {
      const res = await fetch(`${apiConfig.baseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiConfig.apiKey}` }
      });
      if (!res.ok) throw new Error('Auth or endpoint failure');
      const data = await res.json();
      const modelList = data.data ? data.data.map((m) => m.id) : [];
      setModels(modelList);
      if (modelList.length > 0) setApiConfig((prev) => ({ ...prev, model: modelList[0] }));
      setApiStatus('success');
    } catch (err) {
      console.error(err);
      setApiStatus('error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      {/* 顶部 Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold opacity-70 hover:opacity-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Hub</span>
        </button>
        <span className="text-xs font-mono opacity-40">SYSTEM / SETTINGS</span>
      </div>

      {/* 1. 外观与主题 */}
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Palette className="w-4 h-4" />
          <span>外观与主题 (Appearance)</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { id: 'mono-mist', name: 'Mono Mist (白黑极简)' },
            { id: 'cream-latte', name: 'Cream & Latte (燕麦)' },
            { id: 'obsidian-dark', name: 'Obsidian (黑曜石)' },
            { id: 'cyber-velvet', name: 'Cyber Velvet (暗紫)' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => onChangeTheme(t.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                currentTheme === t.id
                  ? 'border-black dark:border-white bg-black/5 dark:bg-white/10 font-semibold'
                  : 'border-white/10 opacity-70 hover:opacity-100'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          <span>显示主页 "WHEN I WITH U" 标题</span>
          <input
            type="checkbox"
            checked={showTitle}
            onChange={(e) => onToggleTitle(e.target.checked)}
            className="w-4 h-4 accent-black dark:accent-white"
          />
        </div>
      </GlassCard>

      {/* 2. 角色主动触发与安静时段 */}
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Sliders className="w-4 h-4" />
          <span>角色主动触发配置 (Auto Message)</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span>允许角色主动发送动态 / 留言</span>
          <input
            type="checkbox"
            checked={autoMessage}
            onChange={(e) => setAutoMessage(e.target.checked)}
            className="w-4 h-4 accent-black dark:accent-white"
          />
        </div>

        {autoMessage && (
          <div className="space-y-3 pt-2 text-xs border-t border-white/10">
            <div>
              <label className="block opacity-60 mb-1">主动触发频率 (Humanized Schedule)</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
              >
                <option value="gentle">轻柔陪伴 (Gentle)</option>
                <option value="moderate">适度问候 (Moderate)</option>
                <option value="occasional">偶尔来信 (Occasional)</option>
                <option value="pause">暂停主动消息 (Paused)</option>
              </select>
            </div>

            {/* 安静时段 (勿扰模式) */}
            <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 opacity-70" />
                  <span className="font-medium">安静勿扰时段 (Quiet Hours)</span>
                </div>
                <input
                  type="checkbox"
                  checked={quietHours.enabled}
                  onChange={(e) => setQuietHours({ ...quietHours, enabled: e.target.checked })}
                />
              </div>

              {quietHours.enabled && (
                <div className="flex items-center gap-2 pt-1 opacity-80">
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                    className="bg-black/5 dark:bg-white/10 rounded px-2 py-1 outline-none"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                    className="bg-black/5 dark:bg-white/10 rounded px-2 py-1 outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* 3. OpenAI 兼容 API 配置 */}
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Key className="w-4 h-4" />
          <span>API Endpoint & Model</span>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block opacity-60 mb-1">Base URL</label>
            <input
              type="text"
              placeholder="https://api.openai.com/v1"
              value={apiConfig.baseUrl}
              onChange={(e) => setApiConfig({ ...apiConfig, baseUrl: e.target.value })}
              className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
            />
          </div>

          <div>
            <label className="block opacity-60 mb-1">API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiConfig.apiKey}
              onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
              className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={testApiConnection}
              className="px-3 py-1.5 rounded-lg bg-black/10 dark:bg-white/10 flex items-center gap-1.5 font-medium active:scale-95"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Test Connection</span>
            </button>

            {apiStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin opacity-50" />}
            {apiStatus === 'success' && (
              <span className="text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </span>
            )}
            {apiStatus === 'error' && (
              <span className="text-rose-500 flex items-center gap-1">
                <XCircle className="w-4 h-4" /> Connection Failed
              </span>
            )}
          </div>

          {models.length > 0 && (
            <div>
              <label className="block opacity-60 mb-1">Select Model</label>
              <select
                value={apiConfig.model}
                onChange={(e) => setApiConfig({ ...apiConfig, model: e.target.value })}
                className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </GlassCard>

      {/* 水印与格式化 */}
      <div className="pt-4 text-center space-y-2 opacity-40 text-xs">
        <p className="font-mono">by shadow</p>
      </div>
    </div>
  );
};

export default SettingsPage;
