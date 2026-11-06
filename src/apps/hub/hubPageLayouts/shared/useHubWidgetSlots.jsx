// src/apps/hub/hubPageLayouts/shared/useHubWidgetSlots.jsx
//
// 整页版式里「小物件」卡片用的数据和添加 / 编辑入口。小物件本身是首页小组件
// （db.homeWidgets），和经典首页、心碎先生共用同一批：在任一版式里贴上的，
// 切换版式后仍然在。这里只负责：
//   useHubWidgetSlots   把小组件按类型分好组，并管理「添加」「编辑」两个弹层的开关
//   HubWidgetModals     弹层本身，直接复用 widgets/AddWidgetModal 和 EditWidgetModal
//   useHubImportantDate 纪念日倒数小组件绑定的那条 Almanac 日期，算出还剩几天
// 版式拿到 byType 之后，自己决定每种类型怎么画；某一类还没有时画一个「贴一个」入口，
// 点开 openAdd 即可。

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../../../db';
import AddWidgetModal from '../../widgets/AddWidgetModal';
import EditWidgetModal from '../../widgets/EditWidgetModal';
import { useHubHomeWidgets } from '../../useHubHomeWidgets';
import { addHomeWidget, updateHomeWidgetConfig } from '../../widgets/homeWidgetsStore';
import { getDaysRemaining } from '../../../almanac/services/almanacImportantDateService';

export const useHubWidgetSlots = () => {
  const widgets = useHubHomeWidgets();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const byType = useMemo(() => {
    const groups = {};
    widgets.forEach((widget) => {
      if (!groups[widget.type]) groups[widget.type] = [];
      groups[widget.type].push(widget);
    });
    return groups;
  }, [widgets]);

  const openAdd = useCallback(() => setAddOpen(true), []);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const openEdit = useCallback((widget) => setEditing(widget), []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const handleAdd = useCallback(async ({ type, config }) => {
    await addHomeWidget({ type, config });
    setAddOpen(false);
  }, []);

  const handleSave = useCallback(async (widgetId, config) => {
    await updateHomeWidgetConfig(widgetId, config);
    setEditing(null);
  }, []);

  return {
    widgets,
    byType,
    addOpen,
    editing,
    openAdd,
    closeAdd,
    openEdit,
    closeEdit,
    handleAdd,
    handleSave,
  };
};

export const HubWidgetModals = ({ slots }) => (
  <>
    {slots.addOpen && <AddWidgetModal onAdd={slots.handleAdd} onClose={slots.closeAdd} />}
    {slots.editing && (
      <EditWidgetModal
        widget={slots.editing}
        onSave={slots.handleSave}
        onClose={slots.closeEdit}
      />
    )}
  </>
);

// 纪念日倒数小组件的配置是 { importantDateId }，指向 db.almanacImportantDates
// 里的一条。传 undefined 也安全（返回 loaded=false）。
export const useHubImportantDate = (config) => {
  const importantDateId = config?.importantDateId;
  const [state, setState] = useState({ loaded: false, record: null });

  useEffect(() => {
    if (!importantDateId) {
      setState({ loaded: true, record: null });
      return undefined;
    }
    const subscription = liveQuery(() => db.almanacImportantDates.get(importantDateId)).subscribe({
      next: (record) => setState({ loaded: true, record: record || null }),
      error: (error) => {
        console.warn('[HubWidget] 读取纪念日失败：', error);
        setState({ loaded: true, record: null });
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [importantDateId]);

  const days = state.record ? getDaysRemaining(state.record) : null;

  return {
    loaded: state.loaded,
    missing: state.loaded && Boolean(importantDateId) && !state.record,
    title: state.record?.title || '',
    days,
  };
};

export default useHubWidgetSlots;
