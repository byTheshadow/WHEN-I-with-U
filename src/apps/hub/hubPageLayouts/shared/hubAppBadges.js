// src/apps/hub/hubPageLayouts/shared/hubAppBadges.js
//
// 把 appRegistry.js 里的 badge / status 字段和 useHubAppStats 的三个数字，
// 换算成整页版式里要显示的角标文字或小圆点。纯函数，没有副作用。
// 数量为 0 时不显示，避免像参考稿那样永远亮着一个占位角标。

export const getAppBadgeText = (app, stats) => {
  if (!app) return '';
  if (app.status === 'wip') return '装修中';

  const counts = stats || {};
  if (app.badge === 'askCount' && counts.askCount > 0) {
    return `${counts.askCount} 未答`;
  }
  if (app.badge === 'habitatCount' && counts.habitatCount > 0) {
    return `${counts.habitatCount} 栖息地`;
  }
  if (app.badge === 'activeWorkflowCount' && counts.activeWorkflowCount > 0) {
    return `${counts.activeWorkflowCount} 已启用`;
  }
  return '';
};

// 只关心「有没有需要留意的数字」的版式（比如气泡上的小圆点）用这个。
export const hasAppBadgeDot = (app, stats) => {
  if (!app || !app.badge) return false;
  const counts = stats || {};
  return Number(counts[app.badge]) > 0;
};
