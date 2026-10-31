// src/apps/hub/hubPageLayouts/ClassicPageLayout.jsx
//
// 「经典首页」整页版式：把 App.jsx 里现在直接写着的首页内容原样搬进来——
// 头部、新鲜事条、留言板、应用网格，顺序、延迟动画参数、每块外面各包一层
// ErrorBoundary，都和 App.jsx 里的写法完全一致，所以切到这个版式之后，
// 视觉和行为跟没有版式框架之前一样。
//
// 注意：DailyOfferingHubGate（每日供奉的拦截层）不在这里，仍然留在
// App.jsx 里包在外面，因为它管的是「进不进得了首页」，和版式无关。

import React from 'react';
import ErrorBoundary from '../../../components/ErrorBoundary';
import HubHeader from '../HubHeader';
import NewThingsBar from '../NewThingsBar';
import QuickBoard from '../QuickBoard';
import AppGrid from '../AppGrid';

export const ClassicPageLayout = ({ onOpenApp, onOpenArchive }) => (
  <>
    <ErrorBoundary>
      <HubHeader />
    </ErrorBoundary>

    <ErrorBoundary>
      <NewThingsBar delay={260} />
    </ErrorBoundary>

    <ErrorBoundary>
      <QuickBoard delay={300} onOpenArchive={onOpenArchive} />
    </ErrorBoundary>

    <ErrorBoundary>
      <AppGrid delay={400} onOpenApp={onOpenApp} />
    </ErrorBoundary>
  </>
);

export default ClassicPageLayout;