import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const sanitizeValue = (value: any): any => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v)).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([k, v]) => [k, sanitizeValue(v)])
        .filter(([, v]) => v !== undefined)
    );
  }
  return value;
};

const sanitize = <T extends Record<string, any>>(obj: T): T =>
  sanitizeValue(obj) as T;

/**
 * GET /api/checklist-templates/[id]
 * Busca um template específico
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log('[API Checklist Template] GET template:', id);

    const { data: templateData, error: templateError } = await supabaseAdmin
      .from('checklist_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (templateError || !templateData) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    const template = {
      id: templateData.id,
      name: templateData.name,
      description: templateData.description || '',
      type: templateData.type,
      frequency: templateData.frequency,
      companyId: templateData.company_id,
      storeIds: templateData.store_ids || [],
      sectors: templateData.sectors || [],
      allowedUserIds: templateData.allowed_user_ids || [],
      questions: templateData.questions || [],
      estimatedDuration: templateData.estimated_duration || 0,
      requiresGPS: templateData.requires_gps || false,
      requiresSignature: templateData.requires_signature || false,
      allowOfflineExecution: templateData.allow_offline_execution !== false,
      active: templateData.active !== false,
      version: templateData.version || 1,
      createdBy: templateData.created_by || '',
      createdAt: templateData.created_at || new Date().toISOString(),
      updatedAt: templateData.updated_at || new Date().toISOString(),
    };

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Erro ao buscar template:', error);
    return NextResponse.json(
      { error: 'Falha ao buscar template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/checklist-templates/[id]
 * Atualiza um template existente
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Verificar se o template existe
    const { data: existingTemplate, error: checkError } = await supabaseAdmin
      .from('checklist_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    // Campos que podem ser atualizados
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.storeIds !== undefined) updateData.store_ids = body.storeIds;
    if (body.sectors !== undefined) updateData.sectors = body.sectors;
    if (body.allowedUserIds !== undefined) updateData.allowed_user_ids = body.allowedUserIds;
    if (body.estimatedDuration !== undefined) updateData.estimated_duration = body.estimatedDuration;
    if (body.requiresGPS !== undefined) updateData.requires_gps = body.requiresGPS;
    if (body.requiresSignature !== undefined) updateData.requires_signature = body.requiresSignature;
    if (body.allowOfflineExecution !== undefined) updateData.allow_offline_execution = body.allowOfflineExecution;
    if (body.active !== undefined) updateData.active = body.active;

    // Atualização de perguntas (incrementa versão)
    if (body.questions !== undefined) {
      updateData.questions = body.questions.map((q: any, index: number) =>
        sanitize({
          id: q.id || `q_${Date.now()}_${index}`,
          order: q.order !== undefined ? q.order : index,
          question: q.question,
          type: q.type,
          required: q.required !== undefined ? q.required : true,
          options: q.options || [],
          minValue: q.minValue,
          maxValue: q.maxValue,
          unit: q.unit,
          conditionalLogic: q.conditionalLogic,
          photoRequired: q.photoRequired || false,
          allowMultiplePhotos: q.allowMultiplePhotos || false,
          maxPhotos: q.maxPhotos || 3,
        })
      );
      updateData.version = (existingTemplate.version || 1) + 1;
    }

    const { error: updateError } = await supabaseAdmin
      .from('checklist_templates')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[Checklist Templates] Erro ao atualizar template:', updateError);
      throw updateError;
    }

    // Buscar template atualizado
    const { data: updatedData, error: fetchError } = await supabaseAdmin
      .from('checklist_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !updatedData) {
      throw fetchError || new Error('Template não encontrado após atualização');
    }

    const template = {
      id: updatedData.id,
      name: updatedData.name,
      description: updatedData.description || '',
      type: updatedData.type,
      frequency: updatedData.frequency,
      companyId: updatedData.company_id,
      storeIds: updatedData.store_ids || [],
      sectors: updatedData.sectors || [],
      allowedUserIds: updatedData.allowed_user_ids || [],
      questions: updatedData.questions || [],
      estimatedDuration: updatedData.estimated_duration || 0,
      requiresGPS: updatedData.requires_gps || false,
      requiresSignature: updatedData.requires_signature || false,
      allowOfflineExecution: updatedData.allow_offline_execution !== false,
      active: updatedData.active !== false,
      version: updatedData.version || 1,
      createdBy: updatedData.created_by || '',
      createdAt: updatedData.created_at || new Date().toISOString(),
      updatedAt: updatedData.updated_at || new Date().toISOString(),
    };

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    return NextResponse.json(
      { error: 'Falha ao atualizar template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checklist-templates/[id]
 * Deleta um template (soft delete - marca como inativo)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: existingTemplate, error: checkError } = await supabaseAdmin
      .from('checklist_templates')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    // Soft delete - apenas marca como inativo
    const { error: updateError } = await supabaseAdmin
      .from('checklist_templates')
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Checklist Templates] Erro ao desativar template:', updateError);
      throw updateError;
    }

    return NextResponse.json({ success: true, message: 'Template desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar template:', error);
    return NextResponse.json(
      { error: 'Falha ao deletar template' },
      { status: 500 }
    );
  }
}
