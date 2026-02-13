import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/services/import.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// POST /api/imports/preview - Preview de arquivo antes de importar
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const delimiter = formData.get('delimiter') as string | null;
    const hasHeader = formData.get('hasHeader') !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Validar tamanho (max 10MB para preview)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum 10MB for preview.' },
        { status: 400 }
      );
    }

    // Determinar formato
    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();

    let fileFormat: 'csv' | 'xlsx' | 'xls' | 'txt' = 'csv';
    if (extension === 'xlsx') fileFormat = 'xlsx';
    else if (extension === 'xls') fileFormat = 'xls';
    else if (extension === 'txt') fileFormat = 'txt';

    // Ler conteúdo
    const fileContent = await file.arrayBuffer();
    const buffer = Buffer.from(fileContent);

    // Fazer preview
    const preview = await importService.previewFile(buffer, fileFormat, {
      delimiter: delimiter || undefined,
      hasHeader,
    });

    return NextResponse.json({
      success: true,
      preview: {
        ...preview,
        fileName,
        fileSize: file.size,
      },
    });
  } catch (error) {
    console.error('Error previewing file:', error);
    return NextResponse.json(
      { error: 'Failed to preview file' },
      { status: 500 }
    );
  }
}
