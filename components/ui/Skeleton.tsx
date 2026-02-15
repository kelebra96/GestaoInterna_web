// ============================================================================
// TYPES
// ============================================================================

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  count?: number;
}

// ============================================================================
// STYLES
// ============================================================================

const roundedStyles = {
  sm: 'rounded-[var(--radius-sm)]',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  full: 'rounded-full',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function Skeleton({
  className = '',
  width,
  height = '1rem',
  rounded = 'md',
  count = 1,
}: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          className={`animate-shimmer ${roundedStyles[rounded]} ${className}`}
          style={{
            width: width ?? '100%',
            height: typeof height === 'number' ? `${height}px` : height,
          }}
          role="status"
          aria-label="Carregando..."
        />
      ))}
    </>
  );
}

// ============================================================================
// PRESET: Card Skeleton
// ============================================================================

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-card rounded-[var(--radius-xl)] border border-border p-6 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton width={40} height={40} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height={12} width="60%" />
          <Skeleton height={10} width="40%" />
        </div>
      </div>
      <Skeleton height={32} width="40%" />
      <Skeleton height={10} width="70%" />
    </div>
  );
}

// ============================================================================
// PRESET: Table Skeleton
// ============================================================================

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-[var(--radius-xl)] border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <Skeleton height={14} width="30%" />
      </div>
      <div className="divide-y divide-divider">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton width={32} height={32} rounded="full" />
            <div className="flex-1 space-y-2">
              <Skeleton height={12} width={`${60 + Math.random() * 30}%`} />
              <Skeleton height={10} width={`${30 + Math.random() * 20}%`} />
            </div>
            <Skeleton width={60} height={24} rounded="full" />
          </div>
        ))}
      </div>
    </div>
  );
}
