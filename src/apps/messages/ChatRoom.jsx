import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from 'react';

import {
  ArrowLeft,
  Sparkles,
  Image,
  Volume2,
  DollarSign,
  Settings,
  RotateCw,
  BookOpen,
  ReceiptText,
  Moon,
  Compass,
  Plus,
  PawPrint,
  Ticket,
  Phone,
  BookHeart,
  Forward,
  Trash2,
} from 'lucide-react';

import {
  SendIcon,
  SparklesIcon,
} from 'lucide-animated';


import Dexie from 'dexie';
import db from '../../db';
import {
  triggerAiResponse,
  rerollAiResponse,
  subscribeAiEvents,
  playMessageSound,
} from '../../services/aiService';


import { maybeGenerateAiReaction } from '../../services/messageReactionService';

import { triggerGlobalToast } from '../../components/NotificationToast';
import { getAwayState, formatAwayUntil } from './away/awayState';
import { handleUserActivityWhileAway } from './away/awayService';

import {
  startOutgoingCall,
  isRealVoiceAvailableForCharacter,
} from '../../services/callService';

import {
  recordAlmanacEvent,
  ALMANAC_EVENT_TYPES,
} from '../almanac/services/almanacService';


import ChatHeaderBar from './components/ChatHeaderBar';
import ChatCalendarModal from './components/ChatCalendarModal';
import MoreMenuPopover from './components/MoreMenuPopover';
import BubbleCustomizer from './components/BubbleCustomizer';
import ChatSettingsModal from './components/ChatSettingsModal';
import ScheduledMessageArchive from './components/ScheduledMessageArchive';
import McpToolApprovalModal from './mcp/McpToolApprovalModal';
import MessageList from './components/MessageList';
import ParallelOrbit from './components/ParallelOrbit';

import { createInteractionMessage } from './interactions/interactionService';
import {
  createPokeMessage,
  ensurePokeReplies,
  pickPokeReply,
} from './interactions/pokeService';
import { INTERACTION_TYPES } from './interactions/interactionRules';

import CheckInNotice from './check-in/CheckInNotice';
import { checkForCrossChatCheckIn } from './check-in/checkInService';
import ChatEntryCardOverlay from './components/ChatEntryCardOverlay';

import PhotoCaptureButton from './components/cards/PhotoCaptureButton';
import OfflineInviteArchive from '../offline/OfflineInviteArchive';

import './check-in/check-in.css';
import './interactions/chat-interactions.css';

import {
  registerMcpToolApprovalHandler,
} from '../../services/mcp/mcpApprovalCoordinator';

import {
  subscribeMcpChatTraceEvents,
} from '../../services/mcp/mcpChatTraceService';

import InteractiveMenuPopover from './components/InteractiveMenuPopover';
import StickerPickerModal from './components/StickerPickerModal';
import HeartbeatPulse from './components/HeartbeatPulse';
import ForwardChatPicker from './components/ForwardChatPicker';
import ConfirmModal from '../../components/ConfirmModal';

import {
  cancelPendingScheduledMessagesForChat,
} from './scheduledMessageService';

import { useChatCustomFont } from './hooks/useChatCustomFont';
import useChatEntryCard from './hooks/useChatEntryCard';
import { isValidHexColor, getReadableTextColor } from './utils/chatColors';
import { getControlStyleRules } from './chatControlStylePresets';

import InnerWorldApp from '../innerworld/InnerWorldApp';

import OfflineChatRoom from '../offline/OfflineChatRoom';
import OfflineInviteComposer from '../offline/OfflineInviteComposer';

import { MapPinned } from 'lucide-react';
import PlaceBooklet from '../location/PlaceBooklet';
import PendingPlaceBanner from './components/cards/PendingPlaceBanner';

import CompanionHeartIcon from '../companion/CompanionHeartIcon';
import { recordChatResponseForCompanion } from '../companion/companionService';

import { recordUserGiftMemoir } from '../memoir/memoirService';

import { getPrecisePosition } from '../../apps/location/locationService';
import {
  getLocationSettings,
  checkLocationAndDetectTransition,
  shouldCheckLocation,
  getRandomCheckIntervalMs,
  POOR_ACCURACY_RETRY_MS,
  namePlace,
} from '../../apps/location/placeService';




const INITIAL_VISIBLE_MESSAGE_COUNT = 200;
const LOAD_MORE_MESSAGE_BATCH = 200;
const LOAD_MORE_SCROLL_THRESHOLD_PX = 150;
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 80;

/*
 * 只从 messages 表的 [chatId+timestamp] 复合索引里，取某个聊天框
 * 最近的一批消息（按时间正序返回），而不是把整个聊天历史都读出来、
 * 在内存里排序、再截尾——避免聊天记录越堆越多之后每次打开/刷新
 * 聊天框都变卡。
 *
 * 线下模式（mode === 'offline'）发生的对话属于线下场景自己的记录
 * （OfflineChatRoom / 线下邀约收纳室），不应该混进主聊天窗——之前
 * 这里没过滤 mode，导致线下内容全跑到主窗口里来了。用 .filter()
 * 而不是换索引，是因为分页排序仍然要靠 [chatId+timestamp]，只是
 * 把线下那部分从结果里摘掉；filter 必须放在 limit 之前，否则会先
 * 摘走一批、再截到 limit 条，凑不够数。
 */
const getRecentMessagesWindow = (chatId, limit) => (
  db.messages
    .where('[chatId+timestamp]')
    .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
    .reverse()
    .filter((message) => message.mode !== 'offline')
    .limit(limit)
    .toArray()
    .then((rows) => rows.reverse())
);

/*
 * 加载“比当前已加载的最早一条消息还要更早”的一批消息，用于
 * 下拉到顶部时的增量分页；同样走 [chatId+timestamp] 索引，
 * 不会把整个聊天历史都读一遍。同样要摘掉线下模式的消息，理由同上。
 */
const getOlderMessagesBefore = (chatId, beforeTimestamp, limit) => (
  db.messages
    .where('[chatId+timestamp]')
    .between(
      [chatId, Dexie.minKey],
      [chatId, beforeTimestamp],
      true,
      false,
    )
    .reverse()
    .filter((message) => message.mode !== 'offline')
    .limit(limit)
    .toArray()
    .then((rows) => rows.reverse())
);
// 点单窗口只有用户点开时才加载，不占用聊天页的首屏体积
const OrderRequestModal = lazy(() => import('./components/OrderRequestModal'));

// #6 聊天窗宠物"小伙伴"，只有用户点开 🐾 更多入口里的入口才加载
const CompanionPage = lazy(() => import('../companion/CompanionPage'));

// 回忆录，同样只有用户点开 🐾 更多入口里的入口才加载
const MemoirPage = lazy(() => import('../memoir/MemoirPage'));

export const ChatRoom = ({
  chatId,
  onBack,
  onOpenChat,
  onOpenCharacterEditor,
  onRoomStateChange,
}) => {
  const [chat, setChat] = useState(null);
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedType, setSelectedType] = useState('text');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [quotedMsg, setQuotedMsg] = useState(null);
  const [showBubbleCustomizer, setShowBubbleCustomizer] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showScheduledArchive, setShowScheduledArchive] = useState(false);
  const [showCallModeMenu, setShowCallModeMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [extraInputMeta, setExtraInputMeta] = useState({});
  const [showStickerModal, setShowStickerModal] = useState(false);
    const [showOrderModal, setShowOrderModal] = useState(false);
  const [checkInDelivery, setCheckInDelivery] = useState(null);
  const [pendingMcpApproval, setPendingMcpApproval] = useState(null);
    const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(true);
  const loadedMessageCountRef = useRef(INITIAL_VISIBLE_MESSAGE_COUNT);

  /*
   * 当前尚未持久化到 messages.metadata 的实时 MCP 调用轨迹。
   * 最终回复写入数据库后，会由每条消息自身的 metadata.mcpTrace 接管展示。
   */
  const [mcpTrace, setMcpTrace] = useState(null);

  const mcpApprovalResolverRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);

const sendIconRef = useRef(null);
const sparklesIconRef = useRef(null);
const sendIconResetTimerRef = useRef(null);
const sparklesIconResetTimerRef = useRef(null);

useEffect(() => {
  return () => {
    if (sendIconResetTimerRef.current) {
      window.clearTimeout(sendIconResetTimerRef.current);
    }

    if (sparklesIconResetTimerRef.current) {
      window.clearTimeout(sparklesIconResetTimerRef.current);
    }
  };
}, []);





  const previousScrollHeightRef = useRef(null);
  const hasScrolledToLatestRef = useRef(false);
const locationCheckIntervalRef = useRef(getRandomCheckIntervalMs());


  // 1. 新增一个 ref，紧挨着其他 ref 声明
const forceScrollMessageIdRef = useRef(null);
// 记录"用户当前是否贴在底部"，只由滚动事件更新，不在消息刚渲染完时临时测量
const isPinnedToBottomRef = useRef(true);
const isLoadingMoreRef = useRef(false);

// 打开表情包面板前，记录当时聊天是否已经贴在底部，
// 用来在面板弹出后（尤其是手机上收起键盘的过程中）把滚动位置纠正回去
const stickerPanelWasNearBottomRef = useRef(false);

 const [showParallelOrbit, setShowParallelOrbit] = useState(false);
const [showInnerWorld, setShowInnerWorld] = useState(false);
const [showPlaceBooklet, setShowPlaceBooklet] = useState(false);
const [pendingNamePlace, setPendingNamePlace] = useState(null);
const [showTopMenu, setShowTopMenu] = useState(false);
const [showCompanionPage, setShowCompanionPage] = useState(false);
  const [showMemoirPage, setShowMemoirPage] = useState(false);

// 顶部按钮行默认收起，只保留返回按钮；展开/收起统一由 ChatHeaderBar
// 里那一颗爱心控制（同时带出这一整排按钮和下面的身份卡片）
const [showFullHeaderBar, setShowFullHeaderBar] = useState(false);

const [activeOfflineSessionId, setActiveOfflineSessionId] = useState(null);
const [showOfflineComposer, setShowOfflineComposer] = useState(false);
const [showOfflineInviteArchive, setShowOfflineInviteArchive] = useState(false);

const [showInputMenu, setShowInputMenu] = useState(false);

// 发送成功后要不要闪一下心电图动效；数值本身没意义，
// 每次自增触发 HeartbeatPulse 重新播放一次。
const [heartbeatPulseKey, setHeartbeatPulseKey] = useState(0);

// 消息多选：长按气泡的反应面板里点"选择"进入，勾选若干条消息后
// 可以批量转发到别的聊天窗，或者批量删除。
const [selectionMode, setSelectionMode] = useState(false);
const [selectedMessageIds, setSelectedMessageIds] = useState(() => new Set());
const [showForwardPicker, setShowForwardPicker] = useState(false);
const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);


  const defaultCss = useMemo(() => `
    .user-bubble {
      background: var(--accent-color);
      color: var(--accent-foreground);
      border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
    }

    .ai-bubble {
      background: var(--control-soft-bg);
      color: var(--text-main);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
    }

    .chat-font {
      font-size: 0.75rem;
      line-height: 1.5;
    }
  `, []);

  const customCssStr = chat?.customCss || '';

  const memoizedStyle = useMemo(() => {
    const cssToApply = customCssStr || defaultCss;
    return <style>{`.chat-room-container ${cssToApply}`}</style>;
  }, [customCssStr, defaultCss]);

    // 本聊天窗自定义字体（用户填写的字体文件 / 字体 CSS 网址）
  const { fontFamilyValue, status: customFontStatus } = useChatCustomFont(
    chat?.fontUrl,
    chat?.fontFamily,
  );

  // 早安/晚安问候卡、节日彩蛋卡：每个聊天窗第一次进来时各自判断一次，
  // 播完自动消失，不写进聊天记录。
  const { entryCard, dismissEntryCard } = useChatEntryCard(chat);

  // 本聊天窗自定义字号（px）。未设置时不输出任何规则，保持原有样式不变。
  const chatFontSizePx = Number.isFinite(chat?.chatFontSize)
    ? Math.min(24, Math.max(10, chat.chatFontSize))
    : null;

  const chatFontStyle = useMemo(() => {
    const rules = [];

    if (fontFamilyValue) {
      rules.push(`.chat-room-container { font-family: ${fontFamilyValue}; }`);

      // TextCard 根节点自带 font-sans，会盖过上面继承下来的字体，这里单独覆盖。
      // 代码块用的是 font-mono，不在这条规则的范围内，不受影响。
      rules.push(
        `.chat-room-container .markdown-content { font-family: ${fontFamilyValue}; }`,
      );
    }

    if (chatFontSizePx !== null) {
      const rem = `${chatFontSizePx / 16}rem`;

      rules.push(`.chat-room-container .chat-font { font-size: ${rem}; }`);
      rules.push(`.chat-room-container .chat-input-font { font-size: ${rem}; }`);

      // TextCard 根节点自带 text-xs，会盖过外层气泡的字号，这里单独覆盖。
      rules.push(`.chat-room-container .markdown-content { font-size: ${rem}; }`);

      // 标题原本是固定字号，改成相对当前字号的倍数。
      // 1.3333em / 1.1667em / 1em 正好对应原来的 text-base / text-sm / text-xs，
      // 所以默认字号 12px 时外观不变。
      rules.push(`.chat-room-container .markdown-content h1 { font-size: 1.3333em; }`);
      rules.push(`.chat-room-container .markdown-content h2 { font-size: 1.1667em; }`);
      rules.push(`.chat-room-container .markdown-content h3 { font-size: 1em; }`);
    }

    if (rules.length === 0) return null;

    return <style>{rules.join('\n')}</style>;
  }, [fontFamilyValue, chatFontSizePx]);

    // 本聊天窗自定义的输入框 / 按钮颜色。
  // 只接受严格的 #rrggbb；未设置或格式不对时不输出任何规则，保持原样。
  // 用 !important 是因为这些元素原本的颜色写在行内 style 里，普通样式压不过。
  const inputBarColor = isValidHexColor(chat?.inputBarColor) ? chat.inputBarColor : null;
  const sendBtnColor = isValidHexColor(chat?.sendBtnColor) ? chat.sendBtnColor : null;
  const respondBtnColor = isValidHexColor(chat?.respondBtnColor) ? chat.respondBtnColor : null;
  const topBtnColor = isValidHexColor(chat?.topBtnColor) ? chat.topBtnColor : null;

  // 本聊天窗的"按钮外观"预设（默认纯色块 / 毛玻璃 / 黑玻璃……），
  // 具体每个预设长什么样在 chatControlStylePresets.js 里注册，这里只
  // 负责挑出当前预设、拼出要覆盖的选择器，交给注册表生成规则。
  // 渲染顺序要放在 chatColorStyle 前面：这样如果用户还单独设置了
  // 顶部按钮/发送按钮的自定义颜色，后面 chatColorStyle 里那些规则
  // 会按 CSS 层叠顺序覆盖掉这里的背景色/文字色，预设里的模糊和边框
  // 效果则保留，两者可以叠加。
  const controlStyleId = chat?.controlStyle || 'default';

  const controlStylePresetStyle = useMemo(() => {
    const selectors = [
      '.chat-room-container .chat-input-bar',
      '.chat-room-container .chat-top-toolbar button.rounded-full',
      '.chat-room-container .chat-send-btn',
      '.chat-room-container .chat-input-sparkle-btn[data-open="false"]',
    ];

    const rules = getControlStyleRules(controlStyleId, selectors);

    if (rules.length === 0) return null;

    return <style>{rules.join('\n')}</style>;
  }, [controlStyleId]);

  const chatColorStyle = useMemo(() => {
    const rules = [];
    const scope = '.chat-room-container';

    if (inputBarColor) {
      const fg = getReadableTextColor(inputBarColor);

      rules.push(`${scope} .chat-input-bar { background: ${inputBarColor} !important; color: ${fg} !important; }`);
      rules.push(`${scope} .chat-input-bar textarea { color: ${fg} !important; }`);
            // 「心意互动」按钮的颜色写在行内样式里；只在它没展开时覆盖，展开时保留它原本的强调色
      rules.push(`${scope} .chat-input-bar .chat-input-sparkle-btn[data-open="false"] { color: ${fg} !important; }`);

      // 发送按钮没单独设色时，让它的图标跟着输入框底色变，避免深底深字
      if (!sendBtnColor) {
        rules.push(`${scope} .chat-input-bar .chat-send-btn { color: ${fg} !important; }`);
      }
    }

    if (sendBtnColor) {
      const fg = getReadableTextColor(sendBtnColor);
      rules.push(`${scope} .chat-send-btn { background: ${sendBtnColor} !important; color: ${fg} !important; }`);
    }

    if (respondBtnColor) {
      const fg = getReadableTextColor(respondBtnColor);
      rules.push(`${scope} .chat-respond-btn { background: ${respondBtnColor} !important; color: ${fg} !important; }`);
    }

    if (topBtnColor) {
      const fg = getReadableTextColor(topBtnColor);
      // 只作用于顶部这一排的圆形按钮，下拉菜单里的条目不是 rounded-full，不受影响
      rules.push(`${scope} .chat-top-toolbar button.rounded-full { background: ${topBtnColor} !important; color: ${fg} !important; }`);
    }

    if (rules.length === 0) return null;

    return <style>{rules.join('\n')}</style>;
  }, [inputBarColor, sendBtnColor, respondBtnColor, topBtnColor]);

  const loadChatData = useCallback(async () => {
    try {
      /*
       * 每次刷新都只按“当前已经加载到的条数”重新取最近一批消息，
       * 而不是整个聊天历史；这样用户如果已经下拉加载过更早的消息，
       * 刷新时不会把已经展开的那部分丢掉，但也不会去扫全表。
       */
      const limit = Math.max(
        loadedMessageCountRef.current,
        INITIAL_VISIBLE_MESSAGE_COUNT,
      );

      const [chatRecord, msgList] = await Promise.all([
        db.chats.get(chatId),
        getRecentMessagesWindow(chatId, limit),
      ]);

      if (!chatRecord) return;

      const charRecord = await db.characters.get(chatRecord.characterId);

      setChat(chatRecord);

      if (charRecord) {
        setCharacter(charRecord);
      }

      const safeMsgList = Array.isArray(msgList) ? msgList : [];

      setMessages(safeMsgList);
      loadedMessageCountRef.current = safeMsgList.length;
      setHasMoreOlderMessages(safeMsgList.length >= limit);
    } catch (error) {
      console.error(
        '[ChatRoom] loadChatData batch query failed safely:',
        error,
      );
    }
  }, [chatId]);

  const handleSendSticker = async (sticker) => {
    if (!sticker || !sticker.name || !chat?.id) return;

    const newMsg = {
      chatId: chat.id,
      characterId: chat.characterId,
      sender: 'user',
      type: 'sticker',
      content: sticker.name,
      metadata: {
        name: sticker.name,
        url: sticker.url,
      },
            isRead: true,
      timestamp: new Date().toISOString(),
    };

   const stickerMsgId = await db.messages.add(newMsg);
   newMsg.id = stickerMsgId;

void recordAlmanacEvent({
  chatId: chat.id,
  characterId: chat.characterId,
  eventType: ALMANAC_EVENT_TYPES.USER_MESSAGE,
  timestamp: newMsg.timestamp,
  metadata: {
    source: 'chat-room',
    messageType: 'sticker',
  },
});

await db.chats.update(chat.id, {
  updatedAt: Date.now(),
});

// 跟发文字消息保持一致：发出的表情包始终强制滚到底部，
// 不依赖"当前是否已经在底部附近"这个概率性判断。
forceScrollMessageIdRef.current = stickerMsgId;

    await loadChatData();
    triggerAiResponse(chat.id);
  };

    // 发送"点单请求"：写入一条消息，然后让角色回应（角色会通过 MCP 去办理）
  const handleSendOrderRequest = async ({ content, metadata }) => {
    if (!chat?.id) return;

    const newMsg = {
      chatId: chat.id,
      characterId: chat.characterId,
      sender: 'user',
      type: 'order_request',
      content,
      metadata,
      isRead: true,
      timestamp: new Date().toISOString(),
    };

    const orderMsgId = await db.messages.add(newMsg);
    newMsg.id = orderMsgId;

    void recordAlmanacEvent({
      chatId: chat.id,
      characterId: chat.characterId,
      eventType: ALMANAC_EVENT_TYPES.USER_MESSAGE,
      timestamp: newMsg.timestamp,
      metadata: {
        source: 'chat-room',
        messageType: 'order_request',
      },
    });

    await db.chats.update(chat.id, {
      updatedAt: Date.now(),
    });

    forceScrollMessageIdRef.current = orderMsgId;

    await loadChatData();
    triggerAiResponse(chat.id);
  };

  const handleCreateInteraction = async (interactionType) => {
    if (!chat?.id || !character?.id) return;

    try {
      await createInteractionMessage({
        chatId: chat.id,
        characterId: character.id,
        interactionType,
      });

      await loadChatData();
    } catch (error) {
      console.error('[ChatRoom] 创建聊天互动失败：', error);
    }
  };

  // 用户戳一戳角色：intensity 是 'light'（双击头像）还是 'full'
  // （表情区手势），决定这条消息渲染出来时播放的效果强弱，具体的
  // 震动/抖动逻辑都在 ChatPokeNotice 里，这里只管把记录写进去。
  const handlePokeCharacter = async (intensity) => {
    if (!chat?.id || !character?.id) return;

    try {
      const phrases = await ensurePokeReplies(character);
      const reactionText = pickPokeReply(phrases);

      await createPokeMessage({
        chatId: chat.id,
        characterId: character.id,
        direction: 'user_to_char',
        intensity,
        reactionText,
        actorLabel: activeUserName || '你',
        targetLabel: character.name || '对方',
      });

      await loadChatData();
    } catch (error) {
      console.error('[ChatRoom] 戳一戳失败：', error);
    }
  };

  const closePendingMcpApproval = useCallback((result) => {
    const resolver = mcpApprovalResolverRef.current;

    mcpApprovalResolverRef.current = null;
    setPendingMcpApproval(null);

    resolver?.(result);
  }, []);

  const handleMcpToolApprovalRequest = useCallback(
    (request) =>
      new Promise((resolve) => {
        /*
         * 同一聊天不应同时存在两份待决授权。
         * 若发生重叠，先安全拒绝旧请求。
         */
        if (mcpApprovalResolverRef.current) {
          mcpApprovalResolverRef.current({
            decision: 'deny',
            scope: 'once',
          });
        }

        mcpApprovalResolverRef.current = resolve;
        setPendingMcpApproval(request);
      }),
    [],
  );

  useEffect(() => {
    const unregister = registerMcpToolApprovalHandler(
      chatId,
      handleMcpToolApprovalRequest,
    );

    return () => {
      unregister();

      if (mcpApprovalResolverRef.current) {
        mcpApprovalResolverRef.current({
          decision: 'deny',
          scope: 'once',
        });

        mcpApprovalResolverRef.current = null;
      }
    };
  }, [chatId, handleMcpToolApprovalRequest]);

  /*
   * MCP Trace 实时事件订阅。
   * 仅用于角色生成过程中的临时提示；历史记录以
   * messages.metadata.mcpTrace 为准。
   */
  useEffect(() => {
    setMcpTrace(null);

    const unsubscribeMcpTrace = subscribeMcpChatTraceEvents((event) => {
      if (
        !event
        || event.type !== 'MCP_CHAT_TRACE_UPDATED'
        || String(event.chatId) !== String(chatId)
      ) {
        return;
      }

      setMcpTrace(event.trace || null);
    });

    return () => {
      unsubscribeMcpTrace?.();
    };
  }, [chatId]);

  useEffect(() => {
    onRoomStateChange?.(true);

    return () => {
      onRoomStateChange?.(false);
    };
  }, [onRoomStateChange]);

 useEffect(() => {
  setIsAiTyping(false);
  setCheckInDelivery(null);
  setMcpTrace(null);
  setHasMoreOlderMessages(true);
  loadedMessageCountRef.current = INITIAL_VISIBLE_MESSAGE_COUNT;
  previousScrollHeightRef.current = null;
  hasScrolledToLatestRef.current = false;
   isLoadingMoreRef.current = false;
   
   const openChatAndMarkMessagesAsRead = async () => {
  try {
    // 将当前聊天中角色发送的未读消息标记为已读
    await db.messages
      .where('chatId')
      .equals(chatId)
      .filter(
        (message) =>
          message.sender !== 'user' && message.isRead === false,
      )
      .modify({
        isRead: true,
      });

    // 计算其他聊天是否仍然有未读消息
    const unreadCount = await db.messages
      .filter((message) => message.isRead === false)
      .count();

    // 更新桌面 PWA 角标
    if (typeof navigator.setAppBadge === 'function') {
      if (unreadCount > 0) {
        await navigator.setAppBadge(unreadCount);
      } else if (typeof navigator.clearAppBadge === 'function') {
        await navigator.clearAppBadge();
      }
    }

    // 重新加载聊天内容
    await loadChatData();
  } catch (error) {
    console.warn('[ChatRoom] 标记消息已读失败：', error);

    // 即使标记已读失败，也继续加载聊天
    await loadChatData();
  }
};

void openChatAndMarkMessagesAsRead();


  void recordAlmanacEvent({
    chatId,
    eventType: ALMANAC_EVENT_TYPES.CHAT_OPEN,
    metadata: {
      source: 'chat-room',
    },
  });

  const unsubscribe = subscribeAiEvents((event) => {
      if (String(event.chatId) !== String(chatId)) return;

      if (event.type === 'AI_TYPING_START') {
        setIsAiTyping(true);
        return;
      }

      if (event.type === 'AI_TYPING_END') {
        setIsAiTyping(false);
        return;
      }

      if (event.type === 'NEW_MESSAGE') {
        setIsAiTyping(false);
        setMcpTrace(null);
        void loadChatData();
        return;
      }

      if (event.type === 'AWAY_AUTO_REPLY') {
        void loadChatData();
        return;
      }

      if (event.type === 'CHAT_SUMMARY_UPDATED') {
        void loadChatData();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsAiTyping(false);
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      unsubscribe();

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [chatId, loadChatData]);

  useEffect(() => {
  if (!chatId) return undefined;


  setPendingNamePlace(null);

  // 取点失败（没有权限、超时等）之后，10 分钟内不再重试，避免反复打开 GPS 费电
  let nextAttemptAllowedAt = 0;

  const runLocationCheck = async () => {
    if (Date.now() < nextAttemptAllowedAt) return;

    try {
      const settings = await getLocationSettings(chatId);

      if (
        !shouldCheckLocation(
          settings,
          locationCheckIntervalRef.current,
        )
      ) {
               return;
      }

      const coords = await getPrecisePosition();

      const {
        place,
        isNewUnnamedPlace,
        skipped,
      } = await checkLocationAndDetectTransition(
        chatId,
        coords,
      );

      // 这次定位误差太大、没有记录：过 10 分钟左右再试一次
      if (skipped) {
        locationCheckIntervalRef.current = POOR_ACCURACY_RETRY_MS;
        return;
      }

      // 每次检查后重新随机一个 10～20 分钟的下次间隔，避免产生规律感
      locationCheckIntervalRef.current = getRandomCheckIntervalMs();

      if (isNewUnnamedPlace) {
        setPendingNamePlace(place);
           }
    } catch (error) {
      // 权限拒绝或定位失败时静默跳过，不影响正常聊天
      nextAttemptAllowedAt = Date.now() + POOR_ACCURACY_RETRY_MS;
      console.warn('[Location] 本次检查跳过：', error);
    }
  };

  void runLocationCheck();

  // 每 5 分钟检查一次是否已经到了实际定位检查时间
  const timer = setInterval(
    runLocationCheck,
    5 * 60 * 1000,
  );

  return () => clearInterval(timer);
}, [chatId]);



  useEffect(() => {
    const handleLocalMessageNotification = (event) => {
      if (
        String(event.detail?.chatId) !== String(chatId)
      ) {
        return;
      }

      void loadChatData();
    };

    window.addEventListener(
      'new-local-message-inserted',
      handleLocalMessageNotification,
    );

    return () => {
      window.removeEventListener(
        'new-local-message-inserted',
        handleLocalMessageNotification,
      );
    };
  }, [chatId, loadChatData]);

 useLayoutEffect(() => {
  const scrollArea = scrollAreaRef.current;
  if (!scrollArea) return;

  const lastMessage = messages[messages.length - 1];
  const isForcedBySend = Boolean(
    lastMessage && lastMessage.id === forceScrollMessageIdRef.current,
  );

  if (isForcedBySend) {
    forceScrollMessageIdRef.current = null;
  }

  const shouldFollow = isForcedBySend
    || !hasScrolledToLatestRef.current
    || isPinnedToBottomRef.current;

  if (!shouldFollow) return;

  // 用瞬时滚动：平滑滚动进行到一半时内容又变高（输入中提示、图片等），
  // 会导致停在离底部还有一截的位置
  scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'auto' });

  isPinnedToBottomRef.current = true;
  hasScrolledToLatestRef.current = true;
}, [
  messages,
  isAiTyping,
  mcpTrace,
  showParallelOrbit,
  showInnerWorld,
  showPlaceBooklet,
  showCompanionPage,
  showMemoirPage,
  activeOfflineSessionId,
]);

  /*
   * 内容高度在消息渲染之后还会继续变化（图片加载、气泡动画、
   * 输入中提示出现/消失）。只要用户原本贴在底部，就跟着补一次滚动。
   */
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const content = scrollArea?.firstElementChild;

    if (!scrollArea || !content || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      if (isPinnedToBottomRef.current) {
        scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'auto' });
      }
    });

    observer.observe(content);

    return () => observer.disconnect();
  }, [
    Boolean(chat),
    showParallelOrbit,
    showInnerWorld,
    showPlaceBooklet,
    showCompanionPage,
    showMemoirPage,
    activeOfflineSessionId,
  ]);

  /*
   * 打开表情包面板时，如果聊天原本就贴在底部，有些手机浏览器会在
   * 面板弹出、输入框失焦收起键盘的过程中，把聊天区域悄悄顶上去
   * （不是我们主动滚动的，是浏览器自己的视口/键盘收起行为）。
   * 这里在面板打开后的下一帧、以及稍晚一点（覆盖键盘收起动画的时长）
   * 各纠正一次，把它贴回底部。
   */
  useEffect(() => {
    if (!showStickerModal || !stickerPanelWasNearBottomRef.current) return;

    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const reanchorToBottom = () => {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'auto' });
    };

    const rafId = requestAnimationFrame(reanchorToBottom);
    const timerId = setTimeout(reanchorToBottom, 320);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [showStickerModal]);

  const messagesById = useMemo(() => {
    const map = new Map();

    messages.forEach((message) => {
      map.set(message.id, message);
    });

    return map;
  }, [messages]);

   const visibleMessages = messages;

const handleLoadOlderMessages = useCallback(async () => {
  if (isLoadingMoreRef.current || !hasMoreOlderMessages) return;

  const oldestLoaded = messages[0];
  if (!oldestLoaded) return;

  isLoadingMoreRef.current = true;

  const scrollArea = scrollAreaRef.current;
  if (scrollArea) {
    previousScrollHeightRef.current = scrollArea.scrollHeight;
  }

  try {
    const olderBatch = await getOlderMessagesBefore(
      chatId,
      oldestLoaded.timestamp,
      LOAD_MORE_MESSAGE_BATCH,
    );

    if (olderBatch.length > 0) {
      setMessages((previous) => [...olderBatch, ...previous]);
      loadedMessageCountRef.current += olderBatch.length;
    }

    setHasMoreOlderMessages(olderBatch.length >= LOAD_MORE_MESSAGE_BATCH);
  } catch (error) {
    console.error('[ChatRoom] 加载更早消息失败：', error);
    isLoadingMoreRef.current = false;
    return;
  }

  if (!scrollArea) {
    isLoadingMoreRef.current = false;
  }
}, [chatId, messages, hasMoreOlderMessages]);

const handleMessagesScroll = useCallback((event) => {
  const scrollArea = event.currentTarget;

  isPinnedToBottomRef.current =
    scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight
    <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

  if (
    isLoadingMoreRef.current
    || scrollArea.scrollTop > LOAD_MORE_SCROLL_THRESHOLD_PX
    || !hasMoreOlderMessages
  ) {
    return;
  }

  void handleLoadOlderMessages();
}, [hasMoreOlderMessages, handleLoadOlderMessages]);

useLayoutEffect(() => {
  const scrollArea = scrollAreaRef.current;

  if (!scrollArea || previousScrollHeightRef.current === null) {
    return;
  }

  const newScrollHeight = scrollArea.scrollHeight;

  scrollArea.scrollTop += newScrollHeight - previousScrollHeightRef.current;

  previousScrollHeightRef.current = null;
  isLoadingMoreRef.current = false;
}, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() && selectedType === 'text') return;

    const userAvatar = chat?.userAvatar || character?.userAvatar || '';
    const userName = chat?.userName || character?.userName || '你';

    const newMsg = {
      chatId,
      characterId: character?.id,
      sender: 'user',
      type: selectedType,
      content: inputText.trim()
        || (selectedType === 'image' ? '画面描述' : '心意转账'),
      metadata: extraInputMeta,
      userAvatar,
      userName,
      quotedMessageId: quotedMsg?.id || null,
      isRead: true,
      timestamp: new Date().toISOString(),
    };

    const payload = { ...newMsg };
    delete payload.id;

    const msgId = await db.messages.add(payload);
    newMsg.id = msgId;

    void recordAlmanacEvent({
  chatId,
  characterId: character?.id,
  eventType: ALMANAC_EVENT_TYPES.USER_MESSAGE,
  timestamp: newMsg.timestamp,
  metadata: {
    source: 'chat-room',
    messageType: selectedType,
  },
});

    // 回忆录：user 主动给角色点外卖/转账，立刻记一条"user -> 角色"的回忆
    // （这时角色还没回复，感受留空，等角色下一次回复带了感受标签再回填）。
    if (selectedType === 'food' || selectedType === 'transfer') {
      void recordUserGiftMemoir({
        chatId,
        characterId: character?.id,
        eventType: selectedType,
        metadata: extraInputMeta,
        content: newMsg.content,
        sourceMessageId: msgId,
        timestamp: newMsg.timestamp,
      });
    }


    try {
      await cancelPendingScheduledMessagesForChat(
        chatId,
        'user_sent_new_message',
      );
    } catch (error) {
      console.warn('[ScheduledMessage] 取消旧预约失败：', error);
    }

    playMessageSound('send');

    if (chat?.heartbeatEffectEnabled) {
      setHeartbeatPulseKey((previous) => previous + 1);
    }

    setMessages((previous) => [...previous, newMsg]);
    setInputText('');

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    setQuotedMsg(null);
    setSelectedType('text');
    setExtraInputMeta({});

 forceScrollMessageIdRef.current = newMsg.id;

    await db.chats.update(chatId, {
      updatedAt: new Date().toISOString(),
    });

    // 角色处于"暂时不在线"的时段：本时段第一次出一条自动回复，
    // 并安排上线后自动回复；离线时不给这条消息点表情反应。
    let isCharacterAway = false;

    try {
      const awayResult = await handleUserActivityWhileAway({ chatId });
      isCharacterAway = awayResult.away;

      if (awayResult.autoReplied) {
        await loadChatData();
      }
    } catch (error) {
      console.warn('[Away] 离线自动回复处理失败：', error);
    }

    void checkForCrossChatCheckIn({
      activeChatId: chatId,
      onDelivered: (delivery) => {
        setCheckInDelivery(delivery);
      },
    });

    // 非阻塞：让角色有机会不动声色地给这条消息点个反应，
    // 不影响正常发送流程，也不等它跑完。
    if (!isCharacterAway) {
      void maybeGenerateAiReaction(chatId, newMsg).then((result) => {
        if (result?.status === 'success') {
          loadChatData();
        }
      });
    }
  };

  const playIconOnce = (iconRef, resetTimerRef) => {
  if (resetTimerRef.current) {
    window.clearTimeout(resetTimerRef.current);
  }

  iconRef.current?.startAnimation();

  resetTimerRef.current = window.setTimeout(() => {
    iconRef.current?.stopAnimation();
    resetTimerRef.current = null;
  }, 1000);
};

  const handleSendButtonClick = () => {
  if (!inputText.trim() && selectedType === 'text') return;

  playIconOnce(sendIconRef, sendIconResetTimerRef);
  void handleSendMessage();
};



  const handleTriggerAi = () => {
    if (!character || isAiTyping) return;

    // 角色离线时不会请求 AI（triggerAiResponse 里也有同样的检查），只提示一下。
    const awayState = getAwayState(chat);

    if (awayState.away) {
      triggerGlobalToast({
        title: `${character.name || 'TA'} 现在离线`,
        content: `约 ${formatAwayUntil(awayState.until)} 后回复`,
        iconType: 'chat',
        duration: 3000,
      });
    }
    setMcpTrace(null);
    triggerAiResponse(chatId);

    // #6 小伙伴：每次点"回应"顺带计一次数（换 ❤️），并有一定概率
    // 让角色顺路去看看小伙伴——跟这个聊天窗有没有养小伙伴无关，
    // 函数内部会自己判断，没养的话直接跳过。
    void recordChatResponseForCompanion(chatId);
  };

  const handleTriggerAiButtonClick = () => {
  if (!character || isAiTyping) return;

  playIconOnce(sparklesIconRef, sparklesIconResetTimerRef);
  handleTriggerAi();
};



  const handleRerollMessage = useCallback((messageId) => {
    if (isAiTyping) return;

    setMcpTrace(null);
    rerollAiResponse(chatId, messageId);
  }, [isAiTyping, chatId]);

  const handleSwitchVersion = useCallback(async (msg, direction) => {
    if (!msg.versions || msg.versions.length <= 1) return;

    const currentIndex = msg.currentVersionIndex
      ?? (msg.versions.length - 1);

    const nextIndex = direction === 'prev'
      ? currentIndex - 1
      : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= msg.versions.length) return;

    const targetVersion = msg.versions[nextIndex];

    await db.messages.update(msg.id, {
      currentVersionIndex: nextIndex,
      type: targetVersion.type,
      content: targetVersion.content,
      metadata: targetVersion.metadata || {},
    });

    await loadChatData();
  }, [loadChatData]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    await db.messages.delete(messageId);

    setMessages((previous) => (
      previous.filter((message) => message.id !== messageId)
    ));

    loadedMessageCountRef.current = Math.max(
      0,
      loadedMessageCountRef.current - 1,
    );
  }, []);

  // 从反应面板的"选择"按钮进入多选：把当前这条消息作为第一条
  // 选中项，同时打开多选模式。
  const handleEnterSelectionMode = useCallback((messageId) => {
    setSelectionMode(true);
    setSelectedMessageIds(new Set([messageId]));
  }, []);

  const handleToggleMessageSelected = useCallback((messageId) => {
    setSelectedMessageIds((previous) => {
      const next = new Set(previous);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessageIds(new Set());
  }, []);

  const handleBatchDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedMessageIds);

    if (ids.length === 0) {
      setShowBatchDeleteConfirm(false);
      return;
    }

    await db.messages.bulkDelete(ids);

    setMessages((previous) => (
      previous.filter((message) => !selectedMessageIds.has(message.id))
    ));

    loadedMessageCountRef.current = Math.max(
      0,
      loadedMessageCountRef.current - ids.length,
    );

    setShowBatchDeleteConfirm(false);
    handleExitSelectionMode();
  }, [selectedMessageIds, handleExitSelectionMode]);

  // 转发：按原消息的时间顺序，逐条在目标聊天窗里写入新记录。
  // 不带走 reactions / versions / currentVersionIndex / quotedMessageId
  // 这些跟"原来那次对话"绑定的历史字段，转发过去就是一条干净的
  // 新消息；sender/type/content/metadata 保留，好让图片、转账卡等
  // 各种卡片在新的聊天窗里也能正常渲染。
  const handleForwardSelectedTo = useCallback(async (targetChatId) => {
    if (!targetChatId) return;

    const targetChat = await db.chats.get(targetChatId);
    if (!targetChat) return;

    const orderedSelected = messages
      .filter((message) => selectedMessageIds.has(message.id))
      .sort(
        (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0),
      );

    for (const original of orderedSelected) {
      await db.messages.add({
        chatId: targetChatId,
        characterId: targetChat.characterId,
        sender: original.sender,
        type: original.type,
        content: original.content,
        metadata: original.metadata || {},
        userAvatar: original.userAvatar || '',
        userName: original.userName || '',
        isRead: true,
        timestamp: new Date().toISOString(),
      });
    }

    await db.chats.update(targetChatId, {
      updatedAt: new Date().toISOString(),
    });

    setShowForwardPicker(false);
    handleExitSelectionMode();

    triggerGlobalToast({
      title: '已转发',
      content: `${orderedSelected.length} 条消息已转发`,
      iconType: 'chat',
      duration: 2400,
    });

    if (targetChatId === chatId) {
      await loadChatData();
    }
  }, [messages, selectedMessageIds, chatId, loadChatData, handleExitSelectionMode]);

  const handleStartCall = useCallback((mode) => {
    if (!character?.id) return;
    void startOutgoingCall({ chatId, characterId: character.id, mode });
  }, [chatId, character]);

  const handleToggleReaction = useCallback(async (messageId, typeId) => {
    const target = await db.messages.get(messageId);
    if (!target) return;

    const existingReactions = Array.isArray(target.reactions)
      ? target.reactions
      : [];

    const hadSameType = existingReactions.some(
      (reaction) => reaction.by === 'user' && reaction.type === typeId,
    );

    const nextReactions = existingReactions.filter(
      (reaction) => reaction.by !== 'user',
    );

    if (!hadSameType) {
      nextReactions.push({
        type: typeId,
        by: 'user',
        at: new Date().toISOString(),
      });
    }

    await db.messages.update(messageId, { reactions: nextReactions });
    await loadChatData();
  }, [loadChatData]);

  const handleClearHistory = async () => {
    await db.messages.where('chatId').equals(chatId).delete();
    setMessages([]);
    setMcpTrace(null);
    loadedMessageCountRef.current = INITIAL_VISIBLE_MESSAGE_COUNT;
    setHasMoreOlderMessages(false);
  };

  const handleSaveCustomCss = async (cssCode) => {
    setChat((previous) => ({
      ...previous,
      customCss: cssCode,
    }));

    await db.chats.update(chatId, {
      customCss: cssCode,
    });
  };

  // 气泡装饰和气泡配色是分开保存的两个字段，互不影响：
  // 换配色不会清掉装饰，换装饰也不会动配色的 CSS。
  const handleSaveBubbleDecoration = async (decorationId) => {
    setChat((previous) => ({
      ...previous,
      bubbleDecoration: decorationId,
    }));

    await db.chats.update(chatId, {
      bubbleDecoration: decorationId,
    });
  };

  const handleUpdateBgImage = async (base64Img) => {
    setChat((previous) => ({
      ...previous,
      bgImage: base64Img,
    }));

    await db.chats.update(chatId, {
      bgImage: base64Img,
    });
  };

  const handleUpdateBgOpacity = async (opacity) => {
    setChat((previous) => ({
      ...previous,
      bgOpacity: opacity,
    }));

    await db.chats.update(chatId, {
      bgOpacity: opacity,
    });
  };

  const handleToggleKeepAlive = async (value) => {
    setChat((previous) => ({
      ...previous,
      keepAlive: value,
    }));

    await db.chats.update(chatId, {
      keepAlive: value,
    });
  };

  const handleToggleHeartbeatEffect = async (value) => {
    setChat((previous) => ({
      ...previous,
      heartbeatEffectEnabled: value,
    }));

    await db.chats.update(chatId, {
      heartbeatEffectEnabled: value,
    });
  };

    const handleTogglePinTopToolbar = async (value) => {
    setChat((previous) => ({
      ...previous,
      pinTopToolbar: value,
    }));

    await db.chats.update(chatId, {
      pinTopToolbar: value,
    });
  };


  const handleSaveHeaderCaption = async (newCaption) => {
    setChat((previous) => ({
      ...previous,
      headerCaption: newCaption,
    }));

    await db.chats.update(chatId, {
      headerCaption: newCaption,
    });
  };

  const handleSaveSummary = async (newSummary) => {
    setChat((previous) => ({
      ...previous,
      summary: newSummary,
    }));

    await db.chats.update(chatId, {
      summary: newSummary,
    });
  };

  if (!chat) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">
        <div className="flex flex-col items-center gap-2">
          <RotateCw className="h-6 w-6 animate-spin text-[var(--accent-color)]" />
          <p className="text-sm">正在加载空间...</p>
        </div>
      </div>
    );
  }

  const activeUserAvatar = chat?.userAvatar || character?.userAvatar || '';
  const activeUserName = chat?.userName || character?.userName || '你';
  const bgOpacity = chat?.bgOpacity ?? 0.3;
  const isBgDimmed = chat?.isBgDimmed ?? true;
  const currentCss = chat?.customCss || defaultCss;


  if (showParallelOrbit) {
    return (
      <ParallelOrbit
        chatId={chatId}
        character={character}
        onBack={() => {
          hasScrolledToLatestRef.current = false;
          setShowParallelOrbit(false);
        }}
      />
    );
  }

        if (showInnerWorld) {
    return (
      <InnerWorldApp
        chatId={chatId}
        characterId={character?.id}
        onClose={() => {
  hasScrolledToLatestRef.current = false;
  setShowInnerWorld(false);
}}
      />
    );
  }

  if (activeOfflineSessionId) {
    return (
      <OfflineChatRoom
        chatId={chatId}
        offlineSessionId={activeOfflineSessionId}
        onBack={() => {
  hasScrolledToLatestRef.current = false;
  setActiveOfflineSessionId(null);
  void loadChatData();
}}
      />
    );
  }
  if (showPlaceBooklet) {
  return (
    <PlaceBooklet
      chatId={chatId}
      character={character}
      onBack={() => {
  hasScrolledToLatestRef.current = false;
  setShowPlaceBooklet(false);
}}
    />
  );
}

  if (showCompanionPage) {
  return (
    <Suspense fallback={null}>
      <CompanionPage
        chatId={chatId}
        character={character}
        onBack={() => {
  hasScrolledToLatestRef.current = false;
  setShowCompanionPage(false);
}}
      />
    </Suspense>
  );
}

  if (showMemoirPage) {
  return (
    <Suspense fallback={null}>
      <MemoirPage
        chatId={chatId}
        character={character}
        onBack={() => {
  hasScrolledToLatestRef.current = false;
  setShowMemoirPage(false);
}}
      />
    </Suspense>
  );
}



  return (
    <div
      className="chat-room-container fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden text-left text-xs animate-fade-in-up"
      style={{
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
      }}
    >
      {memoizedStyle}
      {chatFontStyle}
      {controlStylePresetStyle}
      {chatColorStyle}

      <CheckInNotice
        delivery={checkInDelivery}
        onDismiss={() => setCheckInDelivery(null)}
        onOpen={() => {
          const targetChatId = checkInDelivery?.chatId;

          setCheckInDelivery(null);

          if (targetChatId) {
            onOpenChat?.(targetChatId);
          }
        }}
      />

      <ChatEntryCardOverlay card={entryCard} onDone={dismissEntryCard} />

      {chat.bgImage && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              backgroundImage: `url(${chat.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />

          {isBgDimmed && (
            <div
              className="absolute inset-0 transition-opacity"
              style={{
                background: `rgba(var(--bg-main-rgb, 0, 0, 0), ${bgOpacity})`,
                backgroundColor: 'var(--bg-main)',
                opacity: bgOpacity,
              }}
            />
          )}
        </div>
      )}

      <header className="z-20 shrink-0 px-4 pb-1 pt-3">
        {selectionMode ? (
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExitSelectionMode}
                className="text-xs font-semibold opacity-80 hover:opacity-100"
              >
                完成
              </button>

              <span className="text-xs opacity-70">
                已选择 {selectedMessageIds.size} 条
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={selectedMessageIds.size === 0}
                onClick={() => setShowForwardPicker(true)}
                className="flex items-center gap-1 text-xs font-semibold disabled:opacity-30"
                style={{ color: 'var(--accent-color)' }}
              >
                <Forward className="h-3.5 w-3.5" />
                <span>转发</span>
              </button>

              <button
                type="button"
                disabled={selectedMessageIds.size === 0}
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="flex items-center gap-1 text-xs font-semibold text-red-500 disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>删除</span>
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="chat-top-toolbar flex items-center justify-between pb-1">

          <div className="relative flex items-center gap-2">
            {/* 返回按钮是唯一的例外，收起状态下也始终悬浮在左上角 */}
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center rounded-full p-2 opacity-85 transition-opacity hover:opacity-100"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
              }}
              title="返回列表"
              aria-label="返回列表"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {(Boolean(chat?.pinTopToolbar) || showFullHeaderBar) && (
              <>
                <button
                  type="button"
                  onClick={() => setShowParallelOrbit(true)}
                  className="flex items-center justify-center rounded-full p-2 opacity-80 transition-all hover:bg-neutral-100 hover:opacity-100 dark:hover:bg-neutral-800"
                  style={{
                    color: 'var(--text-main)',
                    border: '1px solid var(--card-border)',
                    background: 'var(--control-soft-bg)',
                  }}
                  title="翻阅平行轨迹"
                >
                  <BookOpen className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowTopMenu((previous) => !previous)}
                  className="flex items-center justify-center rounded-full p-2 opacity-85 transition-all hover:bg-neutral-100 hover:opacity-100 dark:hover:bg-neutral-800"
                  style={{
                    background: 'var(--control-soft-bg)',
                    color: 'var(--text-main)',
                  }}
                  title="更多入口"
                  aria-label="更多入口"
                >
                  <PawPrint
                    className={`h-4 w-4 transition-transform duration-300 ${
                      showTopMenu ? 'scale-110' : ''
                    }`}
                  />
                </button>

                {showTopMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setShowTopMenu(false)}
                    />

                    <div
                      className="absolute left-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-2xl py-1 shadow-xl"
                      style={{
                        background: 'var(--card-bg-gradient)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--card-border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowTopMenu(false);
                          setShowInnerWorld(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                      >
                        <Moon className="h-4 w-4" />
                        <span>内心主页</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowTopMenu(false);
                          setShowPlaceBooklet(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                      >
                        <MapPinned className="h-4 w-4" />
                        <span>地点小册子</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowTopMenu(false);
                          setShowOfflineComposer(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                      >
                        <Compass className="h-4 w-4" />
                        <span>邀请线下见面</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowTopMenu(false);
                          setShowOfflineInviteArchive(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                      >
                        <Ticket className="h-4 w-4" />
                        <span>查看线下邀约</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowTopMenu(false);
                          setShowCompanionPage(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                      >
                                                <CompanionHeartIcon className="h-4 w-4" />
                        <span>小伙伴<span className="opacity-50">（正在施工）</span></span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowTopMenu(false);
                          setShowMemoirPage(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                      >
                        <BookHeart className="h-4 w-4" />
                        <span>回忆录</span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {(Boolean(chat?.pinTopToolbar) || showFullHeaderBar) && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCallModeMenu((previous) => !previous)}
                  className="rounded-full p-2 opacity-85 transition-opacity hover:opacity-100"
                  style={{
                    background: 'var(--control-soft-bg)',
                    color: 'var(--text-main)',
                  }}
                  title="发起语音通话"
                  aria-label="发起语音通话"
                >
                  <Phone className="h-4 w-4" />
                </button>

                {showCallModeMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setShowCallModeMenu(false)}
                    />

                    <div
                      className="absolute right-0 top-full z-40 mt-1.5 w-40 overflow-hidden rounded-2xl py-1 shadow-xl"
                      style={{
                        background: 'var(--card-bg-gradient)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--card-border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowCallModeMenu(false);
                          handleStartCall('text');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                      >
                        <Phone className="h-4 w-4" />
                        <span>文字语气通话</span>
                      </button>

                      {isRealVoiceAvailableForCharacter(character) && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowCallModeMenu(false);
                            handleStartCall('real');
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                        >
                          <Volume2 className="h-4 w-4" />
                          <span>真实语音通话</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowScheduledArchive(true)}
                className="rounded-full p-2 opacity-85 transition-opacity hover:opacity-100"
                style={{
                  background: 'var(--control-soft-bg)',
                  color: 'var(--text-main)',
                }}
                title="查看稍后联系存档"
                aria-label="查看稍后联系存档"
              >
                <ReceiptText className="h-4 w-4" />
              </button>

              <MoreMenuPopover
                onOpenCalendar={() => setShowCalendar(true)}
                onOpenSettings={() => setShowChatSettings(true)}
              />
            </div>
          )}
        </div>


        <ChatHeaderBar
          character={character}
          chat={chat}
          onOpenSettings={onOpenCharacterEditor}
          onSaveSummary={handleSaveSummary}
          onStartCall={handleStartCall}
          realVoiceAvailable={isRealVoiceAvailableForCharacter(character)}
          isExpanded={showFullHeaderBar}
          onToggleExpanded={setShowFullHeaderBar}
          headerCaption={chat?.headerCaption}
          onSaveHeaderCaption={handleSaveHeaderCaption}
        />
        </>
        )}
      </header>

      <section
        ref={scrollAreaRef}
        onScroll={handleMessagesScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 no-scrollbar"
      >
        <MessageList
          visibleMessages={visibleMessages}
          messagesById={messagesById}
          bubbleDecoration={chat?.bubbleDecoration || 'none'}
          character={character}
          activeUserAvatar={activeUserAvatar}
          activeUserName={activeUserName}
          isAiTyping={isAiTyping}
          mcpTrace={mcpTrace}
          typingText={chat.typingText || ''}
          typingStyle={chat.typingStyle || 'default'}
          hasMoreOlderMessages={hasMoreOlderMessages}
          onReroll={handleRerollMessage}
          onDelete={handleDeleteMessage}
          onQuote={setQuotedMsg}
          onSwitchVersion={handleSwitchVersion}
                   onResolvedInteraction={loadChatData}
                             onEnterOfflineScene={(sessionId) => setActiveOfflineSessionId(sessionId)}
          onToggleReaction={handleToggleReaction}
          onOpenCompanionOffer={() => setShowCompanionPage(true)}
          onPokeAvatar={handlePokeCharacter}
          selectionMode={selectionMode}
          selectedMessageIds={selectedMessageIds}
          onToggleSelected={handleToggleMessageSelected}
          onEnterSelectionMode={handleEnterSelectionMode}
        />
      </section>

      

<footer
  className="z-20 shrink-0 px-4 pt-1"
  style={{
    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
  }}
>
  {pendingNamePlace && (
    <PendingPlaceBanner
      onConfirm={async (name) => {
        try {
          await namePlace(pendingNamePlace.id, name);
          setPendingNamePlace(null);
        } catch (error) {
          console.warn('[Location] 地点命名失败：', error);
        }
      }}
      onDismiss={() => setPendingNamePlace(null)}
    />
  )}

        {quotedMsg && (
          <div
            className="mb-2 flex items-start justify-between rounded-2xl p-2 px-3 text-[10px] shadow-md"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
            }}
          >
            <div
              className="pr-2"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              <span className="font-bold">
                引用 {quotedMsg.sender === 'user'
                  ? activeUserName
                  : character?.name}:
              </span>{' '}
              {quotedMsg.content}
            </div>

            <button
              type="button"
              onClick={() => setQuotedMsg(null)}
              className="shrink-0 p-1 opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}

        {selectedType !== 'text' && (
          <div
            className="mb-2 space-y-2 rounded-2xl p-3 text-[11px] shadow-md"
            style={{
              background: 'var(--control-soft-bg)',
              color: 'var(--text-main)',
            }}
          >
            <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
              <span>MODIFIER: {selectedType.toUpperCase()}</span>

              <button
                type="button"
                onClick={() => setSelectedType('text')}
              >
                &times;
              </button>
            </div>

            {selectedType === 'image' && (
              <input
                type="text"
                placeholder="输入图片的视觉描写细节..."
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                className="w-full rounded-xl p-2 outline-none"
                style={{
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                }}
              />
            )}

            {selectedType === 'transfer' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="转账数字"
                  onChange={(event) => {
                    setExtraInputMeta({
                      ...extraInputMeta,
                      amount: event.target.value,
                    });
                  }}
                  className="w-1/2 rounded-xl p-2 font-mono outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />

                <input
                  type="text"
                  placeholder="心意留言"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-1/2 rounded-xl p-2 outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}

            {selectedType === 'gift' && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="礼物名称 (如: 羊绒围巾)"
                  onChange={(event) => {
                    setExtraInputMeta({
                      ...extraInputMeta,
                      name: event.target.value,
                    });
                  }}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />

                <input
                  type="text"
                  placeholder="寄语或选礼理由..."
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}

            {selectedType === 'food' && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="餐品/饮品"
                    onChange={(event) => {
                      setExtraInputMeta({
                        ...extraInputMeta,
                        item: event.target.value,
                      });
                    }}
                    className="w-1/2 rounded-xl p-2 text-xs outline-none"
                    style={{
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                    }}
                  />

                  <input
                    type="text"
                    placeholder="商家/品牌"
                    onChange={(event) => {
                      setExtraInputMeta({
                        ...extraInputMeta,
                        store: event.target.value,
                      });
                    }}
                    className="w-1/2 rounded-xl p-2 text-xs outline-none"
                    style={{
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                    }}
                  />
                </div>

                <input
                  type="text"
                  placeholder="叮嘱留言 (如: 记得趁热吃)"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}

            {selectedType === 'kinship' && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="额度数字 (如: 5200)"
                  onChange={(event) => {
                    setExtraInputMeta({
                      ...extraInputMeta,
                      amount: event.target.value,
                    });
                  }}
                  className="w-full rounded-xl p-2 font-mono text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />

                <input
                  type="text"
                  placeholder="专属卡面赠言..."
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  className="w-full rounded-xl p-2 text-xs outline-none"
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            )}
          </div>
        )}

        <HeartbeatPulse pulseKey={heartbeatPulseKey} />

        <div
          className="chat-input-bar flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-2xl transition-all duration-300"
          style={{
            background: 'var(--card-bg-gradient)',
            color: 'var(--text-main)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
          }}
        >
          <div className="relative flex items-center gap-1 opacity-80">
            <InteractiveMenuPopover
              onSelectAction={(type) => {
                if (type === 'sticker') {
                  const scrollArea = scrollAreaRef.current;
                  if (scrollArea) {
                    const distanceFromBottom =
                      scrollArea.scrollHeight
                      - scrollArea.scrollTop
                      - scrollArea.clientHeight;
                    stickerPanelWasNearBottomRef.current =
                      distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
                  }

                  // 主动收起键盘，避免它和面板弹出的时机互相打架引发跳动
                  inputRef.current?.blur();

                  setShowStickerModal(true);
                  return;
                }

                if (type === 'interaction_coin') {
                  void handleCreateInteraction(INTERACTION_TYPES.COIN);
                  return;
                }

                if (type === 'interaction_dice') {
                  void handleCreateInteraction(INTERACTION_TYPES.DICE);
                  return;
                }

                if (type === 'interaction_rps') {
                  void handleCreateInteraction(INTERACTION_TYPES.RPS);
                  return;
                }

                if (type === 'interaction_poke') {
                  void handlePokeCharacter('full');
                  return;
                }

                
                if (type === 'mcp_order') {
                  // 先收起键盘，避免和窗口弹出的时机互相打架
                  inputRef.current?.blur();
                  setShowOrderModal(true);
                  return;
                }

                setSelectedType(type);
              }}
            />

           <button
  type="button"
  onClick={() => setShowInputMenu((previous) => !previous)}
  className={`rounded-full p-2 transition-all active:scale-90 ${
    showInputMenu ||
    selectedType === 'image' ||
    selectedType === 'voice' ||
    selectedType === 'transfer'
      ? 'bg-[var(--control-soft-bg)] opacity-100'
      : 'opacity-75 hover:opacity-100'
  }`}
  title="更多输入方式"
  aria-label="更多输入方式"
>
  <Plus
    className={`h-[17px] w-[17px] transition-transform duration-300 ${
      showInputMenu ? 'rotate-45' : ''
    }`}
  />
</button>

            {showInputMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowInputMenu(false)}
                />

                <div
                  className="absolute bottom-full left-0 z-40 mb-2 w-36 overflow-hidden rounded-2xl py-1 shadow-xl"
                  style={{
                    background: 'var(--card-bg-gradient)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowInputMenu(false);
                      setSelectedType('image');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                  >
                    <Image className="h-4 w-4" />
                    <span>画面描述</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowInputMenu(false);
                      setSelectedType('voice');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>模拟语音</span>
                  </button>

                                    <button
                    type="button"
                    onClick={() => {
                      setShowInputMenu(false);
                      setSelectedType('transfer');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>心意转账</span>
                  </button>

                  <PhotoCaptureButton
                    chatId={chatId}
                    characterId={character?.id}
                  />
                </div>
              </>
            )}
          </div>

          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
              event.target.style.height = 'auto';
              event.target.style.height = `${
                Math.min(event.target.scrollHeight, 160)
              }px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder={
              selectedType === 'text'
                ? (
                  chat?.inputPlaceholder
                  || `与 ${character?.name || '伴侣'} 倾诉...`
                )
                : `已选 ${selectedType} 模式`
            }
            className="max-h-40 w-full resize-y overflow-y-auto bg-transparent text-xs leading-relaxed outline-none chat-input-font"
            style={{
              color: 'var(--text-main)',
              minHeight: '24px',
            }}
          />

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleSendButtonClick}
              className="chat-send-btn rounded-full p-2 transition-transform hover:opacity-90 active:scale-90"
              style={{
                background: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
              }}
              title="发送记录"
            >
              <SendIcon
  ref={sendIconRef}
  size={14}
  animateOnHover={false}
  className="text-current"
/>

            </button>

           <button
  type="button"
  onClick={handleTriggerAiButtonClick}

              disabled={isAiTyping}
              className="chat-respond-btn flex items-center gap-1 rounded-full px-3.5 py-2 text-[10px] font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              style={{
                background: 'var(--accent-color)',
                color: 'var(--accent-foreground)',
              }}
              title="触发伴侣回应"
            >
              <SparklesIcon
  ref={sparklesIconRef}
  size={12}
  animateOnHover={false}
  className="text-current"
/>

              <span>回应</span>
            </button>
          </div>
        </div>
      </footer>

      {showBubbleCustomizer && (
        <BubbleCustomizer
          currentCss={currentCss}
          onSave={handleSaveCustomCss}
          currentDecoration={chat?.bubbleDecoration || 'none'}
          onSaveDecoration={handleSaveBubbleDecoration}
          onClose={() => setShowBubbleCustomizer(false)}
        />
      )}

            {showChatSettings && (
        <ChatSettingsModal
          chat={chat}
          character={character}
          fontStatus={customFontStatus}
          onClose={() => setShowChatSettings(false)}
          onUpdateBgImage={handleUpdateBgImage}
          onUpdateBgOpacity={handleUpdateBgOpacity}
          onToggleKeepAlive={handleToggleKeepAlive}
          onTogglePinTopToolbar={handleTogglePinTopToolbar}
          onToggleHeartbeatEffect={handleToggleHeartbeatEffect}
          onOpenBubbleCustomizer={() => setShowBubbleCustomizer(true)}
          onClearHistory={handleClearHistory}
          onDeletedChat={onBack}
          onSaveSummary={handleSaveSummary}
          onUpdatedUserPersona={loadChatData}
        />
      )}


      {showCalendar && (
  <ChatCalendarModal
    isOpen={showCalendar}
    chatId={chatId}
    character={character}
    onClose={() => setShowCalendar(false)}
  />
)}

      {showScheduledArchive && (
        <ScheduledMessageArchive
          chatId={chatId}
          character={character}
          onClose={() => setShowScheduledArchive(false)}
        />
      )}

           {showOfflineComposer && (
        <OfflineInviteComposer
          chatId={chatId}
          characterId={character?.id}
          onClose={() => setShowOfflineComposer(false)}
          onCreated={loadChatData}
        />
      )}

      {showOfflineInviteArchive && (
  <OfflineInviteArchive
    chatId={chatId}
    onClose={() => setShowOfflineInviteArchive(false)}
    onEnterScene={(sessionId) => {
      setShowOfflineInviteArchive(false);
      hasScrolledToLatestRef.current = false;
      setActiveOfflineSessionId(sessionId);
    }}
  />
)}

      <StickerPickerModal
        isOpen={showStickerModal}
        onClose={() => setShowStickerModal(false)}
        onSelectSticker={handleSendSticker}
      />

      
      {showOrderModal && (
        <Suspense fallback={null}>
          <OrderRequestModal
            onClose={() => setShowOrderModal(false)}
            onSubmit={handleSendOrderRequest}
          />
        </Suspense>
      )}

      <McpToolApprovalModal
        request={pendingMcpApproval}
        onResolve={closePendingMcpApproval}
      />

      {showForwardPicker && (
        <ForwardChatPicker
          currentChatId={chatId}
          messageCount={selectedMessageIds.size}
          onClose={() => setShowForwardPicker(false)}
          onForward={handleForwardSelectedTo}
        />
      )}

      <ConfirmModal
        isOpen={showBatchDeleteConfirm}
        title="删除选中的消息"
        message={`确定要删除这 ${selectedMessageIds.size} 条消息吗？操作后不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        onCancel={() => setShowBatchDeleteConfirm(false)}
        onConfirm={handleBatchDeleteSelected}
      />
    </div>
  );
};

export default ChatRoom;