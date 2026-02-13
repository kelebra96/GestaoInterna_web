'use client';

import { ClusterSummary, ClusterType } from '@/lib/types/prediction';
import { Users, Package, Layers, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

interface ClusterVisualizationProps {
  clusters: ClusterSummary[];
  clusterType: ClusterType;
  onClusterClick?: (clusterId: string) => void;
}

export function ClusterVisualization({
  clusters,
  clusterType,
  onClusterClick,
}: ClusterVisualizationProps) {
  const typeLabels: Record<ClusterType, string> = {
    store: 'Lojas',
    product: 'Produtos',
    category: 'Categorias',
  };

  const TypeIcon = clusterType === 'store' ? Users : clusterType === 'product' ? Package : Layers;

  const getRiskColor = (score?: number) => {
    if (!score) return 'bg-gray-100 border-gray-300';
    if (score >= 80) return 'bg-red-50 border-red-300';
    if (score >= 60) return 'bg-orange-50 border-orange-300';
    if (score >= 40) return 'bg-yellow-50 border-yellow-300';
    if (score >= 20) return 'bg-green-50 border-green-300';
    return 'bg-emerald-50 border-emerald-300';
  };

  const getRiskTextColor = (score?: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    if (score >= 20) return 'text-green-600';
    return 'text-emerald-600';
  };

  if (clusters.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TypeIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>Nenhum cluster de {typeLabels[clusterType].toLowerCase()} encontrado</p>
        <p className="text-sm mt-1">Execute a clusterização para agrupar seus dados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TypeIcon className="w-5 h-5 text-gray-500" />
        <h3 className="font-medium text-gray-900">
          Clusters de {typeLabels[clusterType]}
        </h3>
        <span className="text-sm text-gray-500">({clusters.length} grupos)</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clusters.map((cluster) => (
          <div
            key={cluster.id}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${getRiskColor(
              cluster.avgRiskScore
            )}`}
            onClick={() => onClusterClick?.(cluster.id)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">
                  {cluster.clusterLabel || cluster.clusterName}
                </h4>
                <p className="text-sm text-gray-500">
                  {cluster.memberCount} membros
                </p>
              </div>
              {cluster.avgRiskScore !== undefined && (
                <div
                  className={`text-2xl font-bold ${getRiskTextColor(
                    cluster.avgRiskScore
                  )}`}
                >
                  {Math.round(cluster.avgRiskScore)}
                </div>
              )}
            </div>

            {/* Characteristics */}
            {cluster.characteristics && (
              <div className="flex flex-wrap gap-1 mb-3">
                {cluster.characteristics.risk_level === 'high' && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Alto Risco
                  </span>
                )}
                {cluster.characteristics.risk_level === 'medium' && (
                  <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                    Risco Moderado
                  </span>
                )}
                {cluster.characteristics.risk_level === 'low' && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                    Baixo Risco
                  </span>
                )}
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {cluster.centroid.avg_loss_rate !== undefined && (
                <div>
                  <p className="text-gray-500">Taxa de Perda</p>
                  <p className="font-medium">
                    {(cluster.centroid.avg_loss_rate * 100).toFixed(1)}%
                  </p>
                </div>
              )}
              {cluster.centroid.efficiency_score !== undefined && (
                <div>
                  <p className="text-gray-500">Eficiência</p>
                  <p className="font-medium">
                    {(cluster.centroid.efficiency_score * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {/* Quality indicator */}
            {cluster.avgMembershipScore !== undefined && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Coesão do cluster</span>
                  <span>{(cluster.avgMembershipScore * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${cluster.avgMembershipScore * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Cluster detail component
interface ClusterDetailProps {
  cluster: ClusterSummary;
  members?: Array<{
    id: string;
    entityId: string;
    entityName?: string;
    membershipScore?: number;
    distanceToCentroid?: number;
    features: Record<string, number>;
  }>;
  onClose?: () => void;
}

export function ClusterDetail({ cluster, members, onClose }: ClusterDetailProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {cluster.clusterLabel || cluster.clusterName}
          </h2>
          <p className="text-gray-500">{cluster.memberCount} membros neste cluster</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Fechar</span>
            &times;
          </button>
        )}
      </div>

      {/* Centroid features */}
      <div className="mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Características do Cluster</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(cluster.centroid).map(([key, value]) => (
            <div key={key} className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-500 capitalize">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {typeof value === 'number' ? value.toFixed(2) : value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Members list */}
      {members && members.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">
            Membros ({members.length})
          </h3>
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Nome
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Afinidade
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Distância
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {member.entityName || member.entityId}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {member.membershipScore !== undefined && (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${member.membershipScore * 100}%` }}
                            />
                          </div>
                          <span className="text-gray-600">
                            {(member.membershipScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {member.distanceToCentroid?.toFixed(2) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary view
interface ClusterSummaryViewProps {
  storeClusters: ClusterSummary[];
  productClusters: ClusterSummary[];
  onViewDetails?: (type: ClusterType) => void;
}

export function ClusterSummaryView({
  storeClusters,
  productClusters,
  onViewDetails,
}: ClusterSummaryViewProps) {
  const getTotalMembers = (clusters: ClusterSummary[]) =>
    clusters.reduce((sum, c) => sum + c.memberCount, 0);

  const getHighRiskCount = (clusters: ClusterSummary[]) =>
    clusters.filter((c) => (c.avgRiskScore || 0) >= 60).length;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Store clusters */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-gray-900">Clusters de Lojas</h3>
          </div>
          <button
            onClick={() => onViewDetails?.('store')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Ver detalhes
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{storeClusters.length}</p>
            <p className="text-sm text-gray-500">Clusters</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {getTotalMembers(storeClusters)}
            </p>
            <p className="text-sm text-gray-500">Lojas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {getHighRiskCount(storeClusters)}
            </p>
            <p className="text-sm text-gray-500">Alto Risco</p>
          </div>
        </div>
      </div>

      {/* Product clusters */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            <h3 className="font-medium text-gray-900">Clusters de Produtos</h3>
          </div>
          <button
            onClick={() => onViewDetails?.('product')}
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            Ver detalhes
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{productClusters.length}</p>
            <p className="text-sm text-gray-500">Clusters</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {getTotalMembers(productClusters)}
            </p>
            <p className="text-sm text-gray-500">Produtos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {getHighRiskCount(productClusters)}
            </p>
            <p className="text-sm text-gray-500">Alto Risco</p>
          </div>
        </div>
      </div>
    </div>
  );
}
