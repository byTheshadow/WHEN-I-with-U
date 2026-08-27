import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft, RefreshCw, PenTool, MapPin, Wind } from 'lucide-react';
import db from '../../../db';
import { checkAndTriggerParallelOrbit } from '../../../services/parallelOrbitService';

export default function ParallelOrbit({ chatId, character, onBack }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [triggerStatus, setTriggerStatus] = useState('');

  const loadLogs = async () => {
    try {
      const data = await db.parallelOrbits
        .where('chatId')
        .equals(chatId)
        .sortBy('timestamp');
      // 倒序排列，最新生成的日常在最上面，像翻开日记本最新的一页
      setLogs(data.reverse());
    } catch (err) {
      console.error('Failed to load parallel orbits:', err);
    }
  };

  const handleGenerate = async (force = false) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const result = await checkAndTriggerParallelOrbit(chatId, force);
      setTriggerStatus(result.status);
      if (result.status === 'success') {
        await loadLogs();
      } else if (result.status === 'active_chatting') {
        setErrorMsg('角色正专注于在聊天室里等待或回复你，独处日记暂时不会更新。');
      } else if (result.status === 'cooldown' && !force) {
        // 如果是冷却期，且不是强制生成，直接提示，但提供强制按钮
        setErrorMsg('他/她刚记录过生活不久，此时正在继续他的日常。');
      } else if (result.status === 'error') {
        setErrorMsg(`记录失败: ${result.error}`);
      }
    } catch (err) {
      setErrorMsg(`生成出错: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // 首次进入时静默自检一次（非强制，仅在符合条件时静默增加生活轨迹）
    handleGenerate(false);
  }, [chatId]);

  // 将带有 <s> 或被划掉格式的文字渲染为手绘涂抹样式
  const renderRichText = (text) => {
    if (!text) return '';
    // 将 <s> </s> 标签或 ~~ 转换为带有删除线类的 span
    const parts = text.split(/(<s>.*?<\/s>|~~.*?~~)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('<s>') && part.endsWith('</s>')) {
        const clean = part.replace(/<\/?s>/g, '');
        return <span key={idx} className="line-through decoration-double opacity-40 italic px-0.5">{clean}</span>;
      }
      if (part.startsWith('~~') && part.endsWith('~~')) {
        const clean = part.replace(/~~/g, '');
        return <span key={idx} className="line-through decoration-double opacity-40 italic px-0.5">{clean}</span>;
      }
      return part;
    });
  };

  // 格式化日期显示为手账感的日期
  const formatNotebookDate = (timestamp) => {
    const d = new Date(timestamp);
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    const year = d.getFullYear();
    const month = months[d.getMonth()];
    const date = d.getDate();
    const day = days[d.getDay()];
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${year}年 ${month}${date}日 (${day}) ${hours}:${minutes}`;
  };

  return (
    <div 
      className="flex flex-col h-full w-full max-w-[420px] mx-auto overflow-hidden animate-fade-in"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
        fontFamily: 'serif'
      }}
    >
      {/* 顶部手账牛皮纸标签栏 */}
      <header className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--card-border)' }}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-opacity hover:opacity-80"
          style={{ background: 'var(--control-soft-bg)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>合上日记</span>
        </button>

        <div className="text-[12px] font-bold tracking-widest font-mono opacity-80">
          PARALLEL ORBIT / 平行轨迹
        </div>

        <button
          type="button"
          onClick={() => handleGenerate(true)}
          disabled={isLoading}
          className="p-1.5 rounded-full transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
          title="探寻日常轨迹"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* 日记纸内容滚动区 */}
      <div 
        className="flex-1 overflow-y-auto p-5 space-y-8 no-scrollbar"
        style={{
          backgroundImage: 'linear-gradient(var(--bg-main) 96%, var(--divider) 96%)',
          backgroundSize: '100% 2rem',
          lineHeight: '2rem'
        }}
      >
        {/* 如果有 API 提示 */}
        {errorMsg && (
          <div 
            className="p-3 border rounded text-[11px] leading-relaxed transition-all"
            style={{ 
              background: 'var(--control-soft-bg)', 
              borderColor: 'var(--card-border)',
              fontFamily: 'sans-serif'
            }}
          >
            <p className="opacity-70">{errorMsg}</p>
            {triggerStatus === 'cooldown' && (
              <button
                onClick={() => handleGenerate(true)}
                className="mt-2 text-xs font-semibold underline opacity-90 block hover:opacity-100"
              >
                强制让角色写下一页日记
              </button>
            )}
          </div>
        )}

        {logs.length === 0 ? (
          <div className="py-20 text-center opacity-40 font-serif italic text-xs space-y-3">
            <BookOpen className="h-8 w-8 mx-auto stroke-[1.2] opacity-60 animate-pulse" />
            <p>这里目前是一本空白的手扎</p>
            <p className="text-[10px] sans-serif font-normal">点击右上角的笔刷探寻对方的生活轨迹...</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <article 
              key={log.id} 
              className="relative pl-6 border-l transition-all animate-fade-in-up"
              style={{ 
                borderColor: 'var(--card-border)',
                animationDelay: `${index * 50}ms`
              }}
            >
              {/* 时间轴节点标记 (铅笔短横线) */}
              <div 
                className="absolute -left-[6px] top-2 h-[11px] w-[11px] rounded-full border-2 bg-neutral-100 dark:bg-neutral-900"
                style={{ borderColor: 'var(--card-border)' }}
              />

              <div className="space-y-3 font-serif">
                {/* 顶端天气与气象氛围 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-400 font-mono tracking-wider">
                  <span className="flex items-center gap-1">
                    <Wind className="h-3 w-3 opacity-60" />
                    <span>{log.weather}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 opacity-60" />
                    <span>{log.location}</span>
                  </span>
                </div>

                {/* 铅笔手账日期 */}
                <time className="block text-[11px] font-sans font-bold tracking-tight opacity-50">
                  {formatNotebookDate(log.timestamp)}
                </time>

                {/* 记事正文 (可能带有NPC对话剧场) */}
                <div 
                  className="text-[12px] leading-6 tracking-wide text-neutral-700 dark:text-neutral-300 font-serif whitespace-pre-wrap pl-2 border-l-2 py-0.5"
                  style={{ borderColor: 'rgba(var(--accent-color-rgb, 120, 120, 120), 0.15)' }}
                >
                  {renderRichText(log.activity)}
                </div>

                {/* 心流独白 (略带倾斜度，模拟手写随感) */}
                {log.thoughts && (
                  <div 
                    className="p-3.5 rounded-xl border border-dashed text-[11px] leading-relaxed italic text-neutral-600 dark:text-neutral-400 font-serif shadow-inner rotate-[0.5deg]"
                    style={{ 
                      background: 'rgba(var(--accent-color-rgb, 120, 120, 120), 0.03)',
                      borderColor: 'var(--card-border)'
                    }}
                  >
                    <p className="font-semibold not-italic text-[10px] opacity-40 mb-1 font-mono tracking-widest">独白 / THOUGHTS</p>
                    {renderRichText(log.thoughts)}
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {/* 页脚手账线缝设计 */}
      <footer className="py-2.5 text-center text-[9px] font-mono tracking-widest opacity-30 border-t" style={{ borderColor: 'var(--card-border)' }}>
        PARALLEL ORBIT INCIDENT NOTEBOOK v1.0
      </footer>
    </div>
  );
}
