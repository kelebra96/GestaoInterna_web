import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * API para gerar endereços automaticamente por intervalo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: inventoryId } = await params;
    const body = await request.json();

    const {
      rua,
      predioInicio,
      predioFim,
      andarInicio,
      andarFim,
      apartamentoInicio,
      apartamentoFim,
    } = body;

    // Validações
    if (!rua || !predioInicio || !predioFim || !andarInicio || !andarFim || !apartamentoInicio || !apartamentoFim) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    const predioInicioNum = parseInt(predioInicio);
    const predioFimNum = parseInt(predioFim);
    const andarInicioNum = parseInt(andarInicio);
    const andarFimNum = parseInt(andarFim);
    const apartamentoInicioNum = parseInt(apartamentoInicio);
    const apartamentoFimNum = parseInt(apartamentoFim);

    if (
      isNaN(predioInicioNum) ||
      isNaN(predioFimNum) ||
      isNaN(andarInicioNum) ||
      isNaN(andarFimNum) ||
      isNaN(apartamentoInicioNum) ||
      isNaN(apartamentoFimNum)
    ) {
      return NextResponse.json(
        { error: 'Todos os valores numéricos devem ser válidos' },
        { status: 400 }
      );
    }

    if (predioInicioNum > predioFimNum || andarInicioNum > andarFimNum || apartamentoInicioNum > apartamentoFimNum) {
      return NextResponse.json(
        { error: 'Os valores de início devem ser menores ou iguais aos valores de fim' },
        { status: 400 }
      );
    }

    // Verificar inventário e permissões
    const inventoryRef = db.collection('inventories').doc(inventoryId);
    const inventorySnap = await inventoryRef.get();

    if (!inventorySnap.exists) {
      return NextResponse.json(
        { error: 'Inventário não encontrado' },
        { status: 404 }
      );
    }

    const inventoryData = inventorySnap.data();
    if (auth.role !== "super_admin" && inventoryData?.companyId !== auth.orgId) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }

    // Calcular total de endereços
    const totalPredios = predioFimNum - predioInicioNum + 1;
    const totalAndares = andarFimNum - andarInicioNum + 1;
    const totalApartamentos = apartamentoFimNum - apartamentoInicioNum + 1;
    const totalEnderecos = totalPredios * totalAndares * totalApartamentos;

    if (totalEnderecos > 10000) {
      return NextResponse.json(
        { error: `Limite excedido: isso geraria ${totalEnderecos} endereços. Máximo: 10.000` },
        { status: 400 }
      );
    }

    console.log(`[Generate Addresses] Gerando ${totalEnderecos} endereços para inventário ${inventoryId}`);

    // Gerar endereços
    const enderecosParaCriar: string[] = [];
    const ruaNormalizada = rua.trim().toUpperCase();

    for (let predio = predioInicioNum; predio <= predioFimNum; predio++) {
      for (let andar = andarInicioNum; andar <= andarFimNum; andar++) {
        for (let apto = apartamentoInicioNum; apto <= apartamentoFimNum; apto++) {
          // Formato: RUA.PRÉDIO.ANDAR.APARTAMENTO
          // Exemplo: 002.22.10.1
          const predioStr = predio.toString().padStart(2, '0');
          const andarStr = andar.toString().padStart(2, '0');
          const aptoStr = apto.toString();

          const endereco = `${ruaNormalizada}.${predioStr}.${andarStr}.${aptoStr}`;
          enderecosParaCriar.push(endereco);
        }
      }
    }

    // Buscar endereços existentes
    const existingAddressesSnap = await db
      .collection('inventory_addresses')
      .where('inventoryId', '==', inventoryId)
      .get();

    const existingAddressCodes = new Set(
      existingAddressesSnap.docs.map((doc: any) => doc.data().addressCode?.toUpperCase())
    );

    // Filtrar endereços que já existem
    const enderecosNovos = enderecosParaCriar.filter(
      (endereco) => !existingAddressCodes.has(endereco)
    );

    if (enderecosNovos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos os endereços já existem',
        stats: {
          total: totalEnderecos,
          created: 0,
          duplicates: totalEnderecos,
        },
      });
    }

    // Criar endereços em lotes (Firestore tem limite de 500 operações por batch)
    const BATCH_SIZE = 500;
    let created = 0;

    for (let i = 0; i < enderecosNovos.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const lote = enderecosNovos.slice(i, i + BATCH_SIZE);

      for (const addressCode of lote) {
        const addressRef = db.collection('inventory_addresses').doc();
        batch.set(addressRef, {
          inventoryId,
          addressCode,
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
          createdBy: auth.userId,
          companyId: auth.orgId,
        });
      }

      await batch.commit();
      created += lote.length;

      console.log(`[Generate Addresses] Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${lote.length} endereços criados`);
    }

    console.log(`[Generate Addresses] Finalizado: ${created} endereços criados, ${totalEnderecos - created} duplicados`);

    return NextResponse.json({
      success: true,
      message: `${created} endereços criados com sucesso`,
      stats: {
        total: totalEnderecos,
        created,
        duplicates: totalEnderecos - created,
      },
    });
  } catch (error: any) {
    console.error('[Generate Addresses] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar endereços: ' + error.message },
      { status: 500 }
    );
  }
}
