import React from 'react';

export const AlmanacChatSelector = ({
  chats = [],
  characters = [],
  selectedChatId,
  onChange,
}) => {
  return (
    <label className="almanac-chat-selector">
      <span className="almanac-eyebrow">Observe one room</span>

      <select
        value={selectedChatId || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">选择一个聊天窗口</option>

        {chats.map((chat) => {
          const character = characters.find(
            (item) => item.id === chat.characterId
          );

          return (
            <option value={chat.id} key={chat.id}>
              {chat.title || character?.name || '未命名聊天'}
            </option>
          );
        })}
      </select>
    </label>
  );
};

export default AlmanacChatSelector;
