// src/apps/messages/secretCode/secretCodeFolderStyle.js
//
// 文件夹颜色：数据里只存序号（folder.colorIndex，0-3），渲染时映射到主题变量，
// 所以换主题不用迁移数据，五套主题都有这四个变量。
// 顺序和 secretCodeService 里"新文件夹优先用没被占用的序号"配合，
// 前四个文件夹颜色各不相同。
export const FOLDER_COLOR_VARS = [
  'var(--bg-blob-1)',
  'var(--bg-blob-3)',
  'var(--bg-blob-2)',
  'var(--accent-color)',
];

export const getFolderColorVar = (folder) => {
  const index = Number.isInteger(folder?.colorIndex) ? folder.colorIndex : 0;
  return FOLDER_COLOR_VARS[((index % FOLDER_COLOR_VARS.length) + FOLDER_COLOR_VARS.length) % FOLDER_COLOR_VARS.length];
};
