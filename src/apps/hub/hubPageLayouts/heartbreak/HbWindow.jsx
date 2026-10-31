// src/apps/hub/hubPageLayouts/heartbreak/HbWindow.jsx
//
// 心碎先生版式里的「玻璃窗口」：标题栏可拖动，右上角有最小化和关闭。
// 外面包一层 .hb-para（绝对定位 + 视差），里面才是窗口本身，这样视差写在
// 外层的 transform 上，拖动写在窗口自己的 translate 上，互不干扰。
// 拖动时直接改元素上的 CSS 变量（--hb-dx / --hb-dy），不走 React 状态，
// 拖动过程中不会重新渲染。最小化和关闭由父组件管理（任务栏要用）。
// 窗口内容区的点击不会触发拖动，只有标题栏可以拖。

import React, { useCallback, useRef } from 'react';
import { Minus, X } from 'lucide-react';

export const HbWindow = ({
  id,
  title,
  alt,
  hidden = false,
  zIndex = 8,
  paraStyle,
  winStyle,
  depth = 0,
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
    const y = Math.max(-260, Math.min(260, drag.baseY + event.clientY - drag.startY));

    offsetRef.current = { x, y };
    element.style.setProperty('--hb-dx', `${x}px`);
    element.style.setProperty('--hb-dy', `${y}px`);
  }, []);

  const handlePointerEnd = useCallback(() => {
    dragRef.current = null;
    if (windowRef.current) windowRef.current.dataset.dragging = 'false';
  }, []);

  return (
    <div
      className="hb-para"
      data-depth={depth}
      style={{ ...paraStyle, zIndex, display: hidden ? 'none' : undefined }}
    >
      <section
        ref={windowRef}
        id={id ? `hb-${id}-win` : undefined}
        className="hb-win"
        style={winStyle}
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
          <span className="hb-grip">
            <i />
            {title}
            {alt && <em>{alt}</em>}
          </span>
          <span className="hb-wb">
            {onMinimize && (
              <button type="button" aria-label={`最小化 ${title}`} onClick={() => onMinimize(id)}>
                <Minus className="hb-i" />
              </button>
            )}
            {onClose && (
              <button type="button" aria-label={`关闭 ${title}`} onClick={() => onClose(id)}>
                <X className="hb-i" />
              </button>
            )}
          </span>
        </div>
        <div className="hb-win-body">{children}</div>
      </section>
    </div>
  );
};

export default HbWindow;