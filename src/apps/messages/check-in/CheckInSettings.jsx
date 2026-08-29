import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  MessageCircleMore,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  getCheckInConfig,
  saveCheckInConfig,
} from './checkInService';

const AWARENESS_OPTIONS = [
  {
    value: 'subtle',
    title: '含蓄关心',
    description: '角色只知道你很久没有回应自己。',
  },
  {
    value: 'busy_elsewhere',
    title: '察觉你正在忙',
    description: '角色知道你正在别处聊天，但不知道对象是谁。',
  },
  {
    value: 'named_character',
    title: '知道当前对象',
    description: '角色可知道当前聊天角色的名称，但不会知道对话内容。',
  },
];

const FREQUENCY_OPTIONS = [
  {
    value: 'low',
    title: '低',
    description: '偶尔递来一张短笺。',
  },
  {
    value: 'medium',
    title: '中',
    description: '保留自然的存在感。',
  },
  {
    value: 'high',
    title: '高',
    description: '角色会更常想起你。',
  },
];

export const CheckInSettings = ({
  isOpen,
  onClose,
  chats = [],
  characters = [],
}) => {
  const [config, setConfig] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const availableCharacters = useMemo(() => {
    const chatCharacterIds = new Set(
      chats
        .map((chat) => chat?.characterId)
        .filter((characterId) => characterId != null)
        .map(String)
    );

    return characters.filter((character) => (
      character?.id != null &&
      chatCharacterIds.has(String(character.id))
    ));
  }, [chats, characters]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;

    const loadConfig = async () => {
      try {
        const loadedConfig = await getCheckInConfig();

        if (!isCancelled) {
          setConfig(loadedConfig);
        }
      } catch (error) {
        console.error(
          '[CheckInSettings] 读取角色来讯设置失败：',
          error
        );
      }
    };

    void loadConfig();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  /*
   * 弹窗开启时禁止页面背景滚动。
   * 关闭或组件卸载时恢复原来的 body overflow。
   */
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const updateConfig = async (patch) => {
    if (!config || isSaving) {
      return;
    }

    const nextConfig = {
      ...config,
      ...patch,
    };

    setConfig(nextConfig);
    setIsSaving(true);

    try {
      const savedConfig = await saveCheckInConfig(nextConfig);
      setConfig(savedConfig);
    } catch (error) {
      console.error(
        '[CheckInSettings] 保存角色来讯设置失败：',
        error
      );
      setConfig(config);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCharacter = async (characterId) => {
    if (!config) {
      return;
    }

    const normalizedId = String(characterId);
    const enabledIds = config.enabledCharacterIds.map(String);

    const nextIds = enabledIds.includes(normalizedId)
      ? enabledIds.filter((id) => id !== normalizedId)
      : [...enabledIds, normalizedId];

    await updateConfig({
      enabledCharacterIds: nextIds,
    });
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  /*
   * 使用 Portal 直接挂载到 body：
   * 即使外层聊天界面有 transform、overflow: hidden、
   * position 等布局，也不会裁切或影响该弹窗的位置。
   */
  return createPortal(
    <div
      className="check-in-settings-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="check-in-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="check-in-settings-title"
      >
        <header className="check-in-settings-header">
          <div>
            <span className="check-in-settings-kicker">
              CROSS-CHAT PRESENCE
            </span>

            <h2 id="check-in-settings-title">
              角色来讯
            </h2>
          </div>

          <button
            type="button"
            className="check-in-icon-button"
            onClick={onClose}
            aria-label="关闭角色来讯设置"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!config ? (
          <div className="check-in-settings-loading">
            <SlidersHorizontal className="h-4 w-4" />
            <span>正在整理来讯方式。</span>
          </div>
        ) : (
          <div className="check-in-settings-content">
            <section className="check-in-setting-section">
              <div className="check-in-setting-row">
                <div className="check-in-setting-copy">
                  <strong>允许角色递来短笺</strong>

                  <p>
                    当你停留在某个对话里时，其他被允许的角色偶尔会从自己的窗口发来消息。
                  </p>
                </div>

                <button
                  type="button"
                  className={`check-in-switch ${
                    config.enabled
                      ? 'check-in-switch--active'
                      : ''
                  }`}
                  onClick={() => updateConfig({
                    enabled: !config.enabled,
                  })}
                  aria-pressed={config.enabled}
                  aria-label="切换角色来讯"
                >
                  <span />
                </button>
              </div>
            </section>

            <section className="check-in-setting-section">
              <div className="check-in-section-title">
                <MessageCircleMore className="h-3.5 w-3.5" />
                <span>他们知道多少</span>
              </div>

              <div className="check-in-option-list">
                {AWARENESS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`check-in-choice ${
                      config.awarenessLevel === option.value
                        ? 'check-in-choice--active'
                        : ''
                    }`}
                    onClick={() => updateConfig({
                      awarenessLevel: option.value,
                    })}
                  >
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.description}</small>
                    </span>

                    {config.awarenessLevel === option.value && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="check-in-setting-section">
              <div className="check-in-section-title">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>来讯频率</span>
              </div>

              <div className="check-in-frequency-list">
                {FREQUENCY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`check-in-frequency ${
                      config.frequency === option.value
                        ? 'check-in-frequency--active'
                        : ''
                    }`}
                    onClick={() => updateConfig({
                      frequency: option.value,
                    })}
                  >
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="check-in-setting-section">
              <div className="check-in-section-title">
                <span>允许递来消息的角色</span>
              </div>

              {availableCharacters.length === 0 ? (
                <p className="check-in-empty-copy">
                  先建立至少两段角色对话，短笺才有另一扇门可以抵达。
                </p>
              ) : (
                <div className="check-in-character-list">
                  {availableCharacters.map((character) => {
                    const isEnabled =
                      config.enabledCharacterIds
                        .map(String)
                        .includes(String(character.id));

                    return (
                      <button
                        key={character.id}
                        type="button"
                        className={`check-in-character ${
                          isEnabled
                            ? 'check-in-character--active'
                            : ''
                        }`}
                        onClick={() => toggleCharacter(character.id)}
                        aria-pressed={isEnabled}
                      >
                        {character.avatar ? (
                          <img
                            src={character.avatar}
                            alt={character.name}
                          />
                        ) : (
                          <span className="check-in-character-avatar">
                            {character.name?.[0] || 'C'}
                          </span>
                        )}

                        <span className="check-in-character-name">
                          {character.name || '未命名角色'}
                        </span>

                        <span className="check-in-character-state">
                          {isEnabled ? '允许' : '静默'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <p className="check-in-privacy-note">
              来讯角色不会读取你与其他角色的聊天正文、图片、语音或任何具体内容。
            </p>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
};

export default CheckInSettings;
