/**
 * Start New Challenge lifecycle, end to end.
 *
 * The bug this guards: pressing Start New Challenge archived the running
 * challenge and then immediately auto-activated 75-Day Discipline while leaving
 * the PREVIOUS challenge's tasks in place — "Day 1 of 75" above Mental Training
 * tasks.
 *
 * The lifecycle asserted here is:
 *   ACTIVE → archive → NO ACTIVE CHALLENGE (Forge Daily) → select → configure
 *   → confirm → ACTIVE
 * with selection and activation as separate actions, and no path where a
 * missing challenge silently becomes 75-Day.
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
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => x.getAttribute('aria-label') === n);
    if (b) b.click();
  }, name);
  await page.waitForTimeout(350);
}
const activeTab = () => page.evaluate(() =>
  document.querySelector('.bottom-nav .nav-tab.active')?.getAttribute('aria-label') || null);
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

const MT_TASKS = [
  { id: 'mt_meditate', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 25, keystone: 3, keystoneHabit: true, source: 'template', order: 0, challenges: ['primary'] },
  { id: 'mt_read',     name: 'Read 5 pages',                icon: '📚', xp: 15, keystone: 1, source: 'template', order: 1, challenges: ['primary'] },
  { id: 'mt_pray',     name: 'Prayer',                      icon: '🙏', xp: 10, keystone: 1, source: 'template', order: 2, challenges: ['primary'] },
  { id: 'mt_grat',     name: 'Write one gratitude',         icon: '📝', xp: 10, keystone: 1, source: 'template', order: 3, challenges: ['primary'] },
  { id: 'daily_log',   name: 'Complete Daily Log',          icon: '📊', xp: 10, keystone: 1, source: 'template', order: 4, challenges: ['primary'] },
];
const MT_META = {
  templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard',
  durationDays: 14, templateVersion: 3, rewardXP: 300, completionBonusXP: 300,
  passingScore: 70, keystoneRequirement: 65, coldExposureUpgradeEnabled: true,
  coldExposureUpgradeStartDate: offset(-9),
  futureSelfLetter: { why: 'To become someone who keeps promises.', writtenAt: offset(-9) },
};

/** A running Mental Training attempt with real logged history. */
async function seedMentalTraining({ profile = 'me', clear = true, meta = {}, tasks = MT_TASKS } = {}) {
  if (clear) {
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
    await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 });
  }
  await page.evaluate(({ profile, meta, tasks, start }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    p[profile].challengeStart = start;
    p[profile].activeChallenge = { ...meta };
    p[profile].tasks = tasks;
    p[profile].weeklySessions = [];
    localStorage.setItem('profiles', JSON.stringify(p));
    const all = JSON.parse(localStorage.getItem('allDays') || '{"me":{},"girlfriend":{}}');
    const recs = {};
    for (let n = 1; n <= 10; n++) {
      const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + n - 1);
      const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      recs[n] = {
        date, dayNumber: n, mood: 4, confidence: 4, sleep: 4, energy: 4, recovery: 4,
        workoutEffort: 4, stress: 2, hoursSlept: 8, validated: true, notes: `day ${n}`,
        tasks: Object.fromEntries(tasks.map(t => [t.id, true])),
        mentalTraining: { selected: 'meditation', completed: true, notes: '' },
        bonusDone: {}, bonusOneTime: [],
      };
    }
    all[profile] = recs;
    localStorage.setItem('allDays', JSON.stringify(all));
    const wr = JSON.parse(localStorage.getItem('weeklyReflections') || '{}');
    wr[profile] = { 1: { went_well: 'Kept the streak.', hardest: 'Early mornings.' } };
    localStorage.setItem('weeklyReflections', JSON.stringify(wr));
  }, { profile, meta: { ...MT_META, ...meta }, tasks, start: offset(-9) });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
}

/** Press Settings → Start New Challenge → confirm. */
async function pressStartNewChallenge() {
  await gotoTab('Settings');
  await page.locator('button', { hasText: 'Start New Challenge' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: /Archive .* Choose New/ }).first().click();
  await page.waitForTimeout(600);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1-5: finish Mental Training → Start New Challenge ═══════════════════════
await seedMentalTraining();
const beforeArch = (await arch()).length;
const lifetimeBefore = await page.evaluate(() => {
  const el = document.querySelector('.xp-lifetime-value, .xp-widget');
  return el ? el.textContent : '';
});
await pressStartNewChallenge();

const a1 = await arch();
check('1: the previous attempt is archived exactly once', a1.length === beforeArch + 1, `${a1.length} entries`);
check('1: the archive is the Mental Training attempt', a1[a1.length - 1]?.challenge?.templateId === 'mental_training_phase');

const p1 = await prof();
check('2: no challenge is active afterwards — the baseline, not a challenge',
  p1.activeChallenge?.templateId === 'forge_daily', String(p1.activeChallenge?.templateId));
check('4: 75-Day Discipline is NOT automatically started',
  p1.activeChallenge?.templateId !== '75_day_discipline_challenge');
check('5: no challenge of any kind is automatically started',
  p1.activeChallenge?.durationDays == null);
check('3: the user lands in the Challenge Library', (await activeTab()) === 'Challenges');
check('3: the library is actually rendered with its options',
  (await page.locator('.challenge-card').count()) > 3);

// ══ 10: no hybrid state — the old tasks are gone ════════════════════════════
check('10: Mental Training tasks do not survive into the next state',
  !p1.tasks.some(t => t.id.startsWith('mt_')), JSON.stringify(p1.tasks.map(t => t.id)));
check('6: the profile holds Forge Daily tasks it can still log',
  p1.tasks.length > 0 && p1.tasks.every(t => /^(fd_|daily_log)/.test(t.id)));
check('14: the Cold Exposure Upgrade does not survive the transition',
  !p1.activeChallenge?.coldExposureUpgradeEnabled && !p1.activeChallenge?.coldExposureUpgradeStartDate);
check('12: the old 14-day duration does not survive', p1.activeChallenge?.durationDays !== 14);
check('13: the old "standard" mode does not survive', !p1.activeChallenge?.variant);

// ══ 16/17/18: history, XP and rank survive the transition ══════════════════
const entry = a1[a1.length - 1];
check('16: the archived attempt keeps all 10 logged days', Object.keys(entry.days || {}).length === 10);
check('16: the archived attempt keeps its own task list', (entry.tasks || []).some(t => t.id === 'mt_meditate'));
check('16: the archived attempt keeps its challenge configuration',
  entry.challenge?.variant === 'standard' && entry.challenge?.durationDays === 14);
check('14: the Cold Exposure Upgrade is preserved IN the archive',
  entry.challenge?.coldExposureUpgradeEnabled === true);
check('16: the archived attempt keeps its completion score',
  entry.finalScore != null && typeof entry.finalScore === 'number');
check('16: the archived attempt keeps its weekly reflections',
  !!entry.weeklyReflections && Object.keys(entry.weeklyReflections).length > 0);
check('17: lifetime XP is banked in the archive, not discarded', (entry.xpEarned || 0) > 0, `${entry.xpEarned} XP`);
check('18: the permanent rank floor is untouched', p1.highestRank === 8);
check('19: challenge XP resets for the new slate (existing behaviour)', p1.xpOffset === 0 && p1.xpStartDay === 1);
check('16: day records for the finished attempt are cleared from the live slate only',
  Object.keys(await days()).length === 0 && Object.keys(entry.days).length === 10);

// ══ 6: Forge Daily is loggable while deciding ══════════════════════════════
await gotoTab('Home');
const homeText = await page.textContent('.dashboard');
check('6: home shows the No Active Challenge state', /No Active Challenge/i.test(homeText));
check('6: home offers Forge Daily as the interim', /Forge Daily/i.test(homeText));
check('6: home does NOT claim a challenge day', !/Day 1 of 75/i.test(homeText));
await gotoTab('Today');
await page.waitForTimeout(400);
const todayText = await page.textContent('body');
check('6: Forge Daily tasks are loggable between challenges',
  (await page.locator('.check-item, .task-row, .gf-task-card').count()) > 0);
check('6: Today does not show "of 75" between challenges', !/of 75/.test(todayText));

// ══ 7: select Fat Loss and confirm → Fat Loss, not 75-Day ══════════════════
async function startFromLibrary(cardName, variantRe = /^Standard/) {
  await gotoTab('Challenges');
  await page.waitForTimeout(400);
  const card = page.locator('.challenge-card', { hasText: cardName });
  await card.locator('.challenge-card-header').click();
  await page.waitForTimeout(400);
  await card.locator('button', { hasText: variantRe }).first().click();
  await page.waitForTimeout(300);
  await card.locator('button', { hasText: new RegExp(`Start ${cardName}`) }).first().click();
  await page.waitForTimeout(600);
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('Because I want to keep the promises I make to myself.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Start Today' }).first().click();
  await page.waitForTimeout(700);
}

await startFromLibrary('Fat Loss Challenge');
const pFat = await prof();
check('7: selecting Fat Loss and confirming creates Fat Loss',
  pFat.activeChallenge?.templateId === 'fat_loss_phase', String(pFat.activeChallenge?.templateId));
check('7: it does NOT create 75-Day Discipline',
  pFat.activeChallenge?.templateId !== '75_day_discipline_challenge');
check('11: Forge Daily tasks did not leak into Fat Loss',
  !pFat.tasks.some(t => t.id.startsWith('fd_')), JSON.stringify(pFat.tasks.map(t => t.id)));
check('10: Mental Training tasks did not leak into Fat Loss',
  !pFat.tasks.some(t => t.id.startsWith('mt_')));
check('7: Fat Loss received its own task set', pFat.tasks.length > 0 && pFat.tasks.every(t => t.source === 'template'));
check('12: Fat Loss uses its own duration, not the previous challenge\'s',
  pFat.activeChallenge?.durationDays !== 14 && pFat.activeChallenge?.durationDays > 0,
  String(pFat.activeChallenge?.durationDays));
check('14: Cold Exposure does not leak into Fat Loss',
  !pFat.activeChallenge?.coldExposureUpgradeEnabled);
check('15: weekly requirement tracking anchors to THIS attempt\'s Day 1',
  !pFat.activeChallenge?.weeklyRequirementsStartDate || pFat.activeChallenge.weeklyRequirementsStartDate === TODAY);
check('1: starting Fat Loss archived the Forge Daily period without duplicating the MT archive',
  (await arch()).filter(a => a.challenge?.templateId === 'mental_training_phase').length === 1);

// ══ 8: Mental Training selected and confirmed → Mental Training ════════════
await pressStartNewChallenge();
await startFromLibrary('Mental Training Phase');
const pMT = await prof();
check('8: selecting Mental Training and confirming creates Mental Training',
  pMT.activeChallenge?.templateId === 'mental_training_phase', String(pMT.activeChallenge?.templateId));
check('8: it received Mental Training\'s own tasks', pMT.tasks.some(t => t.id.startsWith('mt_')));
check('11: Fat Loss tasks did not leak into Mental Training',
  !pMT.tasks.some(t => /^(fl_|fatloss)/.test(t.id)));
check('13: the new attempt carries its own mode', pMT.activeChallenge?.variant === 'standard');
check('14: Cold Exposure defaults OFF on a fresh attempt (not inherited)',
  pMT.activeChallenge?.coldExposureUpgradeEnabled === false);

// ══ 9: 75-Day Discipline selected and confirmed → 75-Day ═══════════════════
await pressStartNewChallenge();
await gotoTab('Challenges');
await page.waitForTimeout(400);
const d75card = page.locator('.challenge-card', { hasText: '75-Day Discipline Challenge' });
await d75card.locator('.challenge-card-header').click();
await page.waitForTimeout(400);
await d75card.locator('button', { hasText: /^Start Challenge$/ }).first().click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: /Next: Your Why/i }).first().click();
await page.waitForTimeout(600);
{
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('Because discipline is the promise I keep to myself.');
}
await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: 'Start Today' }).first().click();
await page.waitForTimeout(700);

const p75 = await prof();
check('9: selecting 75-Day Discipline and confirming creates it',
  p75.activeChallenge?.templateId === '75_day_discipline_challenge', String(p75.activeChallenge?.templateId));
check('9: it is 75 days long', p75.activeChallenge?.durationDays === 75);
check('10: Mental Training tasks cannot leak into 75-Day',
  !p75.tasks.some(t => t.id.startsWith('mt_')), JSON.stringify(p75.tasks.map(t => t.id)));
check('9: 75-Day received its OWN task set', p75.tasks.some(t => t.id === 'workout' || t.id === 'diet'));
check('9: an explicit 75-Day start records the Future Self Letter (proof of intent)',
  !!p75.activeChallenge?.futureSelfLetter);
check('13: the previous "standard" mode did not carry over', p75.activeChallenge?.variant == null);

// ══ 22: reload preserves the started challenge ═════════════════════════════
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
const p75r = await prof();
check('22: reload after starting a challenge preserves it',
  p75r.activeChallenge?.templateId === '75_day_discipline_challenge' && p75r.challengeStart === TODAY);
check('22: and preserves its task set', p75r.tasks.some(t => t.id === 'workout' || t.id === 'diet'));

// ══ 21: reload while between challenges still shows no active challenge ════
await pressStartNewChallenge();
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
const pBetween = await prof();
check('21: reload between challenges keeps the no-active-challenge state',
  pBetween.activeChallenge?.templateId === 'forge_daily');
check('21: reload does not resurrect 75-Day Discipline',
  pBetween.activeChallenge?.templateId !== '75_day_discipline_challenge');
await gotoTab('Home');
check('21: home still reads No Active Challenge after reload',
  /No Active Challenge/i.test(await page.textContent('.dashboard')));

// ══ 20: a future start stays scheduled — no Day 1, no missed tasks ═════════
await seedMentalTraining();
await pressStartNewChallenge();
await gotoTab('Challenges');
await page.waitForTimeout(400);
{
  const card = page.locator('.challenge-card', { hasText: 'Mental Training Phase' });
  await card.locator('.challenge-card-header').click();
  await page.waitForTimeout(400);
  await card.locator('button', { hasText: /^Standard/ }).first().click();
  await page.waitForTimeout(300);
  await card.locator('button', { hasText: /Start Mental Training Phase/ }).first().click();
  await page.waitForTimeout(600);
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('Because I want to keep going.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Start Tomorrow' }).first().click();
  await page.waitForTimeout(700);
}
const pSched = await prof();
check('20: a future start is stored as scheduled, not started',
  pSched.challengeStart === offset(1) && pSched.activeChallenge?.templateId === 'mental_training_phase');
check('20: a scheduled attempt is NOT Day 1 yet', Object.keys(await days()).length === 0);
await gotoTab('Home');
const schedText = await page.textContent('.dashboard');
check('20: the pre-start card is shown instead of a challenge day',
  /Challenge Starts/i.test(schedText), schedText.slice(0, 90));
check('20: a scheduled attempt accumulates no missed tasks', Object.keys(await days()).length === 0);

// ══ 23: profile isolation ═════════════════════════════════════════════════
await seedMentalTraining();
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.challengeStart = '2026-08-01';
  p.girlfriend.activeChallenge = { templateId: 'fat_loss_phase', name: 'Fat Loss Phase', emoji: '⚡', variant: 'standard', durationDays: 30 };
  p.girlfriend.tasks = [{ id: 'gf_fat_1', name: 'Hit protein target', source: 'template', order: 0, challenges: ['primary'] }];
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(300);
const gfBefore = await prof('girlfriend');
await pressStartNewChallenge();
const gfAfter = await prof('girlfriend');
check('23: archiving on Male leaves the Female challenge untouched',
  gfAfter.activeChallenge?.templateId === 'fat_loss_phase' && gfAfter.challengeStart === gfBefore.challengeStart);
check('23: and leaves the Female task list untouched',
  JSON.stringify(gfAfter.tasks) === JSON.stringify(gfBefore.tasks));
check('23: the Female profile gained no archive entry', (await arch('girlfriend')).length === 0);
await startFromLibrary('Fat Loss Challenge');
const gfAfterStart = await prof('girlfriend');
check('23: starting a challenge on Male does not alter the Female profile',
  JSON.stringify(gfAfterStart.activeChallenge) === JSON.stringify(gfBefore.activeChallenge));

// ══ 24: no code path where a missing challenge becomes 75-Day ══════════════
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = null; p.me.activeChallenge = null; p.me.tasks = [];
  localStorage.setItem('profiles', JSON.stringify(p));
  const all = JSON.parse(localStorage.getItem('allDays') || '{}'); all.me = {};
  localStorage.setItem('allDays', JSON.stringify(all));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
const pNull = await prof();
check('24: a null activeChallenge stays null — it is not backfilled with 75-Day',
  pNull.activeChallenge == null, JSON.stringify(pNull.activeChallenge));
check('24: and no start date is invented', pNull.challengeStart == null);
const nullHome = await page.textContent('.dashboard');
check('24: the UI renders the no-challenge state, not a 75-Day challenge',
  /No Active Challenge/i.test(nullHome) && !/75-Day Discipline/i.test(nullHome));

// ══ 25/26: existing archives are never modified ════════════════════════════
await seedMentalTraining();
await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('archives') || '{}');
  a.me = [{
    id: 'arch_fixed_1', archivedAt: '2026-01-10', challengeStart: '2025-12-01', endDate: '2026-01-09',
    challenge: { templateId: 'sleep_reset_challenge', name: 'Sleep Reset', durationDays: 21, variant: 'standard' },
    days: { 1: { date: '2025-12-01', dayNumber: 1, tasks: {} } }, tasks: [{ id: 'sl_1', name: 'Sleep' }],
    xpEarned: 777, finalScore: 88, completed: true, passed: true,
  }];
  localStorage.setItem('archives', JSON.stringify(a));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(300);
const archBefore = JSON.stringify((await arch()).find(a => a.id === 'arch_fixed_1'));
await pressStartNewChallenge();
await startFromLibrary('Fat Loss Challenge');
const archAfter = JSON.stringify((await arch()).find(a => a.id === 'arch_fixed_1'));
check('25: a pre-existing archive is byte-identical after a full transition',
  archBefore === archAfter && archBefore !== undefined);
check('25: its XP contribution is intact',
  (await arch()).find(a => a.id === 'arch_fixed_1')?.xpEarned === 777);
check('1: the transition added exactly one new archive for the finished attempt',
  (await arch()).filter(a => a.challenge?.templateId === 'mental_training_phase').length === 1);

// ══ REGRESSION: the reported corrupted profile heals on load ══════════════
// Exactly the state from the report: 75-Day metadata ("Day 1 of 75") sitting on
// the previous challenge's Mental Training tasks, nothing logged under it, and
// a legitimately archived Mental Training attempt beside it.
await page.evaluate((mtTasks) => {
  localStorage.clear();
  localStorage.setItem('activeProfile', JSON.stringify('me'));
}, MT_TASKS);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 });
await page.evaluate(({ mtTasks, today }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 9;
  p.me.challengeStart = today;
  // The auto-created attempt: the bare default descriptor, no Future Self Letter.
  p.me.activeChallenge = {
    templateId: '75_day_discipline_challenge', name: '75-Day Discipline Challenge',
    emoji: '🔥', variant: null, durationDays: 75,
    passingScore: 80, keystoneRequirement: 70, completionBonusXP: 2500,
  };
  p.me.tasks = mtTasks;
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'arch_mt_real', archivedAt: '2026-09-08', challengeStart: '2026-08-26', endDate: '2026-09-08',
    challenge: { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard', durationDays: 14 },
    days: { 1: { date: '2026-08-26', dayNumber: 1, tasks: { mt_meditate: true } } },
    tasks: mtTasks, xpEarned: 1450, finalScore: 91, completed: true, passed: true,
  }], girlfriend: [] }));
}, { mtTasks: MT_TASKS, today: TODAY });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(500);

const healed = await prof();
check('regression: the accidental 75-Day attempt is cleared on load',
  healed.activeChallenge == null, JSON.stringify(healed.activeChallenge));
check('regression: no "Day 1 of 75" remains', healed.challengeStart == null);
check('regression: the leaked Mental Training tasks are gone',
  !healed.tasks.some(t => t.id.startsWith('mt_')));
check('regression: the archived Mental Training challenge is untouched',
  (await arch()).find(a => a.id === 'arch_mt_real')?.xpEarned === 1450);
check('regression: its days and score survive',
  (await arch()).find(a => a.id === 'arch_mt_real')?.finalScore === 91);
check('regression: the accidental attempt was NOT archived as a completed challenge',
  (await arch()).every(a => a.challenge?.templateId !== '75_day_discipline_challenge'),
  JSON.stringify((await arch()).map(a => a.challenge?.templateId)));
check('regression: the permanent rank floor is untouched', healed.highestRank === 9);
const healedHome = await page.textContent('.dashboard');
check('regression: home shows the no-challenge state, not 75-Day',
  /No Active Challenge/i.test(healedHome) && !/Day 1 of 75/i.test(healedHome));
check('regression: the user can start whatever they actually want from the library',
  (await page.locator('button', { hasText: 'Start New Challenge' }).count()) > 0);

// ══ 26: no runtime errors across the whole lifecycle ═══════════════════════
check('26: no page errors across the full lifecycle', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
