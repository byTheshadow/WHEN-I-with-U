import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft, RefreshCw, ChevronRight, Trash2 } from 'lucide-react';
import db from '../../../db';
import { checkAndTriggerParallelOrbit } from '../../../services/parallelOrbitService';

export default function ParallelOrbit({ chatId, character, onBack }) {
  const [logs, setLogs] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [triggerStatus, setTriggerStatus] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 格式化日期显示
  const formatNotebookDate = (timestamp) => {
    const d = new Date(timestamp);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const weekDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    const month = months[d.getMonth()];
    const date = d.getDate();
    const day = weekDays[d.getDay()];
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return {
      dateStr: `${month} ${date} / ${day}`,
      timeStr: `${hours}:${minutes}`
    };
  };

  const loadLogs = async () => {
    try {
      const data = await db.parallelOrbits
        .where('chatId')
        .equals(chatId)
        .sortBy('timestamp');

      const sortedData = data.reverse();
      setLogs(sortedData);
      setActiveIndex(0);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('加载平行轨迹失败:', err);
    }
  };

 const handleGenerate = async ({
  forceGenerate = false,
  source = 'page-open'
} = {}) => {
  setIsLoading(true);
  setErrorMsg('');

  try {
    const result = await checkAndTriggerParallelOrbit(chatId, {
      forceGenerate,
      source
    });

    setTriggerStatus(result.status);

    if (result.status === 'success' || result.status === 'backfill_success') {
      await loadLogs();
      return;
    }

    if (result.status === 'active_chatting') {
      setErrorMsg('对方当前正专注于与你的聊天中，独处轨迹暂时不会更新。');
      return;
    }

    if (
      (result.status === 'cooldown' || result.status === 'backfill_cooldown') &&
      !forceGenerate
    ) {
      setErrorMsg('这一页刚刚记录过，对方正在继续自己的日常。');
      return;
    }

    if (result.status === 'backfill_not_needed') {
      return;
    }

    if (result.status === 'no_user_activity') {
      setErrorMsg('从一段对话开始后，这里会逐渐留下对方独处时的生活切片。');
      return;
    }

    if (result.status === 'error') {
      setErrorMsg(`记录失败：${result.error}`);
    }
  } catch (err) {
    setErrorMsg(`生成出错：${err.message}`);
  } finally {
    setIsLoading(false);
  }
};


  const handleDeleteActiveLog = async () => {
    if (!activeLog) return;

    try {
      await db.parallelOrbits.delete(activeLog.id);

      const updatedLogs = logs.filter((log) => log.id !== activeLog.id);
      setLogs(updatedLogs);
      setShowDeleteConfirm(false);
      setActiveIndex(0);
    } catch (err) {
      console.error('删除日常轨迹失败:', err);
      setErrorMsg('删除失败，请稍后重试。');
    }
  };

useEffect(() => {
  loadLogs();

  // 页面打开时自检：
  // - 超过 10 小时未聊天：按真实时间段补写有限历史记录；
  // - 正常独处超过 10 分钟且冷却结束：生成一条此刻轨迹；
  // - 正在密集聊天或刚生成过：不重复生成。
  handleGenerate({
    forceGenerate: false,
    source: 'page-open'
  });
}, [chatId]);


  const renderRichText = (text) => {
    if (!text) return '';

    const parts = text.split(/(<s>.*?<\/s>|~~.*?~~)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('<s>') && part.endsWith('</s>')) {
        const clean = part.replace(/<\/?s>/g, '');

        return (
          <span key={idx} className="line-through opacity-30 italic px-0.5">
            {clean}
          </span>
        );
      }

      if (part.startsWith('~~') && part.endsWith('~~')) {
        const clean = part.replace(/~~/g, '');

        return (
          <span key={idx} className="line-through opacity-30 italic px-0.5">
            {clean}
          </span>
        );
      }

      return part;
    });
  };

  const parseActivityText = (text) => {
    if (!text) return [];

    const lines = text.split('\n');
    const parsedElements = [];
    let currentSceneDialogues = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) return;

      const dialogueMatch = trimmed.match(/^([^：:\s]{1,10})\s*[：:]\s*(.*)$/);

      if (dialogueMatch) {
        const speaker = dialogueMatch[1];
        const content = dialogueMatch[2];

        currentSceneDialogues.push({
          speaker,
          content,
          key: index
        });
      } else {
        if (currentSceneDialogues.length > 0) {
          parsedElements.push({
            type: 'scene',
            dialogues: [...currentSceneDialogues],
            key: `scene-${index}`
          });

          currentSceneDialogues = [];
        }

        if (
          (trimmed.startsWith('（') && trimmed.endsWith('）')) ||
          (trimmed.startsWith('(') && trimmed.endsWith(')'))
        ) {
          parsedElements.push({
            type: 'note',
            text: trimmed,
            key: index
          });
        } else {
          parsedElements.push({
            type: 'paragraph',
            text: trimmed,
            key: index
          });
        }
      }
    });

    if (currentSceneDialogues.length > 0) {
      parsedElements.push({
        type: 'scene',
        dialogues: currentSceneDialogues,
        key: 'scene-final'
      });
    }

    return parsedElements;
  };

  const activeLog = logs[activeIndex];
  const formattedActive = activeLog ? formatNotebookDate(activeLog.timestamp) : null;

  return (
    <div
      className="parallel-orbit-page-enter flex flex-col h-full w-full max-w-[420px] mx-auto overflow-hidden font-sans"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)'
      }}
    >
      <style>{`
        @keyframes orbit-page-enter {
          from {
            opacity: 0;
            transform: translateX(18px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes orbit-fade-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes orbit-line-reveal {
          from {
            opacity: 0;
            transform: scaleX(0);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes orbit-visual-reveal {
          from {
            opacity: 0;
            clip-path: inset(0 100% 0 0);
          }
          to {
            opacity: 1;
            clip-path: inset(0 0 0 0);
          }
        }

        .parallel-orbit-page-enter {
          animation: orbit-page-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .parallel-orbit-masthead {
          animation: orbit-fade-up 500ms cubic-bezier(0.22, 1, 0.36, 1) 100ms both;
        }

        .parallel-orbit-weather {
          transform-origin: left center;
          animation: orbit-line-reveal 460ms cubic-bezier(0.22, 1, 0.36, 1) 180ms both;
        }

        .parallel-orbit-entry-meta {
          animation: orbit-fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) 230ms both;
        }

        .parallel-orbit-article {
          animation: orbit-fade-up 460ms cubic-bezier(0.22, 1, 0.36, 1) 290ms both;
        }

        .parallel-orbit-visual {
          animation: orbit-visual-reveal 600ms cubic-bezier(0.22, 1, 0.36, 1) 350ms both;
        }

        .parallel-orbit-quote {
          animation: orbit-fade-up 460ms cubic-bezier(0.22, 1, 0.36, 1) 410ms both;
        }

        .parallel-orbit-notes {
          animation: orbit-fade-up 460ms cubic-bezier(0.22, 1, 0.36, 1) 470ms both;
        }

        @media (prefers-reduced-motion: reduce) {
          .parallel-orbit-page-enter,
          .parallel-orbit-masthead,
          .parallel-orbit-weather,
          .parallel-orbit-entry-meta,
          .parallel-orbit-article,
          .parallel-orbit-visual,
          .parallel-orbit-quote,
          .parallel-orbit-notes {
            animation: none !important;
          }
        }
      `}</style>

      <header
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--card-border)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          style={{
            border: '1px solid var(--card-border)',
            color: 'var(--text-main)'
          }}
          aria-label="返回聊天"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="text-[9px] font-mono tracking-[0.2em] opacity-60 uppercase">
          PRIVATE ISSUE <strong>NO. {String(logs.length - activeIndex).padStart(3, '0')}</strong>
        </div>

        <button
          type="button"
         onClick={() => handleGenerate({
  forceGenerate: true,
  source: 'manual'
})}

          disabled={isLoading}
          className="flex items-center justify-center p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-40"
          style={{
            border: '1px solid var(--card-border)',
            color: 'var(--text-main)'
          }}
          aria-label="生成新轨迹"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <section
          className="parallel-orbit-masthead px-5 py-7 border-b-2"
          style={{ borderColor: 'var(--text-main)' }}
        >
          <div className="flex justify-between items-center text-[9px] font-mono tracking-wider opacity-60 uppercase mb-4">
            <span>Parallel Orbit</span>
            <span>关于一个人未被看见的时间</span>
          </div>

          <h1
            className="text-4xl font-extrabold tracking-tighter leading-[0.88] uppercase font-serif"
            style={{ fontSize: 'clamp(32px, 10vw, 48px)' }}
          >
            THE
            <br />
            ORDINARY
            <br />
            HOURS
          </h1>

          <p className="mt-3 text-[10px] font-mono tracking-wider opacity-60 uppercase">
            {character.name}的私人生活切片 / 仅供翻阅
          </p>
        </section>

        {activeLog ? (
          <div key={activeLog.id} className="parallel-orbit-article">
            <section
              className="parallel-orbit-weather grid grid-cols-[1fr_auto] gap-4 px-5 py-4 border-b text-xs"
              style={{
                borderColor: 'var(--card-border)',
                background: 'var(--control-soft-bg)'
              }}
            >
              <div>
                <span className="block text-[9px] font-mono tracking-wider opacity-50 uppercase mb-1">
                  Outside / Weather
                </span>

                <div className="font-serif text-[14px] leading-relaxed opacity-95">
                  {activeLog.weather}
                </div>
              </div>

              <div className="text-right font-mono text-[10px] leading-relaxed opacity-60 self-end">
                {formattedActive.timeStr}
                <br />
                OBSERVATION
              </div>
            </section>

            <div className="px-5 py-7 space-y-6">
              <div
                className="parallel-orbit-entry-meta flex items-end gap-3 pb-4 border-b"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div className="text-5xl font-extrabold font-serif tracking-tighter leading-none opacity-90">
                  {formattedActive.timeStr}
                </div>

                <div className="pb-0.5">
                  <div className="text-xs font-bold leading-tight">{activeLog.location}</div>
                  <div className="text-[9px] font-mono tracking-wider opacity-50 uppercase mt-0.5">
                    {formattedActive.dateStr}
                  </div>
                </div>
              </div>

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
                      onClick={() => handleGenerate({
  forceGenerate: true,
  source: 'manual'
})}

                      className="mt-1.5 text-[9px] font-bold uppercase tracking-wider underline opacity-90 block hover:opacity-100"
                    >
                      Force Update / 强制同步日常
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-6">
                {parseActivityText(activeLog.activity).map((element, idx) => {
                  if (element.type === 'paragraph') {
                    const isFirstParagraph = idx === 0;

                    if (
                      isFirstParagraph &&
                      typeof element.text === 'string' &&
                      element.text.length > 0
                    ) {
                      const firstChar = element.text.charAt(0);
                      const restText = element.text.slice(1);

                      return (
                        <p
                          key={element.key}
                          className="text-[13px] font-serif leading-loose text-justify opacity-90"
                        >
                          <span
                            className="float-left text-4xl font-bold font-serif leading-[0.8] mr-1.5 mt-1"
                            style={{ color: 'var(--accent-color, #8a4c3d)' }}
                          >
                            {firstChar}
                          </span>

                          {renderRichText(restText)}
                        </p>
                      );
                    }

                    return (
                      <p
                        key={element.key}
                        className="text-[13px] font-serif leading-loose text-justify opacity-90"
                      >
                        {renderRichText(element.text)}
                      </p>
                    );
                  }

                  if (element.type === 'note') {
                    return (
                      <p
                        key={element.key}
                        className="text-[11px] font-serif italic leading-relaxed opacity-60 pl-2"
                      >
                        {renderRichText(element.text)}
                      </p>
                    );
                  }

                  if (element.type === 'scene') {
                    return (
                      <section
                        key={element.key}
                        className="grid grid-cols-[45px_1fr] gap-3 py-4 border-y"
                        style={{ borderColor: 'var(--card-border)' }}
                      >
                        <div className="font-mono text-[9px] tracking-wider uppercase opacity-60 pt-0.5">
                          SCENE
                        </div>

                        <div className="space-y-2 min-w-0">
                          {element.dialogues.map((dlg) => (
                            <div
                              key={dlg.key}
                              className="grid grid-cols-[55px_1fr] gap-2 text-xs leading-relaxed"
                            >
                              <span className="font-mono text-[9px] uppercase opacity-50 tracking-wider pt-0.5 truncate">
                                {dlg.speaker}
                              </span>

                              <span className="opacity-95 font-sans text-justify">
                                {renderRichText(dlg.content)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  return null;
                })}
              </div>

              {activeLog.cutout && activeLog.cutout !== '一片空白' && (
                <div
                  className="parallel-orbit-visual relative min-height-[140px] p-4 border flex flex-col justify-end overflow-hidden"
                  style={{
                    borderColor: 'var(--text-main)',
                    background: 'var(--control-soft-bg)'
                  }}
                >
                  <span className="absolute top-3 left-4 text-[8px] font-mono tracking-widest opacity-40 uppercase">
                    OBSERVATION / 01
                  </span>

                  <p className="text-xs italic leading-relaxed font-serif opacity-75 max-w-[85%] mt-8">
                    {activeLog.cutout}
                  </p>
                </div>
              )}

              {activeLog.thoughts && (
                <div
                  className="parallel-orbit-quote py-2 pl-4 border-l-2"
                  style={{ borderColor: 'var(--accent-color, var(--text-main))' }}
                >
                  <blockquote className="m-0 font-serif text-[18px] italic leading-snug opacity-95 text-justify">
                    “ {renderRichText(activeLog.thoughts)} ”
                  </blockquote>

                  <cite className="block mt-2 font-mono text-[8px] tracking-widest opacity-45 uppercase not-italic">
                    Personal note / 未寄出的念头
                  </cite>
                </div>
              )}

              <div
                className="parallel-orbit-notes grid grid-cols-2 gap-[1px] border"
                style={{
                  borderColor: 'var(--card-border)',
                  background: 'var(--card-border)'
                }}
              >
                <div className="p-3" style={{ background: 'var(--bg-main)' }}>
                  <span className="block text-[8px] font-mono tracking-wider opacity-40 uppercase mb-1">
                    Ambient sound
                  </span>

                  <p className="m-0 text-[11px] font-serif leading-snug opacity-75">
                    {activeLog.bgSound}
                  </p>
                </div>

                <div className="p-3" style={{ background: 'var(--bg-main)' }}>
                  <span className="block text-[8px] font-mono tracking-wider opacity-40 uppercase mb-1">
                    Sensory note
                  </span>

                  <p className="m-0 text-[11px] font-serif leading-snug opacity-75">
                    {activeLog.sensory}
                  </p>
                </div>
              </div>

              {/* 撕去此页面板，无原生弹窗，符合 Zine 排版调性 */}
              <div
                className="pt-6 border-t border-dashed flex flex-col items-end"
                style={{ borderColor: 'var(--card-border)' }}
              >
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono tracking-widest uppercase opacity-45 hover:opacity-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                    style={{ border: '1px solid var(--card-border)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Tear page / 撕去此页</span>
                  </button>
                ) : (
                  <div
                    className="w-full p-3 border flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono tracking-wider"
                    style={{
                      borderColor: 'var(--accent-color, #8a4c3d)',
                      background: 'var(--control-soft-bg)'
                    }}
                  >
                    <span className="opacity-80">
                      是否确定撕下并遗忘这一页轨迹？
                    </span>

                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleDeleteActiveLog}
                        className="px-2.5 py-1 text-white bg-red-600 hover:bg-red-700 font-bold uppercase rounded"
                        style={{ background: 'var(--accent-color, #8a4c3d)' }}
                      >
                        Confirm / 确认
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 uppercase rounded"
                        style={{ border: '1px solid var(--card-border)' }}
                      >
                        Cancel / 取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {logs.length > 1 && (
          <section
            className="px-5 pb-10 border-t-2"
            style={{ borderColor: 'var(--text-main)' }}
          >
            <div
              className="flex justify-between items-baseline py-3 border-b"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <h3 className="m-0 text-[9px] font-mono tracking-widest opacity-60 uppercase">
                Earlier fragments
              </h3>

              <span className="font-mono text-[9px] opacity-40">
                {logs.length - 1} ARCHIVED
              </span>
            </div>

            <div className="divide-y divide-[var(--card-border)]">
              {logs.map((log, idx) => {
                if (idx === activeIndex) return null;

                const { timeStr } = formatNotebookDate(log.timestamp);

                return (
                  <button
                    key={log.id}
                    onClick={() => {
                      setActiveIndex(idx);
                      setShowDeleteConfirm(false);

                      document
                        .querySelector('.flex-1')
                        ?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full flex items-center justify-between py-3 text-left transition-colors hover:opacity-80 animate-fade-in"
                    style={{
                      background: 'transparent',
                      border: 0
                    }}
                  >
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="font-mono text-[10px] opacity-40 shrink-0">
                        {timeStr}
                      </span>

                      <span className="font-serif text-xs truncate opacity-85 pr-4">
                        {log.activity.replace(/<[^>]*>/g, '').substring(0, 24)}...
                      </span>
                    </div>

                    <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <footer
        className="py-3 text-center text-[8px] font-mono tracking-[0.25em] opacity-40 border-t shrink-0"
        style={{ borderColor: 'var(--card-border)' }}
      >
        THE KINETIC ORBIT JOURNAL
      </footer>
    </div>
  );
}
