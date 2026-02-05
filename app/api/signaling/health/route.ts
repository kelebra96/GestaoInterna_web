import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/signaling/health
 * Proxy para testar conexão com o servidor de signaling
 * Evita problemas de CORS e Mixed Content (HTTPS -> HTTP)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serverUrl = searchParams.get('url');

  if (!serverUrl) {
    return NextResponse.json(
      { error: 'URL do servidor não fornecida' },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Servidor respondeu com status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Signaling Health] Erro:', error.message);

    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Tempo esgotado - servidor não respondeu' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Não foi possível conectar ao servidor' },
      { status: 502 }
    );
  }
}
