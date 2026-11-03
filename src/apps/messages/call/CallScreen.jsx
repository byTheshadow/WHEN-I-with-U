import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';


import {
  acceptCall,
  declineCall,
  endCall,
  isRealVoiceAvailableForCharacter,
  rerollCallTurn,
  sendCallTurn,
  switchCallTurnVersion,
} from '../../../services/callService';

import {
  beginFrameSampling,
  captureFrame,
  endFrameSampling,
} from './videoCameraService';
import { isVideoCallAvailable } from '../../../services/videoCallApiService';
import {
  hasUsableMiniMaxAsrConfig,
  transcribeMiniMaxSpeech,
} from '../../../features/real-voice/minimaxClient';
import { normalizeVoiceProfile } from '../../../features/real-voice/realVoiceDefaults';
import { useVoiceRecorder } from '../../../features/real-voice/useVoiceRecorder';
import { triggerGlobalToast } from '../../../components/NotificationToast';

import CallRingingScreen from './CallRingingScreen';
import CallActiveScreen from './CallActiveScreen';
import VideoCallScreen from './VideoCallScreen';
import VoicemailStage from './VoicemailStage';

import './call-screen.css';

// 打字机逐字吐字的速度，以及"这条轮次算不算刚刚发生"的时间窗——
// 只对刚落地的新轮次做逐字动画，翻旧记录、缩小再展开悬浮球时不会
// 把已经说完的话重新打一遍。跟 specialMessageEffects.js 里
// "最近消息才播放特效"是同一个思路。
const TYPEWRITER_MS_PER_CHAR = 68;
const TYPEWRITER_FRESH_WINDOW_MS = 6000;

const formatElapsed = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

// 通话最外层容器：只负责背景/缩小按钮这些两种状态共用的东西，以及
// 通话数据、计时、打字机效果这些跟视觉无关的逻辑。"来电中"和
// "通话中"两种截然不同的视觉分别交给 CallRingingScreen /
// CallActiveScreen 两个独立组件。
const CallScreen = ({ call, onMinimize }) => {
  const { message, character, chat } = call;
  const metadata = message.metadata || {};
  const { status, direction, mode, connectedAt, aiThinking } = metadata;
  const turns = Array.isArray(metadata.turns) ? metadata.turns : [];
  const latestTurn = turns[turns.length - 1] || null;

  const [draftText, setDraftText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [revealedText, setRevealedText] = useState('');

  const transcriptRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const lastPlayedTurnIdRef = useRef(null);
  const animatedTurnIdsRef = useRef(new Set());
  const revealTimerRef = useRef(null);

  const realVoiceAvailable = isRealVoiceAvailableForCharacter(character);
  const voiceInputAvailable = hasUsableMiniMaxAsrConfig(character?.voiceProfile);

   // 能不能视频接听：配置了视频通话 API 就可以，否则看主 API 的模型名
  // 像不像支持视觉的。异步读取，默认 false（保守）。
  const [videoVisionAvailable, setVideoVisionAvailable] = useState(false);
 
  useEffect(() => {
    let isMounted = true;
 
    void isVideoCallAvailable().then((available) => {
      if (isMounted) setVideoVisionAvailable(available);
    });
 
    return () => {
      isMounted = false;
    };
  }, []);
  const {
    isRecording,
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
  } = useVoiceRecorder();

  // 通话被缩小/挂断导致这个组件被卸载时，如果正录着音，把麦克风
  // 关掉，不要留着一直占用、也不要在组件已经不在了之后再触发识别。
  useEffect(() => () => {
    if (isRecording) {
      cancelRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'active' || !connectedAt) return undefined;

    const tick = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000))
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [status, connectedAt]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [turns.length, revealedText, aiThinking]);

 // 真实语音模式、视频模式下，新到达的 AI 语音轮次自动播放一次——
  // 通话本身就是用户主动发起/接听的交互，不算是"未经许可自动出声"。
  useEffect(() => {
    if ((mode !== 'real' && mode !== 'video') || !audioRef.current) return;

    const latestReadyTurn = [...turns].reverse().find((turn) => (
      turn.by === 'ai' && turn.audioStatus === 'ready' && turn.audio?.audioBlob
    ));

    if (!latestReadyTurn || latestReadyTurn.id === lastPlayedTurnIdRef.current) {
      return;
    }

    lastPlayedTurnIdRef.current = latestReadyTurn.id;

    const objectUrl = URL.createObjectURL(latestReadyTurn.audio.audioBlob);
    audioRef.current.src = objectUrl;

    audioRef.current.play().catch(() => {
      // 浏览器拦截了自动播放，文字转写依然会显示，不影响通话继续。
    });
  }, [turns, mode]);

  // 手动播放某一句的语音：自动播放被浏览器拦住时的备用入口。
  const handlePlayTurnAudio = (turn) => {
    if (!audioRef.current || !turn?.audio?.audioBlob) return;
 
    const objectUrl = URL.createObjectURL(turn.audio.audioBlob);
    audioRef.current.src = objectUrl;
    audioRef.current.play().catch((error) => {
      console.warn('[CallScreen] 手动播放通话语音失败：', error);
    });
  };
 
  // 打字机效果：只对"刚刚"到达的 AI 轮次生效。旧轮次（翻看历史、
  // 缩小再展开悬浮球触发的重新渲染）直接整句显示，不重播动画。
  useEffect(() => {
    if (!latestTurn || latestTurn.by !== 'ai') {
      setRevealedText('');
      return undefined;
    }

    const turnTimeMs = new Date(latestTurn.at).getTime();
    const isFresh = Number.isFinite(turnTimeMs)
      && (Date.now() - turnTimeMs) < TYPEWRITER_FRESH_WINDOW_MS;

    if (animatedTurnIdsRef.current.has(latestTurn.id) || !isFresh) {
      setRevealedText(latestTurn.content);
      return undefined;
    }

    animatedTurnIdsRef.current.add(latestTurn.id);

    const fullText = latestTurn.content;
    let index = 0;
    setRevealedText('');

    const tick = () => {
      index += 1;
      setRevealedText(fullText.slice(0, index));

      if (index < fullText.length) {
        revealTimerRef.current = window.setTimeout(tick, TYPEWRITER_MS_PER_CHAR);
      }
    };

    revealTimerRef.current = window.setTimeout(tick, TYPEWRITER_MS_PER_CHAR);

    return () => window.clearTimeout(revealTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestTurn?.id, latestTurn?.content]);

  const handleAccept = (chosenMode) => {
    void acceptCall({ messageId: message.id, mode: chosenMode });
  };

  const handleDecline = () => {
    void declineCall({ messageId: message.id });
  };

  const handleHangUp = () => {
    void endCall({ messageId: message.id });
  };

  const handleRerollTurn = (turnId) => (
    rerollCallTurn({ messageId: message.id, turnId })
  );

  const handleSwitchTurnVersion = (turnId, direction) => {
    void switchCallTurnVersion({ messageId: message.id, turnId, direction });
  };

  const handleSend = async () => {
    const text = draftText.trim();
    if (!text || isSending) return;

    setDraftText('');
    setIsSending(true);

    try {
      // 视频模式下打字发送：没有录像，就取发送瞬间的 1 帧（只在内存里）。
      const frame = mode === 'video' ? captureFrame(videoRef.current) : null;

      await sendCallTurn({
        messageId: message.id,
        text,
        frames: frame ? [frame] : [],
      });
    } finally {
      setIsSending(false);
    }
  };

  // 麦克风按钮：点一下开始录，再点一下结束并送去 MiniMax 识别。
  // 识别完之后是先填输入框等确认、还是直接发出去，由角色语音设置
  // 里的开关（voiceInputAutoSend）决定——默认是前者，跟打字发消息
  // 走的是同一条"点发送才真的发出去"的路；开启开关后跳过这一步，
  // 识别完直接调 sendCallTurn，更接近"说完就说出去了"的通话感。
  const handleToggleVoiceInput = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      setIsTranscribing(true);

      // 视频模式：结束录像，取说话期间的抽帧（只在内存里，不落库）。
      const recordedFrames = mode === 'video' ? endFrameSampling() : [];

      try {
        const audioBlob = await stopRecording();

        const text = await transcribeMiniMaxSpeech({
          audioBlob,
          voiceProfile: character?.voiceProfile,
        });

        if (!text) {
          triggerGlobalToast({
            title: '没听清',
            content: '没识别到内容，再说一次试试。',
          });
          return;
        }

        // 视频模式：录完直接发出，轮到 char 回应；语音模式遵循角色设置。
        const autoSend = mode === 'video'
          || normalizeVoiceProfile(character?.voiceProfile).voiceInputAutoSend;

        if (autoSend) {
          setIsSending(true);

          try {
            await sendCallTurn({
              messageId: message.id,
              text,
              frames: recordedFrames,
            });
          } finally {
            setIsSending(false);
          }
        } else {
          setDraftText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
        }
      } catch (error) {
        triggerGlobalToast({
          title: '语音识别失败',
          content: error.message || '请重试。',
        });
      } finally {
        setIsTranscribing(false);
      }

      return;
    }

    try {
      await startRecording();

      if (mode === 'video') {
        beginFrameSampling(videoRef.current);
      }
    } catch (error) {
      triggerGlobalToast({
        title: '无法录音',
        content: error.message || '请检查麦克风权限。',
      });
    }
  };

  const statusLabel = useMemo(() => {
    if (status === 'ringing') {
      if (metadata.unavailable) return '对方暂时无法接听';

      return direction === 'incoming' ? '邀请你语音通话' : '正在呼叫...';
    }

    return formatElapsed(elapsedSeconds);
  }, [status, direction, elapsedSeconds, metadata.unavailable]);

// 视频通话进行中：整屏就是视频，不要聊天背景图，也不要通话页的内边距。
  const isVideoActive = status === 'active' && mode === 'video';
 
  return (
    <div
      className="call-screen fixed inset-0 z-[59] overflow-hidden"
      style={{ color: '#fff' }}
    >
      {!isVideoActive && (
      <div className="call-screen__backdrop absolute inset-0 -z-10" aria-hidden="true">
        {chat?.bgImage ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${chat.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: 'var(--bg-main)' }} />
        )}

        <div className="call-screen__backdrop-veil absolute inset-0" />
      </div>
      )}

      <audio ref={audioRef} />

      <button
        type="button"
        onClick={onMinimize}
        className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-10 flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
        aria-label="缩小通话"
        title="缩小到悬浮球"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      <div
        className={
          isVideoActive
            ? 'relative z-0 h-full'
            : 'relative z-0 h-full px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+3.25rem)]'
        }
      >
        {isVideoActive ? (
          <VideoCallScreen
            character={character}
            statusLabel={statusLabel}
            turns={turns}
            latestTurn={latestTurn}
            revealedText={revealedText}
            aiThinking={aiThinking}
            transcriptRef={transcriptRef}
            draftText={draftText}
            onDraftChange={setDraftText}
            onSend={handleSend}
            isSending={isSending}
            onHangUp={handleHangUp}
            onRerollTurn={handleRerollTurn}
            onSwitchTurnVersion={handleSwitchTurnVersion}
            voiceInputAvailable={voiceInputAvailable}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            onToggleVoiceInput={handleToggleVoiceInput}
          videoRef={videoRef}
            onPlayTurnAudio={handlePlayTurnAudio}
          />
        ) : status === 'active' ? (
          <CallActiveScreen
            character={character}
            statusLabel={statusLabel}
            turns={turns}
            latestTurn={latestTurn}
            revealedText={revealedText}
            aiThinking={aiThinking}
            transcriptRef={transcriptRef}
            draftText={draftText}
            onDraftChange={setDraftText}
            onSend={handleSend}
            isSending={isSending}
            onHangUp={handleHangUp}
            onRerollTurn={handleRerollTurn}
            onSwitchTurnVersion={handleSwitchTurnVersion}
            voiceInputAvailable={voiceInputAvailable}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            onToggleVoiceInput={handleToggleVoiceInput}
          />
        ) : (
          <CallRingingScreen
            character={character}
            direction={direction}
            statusLabel={statusLabel}
            reason={direction === 'incoming' ? String(metadata.reason || '') : ''}
            realVoiceAvailable={realVoiceAvailable}
            videoVisionAvailable={videoVisionAvailable}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onCancel={handleHangUp}
            voicemailSlot={
              status === 'ringing' && direction === 'outgoing' && metadata.unavailable && metadata.voicemail
                ? (
                  <VoicemailStage
                    messageId={message.id}
                    voicemail={metadata.voicemail}
                    character={character}
                  />
                )
                : null
            }
          />
        )}
      </div>
    </div>
  );
};

export default CallScreen;
