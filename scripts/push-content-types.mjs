// Push specific content types to the CMS by key.
//
// Usage:
//   node scripts/push-content-types.mjs <Key1> [Key2 ...]
//   npm run cms:push:type -- HeroBlockv2 CardBlock
//
// The script finds the cms/*.tsx file(s) that define each requested key,
// generates a scoped temporary config, runs the CMS CLI against it, then
// cleans up. All other content types are untouched.

import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CMS_DIR = join(ROOT, 'cms');
const TEMP_CONFIG = join(ROOT, '.push-types-temp.mjs');

// ---------------------------------------------------------------------------
// Parse requested keys from argv
// ---------------------------------------------------------------------------

const force = process.argv.includes('--force');
const requestedKeys = process.argv.slice(2).filter(a => a !== '--force');
if (requestedKeys.length === 0) {
  console.error('Usage: node scripts/push-content-types.mjs <Key1> [Key2 ...]');
  console.error('Example: npm run cms:push:type -- HeroBlockv2 CardBlock');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Recursively collect all .tsx files under cms/
// ---------------------------------------------------------------------------

function collectTsx(dir, root = dir) {
  const entries = readdirSync(dir);
  const result = [];
  for (const entry of entries) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      result.push(...collectTsx(abs, root));
    } else if (entry.endsWith('.tsx')) {
      result.push(abs);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Find the tsx file(s) that define each key
// ---------------------------------------------------------------------------

const files = collectTsx(CMS_DIR);
const keyToFile = new Map(); // key → absolute path

for (const absPath of files) {
  const src = readFileSync(absPath, 'utf8');
  const re = /contentType\s*\(\s*\{[^}]*?key\s*:\s*['"]([^'"]+)['"]/gs;
  let m;
  while ((m = re.exec(src)) !== null) {
    keyToFile.set(m[1], absPath);
  }
}

const relPath = abs => abs.replace(ROOT + '/', '');

const missing = requestedKeys.filter(k => !keyToFile.has(k));
if (missing.length > 0) {
  console.error(`Key(s) not found under cms/: ${missing.join(', ')}`);
  console.error('Available keys:');
  for (const [key, abs] of [...keyToFile.entries()].sort()) {
    console.error(`  ${key.padEnd(36)} ${relPath(abs)}`);
  }
  process.exit(1);
}

const matchedFiles = [...new Set(requestedKeys.map(k => keyToFile.get(k)))];

// ---------------------------------------------------------------------------
// Write a scoped temp config and run the CLI
// ---------------------------------------------------------------------------

const componentPaths = matchedFiles.map(f => `  '${f}'`).join(',\n');
const tempConfig = `import { buildConfig } from '@optimizely/cms-sdk';
export default buildConfig({
  components: [
${componentPaths}
  ],
  propertyGroups: [
    { key: 'Taxonomy', displayName: 'Taxonomy', sortOrder: 100 },
  ],
});
`;

console.log(`Pushing ${requestedKeys.length} type(s): ${requestedKeys.join(', ')}`);
for (const k of requestedKeys) {
  console.log(`  ${k.padEnd(36)} ${relPath(keyToFile.get(k))}`);
}
console.log();

writeFileSync(TEMP_CONFIG, tempConfig, 'utf8');

try {
  execSync(`npx @optimizely/cms-cli config push ${TEMP_CONFIG}${force ? ' --force' : ''}`, {
    stdio: 'inherit',
    cwd: ROOT,
  });
} finally {
  unlinkSync(TEMP_CONFIG);
}
