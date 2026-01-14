import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { calculateExecutionScore } from '@/lib/utils/checklistScore';
import { ChecklistQuestion } from '@/lib/types/checklist';

/**
 * Verifica se uma execução está atrasada
 */
function checkOverdueStatus(execution: any): any {
  if (execution.status !== 'in_progress') {
    return execution;
  }

  if (!execution.startedAt || !execution.estimatedDuration) {
    return execution;
  }

  const startedAt = new Date(execution.startedAt);
  const now = new Date();
  const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);

  if (elapsedMinutes > execution.estimatedDuration) {
    execution.status = 'overdue';
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
 * GET /api/checklist-executions/[id]
 * Busca uma execução específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: executionData, error: executionError } = await supabaseAdmin
      .from('checklist_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (executionError || !executionData) {
      return NextResponse.json(
        { error: 'Execução não encontrada' },
        { status: 404 }
      );
    }

    let execution = {
      id: executionData.id,
      templateId: executionData.template_id,
      templateName: executionData.template_name,
      templateType: executionData.template_type,
      companyId: executionData.company_id,
      storeId: executionData.store_id,
      storeName: executionData.store_name,
      sector: executionData.sector,
      userId: executionData.user_id,
      userName: executionData.user_name,
      scheduledDate: executionData.scheduled_date || new Date().toISOString(),
      estimatedDuration: executionData.estimated_duration,
      startedAt: executionData.started_at,
      completedAt: executionData.completed_at,
      status: executionData.status,
      progress: executionData.progress || 0,
      answers: executionData.answers || [],
      score: executionData.score,
      conformity: executionData.conformity,
      gpsLocation: executionData.gps_location,
      finalSignature: executionData.final_signature,
      syncedAt: executionData.synced_at,
      createdAt: executionData.created_at || new Date().toISOString(),
      updatedAt: executionData.updated_at || new Date().toISOString(),
    };

    // Verificar se está atrasado e atualizar se necessário
    const originalStatus = execution.status;
    execution = checkOverdueStatus(execution);

    if (execution.status === 'overdue' && originalStatus !== 'overdue') {
      await supabaseAdmin
        .from('checklist_executions')
        .update({
          status: 'overdue',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      console.log(`✅ Execução ${id} marcada como atrasada ao buscar`);
    }

    // Recalcular score se necessário (backward compatibility)
    execution = await recalculateScoreIfNeeded(execution);

    return NextResponse.json({ execution });
  } catch (error) {
    console.error('Erro ao buscar execução:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar execução' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/checklist-executions/[id]
 * Atualiza uma execução existente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Verificar se a execução existe
    const { data: currentData, error: checkError } = await supabaseAdmin
      .from('checklist_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !currentData) {
      return NextResponse.json(
        { error: 'Execução não encontrada' },
        { status: 404 }
      );
    }

    // Campos que podem ser atualizados
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Verificar se está atrasado antes de atualizar
    if (currentData.status === 'in_progress' && currentData.started_at && currentData.estimated_duration) {
      const startedAt = new Date(currentData.started_at);
      const now = new Date();
      const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);

      if (elapsedMinutes > currentData.estimated_duration && body.status !== 'completed') {
        updateData.status = 'overdue';
        console.log(`✅ Execução ${id} marcada como atrasada ao atualizar (${Math.round(elapsedMinutes)} min / ${currentData.estimated_duration} min)`);
      }
    }

    if (body.status !== undefined) {
      // Se o usuário está explicitamente atualizando o status, usar o status fornecido
      // (a menos que já tenha sido marcado como overdue acima)
      if (!updateData.status) {
        updateData.status = body.status;
      }

      // Atualizar timestamps conforme o status
      if (body.status === 'in_progress' && !currentData.started_at) {
        updateData.started_at = new Date().toISOString();
      }

      if (body.status === 'completed' && !currentData.completed_at) {
        updateData.completed_at = new Date().toISOString();
      }
    }

    if (body.answers !== undefined) {
      updateData.answers = body.answers.map((answer: any) => ({
        ...answer,
        answeredAt: answer.answeredAt || new Date().toISOString(),
      }));

      // Buscar template para calcular progresso e pontuação
      if (currentData.template_id) {
        const { data: templateData } = await supabaseAdmin
          .from('checklist_templates')
          .select('questions')
          .eq('id', currentData.template_id)
          .single();

        const templateQuestions: ChecklistQuestion[] = templateData?.questions || [];

        if (templateQuestions.length > 0) {
          // Calcular progresso
          const totalQuestions = templateQuestions.length;
          const answeredQuestions = body.answers.filter((a: any) =>
            a.value !== undefined && a.value !== null && a.value !== ''
          ).length;
          updateData.progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

          // Calcular pontuação e conformidade
          try {
            const { score, conformity } = calculateExecutionScore(templateQuestions, body.answers);
            updateData.score = score;
            updateData.conformity = conformity;
            console.log(`✅ Score calculado para execução ${id}: ${score.percentage}% pontos, ${conformity.percentage}% conformidade`);
          } catch (error) {
            console.error(`❌ Erro ao calcular score para execução ${id}:`, error);
          }
        }
      }
    }

    if (body.progress !== undefined) updateData.progress = body.progress;
    if (body.gpsLocation !== undefined) updateData.gps_location = body.gpsLocation;
    if (body.finalSignature !== undefined) updateData.final_signature = body.finalSignature;

    const { error: updateError } = await supabaseAdmin
      .from('checklist_executions')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[Checklist Executions] Erro ao atualizar execução:', updateError);
      throw updateError;
    }

    // Buscar execução atualizada
    const { data: updatedData, error: fetchError } = await supabaseAdmin
      .from('checklist_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !updatedData) {
      throw fetchError || new Error('Execução não encontrada após atualização');
    }

    const execution = {
      id: updatedData.id,
      templateId: updatedData.template_id,
      templateName: updatedData.template_name,
      templateType: updatedData.template_type,
      companyId: updatedData.company_id,
      storeId: updatedData.store_id,
      storeName: updatedData.store_name,
      sector: updatedData.sector,
      userId: updatedData.user_id,
      userName: updatedData.user_name,
      scheduledDate: updatedData.scheduled_date || new Date().toISOString(),
      estimatedDuration: updatedData.estimated_duration,
      startedAt: updatedData.started_at,
      completedAt: updatedData.completed_at,
      status: updatedData.status,
      progress: updatedData.progress || 0,
      answers: updatedData.answers || [],
      score: updatedData.score,
      conformity: updatedData.conformity,
      gpsLocation: updatedData.gps_location,
      finalSignature: updatedData.final_signature,
      syncedAt: updatedData.synced_at,
      createdAt: updatedData.created_at || new Date().toISOString(),
      updatedAt: updatedData.updated_at || new Date().toISOString(),
    };

    return NextResponse.json({ execution });
  } catch (error) {
    console.error('Erro ao atualizar execução:', error);
    return NextResponse.json(
      { error: 'Falha ao atualizar execução' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checklist-executions/[id]
 * Deleta uma execução
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: existingExecution, error: checkError } = await supabaseAdmin
      .from('checklist_executions')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existingExecution) {
      return NextResponse.json(
        { error: 'Execução não encontrada' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from('checklist_executions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Checklist Executions] Erro ao deletar execução:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: 'Execução deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar execução:', error);
    return NextResponse.json(
      { error: 'Falha ao deletar execução' },
      { status: 500 }
    );
  }
}
