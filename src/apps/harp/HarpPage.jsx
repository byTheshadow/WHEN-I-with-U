import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import db from '../../db';
import HarpCanvas from './HarpCanvas';
import HarpGuideModal from './HarpGuideModal';
import HarpTimbrePicker from './HarpTimbrePicker';
import { ensureHarpAudio, releaseHarpAudio, setHarpTimbre } from './harpAudio';
import { DEFAULT_TIMBRE, getTimbreLabel, normalizeTimbreId } from './harpTimbres';
import {
  MAX_MELODY_NOTES,
  MIN_PHRASE_NOTES,
  PHRASE_CLOSE_MS,
  buildMelodyFromPhrase,
  formatMelodyText,
  getPitch,
} from './harpNotes';
import { sendMelodyToCharacter } from './harpChatService';
import { deleteHarpMelody, getHarpMelodies, saveHarpMelody } from './harpService';
import './harp.css';

// ============================================================
// 星光小竖琴 —— 整页（聊天窗"更多入口"菜单进来，挂在这个聊天上）。
//
// Slice A：用户自己弹、自己收藏、自己重听。
// Slice B："弹给TA听"——刚弹的一段或收藏里的旋律，写成一条聊天消息，TA 立刻回应。
//   - 弹一段：停手 PHRASE_CLOSE_MS 之后算"一段"，至少 MIN_PHRASE_NOTES 个
//     音才能收藏。弹奏过程只存在这个组件的内存里，关掉页面就没了；只有点
//     "收藏"才会写进 harpMelodies。
//   - 还没有的（后面的切片）：角色自己弹给用户听。
//
// 版面跟温室/异地任务挑战同一个做法：没有整条顶栏，只有一个悬浮的圆形
// 返回按钮；颜色全部用 themes.css 的主题变量（见 harp.css 顶部的别名）。
// ============================================================

const PHRASE_PREVIEW_LIMIT = 16;
const GUIDE_SEEN_KEY = 'harpGuideSeen';

const HarpPage = ({ chatId, character, onBack }) => {
  const harpRef = useRef(null);
  const phraseRef = useRef([]);
  const closedRef = useRef(false);
  const playingRef = useRef(false);
  const closeTimerRef = useRef(null);
  const replayTimersRef = useRef([]);

  const [phrase, setPhrase] = useState([]);
  const [closed, setClosed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [melodies, setMelodies] = useState([]);
  const [nameDraft, setNameDraft] = useState('');
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [timbre, setTimbre] = useState(DEFAULT_TIMBRE);

  const characterName = character?.name || 'TA';

  // ---------- 收藏列表 ----------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const rows = await getHarpMelodies(chatId);
        if (!cancelled) setMelodies(rows);
      } catch (error) {
        console.warn('[harp] 读取收藏失败:', error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // ---------- 这个聊天选的音色（chat.harpTimbre，没选过就是经典竖琴） ----------
  useEffect(() => {
    let cancelled = false;
    setHarpTimbre(DEFAULT_TIMBRE);
    setTimbre(DEFAULT_TIMBRE);

    db.chats
      .get(chatId)
      .then((chat) => {
        if (cancelled) return;
        const id = normalizeTimbreId(chat?.harpTimbre) || DEFAULT_TIMBRE;
        setHarpTimbre(id);
        setTimbre(id);
      })
      .catch((error) => console.warn('[harp] 读取音色失败:', error));

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // ---------- 玩法说明：第一次进竖琴弹一次 ----------
  useEffect(() => {
    let cancelled = false;
    db.settings
      .get(GUIDE_SEEN_KEY)
      .then((row) => {
        if (!cancelled && !row) setShowGuide(true);
      })
      .catch((error) => console.warn('[harp] 读取说明状态失败:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const closeGuide = useCallback(() => {
    setShowGuide(false);
    db.settings
      .put({ key: GUIDE_SEEN_KEY, value: { seen: true, seenAt: new Date().toISOString() } })
      .catch((error) => console.warn('[harp] 保存说明状态失败:', error));
  }, []);

  const handleTimbreChange = useCallback(
    (id) => {
      const next = normalizeTimbreId(id) || DEFAULT_TIMBRE;
      setTimbre(next);
      setHarpTimbre(next);
      db.chats
        .update(chatId, { harpTimbre: next })
        .catch((error) => console.warn('[harp] 保存音色失败:', error));
    },
    [chatId]
  );

  // ---------- 页面卸载：清掉所有定时器，关掉音频 ----------
  useEffect(
    () => () => {
      clearTimeout(closeTimerRef.current);
      replayTimersRef.current.forEach((timer) => clearTimeout(timer));
      replayTimersRef.current = [];
      releaseHarpAudio();
    },
    []
  );

  // ---------- 弹奏记录 ----------
  const handlePluck = useCallback((index) => {
    if (playingRef.current) return;

    if (closedRef.current) {
      phraseRef.current = [];
      closedRef.current = false;
      setClosed(false);
    }

    const kept =
      phraseRef.current.length >= MAX_MELODY_NOTES
        ? phraseRef.current.slice(-(MAX_MELODY_NOTES - 1))
        : phraseRef.current;
    phraseRef.current = [...kept, { i: index, t: performance.now() }];
    setPhrase(phraseRef.current);
    setStatus('');

    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closedRef.current = true;
      setClosed(true);
    }, PHRASE_CLOSE_MS);
  }, []);

  // 键盘：数字 1-9 弹前九根弦，0 弹第十根（输入框里打字时不响应）
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      let index = -1;
      if (event.key === '0') index = 9;
      else if (event.key >= '1' && event.key <= '9') index = Number(event.key) - 1;
      if (index >= 0 && harpRef.current) harpRef.current.strum(index, 0.55);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleClear = () => {
    clearTimeout(closeTimerRef.current);
    phraseRef.current = [];
    closedRef.current = false;
    setPhrase([]);
    setClosed(false);
    setStatus('');
  };

  // ---------- 重听（琴弦自己亮起来，不记录、不收录进当前这一段） ----------
  const playSequence = (melody) => {
    if (playingRef.current || !melody?.notes?.length) return;

    ensureHarpAudio();
    playingRef.current = true;
    setPlaying(true);

    let elapsed = 300;
    const timers = [];
    melody.notes.forEach((note, k) => {
      // 间隔为 0 是和弦里同时响的音，所以不能用 "|| 400" 兜底
      const gap = melody.delays?.[k];
      elapsed += k === 0 ? 0 : Number.isFinite(gap) ? gap : 400;
      timers.push(
        setTimeout(() => {
          if (harpRef.current) {
            // 重听用这段旋律自己的音色；没记过音色的旧旋律就是经典竖琴
            // 4、7 两个音没有对应的弦：声音按它自己的音高发，画面点亮最近的一根弦
            const pitch = getPitch(note);
            if (!pitch) return;
            harpRef.current.pluck(
              pitch.light,
              0.5 + (Math.random() - 0.5) * 0.3,
              'user',
              normalizeTimbreId(melody.timbre) || DEFAULT_TIMBRE,
                           note,
              melody.tune
            );
          }
        }, elapsed)
      );
    });
    timers.push(
      setTimeout(() => {
        playingRef.current = false;
        setPlaying(false);
      }, elapsed + 1000)
    );
    replayTimersRef.current = timers;
  };

  // ---------- 收藏 / 删除 ----------
  const handleSave = async () => {
    if (isSaving || playingRef.current || phraseRef.current.length < MIN_PHRASE_NOTES) return;

    setIsSaving(true);
    try {
      clearTimeout(closeTimerRef.current);
      closedRef.current = true;
      setClosed(true);

      const melody = buildMelodyFromPhrase(phraseRef.current);
      const saved = await saveHarpMelody({
        chatId,
        name: nameDraft,
        notes: melody.notes,
        delays: melody.delays,
        createdBy: 'user',
        timbre,
      });

      if (saved) {
        setNameDraft('');
        setMelodies(await getHarpMelodies(chatId));
        setStatus(`已收藏「${saved.name}」`);
      }
    } catch (error) {
      console.warn('[harp] 收藏失败:', error);
      setStatus('收藏失败，请再试一次。');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- 弹给 TA 听 ----------
  const sendToCharacter = async (melody, label) => {
    if (isSending || playingRef.current) return;
    setIsSending(true);
    try {
      const sent = await sendMelodyToCharacter({ chatId, melody });
      setStatus(sent ? `已弹给 ${characterName} 听${label ? `：「${label}」` : ''}` : '发送失败，请再试一次。');
    } catch (error) {
      console.warn('[harp] 弹给TA听失败:', error);
      setStatus('发送失败，请再试一次。');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendPhrase = () => {
    if (phraseRef.current.length < MIN_PHRASE_NOTES) return;
    clearTimeout(closeTimerRef.current);
    closedRef.current = true;
    setClosed(true);
    const built = buildMelodyFromPhrase(phraseRef.current);
    void sendToCharacter({ ...built, name: nameDraft, timbre }, nameDraft.trim());
  };

  const handleDelete = async (id) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }

    setPendingDeleteId(null);
    try {
      await deleteHarpMelody(id);
      setMelodies(await getHarpMelodies(chatId));
    } catch (error) {
      console.warn('[harp] 删除失败:', error);
    }
  };

  // ---------- 渲染 ----------
  const count = phrase.length;
  const canSend = count >= MIN_PHRASE_NOTES && !playing;
  const trailText = count
    ? formatMelodyText(phrase.slice(-PHRASE_PREVIEW_LIMIT).map((event) => event.i))
    : '· · ·';
  const countText =
    count === 0
      ? '还没有弹'
      : closed
        ? `这一段 ${count} 个音`
        : `正在听你弹… ${count} 个音`;
  const statusText =
    status ||
    (count === 0
      ? '一段至少三个音，停下来两秒多就算一段。'
      : count < MIN_PHRASE_NOTES
        ? '再弹几个音，凑成一段。'
        : '起个名字就可以收藏。');

  return (
    <div
      className="harp-page fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden animate-fade-in-up"
      style={{ background: 'var(--bg-main)' }}
    >
      <div className="hp-scroll">
        {/* 跟温室同一个做法：不占整条顶栏，只有一个悬浮的圆形返回按钮 */}
        <button
          type="button"
          onClick={onBack}
          title="返回聊天"
          aria-label="返回聊天"
          className="hp-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowGuide(true)}
          title="玩法说明"
          aria-label="玩法说明"
          className="hp-help"
        >
          ?
        </button>

        <div className="hp-inner">
          <header className="hp-header">
            <p className="hp-eyebrow">Starlight Harp</p>
            <h1 className="hp-title">星光小竖琴</h1>
            <div className="hp-ornament" aria-hidden="true">
              <i />
            </div>
            <p className="hp-lede">指尖轻触一根弦，就是一个音。</p>
          </header>

          <div className="hp-who">
            <div className="hp-avatar" aria-hidden="true">
              {character?.avatar ? (
                <img src={character.avatar} alt="" />
              ) : (
                <span>{characterName.slice(0, 1)}</span>
              )}
            </div>
            <span className="hp-who-text">{characterName} 在旁边</span>
          </div>

          <section className="hp-harp-wrap" aria-label="竖琴">
            <HarpCanvas ref={harpRef} onPluck={handlePluck} disabled={playing} />
            <p className="hp-hint">轻触琴弦，或从弦上滑过</p>
            <HarpTimbrePicker value={timbre} onChange={handleTimbreChange} disabled={playing} />
          </section>

          <section className="hp-trail" aria-label="刚才弹的音">
            <div className="hp-trail-head">
              <span>刚才弹的</span>
              <span>{countText}</span>
            </div>
            <div className="hp-trail-text">{trailText}</div>
          </section>

          <section className="hp-controls">
            <div className="hp-row">
              <input
                id="harp-melody-name"
                className="hp-field"
                type="text"
                maxLength={14}
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="给这段旋律起个名字"
                aria-label="旋律名字"
              />
              <button
                type="button"
                className="hp-btn hp-btn-primary"
                onClick={handleSave}
                disabled={!canSend || isSaving}
              >
                收藏
              </button>
              <button
                type="button"
                className="hp-btn"
                onClick={handleSendPhrase}
                disabled={!canSend || isSending}
              >
                弹给 TA 听
              </button>
              <button
                type="button"
                className="hp-btn"
                onClick={handleClear}
                disabled={count === 0 || playing}
              >
                清空
              </button>
            </div>
            <p className="hp-status" aria-live="polite">
              {statusText}
            </p>
          </section>

          <section className="hp-section">
            <h2 className="hp-section-title">
              收藏的旋律
              <span className="hp-rule" />
            </h2>

            {melodies.length === 0 ? (
              <p className="hp-empty">还没有收藏的旋律。弹一段，起个名字收藏下来。</p>
            ) : (
              <ul className="hp-melodies">
                {melodies.map((melody) => (
                  <li key={melody.id} className="hp-melody">
                    <div className="hp-melody-name">
                      {melody.name}
                      <span
                        className={`hp-melody-by${melody.createdBy === 'character' ? ' hp-melody-by-ta' : ''}`}
                      >
                        {melody.createdBy === 'character' ? `${characterName} 弹的` : '你弹的'}
                        {normalizeTimbreId(melody.timbre) &&
                        normalizeTimbreId(melody.timbre) !== DEFAULT_TIMBRE
                          ? ` · ${getTimbreLabel(melody.timbre)}`
                          : ''}
                      </span>
                    </div>
                    <div className="hp-melody-text">{formatMelodyText(melody.notes, melody.delays)}</div>
                    <div className="hp-melody-actions">
                      <button
                        type="button"
                        className="hp-btn hp-btn-small"
                        onClick={() => playSequence(melody)}
                        disabled={playing}
                      >
                        重听
                      </button>
                      <button
                        type="button"
                        className="hp-btn hp-btn-small"
                        onClick={() => sendToCharacter(melody, melody.name)}
                        disabled={isSending || playing}
                      >
                        弹给 TA
                      </button>
                      <button
                        type="button"
                        className="hp-btn hp-btn-small"
                        onClick={() => handleDelete(melody.id)}
                        onBlur={() => setPendingDeleteId(null)}
                      >
                        {pendingDeleteId === melody.id ? '确认删除' : '删除'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {showGuide && <HarpGuideModal characterName={characterName} onClose={closeGuide} />}
    </div>
  );
};

export default HarpPage;