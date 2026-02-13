/**
 * API Route: GET /api/expiry-analytics/funnel
 * Retorna dados do funil de ações (reported → watched → confirmed → resolved)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFunnelData } from '@/lib/repositories/expiry-analytics.repository';
import { ExpiryAnalyticsFilters, PeriodFilter, ExpiryStatus } from '@/lib/types/expiry-analytics';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';

const NETWORK_ROLES = ['developer', 'admin', 'buyer', 'super_admin', 'admin_rede', 'merchandiser'];

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

    const period = (searchParams.get('period') || '30d') as PeriodFilter;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const storeId = searchParams.get('storeId') || undefined;
    const category = searchParams.get('category') || undefined;

    let allowedStoreIds: string[] | undefined;

    if (!canAccessAllStores(userPayload.role)) {
      allowedStoreIds = userPayload.storeIds;
      if (storeId && !allowedStoreIds.includes(storeId)) {
        return NextResponse.json(
          { success: false, error: 'Acesso negado a esta loja' },
          { status: 403 }
        );
      }
    }

    const filters: ExpiryAnalyticsFilters = {
      period,
      startDate,
      endDate,
      storeId: storeId || undefined,
      storeIds: !storeId ? allowedStoreIds : undefined,
      category,
    };

    const funnel = await getFunnelData(filters);

    return NextResponse.json({
      success: true,
      data: funnel,
    });
  } catch (error) {
    console.error('Erro ao buscar funil:', error);
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
