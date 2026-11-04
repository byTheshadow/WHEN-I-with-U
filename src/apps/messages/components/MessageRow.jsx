import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Quote,
  Trash2,
  ImageOff,
  CheckCheck,
  Check,
  User,
} from 'lucide-react';

import ChatInteractionMessage from '../interactions/ChatInteractionMessage';
import ChatPokeNotice from '../interactions/ChatPokeNotice';
import MoodUpdateNotice from '../mood/MoodUpdateNotice';
import ChatDiyUpdateNotice from '../diy/ChatDiyUpdateNotice';
import ChallengeCompletionNotice from '../../challenges/ChallengeCompletionNotice';
import HarpMelodyNotice from '../../harp/HarpMelodyNotice';
import PixelDollGiftNotice from '../../pixelDoll/PixelDollGiftNotice';
import GreetingGiftNotice from '../../greeting/GreetingGiftNotice';
import TextGameResultNotice from '../../textgames/TextGameResultNotice';
import ChatParcelArrivedNotice from '../parcel/ChatParcelArrivedNotice';
import ChatParallelOrbitNotice from './ChatParallelOrbitNotice';
import ProfileTraceCard from '../profile/ProfileTraceCard';
import ChatTrickNotice from '../interactions/halloween/ChatTrickNotice';
import ChatUserAutoReply from '../userCard/ChatUserAutoReply';
import SpiderEgg from '../interactions/halloween/SpiderEgg';
import OfflineInviteCard from '../../offline/OfflineInviteCard';
import RealVoiceCard from '../../../features/real-voice/components/RealVoiceCard';
import CallLogEntry from './CallLogEntry';

import LocationCard from './cards/LocationCard';

import MessageReactions from './MessageReactions';
import ReactionPickerPopover from './ReactionPickerPopover';
import { matchSpecialMessageEffect, RECENT_MESSAGE_EFFECT_WINDOW_MS } from './specialMessageEffects';
import { BubbleDecorationOverlay } from './bubbleDecorations';

import TextCard from './cards/TextCard';
import LearningModeTranslationToggle from '../learningMode/LearningModeTranslationToggle';
import ImageCard from './cards/ImageCard';
import GeneratedImageCard from './cards/GeneratedImageCard';
import PhoneScreenCard from '../phoneScreen/PhoneScreenCard';
import VoiceCard from './cards/VoiceCard';
import TransferCard from './cards/TransferCard';
import ArticleCard from './cards/ArticleCard';
import GiftCard from './cards/GiftCard';
import FoodDeliveryCard from './cards/FoodDeliveryCard';
import KinshipCard from './cards/KinshipCard';
import CouponCard from './cards/CouponCard';
import SecretCodeProposalNotice from '../secretCode/SecretCodeProposalNotice';
import MarginNoteCard from './cards/MarginNoteCard';
import OrderRequestCard from './cards/OrderRequestCard';
import StickerCard from './cards/StickerCard';
import PhotoCard from './cards/PhotoCard';
import McpUsageTraceCard from './cards/McpUsageTraceCard';
import ApiFallbackHint from './cards/ApiFallbackHint';
import CompanionOfferCard from './cards/CompanionOfferCard';
import CompanionStatusAlertCard from './cards/CompanionStatusAlertCard';
import BubbleCssCard from './cards/BubbleCssCard';
import ConfirmCard from './cards/ConfirmCard';

import McdOrderCard from './cards/McdOrderCard';
import AppleHealthCard from './cards/AppleHealthCard';
import RobotActionCard from './cards/RobotActionCard';
import AppleCalendarCard from './cards/AppleCalendarCard';
import LuckinCoffeeCard from './cards/LuckinCoffeeCard';
import NeteaseMusicCard from './cards/NeteaseMusicCard';
import { DidiRideCard } from './cards/DidiRideCard';
import WeatherCard from './cards/WeatherCard';
import WebSearchResultCard from './cards/WebSearchResultCard';


// 长按多久才算"长按"、弹出反应面板。太短容易跟正常点击冲突，
// 太长又会显得迟钝，420ms 是比较常见的手感。
const REACTION_LONG_PRESS_MS = 420;

// 长按头像打开资料卡，跟上面消息气泡的长按反应面板是同一个手感
// 数值，但用在头像上——跟双击戳一戳（onDoubleClick，浏览器原生
// 事件）完全不冲突：长按走的是 pointerdown 计时器，普通单击/双击
// 根本不会撑到这个时长，不需要额外做"单击/双击"的时序区分。
const AVATAR_LONG_PRESS_MS = 480;

const MessageRow = ({
  msg,
  quoted,
  bubbleDecoration,
  character,
  activeUserAvatar,
  activeUserName,
  isAiTyping,
  onReroll,
  onDelete,
  onClearPhotoMedia,
  onQuote,
  onSwitchVersion,
    onResolvedInteraction,
  onEnterOfflineScene,
  onToggleReaction,
  onOpenCompanionOffer,
  onOpenParcel,
  onOpenParallelOrbit,
  onRespondToConfirmCard,
  onPokeAvatar,
  onOpenProfileCard,
  selectionMode,
  isSelected,
  onToggleSelected,
  onEnterSelectionMode,
}) => {
  const isUser = msg.sender === 'user';
  const versions = msg.versions || [];
  const versionIndex = msg.currentVersionIndex
    ?? (versions.length > 1 ? versions.length - 1 : 0);

  const isErrorMsg = (
    msg.type === 'error'
    || msg.metadata?.errorCode
  );

  // 特殊消息效果（比如"想你"飘小星星）：只在消息内容命中规则、
  // 且是这个会话打开期间刚刚到达的消息时才播放，翻旧消息历史
  // 不会反复重播。
  const specialEffectRule = msg.type === 'text'
    ? matchSpecialMessageEffect(msg.content)
    : null;

  const messageTimestampMs = new Date(
    msg.timestamp || msg.createdAt || 0
  ).getTime();

  const showSpecialEffect = Boolean(specialEffectRule)
    && Number.isFinite(messageTimestampMs)
    && (Date.now() - messageTimestampMs) < RECENT_MESSAGE_EFFECT_WINDOW_MS;

  // 气泡进场动画：沿用上面"刚到的消息才播"的约定（每次渲染重新算，不用
  // ref 防重播）。这里只给刚到达的气泡加 bubble-fresh 类；具体播哪种动画
  // 由 ChatRoom.jsx 按 chat.bubbleAnimation 注入的样式决定，没选动画时
  // 没有任何规则命中这个类，所以对没用这个功能的聊天窗没有任何影响。
  const isFreshBubble = Number.isFinite(messageTimestampMs)
    && (Date.now() - messageTimestampMs) < RECENT_MESSAGE_EFFECT_WINDOW_MS;

  const canReact = !isErrorMsg
    && msg.type !== 'interaction'
    && msg.type !== 'offline_invite'
    && msg.type !== 'call'
    && msg.type !== 'poke';

  // 双击角色头像戳一戳：先给头像本身一个瞬时的小抖动反馈，
  // 不等实际写库/AI反应完成——那部分效果由戳一戳消息自己的
  // ChatPokeNotice 在渲染出来时负责播放（震动 + 系统提示行抖动）。
  const [isPokingAvatar, setIsPokingAvatar] = useState(false);
  const pokeWiggleTimerRef = useRef(null);

  const handleAvatarDoubleClick = useCallback(() => {
    if (!onPokeAvatar) return;

    setIsPokingAvatar(true);

    if (pokeWiggleTimerRef.current) {
      window.clearTimeout(pokeWiggleTimerRef.current);
    }

    pokeWiggleTimerRef.current = window.setTimeout(() => {
      setIsPokingAvatar(false);
    }, 400);

    onPokeAvatar('light');
  }, [onPokeAvatar]);

  useEffect(() => () => {
    if (pokeWiggleTimerRef.current) {
      window.clearTimeout(pokeWiggleTimerRef.current);
    }
  }, []);

  // 长按头像打开资料卡。跟下面消息气泡的长按反应面板用的是同一套
  // pointer 事件写法：按下开始计时，松手/移出就清掉，真正撑过
  // AVATAR_LONG_PRESS_MS 才触发，避免普通点击也被当成长按。
  const avatarPressTimerRef = useRef(null);

  const clearAvatarPressTimer = useCallback(() => {
    if (avatarPressTimerRef.current) {
      window.clearTimeout(avatarPressTimerRef.current);
      avatarPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAvatarPressTimer(), [clearAvatarPressTimer]);

  const handleAvatarPointerDown = useCallback(() => {
    if (!onOpenProfileCard) return;

    clearAvatarPressTimer();
    avatarPressTimerRef.current = window.setTimeout(() => {
      onOpenProfileCard();
    }, AVATAR_LONG_PRESS_MS);
  }, [onOpenProfileCard, clearAvatarPressTimer]);

  const handleAvatarPointerRelease = useCallback(() => {
    clearAvatarPressTimer();
  }, [clearAvatarPressTimer]);

  // 长按消息气泡弹出反应选择面板：用 pointer 事件统一处理鼠标和
  // 触屏，按住超过 REACTION_LONG_PRESS_MS 才算长按，普通点击（比如
  // 点图片看大图、点链接）不会被误触发。
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionPressTimerRef = useRef(null);

  const clearReactionPressTimer = useCallback(() => {
    if (reactionPressTimerRef.current) {
      window.clearTimeout(reactionPressTimerRef.current);
      reactionPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearReactionPressTimer(), [clearReactionPressTimer]);

  const handleBubblePointerDown = useCallback(() => {
    if (!canReact || selectionMode) return;

    clearReactionPressTimer();
    reactionPressTimerRef.current = window.setTimeout(() => {
      setShowReactionPicker(true);
    }, REACTION_LONG_PRESS_MS);
  }, [canReact, selectionMode, clearReactionPressTimer]);

  const handleBubblePointerRelease = useCallback(() => {
    clearReactionPressTimer();
  }, [clearReactionPressTimer]);

  const handleBubbleContextMenu = useCallback((event) => {
    if (canReact) {
      event.preventDefault();
    }
  }, [canReact]);

  const userReactionType = Array.isArray(msg.reactions)
    ? msg.reactions.find((reaction) => reaction.by === 'user')?.type
    : undefined;

  const handlePickReaction = useCallback((typeId) => {
    onToggleReaction(msg.id, typeId);
    setShowReactionPicker(false);
  }, [msg.id, onToggleReaction]);

  // 从反应面板里点"选择"：收起面板，把这条消息作为多选模式的
  // 第一条选中项交给 ChatRoom 去开启多选模式。
  const handleEnterSelect = useCallback(() => {
    setShowReactionPicker(false);
    onEnterSelectionMode?.(msg.id);
  }, [msg.id, onEnterSelectionMode]);

  // 多选模式下点一下消息本体（不是长按）就切换勾选，跟长按反应
  // 面板互斥——canReact 同时也是"这条消息允许被多选"的判定，
  // 两者复用同一份"普通内容消息"名单，不允许多选的消息类型
  // （互动/线下邀约/通话记录/错误消息）点击时什么都不做。
  const handleBubbleSelectClick = useCallback((event) => {
    if (!selectionMode || !canReact) return;

    event.preventDefault();
    event.stopPropagation();
    onToggleSelected?.(msg.id);
  }, [selectionMode, canReact, msg.id, onToggleSelected]);

  const messageMcpTrace = isUser
    ? null
    : msg.metadata?.mcpTrace;

  const messageOrderCard = isUser
    ? null
    : msg.metadata?.mcpCard;

  // 戳一戳是一条居中的系统提示行，不走头像+气泡那一整套布局，
  // 单独渲染即可（放在这里而不是提前 return，是为了让上面这些
  // hook 在每次渲染时都保持同样的调用顺序，不受消息类型影响）。
  if (msg.type === 'poke') {
    return (
      <ChatPokeNotice
        message={msg}
        character={character}
        activeUserName={activeUserName}
      />
    );
  }

    // 用户"暂时不在线"自动回复：用户一侧的小气泡，带"自动回复"标记。
  if (msg.type === 'user_auto_reply') {
    return <ChatUserAutoReply message={msg} />;
  }

  if (msg.type === 'trick') {
    return (
      <ChatTrickNotice
        message={msg}
        character={character}
        activeUserName={activeUserName}
      />
    );
  }

  // 角色DIY小屋换了样子之后的提示：跟戳一戳同理，一条居中系统提示行，
  // 纯文字公告，不可点击跳转。
  if (msg.type === 'diy_update') {
    return <ChatDiyUpdateNotice message={msg} />;
  }

  // 异地任务挑战——用户完成"TA发起的任务"后留的痕迹：同样是一条居中
  // 系统提示行，不可点击跳转，具体进度去打卡板面板里看。
  if (msg.type === 'challenge_complete') {
    return <ChallengeCompletionNotice message={msg} />;
  }

  // 星光小竖琴旋律卡片，可点击重听。
   // 悄悄话词典——角色提议的新暗号：电报票卡片，处理完缩成一行记录。
  if (msg.type === 'secret_code_proposal') {
    return <SecretCodeProposalNotice message={msg} character={character} />;
  }

  if (msg.type === 'harp_melody') {
    return <HarpMelodyNotice message={msg} />;
  }
  // 像素衣橱——送礼/角色回应/角色主动送礼留在聊天记录里的痕迹，同样是
  // 居中系统提示行，不可点击，具体穿戴情况去"像素衣橱"面板里看。
  if (msg.type === 'pixel_doll_gift') {
    return <PixelDollGiftNotice message={msg} />;
  }

     // 贺卡 / 立体书——角色送来的礼物小卡片，可点：就地拆开 / 翻开。
   if (msg.type === 'greeting_gift') {
     return <GreetingGiftNotice message={msg} />;
   }

  // 文字游戏大厅——跟角色对弈完一局之后留在聊天记录里的痕迹，同样
  // 是居中系统提示行，不可点击，具体棋盘/规则都在大厅里回看不了
  // （对局本身不落盘，只落这条结果公告）。
  if (msg.type === 'text_game_result') {
    return <TextGameResultNotice message={msg} />;
  }

  // 快递到了之后的提示：跟DIY换装那条不一样，这条是可以点的——点进去
  // 才能真正拆开看里面是什么。
  if (msg.type === 'parcel_arrived') {
    return <ChatParcelArrivedNotice message={msg} onOpenParcel={onOpenParcel} />;
  }

  // 平行轨迹后台静默扫描偷偷生成了新一段的提示：同样可点，点进去跳转
  // 到平行轨迹页面查看具体内容。
  if (msg.type === 'parallel_orbit_update') {
    return (
      <ChatParallelOrbitNotice
        message={msg}
        onOpenParallelOrbit={onOpenParallelOrbit}
      />
    );
  }

  // 资料卡更新后留下的痕迹：同样是独立渲染，不走头像+气泡布局。
  if (msg.type === 'profile_update') {
    return <ProfileTraceCard message={msg} />;
  }

  // 心情更新后留在聊天记录里的痕迹：跟戳一戳/DIY换装同理，一条居中
  // 系统提示行，纯公告，不可点击（气泡本身已经搬到 ChatHeaderBar 的
  // 大头像旁边，见 MoodBubble.jsx 顶部注释）。
  if (msg.type === 'mood_update') {
    return <MoodUpdateNotice message={msg} />;
  }

  return (
    <div
      className={`flex items-start gap-1.5 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {selectionMode && (
        <button
          type="button"
          disabled={!canReact}
          onClick={() => onToggleSelected?.(msg.id)}
          className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all disabled:opacity-25"
          style={{
            background: isSelected
              ? 'var(--accent-color)'
              : 'var(--control-soft-bg)',
            borderColor: isSelected
              ? 'var(--accent-color)'
              : 'var(--card-border)',
          }}
          aria-label={isSelected ? '取消选择这条消息' : '选择这条消息'}
        >
          {isSelected && (
            <Check
              className="h-3 w-3"
              style={{ color: 'var(--accent-foreground)' }}
            />
          )}
        </button>
      )}

      <div
        className={`group flex flex-1 flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
        onClickCapture={handleBubbleSelectClick}
      >
      {quoted && (
        <div
          className="mb-1 max-w-[75%] rounded-xl border-l-2 px-3 py-1 text-[10px] opacity-60"
          style={{
            background: 'var(--control-soft-bg)',
            borderColor: 'var(--divider)',
          }}
        >
          <span className="block font-bold">
            {quoted.sender === 'user'
              ? activeUserName
              : (character?.name || '伴侣')}
          </span>
          <p
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {quoted.content}
          </p>
        </div>
      )}

      <div
        className={`flex min-w-0 max-w-[85%] items-end gap-2 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {!isUser ? (
          <div className="relative shrink-0">
            {character?.avatar ? (
              <img
                src={character.avatar}
                alt={character.name}
                onDoubleClick={handleAvatarDoubleClick}
                onPointerDown={handleAvatarPointerDown}
                onPointerUp={handleAvatarPointerRelease}
                onPointerLeave={handleAvatarPointerRelease}
                onPointerCancel={handleAvatarPointerRelease}
                className={`h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm ${
                  isPokingAvatar ? 'poke-avatar-wiggle' : ''
                }`}
                style={{
                  borderColor: 'var(--card-border)',
                }} loading="lazy" decoding="async" />
            ) : (
              <div
                onDoubleClick={handleAvatarDoubleClick}
                onPointerDown={handleAvatarPointerDown}
                onPointerUp={handleAvatarPointerRelease}
                onPointerLeave={handleAvatarPointerRelease}
                onPointerCancel={handleAvatarPointerRelease}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isPokingAvatar ? 'poke-avatar-wiggle' : ''
                }`}
                style={{
                  background: 'var(--control-soft-bg)',
                }}
              >
                {character?.name?.[0]}
                       </div>
            )}
          </div>
        ) : activeUserAvatar ? (
          <img
            src={activeUserAvatar}
            alt={activeUserName}
            className="h-7 w-7 shrink-0 rounded-full border object-cover shadow-sm"
            style={{
              borderColor: 'var(--card-border)',
            }} loading="lazy" decoding="async" />
        ) : (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              background: 'var(--control-soft-bg)',
            }}
          >
            <User className="h-3.5 w-3.5 opacity-60" />
          </div>
        )}

        <div className="flex flex-col gap-1">
          {isErrorMsg ? (
            <div
              className="min-w-0 max-w-full space-y-2 rounded-2xl border p-3 shadow-sm chat-font"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: 'var(--text-main)',
              }}
            >
              <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-bold text-red-500">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span
                  className="min-w-0"
                  style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                >
                  API 报错: {msg.metadata?.errorCode || 'ERROR'}
                </span>
              </div>

              <p
                className="text-[11px] opacity-90"
                style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
              >
                {msg.content}
              </p>

              <button
                type="button"
                onClick={() => onReroll(msg.id)}
                className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
              >
                <RotateCw className="h-3 w-3" />
                <span>重新尝试 (Re-roll)</span>
              </button>
            </div>
                    ) : msg.type === 'interaction' ? (
            <ChatInteractionMessage
              message={msg}
              character={character}
              onResolved={onResolvedInteraction}
            />
          ) : msg.type === 'offline_invite' ? (
            <OfflineInviteCard
              message={msg}
                            onEnterScene={onEnterOfflineScene}
              onRefresh={onResolvedInteraction}
            />
                 ) : msg.type === 'companion_offer' ? (
            <CompanionOfferCard
              message={msg}
              chatId={msg.chatId}
              onAccept={() => onOpenCompanionOffer?.()}
            />
          ) : msg.type === 'companion_status_alert' ? (
            // 复用 onOpenCompanionOffer：它本来做的事就是"打开小伙伴页面"，
            // 跟这张卡片点击要跳转的地方完全一样，没必要再接一条新的 prop。
                        <CompanionStatusAlertCard
              message={msg}
              chatId={msg.chatId}
              onOpen={() => onOpenCompanionOffer?.()}
            />
                   ) : msg.type === 'bubble_css_card' ? (
            <BubbleCssCard message={msg} />
          ) : msg.type === 'confirm_card' ? (
            <ConfirmCard
              message={msg}
              onRespond={(responseText) => onRespondToConfirmCard?.(msg, responseText)}
            />
          ) : msg.type === 'call' ? (
            <CallLogEntry
              message={msg}
              isUser={isUser}
              character={character}
              userName={activeUserName}
              userAvatar={activeUserAvatar}
            />
          ) : (
                        <div
              className={`relative min-w-0 max-w-full p-3 shadow-sm transition-all chat-font ${
                isUser ? 'user-bubble' : 'ai-bubble'
              }${isFreshBubble ? ' bubble-fresh' : ''}`}
              onPointerDown={handleBubblePointerDown}
              onPointerUp={handleBubblePointerRelease}
              onPointerLeave={handleBubblePointerRelease}
              onPointerCancel={handleBubblePointerRelease}
              onContextMenu={handleBubbleContextMenu}
            >
                          <BubbleDecorationOverlay decoration={bubbleDecoration} isUser={isUser} />
              {showSpecialEffect && <specialEffectRule.Effect />}
              <SpiderEgg message={msg} />

              <ReactionPickerPopover
                open={showReactionPicker}
                isUser={isUser}
                selectedType={userReactionType}
                onPick={handlePickReaction}
                onClose={() => setShowReactionPicker(false)}
                onEnterSelect={handleEnterSelect}

                            />

              {msg.type === 'text' && (
                <>
                  {msg.metadata?.autoReply && (
                    <div className="mb-1 text-[10px] opacity-60">自动回复</div>
                  )}
                  <TextCard content={msg.content} />
                  <LearningModeTranslationToggle
                    translationText={msg.metadata?.translationText}
                  />
                </>
              )}

              {msg.type === 'image' && (
                <ImageCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'image_generated' && (
                <GeneratedImageCard
                  content={msg.content}
                  metadata={msg.metadata}
                  messageId={msg.id}
                  chatId={msg.chatId}
                  characterId={msg.characterId}
                />
              )}

                            {msg.type === 'phone_screen' && (
                <PhoneScreenCard
                  content={msg.content}
                  metadata={msg.metadata}
                  timestamp={msg.timestamp}
                  messageId={msg.id}
                />
              )}

              {msg.type === 'voice' && (
                <VoiceCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'realVoice' && (
                <RealVoiceCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'transfer' && (
                <TransferCard
                  content={msg.content}
                  metadata={msg.metadata}
                  sender={msg.sender}
                />
              )}

              {msg.type === 'article' && (
                <ArticleCard
                  content={msg.content}
                  metadata={msg.metadata}
                />
              )}

              {msg.type === 'gift' && (
                <GiftCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

              {msg.type === 'food' && (
                <FoodDeliveryCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

{msg.type === 'kinship' && (
  <KinshipCard metadata={msg.metadata} />
)}
{msg.type === 'coupon' && (
  <CouponCard metadata={msg.metadata} messageId={msg.id} isUser={isUser} />
)}
{msg.type === 'margin_note' && (
  <MarginNoteCard metadata={msg.metadata} />
)}


              
              {msg.type === 'order_request' && (
                <OrderRequestCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

              {msg.type === 'sticker' && (
                <StickerCard
                  metadata={msg.metadata}
                  isUser={isUser}
                />
              )}

{msg.type === 'location' && (
  <LocationCard
    metadata={msg.metadata}
    isUser={isUser}
  />
)}

{msg.type === 'photo' && (
  <PhotoCard
    metadata={msg.metadata}
    messageId={msg.id}
    isUser={isUser}
  />
)}


            </div>
          )}

          {/* 消息反应展示条：长按气泡弹出的选择面板见上方 ReactionPickerPopover */}
          {canReact && (
            <MessageReactions
              reactions={msg.reactions}
              isUser={isUser}
            />
          )}

                  {/* MCP 外接痕迹通用胶囊 */}
          {!isUser && messageMcpTrace && (
            <McpUsageTraceCard
              trace={messageMcpTrace}
            />
          )}

          {/* 双 API 备用：这条回复是主 API 失败后自动切到备用 API 生成的 */}
          {!isUser && msg.metadata?.usedFallbackApi && (
            <ApiFallbackHint />
          )}

          {/* 麦当劳专属卡片 */}
          {!isUser && messageOrderCard?.kind === 'mcd' && (
            <McdOrderCard
              card={messageOrderCard}
            />
          )}

          {/* Apple Watch 健康体征卡片 */}
          {!isUser && messageOrderCard?.kind === 'health' && (
            <AppleHealthCard
              card={messageOrderCard}
            />
          )}

          {/* StackChan 桌面机器人专属卡片 */}
          {!isUser && messageOrderCard?.kind === 'robot' && (
            <RobotActionCard
              card={messageOrderCard}
            />
          )}

          {/*  Apple 日历专属卡片 */}
          {!isUser && messageOrderCard?.kind === 'apple_calendar' && (
            <AppleCalendarCard
              card={messageOrderCard}
            />
          )}

          {/* 瑞幸咖啡专属卡片 */}
          {!isUser && messageOrderCard?.kind?.startsWith('luckin_') && (
            <LuckinCoffeeCard
              card={messageOrderCard}
            />
          )}

          {/* 网易云音乐专属无框动效卡片 */}
          {!isUser && messageOrderCard?.kind === 'netease_music' && (
            <NeteaseMusicCard
              card={messageOrderCard}
            />
          )}
{/* 滴滴打车专属卡片 */}
{!isUser && messageOrderCard?.kind === 'didi_ride' && (
  <DidiRideCard card={messageOrderCard} />
)}

{/* 天气与天文环境专属卡片 */}
{!isUser && messageOrderCard?.kind === 'weather' && (
  <WeatherCard card={messageOrderCard} />
)}

{/* 联网搜索专属卡片 */}
{!isUser && messageOrderCard?.kind === 'web_search' && (
  <WebSearchResultCard card={messageOrderCard} />
)}

        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {/* image_generated 类型不用这个"重新让AI写一遍回复"的通用重roll——
              它自己的"换一张"按钮在 GeneratedImageCard.jsx 卡片内部，
              重roll出的是同一个场景的新图，不是重新问一次AI。 */}
          {!isUser && msg.type !== 'image_generated' && (
            <button
              type="button"
              onClick={() => onReroll(msg.id)}
              disabled={isAiTyping}
              className="p-1 opacity-50 hover:opacity-100 disabled:opacity-20"
              title="重 roll 此回复"
            >
              <RotateCw className="h-3 w-3" />
            </button>
          )}

          {msg.type === 'photo' && msg.metadata?.blob instanceof Blob && (
            <button
              type="button"
              onClick={() => onClearPhotoMedia?.(msg.id)}
              className="p-1 opacity-50 hover:opacity-100"
              title="清除原图（保留文字记录，释放内存）"
            >
              <ImageOff className="h-3 w-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onQuote(msg)}
            className="p-1 opacity-50 hover:opacity-100"
            title="引用"
          >
            <Quote className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(msg.id)}
            className="p-1 opacity-50 hover:opacity-100"
            title="抹去"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div
        className={`mt-1 flex items-center gap-2 px-9 font-mono text-[9px] opacity-60 ${
          isUser ? 'justify-end' : 'justify-start'
        }`}
      >
        {versions.length > 1 && (
          <div
            className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5"
            style={{
              background: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            <button
              type="button"
              onClick={() => onSwitchVersion(msg, 'prev')}
              disabled={versionIndex === 0}
              className="p-0.5 hover:opacity-100 disabled:opacity-20"
              title="上一版本"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>

            <span className="px-1 text-[9px] font-bold">
              {versionIndex + 1} / {versions.length}
            </span>

            <button
              type="button"
              onClick={() => onSwitchVersion(msg, 'next')}
              disabled={versionIndex === versions.length - 1}
              className="p-0.5 hover:opacity-100 disabled:opacity-20"
              title="下一版本"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}

        <span>
          {new Date(msg.timestamp || msg.createdAt || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {isUser ? (
          <CheckCheck
            className="h-3 w-3"
            style={{
              color: 'var(--text-muted)',
            }}
          />
        ) : (
          <Check
            className="h-3 w-3"
            style={{
              color: 'var(--text-muted)',
            }}
          />
        )}
      </div>
    </div>
    </div>
  );
};

export default React.memo(MessageRow);