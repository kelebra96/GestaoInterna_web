// web/app/api/produtos/import-csv/route.ts
/**
 * Endpoint de importação de produtos via CSV
 * Usa csv-parse REAL - SEM MOCKS
 * Conforme especificado no documento PLANOGRAMA.md
 */
import { NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { IncomingForm, File } from 'formidable';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse/sync';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { z } from 'zod';

// Schema de validação Zod para produtos
const ProductSchema = z.object({
  orgId: z.string().optional(),
  sku: z.string().min(1),
  ean: z.string().optional(),
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  price: z.number().nonnegative().optional(),
  margin: z.number().min(0).max(100).optional(),
  imageUrl: z.string().url().optional(),
});

type ProductInput = z.infer<typeof ProductSchema>;

// Helper to parse the form data
async function parseFormData(request: Request): Promise<{ fields: any, files: any }> {
    const formidableRequest = request as any;
    return new Promise((resolve, reject) => {
        const form = new IncomingForm();
        form.parse(formidableRequest, (err, fields, files) => {
            if (err) {
                return reject(err);
            }
            resolve({ fields, files });
        });
    });
}

/**
 * POST /api/produtos/import-csv
 * Importa produtos via arquivo CSV
 *
 * Colunas esperadas no CSV:
 * - sku (obrigatório)
 * - ean
 * - name (obrigatório)
 * - brand
 * - category (obrigatório)
 * - subcategory
 * - width (cm)
 * - height (cm)
 * - depth (cm)
 * - price
 * - margin (%)
 * - imageUrl
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { fields, files } = await parseFormData(request);

    const csvFile = files.csvFile;
    if (!csvFile) {
        return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
    }

    const file = Array.isArray(csvFile) ? csvFile[0] : csvFile;
    const fileContent = await fs.readFile(file.filepath, 'utf-8');

    // Parse CSV usando csv-parse
    const records = parse(fileContent, {
      columns: true, // Primeira linha como headers
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Converter strings para números quando necessário
        if (context.column === 'width' || context.column === 'height' ||
            context.column === 'depth' || context.column === 'price' ||
            context.column === 'margin') {
          const num = parseFloat(value);
          return isNaN(num) ? undefined : num;
        }
        return value || undefined;
      },
    });

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    const orgId = auth.role === 'super_admin' ? fields.orgId : auth.orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // Validar e processar produtos
    const validProducts: ProductInput[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as any;
      const productData = {
        orgId,
        sku: record.sku,
        ean: record.ean,
        name: record.name,
        brand: record.brand,
        category: record.category,
        subcategory: record.subcategory,
        width: record.width,
        height: record.height,
        depth: record.depth,
        price: record.price,
        margin: record.margin,
        imageUrl: record.imageUrl,
      };

      // Validar com Zod
      const validation = ProductSchema.safeParse(productData);

      if (!validation.success) {
        errors.push({
          row: i + 2, // +2 porque linha 1 é header e array é 0-indexed
          errors: validation.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`),
        });
      } else {
        validProducts.push(validation.data);
      }
    }

    // Se houver muitos erros, retornar sem importar nada
    if (errors.length > records.length / 2) {
      return NextResponse.json({
        error: 'Too many validation errors in CSV file',
        errors: errors.slice(0, 50), // Retornar apenas primeiros 50 erros
        totalErrors: errors.length,
      }, { status: 400 });
    }

    // Importar produtos válidos em lote
    const batchSize = 500;
    let importedCount = 0;
    let updatedCount = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < validProducts.length; i += batchSize) {
      const batchProducts = validProducts.slice(i, i + batchSize);

      for (const product of batchProducts) {
        // Verificar se produto já existe (por SKU + orgId)
        const { data: existingProducts, error: existingError } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('org_id', orgId)
          .eq('sku', product.sku)
          .limit(1);

        if (existingError) {
          console.error('[Import CSV] Erro ao verificar produto existente:', existingError);
          continue;
        }

        if (existingProducts && existingProducts.length > 0) {
          // Atualizar produto existente
          const { error: updateError } = await supabaseAdmin
            .from('products')
            .update({
              org_id: product.orgId,
              sku: product.sku,
              ean: product.ean,
              name: product.name,
              brand: product.brand,
              category: product.category,
              subcategory: product.subcategory,
              width: product.width,
              height: product.height,
              depth: product.depth,
              price: product.price,
              margin: product.margin,
              image_url: product.imageUrl,
              updated_at: now,
            })
            .eq('id', existingProducts[0].id);

          if (!updateError) {
            updatedCount++;
          } else {
            console.error('[Import CSV] Erro ao atualizar produto:', updateError);
          }
        } else {
          // Criar novo produto
          const { error: insertError } = await supabaseAdmin
            .from('products')
            .insert({
              org_id: product.orgId,
              sku: product.sku,
              ean: product.ean,
              name: product.name,
              brand: product.brand,
              category: product.category,
              subcategory: product.subcategory,
              width: product.width,
              height: product.height,
              depth: product.depth,
              price: product.price,
              margin: product.margin,
              image_url: product.imageUrl,
              created_at: now,
              updated_at: now,
            });

          if (!insertError) {
            importedCount++;
          } else {
            console.error('[Import CSV] Erro ao inserir produto:', insertError);
          }
        }
      }
    }

    // Limpar arquivo temp
    await fs.unlink(file.filepath).catch(() => {
      // Ignorar erros ao deletar arquivo temp
    });

    return NextResponse.json({
      success: true,
      message: `CSV processed successfully`,
      stats: {
        totalRows: records.length,
        imported: importedCount,
        updated: updatedCount,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });

  } catch (error) {
    console.error("Error importing products from CSV:", error);
    return NextResponse.json({
      error: "An internal server error occurred during CSV import",
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
