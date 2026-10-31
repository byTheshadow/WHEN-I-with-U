// src/apps/hub/hubPageLayouts/heartbreak/HbHabitatCard.jsx
//
// Habitats 卡片：栖息地的真实数量，加上用户可以自己改的装饰文案和头像
// （编辑模式下点虚线框修改，存在 hb 自定义内容里）。「进入 Habitats」
// 打开生态瓶应用。预览里另外两个示例数字（照片、最近）没有真实数据源，
// 这里不放，免得显示假数字。

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { HbImageSlot, HbText } from './HbEditable';

export const HbHabitatCard = ({ count, onOpen }) => (
  <div className="hb-prof">
    <div className="hb-prof-row">
      <div className="hb-avatar">
        <HbImageSlot id="habAvatar" label="Habitats 头像" imgClassName="hb-avatar-img" className="hb-fill">
          <span className="hb-avatar-ph" aria-hidden="true" />
        </HbImageSlot>
      </div>
      <div className="hb-prof-stat">
        <b>{count}</b>
        <span>栖息地</span>
      </div>
    </div>
    <div className="hb-prof-name">
      <b>Habitats</b>
      <br />
      <HbText id="habCopy" fallback="放着回忆的地方" maxLength={20} label="Habitats 文案" />
      <br />
      <span className="hb-boxed">
        <HbText id="habNote" fallback="一个栖息地，一段回忆" maxLength={20} label="Habitats 小字" />
      </span>
    </div>
    <button type="button" className="hb-prof-go" onClick={onOpen}>
      进入 Habitats
      <ArrowUpRight className="hb-i" style={{ width: 14, height: 14 }} />
    </button>
  </div>
);

export default HbHabitatCard;