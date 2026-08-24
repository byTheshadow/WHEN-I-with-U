import React, { useState, useEffect } from 'react';
import { X, Sliders } from 'lucide-react';
import db from '../../../db';

export const HabitatApiSettingsModal = ({ onClose, onSave }) => {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      const configRecord = await db.settings.get('habitatApiConfig');
      if (configRecord && configRecord.value) {
        setBaseUrl(configRecord.value.baseUrl || '');
        setApiKey(configRecord.value.apiKey || '');
        setModel(configRecord.value.model || '');
      } else {
        setBaseUrl('https://api.openai.com/v1');
        setModel('gpt-4o');
      }
    };
    loadConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const configValue = {
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim()
    };
    await db.settings.put({ key: 'habitatApiConfig', value: configValue });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-[340px] rounded-2xl border transition-all duration-300"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
          <h3 className="font-serif text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4" style={{ color: 'var(--accent-color)' }} />
            生态瓶副 API 设置
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-neutral-500/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            如果不配置专属接口，系统自动使用全局默认 API 配置。
          </p>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
              API Base URL
            </label>
            <input
              type="url"
              required
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
              API Key
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
              模型 (Model)
            </label>
            <input
              type="text"
              required
              placeholder="gpt-4o"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--divider)' }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border py-2 text-xs font-semibold transition-transform active:scale-95"
              style={{
                borderColor: 'var(--card-border)',
                color: 'var(--text-sub)'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg py-2 text-xs font-semibold transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-foreground)'
              }}
            >
              保存配置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
