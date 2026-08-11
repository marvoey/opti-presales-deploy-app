// Compares locally defined content types (cms/*.tsx) against what's registered
// in the CMS and reports which are synced, missing, or CMS-only.
//
// Usage:
//   node scripts/check-content-types.mjs
//   npm run cms:check
//
// Required env vars (add to .env):
//   OPTIMIZELY_CMS_CLIENT_ID
//   OPTIMIZELY_CMS_CLIENT_SECRET
//   OPTIMIZELY_CMS_API_URL   (optional, defaults to https://api.cms.optimizely.com)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load .env when running locally.
if (
  (!process.env.OPTIMIZELY_CMS_CLIENT_ID || !process.env.OPTIMIZELY_CMS_CLIENT_SECRET) &&
  typeof process.loadEnvFile === 'function'
) {
  try {
    process.loadEnvFile(join(ROOT, '.env'));
  } catch {
    // No .env file — continue with whatever is in process.env.
  }
}

const GATEWAY = (process.env.OPTIMIZELY_CMS_API_URL || 'https://api.cms.optimizely.com').replace(/\/$/, '');
const { OPTIMIZELY_CMS_CLIENT_ID, OPTIMIZELY_CMS_CLIENT_SECRET } = process.env;

// ---------------------------------------------------------------------------
// Parse local content type keys from cms/ (recursive)
// ---------------------------------------------------------------------------

function collectTsx(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      result.push(...collectTsx(abs));
    } else if (entry.endsWith('.tsx')) {
      result.push(abs);
    }
  }
  return result;
}

function localContentTypeKeys() {
  const cmsDir = join(ROOT, 'cms');
  const keys = [];

  for (const abs of collectTsx(cmsDir)) {
    const rel = abs.replace(ROOT + '/', '');
    const src = readFileSync(abs, 'utf8');
    const re = /contentType\s*\(\s*\{[^}]*?key\s*:\s*['"]([^'"]+)['"]/gs;
    let m;
    while ((m = re.exec(src)) !== null) {
      keys.push({ key: m[1], file: rel });
    }
  }

  return keys;
}

// ---------------------------------------------------------------------------
// CMS API helpers
// ---------------------------------------------------------------------------

async function getToken() {
  const res = await fetch(`${GATEWAY}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: OPTIMIZELY_CMS_CLIENT_ID,
      client_secret: OPTIMIZELY_CMS_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data?.access_token) throw new Error('Token endpoint returned no access_token');
  return data.access_token;
}

async function fetchAllCmsTypes(token) {
  const res = await fetch(`${GATEWAY}/v1/contentTypes?pageSize=1000`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /v1/contentTypes failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.items ?? data ?? [];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!OPTIMIZELY_CMS_CLIENT_ID || !OPTIMIZELY_CMS_CLIENT_SECRET) {
    throw new Error(
      'Missing OPTIMIZELY_CMS_CLIENT_ID / OPTIMIZELY_CMS_CLIENT_SECRET.\n' +
        'Set them in .env or the environment.',
    );
  }

  const local = localContentTypeKeys();
  if (local.length === 0) {
    console.log('No contentType() definitions found in cms/*.tsx.');
    return;
  }

  console.log('Authenticating…');
  const token = await getToken();

  console.log('Fetching content types from CMS…\n');
  const cmsTypes = await fetchAllCmsTypes(token);
  const cmsKeys = new Set(cmsTypes.map(t => t.key));

  const willOverwrite = local.filter(e => cmsKeys.has(e.key));

  if (willOverwrite.length === 0) {
    console.log('No local content types exist in the CMS yet — safe to push.');
    return;
  }

  console.log(`⚠  Will overwrite in CMS on next \`npm run cms:push\` (${willOverwrite.length})`);
  for (const { key, file } of willOverwrite) {
    console.log(`   ${key.padEnd(36)} ${file}`);
  }
  console.log();

  process.exitCode = 1;
}

main().catch(err => {
  console.error(`[cms:check] ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
