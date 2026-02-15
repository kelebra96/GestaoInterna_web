/**
 * Webhooks API - Sprint 6 Event-Driven Architecture
 *
 * Endpoints para gerenciar webhooks.
 *
 * GET /api/webhooks - Lista webhooks
 * POST /api/webhooks - Registra webhook
 * DELETE /api/webhooks?id=xxx - Remove webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookService } from '@/lib/events';
import { withMetrics } from '@/lib/helpers/with-metrics';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export const GET = withMetrics('/api/webhooks', async (request: NextRequest) => {
  try {
    const supabase = supabaseAdmin;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: user } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', session.user.id)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const webhooks = await webhookService.list(user.org_id);

    // Remover secrets da resposta
    const safeWebhooks = webhooks.map(w => ({
      ...w,
      secret: '***' + w.secret.slice(-4),
    }));

    return NextResponse.json({
      success: true,
      data: safeWebhooks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});

export const POST = withMetrics('/api/webhooks', async (request: NextRequest) => {
  try {
    const supabase = supabaseAdmin;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: user } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', session.user.id)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validar input
    if (!body.name || !body.url || !body.eventTypes) {
      return NextResponse.json(
        { error: 'name, url and eventTypes are required' },
        { status: 400 }
      );
    }

    // Validar URL
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Registrar webhook
    const webhook = await webhookService.register({
      name: body.name,
      url: body.url,
      eventTypes: body.eventTypes,
      orgId: user.org_id,
      headers: body.headers,
      maxRetries: body.maxRetries,
      retryDelaySeconds: body.retryDelaySeconds,
    });

    return NextResponse.json({
      success: true,
      data: webhook,
      message: 'Webhook registered successfully. Save the secret - it cannot be retrieved later.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});

export const DELETE = withMetrics('/api/webhooks', async (request: NextRequest) => {
  try {
    const supabase = supabaseAdmin;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: user } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', session.user.id)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const webhookId = url.searchParams.get('id');

    if (!webhookId) {
      return NextResponse.json(
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    // Verificar se webhook pertence à organização
    const webhook = await webhookService.getById(webhookId);
    if (!webhook || webhook.org_id !== user.org_id) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    await webhookService.delete(webhookId);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});

export const PATCH = withMetrics('/api/webhooks', async (request: NextRequest) => {
  try {
    const supabase = supabaseAdmin;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: user } = await supabase
      .from('users')
      .select('role, org_id')
      .eq('id', session.user.id)
      .single();

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    // Verificar se webhook pertence à organização
    const webhook = await webhookService.getById(id);
    if (!webhook || webhook.org_id !== user.org_id) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    // Ações especiais
    if (action === 'regenerate_secret') {
      const newSecret = await webhookService.regenerateSecret(id);
      return NextResponse.json({
        success: true,
        data: { secret: newSecret },
        message: 'Secret regenerated successfully. Save it - it cannot be retrieved later.',
      });
    }

    // Atualização normal
    const updated = await webhookService.update(id, updates);

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        secret: '***' + updated.secret.slice(-4),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});
