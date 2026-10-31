// src/apps/hub/hubPageLayouts/pageLayoutRegistry.js
//
// 「整页版式」注册表：决定整个首页（头部以外，也可以包括头部）怎么排。
// 和 hubHeaderLayouts/registry.js 是上下两层的关系：
//   - 头部版式：只管资料卡 + 图片墙那一块（9 种，已有）。
//   - 整页版式：管整个首页的结构，比如新鲜事条、留言板、应用区怎么摆。
//     「经典」版式就是现在首页的样子（头部 + 新鲜事条 + 留言板 + 应用网格）。
//
// 以后新增整页版式（档案柜、分区文件夹、角色优先、小屋、心碎先生……）：
//   1. 在 hubPageLayouts/ 下新建一个版式组件文件（参考 ClassicPageLayout.jsx）；
//   2. 在 HUB_PAGE_LAYOUTS 里加一条 { id, label, hint }；
//   3. 在 HUB_PAGE_LAYOUT_COMPONENTS 里把 id 映射到组件。
// 不需要改 HubPage.jsx 或设置页的选择器，两边都是照着这个注册表渲染的。
//
// 版式组件的约定（props）：
//   onOpenApp(appId)   打开某个应用，和 App.jsx 里的 openApp 一致；
//   onOpenArchive()    打开信件存档（留言板的「存档」入口用）。
// 整页版式自己决定要不要渲染头部（HubHeader）：经典版式会渲染，整套皮肤
// 类的版式（比如心碎先生）可以不用，自己画头部。
//
// 应用的名称、图标、分组从 ../appRegistry.js 取，不要在版式里重复写。
//
// 体积较大的版式（小屋、带大量动画的皮肤）建议用 lazyWithRetry 懒加载：
//   const HousePageLayout = lazyWithRetry(
//     () => import('./HousePageLayout'), 'HousePageLayout'
//   );
// 然后照常放进 HUB_PAGE_LAYOUT_COMPONENTS。HubPage.jsx 已经包了 Suspense，
// 懒加载的版式可以直接用。

import ClassicPageLayout from './ClassicPageLayout';
import lazyWithRetry from '../../../utils/lazyWithRetry';

export const HUB_PAGE_LAYOUT_CLASSIC = 'classic';
export const HUB_PAGE_LAYOUT_HEARTBREAK = 'heartbreak';

// 心碎先生体积较大（样式 + 窗口组件），懒加载，只有选中时才下载。
const HeartbreakPageLayout = lazyWithRetry(
  () => import('./HeartbreakPageLayout'),
  'HeartbreakPageLayout'
);

// 版式列表，用于设置页渲染选择器
export const HUB_PAGE_LAYOUTS = [
  {
    id: HUB_PAGE_LAYOUT_CLASSIC,
    label: '经典首页',
    hint: 'Header + Board + Grid',
  },
  {
    id: HUB_PAGE_LAYOUT_HEARTBREAK,
    label: '心碎先生（装修中）',
    hint: 'Collage + Windows',
  },
];

// id -> 组件，用于 HubPage.jsx 实际渲染
export const HUB_PAGE_LAYOUT_COMPONENTS = {
  [HUB_PAGE_LAYOUT_CLASSIC]: ClassicPageLayout,
  [HUB_PAGE_LAYOUT_HEARTBREAK]: HeartbreakPageLayout,
};

export const isKnownHubPageLayout = (id) =>
  HUB_PAGE_LAYOUTS.some((layout) => layout.id === id);