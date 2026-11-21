/**
 * Promoting a Support Challenge to primary, end to end, on a fake clock.
 *
 * Run against a production build:  npx vite preview --port 4173 --strictPort
 * then:                            node tests/support-promotion-e2e-test.mjs
 *
 *   A. Current economy, through the real screens: a support added from the
 *      picker beside a challenge started from the library; the primary
 *      finishes; Promote. The promoted challenge is stamped with the current
 *      economy, keeps its habits' XP exactly, counts the shared days once, and
 *      promoting moves no XP.
 *   B. Old economy: a support that ran beside a pre-October attempt keeps that
 *      economy when promoted, exactly as before — and still counts shared days
 *      once.
 *   C. A "what next?" choice left waiting from before this release.
 *   D. A promoted challenge already running on the old economy is untouched:
 *      opening Forge changes nothing about it.
 *   E. The other profile is never touched.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { openChallenge, backToChallenges, beginSetup, passReview, pickStartDate, confirmStart, pickDuration } from './helpers/challenges.mjs';
import { dayRules } from '../src/data/xpEconomy.js';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const DAY = 86400000;
const T0 = new Date(); T0.setHours(12, 0, 0, 0);
let NOW = new Date(T0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateAt = (n) => iso(new Date(NOW.getTime() + n * DAY));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
async function setNow(d) { NOW = new Date(d); await page.clock.setFixedTime(NOW); }
async function dismiss() {
  for (let i = 0; i < 4; i++) {
    const s = page.locator('.rankup-skip');
    if (!(await s.count())) return;
    await s.first().click().catch(() => {}); await page.waitForTimeout(300);
  }
}
async function reload() { await page.reload(); await page.waitForSelector('.dashboard', { timeout: 10000 }); await page.waitForTimeout(900); await dismiss(); }
async function gotoTab(n) { await page.evaluate((x) => [...document.querySelectorAll('.bottom-nav .nav-tab')].find(e => e.getAttribute('aria-label') === x)?.click(), n); await page.waitForTimeout(450); }
const store = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);
const prof = async (id = 'me') => (await store('profiles'))[id];
async function split() {
  await gotoTab('Home'); await dismiss();
  return page.evaluate(() => {
    const t = document.querySelector('.xp-split-row')?.textContent || '';
    const read = (re) => { const m = t.match(re); return m ? Number(m[1].replace(/,/g, '')) : null; };
    return { lifetime: read(/Lifetime:\s*([\d,]+)/), challenge: read(/Challenge:\s*([\d,]+)/) };
  });
}
/**
 * Tap Promote. Returns the profile exactly as promotion wrote it, read before
 * the reload: on the next load an existing migration (unchanged here) adds
 * Mental Training's Short Physical Reset row to a running Mental Training
 * attempt that lacks one, and that is not what promotion did.
 */
async function promote() {
  await gotoTab('Home');
  await page.locator('.primary-choice-card button', { hasText: 'Promote' }).click();
  await page.waitForTimeout(800);
  const written = await prof();
  await reload();
  return written;
}
/** Lifetime XP as Settings shows it — readable while the completion screen is up. */
async function settingsLifetime() {
  await gotoTab('Settings');
  return page.evaluate(() => {
    const row = [...document.querySelectorAll('.settings-row')].find(r => /^Lifetime XP/.test(r.querySelector('.settings-row-label')?.textContent?.trim() || ''));
    const m = (row?.textContent || '').replace(/Lifetime XP/, '').match(/([\d,]+)/);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  });
}
/** Tick every row today, on the attempt's own numbering, and return what the day paid. */
async function logToday() {
  const before = await split();
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles')).me;
    const a = JSON.parse(localStorage.getItem('allDays'));
    const start = new Date(p.challengeStart + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const n = Math.round((today - start) / 86400000) + 1;
    a.me[n] = { dayNumber: n, tasks: Object.fromEntries(p.tasks.map(t => [t.id, true])) };
    localStorage.setItem('allDays', JSON.stringify(a));
  });
  await reload();
  return (await split()).lifetime - before.lifetime;
}
const BASE_ARCHIVE = { id: 'base', archivedAt: '2026-01-31', challengeStart: '2026-01-01', endDate: '2026-01-30', endDayNum: 30, completed: true,
  challenge: { templateId: 'mental_training_phase', name: 'Earlier challenge', durationDays: 30, xpEconomyVersion: 2 }, days: {}, tasks: [], xpEarned: 20000 };
const GF_ARCHIVE = { ...BASE_ARCHIVE, id: 'gf_base', xpEarned: 4200 };

await setNow(T0);
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await reload();
// The other profile: a Forge Daily with a logged day and an archive, checked at the end.
await page.locator('.dash-switch-btn').first().click(); await page.waitForTimeout(500);
await page.locator('button', { hasText: 'Start Forge Daily' }).first().click(); await page.waitForTimeout(700);
await page.evaluate((arch) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const a = JSON.parse(localStorage.getItem('allDays') || '{}');
  a.girlfriend = { 1: { dayNumber: 1, tasks: Object.fromEntries(p.girlfriend.tasks.map(t => [t.id, true])) } };
  localStorage.setItem('allDays', JSON.stringify(a));
  const ar = JSON.parse(localStorage.getItem('archives') || '{"me":[],"girlfriend":[]}');
  ar.girlfriend = [arch];
  localStorage.setItem('archives', JSON.stringify(ar));
  localStorage.setItem('activeProfile', JSON.stringify('me'));
}, GF_ARCHIVE);
await reload();
const GF = { profile: JSON.stringify(await prof('girlfriend')), days: JSON.stringify((await store('allDays')).girlfriend), archives: JSON.stringify((await store('archives')).girlfriend) };
const FD = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).girlfriend);
const FD_META = FD.activeChallenge;
const FD_TASKS = FD.tasks;

// ══ A: current economy, through the real screens ═══════════════════════════
await gotoTab('Challenges');
await backToChallenges(page);
await openChallenge(page, 'Fat Loss Challenge');
await page.locator('.f4c-mode').filter({ hasText: /^Standard/ }).first().click();
await page.waitForTimeout(300);
await pickDuration(page, 30);
await beginSetup(page);
await passReview(page);
const tas = page.locator('textarea');
for (let i = 0, n = await tas.count(); i < n; i++) await tas.nth(i).fill('Because I keep my promises.');
await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
await page.waitForTimeout(500);
await pickStartDate(page, 'today');
await confirmStart(page);
await gotoTab('Challenges');
await page.locator('.acc-add-support').click();
await page.waitForTimeout(400);
await page.locator('.sup-option', { hasText: 'Mental Training Phase' }).first().click();
await page.waitForTimeout(400);
for (let i = 0; i < 6 && !(await page.locator('.sup-confirm button', { hasText: 'Add Support Challenge' }).count()); i++) {
  await page.locator('.sup-picker .btn-primary').last().click(); await page.waitForTimeout(400);
}
await page.locator('.sup-confirm button', { hasText: 'Add Support Challenge' }).click();
await page.waitForTimeout(700);
let p = await prof();
check('A: a current-economy primary with a support added from the picker',
  p.activeChallenge?.xpEconomyVersion === 2 && p.supportChallenge?.templateId === 'mental_training_phase');
check('A: the support descriptor carries no economy of its own (as the picker writes it)', p.supportChallenge?.xpEconomyVersion == null);

// Yesterday was the primary's final day (Day 30); the support began on its Day 26.
await setNow(new Date(T0.getTime() - DAY));
await page.evaluate(({ pStart, sStart, base }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const me = p.me;
  Object.assign(me, { challengeStart: pStart, supportChallengeStart: sStart, xpPenalties: false, highestRank: 4 });
  const prim = me.tasks.filter(t => (t.challenges || ['primary']).includes('primary')).map(t => t.id);
  const sup = me.tasks.filter(t => (t.challenges || []).join() === 'support').map(t => t.id);
  const days = {};
  for (let n = 1; n <= 30; n++) {
    const tasks = Object.fromEntries(prim.map(id => [id, true]));
    if (n >= 26) for (const id of sup) tasks[id] = true;
    days[n] = { dayNumber: n, tasks, notes: `day ${n}` };
  }
  localStorage.setItem('profiles', JSON.stringify(p));
  const a = JSON.parse(localStorage.getItem('allDays')); a.me = days; localStorage.setItem('allDays', JSON.stringify(a));
  const ar = JSON.parse(localStorage.getItem('archives')); ar.me = [base]; localStorage.setItem('archives', JSON.stringify(ar));
}, { pStart: dateAt(-29), sStart: dateAt(-4), base: BASE_ARCHIVE });
await reload();
const aFinal = await split();
await setNow(T0);
await reload();
p = await prof();
check('A: the primary finished and the choice is offered', p.pendingPrimaryChoice && (await page.locator('.primary-choice-card').count()) === 1);
check('A: the finish records the economy the support ran under', p.pendingPrimaryChoice?.supportEconomyVersion === 2);
check('A: …and the last day its record banked', p.pendingPrimaryChoice?.bankedThrough === dateAt(-1), p.pendingPrimaryChoice?.bankedThrough);
const rowsOf = (ts) => JSON.stringify(ts.map(t => [t.id, t.xp]).sort((x, y) => x[0].localeCompare(y[0])));
const rowsBefore = rowsOf(p.tasks.filter(t => (t.challenges || []).includes('support')));
const aWritten = await promote();
p = await prof();
const aAfter = await split();
check('A: the promoted challenge is stamped with the current economy',
  p.activeChallenge?.templateId === 'mental_training_phase' && p.activeChallenge?.xpEconomyVersion === 2 && p.activeChallenge?.dailyBudget > 0,
  JSON.stringify({ era: p.activeChallenge?.xpEconomyVersion, budget: p.activeChallenge?.dailyBudget }));
check('A: its habits keep exactly the XP they were paying — nothing repriced',
  rowsOf(aWritten.tasks) === rowsBefore, `${rowsBefore} → ${rowsOf(aWritten.tasks)}`);
check('A: it counts from the first day the finished primary did not bank (Day 6)', p.xpStartDay === 6, String(p.xpStartDay));
check('A: promoting moves no XP: the shared days are not counted again',
  aAfter.lifetime === aFinal.lifetime, `${aFinal.lifetime} → ${aAfter.lifetime}`);
const rowXP = p.tasks.reduce((s, t) => s + t.xp, 0);
const rules = dayRules(p.activeChallenge);
const aDay = await logToday();
check('A: a fully logged day pays its habits at face value plus the normal bonus, not ten times over',
  aDay === rowXP + rules.perfectDay, `${aDay} = ${rowXP} + ${rules.perfectDay}`);

// ══ B: the old economy ═════════════════════════════════════════════════════
// A pre-October Fat Loss (stamped era 1, as every such attempt is) with a
// support beside it — the picker refuses that pairing now, so it is seeded the
// way it was stored back then.
const OLD_PRIMARY = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard', durationDays: 30, xpEconomyVersion: 1,
  completionBonusXP: 500, passingScore: 70, keystoneRequirement: 65, weeklyRequirementsStartDate: '2099-01-01' };
const OLD_SUPPORT = { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard', durationDays: 21, passingScore: 70, keystoneRequirement: 65 };
const OLD_TASKS = [
  { id: 'fl_protein', name: 'Protein', xp: 40, keystone: 3, source: 'template', order: 0, challenges: ['primary'] },
  { id: 'fl_steps', name: 'Steps', xp: 30, keystone: 2, source: 'template', order: 1, challenges: ['primary'] },
  { id: 'daily_log', name: 'Daily Log', xp: 10, keystone: 1, source: 'template', order: 2, challenges: ['primary', 'support'] },
  { id: 'mt_focus', name: 'Focus', xp: 20, keystone: 1, source: 'template', order: 3, challenges: ['support'] },
  { id: 'mt_physical', name: 'Physical', xp: 30, keystone: 1, source: 'template', order: 4, challenges: ['support'] },
];
await setNow(new Date(T0.getTime() - DAY));
await page.evaluate(({ pStart, sStart, meta, sup, tasks, base }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  Object.assign(p.me, { challengeStart: pStart, activeChallenge: meta, supportChallenge: sup, supportChallengeStart: sStart, tasks,
    xpPenalties: false, xpStartDay: 1, xpOffset: 0, highestRank: 4, rankHistory: [], pendingPrimaryChoice: null, lastCompletion: null, weeklySessions: [] });
  delete p.me.xpLedger;
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let n = 1; n <= 30; n++) {
    const t = { fl_protein: true, fl_steps: true, daily_log: true };
    if (n >= 26) Object.assign(t, { mt_focus: true, mt_physical: true });
    days[n] = { dayNumber: n, tasks: t };
  }
  const a = JSON.parse(localStorage.getItem('allDays')); a.me = days; localStorage.setItem('allDays', JSON.stringify(a));
  const ar = JSON.parse(localStorage.getItem('archives')); ar.me = [base]; localStorage.setItem('archives', JSON.stringify(ar));
}, { pStart: dateAt(-29), sStart: dateAt(-4), meta: OLD_PRIMARY, sup: OLD_SUPPORT, tasks: OLD_TASKS, base: BASE_ARCHIVE });
await reload();
const bFinal = await split();
await setNow(T0);
await reload();
p = await prof();
check('B: the old-economy primary finished beside its support', p.pendingPrimaryChoice?.supportEconomyVersion === 1, JSON.stringify(p.pendingPrimaryChoice));
const bRowsBefore = rowsOf(p.tasks.filter(t => (t.challenges || []).includes('support')));
const bWritten = await promote();
p = await prof();
const bAfter = await split();
check('B: a support that ran on the old economy stays on it when promoted', p.activeChallenge?.xpEconomyVersion === 1 && p.activeChallenge?.dailyBudget == null);
check('B: its habits keep their XP', rowsOf(bWritten.tasks) === bRowsBefore, `${bRowsBefore} → ${rowsOf(bWritten.tasks)}`);
check('B: it also counts shared days once', p.xpStartDay === 6 && bAfter.lifetime === bFinal.lifetime, `${p.xpStartDay} ${bFinal.lifetime} → ${bAfter.lifetime}`);
const oldRules = dayRules(p.activeChallenge);
const bRowXP = p.tasks.reduce((s, t) => s + t.xp, 0);
const bDay = await logToday();
check('B: a logged day pays exactly what the old economy paid, as it always did',
  oldRules.displayScale === 10 && bDay === (bRowXP + oldRules.perfectDay) * 10, `${bDay} = (${bRowXP} + ${oldRules.perfectDay}) × 10`);

// ══ C: a choice left waiting from before this release ══════════════════════
// An earlier version, when the primary finished beside a running support,
// left the baseline counting from Day 1 of the support (so the shared days
// were counted twice) and recorded neither the economy nor the banked day.
// Recreated from a real finish here, then given exactly that earlier shape.
const NEW_PRIMARY = { ...OLD_PRIMARY, xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 160 };
await setNow(new Date(T0.getTime() - DAY));
await page.evaluate(({ pStart, sStart, meta, sup, tasks, base }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  Object.assign(p.me, { challengeStart: pStart, activeChallenge: meta, supportChallenge: sup, supportChallengeStart: sStart, tasks,
    xpPenalties: false, xpStartDay: 1, xpOffset: 0, highestRank: 4, rankHistory: [], pendingPrimaryChoice: null, lastCompletion: null, weeklySessions: [] });
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let n = 1; n <= 30; n++) {
    const t = { fl_protein: true, fl_steps: true, daily_log: true };
    if (n >= 26) Object.assign(t, { mt_focus: true, mt_physical: true });
    days[n] = { dayNumber: n, tasks: t };
  }
  const a = JSON.parse(localStorage.getItem('allDays')); a.me = days; localStorage.setItem('allDays', JSON.stringify(a));
  const ar = JSON.parse(localStorage.getItem('archives')); ar.me = [base]; localStorage.setItem('archives', JSON.stringify(ar));
}, { pStart: dateAt(-29), sStart: dateAt(-4), meta: NEW_PRIMARY, sup: OLD_SUPPORT, tasks: OLD_TASKS, base: BASE_ARCHIVE });
await reload();
const cFinal = await split();
await setNow(T0);
await reload();
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  delete p.me.pendingPrimaryChoice.supportEconomyVersion;
  delete p.me.pendingPrimaryChoice.bankedThrough;
  p.me.xpStartDay = 1;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await reload();
const cLoad = { lifetime: await settingsLifetime() };
const cStored = JSON.stringify(await prof());
await reload(); await reload();
check('C: opening Forge changes nothing about a choice left waiting',
  (await settingsLifetime()) === cLoad.lifetime && JSON.stringify(await prof()) === cStored, `${cLoad.lifetime}`);
check('C: (that earlier state does count the shared days twice)', cLoad.lifetime > cFinal.lifetime, `${cFinal.lifetime} vs ${cLoad.lifetime}`);
await promote();
p = await prof();
check('C: promoting reads the finished primary\'s archive for its economy', p.activeChallenge?.xpEconomyVersion === 2 && p.activeChallenge?.dailyBudget > 0);
check('C: …and for the days it banked: counting starts on Day 6', p.xpStartDay === 6, String(p.xpStartDay));
check('C: the promoted challenge counts the shared days once', (await split()).lifetime === cFinal.lifetime,
  `${cLoad.lifetime} → ${(await split()).lifetime} (final day ${cFinal.lifetime})`);

// ══ D: a promoted challenge already running on the old economy ═════════════
const D_META = { ...OLD_SUPPORT, xpEconomyVersion: 1 };
const D_TASKS = OLD_TASKS.filter(t => t.challenges.includes('support')).map((t, i) => ({ ...t, challenges: ['primary'], order: i }));
await page.evaluate(({ start, meta, tasks, base }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  Object.assign(p.me, { challengeStart: start, activeChallenge: meta, tasks, supportChallenge: null, supportChallengeStart: null,
    pendingPrimaryChoice: null, xpPenalties: false, xpStartDay: 1, xpOffset: 0, highestRank: 4, rankHistory: [] });
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let n = 1; n <= 4; n++) days[n] = { dayNumber: n, tasks: Object.fromEntries(tasks.map(t => [t.id, true])) };
  const a = JSON.parse(localStorage.getItem('allDays')); a.me = days; localStorage.setItem('allDays', JSON.stringify(a));
  const ar = JSON.parse(localStorage.getItem('archives')); ar.me = [base]; localStorage.setItem('archives', JSON.stringify(ar));
}, { start: dateAt(-4), meta: D_META, tasks: D_TASKS, base: BASE_ARCHIVE });
await reload();
const dLoad = await split();
const dStored = JSON.stringify({ meta: (await prof()).activeChallenge, tasks: (await prof()).tasks });
await reload(); await reload();
const dp = await prof();
check('D: an already-promoted old-economy challenge is not restamped or repriced',
  JSON.stringify({ meta: dp.activeChallenge, tasks: dp.tasks }) === dStored && dp.activeChallenge.xpEconomyVersion === 1);
check('D: …and its XP does not move on opening Forge', (await split()).lifetime === dLoad.lifetime, `${dLoad.lifetime}`);

// ══ E: the other profile ═══════════════════════════════════════════════════
check('E: the other profile was not touched by any of it',
  JSON.stringify(await prof('girlfriend')) === GF.profile
  && JSON.stringify((await store('allDays')).girlfriend) === GF.days
  && JSON.stringify((await store('archives')).girlfriend) === GF.archives);

check('no page errors', errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
