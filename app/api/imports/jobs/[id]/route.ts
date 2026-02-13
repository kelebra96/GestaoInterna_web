import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/services/import.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';

// GET /api/imports/jobs/[id] - Detalhes de um job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeErrors = searchParams.get('includeErrors') === 'true';
    const errorLimit = parseInt(searchParams.get('errorLimit') || '50');

    const job = await importService.getJobById(id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.orgId !== auth.orgId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let errors;
    if (includeErrors) {
      errors = await importService.getJobErrors(id, errorLimit);
    }

    return NextResponse.json({
      success: true,
      job,
      errors,
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

// DELETE /api/imports/jobs/[id] - Rollback de um job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { id } = await params;

    if (!auth || !auth.orgId || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode fazer rollback
    if (!['super_admin', 'admin_rede'].includes(auth.role)) {
      return NextResponse.json(
        { error: 'Only administrators can rollback imports' },
        { status: 403 }
      );
    }

    const job = await importService.getJobById(id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.orgId !== auth.orgId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!job.canRollback) {
      return NextResponse.json(
        { error: 'This job cannot be rolled back' },
        { status: 400 }
      );
    }

    const deletedCount = await importService.rollbackJob(id, auth.userId);

    return NextResponse.json({
      success: true,
      message: `Rolled back ${deletedCount} records`,
      deletedCount,
    });
  } catch (error) {
    console.error('Error rolling back job:', error);
    return NextResponse.json(
      { error: 'Failed to rollback job' },
      { status: 500 }
    );
  }
}
