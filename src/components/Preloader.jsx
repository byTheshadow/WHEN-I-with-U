import React, { useEffect, useState } from 'react';
import AstrologyDice from './AstrologyDice';
import { getRandomInspiration } from '../data/dailyInspirations';

export const Preloader = ({ onFinish }) => {
  const [quote, setQuote] = useState('');
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    setQuote(getRandomInspiration());

    const fadeTimer = window.setTimeout(() => {
      setIsFading(true);
    }, 3600);

    const finishTimer = window.setTimeout(() => {
      onFinish?.();
    }, 4300);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`preloader fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center transition-opacity duration-700 ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="preloader__ambient-glow" aria-hidden="true" />

      <div className="preloader__content relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className="preloader__dice-wrap flex w-full justify-center">
          <AstrologyDice />
        </div>

        <div className="preloader__copy">
          <h2 className="preloader__title">
            WHEN I <span>with U.</span>
          </h2>

          <p className="preloader__quote">“{quote}”</p>
        </div>

        <p className="preloader__status">Aligning constellations</p>
      </div>
    </div>
  );
};

export default Preloader;

