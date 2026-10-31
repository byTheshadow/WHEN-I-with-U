// src/apps/settings/HubPageLayoutSettings.jsx
//
// 设置页里的「首页整体版式」选择器：决定整个首页的结构怎么排。
// 目前只有「经典首页」一种，后续新增版式时会自动出现在这个列表里
// （见 hub/hubPageLayouts/pageLayoutRegistry.js）。
// 接口和 HubHeaderLayoutSettings.jsx 完全一致（value / onChange），
// 设置页里照同样的草稿状态接线即可。

import React from 'react';
import { HUB_PAGE_LAYOUTS } from '../hub/hubPageLayouts/pageLayoutRegistry';

export const HubPageLayoutSettings = ({ value, onChange }) => (
  <div className="space-y-3">
    <div>
      <p className="font-medium">首页整体版式 (Home Page Layout)</p>
      <p className="mt-1 text-[10px] leading-relaxed opacity-50">
        决定整个首页的结构怎么排，和上面的头部版式是两层设置，可以自由搭配。
        应用和资料内容共用一份，换版式不会丢失内容。
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs">
      {HUB_PAGE_LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          type="button"
          onClick={() => onChange(layout.id)}
          className={`rounded-xl py-3 font-medium transition-all ${
            value === layout.id
              ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
              : 'bg-black/5 dark:bg-white/10 hover:bg-black/10'
          }`}
        >
          <span className="block">{layout.label}</span>
          <span
            className={`mt-0.5 block text-[10px] font-normal ${
              value === layout.id ? 'opacity-70' : 'opacity-40'
            }`}
          >
            {layout.hint}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default HubPageLayoutSettings;