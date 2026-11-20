// src/apps/fiction/fictionReadingThemes.js
//
// 阅读设置的数据：默认值、字号/行距范围、阅读主题（含弥散背景的三团颜色）。
// 纯数据和纯函数，不碰数据库，不碰 DOM。
//
// 阅读设置是全局一份（所有存档共用），存在 db.settings 的 fictionReadingPrefs 里。
// 主题只改游玩页：useFictionReadingPrefs 会把这里算出来的变量写到 .fic-root 上，
// 离开游玩页时全部撤掉。
//
// 每个主题 = 纸色 + 文字色 + 卡片色 + 引号高亮色 + 三团弥散的颜色。
// 「跟随主题」不改任何颜色，弥散的三团颜色直接取 App 全局主题的 --bg-blob-1/2/3。

export const READING_PREFS_KEY = 'fictionReadingPrefs';

export const FONT_SIZE_RANGE = { min: 13, max: 22, step: 0.5 };

export const LINE_HEIGHT_OPTIONS = [
  { id: 'tight', label: '紧凑', value: 1.7 },
  { id: 'normal', label: '标准', value: 1.95 },
  { id: 'loose', label: '宽松', value: 2.25 },
];

export const DEFAULT_READING_PREFS = {
  fontSize: 14.5,
  lineHeight: 1.95,
  themeId: 'follow',
  highlightQuotes: true,
  motion: true,
};

const buildThemeVars = ({
  paper, sheet, sheetSolid, ink, sub, muted, line, border, quote,
}) => ({
  '--fic-paper': paper,
  '--fic-sheet': sheet,
  '--fic-soft': `color-mix(in srgb, ${ink} 7%, transparent)`,
  '--fic-ink': ink,
  '--fic-sub': sub,
  '--fic-muted': muted,
  '--fic-line': line,
  '--fic-border': border,
  '--fic-btn-bg': ink,
  '--fic-btn-fg': paper,
  '--fic-quote': quote,
  // 底部抽屉（编辑、确认删除等）用的是 App 全局的 --modal-*，
  // 夜间主题下不跟着换的话会变成「浅底浅字」，所以这里一起盖掉。
  '--modal-bg': sheetSolid,
  '--modal-border': border,
  '--modal-overlay': 'rgba(10, 10, 12, 0.42)',
  '--modal-shadow': '0 -12px 40px rgba(10, 10, 12, 0.22)',
});

export const READING_THEMES = [
  {
    id: 'follow',
    label: '跟随主题',
    paper: 'var(--bg-main)',
    blobs: ['var(--bg-blob-1)', 'var(--bg-blob-2)', 'var(--bg-blob-3)'],
    vars: {},
  },
  {
    id: 'warm',
    label: '暖纸',
    paper: '#f5ede0',
    blobs: ['rgba(240, 190, 150, 0.55)', 'rgba(232, 168, 160, 0.45)', 'rgba(240, 222, 150, 0.5)'],
    vars: buildThemeVars({
      paper: '#f5ede0',
      sheet: 'rgba(255, 250, 241, 0.78)',
      sheetSolid: '#fbf5ea',
      ink: '#3b2f27',
      sub: '#6d5d50',
      muted: '#9a8a7b',
      line: '#e4d6c4',
      border: '#dccbb5',
      quote: '#a4472f',
    }),
  },
  {
    id: 'gray',
    label: '浅灰',
    paper: '#eceef1',
    blobs: ['rgba(170, 190, 225, 0.55)', 'rgba(205, 190, 225, 0.45)', 'rgba(180, 215, 205, 0.45)'],
    vars: buildThemeVars({
      paper: '#eceef1',
      sheet: 'rgba(250, 251, 252, 0.75)',
      sheetSolid: '#f7f8fa',
      ink: '#23272e',
      sub: '#545b66',
      muted: '#8a919c',
      line: '#d8dce2',
      border: '#cfd4db',
      quote: '#3f5f9a',
    }),
  },
  {
    id: 'night',
    label: '夜间',
    paper: '#14161b',
    blobs: ['rgba(70, 90, 160, 0.45)', 'rgba(110, 70, 140, 0.38)', 'rgba(40, 110, 115, 0.35)'],
    vars: buildThemeVars({
      paper: '#14161b',
      sheet: 'rgba(30, 33, 41, 0.72)',
      sheetSolid: '#1d2029',
      ink: '#e8e4da',
      sub: '#b3b0a6',
      muted: '#7f7d76',
      line: '#2b2f3a',
      border: '#343947',
      quote: '#e3b872',
    }),
  },
  {
    id: 'green',
    label: '护眼绿',
    paper: '#e6eee1',
    blobs: ['rgba(170, 215, 170, 0.55)', 'rgba(215, 230, 160, 0.5)', 'rgba(160, 215, 200, 0.45)'],
    vars: buildThemeVars({
      paper: '#e6eee1',
      sheet: 'rgba(246, 251, 243, 0.76)',
      sheetSolid: '#f1f7ee',
      ink: '#243427',
      sub: '#51634f',
      muted: '#84967f',
      line: '#cfdcc9',
      border: '#c4d3bd',
      quote: '#7a4a2d',
    }),
  },
  {
    id: 'rain',
    label: '雨夜',
    fx: 'rain',
    paper: '#0f151c',
    blobs: ['rgba(56, 92, 132, 0.5)', 'rgba(36, 68, 98, 0.42)', 'rgba(70, 62, 112, 0.34)'],
    vars: buildThemeVars({
      paper: '#0f151c',
      sheet: 'rgba(20, 28, 37, 0.7)',
      sheetSolid: '#18212b',
      ink: '#dfe6ea',
      sub: '#a9b4bb',
      muted: '#75828b',
      line: '#222c36',
      border: '#2c3844',
      quote: '#9fcbdc',
    }),
  },
  {
    id: 'stars',
    label: '星空',
    fx: 'stars',
    paper: '#0b0e1f',
    blobs: ['rgba(72, 60, 156, 0.48)', 'rgba(38, 62, 146, 0.42)', 'rgba(112, 58, 142, 0.3)'],
    vars: buildThemeVars({
      paper: '#0b0e1f',
      sheet: 'rgba(20, 24, 52, 0.7)',
      sheetSolid: '#171b3a',
      ink: '#e6e4f2',
      sub: '#b1afc6',
      muted: '#7c7a95',
      line: '#22264a',
      border: '#2e3358',
      quote: '#f0d38a',
    }),
  },
];
export const getReadingTheme = (themeId) => (
  READING_THEMES.find((theme) => theme.id === themeId) || READING_THEMES[0]
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// 存储里读出来的值可能缺字段、类型不对，统一规整成合法值。
export const normalizeReadingPrefs = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const size = Number(source.fontSize);
  const height = Number(source.lineHeight);

  return {
    fontSize: Number.isFinite(size)
      ? clamp(Math.round(size * 2) / 2, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max)
      : DEFAULT_READING_PREFS.fontSize,
    lineHeight: Number.isFinite(height)
      ? clamp(height, 1.4, 2.6)
      : DEFAULT_READING_PREFS.lineHeight,
    themeId: getReadingTheme(source.themeId).id,
    highlightQuotes: source.highlightQuotes === undefined
      ? DEFAULT_READING_PREFS.highlightQuotes
      : Boolean(source.highlightQuotes),
    motion: source.motion === undefined
      ? DEFAULT_READING_PREFS.motion
      : Boolean(source.motion),
  };
};

// 会写到 .fic-root 上的全部变量名。清理时按这个名单逐个撤掉，
// 不会误删别的变量。
export const READING_VAR_NAMES = [
  '--fic-read-size',
  '--fic-read-lh',
  '--fic-paper',
  '--fic-sheet',
  '--fic-soft',
  '--fic-ink',
  '--fic-sub',
  '--fic-muted',
  '--fic-line',
  '--fic-border',
  '--fic-btn-bg',
  '--fic-btn-fg',
  '--fic-quote',
  '--fic-blob-1',
  '--fic-blob-2',
  '--fic-blob-3',
  '--modal-bg',
  '--modal-border',
  '--modal-overlay',
  '--modal-shadow',
];

export const buildReadingVars = (prefs) => {
  const theme = getReadingTheme(prefs.themeId);

  return {
    '--fic-read-size': `${prefs.fontSize}px`,
    '--fic-read-lh': String(prefs.lineHeight),
    ...theme.vars,
    '--fic-blob-1': theme.blobs[0],
    '--fic-blob-2': theme.blobs[1],
    '--fic-blob-3': theme.blobs[2],
  };
};