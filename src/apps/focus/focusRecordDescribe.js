// src/apps/focus/focusRecordDescribe.js
//
// 聊天里的"专注记录"消息（type: 'focus_record'）的文字描述。纯函数，不碰数据库，
// aiService.js、聊天气泡、导出都从这里取文案，避免循环依赖（和 harpDescribe.js 同一个做法）。
//
// metadata 形状：
//   { source: 'focus', sessionId, status: 'completed' | 'abandoned', early: boolean,
//     task, place, plannedMinutes, actualMinutes, reason }

const cleanText = (value, max = 60) => String(value || '').trim().slice(0, max);

const toMinutes = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const buildFocusRecordMeta = (session) => {
  const planned = toMinutes(session?.durationMinutes);
  const actual = toMinutes(session?.actualMinutes);
  const abandoned = session?.status === 'abandoned';

  return {
    source: 'focus',
    sessionId: session?.id ?? null,
    status: abandoned ? 'abandoned' : 'completed',
    early: !abandoned && planned > 0 && actual < planned,
    task: cleanText(session?.task),
    place: cleanText(session?.place, 12),
    plannedMinutes: planned,
    actualMinutes: actual,
    reason: cleanText(session?.abandonReason, 80),
  };
};

// 给人看的一行字：聊天里的居中小药丸、导出都用它。
export const describeFocusRecordForUser = (meta) => {
  const m = meta || {};
  const what = m.task ? `专注「${m.task}」` : '一次专注';
  const where = m.place ? `，在${m.place}` : '';

  if (m.status === 'abandoned') {
    return `中途放弃了${what}${where}，专注了 ${toMinutes(m.actualMinutes)} 分钟`;
  }
  if (m.early) {
    return `提前结束了${what}${where}，专注了 ${toMinutes(m.actualMinutes)} 分钟（原计划 ${toMinutes(m.plannedMinutes)} 分钟）`;
  }
  return `完成了${what}${where}，共 ${toMinutes(m.actualMinutes)} 分钟`;
};

// 给角色看的一句话：进入系统提示词的聊天记录里，让下一次回复知道发生了什么。
export const describeFocusRecordForPrompt = (msg) => {
  const m = msg?.metadata || {};
  const what = m.task ? `「${m.task}」` : '一件事';
  const where = m.place ? `，地点是${m.place}` : '';

  if (m.status === 'abandoned') {
    const reason = m.reason ? `；TA留下的原因是：${m.reason}` : '';
    return `[用户刚才开了一段专注去做${what}${where}，中途自己放弃了，实际专注了 ${toMinutes(m.actualMinutes)} 分钟（原计划 ${toMinutes(m.plannedMinutes)} 分钟）${reason}。这段时间你按约定没有打扰TA。不用追问原因，也不要责备或失落，自然地接上就好]`;
  }
  if (m.early) {
    return `[用户刚才专注去做${what}${where}，提前结束了，实际专注了 ${toMinutes(m.actualMinutes)} 分钟（原计划 ${toMinutes(m.plannedMinutes)} 分钟）。这段时间你按约定没有打扰TA]`;
  }
  return `[用户刚才专注完成了${what}${where}，一共 ${toMinutes(m.actualMinutes)} 分钟。这段时间你按约定没有打扰TA]`;
};
