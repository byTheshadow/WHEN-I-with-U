import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import { triggerUpdateCheck, subscribeToUpdateStatus } from './AppUpdateManager';

export const AppUpdateSettings = () => {
  const [status, setStatus] = useState('idle'); // idle | checking | latest | available | error
  const [lastCheckTime, setLastCheckTime] = useState('');

  useEffect(() => {
    // 订阅全局 SW 状态变化，如果有可用更新，状态自动变更为 available
    const unsubscribe = subscribeToUpdateStatus((newStatus) => {
      if (newStatus === 'available') {
        setStatus('available');
      } else if (newStatus === 'latest') {
        setStatus('latest');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleManualCheck = async () => {
    setStatus('checking');
    const result = await triggerUpdateCheck();
    
    // 更新最后检查时间
    const now = new Date();
    setLastCheckTime(
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    );

    if (result.status === 'latest') {
      setStatus('latest');
    } else if (result.status === 'found') {
      setStatus('checking'); // 依然处于下载/等待状态中
    } else if (result.status === 'error' || result.status === 'unsupported') {
      setStatus('error');
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'checking':
        return '正在与 shadow 通讯，确认当前的布置...';
      case 'latest':
        return '您的布置已是最新';
      case 'available':
        return '发现有新物件已被 shadow 递交';
      case 'error':
        return '通讯有些受阻，可以稍后再试试';
      default:
        return lastCheckTime ? `上次确认于：${lastCheckTime}` : '随时可以确认 shadow 是否为您带回了新布置';
    }
  };

  return (
    <GlassCard className="p-4 space-y-4">
      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--card-border)' }}>
        <h3 className="font-serif text-sm font-medium" style={{ color: 'var(--text-main)' }}>
          布置版更新 (Update Control)
        </h3>
        {status === 'checking' && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs" style={{ color: 'var(--text-sub)' }}>
          {getStatusText()}
        </span>
        <span className="text-[10px] text-stone-400">
          基于本地沙盒数据库 PWA 架构。更新不破坏原本的聊天、日记及角色存档。
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={status === 'checking'}
          onClick={handleManualCheck}
          className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
          style={{
            color: 'var(--accent-foreground)',
            backgroundColor: 'var(--accent-color)',
            borderColor: 'var(--card-border)',
          }}
        >
          <RefreshCw className={`h-3 w-3 ${status === 'checking' ? 'animate-spin' : ''}`} />
          {status === 'checking' ? '通讯中' : '检查新布置'}
        </button>

        {status === 'available' && (
          <button
            type="button"
            onClick={() => {
              // 触发全局重载
              window.location.reload();
            }}
            className="rounded px-3 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 transition-all active:scale-95 animate-pulse"
          >
            立刻载入
          </button>
        )}
      </div>
    </GlassCard>
  );
};
