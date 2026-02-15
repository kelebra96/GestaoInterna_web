'use client';

import { forwardRef } from 'react';
import { type LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

// ============================================================================
// STYLES MAP
// ============================================================================

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-sm hover:shadow-md',
  secondary:
    'bg-surface text-text-primary border border-border hover:bg-surface-hover active:bg-gray-200 shadow-xs',
  accent:
    'bg-gradient-to-r from-primary-500 to-primary-700 text-white hover:from-primary-600 hover:to-primary-800 shadow-md hover:shadow-lg',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  danger:
    'bg-error-500 text-white hover:bg-error-600 active:bg-error-700 shadow-sm hover:shadow-md',
  success:
    'bg-success-500 text-white hover:bg-success-600 active:bg-success-700 shadow-sm hover:shadow-md',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3.5 text-base gap-2.5 rounded-xl',
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 20,
};

// ============================================================================
// COMPONENT
// ============================================================================

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconRight: IconRight,
      loading = false,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const iconSize = iconSizes[size];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-[var(--duration-normal)] ease-[var(--ease-default)]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          hover:scale-[1.02] active:scale-[0.98]
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `.trim()}
        {...props}
      >
        {loading ? (
          <span
            className="animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ width: iconSize, height: iconSize }}
          />
        ) : Icon ? (
          <Icon style={{ width: iconSize, height: iconSize }} />
        ) : null}
        {children && <span>{children}</span>}
        {IconRight && !loading && (
          <IconRight style={{ width: iconSize, height: iconSize }} />
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
