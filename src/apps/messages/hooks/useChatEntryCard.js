import { useCallback, useEffect, useState } from 'react';

import db from '../../../db';
import {
  getTodayFestival,
  getGreetingPeriod,
  getGreetingCardContent,
  getLocalDateKey,
  matchGreetingKeyword,
  matchThanksKeyword,
  getThanksCardContent,
} from '../../../services/festivalService';

// 判断"这个聊天窗要不要弹一张节日/问候卡"，并负责去重——同一个聊天窗、
// 同一天、同一种卡片只弹一次。记录存在 chat.lastEntryCardShown 里
// （Dexie 的非索引字段，加它不需要升级数据库版本），每个聊天窗各自
// 独立判断，互不影响。
//
// 2026-10 改动：节日卡（万圣节这类按日期触发的）还是"进聊天窗就判断
// 一次"；早安/晚安改成了"发消息触发"——不再是打开聊天窗就固定出现，
// 而是用户发的消息里带了"早安""晚安"这类问候语、且当下真的在对应的
// 时段内，才会弹卡。两条判断逻辑分开，彼此不影响对方的去重状态
// （common 用的是 kind 字段区分，festival:xxx 跟 greeting:xxx 各自
// 独立占一天一次的名额）。
export default function useChatEntryCard(chat) {
  const [entryCard, setEntryCard] = useState(null);

  // 节日卡：维持原来的"进聊天窗判断一次"。
  useEffect(() => {
    if (!chat?.id) return;

    const festival = getTodayFestival();

    if (!festival) return;

    const todayKey = getLocalDateKey();
    const nextCard = {
      kind: `festival:${festival.key}`,
      title: festival.title,
      subtitle: festival.subtitle,
      accent: festival.accent,
    };

    const lastShown = chat.lastEntryCardShown;
    const alreadyShownToday = (
      lastShown
      && lastShown.date === todayKey
      && lastShown.kind === nextCard.kind
    );

    if (alreadyShownToday) return;

    setEntryCard(nextCard);

    void db.chats.update(chat.id, {
      lastEntryCardShown: { date: todayKey, kind: nextCard.kind },
    });

    // 只在切换到某个聊天窗时判断一次，不跟着 chat 对象其它字段的变化
    // （比如消息列表刷新）反复重新判断。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  // 早安/晚安：由 ChatRoom.jsx 在用户发出一条文字消息时调用，
  // 不在这里自动判断、不跟着 chat?.id 的 effect 走。
  const triggerGreetingFromMessage = useCallback((text) => {
    if (!chat?.id) return;

    const matchedPeriod = matchGreetingKeyword(text);

    if (!matchedPeriod) return;

    // 时段限制：这句话得长得像"早安"，而且现在真的是对应的时段，
    // 两条都满足才弹卡——下午发"早安"开玩笑不会触发。
    if (getGreetingPeriod() !== matchedPeriod) return;

    const content = getGreetingCardContent(matchedPeriod);

    if (!content) return;

    const todayKey = getLocalDateKey();
    const nextCard = {
      kind: `greeting:${matchedPeriod}`,
      title: content.title,
      subtitle: content.subtitle,
      accent: content.accent,
    };

    const lastShown = chat.lastEntryCardShown;
    const alreadyShownToday = (
      lastShown
      && lastShown.date === todayKey
      && lastShown.kind === nextCard.kind
    );

    // 同一天同一种问候只弹一次，避免用户反复发"早安"刷卡。
    if (alreadyShownToday) return;

    setEntryCard(nextCard);

    void db.chats.update(chat.id, {
      lastEntryCardShown: { date: todayKey, kind: nextCard.kind },
    });
  }, [chat]);

  // 感恩节"谢谢"彩蛋：十一月限定，用户或角色的文字消息里出现"谢谢"
  // 或感恩节相关词语就弹一张纯视觉小卡片（不带 AI 现写的文案）。跟
  // 早安/晚安共用同一套"关键词命中就弹卡 + 每天每种卡片只弹一次"去重
  // 逻辑，但没有早安/晚安那样的时段限制。ChatRoom.jsx 在用户发文字
  // 消息、以及监测到角色发来新文字消息时都会调用这个函数——两边谁说
  // 都算（跟早安/晚安只认用户自己说的不一样）。
  const triggerThanksFromMessage = useCallback((text) => {
    if (!chat?.id) return;

    if (!matchThanksKeyword(text)) return;

    const content = getThanksCardContent();

    if (!content) return;

    const todayKey = getLocalDateKey();
    const nextCard = {
      kind: 'thanks:keyword',
      title: content.title,
      subtitle: content.subtitle,
      accent: content.accent,
    };

    const lastShown = chat.lastEntryCardShown;
    const alreadyShownToday = (
      lastShown
      && lastShown.date === todayKey
      && lastShown.kind === nextCard.kind
    );

    // 同一天只弹一次，避免反复说谢谢刷屏——想改成每次说谢谢都弹，
    // 把这段去重判断删掉就行。
    if (alreadyShownToday) return;

    setEntryCard(nextCard);

    void db.chats.update(chat.id, {
      lastEntryCardShown: { date: todayKey, kind: nextCard.kind },
    });
  }, [chat]);

  const dismissEntryCard = useCallback(() => {
    setEntryCard(null);
  }, []);

  return {
    entryCard,
    dismissEntryCard,
    triggerGreetingFromMessage,
    triggerThanksFromMessage,
  };
}