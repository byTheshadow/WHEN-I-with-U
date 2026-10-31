// src/apps/hub/hubPresets.js
//
// 「主页套装」：把头部版式、整页版式、主题、应用名称显示模式打包成一个
// 预设，一键套用。套装本身不存任何新的数据，套用时只是把已有的几个设置项
// 一次性写好，所以不需要新表、不需要升级数据库版本（对照项目约定：
// 只需要一个设置键的功能，直接走 db.settings 的 key/value）。
//
// 一个套装的字段（全部可选，缺省或为 null 表示「套用时不改这一项」）：
//   id                    套装 id，唯一。
//   label / description   设置页展示用的名称和一句话说明。
//   hubHeaderLayout       头部版式 id，必须在 hubHeaderLayouts/registry.js 里。
//   hubPageLayout         整页版式 id，必须在 hubPageLayouts/pageLayoutRegistry.js 里。
//   theme                 主题 id（比如 'mono-mist'、'cream-latte'），写入 db.settings
//                         的 theme 键；App.jsx 只在挂载时读一次这个键，所以套用时
//                         需要把 App 的 setActiveTheme 作为 onChangeTheme 传进来，
//                         否则要刷新页面主题才会变。
//   appNameDisplayMode    'en' / 'bilingual' / 'korean'。
//
// 套用时会校验版式 id 和显示模式：认不出的字段会被跳过并记在返回值的
// skipped 里，不会写进数据库，所以一个写错的套装不会把首页弄坏。
//
// 背景图（hubBackground）故意不放进套装：它是一整张 base64 图片，体积大，
// 放进预设会让套装变得很重；用户自己设置的背景也不该被一键套装覆盖。
//
// 新增内置套装：往 BUILT_IN_HUB_PRESETS 里加一项即可。引用的版式必须先
// 在对应的注册表里注册好，否则套用时会被跳过。

import db from '../../db';
import { isKnownHubHeaderLayout } from './hubHeaderLayouts/registry';
import { isKnownHubPageLayout } from './hubPageLayouts/pageLayoutRegistry';
import { HUB_HEADER_LAYOUT_SETTING_KEY } from './useHubHeaderLayout';
import { HUB_PAGE_LAYOUT_SETTING_KEY } from './useHubPageLayout';
import {
  APP_NAME_DISPLAY_SETTING_KEY,
  APP_NAME_DISPLAY_EN,
  APP_NAME_DISPLAY_BILINGUAL,
  APP_NAME_DISPLAY_KOREAN,
} from './useAppNameDisplayMode';

const THEME_SETTING_KEY = 'theme';

const VALID_APP_NAME_MODES = [
  APP_NAME_DISPLAY_EN,
  APP_NAME_DISPLAY_BILINGUAL,
  APP_NAME_DISPLAY_KOREAN,
];

// 内置套装。目前只有「经典」，对应现在首页的样子；新的整页版式和皮肤
// 做好之后，在这里加对应的套装（比如把某个头部版式、整页版式和主题配成一套）。
export const BUILT_IN_HUB_PRESETS = [
  {
    id: 'classic',
    label: '经典',
    description: '现在首页的样子：经典头部加应用网格',
    hubHeaderLayout: 'classic',
    hubPageLayout: 'classic',
    theme: null,
    appNameDisplayMode: null,
  },
];

export const getHubPreset = (id) =>
  BUILT_IN_HUB_PRESETS.find((preset) => preset.id === id) || null;

// 把一个套装拆成「要写入的设置项」和「被跳过的字段」，不碰数据库，
// 方便单独检查。
export const planHubPreset = (preset) => {
  const writes = [];
  const skipped = [];

  if (!preset) {
    return { writes, skipped: [{ field: 'preset', reason: '套装不存在' }] };
  }

  if (preset.hubHeaderLayout != null) {
    if (isKnownHubHeaderLayout(preset.hubHeaderLayout)) {
      writes.push({
        key: HUB_HEADER_LAYOUT_SETTING_KEY,
        value: preset.hubHeaderLayout,
      });
    } else {
      skipped.push({
        field: 'hubHeaderLayout',
        reason: `未注册的头部版式：${preset.hubHeaderLayout}`,
      });
    }
  }

  if (preset.hubPageLayout != null) {
    if (isKnownHubPageLayout(preset.hubPageLayout)) {
      writes.push({
        key: HUB_PAGE_LAYOUT_SETTING_KEY,
        value: preset.hubPageLayout,
      });
    } else {
      skipped.push({
        field: 'hubPageLayout',
        reason: `未注册的整页版式：${preset.hubPageLayout}`,
      });
    }
  }

  if (preset.theme != null) {
    if (typeof preset.theme === 'string' && preset.theme) {
      writes.push({ key: THEME_SETTING_KEY, value: preset.theme });
    } else {
      skipped.push({ field: 'theme', reason: '主题 id 不是字符串' });
    }
  }

  if (preset.appNameDisplayMode != null) {
    if (VALID_APP_NAME_MODES.includes(preset.appNameDisplayMode)) {
      writes.push({
        key: APP_NAME_DISPLAY_SETTING_KEY,
        value: preset.appNameDisplayMode,
      });
    } else {
      skipped.push({
        field: 'appNameDisplayMode',
        reason: `不合法的显示模式：${preset.appNameDisplayMode}`,
      });
    }
  }

  return { writes, skipped };
};

// 套用一个套装：一次性写好所有通过校验的设置项。
//   preset         套装对象（内置的或传入自定义的）。
//   onChangeTheme  可选。传 App.jsx 的 setActiveTheme，套用主题后立刻生效；
//                  不传的话主题只写入数据库，刷新页面后才会变。
// 返回 { applied: [写入的 key], skipped: [{ field, reason }] }。
//
// 头部版式、整页版式、应用名称显示模式这三项，首页是用 liveQuery 订阅
// db.settings 的，写入后首页会自动刷新。注意：如果设置页正开着，它里面
// 的草稿状态是挂载时读的，不会自动跟着变，从设置页里套用套装时需要同时
// 更新设置页自己的草稿状态，否则点「保存」会把旧值写回去。
export const applyHubPreset = async (preset, { onChangeTheme } = {}) => {
  const { writes, skipped } = planHubPreset(preset);

  if (writes.length > 0) {
    await db.settings.bulkPut(writes);
  }

  const themeWrite = writes.find((item) => item.key === THEME_SETTING_KEY);
  if (themeWrite && typeof onChangeTheme === 'function') {
    onChangeTheme(themeWrite.value);
  }

  return {
    applied: writes.map((item) => item.key),
    skipped,
  };
};

// 读出「当前」这几项设置，用来判断现在匹配哪个套装，或者以后做
// 「把当前搭配存成我的套装」。读不到的项返回 null。
export const readCurrentHubSettings = async () => {
  const keys = [
    HUB_HEADER_LAYOUT_SETTING_KEY,
    HUB_PAGE_LAYOUT_SETTING_KEY,
    THEME_SETTING_KEY,
    APP_NAME_DISPLAY_SETTING_KEY,
  ];

  const rows = await db.settings.bulkGet(keys);
  const byKey = {};
  keys.forEach((key, index) => {
    byKey[key] = rows[index]?.value ?? null;
  });

  return {
    hubHeaderLayout: byKey[HUB_HEADER_LAYOUT_SETTING_KEY],
    hubPageLayout: byKey[HUB_PAGE_LAYOUT_SETTING_KEY],
    theme: byKey[THEME_SETTING_KEY],
    appNameDisplayMode: byKey[APP_NAME_DISPLAY_SETTING_KEY],
  };
};