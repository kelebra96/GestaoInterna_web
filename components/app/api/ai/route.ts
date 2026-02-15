import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type GenerateBody = {
  chamadoId?: string;
  text?: string;
};

type StructuredProposal = {
  insights?: string[];
  visualizations?: { title?: string; type?: string; spec?: unknown }[];
  codePatches?: { path?: string; patch?: string }[];
  raw?: unknown;
};

type ChamadoDoc = {
  title?: string;
  description?: string;
};

async function callOpenAIStructured(prompt: string): Promise<StructuredProposal> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  // Pedir resposta em JSON para facilitar parsing e estruturação
  const system = `Você é um assistente que gera:
- um array 'insights' com insights acionáveis (strings);
- um array 'visualizations' com objetos {title, type, spec} onde 'spec' é um breve JSON compatível com Vega-Lite ou Chart.js;
- opcionalmente um array 'codePatches' com objetos {path, patch} contendo sugestões de alterações de código (em texto).
Retorne SOMENTE um JSON válido com essas chaves. Não inclua texto adicional fora do JSON.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1200,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('OpenAI error: ' + txt);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  // Tentar parsear JSON
  try {
    if (typeof content === 'string') {
      return JSON.parse(content) as StructuredProposal;
    }
  } catch {
    // parse error, fallback to raw
  }

  // Se não for JSON, retornar como texto sob a chave 'raw'
  return { raw: content };
}

export async function POST(req: Request) {
  try {
    const body: GenerateBody = await req.json();
    const { chamadoId, text } = body;

    let chamadoDoc: ChamadoDoc | null = null;
    if (chamadoId) {
      const { data, error } = await supabaseAdmin
        .from('chamados')
        .select('title, description')
        .eq('id', chamadoId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
      }

      chamadoDoc = data as ChamadoDoc;
    }

    const prompt = chamadoId
      ? `Gere 3 insights acionáveis e 2 sugestões de visualização (tipo + campos + breve spec Vega-Lite/Chart.js) para o seguinte chamado:\n\nTítulo: ${chamadoDoc?.title}\nDescrição: ${chamadoDoc?.description}`
      : `Gere 3 insights acionáveis e 2 sugestões de visualização para o texto: ${text}`;

    const aiResponse = await callOpenAIStructured(prompt);

    // Salvar proposta estruturada no documento do chamado
    if (chamadoId) {
      const { error: updateError } = await supabaseAdmin
        .from('chamados')
        .update({
          proposal: {
            generatedAt: new Date().toISOString(),
            structured: aiResponse,
          },
        })
        .eq('id', chamadoId);

      if (updateError) {
        console.error('[AI] Error updating chamado:', updateError);
        throw updateError;
      }
    }

    return NextResponse.json({ proposal: aiResponse });
  } catch (error: unknown) {
    console.error('Erro ao gerar com IA:', error);
    const message = error instanceof Error ? error.message : 'Falha ao gerar com IA';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
