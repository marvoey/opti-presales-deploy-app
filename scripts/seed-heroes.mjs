/**
 * Create and publish HeroBlockv2 content items from a JSON seed file.
 *
 * Works exactly like seed-paragraphs.mjs but targets HeroBlockv2 and defaults
 * to seeds/library/discover-recommend/heroes/items.json.
 *
 * Supports the same reference types in property values and the container field:
 *
 *   { "$file": "path/to/file.html" }
 *   Reads the file from disk relative to process.cwd() and inlines its content.
 *
 *   { "$env": "FOLDER_DISCOVER_RECOMMEND_HERO_BLOCKS" }
 *   Reads the named environment variable at runtime.
 *
 * The input file may be a plain JSON array, or an envelope object:
 *   { "container": { "$env": "FOLDER_DISCOVER_RECOMMEND_HERO_BLOCKS" }, "items": [...] }
 *
 * BackgroundImage is a contentReference — supply it as { "key": "<cms-content-key>" }
 * or omit the property to leave it unset.
 *
 * Usage:
 *   node scripts/seed-heroes.mjs [path-to-items.json] [--dry-run] [--limit <n>]
 *   npm run seed:heroes:dr
 *
 * Flags:
 *   --dry-run    Resolve all refs and print what would be sent — no API calls made.
 *   --limit <n>  Only process the first n items.
 *   --live       Use ROOT_CONTAINER_LIVE instead of ROOT_CONTAINER as the target folder.
 *
 * Generate a CMS-compatible key (UUID without hyphens):
 *   node -e "const {randomUUID}=require('crypto'); console.log(randomUUID().replaceAll('-',''))"
 *
 * Required env vars:
 *   OPTIMIZELY_CMS_CLIENT_ID
 *   OPTIMIZELY_CMS_CLIENT_SECRET
 *   OPTIMIZELY_CMS_API_URL   (optional, defaults to https://api.cms.optimizely.com)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

try {
  const require = createRequire(import.meta.url);
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
} catch {
  // Running outside Next context — env must be set externally.
}

const DEFAULT_GATEWAY = 'https://api.cms.optimizely.com';
const DEFAULT_INPUT = 'seeds/library/discover-recommend/heroes/items.json';
const live = process.argv.includes('--live');
const ROOT_CONTAINER_KEY = (live ? process.env.ROOT_CONTAINER_LIVE : process.env.ROOT_CONTAINER) ?? '43f936c99b234ea397b261c538ad07c9';

function apiBase() {
  return (process.env.OPTIMIZELY_CMS_API_URL || DEFAULT_GATEWAY).replace(/\/$/, '');
}

function readCredentials() {
  const clientId = process.env.OPTIMIZELY_CMS_CLIENT_ID?.trim();
  const clientSecret = process.env.OPTIMIZELY_CMS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Set OPTIMIZELY_CMS_CLIENT_ID and OPTIMIZELY_CMS_CLIENT_SECRET in .env\n' +
        '(create an API Client in CMS admin → Settings → API Clients).',
    );
  }
  return { clientId, clientSecret };
}

async function getAccessToken(base, clientId, clientSecret) {
  const res = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status}). Check credentials.`);
  const data = await res.json();
  if (!data.access_token) throw new Error('Token endpoint returned no access_token.');
  return data.access_token;
}

/** Resolve a single reference, or return the value as-is.
 *  { "$file": "path" }          → string (file contents)
 *  { "$env": "VAR" }            → string (env var value)
 */
function resolveRef(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value['$file']) {
      return readFileSync(resolve(process.cwd(), value['$file']), 'utf8');
    }
    if (value['$env']) {
      const val = process.env[value['$env']];
      if (!val) throw new Error(`Environment variable "${value['$env']}" is not set.`);
      return val;
    }
  }
  return value;
}

/** Resolve all $file / $env references in a properties object. */
function resolveFileRefs(properties) {
  const resolved = {};
  for (const [key, value] of Object.entries(properties)) {
    resolved[key] = resolveRef(value);
  }
  return resolved;
}

async function createItem(base, token, item, defaultContainer) {
  const container = resolveRef(item.container ?? defaultContainer ?? ROOT_CONTAINER_KEY);
  const body = {
    contentType: item.contentType,
    container,
    initialVersion: {
      displayName: item.displayName,
      locale: item.locale ?? 'en',
      properties: resolveFileRefs(item.properties ?? {}),
    },
  };
  if (item.key) body.key = item.key;

  const res = await fetch(`${base}/v1/content`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'cms-skip-validation': '*',
      prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    return { skipped: true };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /content failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const key = data.key;
  const version = data.initialVersion?.version ?? data.version;
  if (!key || version == null) throw new Error('POST /content response missing key or version.');
  return { key, version, skipped: false };
}

async function publishItem(base, token, key, version) {
  const res = await fetch(`${base}/v1/content/${encodeURIComponent(key)}/versions/${version}:publish`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Publish failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const filePath = argv.find(a => !a.startsWith('--')) ?? DEFAULT_INPUT;
const dryRun = argv.includes('--dry-run');
const limitIdx = argv.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(argv[limitIdx + 1], 10) : null;

let items;
try {
  items = JSON.parse(readFileSync(resolve(process.cwd(), filePath), 'utf8'));
} catch (err) {
  console.error(`Could not read items file: ${err.message}`);
  process.exit(1);
}

let defaultContainer;
if (Array.isArray(items)) {
  // Plain array — no envelope default container.
} else if (items && typeof items === 'object' && Array.isArray(items.items)) {
  // Envelope format: { container: ..., items: [...] }
  defaultContainer = items.container;
  items = items.items;
} else {
  console.error('Items file must be a JSON array or an envelope object { container, items[] }.');
  process.exit(1);
}

if (items.length === 0) {
  console.error('Items file contains no items.');
  process.exit(1);
}

if (limit != null && !isNaN(limit)) {
  items = items.slice(0, limit);
  console.log(`--limit ${limit}: processing ${items.length} of the available items.`);
}

// Dry-run: resolve refs and print what would be sent — no API calls.
if (dryRun) {
  console.log(`DRY RUN — ${items.length} item(s):\n`);
  for (const item of items) {
    const container = resolveRef(item.container ?? defaultContainer ?? ROOT_CONTAINER_KEY);
    const properties = resolveFileRefs(item.properties ?? {});
    const preview = Object.fromEntries(
      Object.entries(properties).map(([k, v]) =>
        typeof v === 'string' && v.length > 120 ? [k, v.slice(0, 120) + '… (truncated)'] : [k, v]
      )
    );
    const body = { contentType: item.contentType, container, key: item.key, initialVersion: { displayName: item.displayName, locale: item.locale ?? 'en', properties: preview } };
    console.log(JSON.stringify(body, null, 2));
    console.log('---');
  }
  process.exit(0);
}

const cred = readCredentials();
const base = apiBase();

console.log(`Authenticating…`);
const token = await getAccessToken(base, cred.clientId, cred.clientSecret);

const results = { created: 0, skipped: 0, failed: 0 };

for (const item of items) {
  const label = item.key ?? item.displayName;
  try {
    const { key, version, skipped } = await createItem(base, token, item, defaultContainer);
    if (skipped) {
      console.log(`  SKIP     ${label} (already exists)`);
      results.skipped++;
    } else {
      await publishItem(base, token, key, version);
      console.log(`  CREATED  ${label} → ${key} v${version}`);
      results.created++;
    }
  } catch (err) {
    console.error(`  FAILED   ${label}: ${err.message}`);
    results.failed++;
  }
}

console.log(`\nDone. Created: ${results.created}  Skipped: ${results.skipped}  Failed: ${results.failed}`);
if (results.failed > 0) process.exitCode = 1;
