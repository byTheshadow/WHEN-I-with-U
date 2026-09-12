// src/services/mcp/mcpCardRegistry.js
//
// MCP 富动作卡片解析中心
// 负责在工具执行完毕时，将真实返回提取为 UI 渲染用的结构化卡片数据

const parseToolRawData = (toolResult) => {
  if (!toolResult) return null;
  // MCP 的返回值可能是 structuredContent，也可能是 text 里的 JSON
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
  return toolResult;
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
    // 官方状态：PAID 已付待制, COOKING 制作中, WAITING_PICKUP 待取餐, COMPLETED 已完成, CANCELLED 已取消
    const rawStatus = String(data.orderStatus || data.status || '').toUpperCase();
    let phase = 'cooking';
    if (rawStatus.includes('CANCEL')) phase = 'cancelled';
    else if (rawStatus.includes('PICKUP') || rawStatus.includes('WAIT')) phase = 'ready';
    else if (rawStatus.includes('COMPLETE')) phase = 'completed';

    return {
      kind: 'mcd',
      phase, // 'cooking' | 'ready' | 'completed' | 'cancelled'
      orderNo: data.orderNo || data.orderId || '',
      pickupCode: data.takeCode || data.pickupCode || data.pickupNo || '', // 取餐叫号，如 A-082
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

  // 麦当劳相关工具匹配
  if (/mcd|mcdonald|store|order|meal/i.test(toolName)) {
    const card = parseMcdonaldsCard(toolName, toolResult);
    if (card) return card;
  }

  // 未来需要支持星巴克、打车等其他 MCP 时，直接在下面追加 else if 即可
  return null;
};
