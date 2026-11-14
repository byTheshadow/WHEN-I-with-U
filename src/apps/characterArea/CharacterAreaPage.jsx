import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Lock,
  Book,
  Pencil,
  Heart,
  Flame,
  Star,
  Moon,
  Key,
  Feather,
  Leaf,
  Ghost,
  Gem,
  Cloud,
  Sparkles,
  Coffee,
  Camera,
  Music,
} from 'lucide-react';
import {
  AUTO_ORGANIZE_MANUAL,
  AUTO_ORGANIZE_NIGHTLY,
  getAreaForChat,
  getAutoOrganizeMode,
  setAutoOrganizeMode,
} from './characterAreaService';
import CharacterAreaEntryList from './CharacterAreaEntryList';
import CharacterAreaOrganizeBar from './CharacterAreaOrganizeBar';
import { runPrivateAreaSession } from './privateAreaSession';
// ============================================================
// 角色专属区域页（切片 A）：
//   - 区域还没创建：显示一个锁住的占位，用户可以点"请 TA 整理一下"，让角色
//     按人设自己决定要不要此刻建一个（也允许角色这次先不建）。
//   - 区域已创建：显示区域的名称/图标/简介。条目列表和"同意/拒绝"翻开机制
//     是切片 B，这里只放一个空状态。
//   - 两种状态下都有"整理方式"开关（仅手动 / 每晚自动），存在 chats 表上。
//
// 全屏 overlay，不用整条顶栏——跟温室（HabitatRoom）、异地任务挑战同一个
// 做法：一个悬浮的圆形返回按钮叠在内容上面。颜色全部走全局主题变量。
// ============================================================

// 键必须覆盖 characterAreaParse.js 里 AREA_ICON_NAMES 的每一项。
const AREA_ICON_COMPONENTS = {
  Book,
  Pencil,
  Heart,
  Flame,
  Star,
  Moon,
  Key,
  Feather,
  Leaf,
  Ghost,
  Gem,
  Cloud,
  Sparkles,
  Coffee,
  Camera,
  Music,
};

const NOTICE_TEXT = {
  declined: 'TA 这次还不想建，过一阵子再来看看吧。',
  failed: '这次没有成功（可能是接口还没配置，或者网络出了问题），可以再试一次。',
};

const MODE_OPTIONS = [
  { id: AUTO_ORGANIZE_MANUAL, label: '仅手动', hint: '只有你点"整理"的时候，TA 才会整理。' },
  { id: AUTO_ORGANIZE_NIGHTLY, label: '每晚自动', hint: '每天晚上，TA 会自己整理一次。' },
];

const softBorder = 'color-mix(in srgb, var(--text-main) 14%, transparent)';

export default function CharacterAreaPage({ chatId, character, onBack }) {
  const [isLoading, setIsLoading] = useState(true);
  const [area, setArea] = useState(null);
  const [mode, setMode] = useState(AUTO_ORGANIZE_MANUAL);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [loadedArea, loadedMode] = await Promise.all([
          getAreaForChat(chatId),
          getAutoOrganizeMode(chatId),
        ]);

        if (cancelled) return;
        setArea(loadedArea);
        setMode(loadedMode);
      } catch (error) {
        console.warn('[CharacterAreaPage] 读取失败：', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const handleRequestCreation = async () => {
    if (isBusy) return;

    setIsBusy(true);
    setNotice('');

       const result = await runPrivateAreaSession({ chatId, character, source: 'manual' });

    if (result.status === 'created' || result.status === 'exists') {
      setArea(result.area);
    } else {
      setNotice(NOTICE_TEXT[result.status] || NOTICE_TEXT.failed);
    }

    setIsBusy(false);
  };

  const handleChangeMode = async (nextMode) => {
    if (nextMode === mode) return;

    const previous = mode;
    setMode(nextMode);

    try {
      await setAutoOrganizeMode(chatId, nextMode);
    } catch (error) {
      console.warn('[CharacterAreaPage] 保存整理方式失败：', error);
      setMode(previous);
    }
  };

  const AreaIcon = area ? AREA_ICON_COMPONENTS[area.icon] || Book : Lock;
  const activeModeHint = MODE_OPTIONS.find((option) => option.id === mode)?.hint || '';

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden animate-fade-in-up"
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <div className="relative flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={onBack}
          title="返回"
          aria-label="返回"
          className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-95"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
            borderColor: softBorder,
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {isLoading ? null : (
          <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-12 pt-16">
            <section
              className="flex flex-col items-center gap-3 rounded-3xl border px-6 py-8 text-center"
              style={{ background: 'var(--card-bg)', borderColor: softBorder }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: softBorder,
                  opacity: area ? 1 : 0.75,
                }}
              >
                <AreaIcon className="h-7 w-7" />
              </div>

              {area ? (
                <>
                  <h2 className="text-lg font-semibold">{area.name}</h2>
                  {area.intro ? (
                    <p className="text-sm" style={{ color: 'var(--text-sub)' }}>
                      {area.intro}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">TA 好像有自己的小秘密……</h2>
                  <p className="text-sm" style={{ color: 'var(--text-sub)' }}>
                    等 TA 愿意的时候，会在这里留下一本只属于 TA 的小本子。
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestCreation}
                    disabled={isBusy}
                    className="mt-2 rounded-full border px-5 py-2 text-sm transition-transform active:scale-95 disabled:opacity-60"
                    style={{
                      color: 'var(--text-main)',
                      background: 'var(--bg-surface)',
                      borderColor: softBorder,
                    }}
                  >
                    {isBusy ? 'TA 正在想……' : '请 TA 整理一下'}
                  </button>
                  {notice ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {notice}
                    </p>
                  ) : null}
                </>
              )}
            </section>

           
            {area ? <CharacterAreaOrganizeBar chatId={chatId} character={character} /> : null}
            {area ? <CharacterAreaEntryList chatId={chatId} area={area} /> : null}
            <section
              className="flex flex-col gap-3 rounded-3xl border px-5 py-5"
              style={{ background: 'var(--card-bg)', borderColor: softBorder }}
            >
              <div className="text-sm font-medium">整理方式</div>

              <div
                className="flex rounded-full border p-1"
                style={{ borderColor: softBorder, background: 'var(--bg-surface)' }}
              >
                {MODE_OPTIONS.map((option) => {
                  const isActive = option.id === mode;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleChangeMode(option.id)}
                      className="flex-1 rounded-full px-3 py-1.5 text-xs transition-colors"
                      style={{
                        color: isActive ? 'var(--bg-main)' : 'var(--text-sub)',
                        background: isActive ? 'var(--text-main)' : 'transparent',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {activeModeHint}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}