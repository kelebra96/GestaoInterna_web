/**
 * Serviço de Análise de Perdas
 * Analisa dados de loss_records e gera insights para o dashboard de ML
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

interface LossAggregation {
  store_id: string;
  store_name?: string;
  product_ean?: string;
  product_name?: string;
  loss_type: string;
  total_quantity: number;
  total_cost: number;
  record_count: number;
  avg_quantity: number;
  avg_cost: number;
  min_date: string;
  max_date: string;
}

interface AnalysisResult {
  recommendationsCreated: number;
  anomaliesDetected: number;
  clustersCreated: number;
  predictionsGenerated: number;
  errors: string[];
}

class LossAnalysisService {
  /**
   * Executa análise completa dos dados de perdas
   */
  async analyzeImportedData(orgId: string, importJobId?: string): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      recommendationsCreated: 0,
      anomaliesDetected: 0,
      clustersCreated: 0,
      predictionsGenerated: 0,
      errors: [],
    };

    try {
      // 1. Buscar dados agregados de perdas
      const lossData = await this.getLossAggregations(orgId, importJobId);

      if (lossData.length === 0) {
        result.errors.push('Nenhum dado de perda encontrado para análise');
        return result;
      }

      // 2. Gerar recomendações baseadas em padrões
      const recsCreated = await this.generateRecommendations(orgId, lossData);
      result.recommendationsCreated = recsCreated;

      // 3. Detectar anomalias
      const anomaliesDetected = await this.detectAnomalies(orgId, lossData);
      result.anomaliesDetected = anomaliesDetected;

      // 4. Criar clusters de lojas
      const clustersCreated = await this.createStoreClusters(orgId, lossData);
      result.clustersCreated = clustersCreated;

      // 5. Gerar predições de perdas futuras
      const predictionsGenerated = await this.generatePredictions(orgId, lossData);
      result.predictionsGenerated = predictionsGenerated;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
    }

    return result;
  }

  /**
   * Busca agregações de perdas
   */
  private async getLossAggregations(orgId: string, importJobId?: string): Promise<LossAggregation[]> {
    const supabase = supabaseAdmin;

    let query = supabase
      .from('loss_records')
      .select('*')
      .eq('company_id', orgId);

    if (importJobId) {
      query = query.eq('import_job_id', importJobId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Agregar dados por loja e tipo de perda
    const aggregations = new Map<string, LossAggregation>();

    for (const record of data || []) {
      const key = `${record.store_id}_${record.loss_type}`;

      if (!aggregations.has(key)) {
        aggregations.set(key, {
          store_id: record.store_id,
          loss_type: record.loss_type,
          total_quantity: 0,
          total_cost: 0,
          record_count: 0,
          avg_quantity: 0,
          avg_cost: 0,
          min_date: record.occurrence_date,
          max_date: record.occurrence_date,
        });
      }

      const agg = aggregations.get(key)!;
      agg.total_quantity += Number(record.quantity) || 0;
      agg.total_cost += Number(record.total_cost) || 0;
      agg.record_count += 1;

      if (record.occurrence_date < agg.min_date) {
        agg.min_date = record.occurrence_date;
      }
      if (record.occurrence_date > agg.max_date) {
        agg.max_date = record.occurrence_date;
      }
    }

    // Calcular médias
    for (const agg of aggregations.values()) {
      agg.avg_quantity = agg.total_quantity / agg.record_count;
      agg.avg_cost = agg.total_cost / agg.record_count;
    }

    return Array.from(aggregations.values());
  }

  /**
   * Gera recomendações baseadas em padrões de perda
   */
  private async generateRecommendations(
    orgId: string,
    lossData: LossAggregation[]
  ): Promise<number> {
    const supabase = supabaseAdmin;
    const recommendations: Array<Record<string, unknown>> = [];

    // Ordenar por valor total de perda (maior primeiro)
    const sortedByValue = [...lossData].sort((a, b) => b.total_cost - a.total_cost);

    // Top 5 lojas com maior perda - recomendar investigação
    const topLosses = sortedByValue.slice(0, 5);

    for (const loss of topLosses) {
      if (loss.total_cost > 1000) { // Só se perda > R$1000
        recommendations.push({
          org_id: orgId,
          recommendation_type: 'investigation',
          priority: loss.total_cost > 10000 ? 'critical' : loss.total_cost > 5000 ? 'high' : 'medium',
          title: `Investigar perdas elevadas - ${loss.loss_type}`,
          description: `A loja apresentou ${loss.record_count} registros de perdas do tipo "${loss.loss_type}" totalizando R$ ${loss.total_cost.toFixed(2)}. Recomendamos investigação imediata.`,
          rationale: `Valor total de perda acima do limite aceitável. Quantidade média: ${loss.avg_quantity.toFixed(1)} unidades por ocorrência.`,
          entity_type: 'store',
          entity_id: loss.store_id,
          estimated_savings: loss.total_cost * 0.3, // Estimativa de 30% de recuperação
          estimated_loss_reduction: 0.3,
          confidence_score: 0.85,
          suggested_action: {
            type: 'audit',
            steps: [
              'Revisar processos de armazenamento',
              'Verificar validades no recebimento',
              'Analisar rotatividade de estoque',
            ],
          },
          status: 'pending',
        });
      }
    }

    // Analisar perdas por tipo - recomendar mudanças de processo
    const byType = new Map<string, { total_cost: number; total_quantity: number; count: number }>();
    for (const loss of lossData) {
      if (!byType.has(loss.loss_type)) {
        byType.set(loss.loss_type, { total_cost: 0, total_quantity: 0, count: 0 });
      }
      const t = byType.get(loss.loss_type)!;
      t.total_cost += loss.total_cost;
      t.total_quantity += loss.total_quantity;
      t.count += loss.record_count;
    }

    // Recomendação para tipo de perda mais frequente
    let maxType: string | null = null;
    let maxCost = 0;
    for (const [type, data] of byType) {
      if (data.total_cost > maxCost) {
        maxCost = data.total_cost;
        maxType = type;
      }
    }

    if (maxType && maxCost > 5000) {
      const typeLabels: Record<string, string> = {
        expiry: 'vencimento',
        damage: 'avaria',
        theft: 'furto',
        shrinkage: 'quebra operacional',
        other: 'outros motivos',
      };

      recommendations.push({
        org_id: orgId,
        recommendation_type: 'process_change',
        priority: 'high',
        title: `Revisar processos para reduzir perdas por ${typeLabels[maxType] || maxType}`,
        description: `Perdas por ${typeLabels[maxType] || maxType} representam o maior valor de perdas (R$ ${maxCost.toFixed(2)}). Sugerimos revisão de processos operacionais.`,
        rationale: `Análise dos dados importados identificou concentração de perdas nesta categoria.`,
        entity_type: 'category',
        estimated_savings: maxCost * 0.25,
        estimated_loss_reduction: 0.25,
        confidence_score: 0.75,
        suggested_action: {
          type: 'process_review',
          focus: maxType,
          steps: maxType === 'expiry'
            ? ['Implementar FIFO rigoroso', 'Criar alertas de vencimento', 'Revisar previsão de demanda']
            : maxType === 'damage'
            ? ['Revisar procedimentos de manuseio', 'Verificar condições de armazenamento', 'Treinar equipe']
            : ['Revisar processos operacionais', 'Implementar controles adicionais'],
        },
        status: 'pending',
      });
    }

    // Inserir recomendações
    if (recommendations.length > 0) {
      const { error } = await supabase
        .from('recommendations')
        .insert(recommendations);

      if (error) {
        console.error('Erro ao inserir recomendações:', error);
        return 0;
      }
    }

    return recommendations.length;
  }

  /**
   * Detecta anomalias nos dados de perda
   */
  private async detectAnomalies(
    orgId: string,
    lossData: LossAggregation[]
  ): Promise<number> {
    const supabase = supabaseAdmin;
    const anomalies: Array<Record<string, unknown>> = [];

    // Calcular estatísticas globais
    const costs = lossData.map(l => l.total_cost).filter(c => c > 0);
    if (costs.length < 3) return 0; // Precisa de pelo menos 3 pontos

    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    const variance = costs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / costs.length;
    const stdDev = Math.sqrt(variance);

    // Detectar anomalias usando z-score (valor > 2 desvios padrão)
    for (const loss of lossData) {
      if (stdDev === 0) continue;

      const zScore = (loss.total_cost - mean) / stdDev;

      if (Math.abs(zScore) > 2) {
        const isSpike = zScore > 0;

        anomalies.push({
          org_id: orgId,
          anomaly_type: isSpike ? 'spike' : 'drop',
          severity: Math.abs(zScore) > 3 ? 'critical' : Math.abs(zScore) > 2.5 ? 'high' : 'medium',
          entity_type: 'store',
          entity_id: loss.store_id,
          metric_type: 'loss_value',
          detected_value: loss.total_cost,
          expected_value: mean,
          expected_range_lower: mean - (2 * stdDev),
          expected_range_upper: mean + (2 * stdDev),
          deviation_score: zScore,
          detection_method: 'zscore',
          detected_at: new Date().toISOString(),
          period_start: loss.min_date,
          period_end: loss.max_date,
          status: 'open',
          metadata: {
            loss_type: loss.loss_type,
            record_count: loss.record_count,
            total_quantity: loss.total_quantity,
          },
        });
      }
    }

    // Inserir anomalias
    if (anomalies.length > 0) {
      const { error } = await supabase
        .from('anomalies')
        .insert(anomalies);

      if (error) {
        console.error('Erro ao inserir anomalias:', error);
        return 0;
      }
    }

    return anomalies.length;
  }

  /**
   * Cria clusters de lojas baseados no comportamento de perdas
   */
  private async createStoreClusters(
    orgId: string,
    lossData: LossAggregation[]
  ): Promise<number> {
    const supabase = supabaseAdmin;

    // Agrupar por loja
    const storeData = new Map<string, { totalCost: number; totalQuantity: number; types: Set<string> }>();

    for (const loss of lossData) {
      if (!storeData.has(loss.store_id)) {
        storeData.set(loss.store_id, { totalCost: 0, totalQuantity: 0, types: new Set() });
      }
      const store = storeData.get(loss.store_id)!;
      store.totalCost += loss.total_cost;
      store.totalQuantity += loss.total_quantity;
      store.types.add(loss.loss_type);
    }

    if (storeData.size < 2) return 0; // Precisa de pelo menos 2 lojas

    // Calcular pontuação de risco para cada loja
    const stores = Array.from(storeData.entries()).map(([storeId, data]) => ({
      storeId,
      ...data,
      riskScore: data.totalCost / 1000 + data.types.size * 10, // Score simples
    }));

    // Ordenar por risco
    stores.sort((a, b) => b.riskScore - a.riskScore);

    // Criar 3 clusters: Alto, Médio, Baixo risco
    const clusterDefinitions = [
      { name: 'cluster_high_risk', label: 'Alto Risco', threshold: 0.66 },
      { name: 'cluster_medium_risk', label: 'Risco Moderado', threshold: 0.33 },
      { name: 'cluster_low_risk', label: 'Baixo Risco', threshold: 0 },
    ];

    const clusters: Array<Record<string, unknown>> = [];
    const members: Array<Record<string, unknown>> = [];

    for (const def of clusterDefinitions) {
      const startIdx = Math.floor((1 - def.threshold) * stores.length);
      const endIdx = def.threshold === 0.66 ? 0 : Math.floor((1 - def.threshold - 0.33) * stores.length);
      const clusterStores = def.threshold === 0
        ? stores.slice(Math.floor(0.66 * stores.length))
        : def.threshold === 0.33
        ? stores.slice(Math.floor(0.33 * stores.length), Math.floor(0.66 * stores.length))
        : stores.slice(0, Math.floor(0.33 * stores.length));

      if (clusterStores.length === 0) continue;

      const avgCost = clusterStores.reduce((a, b) => a + b.totalCost, 0) / clusterStores.length;
      const avgRisk = clusterStores.reduce((a, b) => a + b.riskScore, 0) / clusterStores.length;

      const clusterId = crypto.randomUUID();

      clusters.push({
        id: clusterId,
        org_id: orgId,
        cluster_type: 'store',
        cluster_name: def.name,
        cluster_label: def.label,
        centroid: {
          avg_loss_cost: avgCost,
          avg_risk_score: avgRisk,
        },
        feature_weights: {
          loss_cost: 0.6,
          risk_score: 0.4,
        },
        member_count: clusterStores.length,
        avg_risk_score: avgRisk,
        characteristics: {
          risk_level: def.name.replace('cluster_', '').replace('_risk', ''),
        },
      });

      // Criar membros
      for (const store of clusterStores) {
        members.push({
          cluster_id: clusterId,
          entity_type: 'store',
          entity_id: store.storeId,
          membership_score: Math.min(1, store.riskScore / (avgRisk * 2)),
          features: {
            total_cost: store.totalCost,
            total_quantity: store.totalQuantity,
            loss_types: store.types.size,
          },
        });
      }
    }

    // Limpar clusters antigos
    await supabase
      .from('clusters')
      .delete()
      .eq('org_id', orgId)
      .eq('cluster_type', 'store');

    // Inserir clusters
    if (clusters.length > 0) {
      const { error: clusterError } = await supabase
        .from('clusters')
        .insert(clusters);

      if (clusterError) {
        console.error('Erro ao inserir clusters:', clusterError);
        return 0;
      }

      // Inserir membros
      if (members.length > 0) {
        const { error: memberError } = await supabase
          .from('cluster_members')
          .insert(members);

        if (memberError) {
          console.error('Erro ao inserir membros:', memberError);
        }
      }
    }

    return clusters.length;
  }

  /**
   * Gera predições básicas de perdas futuras
   */
  private async generatePredictions(
    orgId: string,
    lossData: LossAggregation[]
  ): Promise<number> {
    const supabase = supabaseAdmin;

    // Calcular média diária de perdas
    const totalCost = lossData.reduce((a, b) => a + b.total_cost, 0);
    const totalQuantity = lossData.reduce((a, b) => a + b.total_quantity, 0);

    // Assumir período de 30 dias para cálculo
    const avgDailyCost = totalCost / 30;
    const avgDailyQuantity = totalQuantity / 30;

    const predictions: Array<Record<string, unknown>> = [];
    const today = new Date();

    // Gerar predições para os próximos 7 dias
    for (let i = 1; i <= 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + i);

      // Adicionar variação baseada no dia da semana
      const dayOfWeek = targetDate.getDay();
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.0;

      const predictedCost = avgDailyCost * weekendFactor * (0.9 + Math.random() * 0.2);
      const margin = predictedCost * 0.25;

      predictions.push({
        org_id: orgId,
        prediction_type: 'loss_amount',
        entity_type: 'organization',
        target_date: targetDate.toISOString().split('T')[0],
        horizon_days: i,
        predicted_value: predictedCost,
        confidence_lower: predictedCost - margin,
        confidence_upper: predictedCost + margin,
        confidence_level: 0.85,
        features_used: {
          avg_daily_cost: avgDailyCost,
          avg_daily_quantity: avgDailyQuantity,
          day_of_week: dayOfWeek,
          weekend_factor: weekendFactor,
        },
      });
    }

    // Inserir predições
    if (predictions.length > 0) {
      const { error } = await supabase
        .from('predictions')
        .insert(predictions);

      if (error) {
        console.error('Erro ao inserir predições:', error);
        return 0;
      }
    }

    return predictions.length;
  }
}

export const lossAnalysisService = new LossAnalysisService();
