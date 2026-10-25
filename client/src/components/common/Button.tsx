import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

const variantClasses = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        inline-flex items-center justify-center gap-2 font-semibold
        focus-ring cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        transition-all duration-200
        ${className}
      `}
      disabled={disabled || isLoading} {...props}
      
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="relative z-10">{icon}</span>
      ) : null}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
