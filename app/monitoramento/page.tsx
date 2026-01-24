'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Shield,
  Zap,
  Bug,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  RefreshCw,
  Server,
  Database,
  Lock,
  Gauge,
  FileSearch,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bot,
  Code,
  Lightbulb
} from 'lucide-react';

interface TestRun {
  id: string;
  test_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  coverage_percent: number | null;
}

interface SystemHealth {
  check_type: string;
  endpoint: string;
  status: string;
  response_time_ms: number;
  checked_at: string;
}

interface SecurityScan {
  id: string;
  scan_type: string;
  status: string;
  vulnerabilities_found: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  started_at: string;
}

interface MonitoringData {
  stats: {
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    avgCoverage: number;
    healthyEndpoints: number;
    degradedEndpoints: number;
    unhealthyEndpoints: number;
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
  };
  latestByType: Record<string, TestRun | null>;
  testRuns: TestRun[];
  systemHealth: SystemHealth[];
  securityScans: SecurityScan[];
  lastUpdated: string;
}

interface AiSolution {
  testName: string;
  diagnosis: string;
  severity: string;
  suggestedFix: string;
  codeSnippet?: string;
}

const TEST_TYPES = [
  { key: 'unit', label: 'Unitários', icon: Bug, description: 'Testa funções e componentes isoladamente' },
  { key: 'load', label: 'Carga', icon: Gauge, description: 'Testa performance com múltiplas requisições' },
  { key: 'stress', label: 'Stress', icon: Zap, description: 'Testa capacidade máxima do sistema' },
  { key: 'regression', label: 'Regressão', icon: FileSearch, description: 'Verifica se funcionalidades existentes funcionam' },
  { key: 'quality', label: 'Qualidade', icon: TrendingUp, description: 'Analisa performance, SEO e acessibilidade' },
  { key: 'security', label: 'Segurança', icon: Shield, description: 'Verifica vulnerabilidades e boas práticas' },
];

export default function MonitoramentoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'tests', 'health']));
  const [error, setError] = useState<string | null>(null);
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  
  // AI Fix States
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiSolutions, setAiSolutions] = useState<AiSolution[] | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Verificar acesso - apenas developers
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== 'developer') {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  // Buscar dados de monitoramento
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Monitoramento] Fetching data...');

      const response = await fetch('/api/monitoring', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Monitoramento] Data received:', result);
        setData(result);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Monitoramento] Error:', errorData);
        setError(errorData.error || 'Erro ao carregar dados');
      }
    } catch (err) {
      console.error('[Monitoramento] Exception:', err);
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Atualizar a cada 60 segundos
    return () => clearInterval(interval);
  }, [fetchData]);

  // Executar teste
  const runTest = async (testType: string) => {
    if (runningTests.has(testType)) {
      console.log('[Monitoramento] Test already running:', testType);
      return;
    }

    console.log('[Monitoramento] Starting test:', testType);
    setRunningTests(prev => new Set(prev).add(testType));

    try {
      const response = await fetch('/api/monitoring/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, userId: user?.uid }),
      });

      const result = await response.json();
      console.log('[Monitoramento] Test result:', result);

      if (response.ok) {
        // Atualizar dados após o teste
        await fetchData();
      } else {
        console.error('[Monitoramento] Test error:', result);
        alert(`Erro ao executar teste: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('[Monitoramento] Test exception:', err);
      alert('Erro ao executar teste. Verifique o console.');
    } finally {
      setRunningTests(prev => {
        const next = new Set(prev);
        next.delete(testType);
        return next;
      });
    }
  };

  // Executar health check
  const runHealthCheck = async () => {
    if (runningHealthCheck) return;

    console.log('[Monitoramento] Starting health check...');
    setRunningHealthCheck(true);

    try {
      const response = await fetch('/api/monitoring/health', {
        cache: 'no-store',
      });

      const result = await response.json();
      console.log('[Monitoramento] Health check result:', result);

      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('[Monitoramento] Health check exception:', err);
    } finally {
      setRunningHealthCheck(false);
    }
  };

  // AI Analysis Logic
  const runAiAnalysis = async () => {
    if (analyzingAi) return;
    
    setAnalyzingAi(true);
    setError(null);
    
    try {
      const response = await fetch('/api/monitoring/ai-fix', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro na análise de IA');
      }
      
      setAiSolutions(result.solutions);
      setShowAiModal(true);
      
    } catch (err: any) {
      console.error('[AI Fix] Exception:', err);
      alert('Erro ao executar análise de IA: ' + err.message);
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Toggle seção
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Componente de status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; text: string; icon: any }> = {
      passed: { bg: 'bg-[#3B9797]/20', text: 'text-[#3B9797]', icon: CheckCircle },
      healthy: { bg: 'bg-[#3B9797]/20', text: 'text-[#3B9797]', icon: CheckCircle },
      failed: { bg: 'bg-[#BF092F]/20', text: 'text-[#BF092F]', icon: XCircle },
      unhealthy: { bg: 'bg-[#BF092F]/20', text: 'text-[#BF092F]', icon: XCircle },
      running: { bg: 'bg-[#16476A]/20', text: 'text-[#16476A]', icon: RefreshCw },
      degraded: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
      error: { bg: 'bg-[#BF092F]/20', text: 'text-[#BF092F]', icon: AlertCircle },
    };

    const { bg, text, icon: Icon } = config[status] || config.error;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
        <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#132440] to-[#16476A]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'developer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#132440] to-[#16476A]">
        <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
          <Lock className="w-16 h-16 text-[#BF092F] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#132440] mb-2">Acesso Restrito</h2>
          <p className="text-[#757575]">Esta página é exclusiva para desenvolvedores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#132440] via-[#16476A] to-[#3B9797] shadow-2xl">
        <div className="max-w-[1800px] mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <Activity className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Monitoramento & Testes</h1>
                <p className="text-[#E0E7EF]">Sistema de controle de qualidade e segurança</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={runHealthCheck}
                disabled={runningHealthCheck}
                className="flex items-center gap-2 px-4 py-2 bg-[#3B9797] hover:bg-[#3B9797]/80 text-white rounded-lg transition-all disabled:opacity-50"
              >
                <Server className={`w-5 h-5 ${runningHealthCheck ? 'animate-pulse' : ''}`} />
                {runningHealthCheck ? 'Verificando...' : 'Health Check'}
              </button>

              <button
                onClick={runAiAnalysis}
                disabled={analyzingAi}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg transition-all disabled:opacity-50 shadow-lg border border-white/20"
              >
                <Sparkles className={`w-5 h-5 ${analyzingAi ? 'animate-spin' : ''}`} />
                {analyzingAi ? 'Analisando...' : 'Correção Pela IA'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-[#BF092F]/10 border-2 border-[#BF092F]/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-[#BF092F]" />
            <div>
              <p className="font-semibold text-[#BF092F]">Erro ao carregar dados</p>
              <p className="text-sm text-[#757575]">{error}</p>
            </div>
            <button
              onClick={fetchData}
              className="ml-auto px-4 py-2 bg-[#BF092F] text-white rounded-lg hover:bg-[#BF092F]/80"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-[#16476A] animate-spin mx-auto mb-4" />
              <p className="text-[#757575]">Carregando dados de monitoramento...</p>
            </div>
          </div>
        )}

        {/* Overview Stats */}
        <section className="mb-8">
          <div
            className="flex items-center justify-between cursor-pointer bg-white rounded-t-2xl px-6 py-4 border-2 border-[#E0E0E0]"
            onClick={() => toggleSection('overview')}
          >
            <h2 className="text-xl font-bold text-[#132440] flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#3B9797]" />
              Visão Geral
            </h2>
            {expandedSections.has('overview') ? <ChevronUp className="text-[#757575]" /> : <ChevronDown className="text-[#757575]" />}
          </div>

          {expandedSections.has('overview') && (
            <div className="bg-white rounded-b-2xl border-2 border-t-0 border-[#E0E0E0] p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-[#16476A]/10 to-[#16476A]/5 p-4 rounded-xl border border-[#16476A]/20">
                  <p className="text-sm text-[#16476A] font-medium">Total de Execuções</p>
                  <p className="text-3xl font-bold text-[#16476A]">{data?.stats?.totalRuns || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-[#3B9797]/10 to-[#3B9797]/5 p-4 rounded-xl border border-[#3B9797]/20">
                  <p className="text-sm text-[#3B9797] font-medium">Testes Passando</p>
                  <p className="text-3xl font-bold text-[#3B9797]">{data?.stats?.passedRuns || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-[#BF092F]/10 to-[#BF092F]/5 p-4 rounded-xl border border-[#BF092F]/20">
                  <p className="text-sm text-[#BF092F] font-medium">Testes Falhando</p>
                  <p className="text-3xl font-bold text-[#BF092F]">{data?.stats?.failedRuns || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-[#132440]/10 to-[#132440]/5 p-4 rounded-xl border border-[#132440]/20">
                  <p className="text-sm text-[#132440] font-medium">Cobertura Média</p>
                  <p className="text-3xl font-bold text-[#132440]">{data?.stats?.avgCoverage?.toFixed(0) || 0}%</p>
                </div>
                <div className="bg-gradient-to-br from-[#3B9797]/10 to-[#3B9797]/5 p-4 rounded-xl border border-[#3B9797]/20">
                  <p className="text-sm text-[#3B9797] font-medium">Endpoints Saudáveis</p>
                  <p className="text-3xl font-bold text-[#3B9797]">{data?.stats?.healthyEndpoints || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                  <p className="text-sm text-amber-700 font-medium">Vulnerabilidades</p>
                  <p className="text-3xl font-bold text-amber-700">{data?.stats?.totalVulnerabilities || 0}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Test Types Grid */}
        <section className="mb-8">
          <div
            className="flex items-center justify-between cursor-pointer bg-white rounded-t-2xl px-6 py-4 border-2 border-[#E0E0E0]"
            onClick={() => toggleSection('tests')}
          >
            <h2 className="text-xl font-bold text-[#132440] flex items-center gap-2">
              <Play className="w-6 h-6 text-[#3B9797]" />
              Executar Testes
            </h2>
            {expandedSections.has('tests') ? <ChevronUp className="text-[#757575]" /> : <ChevronDown className="text-[#757575]" />}
          </div>

          {expandedSections.has('tests') && (
            <div className="bg-white rounded-b-2xl border-2 border-t-0 border-[#E0E0E0] p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TEST_TYPES.map(({ key, label, icon: Icon, description }) => {
                  const latest = data?.latestByType?.[key];
                  const isRunning = runningTests.has(key);

                  return (
                    <div
                      key={key}
                      className="bg-gradient-to-br from-[#F8F9FA] to-white rounded-xl border-2 border-[#E0E0E0] overflow-hidden hover:shadow-lg transition-all"
                    >
                      <div className="bg-gradient-to-r from-[#132440] to-[#16476A] p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">Testes {label}</h3>
                              <p className="text-white/70 text-xs">{description}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        {latest ? (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <StatusBadge status={latest.status} />
                              <span className="text-xs text-[#757575]">
                                {new Date(latest.started_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                              <div className="bg-[#F8F9FA] rounded-lg p-2">
                                <p className="text-xs text-[#757575]">Total</p>
                                <p className="text-lg font-bold text-[#132440]">{latest.total_tests}</p>
                              </div>
                              <div className="bg-[#3B9797]/10 rounded-lg p-2">
                                <p className="text-xs text-[#3B9797]">Passou</p>
                                <p className="text-lg font-bold text-[#3B9797]">{latest.passed_tests}</p>
                              </div>
                              <div className="bg-[#BF092F]/10 rounded-lg p-2">
                                <p className="text-xs text-[#BF092F]">Falhou</p>
                                <p className="text-lg font-bold text-[#BF092F]">{latest.failed_tests}</p>
                              </div>
                            </div>
                            {latest.coverage_percent !== null && (
                              <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-[#757575]">Cobertura</span>
                                  <span className="font-bold text-[#132440]">{latest.coverage_percent}%</span>
                                </div>
                                <div className="w-full h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#16476A] to-[#3B9797] transition-all duration-500"
                                    style={{ width: `${latest.coverage_percent}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-4 text-[#757575]">
                            <p className="text-sm">Nenhum teste executado ainda</p>
                          </div>
                        )}

                        <button
                          onClick={() => runTest(key)}
                          disabled={isRunning}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                            isRunning
                              ? 'bg-[#E0E0E0] text-[#757575] cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white hover:opacity-90 hover:shadow-lg'
                          }`}
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              Executando...
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5" />
                              Executar Teste
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* System Health */}
        <section className="mb-8">
          <div
            className="flex items-center justify-between cursor-pointer bg-white rounded-t-2xl px-6 py-4 border-2 border-[#E0E0E0]"
            onClick={() => toggleSection('health')}
          >
            <h2 className="text-xl font-bold text-[#132440] flex items-center gap-2">
              <Server className="w-6 h-6 text-[#3B9797]" />
              Saúde do Sistema
            </h2>
            {expandedSections.has('health') ? <ChevronUp className="text-[#757575]" /> : <ChevronDown className="text-[#757575]" />}
          </div>

          {expandedSections.has('health') && (
            <div className="bg-white rounded-b-2xl border-2 border-t-0 border-[#E0E0E0] p-6">
              {!data?.systemHealth?.length ? (
                <div className="text-center py-8 text-[#757575]">
                  <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma verificação de saúde registrada</p>
                  <button
                    onClick={runHealthCheck}
                    disabled={runningHealthCheck}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-[#16476A] to-[#3B9797] text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {runningHealthCheck ? 'Verificando...' : 'Executar Health Check'}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[#E0E0E0]">
                        <th className="text-left py-3 px-4 font-semibold text-[#757575]">Serviço</th>
                        <th className="text-left py-3 px-4 font-semibold text-[#757575]">Endpoint</th>
                        <th className="text-left py-3 px-4 font-semibold text-[#757575]">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-[#757575]">Tempo de Resposta</th>
                        <th className="text-left py-3 px-4 font-semibold text-[#757575]">Verificado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.systemHealth.slice(0, 10).map((health, index) => (
                        <tr key={index} className="border-b border-[#E0E0E0] hover:bg-[#F8F9FA]">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {health.check_type === 'database' && <Database className="w-4 h-4 text-[#16476A]" />}
                              {health.check_type === 'auth' && <Lock className="w-4 h-4 text-[#3B9797]" />}
                              {health.check_type === 'api' && <Server className="w-4 h-4 text-[#132440]" />}
                              <span className="font-medium capitalize text-[#212121]">{health.check_type}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-sm text-[#757575]">{health.endpoint}</td>
                          <td className="py-3 px-4">
                            <StatusBadge status={health.status} />
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-medium ${
                              health.response_time_ms < 200 ? 'text-[#3B9797]' :
                              health.response_time_ms < 500 ? 'text-amber-600' : 'text-[#BF092F]'
                            }`}>
                              {health.response_time_ms}ms
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#757575] text-sm">
                            {new Date(health.checked_at).toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Security Scans */}
        <section className="mb-8">
          <div
            className="flex items-center justify-between cursor-pointer bg-white rounded-t-2xl px-6 py-4 border-2 border-[#E0E0E0]"
            onClick={() => toggleSection('security')}
          >
            <h2 className="text-xl font-bold text-[#132440] flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#BF092F]" />
              Varreduras de Segurança
            </h2>
            {expandedSections.has('security') ? <ChevronUp className="text-[#757575]" /> : <ChevronDown className="text-[#757575]" />}
          </div>

          {expandedSections.has('security') && (
            <div className="bg-white rounded-b-2xl border-2 border-t-0 border-[#E0E0E0] p-6">
              {!data?.securityScans?.length ? (
                <div className="text-center py-8 text-[#757575]">
                  <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma varredura de segurança registrada</p>
                  <button
                    onClick={() => runTest('security')}
                    disabled={runningTests.has('security')}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-[#BF092F] to-[#BF092F]/80 text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {runningTests.has('security') ? 'Executando...' : 'Executar Varredura'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.securityScans.map((scan) => (
                    <div key={scan.id} className="border-2 border-[#E0E0E0] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-[#BF092F]" />
                          <span className="font-semibold capitalize text-[#132440]">{scan.scan_type}</span>
                          <StatusBadge status={scan.status} />
                        </div>
                        <span className="text-sm text-[#757575]">
                          {new Date(scan.started_at).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-3">
                        <div className="bg-[#F8F9FA] rounded-lg p-3 text-center">
                          <p className="text-xs text-[#757575]">Total</p>
                          <p className="text-xl font-bold text-[#132440]">{scan.vulnerabilities_found}</p>
                        </div>
                        <div className="bg-[#BF092F]/10 rounded-lg p-3 text-center">
                          <p className="text-xs text-[#BF092F]">Crítico</p>
                          <p className="text-xl font-bold text-[#BF092F]">{scan.critical_count}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-amber-700">Alto</p>
                          <p className="text-xl font-bold text-amber-700">{scan.high_count}</p>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-yellow-700">Médio</p>
                          <p className="text-xl font-bold text-yellow-700">{scan.medium_count}</p>
                        </div>
                        <div className="bg-[#16476A]/10 rounded-lg p-3 text-center">
                          <p className="text-xs text-[#16476A]">Baixo</p>
                          <p className="text-xl font-bold text-[#16476A]">{scan.low_count}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-8 text-center text-[#757575] text-sm">
          <p>
            Última atualização: {data ? new Date(data.lastUpdated).toLocaleString('pt-BR') : '-'}
          </p>
        </footer>

        {/* AI Solutions Modal */}
        {showAiModal && aiSolutions && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
              
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Bot className="w-8 h-8 text-white" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Diagnóstico Inteligente</h2>
                    <p className="text-violet-100 text-sm">Análise e correções sugeridas pela IA</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <XCircle className="w-8 h-8" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar">
                {aiSolutions.length === 0 ? (
                  <div className="text-center py-12 text-[#757575]">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#132440]">Tudo parece ótimo!</h3>
                    <p>A IA não encontrou erros recentes que precisem de correção.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {aiSolutions.map((solution, idx) => (
                      <div key={idx} className="border-2 border-[#E0E0E0] rounded-xl overflow-hidden">
                        
                        <div className="bg-[#F8F9FA] px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
                          <h3 className="font-bold text-[#132440] flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            {solution.testName || 'Erro Genérico'}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            solution.severity === 'alta' ? 'bg-red-100 text-red-700' :
                            solution.severity === 'media' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            Severidade: {solution.severity || 'Desconhecida'}
                          </span>
                        </div>

                        <div className="p-6 space-y-4">
                          <div>
                            <h4 className="flex items-center gap-2 font-semibold text-[#132440] mb-2">
                              <FileSearch className="w-4 h-4 text-violet-600" />
                              Diagnóstico
                            </h4>
                            <p className="text-[#424242] bg-violet-50 p-4 rounded-lg text-sm leading-relaxed">
                              {solution.diagnosis}
                            </p>
                          </div>

                          <div>
                            <h4 className="flex items-center gap-2 font-semibold text-[#132440] mb-2">
                              <Lightbulb className="w-4 h-4 text-amber-500" />
                              Correção Sugerida
                            </h4>
                            <p className="text-[#424242] text-sm mb-3">
                              {solution.suggestedFix}
                            </p>
                            
                            {solution.codeSnippet && (
                              <div className="relative group">
                                <div className="absolute top-2 right-2 bg-[#132440] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                  Sugestão de Código
                                </div>
                                <pre className="bg-[#1e293b] text-blue-300 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-blue-900/50 shadow-inner">
                                  <code>{solution.codeSnippet}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-[#E0E0E0] bg-[#F8F9FA] text-center shrink-0">
                <p className="text-xs text-[#757575]">
                  * As sugestões são geradas por IA e devem ser revisadas por um desenvolvedor antes de serem aplicadas.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}