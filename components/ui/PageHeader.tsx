import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header
      className={`
        relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797]
        overflow-hidden shadow-lg
        ${className}
      `.trim()}
    >
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.07]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative w-full px-3 sm:px-5 lg:px-6 py-5 lg:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="p-3.5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
                <Icon className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/70 text-sm font-medium mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
