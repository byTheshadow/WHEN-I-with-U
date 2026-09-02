import React from 'react';
import { HeartHandshake } from 'lucide-react';

const CompanionshipButton = ({
  onClick,
  isActive = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-center rounded-full p-2 opacity-85 transition-opacity hover:opacity-100"
    style={{
      background: isActive
        ? 'var(--accent-color)'
        : 'var(--control-soft-bg)',
      color: isActive
        ? 'var(--accent-foreground)'
        : 'var(--text-main)',
      border: '1px solid var(--card-border)',
    }}
    title={isActive ? '陪伴进行中' : '开始长期陪伴'}
    aria-label={isActive ? '陪伴进行中' : '开始长期陪伴'}
  >
    <HeartHandshake className="h-4 w-4" />
  </button>
);

export default CompanionshipButton;
