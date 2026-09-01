import React from 'react';

import {
  MessageCircleMore,
} from 'lucide-react';

import {
  getVoiceExpressionMode,
  VOICE_EXPRESSION_MODES,
} from '../voiceExpressionGuides';

import {
  normalizeVoiceProfile,
} from '../realVoiceDefaults';

export default function VoiceExpressionGuidePanel({
  value,
  onChange,
}) {
  const profile = normalizeVoiceProfile(value);
  const expression = profile.voiceExpression;
  const selectedMode = getVoiceExpressionMode(expression.mode);

  const updateExpression = (patch) => {
    onChange({
      ...profile,
      voiceExpression: {
        ...expression,
        ...patch,

        // 第一版始终由系统限制为一轮一条。
        maxVoiceNotesPerReply: 1,
      },
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-black/10 px-3 py-3 dark:border-white/10">
      <div className="flex items-start gap-2">
        <MessageCircleMore className="mt-0.5 h-4 w-4 shrink-0" />

        <div>
          <h4 className="text-xs font-semibold">
            声音会在什么时候被留下
          </h4>

          <p className="mt-1 text-[10px] leading-relaxed opacity-55">
            这不是让角色每次都说话。它只是告诉角色：在哪些时刻，一段声音比一行文字更适合被你收到。
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block opacity-60">
          表达倾向
        </label>

        <select
          value={expression.mode}
          onChange={(event) => {
            updateExpression({
              mode: event.target.value,
            });
          }}
          className="w-full rounded-lg bg-black/5 p-2 outline-none dark:bg-white/10"
        >
          {VOICE_EXPRESSION_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>

        <p className="mt-1 text-[10px] leading-relaxed opacity-50">
          {selectedMode.description}
        </p>
      </div>

      {expression.mode === 'custom' && (
        <div>
          <label className="mb-1 block opacity-60">
            这个角色的声音表达习惯
          </label>

          <textarea
            rows={5}
            value={expression.customInstruction}
            onChange={(event) => {
              updateExpression({
                customInstruction: event.target.value,
              });
            }}
            placeholder="他不轻易留下声音。只有在夜晚、我明显疲惫、他想安慰我，或有一句话不想让我只靠眼睛读到时，才会发来一段很短的声音。语气克制，停顿自然，不应重复复述整段文字。"
            className="min-h-[112px] w-full resize-y rounded-lg bg-black/5 p-2 leading-relaxed outline-none dark:bg-white/10"
          />

          <p className="mt-1 text-[10px] leading-relaxed opacity-50">
            这段说明只会影响角色何时、为何留下声音，以及声音的表达感觉。文字回复仍会保留，且每轮最多生成一条短声音留笺。
          </p>
        </div>
      )}

      {expression.mode === 'off' && (
        <p className="rounded-lg bg-black/[0.04] px-2.5 py-2 text-[10px] leading-relaxed opacity-60 dark:bg-white/[0.07]">
          当前不会向角色注入主动留声规则。真实声音资料会继续保留，之后可随时重新开启。
        </p>
      )}
    </section>
  );
}
