import React from 'react';

export const TextCard = ({ content = '' }) => {
  return (
    <div className="text-xs leading-relaxed tracking-wide whitespace-pre-wrap font-sans break-words select-text">
      {content}
    </div>
  );
};

export default TextCard;
