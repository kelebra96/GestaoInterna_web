/**
 * Serviço de Cálculos para Analytics de Vencimentos
 * Funções puras para cálculo de KPIs e insights
 */

import {
  AutoInsight,
  InsightSeverity,
  RiskBacklogKPIs,
  EfficiencyKPIs,
  SLAKPIs,
  EngagementKPIs,
  QualityKPIs,
  TrendDataPoint,
  FunnelData,
  StoreScorecard,
  ExpiryReportDetail,
} from '@/lib/types/expiry-analytics';

// ============================================================================
// CÁLCULOS DE KPIS
// ============================================================================

/**
 * Calcula taxa de eficiência (resolvido antes do vencimento)
 */
export function calcularTaxaEficiencia(
  resolvedBeforeExpiry: number,
  resolvedTotal: number
): number {
  if (resolvedTotal === 0) return 0;
  return Math.round((resolvedBeforeExpiry / resolvedTotal) * 1000) / 10;
}

/**
 * Calcula taxa de vencidos abertos
 */
export function calcularTaxaVencidos(
  overdueOpen: number,
  openTotal: number
): number {
  if (openTotal === 0) return 0;
  return Math.round((overdueOpen / openTotal) * 1000) / 10;
}

/**
 * Calcula variação percentual entre dois valores
 */
export function calcularVariacao(atual: number, anterior: number): number {
  if (anterior === 0) {
    return atual > 0 ? 100 : 0;
  }
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

/**
 * Calcula dias até o vencimento
 */
export function calcularDiasAteVencimento(expiryDate: Date | string): number {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Classifica item por janela de vencimento
 */
export function classificarJanelaVencimento(daysToExpiry: number): 'D0' | 'D1' | 'D3' | 'D7' | 'overdue' | 'future' {
  if (daysToExpiry < 0) return 'overdue';
  if (daysToExpiry === 0) return 'D0';
  if (daysToExpiry === 1) return 'D1';
  if (daysToExpiry <= 3) return 'D3';
  if (daysToExpiry <= 7) return 'D7';
  return 'future';
}

/**
 * Formata horas para exibição
 */
export function formatarHoras(hours: number | null): string {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `${days}d ${remainingHours}h`;
}

/**
 * Formata valor monetário (BRL)
 */
export function formatarMoeda(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata data para exibição (dd/mm/aaaa)
 */
export function formatarData(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

/**
 * Formata data e hora para exibição
 */
export function formatarDataHora(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

// ============================================================================
// GERAÇÃO DE INSIGHTS AUTOMÁTICOS
// ============================================================================

export function gerarInsights(
  risk: RiskBacklogKPIs,
  efficiency: EfficiencyKPIs,
  sla: SLAKPIs,
  quality: QualityKPIs,
  storeScorecard?: StoreScorecard
): AutoInsight[] {
  const insights: AutoInsight[] = [];
  const now = new Date().toISOString();

  // CRÍTICO: Muitos vencidos abertos
  if (risk.overdueCount > 0 && efficiency.overdueRate > 20) {
    insights.push({
      id: `critical-overdue-${Date.now()}`,
      category: 'risk',
      severity: 'critical',
      title: 'Alto volume de itens vencidos',
      description: `${risk.overdueCount} itens já venceram e continuam em aberto. Taxa de ${efficiency.overdueRate.toFixed(1)}% do backlog.`,
      metric: 'Vencidos Abertos',
      value: risk.overdueCount,
      action: 'Priorize a resolução dos itens vencidos imediatamente.',
      createdAt: now,
    });
  }

  // CRÍTICO: Muitos itens vencem hoje
  if (risk.d0Count > 5) {
    insights.push({
      id: `critical-d0-${Date.now()}`,
      category: 'risk',
      severity: 'critical',
      title: 'Itens vencem hoje',
      description: `${risk.d0Count} itens vencem hoje e precisam de ação imediata.`,
      metric: 'Vence Hoje',
      value: risk.d0Count,
      action: 'Verifique estes itens com urgência.',
      createdAt: now,
    });
  }

  // WARNING: Eficiência baixa
  if (efficiency.resolvedTotal >= 10 && efficiency.efficiencyRate < 70) {
    insights.push({
      id: `warning-efficiency-${Date.now()}`,
      category: 'efficiency',
      severity: 'warning',
      title: 'Eficiência de resolução baixa',
      description: `Apenas ${efficiency.efficiencyRate.toFixed(1)}% dos itens são resolvidos antes do vencimento.`,
      metric: 'Taxa de Eficiência',
      value: `${efficiency.efficiencyRate.toFixed(1)}%`,
      action: 'Reduza o tempo entre reportar e resolver.',
      createdAt: now,
    });
  }

  // WARNING: SLA lento
  if (sla.p50ResolutionHours !== null && sla.p50ResolutionHours > 48) {
    insights.push({
      id: `warning-sla-${Date.now()}`,
      category: 'efficiency',
      severity: 'warning',
      title: 'Tempo de resolução elevado',
      description: `O tempo mediano de resolução é ${formatarHoras(sla.p50ResolutionHours)}.`,
      metric: 'P50 Resolução',
      value: formatarHoras(sla.p50ResolutionHours),
      action: 'Otimize o processo de tratamento de vencimentos.',
      createdAt: now,
    });
  }

  // WARNING: Muitos sem foto
  if (quality.noPhotoCount > 0 && quality.noPhotoRate > 15) {
    insights.push({
      id: `warning-photo-${Date.now()}`,
      category: 'quality',
      severity: 'warning',
      title: 'Muitos reports sem foto',
      description: `${quality.noPhotoRate.toFixed(1)}% dos reports estão sem foto (${quality.noPhotoCount} itens).`,
      metric: 'Sem Foto',
      value: `${quality.noPhotoRate.toFixed(1)}%`,
      action: 'Reforce a importância de anexar fotos nos reports.',
      createdAt: now,
    });
  }

  // INFO: Valor em risco alto
  if (risk.valueAtRisk > 5000) {
    insights.push({
      id: `info-value-${Date.now()}`,
      category: 'risk',
      severity: 'info',
      title: 'Valor significativo em risco',
      description: `${formatarMoeda(risk.valueAtRisk)} em produtos com vencimento próximo.`,
      metric: 'Valor em Risco',
      value: formatarMoeda(risk.valueAtRisk),
      action: 'Priorize itens de maior valor.',
      createdAt: now,
    });
  }

  // SUCCESS: Boa eficiência
  if (efficiency.resolvedTotal >= 20 && efficiency.efficiencyRate >= 90) {
    insights.push({
      id: `success-efficiency-${Date.now()}`,
      category: 'efficiency',
      severity: 'success',
      title: 'Excelente taxa de resolução',
      description: `${efficiency.efficiencyRate.toFixed(1)}% dos itens são resolvidos antes do vencimento.`,
      metric: 'Taxa de Eficiência',
      value: `${efficiency.efficiencyRate.toFixed(1)}%`,
      createdAt: now,
    });
  }

  // SUCCESS: Sem vencidos
  if (risk.overdueCount === 0 && risk.totalOpen > 0) {
    insights.push({
      id: `success-no-overdue-${Date.now()}`,
      category: 'risk',
      severity: 'success',
      title: 'Nenhum item vencido',
      description: 'Todos os itens estão dentro do prazo de validade.',
      createdAt: now,
    });
  }

  // Ordenar por severidade
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// AGREGAÇÕES
// ============================================================================

/**
 * Agrupa reports por categoria
 */
export function agruparPorCategoria(reports: ExpiryReportDetail[]): Map<string, ExpiryReportDetail[]> {
  const map = new Map<string, ExpiryReportDetail[]>();
  for (const report of reports) {
    const category = report.productCategory || 'Sem Categoria';
    const existing = map.get(category) || [];
    existing.push(report);
    map.set(category, existing);
  }
  return map;
}

/**
 * Agrupa reports por loja
 */
export function agruparPorLoja(reports: ExpiryReportDetail[]): Map<string, ExpiryReportDetail[]> {
  const map = new Map<string, ExpiryReportDetail[]>();
  for (const report of reports) {
    const existing = map.get(report.storeId) || [];
    existing.push(report);
    map.set(report.storeId, existing);
  }
  return map;
}

/**
 * Calcula dados do funil a partir de contagens
 */
export function calcularFunnel(
  reported: number,
  watched: number,
  confirmed: number,
  resolved: number
): FunnelData {
  return {
    reported,
    watched,
    confirmed,
    resolved,
    watchRate: reported > 0 ? Math.round((watched / reported) * 1000) / 10 : 0,
    confirmRate: reported > 0 ? Math.round((confirmed / reported) * 1000) / 10 : 0,
    resolveRate: reported > 0 ? Math.round((resolved / reported) * 1000) / 10 : 0,
  };
}

/**
 * Calcula métricas de Pareto (80/20)
 */
export function calcularPareto<T extends { value: number }>(
  items: T[],
  valueKey: keyof T = 'value' as keyof T
): { item: T; cumulativePercent: number }[] {
  const sorted = [...items].sort((a, b) => (b[valueKey] as number) - (a[valueKey] as number));
  const total = sorted.reduce((sum, item) => sum + (item[valueKey] as number), 0);

  if (total === 0) return [];

  let cumulative = 0;
  return sorted.map(item => {
    cumulative += item[valueKey] as number;
    return {
      item,
      cumulativePercent: Math.round((cumulative / total) * 1000) / 10,
    };
  });
}

// ============================================================================
// SPARKLINE DATA
// ============================================================================

/**
 * Gera dados para sparkline a partir de tendência
 */
export function gerarSparklineData(trends: TrendDataPoint[], metric: keyof TrendDataPoint): number[] {
  return trends.slice(-14).map(t => t[metric] as number);
}

// ============================================================================
// COMPARATIVOS
// ============================================================================

/**
 * Compara scorecard da loja com média da rede
 */
export function compararComRede(
  storeScorecard: StoreScorecard,
  networkAvg: { efficiencyRate: number; overdueRate: number; p50Hours: number | null }
): { efficiencyDiff: number; overdueDiff: number; p50Diff: number | null } {
  return {
    efficiencyDiff: Math.round((storeScorecard.efficiencyRate - networkAvg.efficiencyRate) * 10) / 10,
    overdueDiff: Math.round((storeScorecard.overdueRate - networkAvg.overdueRate) * 10) / 10,
    p50Diff: storeScorecard.p50Hours !== null && networkAvg.p50Hours !== null
      ? Math.round((storeScorecard.p50Hours - networkAvg.p50Hours) * 10) / 10
      : null,
  };
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================

/**
 * Verifica se uma data de vencimento é válida (não muito no passado ou futuro)
 */
export function isValidExpiryDate(expiryDate: Date | string): boolean {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const now = new Date();

  // Não pode ser mais de 2 anos no passado
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(now.getFullYear() - 2);

  // Não pode ser mais de 5 anos no futuro
  const fiveYearsAhead = new Date(now);
  fiveYearsAhead.setFullYear(now.getFullYear() + 5);

  return expiry >= twoYearsAgo && expiry <= fiveYearsAhead;
}
