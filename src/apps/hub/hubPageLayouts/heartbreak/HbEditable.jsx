// src/apps/hub/hubPageLayouts/heartbreak/HbEditable.jsx
//
// 版式里「可以由用户自己改」的两种东西：
//   HbText      一小段装饰文字（飘字、标签、感叹号牌……）
//   HbImageSlot 一个图片位（人物抠图、播放器封面……）
// 平时它们只负责显示：有自定义内容就显示自定义的，没有就显示默认的。
// 顶栏铅笔按钮打开编辑模式后，它们会出现虚线框和小铅笔，点一下就会通过
// context 请求打开底部的编辑面板（HbEditLayer）。编辑模式下用 role=button
// 并可用键盘操作，不依赖 hover。

import React, { useContext } from 'react';
import { HbCustomContext } from './useHbCustom';

const activateOnKey = (event, action) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

export const HbText = ({ id, fallback, maxLength = 16, label = '文字' }) => {
  const { editing, texts, requestEdit } = useContext(HbCustomContext);
  const custom = typeof texts[id] === 'string' ? texts[id] : '';
  const value = custom || fallback;

  if (!editing) return <>{value}</>;

  const open = () => requestEdit({ kind: 'text', id, fallback, maxLength, label });
  return (
    <span
      role="button"
      tabIndex={0}
      className="hb-editable"
      aria-label={`修改${label}：${value}`}
      onClick={open}
      onKeyDown={(event) => activateOnKey(event, open)}
    >
      {value}
    </span>
  );
};

// fallbackSrc：用户没有自己换图时显示的图（比如陪伴者头像）；都没有才显示 children 占位。
export const HbImageSlot = ({
  id,
  label = '图片',
  imgClassName = 'hb-user-img',
  className = '',
  fallbackSrc = '',
  children,
}) => {
  const { editing, images, requestEdit } = useContext(HbCustomContext);
  const src = typeof images[id] === 'string' ? images[id] : '';
  const shownSrc = src || fallbackSrc;

  const content = shownSrc ? (
    <img className={imgClassName} src={shownSrc} alt="" draggable={false} />
  ) : (
    children
  );

  if (!editing) return content;

  const open = () => requestEdit({ kind: 'image', id, label, hasCustom: Boolean(src) });
  return (
    <div
      role="button"
      tabIndex={0}
      className={`hb-editable hb-editable-block ${className}`}
      aria-label={`更换${label}`}
      onClick={open}
      onKeyDown={(event) => activateOnKey(event, open)}
    >
      {content}
    </div>
  );
};

export default HbText;