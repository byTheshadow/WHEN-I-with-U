import React, { useState, useEffect } from 'react';
import { X, Sliders, RefreshCw, Loader } from 'lucide-react';
import db from '../../../db';
import { fetchAvailableModels } from '../habitatAiService';

const DEFAULT_FALLBACK_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'claude-3-5-sonnet',
  'gemini-1.5-pro'
];

export const HabitatApiSettingsModal = ({ onClose, onSave }) => {
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  
  const [modelList, setModelList] = useState(DEFAULT_FALLBACK_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      const configRecord = await db.settings.get('habitatApiConfig');
      if (configRecord && configRecord.value) {
        setBaseUrl(configRecord.value.baseUrl || 'https://api.openai.com/v1');
        setApiKey(configRecord.value.apiKey || '');
        setModel(configRecord.value.model || 'gpt-4o');
        
        if (configRecord.value.apiKey) {
          void loadModelsFromApi(configRecord.value.baseUrl, configRecord.value.apiKey, configRecord.value.model);
        }
      }
    };
    void loadConfig();
  }, []);

  const loadModelsFromApi = async (url, key, currentModel) => {
    if (!key) return;
    setIsLoadingModels(true);
    setApiError('');
    try {
      const models = await fetchAvailableModels(url, key);
      if (models.length > 0) {
        setModelList(models);
        // 如果当前保存的模型不在获取到的列表中，且当前模型有效，追加至列表
        if (currentModel && !models.includes(currentModel)) {
          setModelList(prev => [currentModel, ...prev]);
        }
      }
    } catch (err) {
      console.error('拉取模型失败:', err);
      setApiError('无法连接 API，已启用预设降级列表。');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleFetchModels = () => {
    void loadModelsFromApi(baseUrl, apiKey, model);
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
        className="w-full max-w-[340px] rounded-2xl border transition-all duration-300 shadow-xl"
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
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-sub)' }}>
                模型 (Model)
              </label>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={isLoadingModels}
                  className="text-[9px] font-semibold flex items-center gap-1 hover:opacity-80 active:scale-95"
                  style={{ color: 'var(--accent-color)' }}
                >
                  {isLoadingModels ? (
                    <Loader className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  获取可用模型
                </button>
              )}
            </div>
            
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)'
              }}
            >
              {modelList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {apiError && (
              <span className="text-[9px] block leading-tight mt-1" style={{ color: 'var(--text-muted)' }}>
                {apiError}
              </span>
            )}
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
