// src/apps/fiction/FictionWizard.jsx
//
// 新建向导的容器：三步、进度条、保存草稿、退出确认。
// 不用 position: fixed，返回按钮、底栏、抽屉都相对 .fic-col 定位。
//
// 编辑模式（editSaveId 有值）：对一份已经创建好的存档重新打开这三步表单。
//   - 玩法形式锁定，不能改（WizardStepPremise 的 lockMode）
//   - 没有「保存为草稿」（那会把正式存档变回草稿）；最后一步「完成 · 保存设定」，
//     用 saveWizardEdits 写回，已玩过的剧情原样保留
//   - 退出时只有「放弃修改」和「继续编辑」

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import WizardStepPremise from './WizardStepPremise';
import WizardStepCast from './WizardStepCast';
import WizardStepRules from './WizardStepRules';
import {
  WIZARD_STEPS,
  WIZARD_STEP_COUNT,
  buildDefaultWizardForm,
  loadWizardForm,
  saveWizardEdits,
  saveWizardForm,
  validateWizardStep,
} from './fictionWizardService';
import './fictionWizard.css';
import './fictionWizardCast.css';

const FictionWizard = ({ draftId = null, editSaveId = null, onExit }) => {
  const isEdit = editSaveId != null;
  const loadId = isEdit ? editSaveId : draftId;

  const [form, setForm] = useState(buildDefaultWizardForm);
  const [step, setStep] = useState(0);
  const [saveId, setSaveId] = useState(draftId);
  const [loading, setLoading] = useState(Boolean(loadId));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [toast, setToast] = useState('');

  const toastTimerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(''), 2200);
  }, []);

  // 打开已有草稿，或（编辑模式）读出正式存档的设定
  useEffect(() => {
    if (!loadId) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const loaded = await loadWizardForm(loadId);

        if (cancelled) return;

        if (!loaded) {
          onExit?.({ message: isEdit ? '这份存档找不到了' : '这份草稿找不到了' });
          return;
        }

        if (isEdit && loaded.isDraft) {
          onExit?.({ message: '这份存档还没有完成创建' });
          return;
        }

        setForm(loaded.form);
        setStep(isEdit ? 0 : Math.min(loaded.step, WIZARD_STEP_COUNT - 1));
      } catch (error) {
        console.warn('[Fiction] 读取草稿失败：', error);
        if (!cancelled) onExit?.({ message: isEdit ? '读取设定失败' : '读取草稿失败' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // onExit 来自父组件，换引用不应该重新读草稿
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId]);

  // 换步骤时回到顶部
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: 0 });
  }, [step]);

  const patchForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const persistDraft = async () => {
    const id = await saveWizardForm({ saveId, form, step, finish: false });

    setSaveId(id);
    setDirty(false);

    return id;
  };

  const handleSaveDraft = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await persistDraft();
      showToast('草稿已保存');
    } catch (error) {
      console.warn('[Fiction] 保存草稿失败：', error);
      showToast('保存失败，请再试一次');
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    if (busy || loading) return;

    const message = validateWizardStep(step, form);

    if (message) {
      showToast(message);
      return;
    }

    if (step < WIZARD_STEP_COUNT - 1) {
      setStep(step + 1);
      return;
    }

    setBusy(true);

    try {
      if (isEdit) {
        await saveWizardEdits({ saveId: editSaveId, form });
        onExit?.({ edited: true, message: '设定已保存' });
      } else {
        await saveWizardForm({ saveId, form, step, finish: true });
        onExit?.({ created: true, message: '存档已创建' });
      }
    } catch (error) {
      if (error && typeof error.step === 'number') {
        setStep(error.step);
        showToast(error.message);
      } else {
        console.warn('[Fiction] 创建存档失败：', error);
        showToast(isEdit ? '保存失败，请再试一次' : '创建失败，请再试一次');
      }

      setBusy(false);
    }
  };

  const handleBack = () => {
    if (busy) return;

    if (loading || !dirty) {
      onExit?.({});
      return;
    }

    setLeaveOpen(true);
  };

  const handleSaveAndLeave = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await persistDraft();
      onExit?.({ message: '草稿已保存' });
    } catch (error) {
      console.warn('[Fiction] 保存草稿失败：', error);
      setLeaveOpen(false);
      showToast('保存失败，请再试一次');
      setBusy(false);
    }
  };

  const current = WIZARD_STEPS[step];
  const isLast = step === WIZARD_STEP_COUNT - 1;
  const nextLabel = isLast
    ? (isEdit ? '完成 · 保存设定' : '完成 · 创建存档')
    : `下一步 · ${WIZARD_STEPS[step + 1].zh}`;
  const flowLabel = isEdit ? '编辑设定' : '新建';

  const renderStep = () => {
    if (step === 0) {
      return <WizardStepPremise form={form} onChange={patchForm} onToast={showToast} lockMode={isEdit} />;
    }

    if (step === 1) {
      return <WizardStepCast form={form} onChange={patchForm} onToast={showToast} />;
    }

    return <WizardStepRules form={form} onChange={patchForm} onToast={showToast} />;
  };

  return (
    <div className="fic-col fic-w">
      <button
        type="button"
        className="fic-btn-reset fic-round-btn fic-back"
        aria-label={isEdit ? '退出编辑' : '退出新建'}
        onClick={handleBack}
      >
        <ArrowLeft size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>

      <div className="fic-scroll fic-w-scroll" ref={scrollRef}>
        <div className="fic-vol-row">
          <span className="fic-vol">STEP {step + 1} / {WIZARD_STEP_COUNT}</span>
        </div>

        <header className="fic-head">
          <div className="fic-eyebrow">{current.kicker}</div>
          <h1 className="fic-title">{current.en}</h1>
          <div className="fic-title-zh">{current.zh}</div>
        </header>

        <div className="fic-w-progress" aria-hidden="true">
          {WIZARD_STEPS.map((item, index) => (
            <span key={item.id} className={`fic-w-seg ${index <= step ? 'is-on' : ''}`} />
          ))}
        </div>
        <div className="fic-w-progress-label">{flowLabel} {step + 1}/{WIZARD_STEP_COUNT} · {current.zh}</div>

        {loading ? <div className="fic-w-loading">正在读取草稿…</div> : renderStep()}
      </div>

      <div className="fic-foot">
        <div className="fic-w-foot-inner">
          <button
            type="button"
            className="fic-btn-reset fic-w-next"
            disabled={busy || loading}
            onClick={handleNext}
          >
            {busy ? '正在保存' : nextLabel}
          </button>
          <div className="fic-w-sub-row">
            {step > 0 && (
              <button
                type="button"
                className="fic-btn-reset fic-w-sub-btn"
                disabled={busy || loading}
                onClick={() => setStep(step - 1)}
              >
                上一步
              </button>
            )}
            {!isEdit && (
              <button
                type="button"
                className="fic-btn-reset fic-w-sub-btn"
                disabled={busy || loading}
                onClick={handleSaveDraft}
              >
                保存为草稿
              </button>
            )}
          </div>
        </div>
      </div>

      {leaveOpen && (
        <>
          <button
            type="button"
            className="fic-btn-reset fic-mask"
            aria-label="关闭"
            onClick={() => !busy && setLeaveOpen(false)}
          />
          <div className="fic-sheet" role="dialog" aria-label={isEdit ? '退出编辑' : '退出新建'}>
            <div className="fic-sheet-grab" />
            <div className="fic-sheet-name">{isEdit ? '要放弃这次修改吗？' : '要退出新建吗？'}</div>
            <div className="fic-sheet-meta">
              {isEdit ? '改过的设定还没有保存，退出后会恢复成原来的' : '已填写的内容还没有保存'}
            </div>
            <div className="fic-sheet-actions">
              {!isEdit && (
                <button
                  type="button"
                  className="fic-btn-reset fic-sheet-btn"
                  disabled={busy}
                  onClick={handleSaveAndLeave}
                >
                  {busy ? '正在保存' : '保存草稿并退出'}
                </button>
              )}
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn is-danger"
                disabled={busy}
                onClick={() => onExit?.({})}
              >
                {isEdit ? '放弃修改，直接退出' : '不保存，直接退出'}
              </button>
              <button
                type="button"
                className="fic-btn-reset fic-sheet-btn"
                disabled={busy}
                onClick={() => setLeaveOpen(false)}
              >
                继续编辑
              </button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="fic-toast fic-w-toast" role="status">{toast}</div>}
    </div>
  );
};

export default FictionWizard;