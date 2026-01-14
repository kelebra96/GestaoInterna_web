import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';

type FeatureStatus =
  | 'ready'
  | 'beta'
  | 'planned';

interface Feature {
  id: string;
  title: string;
  status: FeatureStatus;
  impact: 'alto' | 'medio';
  effort: 'baixo' | 'medio';
  description: string;
  available: boolean;
  metrics?: Record<string, number | string | boolean>;
}

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('storeId') || undefined;

  const orgFilter = auth.role === 'super_admin' ? {} : { orgId: auth.orgId };
  const storeFilter =
    storeId && auth.role === 'super_admin'
      ? { storeId }
      : storeId
        ? { storeId, orgId: auth.orgId }
        : undefined;

  try {
    const [
      planogramBases,
      planogramStores,
      executions,
      inventorySnapshots,
      storeCount,
      ruptureEvents,
    ] = await Promise.all([
      prisma.planogramBase.count({ where: orgFilter }),
      prisma.planogramStore.count({ where: { ...orgFilter, ...(storeFilter ? { storeId: storeFilter.storeId } : {}) } }),
      prisma.complianceExecution.count({ where: { ...orgFilter, ...(storeFilter ? { storeId: storeFilter.storeId } : {}) } }),
      prisma.inventorySnapshot.count({ where: { ...orgFilter, ...(storeFilter ? { storeId: storeFilter.storeId } : {}) } }),
      prisma.store.count({ where: { ...(storeFilter?.storeId ? { id: storeFilter.storeId } : {}), ...orgFilter } }),
      prisma.ruptureEvent.count({ where: { ...orgFilter, ...(storeFilter ? { storeId: storeFilter.storeId } : {}) } }),
    ]);

    const features: Feature[] = [
      {
        id: 'validacao-espaco',
        title: 'Validação de espaço',
        status: planogramStores > 0 ? 'ready' : 'beta',
        impact: 'alto',
        effort: 'baixo',
        description: 'Validação automática de capacidade e ocupação por módulo/slot.',
        available: planogramStores > 0,
        metrics: { planogramStores, executions },
      },
      {
        id: 'scoring-decomposto',
        title: 'Scoring decomposto',
        status: executions > 0 ? 'ready' : 'beta',
        impact: 'medio',
        effort: 'baixo',
        description: 'Score visível por dimensão de exposição e execução.',
        available: executions > 0,
        metrics: { executions },
      },
      {
        id: 'criterios-exposicao',
        title: 'Critérios de exposição documentados',
        status: 'ready',
        impact: 'medio',
        effort: 'baixo',
        description: 'Critérios registrados nas documentações e políticas internas.',
        available: true,
      },
      {
        id: 'analise-pre-planejamento',
        title: 'Análise pré-planejamento',
        status: planogramBases > 0 ? 'beta' : 'planned',
        impact: 'alto',
        effort: 'medio',
        description: 'Checklist pré-publicação (capacidade, módulos e SKUs).',
        available: planogramBases > 0,
        metrics: { planogramBases },
      },
      {
        id: 'modos-geracao-loja',
        title: 'Modos de geração por loja',
        status: planogramStores > 0 ? 'beta' : 'planned',
        impact: 'alto',
        effort: 'medio',
        description: 'Suporte a variações por loja (store-level planogram).',
        available: planogramStores > 0,
        metrics: { planogramStores, storeCount },
      },
      {
        id: 'relatorio-antes-depois',
        title: 'Relatório performance antes/depois',
        status: executions > 0 && ruptureEvents > 0 ? 'beta' : 'planned',
        impact: 'alto',
        effort: 'medio',
        description: 'Comparativo de ruptura, execuções e perdas.',
        available: executions > 0 && ruptureEvents > 0,
        metrics: { executions, ruptureEvents },
      },
      {
        id: 'versionamento-templates',
        title: 'Versionamento de templates',
        status: planogramBases > 0 ? 'ready' : 'beta',
        impact: 'medio',
        effort: 'baixo',
        description: 'PlanogramBase com controle de versão por template.',
        available: planogramBases > 0,
        metrics: { planogramBases },
      },
      {
        id: 'integracao-estoque',
        title: 'Integração com estoque',
        status: inventorySnapshots > 0 ? 'beta' : 'planned',
        impact: 'alto',
        effort: 'medio',
        description: 'Snapshots de estoque vinculados a loja/org.',
        available: inventorySnapshots > 0,
        metrics: { inventorySnapshots },
      },
      {
        id: 'benchmarking-interno',
        title: 'Benchmarking interno',
        status: executions > 1 ? 'beta' : 'planned',
        impact: 'medio',
        effort: 'medio',
        description: 'Comparação entre lojas usando execuções e scoring.',
        available: executions > 1,
        metrics: { executions },
      },
      {
        id: 'dashboard-reajustes',
        title: 'Dashboard de reajustes automáticos',
        status: planogramStores > 0 ? 'beta' : 'planned',
        impact: 'alto',
        effort: 'medio',
        description: 'Visão dos ajustes aplicados em planogramas por loja.',
        available: planogramStores > 0,
        metrics: { planogramStores },
      },
    ];

    return NextResponse.json({ features });
  } catch (error) {
    console.error('Error building planogram features:', error);
    return NextResponse.json({ error: 'Failed to compute planogram features' }, { status: 500 });
  }
}
