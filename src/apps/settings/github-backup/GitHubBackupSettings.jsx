import React, { useState, useEffect } from 'react';
import {
  Key,
  HardDrive,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Save,
} from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import ConfirmModal from '../../../components/ConfirmModal';
import { triggerGlobalToast } from '../../../components/NotificationToast';
import {
  getGitHubConfig,
  saveGitHubConfig,
  testGitHubConnection,
  backupToGitHub,
  restoreFromGitHub,
} from './githubBackupService';

export const GitHubBackupSettings = () => {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [path, setPath] = useState('backups/when-i-with-u.json');

  const [lastTime, setLastTime] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);

  const [isTesting, setIsTesting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [localMessage, setLocalMessage] = useState({ type: 'idle', text: '' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const config = await getGitHubConfig();
        if (config.token) {
          setToken('••••••••••••••••');
        }
        setOwner(config.owner);
        setRepo(config.repo);
        setBranch(config.branch);
        setPath(config.path);
        setLastTime(config.lastTime);
        setLastStatus(config.lastStatus);
      } catch (error) {
        console.error('Failed to load GitHub backup config:', error);
      }
    };
    init();
  }, []);

  const showStatus = (type, text) => {
    setLocalMessage({ type, text });
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        setLocalMessage((prev) => (prev.text === text ? { type: 'idle', text: '' } : prev));
      }, 5000);
    }
  };

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    showStatus('info', '正在校验 GitHub 仓库连接…');

    try {
      await testGitHubConnection(token, owner, repo);
      await saveGitHubConfig({
        token,
        owner,
        repo,
        branch,
        path,
      });

      if (token && token !== '••••••••••••••••') {
        setToken('••••••••••••••••');
      }

      showStatus('success', '云端验证已通过，配置已妥善保存。');
      triggerGlobalToast({
        title: '同步通道开启',
        content: '与 GitHub 存储库的连通性测试已成功建立。',
        iconType: 'bell',
      });
    } catch (error) {
      showStatus('error', error.message || '配置校验失败');
    } finally {
      setIsTesting(false);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    showStatus('info', '正在打包并同步本地记忆至 GitHub…');

    try {
      const nowTime = await backupToGitHub();
      setLastTime(nowTime);
      setLastStatus('success');
      showStatus('success', '记忆存档上传成功。');
      triggerGlobalToast({
        title: '云端备份完成',
        content: '本地数字资产已在个人仓库保存成功。',
        iconType: 'bell',
      });
    } catch (error) {
      showStatus('error', error.message || '备份失败，请核查配置');
      setLastStatus('error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreNow = async () => {
    setConfirmDialog(null);
    setIsRestoring(true);
    showStatus('info', '正在下载云端副本并重塑本地记忆…');

    try {
      await restoreFromGitHub();
      showStatus('success', '恢复就绪。请刷新页面以重载完整设定。');
      triggerGlobalToast({
        title: '云端记忆重塑',
        content: '数据库重构已全部完成，请手动刷新页面。',
        iconType: 'bell',
      });
    } catch (error) {
      showStatus('error', error.message || '恢复过程出错，导入已终止');
    } finally {
      setIsRestoring(false);
    }
  };

  const formatLastTime = (isoString) => {
    if (!isoString) return '从未同步';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '错误的时间格式';
    }
  };

  const isBusy = isTesting || isBackingUp || isRestoring;

  return (
    <GlassCard className="space-y-5 text-left">
      <div className="flex items-center gap-2 text-sm font-bold">
        <HardDrive className="h-4 w-4" />
        <span>记忆的云端抽屉 (GitHub Sync)</span>
      </div>

      <p className="text-[11px] leading-relaxed opacity-60">
        通过建立 GitHub
        私有存储库，将所有本地角色、对话与痕迹留档备份。数据仅在您与个人仓库之间安全流转。
      </p>

      <div className="space-y-3.5 text-xs">
        <div>
          <label className="mb-1 block font-medium opacity-70">GitHub Access Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isBusy}
            placeholder="填写 Fine-grained Personal Access Token"
            className="w-full rounded-xl bg-black/5 p-3 outline-none transition-all focus:bg-black/10 dark:bg-white/10 dark:focus:bg-white/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-medium opacity-70">Owner (用户名)</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              disabled={isBusy}
              placeholder="例如：shadow"
              className="w-full rounded-xl bg-black/5 p-3 outline-none transition-all focus:bg-black/10 dark:bg-white/10 dark:focus:bg-white/15"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium opacity-70">Repository (仓库名)</label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              disabled={isBusy}
              placeholder="例如：my-memories"
              className="w-full rounded-xl bg-black/5 p-3 outline-none transition-all focus:bg-black/10 dark:bg-white/10 dark:focus:bg-white/15"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="mb-1 block font-medium opacity-70">Branch (分支)</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={isBusy}
              className="w-full rounded-xl bg-black/5 p-3 outline-none transition-all focus:bg-black/10 dark:bg-white/10 dark:focus:bg-white/15"
            />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block font-medium opacity-70">File Path (保存路径)</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={isBusy}
              className="w-full rounded-xl bg-black/5 p-3 outline-none transition-all focus:bg-black/10 dark:bg-white/10 dark:focus:bg-white/15"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5">
        <div className="text-[11px]">
          <p className="opacity-50">上一次云端同步时间</p>
          <p className="mt-0.5 font-mono font-medium">
            {formatLastTime(lastTime)}
            {lastStatus === 'success' && (
              <span className="ml-1.5 text-emerald-500 font-sans font-normal">连接正常</span>
            )}
            {lastStatus === 'error' && (
              <span className="ml-1.5 text-rose-500 font-sans font-normal">阻断</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAndTest}
          disabled={isBusy || !owner || !repo || !token}
          className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2.5 font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {isTesting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>保存并验证</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          onClick={handleBackupNow}
          disabled={isBusy || !owner || !repo}
          className="flex items-center justify-center gap-2 rounded-xl bg-black/5 py-3 font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10"
        >
          {isBackingUp ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          立即备份到云端
        </button>

        <button
          type="button"
          onClick={() => {
            setConfirmDialog({
              title: '从云端同步重构',
              description:
                '将拉取 GitHub 最新备份数据覆盖当前数据库。此操作将抹去设备上所有的本地记录，请确认备份链的完整性。',
            });
          }}
          disabled={isBusy || !owner || !repo}
          className="flex items-center justify-center gap-2 rounded-xl bg-black/5 py-3 font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10"
        >
          {isRestoring ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          从云端副本恢复
        </button>
      </div>

      {localMessage.text && (
        <div
          className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
            localMessage.type === 'error'
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : localMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-black/5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'
          }`}
        >
          {localMessage.type === 'error' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : localMessage.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          )}
          <span>{localMessage.text}</span>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.description || ''}
        confirmText="确定覆盖"
        cancelText="放弃"
        onConfirm={handleRestoreNow}
        onCancel={() => setConfirmDialog(null)}
      />
    </GlassCard>
  );
};

export default GitHubBackupSettings;
