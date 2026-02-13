import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/services/import.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { ImportType, ImportStatus } from '@/lib/types/import';

// GET /api/imports/jobs - Lista jobs de importação
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const importType = searchParams.get('type') as ImportType | null;
    const status = searchParams.get('status');
    const storeId = searchParams.get('storeId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const { jobs, total } = await importService.getJobs(auth.orgId, {
      importType: importType || undefined,
      status: status ? status.split(',') as ImportStatus[] : undefined,
      storeId: storeId || undefined,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      jobs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST /api/imports/jobs - Cria e processa novo job de importação
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const storeId = formData.get('storeId') as string | null;
    const templateId = formData.get('templateId') as string | null;
    const importType = formData.get('importType') as ImportType || 'losses';
    const configStr = formData.get('config') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Determinar formato do arquivo
    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();

    let fileFormat: 'csv' | 'xlsx' | 'xls' | 'txt' = 'csv';
    if (extension === 'xlsx') fileFormat = 'xlsx';
    else if (extension === 'xls') fileFormat = 'xls';
    else if (extension === 'txt') fileFormat = 'txt';

    // Ler conteúdo do arquivo
    const fileContent = await file.arrayBuffer();
    const buffer = Buffer.from(fileContent);

    // Parse config se fornecido
    let config;
    if (configStr) {
      try {
        config = JSON.parse(configStr);
      } catch {
        return NextResponse.json({ error: 'Invalid config JSON' }, { status: 400 });
      }
    }

    // Criar job
    const job = await importService.createJob(auth.orgId, auth.userId, {
      storeId,
      templateId: templateId || undefined,
      fileName,
      fileFormat,
      importType,
      config,
    });

    // Fazer preview do arquivo
    const preview = await importService.previewFile(buffer, fileFormat, {
      delimiter: config?.delimiter,
      hasHeader: config?.hasHeader,
    });

    // Atualizar job com total de linhas
    await importService.updateJobProgress(job.id, 0, 0, 0);

    // Atualizar status para validating
    await importService.updateJobStatus(job.id, 'validating', 'Validating file content');

    // Se for importação de perdas, processar
    if (importType === 'losses') {
      try {
        await importService.updateJobStatus(job.id, 'processing', 'Processing loss records');

        // Pegar as linhas do preview (excluindo header se houver)
        const dataRows = job.config.hasHeader
          ? preview.sampleRows
          : preview.sampleRows;

        // Para importação completa, precisamos fazer o parse completo
        const fullPreview = await importService.previewFile(buffer, fileFormat, {
          delimiter: config?.delimiter || job.config.delimiter,
          hasHeader: job.config.hasHeader,
        });

        const result = await importService.processLossImport(
          job.id,
          auth.orgId,
          storeId,
          fullPreview.sampleRows.length > 10 ? fullPreview.sampleRows : preview.sampleRows,
          job.config,
          auth.userId
        );

        // Completar job
        const finalStatus = result.recordsCreated > 0 ? 'completed' : 'completed_with_errors';
        await importService.completeJob(job.id, {
          status: finalStatus,
          recordsCreated: result.recordsCreated,
          recordsUpdated: 0,
          totalQuantity: result.totalQuantity,
          totalValue: result.totalValue,
          message: `Imported ${result.recordsCreated} loss records`,
        });

        // Buscar job atualizado
        const updatedJob = await importService.getJobById(job.id);

        return NextResponse.json({
          success: true,
          job: updatedJob,
          preview: {
            totalRows: preview.totalRows,
            headers: preview.headers,
          },
        }, { status: 201 });

      } catch (err) {
        await importService.updateJobStatus(
          job.id,
          'failed',
          err instanceof Error ? err.message : 'Processing failed'
        );

        return NextResponse.json({
          success: false,
          job,
          error: err instanceof Error ? err.message : 'Processing failed',
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      job,
      preview: {
        totalRows: preview.totalRows,
        headers: preview.headers,
        sampleRows: preview.sampleRows.slice(0, 5),
        detectedMapping: preview.detectedMapping,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating import job:', error);
    return NextResponse.json(
      { error: 'Failed to create import job' },
      { status: 500 }
    );
  }
}
