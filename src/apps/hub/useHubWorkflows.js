// src/apps/hub/useHubWorkflows.js
//
// 首页「Workflows」窗口用的真实工作流列表：每条带名字、触发时间、星期、
// 所属角色和是否启用。读取直接复用 workflowService.getAllWorkflowsWithContext
// （工作流管理页用的同一个函数，按最近更新倒序），用 Dexie liveQuery 订阅，
// 所以在首页开关一条、或在工作流管理页改了，这里都会立刻刷新。
//
// 开关复用 workflowService.setWorkflowEnabled：它会写 enabled、更新
// updatedAt，并触发和服务器的同步，行为和管理页里的开关完全一致。

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  getAllWorkflowsWithContext,
  setWorkflowEnabled,
} from '../../services/workflow/workflowService';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export const formatWorkflowSchedule = (workflow) => {
  const time = workflow?.time ? String(workflow.time).slice(0, 5) : '--:--';
  const days = Array.isArray(workflow?.weekdays) ? workflow.weekdays : [];
  let dayText = '未设置';
  if (days.length === 7) dayText = '每天';
  else if (days.length > 0) {
    dayText = `周${[...days]
      .sort((a, b) => a - b)
      .map((day) => WEEKDAY_LABELS[day] ?? '')
      .join('')}`;
  }
  return `${time} · ${dayText}`;
};

export const setHubWorkflowEnabled = async (id, enabled) => {
  try {
    await setWorkflowEnabled(id, enabled);
    return true;
  } catch (error) {
    console.warn('[HubWorkflows] 切换工作流失败：', error);
    return false;
  }
};

export const useHubWorkflows = () => {
  const [state, setState] = useState({ ready: false, workflows: [] });

  useEffect(() => {
    const subscription = liveQuery(() => getAllWorkflowsWithContext()).subscribe({
      next: (workflows) => {
        setState({ ready: true, workflows: workflows || [] });
      },
      error: (error) => {
        console.warn('[HubWorkflows] 读取工作流失败：', error);
        setState((prev) => ({ ...prev, ready: true }));
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    ready: state.ready,
    workflows: state.workflows,
    activeCount: state.workflows.filter((workflow) => workflow.enabled).length,
  };
};

export default useHubWorkflows;