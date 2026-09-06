import React from 'react';

import TypingIndicator from './TypingIndicator';
import McpToolUsageIndicator from './McpToolUsageIndicator';
import MessageRow from './MessageRow';

const MessageList = ({
  visibleMessages,
  messagesById,
  character,
  activeUserAvatar,
  activeUserName,
  isAiTyping,
  mcpTrace,
  typingText,
  typingStyle,
  hasMoreOlderMessages,
  onReroll,
  onDelete,
  onQuote,
  onSwitchVersion,
  onResolvedInteraction,
}) => (
  <div className="space-y-4 pb-2">
    {visibleMessages.length === 0 && (
      <div className="space-y-2 py-16 text-center opacity-40">
        <p className="font-serif text-xs italic">
          此刻停在这里，等待你们的对话...
        </p>
      </div>
    )}

    {hasMoreOlderMessages && visibleMessages.length > 0 && (
      <div className="py-2 text-center text-[10px] opacity-40">
        向上滚动加载更早的消息...
      </div>
    )}

    {visibleMessages.map((msg) => {
      const quoted = msg.quotedMessageId
        ? messagesById.get(msg.quotedMessageId)
        : null;

      return (
        <MessageRow
          key={msg.id}
          msg={msg}
          quoted={quoted}
          character={character}
          activeUserAvatar={activeUserAvatar}
          activeUserName={activeUserName}
          isAiTyping={isAiTyping}
          onReroll={onReroll}
          onDelete={onDelete}
          onQuote={onQuote}
          onSwitchVersion={onSwitchVersion}
          onResolvedInteraction={onResolvedInteraction}
        />
      );
    })}

    {isAiTyping && (
      <>
        {mcpTrace && (
          <McpToolUsageIndicator
            trace={mcpTrace}
          />
        )}

        <TypingIndicator
          customText={typingText}
          styleType={typingStyle}
        />
      </>
    )}
  </div>
);

export default React.memo(MessageList);