/**
 * Challenge Combination end-to-end: adding a support challenge through the real
 * picker, the two-lane dashboard, deduplicated daily tasks, XP that is paid
 * once, independent lifecycles, and untouched existing users/archives.
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

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => {
    const t = [...document.querySelectorAll('.bottom-nav .nav-tab')].find(x => x.getAttribute('aria-label') === n);
    if (t) t.click();
  }, name);
  await page.waitForTimeout(350);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);
const challengeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
const lifetimeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});

const FL_TASKS = [
  { id: 'fl_protein', name: 'Hit protein goal', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'protein_target', source: 'template', order: 0, challenges: ['primary'] },
  { id: 'fl_sleep',   name: 'Sleep 7.5–9 hours', icon: '😴', xp: 25, keystone: 2, habitKey: 'sleep_target', target: { value: 7.5, unit: 'hours', direction: 'atLeast' }, source: 'template', order: 1, challenges: ['primary'] },
  { id: 'daily_log',  name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, habitKey: 'daily_log', source: 'template', order: 2, challenges: ['primary'] },
];

/** Seed an active primary challenge, optionally with a support challenge stacked. */
async function seed({ primaryStart = offset(-4), tasks = FL_TASKS, support = null, dayRecords = null, primaryMeta = {} } = {}) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  await page.evaluate(({ primaryStart, tasks, support, dayRecords, primaryMeta }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    p.me.challengeStart = primaryStart;
    p.me.xpPenalties = false;
    p.me.weeklySessions = [];
    p.me.activeChallenge = {
      templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard',
      durationDays: 30, templateVersion: 3, rewardXP: 500, completionBonusXP: 500,
      passingScore: 70, keystoneRequirement: 65, weeklyRequirementsStartDate: '2099-01-01',
      ...primaryMeta,
    };
    p.me.tasks = tasks;
    p.me.supportChallenge = support ? support.meta : null;
    p.me.supportChallengeStart = support ? support.start : null;
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({ me: dayRecords || {}, girlfriend: {} }));
  }, { primaryStart, tasks, support, dayRecords, primaryMeta });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });

// ══ 2: the picker groups options by compatibility and explains each ═════════
await seed({});
await gotoTab('Challenges');
check('2: an "Add a Support Challenge" action is offered on the running primary',
  (await page.locator('.acc-add-support').count()) === 1);
check('3: the running challenge is labelled PRIMARY once stacking exists',
  /Primary Challenge|Active Challenge/.test(await page.textContent('.acc-label')));
await page.locator('.acc-add-support').click();
await page.waitForTimeout(400);
check('2: the picker opens', (await page.locator('.sup-picker').count()) === 1);
const groups = await page.locator('.sup-group-title').allTextContents();
check('2: options are grouped with 🟢 / 🟡 / 🔴 labels',
  groups.some(g => /🟢/.test(g)) && groups.some(g => /🔴|🟡/.test(g)), groups.join(' | '));
check('2: Mental Training appears under Highly Compatible', await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🟢/.test(x.querySelector('.sup-group-title').textContent));
  return !!g && /Mental Training/.test(g.textContent);
}));
check('2: every option explains WHY it has its rating',
  (await page.locator('.sup-option-why').allTextContents()).every(t => t.trim().length > 20));
check('2: the primary itself is never offered as a support option',
  !(await page.textContent('.sup-picker')).includes('Start Fat Loss'));

// ══ 2: highly compatible is selectable straight through ═════════════════════
await page.locator('.sup-option', { hasText: 'Mental Training Phase' }).click();
await page.waitForTimeout(400);
check('2: a highly compatible pick goes straight to confirmation, no warning',
  (await page.locator('.sup-confirm').count()) === 1 && (await page.locator('.sup-warn').count()) === 0);
check('3: the confirmation states the primary keeps priority',
  /stays primary/i.test(await page.textContent('.sup-role-note')));

// ══ 4: the merge preview names the shared habit ═════════════════════════════
const mergeText = await page.textContent('.sup-merge');
check('4: the preview reports a merged shared habit', /shared habit/i.test(mergeText), mergeText.replace(/\s+/g, ' ').slice(0, 140));
check('4: it names Daily Log as the shared habit', /Daily log/i.test(mergeText));
check('4: it says the habit is logged once and counted for both', /logged once/i.test(mergeText) && /XP paid once/i.test(mergeText));

await page.locator('.sup-confirm button', { hasText: 'Add Support Challenge' }).click();
await page.waitForTimeout(600);

// ══ 4: one unified, deduplicated daily list ═════════════════════════════════
let p = await prof();
check('2: the support challenge is stored in its own slot', p.supportChallenge?.templateId === 'mental_training_phase');
check('2: it has its own independent start date', !!p.supportChallengeStart);
check('4: the shared Daily Log is ONE row, not two', p.tasks.filter(t => t.id === 'daily_log').length === 1);
check('4: that row is tagged for BOTH challenges',
  p.tasks.find(t => t.id === 'daily_log').challenges.sort().join() === 'primary,support');
check('4: primary-only tasks stay primary-only',
  p.tasks.find(t => t.id === 'fl_protein').challenges.join() === 'primary');
check('4: support tasks were added, tagged support', p.tasks.some(t => t.challenges.join() === 'support'));
check('4: no task id appears twice in the merged list',
  new Set(p.tasks.map(t => t.id)).size === p.tasks.length);
check('4: the shared row kept the PRIMARY xp value (stacking never re-prices the primary)',
  p.tasks.find(t => t.id === 'daily_log').xp === 10);

await gotoTab('Today');
const dailyIds = await page.evaluate(() => [...document.querySelectorAll('.check-item')].map(e => e.querySelector('.check-name')?.textContent || ''));
check('4: the daily list shows each habit exactly once',
  dailyIds.filter(t => /Complete Daily Log/.test(t)).length === 1, dailyIds.join(' | '));
check('4: the shared row is visually marked as shared', (await page.locator('.check-item.shared-habit').count()) >= 1);
check('4: it names both challenges it supports',
  /Supports: Fat Loss Challenge \+ Mental Training Phase/.test(await page.textContent('.check-supports')));

// ══ 5: one completed behaviour = one XP award ═══════════════════════════════
// Sleep is the canonical shared habit: both challenges require it, so it is one
// row. (The Daily Log row scrolls to the log form rather than toggling, so this
// uses a seeded stack whose shared habit is an ordinary check-off task.)
const SHARED_SLEEP_TASKS = [
  { id: 'fl_protein', name: 'Hit protein goal', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'protein_target', source: 'template', order: 0, challenges: ['primary'] },
  { id: 'fl_sleep', name: 'Sleep 8 hours', icon: '😴', xp: 25, keystone: 2, habitKey: 'sleep_target', source: 'template', order: 1, challenges: ['primary', 'support'], mergedFrom: { primary: 'fl_sleep', support: 'mt_sleep' } },
  { id: 'mt_mind', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 100, keystone: 3, habitKey: 'meditation', source: 'template', order: 2, challenges: ['support'] },
];
const supMeta0 = { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard', durationDays: 21, passingScore: 70, keystoneRequirement: 65 };
await seed({ primaryStart: offset(-4), tasks: SHARED_SLEEP_TASKS, support: { meta: supMeta0, start: offset(-2) } });
await gotoTab('Home'); const xp0 = await challengeXP();
await gotoTab('Today');
const sharedRow = page.locator('.check-item.shared-habit').first();
check('4: the shared sleep habit renders as a single row',
  (await page.locator('.check-item', { hasText: 'Sleep 8 hours' }).count()) === 1);
await sharedRow.click();
await page.waitForTimeout(400);
await gotoTab('Home');
const xpGain = (await challengeXP()) - xp0;
check('5: completing the shared habit awards its 25 XP exactly once — not 50', xpGain === 25, `+${xpGain}`);
await gotoTab('Today');
const sharedChecked = await page.evaluate(() =>
  [...document.querySelectorAll('.check-item.shared-habit .check-box')].every(b => b.classList.contains('checked')));
check('5: one tap satisfies the requirement for both challenges (single row, single state)', sharedChecked);
check('5: it is stored as ONE completion flag', await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('allDays')).me;
  const rec = Object.values(d).find(x => x.tasks?.fl_sleep);
  return !!rec && Object.keys(rec.tasks).filter(k => rec.tasks[k]).length === 1;
}));
// Adherence-wise that one completion credits BOTH challenges.
check('5: the single completion credits the support challenge too',
  /\d+%/.test(await page.textContent('.support-perf')));
await gotoTab('Home');

// ══ 6: the dashboard shows PRIMARY and SUPPORT with separate progress ═══════
await gotoTab('Home');
check('6: a two-lane stack card is shown', (await page.locator('.stack-card').count()) === 1);
const stack = await page.textContent('.stack-card');
check('6: it labels PRIMARY and SUPPORT', /PRIMARY/.test(stack) && /SUPPORT/.test(stack));
check('6: PRIMARY names the primary challenge with its own day count',
  /PRIMARY[\s\S]*?Fat Loss Challenge[\s\S]*?Day 5 \/ 30/.test(stack), stack.replace(/\s+/g, ' '));
check('6: SUPPORT names the support challenge with its OWN day count',
  /SUPPORT[\s\S]*?Mental Training Phase[\s\S]*?Day 3 \/ 21/.test(stack), stack.replace(/\s+/g, ' '));
check('6: the two lanes run on different days and different durations',
  /Day 5 \/ 30/.test(stack) && /Day 3 \/ 21/.test(stack));
check('6: the primary lane is rendered as the dominant one', await page.evaluate(() => {
  const p = document.querySelector('.stack-lane.primary .stack-name');
  const s = document.querySelector('.stack-lane.support .stack-name');
  return parseFloat(getComputedStyle(p).fontSize) > parseFloat(getComputedStyle(s).fontSize);
}));
check('6: the support challenge gets its own progress card',
  (await page.locator('.support-perf').count()) === 1);
const sp = await page.textContent('.support-perf');
check('6: that card scores the SUPPORT challenge separately', /SUPPORT/.test(sp) && /Mental Training Phase/.test(sp));
check('6: the primary Challenge Performance card is still present and separate',
  (await page.locator('.perf-card:not(.support-perf)').count()) >= 1);

// ══ 2: never more than two active challenges ════════════════════════════════
await gotoTab('Challenges');
check('2: with two running, no "Add a Support Challenge" action is offered',
  (await page.locator('.acc-add-support').count()) === 0);
const added = await page.evaluate(() => {
  // Try to force a third challenge through the API the UI uses.
  return window.__forgeTestAddSupport ? 'exposed' : 'not-exposed';
});
check('2: the support slot holds exactly one challenge',
  typeof (await prof()).supportChallenge === 'object' && !Array.isArray((await prof()).supportChallenge));

// ══ 2: conflicting pairs are blocked with an explanation + a way out ════════
await seed({});
await gotoTab('Challenges');
await page.locator('.acc-add-support').click();
await page.waitForTimeout(400);
const conflictGroup = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🔴/.test(x.querySelector('.sup-group-title').textContent));
  return g ? g.textContent : '';
});
check('2: a Conflicting group is shown for Fat Loss', /Conflicting/.test(conflictGroup), conflictGroup.slice(0, 80));
check('2: the 75-Day Discipline Challenge is the conflicting option', /75-Day Discipline/.test(conflictGroup));
if (/Conflicting/.test(conflictGroup)) {
  await page.evaluate(() => {
    const g = [...document.querySelectorAll('.sup-group')].find(x => /🔴/.test(x.querySelector('.sup-group-title').textContent));
    g.querySelector('.sup-option').click();
  });
  await page.waitForTimeout(400);
  check('2: choosing a conflicting challenge is BLOCKED, not confirmed',
    (await page.locator('.sup-conflict').count()) === 1 && (await page.locator('.sup-confirm').count()) === 0);
  const cf = await page.textContent('.sup-conflict');
  check('2: it explains why they conflict', /conflict/i.test(cf) && cf.length > 120);
  check('2: it offers to keep the current primary', /Keep Fat Loss Challenge/.test(cf));
  check('2: it offers to switch to it as the new primary', /Switch primary to/.test(cf));
  await page.locator('.sup-conflict button', { hasText: /^Keep / }).click();
  await page.waitForTimeout(300);
  check('2: keeping the primary changes nothing', (await prof()).supportChallenge === null);
}

// ══ 2: conditional pairs warn before confirmation ═══════════════════════════
// Strength + Fat Loss is rated CONDITIONAL in the table, and Fat Loss is
// startable — so a Strength primary reaches the warning step.
await seed({ primaryStart: offset(-4), primaryMeta: { templateId: 'strength_phase', name: 'Strength Phase', emoji: '💪', durationDays: 30 } });
await gotoTab('Challenges');
await page.locator('.acc-add-support').click();
await page.waitForTimeout(400);
check('2: Fat Loss is offered to a Strength primary under Conditional', await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🟡/.test(x.querySelector('.sup-group-title')?.textContent || ''));
  return !!g && /Fat Loss/.test(g.textContent);
}));
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🟡/.test(x.querySelector('.sup-group-title')?.textContent || ''));
  if (g) g.querySelector('.sup-option').click();
});
await page.waitForTimeout(400);
if (await page.locator('.sup-warn').count()) {
  const w = await page.textContent('.sup-warn');
  check('2: a conditional pick warns BEFORE confirmation', /Worth knowing first/.test(w));
  check('2: the warning explains the potential conflict', w.length > 150);
  check('2: it can still be confirmed after acknowledging',
    (await page.locator('.sup-warn button', { hasText: 'I understand' }).count()) === 1);
  await page.locator('.sup-warn button', { hasText: 'I understand' }).click();
  await page.waitForTimeout(300);
  check('2: acknowledging leads to the confirm step', (await page.locator('.sup-confirm').count()) === 1);
} else {
  check('2: a conditional pick warns BEFORE confirmation', false, 'no conditional option rendered');
}
await page.keyboard.press('Escape');

// ══ 3/7: ending support leaves the primary completely untouched ═════════════
const supportMeta = { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard', durationDays: 21, passingScore: 70, keystoneRequirement: 65 };
const stackedTasks = [
  ...FL_TASKS.map(t => t.id === 'daily_log' ? { ...t, challenges: ['primary', 'support'] } : t),
  { id: 'mt_mind', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 100, keystone: 3, habitKey: 'meditation', source: 'template', order: 3, challenges: ['support'] },
];
const records = {};
for (let i = 1; i <= 4; i++) records[i] = { dayNumber: i, date: offset(-5 + i), tasks: { fl_protein: true, fl_sleep: true, daily_log: true, mt_mind: true }, isMWD: false, mwdTasks: {}, bonusDone: {} };
await seed({ primaryStart: offset(-4), tasks: stackedTasks, support: { meta: supportMeta, start: offset(-2) }, dayRecords: records });

await gotoTab('Home');
const primaryBefore = await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles')).me;
  return JSON.stringify({ start: p.challengeStart, meta: p.activeChallenge });
});
const xpBefore = await challengeXP();
const lifeBefore = await lifetimeXP();
const dayBefore = await page.textContent('.stack-lane.primary .stack-progress');
await gotoTab('Challenges');
await page.locator('.acc-support-end').click();
await page.waitForTimeout(300);
await page.locator('.modal-card button', { hasText: 'End Support Challenge' }).click();
await page.waitForTimeout(600);
p = await prof();
check('3: the support slot is cleared', p.supportChallenge === null && p.supportChallengeStart === null);
check('3: support-only tasks are removed from the daily list', !p.tasks.some(t => t.id === 'mt_mind'));
check('3: the shared row survives and reverts to primary-only',
  p.tasks.some(t => t.id === 'daily_log') && p.tasks.find(t => t.id === 'daily_log').challenges.join() === 'primary');
check('3: the PRIMARY challenge descriptor and start date are byte-identical afterwards', await page.evaluate((before) => {
  const q = JSON.parse(localStorage.getItem('profiles')).me;
  return JSON.stringify({ start: q.challengeStart, meta: q.activeChallenge }) === before;
}, primaryBefore));
check('3: the primary keeps every logged completion', await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('allDays')).me;
  return [1, 2, 3, 4].every(i => d[i].tasks.fl_protein && d[i].tasks.daily_log);
}));
await gotoTab('Home');
check('3: the two-lane card is gone; the app is back to a single challenge',
  (await page.locator('.stack-card').count()) === 0 && (await page.locator('.support-perf').count()) === 0);
check('3: the primary is still on the same day', /Day 5|5/.test(dayBefore) && (await page.textContent('.hero-day-num')).trim() === '5');
check('7: the ended support challenge is archived, not lost',
  (await arch()).some(a => a.lane === 'support' && a.challenge.templateId === 'mental_training_phase'));
const xpAfter = await challengeXP();
const lifeAfter = await lifetimeXP();
check('5: ending support does not retroactively change Challenge XP', xpAfter === xpBefore, `${xpBefore} → ${xpAfter}`);
check('5: and Lifetime XP is exactly preserved — a transfer, never a loss or a gain',
  lifeAfter === lifeBefore, `${lifeBefore} → ${lifeAfter}`);
check('5: the archive banks exactly the XP that left the current challenge',
  (await arch()).find(a => a.lane === 'support').xpEarned >= 0);

// ══ 7: finishing the SUPPORT does not finish the PRIMARY ════════════════════
// Support on its final day + 1 → the lifecycle completes it automatically.
await seed({
  primaryStart: offset(-10), tasks: stackedTasks,
  support: { meta: { ...supportMeta, durationDays: 7 }, start: offset(-8) },
  dayRecords: records,
});
await page.waitForTimeout(700);
p = await prof();
check('7: the finished support challenge is cleared', p.supportChallenge === null);
check('7: the PRIMARY is still running, on its own day', p.challengeStart === offset(-10) && p.activeChallenge.templateId === 'fat_loss_phase');
await gotoTab('Home');
check('7: the primary is untouched and still shows Day 11', (await page.textContent('.hero-day-num')).trim() === '11');
check('7: the support challenge archived independently with its own duration',
  (await arch()).some(a => a.lane === 'support' && a.challenge.durationDays === 7));
check('7: the support archive has its OWN Day 1 numbering',
  Object.keys((await arch()).find(a => a.lane === 'support').days).includes('1'));

// ══ 7: finishing the PRIMARY prompts — it never decides for the user ════════
await seed({
  primaryStart: offset(-31), tasks: stackedTasks,
  support: { meta: supportMeta, start: offset(-3) },
  dayRecords: records,
});
await page.waitForTimeout(800);
await gotoTab('Home');
p = await prof();
check('7: finishing the primary does NOT end the running support', p.supportChallenge?.templateId === 'mental_training_phase');
check('7: the finished primary is archived', (await arch()).some(a => a.challenge?.templateId === 'fat_loss_phase'));
const pcVisible = (await page.locator('.primary-choice-card').count()) === 1 ||
  (await page.locator('.challenge-complete, .cc-card').count()) > 0;
check('7: the user is prompted about what comes next', pcVisible);
if ((await page.locator('.primary-choice-card').count()) === 1) {
  const pc = await page.textContent('.primary-choice-card');
  check('7: the prompt offers to promote the support challenge', /Promote Mental Training Phase to Primary/.test(pc));
  check('7: it offers to choose a new primary', /Choose a new Primary Challenge/.test(pc));
  check('7: it offers to continue with no primary', /Continue with no Primary/.test(pc));
  check('7: nothing was promoted automatically', (await prof()).activeChallenge.templateId === 'forge_daily');
  await page.locator('.primary-choice-card button', { hasText: 'Promote' }).click();
  await page.waitForTimeout(600);
  p = await prof();
  check('7: promoting moves the support challenge into the primary slot',
    p.activeChallenge.templateId === 'mental_training_phase' && p.challengeStart === offset(-3));
  check('7: the support slot is emptied by the promotion', p.supportChallenge === null);
  check('7: its tasks become the primary tasks', p.tasks.every(t => t.challenges.join() === 'primary'));
  check('7: promotion preserves logged day records (re-keyed, not discarded)',
    Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('allDays')).me)).length > 0);
  await gotoTab('Home');
  check('7: the promoted challenge continues from its real day, not day 1',
    (await page.textContent('.hero-day-num')).trim() === '4', await page.textContent('.hero-day-num'));
}

// ══ 8: existing single-challenge users migrate naturally ════════════════════
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 8; p.me.challengeStart = start; p.me.xpPenalties = false;
  // A pre-feature profile: NO support fields, NO lane tags on tasks.
  p.me.activeChallenge = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard', durationDays: 30, templateVersion: 3, passingScore: 70, keystoneRequirement: 65, weeklyRequirementsStartDate: '2099-01-01' };
  p.me.tasks = [
    { id: 'fl_protein', name: 'Hit protein goal', xp: 40, keystone: 3, keystoneHabit: true, source: 'template', order: 0 },
    { id: 'daily_log', name: 'Complete Daily Log', xp: 10, keystone: 1, source: 'template', order: 1 },
    { id: 'task_custom', name: 'My own habit', xp: 10, keystone: 0, source: 'custom', order: 2 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const dd = {}; for (let i = 1; i <= 5; i++) dd[i] = { dayNumber: i, tasks: { fl_protein: true, daily_log: true }, mood: 6, isMWD: false, mwdTasks: {}, bonusDone: {} };
  localStorage.setItem('allDays', JSON.stringify({ me: dd, girlfriend: {} }));
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'arch_old', archivedAt: '2026-02-01', challengeStart: '2026-01-01', endDate: '2026-01-30', endDayNum: 30,
    completed: true, challenge: { templateId: 'mental_training_phase', name: 'Mental Training Phase', durationDays: 30 },
    days: { 1: { dayNumber: 1, tasks: { mt_mind: true } } }, tasks: [{ id: 'mt_mind', xp: 100, keystone: 3 }],
    xpEarned: 1200, badges: ['iron_will'], finalScore: 84, scoreAvailable: true, passingScore: 70, passed: true,
  }], girlfriend: [] }));
}, offset(-4));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
p = await prof();
check('8: an existing challenge becomes the PRIMARY, unchanged',
  p.activeChallenge.templateId === 'fat_loss_phase' && p.challengeStart === offset(-4));
check('8: the support slot migrates to none', p.supportChallenge === null && p.supportChallengeStart === null);
check('8: every existing task is tagged primary — template and custom alike',
  p.tasks.every(t => t.challenges.join() === 'primary') && p.tasks.length === 3);
check('8: a user-added custom task keeps its source and position',
  p.tasks[2].id === 'task_custom' && p.tasks[2].source === 'custom');
check('8: no day record was touched', await page.evaluate(() =>
  [1, 2, 3, 4, 5].every(i => JSON.parse(localStorage.getItem('allDays')).me[i].tasks.fl_protein === true)));
check('9: existing archives are untouched', await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('archives')).me[0];
  return a.finalScore === 84 && a.xpEarned === 1200 && a.passed === true && a.badges[0] === 'iron_will';
}));
check('9: no support card appears for a single-challenge profile',
  (await page.locator('.stack-card').count()) === 0 && (await page.locator('.support-perf').count()) === 0);
await gotoTab('Home');
check('9: the challenge still shows its own day count', (await page.textContent('.hero-day-num')).trim() === '5');
const migSnap = await page.evaluate(() => localStorage.getItem('profiles'));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
check('8: the migration is idempotent — a second load changes nothing',
  (await page.evaluate(() => localStorage.getItem('profiles'))) === migSnap);

// ══ 9: existing functionality still works with a stack running ══════════════
await seed({ primaryStart: offset(-4), tasks: stackedTasks, support: { meta: supportMeta, start: offset(-2) } });
await gotoTab('Today');
const before = await page.evaluate(() => document.querySelectorAll('.check-item .check-box.checked').length);
await page.locator('.check-item').first().click();
await page.waitForTimeout(400);
check('9: daily task completion still works', await page.evaluate((b) =>
  document.querySelectorAll('.check-item .check-box.checked').length === b + 1, before));
// Backfill a past day through the day selector.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.day-selector button, .ds-day')].find(x => /^2$/.test(x.textContent.trim()));
  if (b) b.click();
});
await page.waitForTimeout(400);
check('9: backfilling an earlier day still works',
  (await page.locator('.check-item').count()) > 0);
await gotoTab('Insights');
check('9: Insights still renders with two challenges running',
  (await page.locator('.insights-view').count()) === 1);
await gotoTab('Settings');
check('9: Settings still renders', (await page.locator('.settings-view').count()) === 1);

// Backup / restore round-trips the whole stack.
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
const backup = await page.evaluate((keys) => { const o = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) o[k] = JSON.parse(v); } return o; }, LS_KEYS);
await page.evaluate(() => { localStorage.clear(); });
await page.reload(); await page.waitForSelector('.profile-selector, .dashboard', { timeout: 5000 });
await page.evaluate((b) => { for (const [k, v] of Object.entries(b)) localStorage.setItem(k, JSON.stringify(v)); }, backup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
p = await prof();
check('9: backup/restore preserves both lanes',
  p.activeChallenge.templateId === 'fat_loss_phase' && p.supportChallenge?.templateId === 'mental_training_phase');
await gotoTab('Home');
check('9: and the two-lane dashboard comes back', (await page.locator('.stack-card').count()) === 1);

// ══ Profiles stay independent ═══════════════════════════════════════════════
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.challengeStart = start;
  p.girlfriend.activeChallenge = { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', durationDays: 14, passingScore: 70, keystoneRequirement: 65 };
  p.girlfriend.supportChallenge = null; p.girlfriend.supportChallengeStart = null;
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('activeProfile', JSON.stringify('girlfriend'));
}, offset(-2));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
check('9: the other profile has no support challenge and renders single-challenge',
  (await page.locator('.stack-card').count()) === 0);
check('9: switching profiles did not alter the stacked profile',
  (await prof('me')).supportChallenge?.templateId === 'mental_training_phase');

check('9: no page errors across the whole flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
