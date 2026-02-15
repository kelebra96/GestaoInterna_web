// web/app/api/products/import/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { IncomingForm, File } from 'formidable';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse';
import { z } from 'zod';

// Zod schema for a single product row from CSV
const productRowSchema = z.object({
  sku: z.string().min(1),
  ean: z.string().optional(),
  name: z.string().min(2),
  brand: z.string().min(1),
  category: z.string().min(2),
  subcategory: z.string().optional(),
  width: z.preprocess(val => parseFloat(String(val)), z.number().positive()),
  height: z.preprocess(val => parseFloat(String(val)), z.number().positive()),
  depth: z.preprocess(val => parseFloat(String(val)), z.number().positive()),
  price: z.preprocess(val => parseFloat(String(val)), z.number().positive()),
  margin: z.preprocess(val => parseFloat(String(val)), z.number().min(0)),
  imageUrl: z.string().url().optional(),
});

// Helper to parse the form data
async function parseFormData(request: Request): Promise<{ fields: any, files: { [key: string]: File } }> {
    const formidableRequest = request as any;
    return new Promise((resolve, reject) => {
        const form = new IncomingForm();
        form.parse(formidableRequest, (err, fields, files) => {
            if (err) {
                return reject(err);
            }
            resolve({ fields, files: files as unknown as { [key: string]: File } });
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

    let orgId: string;
    if (auth.role === 'super_admin') {
        const orgIdField = Array.isArray(fields.orgId) ? fields.orgId[0] : fields.orgId;
        if (!orgIdField) {
            return NextResponse.json({ error: "orgId field is required for super_admin" }, { status: 400 });
        }
        orgId = orgIdField;
    } else { // admin_rede
        orgId = auth.orgId;
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

    const validatedProducts = [];
    const errors: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const validation = productRowSchema.safeParse(record);
      if (validation.success) {
        validatedProducts.push({ ...validation.data, orgId });
      } else {
        errors.push({ row: i + 2, errors: validation.error.flatten() });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Invalid data in CSV file', details: errors }, { status: 400 });
    }

    // In a real-world scenario, you'd want to handle conflicts (e.g., duplicate SKUs)
    // using `upsert` in a loop, but `createMany` is faster for bulk inserts of new data.
    // Prisma's `createMany` with MongoDB does not support `skipDuplicates`.
    // We'll assume for now we are importing new products.
    
    const result = await prisma.product.createMany({
      data: validatedProducts,
      // Note: skipDuplicates is not supported for MongoDB
    });

    return NextResponse.json({
      message: `${result.count} products imported successfully.`,
    });

  } catch (error) {
    console.error("Error importing products:", error);
    return NextResponse.json({ error: "An internal server error occurred during import" }, { status: 500 });
  }
}
