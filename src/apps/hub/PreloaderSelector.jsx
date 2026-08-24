// src/apps/hub/PreloaderSelector.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  CircleDot,
  Disc3,
  Image,
  Layers3,
  LockKeyhole,
  Mail,
  Sparkles
} from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import db from '../../db';
import {
  DEFAULT_STARTUP_ANIMATION_ID,
  getStartupAnimationById,
  isAvailableStartupAnimation,
  STARTUP_ANIMATIONS,
  STARTUP_ANIMATION_SETTING_KEY,
  STARTUP_ANIMATION_STORAGE_KEY
} from '../../config/startupAnimations';
import './preloader-selector.css';

const ICON_MAP = {
  astrology: Sparkles,
  vinyl: Disc3,
  polaroid: Image,
  letter: Mail,
  pebble: Layers3
};

const readStoredAnimationId = () => {
  try {
    return window.localStorage.getItem(STARTUP_ANIMATION_STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveAnimationIdToStorage = (animationId) => {
  try {
    window.localStorage.setItem(STARTUP_ANIMATION_STORAGE_KEY, animationId);
  } catch {
    // localStorage 不可用时，仍会尝试写入 Dexie。
  }
};

export const PreloaderSelector = ({ delay = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(
    DEFAULT_STARTUP_ANIMATION_ID
  );
  const [saveState, setSaveState] = useState('idle');

  const selectedAnimation = useMemo(() => {
    return getStartupAnimationById(selectedId);
  }, [selectedId]);

  useEffect(() => {
    let isMounted = true;

    const loadStartupPreference = async () => {
      const storedId = readStoredAnimationId();

      if (storedId && isAvailableStartupAnimation(storedId)) {
        if (isMounted) {
          setSelectedId(storedId);
        }
        return;
      }

      try {
        const setting = await db.settings.get(STARTUP_ANIMATION_SETTING_KEY);
        const databaseId = setting?.value?.type;

        if (!isAvailableStartupAnimation(databaseId)) {
          return;
        }

        saveAnimationIdToStorage(databaseId);

        if (isMounted) {
          setSelectedId(databaseId);
        }
      } catch (error) {
        console.warn('Unable to read startup animation preference.', error);
      }
    };

    loadStartupPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelect = async (animation) => {
    if (!animation.isAvailable || animation.id === selectedId) {
      return;
    }

    setSelectedId(animation.id);
    setSaveState('saving');
    saveAnimationIdToStorage(animation.id);

    try {
      await db.settings.put({
        key: STARTUP_ANIMATION_SETTING_KEY,
        value: {
          type: animation.id,
          updatedAt: Date.now()
        }
      });

      setSaveState('saved');
    } catch (error) {
      console.error('Unable to save startup animation preference.', error);
      setSaveState('error');
    }
  };

  const getOptionState = (animation) => {
    if (animation.id === selectedId) {
      return 'ACTIVE';
    }

    return animation.status;
  };

  return (
    <GlassCard
      delay={delay}
      className={`preloader-selector ${
        isExpanded ? 'preloader-selector--expanded' : ''
      }`}
    >
      <button
        type="button"
        className="preloader-selector__toggle"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        aria-controls="startup-animation-archive"
      >
        <span className="preloader-selector__edition">No. 01</span>

        <span className="preloader-selector__toggle-copy">
          <span className="preloader-selector__eyebrow">
            STARTUP ATMOSPHERE ARCHIVE
          </span>

          <span className="preloader-selector__title-row">
            <span className="preloader-selector__title">
              {selectedAnimation.title}
            </span>

            <span className="preloader-selector__active-tag">ACTIVE</span>
          </span>

          <span className="preloader-selector__description">
            {selectedAnimation.description}
          </span>
        </span>

        <span className="preloader-selector__toggle-control" aria-hidden="true">
          <ChevronDown size={15} strokeWidth={1.8} />
        </span>
      </button>

      <div
        id="startup-animation-archive"
        className="preloader-selector__panel"
      >
        <div className="preloader-selector__panel-inner">
          <div className="preloader-selector__content">
            <div className="preloader-selector__heading">
              <h4>SELECT A STARTING SCENE</h4>

              <p>
                THE CHOICE IS SAVED
                <br />
                FOR YOUR NEXT ARRIVAL
              </p>
            </div>

            <div className="preloader-selector__options">
              {STARTUP_ANIMATIONS.map((animation) => {
                const Icon = ICON_MAP[animation.id] || CircleDot;
                const isSelected = animation.id === selectedId;
                const isLocked = !animation.isAvailable;

                return (
                  <button
                    key={animation.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSelect(animation)}
                    className={`preloader-selector__option ${
                      isSelected ? 'preloader-selector__option--selected' : ''
                    } ${
                      isLocked ? 'preloader-selector__option--locked' : ''
                    }`}
                  >
                    <span className="preloader-selector__option-marker">
                      {isLocked ? (
                        <LockKeyhole size={14} strokeWidth={1.6} />
                      ) : (
                        <Icon size={16} strokeWidth={1.55} />
                      )}
                    </span>

                    <span className="preloader-selector__option-copy">
                      <span className="preloader-selector__option-name">
                        {animation.title}
                      </span>

                      <span className="preloader-selector__option-description">
                        {animation.archiveDescription}
                      </span>
                    </span>

                    <span className="preloader-selector__option-state">
                      {getOptionState(animation)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="preloader-selector__footer">
              <p>
                YOUR SELECTED SCENE WILL APPEAR
                <br />
                THE NEXT TIME THE APP OPENS.
              </p>

              <span
                className={`preloader-selector__save-state ${
                  saveState === 'error'
                    ? 'preloader-selector__save-state--error'
                    : ''
                }`}
              >
                {saveState === 'saving' && 'SAVING'}
                {saveState === 'saved' && 'SAVED'}
                {saveState === 'error' && 'NOT SAVED'}
                {saveState === 'idle' && 'LOCAL ARCHIVE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default PreloaderSelector;

