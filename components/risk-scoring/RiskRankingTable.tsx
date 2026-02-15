'use client';

import { StoreRiskRanking, ProductRiskRanking } from '@/lib/types/risk-scoring';
import { RiskBadge, RiskTrendIndicator, MiniScore } from './RiskScoreCard';

// ==========================================
// Tabela de Ranking de Lojas
// ==========================================

interface StoreRankingTableProps {
  rankings: StoreRiskRanking[];
  loading?: boolean;
  onRowClick?: (storeId: string) => void;
}

export function StoreRankingTable({
  rankings,
  loading,
  onRowClick,
}: StoreRankingTableProps) {
  if (loading) {
    return <TableSkeleton rows={5} columns={6} />;
  }

  if (rankings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhuma loja com dados de risco disponíveis
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">#</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Loja</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Score</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Nível</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Tendência</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Valor em Risco</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((store) => (
            <tr
              key={store.storeId}
              className={`
                border-b border-gray-100 transition-colors
                ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              `}
              onClick={() => onRowClick?.(store.storeId)}
            >
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-gray-500">
                  {store.rank}
                </span>
              </td>
              <td className="py-3 px-4">
                <div>
                  <p className="font-medium text-gray-900">{store.storeName}</p>
                  <p className="text-xs text-gray-500">{store.storeCode}</p>
                </div>
              </td>
              <td className="py-3 px-4 text-center">
                <MiniScore score={store.score} level={store.level} />
              </td>
              <td className="py-3 px-4 text-center">
                <RiskBadge level={store.level} />
              </td>
              <td className="py-3 px-4 text-center">
                <RiskTrendIndicator
                  trend={store.trend}
                  change={store.changeFromPrevious ?? undefined}
                />
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-medium text-gray-900">
                  {formatCurrency(store.metrics.valueAtRisk || 0)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// Tabela de Ranking de Produtos
// ==========================================

interface ProductRankingTableProps {
  rankings: ProductRiskRanking[];
  loading?: boolean;
  onRowClick?: (productId: string) => void;
}

export function ProductRankingTable({
  rankings,
  loading,
  onRowClick,
}: ProductRankingTableProps) {
  if (loading) {
    return <TableSkeleton rows={5} columns={7} />;
  }

  if (rankings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum produto com dados de risco disponíveis
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">#</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Produto</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Score</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Nível</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Lojas</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Ocorrências</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Valor em Risco</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((product) => (
            <tr
              key={product.productId}
              className={`
                border-b border-gray-100 transition-colors
                ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              `}
              onClick={() => onRowClick?.(product.productId)}
            >
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-gray-500">
                  {product.rank}
                </span>
              </td>
              <td className="py-3 px-4">
                <div>
                  <p className="font-medium text-gray-900 truncate max-w-[200px]">
                    {product.productName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {product.brand} • {product.category}
                  </p>
                </div>
              </td>
              <td className="py-3 px-4 text-center">
                <MiniScore score={product.score} level={product.level} />
              </td>
              <td className="py-3 px-4 text-center">
                <RiskBadge level={product.level} />
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-sm text-gray-700">{product.storesAffected}</span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-sm text-gray-700">
                  {product.metrics.occurrences90d || 0}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="font-medium text-gray-900">
                  {formatCurrency(product.metrics.totalValueAtRisk || 0)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// Skeleton de Tabela
// ==========================================

function TableSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-100 rounded mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3">
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-6 bg-gray-100 rounded flex-1"
              style={{ maxWidth: j === 0 ? '40px' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ==========================================
// Helpers
// ==========================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
