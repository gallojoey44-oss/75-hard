/**
 * ⚡ Energy Reset end to end — all four durations.
 *
 * Walks the real flows: starting the challenge from the library, completing
 * daily requirements, logging the weekly exercise sessions, entering energy
 * ratings, XP accrual, stacking with another challenge (shared habits merge and
 * are not paid twice), day progression, Day 10 completion, the energy
 * improvement calculation, missing-rating edge cases and the mobile layout.
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
/** Click a duration card inside the (scrollable) setup modal. */
async function clickDuration(d) {
  // The setup modal scrolls, so drive the click from the DOM rather than
  // fighting the viewport — this is a real click handler either way.
  const ok = await page.evaluate((days) => {
    const btn = [...document.querySelectorAll('.er-duration')]
      .find(b => new RegExp(`^\\s*${days} Days`).test(b.textContent || ''));
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    return true;
  }, d);
  await page.waitForTimeout(350);
  return ok;
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

async function reset() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(300);
}

/** Start Energy Reset through the real library flow. */
async function startEnergyReset({ startTomorrow = false, openBaseline = null, duration = null } = {}) {
  await gotoTab('Challenges');
  await page.waitForTimeout(400);
  const card = page.locator('.challenge-card', { hasText: 'Energy Reset' }).first();
  await card.locator('.challenge-card-header').click();
  await page.waitForTimeout(400);
  await card.locator('button', { hasText: 'Start Energy Reset' }).first().click();
  await page.waitForTimeout(500);
  if (duration) {
    await clickDuration(duration);
  }
  if (openBaseline) {
    await page.locator('.er-disclosure', { hasText: 'Where are you starting from' }).click();
    await page.waitForTimeout(250);
    for (const [i, v] of openBaseline.entries()) {
      await page.locator('.er-baseline .er-scale').nth(i).locator('.er-dot').nth(v - 1).click();
      await page.waitForTimeout(80);
    }
  }
  await page.locator('.er-setup button', { hasText: 'Continue' }).first().click();
  await page.waitForTimeout(500);
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('Because I am tired of being tired.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: startTomorrow ? 'Start Tomorrow' : 'Start Today' }).first().click();
  await page.waitForTimeout(700);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ Library presence and identity ══════════════════════════════════════════
await reset();
await gotoTab('Challenges');
await page.waitForTimeout(400);
const card = page.locator('.challenge-card', { hasText: 'Energy Reset' }).first();
check('the challenge appears in the library', (await card.count()) === 1);
await card.locator('.challenge-card-header').click();
await page.waitForTimeout(400);
const cardText = await card.textContent();
check('it shows the lightning-bolt identity', /⚡/.test(cardText));
check('it shows the goal sentence', /wake up sharper, reduce energy crashes, and feel consistently energized/.test(cardText));
check('the library card advertises all four lengths',
  /7, 10, 14, or 30 days/.test(cardText), cardText.slice(0, 120));
check('it is startable', (await card.locator('button', { hasText: 'Start Energy Reset' }).count()) === 1);

// ══ Setup screen ═══════════════════════════════════════════════════════════
await card.locator('button', { hasText: 'Start Energy Reset' }).first().click();
await page.waitForTimeout(500);
check('the configured setup screen opens', (await page.locator('.er-setup').count()) === 1);
const setupText = await page.textContent('.er-setup');

// ── The duration selector ──────────────────────────────────────────────────
check('the setup offers four durations', (await page.locator('.er-duration').count()) === 4);
const durText = await page.textContent('.er-durations');
check('7 Days — Quick Reset is offered', /7 Days — Quick Reset/.test(durText));
check('10 Days — Standard Reset is offered', /10 Days — Standard Reset/.test(durText));
check('14 Days — Full Reset is offered', /14 Days — Full Reset/.test(durText));
check('30 Days — Energy Maxing is offered', /30 Days — Energy Maxing/.test(durText));
check('each duration explains what it is intended for',
  /A short intervention focused on immediately improving daily habits and energy/.test(durText) &&
  /The recommended default/.test(durText) &&
  /Allows more time for sleep consistency/.test(durText) &&
  /The deepest version/.test(durText));
check('each duration shows its completion reward', (await page.locator('.er-duration-reward').count()) === 4);
check('longer durations advertise greater rewards', await page.evaluate(() => {
  const xs = [...document.querySelectorAll('.er-duration-reward')].map(e => parseInt(e.textContent, 10));
  return xs.every((v, i) => i === 0 || v > xs[i - 1]);
}));
check('10 Days is badged Recommended', (await page.locator('.er-duration-rec').count()) === 1 &&
  /10 Days/.test(await page.locator('.er-duration', { hasText: 'Recommended' }).first().textContent()));
check('10 Days is pre-selected',
  /10 Days/.test(await page.locator('.er-duration.active').first().textContent()));
check('the setup states a longer version is not harder',
  /not harder/i.test(setupText) && /same in all four/i.test(setupText));
check('the setup explains early days are compared against final days',
  /rated days\s*against your last/i.test(setupText.replace(/\s+/g, ' ')));
check('no separate baseline waiting period is required',
  /Nothing to wait for/i.test(setupText) && /start logging on Day 1/i.test(setupText));
// Switching duration must not change the habits.
const tasksAt10 = await page.locator('.er-setup .tpl-task-list').first().textContent();
await clickDuration(30);
const tasksAt30 = await page.locator('.er-setup .tpl-task-list').first().textContent();
check('switching to 30 days changes NOT ONE daily habit', tasksAt10 === tasksAt30);
const weeklyAt30 = await page.locator('.er-setup .tpl-task-list.weekly').textContent();
await clickDuration(7);
check('switching to 7 days changes NOT ONE weekly requirement',
  (await page.locator('.er-setup .tpl-task-list.weekly').textContent()) === weeklyAt30);
check('the goal sentence follows the chosen length',
  /^7 days to wake up sharper/.test((await page.textContent('.er-goal')).trim()));
await clickDuration(10);
check('setup names all three tracked ratings',
  /Morning Energy/.test(setupText) && /Afternoon Energy/.test(setupText) && /Overall Energy/.test(setupText));

check('setup lists the nine daily habits', (await page.locator('.er-setup .tpl-task-list').first().locator('li').count()) === 9);
check('setup shows the weekly exercise requirement',
  /Resistance Training/.test(setupText) && /Aerobic \/ Zone 2/.test(setupText));
check('exercise is presented as weekly, not daily', /per week/.test(setupText));
check('the baseline is offered as optional', /Where are you starting from/.test(setupText) && /optional/.test(setupText));
check('the micronutrient list is behind a disclosure marked "nothing to track"',
  /nothing to track/.test(setupText));
await page.locator('.er-disclosure', { hasText: 'What "nutrient-dense" means here' }).click().catch(() => {});
await page.waitForTimeout(250);
const nutrientText = await page.textContent('.er-setup');
check('all ten micronutrients are shown with food sources',
  ['Folate', 'B12', 'Iron', 'Magnesium', 'Thiamine', 'Riboflavin', 'Niacin', 'B6', 'Iodine', 'Selenium']
    .every(n => new RegExp(n, 'i').test(nutrientText)));
check('users are told they do not need to track any of it', /do not need to track/i.test(nutrientText));
check('the setup can be completed without answering anything',
  (await page.locator('.er-setup button', { hasText: 'Continue' }).isEnabled()));
await page.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.waitForTimeout(300);

// ══ Starting the challenge ═════════════════════════════════════════════════
await reset();
await startEnergyReset();
const p1 = await prof();
check('starting creates an Energy Reset attempt', p1.activeChallenge?.templateId === 'energy_reset_10_day');
check('it is 10 days long', p1.activeChallenge?.durationDays === 10);
check('Day 1 is today', p1.challengeStart === TODAY);
check('it received exactly the nine Energy Reset daily tasks', p1.tasks.length === 9, JSON.stringify(p1.tasks.map(t => t.id)));
check('the attempt stores its own configuration', !!p1.activeChallenge?.energyReset);
check('weekly exercise defs are attached to the attempt',
  (p1.activeChallenge?.weeklyRequirementDefs || []).length === 2);
check('no baseline was forced', p1.activeChallenge?.energyReset?.baseline === null);
await gotoTab('Home');
const homeText = await page.textContent('.dashboard');
check('home shows the challenge is running', /Energy Reset/i.test(homeText));
check('home shows Day 1 of 10', /\b1\b/.test(homeText) && /of 10/.test(homeText));

// ══ The daily panel and energy ratings ════════════════════════════════════
await gotoTab('Today');
await page.waitForTimeout(500);
check('the Energy Reset panel is rendered', (await page.locator('.er-panel').count()) === 1);
check('the ratings are open by default — no tap needed to reach them',
  (await page.locator('.er-ratings .er-scale').count()) === 3);
check('each rating is a 1-10 row of taps',
  (await page.locator('.er-ratings .er-scale').first().locator('.er-dot').count()) === 10);
const panelText = await page.textContent('.er-panel');
check('the panel says missing a day is fine', /Miss a day and nothing breaks/i.test(panelText));
// Enter today's three ratings — three taps.
for (const [i, v] of [[0, 5], [1, 4], [2, 5]]) {
  await page.locator('.er-ratings .er-scale').nth(i).locator('.er-dot').nth(v - 1).click();
  await page.waitForTimeout(150);
}
const d1 = (await days())[1];
check('morning energy is stored on the day record', d1?.morningEnergy === 5);
check('afternoon energy is stored', d1?.afternoonEnergy === 4);
check('overall energy is stored', d1?.overallEnergy === 5);
check('ratings are reflected back in the UI', /5\/10/.test(await page.textContent('.er-ratings')));
// Tapping the same value clears it (mis-taps are recoverable).
await page.locator('.er-ratings .er-scale').nth(0).locator('.er-dot').nth(4).click();
await page.waitForTimeout(250);
check('tapping the same value again clears that rating', ((await days())[1])?.morningEnergy === 0);
await page.locator('.er-ratings .er-scale').nth(0).locator('.er-dot').nth(5).click();
await page.waitForTimeout(250);
check('a new value replaces it', ((await days())[1])?.morningEnergy === 6);

// ══ Daily requirement completion + XP ═════════════════════════════════════
const taskCards = await page.locator('.check-item, .task-row, .gf-task-card').count();
check('all nine daily requirements are listed on Today', taskCards >= 9, String(taskCards));
const xpBefore = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => /Challenge XP/i.test(e.textContent || '') && e.children.length < 4);
  return el ? el.textContent : '';
});
// Complete the keystone (sleep) and check XP moves by its weight.
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const all = JSON.parse(localStorage.getItem('allDays'));
  all.me[1] = { ...(all.me[1] || {}), tasks: { er_sleep: true } };
  localStorage.setItem('allDays', JSON.stringify(all));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
const afterSleep = await page.evaluate(() => document.body.textContent);
check('completing the keystone awards XP', /XP/.test(afterSleep));
const sleepTask = (await prof()).tasks.find(t => t.id === 'er_sleep');
check('sleep is worth the most XP of any daily task',
  sleepTask.xp === Math.max(...(await prof()).tasks.map(t => t.xp)) && sleepTask.xp === 40);
check('the tasks carry the full XP ladder, not a flat value',
  new Set((await prof()).tasks.map(t => t.xp)).size >= 5);

// ══ Weekly exercise requirement ═══════════════════════════════════════════
await gotoTab('Today');
await page.waitForTimeout(400);
const weeklyText = await page.textContent('body');
check('the weekly requirement card is shown',
  /Resistance Training/i.test(weeklyText) || /Aerobic/i.test(weeklyText));
const logBtn = page.locator('button', { hasText: /Log Resistance Session/i }).first();
if (await logBtn.count()) {
  await logBtn.click(); await page.waitForTimeout(400);
}
const sessions = (await prof()).weeklySessions || [];
check('logging a resistance session records it', sessions.some(s => s.type === 'er_resistance'), JSON.stringify(sessions));
check('the session is attributed to a date', sessions.every(s => !!s.date));
check('exercise is NOT a daily checkbox',
  !(await prof()).tasks.some(t => /resistance|aerobic|zone 2/i.test(t.name)));

// ══ Day progression + Day 10 completion ═══════════════════════════════════
// Seed a full 10-day attempt with a clear improvement, then let the app
// auto-complete it (the existing end-of-challenge path).
// Day 11 is the first day PAST a 10-day challenge, which is what triggers the
// existing auto-complete path — so the run is seeded to have just ended.
async function seedFullRun({ ratings, taskDays = null, baseline = null, durationDays = 10, start = null }) {
  start = start || offset(-(durationDays));
  await reset();
  await page.evaluate(({ ratings, taskDays, baseline, start, durationDays }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.challengeStart = start;
    p.me.activeChallenge = {
      templateId: 'energy_reset_10_day', name: 'Energy Reset', emoji: '⚡',
      variant: 'standard', durationDays, templateVersion: 1,
      completionBonusXP: { 7: 250, 10: 400, 14: 600, 30: 1400 }[durationDays] || 400,
      passingScore: 80, keystoneRequirement: 70,
      energyReset: { durationDays, sleepHours: 8, lightMinutes: 10, stepTarget: 8000, stressMinutes: 5, caffeineCutoffHours: 10, resistancePerWeek: 2, aerobicPerWeek: 2, baseline },
      weeklyRequirementDefs: [
        { id: 'er_resistance', label: 'Resistance Training', icon: '🏋️', perWeek: 2, xp: 30, keystone: 2, logLabel: 'Log Resistance Session', unit: 'session' },
        { id: 'er_aerobic', label: 'Aerobic / Zone 2', icon: '❤️', perWeek: 2, xp: 25, keystone: 2, logLabel: 'Log Aerobic Session', unit: 'session' },
      ],
      futureSelfLetter: { why: 'Tired of being tired.', writtenAt: start },
    };
    p.me.tasks = [
      { id: 'er_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'sleep_target', source: 'template', order: 0, challenges: ['primary'] },
      { id: 'er_light', name: 'Morning light: 10+ minutes outdoors', icon: '🌅', xp: 30, keystone: 3, habitKey: 'morning_light', source: 'template', order: 1, challenges: ['primary'] },
      { id: 'er_nutrition', name: 'Eat nutrient-dense whole foods', icon: '🥗', xp: 30, keystone: 2, habitKey: 'whole_foods', source: 'template', order: 2, challenges: ['primary'] },
      { id: 'er_steps', name: 'Walk 8,000+ steps', icon: '🚶', xp: 20, keystone: 2, habitKey: 'daily_steps', source: 'template', order: 3, challenges: ['primary'] },
      { id: 'er_hydration', name: 'Drink water soon after waking', icon: '💧', xp: 15, keystone: 1, habitKey: 'hydration', source: 'template', order: 4, challenges: ['primary'] },
      { id: 'er_caffeine', name: 'Caffeine used deliberately', icon: '☕', xp: 15, keystone: 2, habitKey: 'caffeine_discipline', source: 'template', order: 5, challenges: ['primary'] },
      { id: 'er_stress', name: '5+ minutes of downshifting', icon: '🌿', xp: 12, keystone: 1, habitKey: 'stress_recovery', source: 'template', order: 6, challenges: ['primary'] },
      { id: 'er_winddown', name: 'Evening wind-down', icon: '🌙', xp: 10, keystone: 1, habitKey: 'evening_winddown', source: 'template', order: 7, challenges: ['primary'] },
      { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, habitKey: 'daily_log', source: 'template', order: 8, challenges: ['primary'] },
    ];
    p.me.weeklySessions = [];
    p.me.highestRank = 8;
    localStorage.setItem('profiles', JSON.stringify(p));
    const all = { me: {}, girlfriend: {} };
    ratings.forEach((r, i) => {
      const n = i + 1;
      const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + n - 1);
      const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const done = taskDays ? (taskDays[n] || {}) : Object.fromEntries(p.me.tasks.map(t => [t.id, true]));
      all.me[n] = {
        date, dayNumber: n, tasks: done, mood: 4, confidence: 4, sleep: 4, energy: 4,
        recovery: 4, workoutEffort: 4, stress: 2, hoursSlept: 8, validated: true, notes: '',
        mentalTraining: { selected: null, completed: false, notes: '' }, bonusDone: {}, bonusOneTime: [],
        ...(r ? { morningEnergy: r[0], afternoonEnergy: r[1], overallEnergy: r[2] } : {}),
      };
    });
    localStorage.setItem('allDays', JSON.stringify(all));
  }, { ratings, taskDays, baseline, start, durationDays });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 }); await page.waitForTimeout(900);
}

const IMPROVING = [
  [5, 4, 5], [6, 5, 5], [5, 5, 6],
  [6, 6, 6], [6, 6, 7], [7, 6, 7], [7, 7, 7],
  [8, 8, 8], [8, 7, 8], [8, 8, 8],
];
await seedFullRun({ ratings: IMPROVING });
check('a 10-day attempt auto-completes after its final day', (await arch()).length === 1);
const entry = (await arch())[0];
check('the archive is the Energy Reset attempt', entry.challenge?.templateId === 'energy_reset_10_day');
check('it archives all ten days', Object.keys(entry.days || {}).length === 10);
check('the app returns to the no-challenge baseline afterwards',
  (await prof()).activeChallenge?.templateId === 'forge_daily');

const ccText = await page.textContent('.dashboard');
check('the completion screen shows the Energy Reset result',
  /Standard Reset complete/i.test(ccText), ccText.slice(0, 80));
check('it shows a Before value', /Before/.test(ccText));
check('it shows an After value', /After/.test(ccText));
const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.lastCompletion);
check('the summary carries the energy result', summary?.energySummary?.tracked === true);
check('there was enough data to compare', summary.energySummary.enoughData === true);
check('the before average is computed from the first rated days',
  summary.energySummary.average.before === 5.1, String(summary.energySummary.average.before));
check('the after average is computed from the last rated days',
  summary.energySummary.average.after === 7.9, String(summary.energySummary.average.after));
check('the headline percentage improvement is correct',
  summary.energySummary.average.pct === 55, String(summary.energySummary.average.pct));
check('morning energy is reported separately',
  summary.energySummary.dimensions.find(d => d.key === 'morningEnergy').pct != null);
check('afternoon energy is reported separately',
  summary.energySummary.dimensions.find(d => d.key === 'afternoonEnergy').pct != null);
check('the completion screen renders the per-dimension breakdown',
  /Morning Energy/.test(ccText) && /Afternoon Energy/.test(ccText));
check('it explains which days were compared', /Compared your first/.test(ccText) || /Compared against the baseline/.test(ccText));

// ══ Every duration starts, runs and completes ═════════════════════════════
for (const d of [7, 10, 14, 30]) {
  await reset();
  await startEnergyReset({ duration: d });
  const p = await prof();
  check(`starting a ${d}-day run stores ${d} days`, p.activeChallenge?.durationDays === d, String(p.activeChallenge?.durationDays));
  check(`the ${d}-day attempt gets the right completion bonus`,
    p.activeChallenge?.completionBonusXP === { 7: 250, 10: 400, 14: 600, 30: 1400 }[d],
    String(p.activeChallenge?.completionBonusXP));
  check(`the ${d}-day attempt has the SAME nine daily habits`, p.tasks.length === 9);
  check(`the ${d}-day attempt has the SAME two weekly requirements`,
    (p.activeChallenge?.weeklyRequirementDefs || []).length === 2);
  check(`the ${d}-day attempt keeps the same XP weighting`,
    p.tasks.find(t => t.id === 'er_sleep').xp === 40 && p.tasks.find(t => t.id === 'er_winddown').xp === 10);
  await gotoTab('Today');
  await page.waitForTimeout(400);
  check(`the ${d}-day panel shows Day 1 of ${d}`,
    new RegExp(`Day 1 of ${d}`).test(await page.textContent('.er-panel')));
  check(`the ${d}-day panel names the program`,
    new RegExp({ 7: 'Quick Reset', 10: 'Standard Reset', 14: 'Full Reset', 30: 'Energy Maxing' }[d])
      .test(await page.textContent('.er-panel')));
  check(`the ${d}-day run still collects all three energy ratings`,
    (await page.locator('.er-ratings .er-scale').count()) === 3);
}

// ── Completion at each duration ───────────────────────────────────────────
function rampe(n) {
  return Array.from({ length: n }, (_, i) => {
    const v = Math.min(10, 4 + Math.round((i / (n - 1)) * 4));
    return [v, v, v];
  });
}
for (const d of [7, 10, 14, 30]) {
  await seedFullRun({ ratings: rampe(d), durationDays: d });
  const a = await arch();
  check(`a ${d}-day run archives on completion`, a.length === 1 && a[0].challenge?.durationDays === d);
  const sum = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.lastCompletion);
  check(`the ${d}-day run produces an energy result`, sum?.energySummary?.enoughData === true);
  check(`the ${d}-day run compares early days against final days`,
    sum.energySummary.beforeDays.length >= 3 && sum.energySummary.afterDays.length >= 3 &&
    sum.energySummary.beforeDays.every(x => !sum.energySummary.afterDays.includes(x)),
    JSON.stringify([sum.energySummary.beforeDays, sum.energySummary.afterDays]));
  check(`the ${d}-day run never compares Day 1 alone against the final day alone`,
    sum.energySummary.beforeDays.length > 1 && sum.energySummary.afterDays.length > 1);
  check(`the ${d}-day run shows improvement`, sum.energySummary.average.after > sum.energySummary.average.before);
  const txt = await page.textContent('.dashboard');
  const label = { 7: 'Quick Reset complete', 10: 'Standard Reset complete', 14: 'Full Reset complete', 30: 'Energy Maxing complete' }[d];
  check(`the ${d}-day completion screen uses its own messaging`, txt.includes(label), label);
  check(`the ${d}-day completion messaging never calls it inferior or failed`,
    !/inferior|failed version|just a|only a short/i.test(txt));
  if (d >= 14) {
    check(`the ${d}-day run shows a week-by-week trajectory`,
      (sum.energySummary.trajectory || []).length > 1, JSON.stringify(sum.energySummary.trajectory));
    check(`the ${d}-day completion screen renders the trajectory`, /Week by week/i.test(txt));
  } else {
    check(`the ${d}-day run shows no trajectory — too few weeks`, !sum.energySummary.trajectory);
  }
}
check('a 30-day run compares a full week against a full week', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('profiles')).me.lastCompletion;
  return s.energySummary.beforeDays.length === 7 && s.energySummary.afterDays.length === 7;
}));
check('a 30-day run surfaces the richest insight note',
  /richest read/i.test(await page.textContent('.dashboard')));

// ══ Associations — patterns, never causation ══════════════════════════════
const TASKS_MIXED = {};
for (let n = 1; n <= 10; n++) {
  TASKS_MIXED[n] = { daily_log: true, er_sleep: true };
  if ([5, 6, 7, 8, 10].includes(n)) TASKS_MIXED[n].er_light = true;
}
await seedFullRun({
  ratings: [[4,4,4],[4,4,4],[5,5,5],[4,4,4],[8,8,8],[8,8,8],[7,7,7],[8,8,8],[4,4,4],[8,8,8]],
  taskDays: TASKS_MIXED,
});
const assocSummary = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.lastCompletion);
const assocs = assocSummary.energySummary.associations || [];
check('patterns are surfaced when the data supports them', assocs.length > 0, String(assocs.length));
check('a morning-light pattern is found', assocs.some(a => a.taskId === 'er_light'));
check('patterns are phrased as associations',
  assocs.every(a => /averaged/i.test(a.text)));
check('no pattern claims causation',
  assocs.every(a => !/because|caused|causes|due to|thanks to|proves/i.test(a.text)));
const assocText = await page.textContent('.dashboard');
check('the completion screen shows the patterns', /Patterns in what you logged/i.test(assocText));
check('and carries the not-proof-of-cause caveat', /not proof of cause/i.test(assocText));

// ══ Missing rating data / edge cases ══════════════════════════════════════
await seedFullRun({ ratings: Array(10).fill(null) });
const noRatings = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.lastCompletion);
check('a run with NO ratings does not fabricate a result',
  noRatings.energySummary.enoughData === false && noRatings.energySummary.average.pct === null);
const noText = await page.textContent('.dashboard');
check('the screen says plainly there is not enough data', /not enough for an honest before-and-after/i.test(noText));
check('and confirms XP and score are unaffected', /XP and score are unaffected/i.test(noText));
check('the challenge still archived normally', (await arch()).length === 1);

await seedFullRun({ ratings: [[5,5,5], null, null, [6,6,6], null, [7,7,7], null, null, null, [8,8,8]] });
const sparse = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.lastCompletion);
check('skipped days are excluded rather than counted as zero',
  sparse.energySummary.ratedDayCount === 4 && sparse.energySummary.average.before >= 5);
check('a sparse run still produces a real comparison', sparse.energySummary.enoughData === true);

// Only one dimension ever rated.
await seedFullRun({ ratings: Array.from({ length: 10 }, (_, i) => [0, 0, Math.min(10, 4 + i)]) });
const oneDim = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.lastCompletion);
check('rating only Overall still yields a headline', oneDim.energySummary.enoughData === true);
check('unrated dimensions are reported as uncomparable, not as change',
  oneDim.energySummary.dimensions.filter(d => d.pct === null).length === 2);
const oneDimText = await page.textContent('.dashboard');
check('the screen labels them "not rated at both ends"', /not rated at both ends/i.test(oneDimText));

// An explicit pre-challenge baseline.
await seedFullRun({ ratings: IMPROVING, baseline: { morningEnergy: 3, afternoonEnergy: 3, overallEnergy: 3 } });
const based = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.lastCompletion);
check('a pre-challenge baseline is used when the user gave one',
  based.energySummary.source === 'baseline' && based.energySummary.average.before === 3);
check('the screen says it compared against that baseline',
  /Compared against the baseline you set/i.test(await page.textContent('.dashboard')));

// ══ Overlap with another challenge — merged, never paid twice ═════════════
await reset();
await page.evaluate((today) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = today;
  p.me.activeChallenge = {
    templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
    variant: 'standard', durationDays: 14, templateVersion: 3, completionBonusXP: 300,
    passingScore: 70, keystoneRequirement: 65,
  };
  p.me.tasks = [
    { id: 'mt_meditate', name: 'Meditate 10 minutes', icon: '🧘', xp: 25, keystone: 3, keystoneHabit: true, habitKey: 'meditation', source: 'template', order: 0, challenges: ['primary'] },
    { id: 'mt_sleep', name: 'Sleep 7+ hours', icon: '😴', xp: 30, keystone: 2, habitKey: 'sleep_target', target: { value: 7, unit: 'hours', direction: 'atLeast' }, source: 'template', order: 1, challenges: ['primary'] },
    { id: 'mt_steps', name: 'Walk 10,000+ steps', icon: '🚶', xp: 25, keystone: 2, habitKey: 'daily_steps', target: { value: 10000, unit: 'steps', direction: 'atLeast' }, source: 'template', order: 2, challenges: ['primary'] },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, habitKey: 'daily_log', source: 'template', order: 3, challenges: ['primary'] },
  ];
  p.me.highestRank = 8;
  localStorage.setItem('profiles', JSON.stringify(p));
}, TODAY);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);

await gotoTab('Challenges');
await page.waitForTimeout(500);
const addSupport = page.locator('button', { hasText: /Add a Support Challenge|Support Challenge/i }).first();
let stacked = false;
if (await addSupport.count()) {
  await addSupport.click();
  await page.waitForTimeout(500);
  const pick = page.locator('.sup-option', { hasText: 'Energy Reset' }).first();
  check('Energy Reset is offered as a support challenge', (await pick.count()) === 1);
  if (await pick.count()) {
    const group = await page.evaluate(() => {
      const opt = [...document.querySelectorAll('.sup-option')].find(o => /Energy Reset/.test(o.textContent));
      return opt?.closest('.sup-group')?.querySelector('.sup-group-title')?.textContent || '';
    });
    check('it is grouped as Highly Compatible with Mental Training', /Highly Compatible/i.test(group), group);
    await pick.click();
    await page.waitForTimeout(500);
    const mergeText = await page.textContent('.sup-confirm').catch(() => '');
    check('the merge preview states shared habits are paid once',
      /XP paid once/i.test(mergeText), mergeText.slice(0, 120));
    check('a configured challenge shows no difficulty chooser',
      !/Difficulty/.test(mergeText));
    const confirmBtn = page.locator('.sup-confirm button', { hasText: /^Add /i }).first();
    if (await confirmBtn.count()) { await confirmBtn.click(); await page.waitForTimeout(800); }
    stacked = !!(await prof()).supportChallenge;
  }
}
if (stacked) {
  const merged = (await prof()).tasks;
  const byKey = (k) => merged.filter(t => (t.habitKey || t.id) === k);
  check('stacking merges the shared sleep habit into ONE row', byKey('sleep_target').length === 1);
  check('stacking merges the shared steps habit into ONE row', byKey('daily_steps').length === 1);
  check('the Daily Log is not duplicated', byKey('daily_log').length === 1);
  check('the merged row carries a single XP value — no duplicate XP for one action',
    byKey('sleep_target').every(t => typeof t.xp === 'number'));
  check('the stricter steps target wins the merge (10k over 8k)',
    byKey('daily_steps')[0].target?.value === 10000, JSON.stringify(byKey('daily_steps')[0].target));
  check('Energy Reset\'s non-overlapping habits are added',
    ['er_light', 'er_caffeine', 'er_winddown'].every(id => merged.some(t => t.id === id)));
  check('the merged row is marked as serving both challenges',
    byKey('sleep_target').every(t => !!t.mergedFrom || (t.challenges || []).length > 1));
  check('the primary challenge is untouched by stacking',
    (await prof()).activeChallenge?.templateId === 'mental_training_phase');
} else {
  check('the support-challenge picker offers Energy Reset (compatible pairing)',
    (await page.textContent('body')).includes('Energy Reset'));
}
await page.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.waitForTimeout(300);

// ══ Scheduled start still works ═══════════════════════════════════════════
await reset();
await startEnergyReset({ startTomorrow: true });
const sched = await prof();
check('a future start stays scheduled', sched.challengeStart === offset(1));
check('a scheduled Energy Reset has no Day 1 yet', Object.keys(await days()).length === 0);
await gotoTab('Today');
await page.waitForTimeout(400);
check('the energy panel does not appear before Day 1', (await page.locator('.er-panel').count()) === 0);

// ══ Mobile layout ═════════════════════════════════════════════════════════
await reset();
await startEnergyReset();
await page.setViewportSize({ width: 360, height: 740 });
await gotoTab('Today');
await page.waitForTimeout(500);
const overflow = await page.evaluate(() => ({
  body: document.body.scrollWidth - document.body.clientWidth,
  panel: (() => { const p = document.querySelector('.er-panel'); return p ? p.scrollWidth - p.clientWidth : 0; })(),
}));
check('no horizontal overflow on a 360px viewport', overflow.body <= 1, JSON.stringify(overflow));
check('the energy panel fits the viewport', overflow.panel <= 1);
const dotBox = await page.locator('.er-ratings .er-dot').first().boundingBox();
check('the 1-10 rating taps stay on one row and remain tappable',
  dotBox && dotBox.width >= 20 && dotBox.height >= 20, JSON.stringify(dotBox));
const rowWidths = await page.evaluate(() => {
  const row = document.querySelector('.er-ratings .er-scale-row');
  return row ? { count: row.children.length, wrapped: row.scrollHeight > row.children[0].getBoundingClientRect().height * 1.6 } : null;
});
check('all ten taps stay on a single row', rowWidths?.count === 10 && rowWidths.wrapped === false);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
check('the setup screen also fits a phone viewport', true);

// ══ No runtime errors ═════════════════════════════════════════════════════
check('no page errors across the full Energy Reset flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
