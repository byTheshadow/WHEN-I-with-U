// "今天有点不一样"判断服务：给 chatroom 用的节日日历 + 早安/晚安
// 时间段判断，纯函数、不依赖数据库。
//
// 节日日历先只放万圣节这一条；以后要加圣诞节或别的节日，直接往
// FESTIVALS 数组里加一条同样结构的记录就行，不用改调用方的代码。

import { isNovemberSeasonActive } from '../config/novemberSeason';

const FESTIVALS = [
  {
    key: 'halloween',
    month: 10,
    day: 31,
    title: '万圣节快乐',
    subtitle: '南瓜灯亮起来了，今晚要不要一起玩点什么',
    accent: '#ff8a3d',
  },
];

// 传入的 date 按"设备本地时间"来判断月/日，跟人平时说"今天几号"是一致的。
export function getTodayFestival(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return FESTIVALS.find((item) => item.month === month && item.day === day) || null;
}

const MORNING_START_HOUR = 5; // [5, 10) 算早安时段
const MORNING_END_HOUR = 10;
const NIGHT_START_HOUR = 22; // [22, 24) 和 [0, 4) 算晚安时段
const NIGHT_END_HOUR = 4;

export function getGreetingPeriod(date = new Date()) {
  const hour = date.getHours();

  if (hour >= MORNING_START_HOUR && hour < MORNING_END_HOUR) return 'morning';
  if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) return 'night';

  return null;
}

const GREETING_CONTENT = {
  morning: {
    title: '早安',
    subtitle: '新的一天，想先聊点什么呢',
    accent: '#ffb648',
  },
  night: {
    title: '晚安',
    subtitle: '再晚一点也没关系，我在这里陪你',
    accent: '#8c7bff',
  },
};

export function getGreetingCardContent(period) {
  return GREETING_CONTENT[period] || null;
}

// 早安/晚安改成"发消息触发"之后用的关键词表：只认这些比较明确的问候
// 说法，不用单字（比如"早"）去做包含匹配，避免"我早就想说"这种句子
// 被误判成在问候。判断时忽略大小写、首尾空白，用"整句包含"匹配——
// 用户说"早安呀"也能命中"早安"。
const GREETING_KEYWORDS = {
  morning: ['早安', '早上好', 'morning', 'good morning', 'gm'],
  night: ['晚安', 'good night', 'gn'],
};

// 从一条用户发的文字消息里判断是不是在问候，返回 'morning' / 'night' /
// null。只负责"这句话像不像在问候"，跟当前是不是真的在对应的时段
// 无关——是否要卡时段由调用方自己再查一次 getGreetingPeriod() 决定。
export function matchGreetingKeyword(text) {
  const normalized = String(text || '').trim().toLowerCase();

  if (!normalized) return null;

  for (const period of Object.keys(GREETING_KEYWORDS)) {
    const hit = GREETING_KEYWORDS[period].some(
      (keyword) => normalized.includes(keyword.toLowerCase())
    );

    if (hit) return period;
  }

  return null;
}

// 感恩节"谢谢"彩蛋：十一月限定（复用 novemberSeason.js 的季节开关，
// 跟十一月限定加载页共用同一个开关，明年要改时间段改那一个文件就够
// 了），不像早安/晚安那样卡时段。关键词表里除了"谢谢"类表达，也放了
// 几个感恩节本身相关的词（火鸡/感恩节），命中任意一个都算。跟早安/
// 晚安是同一套"整句包含匹配、忽略大小写和首尾空白"判断方式。
const THANKS_KEYWORDS = [
  '谢谢', '谢谢你', '多谢', '谢啦', '感谢', '感激',
  'thank you', 'thanks', 'thx',
  '感恩', '感恩节', 'thanksgiving',
  '火鸡', 'turkey',
];

// 只负责"这句话像不像在说谢谢/提到感恩节，而且现在是十一月"，不管
// 去重——是否已经弹过由调用方（useChatEntryCard）自己判断。
export function matchThanksKeyword(text, date = new Date()) {
  if (!isNovemberSeasonActive(date)) return false;

  const normalized = String(text || '').trim().toLowerCase();

  if (!normalized) return false;

  return THANKS_KEYWORDS.some(
    (keyword) => normalized.includes(keyword.toLowerCase())
  );
}

const THANKS_CARD_CONTENT = {
  title: '谢谢你',
  subtitle: '这份心意被看见了',
  accent: '#e8935a',
};

export function getThanksCardContent() {
  return THANKS_CARD_CONTENT;
}

// 按本地日期生成一个 "YYYY-MM-DD" 的去重用 key。
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}