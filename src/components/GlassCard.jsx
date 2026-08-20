import React from 'react';

export const GlassCard = ({ children, className = '', onClick = null, delay = 0 }) => {
  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-fade-in-up opacity-0 rounded-[2rem] p-5 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''
      } ${className}`}
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderWidth: '1px',
        borderStyle: 'solid',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.03)',
        animationDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
};

export default GlassCard;
