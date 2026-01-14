import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase-client';
import { v4 as uuidv4 } from 'uuid';

const configFilePath = path.join(process.cwd(), 'storage.config.json');

async function getConfig() {
  const data = await fs.readFile(configFilePath, 'utf-8');
  return JSON.parse(data);
}

export async function POST(request: Request) {
  try {
    const config = await getConfig();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileId = uuidv4();
    const fileExtension = path.extname(file.name);
    const fileName = `${fileId}${fileExtension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Use Supabase by default (config.useFirebase is deprecated)
    if (!config.useFirebase) {
      // --- Supabase Upload ---
      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error('[Upload] Supabase storage error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

      return NextResponse.json({ url: publicUrl, path: data.path });
    } else {
      // --- Local Upload (fallback) ---
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true }); // Ensure directory exists
      const localPath = path.join(uploadsDir, fileName);
      await fs.writeFile(localPath, fileBuffer);

      // Return a URL that can be used to access the file locally
      const localUrl = `/uploads/${fileName}`;
      return NextResponse.json({ url: localUrl, path: localPath });
    }
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}