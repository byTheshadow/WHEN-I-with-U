// src/apps/hub/hubPageLayouts/heartbreak/HbAppsWindow.jsx
//
// 「全部应用」窗口的内容：固定在最上面的 Messages，下面按六个分组排成
// 三列图标网格。应用清单、名称、图标全部来自 appRegistry.js / appIcons.js，
// 角标数字来自 useHubAppStats。顶部的三段开关就是设置页里「应用名称
// 显示模式」那个设置，两边读写同一个 appNameDisplayMode，互相同步。

import React from 'react';
import db from '../../../../db';
import {
  HUB_APPS,
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
  { id: APP_NAME_DISPLAY_EN, label: '英文' },
  { id: APP_NAME_DISPLAY_BILINGUAL, label: '英+中' },
  { id: APP_NAME_DISPLAY_KOREAN, label: '英+韩' },
];

const GROUPS = getGroupedHubApps();
const MESSAGES_APP = getHubApp('messages');
// 横幅式的大格子：页边注名字长，单独占一行。
const WIDE_APP_IDS = new Set(['margin-notes']);

const saveNameMode = async (mode) => {
  try {
    await db.settings.put({ key: APP_NAME_DISPLAY_SETTING_KEY, value: mode });
  } catch (error) {
    console.warn('[HeartbreakHome] 保存名称显示模式失败：', error);
  }
};

const AppTile = ({ app, nameMode, stats, onOpenApp }) => {
  const Icon = getAppIcon(app.icon);
  const secondary = getAppSecondaryName(app, nameMode);
  const badgeValue = app.badge ? stats[app.badge] || 0 : 0;
  const wide = WIDE_APP_IDS.has(app.id);

  return (
    <button
      type="button"
      className={`hb-tile ${wide ? 'wide' : ''}`}
      aria-label={`${app.en} ${app.zh}`}
      onClick={() => onOpenApp(app.id)}
    >
      <span className="hb-ic">
        <Icon aria-hidden="true" />
      </span>
      <span style={{ minWidth: 0 }}>
        <b>{app.en}</b>
        {secondary && <span className="nm2">{secondary}</span>}
        {wide && app.sub && <span className="sub">{app.sub}</span>}
      </span>
      {badgeValue > 0 && <span className="hb-badge">{badgeValue}</span>}
      {app.status === 'wip' && <span className="hb-badge wip">装修中</span>}
    </button>
  );
};

export const HbAppsWindow = ({ nameMode, stats, onOpenApp }) => {
  const MessagesIcon = MESSAGES_APP ? getAppIcon(MESSAGES_APP.icon) : null;
  const messagesSecondary = getAppSecondaryName(MESSAGES_APP, nameMode);

  return (
    <div>
      <div className="hb-apps-head">
        <small>
          <b>{HUB_APPS.length}</b> 个入口
          <br />
          名称显示
        </small>
        <div className="hb-seg" role="group" aria-label="应用名称显示模式">
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
      </div>

      <div className="hb-apps-scroll">
        {MESSAGES_APP && (
          <button
            type="button"
            className="hb-pin"
            aria-label={`${MESSAGES_APP.en} ${MESSAGES_APP.zh}`}
            onClick={() => onOpenApp(MESSAGES_APP.id)}
          >
            <span className="hb-ic">
              <MessagesIcon aria-hidden="true" />
            </span>
            <span>
              <b>
                {MESSAGES_APP.en}
                {messagesSecondary && <span className="nm2">{messagesSecondary}</span>}
              </b>
              <small>{MESSAGES_APP.sub}</small>
            </span>
            <span className="hb-pin-tag">固定</span>
          </button>
        )}

        {GROUPS.map((group) => {
          const apps = group.apps.filter((app) => !app.pinned);
          if (apps.length === 0) return null;

          return (
            <div key={group.id} className="hb-grp">
              <h4>
                {group.label}
                <span>{group.en}</span>
              </h4>
              <div className="hb-agrid">
                {apps.map((app) => (
                  <AppTile
                    key={app.id}
                    app={app}
                    nameMode={nameMode}
                    stats={stats}
                    onOpenApp={onOpenApp}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HbAppsWindow;