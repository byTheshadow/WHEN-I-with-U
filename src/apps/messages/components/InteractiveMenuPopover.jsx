import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Gift,
  Utensils,
  CreditCard,
  X,
  Smile,
  CircleDot,
  Box,
  Swords,
  ShoppingBag,
  Hand,
  Scroll,
  HelpCircle,
  Ticket,
    Flame,
  Moon,
  Ghost,
  Pencil,
} from 'lucide-react';
import { isHalloweenSeasonActive } from '../interactions/halloween/halloweenSeason';
import {
  ORDER_ENTRY_STATES,
  getOrderEntryState,
} from '../order/orderRequestService';
import { triggerGlobalToast } from '../../../components/NotificationToast';

// 面板从"一条竖着滚的长列表"改成"按分类分页、可左右滑动切换"的结构。
// 原来的四组（心意互动 / 轻互动 / 桌面游戏 / 情侣小游戏）现在变成四个
// 独立的滑动页，顶部一排标签可以点，面板本身也支持左右滑动翻页，
// 这样每一页的按钮数量都不多，不用再竖着滚很长一截。
// 每一页按钮数量不一样，用一个统一的固定高度（按最多按钮数的那一页算）
// 撑住，切页时面板高度不会跳动。
const ROWS_TALL = 4; // 当前最长的一页（心意互动 / 情侣小游戏）有 4 个按钮
const ROW_HEIGHT_PX = 34; // 单个按钮行大致高度（含间距）

export const InteractiveMenuPopover = ({ onSelectAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const menuRef = useRef(null);
  const scrollerRef = useRef(null);
  const isProgrammaticScroll = useRef(false);

  // "帮我点单"入口的状态：
  // hidden 不显示 / ready 可用 / needs-setup 已同步过点单工具但暂时不能用
  const [orderEntry, setOrderEntry] = useState({
    state: ORDER_ENTRY_STATES.HIDDEN,
  });

  useEffect(() => {
    let cancelled = false;

    getOrderEntryState().then((value) => {
      if (!cancelled) setOrderEntry(value);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const isOrderReady = orderEntry.state === ORDER_ENTRY_STATES.READY;

  // 点击外部自动收起 Popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (type) => {
    setIsOpen(false);
    onSelectAction(type);
  };

  // 四个分类页，按钮内容和原来完全一样，只是被分到各自的页里。
  // Halloween 彩蛋按钮、点单按钮仍然按原来的条件显示/隐藏。
  const tabs = useMemo(() => {
    const list = [
      {
        key: 'heartfelt',
        label: '心意互动',
        buttons: [
          { type: 'sticker', icon: Smile, text: '表情包' },
          { type: 'gift', icon: Gift, text: '赠送礼物' },
          { type: 'food', icon: Utensils, text: '外卖代点' },
          orderEntry.state !== ORDER_ENTRY_STATES.HIDDEN
            ? {
                type: 'mcp_order',
                icon: ShoppingBag,
                text: '帮我点单',
                disabled: !isOrderReady,
                disabledLabel: '未就绪',
                onDisabledClick: () => {
                  setIsOpen(false);
                  triggerGlobalToast({
                    title: orderEntry.title,
                    content: orderEntry.message,
                    duration: 6000,
                  });
                },
              }
            : null,
          { type: 'kinship', icon: CreditCard, text: '开通亲属卡' },
        ].filter(Boolean),
      },
      {
        key: 'light',
        label: '轻互动',
        buttons: [
          { type: 'interaction_poke', icon: Hand, text: '戳一戳' },
          isHalloweenSeasonActive()
            ? { type: 'interaction_trick', icon: Ghost, text: '恶作剧' }
            : null,
        ].filter(Boolean),
      },
      {
        key: 'desktop',
        label: '桌面游戏',
        buttons: [
          { type: 'interaction_coin', icon: CircleDot, text: '抛旧硬币' },
          { type: 'interaction_dice', icon: Box, text: '掷六面骰' },
                  { type: 'interaction_rps', icon: Swords, text: '猜拳' },
          { type: 'interaction_draw_guess', icon: Pencil, text: '你画我猜' },
        ],
      },
      {
        key: 'couple',
        label: '情侣小游戏',
        buttons: [
          { type: 'interaction_lottery', icon: Scroll, text: '抽签筒' },
          { type: 'interaction_intimacy_qa', icon: HelpCircle, text: '亲密问答卡' },
          { type: 'interaction_truth_or_dare', icon: Flame, text: '真心话大冒险' },
          { type: 'interaction_divination', icon: Moon, text: '占卜' },
          { type: 'interaction_coupon', icon: Ticket, text: '和好券' },
        ],
      },
    ];

    return list;
  }, [orderEntry, isOrderReady]);

  const panelHeightPx = ROWS_TALL * ROW_HEIGHT_PX;

  const handleScroll = () => {
    if (isProgrammaticScroll.current) return;

    const node = scrollerRef.current;
    if (!node || node.clientWidth === 0) return;

    const index = Math.round(node.scrollLeft / node.clientWidth);
    setActiveTab((previous) => (previous === index ? previous : index));
  };

  const goToTab = (index) => {
    const node = scrollerRef.current;
    if (!node) return;

    isProgrammaticScroll.current = true;
    node.scrollTo({ left: index * node.clientWidth, behavior: 'smooth' });
    setActiveTab(index);

    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 400);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* 底部悬浮输入栏上的唯一新入口按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        data-open={isOpen ? 'true' : 'false'}
        className="chat-input-sparkle-btn rounded-full p-2 transition-all active:scale-90 flex items-center justify-center"
        style={{
          background: isOpen ? 'var(--accent-color)' : 'var(--control-soft-bg)',
          color: isOpen ? 'var(--accent-foreground)' : 'var(--text-main)',
        }}
        aria-label="心意互动菜单"
        aria-expanded={isOpen}
        title="心意互动菜单"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      {/* 向上平滑展开的子菜单：标签页 + 可左右滑动的分类内容 */}
      {isOpen && (
        <div
          className="absolute bottom-12 left-0 mb-1 w-56 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            borderWidth: '1px',
            borderStyle: 'solid',
            color: 'var(--text-main)',
          }}
        >
          <div
            className="flex items-center justify-between px-1 py-1 mb-1 text-[10px] font-semibold opacity-60"
          >
            <span>心意互动</span>
            <button type="button" aria-label="关闭心意互动菜单" onClick={() => setIsOpen(false)}>
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* 标签栏：点击直接跳页，当前页高亮 */}
          <div
            className="hide-scrollbar mb-2 flex gap-1 overflow-x-auto border-b pb-2"
            style={{ borderColor: 'var(--card-border)', scrollbarWidth: 'none' }}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => goToTab(index)}
                className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors"
                style={{
                  backgroundColor:
                    activeTab === index
                      ? 'var(--accent-color)'
                      : 'var(--control-soft-bg)',
                  color:
                    activeTab === index
                      ? 'var(--accent-foreground)'
                      : 'var(--text-main)',
                  opacity: activeTab === index ? 1 : 0.75,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 横向滑动的分类内容区：每一页是一个分类的按钮竖排列表 */}
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {tabs.map((tab) => (
              <div
                key={tab.key}
                className="flex w-full shrink-0 snap-start flex-col gap-1"
                style={{ height: `${panelHeightPx}px` }}
              >
                {tab.buttons.map((button) => (
                  <button
                    key={button.type}
                    type="button"
                    onClick={() => {
                      if (button.disabled) {
                        button.onDisabledClick?.();
                        return;
                      }
                      handleAction(button.type);
                    }}
                    aria-disabled={button.disabled || undefined}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-85"
                    style={{
                      backgroundColor: 'var(--control-soft-bg)',
                      opacity: button.disabled ? 0.55 : 1,
                    }}
                  >
                    <button.icon className="h-3.5 w-3.5" />
                    <span>{button.text}</span>
                    {button.disabled && (
                      <span className="ml-auto text-[9px] opacity-70">
                        {button.disabledLabel}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* 页码圆点，跟首页 app 区的翻页提示用同一套视觉语言 */}
          {tabs.length > 1 && (
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {tabs.map((tab, index) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-label={`切到${tab.label}`}
                  onClick={() => goToTab(index)}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: activeTab === index ? '1.1rem' : '0.4rem',
                    height: '0.4rem',
                    backgroundColor:
                      activeTab === index
                        ? 'var(--text-main)'
                        : 'var(--card-border)',
                    opacity: activeTab === index ? 0.7 : 0.5,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InteractiveMenuPopover;