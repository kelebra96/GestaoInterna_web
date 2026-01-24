import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Inicializar cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Buscar os últimos erros de teste
    // Vamos pegar os testes que falharam na última execução de cada tipo
    const { data: failedTests, error: dbError } = await supabaseAdmin
      .from('test_results')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (dbError) throw dbError;

    if (!failedTests || failedTests.length === 0) {
      return NextResponse.json({
        message: 'Nenhum erro recente encontrado para análise.',
        solutions: []
      });
    }

    // 2. Preparar o prompt para a IA
    const errorsDescription = failedTests.map((test, index) => {
      return `Erro ${index + 1}:
      - Teste: ${test.test_name} (Suite: ${test.test_suite})
      - Mensagem de Erro: ${test.error_message}
      - Dados: ${JSON.stringify(test.metadata || {})}
      `;
    }).join('\n\n');

    const prompt = `
      Você é um Arquiteto de Software Sênior especialista em Next.js, React e Supabase.
      Analise os seguintes erros encontrados nos testes automatizados do sistema:

      ${errorsDescription}

      Para CADA erro, forneça uma resposta estruturada em JSON (sem markdown, apenas o JSON puro) com o seguinte formato:
      [
        {
          "testName": "Nome do teste",
          "diagnosis": "Explicação técnica de por que falhou",
          "severity": "baixa" | "media" | "alta",
          "suggestedFix": "Explicação do que precisa ser alterado",
          "codeSnippet": "Código sugerido para correção (se aplicável)"
        }
      ]

      Seja direto e técnico. Foco na solução.
    `;

    // 3. Chamar OpenAI
    console.log('[AI Fix] Analyzing errors with OpenAI...');
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Usando 3.5 para ser mais rápido/barato, pode mudar para gpt-4o
      messages: [
        { role: "system", content: "You are a helpful expert developer assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Tentar fazer o parse do JSON
    let solutions = [];
    try {
      // Limpar possíveis blocos de código markdown ```json ... ```
      const cleanJson = aiResponse?.replace(/```json/g, '').replace(/```/g, '').trim();
      solutions = JSON.parse(cleanJson || '[]');
    } catch (e) {
      console.error('[AI Fix] Failed to parse AI response:', e);
      // Fallback: retornar o texto puro
      solutions = [{ diagnosis: aiResponse, testName: 'Análise Geral' }];
    }

    return NextResponse.json({
      success: true, 
      count: failedTests.length,
      solutions 
    });

  } catch (error: any) {
    console.error('[AI Fix] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao processar análise da IA'
    }, { status: 500 });
  }
}
