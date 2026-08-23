import React, { useEffect, useRef } from 'react';

export const AudioKeepAlive = ({ isActive = false }) => {
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const stopKeepAlive = () => {
      try {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }

        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
        }

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
        }
      } catch (error) {
        console.warn('[AudioKeepAlive] Stop notice:', error);
      }
    };

    const startKeepAlive = async () => {
      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (AudioContextClass) {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
          }

          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }

          if (!oscillatorRef.current) {
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(
              20,
              audioContextRef.current.currentTime,
            );

            gainNode.gain.setValueAtTime(
              0.00001,
              audioContextRef.current.currentTime,
            );

            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            oscillator.start();

            oscillatorRef.current = oscillator;
            gainNodeRef.current = gainNode;
          }
        }

        if (audioRef.current) {
          try {
            await audioRef.current.play();
          } catch (error) {
            console.warn(
              '[AudioKeepAlive] Browser blocked audio playback. Please turn on keep-alive through a direct user tap in chat settings.',
              error,
            );
          }
        }

        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'WHEN I with U',
            artist: 'Personal Companion Space',
            album: 'Keep Alive',
          });

          navigator.mediaSession.playbackState = 'playing';
        }
      } catch (error) {
        console.warn('[AudioKeepAlive] Start failed:', error);
      }
    };

    if (isActive) {
      startKeepAlive();
    } else {
      stopKeepAlive();
    }

    return stopKeepAlive;
  }, [isActive]);

  const silentWavData =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  return (
    <audio
      ref={audioRef}
      src={silentWavData}
      loop
      preload="auto"
      aria-hidden="true"
      style={{ display: 'none' }}
    />
  );
};

export default AudioKeepAlive;
