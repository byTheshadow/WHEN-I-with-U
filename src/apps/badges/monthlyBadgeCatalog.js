// src/apps/badges/monthlyBadgeCatalog.js
//
// 每月限定聊天成就图标——静态数据部分（不读/写数据库，可以直接在 node 里测试）。
//
// 一个"赛季"对应现实世界的一个月份（10 月、11 月……），由月份数字索引，
// 跨年重复同一个月份时默认沿用同一套图标（目前只定义了 10 月）。真正的
// "解锁记录"是按 seasonKey（形如 "2026-10"，年份+月份）存的，所以同一个
// 月份定义在不同年份各自有独立的解锁状态。
//
// 解锁规则（已跟用户确认）：3 个条件必须全部达成，才能解锁这一整套（本例
// 7 个）图标，一次性全部可换戴，不是一个条件对应一个图标，也不是达成其中
// 一个就够。过了这个月，新用户无法再"达成条件来解锁"这套图标，但已经
// 解锁过的，图标本身依然可以继续佩戴。
//
// 条件一共四类（每个赛季用其中三条）：
//   'thanks_card_triggered' —— 这个聊天窗口在本赛季月份内，有一条文字消息
//     （用户或角色说的都算）命中感恩节「谢谢」彩蛋的关键词
//     （festivalService.matchThanksKeyword），跟彩蛋卡片触发的条件一致。
//   'messages_total' —— 这个聊天窗口累计消息数达到 threshold 条
//     （跟 Almanac 的 'messages' 里程碑类型算法完全一致：按单个聊天窗口，
//      不是全局、也不是"这个月里新增"的消息数）。
//   'trick_triggered' —— 这个聊天窗口在本赛季月份内，成功触发过一次
//     "恶作剧"（trickService.createTrickMessage 写下的 type:'trick' 消息），
//     替代原本不存在的"万圣节特殊菜单"。
//   'ai_custom' —— 角色自己设定的要求，不是在这里写死的，而是由
//     monthlyBadgeAiService 在本月第一次打开兑换页时调用一次 AI 生成，
//     生成结果被限定在 AI_CUSTOM_TEMPLATES 这三种"AI 能提的要求"范围内
//     （每一种都对应一个可以用聊天消息直接判定真假的信号，不接受开放式、
//      无法验证的说法）。

export const AI_CUSTOM_TEMPLATES = [
  {
    templateId: 'extra_messages',
    title: '再聊满一些消息',
    aiPrompt:
      '要求对方在本月再发一定数量的消息给你（target 字段填一个 20 到 120 之间的整数）',
    minTarget: 20,
    maxTarget: 120,
  },
  {
    templateId: 'stickers_in_month',
    title: '本月收到一些表情包',
    aiPrompt:
      '要求对方在本月给你发一定数量的表情包（target 字段填一个 3 到 15 之间的整数）',
    minTarget: 3,
    maxTarget: 15,
  },
  {
    templateId: 'late_night_chat',
    title: '陪你聊到深夜',
    aiPrompt:
      '要求对方在本月有一次凌晨 0 点到 4 点之间还在跟你聊天（不需要 target 字段）',
    minTarget: null,
    maxTarget: null,
  },
];

// 十一月图标还没放上真实图片时用的占位图（虚线圆圈）。
const NOVEMBER_PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#f3e6d6" stroke="#c4502b" stroke-width="2" stroke-dasharray="4 4"/></svg>'
)}`;

export const MONTHLY_BADGE_SEASONS = {
  10: {
    month: 10,
    seasonId: 'halloween',
    sceneEyebrow: 'HALLOWEEN / OCT',
    sceneKind: 'halloween',
    seasonTitle: '万圣节限定',
    seasonSubtitle: '十月限定聊天成就图标',
    badges: [
      {
        id: 'halloween-cross-moon',
        title: '十字月光',
        description: '十字架与月亮，华丽风格',
        imageUrl: 'https://u2.fukit.cn/X4RH2wOg6',
      },
      {
        id: 'halloween-ghost-guitar',
        title: '幽灵吉他手',
        description: '小幽灵抱着吉他',
        imageUrl: 'https://u2.fukit.cn/oKL64jiAp',
      },
      {
        id: 'halloween-heart-cross-gem',
        title: '心形十字宝石',
        description: '爱心十字架宝石',
        imageUrl: 'https://u2.fukit.cn/n9VZGCXHn',
      },
      {
        id: 'halloween-castle-bats',
        title: '古堡夜翼',
        description: '万圣节城堡与飞舞的小蝙蝠',
        imageUrl: 'https://u2.fukit.cn/ynUOs1Fg0',
      },
      {
        id: 'halloween-candle-skull',
        title: '烛影骸骨',
        description: '蜡烛与骷髅',
        imageUrl: 'https://u2.fukit.cn/utQdxrQuF',
      },
      {
        id: 'halloween-ghost-candlestick',
        title: '提灯幽魂',
        description: '小幽灵拿着烛台',
        imageUrl: 'https://u2.fukit.cn/MUOuxCE2T',
      },
      {
        id: 'halloween-ghost-pumpkin',
        title: '南瓜灯幽魂',
        description: '华丽的小幽灵拿着南瓜灯',
        imageUrl: 'https://u2.fukit.cn/zz3MQWOkH',
      },
    ],
    conditions: [
      {
        id: 'messages-520',
        kind: 'fixed',
        type: 'messages_total',
        threshold: 520,
        title: '单聊满 520 条',
        description: '和 TA 在这个聊天窗口里，消息总数累计达到 520 条',
      },
      {
        id: 'trick-egg',
        kind: 'fixed',
        type: 'trick_triggered',
        title: '触发一次恶作剧',
        description: '本月在这个聊天窗口里，成功恶作剧了一次（无论是谁发起的）',
      },
           {
        id: 'ai-custom',
        kind: 'ai',
        title: 'TA 自己定的小考验',
        description: 'TA 这个月想到的一个小要求，三个条件要一起全部达成才能解锁',
      },
    ],
  },

  // 十一月：从枫叶到初雪。6 枚图标的 imageUrl 先用占位图，等图标生成好之后
  // 把每个 imageUrl 换成真实链接即可，其余字段不用动。
  11: {
    month: 11,
    seasonId: 'maple-to-snow',
    seasonTitle: '十一月限定',
    seasonSubtitle: '十一月限定聊天成就图标',
    sceneEyebrow: 'AUTUMN / NOV',
    sceneKind: 'november',
    badges: [
      {
        id: 'november-maple-letter',
        title: '枫叶信笺',
        description: '一片枫叶夹着手写便签',
        imageUrl: NOVEMBER_PLACEHOLDER_IMAGE,
      },
      {
        id: 'november-hearth-party',
        title: '暖炉派对',
        description: '南瓜派配热茶',
        imageUrl: NOVEMBER_PLACEHOLDER_IMAGE,
      },
      {
        id: 'november-scarf-turkey',
        title: '围巾小火鸡',
        description: '戴着围巾的卡通火鸡',
        imageUrl: NOVEMBER_PLACEHOLDER_IMAGE,
      },
      {
        id: 'november-pinecone-hoard',
        title: '松果储粮',
        description: '松鼠抱着松果，囤聊天记录',
        imageUrl: NOVEMBER_PLACEHOLDER_IMAGE,
      },
      {
        id: 'november-frost-window',
        title: '窗上霜花',
        description: '起雾的窗户上有手指画的小爱心',
        imageUrl: NOVEMBER_PLACEHOLDER_IMAGE,
      },
      {
        id: 'november-first-snow-cabin',
        title: '初雪小屋',
        description: '亮灯的小屋和第一场雪',
        imageUrl: NOVEMBER_PLACEHOLDER_IMAGE,
      },
    ],
    conditions: [
      {
        id: 'messages-1111',
        kind: 'fixed',
        type: 'messages_total',
        threshold: 1111,
        title: '单聊满 1111 条',
        description: '和 TA 在这个聊天窗口里，消息总数累计达到 1111 条',
      },
      {
        id: 'thanks-egg',
        kind: 'fixed',
        type: 'thanks_card_triggered',
        title: '触发一次感恩节彩蛋',
        description: '本月在这个聊天窗口里，出现过一次感恩节「谢谢」彩蛋（无论是谁说的）',
      },
      {
        id: 'ai-custom',
        kind: 'ai',
        title: 'TA 自己定的小考验',
        description: 'TA 这个月想到的一个小要求，三个条件要一起全部达成才能解锁',
      },
    ],
  },
};

/** "2026-10" 这种 年-月 格式，作为一次赛季解锁记录的唯一键。 */
export const getSeasonKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** 根据 seasonKey 取出对应月份的赛季静态定义；没有定义就返回 null。 */
export const getSeasonDefByKey = (seasonKey) => {
  const month = Number(String(seasonKey || '').slice(5, 7));
  if (!Number.isInteger(month)) return null;
  return MONTHLY_BADGE_SEASONS[month] || null;
};

/** 当前这一刻，是否存在一个"正在进行"的赛季（即当前月份有图标定义）。 */
export const getActiveSeason = (date = new Date()) => {
  const seasonKey = getSeasonKey(date);
  const def = getSeasonDefByKey(seasonKey);
  if (!def) return null;
  return { seasonKey, def };
};

export const findBadgeInSeason = (seasonDef, badgeId) =>
  (seasonDef?.badges || []).find((badge) => badge.id === badgeId) || null;

export const findAiTemplate = (templateId) =>
  AI_CUSTOM_TEMPLATES.find((item) => item.templateId === templateId) || null;