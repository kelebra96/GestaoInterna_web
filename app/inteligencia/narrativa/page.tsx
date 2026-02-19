'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  RefreshCw,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  FileText,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  ArrowLeft,
} from 'lucide-react';
import Card from '@/components/ui/Card';

interface NarrativeResult {
  tipo: string;
  titulo: string;
  conteudo: string;
  highlights: string[];
  alertas: string[];
  acoes: string[];
  geradoEm: string;
  modelo: string;
}

interface FullNarrativeReport {
  resumoExecutivo: NarrativeResult;
  analiseTendencias: NarrativeResult;
  alertasRiscos: NarrativeResult;
  oportunidades: NarrativeResult;
  geradoEm: string;
  contexto: any;
}

const SECTION_ICONS = {
  resumo_executivo: FileText,
  analise_tendencia: TrendingUp,
  alerta_risco: AlertTriangle,
  oportunidade: Lightbulb,
};

// Paleta de cores consistente com a identidade visual da aplicação
const SECTION_COLORS = {
  resumo_executivo: 'blue',      // Azul da marca
  analise_tendencia: 'teal',     // Teal (cor secundária)
  alerta_risco: 'amber',         // Âmbar (warning)
  oportunidade: 'emerald',       // Verde (success)
};

function NarrativeSection({ narrative, expanded = false }: { narrative: NarrativeResult; expanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const Icon = SECTION_ICONS[narrative.tipo as keyof typeof SECTION_ICONS] || FileText;
  const colorKey = narrative.tipo as keyof typeof SECTION_COLORS;
  const color = SECTION_COLORS[colorKey] || 'gray';

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'bg-blue-100 text-blue-600',
      border: 'border-blue-200',
      highlight: 'bg-blue-50 text-blue-800',
    },
    teal: {
      bg: 'bg-teal-50',
      icon: 'bg-teal-100 text-teal-600',
      border: 'border-teal-200',
      highlight: 'bg-teal-50 text-teal-800',
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'bg-amber-100 text-amber-600',
      border: 'border-amber-200',
      highlight: 'bg-amber-50 text-amber-800',
    },
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'bg-emerald-100 text-emerald-600',
      border: 'border-emerald-200',
      highlight: 'bg-emerald-50 text-emerald-800',
    },
    gray: {
      bg: 'bg-gray-50',
      icon: 'bg-gray-100 text-gray-600',
      border: 'border-gray-200',
      highlight: 'bg-gray-50 text-gray-800',
    },
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.gray;

  return (
    <Card className={`border ${colors.border} ${colors.bg}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{narrative.titulo}</h3>
            <p className="text-sm text-gray-500">
              {narrative.highlights.length} pontos principais | {narrative.acoes.length} ações
            </p>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Conteúdo */}
          <div className="prose prose-sm max-w-none text-gray-700">
            {narrative.conteudo.split('\n').map((paragraph, i) => (
              <p key={i} className="mb-2">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Highlights */}
          {narrative.highlights.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Pontos Principais
              </h4>
              <ul className="space-y-1">
                {narrative.highlights.map((highlight, i) => (
                  <li
                    key={i}
                    className={`text-sm px-3 py-2 rounded-lg ${colors.highlight} flex items-start gap-2`}
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alertas */}
          {narrative.alertas.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Alertas
              </h4>
              <ul className="space-y-1">
                {narrative.alertas.map((alerta, i) => (
                  <li
                    key={i}
                    className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-800 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                    {alerta}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ações */}
          {narrative.acoes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-green-500" />
                Ações Recomendadas
              </h4>
              <ul className="space-y-1">
                {narrative.acoes.map((acao, i) => (
                  <li
                    key={i}
                    className="text-sm px-3 py-2 rounded-lg bg-green-50 text-green-800 flex items-start gap-2"
                  >
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                    {acao}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function NarrativaBIPage() {
  const router = useRouter();
  const [data, setData] = useState<FullNarrativeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const fetchData = async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/varejo/narrative?periodo=${periodo}&tipo=full${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Erro ao gerar narrativa');
      }

      setData(json.data);
    } catch (err: any) {
      console.error('Erro ao carregar narrativa:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodo]);

  if (loading && !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/inteligencia/executivo')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6" style={{ color: '#3B9797' }} />
              Análise Narrativa IA
            </h1>
            <p className="text-gray-500">Gerando insights com inteligência artificial...</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="w-16 h-16 border-4 rounded-full animate-spin" style={{ borderColor: '#3B979733', borderTopColor: '#3B9797' }} />
            <Sparkles className="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ color: '#3B9797' }} />
          </div>
          <p className="mt-4 text-gray-600 font-medium">Analisando dados e gerando insights...</p>
          <p className="text-sm text-gray-400">Isso pode levar alguns segundos</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/inteligencia/executivo')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Análise Narrativa IA</h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erro ao gerar análise</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchData(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/inteligencia/executivo')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6" style={{ color: '#3B9797' }} />
              Análise Narrativa IA
            </h1>
            <p className="text-gray-500 mt-1">
              Insights gerados automaticamente por inteligência artificial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="month"
              value={periodo.slice(0, 7)}
              onChange={(e) => setPeriodo(`${e.target.value}-01`)}
              className="border-0 focus:ring-0 text-sm"
            />
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="p-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: '#16476A' }}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Regenerar</span>
          </button>
        </div>
      </div>

      {/* AI Badge */}
      <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #16476A 0%, #3B9797 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Relatório gerado por IA</h2>
            <p className="text-sm text-white/80">
              Análise baseada em {data?.contexto?.distribuicaoRisco?.total || 0} lojas | Modelo: GPT-4o-mini
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm text-white/70">
            <Clock className="w-4 h-4" />
            {data?.geradoEm && new Date(data.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Narrative Sections */}
      <div className="space-y-4">
        {data?.resumoExecutivo && (
          <NarrativeSection narrative={data.resumoExecutivo} expanded />
        )}
        {data?.analiseTendencias && (
          <NarrativeSection narrative={data.analiseTendencias} />
        )}
        {data?.alertasRiscos && (
          <NarrativeSection narrative={data.alertasRiscos} />
        )}
        {data?.oportunidades && (
          <NarrativeSection narrative={data.oportunidades} />
        )}
      </div>

      {/* Quick Links */}
      <Card header={<h3 className="font-semibold text-gray-900">Explorar Dados</h3>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          {[
            { label: 'Dashboard', href: '/inteligencia/executivo', color: 'blue' },
            { label: 'Perdas', href: '/inteligencia/perdas', color: 'red' },
            { label: 'Rupturas', href: '/inteligencia/rupturas', color: 'amber' },
            { label: 'Ações', href: '/inteligencia/acoes', color: 'green' },
          ].map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400">
        Este relatório foi gerado automaticamente usando inteligência artificial.
        Os insights são baseados nos dados disponíveis e devem ser validados com análise humana.
      </div>
    </div>
  );
}
