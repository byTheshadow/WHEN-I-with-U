// src/apps/hub/hubPageLayouts/heartbreak/HbWorkflowsWindow.jsx
//
// 首页 Workflows 窗口的内容：真实的工作流列表，每条一个开关，写的是
// 工作流自己的 enabled（和工作流管理页里的开关是同一个函数）。
// 轻量确认：切换后立刻生效，窗口里出现一条小提示「已启用 / 已暂停 xxx」，
// 带「撤销」，5 秒后自己消失；不弹原生对话框，也不挡住别的操作。
// 启用数量取自列表本身，所以切换后数字马上跟着变。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatWorkflowSchedule, setHubWorkflowEnabled } from '../../useHubWorkflows';

const NOTE_MS = 5000;

export const HbWorkflowsWindow = ({ workflows, ready, activeCount, onOpenWorkflows }) => {
  const [note, setNote] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const showNote = useCallback((next) => {
    clearTimeout(timerRef.current);
    setNote(next);
    timerRef.current = setTimeout(() => setNote(null), NOTE_MS);
  }, []);

  const toggle = async (workflow) => {
    if (busyId !== null) return;
    const nextEnabled = !workflow.enabled;
    setBusyId(workflow.id);
    const ok = await setHubWorkflowEnabled(workflow.id, nextEnabled);
    setBusyId(null);
    showNote(
      ok
        ? { id: workflow.id, name: workflow.name, enabled: nextEnabled }
        : { error: true, name: workflow.name }
    );
  };

  const undo = async () => {
    if (!note || note.error) return;
    const { id, enabled } = note;
    clearTimeout(timerRef.current);
    setNote(null);
    await setHubWorkflowEnabled(id, !enabled);
  };

  return (
    <>
      <div className="hb-wf-count">
        <span>{activeCount}</span>
        <small>个已启用</small>
      </div>

      {ready && workflows.length === 0 ? (
        <p className="hb-wf-empty">还没有工作流，去创建第一个吧。</p>
      ) : (
        <ul className="hb-wf-list">
          {workflows.map((workflow) => (
            <li key={workflow.id} className="hb-wf-row" data-on={workflow.enabled ? 'true' : 'false'}>
              <span className="hb-wf-info">
                <b>{workflow.name || '未命名工作流'}</b>
                <small>
                  {formatWorkflowSchedule(workflow)}
                  {workflow.character?.name ? ` · ${workflow.character.name}` : ''}
                </small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(workflow.enabled)}
                aria-label={`${workflow.enabled ? '暂停' : '启用'} ${workflow.name || '未命名工作流'}`}
                className="hb-sw"
                disabled={busyId === workflow.id}
                onClick={() => toggle(workflow)}
              />
            </li>
          ))}
        </ul>
      )}

      {note && (
        <div className="hb-wf-note" role="status">
          <span>
            {note.error
              ? `没能切换「${note.name}」`
              : `已${note.enabled ? '启用' : '暂停'}「${note.name}」`}
          </span>
          {!note.error && (
            <button type="button" onClick={undo}>撤销</button>
          )}
        </div>
      )}

      <div className="hb-btns">
        <button type="button" className="hb-btn main" onClick={onOpenWorkflows}>
          去看看
        </button>
      </div>
    </>
  );
};

export default HbWorkflowsWindow;