// web/app/api/sales/import/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { IncomingForm, File } from 'formidable';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';
import { z } from 'zod';

// Zod schema for a single sales row from CSV
const salesRowSchema = z.object({
  storeCode: z.string().min(1),
  sku: z.string().min(1),
  date: z.string(), // Assuming YYYY-MM-DD format
  hour: z.preprocess(val => parseInt(String(val), 10), z.number().int().min(0).max(23)),
  quantity: z.preprocess(val => parseInt(String(val), 10), z.number().int().min(0)),
});

// Helper to parse the form data
async function parseFormData(request: Request): Promise<{ fields: any, files: { [key: string]: File | File[] } }> {
    const formidableRequest = request as any;
    return new Promise((resolve, reject) => {
        const form = new IncomingForm();
        form.parse(formidableRequest, (err, fields, files) => {
            if (err) {
                return reject(err);
            }
            resolve({ fields, files: files as any });
        });
    });
}
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth || !['super_admin', 'admin_rede'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { fields, files } = await parseFormData(request);
    const fileData = files.file;

    if (!fileData) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const file = Array.isArray(fileData) ? fileData[0] : fileData;
    const fileContent = await fs.readFile(file.filepath, 'utf8');
    const records: any[] = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
    });

    parser.on('readable', function(){
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });

    parser.write(fileContent);
    parser.end();

    const salesToCreate: any[] = [];
    const errors: any[] = [];

    const [stores, products] = await Promise.all([
        prisma.store.findMany({ where: { orgId: auth.orgId } }),
        prisma.product.findMany({ where: { orgId: auth.orgId } }),
    ]);

    const storeMap = new Map(stores.map(s => [s.code, s.id]));
    const productMap = new Map(products.map(p => [p.sku, p.id]));

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const validation = salesRowSchema.safeParse(record);

      if (!validation.success) {
        errors.push({ row: i + 2, errors: validation.error.flatten() });
        continue;
      }

      const { storeCode, sku, date, hour, quantity } = validation.data;

      const storeId = storeMap.get(storeCode);
      if (!storeId) {
        errors.push({ row: i + 2, message: `Store with code ${storeCode} not found.` });
        continue;
      }

      const productId = productMap.get(sku);
      if (!productId) {
        errors.push({ row: i + 2, message: `Product with SKU ${sku} not found.` });
        continue;
      }

      salesToCreate.push({
        storeId,
        productId,
        date: new Date(date),
        hour,
        quantity,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Invalid data in CSV file', details: errors }, { status: 400 });
    }

    const result = await prisma.hourlySale.createMany({
      data: salesToCreate,
    });

    return NextResponse.json({
      message: `${result.count} hourly sales records imported successfully.`,
    });

  } catch (error) {
    console.error("Error importing sales:", error);
    return NextResponse.json({ error: "An internal server error occurred during import" }, { status: 500 });
  }
}
