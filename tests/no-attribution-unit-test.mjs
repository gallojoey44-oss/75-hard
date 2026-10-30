import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CHALLENGE_TEMPLATES } from '../src/data/challengeTemplates.js';
import { HABIT_LIBRARY } from '../src/data/habitLibrary.js';

/**
 * Forge speaks in its own voice.
 *
 * The app used to credit named people for its habits and challenges — an
 * "Informed by: …" line under a challenge's programme, a "Source: …" line under
 * every suggested habit. However it was meant, naming a public figure beside a
 * product reads as that person standing behind the product, and none of them
 * has anything to do with Forge. The habits, the guidance and the evidence
 * levels stayed; the names went.
 *
 * This guards the removal three ways, because a name can come back by three
 * routes: someone writes one into content, someone re-adds the FIELD that used
 * to carry them, or someone adds a new attribution label. The last check reads
 * the built bundle rather than the source, because that is what a person
 * actually sees and it contains no comments to explain anything away.
 */

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

/**
 * The people who were credited, and the forms their names took.
 *
 * Listed individually rather than guessed at by pattern: a regex for "two
 * capitalised words" would fire on every challenge name in the registry, and a
 * check that cries wolf gets deleted by the third person who trips it.
 */
const NAMES = [
  'Huberman', 'Matthew Walker', 'James Clear', 'Peter Attia', 'Layne Norton',
  'Cal Newport', 'Csikszentmihalyi', 'Anders Ericsson', 'Brad Schoenfeld',
  'Eric Helms', 'Mike Israetel',
];
const NAME_RE = new RegExp(NAMES.join('|'), 'i');

/** The fields that used to carry attributions, by name. */
const CARRIER_RE = /inspiration_sources/;

/** The labels those fields were printed under. */
const LABEL_RE = /informed by/i;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function scan(files, re, label) {
  const hits = [];
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    text.split('\n').forEach((line, i) => {
      if (re.test(line)) hits.push(`${relative(process.cwd(), f)}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  check(label, hits.length === 0, hits.length ? `\n    ${hits.join('\n    ')}` : '');
  return hits;
}

// ── 1. The data carries no attributions ─────────────────────────────────────
//
// Read from the modules themselves, so a field that is present but empty, or
// renamed in the file while still shipping, is still caught.

check('there are challenges to check', CHALLENGE_TEMPLATES.length > 0);
const withSources = CHALLENGE_TEMPLATES.filter(t => 'inspiration_sources' in t);
check('no challenge template carries an inspiration list',
  withSources.length === 0,
  withSources.map(t => t.id).join(', '));

check('there are habit suggestions to check', HABIT_LIBRARY.length > 0);
const withSource = HABIT_LIBRARY.filter(h => 'source' in h);
check('no suggested habit is credited to a person',
  withSource.length === 0,
  withSource.map(h => `${h.id}: ${h.source}`).join(', '));

// The habits themselves have to survive the removal — this is a content
// cleanup, not a content deletion.
check('every habit still says what to do',
  HABIT_LIBRARY.every(h => typeof h.task === 'string' && h.task.length > 10),
  HABIT_LIBRARY.filter(h => !h.task).map(h => h.id).join(', '));
check('and why it may help',
  HABIT_LIBRARY.every(h => typeof h.why === 'string' && h.why.length > 10),
  HABIT_LIBRARY.filter(h => !h.why).map(h => h.id).join(', '));
check('with its evidence still qualified',
  HABIT_LIBRARY.every(h => !!h.evidenceLevel && !!h.riskLevel),
  HABIT_LIBRARY.filter(h => !h.evidenceLevel || !h.riskLevel).map(h => h.id).join(', '));

// ── 2. The source tree names nobody ─────────────────────────────────────────

const srcFiles = [
  ...walk('src'),
  ...(existsSync('public') ? walk('public') : []),
  ...(existsSync('api') ? walk('api') : []),
  ...(existsSync('index.html') ? ['index.html'] : []),
];
check('there are source files to scan', srcFiles.length > 20, `${srcFiles.length} files`);

scan(srcFiles, NAME_RE, 'no source file names any of the credited people');
scan(srcFiles, CARRIER_RE, 'no source file re-introduces the attribution field');
scan(srcFiles, LABEL_RE, 'no source file prints an "Informed by" label');

// ── 3. The built bundle, which is what a person actually reads ──────────────
//
// Comments are stripped at build time, so anything matched here is a string
// that genuinely ships. This is the check that cannot be argued with.

if (!existsSync('dist')) {
  check('the production build is present to scan (run `npx vite build` first)', false);
} else {
  const distFiles = walk('dist');
  check('there are built assets to scan', distFiles.length > 0, `${distFiles.length} files`);
  scan(distFiles, NAME_RE, 'the production build names none of them');
  scan(distFiles, CARRIER_RE, 'the production build ships no attribution field');
  scan(distFiles, /informed by|inspired by/i,
    'the production build ships no attribution label');
}

// ── Summary ─────────────────────────────────────────────────────────────────

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
