// src/apps/hub/useHubAppStats.js
//
// 首页应用角标用到的三个数字：匿名信箱未回答数、栖息地数量、已启用的
// 定时工作流数量。读取方式和 AppGrid.jsx 里完全一致（同样三个查询），
// 这里抽成 hook 是为了让新版式不用复制一遍。键名和 appRegistry.js 里的
// badge 字段对应：askCount / habitatCount / activeWorkflowCount。
//
// 挂载时读一次；页面从后台切回前台时再读一次（比如在别的应用里回答了
// 问题再回到首页），其余时间不做任何查询。

import { useCallback, useEffect, useState } from 'react';
import db from '../../db';

const EMPTY_STATS = {
  askCount: 0,
  habitatCount: 0,
  activeWorkflowCount: 0,
};

export const useHubAppStats = () => {
  const [stats, setStats] = useState(EMPTY_STATS);

  const load = useCallback(async (isActive = () => true) => {
    try {
      const [habitatCount, askCount, allWorkflows] = await Promise.all([
        db.habitats.count(),
        db.askBoxQuestions.filter((question) => !question.reply).count(),
        db.workflows.toArray(),
      ]);

      if (!isActive()) return;

      setStats({
        askCount,
        habitatCount,
        activeWorkflowCount: allWorkflows.filter(
          (workflow) => workflow.enabled
        ).length,
      });
    } catch (error) {
      console.error('读取首页应用统计失败：', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const isActive = () => isMounted;

    void load(isActive);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load(isActive);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  return stats;
};

export default useHubAppStats;