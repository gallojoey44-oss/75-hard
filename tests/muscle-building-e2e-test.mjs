/**
 * Muscle Building end-to-end: the real setup flow, the daily list, weekly
 * training and volume, XP hierarchy in the running app, the challenge panel,
 * stacking as a Primary/Support pair, and no damage to existing challenges.
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
const challengeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});

async function init() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8; p.me.xpPenalties = false;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
}

/** Walk the real Muscle Building setup flow. `tweak` runs inside the modal. */
async function startMuscleBuilding(tweak = null) {
  await gotoTab('Challenges');
  await page.waitForTimeout(300);
  const card = page.locator('.challenge-card', { hasText: 'Muscle Building' });
  await card.locator('.challenge-card-header').click();
  await page.waitForTimeout(300);
  await card.locator('button', { hasText: 'Start Muscle Building' }).click();
  await page.waitForSelector('.mb-setup', { timeout: 5000 });
  if (tweak) await tweak();
  await page.locator('.mb-setup button', { hasText: 'Continue' }).click();
  await page.waitForSelector('.letter-modal, textarea', { timeout: 5000 });
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('To become someone who trains with purpose.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForSelector('.start-when-options', { timeout: 5000 });
  await page.locator('.start-when-btn', { hasText: 'Start Today' }).click();
  await page.waitForSelector('.daily-view', { timeout: 5000 });
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });

// ══ 16/17: the challenge exists with its own identity and setup screen ══════
await init();
await gotoTab('Challenges');
const card = page.locator('.challenge-card', { hasText: 'Muscle Building' });
check('17: Muscle Building appears in the challenge library', (await card.count()) === 1);
await card.locator('.challenge-card-header').click();
await page.waitForTimeout(300);
const cardText = await card.textContent();
check('17: it states the hypertrophy goal, not a generic strength goal',
  /muscle growth/i.test(cardText) && !/^.*maximal strength/i.test(cardText));
check('1: the card advertises 30, 60 or 90 days', /30, 60, or 90 days/.test(cardText), cardText.slice(0, 90));

await card.locator('button', { hasText: 'Start Muscle Building' }).click();
await page.waitForSelector('.mb-setup', { timeout: 5000 });
const setupText = await page.textContent('.mb-setup');
check('16: setup shows the title and subtitle',
  /Muscle Building/.test(setupText) && /Build More Muscle\. Train With Purpose\./.test(setupText));
check('2: the four pillars are shown',
  ['Training Stimulus', 'Nutrition', 'Recovery', 'Optimization'].every(p => setupText.includes(p)));
check('16: setup asks for duration 30 / 60 / 90', ['30 days', '60 days', '90 days'].every(d => setupText.includes(d)));
check('1: 60 days is pre-selected and marked Recommended',
  (await page.locator('.mb-chip.active', { hasText: '60 days' }).count()) === 1 && /Recommended/.test(setupText));
check('4: setup asks how many resistance-training days per week',
  /How many resistance-training days per week\?/.test(setupText));
check('4: it offers 3 / 4 / 5 / 6',
  ['3 days', '4 days', '5 days', '6 days'].every(x => setupText.includes(x)));
check('16: protein can be suggested or custom', /Protein target/.test(setupText) && /Set a custom target/.test(setupText));
check('3A: the muscle-building protein range is shown', /0\.7–1 g per lb|0\.7–1\.0 g per lb/.test(setupText.replace(/\s+/g, ' ')));
check('16: nutrition target offers lean bulk / recomp / maximum',
  ['Lean Bulk', 'Recomp', 'Maximum Gain'].every(x => setupText.includes(x)));
check('16: a calorie target is optional and customisable', /Daily calorie target \(optional\)/.test(setupText));
check('16: a sleep target is offered', /Sleep target/.test(setupText));
check('16: weekly set targets default to suggested values but can be customised',
  /Weekly muscle-group set targets/.test(setupText) && /using suggested defaults/.test(setupText));
check('16: both optional optimizations are offered, unchecked',
  /Creatine/.test(setupText) && /Protein Distribution/.test(setupText) &&
  (await page.locator('.mb-check input:checked').count()) === 0);
check('16: physique tracking is offered and optional', /Physique tracking/.test(setupText));
check('6: the RIR guidance is educational and does not demand failure',
  /0–3 reps in reserve/.test(setupText) && /do not need to take every set to absolute failure/i.test(setupText));

// Expand the advanced sections.
await page.locator('.mb-disclosure', { hasText: 'Weekly muscle-group set targets' }).click();
await page.waitForTimeout(200);
const volText = await page.textContent('.mb-volume-grid');
check('5: all ten muscle groups are listed with editable targets',
  ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Calves', 'Abs']
    .every(m => volText.includes(m)));
check('5: ~10 sets is framed as a starting reference, not a rule',
  /useful starting\s+reference, not a universal rule/.test(await page.textContent('.mb-setup')));
check('5: targets are editable inputs', (await page.locator('.mb-volume-input').count()) === 10);
await page.keyboard.press('Escape');

// ══ Start it for real, with 5 training days and both optimizations on ═══════
await init();
await startMuscleBuilding(async () => {
  await page.locator('.mb-chip', { hasText: '5 days' }).click();
  await page.locator('.mb-check', { hasText: 'Creatine' }).locator('input').check();
  await page.locator('.mb-check', { hasText: 'Protein Distribution' }).locator('input').check();
});
let p = await prof();
check('16: the attempt is created with the chosen configuration',
  p.activeChallenge.templateId === 'muscle_building_phase' && p.challengeStart === TODAY);
check('1: the default 60-day duration is stored', p.activeChallenge.durationDays === 60);
check('4: 5 training days becomes a weekly requirement of 5',
  p.activeChallenge.weeklyRequirementDefs[0].perWeek === 5 &&
  p.activeChallenge.weeklyRequirementDefs[0].id === 'hypertrophy_training');
check('20: the attempt carries its own Muscle Building config block',
  !!p.activeChallenge.muscleBuilding && p.activeChallenge.muscleBuilding.trainingDaysPerWeek === 5);
check('5: weekly set targets are stored on the attempt',
  p.activeChallenge.muscleBuilding.volumeTargets.chest === 10 && p.activeChallenge.muscleBuilding.volumeTargets.abs === 6);

// ══ 3: the daily list ═══════════════════════════════════════════════════════
const taskNames = p.tasks.map(t => t.name);
check('3: the daily list is short — 4 fundamentals + 2 optimizations + daily log',
  p.tasks.length === 7, `${p.tasks.length}: ${taskNames.join(' | ')}`);
check('3A: protein target is present', taskNames.some(n => /protein target/i.test(n)));
check('3B: "Hit Nutrition Target" is present', taskNames.includes('Hit Nutrition Target'));
check('3C: a sleep target is present', taskNames.some(n => /Sleep 8\+ hours/.test(n)));
check('3D: "Daily Recovery Practice" is present', taskNames.includes('Daily Recovery Practice'));
check('4: training is NOT a daily checkbox', !taskNames.some(n => /train|workout/i.test(n)));
check('10: no hydration / steps / stretching / sauna / cold / cardio clutter',
  !/water|hydrat|steps|stretch|sauna|cold|cardio/i.test(taskNames.join(' ')));
check('3A: protein is the keystone habit',
  p.tasks.filter(t => t.keystoneHabit).map(t => t.id).join() === 'mb_protein');
check('11/15: canonical habitKeys are attached', (() => {
  const keys = Object.fromEntries(p.tasks.map(t => [t.id, t.habitKey]));
  return keys.mb_protein === 'protein_target' && keys.mb_nutrition === 'calorie_target'
    && keys.mb_sleep === 'sleep_target' && keys.mb_recovery === 'stress_recovery'
    && keys.mb_creatine === 'creatine' && keys.mb_protein_distribution === 'protein_distribution';
})());
check('14: the XP ladder holds in the running app', (() => {
  const xp = Object.fromEntries(p.tasks.map(t => [t.id, t.xp]));
  return xp.mb_protein === 40 && xp.mb_nutrition === 30 && xp.mb_sleep === 25
    && xp.mb_recovery === 15 && xp.mb_protein_distribution < xp.daily_log && xp.mb_creatine < xp.daily_log;
})());
check('9: creatine is labelled optional with 3–5 g and no loading phase',
  /3–5 g/.test(p.tasks.find(t => t.id === 'mb_creatine').desc) &&
  /No loading phase/i.test(p.tasks.find(t => t.id === 'mb_creatine').desc));

await gotoTab('Today');
const dailyText = await page.textContent('.daily-view');
check('3: the daily list renders each requirement once',
  (await page.locator('.check-item').count()) === 7);
check('18: the recovery task explains what counts',
  /meditation|breathing|nsdr|prayer/i.test(dailyText));

// ══ 17: the challenge panel ═════════════════════════════════════════════════
check('17: the Muscle Building panel is shown', (await page.locator('.mb-panel').count()) === 1);
const panel = await page.textContent('.mb-panel');
check('17: it carries the challenge identity', /Muscle Building/.test(panel) && /Build More Muscle/.test(panel));
check('17: weekly training completion is shown', /Training this week/.test(panel) && /0 \/ 5/.test(panel));
check('17: weekly muscle-group volume is shown', /Weekly volume/.test(panel));
check('17: a bodyweight trend section is shown', /Bodyweight trend/.test(panel));
check('17: a performance section is shown', /Performance/.test(panel));
check('17: optimization adherence is reported separately', /Optimization/.test(panel) && /0 \/ 2 logged today/.test(panel));
check('18: the "why this helps" copy for training is shown',
  /stimulus that tells muscle tissue to adapt and grow/.test(panel));

// ══ 5: weekly volume tracking ═══════════════════════════════════════════════
await page.locator('.mb-block-toggle', { hasText: 'Weekly volume' }).click();
await page.waitForTimeout(250);
const volPanel = await page.textContent('.mb-volume-list');
check('5: every muscle group shows "done / target sets"',
  /Chest[\s\S]*?0 \/ 10 sets/.test(volPanel) && /Abs[\s\S]*?0 \/ 6 sets/.test(volPanel));
const xpBeforeSets = await (async () => { await gotoTab('Home'); const v = await challengeXP(); await gotoTab('Today'); return v; })();
await page.locator('.mb-block-toggle', { hasText: 'Weekly volume' }).click();
await page.waitForTimeout(250);
const chestRow = page.locator('.mb-vol-row', { hasText: 'Chest' });
for (let i = 0; i < 8; i++) { await chestRow.locator('.mb-vol-add').click(); await page.waitForTimeout(90); }
await page.waitForTimeout(300);
check('5: logging 8 chest sets reads "Chest: 8 / 10 sets"',
  /8 \/ 10 sets/.test(await chestRow.textContent()), await chestRow.textContent());
const backRow = page.locator('.mb-vol-row', { hasText: 'Back' });
for (let i = 0; i < 10; i++) { await backRow.locator('.mb-vol-add').click(); await page.waitForTimeout(90); }
await page.waitForTimeout(300);
check('5: a met target is marked as met', (await backRow.getAttribute('class')).includes('met'));
p = await prof();
check('5: each set is stored as an individually removable entry',
  p.volumeSets.length === 18 && new Set(p.volumeSets.map(v => v.id)).size === 18);
await gotoTab('Home');
check('5: logging 18 hard sets awarded ZERO XP — volume is a metric, not a currency',
  (await challengeXP()) === xpBeforeSets, `${xpBeforeSets} → ${await challengeXP()}`);
await gotoTab('Today');
// Navigating away remounts the view, so re-open the volume block to read it.
await page.locator('.mb-block-toggle', { hasText: 'Weekly volume' }).click();
await page.waitForTimeout(250);
check('5: the panel says volume awards no XP', /awards no XP/.test(await page.textContent('.mb-panel')));
check('5: the logged sets survived the round trip',
  /8 \/ 10 sets/.test(await page.locator('.mb-vol-row', { hasText: 'Chest' }).textContent()));

// ══ 5: XP is only paid for the daily tasks ══════════════════════════════════
await gotoTab('Home'); const xp0 = await challengeXP();
await gotoTab('Today');
await page.locator('.check-item', { hasText: /protein target/i }).click();
await page.waitForTimeout(400);
await gotoTab('Home');
check('14: completing the protein keystone awards its 40 XP', (await challengeXP()) - xp0 === 40, `+${(await challengeXP()) - xp0}`);
await gotoTab('Today');
await page.locator('.check-item', { hasText: 'Take Creatine' }).click();
await page.waitForTimeout(400);
await gotoTab('Home');
check('14: creatine awards far less than the keystone', (await challengeXP()) - xp0 === 46, `+${(await challengeXP()) - xp0}`);

// ══ 7: progressive overload logging ═════════════════════════════════════════
await gotoTab('Today');
await page.locator('.mb-block-toggle', { hasText: 'Performance' }).click();
await page.waitForTimeout(250);
check('7: an exercise log form is available',
  (await page.locator('.mb-exercise-form').count()) === 1);
check('6: RIR is offered as an optional field, never scored',
  (await page.locator('.mb-exercise-form input[placeholder="RIR"]').count()) === 1 &&
  /RIR is optional and never scored/.test(await page.textContent('.mb-exercise-form')));
await page.locator('.mb-exercise-form input[placeholder*="Exercise"]').fill('Incline Dumbbell Press');
await page.locator('.mb-exercise-form input[placeholder="load"]').fill('70');
await page.locator('.mb-exercise-form input[placeholder="reps"]').fill('10');
await page.locator('.mb-exercise-form input[placeholder="sets"]').fill('3');
await page.locator('.mb-exercise-form button', { hasText: 'Log Exercise' }).click();
await page.waitForTimeout(400);
p = await prof();
check('7: the entry records exercise, load, reps and sets', (() => {
  const e = p.exerciseLog[0];
  return e && e.exercise === 'Incline Dumbbell Press' && e.load === 70 && e.reps === 10 && e.sets === 3;
})());
check('7: RIR is absent when not supplied', p.exerciseLog[0].rir === undefined);
check('7: logging a lift awards no XP either',
  (await (async () => { await gotoTab('Home'); const v = await challengeXP(); await gotoTab('Today'); return v; })()) === xp0 + 46);
// Enough history for a verdict, showing progression via more reps at one load.
await page.evaluate((dates) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.exerciseLog = dates.map((date, i) => ({
    id: `seed_${i}`, date, exercise: 'Incline Dumbbell Press', load: 70, reps: 8 + i, sets: 3,
  }));
  localStorage.setItem('profiles', JSON.stringify(p));
}, [offset(-12), offset(-9), offset(-5), offset(-1)]);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForTimeout(400);
check('7: a progressing lift is surfaced as an insight',
  /Your incline dumbbell press is progressing\./.test(await page.textContent('.mb-panel')));

// ══ 11/12: bodyweight trend and physique check-ins ══════════════════════════
check('12: opted-in measurements appear in the daily log',
  /Progress Tracking/.test(await page.textContent('.daily-view')));
const metricLabels = await page.locator('.body-metric-label').allTextContents();
check('12: weight, waist and arms are offered by default; chest/thighs are not',
  metricLabels.some(l => /Weight/.test(l)) && metricLabels.some(l => /Arms/.test(l)) &&
  !metricLabels.some(l => /Chest/.test(l)), metricLabels.join(' | '));
// Seed a run of weigh-ins that gains much faster than the lean-bulk target.
await page.evaluate(({ start }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = start;
  localStorage.setItem('profiles', JSON.stringify(p));
  const dd = {};
  const w = [200, 201, 202, 203, 204, 206, 208];
  [1, 4, 8, 11, 15, 18, 22].forEach((day, i) => {
    dd[day] = { dayNumber: day, weight: w[i], tasks: {}, isMWD: false, mwdTasks: {}, bonusDone: {} };
  });
  localStorage.setItem('allDays', JSON.stringify({ me: dd, girlfriend: {} }));
}, { start: offset(-24) });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForTimeout(400);
const panel2 = await page.textContent('.mb-panel');
check('11: a weekly bodyweight rate is shown against the configured range',
  /% \/ week/.test(panel2) && /target 0\.1–0\.3%/.test(panel2), panel2.match(/[-+\d.]+% \/ week/)?.[0]);
check('11: gaining much faster than target produces the coaching insight',
  /increasing faster than your selected muscle-gain target/.test(panel2) &&
  /Consider slightly reducing calorie intake/.test(panel2));
check('11: Forge does not change the target itself',
  /never changes your targets for you/.test(panel2));
check('11: the stored calorie/nutrition config was NOT modified', (await prof()).activeChallenge.muscleBuilding.calorieTarget === null);

// ══ 15: Primary + Support with shared-habit deduplication ═══════════════════
await init();
await startMuscleBuilding();
await gotoTab('Challenges');
await page.locator('.acc-add-support').click();
await page.waitForTimeout(400);
const pickerText = await page.textContent('.sup-picker');
check('15: Mental Training is offered as Highly Compatible with Muscle Building', await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🟢/.test(x.querySelector('.sup-group-title').textContent));
  return !!g && /Mental Training/.test(g.textContent);
}));
check('15: Fat Loss is shown as Conflicting with Muscle Building', await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🔴/.test(x.querySelector('.sup-group-title')?.textContent || ''));
  return !!g && /Fat Loss/.test(g.textContent);
}), pickerText.slice(0, 60));
// Conflicting must be blocked with an explanation.
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🔴/.test(x.querySelector('.sup-group-title')?.textContent || ''));
  const opt = [...g.querySelectorAll('.sup-option')].find(o => /Fat Loss/.test(o.textContent));
  opt.click();
});
await page.waitForTimeout(400);
check('15: picking Fat Loss is blocked, not confirmed', (await page.locator('.sup-conflict').count()) === 1);
check('15: it explains the opposite energy balances',
  /opposite energy balances/.test(await page.textContent('.sup-conflict')));
await page.locator('.sup-conflict button', { hasText: /^Keep / }).click();
await page.waitForTimeout(300);
// Now stack Mental Training and check dedup.
await page.locator('.sup-option', { hasText: 'Mental Training Phase' }).click();
await page.waitForTimeout(400);
const merge = await page.textContent('.sup-merge');
check('15: the merge preview reports the shared habit(s)', /shared habit/i.test(merge), merge.replace(/\s+/g, ' ').slice(0, 120));
await page.locator('.sup-confirm button', { hasText: 'Add Support Challenge' }).click();
await page.waitForTimeout(600);
p = await prof();
check('15: the daily log is a single shared row', p.tasks.filter(t => t.id === 'daily_log').length === 1);
check('15: no habitKey appears twice in the merged list', (() => {
  const keys = p.tasks.map(t => t.habitKey || t.id);
  return new Set(keys).size === keys.length;
})());
check('15: Muscle Building stays the PRIMARY', p.activeChallenge.templateId === 'muscle_building_phase');
check('15: protein is still Muscle Building\'s keystone after stacking',
  p.tasks.filter(t => t.keystoneHabit).map(t => t.id).join() === 'mb_protein');
await gotoTab('Home');
check('15: the two-lane dashboard shows Muscle Building as PRIMARY',
  /PRIMARY[\s\S]*?Muscle Building/.test(await page.textContent('.stack-card')));

// ══ 19: existing Forge behaviour is unaffected ══════════════════════════════
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 8; p.me.challengeStart = start; p.me.xpPenalties = false;
  p.me.activeChallenge = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard', durationDays: 30, templateVersion: 3, passingScore: 70, keystoneRequirement: 65, weeklyRequirementsStartDate: start };
  p.me.tasks = [
    { id: 'fl_protein', name: 'Hit protein goal', xp: 40, keystone: 3, keystoneHabit: true, source: 'template', order: 0 },
    { id: 'daily_log', name: 'Complete Daily Log', xp: 10, keystone: 1, source: 'template', order: 1 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const dd = {}; for (let i = 1; i <= 5; i++) dd[i] = { dayNumber: i, tasks: { fl_protein: true }, mood: 6, isMWD: false, mwdTasks: {}, bonusDone: {} };
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
check('19: an existing Fat Loss attempt is untouched',
  p.activeChallenge.templateId === 'fat_loss_phase' && p.challengeStart === offset(-4) && p.tasks.length === 2);
check('19: Fat Loss keeps its own weekly requirements (lifting + Zone 2)',
  p.activeChallenge.weeklyRequirementDefs === undefined);
check('19: the new per-attempt arrays are added empty and additively',
  Array.isArray(p.volumeSets) && p.volumeSets.length === 0 && Array.isArray(p.exerciseLog) && p.exerciseLog.length === 0);
check('19: no Muscle Building panel appears on a Fat Loss attempt',
  (await page.locator('.mb-panel').count()) === 0);
check('19: existing archives are untouched', await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('archives')).me[0];
  return a.finalScore === 84 && a.xpEarned === 1200 && a.badges[0] === 'iron_will';
}));
await gotoTab('Today');
check('19: Fat Loss still shows its own weekly requirements card', (await page.locator('.wr-card').count()) === 1);
check('19: Fat Loss daily tasks still render', (await page.locator('.check-item').count()) === 2);
const migSnap = await page.evaluate(() => localStorage.getItem('profiles'));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
check('19: the migration is idempotent', (await page.evaluate(() => localStorage.getItem('profiles'))) === migSnap);

check('19: no page errors across the whole flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
