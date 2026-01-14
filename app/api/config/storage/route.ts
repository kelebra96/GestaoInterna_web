
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const configFilePath = path.join(process.cwd(), 'storage.config.json');

async function getConfig() {
  try {
    const data = await fs.readFile(configFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    // If the file doesn't exist, create it with default values
    if (error.code === 'ENOENT') {
      const defaultConfig = { useFirebase: true };
      await fs.writeFile(configFilePath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    throw error;
  }
}

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read configuration' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { useFirebase } = await request.json();
    if (typeof useFirebase !== 'boolean') {
      return NextResponse.json({ error: 'Invalid value for useFirebase' }, { status: 400 });
    }

    const currentConfig = await getConfig();
    const newConfig = { ...currentConfig, useFirebase };

    await fs.writeFile(configFilePath, JSON.stringify(newConfig, null, 2));

    return NextResponse.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
  }
}
