import React, {
  useState,
} from 'react';

import {
  AudioLines,
  RefreshCw,
} from 'lucide-react';

import GlassCard from '../../../components/GlassCard';

import {
  createDefaultVoiceProfile,
  getMiniMaxRegionPreset,
  MINIMAX_REGION_PRESETS,
  normalizeVoiceProfile,
  VOICE_LANGUAGE_OPTIONS,
} from '../realVoiceDefaults';

import {
  fetchMiniMaxModels,
} from '../minimaxClient';

import VoicePreviewBox from './VoicePreviewBox';
import VoiceExpressionGuidePanel from './VoiceExpressionGuidePanel';

const updateMiniMax = (profile, patch) => ({
  ...profile,
  minimax: {
    ...profile.minimax,
    ...patch,
  },
});

export default function VoiceProfilePanel({
  value,
  onChange,
}) {
  const profile = normalizeVoiceProfile(
    value || createDefaultVoiceProfile(),
  );

  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');

  const updateProfile = (patch) => {
    onChange({
      ...profile,
      ...patch,
    });
  };

  const handleRegionChange = (region) => {
    const preset = getMiniMaxRegionPreset(region);

    onChange(updateMiniMax(profile, {
      region,
      baseUrl: preset.baseUrl,
      modelId: '',
    }));

    setModels([]);
    setModelError('');
  };

  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    setModelError('');

    try {
      const receivedModels = await fetchMiniMaxModels(profile);

      setModels(receivedModels);

      if (
        !profile.minimax.modelId
        && receivedModels[0]?.id
      ) {
        onChange(updateMiniMax(profile, {
          modelId: receivedModels[0].id,
        }));
      }
    } catch (error) {
      setModels([]);
      setModelError(
        error?.message
        || '模型列表没有顺利抵达。',
      );
    } finally {
      setIsLoadingModels(false);
    }
  };

  const selectedRegion = (
    MINIMAX_REGION_PRESETS[profile.minimax.region]
    || MINIMAX_REGION_PRESETS.custom
  );

  const shouldShowGroupId = (
    selectedRegion.requiresGroupId
    || Boolean(profile.minimax.groupId)
  );

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start gap-2">
        <AudioLines className="mt-0.5 h-4 w-4 shrink-0" />

        <div>
          <h3 className="text-sm font-bold">真实声音档案</h3>

          <p className="mt-1 text-[10px] leading-relaxed opacity-60">
            为这个角色保存独立的 MiniMax 声音资料。真实语音会作为新的声音留笺出现，不影响原有文字语音组件。
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-black/[0.04] px-3 py-2.5 dark:bg-white/[0.07]">
        <div>
          <span className="block text-xs font-semibold">
            启用真实声音
          </span>

          <span className="mt-0.5 block text-[10px] opacity-55">
            关闭后，该角色不会调用真实语音生成。
          </span>
        </div>

        <input
          type="checkbox"
          checked={profile.enabled}
          onChange={(event) => {
            updateProfile({
              enabled: event.target.checked,
            });
          }}
          className="h-4 w-4 accent-current"
        />
      </label>

      {profile.enabled && (
        <div className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-xs font-semibold">
                让角色自行决定
              </span>

              <span className="mt-0.5 block text-[10px] opacity-55">
                角色会判断这段话更适合停留为文字，还是额外留下一段声音。
              </span>
            </div>

            <input
              type="checkbox"
              checked={profile.aiMaySendVoice}
              onChange={(event) => {
                updateProfile({
                  aiMaySendVoice: event.target.checked,
                });
              }}
              className="h-4 w-4 accent-current"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-xs font-semibold">
                允许 AI 调整声音表现
              </span>

              <span className="mt-0.5 block text-[10px] leading-relaxed opacity-55">
                开启后，AI 可以根据情绪临时调整语速、音调和情绪。关闭时始终使用下方固定配置。
              </span>
            </div>

            <input
              type="checkbox"
              checked={profile.aiMayControlVoiceSettings}
              onChange={(event) => {
                updateProfile({
                  aiMayControlVoiceSettings: event.target.checked,
                });
              }}
              className="h-4 w-4 accent-current"
            />
          </label>

          {profile.aiMaySendVoice && (
            <VoiceExpressionGuidePanel
              value={profile}
              onChange={onChange}
            />
          )}

          <div>
            <label className="mb-1 block opacity-60">
              MiniMax 区域
            </label>

            <select
              value={profile.minimax.region}
              onChange={(event) => {
                handleRegionChange(event.target.value);
              }}
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            >
              {Object.entries(MINIMAX_REGION_PRESETS).map(
                ([value, item]) => (
                  <option key={value} value={value}>
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block opacity-60">
              MiniMax Base URL
            </label>

            <input
              type="url"
              value={profile.minimax.baseUrl}
              onChange={(event) => {
                onChange(updateMiniMax(profile, {
                  baseUrl: event.target.value,
                }));
              }}
              placeholder="https://..."
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />

            <p className="mt-1 text-[10px] leading-relaxed opacity-50">
              区域切换只会提供建议地址。此处始终可以按你的 MiniMax 控制台或兼容服务地址修改。
            </p>
          </div>

          <div>
            <label className="mb-1 block opacity-60">
              可选代理地址
            </label>

            <input
              type="url"
              value={profile.minimax.proxyBaseUrl}
              onChange={(event) => {
                onChange(updateMiniMax(profile, {
                  proxyBaseUrl: event.target.value,
                }));
              }}
              placeholder="留空时直接连接 MiniMax"
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />

            <p className="mt-1 text-[10px] leading-relaxed opacity-50">
              只有浏览器出现 CORS 错误、或你使用 One-API 等兼容服务时才填写。填写后将优先使用该地址。
            </p>
          </div>

          <div>
            <label className="mb-1 block opacity-60">
              MiniMax API Key
            </label>

            <input
              type="password"
              value={profile.minimax.apiKey}
              onChange={(event) => {
                onChange(updateMiniMax(profile, {
                  apiKey: event.target.value,
                }));
              }}
              placeholder="粘贴 API Key"
              autoComplete="off"
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />
          </div>

          {shouldShowGroupId && (
            <div>
              <label className="mb-1 block opacity-60">
                MiniMax Group ID
                {selectedRegion.requiresGroupId
                  ? '（国内版通常需要）'
                  : '（可选）'}
              </label>

              <input
                type="text"
                value={profile.minimax.groupId}
                onChange={(event) => {
                  onChange(updateMiniMax(profile, {
                    groupId: event.target.value,
                  }));
                }}
                placeholder="例如 grp-..."
                autoComplete="off"
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              />
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="opacity-60">
                语音模型
              </label>

              <button
                type="button"
                onClick={handleLoadModels}
                disabled={isLoadingModels}
                className="flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-[10px] font-semibold transition-opacity disabled:opacity-45 dark:bg-white/10"
              >
                <RefreshCw
                  className={`h-3 w-3 ${
                    isLoadingModels
                      ? 'animate-spin'
                      : ''
                  }`}
                />

                <span>
                  {isLoadingModels
                    ? '载入中'
                    : '获取模型'}
                </span>
              </button>
            </div>

            <select
              value={profile.minimax.modelId}
              onChange={(event) => {
                onChange(updateMiniMax(profile, {
                  modelId: event.target.value,
                }));
              }}
              disabled={models.length === 0}
              className="w-full rounded-lg bg-black/5 p-2 outline-none disabled:opacity-45 dark:bg-white/10"
            >
              <option value="">
                {models.length > 0
                  ? '选择一个语音模型'
                  : '请先读取模型'}
              </option>

              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                  {model.source === 'remote'
                    ? ' · 接口返回'
                    : ' · TTS 推荐'}
                </option>
              ))}
            </select>

            {modelError && (
              <p className="mt-1 text-[10px] leading-relaxed text-red-500">
                {modelError}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block opacity-60">
              已有克隆 Voice ID
            </label>

            <input
              type="text"
              value={profile.minimax.voiceId}
              onChange={(event) => {
                onChange(updateMiniMax(profile, {
                  voiceId: event.target.value,
                }));
              }}
              placeholder="粘贴已授权的 Voice ID"
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />

            <p className="mt-1 text-[10px] leading-relaxed opacity-50">
              第一版仅使用你已经在 MiniMax 创建、且拥有授权的 Voice ID；不会在 PWA 内上传样本或创建声音克隆。
            </p>
          </div>

          <div>
            <label className="mb-1 block opacity-60">
              声音语言
            </label>

            <select
              value={profile.minimax.language}
              onChange={(event) => {
                onChange(updateMiniMax(profile, {
                  language: event.target.value,
                }));
              }}
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            >
              {VOICE_LANGUAGE_OPTIONS.map((language) => (
                <option
                  key={language.value}
                  value={language.value}
                >
                  {language.label}
                </option>
              ))}
            </select>

            <p className="mt-1 text-[10px] leading-relaxed opacity-50">
              自动模式会跟随本次文本语言；指定语言会通过 MiniMax 的语言增强字段发送。若当前模型不支持该语言，以服务商实际回退结果为准。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block opacity-60">
                语速
              </label>

              <input
                type="number"
                min="0.5"
                max="2"
                step="0.05"
                value={profile.minimax.speed}
                onChange={(event) => {
                  onChange(updateMiniMax(profile, {
                    speed: event.target.value,
                  }));
                }}
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              />
            </div>

            <div>
              <label className="mb-1 block opacity-60">
                音量
              </label>

              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={profile.minimax.volume}
                onChange={(event) => {
                  onChange(updateMiniMax(profile, {
                    volume: event.target.value,
                  }));
                }}
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              />
            </div>

            <div>
              <label className="mb-1 block opacity-60">
                音调
              </label>

              <input
                type="number"
                min="-12"
                max="12"
                step="1"
                value={profile.minimax.pitch}
                onChange={(event) => {
                  onChange(updateMiniMax(profile, {
                    pitch: event.target.value,
                  }));
                }}
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              />
            </div>
          </div>

          <VoicePreviewBox
            voiceProfile={profile}
          />

          <p className="rounded-lg border border-black/10 px-2.5 py-2 text-[10px] leading-relaxed opacity-55 dark:border-white/10">
            这个项目使用本地 PWA 存储。以上声音资料与已生成的声音留笺只保存在当前浏览器的本地数据库内；清理站点数据或浏览器存储时会一并删除。
          </p>
        </div>
      )}
    </GlassCard>
  );
}
