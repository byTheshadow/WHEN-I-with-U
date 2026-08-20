import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  HardDrive,
  ImageOff,
  Key,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Sliders,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';

const TABLE_NAMES = [
  'profile',
  'pinnedGallery',
  'characters',
  'homeBoard',
  'diaries',
  'travels',
  'todos',
  'settings',
];

const BACKUP_FORMAT = 'when-i-with-u-backup';
const BACKUP_VERSION = 1;

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const readBlobAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read local image data.'));
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = async (dataUrl, fallbackType = 'application/octet-stream') => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return new Blob([blob], { type: blob.type || fallbackType });
};

const serializeBackupValue = async (value) => {
  if (value instanceof Blob) {
    return {
      __whenIWithUType: 'blob',
      type: value.type || 'application/octet-stream',
      dataUrl: await readBlobAsDataUrl(value),
    };
  }

  if (value instanceof Date) {
    return {
      __whenIWithUType: 'date',
      value: value.toISOString(),
    };
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => serializeBackupValue(item)));
  }

  if (value && typeof value === 'object') {
    const serializedObject = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      serializedObject[key] = await serializeBackupValue(nestedValue);
    }

    return serializedObject;
  }

  return value;
};

const restoreBackupValue = async (value) => {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => restoreBackupValue(item)));
  }

  if (value && typeof value === 'object') {
    if (value.__whenIWithUType === 'blob' && typeof value.dataUrl === 'string') {
      return dataUrlToBlob(value.dataUrl, value.type);
    }

    if (value.__whenIWithUType === 'date' && typeof value.value === 'string') {
      return new Date(value.value);
    }

    const restoredObject = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      restoredObject[key] = await restoreBackupValue(nestedValue);
    }

    return restoredObject;
  }

  return value;
};

const isValidBackup = (backup) => {
  if (!backup || typeof backup !== 'object') return false;
  if (backup.format !== BACKUP_FORMAT) return false;
  if (!backup.data || typeof backup.data !== 'object') return false;

  return TABLE_NAMES.every(
    (tableName) => Array.isArray(backup.data[tableName]),
  );
};

export const SettingsPage = ({
  onBack,
  currentTheme,
  onChangeTheme,
  showTitle,
  onToggleTitle,
}) => {
  const importInputRef = useRef(null);

  const [autoMessage, setAutoMessage] = useState(false);
  const [frequency, setFrequency] = useState('moderate');
  const [quietHours, setQuietHours] = useState({
    enabled: true,
    start: '23:00',
    end: '08:00',
  });
  const [apiConfig, setApiConfig] = useState({
    baseUrl: '',
    apiKey: '',
    model: '',
  });
  const [models, setModels] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle');
  const [storageInfo, setStorageInfo] = useState({
    supported: true,
    usage: 0,
    quota: 0,
  });
  const [dataStatus, setDataStatus] = useState({
    type: 'idle',
    message: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const updateStorageEstimate = async () => {
    if (!navigator.storage || !navigator.storage.estimate) {
      setStorageInfo({
        supported: false,
        usage: 0,
        quota: 0,
      });
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();

      setStorageInfo({
        supported: true,
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      });
    } catch (error) {
      console.error('Unable to estimate storage usage:', error);
      setStorageInfo({
        supported: false,
        usage: 0,
        quota: 0,
      });
    }
  };

  const saveSetting = async (key, value) => {
    try {
      await db.settings.put({ key, value });
    } catch (error) {
      console.error(`Unable to save setting: ${key}`, error);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await db.settings.toArray();
        const settingMap = savedSettings.reduce((result, item) => {
          result[item.key] = item.value;
          return result;
        }, {});

        if (typeof settingMap.autoMessage === 'boolean') {
          setAutoMessage(settingMap.autoMessage);
        }

        if (typeof settingMap.frequency === 'string') {
          setFrequency(settingMap.frequency);
        }

        if (settingMap.quietHours && typeof settingMap.quietHours === 'object') {
          setQuietHours((previous) => ({
            ...previous,
            ...settingMap.quietHours,
          }));
        }

        if (settingMap.apiConfig && typeof settingMap.apiConfig === 'object') {
          setApiConfig((previous) => ({
            ...previous,
            ...settingMap.apiConfig,
          }));
        }
      } catch (error) {
        console.error('Unable to load settings:', error);
      }
    };

    loadSettings();
    updateStorageEstimate();
  }, []);

  const handleThemeChange = (themeId) => {
    onChangeTheme(themeId);
    saveSetting('theme', themeId);
  };

  const handleTitleChange = (isVisible) => {
    onToggleTitle(isVisible);
    saveSetting('showTitle', isVisible);
  };

  const handleAutoMessageChange = (isEnabled) => {
    setAutoMessage(isEnabled);
    saveSetting('autoMessage', isEnabled);
  };

  const handleFrequencyChange = (value) => {
    setFrequency(value);
    saveSetting('frequency', value);
  };

  const handleQuietHoursChange = (nextValue) => {
    setQuietHours(nextValue);
    saveSetting('quietHours', nextValue);
  };

  const handleApiConfigChange = (nextValue) => {
    setApiConfig(nextValue);
    saveSetting('apiConfig', nextValue);
  };

  const testApiConnection = async () => {
    if (!apiConfig.baseUrl.trim()) {
      setApiStatus('error');
      return;
    }

    setApiStatus('testing');

    try {
      const baseUrl = apiConfig.baseUrl.trim().replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/models`, {
        headers: apiConfig.apiKey
          ? { Authorization: `Bearer ${apiConfig.apiKey}` }
          : {},
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseData = await response.json();
      const modelList = Array.isArray(responseData.data)
        ? responseData.data
          .map((model) => model?.id)
          .filter((modelId) => typeof modelId === 'string' && modelId.length > 0)
        : [];

      setModels(modelList);

      const nextConfig = {
        ...apiConfig,
        model: apiConfig.model || modelList[0] || '',
      };

      setApiConfig(nextConfig);
      saveSetting('apiConfig', nextConfig);
      setApiStatus('success');
    } catch (error) {
      console.error('API connection failed:', error);
      setApiStatus('error');
    }
  };

  const exportDatabase = async () => {
    setIsProcessing(true);
    setDataStatus({ type: 'idle', message: '' });

    try {
      const data = {};

      for (const tableName of TABLE_NAMES) {
        const records = await db.table(tableName).toArray();
        data[tableName] = await Promise.all(
          records.map((record) => serializeBackupValue(record)),
        );
      }

      const backup = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      };

      const backupBlob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: 'application/json' },
      );

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

      const downloadUrl = URL.createObjectURL(backupBlob);
      const downloadLink = document.createElement('a');

      downloadLink.href = downloadUrl;
      downloadLink.download = `when-i-with-u-backup-${timestamp}.json`;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(downloadUrl);

      setDataStatus({
        type: 'success',
        message: '数据备份文件已导出。',
      });
    } catch (error) {
      console.error('Database export failed:', error);
      setDataStatus({
        type: 'error',
        message: '导出失败。请检查浏览器存储权限后重试。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setDataStatus({ type: 'idle', message: '' });

    try {
      const content = await file.text();
      const backup = JSON.parse(content);

      if (!isValidBackup(backup)) {
        throw new Error('The selected file is not a valid project backup.');
      }

      setPendingImport(backup);
      setConfirmDialog({
        type: 'import',
        title: '恢复本地备份',
        description:
          '恢复将先清空当前所有本地数据，再写入备份中的数据。此操作无法撤销。',
        confirmLabel: '确认恢复',
        danger: true,
      });
    } catch (error) {
      console.error('Backup import validation failed:', error);
      setDataStatus({
        type: 'error',
        message: '文件无法识别。请选择由本项目导出的有效 JSON 备份。',
      });
    }
  };

  const importDatabase = async () => {
    if (!pendingImport) return;

    setIsProcessing(true);
    setConfirmDialog(null);

    try {
      const restoredData = {};

      for (const tableName of TABLE_NAMES) {
        restoredData[tableName] = await Promise.all(
          pendingImport.data[tableName].map((record) => restoreBackupValue(record)),
        );
      }

      await db.transaction(
        'rw',
        TABLE_NAMES.map((tableName) => db.table(tableName)),
        async () => {
          await Promise.all(
            TABLE_NAMES.map((tableName) => db.table(tableName).clear()),
          );

          for (const tableName of TABLE_NAMES) {
            if (restoredData[tableName].length > 0) {
              await db.table(tableName).bulkPut(restoredData[tableName]);
            }
          }
        },
      );

      setPendingImport(null);
      await updateStorageEstimate();

      setDataStatus({
        type: 'success',
        message: '备份已恢复。请刷新页面以重新加载全部设置。',
      });
    } catch (error) {
      console.error('Database import failed:', error);
      setDataStatus({
        type: 'error',
        message: '恢复失败。当前数据未完成更新，请重新检查备份文件。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearGalleryImages = async () => {
    setIsProcessing(true);
    setConfirmDialog(null);

    try {
      const galleries = await db.pinnedGallery.toArray();

      await db.transaction('rw', db.pinnedGallery, async () => {
        await Promise.all(
          galleries.map((gallery) =>
            db.pinnedGallery.put({
              ...gallery,
              photos: [],
            }),
          ),
        );
      });

      await updateStorageEstimate();

      setDataStatus({
        type: 'success',
        message: '图集中的本地图片已清理，标题与文字内容已保留。',
      });
    } catch (error) {
      console.error('Image cleanup failed:', error);
      setDataStatus({
        type: 'error',
        message: '图片清理失败，请稍后重试。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const factoryReset = async () => {
    setIsProcessing(true);
    setConfirmDialog(null);

    try {
      await db.transaction(
        'rw',
        TABLE_NAMES.map((tableName) => db.table(tableName)),
        async () => {
          await Promise.all(
            TABLE_NAMES.map((tableName) => db.table(tableName).clear()),
          );
        },
      );

      setModels([]);
      setApiStatus('idle');
      setPendingImport(null);

      await updateStorageEstimate();

      setDataStatus({
        type: 'success',
        message: '本地数据已清空。请刷新页面以恢复初始界面状态。',
      });
    } catch (error) {
      console.error('Factory reset failed:', error);
      setDataStatus({
        type: 'error',
        message: '清空失败，请稍后重试。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runConfirmedAction = () => {
    if (confirmDialog?.type === 'import') importDatabase();
    if (confirmDialog?.type === 'clear-images') clearGalleryImages();
    if (confirmDialog?.type === 'factory-reset') factoryReset();
  };

  const storagePercent = storageInfo.quota > 0
    ? Math.min((storageInfo.usage / storageInfo.quota) * 100, 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold opacity-70 transition-opacity hover:opacity-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Hub</span>
        </button>
        <span className="font-mono text-xs opacity-40">SYSTEM / SETTINGS</span>
      </div>

      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Palette className="h-4 w-4" />
          <span>外观与主题 (Appearance)</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { id: 'mono-mist', name: 'Mono Mist (白黑极简)' },
            { id: 'cream-latte', name: 'Cream & Latte (燕麦)' },
            { id: 'obsidian-dark', name: 'Obsidian (黑曜石)' },
            { id: 'cyber-velvet', name: 'Cyber Velvet (暗紫)' },
          ].map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                currentTheme === theme.id
                  ? 'border-black bg-black/5 font-semibold dark:border-white dark:bg-white/10'
                  : 'border-white/10 opacity-70 hover:opacity-100'
              }`}
            >
              {theme.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
          <span>显示主页 "WHEN I WITH U" 标题</span>
          <input
            type="checkbox"
            checked={showTitle}
            onChange={(event) => handleTitleChange(event.target.checked)}
            className="h-4 w-4 accent-black dark:accent-white"
          />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sliders className="h-4 w-4" />
          <span>角色主动触发配置 (Auto Message)</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span>允许角色主动发送动态 / 留言</span>
          <input
            type="checkbox"
            checked={autoMessage}
            onChange={(event) => handleAutoMessageChange(event.target.checked)}
            className="h-4 w-4 accent-black dark:accent-white"
          />
        </div>

        {autoMessage && (
          <div className="space-y-3 border-t border-white/10 pt-2 text-xs">
            <div>
              <label className="mb-1 block opacity-60">
                主动触发频率 (Humanized Schedule)
              </label>
              <select
                value={frequency}
                onChange={(event) => handleFrequencyChange(event.target.value)}
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              >
                <option value="gentle">轻柔陪伴 (Gentle)</option>
                <option value="moderate">适度问候 (Moderate)</option>
                <option value="occasional">偶尔来信 (Occasional)</option>
                <option value="pause">暂停主动消息 (Paused)</option>
              </select>
            </div>

            <div className="space-y-2 rounded-xl bg-black/5 p-3 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5 opacity-70" />
                  <span className="font-medium">安静勿扰时段 (Quiet Hours)</span>
                </div>
                <input
                  type="checkbox"
                  checked={quietHours.enabled}
                  onChange={(event) =>
                    handleQuietHoursChange({
                      ...quietHours,
                      enabled: event.target.checked,
                    })
                  }
                />
              </div>

              {quietHours.enabled && (
                <div className="flex items-center gap-2 pt-1 opacity-80">
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(event) =>
                      handleQuietHoursChange({
                        ...quietHours,
                        start: event.target.value,
                      })
                    }
                    className="rounded bg-black/5 px-2 py-1 outline-none dark:bg-white/10"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(event) =>
                      handleQuietHoursChange({
                        ...quietHours,
                        end: event.target.value,
                      })
                    }
                    className="rounded bg-black/5 px-2 py-1 outline-none dark:bg-white/10"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Key className="h-4 w-4" />
          <span>API Endpoint & Model</span>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block opacity-60">Base URL</label>
            <input
              type="text"
              placeholder="https://api.openai.com/v1"
              value={apiConfig.baseUrl}
              onChange={(event) =>
                handleApiConfigChange({
                  ...apiConfig,
                  baseUrl: event.target.value,
                })
              }
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />
          </div>

          <div>
            <label className="mb-1 block opacity-60">API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiConfig.apiKey}
              onChange={(event) =>
                handleApiConfigChange({
                  ...apiConfig,
                  apiKey: event.target.value,
                })
              }
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={testApiConnection}
              disabled={apiStatus === 'testing'}
              className="flex items-center gap-1.5 rounded-lg bg-black/10 px-3 py-1.5 font-medium transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Test Connection</span>
            </button>

            {apiStatus === 'testing' && (
              <RefreshCw className="h-4 w-4 animate-spin opacity-50" />
            )}
            {apiStatus === 'success' && (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </span>
            )}
            {apiStatus === 'error' && (
              <span className="flex items-center gap-1 text-rose-600">
                <XCircle className="h-4 w-4" />
                Connection Failed
              </span>
            )}
          </div>

          {models.length > 0 && (
            <div>
              <label className="mb-1 block opacity-60">Select Model</label>
              <select
                value={apiConfig.model}
                onChange={(event) =>
                  handleApiConfigChange({
                    ...apiConfig,
                    model: event.target.value,
                  })
                }
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="space-y-5 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Database className="h-4 w-4" />
          <span>数据与本地存储 (Data Management)</span>
        </div>

        <div className="rounded-2xl bg-black/5 p-4 dark:bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 opacity-70" />
              <div>
                <p className="text-xs font-medium">本地存储空间</p>
                <p className="mt-1 text-[11px] opacity-60">
                  {storageInfo.supported
                    ? `${formatBytes(storageInfo.usage)} / ${formatBytes(storageInfo.quota)}`
                    : '当前浏览器不支持存储空间统计'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={updateStorageEstimate}
              className="rounded-full p-2 opacity-60 transition-opacity hover:opacity-100"
              title="刷新存储空间统计"
              aria-label="刷新存储空间统计"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {storageInfo.supported && storageInfo.quota > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-black transition-all dark:bg-white"
                style={{ width: `${Math.max(storagePercent, 0.5)}%` }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <button
            type="button"
            onClick={exportDatabase}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
          >
            <Download className="h-4 w-4" />
            导出全部数据
          </button>

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 rounded-xl bg-black/5 px-4 py-3 font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
          >
            <Upload className="h-4 w-4" />
            导入备份文件
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() =>
              setConfirmDialog({
                type: 'clear-images',
                title: '清理本地图片',
                description:
                  '将移除置顶图集内保存的所有图片数据，但会保留图集标题与文字说明。此操作无法撤销。',
                confirmLabel: '清理图片',
                danger: false,
              })
            }
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 rounded-xl bg-black/5 px-4 py-3 font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
          >
            <ImageOff className="h-4 w-4" />
            清理图片缓存
          </button>

          <button
            type="button"
            onClick={() =>
              setConfirmDialog({
                type: 'factory-reset',
                title: '恢复出厂状态',
                description:
                  '将永久清空角色、消息、图集、日记、旅行、待办与全部设置。建议先导出备份。此操作无法撤销。',
                confirmLabel: '永久清空全部数据',
                danger: true,
              })
            }
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-4 py-3 font-semibold text-rose-700 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
            格式化本地数据
          </button>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs opacity-60">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>正在处理本地数据，请勿关闭页面。</span>
          </div>
        )}

        {dataStatus.message && (
          <div
            className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
              dataStatus.type === 'error'
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {dataStatus.type === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{dataStatus.message}</span>
          </div>
        )}
      </GlassCard>

      <div className="space-y-2 pt-4 text-center text-xs opacity-40">
        <p className="font-mono">by shadow</p>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-confirm-title"
            className="w-full max-w-sm rounded-[2rem] border border-white/20 bg-white p-6 shadow-2xl dark:bg-neutral-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className={`rounded-2xl p-3 ${
                  confirmDialog.danger
                    ? 'bg-rose-500/10 text-rose-600'
                    : 'bg-black/5 text-black dark:bg-white/10 dark:text-white'
                }`}
              >
                {confirmDialog.danger ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <Database className="h-5 w-5" />
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmDialog(null);
                  setPendingImport(null);
                }}
                className="rounded-full p-1.5 opacity-50 transition-opacity hover:opacity-100"
                aria-label="关闭确认窗口"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h2 id="settings-confirm-title" className="mt-5 text-base font-bold">
              {confirmDialog.title}
            </h2>

            <p className="mt-2 text-xs leading-6 opacity-65">
              {confirmDialog.description}
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog(null);
                  setPendingImport(null);
                }}
                className="flex-1 rounded-xl bg-black/5 px-4 py-3 text-xs font-semibold transition-transform active:scale-[0.98] dark:bg-white/10"
              >
                取消
              </button>

              <button
                type="button"
                onClick={runConfirmedAction}
                className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold transition-transform active:scale-[0.98] ${
                  confirmDialog.danger
                    ? 'bg-rose-600 text-white'
                    : 'bg-black text-white dark:bg-white dark:text-black'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
