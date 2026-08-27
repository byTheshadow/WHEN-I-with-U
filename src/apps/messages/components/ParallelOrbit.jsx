import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft, RefreshCw, Compass, Eye, VolumeX } from 'lucide-react';
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
      setLogs(data.reverse());
    } catch (err) {
      console.error('加载平行轨迹失败:', err);
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
        setErrorMsg('对方当前正专注于与你的聊天中。独处轨迹暂时不会更新。');
      } else if (result.status === 'cooldown' && !force) {
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
    handleGenerate(false);
  }, [chatId]);

  const renderRichText = (text) => {
    if (!text) return '';
    const parts = text.split(/(<s>.*?<\/s>|~~.*?~~)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('<s>') && part.endsWith('</s>')) {
        const clean = part.replace(/<\/?s>/g, '');
        return <span key={idx} className="line-through decoration-1 opacity-35 px-0.5">{clean}</span>;
      }
      if (part.startsWith('~~') && part.endsWith('~~')) {
        const clean = part.replace(/~~/g, '');
        return <span key={idx} className="line-through decoration-1 opacity-35 px-0.5">{clean}</span>;
      }
      return part;
    });
  };

  const formatNotebookDate = (timestamp) => {
    const d = new Date(timestamp);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const date = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return {
      dateStr: `${month} ${date}`,
      timeStr: `${hours}:${minutes}`
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
      {/* 极简现代主义 Header */}
      <header 
        className="flex items-center justify-between px-6 py-4 border-b shrink-0" 
        style={{ borderColor: 'var(--card-border)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          style={{ border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="text-[10px] font-bold tracking-[0.25em] font-mono opacity-65 uppercase">
          Orbit / {character.name}
        </div>

        <button
          type="button"
          onClick={() => handleGenerate(true)}
          disabled={isLoading}
          className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-40"
          style={{ border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* 杂志排版滚动区 */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-12 no-scrollbar">
        {errorMsg && (
          <div 
            className="p-4 border rounded text-[11px] leading-relaxed transition-all font-mono"
            style={{ 
              background: 'var(--control-soft-bg)', 
              borderColor: 'var(--card-border)'
            }}
          >
            <p className="opacity-70">{errorMsg}</p>
            {triggerStatus === 'cooldown' && (
              <button
                onClick={() => handleGenerate(true)}
                className="mt-2 text-[10px] font-bold uppercase tracking-wider underline opacity-90 block hover:opacity-100"
              >
                Force Record / 强制记录
              </button>
            )}
          </div>
        )}

        {logs.length === 0 ? (
          <div className="py-32 text-center opacity-45 font-mono text-[10px] space-y-4 tracking-widest">
            <BookOpen className="h-6 w-6 mx-auto stroke-[1] opacity-50" />
            <p>EMPTY ORBIT JOURNAL</p>
            <p className="text-[9px] opacity-60">点击右上角探寻对方的生活轨迹</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const { dateStr, timeStr } = formatNotebookDate(log.timestamp);
            return (
              <article 
                key={log.id} 
                className="space-y-6 pt-4 border-t first:border-t-0 first:pt-0"
                style={{ borderColor: 'var(--card-border)' }}
              >
                {/* 1. 大字号现代主义时间标志 */}
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-extrabold tracking-tighter font-serif opacity-90">
                    {timeStr}
                  </span>
                  <span className="text-[10px] font-mono tracking-widest opacity-45">
                    {dateStr} // {log.weather || 'STABLE'}
                  </span>
                </div>

                {/* 2. 感官白噪音仪表栏 (Zine Sidebar) */}
                <div 
                  className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 px-4 border-y text-[10px] font-mono tracking-wide opacity-65"
                  style={{ borderColor: 'var(--card-border)', background: 'var(--control-soft-bg)' }}
                >
                  <div className="truncate">
                    <span className="opacity-40">LOC: </span>{log.location}
                  </div>
                  <div className="truncate">
                    <span className="opacity-40">SNS: </span>{log.sensory || 'NONE'}
                  </div>
                  <div className="truncate col-span-2">
                    <span className="opacity-40">SND: </span>{log.bgSound || 'AMBIENT SILENCE'}
                  </div>
                </div>

                {/* 3. 引言独白 (Pull Quote) */}
                {log.thoughts && (
                  <div className="relative py-2 pl-4 border-l-2" style={{ borderColor: 'var(--text-main)' }}>
                    <p className="text-xs font-serif italic leading-relaxed opacity-85 text-justify">
                      “ {renderRichText(log.thoughts)} ”
                    </p>
                  </div>
                )}

                {/* 4. 戏剧场景与日常记事 */}
                <div className="text-xs leading-relaxed opacity-80 font-sans tracking-wide text-justify whitespace-pre-wrap">
                  {renderRichText(log.activity)}
                </div>

                {/* 5. 画面速写黑白线框 (Graphic Cutout) */}
                {log.cutout && log.cutout !== '一片空白' && (
                  <div 
                    className="p-4 border border-dashed flex flex-col items-center justify-center text-center space-y-2 select-none"
                    style={{ borderColor: 'var(--card-border)', background: 'var(--bg-main)' }}
                  >
                    <span className="text-[9px] font-mono tracking-[0.2em] opacity-40 uppercase">
                      Visual / 画面速写
                    </span>
                    <p className="text-[10px] italic opacity-60 leading-relaxed font-serif max-w-[90%]">
                      {log.cutout}
                    </p>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      <footer 
        className="py-4 text-center text-[9px] font-mono tracking-[0.3em] opacity-35 border-t" 
        style={{ borderColor: 'var(--card-border)' }}
      >
        THE KINETIC ORBIT JOURNAL
      </footer>
    </div>
  );
}
