import React from 'react';

export const GlassCard = ({
  children,
  className = '',
  onClick = null,
  delay = 0,
}) => {
  const interactiveClassName = onClick
    ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
    : '';

  return (
    <div
      onClick={onClick}
      style={{
        color: 'var(--card-text-main)',
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
        backdropFilter: 'blur(22px) saturate(115%)',
        WebkitBackdropFilter: 'blur(22px) saturate(115%)',
        boxShadow: '0 16px 36px var(--shadow-color)',
        animationDelay: `${delay}ms`,
      }}
      className={`animate-fade-in-up rounded-[2rem] p-5 opacity-0 transition-all duration-300 ${interactiveClassName} ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;

