import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  CircleStop,
  LoaderCircle,
  Play,
  Volume2,
} from 'lucide-react';

import {
  synthesizeMiniMaxSpeech,
} from '../minimaxClient';

const DEFAULT_PREVIEW_TEXT = '这是一段被留在这里的声音。';

export default function VoicePreviewBox({
  voiceProfile,
}) {
  const audioRef = useRef(null);
  const objectUrlRef = useRef('');

  const [previewText, setPreviewText] = useState(
    DEFAULT_PREVIEW_TEXT,
  );
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const clearPreviewAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
  };

  useEffect(() => (
    () => clearPreviewAudio()
  ), []);

  const handlePreview = async () => {
    if (!previewText.trim()) {
      setStatus('error');
      setErrorMessage('请先写下一句试听文案。');
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    clearPreviewAudio();

    try {
      const result = await synthesizeMiniMaxSpeech({
        text: previewText.trim(),
        voiceProfile,
      });

      const objectUrl = URL.createObjectURL(
        result.audioBlob,
      );

      objectUrlRef.current = objectUrl;

      if (!audioRef.current) {
        throw new Error('浏览器没有准备好播放这段声音。');
      }

      audioRef.current.src = objectUrl;
      await audioRef.current.play();

      setStatus('playing');
    } catch (error) {
      console.warn('[RealVoice] 音色试听失败：', error);

      setStatus('error');
      setErrorMessage(
        error?.message
        || '这段试听没有顺利抵达。',
      );
    }
  };

  const handleStop = () => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setStatus('ready');
  };

  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start gap-2">
        <Volume2 className="mt-0.5 h-4 w-4 shrink-0" />

        <div>
          <h4 className="text-xs font-bold">先听一听</h4>

          <p className="mt-0.5 text-[10px] leading-relaxed opacity-55">
            试听不会写入聊天，也不会保存为声音留笺。
          </p>
        </div>
      </div>

      <textarea
        rows={3}
        value={previewText}
        maxLength={240}
        onChange={(event) => {
          setPreviewText(event.target.value);
        }}
        placeholder="写下一句想试听的话"
        className="w-full resize-none rounded-lg bg-black/5 p-2 text-xs outline-none dark:bg-white/10"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={status === 'loading'}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-black px-3 py-2 text-[11px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === 'loading' ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}

          <span>
            {status === 'loading'
              ? '正在试听'
              : '试着听一听'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleStop}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-black/5 transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
          aria-label="停止试听"
        >
          <CircleStop className="h-4 w-4" />
        </button>
      </div>

      <audio
        ref={audioRef}
        onPlay={() => setStatus('playing')}
        onPause={() => {
          if (status !== 'error') {
            setStatus('ready');
          }
        }}
        onEnded={() => setStatus('ready')}
      />

      {status === 'error' && (
        <p className="text-[10px] leading-relaxed text-red-500">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
