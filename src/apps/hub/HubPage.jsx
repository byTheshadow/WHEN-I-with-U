// src/apps/hub/HubPage.jsx
//
// 首页整页内容的统一入口：根据「整页版式」设置，从注册表里挑一个版式组件
// 渲染出来。以后 App.jsx 在 DailyOfferingHubGate 里只需要放这一个组件，
// 不用关心具体是哪种版式、里面有几块。写法对照 HubHeader.jsx。
//
// 外面包了一层 Suspense，是为了以后体积较大的版式可以用 lazyWithRetry
// 懒加载；现在只有经典版式（同步加载），这层 Suspense 不会触发。

import React from 'react';
import useHubPageLayout from './useHubPageLayout';
import {
  HUB_PAGE_LAYOUT_CLASSIC,
  HUB_PAGE_LAYOUT_COMPONENTS,
} from './hubPageLayouts/pageLayoutRegistry';

export const HubPage = ({ onOpenApp, onOpenArchive }) => {
  const layoutId = useHubPageLayout();

  const LayoutComponent =
    HUB_PAGE_LAYOUT_COMPONENTS[layoutId] ||
    HUB_PAGE_LAYOUT_COMPONENTS[HUB_PAGE_LAYOUT_CLASSIC];

  return (
    <React.Suspense fallback={null}>
      <LayoutComponent
        onOpenApp={onOpenApp}
        onOpenArchive={onOpenArchive}
      />
    </React.Suspense>
  );
};

export default HubPage;