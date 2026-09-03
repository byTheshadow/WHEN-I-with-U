import {
  triggerCompanionshipResponse,
} from '../../../services/aiService';

import {
  createCompanionshipEvent,
} from './companionshipEventService';
import {
  createCompanionshipMcpAuthorization,
} from './companionshipPermissionService';


const getTraceCalls = (trace) => {
  if (!trace) return [];

  if (Array.isArray(trace.calls)) {
    return trace.calls;
  }

  if (Array.isArray(trace.items)) {
    return trace.items;
  }

  return [];
};

const getEventContent = (event) => (
  event?.content
  || event?.message
  || event?.text
  || ''
);

export const runCompanionshipTurn = async ({
  session,
  onEvent,
}) => {
  if (!session?.id || !session?.chatId) {
    throw new Error('陪伴会话信息不完整。');
  }

  const emit = async (event) => {
    const normalizedEvent = {
      sessionId: session.id,
      chatId: session.chatId,
      ...event,
    };

    const saved = await createCompanionshipEvent(normalizedEvent);

    onEvent?.(saved || normalizedEvent);

    return saved || normalizedEvent;
  };

 const companionshipAuthorization =
  createCompanionshipMcpAuthorization({
    sessionId: session.id,
  });

const result = await triggerCompanionshipResponse({
  session,
  companionshipAuthorization,
  onEvent: emit,
});


  if (result?.decision === 'silent') {
    await emit({
      type: 'silent',
      title: '这一刻没有打扰你',
      content: '陪伴仍在继续。',
      metadata: {
        source: 'companionship',
        decision: 'silent',
      },
    });
  }

  const traceCalls = getTraceCalls(result?.mcpTrace);

  for (const call of traceCalls) {
    await emit({
      type: 'mcp',
      title: call.toolName || call.name || 'MCP 动作',
      content: getEventContent(call) || 'MCP 动作已完成。',
      metadata: {
        source: 'companionship',
        mcpCall: call,
      },
    });
  }

  return result;
};
