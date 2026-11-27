/**
 * A copy of Forge built against the local Supabase stack, served on its own
 * port — the same app code, with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * set the way a deployment sets them. Nothing else differs.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_URL, ANON_KEY } from './stack.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vite = join(root, 'node_modules', '.bin', 'vite');

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return true; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

export async function startJourneyBuild(port = 4175) {
  const out = mkdtempSync(join(tmpdir(), 'forge-journey-build-'));
  const env = { ...process.env, VITE_SUPABASE_URL: SUPABASE_URL, VITE_SUPABASE_ANON_KEY: ANON_KEY };
  const built = spawnSync(vite, ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, env, encoding: 'utf8' });
  if (built.status !== 0) {
    rmSync(out, { recursive: true, force: true });
    throw new Error(`journey build failed: ${built.stderr || built.stdout}`);
  }
  const server = spawn(vite, ['preview', '--outDir', out, '--port', String(port), '--strictPort'], { cwd: root, env, stdio: 'ignore' });
  const url = `http://localhost:${port}`;
  if (!(await waitFor(url))) {
    server.kill();
    rmSync(out, { recursive: true, force: true });
    throw new Error(`journey build did not start on ${url}`);
  }
  return {
    url,
    stop() {
      try { server.kill(); } catch { /* gone */ }
      rmSync(out, { recursive: true, force: true });
    },
  };
}
