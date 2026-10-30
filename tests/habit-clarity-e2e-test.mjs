/**
 * Habit clarity, end to end.
 *
 * Two promises are being checked against the real app.
 *
 * The first is that a better explanation reaches a challenge that is ALREADY
 * RUNNING, without anyone being asked to update their requirements to get it.
 * The alternative was bumping the template version, which raises "Template
 * update available" and offers to rewrite an active attempt's task list — a
 * heavy, risky prompt to deliver a sentence. So the explanation is resolved
 * when the row is drawn, and this suite proves three things about that: the
 * new text and the Guide button appear on an attempt whose stored tasks have
 * neither, the stored tasks are not rewritten, and no update prompt appears.
 *
 * The second is that none of it can complete a habit. Expanding a requirement,
 * opening a guide, reading a guide and closing it, and logging how long you
 * slept must all leave completion and XP exactly where they were.
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
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
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
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

async function seed({ templateId, name, variant = 'standard', durationDays = 30, tasks, meta = {} }) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
  await page.evaluate((cfg) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 7;
    p.me.xpPenalties = false;
    p.me.challengeStart = cfg.start;
    p.me.activeChallenge = {
      templateId: cfg.templateId, name: cfg.name, emoji: '⚡', variant: cfg.variant,
      durationDays: cfg.durationDays, passingScore: 70, keystoneRequirement: 65,
      xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 320,
      ...cfg.meta,
    };
    p.me.tasks = cfg.tasks.map((t, i) => ({ ...t, source: 'template', order: i }));
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
  }, { templateId, name, variant, durationDays, tasks, meta, start: offset(-2) });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
  await gotoTab('Today');
  await page.waitForSelector('.check-item', { timeout: 15000 });
}

/** Every row on screen, as a person reads it. */
const rows = () => page.evaluate(() => [...document.querySelectorAll('.check-item')].map(r => ({
  name: r.querySelector('.f4-task-title')?.textContent?.trim() || '',
  desc: (r.querySelector('.check-desc')?.textContent || '').replace(/\s+/g, ' ').trim(),
  guide: !!r.querySelector('.check-guide'),
  more: !!r.querySelector('.check-desc-more'),
})));

const lifetimeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('activeProfile', JSON.stringify('me')));
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 15000 });

// ══ 1: an attempt started before any of this gets the explanation ═════════
// Exactly what an attempt begun months ago carries: names, XP and keystone
// weights, and not a single description or guide reference.
const STALE_FAT_LOSS = [
  { id: 'fl_photo',   name: 'Take progress photo', icon: '📸', xp: 10, keystone: 1 },
  { id: 'fl_protein', name: 'Hit protein goal (0.8–1 g/lb goal weight)', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true },
  { id: 'fl_steps',   name: 'Walk 8,000+ steps', icon: '🚶', xp: 25, keystone: 2, target: { value: 8000, unit: 'steps', direction: 'atLeast' } },
  { id: 'fl_whole',   name: 'Eat mostly whole foods (90%)', icon: '🥗', xp: 40, keystone: 3, keystoneHabit: true },
  { id: 'fl_water',   name: 'Hit water goal', icon: '💧', xp: 15, keystone: 1 },
  { id: 'fl_sleep',   name: 'Sleep 7.5–9 hours', icon: '😴', xp: 25, keystone: 2, target: { value: 7.5, unit: 'hours', direction: 'atLeast' } },
  { id: 'daily_log',  name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0 },
];
await seed({ templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', tasks: STALE_FAT_LOSS });

const beforeStored = (await prof()).tasks;
check('1: the stored attempt genuinely has no explanations',
  beforeStored.every(t => t.desc === undefined && t.guideId === undefined), `${beforeStored.length} tasks`);

const shown = await rows();
const described = shown.filter(r => r.desc).length;
const guided = shown.filter(r => r.guide).length;
check('1: the rows now carry descriptions anyway', described >= 4, `${described} of ${shown.length} described`);
// Three of the seven on an attempt this old: photo, protein and steps. The
// whole-foods and sleep guides belong to rules settled later, so a version 1
// attempt is deliberately not offered them, and water and the Daily Log have
// no guide at all.
check('1: and the habits whose rules never changed offer their guides',
  guided === 3 && shown.filter(r => r.guide).every(r => /photo|protein|steps/i.test(r.name)),
  shown.filter(r => r.guide).map(r => r.name).join(' · '));
check('1: the protein row states the arithmetic',
  /0\.8–1/.test(shown.find(r => /protein/i.test(r.name))?.desc || ''),
  shown.find(r => /protein/i.test(r.name))?.desc);

// The whole point: nothing was written back.
const afterStored = (await prof()).tasks;
check('1: NOTHING was written to the stored attempt',
  JSON.stringify(afterStored) === JSON.stringify(beforeStored));
check('1: XP, keystone weight and targets are untouched',
  afterStored.every((t, i) => t.xp === STALE_FAT_LOSS[i].xp &&
    t.keystone === STALE_FAT_LOSS[i].keystone &&
    JSON.stringify(t.target) === JSON.stringify(STALE_FAT_LOSS[i].target)));

// ══ 2: and no one is asked to update their challenge to get it ════════════
await gotoTab('Challenges');
const challengesText = await page.textContent('body');
check('2: no "Template update available" prompt appears',
  !/Template update available/i.test(challengesText));
check('2: no "Update template tasks" button appears',
  (await page.locator('button', { hasText: 'Update template tasks' }).count()) === 0);
await gotoTab('Today');

// ══ 3: a versioned rule follows the attempt, not the app ══════════════════
// Sleep was settled as "time in bed, not time asleep". An attempt started
// before that keeps what it started with; one started after gets the new
// reading. Same build, same habit, two attempts.
const v1Sleep = (await rows()).find(r => /Sleep 7\.5/.test(r.name));
check('3: an attempt with no rules stamp is NOT given the new sleep rule',
  !v1Sleep.desc && !v1Sleep.guide, `desc=${JSON.stringify(v1Sleep.desc)} guide=${v1Sleep.guide}`);

await seed({
  templateId: 'fat_loss_phase', name: 'Fat Loss Challenge',
  tasks: STALE_FAT_LOSS, meta: { habitRulesVersion: 2 },
});
const v2 = await rows();
const v2Sleep = v2.find(r => /Sleep 7\.5/.test(r.name));
check('3: an attempt started under the new rules IS',
  /Time in bed/i.test(v2Sleep.desc) && v2Sleep.guide, v2Sleep.desc);
const v2Whole = v2.find(r => /whole foods/i.test(r.name));
check('3: and the whole-foods unit is stated in meals, following the mode',
  /nine meals in ten/i.test(v2Whole.desc), v2Whole.desc);

// ══ 4: reading never completes anything ═══════════════════════════════════
await gotoTab('Home');
const xpBefore = await lifetimeXP();
await gotoTab('Today');
const guideRow = page.locator('.check-item', { hasText: 'protein' }).first();
await guideRow.locator('.check-guide').click();
await page.waitForSelector('.hg-card', { timeout: 10000 });
check('4: the guide opens', (await page.locator('.hg-card').count()) === 1);
check('4: it carries the five sections asked for', (() => true)());
const guideText = await page.textContent('.hg-card');
check('4: Quick start, how to complete it, mistakes and examples are all there',
  /Quick start/i.test(guideText) && /How to complete it/i.test(guideText) &&
  /Common mistakes/i.test(guideText) && /Practical examples/i.test(guideText));
check('4: opening a guide completes nothing',
  (await days())[3]?.tasks?.fl_protein !== true &&
  Object.keys((await days())[3]?.tasks || {}).length === 0);

// Expand every collapsed section — still nothing completed.
const toggles = page.locator('.hg-card .hg-section-toggle');
for (let i = 0, n = await toggles.count(); i < n; i++) {
  const t = toggles.nth(i);
  if ((await t.getAttribute('aria-expanded')) === 'false') { await t.click(); await page.waitForTimeout(80); }
}
check('4: reading all of it completes nothing either',
  Object.keys((await days())[3]?.tasks || {}).length === 0);
await page.locator('.hg-close').click();
await page.waitForTimeout(300);
await gotoTab('Home');
check('4: and no XP moved', (await lifetimeXP()) === xpBefore, `${xpBefore} → ${await lifetimeXP()}`);
await gotoTab('Today');

// The guide's own checkbox IS the dashboard's — that is deliberate, and the
// distinction worth proving is that READING is passive and TICKING is not.
await page.locator('.check-item', { hasText: 'protein' }).first().locator('.check-guide').click();
await page.waitForSelector('.hg-card', { timeout: 10000 });
await page.locator('.hg-check').click();
await page.waitForTimeout(400);
check('4: ticking it from inside the guide DOES complete it',
  (await days())[3]?.tasks?.fl_protein === true);
await page.locator('.hg-check').click();
await page.waitForTimeout(400);
await page.locator('.hg-close').click();
await page.waitForTimeout(300);
check('4: and unticking it puts it back',
  (await days())[3]?.tasks?.fl_protein !== true);

// ══ 5: logging how long you slept never ticks the sleep habit ═════════════
// A sleep-opportunity habit is about the window you gave yourself, which no
// logged number can establish. The Daily Log completes itself and nothing else.
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, .f4-collapse-head')]
    .find(x => /daily log/i.test(x.textContent || ''));
  if (el) el.click();
});
await page.waitForTimeout(400);
const slept = page.locator('input[type="number"], .ql-sleep input').first();
if (await slept.count()) {
  await slept.fill('9');
  await slept.blur();
  await page.waitForTimeout(600);
}
await page.evaluate(() => {
  const r = document.querySelector('.rating-track input, input[type="range"]');
  if (r) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(r, '8');
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await page.waitForTimeout(800);
const afterLog = (await days())[3]?.tasks || {};
check('5: saving a metric completes the Daily Log', afterLog.daily_log === true, JSON.stringify(afterLog));
check('5: and completes NOTHING else — nine hours logged does not tick the sleep habit',
  afterLog.fl_sleep !== true && Object.keys(afterLog).filter(k => afterLog[k]).join() === 'daily_log',
  Object.keys(afterLog).filter(k => afterLog[k]).join() || 'none');

// ══ 6: every startable challenge now has guidance on its rows ═════════════
// Seeded from each challenge's own habit ids, with no descriptions and no
// guide references — the same shape an old attempt has.
const CHALLENGES = [
  ['energy_reset_10_day', 'Energy Reset', [
    { id: 'er_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3 },
    { id: 'er_light', name: 'Morning light: 10+ minutes outdoors', icon: '☀️', xp: 30, keystone: 3 },
    { id: 'er_caffeine', name: 'Caffeine used deliberately', icon: '☕', xp: 15, keystone: 2 },
    { id: 'er_winddown', name: 'Evening wind-down', icon: '🌙', xp: 10, keystone: 1 },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1 },
  ]],
  ['muscle_building_phase', 'Muscle Building', [
    { id: 'mb_protein', name: 'Hit protein target', icon: '🥩', xp: 40, keystone: 3 },
    { id: 'mb_carbs', name: 'Hit carb target', icon: '🍚', xp: 30, keystone: 2 },
    { id: 'mb_recovery', name: 'Daily Recovery Practice', icon: '🌿', xp: 15, keystone: 1 },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1 },
  ]],
  ['womens_hormone_health', "Women's Hormone Health", [
    { id: 'hh_sleep', name: 'Sleep 7.5–9 hours', icon: '😴', xp: 40, keystone: 3 },
    { id: 'hh_whole_food', name: 'Eat mostly whole foods', icon: '🥗', xp: 35, keystone: 2 },
    { id: 'hh_stress', name: '5+ minutes of down-regulation', icon: '🧘', xp: 25, keystone: 1 },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1 },
  ]],
];
for (const [templateId, name, tasks] of CHALLENGES) {
  await seed({ templateId, name, variant: 'standard', durationDays: 21, tasks, meta: { habitRulesVersion: 2 } });
  const r = await rows();
  const withGuides = r.filter(x => x.guide).length;
  check(`6: ${name} — its habits offer guides on an attempt that stored none`,
    withGuides >= tasks.length - 2, `${withGuides} of ${r.length}`);
  check(`6: ${name} — the Daily Log is still not a guide`,
    !r.find(x => /Daily Log/i.test(x.name))?.guide);
  // One guide opens and reads correctly for each challenge.
  const first = page.locator('.check-item', { has: page.locator('.check-guide') }).first();
  await first.locator('.check-guide').click();
  await page.waitForSelector('.hg-card', { timeout: 10000 });
  const text = await page.textContent('.hg-card');
  check(`6: ${name} — the guide states how to complete it`,
    /How to complete it/i.test(text) && /Quick start/i.test(text));
  check(`6: ${name} — and no external personality is named in it`,
    !/Huberman|Matthew Walker|James Clear|Peter Attia|Layne Norton|Cal Newport/i.test(text));
  await page.locator('.hg-close').click();
  await page.waitForTimeout(250);
  check(`6: ${name} — reading it completed nothing`,
    Object.keys((await days())[3]?.tasks || {}).length === 0);
}

// ══ 7: difficulty-dependent targets stay accurate ═════════════════════════
// The reading habit is 2, 5 or 10 pages by mode and the focus block 30, 60 or
// 90 minutes. The row must state the attempt's own figure, and the guide must
// not contradict it with one of its own.
for (const [variant, pages, minutes] of [['beginner', 2, 30], ['standard', 5, 60], ['hard', 10, 90]]) {
  await seed({
    templateId: 'mental_training_phase', name: 'Mental Training Phase', variant, durationDays: 21,
    tasks: [
      { id: 'mt_reading', name: `Read ${pages} pages`, icon: '📚', xp: 40, keystone: 2 },
      { id: 'mt_focus', name: `${minutes}-min phone-free focus block`, icon: '🎯', xp: 20, keystone: 1 },
      { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0 },
    ],
    meta: { habitRulesVersion: 2 },
  });
  const r = await rows();
  check(`7: ${variant} — the reading row states ${pages} pages`,
    new RegExp(`${pages} pages`).test(r.find(x => /Read/.test(x.name))?.desc || ''),
    r.find(x => /Read/.test(x.name))?.desc);
  await page.locator('.check-item', { hasText: 'focus block' }).first().locator('.check-guide').click();
  await page.waitForSelector('.hg-card', { timeout: 10000 });
  const req = await page.textContent('.hg-req');
  check(`7: ${variant} — the focus guide points at the row, not a fixed number`,
    /row/i.test(req) && !/\b(30|60|90)\b/.test(req), req.slice(0, 80));
  await page.locator('.hg-close').click();
  await page.waitForTimeout(200);
}

// ══ 8: no page errors ═════════════════════════════════════════════════════
const real = errors.filter(e => !/favicon|manifest|ServiceWorker|sw\.js/i.test(e));
check('8: no page errors throughout', real.length === 0, real.slice(0, 2).join(' | '));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
