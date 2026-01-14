'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  BarChart3,
  Layers,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Lightbulb,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CategoryAnalysis, ProductAnalysisResult } from '@/lib/types/category-planning';

interface CategoryAnalysisViewProps {
  analysis: CategoryAnalysis;
  onApplyRecommendations?: () => void;
}

export default function CategoryAnalysisView({
  analysis,
  onApplyRecommendations,
}: CategoryAnalysisViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'products'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const classColors = {
    A: 'bg-[#4CAF50] text-white',
    B: 'bg-[#FF9800] text-white',
    C: 'bg-[#E82129] text-white',
  };

  const priorityColors = {
    high: 'text-[#4CAF50]',
    medium: 'text-[#FF9800]',
    low: 'text-[#757575]',
  };

  const levelLabels = {
    eye: 'Nível dos Olhos',
    middle: 'Nível Médio',
    top: 'Prateleira Superior',
    bottom: 'Prateleira Inferior',
  };

  const levelIcons = {
    eye: Eye,
    middle: Minus,
    top: ArrowUp,
    bottom: ArrowDown,
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] overflow-hidden">
        <button
          onClick={() => toggleSection('overview')}
          className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-[#1F53A2] to-[#153D7A] text-white hover:opacity-90 transition-opacity"
        >
          <h2 className="text-lg font-bold">Visão Geral da Análise</h2>
          {expandedSections.has('overview') ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {expandedSections.has('overview') && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-[#E3F2FD] rounded-lg">
                <Package className="w-8 h-8 text-[#2196F3]" />
                <div>
                  <p className="text-sm text-[#757575]">Total de Produtos</p>
                  <p className="text-2xl font-bold text-[#212121]">
                    {analysis.totalProducts}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-[#E8F5E9] rounded-lg">
                <TrendingUp className="w-8 h-8 text-[#4CAF50]" />
                <div>
                  <p className="text-sm text-[#757575]">Volume Total</p>
                  <p className="text-2xl font-bold text-[#212121]">
                    {analysis.totalSalesVolume.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-[#757575]">unidades</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-[#FFF3E0] rounded-lg">
                <DollarSign className="w-8 h-8 text-[#FF9800]" />
                <div>
                  <p className="text-sm text-[#757575]">Receita Total</p>
                  <p className="text-2xl font-bold text-[#212121]">
                    R$ {analysis.totalSalesRevenue.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Estratégia de Layout */}
            <div className="mt-6 p-4 bg-[#F3E5F5] border-l-4 border-[#9C27B0] rounded-lg">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-[#9C27B0] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-[#212121] mb-2">
                    Estratégia de Layout Recomendada
                  </h3>
                  <p className="text-sm text-[#757575] mb-2">
                    {analysis.recommendations.layoutJustification}
                  </p>
                  <span className="inline-block px-3 py-1 bg-[#9C27B0] text-white text-sm font-semibold rounded-full">
                    {analysis.recommendations.layoutStrategy.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Métricas Esperadas */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border border-[#E0E0E0] rounded-lg">
                <p className="text-xs text-[#757575] mb-1">Utilização de Espaço</p>
                <p className="text-xl font-bold text-[#212121]">
                  {analysis.recommendations.expectedMetrics.totalSpaceUtilization.toFixed(1)}%
                </p>
              </div>

              <div className="p-3 border border-[#E0E0E0] rounded-lg">
                <p className="text-xs text-[#757575] mb-1">Vendas Médias/Facing</p>
                <p className="text-xl font-bold text-[#212121]">
                  {analysis.recommendations.expectedMetrics.averageSalesPerFacing.toFixed(0)}
                </p>
              </div>

              <div className="p-3 border border-[#E0E0E0] rounded-lg">
                <p className="text-xs text-[#757575] mb-1">Potencial de Lucro</p>
                <p className="text-xl font-bold text-[#212121]">
                  R$ {analysis.recommendations.expectedMetrics.totalProfitPotential.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Produtos */}
      <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] overflow-hidden">
        <button
          onClick={() => toggleSection('products')}
          className="w-full px-6 py-4 flex items-center justify-between bg-[#F5F5F5] hover:bg-[#EEEEEE] transition-colors"
        >
          <h2 className="text-lg font-bold text-[#212121] flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Análise por Produto ({analysis.products.length})
          </h2>
          {expandedSections.has('products') ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {expandedSections.has('products') && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#E0E0E0]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#757575]">
                      Produto
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[#757575]">
                      Classe
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#757575]">
                      Vendas %
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#757575]">
                      Margem
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[#757575]">
                      Facings
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[#757575]">
                      Posição
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.products.map((product, index) => {
                    const LevelIcon = levelIcons[product.recommendedPosition.level];
                    return (
                      <tr
                        key={product.productId}
                        className="border-b border-[#E0E0E0] hover:bg-[#F5F5F5] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-[#212121]">
                              {product.productName || product.productId}
                            </p>
                            {product.productName && (
                              <p className="text-xs text-[#757575]">{product.productId}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block w-8 h-8 rounded-full ${
                              classColors[product.classification]
                            } flex items-center justify-center font-bold text-sm`}
                          >
                            {product.classification}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${priorityColors[product.priority]}`}>
                            {product.salesPercentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[#212121]">
                            {product.profitMargin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-3 py-1 bg-[#E3F2FD] text-[#1F53A2] rounded-full font-semibold text-sm">
                            {product.recommendedFacings}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <LevelIcon className="w-4 h-4 text-[#757575]" />
                            <span className="text-xs text-[#757575]">
                              {levelLabels[product.recommendedPosition.level]}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legenda */}
            <div className="mt-4 p-4 bg-[#F5F5F5] rounded-lg">
              <p className="text-sm font-semibold text-[#212121] mb-2">Legenda:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="inline-block w-6 h-6 rounded-full bg-[#4CAF50] text-white text-center leading-6 font-bold mr-2">
                    A
                  </span>
                  <span className="text-[#757575]">
                    Classe A: Top performers (~80% vendas)
                  </span>
                </div>
                <div>
                  <span className="inline-block w-6 h-6 rounded-full bg-[#FF9800] text-white text-center leading-6 font-bold mr-2">
                    B
                  </span>
                  <span className="text-[#757575]">Classe B: Performance média (~15% vendas)</span>
                </div>
                <div>
                  <span className="inline-block w-6 h-6 rounded-full bg-[#E82129] text-white text-center leading-6 font-bold mr-2">
                    C
                  </span>
                  <span className="text-[#757575]">Classe C: Baixo giro (~5% vendas)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Otimizações */}
      {analysis.recommendations.optimizations.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-[#E0E0E0] overflow-hidden">
          <button
            onClick={() => toggleSection('optimizations')}
            className="w-full px-6 py-4 flex items-center justify-between bg-[#FFF3E0] hover:bg-[#FFECB3] transition-colors"
          >
            <h2 className="text-lg font-bold text-[#212121] flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#FF9800]" />
              Recomendações de Otimização ({analysis.recommendations.optimizations.length})
            </h2>
            {expandedSections.has('optimizations') ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>

          {expandedSections.has('optimizations') && (
            <div className="p-6">
              <div className="space-y-4">
                {analysis.recommendations.optimizations.map((opt, index) => {
                  const typeIcons = {
                    increase_facings: ArrowUp,
                    decrease_facings: ArrowDown,
                    reposition: Layers,
                    remove: AlertCircle,
                    add: CheckCircle,
                  };
                  const typeColors = {
                    increase_facings: 'bg-[#E8F5E9] border-[#4CAF50] text-[#4CAF50]',
                    decrease_facings: 'bg-[#FFEBEE] border-[#E82129] text-[#E82129]',
                    reposition: 'bg-[#E3F2FD] border-[#2196F3] text-[#2196F3]',
                    remove: 'bg-[#FFF3E0] border-[#FF9800] text-[#FF9800]',
                    add: 'bg-[#E8F5E9] border-[#4CAF50] text-[#4CAF50]',
                  };

                  const Icon = typeIcons[opt.type];

                  return (
                    <div
                      key={index}
                      className={`p-4 border-l-4 rounded-lg ${typeColors[opt.type]}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-[#212121] mb-1">
                            {opt.productName || opt.productId}
                          </h3>
                          <p className="text-sm text-[#757575] mb-2">{opt.reasoning}</p>
                          {opt.currentValue !== undefined && (
                            <p className="text-xs text-[#757575]">
                              Atual: {opt.currentValue} → Recomendado: {opt.recommendedValue}
                            </p>
                          )}
                          {opt.expectedImpact && (
                            <div className="mt-2 text-xs text-[#212121] bg-white/50 px-2 py-1 rounded">
                              <strong>Impacto esperado:</strong> {opt.expectedImpact}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {onApplyRecommendations && (
                <div className="mt-6 pt-4 border-t border-[#E0E0E0]">
                  <button
                    onClick={onApplyRecommendations}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#FF9800] hover:bg-[#F57C00] text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Aplicar Recomendações ao Planograma
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
