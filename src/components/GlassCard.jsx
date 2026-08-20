import React from 'react';

export const GlassCard = ({
  children,
  className = '',
  onClick = null,
  delay = 0,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.03)',
        animationDelay: `${delay}ms`,
      }}
      className={`animate-fade-in-up rounded-[2rem] p-5 opacity-0 transition-all duration-300 ${
        onClick
          ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;
