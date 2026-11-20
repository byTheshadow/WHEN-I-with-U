import React, { useEffect, useRef, useState } from 'react';
import { Music2, Play } from 'lucide-react';

import { ensureHarpAudio, playHarpNote } from './harpAudio';
import db from '../../db';
import { getNoteLabel, groupMelody } from './harpNotes';
import { saveHarpMelody } from './harpService';
import { DEFAULT_TIMBRE, normalizeTimbreId } from './harpTimbres';

// 星光小竖琴 —— 聊天记录里的旋律卡片。
// 用户弹给角色听（sender:'user'）和角色弹给用户听（sender:'character'）
// 共用这一张卡片。点卡片就按这段旋律的节奏把音再播一遍；这里没有竖琴
// 画布，所以只有声音和卡片上简谱的逐音高亮。颜色全部取自主题变量。
const HarpMelodyNotice = ({ message }) => {
  const meta = message?.metadata || {};
  const notes = Array.isArray(meta.notes) ? meta.notes : [];
  const delays = Array.isArray(meta.delays) ? meta.delays : [];
  const isUser = message?.sender !== 'character';
  // 重听用这条消息发出时记下的音色；没有记录的旧消息就是经典竖琴
  const timbre = normalizeTimbreId(meta.timbre) || DEFAULT_TIMBRE;
  const timersRef = useRef([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [saveState, setSaveState] = useState(meta.collected ? 'saved' : 'idle');

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
    },
    []
  );

  const handlePlay = () => {
    if (playing || !notes.length) return;
    if (!ensureHarpAudio()) return;

    setPlaying(true);
    let elapsed = 150;
    const timers = [];
    notes.forEach((note, k) => {
      // 间隔为 0 是和弦里同时响的音，所以不能用 "|| 400" 兜底
      elapsed += k === 0 ? 0 : Number.isFinite(delays[k]) ? delays[k] : 400;
      timers.push(
        setTimeout(() => {
          playHarpNote(note, timbre);
          setActiveIndex(k);
        }, elapsed)
      );
    });
    timers.push(
      setTimeout(() => {
        setActiveIndex(-1);
        setPlaying(false);
      }, elapsed + 900)
    );
    timersRef.current = timers;
  };

    // TA 弹的旋律可以收藏进这个聊天的收藏列表（createdBy:'character'）
  const handleCollect = async (event) => {
    event.stopPropagation();
    if (saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const saved = await saveHarpMelody({
        chatId: message.chatId,
        name: meta.name,
        notes,
        delays,
        createdBy: 'character',
        timbre,
      });
      if (saved && message?.id) {
        await db.messages.update(message.id, { metadata: { ...meta, collected: true } });
      }
      setSaveState(saved ? 'saved' : 'idle');
    } catch (error) {
      console.warn('[harp] 收藏TA的旋律失败:', error);
      setSaveState('idle');
    }
  };

  // 同时响的音（和弦）合成一格，例如 "5+↑1"；高亮时整格一起亮
  const groups = groupMelody(notes, delays);
  const score = groups.map((group) => group.map((k) => getNoteLabel(notes[k])).join('+'));
  const activeGroup = groups.findIndex((group) => group.includes(activeIndex));

  return (
    <div className={`my-2 flex ${isUser ? 'justify-end' : 'justify-start'} px-3`}>
      <button
        type="button"
        onClick={handlePlay}
        disabled={playing}
        aria-label={`播放旋律 ${meta.name || ''}`}
        className="max-w-[78%] rounded-2xl px-4 py-3 text-left"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
          cursor: playing ? 'default' : 'pointer',
        }}
      >
        <div
          className="flex items-center gap-2 text-[11px]"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}
        >
          <Music2 className="h-3.5 w-3.5" />
          <span>{isUser ? '星光小竖琴 · 你弹的' : '星光小竖琴 · TA 弹的'}</span>
        </div>
        <div className="mt-1 text-[15px]" style={{ color: 'var(--text-main)' }}>
          {meta.name || '无名旋律'}
        </div>
        <div
          className="mt-1 flex flex-wrap gap-x-2 text-[15px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '0.08em' }}
        >
          {score.map((token, k) => (
            <span
              key={k}
              style={{
                color: k === activeGroup ? 'var(--accent-color)' : 'var(--text-sub)',
                fontWeight: k === activeGroup ? 700 : 400,
                transition: 'color 0.15s',
              }}
            >
              {token}
            </span>
          ))}
        </div>
        <div
          className="mt-2 flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Play className="h-3 w-3" />
          <span>{playing ? '正在播放…' : '点一下再听一遍'}</span>
        </div>
           </button>
      {!isUser && (
        <button
          type="button"
          onClick={handleCollect}
          disabled={saveState !== 'idle'}
          className="ml-2 self-end rounded-full px-3 py-1 text-[11px]"
          style={{
            background: 'var(--control-soft-bg)',
            color: 'var(--text-sub)',
            border: '1px solid var(--card-border)',
            opacity: saveState === 'idle' ? 1 : 0.6,
          }}
        >
          {saveState === 'saved' ? '已收藏' : '收藏'}
        </button>
      )}
    </div>
  );
};

export default HarpMelodyNotice;