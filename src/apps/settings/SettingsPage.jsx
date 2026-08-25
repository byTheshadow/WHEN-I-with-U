import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  HardDrive,
  Heart,
  ImageOff,
  Key,
  Moon,
  Music,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import ConfirmModal from '../../components/ConfirmModal';
import DailyOfferingSettings from '../daily-offering/DailyOfferingSettings';
import GitHubBackupSettings from './github-backup/GitHubBackupSettings';

import db from '../../db';
import {
  getLockscreenQuotes,
  saveLockscreenQuotes,
  startLockscreenCompanion,
  stopLockscreenCompanion,
} from '../../services/lockscreenService';
import {
  generateBackupData,
  restoreBackupData,
} from '../../services/backupService';

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const SettingsPage = ({
  onBack,
  currentTheme,
  onChangeTheme,
  showTitle,
  onToggleTitle,
}) => {
  const importInputRef = useRef(null);
  const saveToastTimerRef = useRef(null);

  const [draftTheme, setDraftTheme] = useState(currentTheme);
  const [draftShowTitle, setDraftShowTitle] = useState(showTitle);

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

  const [lockscreenQuotes, setLockscreenQuotes] = useState([]);
  const [newQuoteInput, setNewQuoteInput] = useState('');
  const [isCompanionActive, setIsCompanionActive] = useState(false);

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

  const [saveStatus, setSaveStatus] = useState({
    type: 'idle',
    message: '',
  });

  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await db.settings.toArray();

        const settingMap = savedSettings.reduce((result, item) => {
          result[item.key] = item.value;
          return result;
        }, {});

        if (typeof settingMap.theme === 'string') {
          setDraftTheme(settingMap.theme);
        }

        if (typeof settingMap.showTitle === 'boolean') {
          setDraftShowTitle(settingMap.showTitle);
        }

        if (typeof settingMap.autoMessage === 'boolean') {
          setAutoMessage(settingMap.autoMessage);
        }

        if (typeof settingMap.frequency === 'string') {
          setFrequency(settingMap.frequency);
        }

        if (
          settingMap.quietHours &&
          typeof settingMap.quietHours === 'object'
        ) {
          setQuietHours((previous) => ({
            ...previous,
            ...settingMap.quietHours,
          }));
        }

        if (
          settingMap.apiConfig &&
          typeof settingMap.apiConfig === 'object'
        ) {
          setApiConfig((previous) => ({
            ...previous,
            ...settingMap.apiConfig,
          }));
        }

        const quotes = await getLockscreenQuotes();
        setLockscreenQuotes(quotes);
      } catch (error) {
        console.error('Unable to load settings:', error);
      }
    };

    loadSettings();
    updateStorageEstimate();

    return () => {
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
    };
  }, []);

  const hasUnsavedChanges =
    draftTheme !== currentTheme ||
    draftShowTitle !== showTitle ||
    autoMessage !== false ||
    frequency !== 'moderate' ||
    apiConfig.baseUrl !== '' ||
    apiConfig.apiKey !== '' ||
    apiConfig.model !== '';

  const showSaveResult = (type, message) => {
    setSaveStatus({ type, message });

    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
    }

    saveToastTimerRef.current = setTimeout(() => {
      setSaveStatus({ type: 'idle', message: '' });
    }, 2500);
  };

  const handleAddQuote = () => {
    const quote = newQuoteInput.trim();

    if (!quote) return;

    if (quote.length > 120) {
      showSaveResult('error', '单条锁屏台词请控制在 120 个字符以内。');
      return;
    }

    if (lockscreenQuotes.includes(quote)) {
      showSaveResult('error', '这条锁屏台词已存在。');
      return;
    }

    setLockscreenQuotes((previous) => [...previous, quote]);
    setNewQuoteInput('');
  };

  const handleEditQuote = (index, value) => {
    setLockscreenQuotes((previous) =>
      previous.map((quote, quoteIndex) =>
        quoteIndex === index ? value.slice(0, 120) : quote,
      ),
    );
  };

  const handleDeleteQuote = (index) => {
    setLockscreenQuotes((previous) =>
      previous.filter((_, quoteIndex) => quoteIndex !== index),
    );
  };

  const handleToggleCompanion = async () => {
    try {
      if (isCompanionActive) {
        stopLockscreenCompanion();
        setIsCompanionActive(false);
        showSaveResult('success', '锁屏陪伴已关闭。');
        return;
      }

      const character = await db.characters
        .filter((item) => item.isNpc !== true)
        .first();

      const started = await startLockscreenCompanion(character || null);

      if (started) {
        setIsCompanionActive(true);
        showSaveResult(
          'success',
          '锁屏陪伴已开启。请保持音频播放，系统才可能展示媒体卡片。',
        );
      } else {
        showSaveResult(
          'error',
          '无法启动锁屏陪伴。请在手机浏览器中通过点击按钮授权播放。',
        );
      }
    } catch (error) {
      console.error('Unable to toggle lockscreen companion:', error);
      showSaveResult('error', '锁屏陪伴启动失败，请稍后重试。');
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);

    try {
      const cleanQuotes = lockscreenQuotes
        .map((quote) => quote.trim())
        .filter(Boolean)
        .filter((quote, index, array) => array.indexOf(quote) === index);

      await db.transaction('rw', db.settings, async () => {
        await db.settings.bulkPut([
          { key: 'theme', value: draftTheme },
          { key: 'showTitle', value: draftShowTitle },
          { key: 'autoMessage', value: autoMessage },
          { key: 'frequency', value: frequency },
          { key: 'quietHours', value: quietHours },
          { key: 'apiConfig', value: apiConfig },
        ]);
      });

      await saveLockscreenQuotes(cleanQuotes);

      if (draftTheme !== currentTheme) {
        onChangeTheme(draftTheme);
      }

      if (draftShowTitle !== showTitle) {
        onToggleTitle();
      }

      showSaveResult('success', '配置保存成功。');
    } catch (error) {
      console.error('Unable to save all settings:', error);
      showSaveResult('error', '保存失败，请稍后重试。');
    } finally {
      setIsSaving(false);
    }
  };

  const testApiConnection = async () => {
    if (!apiConfig.baseUrl || !apiConfig.apiKey) {
      setApiStatus('error');
      return;
    }

    setApiStatus('testing');

    try {
      const cleanUrl = apiConfig.baseUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const resData = await response.json();
      const list = Array.isArray(resData.data)
        ? resData.data.map((item) => item.id)
        : [];

      setModels(list);
      setApiStatus('success');

      if (list.length > 0 && !list.includes(apiConfig.model)) {
        setApiConfig((previous) => ({
          ...previous,
          model: list[0],
        }));
      }
    } catch (error) {
      console.error('API connection failed:', error);
      setApiStatus('error');
    }
  };

  const exportDatabase = async () => {
    setIsProcessing(true);
    setDataStatus({ type: 'idle', message: '' });

    try {
      const backup = await generateBackupData();

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

      setDataStatus({
        type: 'success',
        message: '数据已安全导出到本地，请妥善保管导出的 JSON 文件。',
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

      if (!backup || backup.format !== 'when-i-with-u-backup' || !backup.data) {
        throw new Error('无效的备份数据结构');
      }

      setPendingImport(backup);
      setConfirmDialog({
        type: 'import',
        title: '恢复本地备份',
        description: '此操作将抹去设备上所有的本地记录并载入备份，确定载入？',
        confirmLabel: '载入备份',
        danger: false,
      });
    } catch (error) {
      console.error('Failed to read backup file:', error);
      setDataStatus({
        type: 'error',
        message: '无效的文件格式，解析失败。请重新确认备份文件合法。',
      });
    }
  };

  const importDatabase = async () => {
    setIsProcessing(true);
    setConfirmDialog(null);

    try {
      await restoreBackupData(pendingImport);

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
      await db.pinnedGallery.clear();
      await updateStorageEstimate();

      setDataStatus({
        type: 'success',
        message: '置顶图集中的图片数据已清理。',
      });
    } catch (error) {
      console.error('Failed to clear gallery images:', error);

      setDataStatus({
        type: 'error',
        message: '清理图片失败，请稍后重试。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const factoryReset = async () => {
    setIsProcessing(true);
    setConfirmDialog(null);

    try {
      stopLockscreenCompanion();
      setIsCompanionActive(false);

      await db.transaction(
        'rw',
        db.tables,
        async () => {
          await Promise.all(
            db.tables.map((table) => table.clear()),
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

  const storagePercent =
    storageInfo.quota > 0
      ? (storageInfo.usage / storageInfo.quota) * 100
      : 0;

  return (
    <div className="w-full space-y-6 pb-20 pt-4 text-xs">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full bg-black/5 p-2 transition-transform active:scale-90 dark:bg-white/5"
          aria-label="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="text-left">
          <h2 className="font-serif text-lg font-bold">设定空间 (Settings)</h2>
          <p className="text-[10px] opacity-60">调校你的空间与专属记忆</p>
        </div>
      </header>

      {/* 1. 主题与视觉设置 */}
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Palette className="h-4 w-4" />
          <span>视觉美学 (Theme Settings)</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-2 block opacity-60">空间底色 (Select Theme)</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'mono-mist', name: 'Mono Mist (水墨灰)' },
                { id: 'cream-latte', name: 'Cream Latte (奶油咖)' },
                { id: 'obsidian-dark', name: 'Obsidian (曜石黑)' },
                { id: 'rose-quartz', name: 'Quartz (暮色粉)' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setDraftTheme(theme.id)}
                  className={`rounded-xl py-3 font-medium transition-all ${
                    draftTheme === theme.id
                      ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                      : 'bg-black/5 dark:bg-white/10 hover:bg-black/10'
                  }`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/5">
            <div>
              <p className="font-medium">空间文学标题 (Space Title)</p>
              <p className="mt-0.5 text-[10px] opacity-50">
                决定是否在主页和各副应用上方悬挂本空间标题
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraftShowTitle(!draftShowTitle)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                draftShowTitle ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/20'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-black ${
                  draftShowTitle ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 2. 陪伴系统行为设定 */}
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sliders className="h-4 w-4" />
          <span>陪伴频率 (Interaction Behavior)</span>
        </div>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">日常自动偶发消息</p>
              <p className="mt-0.5 text-[10px] opacity-50">
                开启后，伴侣将不定期自发给你留信
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoMessage(!autoMessage)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                autoMessage ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/20'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-black ${
                  autoMessage ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {autoMessage && (
            <div className="space-y-3 border-t border-black/5 pt-3 dark:border-white/5 animate-fade-in-up">
              <div>
                <label className="mb-1 block opacity-60">触发频次阈值</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'quiet', name: '静寂' },
                    { id: 'moderate', name: '适中' },
                    { id: 'passionate', name: '热情' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setFrequency(level.id)}
                      className={`rounded-lg py-2 transition-all ${
                        frequency === level.id
                          ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                          : 'bg-black/5 dark:bg-white/10'
                      }`}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="opacity-60">设定勿扰时段</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuietHours((prev) => ({
                        ...prev,
                        enabled: !prev.enabled,
                      }))
                    }
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      quietHours.enabled ? 'bg-black dark:bg-white' : 'bg-black/10'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-black ${
                        quietHours.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {quietHours.enabled && (
                  <div className="mt-2 flex items-center gap-2 animate-fade-in-up">
                    <input
                      type="time"
                      value={quietHours.start}
                      onChange={(event) =>
                        setQuietHours((prev) => ({
                          ...prev,
                          start: event.target.value,
                        }))
                      }
                      className="rounded bg-black/5 p-1 dark:bg-white/10 outline-none text-[11px]"
                    />
                    <span className="opacity-50">至</span>
                    <input
                      type="time"
                      value={quietHours.end}
                      onChange={(event) =>
                        setQuietHours((prev) => ({
                          ...prev,
                          end: event.target.value,
                        }))
                      }
                      className="rounded bg-black/5 p-1 dark:bg-white/10 outline-none text-[11px]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* 3. 锁屏音频陪伴 */}
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Music className="h-4 w-4" />
          <span>锁屏台词陪伴 (Lockscreen Quotes)</span>
        </div>

        <p className="text-[11px] leading-relaxed opacity-60">
          通过锁屏时后台循环的极静环境音频，在手机锁屏时将你留下的回忆台词投送在通知媒体卡片上。
        </p>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between rounded-xl bg-black/5 p-3 dark:bg-white/5">
            <div>
              <p className="font-semibold">开启锁屏陪伴通道</p>
              <p className="mt-0.5 text-[10px] opacity-50">
                使用手机端浏览器时需授权音频播放
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleCompanion}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isCompanionActive ? 'bg-black dark:bg-white' : 'bg-black/10'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-black ${
                  isCompanionActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="space-y-2 border-t border-black/5 pt-3 dark:border-white/5">
            <label className="block font-medium opacity-65">自定义陪伴台词册 (至多120字)</label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="在锁屏卡片上留下他/她会对你说的话..."
                value={newQuoteInput}
                onChange={(event) => setNewQuoteInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAddQuote()}
                className="flex-1 rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10 text-xs"
              />
              <button
                type="button"
                onClick={handleAddQuote}
                className="rounded-xl bg-black px-4 font-semibold text-white transition-transform active:scale-95 dark:bg-white dark:text-black"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {lockscreenQuotes.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-xl border border-black/5 p-2 dark:border-white/5">
                {lockscreenQuotes.map((quote, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 py-1">
                    <input
                      type="text"
                      value={quote}
                      onChange={(event) => handleEditQuote(index, event.target.value)}
                      className="flex-1 bg-transparent font-medium outline-none focus:border-b focus:border-black/20 text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteQuote(index)}
                      className="rounded-full p-1 opacity-50 hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* 4. AI 连通设置 */}
      <GlassCard className="space-y-4 text-left">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Cpu className="h-4 w-4" />
          <span>AI 心灵连通 (Core Model Configuration)</span>
        </div>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block opacity-60">API Base URL</label>
            <input
              type="text"
              placeholder="e.g. https://api.openai.com/v1"
              value={apiConfig.baseUrl}
              onChange={(event) =>
                setApiConfig((previous) => ({
                  ...previous,
                  baseUrl: event.target.value,
                }))
              }
              className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
            />
          </div>

          <div>
            <label className="mb-1 block opacity-60">API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiConfig.apiKey}
              onChange={(event) =>
                setApiConfig((previous) => ({
                  ...previous,
                  apiKey: event.target.value,
                }))
              }
              className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
            />
          </div>

          {apiConfig.model && (
            <div>
              <label className="mb-1 block opacity-60">Model (当前使用)</label>
              <input
                type="text"
                placeholder="gpt-4o"
                value={apiConfig.model}
                onChange={(event) =>
                  setApiConfig((previous) => ({
                    ...previous,
                    model: event.target.value,
                  }))
                }
                className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-black/5 pt-3 dark:border-white/5">
            <button
              type="button"
              onClick={testApiConnection}
              disabled={apiStatus === 'testing' || !apiConfig.baseUrl || !apiConfig.apiKey}
              className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {apiStatus === 'testing' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>{apiStatus === 'testing' ? '正在连接' : '测试连通性'}</span>
            </button>

            {apiStatus === 'success' && (
              <span className="flex items-center gap-1 font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                连通正常
              </span>
            )}

            {apiStatus === 'error' && (
              <span className="flex items-center gap-1 font-semibold text-rose-500">
                <XCircle className="h-4 w-4" />
                连接失败
              </span>
            )}
          </div>

          {models.length > 0 && (
            <div>
              <label className="mb-1 block opacity-60">Select Model</label>

              <select
                value={apiConfig.model}
                onChange={(event) =>
                  setApiConfig((previous) => ({
                    ...previous,
                    model: event.target.value,
                  }))
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

      {/* 5. 今日留物设置组件（已装配） */}
      <DailyOfferingSettings />

      {/* 6. GitHub 备份云端抽屉组件（全新装配） */}
      <GitHubBackupSettings />

      {/* 7. 本地数据与存储卡片 */}
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

      <div className="sticky bottom-3 z-20 pt-2">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-4 text-sm font-semibold text-white shadow-xl transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          <span>{isSaving ? '正在保存…' : '保存设置'}</span>
        </button>
      </div>

      <div className="space-y-2 pt-2 text-center text-xs opacity-40">
        <p className="font-mono">by shadow</p>
      </div>

      {saveStatus.message && (
        <div
          className={`fixed left-1/2 top-10 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-3 text-xs font-medium shadow-2xl ${
            saveStatus.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {saveStatus.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}

          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* 统一为 ConfirmModal 组件以遵循全站交互哲学 */}
      <ConfirmModal
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.description || ''}
        confirmText={confirmDialog?.confirmLabel || '确定'}
        cancelText="取消"
        onConfirm={runConfirmedAction}
        onCancel={() => {
          setConfirmDialog(null);
          setPendingImport(null);
        }}
      />
    </div>
  );
};

export default SettingsPage;
