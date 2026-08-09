#!/usr/bin/env node
/**
 * Test runner. Bundles *-unit-test.mjs with esbuild (they import app source),
 * runs every suite, and reports a summary.
 *
 * Usage:
 *   node tests/run.mjs            # all suites
 *   node tests/run.mjs fatloss    # only suites whose filename matches
 *
 * e2e suites need a production build served on :4173 (npx vite preview).
 */
import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const filter = process.argv[2] || '';
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

const suites = readdirSync(here)
  .filter(f => f.endsWith('-test.mjs'))
  .filter(f => !filter || f.includes(filter))
  .sort();

if (!suites.length) {
  console.error(`No suites matched "${filter}".`);
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'forge-tests-'));
let passed = 0;
const failures = [];

for (const suite of suites) {
  const src = join(here, suite);
  let entry = src;
  // Unit suites import app source with bare/relative specifiers — bundle them.
  if (suite.includes('-unit-')) {
    entry = join(work, suite.replace('-test.mjs', '-bundle.mjs'));
    try {
      execFileSync(esbuild, [src, '--bundle', '--platform=node', '--format=esm', `--outfile=${entry}`], { stdio: 'pipe' });
    } catch (err) {
      console.log(`\n=== ${suite} ===\nBUNDLE FAILED\n${err.stderr?.toString() || err.message}`);
      failures.push(suite);
      continue;
    }
  }
  console.log(`\n=== ${suite} ===`);
  const res = spawnSync(process.execPath, [entry], { stdio: 'inherit', cwd: root });
  if (res.status === 0) passed++;
  else failures.push(suite);
}

rmSync(work, { recursive: true, force: true });

console.log(`\n${'='.repeat(48)}`);
console.log(`Suites: ${passed}/${suites.length} passed`);
if (failures.length) {
  console.log(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
