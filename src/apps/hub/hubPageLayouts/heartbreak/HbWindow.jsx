// src/apps/hub/hubPageLayouts/heartbreak/HbWindow.jsx
//
// 心碎先生版式里的「玻璃窗口」：标题栏可拖动，右上角有最小化和关闭。
// 拖动时直接改元素上的 CSS 变量（--hb-dx / --hb-dy），不走 React 状态，
// 所以拖动过程中不会重新渲染。最小化和关闭都由父组件管理（任务栏要用）。
// 窗口内容区的点击不会触发拖动，只有标题栏可以拖。

import React, { useCallback, useRef } from 'react';
import { Minus, X } from 'lucide-react';

export const HbWindow = ({
  id,
  title,
  hidden = false,
  zIndex = 3,
  onFocus,
  onMinimize,
  onClose,
  children,
}) => {
  const windowRef = useRef(null);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback(
    (event) => {
      if (event.target.closest('button')) return;

      onFocus?.(id);
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        baseX: offsetRef.current.x,
        baseY: offsetRef.current.y,
      };

      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (windowRef.current) windowRef.current.dataset.dragging = 'true';
    },
    [id, onFocus]
  );

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    const element = windowRef.current;
    if (!drag || !element) return;

    // 限制在一个合理范围内，避免把窗口拖出屏幕找不回来。
    const x = Math.max(-140, Math.min(140, drag.baseX + event.clientX - drag.startX));
    const y = Math.max(-240, Math.min(240, drag.baseY + event.clientY - drag.startY));

    offsetRef.current = { x, y };
    element.style.setProperty('--hb-dx', `${x}px`);
    element.style.setProperty('--hb-dy', `${y}px`);
  }, []);

  const handlePointerEnd = useCallback(() => {
    dragRef.current = null;
    if (windowRef.current) windowRef.current.dataset.dragging = 'false';
  }, []);

  return (
    <section
      ref={windowRef}
      className="hb-win"
      hidden={hidden}
      style={{ zIndex }}
      aria-label={title}
      onPointerDown={() => onFocus?.(id)}
    >
      <div
        className="hb-win-bar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <span className="hb-win-title">{title}</span>
        {onMinimize && (
          <button
            type="button"
            className="hb-win-btn"
            aria-label={`最小化 ${title}`}
            onClick={() => onMinimize(id)}
          >
            <Minus size={12} />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className="hb-win-btn"
            aria-label={`关闭 ${title}`}
            onClick={() => onClose(id)}
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="hb-win-body">{children}</div>
    </section>
  );
};

export default HbWindow;