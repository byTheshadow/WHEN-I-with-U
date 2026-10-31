// src/apps/hub/appRegistry.js
//
// 首页所有应用入口的「基本信息」注册表：id、中英韩名称、副标题、图标名、
// 所属分组、角标来源、状态。纯数据，不 import 任何东西（包括 React、
// lucide、数据库），所以任何版式都能直接引用，也能在 node 里直接跑检查。
//
// 为什么单独抽一份：appGridItems.jsx 里每个应用是写死的 GlassCard JSX，
// 图标、名称、颜色都和卡片样式绑在一起。新的整页版式（图标桌面、档案柜、
// 分区文件夹、小屋……）只需要「名称 + 图标 + 点击后打开谁」，从这里拿
// 就行，不用去解析卡片 JSX。appGridItems.jsx 本身不改，继续按原样工作。
//
// 数据来源：appGridItems.jsx（id、中英韩名称、图标）和 AppGrid.jsx
// （Messages 固定在应用区上方）。分组是按名称和副标题做的初稿，标了
// 「待确认」的几项请按实际功能调整，改这一个文件即可，所有版式同步生效。
//
// 字段说明：
//   id       和 onOpenApp(id) 的路由名完全一致，不要随便改。
//   en/zh/ko 名称。ko 为 null 表示仓库里没有对应的韩文名，显示时回退到英文名。
//   sub      副标题（英文，和现有卡片上的小字一致）；null 表示现有卡片上
//            没有副标题（匿名信箱、定时工作流），版式自己决定要不要补一句。
//   icon     lucide 图标的名字（字符串），真正的组件在 appIcons.js 里映射。
//   group    所属分组 id，见 HUB_APP_GROUPS。
//   badge    角标数字来源：'askCount' / 'habitatCount' / 'activeWorkflowCount'，
//            和 buildAppGridItems 的同名参数一致；null 表示没有角标。
//   status   'wip' 表示还在装修中（比如泡泡），null 表示正常。
//   pinned   true 表示固定在应用区上方，不参与翻页和排序（目前只有 Messages）。
//   todo     true 表示分组或功能描述待确认。

export const HUB_APP_GROUPS = [
  { id: 'talk', label: '对话与角色', en: 'Talk', hint: 'Chat, groups, roleplay' },
  { id: 'memory', label: '记忆与档案', en: 'Memory', hint: 'Diaries, archives, keepsakes' },
  { id: 'story', label: '故事与创作', en: 'Stories', hint: 'Fiction, worlds, making things' },
  { id: 'daily', label: '日常与外出', en: 'Daily', hint: 'Plans, trips, places' },
  { id: 'play', label: '玩与小物', en: 'Play', hint: 'Games and little things' },
  { id: 'tools', label: '工具', en: 'Tools', hint: 'Workflows and logs' },
];

export const HUB_APPS = [
  // ---- 对话与角色 ----
  { id: 'messages', en: 'Messages', zh: '消息', ko: null, sub: 'Continue the conversation', icon: 'MessageSquare', group: 'talk', badge: null, status: null, pinned: true },
  { id: 'ensemble', en: 'The Ensemble', zh: '羁绊圈', ko: '인연의 고리', sub: 'Bonded Group', icon: 'Users', group: 'talk', badge: null, status: null },
  { id: 'bubble', en: 'Bubble', zh: '泡泡', ko: '버블', sub: 'Group Bubbles', icon: 'MessagesSquare', group: 'talk', badge: null, status: 'wip' },
  { id: 'rp', en: 'RP', zh: '长文', ko: '장문 롤플레이', sub: 'Immersive Roleplay', icon: 'ScrollText', group: 'talk', badge: null, status: null },
  { id: 'callHistory', en: 'Call History', zh: '通话记录', ko: '통화 기록', sub: 'Voice Calls', icon: 'PhoneCall', group: 'talk', badge: null, status: null },
  { id: 'askbox', en: 'Ask Box', zh: '匿名信箱', ko: '익명 사서함', sub: null, icon: 'MailOpen', group: 'talk', badge: 'askCount', status: null },

  // ---- 记忆与档案 ----
  { id: 'diaries', en: 'Diaries', zh: '日记', ko: '일기', sub: 'Sync Memories', icon: 'BookOpen', group: 'memory', badge: null, status: null },
  { id: 'memory', en: 'Memory Room', zh: '记忆室', ko: '기억의 방', sub: 'Private Archive', icon: 'Archive', group: 'memory', badge: null, status: null },
  { id: 'archive', en: 'Archive Room', zh: '存档室', ko: '보관함', sub: 'Old Messages', icon: 'FolderArchive', group: 'memory', badge: null, status: null },
  { id: 'ephemera', en: 'Ephemera', zh: '时光票根', ko: '시간의 조각', sub: 'Time Tickets', icon: 'Ticket', group: 'memory', badge: null, status: null },
  { id: 'snapshots', en: 'Snapshots', zh: '快照', ko: '스냅샷', sub: 'Polaroid Feed', icon: 'Camera', group: 'memory', badge: null, status: null, todo: true },
  { id: 'almanac', en: 'Almanac', zh: '岁时纪', ko: '세시기', sub: 'Seasonal Notes', icon: 'BookOpen', group: 'memory', badge: null, status: null },

  // ---- 故事与创作 ----
  { id: 'imaginarium', en: 'Imaginarium', zh: '幻想沙龙', ko: '환상 살롱', sub: 'Virtual Salon', icon: 'Sparkles', group: 'story', badge: null, status: null },
  { id: 'fiction', en: 'Fiction', zh: '互动文游', ko: '인터랙티브 소설', sub: 'Story Shelf', icon: 'BookMarked', group: 'story', badge: null, status: null },
  { id: 'shared-world', en: 'Shared World', zh: '共享世界', ko: '공유 세계', sub: 'Booklets', icon: 'Globe', group: 'story', badge: null, status: null },
  { id: 'margin-notes', en: 'The Margin Notes', zh: '页边注', ko: null, sub: 'A shared reading room', icon: 'BookOpen', group: 'story', badge: null, status: null },
  { id: 'imagestudio', en: 'Studio', zh: '生图室', ko: '이미지 스튜디오', sub: 'Image Studio', icon: 'Palette', group: 'story', badge: null, status: null },
  { id: 'greeting', en: 'Cards', zh: '贺卡', ko: '카드', sub: 'Greeting Cards', icon: 'Gift', group: 'story', badge: null, status: null },

  // ---- 日常与外出 ----
  { id: 'planner', en: 'Planner', zh: '日程', ko: '일정', sub: 'Shared Schedule', icon: 'Calendar', group: 'daily', badge: null, status: null },
  { id: 'rhythm', en: 'Rhythm', zh: '律动', ko: '리듬', sub: 'Study Rhythm', icon: 'Clock', group: 'daily', badge: null, status: null, todo: true },
  { id: 'newspaper', en: 'Daily Post', zh: '晨报', ko: '아침 소식', sub: 'Morning Press', icon: 'Newspaper', group: 'daily', badge: null, status: null },
  { id: 'travel', en: 'Travel', zh: '旅行', ko: '여행', sub: 'Journey Log', icon: 'Compass', group: 'daily', badge: null, status: null },
  { id: 'tripHome', en: 'Trip Home', zh: '旅行小屋', ko: '여행 집', sub: 'Postcards', icon: 'Plane', group: 'daily', badge: null, status: null },
  { id: 'footprintMap', en: 'Footprints', zh: '足迹地图', ko: '발자취 지도', sub: 'Places', icon: 'Map', group: 'daily', badge: null, status: null },

  // ---- 玩与小物 ----
  { id: 'flightchess', en: 'Flight Chess', zh: '飞行棋', ko: '루도 게임', sub: 'Roll the Dice', icon: 'Dices', group: 'play', badge: null, status: null },
  { id: 'textgames', en: 'Text Game Hall', zh: '文字游戏', ko: '텍스트 게임', sub: 'Issue Index', icon: 'Gamepad2', group: 'play', badge: null, status: null },
  { id: 'pebbling', en: 'Pebbling', zh: '传石', ko: '조약돌', sub: 'Nest Exchange', icon: 'Waves', group: 'play', badge: null, status: null, todo: true },
  { id: 'habitat', en: 'Living Habitat', zh: '生态瓶', ko: '생태 서식지', sub: 'Bio-Sync', icon: 'Leaf', group: 'play', badge: 'habitatCount', status: null, todo: true },
  { id: 'shell', en: 'Tidal Shell', zh: '潮汐贝壳', ko: '파도의 조개', sub: 'Fragments washed ashore', icon: 'Shell', group: 'play', badge: null, status: null, todo: true },
  { id: 'emotionkit', en: 'First-Aid', zh: '情绪急救盒', ko: '감정 응급상자', sub: 'Draw a Note', icon: 'Heart', group: 'play', badge: null, status: null },
  { id: 'badges', en: 'Badges', zh: '限定图标', ko: '한정 배지', sub: 'Monthly Exchange', icon: 'Medal', group: 'play', badge: null, status: null, todo: true },

  // ---- 工具 ----
  { id: 'workflows', en: 'Workflows', zh: '定时工作流', ko: '예약 워크플로우', sub: null, icon: 'Repeat', group: 'tools', badge: 'activeWorkflowCount', status: null },
  { id: 'hourglass', en: 'Hourglass', zh: '信号沙漏', ko: '신호 모래시계', sub: 'API Signal Log', icon: 'Hourglass', group: 'tools', badge: null, status: null },
];

const APP_BY_ID = new Map(HUB_APPS.map((app) => [app.id, app]));

export const getHubApp = (id) => APP_BY_ID.get(id) || null;

export const getHubAppsByGroup = (groupId) =>
  HUB_APPS.filter((app) => app.group === groupId);

// 按分组顺序返回 [{ ...分组信息, apps: [...] }]，档案柜、分区文件夹、
// 小屋这类按组展示的版式直接用这个。
export const getGroupedHubApps = () =>
  HUB_APP_GROUPS.map((group) => ({
    ...group,
    apps: getHubAppsByGroup(group.id),
  }));

// 应用区网格里的应用（不含固定在上方的 Messages），数量和顺序对应
// 现有 appGridItems.jsx 里的 32 个，但这里是按分组排序，不是网格顺序。
export const getGridHubApps = () => HUB_APPS.filter((app) => !app.pinned);

// 按「应用名称显示模式」算出副名称（中文或韩文）。
// 模式取值和 useAppNameDisplayMode.js 里的常量一致：
//   'en' 只显示英文、'bilingual' 英文加中文、'korean' 英文加韩文。
// 返回 null 表示不显示副名称。韩文缺失时同样返回 null，调用方只显示英文。
export const getAppSecondaryName = (app, mode) => {
  if (!app) return null;
  if (mode === 'bilingual') return app.zh || null;
  if (mode === 'korean') return app.ko || null;
  return null;
};

export default HUB_APPS;