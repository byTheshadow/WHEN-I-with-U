import React, { useState } from 'react';
import { AudioLines, RefreshCw } from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import {
  createDefaultVoiceProfile,
  normalizeVoiceProfile,
} from '../realVoiceDefaults';
import { fetchMiniMaxModels } from '../minimaxClient';

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
      setModelError(error?.message || '模型列表没有顺利抵达。');
    } finally {
      setIsLoadingModels(false);
    }
  };

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
          <span className="block text-xs font-semibold">启用真实声音</span>
          <span className="mt-0.5 block text-[10px] opacity-55">
            关闭后，角色不会调用真实语音生成。
          </span>
        </div>

        <input
          type="checkbox"
          checked={profile.enabled}
          onChange={(event) => updateProfile({
            enabled: event.target.checked,
          })}
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
                角色会判断这一段更适合文字，还是额外留下声音。
              </span>
            </div>

            <input
              type="checkbox"
              checked={profile.aiMaySendVoice}
              onChange={(event) => updateProfile({
                aiMaySendVoice: event.target.checked,
              })}
              className="h-4 w-4 accent-current"
            />
          </label>

          <div>
            <label className="mb-1 block opacity-60">MiniMax API Key</label>
            <input
              type="password"
              value={profile.minimax.apiKey}
              onChange={(event) => onChange(updateMiniMax(profile, {
                apiKey: event.target.value,
              }))}
              placeholder="粘贴 API Key"
              autoComplete="off"
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />
          </div>

          <div>
            <label className="mb-1 block opacity-60">MiniMax Group ID</label>
            <input
              type="text"
              value={profile.minimax.groupId}
              onChange={(event) => onChange(updateMiniMax(profile, {
                groupId: event.target.value,
              }))}
              placeholder="例如 grp-..."
              autoComplete="off"
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />
          </div>

          <div>
            <label className="mb-1 block opacity-60">
              可选代理地址
            </label>
            <input
              type="url"
              value={profile.minimax.proxyBaseUrl}
              onChange={(event) => onChange(updateMiniMax(profile, {
                proxyBaseUrl: event.target.value,
              }))}
              placeholder="留空时直接连接 MiniMax"
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />
            <p className="mt-1 text-[10px] leading-relaxed opacity-50">
              只有浏览器出现 CORS 错误时才需要填写。代理须兼容 MiniMax 的
              {' '}/v1/models 与 /v1/t2a_v2 路径。
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="opacity-60">语音模型</label>

              <button
                type="button"
                onClick={handleLoadModels}
                disabled={isLoadingModels}
                className="flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-[10px] font-semibold transition-opacity disabled:opacity-45 dark:bg-white/10"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                <span>{isLoadingModels ? '读取中' : '读取模型'}</span>
              </button>
            </div>

            <select
              value={profile.minimax.modelId}
              onChange={(event) => onChange(updateMiniMax(profile, {
                modelId: event.target.value,
              }))}
              disabled={models.length === 0}
              className="w-full rounded-lg bg-black/5 p-2 outline-none disabled:opacity-45 dark:bg-white/10"
            >
              <option value="">
                {models.length > 0 ? '选择一个语音模型' : '请先读取模型'}
              </option>

              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
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
              onChange={(event) => onChange(updateMiniMax(profile, {
                voiceId: event.target.value,
              }))}
              placeholder="粘贴已授权的 Voice ID"
              className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
            />
            <p className="mt-1 text-[10px] leading-relaxed opacity-50">
              第一版仅使用你已在 MiniMax 创建、并拥有授权的 Voice ID；不在 PWA 内上传样本或创建克隆声音。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block opacity-60">语速</label>
              <input
                type="number"
                min="0.5"
                max="2"
                step="0.05"
                value={profile.minimax.speed}
                onChange={(event) => onChange(updateMiniMax(profile, {
                  speed: event.target.value,
                }))}
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              />
            </div>

            <div>
              <label className="mb-1 block opacity-60">音量</label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={profile.minimax.volume}
                onChange={(event) => onChange(updateMiniMax(profile, {
                  volume: event.target.value,
                }))}
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              />
            </div>

            <div>
              <label className="mb-1 block opacity-60">音调</label>
              <input
                type="number"
                min="-12"
                max="12"
                step="1"
                value={profile.minimax.pitch}
                onChange={(event) => onChange(updateMiniMax(profile, {
                  pitch: event.target.value,
                }))}
                className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
              />
            </div>
          </div>

          <p className="rounded-lg border border-black/10 px-2.5 py-2 text-[10px] leading-relaxed opacity-55 dark:border-white/10">
            此项目为本地 PWA，以上资料只保存在当前浏览器的本地数据库中，不会上传到项目服务器。清理浏览器站点数据会一并清除。
          </p>
        </div>
      )}
    </GlassCard>
  );
}
