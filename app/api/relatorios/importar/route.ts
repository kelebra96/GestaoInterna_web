// =============================================
// API de Importação de Relatórios de Varejo
// POST /api/relatorios/importar
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  TipoRelatorioABC,
  REPORT_MAPPINGS,
} from '@/lib/types/retail-import';
import {
  parseCSV,
  detectReportType,
  generatePreview,
  importarRelatorioABC,
  consolidarMetricasAposImportacao,
} from '@/lib/services/retail-import.service';
import iconv from 'iconv-lite';

// Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper para extrair user payload do header
function getUserPayload(request: NextRequest): { userId: string; orgId: string } | null {
  const payloadHeader = request.headers.get('x-user-payload');
  if (!payloadHeader) return null;
  try {
    return JSON.parse(payloadHeader);
  } catch {
    return null;
  }
}

// =============================================
// POST - Importar Relatório
// =============================================

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserPayload(request);
    if (!userPayload) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const lojaId = formData.get('lojaId') as string | null;
    const dataReferencia = formData.get('dataReferencia') as string | null;
    const tipoRelatorio = formData.get('tipo') as TipoRelatorioABC | null;
    const action = formData.get('action') as string | null;

    // Validações básicas
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Arquivo não fornecido' },
        { status: 400 }
      );
    }

    // Ler conteúdo do arquivo
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detectar e converter encoding (arquivos brasileiros geralmente são latin1)
    let content: string;
    try {
      // Tentar latin1 primeiro (comum em arquivos Windows brasileiros)
      content = iconv.decode(buffer, 'latin1');
    } catch {
      // Fallback para UTF-8
      content = buffer.toString('utf-8');
    }

    // Se é apenas preview
    if (action === 'preview') {
      try {
        const preview = generatePreview(content, tipoRelatorio || undefined);
        return NextResponse.json({
          success: true,
          preview,
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao gerar preview',
          },
          { status: 400 }
        );
      }
    }

    // Validar campos obrigatórios para importação
    if (!lojaId) {
      return NextResponse.json(
        { success: false, error: 'Loja não selecionada' },
        { status: 400 }
      );
    }

    if (!dataReferencia) {
      return NextResponse.json(
        { success: false, error: 'Data de referência não informada' },
        { status: 400 }
      );
    }

    // Detectar tipo se não informado
    const { headers } = parseCSV(content, ';');
    const tipo = tipoRelatorio || detectReportType(headers);

    if (!tipo) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível identificar o tipo de relatório' },
        { status: 400 }
      );
    }

    // Verificar se o tipo é válido
    if (!REPORT_MAPPINGS[tipo]) {
      return NextResponse.json(
        { success: false, error: `Tipo de relatório inválido: ${tipo}` },
        { status: 400 }
      );
    }

    // Verificar se a loja existe e pertence à organização
    // Primeiro tenta buscar por store_id (enviado pelo frontend)
    // Depois tenta por id da dim_loja (fallback)
    const supabase = getSupabaseAdmin();

    let loja = null;
    let lojaError = null;

    // Tentar buscar por store_id primeiro
    const { data: lojaByStoreId, error: err1 } = await supabase
      .from('dim_loja')
      .select('id, nome')
      .eq('store_id', lojaId)
      .eq('organization_id', userPayload.orgId)
      .maybeSingle();

    if (lojaByStoreId) {
      loja = lojaByStoreId;
    } else {
      // Fallback: buscar por id da dim_loja
      const { data: lojaById, error: err2 } = await supabase
        .from('dim_loja')
        .select('id, nome')
        .eq('id', lojaId)
        .eq('organization_id', userPayload.orgId)
        .maybeSingle();

      loja = lojaById;
      lojaError = err2;
    }

    // Se não encontrou na dim_loja, tentar criar a partir da stores
    if (lojaError || !loja) {
      // Verificar na tabela stores
      const { data: store } = await supabase
        .from('stores')
        .select('id, name, code, company_id')
        .eq('id', lojaId)
        .single();

      if (store) {
        // Criar ou atualizar na dim_loja usando upsert
        const lojaCode = store.code || store.id.substring(0, 20);
        const { data: novaLoja, error: insertError } = await supabase
          .from('dim_loja')
          .upsert(
            {
              organization_id: userPayload.orgId,
              store_id: store.id,
              codigo: lojaCode,
              nome: store.name,
            },
            {
              onConflict: 'organization_id,codigo',
            }
          )
          .select('id')
          .single();

        if (insertError) {
          console.error('Erro ao registrar loja:', insertError);

          // Tentar buscar novamente (pode já existir com outro ID)
          const { data: lojaExistente } = await supabase
            .from('dim_loja')
            .select('id')
            .eq('organization_id', userPayload.orgId)
            .eq('store_id', store.id)
            .maybeSingle();

          if (lojaExistente) {
            // Usar a loja existente
            const resultado = await importarRelatorioABC(
              tipo,
              userPayload.orgId,
              lojaExistente.id,
              dataReferencia,
              content
            );

            if (resultado.success) {
              try {
                await consolidarMetricasAposImportacao(userPayload.orgId, lojaExistente.id, dataReferencia);
              } catch (e) {
                console.error('Erro ao consolidar:', e);
              }
            }

            return NextResponse.json({ success: resultado.success, resultado });
          }

          return NextResponse.json(
            { success: false, error: `Erro ao registrar loja: ${insertError.message}` },
            { status: 400 }
          );
        }

        // Usar o ID da dim_loja
        const resultado = await importarRelatorioABC(
          tipo,
          userPayload.orgId,
          novaLoja.id,
          dataReferencia,
          content
        );

        // Consolidar métricas após importação bem-sucedida
        if (resultado.success) {
          try {
            await consolidarMetricasAposImportacao(
              userPayload.orgId,
              novaLoja.id,
              dataReferencia
            );
          } catch (consolidateError) {
            console.error('Erro ao consolidar métricas:', consolidateError);
            // Não falhar a importação por causa da consolidação
          }
        }

        return NextResponse.json({
          success: resultado.success,
          resultado,
        });
      }

      return NextResponse.json(
        { success: false, error: 'Loja não encontrada' },
        { status: 404 }
      );
    }

    // Executar importação usando loja.id (dim_loja.id), não lojaId (store_id)
    const dimLojaId = loja.id;

    const resultado = await importarRelatorioABC(
      tipo,
      userPayload.orgId,
      dimLojaId,
      dataReferencia,
      content
    );

    // Consolidar métricas após importação bem-sucedida
    if (resultado.success) {
      try {
        await consolidarMetricasAposImportacao(
          userPayload.orgId,
          dimLojaId,
          dataReferencia
        );
      } catch (consolidateError) {
        console.error('Erro ao consolidar métricas:', consolidateError);
      }
    }

    return NextResponse.json({
      success: resultado.success,
      resultado,
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

// =============================================
// GET - Listar histórico de importações
// =============================================

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserPayload(request);
    if (!userPayload) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const lojaId = searchParams.get('lojaId');
    const tipo = searchParams.get('tipo');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('historico_importacoes_varejo')
      .select(`
        *,
        dim_loja (
          id,
          nome,
          codigo
        )
      `)
      .eq('organization_id', userPayload.orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (lojaId) {
      query = query.eq('loja_id', lojaId);
    }

    if (tipo) {
      query = query.eq('tipo_relatorio', tipo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar histórico' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      historico: data,
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
