import React from 'react';
import { ArrowUpRight, X } from 'lucide-react';

export const CheckInNotice = ({
  delivery,
  onOpen,
  onDismiss,
}) => {
  if (!delivery) {
    return null;
  }

  return (
    <aside
      className="check-in-notice"
      aria-live="polite"
    >
      <button
        type="button"
        className="check-in-notice__close"
        onClick={onDismiss}
        aria-label="收起这张短笺"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        className="check-in-notice__body"
        onClick={onOpen}
      >
        {delivery.characterAvatar ? (
          <img
            src={delivery.characterAvatar}
            alt={delivery.characterName}
            className="check-in-notice__avatar"
          />
        ) : (
          <span className="check-in-notice__avatar check-in-notice__avatar--empty">
            {delivery.characterName?.[0] || 'C'}
          </span>
        )}

        <span className="check-in-notice__copy">
          <span className="check-in-notice__kicker">
            ANOTHER DOOR
          </span>
          <strong>{delivery.characterName}</strong>
          <span className="check-in-notice__preview">
            {delivery.preview}
          </span>
        </span>

        <ArrowUpRight className="check-in-notice__arrow" />
      </button>
    </aside>
  );
};

export default CheckInNotice;
