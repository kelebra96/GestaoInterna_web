'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Download, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ComplianceScoreBreakdownView from '@/components/compliance/ComplianceScoreBreakdown';
import { ComplianceScoreBreakdown } from '@/lib/types/compliance-scoring';
import { ComplianceScoringService, ExecutionData } from '@/lib/services/compliance-scoring.service';

export default function ExecutionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const executionId = params.id as string;
  const { firebaseUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<ComplianceScoreBreakdown | null>(null);
  const [executionData, setExecutionData] = useState<any>(null);

  useEffect(() => {
    if (firebaseUser && executionId) {
      fetchExecutionData();
    }
  }, [firebaseUser, executionId]);

  const fetchExecutionData = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('Usuário não autenticado');
      }

      const token = await firebaseUser.getIdToken();

      // Buscar dados da execução
      const response = await fetch(`/api/planograms/executions/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar execução');
      }

      const data = await response.json();
      setExecutionData(data);

      // Criar dados mockados para demonstração
      // Em produção, isso viria do backend
      const mockExecutionData: ExecutionData = {
        executionId: executionId,
        storeId: data.storeId || 'store-1',
        templateId: data.templateId || 'template-1',
        executedAt: new Date(data.executedAt || Date.now()),

        expectedProducts: [
          {
            productId: 'PROD-001',
            productName: 'Biscoito Maria',
            shelfId: 'shelf-1',
            positionX: 10,
            positionY: 50,
            facings: 3,
            height: 25,
            visible: true,
          },
          {
            productId: 'PROD-002',
            productName: 'Bolacha Cream Cracker',
            shelfId: 'shelf-1',
            positionX: 40,
            positionY: 50,
            facings: 4,
            height: 25,
            visible: true,
          },
          {
            productId: 'PROD-003',
            productName: 'Wafer Chocolate',
            shelfId: 'shelf-2',
            positionX: 10,
            positionY: 80,
            facings: 5,
            height: 20,
            visible: true,
          },
          {
            productId: 'PROD-004',
            productName: 'Rosquinha',
            shelfId: 'shelf-2',
            positionX: 60,
            positionY: 80,
            facings: 3,
            height: 20,
            visible: true,
          },
          {
            productId: 'PROD-005',
            productName: 'Biscoito Recheado',
            shelfId: 'shelf-3',
            positionX: 20,
            positionY: 110,
            facings: 6,
            height: 30,
            visible: true,
          },
        ],

        detectedProducts: [
          {
            productId: 'PROD-001',
            productName: 'Biscoito Maria',
            shelfId: 'shelf-1',
            positionX: 12,
            positionY: 48,
            facings: 3,
            height: 25,
            visible: true,
            confidence: 0.95,
          },
          {
            productId: 'PROD-002',
            productName: 'Bolacha Cream Cracker',
            shelfId: 'shelf-1',
            positionX: 42,
            positionY: 51,
            facings: 3, // Faltando 1 facing
            height: 26,
            visible: true,
            confidence: 0.92,
          },
          {
            productId: 'PROD-003',
            productName: 'Wafer Chocolate',
            shelfId: 'shelf-2',
            positionX: 15, // Posição errada
            positionY: 82,
            facings: 5,
            height: 20,
            visible: true,
            confidence: 0.88,
          },
          {
            productId: 'PROD-004',
            productName: 'Rosquinha',
            shelfId: 'shelf-2',
            positionX: 61,
            positionY: 79,
            facings: 3,
            height: 22, // Altura errada
            visible: false, // Não visível
            confidence: 0.65,
          },
          // PROD-005 faltando (não detectado)
        ],

        areaQuality: {
          cleanliness: 92,
          signage: 78,
          lighting: 85,
        },

        previousExecution: {
          score: 82,
          executedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
        },
      };

      // Calcular breakdown
      const service = new ComplianceScoringService();
      const calculatedBreakdown = service.calculateBreakdown(mockExecutionData);
      setBreakdown(calculatedBreakdown);

    } catch (error) {
      console.error('Erro ao carregar execução:', error);
      alert('Erro ao carregar dados da execução');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = () => {
    if (!breakdown) return;

    // Gerar relatório em texto
    const report = `
RELATÓRIO DE CONFORMIDADE DE PLANOGRAMA
========================================

Execução ID: ${breakdown.executionId}
Data: ${breakdown.executedAt.toLocaleDateString('pt-BR')}

CONFORMIDADE TOTAL: ${breakdown.overallScore.toFixed(1)}%
Status: ${breakdown.overallStatus.toUpperCase()}

BREAKDOWN POR DIMENSÃO:
${breakdown.dimensions.map(dim =>
  `├─ ${dim.label}: ${dim.score.toFixed(1)}% (${dim.status})\n   ${dim.details.correct}/${dim.details.total} corretos`
).join('\n')}

PROBLEMAS IDENTIFICADOS (${breakdown.summary.totalIssues}):
${breakdown.dimensions.flatMap(dim =>
  dim.issues.map(issue => `- [${issue.severity.toUpperCase()}] ${issue.message}`)
).join('\n')}

RECOMENDAÇÕES:
${breakdown.dimensions.flatMap(dim => dim.suggestions).join('\n')}
    `.trim();

    // Download como arquivo texto
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-conformidade-${executionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto text-[#1F53A2] mb-4" />
          <p className="text-[#757575]">Carregando análise de conformidade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.back()}
                className="text-[#1F53A2] hover:text-[#153D7A]"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#212121]">
                  Análise de Conformidade
                </h1>
                <p className="text-sm text-[#757575] mt-1">
                  Execução #{executionId.slice(0, 8)}
                </p>
              </div>
            </div>

            <button
              onClick={handleExportReport}
              disabled={!breakdown}
              className="inline-flex items-center gap-2 bg-[#1F53A2] hover:bg-[#153D7A] text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 transition-all"
            >
              <Download className="w-4 h-4" />
              Exportar Relatório
            </button>
          </div>
        </div>

        {/* Breakdown Component */}
        {breakdown ? (
          <ComplianceScoreBreakdownView
            breakdown={breakdown}
            showDetails={true}
            onDimensionClick={(dimension) => {
              console.log('Dimensão clicada:', dimension);
            }}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum dado de conformidade disponível</p>
          </div>
        )}

        {/* Informações Adicionais */}
        <div className="mt-6 bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Informações da Execução
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">ID da Execução</p>
              <p className="font-semibold text-gray-900">{executionId.slice(0, 12)}...</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Loja</p>
              <p className="font-semibold text-gray-900">{executionData?.storeName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Template</p>
              <p className="font-semibold text-gray-900">{executionData?.templateName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Executado em</p>
              <p className="font-semibold text-gray-900">
                {breakdown?.executedAt.toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
