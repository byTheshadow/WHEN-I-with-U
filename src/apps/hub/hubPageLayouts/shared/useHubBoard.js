// src/apps/hub/hubPageLayouts/shared/useHubBoard.js
//
// 留言板（db.homeBoard）的只读订阅：最新一条、未读数量、总数，加上
// 「标为已读 / 未读」。数据和 QuickBoard 是同一张表，所以在任何版式里
// 标记已读，其他版式和经典首页都会同步。用 Dexie liveQuery 订阅，AI 新发
// 来的留言写入后这里会自动刷新。

import { useCallback, useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import db from '../../../../db';

const EMPTY_BOARD = { newest: null, latestUnread: null, unreadCount: 0, total: 0 };

// newest        最新一条（不管读没读过）
// latestUnread  最新的一条未读（没有未读时是 null）
// unreadCount   未读总数
// total         留言总数
const loadBoard = async () => {
  const [newest, latestUnread, unreadCount, total] = await Promise.all([
    db.homeBoard.orderBy('timestamp').last(),
    db.homeBoard
      .orderBy('timestamp')
      .reverse()
      .filter((message) => !message.isRead)
      .first(),
    db.homeBoard.filter((message) => !message.isRead).count(),
    db.homeBoard.count(),
  ]);
  return {
    newest: newest || null,
    latestUnread: latestUnread || null,
    unreadCount,
    total,
  };
};

export const formatBoardTime = (timestamp) => {
  if (!timestamp) return '刚刚';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const useHubBoard = () => {
  const [board, setBoard] = useState(EMPTY_BOARD);

  useEffect(() => {
    const subscription = liveQuery(loadBoard).subscribe({
      next: (next) => setBoard(next || EMPTY_BOARD),
      error: (error) => {
        console.warn('[HubBoard] 读取留言板失败：', error);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setRead = useCallback(async (id, isRead) => {
    if (id === undefined || id === null) return;
    try {
      await db.homeBoard.update(id, { isRead: Boolean(isRead) });
    } catch (error) {
      console.warn('[HubBoard] 更新已读状态失败：', error);
    }
  }, []);

  return { ...board, setRead };
};

export default useHubBoard;
