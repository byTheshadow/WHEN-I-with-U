import React from 'react';
import { ChevronRight, Mail } from 'lucide-react';

export const DailyOfferingEmptyEnvelope = ({ onOpenSettings }) => (
  <button
    type="button"
    onClick={onOpenSettings}
    className="daily-offering-empty-envelope animate-fade-in-up"
  >
    <span className="daily-offering-empty-envelope__icon">
      <Mail className="h-4 w-4" strokeWidth={1.5} />
    </span>

    <span className="daily-offering-empty-envelope__copy">
      <span className="daily-offering-empty-envelope__title">
        今日还没有留下什么
      </span>
      <span className="daily-offering-empty-envelope__subtitle">
        去为这封信署名
      </span>
    </span>

    <ChevronRight className="h-4 w-4 opacity-45" strokeWidth={1.5} />
  </button>
);

export default DailyOfferingEmptyEnvelope;
