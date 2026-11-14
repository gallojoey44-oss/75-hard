/**
 * A build of Forge with background push switched on, served on its own port.
 *
 * The suite's normal build has no VAPID public key, because the key is inlined
 * at build time and CI has none — which is the right default, and means every
 * code path behind "is background push configured?" is otherwise untested. A
 * suite that needs those paths asks for this instead: the same source, built
 * once into a temporary directory with a placeholder key, and previewed on a
 * port of its own so it cannot disturb the shared :4173 server.
 *
 * The key is a placeholder. No push service is ever contacted: headless
 * Chromium cannot create a push subscription, and every /api/ call is answered
 * by fakePushApi in-process.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vite = join(root, 'node_modules', '.bin', 'vite');
// 65 bytes of base64url, the shape of an uncompressed P-256 public key.
const PLACEHOLDER_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return true; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

export async function startPushBuild(port = 4174) {
  const out = mkdtempSync(join(tmpdir(), 'forge-push-build-'));
  const env = { ...process.env, VITE_VAPID_PUBLIC_KEY: PLACEHOLDER_KEY };
  const built = spawnSync(vite, ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, env, encoding: 'utf8' });
  if (built.status !== 0) {
    rmSync(out, { recursive: true, force: true });
    throw new Error(`push build failed: ${built.stderr || built.stdout}`);
  }
  const server = spawn(vite, ['preview', '--outDir', out, '--port', String(port), '--strictPort'], { cwd: root, env, stdio: 'ignore' });
  const url = `http://localhost:${port}`;
  if (!(await waitFor(url))) {
    server.kill();
    rmSync(out, { recursive: true, force: true });
    throw new Error(`push build did not start on ${url}`);
  }
  return {
    url,
    stop() {
      try { server.kill(); } catch { /* already gone */ }
      rmSync(out, { recursive: true, force: true });
    },
  };
}
