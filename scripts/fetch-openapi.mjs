// Fetches the Optimizely CMS REST API (Content) OpenAPI schema and writes it to
// `cms-openapi.json` at the project root.
//
// Run via: `npm run schema:pull`
//
// Auth + endpoints mirror the cms-cli's REST client
// (node_modules/@optimizely/cms-cli/dist/service/cmsRestClient.js): OAuth
// client-credentials → `POST {gateway}/oauth/token`, then
// `GET {gateway}/v1/docs/content-openapi.json`.
//
// Usage:
//   node --env-file=.env scripts/fetch-openapi.mjs [outFile]
//   npm run schema:pull                 # writes cms-openapi.json
//   npm run schema:pull -- ./other.json # custom output path

import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Resolve configuration from the environment. On Vercel/CI the vars are injected
// by the platform (already in process.env). Locally they often aren't exported,
// so if the CMS credentials are missing we fall back to loading the project's
// .env file. `process.loadEnvFile` does not overwrite vars already in the
// environment, so the platform's values always win.
if (
  (!process.env.OPTIMIZELY_CMS_CLIENT_ID || !process.env.OPTIMIZELY_CMS_CLIENT_SECRET) &&
  typeof process.loadEnvFile === 'function'
) {
  try {
    process.loadEnvFile(join(ROOT, '.env'));
    console.log('[schema:pull] Loaded configuration from .env');
  } catch {
    // No .env file present — continue with whatever is already in process.env.
  }
}

const GATEWAY = (process.env.OPTIMIZELY_CMS_API_URL || 'https://api.cms.optimizely.com').replace(
  /\/$/,
  '',
);
const API_VERSION = 'v1';
const SCHEMA_PATH = `/${API_VERSION}/docs/content-openapi.json`;
const OUT_FILE = resolve(ROOT, process.argv[2] || 'cms-openapi.json');

const { OPTIMIZELY_CMS_CLIENT_ID, OPTIMIZELY_CMS_CLIENT_SECRET } = process.env;

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
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!data?.access_token) throw new Error('Token endpoint returned no access_token');
  return data.access_token;
}

async function fetchSchema(token) {
  const res = await fetch(`${GATEWAY}${SCHEMA_PATH}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Schema request failed: ${res.status} ${res.statusText} (${SCHEMA_PATH})`);
  }
  return res.json();
}

async function main() {
  if (!OPTIMIZELY_CMS_CLIENT_ID || !OPTIMIZELY_CMS_CLIENT_SECRET) {
    throw new Error(
      'Missing OPTIMIZELY_CMS_CLIENT_ID / OPTIMIZELY_CMS_CLIENT_SECRET. ' +
        'Set them in .env or the environment.',
    );
  }

  const token = await getToken();
  const schema = await fetchSchema(token);

  await writeFile(OUT_FILE, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');

  const paths = Object.keys(schema?.paths ?? {}).length;
  const schemas = Object.keys(schema?.components?.schemas ?? {}).length;
  console.log(
    `[schema:pull] Wrote ${OUT_FILE}\n` +
      `  ${schema?.info?.title ?? 'OpenAPI'} ${schema?.info?.version ?? ''} ` +
      `(openapi ${schema?.openapi ?? '?'}, ${paths} paths, ${schemas} schemas)`,
  );
}

main().catch((err) => {
  console.error(`[schema:pull] ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
