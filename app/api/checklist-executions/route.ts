import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ChecklistExecution, ChecklistQuestion } from '@/lib/types/checklist';
import { calculateExecutionScore } from '@/lib/utils/checklistScore';

/**
 * Verifica se uma execução está atrasada e atualiza se necessário
 */
async function checkAndUpdateOverdue(execution: any) {
  // Só verifica se está em andamento
  if (execution.status !== 'in_progress') {
    return execution;
  }

  // Precisa ter startedAt e estimatedDuration
  if (!execution.startedAt || !execution.estimatedDuration) {
    return execution;
  }

  const startedAt = new Date(execution.startedAt);
  const now = new Date();
  const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);

  // Se ultrapassou o tempo estimado, marcar como atrasado
  if (elapsedMinutes > execution.estimatedDuration) {
    try {
      await supabaseAdmin
        .from('checklist_executions')
        .update({
          status: 'overdue',
          updated_at: new Date().toISOString(),
        })
        .eq('id', execution.id);

      execution.status = 'overdue';
      console.log(`✅ Execução ${execution.id} marcada como atrasada (${Math.round(elapsedMinutes)} min / ${execution.estimatedDuration} min)`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar status de atraso para execução ${execution.id}:`, error);
    }
  }

  return execution;
}

/**
 * Recalcula score e conformidade se não existirem
 */
async function recalculateScoreIfNeeded(execution: any): Promise<any> {
  // Se já tem score, não precisa recalcular
  if (execution.score && execution.conformity) {
    return execution;
  }

  // Se não tem respostas, não há o que calcular
  if (!execution.answers || execution.answers.length === 0) {
    return execution;
  }

  // Se não tem templateId, não pode calcular
  if (!execution.templateId) {
    return execution;
  }

  try {
    // Buscar template
    const { data: templateData, error: templateError } = await supabaseAdmin
      .from('checklist_templates')
      .select('questions')
      .eq('id', execution.templateId)
      .single();

    if (templateError || !templateData) {
      return execution;
    }

    const templateQuestions: ChecklistQuestion[] = templateData.questions || [];
    if (templateQuestions.length === 0) {
      return execution;
    }

    // Calcular score e conformidade
    const { score, conformity } = calculateExecutionScore(templateQuestions, execution.answers);

    // Atualizar no banco
    await supabaseAdmin
      .from('checklist_executions')
      .update({
        score,
        conformity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', execution.id);

    // Atualizar objeto local
    execution.score = score;
    execution.conformity = conformity;

    console.log(`✅ Score recalculado para execução ${execution.id}: ${score.percentage}% pontos, ${conformity.percentage}% conformidade`);
  } catch (error) {
    console.error(`❌ Erro ao recalcular score para execução ${execution.id}:`, error);
  }

  return execution;
}

/**
 * GET /api/checklist-executions
 * Lista execuções de checklist
 * Query params: companyId, storeId, userId, status, startDate, endDate
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const storeId = searchParams.get('storeId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabaseAdmin
      .from('checklist_executions')
      .select(`
        *,
        stores:store_id (
          name
        )
      `);

    // Filtros
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Ordenar por data agendada
    query = query.order('scheduled_date', { ascending: false });

    const { data: executionsData, error: executionsError } = await query;

    if (executionsError) {
      console.error('[Checklist Executions] Erro ao listar execuções:', executionsError);
      // Se a tabela ainda não existir (migração pendente), retornamos lista vazia para não quebrar o front.
      if (executionsError.code === 'PGRST205') {
        return NextResponse.json({ executions: [] });
      }
      throw executionsError;
    }

    const executions = (executionsData || []).map((data: any) => ({
      id: data.id,
      templateId: data.template_id,
      templateName: data.template_name,
      templateType: data.template_type,
      companyId: data.company_id,
      storeId: data.store_id,
      storeName: data.store_name || data.stores?.name || '',
      sector: data.sector,
      userId: data.user_id,
      userName: data.user_name,
      scheduledDate: data.scheduled_date || new Date().toISOString(),
      estimatedDuration: data.estimated_duration,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      status: data.status,
      progress: data.progress || 0,
      answers: data.answers || [],
      score: data.score,
      conformity: data.conformity,
      gpsLocation: data.gps_location,
      finalSignature: data.final_signature,
      syncedAt: data.synced_at,
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
    }));

    // Verificar e atualizar execuções atrasadas
    const executionsWithOverdueCheck = await Promise.all(
      executions.map((exec: any) => checkAndUpdateOverdue(exec))
    );

    // Recalcular scores para backward compatibility
    const executionsWithScore = await Promise.all(
      executionsWithOverdueCheck.map((exec: any) => recalculateScoreIfNeeded(exec))
    );

    // Filtrar por período se fornecido
    let filteredExecutions = executionsWithScore;
    if (startDate || endDate) {
      filteredExecutions = executionsWithScore.filter((e: any) => {
        const execDate = new Date(e.scheduledDate);
        if (startDate && execDate < new Date(startDate)) return false;
        if (endDate && execDate > new Date(endDate)) return false;
        return true;
      });
    }

    return NextResponse.json({ executions: filteredExecutions });
  } catch (error) {
    console.error('Erro ao listar execuções:', error);
    return NextResponse.json(
      { error: 'Falha ao listar execuções' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/checklist-executions
 * Cria uma nova execução de checklist
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      templateId,
      companyId,
      storeId,
      userId,
      scheduledDate,
      sector,
    } = body;

    // Validações
    if (!templateId || !companyId || !storeId || !userId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando: templateId, companyId, storeId, userId' },
        { status: 400 }
      );
    }

    // Buscar o template
    const { data: templateData, error: templateError } = await supabaseAdmin
      .from('checklist_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !templateData) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    if (!templateData.active) {
      return NextResponse.json(
        { error: 'Template inativo' },
        { status: 400 }
      );
    }

    // Buscar informações da loja
    const { data: storeData } = await supabaseAdmin
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single();

    const storeName = storeData?.name || storeId;

    // Buscar informações do usuário
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const userName = userData?.name || userId;

    const now = new Date().toISOString();
    const scheduled = scheduledDate || now;

    const executionData: Omit<ChecklistExecution, 'id'> = {
      templateId,
      templateName: templateData.name,
      templateType: templateData.type,
      companyId,
      storeId,
      storeName,
      sector: sector || templateData.sectors?.[0] || '',
      userId,
      userName,
      scheduledDate: scheduled,
      estimatedDuration: templateData.estimated_duration, // Copiar duração estimada do template
      status: 'scheduled',
      progress: 0,
      answers: [],
      createdAt: now,
      updatedAt: now,
    };

    const { data: insertedExecution, error: insertError } = await supabaseAdmin
      .from('checklist_executions')
      .insert({
        template_id: executionData.templateId,
        template_name: executionData.templateName,
        template_type: executionData.templateType,
        company_id: executionData.companyId,
        store_id: executionData.storeId,
        store_name: executionData.storeName,
        sector: executionData.sector,
        user_id: executionData.userId,
        user_name: executionData.userName,
        scheduled_date: executionData.scheduledDate,
        estimated_duration: executionData.estimatedDuration,
        status: executionData.status,
        progress: executionData.progress,
        answers: executionData.answers,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Checklist Executions] Erro ao criar execução:', insertError);
      throw insertError;
    }

    const execution = {
      id: insertedExecution.id,
      ...executionData,
    };

    return NextResponse.json({ execution }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar execução:', error);
    return NextResponse.json(
      { error: 'Falha ao criar execução' },
      { status: 500 }
    );
  }
}
