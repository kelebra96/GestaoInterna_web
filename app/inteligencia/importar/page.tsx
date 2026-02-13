'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  RefreshCw,
  TrendingDown,
  Package,
  Building2,
  Brain,
  Lightbulb,
  Activity,
  Target,
} from 'lucide-react';

interface Store {
  id: string;
  name: string;
}

// Tipos
interface PreviewData {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
}

interface ImportResult {
  success: boolean;
  job?: {
    id: string;
    status: string;
    recordsCreated: number;
    totalQuantity: number;
    totalValue: number;
  };
  error?: string;
}

interface AnalysisResult {
  recommendationsCreated: number;
  anomaliesDetected: number;
  clustersCreated: number;
  predictionsGenerated: number;
  errors: string[];
}

interface ColumnMapping {
  source: string;
  target: string;
  required: boolean;
  type: string;
}

// Mapeamento de colunas para o arquivo DADOS_MOVIMENTACAO_INTERNA.xlsx
const MOVIMENTACAO_COLUMN_MAPPING: ColumnMapping[] = [
  { source: 'CATEGORIA', target: 'category', required: false, type: 'string' },
  { source: 'CODIGO', target: 'sku', required: true, type: 'string' },
  { source: 'DESCCOMPLETA', target: 'productName', required: true, type: 'string' },
  { source: 'QUANTIDADE', target: 'quantity', required: true, type: 'number' },
  { source: 'FANTASIA', target: 'supplier', required: false, type: 'string' },
  { source: 'MOTIVO', target: 'lossReason', required: false, type: 'string' },
  { source: 'CUSTO', target: 'unitCost', required: false, type: 'currency' },
  { source: 'VENDA', target: 'salePrice', required: false, type: 'currency' },
];

// Mapeamento de motivos para tipo de perda
const MOTIVO_TO_LOSS_TYPE: Record<string, string> = {
  'PRAZO DE VALIDADE VENCIDO': 'vencimento',
  'VALIDADE': 'vencimento',
  'AVARIA': 'avaria',
  'QUEBRA': 'quebra',
  'ROUBO': 'roubo',
  'FURTO': 'roubo',
  'AJUSTE': 'ajuste',
};

export default function ImportarDadosPage() {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [stores, setStores] = useState<Store[]>([]);
  const [importDate, setImportDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Estatísticas do preview
  const [previewStats, setPreviewStats] = useState<{
    totalQuantity: number;
    totalCost: number;
    totalSaleValue: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  } | null>(null);

  // Helper para obter headers de autenticação
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!firebaseUser) return {};
    const token = await firebaseUser.getIdToken(true);
    const userRecord = user as unknown as Record<string, unknown>;
    const userPayload = {
      userId: firebaseUser.uid,
      orgId: userRecord?.companyId || userRecord?.storeId || '',
      role: userRecord?.role || 'store_user',
      storeIds: [],
    };
    return {
      Authorization: `Bearer ${token}`,
      'x-user-payload': JSON.stringify(userPayload),
    };
  }, [firebaseUser, user]);

  // Fetch stores on mount
  useEffect(() => {
    async function fetchStores() {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/lojas', { headers });
        if (response.ok) {
          const data = await response.json();
          setStores(data.lojas || data || []);
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
      }
    }
    if (firebaseUser) {
      fetchStores();
    }
  }, [firebaseUser, getAuthHeaders]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);
      setResult(null);
      setPreview(null);
      setPreviewStats(null);
      setIsLoading(true);

      try {
        // Preview via API
        const formData = new FormData();
        formData.append('file', file);

        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/imports/preview', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Falha ao processar arquivo');
        }

        const data = await response.json();

        if (data.success && data.preview) {
          setPreview({
            headers: data.preview.headers,
            sampleRows: data.preview.sampleRows,
            totalRows: data.preview.totalRows,
          });

          // Calcular estatísticas
          const stats = calculateStats(data.preview.sampleRows);
          setPreviewStats(stats);
        }
      } catch (error) {
        console.error('Error previewing file:', error);
        setResult({
          success: false,
          error:
            error instanceof Error ? error.message : 'Erro ao processar arquivo',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const calculateStats = (rows: Record<string, unknown>[]) => {
    let totalQuantity = 0;
    let totalCost = 0;
    let totalSaleValue = 0;
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    rows.forEach((row) => {
      const qty = Number(row['QUANTIDADE']) || 0;
      const cost = Number(String(row['CUSTO']).replace(',', '.')) || 0;
      const sale = Number(String(row['VENDA']).replace(',', '.')) || 0;
      const motivo = String(row['MOTIVO'] || '').toUpperCase();
      const categoria = String(row['CATEGORIA'] || 'SEM CATEGORIA');

      totalQuantity += qty;
      totalCost += cost;
      totalSaleValue += sale;

      // Determinar tipo de perda
      let lossType = 'outros';
      for (const [key, value] of Object.entries(MOTIVO_TO_LOSS_TYPE)) {
        if (motivo.includes(key)) {
          lossType = value;
          break;
        }
      }

      byType[lossType] = (byType[lossType] || 0) + qty;
      byCategory[categoria] = (byCategory[categoria] || 0) + qty;
    });

    return { totalQuantity, totalCost, totalSaleValue, byType, byCategory };
  };

  // Executar analise ML apos importacao
  const runMLAnalysis = useCallback(async (jobId: string) => {
    setIsAnalyzing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/ml/analyze', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ importJobId: jobId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalysisResult(data.data);
        }
      }
    } catch (error) {
      console.error('Error running ML analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [getAuthHeaders]);

  const handleImport = useCallback(async () => {
    if (!selectedFile || !selectedStore) {
      setResult({
        success: false,
        error: 'Selecione um arquivo e uma loja',
      });
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('storeId', selectedStore);
      formData.append('importType', 'losses');
      formData.append(
        'config',
        JSON.stringify({
          columnMapping: MOVIMENTACAO_COLUMN_MAPPING,
          hasHeader: true,
          dateFormat: 'DD/MM/YYYY',
          defaultDate: importDate,
        })
      );

      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/imports/jobs', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          job: {
            id: data.job.id,
            status: data.job.status,
            recordsCreated: data.job.recordsCreated || 0,
            totalQuantity: data.job.totalQuantity || 0,
            totalValue: data.job.totalValue || 0,
          },
        });
        // Executar analise ML automaticamente
        runMLAnalysis(data.job.id);
      } else {
        setResult({
          success: false,
          error: data.error || 'Erro ao importar dados',
        });
      }
    } catch (error) {
      console.error('Error importing:', error);
      setResult({
        success: false,
        error:
          error instanceof Error ? error.message : 'Erro ao importar dados',
      });
    } finally {
      setIsImporting(false);
    }
  }, [selectedFile, selectedStore, importDate, getAuthHeaders, runMLAnalysis]);

  const resetForm = () => {
    setSelectedFile(null);
    setPreview(null);
    setPreviewStats(null);
    setResult(null);
    setAnalysisResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => router.push('/inteligencia')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Inteligencia
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Upload className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Importar Dados de Perdas
              </h1>
              <p className="text-white/80 mt-1">
                Importe arquivos Excel com dados de movimentacao interna para
                analise
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resultado da importacao */}
        {result && (
          <div
            className={`mb-6 p-6 rounded-2xl ${
              result.success
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-start gap-4">
              {result.success ? (
                <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3
                  className={`font-semibold text-lg ${
                    result.success ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  {result.success
                    ? 'Importacao Concluida!'
                    : 'Erro na Importacao'}
                </h3>
                {result.success && result.job && (
                  <div className="mt-2 space-y-1 text-emerald-700">
                    <p>Registros criados: {result.job.recordsCreated}</p>
                    <p>
                      Quantidade total:{' '}
                      {result.job.totalQuantity.toLocaleString('pt-BR')}
                    </p>
                    <p>
                      Valor total: R${' '}
                      {result.job.totalValue.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                )}

                {/* Analise ML */}
                {result.success && (
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-emerald-800">Analise Inteligente</span>
                    </div>

                    {isAnalyzing ? (
                      <div className="flex items-center gap-2 text-emerald-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando insights e recomendacoes...</span>
                      </div>
                    ) : analysisResult ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-emerald-100 rounded-lg p-3 text-center">
                          <Lightbulb className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                          <p className="text-xl font-bold text-emerald-800">{analysisResult.recommendationsCreated}</p>
                          <p className="text-xs text-emerald-600">Recomendacoes</p>
                        </div>
                        <div className="bg-amber-100 rounded-lg p-3 text-center">
                          <Activity className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                          <p className="text-xl font-bold text-amber-800">{analysisResult.anomaliesDetected}</p>
                          <p className="text-xs text-amber-600">Anomalias</p>
                        </div>
                        <div className="bg-blue-100 rounded-lg p-3 text-center">
                          <Target className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                          <p className="text-xl font-bold text-blue-800">{analysisResult.clustersCreated}</p>
                          <p className="text-xs text-blue-600">Clusters</p>
                        </div>
                        <div className="bg-purple-100 rounded-lg p-3 text-center">
                          <TrendingDown className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                          <p className="text-xl font-bold text-purple-800">{analysisResult.predictionsGenerated}</p>
                          <p className="text-xs text-purple-600">Predicoes</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                {result.error && (
                  <p className="mt-2 text-red-700">{result.error}</p>
                )}
              </div>
              {result.success && (
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push('/inteligencia')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                  >
                    Ver Dashboard
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-[#132440] mb-4">
              1. Selecionar Arquivo
            </h2>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-[#3B9797] bg-[#3B9797]/5'
                  : 'border-gray-300 hover:border-[#3B9797]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-[#3B9797] animate-spin" />
                  <p className="text-gray-600">Processando arquivo...</p>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="w-12 h-12 text-[#3B9797]" />
                  <div>
                    <p className="font-medium text-[#132440]">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-12 h-12 text-gray-400" />
                  <div>
                    <p className="font-medium text-[#132440]">
                      Clique para selecionar arquivo
                    </p>
                    <p className="text-sm text-gray-500">
                      Excel (.xlsx, .xls) ou CSV
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Info sobre formato esperado */}
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Formato esperado:</p>
                  <p>
                    O arquivo deve conter colunas como CATEGORIA, CODIGO,
                    DESCCOMPLETA, QUANTIDADE, FANTASIA, MOTIVO, CUSTO, VENDA.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Config Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-[#132440] mb-4">
              2. Configurar Importacao
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loja de Destino *
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3B9797] focus:border-transparent"
                >
                  <option value="">Selecione uma loja</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data da Ocorrencia
                </label>
                <input
                  type="date"
                  value={importDate}
                  onChange={(e) => setImportDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3B9797] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Data padrao para registros sem data especifica
                </p>
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={!selectedFile || !selectedStore || isImporting}
              className="mt-6 w-full py-4 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white rounded-xl font-semibold
                disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Importar Dados
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview Section */}
        {preview && (
          <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#132440] flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Preview dos Dados
              </h2>
              <span className="text-sm text-gray-500">
                {preview.totalRows.toLocaleString('pt-BR')} registros
              </span>
            </div>

            {/* Estatisticas do Preview */}
            {previewStats && (
              <div className="grid sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-[#16476A] to-[#3B9797] rounded-xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 opacity-80" />
                    <span className="text-sm opacity-80">Quantidade</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {previewStats.totalQuantity.toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-[#BF092F] to-[#8B0000] rounded-xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 opacity-80" />
                    <span className="text-sm opacity-80">Custo Total</span>
                  </div>
                  <p className="text-2xl font-bold">
                    R${' '}
                    {previewStats.totalCost.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 opacity-80" />
                    <span className="text-sm opacity-80">Valor Venda</span>
                  </div>
                  <p className="text-2xl font-bold">
                    R${' '}
                    {previewStats.totalSaleValue.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 opacity-80" />
                    <span className="text-sm opacity-80">Tipos de Perda</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {Object.keys(previewStats.byType).length}
                  </p>
                </div>
              </div>
            )}

            {/* Distribuicao por tipo */}
            {previewStats && Object.keys(previewStats.byType).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Distribuicao por Tipo de Perda
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(previewStats.byType).map(([type, count]) => (
                    <span
                      key={type}
                      className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                    >
                      {type}: {count.toLocaleString('pt-BR')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabela de preview */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {preview.headers.slice(0, 8).map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.sampleRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {preview.headers.slice(0, 8).map((header) => (
                        <td
                          key={header}
                          className="px-3 py-2 text-gray-900 truncate max-w-[200px]"
                        >
                          {String(row[header] || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.sampleRows.length > 5 && (
              <p className="text-center text-sm text-gray-500 mt-4">
                Mostrando 5 de {preview.totalRows.toLocaleString('pt-BR')}{' '}
                registros
              </p>
            )}
          </div>
        )}

        {/* Instrucoes */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-[#132440] mb-4">
            Como Funciona
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-[#3B9797]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#3B9797] font-bold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-[#132440]">
                  Selecione o arquivo
                </h3>
                <p className="text-sm text-gray-600">
                  Escolha o arquivo Excel com os dados de movimentacao interna
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-[#3B9797]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#3B9797] font-bold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-[#132440]">Configure e revise</h3>
                <p className="text-sm text-gray-600">
                  Selecione a loja e verifique o preview dos dados
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-[#3B9797]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#3B9797] font-bold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-[#132440]">Analise os dados</h3>
                <p className="text-sm text-gray-600">
                  Apos importar, acesse o dashboard de inteligencia para
                  analises
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
