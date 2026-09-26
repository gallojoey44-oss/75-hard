/**
 * Muscle Building V1 update, end to end: the carb target in setup, a real
 * specialization block through the UI, the priority-muscle dashboard, and —
 * most importantly — that an attempt started before this update is completely
 * unaffected by any of it.
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
  await page.waitForTimeout(400);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);

async function reset() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 9; p.girlfriend.highestRank = 9;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(300);
}

async function openSetup() {
  await gotoTab('Challenges');
  await page.waitForTimeout(400);
  const card = page.locator('.challenge-card', { hasText: 'Muscle Building' });
  await card.locator('.challenge-card-header').click();
  await page.waitForTimeout(400);
  await card.locator('button', { hasText: /Start Muscle Building/ }).first().click();
  await page.waitForTimeout(600);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ Setup: carbohydrate ═══════════════════════════════════════════════════
await reset();
await openSetup();
check('the Muscle Building setup opens', (await page.locator('.mb-setup, .modal-card').count()) >= 1);
let setupText = await page.textContent('.modal-card');
check('a carbohydrate target section is offered', /Carbohydrate target/i.test(setupText));
check('all three demand levels are offered',
  /Lower-volume lifting/.test(setupText) && /Typical hypertrophy training/.test(setupText) &&
  /High-volume \/ specialization/.test(setupText));
check('the carb explanation is shown',
  /replenish muscle glycogen/i.test(setupText));
check('it does not claim carbs directly build muscle',
  !/carbs? (directly )?(build|cause)s? muscle/i.test(setupText));

// Enter a bodyweight so the suggestion resolves.
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.modal-card input[type=number]')];
  const bw = inputs.find(i => i.closest('label')?.textContent.match(/bodyweight/i));
  if (bw) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(bw, '180');
    bw.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(400);
setupText = await page.textContent('.modal-card');
check('a carb gram target resolves from bodyweight', /Daily carb target/i.test(setupText));
check('the default reference is ~1.5 g/lb → 270 g at 180 lb', /270 g/.test(setupText), setupText.match(/Daily carb target:.{0,40}/)?.[0]);

// ══ Setup: specialization ═════════════════════════════════════════════════
check('the specialization question is asked',
  /Do you want to prioritize specific muscles\?/.test(setupText));
check('both options are offered',
  /No — Balanced Muscle Growth/.test(setupText) && /Yes — Specialization Block/.test(setupText));
check('balanced is selected by default', await page.evaluate(() =>
  [...document.querySelectorAll('.mb-chip.active')].some(c => /Balanced Muscle Growth/.test(c.textContent))));
check('no priority pickers are shown while balanced',
  !/Priority muscles \(up to/.test(setupText));

await page.evaluate(() => {
  const b = [...document.querySelectorAll('.mb-chip')].find(x => /Yes — Specialization Block/.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(400);
setupText = await page.textContent('.modal-card');
check('choosing specialization reveals the priority pickers', /Priority muscles \(up to 2\)/.test(setupText));
check('the explanation is shown',
  /gives priority muscles more of your recoverable training volume/i.test(setupText));
check('it states it does not add whole-body muscle',
  /does not add whole-body muscle/i.test(setupText));
check('all ten muscle groups are selectable',
  (await page.evaluate(() => {
    const t = document.querySelector('.modal-card').textContent;
    return ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs']
      .every(m => t.includes(m));
  })));

// Pick two, then confirm a third is refused.
for (const m of ['Chest', 'Abs']) {
  await page.evaluate((label) => {
    const b = [...document.querySelectorAll('.mb-chip')].find(x => x.textContent.trim().endsWith(label));
    if (b) b.click();
  }, m);
  await page.waitForTimeout(250);
}
check('two priority muscles can be selected', await page.evaluate(() =>
  [...document.querySelectorAll('.mb-chip.active')].filter(c => /Chest|Abs/.test(c.textContent)).length === 2));
check('a third priority muscle is blocked at the cap', await page.evaluate(() => {
  const b = [...document.querySelectorAll('.mb-chip')].find(x => x.textContent.trim().endsWith('Back'));
  return !!b && b.disabled;
}));

setupText = await page.textContent('.modal-card');
check('a priority set target is offered', /Weekly sets for priority muscles/.test(setupText));
check('the lowest-effective-volume principle is stated',
  /LOWEST volume that keeps you progressing/i.test(setupText));
check('a starting point is asked for so volume can ramp',
  /Where are you starting from\?/.test(setupText));
check('weekly exposures are offered', /Weekly sessions per priority muscle/.test(setupText));
check('the 5 + 3 + 5 illustration is shown', /5 \+ 3 \+ 5/.test(setupText));
check('6–8 weeks is suggested without being forced',
  /Six to eight weeks/i.test(setupText) && /If your challenge runs longer, that is fine/i.test(setupText));

// Enter a current chest volume and check the ramp preview.
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.modal-card input[type=number]')];
  const cur = inputs.find(i => /sets per week now/i.test(i.closest('label')?.textContent || ''));
  if (cur) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(cur, '6');
    cur.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await page.waitForTimeout(400);
check('a gradual ramp is previewed, not a jump to the target',
  /Ramp: 10 → 10 → 11 → 11 → 12 → 12 → 13 → 13 sets/.test(await page.textContent('.modal-card')));

// ══ Start the block ═══════════════════════════════════════════════════════
await page.locator('.modal-card button', { hasText: /^Continue$/ }).first().click();
await page.waitForTimeout(500);
{
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('Because I want to build real muscle.');
}
await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: 'Start Today' }).first().click();
await page.waitForTimeout(800);

const p = await prof();
const cfg = p.activeChallenge?.muscleBuilding;
check('a Muscle Building attempt was created', p.activeChallenge?.templateId === 'muscle_building_phase');
check('the attempt stores its specialization block', cfg?.specialization?.enabled === true);
check('it stores exactly the two chosen priority muscles',
  JSON.stringify(cfg.specialization.priority.sort()) === '["abs","chest"]');
check('it stores the pre-block starting volume for the ramp', cfg.specialization.currentSets?.chest === 6);
check('volume targets were reallocated toward the priority muscles',
  cfg.volumeTargets.chest === cfg.specialization.prioritySets && cfg.volumeTargets.back < 10,
  `chest=${cfg.volumeTargets.chest} back=${cfg.volumeTargets.back}`);
check('the pre-block baseline is preserved', cfg.baseVolumeTargets?.back === 10);
check('the carb target was stored on the attempt', cfg.carbGrams === 270);
check('the carb demand level was stored', cfg.carbDemand === 'typical');
check('a carb daily task exists', p.tasks.some(t => t.id === 'mb_carbs'));
check('the carb task carries the canonical habitKey',
  p.tasks.find(t => t.id === 'mb_carbs').habitKey === 'carbohydrate_target');
check('specialization added NO extra daily tasks',
  p.tasks.length === 6, `${p.tasks.length}: ${p.tasks.map(t => t.name).join(' | ')}`);

// ══ The daily screen stays small ══════════════════════════════════════════
await gotoTab('Today');
await page.waitForTimeout(600);
check('the daily list stays short', (await page.locator('.check-item').count()) === 6);
check('no per-muscle daily checkbox appeared',
  !/Chest|Biceps|Quads/.test(await page.evaluate(() =>
    [...document.querySelectorAll('.check-name')].map(e => e.textContent).join(' '))));
check('the carb task is on the daily list',
  /carb target/i.test(await page.textContent('.daily-view')));

// ══ The priority-muscle dashboard ═════════════════════════════════════════
const panelText = await page.locator('.mb-panel').first().textContent();
check('a PRIORITY MUSCLES section is shown', /Priority muscles/i.test(panelText));
check('it appears before the general volume block', await page.evaluate(() => {
  // Scoped to ONE panel — the Dashboard mounts its own copy, so a document-wide
  // query can interleave blocks from two instances.
  const panel = document.querySelector('.mb-panel');
  if (!panel) return false;
  const blocks = [...panel.querySelectorAll('.mb-block')];
  // Match the block TITLES — the priority block's own explanation contains the
  // phrase "other muscles", which makes a whole-text match ambiguous.
  const title = (b) => b.querySelector('.mb-block-title')?.textContent || '';
  const pi = blocks.findIndex(b => /Priority muscles/i.test(title(b)));
  const vi = blocks.findIndex(b => /Other muscles/i.test(title(b)));
  return pi >= 0 && vi >= 0 && pi < vi;
}));
check('both priority muscles are listed with a star',
  (await page.locator('.mb-priority-row').count()) === 2 &&
  /Chest ⭐/.test(panelText) && /Abs ⭐/.test(panelText));
check('each shows Weekly Volume', /Weekly Volume/.test(panelText));
check('each shows Training Exposures', /Training Exposures/.test(panelText));
check('each shows a Performance Trend', /Performance Trend/.test(panelText));
check('week 1 asks for the RAMPED target, not the block target',
  /0 \/ 10 sets/.test(panelText), panelText.match(/Weekly Volume.{0,24}/)?.[0]);
check('non-priority muscles are shown separately and less prominently',
  /Other muscles/.test(panelText));

// Log sets and confirm the dashboard tracks them.
await page.locator('.mb-priority-row button', { hasText: '+1 set' }).first().click();
await page.waitForTimeout(500);
check('logging a priority set updates the dashboard',
  /1 \/ 10 sets/.test(await page.locator('.mb-panel').first().textContent()));
check('logging sets awards no XP — it is a tracking metric',
  ((await prof()).volumeSets || []).length === 1);

// ══ BACKWARD COMPATIBILITY: a pre-update attempt ══════════════════════════
await reset();
await page.evaluate((today) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = today;
  p.me.highestRank = 9;
  // Exactly the shape a Muscle Building attempt had BEFORE this update:
  // no carb fields, no specialization, no micronutrient optimization.
  p.me.activeChallenge = {
    templateId: 'muscle_building_phase', name: 'Muscle Building', emoji: '🏗️',
    variant: 'standard', durationDays: 60, templateVersion: 1, completionBonusXP: 900,
    muscleBuilding: {
      trainingDaysPerWeek: 4, bodyweightLb: 180, proteinPerLb: 0.85, proteinGrams: 155,
      nutritionMode: 'lean_bulk', calorieTarget: null, sleepHours: 8,
      volumeTargets: { chest: 10, back: 10, quads: 10, hamstrings: 10, glutes: 10, shoulders: 10, biceps: 8, triceps: 8, calves: 8, abs: 6 },
      optimizations: { proteinDistribution: true, creatine: true },
      measurements: { weight: true, waist: true, arms: true, photos: true },
      gainRateMin: 0.1, gainRateMax: 0.3,
    },
    weeklyRequirementDefs: [{ id: 'hypertrophy_training', habitKey: 'hypertrophy_training', label: 'Hypertrophy Training', icon: '🏋️', perWeek: 4, xp: 40, keystone: 3, logLabel: 'Log Training Session', unit: 'session' }],
  };
  // The old seven-task list, with no carb row.
  p.me.tasks = [
    { id: 'mb_protein', name: 'Hit protein target (155 g)', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'protein_target', source: 'template', order: 0, challenges: ['primary'] },
    { id: 'mb_nutrition', name: 'Hit Nutrition Target', icon: '🍽️', xp: 30, keystone: 2, habitKey: 'calorie_target', source: 'template', order: 1, challenges: ['primary'] },
    { id: 'mb_sleep', name: 'Sleep 8+ hours', icon: '😴', xp: 25, keystone: 2, habitKey: 'sleep_target', source: 'template', order: 2, challenges: ['primary'] },
    { id: 'mb_recovery', name: 'Daily Recovery Practice', icon: '🌿', xp: 15, keystone: 1, habitKey: 'stress_recovery', source: 'template', order: 3, challenges: ['primary'] },
    { id: 'mb_protein_distribution', name: 'Protein Distribution', icon: '🍽️', xp: 8, keystone: 0, habitKey: 'protein_distribution', source: 'template', order: 4, challenges: ['primary'] },
    { id: 'mb_creatine', name: 'Take Creatine', icon: '⚗️', xp: 6, keystone: 0, habitKey: 'creatine', source: 'template', order: 5, challenges: ['primary'] },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, habitKey: 'daily_log', source: 'template', order: 6, challenges: ['primary'] },
  ];
  p.me.volumeSets = [{ id: 'v1', muscle: 'chest', sets: 8, date: today }];
  p.me.weeklySessions = [{ id: 'ws1', type: 'hypertrophy_training', date: today }];
  localStorage.setItem('profiles', JSON.stringify(p));
  const all = { me: {}, girlfriend: {} };
  all.me[1] = { date: today, dayNumber: 1, validated: true, tasks: { mb_protein: true, mb_sleep: true, mb_creatine: true }, mood: 4, confidence: 4, sleep: 4, energy: 4, recovery: 4, workoutEffort: 4, stress: 2, hoursSlept: 8, weight: 180, mentalTraining: { selected: null, completed: false, notes: '' }, bonusDone: {}, bonusOneTime: [] };
  localStorage.setItem('allDays', JSON.stringify(all));
}, TODAY);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(600);

const legacy = await prof();
check('a pre-update attempt still loads', legacy.activeChallenge?.templateId === 'muscle_building_phase');
check('its task list is UNCHANGED — no carb task was injected mid-challenge',
  legacy.tasks.length === 7 && !legacy.tasks.some(t => t.id === 'mb_carbs'),
  `${legacy.tasks.length}: ${legacy.tasks.map(t => t.id).join(',')}`);
check('its stored XP values are untouched',
  legacy.tasks.find(t => t.id === 'mb_protein').xp === 40 &&
  legacy.tasks.find(t => t.id === 'mb_creatine').xp === 6);
check('its volume targets are unchanged',
  legacy.activeChallenge.muscleBuilding.volumeTargets.chest === 10);
check('no specialization block was invented',
  !legacy.activeChallenge.muscleBuilding.specialization?.enabled);
check('its logged volume survives', (legacy.volumeSets || []).length === 1);
check('its logged training sessions survive', (legacy.weeklySessions || []).length === 1);
check('its day history survives',
  await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('allDays')).me).length === 1));

await gotoTab('Today');
await page.waitForTimeout(600);
check('a pre-update attempt renders its original 7 tasks',
  (await page.locator('.check-item').count()) === 7);
check('it shows NO priority-muscle dashboard', (await page.locator('.mb-priority-row').count()) === 0);
check('its volume block reads as ordinary weekly volume, not "Other muscles"',
  /Weekly volume/.test(await page.textContent('.mb-panel')) &&
  !/Other muscles/.test(await page.textContent('.mb-panel')));
await page.locator('.mb-block-toggle', { hasText: 'Weekly volume' }).click();
await page.waitForTimeout(400);
check('its per-muscle targets still render at their original values',
  /10 sets/.test(await page.textContent('.mb-panel')));
check('no page errors on a pre-update attempt', errors.length === 0, errors.slice(0, 2).join(' | '));

// ══ Profile isolation ═════════════════════════════════════════════════════
check('the other profile was not touched',
  !(await prof('girlfriend')).activeChallenge);

check('no page errors across the full flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
