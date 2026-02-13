/**
 * API Route: GET /api/expiry-analytics/kpis
 * Retorna todos os KPIs agregados para o dashboard de vencimentos
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllKPIs } from '@/lib/repositories/expiry-analytics.repository';
import { ExpiryAnalyticsFilters, PeriodFilter, ExpiryStatus } from '@/lib/types/expiry-analytics';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';

// Roles que podem ver a rede inteira
const NETWORK_ROLES = ['developer', 'admin', 'buyer', 'super_admin', 'admin_rede', 'merchandiser'];

// Roles que só veem sua própria loja
const STORE_ROLES = ['manager', 'agent', 'gestor_loja', 'repositor'];

interface UserPayload {
  userId: string;
  orgId: string;
  role: string;
  storeIds: string[];
}

function getUserPayload(request: NextRequest): UserPayload | null {
  try {
    const payloadHeader = request.headers.get('x-user-payload');
    if (!payloadHeader) return null;
    return JSON.parse(payloadHeader);
  } catch {
    return null;
  }
}

function canAccessAllStores(role: string): boolean {
  return NETWORK_ROLES.includes(role.toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserPayload(request);

    if (!userPayload) {
      return NextResponse.json(
        { success: false, error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query params
    const period = (searchParams.get('period') || '30d') as PeriodFilter;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const storeId = searchParams.get('storeId') || undefined;
    const statusParam = searchParams.get('status');
    const category = searchParams.get('category') || undefined;
    const brand = searchParams.get('brand') || undefined;

    // Parse status array
    let status: ExpiryStatus[] | undefined;
    if (statusParam) {
      status = statusParam.split(',') as ExpiryStatus[];
    }

    // Verificar permissões
    let allowedStoreIds: string[] | undefined;

    if (!canAccessAllStores(userPayload.role)) {
      // Usuário só pode ver suas lojas
      allowedStoreIds = userPayload.storeIds;

      // Se pediu um storeId específico, verificar se tem permissão
      if (storeId && !allowedStoreIds.includes(storeId)) {
        return NextResponse.json(
          { success: false, error: 'Acesso negado a esta loja' },
          { status: 403 }
        );
      }
    }

    // Montar filtros
    const filters: ExpiryAnalyticsFilters = {
      period,
      startDate,
      endDate,
      storeId: storeId || undefined,
      storeIds: !storeId ? allowedStoreIds : undefined,
      status,
      category,
      brand,
    };

    const kpis = await getAllKPIs(filters);

    return NextResponse.json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    console.error('Erro ao buscar KPIs:', error);
    if (error instanceof PrismaClientInitializationError) {
      return NextResponse.json(
        { success: false, error: 'Erro de conexão com o banco de dados. Verifique sua DATABASE_URL.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar requisição' },
      { status: 500 }
    );
  }
}
