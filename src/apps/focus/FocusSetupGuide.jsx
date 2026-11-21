// src/apps/focus/FocusSetupGuide.jsx
//
// 开始前的设置页，一屏一件事：
//   1 专注多久（顺带选成长图标的样子）  2 想做什么、在哪里  3 谁陪着你、要不要休息，然后开始。
// 顶部的成长图标随步骤一步步长大，当作进度。属性和旧的 FocusSetup 完全一致，
// 时长范围等常量仍从 FocusSetup 取，旧文件保留不动。

import React, { useState } from 'react';

import GrowthIcon from './GrowthIcon';
import { DURATION_PRESETS, MAX_DURATION, MIN_DURATION } from './FocusSetup';
import { FOCUS_MUTE_BUFFER_MINUTES } from './focusMuteState';
import { GROWTH_STYLE_IDS, GROWTH_STYLE_META } from './focusGrowthIcons';
import './focusGuide.css';

const STEP_COUNT = 3;
const HERO_STAGES = [2, 3, 5];
const STEP_TITLES = ['这一轮，专注多久', '想做点什么', '谁陪着你'];

const FocusSetupGuide = ({
  task,
  onTaskChange,
  durationMinutes,
  onDurationChange,
  places,
  place,
  onPlaceChange,
  onPlacesChange,
  chatOptions,
  selectedChatIds,
  onToggleChat,
  restEnabled,
  onRestChange,
  growthStyle,
  onGrowthStyleChange,
  onStart,
  starting,
  error,
}) => {
  const [step, setStep] = useState(0);
  const [customMode, setCustomMode] = useState(!DURATION_PRESETS.includes(durationMinutes));
  const [editPlaces, setEditPlaces] = useState(false);
  const [newPlace, setNewPlace] = useState('');

  const durationValid =
    Number.isFinite(durationMinutes) &&
    durationMinutes >= MIN_DURATION &&
    durationMinutes <= MAX_DURATION;

  const goNext = () => setStep((value) => Math.min(STEP_COUNT - 1, value + 1));
  const goPrev = () => setStep((value) => Math.max(0, value - 1));

  const stepDuration = (delta) => {
    const base = Number.isFinite(durationMinutes) ? durationMinutes : 25;
    onDurationChange(Math.max(MIN_DURATION, Math.min(MAX_DURATION, base + delta)));
  };

  const addPlace = () => {
    const name = newPlace.trim().slice(0, 12);
    if (!name) return;
    if (!places.includes(name)) onPlacesChange([...places, name]);
    onPlaceChange(name);
    setNewPlace('');
  };

  const removePlace = (name) => {
    onPlacesChange(places.filter((item) => item !== name));
    if (place === name) onPlaceChange('');
  };

  const chosenNames = chatOptions
    .filter((option) => selectedChatIds.includes(option.chatId))
    .map((option) => option.name);

  const summaryParts = [
    durationValid ? `${durationMinutes} 分钟` : '',
    task.trim(),
    place ? `在${place}` : '',
    chosenNames.length ? `${chosenNames.join('、')} 陪着你` : '',
  ].filter(Boolean);

  return (
    <div className="fg">
      <div className="fg-steps" aria-label={`第 ${step + 1} 步，共 ${STEP_COUNT} 步`}>
        {STEP_TITLES.map((title, index) => (
          <i key={title} className={index === step ? 'is-on' : index < step ? 'is-done' : ''} />
        ))}
      </div>

      <div className="fg-hero">
        <GrowthIcon style={growthStyle} stage={HERO_STAGES[step]} className="focus-gicon--stage" />
      </div>

      <h2 className="fg-title">{STEP_TITLES[step]}</h2>

      <div className="fg-body" key={step}>
        {step === 0 && (
          <>
            <div className="fg-time">
              <span className="fg-time-num">{durationValid ? durationMinutes : '--'}</span>
              <span className="fg-time-unit">分钟</span>
            </div>

            <div className="fg-chips">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={`fg-chip${!customMode && durationMinutes === minutes ? ' is-on' : ''}`}
                  onClick={() => {
                    setCustomMode(false);
                    onDurationChange(minutes);
                  }}
                >
                  {minutes}
                </button>
              ))}
              <button
                type="button"
                className={`fg-chip${customMode ? ' is-on' : ''}`}
                onClick={() => setCustomMode(true)}
              >
                自定义
              </button>
            </div>

            {customMode && (
              <div className="fg-stepper">
                <button type="button" aria-label="减少 5 分钟" onClick={() => stepDuration(-5)}>
                  &minus;
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_DURATION}
                  max={MAX_DURATION}
                  value={Number.isFinite(durationMinutes) ? durationMinutes : ''}
                  aria-label="自定义分钟数"
                  onChange={(event) => {
                    const raw = event.target.value;
                    onDurationChange(raw === '' ? NaN : Math.round(Number(raw)));
                  }}
                />
                <button type="button" aria-label="增加 5 分钟" onClick={() => stepDuration(5)}>
                  +
                </button>
              </div>
            )}
            {customMode && !durationValid && (
              <p className="fg-note">请填写 {MIN_DURATION} 到 {MAX_DURATION} 之间的分钟数</p>
            )}

            <div className="fg-styles" role="group" aria-label="成长的样子">
              {GROWTH_STYLE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`fg-style${growthStyle === id ? ' is-on' : ''}`}
                  aria-pressed={growthStyle === id}
                  onClick={() => onGrowthStyleChange(id)}
                >
                  <GrowthIcon style={id} stage={4} />
                  <span>{GROWTH_STYLE_META[id].name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <input
              className="fg-field"
              type="text"
              value={task}
              maxLength={40}
              placeholder="这一轮要做的事，可以留空"
              aria-label="这一轮要做什么"
              onChange={(event) => onTaskChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') goNext();
              }}
            />

            <div className="fg-section">
              <div className="fg-section-head">
                <span>在哪里</span>
                <button type="button" className="focus-link" onClick={() => setEditPlaces((v) => !v)}>
                  {editPlaces ? '完成' : '编辑'}
                </button>
              </div>

              <div className="fg-chips">
                {places.map((name) => (
                  <span key={name} className="focus-chip-wrap">
                    <button
                      type="button"
                      className={`fg-chip${place === name ? ' is-on' : ''}`}
                      onClick={() => onPlaceChange(place === name ? '' : name)}
                    >
                      {name}
                    </button>
                    {editPlaces && (
                      <button
                        type="button"
                        className="focus-chip-del"
                        aria-label={`删除地点 ${name}`}
                        onClick={() => removePlace(name)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {places.length === 0 && <span className="focus-muted">还没有地点，写一个吧</span>}
              </div>

              <div className="fg-add">
                <input
                  type="text"
                  value={newPlace}
                  maxLength={12}
                  placeholder="写一个新地点"
                  aria-label="新地点"
                  onChange={(event) => setNewPlace(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addPlace();
                  }}
                />
                <button type="button" onClick={addPlace} disabled={!newPlace.trim()}>
                  添加
                </button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="fg-lead">
              选中的人这段时间不会来打扰你，不发消息、不来电，也不会问你在做什么；
              结束后再安静 {FOCUS_MUTE_BUFFER_MINUTES} 分钟，让你缓一缓。
            </p>

            {chatOptions.length === 0 ? (
              <p className="focus-muted">还没有可以通知的聊天</p>
            ) : (
              <div className="fg-orbs">
                {chatOptions.map((option) => {
                  const on = selectedChatIds.includes(option.chatId);
                  return (
                    <button
                      key={option.chatId}
                      type="button"
                      className={`focus-orb${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => onToggleChat(option.chatId)}
                    >
                      <span className="focus-orb-face">
                        {option.avatar ? (
                          <img src={option.avatar} alt="" />
                        ) : (
                          <b>{option.name.slice(0, 1)}</b>
                        )}
                      </span>
                      <span className="focus-orb-name">{option.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="fg-row">
              <span>结束后休息 5 分钟</span>
              <button
                type="button"
                className={`focus-switch${restEnabled ? ' is-on' : ''}`}
                role="switch"
                aria-checked={restEnabled}
                aria-label="结束后休息"
                onClick={() => onRestChange(!restEnabled)}
              >
                <i />
              </button>
            </div>

            {summaryParts.length > 0 && <p className="fg-summary">{summaryParts.join(' · ')}</p>}
          </>
        )}
      </div>

      {error && <p className="focus-error" role="alert">{error}</p>}

      <div className="fg-actions">
        {step < STEP_COUNT - 1 ? (
          <button
            type="button"
            className="focus-main-btn"
            disabled={step === 0 && !durationValid}
            onClick={goNext}
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            className="focus-main-btn"
            disabled={!durationValid || starting}
            onClick={onStart}
          >
            {starting ? '正在开始…' : '开始专注'}
          </button>
        )}
        {step > 0 && (
          <button type="button" className="focus-link" disabled={starting} onClick={goPrev}>
            上一步
          </button>
        )}
      </div>
    </div>
  );
};

export default FocusSetupGuide;