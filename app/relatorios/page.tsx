'use client';

import { useEffect, useState } from 'react';
import {
  RefreshCw,
  FileDown,
  BarChart3,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Download,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
  Package,
  Store,
  Users,
  Target,
  Zap,
} from 'lucide-react';

type Status = 'pending' | 'batched' | 'closed';

interface Dashboard {
  kpis: {
    totalSolicitacoes: number;
    totalUsuarios: number;
    usuariosAtivos: number;
    totalLojas: number;
    totalItens: number;
    solicitacoesHoje: number;
    solicitacoesOntem: number;
    mediaItensPorSolicitacao: number;
    taxaConversao: number;
    solicitacoesUltimos7Dias: number;
    mudancaSemanal: number;
  };
  solicitacoesPorStatus: {
    pending: number;
    batched: number;
    closed: number;
  };
  solicitacoesPorLoja: Array<{
    storeId: string;
    storeName: string;
    count: number;
  }>;
  solicitacoesRecentes: Array<{
    id: string;
    status: Status;
    createdAt: string;
    userName: string;
    storeName: string;
    storeId?: string;
  }>;
  chartData: Array<{ date: string; count: number }>;
  topProdutos: Array<{
    productId: string;
    productName: string;
    count: number;
    ean?: string;
  }>;
  rankingPorLoja: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  rankingPorComprador: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  rankingPorProduto: Array<{
    id: string;
    name: string;
    count: number;
    details?: string;
  }>;
  lastUpdated: string;
}

type ReportType = 'solicitacoes' | 'produtos' | 'lojas' | 'usuarios' | 'performance' | 'tendencias';
type PeriodType = '7d' | '15d' | '30d' | '60d' | '90d' | '6m' | '1y' | 'custom';

export default function RelatoriosPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportType>('solicitacoes');
  const [period, setPeriod] = useState<PeriodType>('30d');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    detalhes: true,
    analise: true,
    comparativo: true,
  });
  const [formattedLastUpdated, setFormattedLastUpdated] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) throw new Error('Falha ao carregar dados');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (data?.lastUpdated) {
      setFormattedLastUpdated(
        new Date(data.lastUpdated).toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    }
  }, [data?.lastUpdated]);

  const exportCsv = (rows: Array<Record<string, any>>, filename: string) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv = [headers.join(',')]
      .concat(rows.map((r) => headers.map((h) => escape(r[h])).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const reports = [
    { id: 'solicitacoes', label: 'Solicitações', icon: FileText, color: '#16476A' },
    { id: 'produtos', label: 'Produtos', icon: Package, color: '#3B9797' },
    { id: 'lojas', label: 'Lojas', icon: Store, color: '#F59E0B' },
    { id: 'usuarios', label: 'Usuários', icon: Users, color: '#132440' },
    { id: 'performance', label: 'Performance', icon: Target, color: '#BF092F' },
    { id: 'tendencias', label: 'Tendências', icon: TrendingUp, color: '#16476A' },
  ];

  const periods = [
    { id: '7d', label: '7 dias' },
    { id: '15d', label: '15 dias' },
    { id: '30d', label: '30 dias' },
    { id: '60d', label: '60 dias' },
    { id: '90d', label: '90 dias' },
    { id: '6m', label: '6 meses' },
    { id: '1y', label: '1 ano' },
  ];

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#16476A] to-[#132440] mb-6 animate-pulse">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-xl font-bold text-[#212121]">Gerando relatórios...</p>
          <p className="text-sm text-[#757575] mt-2">Processando dados analíticos</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl border border-[#E0E0E0]">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#BF092F] to-[#a50728] mb-6">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <p className="text-xl font-bold text-[#BF092F] mb-4">{error}</p>
          <p className="text-sm text-[#757575] mb-6">Não foi possível carregar os dados dos relatórios</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#16476A] to-[#132440] hover:from-[#16476A] hover:to-[#132440] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Cálculos gerais
  const totalSolicitacoes = data.kpis.totalSolicitacoes;
  const mediaItensDia = data.chartData.length > 0
    ? Math.round(data.chartData.reduce((sum, d) => sum + d.count, 0) / data.chartData.length)
    : 0;

  const solicitacoesPorDiaSemana = data.chartData.reduce((acc, d) => {
    const day = new Date(d.date).getDay();
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayName = dayNames[day];
    acc[dayName] = (acc[dayName] || 0) + d.count;
    return acc;
  }, {} as Record<string, number>);

  const crescimentoPercentual = data.chartData.length >= 14
    ? (() => {
        const primeirosSeteDias = data.chartData.slice(0, 7).reduce((sum, d) => sum + d.count, 0);
        const ultimosSeteDias = data.chartData.slice(-7).reduce((sum, d) => sum + d.count, 0);
        return primeirosSeteDias > 0
          ? Math.round(((ultimosSeteDias - primeirosSeteDias) / primeirosSeteDias) * 100)
          : 0;
      })()
    : 0;

  const taxaPendencia = data.kpis.totalSolicitacoes > 0
    ? Math.round((data.solicitacoesPorStatus.pending / data.kpis.totalSolicitacoes) * 100)
    : 0;

  const taxaConclusao = data.kpis.totalSolicitacoes > 0
    ? Math.round((data.solicitacoesPorStatus.closed / data.kpis.totalSolicitacoes) * 100)
    : 0;

  const produtosMaisSolicitados = data.topProdutos.slice(0, 20);
  const lojasMaisAtivas = data.solicitacoesPorLoja.slice(0, 20);

  // Renderizar conteúdo baseado no tipo de relatório
  const renderReportContent = () => {
    switch (selectedReport) {
      case 'solicitacoes':
        return (
          <>
            {/* Resumo Executivo - Solicitações */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <button
                  onClick={() => toggleSection('detalhes')}
                  className="w-full bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4 flex items-center justify-between hover:from-[#132440] hover:to-[#16476A] transition-all"
                >
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Resumo Executivo - Solicitações
                  </h2>
                  {expandedSections.detalhes ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
                </button>
                {expandedSections.detalhes && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-[#757575]">Total de Solicitações</span>
                          <FileText className="w-5 h-5 text-[#16476A]" />
                        </div>
                        <p className="text-3xl font-bold text-[#16476A]">{totalSolicitacoes.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-[#757575] mt-2">No período selecionado</p>
                      </div>

                      <div className="p-5 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-[#757575]">Média Diária</span>
                          <Calendar className="w-5 h-5 text-[#3B9797]" />
                        </div>
                        <p className="text-3xl font-bold text-[#3B9797]">{mediaItensDia.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-[#757575] mt-2">Solicitações por dia</p>
                      </div>

                      <div className="p-5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-[#757575]">Taxa de Conclusão</span>
                          {taxaConclusao >= 70 ? <TrendingUp className="w-5 h-5 text-[#3B9797]" /> : <TrendingDown className="w-5 h-5 text-[#BF092F]" />}
                        </div>
                        <p className="text-3xl font-bold text-amber-500">{taxaConclusao}%</p>
                        <p className="text-xs text-[#757575] mt-2">{data.solicitacoesPorStatus.closed} concluídas</p>
                      </div>

                      <div className="p-5 rounded-xl bg-gradient-to-br from-red-100 to-red-50 border-2 border-[#BF092F]/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-[#757575]">Crescimento</span>
                          {crescimentoPercentual >= 0 ? <TrendingUp className="w-5 h-5 text-[#3B9797]" /> : <TrendingDown className="w-5 h-5 text-[#BF092F]" />}
                        </div>
                        <p className={`text-3xl font-bold ${crescimentoPercentual >= 0 ? 'text-[#3B9797]' : 'text-[#BF092F]'}`}>
                          {crescimentoPercentual >= 0 ? '+' : ''}{crescimentoPercentual}%
                        </p>
                        <p className="text-xs text-[#757575] mt-2">Últimos 7 dias vs anteriores</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Análise por Dia da Semana */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div
                  onClick={() => toggleSection('analise')}
                  className="w-full bg-gradient-to-r from-[#132440] to-[#16476A] px-6 py-4 flex items-center justify-between hover:from-[#16476A] hover:to-[#132440] transition-all cursor-pointer"
                >
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Análise por Dia da Semana
                  </h2>
                  <div className="flex items-center gap-3">
                    {expandedSections.analise ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
                  </div>
                </div>
                <div className="px-6 py-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportCsv(
                        Object.entries(solicitacoesPorDiaSemana).map(([dia, count]) => ({ dia, quantidade: count })),
                        'analise_dia_semana.csv'
                      );
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 border-2 rounded-xl text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <Download className="w-4 h-4" /> CSV
                  </button>
                </div>
                {expandedSections.analise && (
                  <div className="p-6">
                    <div className="space-y-4">
                      {Object.entries(solicitacoesPorDiaSemana)
                        .sort((a, b) => b[1] - a[1])
                        .map(([dia, count]) => {
                          const maxCount = Math.max(...Object.values(solicitacoesPorDiaSemana));
                          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          return (
                            <div key={dia} className="flex items-center gap-4">
                              <div className="w-32">
                                <span className="text-sm font-bold text-[#212121]">{dia}</span>
                              </div>
                              <div className="flex-1 relative">
                                <div className="h-10 bg-[#F5F5F5] rounded-xl overflow-hidden border border-[#E0E0E0]">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#132440] to-[#16476A] flex items-center justify-end px-3 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  >
                                    {percentage > 15 && (
                                      <span className="text-sm font-bold text-white">{count}</span>
                                    )}
                                  </div>
                                </div>
                                {percentage <= 15 && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#212121]">{count}</span>
                                )}
                              </div>
                              <div className="w-20 text-right">
                                <span className="text-xs text-[#757575]">{Math.round(percentage)}%</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Análise de Status */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div
                  onClick={() => toggleSection('comparativo')}
                  className="w-full bg-gradient-to-r from-[#BF092F] to-[#a50728] px-6 py-4 flex items-center justify-between hover:from-[#a50728] hover:to-[#BF092F] transition-all cursor-pointer"
                >
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Análise Comparativa de Status
                  </h2>
                  <div className="flex items-center gap-3">
                    {expandedSections.comparativo ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
                  </div>
                </div>
                <div className="px-6 py-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportCsv([
                        { status: 'Pendentes', quantidade: data.solicitacoesPorStatus.pending, percentual: taxaPendencia },
                        { status: 'Agrupadas', quantidade: data.solicitacoesPorStatus.batched, percentual: Math.round((data.solicitacoesPorStatus.batched / data.kpis.totalSolicitacoes) * 100) },
                        { status: 'Concluídas', quantidade: data.solicitacoesPorStatus.closed, percentual: taxaConclusao },
                      ], 'analise_status.csv');
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 border-2 rounded-xl text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <Download className="w-4 h-4" /> CSV
                  </button>
                </div>
                {expandedSections.comparativo && (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/30">
                        <div className="text-center mb-4">
                          <span className="text-sm font-bold text-[#757575]">PENDENTES</span>
                        </div>
                        <div className="text-center mb-4">
                          <p className="text-5xl font-bold text-amber-500">{data.solicitacoesPorStatus.pending}</p>
                        </div>
                        <div className="h-3 bg-white/50 rounded-full overflow-hidden mb-3">
                          <div className="h-full bg-amber-500" style={{ width: `${taxaPendencia}%` }} />
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-bold text-amber-500">{taxaPendencia}%</span>
                          <p className="text-xs text-[#757575] mt-1">do total</p>
                        </div>
                      </div>

                      <div className="p-6 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/30">
                        <div className="text-center mb-4">
                          <span className="text-sm font-bold text-[#757575]">AGRUPADAS</span>
                        </div>
                        <div className="text-center mb-4">
                          <p className="text-5xl font-bold text-[#3B9797]">{data.solicitacoesPorStatus.batched}</p>
                        </div>
                        <div className="h-3 bg-white/50 rounded-full overflow-hidden mb-3">
                          <div className="h-full bg-[#3B9797]" style={{ width: `${Math.round((data.solicitacoesPorStatus.batched / data.kpis.totalSolicitacoes) * 100)}%` }} />
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-bold text-[#3B9797]">{Math.round((data.solicitacoesPorStatus.batched / data.kpis.totalSolicitacoes) * 100)}%</span>
                          <p className="text-xs text-[#757575] mt-1">do total</p>
                        </div>
                      </div>

                      <div className="p-6 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/30">
                        <div className="text-center mb-4">
                          <span className="text-sm font-bold text-[#757575]">CONCLUÍDAS</span>
                        </div>
                        <div className="text-center mb-4">
                          <p className="text-5xl font-bold text-[#16476A]">{data.solicitacoesPorStatus.closed}</p>
                        </div>
                        <div className="h-3 bg-white/50 rounded-full overflow-hidden mb-3">
                          <div className="h-full bg-[#16476A]" style={{ width: `${taxaConclusao}%` }} />
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-bold text-[#16476A]">{taxaConclusao}%</span>
                          <p className="text-xs text-[#757575] mt-1">do total</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                      <h3 className="text-sm font-bold text-[#757575] mb-3">INSIGHTS</h3>
                      <div className="space-y-2">
                        {taxaPendencia > 30 && (
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                            <p className="text-sm text-[#757575]">
                              <strong className="text-amber-500">Atenção:</strong> {taxaPendencia}% das solicitações estão pendentes. Considere revisar o fluxo de aprovação.
                            </p>
                          </div>
                        )}
                        {taxaConclusao >= 70 && (
                          <div className="flex items-start gap-2">
                            <TrendingUp className="w-4 h-4 text-[#3B9797] mt-0.5" />
                            <p className="text-sm text-[#757575]">
                              <strong className="text-[#3B9797]">Excelente:</strong> Taxa de conclusão de {taxaConclusao}% indica alta eficiência operacional.
                            </p>
                          </div>
                        )}
                        {crescimentoPercentual > 20 && (
                          <div className="flex items-start gap-2">
                            <TrendingUp className="w-4 h-4 text-[#16476A] mt-0.5" />
                            <p className="text-sm text-[#757575]">
                              <strong className="text-[#16476A]">Crescimento Acelerado:</strong> Aumento de {crescimentoPercentual}% nas últimas semanas.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );

      case 'produtos':
        return (
          <>
            {/* Resumo - Produtos */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Análise Detalhada de Produtos
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Total de Produtos</span>
                        <Package className="w-5 h-5 text-[#3B9797]" />
                      </div>
                      <p className="text-3xl font-bold text-[#3B9797]">{data.topProdutos.length.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-[#757575] mt-2">Produtos únicos solicitados</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Média por Produto</span>
                        <BarChart3 className="w-5 h-5 text-[#16476A]" />
                      </div>
                      <p className="text-3xl font-bold text-[#16476A]">
                        {data.topProdutos.length > 0
                          ? Math.round(data.topProdutos.reduce((sum, p) => sum + p.count, 0) / data.topProdutos.length)
                          : 0}
                      </p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações por produto</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Produto Mais Solicitado</span>
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                      </div>
                      <p className="text-3xl font-bold text-amber-500">
                        {data.topProdutos[0]?.count || 0}
                      </p>
                      <p className="text-xs text-[#757575] mt-2 truncate">{data.topProdutos[0]?.productName || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top 20 Produtos */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#3B9797] to-[#2c7a7a] px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Top 20 Produtos Mais Solicitados
                  </h2>
                  <button
                    onClick={() => exportCsv(
                      produtosMaisSolicitados.map((p, i) => ({
                        posicao: i + 1,
                        produto: p.productName,
                        ean: p.ean || '-',
                        quantidade: p.count,
                      })),
                      'top_20_produtos.csv'
                    )}
                    className="inline-flex items-center gap-2 px-3 py-2 border-2 rounded-xl text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-105"
                  >
                    <Download className="w-4 h-4" /> Exportar CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E0E0E0]">
                    <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider w-20">#</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Produto</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">EAN</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-[#16476A] uppercase tracking-wider">Quantidade</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-[#16476A] uppercase tracking-wider">% do Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E0E0E0]">
                      {produtosMaisSolicitados.map((produto, index) => {
                        const totalProdutos = data.topProdutos.reduce((sum, p) => sum + p.count, 0);
                        const percentage = totalProdutos > 0 ? (produto.count / totalProdutos) * 100 : 0;
                        return (
                          <tr key={produto.productId} className="hover:bg-green-50 transition-all duration-300">
                            <td className="px-6 py-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg' :
                                index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-md' :
                                index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md' :
                                'bg-[#F5F5F5] text-[#757575]'
                              }`}>
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-[#212121]">{produto.productName}</td>
                            <td className="px-6 py-4 text-sm font-mono text-[#757575]">{produto.ean || '-'}</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-[#3B9797]">{produto.count.toLocaleString('pt-BR')}</td>
                            <td className="px-6 py-4 text-right text-sm font-medium text-[#757575]">{percentage.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        );

      case 'lojas':
        return (
          <>
            {/* Resumo - Lojas */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Análise Detalhada de Lojas
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Total de Lojas</span>
                        <Store className="w-5 h-5 text-amber-500" />
                      </div>
                      <p className="text-3xl font-bold text-amber-500">{data.kpis.totalLojas.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-[#757575] mt-2">Lojas ativas</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Média por Loja</span>
                        <BarChart3 className="w-5 h-5 text-[#16476A]" />
                      </div>
                      <p className="text-3xl font-bold text-[#16476A]">
                        {data.kpis.totalLojas > 0
                          ? Math.round(totalSolicitacoes / data.kpis.totalLojas)
                          : 0}
                      </p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações por loja</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Loja Mais Ativa</span>
                        <TrendingUp className="w-5 h-5 text-[#3B9797]" />
                      </div>
                      <p className="text-3xl font-bold text-[#3B9797]">
                        {data.solicitacoesPorLoja[0]?.count || 0}
                      </p>
                      <p className="text-xs text-[#757575] mt-2 truncate">{data.solicitacoesPorLoja[0]?.storeName || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top 20 Lojas */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Top 20 Lojas Mais Ativas
                  </h2>
                  <button
                    onClick={() => exportCsv(
                      lojasMaisAtivas.map((l, i) => ({
                        posicao: i + 1,
                        loja: l.storeName,
                        quantidade: l.count,
                      })),
                      'top_20_lojas.csv'
                    )}
                    className="inline-flex items-center gap-2 px-3 py-2 border-2 rounded-xl text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-105"
                  >
                    <Download className="w-4 h-4" /> Exportar CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E0E0E0]">
                    <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider w-20">#</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Loja</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-[#16476A] uppercase tracking-wider">Solicitações</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-[#16476A] uppercase tracking-wider">% do Total</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-[#16476A] uppercase tracking-wider">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E0E0E0]">
                      {lojasMaisAtivas.map((loja, index) => {
                        const totalLojas = data.solicitacoesPorLoja.reduce((sum, l) => sum + l.count, 0);
                        const percentage = totalLojas > 0 ? (loja.count / totalLojas) * 100 : 0;
                        return (
                          <tr key={loja.storeId} className="hover:bg-amber-50 transition-all duration-300">
                            <td className="px-6 py-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg' :
                                index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-md' :
                                index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md' :
                                'bg-[#F5F5F5] text-[#757575]'
                              }`}>
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-[#212121]">{loja.storeName}</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-amber-500">{loja.count.toLocaleString('pt-BR')}</td>
                            <td className="px-6 py-4 text-right text-sm font-medium text-[#757575]">{percentage.toFixed(1)}%</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <div className="flex-1 h-2 bg-[#F5F5F5] rounded-full overflow-hidden max-w-[100px]">
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                                    style={{ width: `${Math.min(100, percentage * 5)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        );

      case 'usuarios':
        return (
          <>
            {/* Resumo - Usuários */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#132440] to-[#16476A] px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Análise Detalhada de Usuários
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-gray-200 to-gray-100 border-2 border-[#132440]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Total de Usuários</span>
                        <Users className="w-5 h-5 text-[#132440]" />
                      </div>
                      <p className="text-3xl font-bold text-[#132440]">{data.kpis.totalUsuarios.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-[#757575] mt-2">Usuários cadastrados</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Usuários Ativos</span>
                        <TrendingUp className="w-5 h-5 text-[#3B9797]" />
                      </div>
                      <p className="text-3xl font-bold text-[#3B9797]">{data.kpis.usuariosAtivos.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-[#757575] mt-2">
                        {Math.round((data.kpis.usuariosAtivos / data.kpis.totalUsuarios) * 100)}% do total
                      </p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Média por Usuário</span>
                        <BarChart3 className="w-5 h-5 text-[#16476A]" />
                      </div>
                      <p className="text-3xl font-bold text-[#16476A]">
                        {data.kpis.totalUsuarios > 0
                          ? Math.round(totalSolicitacoes / data.kpis.totalUsuarios)
                          : 0}
                      </p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações por usuário</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top 20 Compradores */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#132440] to-[#16476A] px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Top 20 Compradores Mais Ativos
                  </h2>
                  <button
                    onClick={() => exportCsv(
                      data.rankingPorComprador.slice(0, 20).map((c, i) => ({
                        posicao: i + 1,
                        comprador: c.name,
                        quantidade: c.count,
                      })),
                      'top_20_compradores.csv'
                    )}
                    className="inline-flex items-center gap-2 px-3 py-2 border-2 rounded-xl text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-105"
                  >
                    <Download className="w-4 h-4" /> Exportar CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E0E0E0]">
                    <thead className="bg-gradient-to-r from-[#F8F9FA] to-[#E9ECEF]">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider w-20">#</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-[#16476A] uppercase tracking-wider">Comprador</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-[#16476A] uppercase tracking-wider">Solicitações</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-[#16476A] uppercase tracking-wider">% do Total</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-[#16476A] uppercase tracking-wider">Atividade</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E0E0E0]">
                      {data.rankingPorComprador.slice(0, 20).map((comprador, index) => {
                        const totalCompradores = data.rankingPorComprador.reduce((sum, c) => sum + c.count, 0);
                        const percentage = totalCompradores > 0 ? (comprador.count / totalCompradores) * 100 : 0;
                        return (
                          <tr key={comprador.id} className="hover:bg-gray-100 transition-all duration-300">
                            <td className="px-6 py-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg' :
                                index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-md' :
                                index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md' :
                                'bg-[#F5F5F5] text-[#757575]'
                              }`}>
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-[#212121]">{comprador.name}</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-[#132440]">{comprador.count.toLocaleString('pt-BR')}</td>
                            <td className="px-6 py-4 text-right text-sm font-medium text-[#757575]">{percentage.toFixed(1)}%</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <div className="flex-1 h-2 bg-[#F5F5F5] rounded-full overflow-hidden max-w-[100px]">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#132440] to-[#16476A]"
                                    style={{ width: `${Math.min(100, percentage * 5)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        );

      case 'performance':
        return (
          <>
            {/* Resumo - Performance */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#BF092F] to-[#a50728] px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Análise de Performance Operacional
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Taxa de Conversão</span>
                        <Target className="w-5 h-5 text-[#16476A]" />
                      </div>
                      <p className="text-3xl font-bold text-[#16476A]">{data.kpis.taxaConversao}%</p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações processadas</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Média de Itens</span>
                        <Package className="w-5 h-5 text-[#3B9797]" />
                      </div>
                      <p className="text-3xl font-bold text-[#3B9797]">{data.kpis.mediaItensPorSolicitacao}</p>
                      <p className="text-xs text-[#757575] mt-2">Itens por solicitação</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Taxa de Pendência</span>
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      </div>
                      <p className="text-3xl font-bold text-amber-500">{taxaPendencia}%</p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações pendentes</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-red-100 to-red-50 border-2 border-[#BF092F]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Taxa de Conclusão</span>
                        {taxaConclusao >= 70 ? <TrendingUp className="w-5 h-5 text-[#3B9797]" /> : <TrendingDown className="w-5 h-5 text-[#BF092F]" />}
                      </div>
                      <p className={`text-3xl font-bold ${taxaConclusao >= 70 ? 'text-[#3B9797]' : 'text-[#BF092F]'}`}>
                        {taxaConclusao}%
                      </p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações concluídas</p>
                    </div>
                  </div>

                  {/* Insights de Performance */}
                  <div className="p-5 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                    <h3 className="text-sm font-bold text-[#757575] mb-4 uppercase">Insights de Performance</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                        <Zap className="w-5 h-5 text-[#16476A] mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-[#212121]">Eficiência Operacional</p>
                          <p className="text-xs text-[#757575] mt-1">
                            Sistema processando média de {mediaItensDia} solicitações por dia com {data.kpis.mediaItensPorSolicitacao} itens cada.
                          </p>
                        </div>
                      </div>

                      {taxaConclusao >= 70 && (
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <TrendingUp className="w-5 h-5 text-[#3B9797] mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-[#212121]">Alta Performance</p>
                            <p className="text-xs text-[#757575] mt-1">
                              Taxa de conclusão de {taxaConclusao}% indica excelente eficiência no processamento de solicitações.
                            </p>
                          </div>
                        </div>
                      )}

                      {taxaPendencia > 30 && (
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-[#212121]">Atenção Necessária</p>
                            <p className="text-xs text-[#757575] mt-1">
                              {taxaPendencia}% de pendência pode indicar gargalos no fluxo. Considere revisar processos de aprovação.
                            </p>
                          </div>
                        </div>
                      )}

                      {crescimentoPercentual > 20 && (
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <TrendingUp className="w-5 h-5 text-[#BF092F] mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-[#212121]">Crescimento Acelerado</p>
                            <p className="text-xs text-[#757575] mt-1">
                              Crescimento de {crescimentoPercentual}% nas últimas semanas. Verifique capacidade operacional.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      case 'tendencias':
        return (
          <>
            {/* Resumo - Tendências */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Análise de Tendências Temporais
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="p-5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-[#16476A]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Hoje</span>
                        <Calendar className="w-5 h-5 text-[#16476A]" />
                      </div>
                      <p className="text-3xl font-bold text-[#16476A]">{data.kpis.solicitacoesHoje}</p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações hoje</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border-2 border-[#3B9797]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Últimos 7 Dias</span>
                        <BarChart3 className="w-5 h-5 text-[#3B9797]" />
                      </div>
                      <p className="text-3xl font-bold text-[#3B9797]">{data.kpis.solicitacoesUltimos7Dias}</p>
                      <p className="text-xs text-[#757575] mt-2">Solicitações na semana</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Mudança Semanal</span>
                        {data.kpis.mudancaSemanal >= 0 ? <TrendingUp className="w-5 h-5 text-[#3B9797]" /> : <TrendingDown className="w-5 h-5 text-[#BF092F]" />}
                      </div>
                      <p className={`text-3xl font-bold ${data.kpis.mudancaSemanal >= 0 ? 'text-[#3B9797]' : 'text-[#BF092F]'}`}>
                        {data.kpis.mudancaSemanal >= 0 ? '+' : ''}{data.kpis.mudancaSemanal}%
                      </p>
                      <p className="text-xs text-[#757575] mt-2">vs semana anterior</p>
                    </div>

                    <div className="p-5 rounded-xl bg-gradient-to-br from-gray-200 to-gray-100 border-2 border-[#132440]/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[#757575]">Tendência Geral</span>
                        {crescimentoPercentual >= 0 ? <TrendingUp className="w-5 h-5 text-[#3B9797]" /> : <TrendingDown className="w-5 h-5 text-[#BF092F]" />}
                      </div>
                      <p className={`text-3xl font-bold ${crescimentoPercentual >= 0 ? 'text-[#3B9797]' : 'text-[#BF092F]'}`}>
                        {crescimentoPercentual >= 0 ? '+' : ''}{crescimentoPercentual}%
                      </p>
                      <p className="text-xs text-[#757575] mt-2">Crescimento no período</p>
                    </div>
                  </div>

                  {/* Análise Temporal */}
                  <div className="p-5 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0]">
                    <h3 className="text-sm font-bold text-[#757575] mb-4 uppercase">Insights Temporais</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                        <Calendar className="w-5 h-5 text-[#16476A] mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-[#212121]">Padrão Diário</p>
                          <p className="text-xs text-[#757575] mt-1">
                            Média de {mediaItensDia} solicitações por dia, com picos em dias úteis da semana.
                          </p>
                        </div>
                      </div>

                      {data.kpis.mudancaSemanal > 10 && (
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <TrendingUp className="w-5 h-5 text-[#3B9797] mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-[#212121]">Crescimento Semanal</p>
                            <p className="text-xs text-[#757575] mt-1">
                              Aumento de {data.kpis.mudancaSemanal}% em relação à semana anterior indica demanda crescente.
                            </p>
                          </div>
                        </div>
                      )}

                      {crescimentoPercentual > 20 && (
                        <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                          <Zap className="w-5 h-5 text-[#BF092F] mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-[#212121]">Tendência de Alta</p>
                            <p className="text-xs text-[#757575] mt-1">
                              Crescimento sustentado de {crescimentoPercentual}% no período. Monitore recursos e capacidade.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                        <BarChart3 className="w-5 h-5 text-[#132440] mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-[#212121]">Análise de Sazonalidade</p>
                          <p className="text-xs text-[#757575] mt-1">
                            Dados históricos indicam variações ao longo da semana. Dia mais ativo: {
                              Object.entries(solicitacoesPorDiaSemana)
                                .reduce((max, curr) => curr[1] > max[1] ? curr : max, ['', 0])[0]
                            }.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Análise por Dia da Semana */}
            <div className="mb-6">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Distribuição Semanal
                  </h2>
                  <button
                    onClick={() => exportCsv(
                      Object.entries(solicitacoesPorDiaSemana).map(([dia, count]) => ({ dia, quantidade: count })),
                      'distribuicao_semanal.csv'
                    )}
                    className="inline-flex items-center gap-2 px-3 py-2 border-2 rounded-xl text-xs font-bold text-white border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <Download className="w-4 h-4" /> CSV
                  </button>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {Object.entries(solicitacoesPorDiaSemana)
                      .sort((a, b) => b[1] - a[1])
                      .map(([dia, count]) => {
                        const maxCount = Math.max(...Object.values(solicitacoesPorDiaSemana));
                        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div key={dia} className="flex items-center gap-4">
                            <div className="w-32">
                              <span className="text-sm font-bold text-[#212121]">{dia}</span>
                            </div>
                            <div className="flex-1 relative">
                              <div className="h-10 bg-[#F5F5F5] rounded-xl overflow-hidden border border-[#E0E0E0]">
                                <div
                                  className="h-full bg-gradient-to-r from-[#16476A] to-[#132440] flex items-center justify-end px-3 transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                >
                                  {percentage > 15 && (
                                    <span className="text-sm font-bold text-white">{count}</span>
                                  )}
                                </div>
                              </div>
                              {percentage <= 15 && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#212121]">{count}</span>
                              )}
                            </div>
                            <div className="w-20 text-right">
                              <span className="text-xs text-[#757575]">{Math.round(percentage)}%</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-[#132440] via-[#16476A] to-[#3B9797] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-[1800px] mx-auto px-4 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                  <FileDown className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                    Central de Relatórios
                  </h1>
                  <p className="text-gray-200 text-base font-medium mt-2">
                    Análises avançadas, relatórios detalhados e exportações personalizadas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar Dados
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-8 lg:px-10 py-8 -mt-6">

        {/* Seletor de Tipo de Relatório */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
            <div className="bg-gradient-to-r from-[#16476A] to-[#132440] px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Configuração do Relatório
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {reports.map((report) => {
                  const Icon = report.icon;
                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report.id as ReportType)}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                        selectedReport === report.id
                          ? 'border-[#16476A] bg-blue-100 shadow-lg'
                          : 'border-[#E0E0E0] bg-white hover:border-[#16476A] hover:bg-[#F8F9FA]'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-2 ${selectedReport === report.id ? 'text-[#16476A]' : 'text-[#757575]'}`} />
                      <p className={`text-sm font-bold text-center ${selectedReport === report.id ? 'text-[#16476A]' : 'text-[#757575]'}`}>
                        {report.label}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-[#757575] mb-2">Período de Análise</label>
                  <div className="flex gap-2 flex-wrap">
                    {periods.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPeriod(p.id as PeriodType)}
                        className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-300 hover:scale-105 ${
                          period === p.id
                            ? 'bg-gradient-to-r from-[#16476A] to-[#132440] text-white border-[#16476A] shadow-lg'
                            : 'bg-white text-[#212121] border-[#E0E0E0] hover:border-[#16476A] hover:bg-[#F8F9FA]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Renderizar conteúdo dinâmico baseado no tipo de relatório */}
        {renderReportContent()}

        {/* Footer */}
        <div className="mt-8 text-center p-6 bg-white rounded-2xl shadow-xl border border-[#E0E0E0]">
          <p className="text-sm text-[#757575]">
            <span className="font-semibold text-[#16476A]">Relatório gerado em:</span>{' '}
            {formattedLastUpdated}
          </p>
          <p className="text-xs text-[#BFC7C9] mt-2">
            MyInventory Professional Reports · Período: {periods.find(p => p.id === period)?.label} · Tipo: {reports.find(r => r.id === selectedReport)?.label}
          </p>
        </div>
      </main>
    </div>
  );
}
