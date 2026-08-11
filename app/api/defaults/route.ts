import { readFileSync } from 'fs';
import { join } from 'path';

const CMS_KEYS = [
  'OPTIMIZELY_CMS_URL',
  'OPTIMIZELY_CMS_CLIENT_ID',
  'OPTIMIZELY_CMS_CLIENT_SECRET',
  'OPTIMIZELY_GRAPH_SINGLE_KEY',
] as const;

function parseEnvFile(path: string): Record<string, string> | null {
  try {
    const content = readFileSync(path, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key) result[key] = value;
    }
    return result;
  } catch {
    return null;
  }
}

export async function GET() {
  const env = parseEnvFile(join(process.cwd(), '.env.deploy'));
  if (!env) return Response.json({});
  return Response.json(Object.fromEntries(CMS_KEYS.map((k) => [k, env[k] ?? ''])));
}
