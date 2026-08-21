/**
 * Fat Loss hierarchy end-to-end: the stars/XP shown on Today match the values
 * actually awarded, and existing active attempts + archives keep their original
 * values.
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
async function init() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('profiles')); p.me.highestRank = 8; localStorage.setItem('profiles', JSON.stringify(p)); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
}
const challengeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
// Rows as { name, stars, xp } read straight off the rendered checklist.
const rows = () => page.evaluate(() => [...document.querySelectorAll('.check-item')].map(el => ({
  name: el.querySelector('.check-name')?.firstChild?.textContent?.trim() || el.textContent.trim(),
  stars: (el.querySelector('.keystone-stars')?.textContent.match(/⭐/g) || []).length,
  xp: parseInt(el.querySelector('.check-xp')?.textContent || '0', 10),
  cls: el.className,
})));

// ── Start a fresh Standard Fat Loss challenge through the real setup flow ──
await page.goto(BASE);
await init();
await gotoTab('Challenges');
await page.waitForSelector('.challenges-view', { timeout: 5000 });
await page.evaluate(() => { const h = [...document.querySelectorAll('.challenge-card-header')].find(x => /Fat Loss Challenge/.test(x.textContent)); if (h) h.click(); });
await page.waitForTimeout(300);
const flCard = page.locator('.challenge-card', { hasText: 'Fat Loss Challenge' });
check('Library preview shows the star hierarchy', /⭐⭐⭐ Hit protein goal/.test(await flCard.textContent()));
await flCard.locator('.challenge-card-action', { hasText: 'Start Fat Loss Challenge' }).click();
await page.waitForSelector('.letter-modal', { timeout: 5000 });
await page.locator('.letter-modal .letter-textarea').first().fill('Lean out.');
await page.locator('.letter-modal .btn-primary', { hasText: 'Save & Begin' }).click();
// Setup now asks when to begin — these suites test a challenge running today.
await page.waitForSelector('.start-when-options', { timeout: 5000 });
await page.locator('.start-when-btn', { hasText: 'Start Today' }).click();
await page.waitForSelector('.daily-view', { timeout: 5000 });

// ── 1–8: displayed stars + XP ───────────────────────────────────────────────
const shown = await rows();
const byName = (frag) => shown.find(r => r.name.includes(frag));
const EXPECT = [
  ['protein', 3, 40], ['whole foods', 3, 40],
  ['8,000+ steps', 2, 25], ['Sleep 7.5', 2, 25],
  ['water', 1, 15], ['progress photo', 1, 10], ['Daily Log', 1, 10],
];
for (const [frag, stars, xp] of EXPECT) {
  const r = byName(frag);
  check(`UI: "${frag}" shows ${'⭐'.repeat(stars)} and ${xp} XP`, r && r.stars === stars && r.xp === xp,
    r ? `stars=${r.stars} xp=${r.xp}` : 'row missing');
}
check('UI: keystone visual treatment applied to the ⭐⭐⭐ habits',
  byName('protein').cls.includes('keystone-3') && byName('whole foods').cls.includes('keystone-3'));
check('UI: exactly 7 required tasks on Standard', shown.length === 7, `${shown.length}`);
check('9: displayed XP sums to 165', shown.reduce((s, r) => s + r.xp, 0) === 165, `${shown.reduce((s, r) => s + r.xp, 0)}`);

// ── 20: XP shown == XP awarded ──────────────────────────────────────────────
for (const [frag, , xp] of EXPECT) {
  if (frag === 'Daily Log') continue; // opens the log form instead of toggling
  await gotoTab('Home'); const before = await challengeXP();
  await gotoTab('Today');
  await page.locator('.check-item', { hasText: frag === 'Sleep 7.5' ? 'Sleep 7.5' : frag }).first().click();
  await page.waitForTimeout(250);
  await gotoTab('Home'); const after = await challengeXP();
  check(`20: completing "${frag}" awards exactly the ${xp} XP shown`, after - before === xp, `+${after - before}`);
  await gotoTab('Today');
  await page.locator('.check-item', { hasText: frag === 'Sleep 7.5' ? 'Sleep 7.5' : frag }).first().click(); // undo
  await page.waitForTimeout(250);
}

// ── 22: reload does not change importance or XP ─────────────────────────────
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
check('22: stars/XP identical after reload', JSON.stringify(await rows()) === JSON.stringify(shown));

// ── 3/11: adherence uses only the two ⭐⭐⭐ habits ══════════════════════════
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.tasks);
check('3: only protein + whole foods carry keystoneHabit', stored.filter(t => t.keystoneHabit).map(t => t.id).sort().join() === 'fl_protein,fl_whole');
check('23: stored task ids are unique', new Set(stored.map(t => t.id)).size === stored.length);

// ── 19: an EXISTING active attempt keeps its original values ════════════════
await init();
const beforeStart = new Date(); beforeStart.setDate(beforeStart.getDate() - 6);
await page.evaluate(({ startStr }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = startStr; p.me.xpPenalties = false;
  // Pre-change snapshot: protein 25 XP / 2 stars, everything else unvalued (10 XP default).
  p.me.activeChallenge = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard', durationDays: 30, templateVersion: 3, rewardXP: 500, completionBonusXP: 500, passingScore: 70, keystoneRequirement: 65 };
  p.me.tasks = [
    { id: 'fl_photo',   name: 'Take progress photo', icon: '📸', source: 'template', order: 0 },
    { id: 'fl_protein', name: 'Hit protein goal (0.8–1 g/lb goal weight)', icon: '🥩', xp: 25, keystone: 2, source: 'template', order: 1 },
    { id: 'fl_steps',   name: 'Walk 8,000+ steps', icon: '🚶', source: 'template', order: 2 },
    { id: 'fl_whole',   name: 'Eat mostly whole foods (90%)', icon: '🥗', source: 'template', order: 3 },
    { id: 'fl_water',   name: 'Hit water goal', icon: '💧', source: 'template', order: 4 },
    { id: 'fl_sleep',   name: 'Sleep 7.5–9 hours', icon: '😴', source: 'template', order: 5 },
    { id: 'daily_log',  name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0, source: 'template', order: 6 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const dd = {};
  for (let i = 1; i <= 5; i++) dd[i] = { dayNumber: i, tasks: { fl_protein: true, fl_steps: true, fl_photo: true }, mood: 6, energy: 6, sleep: 6, stress: 4, recovery: 6, isMWD: false, mwdTasks: {}, bonusDone: {} };
  localStorage.setItem('allDays', JSON.stringify({ me: dd, girlfriend: {} }));
}, { startStr: dstr(beforeStart) });
const snapBefore = await page.evaluate(() => localStorage.getItem('profiles') + '||' + localStorage.getItem('allDays'));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
await gotoTab('Home');
const legacyXP = await challengeXP();
await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
const legacyRows = await rows();
check('19: active attempt keeps its OLD protein value (25 XP, ⭐⭐)', (r => r && r.xp === 25 && r.stars === 2)(legacyRows.find(r => r.name.includes('protein'))), JSON.stringify(legacyRows.find(r => r.name.includes('protein'))));
check('19: active attempt keeps its OLD photo value (10 XP, no stars)', (r => r && r.xp === 10 && r.stars === 0)(legacyRows.find(r => r.name.includes('progress photo'))));
check('19: active attempt is NOT silently upgraded to the new hierarchy', !legacyRows.some(r => r.xp === 40));
// Nothing about the attempt's rules or the user's logged work may change. (The
// long-standing Daily Log metric backfill may still mark daily_log on days that
// already carry metric data — that is unrelated to task values and idempotent,
// so we assert on the task definitions, the seeded completions and idempotency.)
const profilesBefore = snapBefore.split('||')[0];
const afterFirst = await page.evaluate(() => localStorage.getItem('profiles') + '||' + localStorage.getItem('allDays'));
const daysFirst = await page.evaluate(() => JSON.parse(localStorage.getItem('allDays')).me);
// The weekly-requirements migration additively stamps weeklySessions:[] and
// weeklyRequirementsStartDate; the task list and every pre-existing challenge
// rule must be byte-identical.
check('19: task definitions and challenge rules untouched (ignoring additive weekly fields)',
  await page.evaluate(({ before }) => {
    const b = JSON.parse(before).me, a = JSON.parse(localStorage.getItem('profiles')).me;
    const strip = (o) => { const c = { ...o, activeChallenge: { ...o.activeChallenge } };
      delete c.weeklySessions; delete c.activeChallenge.weeklyRequirementsStartDate; return JSON.stringify(c); };
    return strip(b) === strip(a);
  }, { before: profilesBefore }));
check('19: the task snapshot itself is unchanged', await page.evaluate(({ before }) =>
  JSON.stringify(JSON.parse(before).me.tasks) === JSON.stringify(JSON.parse(localStorage.getItem('profiles')).me.tasks), { before: profilesBefore }));
check('19: seeded task completions preserved exactly', [1, 2, 3, 4, 5].every(i =>
  daysFirst[i].tasks.fl_protein === true && daysFirst[i].tasks.fl_steps === true && daysFirst[i].tasks.fl_photo === true));
check('19: no task was auto-completed that the user never did', [1, 2, 3, 4, 5].every(i =>
  daysFirst[i].tasks.fl_whole !== true && daysFirst[i].tasks.fl_water !== true && daysFirst[i].tasks.fl_sleep !== true));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const afterSecond = await page.evaluate(() => localStorage.getItem('profiles') + '||' + localStorage.getItem('allDays'));
check('19: load is idempotent (second load changes nothing further)', afterSecond === afterFirst);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await gotoTab('Home');
check('19: previously earned XP unchanged across reloads', (await challengeXP()) === legacyXP, `${legacyXP} → ${await challengeXP()}`);
check('19: no "update available" prompt forcing a retroactive re-weight', (await page.locator('button', { hasText: 'Update Active Challenge' }).count()) === 0);

// ── 18: archives keep their historical values ═══════════════════════════════
await page.evaluate(() => {
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'arch_fl', archivedAt: '2026-02-01', challengeStart: '2026-01-01', endDate: '2026-01-30', endDayNum: 30,
    completed: true, completionDate: '2026-01-31',
    challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30, completionBonusXP: 500 },
    days: { 1: { dayNumber: 1, tasks: { fl_protein: true }, mood: 5 } },
    // Historical snapshot: the OLD values that applied then.
    tasks: [{ id: 'fl_protein', name: 'Protein', xp: 25, keystone: 2 }, { id: 'fl_photo', name: 'Photo' }],
    xpEarned: 1200, badges: [], finalScore: 84, scoreAvailable: true, passingScore: 70, keystoneAdherence: 90, passed: true,
  }], girlfriend: [] }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const arch = await page.evaluate(() => JSON.parse(localStorage.getItem('archives')).me[0]);
check('18: archived task snapshot keeps the old XP/stars', arch.tasks[0].xp === 25 && arch.tasks[0].keystone === 2);
check('18: archived score/XP/result untouched', arch.finalScore === 84 && arch.xpEarned === 1200 && arch.passed === true && arch.keystoneAdherence === 90);
check('18: archive retains enough to reconstruct its rules', arch.passingScore === 70 && arch.challenge.completionBonusXP === 500 && Array.isArray(arch.tasks));

check('No console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
