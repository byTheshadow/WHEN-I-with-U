// src/services/mcp/mcpCardRegistry.js
//
// MCP 富动作卡片解析中心
// 负责在工具执行完毕时，将真实返回提取为 UI 渲染用的结构化卡片数据

import { parseHealthMarkdown } from './healthCardParser';

const parseToolRawData = (toolResult) => {
  if (!toolResult) return null;
  if (toolResult.structuredContent) return toolResult.structuredContent;
  if (toolResult.data) return toolResult.data;
  if (Array.isArray(toolResult.content)) {
    for (const part of toolResult.content) {
      if (part.type === 'text') {
        try {
          const parsed = JSON.parse(part.text);
          return parsed.data || parsed;
        } catch {
          // 不是 JSON 文本，忽略
        }
      }
    }
  }
  if (typeof toolResult === 'string') {
    try {
      const cleaned = toolResult.replace(/^```json\s*|\s*```$/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return toolResult;
    }
  }
  return toolResult;
};

// 苹果日历专用解析器（适配 list_calendars / search_events / create_event / update_event / delete_event）
const parseAppleCalendarCard = (toolName, toolResult) => {
  const data = parseToolRawData(toolResult);
  if (!data) return null;

  // 1. 搜索与查询事件 (search_events)
  if (/search_events/i.test(toolName)) {
    const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
    return {
      kind: 'apple_calendar',
      action: 'search',
      total: Number(data.total ?? events.length),
      events: events.map((ev) => ({
        id: ev.id || String(Math.random()),
        title: ev.title || '无标题日程',
        startTime: ev.startTime || null,
        endTime: ev.endTime || null,
        location: ev.location || '',
        description: ev.description || '',
        timezone: ev.timezone || 'Asia/Shanghai',
        attendeesCount: Array.isArray(ev.attendees) ? ev.attendees.length : 0,
      })),
    };
  }

  // 2. 创建新日程 (create_event)
  if (/create_event/i.test(toolName)) {
    if (data.success === false) return null;
    return {
      kind: 'apple_calendar',
      action: 'create',
      eventId: data.eventId || null,
      message: data.message || '已成功添加到日历',
      event: {
        title: data.title || (data.message ? data.message.replace(/^Event\s*['"]?|['"]?\s*created successfully$/gi, '') : '新日程'),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        location: data.location || '',
        description: data.description || '',
      },
    };
  }

  // 3. 更新日程 (update_event)
  if (/update_event/i.test(toolName)) {
    if (data.success === false) return null;
    return {
      kind: 'apple_calendar',
      action: 'update',
      eventId: data.eventId || null,
      message: data.message || '日程已更新',
      event: {
        title: data.title || '日程已修改',
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        location: data.location || '',
      },
    };
  }

  // 4. 删除日程 (delete_event)
  if (/delete_event/i.test(toolName)) {
    if (data.success === false) return null;
    return {
      kind: 'apple_calendar',
      action: 'delete',
      eventId: data.eventId || null,
      message: data.message || '日程已移除',
    };
  }

  // 5. 列出日历列表 (list_calendars)
  if (/list_calendars/i.test(toolName)) {
    const calendars = Array.isArray(data.calendars) ? data.calendars : (Array.isArray(data) ? data : []);
    return {
      kind: 'apple_calendar',
      action: 'list',
      calendars: calendars.map((c) => ({
        name: c.name || '日历',
        color: c.color || '#FF3B30',
        description: c.description || '',
        path: c.path || '',
      })),
    };
  }

  return null;
};

// 麦当劳专用解析器（对照 M-China/mcd-mcp-server 官方规范）
const parseMcdonaldsCard = (toolName, toolResult) => {
  const data = parseToolRawData(toolResult);
  if (!data) return null;

  // 1. 附近门店查询 (query-nearby-stores / delivery-query-stores)
  if (/query-.*stores?/i.test(toolName)) {
    const stores = Array.isArray(data) ? data : (data.stores || []);
    if (stores.length === 0) return null;
    return {
      kind: 'mcd',
      phase: 'store_list',
      stores: stores.slice(0, 3).map((s) => ({
        name: s.storeName || s.name,
        address: s.address || s.fullAddress,
        distance: s.distance ? `${s.distance}m` : null,
        status: s.businessStatus ? '营业中' : '休息中',
      })),
    };
  }

  // 2. 下单创建 (create-order)
  if (/create-?order/i.test(toolName)) {
    return {
      kind: 'mcd',
      phase: 'order_created',
      orderNo: data.orderNo || data.orderId || data.order_id,
      storeName: data.storeName || data.store || '麦当劳餐厅',
      total: Number(data.totalAmount || data.total || data.amount || 0),
      items: Array.isArray(data.items) ? data.items.map((it) => ({
        name: it.productName || it.name || it.itemName,
        qty: Number(it.quantity || it.qty || 1),
        price: Number(it.price ?? 0),
      })) : [],
      pickupType: data.beType === 2 ? '麦乐送外送' : '到店取餐',
      payUrl: data.payUrl || data.paymentUrl || null,
    };
  }

  // 3. 订单状态查询 (query-order)
  if (/query-?order/i.test(toolName)) {
    const rawStatus = String(data.orderStatus || data.status || '').toUpperCase();
    let phase = 'cooking';
    if (rawStatus.includes('CANCEL')) phase = 'cancelled';
    else if (rawStatus.includes('PICKUP') || rawStatus.includes('WAIT')) phase = 'ready';
    else if (rawStatus.includes('COMPLETE')) phase = 'completed';

    return {
      kind: 'mcd',
      phase,
      orderNo: data.orderNo || data.orderId || '',
      pickupCode: data.takeCode || data.pickupCode || data.pickupNo || '',
      storeName: data.storeName || data.store || '麦当劳餐厅',
      etaMinutes: Number(data.estimatedMinutes || data.pickupMinutes || 0) || null,
      items: Array.isArray(data.items) ? data.items.map((it) => ({
        name: it.productName || it.name,
        qty: Number(it.quantity || it.qty || 1),
      })) : [],
    };
  }

  return null;
};

// 全局卡片提取入口
export const extractMcpCard = (toolName = '', toolResult = null) => {
  if (!toolName || !toolResult) return null;

  // 1. 苹果日历匹配
  if (/calendar|search_events|create_event|update_event|delete_event/i.test(toolName)) {
    const calendarCard = parseAppleCalendarCard(toolName, toolResult);
    if (calendarCard) return calendarCard;
  }

  // 2. 健康工具匹配
  if (/health|watch|apple_health/i.test(toolName)) {
    const rawText = toolResult?.content?.[0]?.text || (typeof toolResult === 'string' ? toolResult : '');
    const healthCard = parseHealthMarkdown(rawText);
    if (healthCard) return healthCard;
  }

  // 3. 麦当劳匹配
  if (/mcd|mcdonald|store|order|meal/i.test(toolName)) {
    const card = parseMcdonaldsCard(toolName, toolResult);
    if (card) return card;
  }

  return null;
};
