// Next.js server launcher (dev + start).
//
// Next.js resolves its listen port *before* it loads the project's .env, so a
// `PORT` set there is ignored by a bare `next dev` / `next start`. This launcher
// loads .env first (mirroring scripts/generate-locales.mjs) and passes the
// resolved port through, so the port is configurable from one place: .env.
//
// The Next subcommand is the first arg; extra args are forwarded:
//   node scripts/run-next.mjs dev            (npm run dev)
//   node scripts/run-next.mjs start          (npm run start)
//   npm run dev -- -H 0.0.0.0

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const [command, ...forwarded] = process.argv.slice(2);
if (command !== 'dev' && command !== 'start') {
  console.error(`[run-next] Expected "dev" or "start" as the first arg, got "${command}".`);
  process.exit(1);
}

// Load .env unless the platform already injected PORT (e.g. a hosted env).
// process.loadEnvFile does not overwrite existing vars, so injected values win.
if (!process.env.PORT && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(join(ROOT, '.env'));
  } catch {
    // No .env file present — fall through to the default port below.
  }
}

const DEFAULT_PORT = '3009';
const port = process.env.PORT?.trim() || DEFAULT_PORT;

if (!/^\d+$/.test(port)) {
  console.error(`[run-next] Invalid PORT "${port}" — must be a number.`);
  process.exit(1);
}

console.log(`[run-next] Starting "next ${command}" on port ${port}`);

const child = spawn(
  'next',
  [command, '-p', port, ...forwarded],
  { cwd: ROOT, stdio: 'inherit', shell: false },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
