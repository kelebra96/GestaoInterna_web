import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { searchImages } from '@/lib/images/pipeline';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';

  const devBypass = process.env.NODE_ENV !== 'production';
  if (!devBypass) {
    const auth = await getAuthFromRequest(request);
    if (!auth || ![Role.super_admin, Role.admin_rede].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (!query.trim()) {
    return NextResponse.json({ error: 'query é obrigatório' }, { status: 400 });
  }

  try {
    const urls = await searchImages('bing', query);
    return NextResponse.json({
      query,
      count: urls.length,
      sample: urls.slice(0, 5),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao consultar Bing' },
      { status: 500 }
    );
  }
}
