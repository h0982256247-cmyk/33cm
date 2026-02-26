import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '',
  disabled,
  ...props 
}) => {
  const baseStyle = "px-4 py-3 rounded-[10px] font-medium transition-all duration-200 text-[15px] flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
    secondary: "bg-gray-100 text-text hover:bg-gray-200 disabled:opacity-50",
    danger: "bg-error/10 text-error hover:bg-error/20",
    ghost: "bg-transparent text-primary hover:bg-gray-50"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
