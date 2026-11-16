// src/apps/fiction/FictionSheetPortal.jsx
//
// 把向导里的底部抽屉渲染到 .fic-w（向导根节点）下面，而不是留在 .fic-scroll 滚动区里面。
// 手机浏览器会把可滚动容器当成独立的层叠上下文，抽屉的 z-index 只在容器内部有效，
// 会被外面的底栏（下一步）盖住；挪到滚动区外面后，抽屉和遮罩就能正常盖在底栏上面。
// 找不到 .fic-w 时原样渲染，行为和以前一样。

import { createPortal } from 'react-dom';

const FictionSheetPortal = ({ children }) => {
  const host = typeof document !== 'undefined'
    ? document.querySelector('.fic-root .fic-w')
    : null;

  return host ? createPortal(children, host) : children;
};

export default FictionSheetPortal;