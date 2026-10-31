// src/apps/hub/hubPageLayouts/heartbreak/HbAppsWindow.jsx
//
// 「全部应用」窗口的内容：固定在最上面的 Messages，下面按六个分组排成
// 三列网格。应用清单、名称、图标全部来自 appRegistry.js / appIcons.js，
// 角标数字来自 useHubAppStats。顶部的三段开关就是设置页里「应用名称
// 显示模式」那个设置，两边读写同一个 appNameDisplayMode，互相同步。

import React from 'react';
import db from '../../../../db';
import {
  getGroupedHubApps,
  getHubApp,
  getAppSecondaryName,
} from '../../appRegistry';
import { getAppIcon } from '../../appIcons';
import {
  APP_NAME_DISPLAY_SETTING_KEY,
  APP_NAME_DISPLAY_EN,
  APP_NAME_DISPLAY_BILINGUAL,
  APP_NAME_DISPLAY_KOREAN,
} from '../../useAppNameDisplayMode';

const NAME_MODES = [
  { id: APP_NAME_DISPLAY_EN, label: 'EN' },
  { id: APP_NAME_DISPLAY_BILINGUAL, label: 'EN + 中' },
  { id: APP_NAME_DISPLAY_KOREAN, label: 'EN + 한' },
];

const GROUPS = getGroupedHubApps();
const MESSAGES_APP = getHubApp('messages');

const saveNameMode = async (mode) => {
  try {
    await db.settings.put({ key: APP_NAME_DISPLAY_SETTING_KEY, value: mode });
  } catch (error) {
    console.warn('[HeartbreakHome] 保存名称显示模式失败：', error);
  }
};

const AppTile = ({ app, nameMode, stats, onOpenApp, wide = false }) => {
  const Icon = getAppIcon(app.icon);
  const secondary = getAppSecondaryName(app, nameMode);
  const badgeValue = app.badge ? stats[app.badge] || 0 : 0;

  return (
    <button
      type="button"
      className={`hb-app ${wide ? 'hb-app-wide' : ''}`}
      aria-label={`${app.en} ${app.zh}`}
      onClick={() => onOpenApp(app.id)}
    >
      <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
      <span>
        <span className="hb-app-name">{app.en}</span>
        {secondary && (
          <span className="hb-app-sub" style={{ display: 'block' }}>
            {secondary}
          </span>
        )}
        {!secondary && app.sub && nameMode === APP_NAME_DISPLAY_EN && (
          <span className="hb-app-sub" style={{ display: 'block' }}>
            {app.sub}
          </span>
        )}
      </span>
      {badgeValue > 0 && <span className="hb-badge">{badgeValue}</span>}
      {app.status === 'wip' && <span className="hb-wip">装修中</span>}
    </button>
  );
};

export const HbAppsWindow = ({ nameMode, stats, onOpenApp }) => (
  <div>
    <div className="hb-seg" role="group" aria-label="应用名称显示">
      {NAME_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-pressed={nameMode === mode.id}
          onClick={() => saveNameMode(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>

    {MESSAGES_APP && (
      <div className="hb-pinned">
        <AppTile
          app={MESSAGES_APP}
          nameMode={nameMode}
          stats={stats}
          onOpenApp={onOpenApp}
          wide
        />
      </div>
    )}

    {GROUPS.map((group) => {
      const apps = group.apps.filter((app) => !app.pinned);
      if (apps.length === 0) return null;

      return (
        <div key={group.id}>
          <h3 className="hb-group-title">
            {group.label}
            <small>{group.en}</small>
          </h3>
          <div className="hb-grid">
            {apps.map((app) => (
              <AppTile
                key={app.id}
                app={app}
                nameMode={nameMode}
                stats={stats}
                onOpenApp={onOpenApp}
                wide={app.id === 'margin-notes'}
              />
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export default HbAppsWindow;