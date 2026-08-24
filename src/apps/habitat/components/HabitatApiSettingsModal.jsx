import React, { useState, useEffect } from 'react';
import { X, Sliders, RefreshCw } from 'lucide-react';
import db from '../../../db';
import { fetchHabitatModels } from '../habitatAiService';

const DEFAULT_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'claude-3-5-sonnet',
  'gemini-1.5-pro'
];

export const HabitatApiSettingsModal = ({ onClose, onSave }) => {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const configRecord = await db.settings.get('habitatApiConfig');
      if (configRecord && configRecord.value) {
        setBaseUrl(configRecord.value.baseUrl || '');
        setApiKey(configRecord.value.apiKey || '');
        setModel(configRecord.value.model || 'gpt-4o');
        
        if (configRecord.value.baseUrl && configRecord.value.apiKey) {
          triggerFetchModels(configRecord.value.baseUrl, configRecord.value.apiKey);
        }
      } else {
        setBaseUrl('https://api.openai.com/v1');
        setModel('gpt-4o');
      }
    };
    loadConfig();
  }, []);

  const triggerFetchModels = async (url, key) => {
    if (!url || !key) return;
    setFetching(true);
    const fetched = await fetchHabitatModels(url, key);
    if (fetched && fetched.length > 0) {
      setModels(fetched);
    }
    setFetching(false);
  };

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
            配置生态瓶独立共用的 API。未配置时将使用全局默认 API。
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
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
                模型 (Model)
              </label>
              <button
                type="button"
                onClick={() => triggerFetchModels(baseUrl, apiKey)}
                disabled={fetching}
                className="text-[9px] flex items-center gap-1 hover:opacity-80 active:scale-95 disabled:opacity-50"
                style={{ color: 'var(--accent-color)' }}
              >
                <RefreshCw className={`h-3 w-3 ${fetching ? 'animate-spin' : ''}`} />
                获取可用模型
              </button>
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            >
              {!models.includes(model) && model && (
                <option value={model}>{model} (当前)</option>
              )}
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
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
