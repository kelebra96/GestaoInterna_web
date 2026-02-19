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
  Package,
  ShoppingCart,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Building2,
  ChevronDown,
  Clock,
  BarChart3,
  Calculator,
} from 'lucide-react';
import { TipoRelatorioABC, ImportPreview, ImportResult } from '@/lib/types/retail-import';

interface Store {
  id: string;
  name: string;
  code?: string;
}

// Configuração dos tipos de relatório
const TIPOS_RELATORIO = [
  {
    id: 'estoque' as TipoRelatorioABC,
    nome: 'ABC de Estoque',
    descricao: 'Giro, cobertura, capital investido',
    icon: Package,
    cor: 'from-blue-500 to-blue-600',
    corLight: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'vendas' as TipoRelatorioABC,
    nome: 'ABC de Vendas',
    descricao: 'Faturamento, margens, promoções',
    icon: ShoppingCart,
    cor: 'from-emerald-500 to-emerald-600',
    corLight: 'bg-emerald-50 border-emerald-200',
  },
  {
    id: 'perdas' as TipoRelatorioABC,
    nome: 'ABC de Perdas',
    descricao: 'Quebras, vencimentos, avarias',
    icon: TrendingDown,
    cor: 'from-red-500 to-red-600',
    corLight: 'bg-red-50 border-red-200',
  },
  {
    id: 'rupturas' as TipoRelatorioABC,
    nome: 'ABC de Rupturas',
    descricao: 'Vendas perdidas por falta',
    icon: AlertTriangle,
    cor: 'from-amber-500 to-amber-600',
    corLight: 'bg-amber-50 border-amber-200',
  },
];

interface UploadState {
  file: File | null;
  preview: ImportPreview | null;
  resultado: ImportResult | null;
  loading: boolean;
  error: string | null;
}

type UploadStates = Record<TipoRelatorioABC, UploadState>;

const initialUploadState: UploadState = {
  file: null,
  preview: null,
  resultado: null,
  loading: false,
  error: null,
};

// Componente de Progresso
interface ProgressState {
  visible: boolean;
  tipoAtual: TipoRelatorioABC | null;
  fase: 'upload' | 'produtos' | 'processando' | 'gravando' | 'consolidando' | 'concluido';
  progresso: number;
  totalArquivos: number;
  arquivoAtual: number;
  registrosProcessados: number;
  totalRegistros: number;
  mensagem: string;
}

function ProgressModal({ state, tipos }: { state: ProgressState; tipos: typeof TIPOS_RELATORIO }) {
  if (!state.visible) return null;

  const tipoConfig = tipos.find(t => t.id === state.tipoAtual);
  const Icon = tipoConfig?.icon || Package;

  const fases = [
    { id: 'upload', nome: 'Enviando arquivo', icone: Upload },
    { id: 'produtos', nome: 'Criando produtos', icone: Package },
    { id: 'processando', nome: 'Processando linhas', icone: FileSpreadsheet },
    { id: 'gravando', nome: 'Gravando no banco', icone: BarChart3 },
    { id: 'consolidando', nome: 'Consolidando métricas', icone: Calculator },
    { id: 'concluido', nome: 'Concluído', icone: CheckCircle },
  ];

  const faseAtualIdx = fases.findIndex(f => f.id === state.fase);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={`p-6 bg-gradient-to-r ${tipoConfig?.cor || 'from-[#16476A] to-[#3B9797]'} text-white`}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Importando Dados</h2>
              <p className="text-white/80">
                Arquivo {state.arquivoAtual} de {state.totalArquivos}
                {tipoConfig && ` · ${tipoConfig.nome}`}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar Principal */}
        <div className="p-6">
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 font-medium">{state.mensagem}</span>
              <span className="text-[#3B9797] font-bold">{Math.round(state.progresso)}%</span>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#16476A] to-[#3B9797] rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${state.progresso}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Registros */}
          {state.totalRegistros > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Registros processados</span>
                <span className="font-mono font-bold text-[#132440]">
                  {state.registrosProcessados.toLocaleString('pt-BR')} / {state.totalRegistros.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(state.registrosProcessados / state.totalRegistros) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Fases */}
          <div className="space-y-2">
            {fases.map((fase, idx) => {
              const FaseIcon = fase.icone;
              const isAtual = idx === faseAtualIdx;
              const isConcluido = idx < faseAtualIdx;
              const isPendente = idx > faseAtualIdx;

              return (
                <div
                  key={fase.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isAtual ? 'bg-[#3B9797]/10 border border-[#3B9797]/30' :
                    isConcluido ? 'bg-emerald-50' :
                    'bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isAtual ? 'bg-[#3B9797] text-white' :
                    isConcluido ? 'bg-emerald-500 text-white' :
                    'bg-gray-300 text-gray-500'
                  }`}>
                    {isConcluido ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : isAtual ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FaseIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`font-medium ${
                    isAtual ? 'text-[#3B9797]' :
                    isConcluido ? 'text-emerald-600' :
                    'text-gray-400'
                  }`}>
                    {fase.nome}
                  </span>
                  {isAtual && (
                    <div className="ml-auto flex items-center gap-1">
                      <span className="text-xs text-[#3B9797]">Em andamento</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-[#3B9797] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#3B9797] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#3B9797] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImportarVarejoPage() {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const fileInputRefs = useRef<Record<TipoRelatorioABC, HTMLInputElement | null>>({
    estoque: null,
    vendas: null,
    perdas: null,
    rupturas: null,
  });

  const [selectedStore, setSelectedStore] = useState<string>('');
  const [stores, setStores] = useState<Store[]>([]);
  const [dataReferencia, setDataReferencia] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [uploadStates, setUploadStates] = useState<UploadStates>({
    estoque: { ...initialUploadState },
    vendas: { ...initialUploadState },
    perdas: { ...initialUploadState },
    rupturas: { ...initialUploadState },
  });
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState<TipoRelatorioABC | null>(null);
  const [consolidando, setConsolidando] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState>({
    visible: false,
    tipoAtual: null,
    fase: 'upload',
    progresso: 0,
    totalArquivos: 0,
    arquivoAtual: 0,
    registrosProcessados: 0,
    totalRegistros: 0,
    mensagem: 'Preparando...',
  });

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

  // Buscar lojas
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

  // Handler de seleção de arquivo
  const handleFileSelect = useCallback(
    async (tipo: TipoRelatorioABC, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadStates((prev) => ({
        ...prev,
        [tipo]: { ...prev[tipo], file, loading: true, error: null, preview: null },
      }));

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('action', 'preview');
        formData.append('tipo', tipo);

        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/relatorios/importar', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });

        const data = await response.json();

        if (data.success && data.preview) {
          setUploadStates((prev) => ({
            ...prev,
            [tipo]: { ...prev[tipo], preview: data.preview, loading: false },
          }));
        } else {
          setUploadStates((prev) => ({
            ...prev,
            [tipo]: { ...prev[tipo], error: data.error || 'Erro ao processar', loading: false },
          }));
        }
      } catch (error) {
        setUploadStates((prev) => ({
          ...prev,
          [tipo]: {
            ...prev[tipo],
            error: error instanceof Error ? error.message : 'Erro ao processar',
            loading: false,
          },
        }));
      }
    },
    [getAuthHeaders]
  );

  // Simular progresso durante importação
  const simularProgresso = useCallback((
    tipo: TipoRelatorioABC,
    totalRegistros: number,
    onComplete: () => void
  ) => {
    const fases: ProgressState['fase'][] = ['upload', 'produtos', 'processando', 'gravando'];
    let faseIdx = 0;
    let progresso = 0;
    let registros = 0;

    const interval = setInterval(() => {
      progresso += Math.random() * 3 + 1;
      registros = Math.min(Math.floor((progresso / 90) * totalRegistros), totalRegistros);

      if (progresso >= 25 && faseIdx === 0) faseIdx = 1;
      if (progresso >= 40 && faseIdx === 1) faseIdx = 2;
      if (progresso >= 75 && faseIdx === 2) faseIdx = 3;

      if (progresso >= 90) {
        progresso = 90;
        clearInterval(interval);
      }

      const mensagens = {
        upload: 'Enviando arquivo para o servidor...',
        produtos: 'Criando produtos no catálogo...',
        processando: `Processando ${registros.toLocaleString('pt-BR')} registros...`,
        gravando: 'Gravando dados no banco...',
        consolidando: 'Consolidando métricas...',
        concluido: 'Importação concluída!',
      };

      setProgressState(prev => ({
        ...prev,
        tipoAtual: tipo,
        fase: fases[faseIdx],
        progresso,
        registrosProcessados: registros,
        totalRegistros,
        mensagem: mensagens[fases[faseIdx]],
      }));
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Importar um tipo específico
  const importarTipo = useCallback(
    async (tipo: TipoRelatorioABC, arquivoAtual: number, totalArquivos: number): Promise<boolean> => {
      const state = uploadStates[tipo];
      if (!state.file || !selectedStore) return false;

      const totalRegistros = state.preview?.totalRows || 1000;

      setUploadStates((prev) => ({
        ...prev,
        [tipo]: { ...prev[tipo], loading: true, error: null },
      }));

      // Iniciar progresso visual
      setProgressState(prev => ({
        ...prev,
        visible: true,
        tipoAtual: tipo,
        fase: 'upload',
        progresso: 0,
        totalArquivos,
        arquivoAtual,
        registrosProcessados: 0,
        totalRegistros,
        mensagem: 'Enviando arquivo para o servidor...',
      }));

      // Iniciar simulação de progresso
      let stopSimulation: (() => void) | undefined;
      new Promise<void>((resolve) => {
        stopSimulation = simularProgresso(tipo, totalRegistros, resolve);
      });

      try {
        const formData = new FormData();
        formData.append('file', state.file);
        formData.append('lojaId', selectedStore);
        formData.append('dataReferencia', dataReferencia);
        formData.append('tipo', tipo);

        const authHeaders = await getAuthHeaders();
        const response = await fetch('/api/relatorios/importar', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });

        const data = await response.json();

        // Parar simulação
        stopSimulation?.();

        if (data.success && data.resultado) {
          // Mostrar conclusão
          setProgressState(prev => ({
            ...prev,
            fase: 'concluido',
            progresso: 100,
            registrosProcessados: data.resultado.registrosImportados,
            mensagem: `${data.resultado.registrosImportados.toLocaleString('pt-BR')} registros importados!`,
          }));

          setUploadStates((prev) => ({
            ...prev,
            [tipo]: { ...prev[tipo], resultado: data.resultado, loading: false },
          }));

          // Aguardar um pouco para mostrar conclusão
          await new Promise(r => setTimeout(r, 500));
          return true;
        } else {
          setProgressState(prev => ({ ...prev, visible: false }));
          setUploadStates((prev) => ({
            ...prev,
            [tipo]: { ...prev[tipo], error: data.error || 'Erro na importação', loading: false },
          }));
          return false;
        }
      } catch (error) {
        stopSimulation?.();
        setProgressState(prev => ({ ...prev, visible: false }));
        setUploadStates((prev) => ({
          ...prev,
          [tipo]: {
            ...prev[tipo],
            error: error instanceof Error ? error.message : 'Erro na importação',
            loading: false,
          },
        }));
        return false;
      }
    },
    [uploadStates, selectedStore, dataReferencia, getAuthHeaders, simularProgresso]
  );

  // Importar todos os arquivos selecionados
  const importarTodos = async () => {
    if (!selectedStore) {
      alert('Selecione uma loja antes de importar');
      return;
    }

    const tiposComArquivo = TIPOS_RELATORIO.filter((t) => uploadStates[t.id].file);
    if (tiposComArquivo.length === 0) {
      alert('Selecione pelo menos um arquivo para importar');
      return;
    }

    setIsImportingAll(true);

    for (let i = 0; i < tiposComArquivo.length; i++) {
      const tipo = tiposComArquivo[i];
      await importarTipo(tipo.id, i + 1, tiposComArquivo.length);
    }

    // Fase de consolidação
    setProgressState(prev => ({
      ...prev,
      fase: 'consolidando',
      progresso: 90,
      mensagem: 'Consolidando métricas da rede...',
    }));

    setConsolidando(true);

    // Chamar API de consolidação
    try {
      const authHeaders = await getAuthHeaders();

      // 1. Consolidar métricas da rede (inclui todas as lojas)
      setProgressState(prev => ({
        ...prev,
        progresso: 92,
        mensagem: 'Calculando métricas de todas as lojas...',
      }));

      const resRede = await fetch('/api/varejo/consolidar', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: 'rede',
          periodo: dataReferencia,
          tipoPeriodo: 'mensal',
        }),
      });

      if (!resRede.ok) {
        console.warn('Aviso: Erro na consolidação da rede, continuando...');
      }

      // 2. Atualizar views materializadas
      setProgressState(prev => ({
        ...prev,
        progresso: 96,
        mensagem: 'Atualizando views de análise...',
      }));

      const resViews = await fetch('/api/varejo/consolidar', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tipo: 'views' }),
      });

      if (!resViews.ok) {
        console.warn('Aviso: Erro ao atualizar views, continuando...');
      }

    } catch (err) {
      console.error('Erro na consolidação:', err);
      // Continuar mesmo com erro na consolidação
    }

    // Conclusão final
    setProgressState(prev => ({
      ...prev,
      fase: 'concluido',
      progresso: 100,
      mensagem: 'Importação e consolidação concluídas! Dashboard atualizado.',
    }));

    await new Promise(r => setTimeout(r, 1000));

    setProgressState(prev => ({ ...prev, visible: false }));
    setConsolidando(false);
    setIsImportingAll(false);
  };

  // Limpar um tipo específico
  const limparTipo = (tipo: TipoRelatorioABC) => {
    setUploadStates((prev) => ({
      ...prev,
      [tipo]: { ...initialUploadState },
    }));
    if (fileInputRefs.current[tipo]) {
      fileInputRefs.current[tipo]!.value = '';
    }
  };

  // Limpar todos
  const limparTodos = () => {
    setUploadStates({
      estoque: { ...initialUploadState },
      vendas: { ...initialUploadState },
      perdas: { ...initialUploadState },
      rupturas: { ...initialUploadState },
    });
    Object.values(fileInputRefs.current).forEach((ref) => {
      if (ref) ref.value = '';
    });
  };

  // Contadores de sucesso
  const importadosComSucesso = TIPOS_RELATORIO.filter(
    (t) => uploadStates[t.id].resultado?.success
  ).length;
  const totalComArquivo = TIPOS_RELATORIO.filter((t) => uploadStates[t.id].file).length;

  // Formatadores
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal de Progresso */}
      <ProgressModal state={progressState} tipos={TIPOS_RELATORIO} />

      {/* Hero Header */}
      <div className="bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => router.push('/inteligencia')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Inteligência
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Importar Relatórios de Varejo
              </h1>
              <p className="text-white/80 mt-1">
                Importe os 4 relatórios ABC para análise completa de gestão
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuração Global */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#132440] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#3B9797]" />
            Configuração da Importação
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loja de Destino *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3B9797] focus:border-transparent appearance-none"
                >
                  <option value="">Selecione uma loja</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Referência *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={dataReferencia}
                  onChange={(e) => setDataReferencia(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3B9797] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Data do relatório (geralmente a data de extração)
              </p>
            </div>
          </div>
        </div>

        {/* Grid de Upload dos 4 Tipos */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {TIPOS_RELATORIO.map((tipo) => {
            const state = uploadStates[tipo.id];
            const Icon = tipo.icon;

            return (
              <div
                key={tipo.id}
                className={`bg-white rounded-2xl shadow-xl overflow-hidden border-2 transition-all ${
                  state.resultado?.success
                    ? 'border-emerald-300'
                    : state.error
                      ? 'border-red-300'
                      : state.file
                        ? 'border-[#3B9797]'
                        : 'border-transparent'
                }`}
              >
                {/* Header do Card */}
                <div className={`p-4 bg-gradient-to-r ${tipo.cor} text-white`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{tipo.nome}</h3>
                      <p className="text-sm text-white/80">{tipo.descricao}</p>
                    </div>
                    {state.resultado?.success && (
                      <CheckCircle className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>

                {/* Conteúdo */}
                <div className="p-4">
                  {/* Área de Upload */}
                  <div
                    onClick={() => fileInputRefs.current[tipo.id]?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      state.file
                        ? `${tipo.corLight}`
                        : 'border-gray-300 hover:border-[#3B9797]'
                    }`}
                  >
                    <input
                      ref={(el) => {
                        fileInputRefs.current[tipo.id] = el;
                      }}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => handleFileSelect(tipo.id, e)}
                      className="hidden"
                    />

                    {state.loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-[#3B9797] animate-spin" />
                        <p className="text-gray-600 text-sm">Processando...</p>
                      </div>
                    ) : state.file ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 text-[#3B9797]" />
                        <p className="font-medium text-[#132440] text-sm truncate max-w-full">
                          {state.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(state.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          Clique para selecionar
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Preview ou Resultado */}
                  {state.preview && !state.resultado && (
                    <div className="mt-4">
                      <button
                        onClick={() =>
                          setExpandedPreview(
                            expandedPreview === tipo.id ? null : tipo.id
                          )
                        }
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-[#3B9797]" />
                          <span className="text-sm font-medium">
                            {formatNumber(state.preview.totalRows)} registros
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            expandedPreview === tipo.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {expandedPreview === tipo.id && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Quantidade:</span>
                              <p className="font-medium">
                                {formatNumber(state.preview.stats.totalQuantity)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Valor:</span>
                              <p className="font-medium">
                                {formatCurrency(state.preview.stats.totalValue)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Produtos:</span>
                              <p className="font-medium">
                                {formatNumber(state.preview.stats.productCount)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Colunas:</span>
                              <p className="font-medium">
                                {state.preview.mappedColumns} mapeadas
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resultado da Importação */}
                  {state.resultado && (
                    <div
                      className={`mt-4 p-3 rounded-lg ${
                        state.resultado.success
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {state.resultado.success ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-medium">
                          {state.resultado.success ? 'Importado!' : 'Erro'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <span>Registros: {state.resultado.registrosImportados}</span>
                        <span>Valor: {formatCurrency(state.resultado.valorTotal)}</span>
                      </div>
                      {state.resultado.erros.length > 0 && (
                        <p className="text-xs mt-1 text-red-600">
                          {state.resultado.erros.length} erros encontrados
                        </p>
                      )}
                    </div>
                  )}

                  {/* Erro */}
                  {state.error && !state.resultado && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-800 text-sm flex items-center gap-2">
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      {state.error}
                    </div>
                  )}

                  {/* Botão Limpar */}
                  {state.file && (
                    <button
                      onClick={() => limparTipo(tipo.id)}
                      className="mt-3 w-full py-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra de Ações */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm text-gray-600">
                {totalComArquivo === 0
                  ? 'Selecione os arquivos para importar'
                  : `${totalComArquivo} arquivo(s) selecionado(s)`}
                {importadosComSucesso > 0 &&
                  ` · ${importadosComSucesso} importado(s)`}
              </p>
              {consolidando && (
                <p className="text-xs text-[#3B9797] flex items-center gap-1 mt-1">
                  <Calculator className="w-3 h-3 animate-pulse" />
                  Consolidando métricas...
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={limparTodos}
                disabled={totalComArquivo === 0}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Limpar Todos
              </button>

              <button
                onClick={importarTodos}
                disabled={!selectedStore || totalComArquivo === 0 || isImportingAll}
                className="px-6 py-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white rounded-xl font-semibold
                  disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all flex items-center gap-2"
              >
                {isImportingAll ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Importar Todos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-[#132440] mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#3B9797]" />
            Informações Importantes
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50 rounded-xl">
              <h3 className="font-medium text-blue-800 mb-2">Formato dos Arquivos</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Arquivos CSV com separador ponto-e-vírgula (;)</li>
                <li>• Codificação Latin1/ISO-8859-1 (padrão Windows)</li>
                <li>• Números com vírgula decimal (1.234,56)</li>
                <li>• Primeira linha com cabeçalho</li>
              </ul>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl">
              <h3 className="font-medium text-emerald-800 mb-2">Após a Importação</h3>
              <ul className="text-sm text-emerald-700 space-y-1">
                <li>• Métricas são consolidadas automaticamente</li>
                <li>• RFE (Risk Financial Exposure) é calculado</li>
                <li>• Dashboard executivo é atualizado</li>
                <li>• Histórico de importações é mantido</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              onClick={() => router.push('/inteligencia/executivo')}
              className="px-6 py-3 bg-[#3B9797] text-white rounded-xl hover:bg-[#2D7A7A] transition-colors flex items-center gap-2"
            >
              <BarChart3 className="w-5 h-5" />
              Ver Dashboard Executivo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
