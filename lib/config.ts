
import { promises as fs } from 'fs';
import path from 'path';

const configFilePath = path.join(process.cwd(), 'storage.config.json');

export async function getConfig() {
  try {
    const data = await fs.readFile(configFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const defaultConfig = { useFirebase: true };
      await fs.writeFile(configFilePath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    throw error;
  }
}
