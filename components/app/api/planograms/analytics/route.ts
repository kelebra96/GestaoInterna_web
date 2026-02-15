// web/app/api/planograms/analytics/route.ts
import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { z } from 'zod';
import { PlanogramKPIs } from '@/lib/types/planogram';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Zod schema for query parameters
const analyticsQuerySchema = z.object({
  orgId: z.string().optional(),
  storeId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// GET /api/planograms/analytics - Returns KPIs and analytics for planograms
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  // Autenticação opcional - se não houver auth, retorna dados de todas as orgs

  try {
    const { searchParams } = new URL(request.url);
    const validation = analyticsQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: validation.error.flatten() }, { status: 400 });
    }

    const { orgId, storeId, startDate, endDate } = validation.data;

    const start = startDate ? new Date(startDate).toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const end = endDate ? new Date(endDate).toISOString() : new Date().toISOString();

    // Determinar qual orgId usar
    const targetOrg = auth ? (auth.role === 'super_admin' ? orgId : auth.orgId) : orgId;

    // Buscar execuções de compliance
    let execQuery = supabaseAdmin
      .from('compliance_executions')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end);

    if (targetOrg) {
      execQuery = execQuery.eq('org_id', targetOrg);
    }

    if (storeId) {
      execQuery = execQuery.eq('store_id', storeId);
    }

    const { data: executions, error: execError } = await execQuery;

    // Buscar tarefas de compliance
    let taskQuery = supabaseAdmin
      .from('compliance_tasks')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end);

    if (targetOrg) {
      taskQuery = taskQuery.eq('org_id', targetOrg);
    }

    if (storeId) {
      taskQuery = taskQuery.eq('store_id', storeId);
    }

    const { data: tasks, error: taskError} = await taskQuery;

    const complianceExecutions = (executions || []).map((exec: any) => ({
      id: exec.id,
      storeId: exec.store_id,
      planogramStoreId: exec.planogram_store_id,
      aiScore: exec.ai_score || 0,
      aiAnalysis: exec.ai_analysis || {},
      createdAt: new Date(exec.created_at),
    }));

    const complianceTasks = (tasks || []).map((task: any) => ({
      id: task.id,
      storeId: task.store_id,
      status: task.status,
      dueDate: task.due_date ? new Date(task.due_date) : null,
      createdAt: new Date(task.created_at),
    }));

    // --- Calculate KPIs ---
    const executionsTotal = complianceExecutions.length;
    const tasksTotal = complianceTasks.length;

    // Average Compliance Score
    const avgComplianceScore = executionsTotal > 0
      ? complianceExecutions.reduce((sum, e) => sum + (e.aiScore || 0), 0) / executionsTotal
      : 0;

    // Overdue Tasks
    const now = new Date();
    const overdueTasks = complianceTasks.filter((task) => task.status === 'pending' && task.dueDate && task.dueDate < now).length;

    // Executions by Store (for best/worst store)
    const uniqueStoreIds = Array.from(
      new Set([
        ...complianceExecutions.map(e => e.storeId),
        ...complianceTasks.map(t => t.storeId),
      ]),
    ).filter(Boolean) as string[];

    const { data: stores } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .in('id', uniqueStoreIds);

    const storeMap = new Map<string, string>();
    (stores || []).forEach((store: any) => {
      storeMap.set(store.id, store.name);
    });

    const storeScoresMap = new Map<string, { totalScore: number; count: number; storeName: string }>();
    for (const exec of complianceExecutions) {
      const storeName = storeMap.get(exec.storeId) || exec.storeId;
      if (!storeScoresMap.has(exec.storeId)) {
        storeScoresMap.set(exec.storeId, { totalScore: 0, count: 0, storeName });
      }
      const entry = storeScoresMap.get(exec.storeId)!;
      entry.totalScore += exec.aiScore || 0;
      entry.count += 1;
    }

    const storeAverages = Array.from(storeScoresMap.entries()).map(([storeId, data]) => ({
      storeId,
      storeName: data.storeName,
      avgScore: data.count > 0 ? data.totalScore / data.count : 0,
    }));

    storeAverages.sort((a, b) => b.avgScore - a.avgScore);

    const bestStore = storeAverages.length > 0 ? storeAverages[0].storeName : undefined;
    const worstStore = storeAverages.length > 0 ? storeAverages[storeAverages.length - 1].storeName : undefined;

    // Top Categories
    const uniquePlanogramStoreIds = Array.from(new Set(complianceExecutions.map(e => e.planogramStoreId))).filter(Boolean) as string[];

    const { data: planogramStores } = await supabaseAdmin
      .from('planogram_store')
      .select('id, base_planogram_id')
      .in('id', uniquePlanogramStoreIds);

    const basePlanogramIds = Array.from(new Set((planogramStores || []).map((ps: any) => ps.base_planogram_id).filter(Boolean)));

    const { data: basePlanograms } = await supabaseAdmin
      .from('planogram_base')
      .select('id, category')
      .in('id', basePlanogramIds);

    const basePlanogramMap = new Map<string, string>();
    (basePlanograms || []).forEach((bp: any) => {
      basePlanogramMap.set(bp.id, bp.category || 'Unknown');
    });

    const planogramStoreMap = new Map<string, string>();
    (planogramStores || []).forEach((ps: any) => {
      if (ps.base_planogram_id) {
        planogramStoreMap.set(ps.id, ps.base_planogram_id);
      }
    });

    const categoryScoresMap = new Map<string, { totalScore: number; count: number }>();
    for (const exec of complianceExecutions) {
      const basePlanogramId = planogramStoreMap.get(exec.planogramStoreId);
      const category = basePlanogramId ? basePlanogramMap.get(basePlanogramId) || 'Unknown' : 'Unknown';

      if (!categoryScoresMap.has(category)) {
        categoryScoresMap.set(category, { totalScore: 0, count: 0 });
      }
      const entry = categoryScoresMap.get(category)!;
      entry.totalScore += exec.aiScore || 0;
      entry.count += 1;
    }

    const topCategories = Array.from(categoryScoresMap.entries())
      .map(([category, data]) => ({
        category,
        score: data.count > 0 ? data.totalScore / data.count : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Calcular issues reais dos aiFindings/aiAnalysis
    let totalIssues = 0;
    let criticalIssues = 0;
    let resolvedIssues = 0;
    let totalProductsDetected = 0;
    let totalProductsMissing = 0;
    let totalGaps = 0;

    for (const exec of complianceExecutions) {
      const aiAnalysis = exec.aiAnalysis;
      if (aiAnalysis) {
        const issues = aiAnalysis.issues || [];
        totalIssues += issues.length;
        criticalIssues += issues.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length;

        totalProductsDetected += aiAnalysis.productsDetected || 0;
        totalProductsMissing += aiAnalysis.productsMissing || 0;
        totalGaps += aiAnalysis.gaps || 0;
      }

      if ((exec.aiScore || 0) >= 80) {
        resolvedIssues++;
      }
    }

    const avgProductsDetected = executionsTotal > 0 ? totalProductsDetected / executionsTotal : 0;
    const avgProductsMissing = executionsTotal > 0 ? totalProductsMissing / executionsTotal : 0;
    const avgGaps = executionsTotal > 0 ? totalGaps / executionsTotal : 0;

    const kpis: any = {
      storeId: storeId || undefined,
      period: {
        start,
        end,
      },
      avgComplianceScore: parseFloat(avgComplianceScore.toFixed(2)),
      executionsTotal,
      overdueTasks,
      bestStore,
      worstStore,
      topCategories,
      executionsOnTime: complianceExecutions.filter(exec => (exec.aiScore || 0) >= 80).length,
      executionsLate: complianceExecutions.filter(exec => (exec.aiScore || 0) < 80).length,
      totalIssues,
      criticalIssues,
      resolvedIssues,
      avgProductsDetected: parseFloat(avgProductsDetected.toFixed(2)),
      avgProductsMissing: parseFloat(avgProductsMissing.toFixed(2)),
      avgGaps: parseFloat(avgGaps.toFixed(2)),
    };

    return NextResponse.json({ kpis });
  } catch (error) {
    console.error('Error calculating analytics:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
