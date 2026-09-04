import db from '../../db';

const getNowIso = () => new Date().toISOString();

export const getScheduledMessageArchive = async (chatId) => {
  if (!chatId) {
    return [];
  }

  const records = await db.scheduledMessages
    .where('chatId')
    .equals(chatId)
    .toArray();

  return records.sort((left, right) => {
    const leftTime = new Date(
      left.scheduledFor || left.createdAt || 0
    ).getTime();

    const rightTime = new Date(
      right.scheduledFor || right.createdAt || 0
    ).getTime();

    return rightTime - leftTime;
  });
};

export const deleteScheduledMessageArchiveItem = async (id) => {
  if (!id) {
    return false;
  }

  await db.scheduledMessages.delete(id);
  return true;
};

export const deleteScheduledMessageArchive = async (chatId) => {
  if (!chatId) {
    return 0;
  }

  return db.scheduledMessages
    .where('chatId')
    .equals(chatId)
    .delete();
};

/**
 * 将失败或已取消的预约重新放回待处理状态。
 *
 * 已发送和正在处理的记录不能被手动重试，
 * 避免重复发送或干扰当前执行流程。
 */
export const retryScheduledMessageArchiveItem = async (
  id
) => {
  if (!id) {
    return false;
  }

  const record = await db.scheduledMessages.get(id);

  if (!record) {
    return false;
  }

  if (
    record.status !== 'failed' &&
    record.status !== 'cancelled'
  ) {
    return false;
  }

  await db.scheduledMessages.update(id, {
    status: 'pending',
    attemptCount: 0,
    cancelledReason: '',
    sentMessageId: null,
    updatedAt: getNowIso()
  });

  return true;
};

export const getScheduledMessageDisplayState = (record) => {
  if (!record) {
    return {
      label: '未知状态',
      tone: 'muted'
    };
  }

  switch (record.status) {
    case 'pending':
      return {
        label: '等待抵达',
        tone: 'pending'
      };

    case 'processing':
      return {
        label: '正在写下',
        tone: 'processing'
      };

    case 'sent':
      return {
        label: '已经抵达',
        tone: 'sent'
      };

    case 'cancelled':
      return {
        label: '已收回',
        tone: 'cancelled'
      };

    case 'failed':
      return {
        label: '未能抵达',
        tone: 'failed'
      };

    default:
      return {
        label: '未知状态',
        tone: 'muted'
      };
  }
};

export const formatScheduledMessageDate = (value) => {
  if (!value) {
    return '时间未记下';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '时间未记下';
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getScheduledMessageTypeLabel = (record) => {
  const type = record?.scheduleType || 'follow_up';

  return type === 'reminder'
    ? '约定提醒'
    : '情境回访';
};

export const getScheduledMessageCancelLabel = (record) => {
  const policy = record?.cancelPolicy || 'cancel_if_user_replies';

  return policy === 'keep'
    ? '不会因再次聊天取消'
    : '用户回来后可自然收回';
};

export const markScheduledMessageArchiveUpdated = async (
  id
) => {
  if (!id) {
    return;
  }

  await db.scheduledMessages.update(id, {
    updatedAt: getNowIso()
  });
};
