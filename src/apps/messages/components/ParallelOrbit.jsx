import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft, RefreshCw, Compass } from 'lucide-react';
import db from '../../../db';
import { checkAndTriggerParallelOrbit } from '../../../services/parallelOrbitService';

export default function ParallelOrbit({ chatId, character, onBack }) {
  const [logs, setLogs] = useState([]);
  const [activeLog, setActiveLog] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [triggerStatus, setTriggerStatus] = useState('');

  const loadLogs = async () => {
    try {
      const data = await db.parallelOrbits
        .where('chatId')
        .equals(chatId)
        .sortBy('timestamp');
      const sorted = data.reverse();
      setLogs(sorted);
      if (sorted.length > 0) {
        // 默认显示最新的一篇日常
        setActiveLog(sorted[0]);
      }
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
        setErrorMsg('对方当前正专注于与你的聊天中。独处随笔暂时不会更新。');
      } else if (result.status === 'cooldown' && !force) {
        setErrorMsg('他/她刚记录过生活不久，此时正在继续他的日常。');
      } else if (result.status === 'error') {
        setErrorMsg(`生成失败: ${result.error}`);
      }
    } catch (err) {
      setErrorMsg(`生成出错: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    handleGenerate(false);
  }, [chatId]);

  const renderRichText = (text) => {
    if (!text) return '';
    const parts = text.split(/(<s>.*?<\/s>|~~.*?~~)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('<s>') && part.endsWith('</s>')) {
        const clean = part.replace(/<\/?s>/g, '');
        return <span key={idx} className="line-through decoration-double opacity-30 italic px-0.5">{clean}</span>;
      }
      if (part.startsWith('~~') && part.endsWith('~~')) {
        const clean = part.replace(/~~/g, '');
        return <span key={idx} className="line-through decoration-double opacity-30 italic px-0.5">{clean}</span>;
      }
      return part;
    });
  };

  // 生成首字下沉的排版
  const renderLeadParagraph = (text) => {
    if (!text) return null;
    const cleanText = text.trim();
    const firstChar = cleanText.charAt(0);
    const restText = cleanText.slice(1);

    return (
      <p className="text-xs leading-relaxed tracking-wide text-justify whitespace-pre-wrap">
        <span 
          className="float-left text-[38px] font-semibold leading-[0.8] mr-2 mt-1 select-none font-serif"
          style={{ color: 'var(--accent-color, inherit)' }}
        >
          {firstChar}
        </span>
        {renderRichText(restText)}
      </p>
    );
  };

  const formatNotebookDate = (timestamp) => {
    const d = new Date(timestamp);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    
    return {
      monthStr: months[d.getMonth()],
      dateNum: d.getDate(),
      dayName: days[d.getDay()],
      timeStr: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    };
  };

  return (
    <div 
      className="flex flex-col h-full w-full max-w-[420px] mx-auto overflow-hidden animate-fade-in"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
      }}
    >
      {/* 顶部操作区 */}
      <header className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--card-border)' }}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          style={{ border: '1px solid var(--card-border)', color: 'var(--text-main)', background: 'var(--control-soft-bg)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="text-[9px] font-bold tracking-[0.2em] font-mono opacity-50 uppercase">
          PRIVATE ISSUE <strong>NO. {activeLog ? activeLog.issueNo || '001' : '---'}</strong>
        </div>

        <button
          type="button"
          onClick={() => handleGenerate(true)}
          disabled={isLoading}
          className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-40"
          style={{ border: '1px solid var(--card-border)', color: 'var(--text-main)', background: 'var(--control-soft-bg)' }}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* 杂志主版面滚动区 */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 no-scrollbar">
        
        {errorMsg && (
          <div 
            className="p-3 border rounded text-[10px] leading-relaxed font-mono"
            style={{ 
              background: 'var(--control-soft-bg)', 
              borderColor: 'var(--card-border)'
            }}
          >
            <p className="opacity-70">{errorMsg}</p>
            {triggerStatus === 'cooldown' && (
              <button
                onClick={() => handleGenerate(true)}
                className="mt-2 text-[9px] font-bold uppercase tracking-wider underline opacity-90 block hover:opacity-100"
              >
                Force Record / 强制记录
              </button>
            )}
          </div>
        )}

        {activeLog ? (
          <div className="space-y-6 animate-fade-in-up">
            
            {/* 1. 杂志刊头 */}
            <section className="pb-4 border-b-2" style={{ borderColor: 'var(--text-main)' }}>
              <div className="flex items-center justify-between text-[8px] font-mono tracking-widest opacity-50 uppercase">
                <span>Parallel Orbit</span>
                <span>关于未被看见的时间</span>
              </div>
              <h1 className="mt-4 font-serif text-[42px] font-bold leading-[0.9] tracking-tighter">
                THE<br />ORDINARY<br />HOURS
              </h1>
              <p className="mt-2 text-[9px] font-mono tracking-widest opacity-50 uppercase">
                {character.name}的私人生活切片 / 仅供翻阅
              </p>
            </section>

            {/* 2. 天气刊头新闻 */}
            <section 
              className="grid grid-cols-3 gap-4 p-4 border rounded text-xs leading-normal"
              style={{ 
                borderColor: 'var(--card-border)',
                background: 'var(--control-soft-bg)' 
              }}
            >
              <div className="col-span-2">
                <span className="block text-[8px] font-mono font-bold tracking-widest opacity-40 uppercase mb-1">
                  Outside / Weather
                </span>
                <p className="font-serif text-[13px] leading-relaxed opacity-85">
                  {activeLog.weather}
                </p>
              </div>
              <div className="text-right font-mono text-[9px] opacity-60 self-end">
                {activeLog.temperature}<br />
                {formatNotebookDate(activeLog.timestamp).timeStr}
              </div>
            </section>

            {/* 3. 时间与地点定位 */}
            <div className="flex items-end gap-3 pt-2">
              <span className="font-serif text-5xl font-semibold leading-none tracking-tighter">
                {formatNotebookDate(activeLog.timestamp).timeStr}
              </span>
              <div className="pb-0.5">
                <div className="text-[11px] font-semibold">{activeLog.location}</div>
                <div className="text-[8px] font-mono tracking-widest opacity-40 uppercase mt-0.5">
                  {formatNotebookDate(activeLog.timestamp).monthStr} {formatNotebookDate(activeLog.timestamp).dateNum} / {formatNotebookDate(activeLog.timestamp).dayName}
                </div>
              </div>
            </div>

            {/* 4. 专栏副标题与主文内容 */}
            <section className="space-y-4 pt-2">
              <div className="space-y-1">
                <span className="block text-[8px] font-mono tracking-widest opacity-40 uppercase">
                  A small daily report
                </span>
                <h2 className="font-serif text-xl font-medium tracking-tight opacity-90">
                  {activeLog.subtitle || '在属于个人的现实轨迹里。'}
                </h2>
              </div>

              <div className="w-10 h-[2px]" style={{ background: 'var(--accent-color, var(--text-main))' }} />

              {/* 记事正文 (首字下沉) */}
              <div className="font-serif">
                {renderLeadParagraph(activeLog.activity)}
              </div>
            </section>

            {/* 5. 画面速写 (Visual Cutout) */}
            {activeLog.cutout && activeLog.cutout !== '一片空白' && (
              <figure 
                className="relative min-h-[140px] flex items-end p-4 overflow-hidden border border-dashed rounded select-none"
                style={{ 
                  borderColor: 'var(--card-border)',
                  background: 'var(--control-soft-bg)'
                }}
              >
                <span className="absolute top-3 left-3 text-[8px] font-mono tracking-widest opacity-30">
                  OBSERVATION / {activeLog.issueNo || '001'}
                </span>
                <span 
                  className="absolute right-3 bottom-3 text-[8px] font-mono tracking-widest opacity-30" 
                  style={{ writingMode: 'vertical-rl' }}
                >
                  FIELD OBS
                </span>
                <figcaption className="relative z-10 max-w-[85%] font-serif text-[12px] italic opacity-70 leading-relaxed">
                  {activeLog.cutout}
                </figcaption>
              </figure>
            )}

            {/* 6. 心流独白 (Pull Quote) */}
            {activeLog.thoughts && (
              <section className="py-2 pl-4 border-l-[3px] my-6" style={{ borderColor: 'var(--accent-color, var(--text-main))' }}>
                <blockquote className="font-serif text-lg italic leading-relaxed opacity-90 text-justify">
                  “ {renderRichText(activeLog.thoughts)} ”
                </blockquote>
                <cite className="block mt-2 text-[8px] font-mono tracking-widest opacity-40 uppercase not-italic">
                  Personal note / 未寄出的念头
                </cite>
              </section>
            )}

            {/* 7. 仪表页边注 (Margin notes) */}
            <div className="grid grid-cols-2 gap-px border bg-neutral-200 dark:bg-neutral-800" style={{ borderColor: 'var(--card-border)' }}>
              <div className="p-3 space-y-1" style={{ background: 'var(--bg-main)' }}>
                <span className="block text-[8px] font-mono tracking-widest opacity-40 uppercase">Ambient sound</span>
                <p className="text-[10px] font-serif opacity-75">{activeLog.bgSound || '安静的天空下'}</p>
              </div>
              <div className="p-3 space-y-1" style={{ background: 'var(--bg-main)' }}>
                <span className="block text-[8px] font-mono tracking-widest opacity-40 uppercase">Sensory note</span>
                <p className="text-[10px] font-serif opacity-75">{activeLog.sensory || '指尖轻触微凉'}</p>
              </div>
            </div>

            {/* 8. 往期片段目录 (Earlier Fragments) */}
            {logs.length > 1 && (
              <section className="pt-6 border-t-2" style={{ borderColor: 'var(--text-main)' }}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-[10px] font-mono tracking-widest uppercase">Earlier fragments</h3>
                  <span className="text-[9px] font-mono opacity-40">{logs.length - 1} ARCHIVED</span>
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {logs.map((log) => {
                    if (log.id === activeLog.id) return null;
                    const dateInfo = formatNotebookDate(log.timestamp);
                    return (
                      <button
                        key={log.id}
                        onClick={() => setActiveLog(log)}
                        className="w-full flex items-center justify-between py-3 text-left hover:opacity-85 transition-opacity"
                      >
                        <span className="font-mono text-[9px] opacity-40 mr-3">{dateInfo.timeStr}</span>
                        <span className="flex-1 font-serif text-[11px] truncate pr-4">{log.subtitle || '生活的切片片段'}</span>
                        <span className="opacity-40 text-xs">→</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

          </div>
        ) : (
          <div className="py-24 text-center opacity-40 font-mono text-[10px] space-y-3 tracking-widest">
            <BookOpen className="h-6 w-6 mx-auto stroke-[1] opacity-60" />
            <p>EMPTY JOURNAL</p>
            <p className="text-[9px]">点击右上角笔刷探寻对方的生活轨迹...</p>
          </div>
        )}
      </div>

      <footer className="py-3 text-center text-[8px] font-mono tracking-widest opacity-35 border-t shrink-0" style={{ borderColor: 'var(--card-border)' }}>
        PARALLEL ORBIT / A RECORD OF INDEPENDENT HOURS
      </footer>
    </div>
  );
}
