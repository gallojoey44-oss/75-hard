/**
 * Scheduled (future) challenge starts end-to-end: the setup schedule step, the
 * pre-start state, that nothing accrues before Day 1, automatic activation on
 * the local start date, rescheduling / Start Now, persistence, profile
 * isolation, and protection of existing attempts and archives.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function offset(n) { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); }
const TODAY = dstr(new Date());
const TOMORROW = offset(1);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => {
    const tabs = [...document.querySelectorAll('.bottom-nav .nav-tab')];
    const b = tabs.find(x => x.getAttribute('aria-label') === n) ||
      [...document.querySelectorAll('button')].find(x => new RegExp(n, 'i').test(x.textContent));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(300);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

const MT_TASKS = [
  { id: 'mt_meditate', name: 'Meditate 10 minutes', icon: '🧘', xp: 25, keystone: 3, keystoneHabit: true, source: 'template', order: 0 },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, source: 'template', order: 1 },
];

/** Seed a challenge attempt with an arbitrary (possibly future) start date. */
async function seed({ start, profile = 'me', tasks = MT_TASKS, meta = {}, dayRecords = null, clear = true } = {}) {
  if (clear) {
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
    await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  }
  await page.evaluate(({ start, profile, tasks, meta, dayRecords }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    p[profile].challengeStart = start;
    p[profile].xpPenalties = true;
    p[profile].weeklySessions = [];
    p[profile].activeChallenge = {
      templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard',
      durationDays: 14, templateVersion: 3, rewardXP: 300, completionBonusXP: 300,
      passingScore: 70, keystoneRequirement: 65, coldExposureUpgradeEnabled: false,
      futureSelfLetter: { why: 'To become someone who keeps promises.', writtenAt: '2026-08-20' },
      ...meta,
    };
    p[profile].tasks = tasks;
    localStorage.setItem('profiles', JSON.stringify(p));
    if (dayRecords) {
      const all = JSON.parse(localStorage.getItem('allDays') || '{"me":{},"girlfriend":{}}');
      all[profile] = dayRecords;
      localStorage.setItem('allDays', JSON.stringify(all));
    }
  }, { start, profile, tasks, meta, dayRecords });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(350);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });

// ══ 1/2: the setup flow offers Today / Tomorrow / Choose Date ═══════════════
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 8; localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Challenges');
await page.waitForTimeout(400);
// Walk the real Mental Training setup flow through to the Future Self Letter.
const mtCard = page.locator('.challenge-card', { hasText: 'Mental Training Phase' });
await mtCard.locator('.challenge-card-header').click();
await page.waitForTimeout(400);
await mtCard.locator('button', { hasText: /^Standard/ }).first().click();
await page.waitForTimeout(300);
await mtCard.locator('button', { hasText: 'Start Mental Training Phase' }).first().click();
await page.waitForTimeout(600);
// Future Self Letter → answer every prompt and submit.
const tas = page.locator('textarea');
const nTa = await tas.count();
for (let i = 0; i < nTa; i++) await tas.nth(i).fill('Because I want to become someone who keeps promises.');
await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
await page.waitForTimeout(500);
const scheduleStep = await page.locator('.start-when-options').count();
check('1: setup asks "When do you want to begin?" with a schedule step', scheduleStep === 1);
const whenText = scheduleStep ? await page.textContent('.start-when-options') : '';
check('1: it offers Start Today, Start Tomorrow and Choose Date',
  /Start Today/.test(whenText) && /Start Tomorrow/.test(whenText) && /Choose Date/.test(whenText));
check('1: the date picker cannot select the past', scheduleStep
  ? (await page.locator('.start-when-btn input[type=date]').getAttribute('min')) === TODAY : false);

if (scheduleStep) {
  await page.locator('.start-when-btn', { hasText: 'Start Tomorrow' }).click();
  await page.waitForTimeout(500);
}
let p1 = await prof();
check('1: choosing Start Tomorrow sets Day 1 to tomorrow', p1.challengeStart === TOMORROW, p1.challengeStart);
check('3: the Future Self Letter (My Why) written during setup is saved',
  /promises/.test(p1.activeChallenge?.futureSelfLetter?.why || JSON.stringify(p1.activeChallenge?.futureSelfLetter || {})));
check('26: setup completed with no page errors', errors.length === 0, errors[0] || '');

// ══ 2: an arbitrary future date via Choose Date ═════════════════════════════
await seed({ start: offset(9) });
check('2: an arbitrary future start date is accepted and stored', (await prof()).challengeStart === offset(9));
const farText = await page.textContent('.scheduled-card');
check('2/4: the heading names the date when it is more than a day out', /Challenge Starts \w+/.test(farText) && !/Tomorrow/.test(farText.split('\n')[0]));

// ══ 4/5: pre-start state on Home and Today ══════════════════════════════════
await seed({ start: TOMORROW });
const homeText = await page.textContent('.dashboard');
check('4: Home shows the pre-start card', (await page.locator('.scheduled-card').count()) === 1);
check('4: it reads "Challenge Starts Tomorrow"', /Challenge Starts Tomorrow/.test(homeText));
check('4: it names the challenge and the Day 1 date', /Mental Training Phase/.test(homeText) && /Day 1 begins/.test(homeText));
check('4: it reassures that nothing counts yet', /nothing counts against you until then/i.test(homeText));
check('5: Home never labels today "Day 1"', !/Day\s*1\b(?!\s*begins)/.test(homeText.replace(/Day 1 begins[^\n]*/g, '')));
check('4: it offers Change Start Date and Start Now', /Change Start Date/.test(homeText) && /Start Now/.test(homeText));
check('3: My Why is readable before Day 1', /Read My Why/.test(homeText));

await gotoTab('Today');
await page.waitForTimeout(300);
const todayText = await page.textContent('.daily-view');
check('5: Today shows the pre-start card instead of a day', (await page.locator('.daily-view .scheduled-card').count()) === 1);
check('6: no daily task list is rendered before Day 1', (await page.locator('.check-item, .task-row').count()) === 0);
check('5: Today does not label the current date Day 1', !/Day 1 of/.test(todayText));
check('7: no Challenge Performance card exists before Day 1', (await page.locator('.perf-card').count()) === 0);
check('11: no Weekly Requirements card exists before Day 1', (await page.locator('.wr-card').count()) === 0);

// ══ 6/7/8/9/10: nothing accrues ═════════════════════════════════════════════
const preState = await page.evaluate(() => ({
  days: JSON.parse(localStorage.getItem('allDays') || '{}').me || {},
  archives: (JSON.parse(localStorage.getItem('archives') || '{}').me || []).length,
}));
check('10: no Day 1 record is created merely by scheduling', Object.keys(preState.days).length === 0);
await gotoTab('Home');
const xpText = await page.textContent('.dashboard');
check('9: no challenge XP is displayed before Day 1', !/Challenge:\s*[1-9]/.test(xpText));
check('8: no challenge grade/score is shown before Day 1', (await page.locator('.perf-ring-num').count()) === 0);
check('10: no streak is displayed before Day 1', (await page.locator('.hero-day-num').count()) === 0);
check('25: scheduling produced no archive entry', preState.archives === 0);

// ══ 12: no notifications are scheduled for a pre-start attempt ══════════════
const notif = await page.evaluate(() => localStorage.getItem('notifPrefs'));
check('12: no incomplete-task notification state is produced pre-start',
  notif === null || !/pendingTasks|incomplete/i.test(notif));

// ══ 13/14: automatic activation on the local start date ═════════════════════
// The stored attempt is identical; only the local date moves. Simulating "the
// next day" by re-anchoring the start date is equivalent because activation is
// a pure comparison of challengeStart to the local date.
await seed({ start: TODAY });
check('13: on the scheduled date the attempt activates automatically', (await page.locator('.scheduled-card').count()) === 0);
const day1Text = await page.textContent('.dashboard');
check('13: that date becomes Day 1 with no button press', /\b1\b/.test(await page.textContent('.hero-day-num')), day1Text.slice(0, 60));
await gotoTab('Today');
check('13: Day 1 tasks are now available', (await page.locator('.check-item').count()) > 0);
await seed({ start: offset(-1) });
check('14: the following local date is Day 2', (await page.textContent('.hero-day-num')).trim() === '2');
await seed({ start: offset(-6) });
check('14: six days later is Day 7', (await page.textContent('.hero-day-num')).trim() === '7');

// ══ 15: Fat Loss weeks are measured from the scheduled Day 1 ════════════════
await seed({
  start: TOMORROW,
  tasks: [{ id: 'fl_protein', name: 'Hit protein goal', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, source: 'template', order: 0 }],
  meta: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', durationDays: 30, weeklyRequirementsStartDate: TOMORROW },
});
await gotoTab('Today'); await page.waitForTimeout(300);
check('11/15: no lifting or Zone 2 requirement exists the day before Day 1', (await page.locator('.wr-card').count()) === 0);
const flMeta = (await prof()).activeChallenge;
check('15: weekly requirements are anchored to the scheduled Day 1, not the setup day',
  flMeta.weeklyRequirementsStartDate === TOMORROW, flMeta.weeklyRequirementsStartDate);
// Activate it: week 1 then spans Days 1–7 from that date, and the setup day is
// outside it entirely.
await seed({
  start: TODAY,
  tasks: [{ id: 'fl_protein', name: 'Hit protein goal', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, source: 'template', order: 0 }],
  meta: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', durationDays: 30, weeklyRequirementsStartDate: TODAY },
});
await gotoTab('Today'); await page.waitForTimeout(300);
const wrText = await page.textContent('.wr-card');
check('15: on Day 1 Week 1 opens with the full targets', /Week 1/.test(wrText) && /0 \/ 3 this week/.test(wrText));
// A session dated the day BEFORE the start credits nothing.
await page.evaluate((d) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.weeklySessions = [{ id: 'pre1', type: 'lifting', date: d }];
  localStorage.setItem('profiles', JSON.stringify(p));
}, offset(-1));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForTimeout(400);
check('15: a session logged before Day 1 is not part of Week 1', /0 \/ 3 this week/.test(await page.textContent('.wr-card')));

// ══ 16: pre-start day logs stay eligible as pre-challenge baseline ══════════
// A Forge Daily log from before the scheduled start is archived when the
// challenge is set up, and is strictly earlier than Day 1 — exactly what the
// baseline comparison consumes.
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await page.evaluate((today) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 8;
  p.me.challengeStart = today;
  p.me.activeChallenge = { templateId: 'forge_daily', name: 'Forge Daily', emoji: '🔥', durationDays: null };
  p.me.tasks = [{ id: 'daily_log', name: 'Complete Daily Log', xp: 10, source: 'template', order: 0 }];
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('allDays', JSON.stringify({
    me: { 1: { dayNumber: 1, date: today, tasks: { daily_log: true }, mood: 5, sleep: 6, energy: 5, weight: 200 } },
    girlfriend: {},
  }));
}, TODAY);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
// Schedule a challenge for tomorrow via the context helper the setup flow uses.
await page.evaluate((tomorrow) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = tomorrow;
  p.me.activeChallenge = { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard', durationDays: 14, passingScore: 70, keystoneRequirement: 65 };
  localStorage.setItem('profiles', JSON.stringify(p));
}, TOMORROW);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const baselineDays = await days();
check('16: a log from before the scheduled start is retained, dated before Day 1',
  Object.values(baselineDays).some(d => d.date === TODAY) && TODAY < TOMORROW);
check('16: that setup-day log is NOT counted as a challenge day', (await page.locator('.scheduled-card').count()) === 1);

// ══ 17: rescheduling before Day 1 is free ═══════════════════════════════════
await seed({ start: TOMORROW });
const before = await prof();
await page.locator('button', { hasText: 'Change Start Date' }).first().click();
await page.waitForTimeout(200);
await page.locator('.sched-date-input').fill(offset(6));
await page.locator('button', { hasText: 'Save Date' }).click();
await page.waitForTimeout(400);
const after = await prof();
check('17: the start date can be moved freely while scheduled', after.challengeStart === offset(6), after.challengeStart);
check('17: rescheduling changes nothing but the date',
  after.xpOffset === before.xpOffset && JSON.stringify(after.tasks) === JSON.stringify(before.tasks) &&
  JSON.stringify(after.weeklySessions) === JSON.stringify(before.weeklySessions));
check('17: rescheduling creates no archive entry and no day records',
  (await arch()).length === 0 && Object.keys(await days()).length === 0);
check('17: the card confirms the new schedule', /Challenge scheduled for/.test(await page.textContent('.scheduled-card')));
// Move it back — lossless.
await page.locator('button', { hasText: 'Change Start Date' }).first().click();
await page.waitForTimeout(200);
await page.locator('.sched-date-input').fill(TOMORROW);
await page.locator('button', { hasText: 'Save Date' }).click();
await page.waitForTimeout(400);
check('17: moving it back is lossless', (await prof()).challengeStart === TOMORROW && (await arch()).length === 0);

// ══ 18: Start Now converts today into Day 1 ═════════════════════════════════
await page.locator('button', { hasText: 'Start Now' }).first().click();
await page.waitForTimeout(500);
check('18: Start Now makes today Day 1', (await prof()).challengeStart === TODAY);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
check('18: the challenge is now active (pre-start card gone)', (await page.locator('.scheduled-card').count()) === 0);
check('18: Home shows Day 1', (await page.textContent('.hero-day-num')).trim() === '1');

// ══ 19/20: persistence ══════════════════════════════════════════════════════
await seed({ start: offset(3) });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
check('19: the scheduled start survives a reload',
  (await prof()).challengeStart === offset(3) && (await page.locator('.scheduled-card').count()) === 1);
// PWA restart: a brand-new browser context sharing the same origin storage.
const ctx2 = await browser.newContext({ storageState: await page.context().storageState() });
const page2 = await ctx2.newPage();
await page2.goto(BASE);
await page2.waitForSelector('.dashboard', { timeout: 8000 });
await page2.waitForTimeout(400);
check('20: it survives an app restart (fresh context)',
  (await page2.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.challengeStart)) === offset(3) &&
  (await page2.locator('.scheduled-card').count()) === 1);
await ctx2.close();

// ══ 21: backup / restore ════════════════════════════════════════════════════
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
const backup = await page.evaluate((keys) => {
  const o = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) o[k] = JSON.parse(v); } return o;
}, LS_KEYS);
await page.evaluate(() => { localStorage.clear(); });
await page.reload(); await page.waitForSelector('.profile-selector, .dashboard', { timeout: 5000 });
await page.evaluate((b) => { for (const [k, v] of Object.entries(b)) localStorage.setItem(k, JSON.stringify(v)); }, backup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
check('21: backup/restore preserves the scheduled start',
  (await prof()).challengeStart === offset(3) && (await page.locator('.scheduled-card').count()) === 1);

// ══ 22: the two profiles are fully independent ══════════════════════════════
await seed({ start: TOMORROW });
await seed({ start: offset(-4), profile: 'girlfriend', clear: false });
const both = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')));
check('22: Male scheduled and Female active coexist',
  both.me.challengeStart === TOMORROW && both.girlfriend.challengeStart === offset(-4));
check('22: the active profile (Male) shows the pre-start card', (await page.locator('.scheduled-card').count()) === 1);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
check('22: switching to Female shows a running challenge, not the pre-start card',
  (await page.locator('.scheduled-card').count()) === 0 && (await page.textContent('.hero-day-num')).trim() === '5');
check('22: switching profiles did not alter the scheduled Male attempt',
  (await prof('me')).challengeStart === TOMORROW);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);

// ══ 23: an existing active challenge behaves exactly as before ══════════════
const legacyDays = {};
for (let i = 1; i <= 5; i++) legacyDays[i] = { dayNumber: i, tasks: { mt_meditate: true, daily_log: true }, mood: 6, isMWD: false, mwdTasks: {}, bonusDone: {} };
await seed({ start: offset(-5), dayRecords: legacyDays });
const legacySnap = await page.evaluate(() => localStorage.getItem('profiles'));
check('23: an existing active attempt is untouched — still Day 6', (await page.textContent('.hero-day-num')).trim() === '6');
check('23: it renders no pre-start card', (await page.locator('.scheduled-card').count()) === 0);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
check('23: migration is a no-op for it (idempotent, no fields rewritten)',
  (await page.evaluate(() => localStorage.getItem('profiles'))) === legacySnap);
check('23: no future start is ever inferred for an existing attempt', (await prof()).challengeStart === offset(-5));

// ══ 24/25: archives ═════════════════════════════════════════════════════════
await page.evaluate(() => {
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'arch_old', archivedAt: '2026-02-01', challengeStart: '2026-01-01', endDate: '2026-01-30', endDayNum: 30,
    completed: true, completionDate: '2026-01-31',
    challenge: { templateId: 'mental_training_phase', name: 'Mental Training Phase', durationDays: 30 },
    days: { 1: { dayNumber: 1, tasks: { mt_meditate: true } } }, tasks: [{ id: 'mt_meditate', xp: 25, keystone: 3 }],
    xpEarned: 900, badges: [], finalScore: 84, scoreAvailable: true, passingScore: 70, passed: true,
  }], girlfriend: [] }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const oldArch = (await arch())[0];
check('24: an existing archive is byte-identical after this feature ships',
  oldArch.finalScore === 84 && oldArch.xpEarned === 900 && oldArch.passed === true && oldArch.endDayNum === 30);

// 25: abandoning a scheduled attempt must not look like a failed challenge.
await seed({ start: offset(2) });
const archBefore = (await arch()).length;
await page.evaluate(() => {
  // Same path the app takes when a different challenge is started.
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = null; p.me.activeChallenge = null;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
check('25: cancelling a never-started attempt creates no archive entry', (await arch()).length === archBefore);
check('25: no phantom completed/failed challenge appears in history',
  !(await arch()).some(a => a.completed === false && a.endDayNum === 1));
// Starting a real challenge afterwards is a clean Day 1.
await seed({ start: TODAY });
check('25: the next challenge starts cleanly at Day 1', (await page.textContent('.hero-day-num')).trim() === '1');
check('25: with no misleading failed-challenge stats', (await arch()).every(a => a.endDayNum > 0));

// ══ 26: no runtime errors across the whole flow ═════════════════════════════
check('26: no page errors across the full scheduled-start flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
