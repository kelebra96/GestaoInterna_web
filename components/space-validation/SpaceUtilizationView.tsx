'use client';

import { AlertCircle, CheckCircle, AlertTriangle, Info, Maximize2 } from 'lucide-react';
import { ValidationResult, SpaceUtilization } from '@/lib/types/space-validation';

interface SpaceUtilizationViewProps {
  validation: ValidationResult;
  compact?: boolean; // Modo compacto (padrão: false)
}

export default function SpaceUtilizationView({ validation, compact = false }: SpaceUtilizationViewProps) {
  const getStatusColor = (status: SpaceUtilization['status']) => {
    switch (status) {
      case 'empty':
        return 'bg-gray-200 text-gray-700';
      case 'underutilized':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'optimal':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'overutilized':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'exceeded':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: SpaceUtilization['status']) => {
    switch (status) {
      case 'optimal':
        return <CheckCircle className="w-4 h-4" />;
      case 'exceeded':
        return <AlertCircle className="w-4 h-4" />;
      case 'overutilized':
      case 'underutilized':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: SpaceUtilization['status']) => {
    switch (status) {
      case 'empty':
        return 'Vazio';
      case 'underutilized':
        return 'Subutilizado';
      case 'optimal':
        return 'Ótimo';
      case 'overutilized':
        return 'Alto';
      case 'exceeded':
        return 'Excedido';
      default:
        return status;
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Resumo Compacto */}
        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Utilização Total:</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  validation.totalUtilization > 100
                    ? 'bg-red-500'
                    : validation.totalUtilization >= 85
                    ? 'bg-green-500'
                    : validation.totalUtilization >= 70
                    ? 'bg-yellow-500'
                    : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(100, validation.totalUtilization)}%` }}
              />
            </div>
            <span className="text-sm font-bold text-gray-900">
              {validation.totalUtilization.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Erros e Avisos Compactos */}
        {validation.errors.length > 0 && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            {validation.errors.length} erro(s)
          </div>
        )}
        {validation.warnings.length > 0 && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            {validation.warnings.length} aviso(s)
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Maximize2 className="w-5 h-5" />
          Validação de Espaço
        </h3>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-medium mb-1">Total Disponível</p>
            <p className="text-2xl font-bold text-blue-900">
              {validation.summary.totalSpaceAvailable.toFixed(0)} cm
            </p>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-600 font-medium mb-1">Espaço Usado</p>
            <p className="text-2xl font-bold text-green-900">
              {validation.summary.totalSpaceUsed.toFixed(0)} cm
            </p>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1">Espaço Restante</p>
            <p className="text-2xl font-bold text-gray-900">
              {validation.summary.totalSpaceRemaining.toFixed(0)} cm
            </p>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-xs text-purple-600 font-medium mb-1">Utilização Média</p>
            <p className="text-2xl font-bold text-purple-900">
              {validation.summary.averageUtilization.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Barra de Progresso Global */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Utilização Total</span>
            <span className="text-sm font-bold text-gray-900">
              {validation.totalUtilization.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                validation.totalUtilization > 100
                  ? 'bg-red-500'
                  : validation.totalUtilization >= 85
                  ? 'bg-green-500'
                  : validation.totalUtilization >= 70
                  ? 'bg-yellow-500'
                  : 'bg-gray-400'
              }`}
              style={{ width: `${Math.min(100, validation.totalUtilization)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span className="text-yellow-600">70%</span>
            <span className="text-green-600">85%</span>
            <span className="text-red-600">100%</span>
          </div>
        </div>

        {/* Status Geral */}
        <div className="flex items-center gap-2">
          {validation.valid ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Validação OK - Pode adicionar produtos</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">
                Validação com {validation.errors.length} erro(s)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Utilização por Prateleira */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Utilização por Prateleira</h3>

        <div className="space-y-4">
          {validation.spaceUtilization.map((shelf) => (
            <div
              key={shelf.shelfId}
              className={`p-4 border-2 rounded-lg ${getStatusColor(shelf.status)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(shelf.status)}
                  <span className="font-semibold">Prateleira {shelf.shelfLevel}</span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                      shelf.status
                    )}`}
                  >
                    {getStatusLabel(shelf.status)}
                  </span>
                </div>
                <span className="text-sm font-bold">
                  {shelf.utilizationPercentage.toFixed(1)}%
                </span>
              </div>

              {/* Barra de Progresso */}
              <div className="mb-3">
                <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-gray-300">
                  <div
                    className={`h-full transition-all ${
                      shelf.status === 'exceeded'
                        ? 'bg-red-500'
                        : shelf.status === 'optimal'
                        ? 'bg-green-500'
                        : shelf.status === 'overutilized'
                        ? 'bg-orange-500'
                        : shelf.status === 'underutilized'
                        ? 'bg-yellow-500'
                        : 'bg-gray-400'
                    }`}
                    style={{ width: `${Math.min(100, shelf.utilizationPercentage)}%` }}
                  />
                </div>
              </div>

              {/* Detalhes */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Total: </span>
                  <span className="font-medium">{shelf.totalWidth.toFixed(1)} cm</span>
                </div>
                <div>
                  <span className="text-gray-600">Usado: </span>
                  <span className="font-medium">{shelf.usedWidth.toFixed(1)} cm</span>
                </div>
                <div>
                  <span className="text-gray-600">Disponível: </span>
                  <span className="font-medium">{shelf.availableWidth.toFixed(1)} cm</span>
                </div>
              </div>

              {/* Gaps */}
              {shelf.gaps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                  <p className="text-xs font-medium mb-2">Gaps detectados: {shelf.gaps.length}</p>
                  <div className="space-y-1">
                    {shelf.gaps
                      .filter((gap) => gap.severity !== 'minor')
                      .slice(0, 2)
                      .map((gap, index) => (
                        <div
                          key={index}
                          className="text-xs flex items-center justify-between"
                        >
                          <span>
                            {gap.type === 'start'
                              ? 'Início'
                              : gap.type === 'middle'
                              ? 'Meio'
                              : 'Fim'}
                            : {gap.startX.toFixed(1)} - {gap.endX.toFixed(1)} cm
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              gap.severity === 'major'
                                ? 'bg-red-500 text-white'
                                : 'bg-orange-500 text-white'
                            }`}
                          >
                            {gap.width.toFixed(1)} cm
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Erros */}
      {validation.errors.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
          <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Erros ({validation.errors.length})
          </h3>
          <div className="space-y-3">
            {validation.errors.map((error, index) => (
              <div key={index} className="p-3 bg-white rounded-lg border border-red-200">
                <p className="text-sm font-semibold text-red-800 mb-1">{error.type}</p>
                <p className="text-sm text-red-700">{error.message}</p>
                {error.shelfId && (
                  <p className="text-xs text-red-600 mt-1">Prateleira: {error.shelfId}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avisos */}
      {validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
          <h3 className="text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Avisos ({validation.warnings.length})
          </h3>
          <div className="space-y-3">
            {validation.warnings.map((warning, index) => (
              <div key={index} className="p-3 bg-white rounded-lg border border-yellow-200">
                <p className="text-sm font-semibold text-yellow-800 mb-1">{warning.type}</p>
                <p className="text-sm text-yellow-700">{warning.message}</p>
                {warning.suggestion && (
                  <p className="text-xs text-yellow-600 mt-2">
                    <strong>Sugestão:</strong> {warning.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
