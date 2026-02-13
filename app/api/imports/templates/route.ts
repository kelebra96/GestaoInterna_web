import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/services/import.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { ImportType } from '@/lib/types/import';

// GET /api/imports/templates - Lista templates de importação
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const importType = searchParams.get('type') as ImportType | null;

    const templates = await importService.getTemplates(auth.orgId, importType || undefined);

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/imports/templates - Cria novo template
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode criar templates
    if (!['super_admin', 'admin_rede', 'gestor_loja'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only managers can create templates' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.name || !body.importType || !body.columnMapping) {
      return NextResponse.json(
        { error: 'Name, importType, and columnMapping are required' },
        { status: 400 }
      );
    }

    const template = await importService.createTemplate(auth.orgId, auth.userId, body);

    return NextResponse.json({
      success: true,
      template,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
