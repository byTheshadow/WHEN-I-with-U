import React from 'react';

export const GlassCard = ({ children, className = '', hoverable = false, ...props }) => {
  return (
    <div
      className={`glass-panel rounded-3xl p-6 transition-all duration-300 ${
        hoverable ? 'hover:-translate-y-1 hover:shadow-2xl' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
