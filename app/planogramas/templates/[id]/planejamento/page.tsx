'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Brain, Save } from 'lucide-react';
import DataUploader from '@/components/category-planning/DataUploader';
import CategoryAnalysisView from '@/components/category-planning/CategoryAnalysisView';
import { ProductSalesData, CategoryAnalysis } from '@/lib/types/category-planning';

export default function CategoryPlanningPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [importedData, setImportedData] = useState<ProductSalesData[] | null>(null);
  const [analysis, setAnalysis] = useState<CategoryAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDataImported = async (data: ProductSalesData[]) => {
    setImportedData(data);
    setError(null);

    // Automaticamente analisar após importação
    await handleAnalyze(data);
  };

  const handleAnalyze = async (dataToAnalyze?: ProductSalesData[]) => {
    const data = dataToAnalyze || importedData;

    if (!data || data.length === 0) {
      setError('Nenhum dado disponível para análise');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);

      const response = await fetch('/api/category-planning/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: data,
          config: {
            // Configurações opcionais
            availableSpace: {
              totalWidth: 120,
              shelfLevels: 4,
              averageDepth: 40,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao analisar dados');
      }

      const result = await response.json();
      setAnalysis(result.analysis);
    } catch (err: any) {
      console.error('Erro na análise:', err);
      setError(err.message || 'Erro ao processar análise');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyRecommendations = () => {
    if (!analysis) return;

    // Preparar dados para aplicar ao template
    const recommendations = analysis.products.map((product) => ({
      productId: product.productId,
      facings: product.recommendedFacings,
      shelfLevel: product.recommendedPosition.level,
      sequence: product.recommendedPosition.sequence,
    }));

    // TODO: Enviar para API para atualizar o template
    alert(
      `${recommendations.length} recomendações prontas para aplicar!\n\nEm desenvolvimento: Aplicar automaticamente ao planograma.`
    );

    // Redirecionar para gerenciamento de produtos
    router.push(`/planogramas/templates/${id}/produtos`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.push(`/planogramas/templates/${id}`)}
              className="text-[#1F53A2] hover:text-[#153D7A]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-[#212121]">
              Planejamento de Categoria
            </h1>
          </div>
          <p className="text-[#757575] mt-1">
            Importe dados de vendas e obtenha recomendações inteligentes de layout
          </p>
        </div>

        {/* Informational Banner */}
        <div className="bg-gradient-to-r from-[#E3F2FD] to-[#BBDEFB] border-l-4 border-[#2196F3] rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <Brain className="w-6 h-6 text-[#2196F3] flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-[#212121] mb-2">
                Como funciona o Planejamento de Categoria?
              </h2>
              <ul className="space-y-2 text-sm text-[#757575]">
                <li className="flex items-start gap-2">
                  <span className="inline-block w-2 h-2 bg-[#2196F3] rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>
                    <strong>Importa dados:</strong> Envie histórico de vendas, margem de lucro e
                    sazonalidade (CSV, JSON ou XLSX)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-2 h-2 bg-[#2196F3] rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>
                    <strong>Análise inteligente:</strong> Sistema classifica produtos usando Curva ABC e
                    analisa performance
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-2 h-2 bg-[#2196F3] rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>
                    <strong>Recomendações:</strong> Receba sugestões de facings, posicionamento e
                    estratégia de layout
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-2 h-2 bg-[#2196F3] rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>
                    <strong>Aplica ao planograma:</strong> Use as recomendações para configurar seu
                    template automaticamente
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <DataUploader onDataImported={handleDataImported} templateId={id} />

        {/* Status Messages */}
        {analyzing && (
          <div className="mt-6 bg-white rounded-xl shadow-md border border-[#E0E0E0] p-8 text-center">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto text-[#1F53A2] mb-4" />
            <p className="text-[#212121] font-medium mb-2">Analisando dados de categoria...</p>
            <p className="text-sm text-[#757575]">
              Calculando curva ABC, alocação de espaço e recomendações
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-[#FFEBEE] border border-[#E82129] rounded-lg p-4">
            <p className="text-[#E82129] font-semibold">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !analyzing && (
          <div className="mt-6">
            <CategoryAnalysisView
              analysis={analysis}
              onApplyRecommendations={handleApplyRecommendations}
            />
          </div>
        )}

        {/* Empty State */}
        {!importedData && !analyzing && !error && (
          <div className="mt-6 bg-white rounded-xl shadow-md border border-[#E0E0E0] p-12 text-center">
            <Brain className="w-16 h-16 mx-auto text-[#E0E0E0] mb-4" />
            <p className="text-[#757575] mb-2">Nenhum dado importado ainda</p>
            <p className="text-sm text-[#9E9E9E]">
              Faça upload de um arquivo CSV, JSON ou XLSX para começar a análise
            </p>
          </div>
        )}

        {/* Actions */}
        {importedData && !analyzing && (
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => handleAnalyze()}
              className="inline-flex items-center gap-2 bg-[#2196F3] hover:bg-[#1976D2] text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Reanalisar
            </button>

            {analysis && (
              <button
                onClick={() => router.push(`/planogramas/templates/${id}`)}
                className="inline-flex items-center gap-2 bg-white border-2 border-[#E0E0E0] text-[#212121] hover:bg-[#F5F5F5] px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Voltar ao Template
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
