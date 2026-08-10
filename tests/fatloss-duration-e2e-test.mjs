import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4173';
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
async function init() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('profiles')); p.me.highestRank = 8; p.girlfriend.highestRank = 8; localStorage.setItem('profiles', JSON.stringify(p)); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
}
const flCard = () => page.locator('.challenge-card', { hasText: 'Fat Loss Challenge' });
async function openFatLoss() {
  await gotoTab('Challenges');
  await page.waitForSelector('.challenges-view', { timeout: 5000 });
  const startBtn = flCard().locator('.challenge-card-action', { hasText: 'Start Fat Loss Challenge' });
  if (!((await startBtn.count()) > 0 && await startBtn.first().isVisible().catch(() => false))) {
    await page.evaluate(() => { const h = [...document.querySelectorAll('.challenge-card-header')].find(x => /Fat Loss Challenge/.test(x.textContent)); if (h) h.click(); });
    await page.waitForTimeout(300);
  }
}
async function startFatLoss(days) {
  await openFatLoss();
  if (days != null) {
    await flCard().locator('.tpl-duration-card', { hasText: `${days} DAYS` }).click();
    await page.waitForTimeout(150);
  }
  await flCard().locator('.challenge-card-action', { hasText: 'Start Fat Loss Challenge' }).click();
  await page.waitForSelector('.letter-modal', { timeout: 5000 });
  await page.locator('.letter-modal .letter-textarea').first().fill('Get lean and stay consistent.');
  await page.locator('.letter-modal .btn-primary', { hasText: 'Save & Begin' }).click();
  await page.waitForSelector('.daily-view', { timeout: 5000 });
}
const meta = () => page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.activeChallenge);

// ══ A: setup UI offers 14/30/60 with 30 default+recommended ═════════════════
await page.goto(BASE);
await init();
await openFatLoss();
const cards = await flCard().locator('.tpl-duration-card').allTextContents();
check('1: exactly three duration cards', cards.length === 3, cards.join(' | '));
check('1: 14 Kickstart / 30 Standard / 60 Transformation', /14 DAYS.*Kickstart/s.test(cards[0]) && /30 DAYS.*Standard/s.test(cards[1]) && /60 DAYS.*Transformation/s.test(cards[2]));
check('2: 30 DAYS is marked Recommended', /Recommended/.test(cards[1]) && !/Recommended/.test(cards[0]) && !/Recommended/.test(cards[2]));
check('2: 30 DAYS is pre-selected by default', (await flCard().locator('.tpl-duration-card.active').textContent()).includes('30 DAYS'));
const header = await flCard().locator('.challenge-card-meta').textContent();
check('Header no longer implies 30 days only', /14/.test(header) && /30/.test(header) && /60/.test(header), header.trim());

// ══ 10/11: Expected Results + Goal change with the selection ════════════════
let body = await flCard().textContent();
check('10: default shows "Expected Results (30 Days)" with 2–5 lb', /Expected Results \(30 Days\)/.test(body) && /2–5 lb/.test(body));
await flCard().locator('.tpl-duration-card', { hasText: '14 DAYS' }).click();
await page.waitForTimeout(200);
body = await flCard().textContent();
check('10: 14 selected → "Expected Results (14 Days)" with 1–2.5 lb', /Expected Results \(14 Days\)/.test(body) && /1–2\.5 lb/.test(body));
check('10: 14 no longer shows the 30-day 2–5 lb claim', !/2–5 lb/.test(body));
check('10: 14 shows the momentum emphasis', /Build momentum and create visible early progress/.test(body));
check('10: disclaimer still present on 14', /Results vary depending on starting body fat/.test(body));
await flCard().locator('.tpl-duration-card', { hasText: '60 DAYS' }).click();
await page.waitForTimeout(200);
body = await flCard().textContent();
check('10: 60 selected → "Expected Results (60 Days)" with 4–10 lb', /Expected Results \(60 Days\)/.test(body) && /4–10 lb/.test(body));
check('10: 60 shows the transformation emphasis', /clearly noticeable transformation/.test(body));
check('11: 60 "Finish all 60 days" copy (not 30)', /Finish all 60 days/.test(body) && !/Finish all 30 days/.test(body));

// ══ 19: other challenges are untouched ══════════════════════════════════════
await page.evaluate(() => { const h = [...document.querySelectorAll('.challenge-card-header')].find(x => /Mental Training Phase/.test(x.textContent)); if (h) h.click(); });
await page.waitForTimeout(300);
const mtCard = page.locator('.challenge-card', { hasText: 'Mental Training Phase' });
check('19: Mental Training has NO labelled duration cards', (await mtCard.locator('.tpl-duration-card').count()) === 0);
check('19: Mental Training keeps its plain 7/14/21 chips', (await mtCard.locator('.tpl-duration-chip').allTextContents()).join(',') === '7 days,14 days,21 days');

// ══ 3/4/5 + 6: each duration persists and ends on its own final day ═════════
for (const days of [14, 30, 60]) {
  await init();
  await startFatLoss(days);
  let m = await meta();
  check(`${days}d: stored on the attempt (durationDays=${days})`, m.durationDays === days, `got ${m.durationDays}`);
  const expectedBonus = { 14: 200, 30: 500, 60: 1100 }[days];
  check(`${days}d: completion bonus ${expectedBonus} stored on the attempt`, m.completionBonusXP === expectedBonus, `got ${m.completionBonusXP}`);
  check(`${days}d: passing score is the standard 70%`, m.passingScore === 70);
  // 6: survives reload
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  m = await meta();
  check(`6: ${days}d duration survives reload`, m.durationDays === days && m.completionBonusXP === expectedBonus);
  // Day selector reflects the duration
  await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
  check(`${days}d: Today shows "of ${days}"`, (await page.textContent('.day-selector')).includes(`of ${days}`));

  // 3/4/5: completion triggers on the final day, not before.
  // One day short → still running.
  await page.evaluate((d) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    const s = new Date(); s.setDate(s.getDate() - (d - 2)); // raw day d-1
    p.me.challengeStart = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}`;
    localStorage.setItem('profiles', JSON.stringify(p));
    const dd = {}; for (let i = 1; i <= d - 1; i++) dd[i] = { dayNumber: i, tasks: { fl_protein: true }, mood: 6, energy: 6, sleep: 6, stress: 4, recovery: 6, isMWD: false, mwdTasks: {}, bonusDone: {} };
    localStorage.setItem('allDays', JSON.stringify({ me: dd, girlfriend: {} }));
  }, days);
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(600);
  check(`${days}d: NOT complete on day ${days - 1}`, (await page.locator('.challenge-complete-screen').count()) === 0);
  // Past the final day → completes.
  await page.evaluate((d) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    const s = new Date(); s.setDate(s.getDate() - d); // raw day d+1 → overrun
    p.me.challengeStart = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}`;
    localStorage.setItem('profiles', JSON.stringify(p));
  }, days);
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(800);
  check(`${days === 14 ? '3' : days === 30 ? '4' : '5'}: ${days}-day Fat Loss completes at day ${days}`, (await page.locator('.challenge-complete-screen').count()) === 1);
  const cc = await page.textContent('.challenge-complete-screen');
  check(`16: completion summary reports ${days} days`, cc.includes(`${days} days`), cc.slice(0, 60).replace(/\s+/g, ' '));
  // 17: archive records the duration actually completed
  const arch = await page.evaluate(() => JSON.parse(localStorage.getItem('archives')).me.slice(-1)[0]);
  check(`17: archive stores durationDays=${days}`, arch.challenge.durationDays === days);
  check(`17: archive stores the matching completion bonus`, arch.challenge.completionBonusXP === expectedBonus);
  check(`17: archive marked completed`, arch.completed === true);
}

// ══ 7: a future attempt can choose a different duration ═════════════════════
await page.locator('.challenge-complete-screen button', { hasText: 'Return to Forge Daily' }).click().catch(() => {});
await page.waitForTimeout(300);
await startFatLoss(14);
check('7: next Fat Loss attempt can pick a different duration (14)', (await meta()).durationDays === 14);
check('7: and its bonus follows the new choice (200)', (await meta()).completionBonusXP === 200);

// ══ 8/9/20: legacy fixed 30-day attempts are preserved untouched ════════════
await init();
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const s = new Date(); s.setDate(s.getDate() - 5);
  p.me.challengeStart = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}`;
  // Legacy shape: fixed 30-day Fat Loss started before durations existed.
  p.me.activeChallenge = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard', durationDays: 30, templateVersion: 3, rewardXP: 500, completionBonusXP: 500, passingScore: 70, keystoneRequirement: 65 };
  p.me.tasks = [{ id: 'fl_protein', name: 'Protein', xp: 25, keystone: 2, source: 'template', order: 0 }, { id: 'daily_log', name: 'Daily Log', xp: 20, keystone: 0, source: 'template', order: 1 }];
  localStorage.setItem('profiles', JSON.stringify(p));
  const dd = {}; for (let i = 1; i <= 5; i++) dd[i] = { dayNumber: i, tasks: { fl_protein: true, daily_log: true }, mood: 6, energy: 6, sleep: 6, stress: 4, recovery: 6, isMWD: false, mwdTasks: {}, bonusDone: {} };
  localStorage.setItem('allDays', JSON.stringify({ me: dd, girlfriend: {} }));
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'arch_legacy', archivedAt: '2026-01-01', challengeStart: '2025-12-01', endDate: '2025-12-30', endDayNum: 30,
    completed: true, completionDate: '2025-12-31',
    challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30, completionBonusXP: 500 },
    days: { 1: { dayNumber: 1, tasks: { fl_protein: true }, mood: 5 } }, tasks: [{ id: 'fl_protein', name: 'Protein', xp: 25, keystone: 2 }],
    xpEarned: 900, badges: [], finalScore: 88, scoreAvailable: true, passingScore: 70, passed: true,
  }], girlfriend: [] }));
});
const beforeLegacy = await page.evaluate(() => localStorage.getItem('profiles') + '||' + localStorage.getItem('archives') + '||' + localStorage.getItem('allDays'));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const legacyMeta = await meta();
check('9: legacy active 30-day Fat Loss stays 30 days', legacyMeta.durationDays === 30);
check('9: legacy bonus stays 500', legacyMeta.completionBonusXP === 500);
const legacyArch = await page.evaluate(() => JSON.parse(localStorage.getItem('archives')).me[0]);
check('9/17: legacy archive still reports 30 days', legacyArch.challenge.durationDays === 30);
check('8/20: legacy archive score/XP untouched', legacyArch.finalScore === 88 && legacyArch.xpEarned === 900 && legacyArch.passed === true);
const afterLegacy = await page.evaluate(() => localStorage.getItem('profiles') + '||' + localStorage.getItem('archives') + '||' + localStorage.getItem('allDays'));
// The weekly-requirements migration additively stamps weeklySessions:[] and
// weeklyRequirementsStartDate on Fat Loss attempts. Nothing else may change, and
// a second load must change nothing at all.
check('20: legacy scores/XP/tasks untouched by load', await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles')).me;
  const a = JSON.parse(localStorage.getItem('archives')).me[0];
  return p.activeChallenge.durationDays === 30 && p.activeChallenge.completionBonusXP === 500
    && p.tasks.length === 2 && a.finalScore === 88 && a.xpEarned === 900;
}));
check('20: only the additive weekly fields differ', await page.evaluate(({ before }) => {
  const b = JSON.parse(before.split('||')[0]).me;
  const a = JSON.parse(localStorage.getItem('profiles')).me;
  const strip = (o) => { const c = { ...o, activeChallenge: { ...o.activeChallenge } };
    delete c.weeklySessions; delete c.activeChallenge.weeklyRequirementsStartDate; return JSON.stringify(c); };
  return strip(b) === strip(a);
}, { before: beforeLegacy }));
const legacySecond = await page.evaluate(() => localStorage.getItem('profiles') + '||' + localStorage.getItem('archives') + '||' + localStorage.getItem('allDays'));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
check('20: load is idempotent (second load changes nothing)',
  (await page.evaluate(() => localStorage.getItem('profiles') + '||' + localStorage.getItem('archives') + '||' + localStorage.getItem('allDays'))) === legacySecond);
await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
check('9: legacy attempt still shows "of 30"', (await page.textContent('.day-selector')).includes('of 30'));

// ══ 21: backup/export/import preserves the duration ═════════════════════════
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
await init();
await startFatLoss(60);
const backup = await page.evaluate((keys) => { const d = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) d[k] = JSON.parse(v); } return d; }, LS_KEYS);
await page.evaluate(() => localStorage.clear());
await page.evaluate((data) => { for (const k of Object.keys(data)) localStorage.setItem(k, JSON.stringify(data[k])); }, backup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
const restored = await meta();
check('21: export/import preserves durationDays=60', restored.durationDays === 60);
check('21: export/import preserves the 1100 bonus', restored.completionBonusXP === 1100);

// ══ 15: current-day fairness still holds on a 60-day attempt ════════════════
await gotoTab('Home'); await page.waitForTimeout(300);
const scoreBefore = await page.textContent('.perf-ring-num').catch(() => null);
check('15: performance card renders for a 60-day attempt', scoreBefore != null, `score=${scoreBefore}`);
await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
await gotoTab('Home'); await page.waitForTimeout(200);
check('15: unchecked tasks today do not drag the score', (await page.textContent('.perf-ring-num')) === scoreBefore);

check('No console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
