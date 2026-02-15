import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ChecklistTemplate } from '@/lib/types/checklist';

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
 * GET /api/checklist-templates
 * Lista todos os templates de checklist
 * Query params: companyId, storeId, type, active
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const storeId = searchParams.get('storeId');
    const type = searchParams.get('type');
    const activeParam = searchParams.get('active');

    let query = supabaseAdmin.from('checklist_templates').select('*');

    // Filtros
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (activeParam !== null) {
      const active = activeParam === 'true';
      query = query.eq('active', active);
    }

    // Ordenar por data de criação
    query = query.order('created_at', { ascending: false });

    const { data: templatesData, error: templatesError } = await query;

    if (templatesError) {
      console.error('[Checklist Templates] Erro ao listar templates:', templatesError);
      throw templatesError;
    }

    let templates = (templatesData || []).map((data: any) => ({
      id: data.id,
      name: data.name,
      description: data.description || '',
      type: data.type,
      frequency: data.frequency,
      companyId: data.company_id,
      storeIds: data.store_ids || [],
      sectors: data.sectors || [],
      allowedUserIds: data.allowed_user_ids || [],
      questions: data.questions || [],
      estimatedDuration: data.estimated_duration || 0,
      requiresGPS: data.requires_gps || false,
      requiresSignature: data.requires_signature || false,
      allowOfflineExecution: data.allow_offline_execution !== false,
      active: data.active !== false,
      version: data.version || 1,
      createdBy: data.created_by || '',
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
    }));

    // Filtrar por storeId se fornecido (pode estar em array storeIds)
    if (storeId) {
      templates = templates.filter((t: any) =>
        !t.storeIds || t.storeIds.length === 0 || t.storeIds.includes(storeId)
      );
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    return NextResponse.json(
      { error: 'Falha ao listar templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/checklist-templates
 * Cria um novo template de checklist
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      name,
      description,
      type,
      frequency,
      companyId,
      storeIds,
      sectors,
      allowedUserIds,
      questions,
      estimatedDuration,
      requiresGPS,
      requiresSignature,
      allowOfflineExecution,
      createdBy,
    } = body;

    // Validações
    if (!name || !type || !frequency || !companyId || !createdBy) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando: name, type, frequency, companyId, createdBy' },
        { status: 400 }
      );
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'Template deve ter pelo menos uma pergunta' },
        { status: 400 }
      );
    }

    // Verificar se a empresa existe
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single();

    if (companyError || !companyData) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const templateData: Omit<ChecklistTemplate, 'id'> = {
      name,
      description: description || '',
      type,
      frequency,
      companyId,
      storeIds: storeIds || [],
      sectors: sectors || [],
      allowedUserIds: allowedUserIds || [],
      questions: questions.map((q: any, index: number) =>
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
      ),
      estimatedDuration: estimatedDuration || 0,
      requiresGPS: requiresGPS !== undefined ? requiresGPS : false,
      requiresSignature: requiresSignature !== undefined ? requiresSignature : false,
      allowOfflineExecution: allowOfflineExecution !== undefined ? allowOfflineExecution : true,
      active: true,
      version: 1,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const { data: insertedTemplate, error: insertError } = await supabaseAdmin
      .from('checklist_templates')
      .insert({
        name: templateData.name,
        description: templateData.description,
        type: templateData.type,
        frequency: templateData.frequency,
        company_id: templateData.companyId,
        store_ids: templateData.storeIds,
        sectors: templateData.sectors,
        allowed_user_ids: templateData.allowedUserIds,
        questions: templateData.questions,
        estimated_duration: templateData.estimatedDuration,
        requires_gps: templateData.requiresGPS,
        requires_signature: templateData.requiresSignature,
        allow_offline_execution: templateData.allowOfflineExecution,
        active: templateData.active,
        version: templateData.version,
        created_by: templateData.createdBy,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Checklist Templates] Erro ao criar template:', insertError);
      throw insertError;
    }

    const template = {
      id: insertedTemplate.id,
      ...templateData,
    };

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar template:', error);
    return NextResponse.json(
      { error: 'Falha ao criar template' },
      { status: 500 }
    );
  }
}
