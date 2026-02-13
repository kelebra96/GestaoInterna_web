'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Store as StoreIcon,
  Trash2,
  MapPin,
  FileText,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useExpiryRealtime } from '@/hooks/useExpiryRealtime';
import type { ExpiryReportWithDays, ExpiryStats, ExpiryDaysFilter } from '@/lib/types/expiry';

// Paleta MyInventory: #BF092F (accent), #132440 (primary), #16476A (secondary), #3B9797 (tertiary)
// Filter options
const FILTER_OPTIONS: { value: ExpiryDaysFilter | null; label: string; color: string }[] = [
  { value: null, label: 'Todos', color: 'bg-gray-100 text-gray-700' },
  { value: 0, label: 'D0 - Hoje', color: 'bg-[#F5E6E9] text-[#BF092F]' },
  { value: 1, label: 'D1 - Amanhã', color: 'bg-[#F5E6E9] text-[#BF092F]' },
  { value: 3, label: 'D3 - 3 dias', color: 'bg-[#E6EDF2] text-[#16476A]' },
  { value: 7, label: 'D7 - 7 dias', color: 'bg-[#E0F2F2] text-[#3B9797]' },
];

// Urgency colors based on days to expire
const getUrgencyColor = (days: number) => {
  if (days <= 0) return 'border-l-[#BF092F] bg-[#F5E6E9]';
  if (days <= 1) return 'border-l-[#BF092F] bg-[#F5E6E9]';
  if (days <= 3) return 'border-l-[#16476A] bg-[#E6EDF2]';
  return 'border-l-[#3B9797] bg-white';
};

const getUrgencyBadge = (days: number) => {
  if (days < 0) return { label: 'Vencido', class: 'bg-[#BF092F] text-white' };
  if (days === 0) return { label: 'Hoje', class: 'bg-[#BF092F] text-white' };
  if (days === 1) return { label: 'Amanhã', class: 'bg-[#BF092F] text-white' };
  if (days <= 3) return { label: `${days}d`, class: 'bg-[#16476A] text-white' };
  return { label: `${days}d`, class: 'bg-[#3B9797] text-white' };
};

// Stats Card component
const StatCard = ({ icon: Icon, label, value, color }: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${color}`}>
    <Icon className="w-5 h-5" />
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  </div>
);

// Report Card component
const ReportCard = ({
  report,
  onResolve,
  onDelete,
  isResolving,
  isDeleting,
}: {
  report: ExpiryReportWithDays;
  onResolve: () => void;
  onDelete: () => void;
  isResolving: boolean;
  isDeleting: boolean;
}) => {
  const urgencyColor = getUrgencyColor(report.daysToExpire);
  const badge = getUrgencyBadge(report.daysToExpire);
  const isResolved = report.status === 'resolved';

  return (
    <div className={`border-l-4 rounded-lg shadow-sm p-4 mb-3 transition-all ${urgencyColor} ${isResolved ? 'opacity-60' : ''}`}>
      <div className="flex gap-4">
        {/* Photo */}
        {report.photoUrl && (
          <div className="flex-shrink-0">
            <Image
              src={report.photoUrl}
              alt={report.productName || 'Produto'}
              width={80}
              height={80}
              className="rounded-lg object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {report.productName || 'Produto sem nome'}
              </h3>
              <p className="text-sm text-gray-500 font-mono">{report.barcode}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${badge.class}`}>
              {badge.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(report.expiryDate).toLocaleDateString('pt-BR')}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              Qtd: {report.quantity}
            </span>
            {report.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {report.location}
              </span>
            )}
          </div>

          {report.notes && (
            <p className="mt-2 text-sm text-gray-500 flex items-start gap-1">
              <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {report.notes}
            </p>
          )}

          {/* Actions */}
          {!isResolved && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={onResolve}
                disabled={isResolving}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#3B9797] text-white rounded-lg hover:bg-[#2A7A7A] disabled:opacity-50 transition-colors"
              >
                {isResolving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Resolver
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#F5E6E9] text-[#BF092F] rounded-lg hover:bg-[#EBCDD2] disabled:opacity-50 transition-colors"
              >
                {isDeleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir
              </button>
            </div>
          )}

          {isResolved && (
            <p className="mt-2 text-sm text-[#3B9797] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Resolvido
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="border-l-4 border-l-gray-200 rounded-lg p-4 bg-gray-50 animate-pulse">
        <div className="flex gap-4">
          <div className="w-20 h-20 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function ValidadePage() {
  const { user, firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<ExpiryStats | null>(null);
  const [filter, setFilter] = useState<ExpiryDaysFilter | null>(null);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get effective store ID from user
  const storeId = useMemo(() => {
    return user?.storeId || (user as any)?.companyId;
  }, [user]);

  // Use realtime hook for live updates
  const {
    reports,
    loading,
    error,
    refresh: refreshReports,
    isConnected,
  } = useExpiryRealtime({
    storeId: storeId || '',
    daysFilter: filter,
    includeResolved,
  });

  // Build auth headers
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!firebaseUser) return {};
    const token = await firebaseUser.getIdToken(true);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [firebaseUser]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!storeId) return;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/expiry/stats?storeId=${storeId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [storeId, getAuthHeaders]);

  // Handle resolve
  const handleResolve = async (reportId: string) => {
    if (!user?.uid) return;

    setResolvingId(reportId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/expiry/${reportId}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolvedBy: user.uid }),
      });

      if (!res.ok) throw new Error('Falha ao resolver');

      // Realtime will auto-update, but refresh stats manually
      fetchStats();
    } catch (err) {
      console.error('Error resolving:', err);
    } finally {
      setResolvingId(null);
    }
  };

  // Handle delete
  const handleDelete = async (reportId: string) => {
    if (!confirm('Tem certeza que deseja excluir este relatório?')) return;

    setDeletingId(reportId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/expiry/${reportId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error('Falha ao excluir');

      // Realtime will auto-update, but refresh stats manually
      fetchStats();
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Fetch stats on mount and when storeId changes
  useEffect(() => {
    if (firebaseUser && storeId) {
      fetchStats();
    }
  }, [firebaseUser, storeId, fetchStats]);

  // Filter counts
  const filterCounts = useMemo(() => {
    if (!stats) return { d0: 0, d1: 0, d3: 0, d7: 0, all: 0 };
    return {
      d0: stats.d0Count,
      d1: stats.d1Count,
      d3: stats.d3Count,
      d7: stats.d7Count,
      all: stats.total,
    };
  }, [stats]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#132440]" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Faça login para acessar esta página.</p>
      </div>
    );
  }

  // No store assigned
  if (!storeId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <StoreIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Nenhuma Loja Atribuída</h1>
          <p className="text-gray-600">
            Você não tem uma loja atribuída ao seu usuário.
            Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#132440] to-[#16476A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Controle de Validades</h1>
                <p className="text-[#E0E7EF] text-sm">Gestão de produtos próximos ao vencimento</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/validade/novo')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#132440] rounded-xl font-medium hover:bg-[#E0E7EF] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nova Validade
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={AlertTriangle}
                label="Urgentes (D0+D1)"
                value={stats.d0Count + stats.d1Count}
                color="bg-white/20 text-white"
              />
              <StatCard
                icon={Package}
                label="Total Ativos"
                value={stats.total}
                color="bg-white/20 text-white"
              />
              <StatCard
                icon={CheckCircle2}
                label="Resolvidos"
                value={stats.resolvedCount}
                color="bg-white/20 text-white"
              />
              <StatCard
                icon={Clock}
                label="Vencidos"
                value={stats.expiredCount}
                color="bg-white/20 text-white"
              />
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-gray-600">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filtrar:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => {
              const count = opt.value === null
                ? filterCounts.all
                : opt.value === 0
                ? filterCounts.d0
                : opt.value === 1
                ? filterCounts.d1
                : opt.value === 3
                ? filterCounts.d3
                : filterCounts.d7;

              return (
                <button
                  key={String(opt.value)}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filter === opt.value
                      ? `${opt.color} ring-2 ring-offset-1 ring-[#132440]`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label} ({count})
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
              className="rounded border-gray-300 text-[#132440] focus:ring-[#132440]"
            />
            <span className="text-sm text-gray-600">Mostrar resolvidos</span>
          </label>

          {/* Realtime connection indicator */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
            isConnected ? 'bg-[#E0F2F2] text-[#3B9797]' : 'bg-[#F5E6E9] text-[#BF092F]'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>Ao vivo</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Conectando...</span>
              </>
            )}
          </div>

          <button
            onClick={() => { refreshReports(); fetchStats(); }}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-[#132440] hover:bg-[#E0E7EF] rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="font-medium">Erro ao carregar dados</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Reports List */}
        {loading ? (
          <LoadingSkeleton />
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Nenhum produto encontrado
            </h3>
            <p className="text-gray-500">
              {filter !== null
                ? 'Tente outro filtro ou adicione novos produtos.'
                : 'Adicione produtos próximos ao vencimento.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onResolve={() => handleResolve(report.id)}
                onDelete={() => handleDelete(report.id)}
                isResolving={resolvingId === report.id}
                isDeleting={deletingId === report.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
