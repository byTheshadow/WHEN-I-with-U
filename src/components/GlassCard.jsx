import React from 'react';

export const GlassCard = ({
  children,
  className = '',
  onClick = null,
  delay = 0,
  tone = 'light',
}) => {
  const isInk = tone === 'ink';

  return (
    <div
      onClick={onClick}
      style={{
        background: isInk ? 'var(--ink-card-bg)' : 'var(--card-bg-gradient)',
        borderColor: isInk
          ? 'var(--ink-card-border)'
          : 'var(--card-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
        boxShadow: isInk
          ? 'var(--ink-card-shadow)'
          : 'var(--card-shadow)',
        color: isInk ? 'var(--text-on-ink)' : 'var(--text-main)',
        backdropFilter: 'blur(22px) saturate(120%)',
        WebkitBackdropFilter: 'blur(22px) saturate(120%)',
        animationDelay: `${delay}ms`,
      }}
      className={`animate-fade-in-up rounded-[2rem] p-5 opacity-0 transition-transform duration-300 ${
        onClick
          ? 'cursor-pointer active:scale-[0.985] sm:hover:-translate-y-0.5'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;
