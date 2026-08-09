/**
 * Broad smoke test across Forge's main flows.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/smoke-e2e-test.mjs
 *
 * This exercises the core surfaces end-to-end (navigation, task logging, XP,
 * challenge performance, current-day fairness, challenge setup, insights,
 * settings, backup/restore, profile separation) so a regression in any of them
 * is caught even without the full per-feature suites.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => { const b = [...document.querySelectorAll('.bottom-nav .nav-tab, button')].find(x => new RegExp(n, 'i').test(x.textContent)); if (b) b.click(); }, name);
  await page.waitForTimeout(300);
}
const challengeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});

// ── Seed an active Mental Training challenge on day 4 with 3 logged days ──
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
const start = new Date(); start.setDate(start.getDate() - 3);
await page.evaluate(({ startStr }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 8; p.girlfriend.highestRank = 8;
  p.me.challengeStart = startStr; p.me.xpPenalties = false;
  p.me.activeChallenge = { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard', durationDays: 14, templateVersion: 6, rewardXP: 400, completionBonusXP: 400, passingScore: 70, keystoneRequirement: 65 };
  p.me.tasks = [
    { id: 'mt_mind', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 100, keystone: 3, source: 'template', order: 0 },
    { id: 'mt_reading', name: 'Read 5 pages', icon: '📚', xp: 40, keystone: 2, source: 'template', order: 1 },
    { id: 'mt_physical', name: 'Short Physical Reset — 10 minutes', icon: '🚶', xp: 30, keystone: 0, source: 'template', order: 2 },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0, source: 'template', order: 3 },
  ];
  p.me.bonusMissions = [{ id: 'bm_cold', icon: '🚿', name: 'Cold shower or cold finish', xp: 20, source: 'template', recurring: true, order: 0 }];
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let i = 1; i <= 3; i++) days[i] = { dayNumber: i, tasks: { mt_mind: true, mt_reading: true, mt_physical: true, daily_log: true }, mood: 6, energy: 6, sleep: 6, stress: 4, recovery: 6, workoutEffort: 5, confidence: 6, notes: 'ok', hoursSlept: 7, isMWD: false, mwdTasks: {}, bonusDone: {} };
  localStorage.setItem('allDays', JSON.stringify({ me: days, girlfriend: {} }));
}, { startStr: dstr(start) });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);

// ── Home ──
check('Home renders', (await page.locator('.dashboard').count()) === 1);
check('Home shows XP split (Challenge/Lifetime)', /Challenge/.test(await page.textContent('.xp-split-row')));
check('Home shows the Challenge Performance card', (await page.locator('.perf-card').count()) === 1);
const homeScore = (await page.textContent('.perf-ring-num')).trim();
check('Performance ring shows a percentage', /^\d+%$/.test(homeScore), homeScore);
check('Home shows Passing Score 70%', (await page.textContent('.perf-card')).includes('70%'));

// ── Today: layout order, task logging, XP ──
await gotoTab('Today');
await page.waitForSelector('.daily-view', { timeout: 5000 });
check('Today renders the daily view', (await page.locator('.daily-view').count()) === 1);
check('Today shows 4 required tasks', (await page.locator('.check-item').count()) >= 4);
const layout = await page.evaluate(() => {
  const perf = document.querySelector('.perf-card');
  const daily = [...document.querySelectorAll('.section-card')].find(c => /Daily Tasks/.test(c.textContent));
  const top = el => el ? el.getBoundingClientRect().top : null;
  return { dailyAbovePerf: daily && perf ? top(daily) < top(perf) : null, perfCount: document.querySelectorAll('.perf-card').length };
});
check('Daily Tasks appears above Challenge Performance', layout.dailyAbovePerf === true);
check('Challenge Performance appears exactly once on Today', layout.perfCount === 1);
check('Today score consistent with Home', (await page.textContent('.perf-ring-num')).trim() === homeScore);

await gotoTab('Home');
const xpBefore = await challengeXP();
await gotoTab('Today');
await page.locator('.check-item', { hasText: 'Mental Training' }).first().click();
await page.waitForTimeout(300);
check('Toggling a task persists to storage', await page.evaluate(() => { const ad = JSON.parse(localStorage.getItem('allDays')).me; return ad['4']?.tasks?.mt_mind === true; }));
await gotoTab('Home');
check('Completing a task increases challenge XP', (await challengeXP()) > xpBefore, `${xpBefore} → ${await challengeXP()}`);
check('Completing a task does not lower the score', parseInt(await page.textContent('.perf-ring-num'), 10) >= parseInt(homeScore, 10));

// ── Current-day fairness: unchecked today stays neutral ──
await gotoTab('Today');
await page.locator('.check-item', { hasText: 'Mental Training' }).first().click(); // uncheck
await page.waitForTimeout(300);
await gotoTab('Home');
check('Unchecking returns the score to its prior value (today neutral)', (await page.textContent('.perf-ring-num')).trim() === homeScore);

// ── Bonus missions never affect the score ──
await gotoTab('Today');
await page.locator('.bonus-item', { hasText: 'Cold shower' }).locator('.check-box').click();
await page.waitForTimeout(300);
await gotoTab('Home');
check('Bonus mission does not change the challenge score', (await page.textContent('.perf-ring-num')).trim() === homeScore);

// ── Challenges tab ──
await gotoTab('Challenges');
await page.waitForSelector('.challenges-view', { timeout: 5000 });
check('Challenges tab lists the library', (await page.locator('.challenge-card').count()) >= 5);
check('Active challenge summary shown', (await page.locator('.active-challenge-card').count()) === 1);
check('Fat Loss offers three durations', await page.evaluate(() => {
  const h = [...document.querySelectorAll('.challenge-card-header')].find(x => /Fat Loss Challenge/.test(x.textContent));
  if (h) h.click();
  return true;
}) && (await page.waitForTimeout(300), (await page.locator('.challenge-card', { hasText: 'Fat Loss Challenge' }).locator('.tpl-duration-card').count()) === 3));

// ── Insights ──
await gotoTab('Insights');
await page.waitForSelector('.insights-view', { timeout: 5000 });
check('Insights renders', (await page.locator('.insights-view').count()) === 1);
check('Insights filter chips present', (await page.locator('.ins-filter-chip').count()) === 4);

// ── Settings + backup/restore ──
await gotoTab('Settings');
await page.waitForSelector('.settings-view', { timeout: 5000 });
check('Settings renders', (await page.locator('.settings-view').count()) === 1);
check('Danger zone collapsed by default', (await page.evaluate(() => document.querySelector('.danger-zone')?.open)) === false);
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
const backup = await page.evaluate((keys) => { const d = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) d[k] = JSON.parse(v); } return d; }, LS_KEYS);
await page.evaluate(() => localStorage.clear());
await page.evaluate((data) => { for (const k of Object.keys(data)) localStorage.setItem(k, JSON.stringify(data[k])); }, backup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
check('Backup/restore round-trips the active challenge', await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.activeChallenge.templateId === 'mental_training_phase'));
check('Backup/restore round-trips logged days', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('allDays')).me).length >= 3));

// ── Profile separation ──
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
check('Female profile has its own (empty) challenge state', await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  return p.girlfriend.activeChallenge?.templateId !== 'mental_training_phase';
}));
check('Male profile data still intact after switching', await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.activeChallenge.templateId === 'mental_training_phase'));

check('No console/page errors across all flows', errors.length === 0, errors.slice(0, 3).join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
