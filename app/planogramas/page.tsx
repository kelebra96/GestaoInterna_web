'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutGrid,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Plus,
  Store,
  TrendingUp,
  TrendingDown,
  Package,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
} from 'lucide-react';
import { PlanogramKPIs } from '@/lib/types/planogram';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function PlanogramasPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<PlanogramKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
  };

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();

      const response = await fetch('/api/planograms/analytics', {
        cache: 'no-store',
        headers: token ? {
          Authorization: `Bearer ${token}`,
        } : {},
      });

      if (!response.ok) throw new Error('Falha ao carregar KPIs');

      const data = await response.json();
      setKpis(data.kpis);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erro ao carregar KPIs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, []);

  // Dados para gráfico de pizza - conformidade
  const complianceData = kpis ? [
    { name: 'Conforme', value: kpis.executionsOnTime, color: '#3B9797' },
    { name: 'Atrasado', value: kpis.executionsLate, color: '#BF092F' },
  ].filter((item) => item.value > 0) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]">
      {/* Hero Header com gradiente e padrão */}
      <div className="relative bg-gradient-to-br from-[#16476A] via-[#3B9797] to-[#3B9797] overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                <LayoutGrid className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg">
                  Planogramas
                </h1>
                <p className="text-[#E0E7EF] text-base font-medium mt-2">
                  Gestão visual de gôndolas e análise de conformidade
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/planogramas/templates')}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 transition-all duration-300 hover:scale-105"
              >
                <LayoutGrid className="w-5 h-5" />
                Templates
              </button>
              <button
                onClick={fetchKPIs}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold shadow-lg border border-white/30 disabled:opacity-50 transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">

        {/* Estados de Loading/Erro - Redesenhados */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-full mb-6">
              <RefreshCw className="w-10 h-10 text-[#16476A] animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Carregando KPIs</h3>
            <p className="text-[#757575]">Aguarde enquanto buscamos os dados...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#BF092F]">
            <div className="bg-gradient-to-r from-[#E9ECEF] to-[#E0E7EF] px-6 py-5 border-b border-[#BF092F]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#BF092F] rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#BF092F]">Erro ao Carregar</h3>
                  <p className="text-[#BF092F]/80 text-sm">Não foi possível buscar os KPIs</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[#757575] mb-4">{error}</p>
              <button
                onClick={fetchKPIs}
                className="px-5 py-2.5 bg-[#BF092F] text-white rounded-xl font-semibold hover:bg-[#BF092F] transition-all inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : kpis ? (
          <>
            {/* KPIs Principais - Redesenhados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#16476A]/10 to-transparent rounded-bl-full"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Score de Conformidade</span>
                    <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                      <CheckCircle className="w-6 h-6 text-[#16476A]" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-[#212121] mb-3">{kpis.avgComplianceScore}%</p>
                  <div className="flex items-center gap-2 text-sm">
                    {kpis.avgComplianceScore >= 80 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-[#3B9797]" />
                        <span className="font-semibold text-[#3B9797]">Excelente</span>
                      </>
                    ) : kpis.avgComplianceScore >= 60 ? (
                      <>
                        <span className="text-[#BF092F]">→</span>
                        <span className="font-semibold text-[#BF092F]">Regular</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-[#BF092F]" />
                        <span className="font-semibold text-[#BF092F]">Precisa melhorar</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#3B9797]/10 to-transparent rounded-bl-full"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Execuções Totais</span>
                    <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                      <Eye className="w-6 h-6 text-[#3B9797]" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-[#3B9797] mb-3">{kpis.executionsTotal}</p>
                  <div className="flex items-center gap-2 text-sm text-[#757575]">
                    <Package className="w-4 h-4" />
                    <span className="font-semibold text-[#3B9797]">{kpis.executionsOnTime}</span>
                    <span>no prazo</span>
                  </div>
                </div>
              </div>

              <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#BF092F]/10 to-transparent rounded-bl-full"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Problemas Totais</span>
                    <div className="p-3 bg-gradient-to-br from-[#E9ECEF] to-[#E0E7EF] rounded-xl">
                      <AlertCircle className="w-6 h-6 text-[#BF092F]" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-[#BF092F] mb-3">{kpis.totalIssues}</p>
                  <div className="flex items-center gap-2 text-sm text-[#757575]">
                    <AlertCircle className="w-4 h-4 text-[#BF092F]" />
                    <span className="font-semibold text-[#BF092F]">{kpis.criticalIssues}</span>
                    <span>críticos</span>
                  </div>
                </div>
              </div>

              <div className="group relative bg-white rounded-2xl shadow-xl p-6 border border-[#E0E0E0] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#132440]/10 to-transparent rounded-bl-full"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-[#757575] uppercase tracking-wide">Produtos Detectados</span>
                    <div className="p-3 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-xl">
                      <Package className="w-6 h-6 text-[#132440]" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-[#132440] mb-3">{kpis.avgProductsDetected}</p>
                  <div className="flex items-center gap-2 text-sm text-[#757575]">
                    <TrendingDown className="w-4 h-4 text-[#BF092F]" />
                    <span className="font-semibold text-[#BF092F]">{kpis.avgProductsMissing}</span>
                    <span>faltando (média)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráficos - Redesenhados */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Gráfico de Pizza - Conformidade */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                      <PieChartIcon className="w-5 h-5 text-[#16476A]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#212121]">Execuções no Prazo vs Atrasadas</h2>
                  </div>
                </div>
                <div className="p-6">
                  {complianceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={complianceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#3B9797"
                          dataKey="value"
                        >
                          {complianceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-[#757575]">
                      <div className="text-center">
                        <PieChartIcon className="w-16 h-16 mx-auto mb-4 text-[#E0E0E0]" />
                        <p className="font-medium">Sem dados disponíveis</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Gráfico de Barras - Top Categorias */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#E0E0E0] overflow-hidden">
                <div className="bg-gradient-to-r from-[#F8F9FA] to-white px-6 py-4 border-b border-[#E0E0E0]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-[#E0E7EF] to-[#E0E7EF] rounded-lg">
                      <BarChart3 className="w-5 h-5 text-[#16476A]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#212121]">Top Categorias por Score</h2>
                  </div>
                </div>
                <div className="p-6">
                  {kpis.topCategories && kpis.topCategories.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={kpis.topCategories}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="score" fill="#16476A" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-[#757575]">
                      <div className="text-center">
                        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-[#E0E0E0]" />
                        <p className="font-medium">Sem dados disponíveis</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Destaques - Redesenhados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Melhor Loja */}
              {kpis.bestStore && (
                <div className="group relative bg-white rounded-2xl shadow-xl border-2 border-[#3B9797] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#3B9797]/10 to-transparent rounded-bl-full"></div>
                  <div className="relative p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-4 bg-gradient-to-br from-[#3B9797] to-[#16476A] rounded-2xl shadow-lg">
                        <Store className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">🏆</span>
                          <h3 className="font-bold text-lg text-[#212121]">Melhor Loja</h3>
                        </div>
                        <p className="text-3xl font-bold text-[#3B9797] mb-3">{kpis.bestStore}</p>
                        <p className="text-sm text-[#757575] leading-relaxed">
                          Loja com melhor score de conformidade no período
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pior Loja */}
              {kpis.worstStore && (
                <div className="group relative bg-white rounded-2xl shadow-xl border-2 border-[#BF092F] overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#BF092F]/10 to-transparent rounded-bl-full"></div>
                  <div className="relative p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-4 bg-gradient-to-br from-[#BF092F] to-[#BF092F] rounded-2xl shadow-lg">
                        <Store className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">⚠️</span>
                          <h3 className="font-bold text-lg text-[#212121]">Precisa Atenção</h3>
                        </div>
                        <p className="text-3xl font-bold text-[#BF092F] mb-3">{kpis.worstStore}</p>
                        <p className="text-sm text-[#757575] leading-relaxed">
                          Loja que precisa de mais suporte para melhorar conformidade
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botões de Ação - Redesenhados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/planogramas/templates')}
                className="group flex items-center justify-center gap-3 bg-white border-2 border-[#16476A] text-[#16476A] hover:bg-gradient-to-r hover:from-[#16476A] hover:to-[#3B9797] hover:text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <LayoutGrid className="w-5 h-5" />
                <span>Gerenciar Templates</span>
              </button>

              <button
                onClick={() => router.push('/planogramas/lojas')}
                className="group flex items-center justify-center gap-3 bg-white border-2 border-[#3B9797] text-[#3B9797] hover:bg-gradient-to-r hover:from-[#3B9797] hover:to-[#16476A] hover:text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <Store className="w-5 h-5" />
                <span>Planogramas por Loja</span>
              </button>

              <button
                onClick={() => router.push('/planogramas/execucoes')}
                className="group flex items-center justify-center gap-3 bg-white border-2 border-[#132440] text-[#132440] hover:bg-gradient-to-r hover:from-[#132440] hover:to-[#16476A] hover:text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <Eye className="w-5 h-5" />
                <span>Ver Execuções</span>
              </button>

              <button
                onClick={() => router.push('/analytics')}
                className="group flex items-center justify-center gap-3 bg-white border-2 border-[#BF092F] text-[#BF092F] hover:bg-gradient-to-r hover:from-[#BF092F] hover:to-[#BF092F] hover:text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <TrendingUp className="w-5 h-5" />
                <span>Análise Operacional</span>
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-[#E0E0E0]">
            <div className="w-24 h-24 bg-gradient-to-br from-[#F5F5F5] to-[#E0E0E0] rounded-full flex items-center justify-center mx-auto mb-6">
              <LayoutGrid className="w-12 h-12 text-[#757575]" />
            </div>
            <h3 className="text-xl font-bold text-[#212121] mb-2">Nenhum Dado Disponível</h3>
            <p className="text-[#757575]">Não há informações de planogramas para exibir</p>
          </div>
        )}
      </div>
    </div>
  );
}
