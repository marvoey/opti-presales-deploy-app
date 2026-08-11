/**
 * Create and publish a BlankExperience from a JSON seed file.
 *
 * Usage:
 *   node scripts/seed-experience.mjs <path-to-seed.json> [--live]
 *   npm run seed:experience -- <path-to-seed.json> [--live]
 *
 * Flags:
 *   --live   Use ROOT_CONTAINER_LIVE instead of ROOT_CONTAINER as the target folder.
 *
 * Required env vars (add to .env):
 *   OPTIMIZELY_CMS_CLIENT_ID
 *   OPTIMIZELY_CMS_CLIENT_SECRET
 *   OPTIMIZELY_CMS_API_URL   (optional, defaults to https://api.cms.optimizely.com)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

// Load .env via Next.js env loader (no dotenv dependency required).
try {
  const require = createRequire(import.meta.url);
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
} catch {
  // Running outside Next context — env must be set externally.
}

const DEFAULT_GATEWAY = 'https://api.cms.optimizely.com';

function buildRouteSegment(seed) {
  if (seed.routeSegment) return seed.routeSegment;
  return seed.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-{3,}/g, '--')
    .replace(/^-+|-+$/g, '');
}
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

async function createExperience(base, token, seed, routeSegment) {
  const body = {
    contentType: seed.contentType ?? 'BlankExperience',
    container: seed.container ?? ROOT_CONTAINER_KEY,
    initialVersion: {
      displayName: seed.displayName,
      locale: seed.locale ?? 'en',
      routeSegment,
      properties: {},
    },
  };
  if (seed.key) body.key = seed.key;

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
    return { existed: true };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /content failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const key = data.key;
  const version = data.initialVersion?.version ?? data.version;
  if (!key || version == null) throw new Error('POST /content response missing key or version.');
  return { key, version, existed: false };
}

async function patchComposition(base, token, key, version, composition) {
  const res = await fetch(`${base}/v1/content/${encodeURIComponent(key)}/versions/${version}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/merge-patch+json',
      authorization: `Bearer ${token}`,
      'cms-skip-validation': '*',
    },
    body: JSON.stringify({ composition }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH composition failed (${res.status}): ${text}`);
  }
}

async function deleteContent(base, token, key) {
  await fetch(`${base}/v1/content/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/** Page through published versions to find the content key for a given routeSegment. */
async function findKeyByRouteSegment(base, token, routeSegment) {
  let pageIndex = 0;
  while (true) {
    const res = await fetch(
      `${base}/v1/content/versions:all?statuses=published&pageSize=100&pageIndex=${pageIndex}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const match = data.items?.find((v) => v.routeSegment === routeSegment);
    if (match?.key) return match.key;
    if (!data.items?.length || data.items.length < 100) return null;
    pageIndex++;
  }
}

async function publishVersion(base, token, key, version) {
  const res = await fetch(`${base}/v1/content/${encodeURIComponent(key)}/versions/${version}:publish`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });

  if (res.ok) return { routeConflict: false };

  let body = {};
  try { body = await res.json(); } catch { throw new Error(`Publish failed (${res.status}): (unreadable response)`); }

  const hasRouteConflict = body.errors?.some((e) => e.field === 'RouteSegment') ?? false;
  if (hasRouteConflict) return { routeConflict: true };

  const details = body.errors?.map((e) => e.detail).filter(Boolean).join('; ');
  throw new Error(`Publish failed (${res.status})${details ? `: ${details}` : ''}`);
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function toSlug(input) {
  return input.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ---------------------------------------------------------------------------

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/seed-experience.mjs <path-to-seed.json>');
  process.exit(1);
}

let seed;
try {
  seed = JSON.parse(readFileSync(resolve(process.cwd(), filePath), 'utf8'));
} catch (err) {
  console.error(`Could not read seed file: ${err.message}`);
  process.exit(1);
}

if (!seed.displayName || !seed.composition) {
  console.error('Seed file must have "displayName" and "composition" fields.');
  process.exit(1);
}

async function main() {
  const cred = readCredentials();
  const base = apiBase();

  console.log(`Authenticating…`);
  const token = await getAccessToken(base, cred.clientId, cred.clientSecret);

  let routeSegment = buildRouteSegment(seed);

  while (true) {
    console.log(`Creating experience "${seed.displayName}"…`);
    const result = await createExperience(base, token, seed, routeSegment);

    if (result.existed) {
      console.log(`\nSkipped — experience already exists in the CMS.`);
      console.log(`  URL:     /${routeSegment}`);
      process.exit(0);
    }

    const { key, version } = result;

    console.log(`Patching composition…`);
    await patchComposition(base, token, key, version, seed.composition);

    console.log(`Publishing…`);
    const publish = await publishVersion(base, token, key, version);

    if (publish.routeConflict) {
      await deleteContent(base, token, key);
      console.log(`\nURL "/${routeSegment}" is already in use by a published page.`);

      const overwrite = await prompt('Overwrite the existing page? [y/N] ');
      if (overwrite.toLowerCase() === 'y') {
        console.log('Looking up existing page…');
        const existingKey = await findKeyByRouteSegment(base, token, routeSegment);
        if (!existingKey) {
          console.error('Could not locate the existing page via the API. Delete it manually in the CMS and re-run.');
          process.exit(1);
        }
        await deleteContent(base, token, existingKey);
        console.log('Existing page deleted. Retrying…');
        continue;
      }

      const createNew = await prompt('Create with a different URL? [y/N] ');
      if (createNew.toLowerCase() !== 'y') {
        console.log('Aborted.');
        process.exit(0);
      }

      const slug = await prompt('Enter a URL slug: ');
      if (!slug) {
        console.error('No slug provided. Aborted.');
        process.exit(1);
      }

      routeSegment = toSlug(slug);
      console.log(`Retrying with display name "${seed.displayName}" and URL "/${routeSegment}"…`);
      continue;
    }

    console.log(`\nDone.`);
    console.log(`  Key:     ${key}`);
    console.log(`  Version: ${version}`);
    console.log(`  URL:     /${routeSegment}`);
    break;
  }
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
