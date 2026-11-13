import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Check,
  Droplets,
  Gamepad2,
  Heart,
  HelpCircle,
  Palette,
  Pencil,
  Shirt,
    ShoppingBag,
  Sparkles,
  Store,
  Upload,
  UtensilsCrossed,
  X,
    HeartHandshake,
} from 'lucide-react';

import {
  adoptCompanion,
  buyShopItem,
  claimCompanionEvent,
  equipOutfit,
  getActiveEvents,
  getBackpack,
  getCompanionByChat,
  getInventory,
  getRecentLogs,
  openCompanionSession,
  performFreeAction,
  pokeCompanion,
  renameCompanion,
  resolveCompanionChoiceEvent,
  setCompanionScene,
  updateCompanionAvatar,
  useBackpackItem,
  useLegendaryFood,
} from './companionService';
import { DEFAULT_AVATARS, findScene, findShopItem, getAllSceneOptions } from './companionShopData';
import { buyFreezeCard, getStreakForChat } from '../messages/streak/streakService';
import CompanionShopModal from './CompanionShopModal';
import CompanionSceneModal from './CompanionSceneModal';
import CompanionHeartsInfoModal from './CompanionHeartsInfoModal';
import CompanionProfileModal from './profile/CompanionProfileModal';
import CompanionProfileIcon from './profile/CompanionProfileIcon';
import CompanionHeartIcon from './CompanionHeartIcon';
import CompanionFortuneModal from './fortune/CompanionFortuneModal';
import CompanionCatchGameModal from './play/CompanionCatchGameModal';
import CompanionPlayPickerModal from './play/CompanionPlayPickerModal';
import CompanionMarblesModal from './marbles/CompanionMarblesModal';
import CompanionWishPoolModal from './wish/CompanionWishPoolModal';
import CompanionBackpackModal from './backpack/CompanionBackpackModal';
   import CompanionDiaryBook from './diary/CompanionDiaryBook';
   import CompanionDiaryIcon from './diary/CompanionDiaryIcon';
import CompanionBackpackIcon from './backpack/CompanionBackpackIcon';
import CompanionFortuneIcon from './fortune/CompanionFortuneIcon';
import CompanionGameIcon from './play/CompanionGameIcon';
import CompanionMoodCalendar from './mood/CompanionMoodCalendar';
import { CompanionMoodEntryIcon } from './mood/companionMoodIcons';
import CompanionDailyQaModal from './daily-qa/CompanionDailyQaModal';
import CompanionDailyQaIcon from './daily-qa/CompanionDailyQaIcon';
import CompanionClawMachine from './claw/CompanionClawMachine';
import CompanionClawIcon from './claw/CompanionClawIcon';
import CompanionSchoolModal from './school/CompanionSchoolModal';
import CompanionSchoolIcon from './school/CompanionSchoolIcon';
import SweetStreetDockIcon from '../sweetstreet/SweetStreetDockIcon';
import { openSweetStreet } from '../sweetstreet/openSweetStreet';
import { getSchoolStatus } from './school/companionSchoolService';
import CompanionTasksModal from './tasks/CompanionTasksModal';
import CompanionTasksIcon from './tasks/CompanionTasksIcon';
import { getDailyTaskView } from './tasks/companionTaskService';
import CompanionCustodyNote from './custody/CompanionCustodyNote';
import CompanionCustodyLetter from './custody/CompanionCustodyLetter';
import CompanionCustodyIcon from './custody/CompanionCustodyIcon';
import { setCustodyEnabled, takePendingCustodyLetter } from './custody/companionCustodyService';
import CompanionCustodySchoolLetter from './custody/CompanionCustodySchoolLetter';
import { takePendingCustodySchoolLetter, comfortCompanionAfterBadLesson } from './custody/companionCustodySchoolService';
import CompanionFriendPage from './friends/CompanionFriendPage';
import CompanionFriendMealLetter from './friends/CompanionFriendMealLetter';
import { takePendingFriendMealLetter } from './friends/companionFriendMealService';
import CompanionFriendIcon from './friends/CompanionFriendIcon';
  import CompanionChatModal from './chat/CompanionChatModal';
  import CompanionChatIcon from './chat/CompanionChatIcon';
import { getFriendDockBadgeCount, getCompanionSnapshot } from './friends/companionFriendService';
import './companionPage.css';
import './companionSleep.css';
import {
  SLEEPING_STATUS_LINE,
  SLEEP_WAKE_CONFIRM_LINE,
  isCompanionSleeping,
  takePendingWakeTip,
} from './companionSleepService';
/*
 * 把用户上传的图片压到一个头像该有的尺寸、保留透明通道、输出 PNG。
 *
 * 思路照抄 src/apps/pet/petWidgetService.js 的 compressPetAvatar，
 * 但按第 9.1 节的约定这里是新写的一份、不 import 那边的代码。
 */
const compressAvatarFile = (file) => new Promise((resolve, reject) => {
  if (!file?.type?.startsWith('image/')) {
    reject(new Error('请选择有效的图片文件。'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'));

  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('图片无法处理，请尝试其他文件。'));

    image.onload = () => {
      const maxEdge = 512;
      const longestEdge = Math.max(image.width, image.height);
      const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('当前浏览器无法处理图片。'));
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };

    image.src = String(reader.result || '');
  };

  reader.readAsDataURL(file);
});

const rand = (min, max) => min + Math.random() * (max - min);
const clampPercent = (value) => Math.max(0, Math.min(100, value));

// ---- 漂浮数值小动画：渲染挂在某个锚点（satiety/mood/hearts）上的一批 +N ----
const FloatingNumbers = ({ floaters, anchor, color }) => {
  const items = floaters.filter((item) => item.anchor === anchor);
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item, index) => (
        <span
          key={item.id}
          className="cp-floating-number"
          style={{ right: 0, top: '-2px', color, marginRight: `${index * 18}px` }}
        >
          {item.text}
        </span>
      ))}
    </>
  );
};

// 状态气泡里的一行：图标 + 名称 + 数值，下面一条进度条
const StatBar = ({ icon: Icon, label, value, floaters, anchor, tone }) => (
  <div className={`cp-stat-row ${tone}`}>
    <div className="cp-stat-top">
      <Icon className="cp-ic" />
      {label}
      <b className="cp-stat-val">
        {Math.round(value)}
        <FloatingNumbers floaters={floaters} anchor={anchor} color="var(--cp-accent)" />
      </b>
    </div>
    <div className="cp-track" role="img" aria-label={label}>
      <i className="cp-fill" style={{ width: `${clampPercent(value)}%` }} />
    </div>
  </div>
);

const ACTIONS = [
  { id: 'feed', label: '喂食', icon: UtensilsCrossed },
  { id: 'clean', label: '清洁', icon: Droplets },
  { id: 'play', label: '玩耍', icon: Gamepad2 },
];

// 三个互动各自的动效：宠物动作 + 粒子
const ACTION_FX = {
  feed: { zone: 'munch', particle: 'crumb', count: 8, gap: 80, ms: 1400 },
  clean: { zone: 'wiggle', particle: 'bubble-p', count: 10, gap: 70, ms: 900 },
  play: { zone: 'hop', particle: 'spark', count: 9, gap: 40, ms: 950 },
};

// ---- 动态时间线：按内容给每条动态配一张小贴纸（吃/玩/洗/换装/购物/改名/来看过） ----
const LOG_KINDS = {
  feed: { label: '喂食', icon: UtensilsCrossed },
  clean: { label: '清洁', icon: Droplets },
  play: { label: '玩耍', icon: Gamepad2 },
  outfit: { label: '换装', icon: Shirt },
  buy: { label: '购物', icon: ShoppingBag },
  rename: { label: '改名', icon: Pencil },
  visit: { label: '来看过', icon: Heart },
  custody: { label: '贴心照顾', icon: Heart },
  other: { label: '动态', icon: Sparkles },
    friend_meal: { label: '蹭饭', icon: HeartHandshake },
};

const matchLogKind = (text) => {
  const value = String(text || '').toLowerCase();
  if (!value) return null;
  if (/feed|food|eat|喂|吃|点心|好吃/.test(value)) return 'feed';
  if (/clean|wash|bath|洗|澡|清洁/.test(value)) return 'clean';
  if (/play|玩|陪/.test(value)) return 'play';
  if (/outfit|equip|cloth|换上|穿|衣|围巾|帽/.test(value)) return 'outfit';
  if (/buy|purchase|shop|买|购|商店/.test(value)) return 'buy';
  if (/rename|改名|名字/.test(value)) return 'rename';
  return null;
};

// 先看 logType，认不出来再从内容里找关键词
const getLogKind = (log) => {
  if (log.logType === 'co_care') return 'visit';
  if (log.logType === 'custody_care') return 'custody';
    if (log.logType === 'friend_meal') return 'friend_meal';
  return matchLogKind(log.logType) || matchLogKind(log.content) || 'other';
};

// 如果日志里带了时间（createdAt / created_at / timestamp），就显示成"刚刚 / 5 分钟前 / 3/14"
const formatLogTime = (log) => {
  const raw = log.createdAt ?? log.created_at ?? log.timestamp;
  if (raw === undefined || raw === null || raw === '') return '';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} 小时前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const FLOATER_LIFETIME_MS = 1100;
const STATS_AUTO_CLOSE_MS = 2400;
const CONFETTI_COLORS = ['#3A97E8', '#FFD27A', '#8FD9C0', '#8CC9FF', '#FF86A0'];

// 跟 MemoirPage 一样的全屏方式：脱离父容器，直接铺满整个视口
const ROOT_CLASS = 'cp-root fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden animate-fade-in-up';
const ROOT_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  width: '100%',
  height: '100dvh',
  overflow: 'hidden',
  background: 'var(--bg-main)',
};

const CompanionPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [companion, setCompanion] = useState(null);
  const [logs, setLogs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [backpackItems, setBackpackItems] = useState([]);
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [showHeartsInfo, setShowHeartsInfo] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFortune, setShowFortune] = useState(false);
   const [showCatchGame, setShowCatchGame] = useState(false);
  const [showPlayPicker, setShowPlayPicker] = useState(false);
  const [showMarblesGame, setShowMarblesGame] = useState(false);
  const [showWishPool, setShowWishPool] = useState(false);
     const [showMoodCalendar, setShowMoodCalendar] = useState(false);
  const [showDailyQa, setShowDailyQa] = useState(false);
  const [showDiary, setShowDiary] = useState(false);
   const [showClaw, setShowClaw] = useState(false);
  const [showSchool, setShowSchool] = useState(false);
  const [schoolDotOn, setSchoolDotOn] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [taskView, setTaskView] = useState(null);
  // 托管给角色：小纸条面板 / 处理中 / 还没弹过的"贴心照顾"信
  const [showCustody, setShowCustody] = useState(false);
  const [custodyBusy, setCustodyBusy] = useState(false);
  const [custodyLetter, setCustodyLetter] = useState(null);
  // 托管上学：还没弹过的"学校来信"
  const [schoolLetter, setSchoolLetter] = useState(null);
  // 好友广场 + 我的朋友
  const [showFriends, setShowFriends] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [mealLetter, setMealLetter] = useState(null);

  // 每日任务：companion 对象每次更新（喂食/戳一戳/上学/……任何互动）
  // 都重新拉一次最新的任务进度——这些互动大多会改到 companion.dailyTasks
  // 或 hearts，companion 本身是每次都新建的对象，依赖它整体正好能在
  // "任务可能有进展"的时候刷新，不需要每个互动点各自手动触发一次。
  useEffect(() => {
    if (!companion) {
      setTaskView(null);
      return;
    }
    let cancelled = false;
    getDailyTaskView(companion.id).then((view) => {
      if (!cancelled) setTaskView(view);
    }).catch(() => {
      // 静默失败，不影响其它功能
    });
    return () => { cancelled = true; };
  }, [companion]);

  const pendingTaskCount = taskView ? Math.max(0, taskView.totalCount - taskView.completedCount) : 0;

  // 「上学」dock 小红点：还没入学 / 满 20 节可以升班时才亮，别的时候都不亮
  // （包括还有课没上），升班到小学后不会再出现。
  const refreshSchoolDot = async () => {
    if (!companion) return;
    try {
      const st = await getSchoolStatus(companion.id);
      setSchoolDotOn(!st.enrolled || st.promote.canPromote);
    } catch (_) {
      // 静默失败，不影响其它功能
    }
  };
  useEffect(() => {
    refreshSchoolDot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companion?.id]);
  const [chatStreakCount, setChatStreakCount] = useState(0);
  const [isPoking, setIsPoking] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [eventPopup, setEventPopup] = useState(null);

  // 新增的纯视觉 state：状态气泡 / 抽屉 / 动效
  const [showStats, setShowStats] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState('logs');
  const [zoneFx, setZoneFx] = useState('');
  const [particles, setParticles] = useState([]);
  const [hasPoked, setHasPoked] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [isClaiming, setIsClaiming] = useState(false);

  // 领养表单
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_AVATARS[0]?.id || null);
  const [uploadedAvatar, setUploadedAvatar] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [isAdopting, setIsAdopting] = useState(false);
  const [adoptError, setAdoptError] = useState('');

  // 改名
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const feedbackTimerRef = useRef(null);
  const pokeTimerRef = useRef(null);
  const avatarInputRef = useRef(null);
  const adoptFileInputRef = useRef(null);
  const floaterTimersRef = useRef([]);
  const statsTimerRef = useRef(null);
  const zoneFxTimerRef = useRef(null);
  const claimTimerRef = useRef(null);

  // 睡觉：页面开着的时候跨过睡觉/起床时间点也要自己切换，所以每分钟刷新一次。
  // wakeConfirmRef 记录"睡觉时点了喂食/清洁/玩耍的第一下"，5 秒内再点同一个才真的叫醒它。
  const [sleepTick, setSleepTick] = useState(0);
  const wakeConfirmRef = useRef({ action: null, at: 0 });
  useEffect(() => {
    const timerId = window.setInterval(() => setSleepTick((n) => n + 1), 60000);
    return () => window.clearInterval(timerId);
  }, []);

  // 抽屉拖拽用
  const rootRef = useRef(null);
  const sheetRef = useRef(null);
  const peekRef = useRef(null);
  const dragRef = useRef(null);
  const reload = async () => {
    const { companion: found, newEvents } = await openCompanionSession(chatId);
    setCompanion(found);

    if (found) {
      const [recentLogs, ownedItems, backpackRows] = await Promise.all([
        getRecentLogs(found.id),
        getInventory(found.id),
        getBackpack(found.id),
      ]);
      setLogs(recentLogs);
      setInventory(ownedItems);
      setBackpackItems(backpackRows);

      // 新出现的事件，自动弹一个详情（只弹第一个，另一个留在横幅里点开看）。
      if (newEvents.length > 0) {
        setEventPopup(newEvents[0]);
      }

      // 托管期间攒下的"贴心照顾"信：用户回来时弹一次，取走即清空。
      try {
        const pendingLetter = await takePendingCustodyLetter(found.id);
        if (pendingLetter) setCustodyLetter(pendingLetter);
      } catch (_) { /* 静默失败，不影响页面加载 */ }

      // 睡醒后的早安小提示：取走即清空，用气泡显示一次。
      try {
        const wakeTip = await takePendingWakeTip(found.id);
        if (wakeTip) showFeedback(wakeTip);
      } catch (_) { /* 静默失败，不影响页面加载 */ }

            // 蹭饭期间攒下的"蹭饭"信，跟贴心照顾信一样用户回来时弹一次。
      try {
        const pendingMealLetter = await takePendingFriendMealLetter(found.id);
        if (pendingMealLetter) setMealLetter(pendingMealLetter);
      } catch (_) { /* 静默失败，不影响页面加载 */ }

      // 托管上学期间攒下的"学校来信"，同样用户回来时弹一次、取走即清空。
      try {
        const pendingSchoolLetter = await takePendingCustodySchoolLetter(found.id);
        if (pendingSchoolLetter) setSchoolLetter(pendingSchoolLetter);
      } catch (_) { /* 静默失败，不影响页面加载 */ }
    }

    setIsLoading(false);
  };


  // 好友页用：只刷新 companion 对象本身（friendPlaza/friends），
  // 不用像 reload() 那样顺带查日志/背包/事件。
  const refreshCompanionForFriends = async () => {
    if (!companion) return;
    const [fresh, freshBackpack] = await Promise.all([
      getCompanionSnapshot(companion.id),
      getBackpack(companion.id),
    ]);
    if (fresh) setCompanion(fresh);
    setBackpackItems(freshBackpack);
  };

  // 小纸条上的开关：打开时会立刻跑一轮托管，跑完如果有信就直接弹出来。
  const handleToggleCustody = async () => {
    if (!companion || custodyBusy) return;
    setCustodyBusy(true);
    try {
      const updated = await setCustodyEnabled(companion.id, !companion.custodyEnabled);
      if (updated) setCompanion(updated);
      setLogs(await getRecentLogs(companion.id));
           if (updated?.custodyEnabled) {
        const letter = await takePendingCustodyLetter(companion.id);
        if (letter) {
          setShowCustody(false);
          setCustodyLetter(letter);
        }
        // 打开开关这一下也会顺手带课（见 runCustodyForCompanion），
        // 一样取一次学校来信，没有就是 null，不影响上面那封信。
        const lessonLetter = await takePendingCustodySchoolLetter(companion.id);
        if (lessonLetter) {
          setShowCustody(false);
          setSchoolLetter(lessonLetter);
        }
      }
    } catch (error) {
      showFeedback(error.message || '这次没拜托成功，请再试一次。');
    } finally {
      setCustodyBusy(false);
    }
  };

  // 考砸之后的"安慰一下"：提交安慰话，成功/不成功都更新 companion
  // （succeeded 时心情回涨），把结果透传给信件组件展示。
  const handleComfortSchool = async (text) => {
    if (!companion) return null;
    const res = await comfortCompanionAfterBadLesson(companion.id, text);
    if (res?.companion) setCompanion(res.companion);
    return res;
  };
  useEffect(() => {
    void reload();
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current);
      if (statsTimerRef.current) window.clearTimeout(statsTimerRef.current);
      if (zoneFxTimerRef.current) window.clearTimeout(zoneFxTimerRef.current);
      if (claimTimerRef.current) window.clearTimeout(claimTimerRef.current);
      floaterTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      floaterTimersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const showFeedback = (text) => {
    setFeedback(text);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(''), 4000);
  };

  // ---- 状态气泡：点小图标展开，点别处/按 Esc 收起；互动之后自动弹一下 ----
  const setStatsOpen = (open, autoClose = false) => {
    if (statsTimerRef.current) window.clearTimeout(statsTimerRef.current);
    setShowStats(open);
    if (open && autoClose) {
      statsTimerRef.current = window.setTimeout(() => setShowStats(false), STATS_AUTO_CLOSE_MS);
    }
  };

  useEffect(() => {
    if (!showStats) return undefined;

    const handlePointerDown = (event) => {
      if (!event.target.closest?.('[data-cp-stats]')) setStatsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setStatsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStats]);

  // ---- 漂浮数值：喂食/清洁/玩耍/戳一戳之后，在对应的数值条上飘一个 +N ----
  const spawnFloater = (anchor, text) => {
    const id = `${anchor}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFloaters((prev) => [...prev, { id, anchor, text }]);
    const timerId = window.setTimeout(() => {
      setFloaters((prev) => prev.filter((item) => item.id !== id));
    }, FLOATER_LIFETIME_MS);
    floaterTimersRef.current.push(timerId);
  };

  const spawnDeltaFloaters = (before, after) => {
    if (!before || !after) return;

    const satietyDelta = Math.round(after.satiety - before.satiety);
    const moodDelta = Math.round(after.mood - before.mood);
    const cleanlinessDelta = Math.round((after.cleanliness ?? 100) - (before.cleanliness ?? 100));
    const heartsDelta = Math.round((after.hearts - before.hearts) * 10) / 10;

    if (satietyDelta !== 0) spawnFloater('satiety', `${satietyDelta > 0 ? '+' : ''}${satietyDelta}`);
    if (moodDelta !== 0) spawnFloater('mood', `${moodDelta > 0 ? '+' : ''}${moodDelta}`);
    if (cleanlinessDelta !== 0) spawnFloater('cleanliness', `${cleanlinessDelta > 0 ? '+' : ''}${cleanlinessDelta}`);
    if (heartsDelta !== 0) spawnFloater('hearts', `${heartsDelta > 0 ? '+' : ''}${heartsDelta}`);
  };

  // ---- 粒子：以宠物中心为原点，随机散开（crumb/bubble-p/spark/ripple/heart-p） ----
  const spawnParticles = (type, count, gap = 90) => {
    const stamp = Date.now();
    const batch = Array.from({ length: count }, (_, index) => {
      let dx = rand(-60, 60);
      let dy = rand(-90, -20);
      let offsetX = type === 'crumb' ? 0 : rand(-40, 40);
      let offsetY = type === 'crumb' ? -10 : rand(-10, 60);

      if (type === 'spark') {
        dx = rand(-90, 90);
        dy = rand(-100, 50);
      }
      if (type === 'ripple' || type === 'heart-p') {
        dx = rand(-30, 30);
        offsetX = rand(-24, 24);
        offsetY = rand(-24, 8);
      }

      return {
        id: `${type}-${stamp}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        style: {
          '--x': `calc(50% + ${offsetX}px)`,
          '--y': `calc(50% + ${offsetY}px)`,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
          '--s': `${rand(10, 24)}px`,
          animationDelay: `${index * gap}ms`,
        },
      };
    });

    setParticles((prev) => [...prev, ...batch]);
    const doomed = new Set(batch.map((item) => item.id));
    const timerId = window.setTimeout(() => {
      setParticles((prev) => prev.filter((item) => !doomed.has(item.id)));
    }, 1800 + count * gap);
    floaterTimersRef.current.push(timerId);
  };

  const playActionFx = (actionType) => {
    const fx = ACTION_FX[actionType];
    if (!fx) return;

    setZoneFx(fx.zone);
    if (zoneFxTimerRef.current) window.clearTimeout(zoneFxTimerRef.current);
    zoneFxTimerRef.current = window.setTimeout(() => setZoneFx(''), fx.ms);
    spawnParticles(fx.particle, fx.count, fx.gap);
  };

  const handlePickAdoptFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await compressAvatarFile(file);
      setUploadedAvatar(dataUrl);
      setSelectedPreset(null);
      setAdoptError('');
    } catch (error) {
      setAdoptError(error.message || '图片处理失败');
    }
  };

  const handleAdopt = async () => {
    const avatarUrl = uploadedAvatar || DEFAULT_AVATARS.find((item) => item.id === selectedPreset)?.url;

    if (!avatarUrl) {
      setAdoptError('先选一个形态，或上传自己的图。');
      return;
    }
    if (!nameDraft.trim()) {
      setAdoptError('给它起个名字吧。');
      return;
    }

    setIsAdopting(true);
    setAdoptError('');

    try {
      await adoptCompanion({
        chatId,
        characterId: character?.id ?? null,
        name: nameDraft.trim(),
        avatarUrl,
      });
      await reload();
    } catch (error) {
      setAdoptError(error.message || '领养失败，请重试。');
    } finally {
      setIsAdopting(false);
    }
  };

  const handleChangeAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !companion) return;

    try {
      const dataUrl = await compressAvatarFile(file);
      const updated = await updateCompanionAvatar(companion.id, dataUrl);
      setCompanion(updated);
    } catch (error) {
      showFeedback(error.message || '换图失败，请重试。');
    }
  };

  const handleFreeAction = async (actionType) => {
    if (!companion || isActing) return;

    // 睡觉时：第一下只提示"再点一次会叫醒它"，5 秒内再点同一个才真的执行。
    if (isSleeping) {
      const pending = wakeConfirmRef.current;
      const confirmed = pending.action === actionType && Date.now() - pending.at < 5000;
      if (!confirmed) {
        wakeConfirmRef.current = { action: actionType, at: Date.now() };
        showFeedback(SLEEP_WAKE_CONFIRM_LINE);
        return;
      }
      wakeConfirmRef.current = { action: null, at: 0 };
    }

    setIsActing(true);
    const before = companion;

    try {
      const result = await performFreeAction(companion.id, actionType);
      if (result) {
        playActionFx(actionType);
        setStatsOpen(true, true);
        spawnDeltaFloaters(before, result.companion);
        setCompanion(result.companion);
        showFeedback(result.feedbackText);
        setLogs(await getRecentLogs(companion.id));
      }
    } catch (error) {
      showFeedback(error.message || '这次没成功，稍后再试试。');
    } finally {
      setIsActing(false);
    }
  };

  const handlePoke = async () => {
    if (!companion) return;
    const before = companion;

    setHasPoked(true);
    setIsPoking(true);
    if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current);
    pokeTimerRef.current = window.setTimeout(() => setIsPoking(false), 500);
    spawnParticles('ripple', 1, 0);
    if (!isSleeping) spawnParticles('heart-p', 1, 0); // 睡觉时被戳是被嫌弃，不冒爱心

    try {
      const result = await pokeCompanion(companion.id);
      if (result) {
        spawnDeltaFloaters(before, result.companion);
        setCompanion(result.companion);
        showFeedback(result.line);
      }
    } catch (error) {
      // 戳一戳很轻量，失败了就当没发生，不打扰用户
    }
  };

  const handleBuy = async (itemId) => {
    if (!companion) return;
    const updated = await buyShopItem(companion.id, itemId);
    setCompanion(updated);
    setInventory(await getInventory(companion.id));
    setLogs(await getRecentLogs(companion.id));
    setBackpackItems(await getBackpack(companion.id));
  };

  const handleBuyTool = async (itemId) => {
    if (!companion || !chatId) return;
    // 目前只有冻结卡这一种道具，统一走 streakService
    await buyFreezeCard(chatId, companion.id);
    // 刷新心心余额
    const updated = await getCompanionByChat(chatId);
    if (updated) setCompanion(updated);
  };

  const handleToggleOutfit = async (itemName) => {
    if (!companion) return;
    const next = companion.equippedOutfit === itemName ? null : itemName;
    const updated = await equipOutfit(companion.id, next);
    setCompanion(updated);
    spawnParticles('spark', 5, 50);
  };

  const handleSelectScene = async (sceneId) => {
    if (!companion) return;
    const updated = await setCompanionScene(companion.id, sceneId);
    setCompanion(updated);
    setShowScenePicker(false);
  };

  const handleStartRename = () => {
    if (!companion) return;
    setRenameDraft(companion.name);
    setIsRenaming(true);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameDraft('');
  };

  const handleSaveRename = async () => {
    if (!companion) return;
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === companion.name) {
      setIsRenaming(false);
      return;
    }

    setIsSavingRename(true);
    try {
      const updated = await renameCompanion(companion.id, trimmed);
      setCompanion(updated);
      setIsRenaming(false);
      setLogs(await getRecentLogs(companion.id));
    } catch (error) {
      showFeedback(error.message || '改名失败，请重试。');
    } finally {
      setIsSavingRename(false);
    }
  };

  const ownedClothingNames = useMemo(() => (
    inventory
      .filter((row) => row.category === 'clothing')
      .map((row) => findShopItem(row.itemId))
      .filter(Boolean)
  ), [inventory]);

  const ownedSceneIds = useMemo(() => (
    inventory.filter((row) => row.category === 'scene').map((row) => row.itemId)
  ), [inventory]);

  const activeEvents = useMemo(() => (
    companion ? getActiveEvents(companion) : []
  ), [companion]);

  const handleClaimEvent = async (activeEventId) => {
    if (!companion) return;
    const updated = await claimCompanionEvent(companion.id, activeEventId);
    if (updated) setCompanion(updated);
    setEventPopup(null);
  };

  // 选项事件：选完一个选项后不直接关弹窗，而是让弹窗刷新成"已选择"状态，
  // 把结果文案展示出来，用户自己点"知道啦"再关。
  const handleResolveChoice = async (activeEventId, optionId) => {
    if (!companion || isClaiming) return;
    setIsClaiming(true);
    try {
      const result = await resolveCompanionChoiceEvent(companion.id, activeEventId, optionId);
      if (result?.companion) {
        setCompanion(result.companion);
        const resolvedEvent = getActiveEvents(result.companion).find((event) => event.id === activeEventId);
        if (resolvedEvent) setEventPopup(resolvedEvent);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // 点"知道啦"：先撒一把彩带，稍等一下再真正领取、关弹窗
  const handleClaimWithFx = (activeEventId) => {
    if (isClaiming) return;
    setIsClaiming(true);

    setConfetti(Array.from({ length: 26 }, (_, index) => {
      const angle = rand(0, Math.PI * 2);
      const distance = rand(90, 200);
      return {
        id: index,
        style: {
          background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          '--dx': `${Math.cos(angle) * distance}px`,
          '--dy': `${Math.sin(angle) * distance - 40}px`,
          '--r': `${rand(-540, 540)}deg`,
        },
      };
    }));

    claimTimerRef.current = window.setTimeout(async () => {
      try {
        await handleClaimEvent(activeEventId);
      } finally {
        setIsClaiming(false);
        setConfetti([]);
      }
    }, 800);
  };

  const handleUseLegendaryFood = async (foodId) => {
    if (!companion) return;
    const updated = await useLegendaryFood(companion.id, foodId);
    setCompanion(updated);
    setLogs(await getRecentLogs(companion.id));
  };

  const handleUseBackpackItem = async (itemId) => {
    if (!companion) return null;
    const before = companion;
    const result = await useBackpackItem(companion.id, itemId);
    spawnDeltaFloaters(before, result.companion);
    setCompanion(result.companion);
    setLogs(await getRecentLogs(companion.id));
    setBackpackItems(await getBackpack(companion.id));
    return result;
  };
  const handleBuyScene = async (itemId) => {
    if (!companion) return;
    const updated = await buyShopItem(companion.id, itemId);
    setCompanion(updated);
    setInventory(await getInventory(companion.id));
  };

  const activeScene = useMemo(() => (
    findScene(companion?.background) || getAllSceneOptions()[0]
  ), [companion?.background]);

  const isSleeping = useMemo(
    () => isCompanionSleeping(companion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companion, sleepTick],
  );

  const statusLine = useMemo(() => {
    if (!companion) return '';
    if (isSleeping) return SLEEPING_STATUS_LINE;
    if (companion.satiety < 30) return '好像有点饿了呀……';
    if (companion.mood < 30) return '看起来不太开心，需要陪陪它。';
    if ((companion.cleanliness ?? 100) < 30) return '身上有点脏了，该清洁一下啦。';
    return '状态很不错，暖暖的。';
  }, [companion, isSleeping]);

  // ---- 底部抽屉：点一下 / 拖一下展开收起 ----
  const getPeekOffset = () => {
    const sheet = sheetRef.current;
    const peek = peekRef.current;
    return sheet && peek ? sheet.offsetHeight - peek.offsetHeight : 0;
  };

  const applySheetPosition = (open) => {
    const sheet = sheetRef.current;
    const root = rootRef.current;
    if (!sheet || !root) return;

    sheet.style.transform = open ? 'translateY(0)' : `translateY(${getPeekOffset()}px)`;
    root.style.setProperty('--cp-p', open ? '1' : '0');
  };

  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;
  const hasCompanion = Boolean(companion);

  useLayoutEffect(() => {
    applySheetPosition(sheetOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, hasCompanion]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => applySheetPosition(sheetOpenRef.current));
    observer.observe(sheet);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompanion]);

  const handlePeekPointerDown = (event) => {
    if (event.target.closest('.cp-dock-btn')) return;
    dragRef.current = {
      startY: event.clientY,
      from: sheetOpen ? 0 : getPeekOffset(),
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePeekPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaY) > 4) drag.moved = true;
    if (!drag.moved) return;

    const max = getPeekOffset();
    const offset = Math.max(0, Math.min(max, drag.from + deltaY));
    rootRef.current.dataset.dragging = '1';
    sheetRef.current.style.transform = `translateY(${offset}px)`;
    rootRef.current.style.setProperty('--cp-p', String(max ? 1 - offset / max : 0));
  };

  const finishPeekDrag = (event, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    delete rootRef.current.dataset.dragging;

    if (cancelled) {
      applySheetPosition(sheetOpen);
      return;
    }

    let nextOpen = !sheetOpen;
    if (drag.moved) {
      const offset = drag.from + (event.clientY - drag.startY);
      nextOpen = offset < getPeekOffset() * 0.5;
    }

    applySheetPosition(nextOpen);
    setSheetOpen(nextOpen);
  };

  const floatingBackButton = (
    <button
      type="button"
      onClick={onBack}
      title="返回"
      aria-label="返回"
      className="cp-round-btn left"
    >
      <ArrowLeft className="cp-ic" />
    </button>
  );

  if (isLoading) {
    return (
      <div className={ROOT_CLASS} style={ROOT_STYLE} ref={rootRef}>
        {floatingBackButton}
      </div>
    );
  }

  // ================= 领养页 =================
  if (!companion) {
    const adoptPreviewUrl = uploadedAvatar
      || DEFAULT_AVATARS.find((item) => item.id === selectedPreset)?.url
      || '';

    return (
      <div className={ROOT_CLASS} style={ROOT_STYLE} ref={rootRef}>
        <div className="cp-adopt">
          <div className="cp-adopt-inner">
            <i className="cp-blob b1" />
            <i className="cp-blob b2" />

            <div className="cp-hello">
              这个聊天窗还没有养小伙伴。选一个形态、起个名字，从今天开始由你和
              {character?.name ? ` ${character.name} ` : '它'}一起照顾它吧。
            </div>

            <div className={`cp-arch ${isAdopting ? 'is-hatching' : ''}`}>
              <div className="cp-pet" aria-hidden="true">
                <span className="cp-pet-ring" />
                <span className="cp-pet-body">
                  {adoptPreviewUrl && <img src={adoptPreviewUrl} alt="" />}
                </span>
                <i className="cp-orn a" />
                <i className="cp-orn b" />
                <i className="cp-orn c" />
              </div>
            </div>

            <div className="cp-ribbon">{nameDraft.trim() || '?'}</div>

            <div className="cp-presets">
              {DEFAULT_AVATARS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.label}
                  title={preset.label}
                  className={`cp-preset ${selectedPreset === preset.id && !uploadedAvatar ? 'is-on' : ''}`}
                  onClick={() => {
                    setSelectedPreset(preset.id);
                    setUploadedAvatar(null);
                  }}
                >
                  {preset.url && <img src={preset.url} alt={preset.label} />}
                </button>
              ))}

              <button
                type="button"
                aria-label="上传自己的图片"
                title="上传自己的图片"
                className={`cp-preset up ${uploadedAvatar ? 'is-on has' : ''}`}
                onClick={() => adoptFileInputRef.current?.click()}
              >
                {uploadedAvatar ? <img src={uploadedAvatar} alt="自定义形态" /> : <Upload className="cp-ic" />}
              </button>
            </div>

            <input
              ref={adoptFileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePickAdoptFile}
            />

            <div className="cp-name-field">
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value.slice(0, 20))}
                placeholder="给小伙伴起个名字"
                maxLength={20}
                autoComplete="off"
              />
              <small>{nameDraft.length}/20</small>
            </div>

            <p className="cp-err">{adoptError}</p>

            <button
              type="button"
              disabled={isAdopting}
              onClick={handleAdopt}
              className="cp-go"
            >
              {isAdopting ? '正在领养…' : '开始养它'}
            </button>

            <p className="cp-adopt-note">
              形态图、名字之后都可以在这里随时重新上传/修改，场景领养之后也能换。
            </p>
          </div>
        </div>

        {floatingBackButton}
      </div>
    );
  }

  // ================= 主页 =================
  const bubbleText = feedback || statusLine;
  const lowStat = companion.satiety < 30 || companion.mood < 30 || (companion.cleanliness ?? 100) < 30;

  return (
    <div className={ROOT_CLASS} style={ROOT_STYLE} ref={rootRef}>
      {/* 场景：有图用图，没图（url 为空）就用兜底的天空 */}
      <div className="cp-scene">
        {activeScene?.url ? (
          <>
            <div
              className="cp-scene-bg cp-scene-img"
              style={{ backgroundImage: `url(${activeScene.url})` }}
            />
            <div className="cp-scene-dim" />
          </>
        ) : (
          <div className="cp-sky">
            <div className="orb" />
            <i className="cloud c1" />
            <i className="cloud c2" />
            <i className="cloud c3" />
            <div className="ground" />
          </div>
        )}
      </div>

            {floatingBackButton}

      <button
        type="button"
        onClick={() => setShowMoodCalendar(true)}
        title="心情日历"
        aria-label="心情日历"
        className="cp-round-btn right2"
      >
        <CompanionMoodEntryIcon />
      </button>

      <button
        type="button"
        onClick={() => setShowScenePicker(true)}
        title="换场景"
        aria-label="换场景"
        className="cp-round-btn right"
      >
        <Palette className="cp-ic" />
      </button>

          <button
        type="button"
        onClick={() => setShowProfile(true)}
        title="小伙伴的档案"
        aria-label="小伙伴的档案"
        className="cp-round-btn right3"
      >
        <CompanionProfileIcon />
      </button>

      {/* 特殊事件吊牌：最多同时显示 2 个，点一下看详情/领取 */}
      {activeEvents.length > 0 && (
        <div className="cp-tags">
          {activeEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setEventPopup(event)}
              className={`cp-tag ${event.claimed ? 'is-done' : ''}`}
            >
              <b>{event.title}</b>
              <small>{event.bannerText}</small>
              {!event.claimed && (
                <span className="cp-claim">{event.kind === 'choice' ? '选择' : '领取'}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 舞台：宠物居中，点一下会"戳一戳"；饱食度/心情收进左上角的小图标 */}
      <div className="cp-stage">
        <div className={`cp-zone ${zoneFx ? `is-${zoneFx}` : ''}`}>
          <div className="cp-bubble">
            <span key={bubbleText}>{bubbleText}</span>
          </div>

          <div className="cp-pet-wrap">
            <button
              type="button"
              onClick={handlePoke}
              className={`cp-pet ${hasPoked ? '' : 'hint'} ${isPoking ? 'is-jelly' : ''} ${isSleeping ? 'is-sleeping' : ''}`}
              title="戳一戳"
              aria-label="戳一戳"
            >
              <span className="cp-pet-ring" />
              <span className="cp-pet-body">
                <img src={companion.avatarUrl} alt={companion.name} />
              </span>
              <i className="cp-orn a" />
              <i className="cp-orn b" />
              <i className="cp-orn c" />
              {companion.equippedOutfit && (
                <span className="cp-outfit-tag">{companion.equippedOutfit}</span>
              )}
            </button>

            {isSleeping && (
              <span className="cp-zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>
            )}

            <button
              type="button"
              data-cp-stats
              onClick={() => setStatsOpen(!showStats)}
              aria-label="查看饱食度和心情"
              aria-expanded={showStats}
              className={`cp-mini-fab stat ${showStats ? 'is-on' : ''} ${lowStat ? 'warn' : ''}`}
            >
              <Activity className="cp-ic" />
            </button>

            <div
              data-cp-stats
              role="group"
              aria-label="状态"
              aria-hidden={!showStats}
              className={`cp-stat-pop ${showStats ? 'is-open' : ''}`}
            >
                          <StatBar icon={UtensilsCrossed} label="饱食度" value={companion.satiety} floaters={floaters} anchor="satiety" tone="satiety" />
              <StatBar icon={Sparkles} label="心情" value={companion.mood} floaters={floaters} anchor="mood" tone="mood" />
              <StatBar icon={Droplets} label="清洁度" value={companion.cleanliness ?? 100} floaters={floaters} anchor="cleanliness" tone="cleanliness" />
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleChangeAvatar}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="更换形态图"
              title="更换形态图"
              className="cp-mini-fab avatar"
            >
              <Upload className="cp-ic" />
            </button>

            <div className="cp-fx">
              {particles.map((particle) => (
                <i key={particle.id} className={`cp-p ${particle.type}`} style={particle.style}>
                  {particle.type === 'heart-p' && <Heart className="cp-ic" fill="currentColor" stroke="none" />}
                </i>
              ))}
            </div>
          </div>
          <div className="cp-pet-shadow" />

          <div className="cp-nameplate">
            {isRenaming ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={renameDraft}
                  maxLength={20}
                  onChange={(event) => setRenameDraft(event.target.value.slice(0, 20))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSaveRename();
                    if (event.key === 'Escape') handleCancelRename();
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveRename}
                  disabled={isSavingRename}
                  aria-label="保存名字"
                  className="cp-mini-btn ok"
                >
                  <Check className="cp-ic" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelRename}
                  aria-label="取消改名"
                  className="cp-mini-btn"
                >
                  <X className="cp-ic" />
                </button>
              </>
            ) : (
              <>
                <span className="cp-nm">{companion.name}</span>
                <button
                  type="button"
                  onClick={handleStartRename}
                  aria-label="改名字"
                  title="改名字"
                  className="cp-mini-btn"
                >
                  <Pencil className="cp-ic" />
                </button>
                <span className="cp-heart-pill">
                  <CompanionHeartIcon className="cp-heart-ic" />
                  {companion.hearts}
                  <FloatingNumbers floaters={floaters} anchor="hearts" color="var(--cp-heart)" />
                </span>
                <button
                  type="button"
                  onClick={() => setShowHeartsInfo(true)}
                  aria-label="心心是怎么来的"
                  title="心心是怎么来的"
                  className="cp-mini-btn cp-hearts-info-trigger"
                >
                  <HelpCircle className="cp-ic" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 底部抽屉：收起时露出互动按钮，拖上来看动态/穿着 */}
      <div className={`cp-sheet ${sheetOpen ? 'is-open' : ''}`} ref={sheetRef}>
        <div
          className="cp-sheet-peek"
          ref={peekRef}
          onPointerDown={handlePeekPointerDown}
          onPointerMove={handlePeekPointerMove}
          onPointerUp={(event) => finishPeekDrag(event)}
          onPointerCancel={(event) => finishPeekDrag(event, true)}
        >
          <div className="cp-grabber"><i /></div>
          <div className="cp-dock-main">
            {ACTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={isActing}
                onClick={() => handleFreeAction(id)}
                className={`cp-dock-btn ${id === 'feed' ? 'feed' : id === 'clean' ? 'clean' : 'play'}`}
              >
                <span className="cp-dock-ico"><Icon className="cp-ic" /></span>
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowShop(true)}
              className="cp-dock-btn shop"
            >
              <span className="cp-dock-ico">
                <Store className="cp-ic" />
                <b className="cp-badge">{companion.hearts}</b>
              </span>
              商店
            </button>
          </div>

          <div className="cp-dock-extra">
            <button
              type="button"
              onClick={() => setShowTasks(true)}
              className="cp-dock-btn"
              aria-label="每日任务"
            >
              <span className={`cp-dock-ico ${pendingTaskCount > 0 ? 'has-pending-tasks' : ''}`}>
                <CompanionTasksIcon />
                {pendingTaskCount > 0 && <b className="cp-badge">{pendingTaskCount}</b>}
              </span>
              任务
            </button>
            <button
              type="button"
              onClick={() => setShowCustody(true)}
              className="cp-dock-btn"
              aria-label="托管给角色"
            >
              <span className={`cp-dock-ico ${companion.custodyEnabled ? 'custody-on' : ''}`}>
                <CompanionCustodyIcon />
                {companion.custodyEnabled && <b className="cp-custody-dot" />}
              </span>
              托管
            </button>
              <button
    type="button"
    onClick={() => setShowChat(true)}
    className="cp-dock-btn"
    aria-label="聊天"
  >
    <span className="cp-dock-ico">
      <CompanionChatIcon />
    </span>
    聊天
  </button>
            <button
              type="button"
              onClick={() => setShowFriends(true)}
              className="cp-dock-btn"
              aria-label="好友"
            >
              <span className="cp-dock-ico">
                <CompanionFriendIcon />
                {getFriendDockBadgeCount(companion) > 0 && (
                  <b className="cp-badge">{getFriendDockBadgeCount(companion)}</b>
                )}
              </span>
              好友
            </button>
            <button
              type="button"
              onClick={() => setShowBackpack(true)}
              className="cp-dock-btn"
              aria-label="背包"
            >
              <span className="cp-dock-ico">
                <CompanionBackpackIcon />
                {backpackItems.length > 0 && <b className="cp-badge">{backpackItems.length}</b>}
              </span>
              背包
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const st = await getStreakForChat(chatId);
                  setChatStreakCount(st?.count ?? 0);
                } catch (_) { /* 静默失败 */ }
                setShowFortune(true);
              }}
              className="cp-dock-btn"
              aria-label="宠物日签"
            >
              <span className="cp-dock-ico">
                <CompanionFortuneIcon />
              </span>
              日签
            </button>
                        <button
              type="button"
              onClick={() => setShowPlayPicker(true)}
              className="cp-dock-btn"
              aria-label="小游戏"
            >
              <span className="cp-dock-ico">
                <CompanionGameIcon />
              </span>
              小游戏
            </button>
            <button
              type="button"
              onClick={() => setShowDiary(true)}
              className="cp-dock-btn"
              aria-label="日记"
            >
              <span className="cp-dock-ico">
                <CompanionDiaryIcon />
              </span>
              日记
            </button>
            <button
              type="button"
              onClick={() => setShowDailyQa(true)}
              className="cp-dock-btn"
              aria-label="每日问答"
            >
              <span className="cp-dock-ico">
                <CompanionDailyQaIcon />
              </span>
                           问答
            </button>
            <button
              type="button"
              onClick={() => setShowClaw(true)}
              className="cp-dock-btn"
              aria-label="娃娃机"
            >
              <span className="cp-dock-ico">
                <CompanionClawIcon />
              </span>
              娃娃机
            </button>
            <button
              type="button"
              onClick={() => setShowSchool(true)}
              className="cp-dock-btn"
              aria-label="上学"
            >
              <span className="cp-dock-ico">
                <CompanionSchoolIcon />
                {schoolDotOn && <b className="sh-dot" />}
              </span>
              上学
            </button>
            <button
              type="button"
              onClick={() => openSweetStreet(chatId)}
              className="cp-dock-btn"
              aria-label="甜品小街"
            >
              <span className="cp-dock-ico">
                <SweetStreetDockIcon />
              </span>
              小街
            </button>
          </div>
        </div>

        <div className="cp-sheet-body">
          <div className="cp-tabs">
            <i className="ind" style={{ transform: sheetTab === 'logs' ? 'translateX(0)' : 'translateX(100%)' }} />
            <button
              type="button"
              className={sheetTab === 'logs' ? 'is-on' : ''}
              onClick={() => setSheetTab('logs')}
            >
              最近的动态
            </button>
            <button
              type="button"
              className={sheetTab === 'outfit' ? 'is-on' : ''}
              onClick={() => setSheetTab('outfit')}
            >
              穿着
            </button>
          </div>

          <div className="cp-panel-scroll">
            {sheetTab === 'logs' ? (
              <ul className="cp-tl">
                {logs.length === 0 && <li className="cp-empty">还没有记录，喂喂它、陪它玩一会儿吧～</li>}
                {logs.map((log, index) => {
                  const kind = getLogKind(log);
                  const { label, icon: KindIcon } = LOG_KINDS[kind];
                  const time = formatLogTime(log);

                  return (
                    <li
                      key={log.id}
                      className={`cp-tl-item ${kind}`}
                      style={{ '--i': Math.min(index, 8) }}
                    >
                      <span className="cp-sticker"><KindIcon className="cp-ic" /></span>
                      <div className="cp-tl-bubble">
                        <div className="cp-tl-meta">
                          <b>
                            {kind === 'visit'
                              ? `${character?.name || 'TA'} 自己来看过`
                              : kind === 'custody'
                                ? `${character?.name || 'TA'} 帮忙照顾好了`
                                : kind === 'friend_meal'
                                  ? '朋友来蹭饭了'
                                  : label}
                          </b>
                          {time && <time>{time}</time>}
                        </div>
                        <p>{log.content}</p>
                        {kind === 'custody' && <span className="cp-tl-tag custody">贴心照顾 · 托管</span>}
                                                {kind === 'friend_meal' && <span className="cp-tl-tag friend_meal">蹭饭 · 自动触发</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="cp-hangers">
                {ownedClothingNames.length === 0 && (
                  <p className="cp-empty">还没有衣服，去商店逛逛吧。</p>
                )}
                {ownedClothingNames.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleOutfit(item.name)}
                    className={`cp-hanger ${companion.equippedOutfit === item.name ? 'is-on' : ''}`}
                  >
                    <span className="cp-thumb">
                      {item.url ? <img src={item.url} alt="" /> : <Shirt className="cp-ic" />}
                    </span>
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showShop && (
        <CompanionShopModal
          hearts={companion.hearts}
          ownedClothingIds={ownedClothingNames.map((item) => item.id)}
          unlockedRareFoodIds={companion.unlockedRareFoodIds || []}
          unlockedRareCleanIds={companion.unlockedRareCleanIds || []}
          unlockedRareToyIds={companion.unlockedRareToyIds || []}
          legendaryStock={companion.legendaryStock || {}}
          onBuy={handleBuy}
          onUseLegendary={handleUseLegendaryFood}
          onBuyTool={handleBuyTool}
          onClose={() => setShowShop(false)}
          shopkeeperUrl={companion.avatarUrl}
          shopkeeperName={companion.name}
        />
      )}

      {showBackpack && (
        <CompanionBackpackModal
          items={backpackItems}
          onUse={handleUseBackpackItem}
          onClose={() => setShowBackpack(false)}
        />
      )}

      {showScenePicker && (
        <CompanionSceneModal
          currentSceneId={activeScene.id}
          ownedSceneIds={ownedSceneIds}
          hearts={companion.hearts}
          onSelect={handleSelectScene}
          onBuy={handleBuyScene}
          onClose={() => setShowScenePicker(false)}
        />
      )}

           {showHeartsInfo && (
        <CompanionHeartsInfoModal onClose={() => setShowHeartsInfo(false)} />
      )}

      {showProfile && companion && (
        <CompanionProfileModal
          companion={companion}
          onSaved={(updated) => setCompanion(updated)}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showTasks && (
        <CompanionTasksModal view={taskView} onClose={() => setShowTasks(false)} />
      )}

      {showCustody && (
        <CompanionCustodyNote
          enabled={Boolean(companion.custodyEnabled)}
          busy={custodyBusy}
          characterName={character?.name}
          onToggle={handleToggleCustody}
          onClose={() => setShowCustody(false)}
        />
      )}

      {custodyLetter && (
        <CompanionCustodyLetter
          letter={custodyLetter}
          characterName={character?.name}
          onClose={() => setCustodyLetter(null)}
        />
      )}

                       {!custodyLetter && mealLetter && (
        <CompanionFriendMealLetter
          letter={mealLetter}
          companionName={companion.name}
          companionAvatarUrl={companion.avatarUrl}
          onClose={() => setMealLetter(null)}
        />
      )}

      {!custodyLetter && !mealLetter && schoolLetter && (
        <CompanionCustodySchoolLetter
          letter={schoolLetter}
          companion={companion}
          onComfort={handleComfortSchool}
          onClose={() => setSchoolLetter(null)}
        />
      )}

        {showChat && (
    <CompanionChatModal
      companion={companion}
      character={character}
      chatId={chatId}
      onClose={() => setShowChat(false)}
    />
  )}

            {showFriends && (
        <CompanionFriendPage
          companion={companion}
          character={character}
          backpackItems={backpackItems}
          onRefresh={refreshCompanionForFriends}
          onClose={() => setShowFriends(false)}
        />
      )}

      {showFortune && (
        <CompanionFortuneModal
          companionId={companion.id}
          companionAvatarUrl={companion.avatarUrl}
          companionName={companion.name}
          streakCount={chatStreakCount}
          onClose={() => setShowFortune(false)}
        />
      )}

      {showPlayPicker && (
        <CompanionPlayPickerModal
          onPickCatch={() => { setShowPlayPicker(false); setShowCatchGame(true); }}
          onPickMarbles={() => { setShowPlayPicker(false); setShowMarblesGame(true); }}
          onPickWish={() => { setShowPlayPicker(false); setShowWishPool(true); }}
          onClose={() => setShowPlayPicker(false)}
        />
      )}

      {showCatchGame && (
        <CompanionCatchGameModal
          companionId={companion.id}
          companionAvatarUrl={companion.avatarUrl}
          companionName={companion.name}
          onRewardApplied={async (updatedCompanion) => {
            setCompanion(updatedCompanion);
            setLogs(await getRecentLogs(updatedCompanion.id));
          }}
          onClose={() => setShowCatchGame(false)}
        />
      )}

      {showMarblesGame && (
        <CompanionMarblesModal
          companionId={companion.id}
          companionAvatarUrl={companion.avatarUrl}
          companionName={companion.name}
          onRewardApplied={async (updatedCompanion) => {
            setCompanion(updatedCompanion);
            setLogs(await getRecentLogs(updatedCompanion.id));
          }}
          onClose={() => setShowMarblesGame(false)}
        />
      )}

      {showWishPool && (
        <CompanionWishPoolModal
          companionId={companion.id}
          onRewardApplied={async (updatedCompanion) => {
            setCompanion(updatedCompanion);
            setLogs(await getRecentLogs(updatedCompanion.id));
          }}
          onClose={() => setShowWishPool(false)}
        />
      )}

      {showDiary && (
          <CompanionDiaryBook
     companionId={companion.id}
     companionName={companion.name}
        companionAvatarUrl={companion.avatarUrl}
     onClose={() => setShowDiary(false)}
   />
      )}

      {showMoodCalendar && (
        <CompanionMoodCalendar
          companionId={companion.id}
          onClose={() => setShowMoodCalendar(false)}
        />
      )}

           {showClaw && (
        <CompanionClawMachine
          companion={companion}
          onCompanionChange={async (updated) => {
            setCompanion(updated);
            setLogs(await getRecentLogs(updated.id));
          }}
          onClose={() => setShowClaw(false)}
        />
      )}

      {showSchool && (
        <CompanionSchoolModal
          companion={companion}
          chatId={chatId}
          character={character}
          onClose={() => {
            setShowSchool(false);
            refreshSchoolDot();
          }}
        />
      )}

      {showDailyQa && (
        <CompanionDailyQaModal
          chatId={chatId}
          character={character}
          companion={companion}
          onClose={() => setShowDailyQa(false)}
        />
      )}

      {eventPopup && (
        <div className="cp-overlay center">
          <div className="cp-backdrop" onClick={() => setEventPopup(null)} />
          <div className="cp-panel cp-event-card">
            <div className="cp-gift" aria-hidden="true">
              <i className="box" />
              <i className="lid" />
              <i className="rib" />
              <i className="bow" />
            </div>

            <h4>{eventPopup.title}</h4>
            <p>{eventPopup.kind === 'choice' && eventPopup.claimed ? eventPopup.resolvedText : eventPopup.bannerText}</p>
            {eventPopup.grantsFoodId && (
              <p className="got">
                获得了「{findShopItem(eventPopup.grantsFoodId)?.name || '新食物'}」
              </p>
            )}

            {eventPopup.kind === 'choice' ? (
              eventPopup.claimed ? (
                <div className="cp-btn-row">
                  <button
                    type="button"
                    onClick={() => setEventPopup(null)}
                    className="cp-btn main"
                  >
                    知道啦
                  </button>
                </div>
              ) : (
                <div className="cp-btn-row cp-choice-row">
                  {(eventPopup.options || []).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isClaiming}
                      onClick={() => handleResolveChoice(eventPopup.id, option.id)}
                      className="cp-btn main"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="cp-btn-row">
                <button
                  type="button"
                  onClick={() => setEventPopup(null)}
                  className="cp-btn"
                >
                  先这样
                </button>
                <button
                  type="button"
                  disabled={isClaiming}
                  onClick={() => handleClaimWithFx(eventPopup.id)}
                  className="cp-btn main"
                >
                  知道啦
                </button>
              </div>
            )}

            {confetti.map((piece) => (
              <i key={piece.id} className="cp-confetti" style={piece.style} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanionPage;