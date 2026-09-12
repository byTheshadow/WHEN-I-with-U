// src/services/mcp/mcpOrderCardService.js

const listeners = new Set();

const nowIso = () => new Date().toISOString();

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `mcp_card_${crypto.randomUUID()}`;
  }
  return `mcp_card_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

/**
 * 麦当劳官方 MCP 工具结果解析器
 * 适配官方工具：create-order, query-order, query-nearby-stores
 */
const parseMcdonaldResult = (toolName, toolResult) => {
  const data = toolResult?.structuredContent || toolResult?.data || toolResult;
  if (!data) return null;

  const tName = (toolName || '').toLowerCase();

  // 1. 附近餐厅 / 选择餐厅
  if (tName.includes('store')) {
    const stores = Array.isArray(data) ? data : (data.stores || []);
    return {
      kind: 'mcd-store',
      phase: 'store_select',
      stores: stores.slice(0, 3).map(s => ({
        name: s.storeName || s.name || '麦当劳餐厅',
        address: s.address || s.fullAddress || '',
        businessHours: s.businessStartTime ? `${s.businessStartTime}-${s.businessEndTime}` : '营业中',
      })),
    };
  }

  // 2. 创建订单 (create-order)
  if (tName.includes('create') || tName.includes('order') && !tName.includes('query')) {
    const items = Array.isArray(data.items)
      ? data.items.map(it => ({
          name: it.name || it.productName || it.itemName || '餐品',
          qty: Number(it.qty || it.quantity || 1),
          price: Number(it.price || 0),
        }))
      : [];

    return {
      kind: 'mcd-order',
      phase: 'created', // 下单成功，等待接单/支付
      orderNo: data.orderNo || data.orderId || data.order_id || '',
      store: data.storeName || data.store || '',
      total: Number(data.total || data.totalPrice || data.amount || 0),
      items,
      pickupCode: data.pickupCode || data.takeCode || null,
      payUrl: data.payUrl || data.paymentUrl || null,
    };
  }

  // 3. 查询订单进度 (query-order) -> 制作中 / 待取餐 / 已完成 / 已取消
  if (tName.includes('query') && tName.includes('order')) {
    const rawStatus = String(data.orderStatus || data.status || '').toUpperCase();
    let phase = 'cooking'; // 默认状态：制作中

    if (rawStatus.includes('CANCEL')) {
      phase = 'cancelled';
    } else if (rawStatus.includes('COMPLETE') || rawStatus.includes('FINISH')) {
      phase = 'completed';
    } else if (rawStatus.includes('READY') || rawStatus.includes('PICK') || data.pickupCode) {
      phase = 'ready'; // 可取餐
    }

    const items = Array.isArray(data.items)
      ? data.items.map(it => ({
          name: it.name || it.productName || '餐品',
          qty: Number(it.qty || it.quantity || 1),
          price: Number(it.price || 0),
        }))
      : [];

    return {
      kind: 'mcd-order',
      phase, // 'cooking' | 'ready' | 'completed' | 'cancelled'
      orderNo: data.orderNo || data.orderId || '',
      store: data.storeName || data.store || '',
      pickupCode: data.pickupCode || data.takeCode || '—',
      pickupMinutes: Number(data.pickupMinutes || data.eta || 0) || null,
      total: Number(data.total || data.totalPrice || 0),
      items,
    };
  }

  return null;
};

// 白名单匹配规则：未来扩展星巴克、瑞幸等只需在此添加规则
const CARD_MATCHERS = [
  {
    test: (toolName = '') => /mcd|mcdonald|麦当劳/i.test(toolName) || /(create-order|query-order|query-nearby-stores)/i.test(toolName),
    parse: parseMcdonaldResult,
  },
];

const notify = (event) => {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      console.warn('[MCP Card] 事件派发异常:', e);
    }
  });
};

const cloneSession = (session) => {
  if (!session) return null;
  return {
    version: 1,
    used: session.cards.length > 0,
    cards: session.cards.map((c) => ({ ...c })),
  };
};

export const createOrderCardSession = ({ chatId = null, characterId = null } = {}) => ({
  id: createId(),
  chatId: chatId != null ? String(chatId) : null,
  characterId: characterId != null ? String(characterId) : null,
  cards: [],
  createdAt: nowIso(),
});

export const startOrderCard = ({ session, tool }) => {
  if (!session || !tool) return null;

  const toolName = tool.toolName || '';
  const matcher = CARD_MATCHERS.find((m) => m.test(toolName));
  if (!matcher) return null;

  const card = {
    id: createId(),
    toolName,
    status: 'pending',
    result: null,
    error: null,
    startedAt: nowIso(),
  };

  session.cards.push(card);

  notify({
    type: 'MCP_ORDER_CARD_UPDATED',
    chatId: session.chatId,
    characterId: session.characterId,
    orderCard: cloneSession(session),
  });

  return card.id;
};

export const finishOrderCard = ({ session, cardId, status, toolResult = null, errorMessage = '' }) => {
  if (!session || !cardId) return;

  const card = session.cards.find((c) => c.id === cardId);
  if (!card) return;

  card.completedAt = nowIso();

  if (status === 'success' && toolResult) {
    const matcher = CARD_MATCHERS.find((m) => m.test(card.toolName));
    const parsed = matcher ? matcher.parse(card.toolName, toolResult) : null;

    if (parsed) {
      card.status = 'success';
      card.result = parsed;
    } else {
      card.status = 'error';
      card.error = { message: '信息解析不完整' };
    }
  } else {
    card.status = 'error';
    card.error = { message: errorMessage || '操作未成功' };
  }

  notify({
    type: 'MCP_ORDER_CARD_UPDATED',
    chatId: session.chatId,
    characterId: session.characterId,
    orderCard: cloneSession(session),
  });
};

export const subscribeMcpOrderCardEvents = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getOrderCardSummary = (session) => {
  const summary = cloneSession(session);
  if (!summary || !summary.used) return null;
  return summary;
};
