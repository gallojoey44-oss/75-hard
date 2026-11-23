/**
 * Daily Log — Stress beside Mood and Energy.
 *
 * Stress used to sit inside "More metrics". It now leads with the metrics
 * logged every day. Only its place and its wording changed: it writes the same
 * `stress` field on the same 1–10 scale, so every stored day, archive and
 * backup reads exactly as before.
 *
 *   A. The main metrics read Mood, Energy, Stress, Hours Slept, Notes — in that
 *      order, before "More metrics" — and Stress says what 1 and 10 mean.
 *   B. There is one Stress control: "More metrics" no longer has one or names
 *      it, and keeps the other four.
 *   C. Stress writes the same field, every value 1–10 exactly, nothing is saved
 *      by arriving, and it survives a reload.
 *   D. It stays optional and the Daily Log rule is unchanged: any one metric
 *      completes the habit once, and more metrics pay nothing more.
 *   E. Stress saved before this release shows in its new place, on any day, and
 *      the other metrics keep theirs. Loading writes nothing.
 *   F. Each profile keeps its own values.
 *   G. A backup exports stress as it always did, and restoring one shows it.
 *   H. 320, 390 and 430px.
 *
 * Run against a production build:  npx vite preview --port 4173
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function offset(n) { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); }

async function gotoTab(name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => new RegExp(`^${n}$`, 'i').test((x.getAttribute('aria-label') || x.textContent || '').trim()));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(400);
}
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);
const allDaysRaw = () => page.evaluate(() => localStorage.getItem('allDays'));

const TASKS = [
  { id: 'li_flow', name: 'Flow training: 2 focused sessions', icon: '🌊', xp: 29, keystone: 3 },
  { id: 'li_execute', name: 'Execute 2 of 3 priorities', icon: '✅', xp: 28, keystone: 3 },
  { id: 'li_mission', name: 'Daily mission: 3 priorities', icon: '🗂️', xp: 20, keystone: 2 },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0 },
];
const META = {
  templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard', durationDays: 14,
  passingScore: 70, keystoneRequirement: 65, xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180, completionBonusXP: 504,
};

/** Both profiles on Day 3 of LOCK IN, with whatever day records are given. */
async function seed(records = { me: {}, girlfriend: {} }, active = 'me') {
  await page.evaluate((p) => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify(p)); }, active);
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
  await page.evaluate(({ records, start, tasks, meta }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    for (const id of ['me', 'girlfriend']) {
      p[id].highestRank = 7;
      p[id].xpPenalties = false;
      p[id].challengeStart = start;
      p[id].activeChallenge = { ...meta };
      p[id].tasks = tasks.map((t, i) => ({ ...t, source: 'template', order: i }));
    }
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify(records));
  }, { records, start: offset(-2), tasks: TASKS, meta: META });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
  await gotoTab('Today');
  await page.waitForSelector('.daily-log-card', { timeout: 15000 });
}

const stressRow = () => page.locator('.daily-log-card .rating-row', { hasText: 'Stress' });
const stressTrack = () => stressRow().locator('.rating-track');
const stressShown = async () => (await stressRow().locator('.rating-val').textContent()).replace(/\s+/g, '');
const openMore = async () => {
  if ((await page.locator('.f4-log-more').getAttribute('aria-expanded')) !== 'true') {
    await page.locator('.f4-log-more').click();
    await page.waitForTimeout(250);
  }
};
const closeMore = async () => {
  if ((await page.locator('.f4-log-more').getAttribute('aria-expanded')) === 'true') {
    await page.locator('.f4-log-more').click();
    await page.waitForTimeout(250);
  }
};
const earned = async () => Number(((await page.locator('.f4-xp-pill.earned .f4-xp-val').textContent()) || '0').replace(/[^\d-]/g, ''));
const logTaskXP = async () => Number((/([\d,]+)\s*XP/.exec(await page.locator('.check-item', { hasText: 'Complete Daily Log' }).locator('.check-xp').textContent()) || [])[1]?.replace(/,/g, ''));

await page.goto(BASE);
await seed();

// ══ A: the order, and what the scale means ═════════════════════════════════
const order = await page.evaluate(() => {
  const card = document.querySelector('.daily-log-card');
  return [...card.querySelectorAll('.rating-row, .sleep-hours-row, textarea.log-textarea, .f4-log-more')].map(e => {
    if (e.matches('.rating-row')) return e.querySelector('.rating-label-left').textContent.trim();
    if (e.matches('.sleep-hours-row')) return 'Hours Slept';
    if (e.matches('textarea')) return 'Notes';
    return 'More metrics';
  });
});
check('A: Mood, Energy, Stress, Hours Slept, Notes — then More metrics',
  order.join(' | ') === '😊Mood | ⚡Energy | 🧠Stress | Hours Slept | Notes | More metrics', order.join(' | '));
check('A: Stress is one of the main metrics, not tucked away',
  (await page.locator('.daily-log-card .f4-log-quick .rating-row', { hasText: 'Stress' }).count()) === 1);
check('A: it says what 1 and 10 mean',
  (await stressRow().locator('.rating-hint').textContent()).trim() === '1 = minimal stress · 10 = extreme stress');
check('A: it is a 1–10 scale like the others, announced as one',
  (await stressTrack().getAttribute('min')) === '0' && (await stressTrack().getAttribute('max')) === '10'
    && (await stressTrack().getAttribute('step')) === '1' && (await stressTrack().getAttribute('aria-label')) === 'Stress, 1 to 10'
    && /\/10/.test(await stressRow().locator('.rating-val').textContent()));

// ══ B: one Stress control ═══════════════════════════════════════════════════
check('B: "More metrics" no longer names Stress',
  (await page.locator('.f4-log-more-hint').textContent()).trim() === 'Confidence · Sleep Quality · Recovery · Workout Effort');
await openMore();
const rest = await page.locator('.daily-log-card .f4-log-rest .rating-label-left').allTextContents();
check('B: it keeps the other four, unchanged',
  rest.map(s => s.trim()).join(' | ') === '💪Confidence | ⭐Sleep Quality | 🔋Recovery / Soreness | 🏋️Workout Effort', rest.join(' | '));
check('B: with it open there is still exactly one Stress control', (await stressRow().count()) === 1);
check('B: and seven 1–10 controls in all, as before',
  (await page.locator('.daily-log-card .rating-track').count()) === 7
    && (await page.locator('.daily-log-card .rating-track').evaluateAll(els => els.every(e => e.max === '10' && e.step === '1'))));
await closeMore();

// ══ C: same field, every value, reload ══════════════════════════════════════
check('C: Stress starts unrated, and arriving saves nothing',
  (await stressTrack().inputValue()) === '0' && /^–\/10$/.test(await stressShown()) && (await days())[3]?.stress === undefined,
  `${await stressShown()}, stored ${JSON.stringify((await days())[3]?.stress)}`);
const missed = [];
for (let n = 1; n <= 10; n++) {
  await stressTrack().fill(String(n));
  await page.waitForTimeout(140);
  const stored = (await days())[3]?.stress;
  const shown = await stressShown();
  if (stored !== n || shown !== `${n}/10`) missed.push(`${n}→${stored}/${shown}`);
}
check('C: every value 1–10 saves to the same `stress` field and shows exactly itself', missed.length === 0, missed.join(' ') || 'all ten exact');
await stressTrack().fill('4');
await page.waitForTimeout(300);
check('C: the card confirms the save', /✓ Saved/.test(await page.textContent('.daily-log-card')));
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 15000 });
await gotoTab('Today');
await page.waitForSelector('.daily-log-card', { timeout: 15000 });
check('C: it survives a reload, stored and shown',
  (await days())[3]?.stress === 4 && (await stressShown()) === '4/10' && (await stressTrack().inputValue()) === '4'
    && (await stressTrack().getAttribute('aria-valuetext')) === '4 out of 10');
const stressKeys = Object.keys((await days())[3] || {}).filter(k => /stress/i.test(k));
check('C: no new field was added for it', stressKeys.join() === 'stress', stressKeys.join());

// ══ D: optional, and the Daily Log rule is unchanged ═══════════════════════
await seed();
const logXP = await logTaskXP();
const xp0 = await earned();
check('D: the Daily Log starts incomplete', (await days())[3]?.tasks?.daily_log !== true);
await stressTrack().fill('6');
await page.waitForTimeout(450);
check('D: logging Stress alone completes the Daily Log, as any one metric does',
  (await days())[3]?.tasks?.daily_log === true && (await days())[3]?.stress === 6);
const xp1 = await earned();
check('D: …paying exactly the Daily Log habit\'s XP, once', Number.isFinite(logXP) && xp1 - xp0 === logXP, `${xp0} → ${xp1} (habit ${logXP})`);
for (const [label, v] of [['Mood', '7'], ['Energy', '5'], ['Stress', '3']]) {
  await page.locator('.daily-log-card .rating-row', { hasText: label }).locator('.rating-track').fill(v);
  await page.waitForTimeout(250);
}
check('D: further metrics never complete it again or pay more', (await earned()) === xp1);
await seed();
await page.locator('.daily-log-card .rating-row', { hasText: 'Mood' }).locator('.rating-track').fill('8');
await page.waitForTimeout(450);
// A new day record starts every rating at 0, "not rated" — as it always has.
check('D: Stress stays optional — Mood alone still completes the Daily Log, Stress left unrated',
  (await days())[3]?.tasks?.daily_log === true && !((await days())[3]?.stress > 0) && /^–\/10$/.test(await stressShown()),
  `stress ${JSON.stringify((await days())[3]?.stress)}, shown ${await stressShown()}`);

// ══ E: stress saved before this release ════════════════════════════════════
const OLD = {
  me: {
    2: { date: offset(-1), dayNumber: 2, tasks: { daily_log: true }, mood: 6, energy: 5, stress: 2, confidence: 7, sleep: 6, recovery: 5, workoutEffort: 4, hoursSlept: 7.5, notes: 'yesterday', validated: true },
    3: { date: offset(0), dayNumber: 3, tasks: { daily_log: true }, mood: 5, energy: 4, stress: 7, confidence: 6, sleep: 5, recovery: 4, workoutEffort: 8, hoursSlept: 6, notes: 'today', validated: true },
  },
  girlfriend: {
    3: { date: offset(0), dayNumber: 3, tasks: { daily_log: true }, mood: 9, energy: 8, stress: 3, validated: true },
  },
};
await seed(OLD);
const seededDays = JSON.stringify(OLD);
check('E: a stress value saved before shows in its new place', (await stressShown()) === '7/10' && (await stressTrack().inputValue()) === '7');
await openMore();
const restVals = await page.locator('.daily-log-card .f4-log-rest .rating-val').allTextContents();
check('E: the other metrics keep their values',
  restVals.map(s => s.replace(/\s+/g, '')).join(' ') === '6/10 5/10 4/10 8/10'
    && (await page.locator('.daily-log-card .rating-row', { hasText: 'Mood' }).locator('.rating-val').textContent()).replace(/\s+/g, '') === '5/10'
    && (await page.locator('.sleep-hours-input').inputValue()) === '6'
    && (await page.locator('.daily-log-card textarea.log-textarea').inputValue()) === 'today',
  restVals.join(' '));
await closeMore();
await page.click('.day-sel-btn[aria-label="Previous day"]');
await page.waitForTimeout(400);
check('E: an earlier day shows its own stored stress', (await stressShown()) === '2/10');
await page.click('.day-sel-btn[aria-label="Next day"]');
await page.waitForTimeout(400);
check('E: loading and looking wrote nothing — every day record is exactly as stored',
  (await allDaysRaw()) === seededDays);

// ══ F: each profile keeps its own ══════════════════════════════════════════
await stressTrack().fill('9');
await page.waitForTimeout(300);
await gotoTab('Home');
await page.click('.dash-switch-btn');
await page.waitForTimeout(500);
await gotoTab('Today');
await page.waitForSelector('.daily-log-card', { timeout: 15000 });
check('F: the other profile shows its own stress', (await stressShown()) === '3/10');
await stressTrack().fill('5');
await page.waitForTimeout(300);
check('F: each profile saved only its own',
  (await days('girlfriend'))[3]?.stress === 5 && (await days('me'))[3]?.stress === 9
    && (await days('me'))[2]?.stress === 2 && (await days('girlfriend'))[3]?.mood === 9);

// ══ G: backups ══════════════════════════════════════════════════════════════
await gotoTab('Settings');
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }),
  page.locator('button', { hasText: 'Export / Backup Data' }).click(),
]);
const exported = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
check('G: an export carries stress exactly where it always has',
  exported.allDays?.me?.[3]?.stress === 9 && exported.allDays?.me?.[2]?.stress === 2 && exported.allDays?.girlfriend?.[3]?.stress === 5);

// A backup made before this release: same keys, same day-record shape.
const before = {
  ...exported,
  activeProfile: 'me',
  allDays: {
    me: { 3: { date: offset(0), dayNumber: 3, tasks: { daily_log: true }, mood: 4, energy: 6, stress: 8, workoutEffort: 3, validated: true } },
    girlfriend: { 3: { date: offset(0), dayNumber: 3, tasks: { daily_log: true }, stress: 1, validated: true } },
  },
};
await page.locator('input[type="file"][accept*="json"]').setInputFiles({
  name: '75hard-backup-before.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)),
});
await page.waitForSelector('.dashboard', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2200);
await page.waitForSelector('.dashboard', { timeout: 15000 });
await gotoTab('Today');
await page.waitForSelector('.daily-log-card', { timeout: 15000 });
check('G: restoring an older backup shows its stress in the new place', (await stressShown()) === '8/10');
await openMore();
check('G: …and its other metrics where they were',
  (await page.locator('.daily-log-card .rating-row', { hasText: 'Workout Effort' }).locator('.rating-val').textContent()).replace(/\s+/g, '') === '3/10');
await closeMore();
check('G: …with every restored day record exactly as it was in the file',
  JSON.stringify((await days('me'))) === JSON.stringify(before.allDays.me)
    && JSON.stringify((await days('girlfriend'))) === JSON.stringify(before.allDays.girlfriend));

// ══ H: widths ═══════════════════════════════════════════════════════════════
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: w === 320 ? 640 : 844 });
  await page.waitForTimeout(250);
  await stressRow().scrollIntoViewIfNeeded();
  const fit = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.daily-log-card .rating-row')].find(r => /Stress/.test(r.textContent));
    const card = document.querySelector('.daily-log-card').getBoundingClientRect();
    const parts = ['.rating-label-left', '.rating-val', '.rating-hint', '.rating-track'].map(s => row.querySelector(s).getBoundingClientRect());
    const hint = row.querySelector('.rating-hint');
    return {
      page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      inCard: parts.every(r => r.left >= card.left - 0.5 && r.right <= card.right + 0.5 && r.width > 0),
      hintWhole: hint.scrollWidth <= hint.clientWidth + 1,
      trackWide: parts[3].width >= 200,
    };
  });
  check(`H: ${w}px — Stress, its value, its scale note and its slider all fit`,
    fit.page && fit.inCard && fit.hintWhole && fit.trackWide, JSON.stringify(fit));
  await stressTrack().fill(String(w === 320 ? 2 : w === 390 ? 6 : 10));
  await page.waitForTimeout(200);
  check(`H: ${w}px — and it saves from there`, (await days())[3]?.stress === (w === 320 ? 2 : w === 390 ? 6 : 10));
}
await page.setViewportSize({ width: 390, height: 844 });

// ══ summary ═════════════════════════════════════════════════════════════════
const relevant = errors.filter(e => !/favicon|manifest|service worker|sw\.js/i.test(e));
check('no page errors', relevant.length === 0, relevant.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
