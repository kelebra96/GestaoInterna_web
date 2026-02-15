import { type ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  hoverable?: boolean;
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

// ============================================================================
// STYLES
// ============================================================================

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function Card({
  children,
  header,
  footer,
  className = '',
  hoverable = false,
  bordered = true,
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={`
        bg-card rounded-[var(--radius-xl)] shadow-sm
        transition-all duration-[var(--duration-normal)] ease-[var(--ease-default)]
        ${bordered ? 'border border-border' : ''}
        ${hoverable ? 'hover:shadow-md hover:border-border-strong hover:-translate-y-0.5' : ''}
        ${className}
      `.trim()}
    >
      {header && (
        <div className="px-6 py-4 border-b border-divider">
          {header}
        </div>
      )}
      <div className={paddingStyles[padding]}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-divider bg-surface-hover/50 rounded-b-[var(--radius-xl)]">
          {footer}
        </div>
      )}
    </div>
  );
}
