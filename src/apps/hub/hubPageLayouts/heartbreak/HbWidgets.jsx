// src/apps/hub/hubPageLayouts/heartbreak/HbWidgets.jsx
//
// 心碎先生版式里的小组件：
//   HbWidgetShelf   「小组件」区，显示用户贴上的小组件（和经典首页是同一批数据）。
//                   小组件本身的点击行为沿用原来的：数据类跳转对应应用，
//                   装饰类弹出编辑。编辑模式（顶栏铅笔）下每张右上角多一个
//                   「移除」，要点两次才会真的删除。
//   HbWidgetModals  「贴一个小组件」贴纸打开的添加面板，以及装饰类小组件的编辑面板，
//                   直接复用 widgets/AddWidgetModal 和 EditWidgetModal。
// 没有小组件时整个区域不显示。

import React, { useEffect, useRef, useState } from 'react';
import AddWidgetModal from '../../widgets/AddWidgetModal';
import EditWidgetModal from '../../widgets/EditWidgetModal';
import { WIDGET_TYPES } from '../../widgets/widgetRegistry';

const RemoveButton = ({ onConfirm }) => {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = () => {
    if (armed) {
      clearTimeout(timerRef.current);
      onConfirm();
      return;
    }
    setArmed(true);
    timerRef.current = setTimeout(() => setArmed(false), 3000);
  };

  return (
    <button type="button" className="hb-shelf-remove" data-armed={armed ? 'true' : 'false'} onClick={handleClick}>
      {armed ? '再点一次移除' : '移除'}
    </button>
  );
};

export const HbWidgetShelf = ({ widgets, editing, onOpenApp, onEditWidget, onRemoveWidget }) => {
  const items = widgets
    .map((widget) => ({ widget, definition: WIDGET_TYPES[widget.type] }))
    .filter((item) => item.definition);

  if (items.length === 0) return null;

  return (
    <section id="hb-widget-shelf" className="hb-shelf" aria-label="小组件">
      <div className="hb-shelf-head">
        <h2>Widgets</h2>
        <span>{editing ? '编辑中：可以移除' : `${items.length} 个小组件`}</span>
      </div>
      <div className="hb-shelf-grid">
        {items.map(({ widget, definition }) => (
          <div key={widget.id} className="hb-shelf-cell" data-span={definition.colSpan === 2 ? '2' : '1'}>
            {definition.renderContent({ widget, onOpenApp, onEditWidget })}
            {editing && <RemoveButton onConfirm={() => onRemoveWidget(widget.id)} />}
          </div>
        ))}
      </div>
    </section>
  );
};

export const HbWidgetModals = ({ addOpen, onCloseAdd, onAdd, editingWidget, onCloseEdit, onSaveEdit }) => (
  <>
    {addOpen && <AddWidgetModal onAdd={onAdd} onClose={onCloseAdd} />}
    {editingWidget && (
      <EditWidgetModal widget={editingWidget} onSave={onSaveEdit} onClose={onCloseEdit} />
    )}
  </>
);

export default HbWidgetShelf;