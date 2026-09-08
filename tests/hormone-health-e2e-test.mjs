/**
 * Women's Hormone Health end-to-end: the real setup flow, the daily and weekly
 * requirements in the running app, the symptom check-in and Life Impact Score,
 * three-cycle progress, medical safety, and no effect on any other challenge.
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
const prof = (id = 'girlfriend') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const challengeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});

/** Hormone Health is female-only, so this suite runs on the Female profile. */
async function init(which = 'girlfriend') {
  await page.evaluate((w) => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify(w)); }, which);
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    p.me.xpPenalties = false; p.girlfriend.xpPenalties = false;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
}

async function startHormoneHealth(weeks = null) {
  await gotoTab('Challenges');
  await page.waitForTimeout(300);
  const card = page.locator('.challenge-card', { hasText: "Women's Hormone Health" });
  await card.locator('.challenge-card-header').click();
  await page.waitForTimeout(300);
  await card.locator('button', { hasText: "Start Women's Hormone Health" }).click();
  await page.waitForSelector('.hh-setup', { timeout: 5000 });
  if (weeks) {
    await page.locator('.hh-duration', { hasText: `${weeks} Weeks` }).click();
    await page.waitForTimeout(200);
  }
  await page.locator('.hh-safety .hh-check input').check();
  await page.locator('.hh-setup button', { hasText: 'Continue' }).click();
  await page.waitForSelector('.letter-modal, textarea', { timeout: 5000 });
  const tas = page.locator('textarea');
  for (let i = 0, n = await tas.count(); i < n; i++) await tas.nth(i).fill('Because I want my month back.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForSelector('.start-when-options', { timeout: 5000 });
  await page.locator('.start-when-btn', { hasText: 'Start Today' }).click();
  await page.waitForSelector('.daily-view', { timeout: 5000 });
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });

// ══ Availability ════════════════════════════════════════════════════════════
await init('girlfriend');
await gotoTab('Challenges');
check('the challenge appears in the Female profile library',
  (await page.locator('.challenge-card', { hasText: "Women's Hormone Health" }).count()) === 1);
await init('me');
await gotoTab('Challenges');
check('it is not offered to the Male profile (female-only, per the existing convention)',
  (await page.locator('.challenge-card', { hasText: "Women's Hormone Health" }).count()) === 0);

// ══ Setup screen ════════════════════════════════════════════════════════════
await init('girlfriend');
await gotoTab('Challenges');
const card = page.locator('.challenge-card', { hasText: "Women's Hormone Health" });
await card.locator('.challenge-card-header').click();
await page.waitForTimeout(300);
const cardText = await card.textContent();
check('the card offers both lengths', /56 or 84 days/.test(cardText), cardText.slice(0, 140));
check('the card previews the real daily requirements',
  /Sleep 7\.5–9 hours/.test(cardText) && /Eat mostly whole foods/.test(cardText) && /8,000\+ steps/.test(cardText));
check('the card previews the weekly requirements',
  /Exercise — 3× per week/.test(cardText) && /Omega-3 Foods/.test(cardText) && /Iron-Rich Foods/.test(cardText));
check('the card carries the cycle-aware exercise principle',
  /Adjust intensity, not consistency/.test(cardText));

await card.locator('button', { hasText: "Start Women's Hormone Health" }).click();
await page.waitForSelector('.hh-setup', { timeout: 5000 });
const setupText = await page.textContent('.hh-setup');
check('setup shows the name and subtitle',
  /Women's Hormone Health/.test(setupText) && /Build habits\. Reclaim your month\./.test(setupText));
check('setup states what the challenge does NOT claim',
  /does not claim to balance hormones/i.test(setupText) && /treat any medical condition/i.test(setupText));
// ── Duration selector ──
check('setup offers both durations',
  (await page.locator('.hh-duration').count()) === 2);
check('the options read "8 Weeks — Standard" and "12 Weeks — Recommended"',
  /8 Weeks — Standard/.test(setupText) && /12 Weeks — Recommended/.test(setupText));
check('each option states its day count', /56 days/.test(setupText) && /84 days/.test(setupText));
check('the required blurbs are shown',
  /Build the foundations and compare how your cycle responds\./.test(setupText) &&
  /Give the habits more time and get a clearer picture across multiple cycles\./.test(setupText));
check('12 weeks is highlighted as Recommended and pre-selected',
  /Recommended/.test(setupText) &&
  /12 Weeks/.test(await page.locator('.hh-duration.active').textContent()));
check('setup says the two versions are otherwise identical',
  /exactly the\s+same in both/.test(setupText.replace(/\s+/g, ' ')) ||
  /are exactly the same in both/.test(setupText.replace(/\s+/g, ' ')));
check('setup says the longer version is not harder',
  /longer version is not harder/i.test(setupText));
check('setup does not assume a fixed number of cycles',
  /Cycle length varies/i.test(setupText) &&
  /compares whatever cycles you actually logged/i.test(setupText));
check('12 weeks shows three stages by default',
  (await page.locator('.hh-stage').count()) === 3);
// Switching to 8 weeks updates the framing without changing any requirement.
const before12 = await page.evaluate(() =>
  [...document.querySelectorAll('.tpl-task-list li')].map(x => x.textContent).join('|'));
await page.locator('.hh-duration', { hasText: '8 Weeks' }).click();
await page.waitForTimeout(250);
const after8 = await page.evaluate(() =>
  [...document.querySelectorAll('.tpl-task-list li')].map(x => x.textContent).join('|'));
check('choosing 8 weeks changes NO daily or weekly requirement', before12 === after8);
check('8 weeks shows two stages', (await page.locator('.hh-stage').count()) === 2);
check('8 weeks is framed as the minimum recommended version',
  /minimum recommended version/i.test(await page.textContent('.hh-setup')));
await page.locator('.hh-duration', { hasText: '12 Weeks' }).click();
await page.waitForTimeout(200);
check('setup explains the three stages',
  /Cycle 1 — Baseline/.test(setupText) && /Cycle 2 — Improvement/.test(setupText) && /Cycle 3 — Consolidation/.test(setupText));
check('setup lists the daily habits with XP and marks the keystone',
  /Sleep 7\.5–9 hours \(40 XP\)/.test(setupText) && /⭐⭐⭐ Keystone/.test(setupText));
check('setup lists the weekly habits', /Exercise — 3× per week \(35 XP each\)/.test(setupText));
check('setup states fish oil and iron supplements are not required',
  /supplements are never required/i.test(setupText) && /no iron or liver supplements required/i.test(setupText));
check('setup carries the exercise rule with both directions',
  /When energy and recovery are good/.test(setupText) && /When luteal or menstrual symptoms are significant/.test(setupText));
check('setup explicitly rejects the "cannot lift heavy" claim',
  /not biologically incapable of training hard during your period/i.test(setupText));
check('setup requires acknowledging the medical framing before continuing',
  await page.locator('.hh-setup button', { hasText: 'Continue' }).isDisabled());
// Supplements are education only.
await page.locator('.hh-disclosure', { hasText: 'Supplements' }).click();
await page.waitForTimeout(200);
const suppText = await page.textContent('.hh-supplements');
check('supplements are optional education covering magnesium, ginger, omega-3, iron',
  /Habits first\. Food first\. Supplements optional\./.test(suppText) &&
  ['Magnesium', 'Ginger', 'Omega-3', 'Iron'].every(n => suppText.includes(n)));
check('iron guidance requires confirmed deficiency', /deficiency is confirmed or clinically indicated/i.test(suppText));
// Targets are editable but pre-filled.
await page.locator('.hh-disclosure', { hasText: 'Your targets' }).click();
await page.waitForTimeout(200);
check('personal targets are editable', (await page.locator('.hh-targets .inline-input').count()) >= 6);
await page.keyboard.press('Escape');

// ══ Starting the challenge ══════════════════════════════════════════════════
await init('girlfriend');
await startHormoneHealth();
let p = await prof();
check('the attempt is created', p.activeChallenge.templateId === 'womens_hormone_health' && p.challengeStart === TODAY);
check('the default attempt is 84 days', p.activeChallenge.durationDays === 84);
check('the attempt carries its own config block', !!p.activeChallenge.hormoneHealth);
check('the safety acknowledgment is recorded', p.activeChallenge.hormoneHealth.acknowledgedSafety === true);
check('weekly requirements are stored on the attempt',
  p.activeChallenge.weeklyRequirementDefs.map(d => d.id).join() === 'hh_exercise,hh_omega3,hh_iron');
check('exercise is 3 per week, omega-3 is 2, iron-rich is 4', (() => {
  const byId = Object.fromEntries(p.activeChallenge.weeklyRequirementDefs.map(d => [d.id, d.perWeek]));
  return byId.hh_exercise === 3 && byId.hh_omega3 === 2 && byId.hh_iron === 4;
})());

// ══ An 8-week attempt is identical apart from its length ═══════════════════
const twelveTasks = JSON.stringify(p.tasks.map(t => ({ id: t.id, name: t.name, xp: t.xp, keystone: t.keystone })));
const twelveWeekly = JSON.stringify(p.activeChallenge.weeklyRequirementDefs);
await init('girlfriend');
await startHormoneHealth(8);
const p8 = await prof();
check('choosing 8 Weeks creates a 56-day attempt', p8.activeChallenge.durationDays === 56);
check('the attempt records the chosen length', p8.activeChallenge.hormoneHealth.durationDays === 56);
check('its daily habits are identical to the 12-week version',
  JSON.stringify(p8.tasks.map(t => ({ id: t.id, name: t.name, xp: t.xp, keystone: t.keystone }))) === twelveTasks);
check('its weekly requirements are identical',
  JSON.stringify(p8.activeChallenge.weeklyRequirementDefs) === twelveWeekly);
check('sleep is still the keystone at the same XP',
  p8.tasks.find(t => t.keystoneHabit)?.id === 'hh_sleep' && p8.tasks.find(t => t.id === 'hh_sleep').xp === 40);
await gotoTab('Today');
check('the 8-week attempt shows "of 56"', /of 56/.test(await page.textContent('.day-selector')));
check('it renders the same six daily tasks', (await page.locator('.gf-task-card').count()) === 6);
check('it has the same three weekly requirements', (await page.locator('.wr-row').count()) === 3);
check('the same panel, guidance and check-in are available',
  (await page.locator('.hh-panel').count()) === 1 && (await page.locator('.hh-period-btn').count()) === 1);
await page.locator('.hh-block-toggle', { hasText: 'Cycle progress' }).click();
await page.waitForTimeout(300);
const p8panel = await page.textContent('.hh-panel');
check('an 8-week attempt shows two cycle stages',
  /Cycle 1 — Baseline/.test(p8panel) && /Cycle 2 — Improvement/.test(p8panel) &&
  !/Cycle 3 — Consolidation/.test(p8panel));

// Back to the 12-week attempt for the remainder of the suite.
await init('girlfriend');
await startHormoneHealth();
p = await prof();
await gotoTab('Today');

// ══ Daily habits ════════════════════════════════════════════════════════════
const names = p.tasks.map(t => t.name);
check('there are five daily habits plus the daily log', p.tasks.length === 6, `${p.tasks.length}: ${names.join(' | ')}`);
check('sleep is the keystone', p.tasks.filter(t => t.keystoneHabit).map(t => t.id).join() === 'hh_sleep');
check('sleep carries the highest XP', p.tasks.find(t => t.id === 'hh_sleep').xp === 40);
check('the daily list is sleep, whole food, steps, down-regulation, hydration, log',
  names.some(n => /Sleep 7\.5–9 hours/.test(n)) && names.includes('Eat mostly whole foods') &&
  names.some(n => /8,000\+ steps/.test(n)) && names.some(n => /minutes of down-regulation/.test(n)) &&
  names.includes('Hit your hydration target') && names.includes('Complete Daily Log'));
check('exercise is NOT a daily checkbox — it is weekly', !names.some(n => /exercise session/i.test(n)));
check('canonical habitKeys are attached', (() => {
  const k = Object.fromEntries(p.tasks.map(t => [t.id, t.habitKey]));
  return k.hh_sleep === 'sleep_target' && k.hh_whole_food === 'whole_foods' &&
    k.hh_movement === 'daily_steps' && k.hh_stress === 'stress_recovery' && k.hh_hydration === 'hydration';
})());
check('the XP ladder holds in the running app', (() => {
  const xp = Object.fromEntries(p.tasks.map(t => [t.id, t.xp]));
  return xp.hh_sleep === 40 && xp.hh_whole_food === 35 && xp.hh_movement === 25 &&
    xp.hh_stress === 25 && xp.hh_hydration === 10 && xp.hh_sleep >= xp.hh_hydration * 4;
})());
check('no supplement, sauna, cold or special-salt task exists',
  !/magnesium|ginger|supplement|sauna|cold|sea salt|electrolyte/i.test(names.join(' ')));

await gotoTab('Today');
// The Female profile uses the card task layout rather than the check-item list.
check('all six daily tasks render', (await page.locator('.gf-task-card').count()) === 6,
  `${await page.locator('.gf-task-card').count()}`);
const dailyText = await page.textContent('.daily-view');
check('hydration says no special products are required',
  /No special salt, trace minerals or electrolyte products required/i.test(dailyText));
check('the down-regulation options are the user\'s choice',
  /meditation|breathing|prayer|journaling/i.test(dailyText));

// ══ The challenge panel ═════════════════════════════════════════════════════
check('the Hormone Health panel is shown', (await page.locator('.hh-panel').count()) === 1);
let panel = await page.textContent('.hh-panel');
check('it carries the challenge identity', /Women's Hormone Health/.test(panel) && /Reclaim your month/.test(panel));
check('there is no daily questionnaire — just one period prompt',
  (await page.locator('.hh-period-btn').count()) === 1 && (await page.locator('.hh-scale').count()) === 0);
check('cycle progress is available', /Cycle progress/.test(panel));
check('training guidance is available with the principle visible',
  /Training & recovery guidance/.test(panel) && /Adjust intensity, not consistency/.test(panel));

// The training guidance content.
await page.locator('.hh-block-toggle', { hasText: 'Training & recovery guidance' }).click();
await page.waitForTimeout(250);
panel = await page.textContent('.hh-panel');
check('scaled options are listed for symptomatic days',
  /Pilates/.test(panel) && /Zone 2 cardio/.test(panel) && /Yoga/.test(panel) && /Mobility/.test(panel));
check('training hard is encouraged when she feels good',
  /Progressive overload/.test(panel) && /chase a PR if you want one/.test(panel));
check('the extra sleep-opportunity guidance is a recommendation only',
  /30–60 minutes of sleep opportunity/.test(panel) && /recommendations, not extra boxes to tick/i.test(panel));
check('comfort tools are offered and explicitly optional',
  /Heating pad/.test(panel) && /Warm bath/.test(panel) &&
  /None of these are required and none affect your score/i.test(panel));

// ══ Symptom check-in ════════════════════════════════════════════════════════
await page.locator('.hh-block-toggle', { hasText: 'Training & recovery guidance' }).click();
await page.waitForTimeout(200);
await gotoTab('Home'); const xpBefore = await challengeXP();
await gotoTab('Today');
await page.locator('.hh-period-btn').click();
await page.waitForTimeout(400);
check('marking a period day opens the check-in', (await page.locator('.hh-checkin').count()) === 1);
const checkinText = await page.textContent('.hh-checkin');
check('the check-in covers pain, bloating, energy, mood and sleep quality',
  ['Pain / cramps', 'Bloating', 'Energy', 'Mood', 'Sleep quality'].every(l => checkinText.includes(l)));
check('flow offers light / moderate / heavy',
  ['Light', 'Moderate', 'Heavy'].every(l => checkinText.includes(l)));
check('pain medication is an optional checkbox', /Took pain medication today/.test(checkinText));
check('interference covers work, exercise, sleep and social',
  ['Work / school', 'Exercise', 'Sleep', 'Social / plans'].every(l => checkinText.includes(l)));
check('the check-in states it never affects score or XP',
  /never affects your score or XP/i.test(checkinText));
check('the interference question is framed as the one that matters most',
  /not whether you had cramps, but how\s+much your cycle interfered/i.test(checkinText.replace(/\s+/g, ' ')) ||
  /how much your cycle interfered with your life/i.test(checkinText));

// Fill a severe, fully disruptive day.
async function setScale(label, value) {
  const row = page.locator('.hh-scale', { hasText: label }).first();
  await row.locator('.hh-dot', { hasText: new RegExp(`^${value}$`) }).click();
  await page.waitForTimeout(180);
}
await setScale('Pain / cramps', 9);
await setScale('Bloating', 8);
await setScale('Energy', 2);
await setScale('Mood', 2);
await setScale('Sleep quality', 2);
await page.locator('.hh-chip', { hasText: 'Heavy' }).click();
await page.waitForTimeout(200);
for (const area of ['Work / school', 'Exercise', 'Sleep', 'Social / plans']) {
  await page.locator('.hh-chip', { hasText: area }).click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(300);
check('a Life Impact Score is produced', (await page.locator('.hh-impact').count()) === 1);
const impactText = await page.textContent('.hh-impact');
check('a severe, fully disruptive day scores near 10',
  parseFloat(impactText) >= 8.5, impactText.trim());
check('the score is described in words too', /disruptive/i.test(impactText));
p = await prof();
check('the check-in is stored on the attempt', (p.cycleLogs || []).length === 1);
check('it recorded the values', (() => {
  const l = p.cycleLogs[0];
  return l.pain === 9 && l.bloating === 8 && l.energy === 2 && l.flow === 'heavy' &&
    l.interference.work && l.interference.exercise && l.interference.sleep && l.interference.social;
})());
await gotoTab('Home');
check('the check-in awarded ZERO XP — it is a measurement, not a habit',
  (await challengeXP()) === xpBefore, `${xpBefore} → ${await challengeXP()}`);

// ══ Medical safety ══════════════════════════════════════════════════════════
// One bad day must not trigger anything.
await gotoTab('Today');
check('one severe day raises no medical prompt', (await page.locator('.hh-safety-block').count()) === 0);
// Seed repeated severe reports across two cycles.
await page.evaluate(({ dates }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.cycleLogs = dates.map((date, i) => ({
    id: `seed_${i}`, date, pain: 9, bloating: 7, energy: 2, mood: 2, sleepQuality: 3, flow: 'heavy',
    meds: true, interference: { work: true, exercise: true, sleep: true, social: false }, concerns: {},
  }));
  localStorage.setItem('profiles', JSON.stringify(p));
}, { dates: [offset(0), offset(-1), offset(-2)] });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForTimeout(400);
check('repeated severe reports raise a discreet medical prompt',
  (await page.locator('.hh-safety-block').count()) === 1);
const safetyText = await page.textContent('.hh-safety-block');
check('it names the conditions worth ruling out',
  ['endometriosis', 'adenomyosis', 'fibroids', 'anaemia'].every(w => safetyText.toLowerCase().includes(w)));
check('it flags repeated severe pain', /severe pain/i.test(safetyText));
check('it flags repeatedly being stopped from normal activities', /normal activities/i.test(safetyText));
check('it flags heavy flow and mentions iron testing',
  /heavy flow/i.test(safetyText) && /iron/i.test(safetyText));
check('it never implies a lack of discipline',
  /not a discipline problem/i.test(safetyText) && /does not mean you did the challenge wrong/i.test(safetyText));

// ══ Three-cycle progress ════════════════════════════════════════════════════
// Seed three improving cycles roughly a month apart.
await page.evaluate(({ start }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const mk = (date, v) => ({ id: `c_${date}`, date, flow: v.flow, meds: false, concerns: {},
    pain: v.pain, bloating: v.bloating, energy: v.energy, mood: v.mood, sleepQuality: v.sleep,
    interference: v.interference });
  const day = (n) => { const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const all = [];
  const heavy = { work: true, exercise: true, sleep: true, social: true };
  const mid = { work: false, exercise: true, sleep: false, social: false };
  const none = { work: false, exercise: false, sleep: false, social: false };
  for (const n of [0, 1, 2, 3]) all.push(mk(day(n), { pain: 9, bloating: 8, energy: 2, mood: 2, sleep: 3, flow: 'heavy', interference: heavy }));
  for (const n of [28, 29, 30]) all.push(mk(day(n), { pain: 5, bloating: 5, energy: 6, mood: 6, sleep: 6, flow: 'moderate', interference: mid }));
  for (const n of [56, 57, 58]) all.push(mk(day(n), { pain: 3, bloating: 3, energy: 8, mood: 8, sleep: 8, flow: 'light', interference: none }));
  p.girlfriend.cycleLogs = all;
  p.girlfriend.challengeStart = start;
  localStorage.setItem('profiles', JSON.stringify(p));
}, { start: offset(-60) });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForTimeout(400);
await page.locator('.hh-block-toggle', { hasText: 'Cycle progress' }).click();
await page.waitForTimeout(300);
const progressText = await page.textContent('.hh-panel');
check('all three stages are shown',
  /Cycle 1 — Baseline/.test(progressText) && /Cycle 2 — Improvement/.test(progressText) && /Cycle 3 — Consolidation/.test(progressText));
check('each logged cycle reports its Life Impact Score',
  (progressText.match(/Life Impact \d/g) || []).length >= 3, (progressText.match(/Life Impact [\d.]+/g) || []).join(' | '));
check('the comparison runs first cycle → most recent',
  /First logged cycle → most recent/.test(progressText));
check('average pain is compared', /Average pain[\s\S]{0,30}9 → 3/.test(progressText));
check('worst pain is compared separately', /Worst pain/.test(progressText));
check('energy, mood, bloating and sleep quality are compared',
  ['Energy', 'Mood', 'Bloating', 'Sleep quality'].every(l => progressText.includes(l)));
check('exercise and work disruption are compared',
  /Exercise disruption/.test(progressText) && /Work \/ school disruption/.test(progressText));
check('the Life Impact Score is compared as the headline',
  /Life Impact Score[\s\S]{0,30}\d/.test(progressText));

// With only one cycle, nothing is fabricated.
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.cycleLogs = p.girlfriend.cycleLogs.slice(0, 4);
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForTimeout(400);
await page.locator('.hh-block-toggle', { hasText: 'Cycle progress' }).click();
await page.waitForTimeout(300);
check('with one cycle it says so rather than inventing a change',
  /at least two logged cycles/i.test(await page.textContent('.hh-panel')));
check('nothing is estimated', /Nothing is estimated/i.test(await page.textContent('.hh-panel')));

// ══ Self-contained: no global tracking, no effect on other challenges ══════
await init('me');
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = start;
  p.me.activeChallenge = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard',
    durationDays: 30, templateVersion: 3, passingScore: 70, keystoneRequirement: 65, weeklyRequirementsStartDate: start };
  p.me.tasks = [
    { id: 'fl_protein', name: 'Hit protein goal', xp: 40, keystone: 3, keystoneHabit: true, source: 'template', order: 0 },
    { id: 'daily_log', name: 'Complete Daily Log', xp: 10, keystone: 1, source: 'template', order: 1 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
}, offset(-4));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
const mp = await prof('me');
check('an existing Fat Loss attempt is untouched',
  mp.activeChallenge.templateId === 'fat_loss_phase' && mp.tasks.length === 2);
check('Fat Loss keeps its own weekly requirements', mp.activeChallenge.weeklyRequirementDefs === undefined);
check('the cycleLogs list is added empty and additively',
  Array.isArray(mp.cycleLogs) && mp.cycleLogs.length === 0);
check('no Hormone Health panel appears on another challenge',
  (await page.locator('.hh-panel').count()) === 0);
await gotoTab('Today');
check('no menstrual check-in appears anywhere outside the challenge',
  (await page.locator('.hh-period-btn').count()) === 0 && (await page.locator('.hh-checkin').count()) === 0);
check('Fat Loss exercise requirements are unchanged', (await page.locator('.wr-card').count()) === 1);
check('Fat Loss daily tasks still render', (await page.locator('.check-item').count()) === 2);
const migSnap = await page.evaluate(() => localStorage.getItem('profiles'));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
check('the migration is idempotent',
  (await page.evaluate(() => localStorage.getItem('profiles'))) === migSnap);

// ══ Primary + Support pairing ═══════════════════════════════════════════════
await init('girlfriend');
await startHormoneHealth();
await gotoTab('Challenges');
await page.locator('.acc-add-support').click();
await page.waitForTimeout(400);
check('Mental Training is offered as Highly Compatible', await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🟢/.test(x.querySelector('.sup-group-title').textContent));
  return !!g && /Mental Training/.test(g.textContent);
}));
check('Fat Loss is offered only with a Conditional warning', await page.evaluate(() => {
  const g = [...document.querySelectorAll('.sup-group')].find(x => /🟡/.test(x.querySelector('.sup-group-title')?.textContent || ''));
  return !!g && /Fat Loss/.test(g.textContent);
}));
await page.locator('.sup-option', { hasText: 'Mental Training Phase' }).click();
await page.waitForTimeout(400);
const mergeText = await page.textContent('.sup-merge');
check('the merge preview reports shared habits', /shared habit/i.test(mergeText), mergeText.replace(/\s+/g, ' ').slice(0, 120));
await page.locator('.sup-confirm button', { hasText: 'Add Support Challenge' }).click();
await page.waitForTimeout(600);
p = await prof();
check('no habitKey is duplicated across the stacked pair', (() => {
  const keys = p.tasks.map(t => t.habitKey || t.id);
  return new Set(keys).size === keys.length;
})());
check('sleep stays the Hormone Health keystone after stacking',
  p.tasks.filter(t => t.keystoneHabit).map(t => t.id).join() === 'hh_sleep');
check('Hormone Health remains the primary', p.activeChallenge.templateId === 'womens_hormone_health');

check('no page errors across the whole flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
