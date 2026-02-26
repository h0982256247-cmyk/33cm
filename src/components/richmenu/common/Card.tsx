import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      className={`bg-card rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
