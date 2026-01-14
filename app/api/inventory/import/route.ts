// web/app/api/inventory/import/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { IncomingForm, File } from 'formidable';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';
import { z } from 'zod';
import { InventorySource } from '@prisma/client';

// Zod schema for a single inventory row from CSV
const inventoryRowSchema = z.object({
  storeCode: z.string().min(1),
  sku: z.string().min(1).optional(),
  ean: z.string().min(1).optional(),
  quantity: z.preprocess(val => parseInt(String(val), 10), z.number().int().min(0)),
});

// Helper to parse the form data
async function parseFormData(request: Request): Promise<{ fields: any, files: any }> {
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
    const file = files.file;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

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

    const inventorySnapshotsToCreate: any[] = [];
    const errors: any[] = [];

    // Fetch all stores and products for the organization to resolve IDs
    const [stores, products] = await Promise.all([
        prisma.store.findMany({ where: { orgId: auth.orgId } }),
        prisma.product.findMany({ where: { orgId: auth.orgId } }),
    ]);

    const storeMap = new Map(stores.map(s => [s.code, s.id]));
    const productMapSku = new Map(products.map(p => [p.sku, p.id]));
    const productMapEan = new Map(products.filter(p => p.ean).map(p => [p.ean!, p.id]));

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const validation = inventoryRowSchema.safeParse(record);

      if (!validation.success) {
        errors.push({ row: i + 2, errors: validation.error.flatten() });
        continue;
      }

      const { storeCode, sku, ean, quantity } = validation.data;

      const storeId = storeMap.get(storeCode);
      if (!storeId) {
        errors.push({ row: i + 2, message: `Store with code ${storeCode} not found in organization.` });
        continue;
      }

      let productId: string | undefined;
      if (sku) {
          productId = productMapSku.get(sku);
      } else if (ean) {
          productId = productMapEan.get(ean);
      }

      if (!productId) {
          errors.push({ row: i + 2, message: `Product with SKU ${sku || 'N/A'} or EAN ${ean || 'N/A'} not found in organization.` });
          continue;
      }

      inventorySnapshotsToCreate.push({
        orgId: auth.orgId,
        storeId: storeId,
        productId: productId,
        quantity: quantity,
        snapshotAt: new Date(),
        source: InventorySource.csv,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Invalid data in CSV file', details: errors }, { status: 400 });
    }

    // Use upsert to handle existing inventory snapshots for the same product/store
    // For simplicity, we'll delete existing and create new for now.
    // A more robust solution would involve checking existing snapshots and updating quantities.
    await prisma.inventorySnapshot.deleteMany({
        where: {
            orgId: auth.orgId,
            storeId: { in: Array.from(new Set(inventorySnapshotsToCreate.map(s => s.storeId))) },
            productId: { in: Array.from(new Set(inventorySnapshotsToCreate.map(s => s.productId))) },
        }
    });

    const result = await prisma.inventorySnapshot.createMany({
      data: inventorySnapshotsToCreate,
    });

    return NextResponse.json({
      message: `${result.count} inventory snapshots imported successfully.`,
    });

  } catch (error) {
    console.error("Error importing inventory:", error);
    return NextResponse.json({ error: "An internal server error occurred during import" }, { status: 500 });
  }
}
