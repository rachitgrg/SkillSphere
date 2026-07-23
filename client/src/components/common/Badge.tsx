import { type ReactNode } from 'react';

interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'secondary';
  children: ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantClasses = {
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  secondary: 'badge-secondary',
};

export function Badge({ variant = 'primary', children, size = 'md', dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`badge ${variantClasses[variant]} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : ''} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          variant === 'success' ? 'bg-green-400' :
          variant === 'warning' ? 'bg-yellow-400' :
          variant === 'error' ? 'bg-red-400' :
          variant === 'secondary' ? 'bg-cyan-400' :
          'bg-indigo-400'
        }`} />
      )}
      {children}
    </span>
  );
}
