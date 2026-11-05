// src/config/novemberSeason.js
//
// 十一月限定加载页（冬日镜子小屋等）共用的季节开关：只在十一月自动生效，
// 其余月份这些加载页在选择器里是锁定状态，Preloader 也不会读取它们。
// 做法与 halloweenSeason.js 一致；明年要改时间段，改这一个文件就够了。

// 月份用 JS Date 的 0-11 记法：10 = 十一月。
const NOVEMBER_MONTH_INDEX = 10;

export const isNovemberSeasonActive = (date = new Date()) => (
  date.getMonth() === NOVEMBER_MONTH_INDEX
);