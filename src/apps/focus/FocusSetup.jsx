// src/apps/focus/FocusSetup.jsx
//
// 开始前的设置页：做什么、多久、在哪里、告诉谁、要不要休息、成长图标风格。
// 地点不是真实定位：用户自己写几个，每次开始时选一个。

import React, { useState } from 'react';
import GrowthIcon from './GrowthIcon';
import { FOCUS_MUTE_BUFFER_MINUTES } from './focusMuteState';
import { GROWTH_STYLE_IDS, GROWTH_STYLE_META } from './focusGrowthIcons';

export const DURATION_PRESETS = [25, 45, 60, 90];
export const MIN_DURATION = 1;
export const MAX_DURATION = 240;

const FocusSetup = ({
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
  const [customMode, setCustomMode] = useState(!DURATION_PRESETS.includes(durationMinutes));
  const [editPlaces, setEditPlaces] = useState(false);
  const [newPlace, setNewPlace] = useState('');

  const durationValid =
    Number.isFinite(durationMinutes) &&
    durationMinutes >= MIN_DURATION &&
    durationMinutes <= MAX_DURATION;

  const addPlace = () => {
    const name = newPlace.trim().slice(0, 12);
    if (!name) return;
    if (!places.includes(name)) onPlacesChange([...places, name]);
    onPlaceChange(name);
    setNewPlace('');
  };

  const removePlace = (name) => {
    const next = places.filter((item) => item !== name);
    onPlacesChange(next);
    if (place === name) onPlaceChange('');
  };

  return (
    <div className="focus-setup">
      <section className="focus-block">
        <label className="focus-label" htmlFor="focus-task">这一轮要做什么</label>
        <input
          id="focus-task"
          className="focus-input"
          type="text"
          value={task}
          maxLength={40}
          placeholder="可以留空"
          onChange={(event) => onTaskChange(event.target.value)}
        />
      </section>

      <section className="focus-block">
        <div className="focus-label">专注多久</div>
        <div className="focus-pills">
          {DURATION_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`focus-pill${!customMode && durationMinutes === minutes ? ' is-on' : ''}`}
              onClick={() => {
                setCustomMode(false);
                onDurationChange(minutes);
              }}
            >
              {minutes} 分钟
            </button>
          ))}
          <button
            type="button"
            className={`focus-pill${customMode ? ' is-on' : ''}`}
            onClick={() => setCustomMode(true)}
          >
            自定义
          </button>
        </div>
        {customMode && (
          <div className="focus-custom">
            <input
              className="focus-input focus-input--num"
              type="number"
              inputMode="numeric"
              min={MIN_DURATION}
              max={MAX_DURATION}
              value={Number.isFinite(durationMinutes) ? durationMinutes : ''}
              onChange={(event) => {
                const raw = event.target.value;
                onDurationChange(raw === '' ? NaN : Math.round(Number(raw)));
              }}
            />
            <span className="focus-muted">分钟（{MIN_DURATION}–{MAX_DURATION}）</span>
          </div>
        )}
      </section>

      <section className="focus-block">
        <div className="focus-label-row">
          <div className="focus-label">在哪里</div>
          <button type="button" className="focus-link" onClick={() => setEditPlaces((v) => !v)}>
            {editPlaces ? '完成' : '编辑'}
          </button>
        </div>
        <div className="focus-pills">
          {places.map((name) => (
            <span key={name} className="focus-chip-wrap">
              <button
                type="button"
                className={`focus-pill${place === name ? ' is-on' : ''}`}
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
        <div className="focus-custom">
          <input
            className="focus-input"
            type="text"
            value={newPlace}
            maxLength={12}
            placeholder="写一个新地点"
            onChange={(event) => setNewPlace(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addPlace();
            }}
          />
          <button type="button" className="focus-pill" onClick={addPlace} disabled={!newPlace.trim()}>
            添加
          </button>
        </div>
      </section>

      <section className="focus-block">
        <div className="focus-label">告诉谁，这段时间他们不来打扰你</div>
        {chatOptions.length === 0 ? (
          <p className="focus-muted">还没有可以通知的聊天</p>
        ) : (
          <div className="focus-orbs">
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
                    {option.avatar ? <img src={option.avatar} alt="" /> : <b>{option.name.slice(0, 1)}</b>}
                  </span>
                  <span className="focus-orb-name">{option.name}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="focus-hint">
          选中的角色在专注期间不会主动发消息、不会来电，也不会追问你在做什么；
          结束后还会再安静 {FOCUS_MUTE_BUFFER_MINUTES} 分钟，让你缓一缓。
        </p>
      </section>

      <section className="focus-block">
        <div className="focus-toggle-row">
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
      </section>

      <section className="focus-block">
        <div className="focus-label">成长图标</div>
        <div className="focus-styles">
          {GROWTH_STYLE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`focus-style${growthStyle === id ? ' is-on' : ''}`}
              aria-pressed={growthStyle === id}
              onClick={() => onGrowthStyleChange(id)}
            >
              <GrowthIcon style={id} stage={4} className="focus-gicon--mini" />
              <span>{GROWTH_STYLE_META[id].name}</span>
            </button>
          ))}
        </div>
      </section>

      {error && <p className="focus-error" role="alert">{error}</p>}

      <button
        type="button"
        className="focus-main-btn"
        disabled={!durationValid || starting}
        onClick={onStart}
      >
        {starting ? '正在开始…' : '开始专注'}
      </button>
    </div>
  );
};

export default FocusSetup;
