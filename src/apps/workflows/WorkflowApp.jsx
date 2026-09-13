import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ImagePlus,
  Camera,
  Shuffle,
  Upload,
  Moon,
  Sun
} from 'lucide-react';


import db from '../../db';
import GlassCard from '../../components/GlassCard';
import {
  getAllWorkflowsWithContext,
  getWorkflowCandidateChats,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowEnabled
} from '../../services/workflow/workflowService';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

// 用于封面横幅的撕纸边缘（纯 CSS clip-path，不需要额外图片资源）
const TORN_EDGE_CLIP =
  'polygon(0% 0%, 100% 0%, 100% 90%, 95% 100%, 90% 88%, 85% 100%, 80% 88%, 75% 100%, 70% 88%, 65% 100%, 60% 88%, 55% 100%, 50% 88%, 45% 100%, 40% 88%, 35% 100%, 30% 88%, 25% 100%, 20% 88%, 15% 100%, 10% 88%, 5% 100%, 0% 88%)';

const formatWeekdays = (weekdays) => {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return '未设置';
  if (weekdays.length === 7) return '每天';

  const sorted = [...weekdays].sort();
  return sorted.map((day) => WEEKDAY_LABELS[day]).join('、');
};

const StatusBadge = ({ workflow }) => {
  if (!workflow.lastRunAt) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-45"
      >
        <CircleDashed className="h-3 w-3" />
        尚未运行
      </span>
    );
  }

  if (workflow.lastRunStatus === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70">
        <CircleAlert className="h-3 w-3" />
        {workflow.lastRunError
          ? workflow.lastRunError.slice(0, 24)
          : '上次执行失败'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-55">
      <CheckCircle2 className="h-3 w-3" />
      已送达
    </span>
  );
};

const WashiTape = ({ rotate = -6 }) => (
  <span
    className="pointer-events-none absolute -top-2 left-5 h-3.5 w-10 opacity-[0.14]"
    style={{
      backgroundColor: 'var(--text-main)',
      transform: `rotate(${rotate}deg)`
    }}
  />
);

const WorkflowCard = ({
  workflow,
  rotate,
  onEdit,
  onToggleEnabled,
  onRequestDelete,
  confirmingDelete,
  onCancelDelete,
  onConfirmDelete
}) => {
  return (
    <div
      className="relative"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <WashiTape rotate={rotate < 0 ? 8 : -8} />

      <GlassCard className="cursor-default p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
              {workflow.chat?.title || workflow.character?.name || '未命名聊天'}
            </p>

            <h4 className="mt-1 truncate font-serif text-[16px] font-semibold">
              {workflow.name || '未命名工作流'}
            </h4>

            <p className="mt-1 text-[11px] opacity-55">
              {workflow.time || '--:--'} · {formatWeekdays(workflow.weekdays)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleEnabled(workflow)}
            aria-label={workflow.enabled ? '暂停工作流' : '启用工作流'}
            className="relative h-5 w-9 shrink-0 rounded-full border transition-colors"
            style={{
              borderColor: 'var(--card-border)',
              backgroundColor: workflow.enabled
                ? 'var(--text-main)'
                : 'transparent'
            }}
          >
            <span
              className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
              style={{
                left: workflow.enabled ? '18px' : '2px',
                backgroundColor: workflow.enabled
                  ? 'var(--bg-main)'
                  : 'var(--text-main)',
                opacity: workflow.enabled ? 1 : 0.6
              }}
            />
          </button>
        </div>

        {workflow.goal && (
          <p
            className="mt-3 border-l-2 pl-3 font-serif text-[12px] italic leading-relaxed opacity-70"
            style={{ borderColor: 'var(--card-border)' }}
          >
            "{workflow.goal}"
          </p>
        )}

        <div
          className="mt-3 flex items-center justify-between border-t pt-2.5"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <StatusBadge workflow={workflow} />

          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="opacity-60">删除这条工作流？</span>
              <button
                type="button"
                onClick={() => onConfirmDelete(workflow)}
                className="font-semibold underline underline-offset-2"
              >
                确认
              </button>
              <button type="button" onClick={onCancelDelete} className="opacity-50">
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onEdit(workflow)}
                aria-label="编辑"
                className="opacity-45 transition-opacity hover:opacity-90"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onRequestDelete(workflow.id)}
                aria-label="删除"
                className="opacity-45 transition-opacity hover:opacity-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

const WeekdayPicker = ({ value, onChange }) => (
  <div className="flex gap-1.5">
    {WEEKDAY_LABELS.map((label, index) => {
      const active = value.includes(index);

      return (
        <button
          key={label}
          type="button"
          onClick={() =>
            onChange(
              active
                ? value.filter((day) => day !== index)
                : [...value, index].sort()
            )
          }
          className="flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: active ? 'var(--text-main)' : 'transparent',
            color: active ? 'var(--bg-main)' : 'var(--text-main)'
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const WorkflowFormSheet = ({ chat, workflow, onClose, onSaved }) => {
  const isEdit = Boolean(workflow);

  const [name, setName] = useState(workflow?.name || '');
  const [time, setTime] = useState(workflow?.time || '08:00');
  const [weekdays, setWeekdays] = useState(
    workflow?.weekdays || [0, 1, 2, 3, 4, 5, 6]
  );
  const [goal, setGoal] = useState(workflow?.goal || '');
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  const targetChat = workflow?.chat || chat;
  const targetCharacter = workflow?.character || chat?.character;

  const handleSave = useCallback(async () => {
    setErrorText('');

    if (!time) {
      setErrorText('请填写触发时间。');
      return;
    }

    if (weekdays.length === 0) {
      setErrorText('请至少选择一个星期。');
      return;
    }

    setIsSaving(true);

    try {
      if (isEdit) {
        await updateWorkflow(workflow.id, {
          name,
          time,
          weekdays,
          goal,
          enabled
        });
      } else {
        await createWorkflow({
          chatId: targetChat.id,
          characterId: targetChat.characterId,
          name,
          time,
          weekdays,
          goal,
          enabled
        });
      }

      onSaved();
    } catch (error) {
      setErrorText(error?.message || '保存失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  }, [isEdit, workflow, targetChat, name, time, weekdays, goal, enabled, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div
        className="max-h-[88vh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl border-t p-5 pb-8"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--card-border)'
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
              {targetCharacter?.name || '未知角色'}
            </p>
            <h3 className="font-serif text-lg font-semibold">
              {isEdit ? '编辑工作流' : '新建工作流'}
            </h3>
          </div>

          <button type="button" onClick={onClose} className="opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
              名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="比如：早安问候"
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
                时间
              </label>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--card-border)' }}
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <span className="text-[11px] opacity-60">启用</span>
              <button
                type="button"
                onClick={() => setEnabled((prev) => !prev)}
                className="relative h-5 w-9 rounded-full border"
                style={{
                  borderColor: 'var(--card-border)',
                  backgroundColor: enabled ? 'var(--text-main)' : 'transparent'
                }}
              >
                <span
                  className="absolute top-0.5 h-3.5 w-3.5 rounded-full"
                  style={{
                    left: enabled ? '18px' : '2px',
                    backgroundColor: enabled
                      ? 'var(--bg-main)'
                      : 'var(--text-main)'
                  }}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
              重复星期
            </label>
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
              目标 / 意图
            </label>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="告诉 AI 这次主动联系想做什么，比如提醒喝水、查一下今天天气再关心一句"
              rows={4}
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>

          {errorText && (
            <p className="text-[12px] opacity-70">{errorText}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-2xl py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: 'var(--text-main)',
              color: 'var(--bg-main)'
            }}
          >
            {isSaving ? '保存中…' : isEdit ? '保存修改' : '创建工作流'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatPickerSheet = ({ chats, onPick, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
    <div
      className="max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl border-t p-5 pb-8"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--card-border)'
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">挂在哪个聊天下？</h3>
        <button type="button" onClick={onClose} className="opacity-50">
          <X className="h-5 w-5" />
        </button>
      </div>

      {chats.length === 0 ? (
        <p className="py-6 text-center text-sm opacity-50">
          还没有任何聊天，先去开始一段对话吧。
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onPick(chat)}
              className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <img
                src={chat.character?.avatar || ''}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                style={{ backgroundColor: 'var(--control-soft-bg)' }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {chat.character?.name || '未知角色'}
                </p>
                <p className="truncate text-[11px] opacity-50">
                  {chat.title || '默认对话'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

const VISUAL_STORAGE_KEY = 'interactive-polaroid-visuals';

const readCharacterVisuals = () => {
  try {
    return JSON.parse(localStorage.getItem(VISUAL_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveCharacterVisuals = (value) => {
  localStorage.setItem(VISUAL_STORAGE_KEY, JSON.stringify(value));
};

const PolaroidCard = ({ character, index, onClick }) => {
  const rotations = [-6, 3, -4, 5, -2];
  const rotation = rotations[index % rotations.length];

  return (
    <button
      type="button"
      onClick={onClick}
      className="ip-polaroid group"
      style={{
        '--ip-rotation': `${rotation}deg`,
        '--ip-offset': `${index % 2 === 0 ? 16 : -10}px`
      }}
    >
      <div className="ip-polaroid-image">
        {character.avatar ? (
          <img src={character.avatar} alt={character.name || ''} />
        ) : (
          <div className="ip-empty-image">
            <Camera size={28} strokeWidth={1} />
          </div>
        )}
      </div>

      <div className="ip-polaroid-name">
        {character.name || '未命名角色'}
      </div>

      <div className="ip-polaroid-index">
        {String(index + 1).padStart(2, '0')}
      </div>
    </button>
  );
};

const UploadVisualButton = ({ label, onChange }) => (
  <label className="ip-upload-option">
    <span>
      <Upload size={14} />
      {label}
    </span>
    <small>选择图片</small>
    <input
      type="file"
      accept="image/*"
      onChange={onChange}
    />
  </label>
);

const TimelineEvent = ({ workflow, index }) => {
  const date = workflow.lastRunAt
    ? new Date(workflow.lastRunAt).toLocaleDateString('zh-CN')
    : '未运行';

  return (
    <article className="ip-event">
      <div className="ip-event-dot" />

      <div className="ip-event-date">
        {date}
      </div>

      <div className="ip-event-content">
        <h3>
          {workflow.name || '未命名工作流'}
        </h3>

        <p>
          {workflow.goal || '这是一段尚未命名的角色记忆。'}
        </p>

        <div className="ip-event-meta">
          <span>
            {workflow.enabled ? 'ACTIVE' : 'PAUSED'}
          </span>

          <span>
            {workflow.time || '--:--'}
          </span>

          {workflow.lastRunStatus === 'error' && (
            <span>ERROR</span>
          )}
        </div>
      </div>
    </article>
  );
};

export const WorkflowApp = ({ onBackHub }) => {
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [candidateChats, setCandidateChats] = useState([]);
  const [isPickingChat, setIsPickingChat] = useState(false);
  const [formTarget, setFormTarget] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [visuals, setVisuals] = useState(readCharacterVisuals);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [isDark, setIsDark] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await getAllWorkflowsWithContext();
      setWorkflows(data);
    } catch (error) {
      console.error('[WorkflowApp] 读取工作流失败：', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groupedByCharacter = useMemo(() => {
    const groups = new Map();

    for (const workflow of workflows) {
      const key = workflow.characterId || 'unknown';

      if (!groups.has(key)) {
        groups.set(key, {
          character: workflow.character || {
            id: key,
            name: '未知角色',
            avatar: ''
          },
          items: []
        });
      }

      groups.get(key).items.push(workflow);
    }

    return Array.from(groups.values());
  }, [workflows]);

  const selectedGroup = useMemo(
    () =>
      groupedByCharacter.find(
        (group) => String(group.character?.id) === String(selectedCharacterId)
      ),
    [groupedByCharacter, selectedCharacterId]
  );

  const activeCount = workflows.filter(
    (workflow) => workflow.enabled
  ).length;

  const handleOpenCreate = useCallback(async () => {
    try {
      const chats = await getWorkflowCandidateChats();
      setCandidateChats(chats);
      setIsPickingChat(true);
    } catch (error) {
      console.error('[WorkflowApp] 读取聊天列表失败：', error);
    }
  }, []);

  const handleToggleEnabled = useCallback(
    async (workflow) => {
      await setWorkflowEnabled(workflow.id, !workflow.enabled);
      await reload();
    },
    [reload]
  );

  const handleConfirmDelete = useCallback(
    async (workflow) => {
      await deleteWorkflow(workflow.id);
      setConfirmingDeleteId(null);
      await reload();
    },
    [reload]
  );

  const updateVisual = useCallback(
    (characterId, type, file) => {
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (event) => {
        const next = {
          ...visuals,
          [characterId]: {
            ...(visuals[characterId] || {}),
            [type]: event.target.result
          }
        };

        setVisuals(next);
        saveCharacterVisuals(next);
      };

      reader.readAsDataURL(file);
    },
    [visuals]
  );

  const addMemoryImage = useCallback(
    (characterId, file) => {
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (event) => {
        const current = visuals[characterId] || {};
        const memories = current.memories || [];

        const next = {
          ...visuals,
          [characterId]: {
            ...current,
            memories: [
              {
                id: Date.now(),
                image: event.target.result,
                date: new Date().toLocaleDateString('zh-CN'),
                title: '新的视觉记忆'
              },
              ...memories
            ]
          }
        };

        setVisuals(next);
        saveCharacterVisuals(next);
      };

      reader.readAsDataURL(file);
    },
    [visuals]
  );

  const getCharacterVisual = (character) => {
    const characterId = character?.id;
    const saved = visuals[characterId] || {};

    return {
      avatar: saved.avatar || character?.avatar || '',
      banner: saved.banner || character?.avatar || '',
      memories: saved.memories || []
    };
  };

  const renderArchive = () => (
    <div className={`interactive-polaroid ${isDark ? 'ip-dark' : ''}`}>
      <header className="ip-topbar">
        <button
          type="button"
          onClick={onBackHub}
          className="ip-logo"
        >
          INTERACTIVE / POLAROID
        </button>

        <div className="ip-top-actions">
          <button
            type="button"
            className="ip-icon-button"
            onClick={() => setIsDark((value) => !value)}
            aria-label="切换主题"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="button"
            className="ip-icon-button"
            onClick={handleOpenCreate}
            aria-label="新建工作流"
          >
            <Plus size={17} />
          </button>
        </div>
      </header>

      <main className="ip-page">
        <section className="ip-hero">
          <div>
            <p className="ip-eyebrow">
              CHARACTER ARCHIVE / PERSONAL TIMELINE
            </p>

            <h1>
              Every
              <br />
              person
              <br />
              has a side.
            </h1>
          </div>

          <div className="ip-hero-note">
            <p>
              一个角色不是一张头像，而是一组持续发生的时间、地点、片段与未完成的关系。
            </p>

            <span>
              {isLoading
                ? 'LOADING ARCHIVE…'
                : `${activeCount} / ${workflows.length} WORKFLOWS ACTIVE`}
            </span>
          </div>
        </section>

        <div className="ip-section-line">
          <span>01 / PORTRAITS</span>
        </div>

        {groupedByCharacter.length === 0 && !isLoading && (
          <div className="ip-empty-archive">
            <Camera size={34} strokeWidth={1} />
            <p>还没有角色记忆</p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="ip-underlined-action"
            >
              创建第一条工作流
            </button>
          </div>
        )}

        <section className="ip-wall">
          {groupedByCharacter.map((group, index) => (
            <PolaroidCard
              key={group.character?.id || index}
              character={{
                ...group.character,
                avatar: getCharacterVisual(group.character).avatar
              }}
              index={index}
              onClick={() => {
                setSelectedCharacterId(group.character?.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ))}

          <button
            type="button"
            className="ip-add-polaroid"
            onClick={handleOpenCreate}
          >
            <Plus size={32} strokeWidth={1} />
            <span>ADD MEMORY</span>
          </button>
        </section>

        <div className="ip-wall-caption">
          MOVE THROUGH THE WALL / CLICK TO ENTER
        </div>

        <div className="ip-section-line">
          <span>THE ARCHIVE IS NEVER FINISHED</span>
        </div>

        <section className="ip-workflow-strip">
          <div>
            <p className="ip-eyebrow">STANDING ROUTINES</p>
            <h2>工作流仍在继续。</h2>
          </div>

          <button
            type="button"
            className="ip-text-button"
            onClick={handleOpenCreate}
          >
            新建工作流
            <ArrowRight size={14} />
          </button>
        </section>
      </main>
    </div>
  );

  const renderCharacterDetail = () => {
    if (!selectedGroup) return null;

    const character = selectedGroup.character;
    const characterId = character?.id;
    const visual = getCharacterVisual(character);

    return (
      <div className={`interactive-polaroid ${isDark ? 'ip-dark' : ''}`}>
        <header className="ip-topbar">
          <button
            type="button"
            onClick={() => setSelectedCharacterId(null)}
            className="ip-logo"
          >
            INTERACTIVE / POLAROID
          </button>

          <div className="ip-top-actions">
            <button
              type="button"
              className="ip-icon-button"
              onClick={() => setIsDark((value) => !value)}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              className="ip-icon-button"
              onClick={() => setSelectedCharacterId(null)}
            >
              <ArrowLeft size={17} />
            </button>
          </div>
        </header>

        <main className="ip-page ip-detail-page">
          <div className="ip-detail-head">
            <button
              type="button"
              className="ip-back-button"
              onClick={() => setSelectedCharacterId(null)}
            >
              <ArrowLeft size={14} />
              RETURN TO ARCHIVE
            </button>

            <div className="ip-detail-meta">
              <span>CHARACTER / {characterId}</span>
              <span>MEMORIES / {selectedGroup.items.length}</span>
            </div>
          </div>

          <section className="ip-detail-title">
            <p className="ip-eyebrow">
              PRIVATE VISUAL DIARY
            </p>

            <h1>
              {character?.name || '未命名角色'}
            </h1>
          </section>

          <section className="ip-profile-stage">
            <div className="ip-banner">
              {visual.banner ? (
                <img src={visual.banner} alt="" />
              ) : (
                <div className="ip-banner-placeholder">
                  <ImagePlus size={38} strokeWidth={1} />
                  <span>UPLOAD BANNER</span>
                </div>
              )}

              <div className="ip-banner-overlay" />

              <div className="ip-banner-text">
                <small>CHARACTER / {characterId}</small>
                <p>
                  这里记录着与这个角色有关的时间、习惯和正在发生的事情。
                </p>
              </div>

              <label className="ip-floating-upload">
                <ImagePlus size={17} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    updateVisual(
                      characterId,
                      'banner',
                      event.target.files?.[0]
                    );
                    event.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="ip-avatar-wrap">
              <div className="ip-avatar">
                {visual.avatar ? (
                  <img src={visual.avatar} alt={character?.name || ''} />
                ) : (
                  <div className="ip-avatar-placeholder">
                    <Camera size={30} strokeWidth={1} />
                  </div>
                )}

                <div className="ip-avatar-label">
                  {character?.name || 'UNKNOWN'} / {characterId}
                </div>
              </div>

              <label className="ip-avatar-upload">
                <ImagePlus size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    updateVisual(
                      characterId,
                      'avatar',
                      event.target.files?.[0]
                    );
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </section>

          <div className="ip-detail-tools">
            <button
              type="button"
              className="ip-tool-button"
              onClick={() => setUploadTarget('memory')}
            >
              <ImagePlus size={14} />
              ADD MEMORY
            </button>

            <button
              type="button"
              className="ip-tool-button"
              onClick={handleOpenCreate}
            >
              <Plus size={14} />
              ADD WORKFLOW
            </button>

            <button
              type="button"
              className="ip-tool-button"
              onClick={() => {
                const reordered = [...workflows].sort(
                  () => Math.random() - 0.5
                );
                setWorkflows(reordered);
              }}
            >
              <Shuffle size={14} />
              REARRANGE
            </button>
          </div>

          {visual.memories.length > 0 && (
            <section className="ip-memory-strip">
              {visual.memories.map((memory) => (
                <div
                  className="ip-memory-photo"
                  key={memory.id}
                >
                  <img src={memory.image} alt="" />
                  <span>{memory.date}</span>
                </div>
              ))}
            </section>
          )}

          <section className="ip-timeline">
            <h2>
              A LINE OF
              <br />
              FRAGMENTS.
            </h2>

            {selectedGroup.items.length === 0 ? (
              <div className="ip-empty-timeline">
                这个角色还没有被记录。
              </div>
            ) : (
              selectedGroup.items.map((workflow, index) => (
                <TimelineEvent
                  key={workflow.id}
                  workflow={workflow}
                  index={index}
                />
              ))
            )}
          </section>
        </main>

        <input
          id="ip-memory-upload"
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            addMemoryImage(
              characterId,
              event.target.files?.[0]
            );
            event.target.value = '';
            setUploadTarget(null);
          }}
        />

        {uploadTarget === 'memory' && (
          <label
            htmlFor="ip-memory-upload"
            className="ip-memory-upload-modal"
            onClick={() => setUploadTarget(null)}
          >
            <div
              className="ip-memory-upload-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setUploadTarget(null)}
                className="ip-close-button"
              >
                <X size={18} />
              </button>

              <p className="ip-eyebrow">
                ADD TO TIMELINE
              </p>

              <h2>放入一张新的记忆照片</h2>

              <span>
                点击此处选择图片，它会被保存在当前角色的时间轴中。
              </span>
            </div>
          </label>
        )}
      </div>
    );
  };

  return (
    <>
      {selectedCharacterId
        ? renderCharacterDetail()
        : renderArchive()}

      {isPickingChat && (
        <ChatPickerSheet
          chats={candidateChats}
          onClose={() => setIsPickingChat(false)}
          onPick={(chat) => {
            setIsPickingChat(false);
            setFormTarget({ chat });
          }}
        />
      )}

      {formTarget && (
        <WorkflowFormSheet
          chat={formTarget.chat}
          workflow={formTarget.workflow}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            void reload();
          }}
        />
      )}
    </>
  );
};

export default WorkflowApp;
