/**
 * Mental Training — one habit, six practices, end to end.
 *
 * Driven the way a person drives it: the challenge is started through the
 * real setup flow, the habit is completed through Begin Training, and every
 * claim is checked against what the app stores as well as what it shows.
 *
 *   A. Setup offers 5 / 10 / 15 / 30 minutes, never below the mode's minimum
 *      (Beginner 5, Standard 10, Hard 30), and stamps the choice onto the
 *      attempt without a template update prompt.
 *   B. Today shows ONE Mental Training habit, its sentence, its Guide and a
 *      Begin Training action that lives outside the checkbox row.
 *   C. Opening, reading, choosing, timing and the Guide award nothing.
 *   D. The device-free practices say to put the phone away.
 *   E. "Not yet" records nothing.
 *   F. Confirming completes the habit once, pays its XP once, records the
 *      practice id and touches no other habit or stored value.
 *   G. A second session the same day pays nothing.
 *   H. Undo through the row works, and re-recording pays once.
 *   I. All of it survives a reload.
 *   J. Navigation to and from Today.
 *   K. The other profile, in its own colour, with its own data.
 *   L. Attempts started before the practices keep exactly what they had,
 *      including through a template sync — and a stamped one keeps its
 *      minutes through a sync.
 *   M. 320, 390 and 430px.
 *   N. Mental Training as a Support Challenge.
 *   O. An attempt already running at Standard's earlier 15 minutes keeps them.
 *
 * Run against a production build:  npx vite preview --port 4173
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import * as H from './helpers/challenges.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const TRAINING_DESC = 'Choose an intentional practice to strengthen your attention, awareness, or understanding.';
const SIX = [
  ['dead_calm', 'Dead Calm', 'Meditation & Breathwork', false],
  ['open_sky', 'Open Sky', 'Mindful Nature Observation', true],
  ['moving_stillness', 'Moving Stillness', 'Mindful Stretching & Mobility', true],
  ['pursuit_of_wisdom', 'Pursuit of Wisdom', 'Reflective Reading', true],
  ['inner_vision', 'Inner Vision', 'Visualization & Mental Rehearsal', false],
  ['inner_mirror', 'Inner Mirror', 'Journaling & Introspection', true],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function offset(n) { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); }

async function gotoTab(name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => new RegExp(`^${n}$`, 'i').test((x.getAttribute('aria-label') || x.textContent || '').trim()));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(400);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);
const today = async (id = 'me') => {
  const d = await days(id);
  const keys = Object.keys(d).map(Number).sort((a, b) => b - a);
  return d[keys[0]] || null;
};
const earned = async () => parseInt(((await page.textContent('.f4-xp-pill.earned .f4-xp-val')) || '0').replace(/[^\d]/g, ''), 10);
const mindRow = () => page.locator('.check-item', { hasText: 'Mental Training —' }).first();
const mindChecked = async () => (await mindRow().getAttribute('aria-checked')) === 'true';
const rowXP = async () => parseInt(((await mindRow().locator('.check-xp').textContent()) || '0').replace(/[^\d]/g, ''), 10);
const overlayOpen = async () => (await page.locator('[data-testid="mental-training"]').count()) > 0;

async function fresh(profile = 'me') {
  await page.evaluate((p) => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify(p)); }, profile);
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
}

/** Through the real setup flow, stopping on the training step. */
async function toTrainingStep({ mode = null } = {}) {
  await gotoTab('Challenges');
  await H.openChallenge(page, 'Mental Training Phase');
  if (mode) await H.pickMode(page, mode);
  await H.beginSetup(page);
  for (let i = 0; i < 6; i++) {
    if (await page.locator('[data-testid="setup-training"]').count()) return true;
    await page.locator('.f4c-setup .f4c-btn.primary').last().click();
    await page.waitForTimeout(350);
  }
  return (await page.locator('[data-testid="setup-training"]').count()) > 0;
}
const lengths = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="setup-training"] .mt-length')]
  .map(b => ({ text: b.querySelector('.f4c-dur-n').textContent, on: b.getAttribute('aria-checked') === 'true', disabled: b.disabled })));
async function pickLength(m) {
  // Anchored: "5 minutes a day" is also inside "15 minutes a day".
  await page.locator('[data-testid="setup-training"] .mt-length', { hasText: new RegExp(`^${m} minutes a day`) }).click();
  await page.waitForTimeout(200);
}
async function finishSetup() {
  await H.advanceToStart(page);
  await H.pickStartDate(page, 'today');
  await H.confirmStart(page);
}
async function startMT({ mode = null, minutes = null } = {}) {
  await toTrainingStep({ mode });
  if (minutes) await pickLength(minutes);
  await finishSetup();
  await gotoTab('Today');
  await page.waitForSelector('.check-item', { timeout: 15000 });
}
async function openTraining() {
  await page.click('[data-testid="begin-training"]');
  await page.waitForSelector('[data-testid="training-choose"]', { timeout: 5000 });
}
async function choosePractice(id) {
  await page.click(`[data-practice="${id}"]`);
  await page.waitForSelector(`[data-testid="training-session"][data-practice="${id}"]`, { timeout: 5000 });
}
async function backToPractices() {
  await page.click('.mtx-back');
  await page.waitForSelector('[data-testid="training-choose"]', { timeout: 5000 });
}
async function closeTraining() {
  await page.click('.mtx-close');
  await page.waitForTimeout(250);
}
async function recordSession(id) {
  await openTraining();
  await choosePractice(id);
  await page.click('[data-testid="training-finish"]');
  await page.waitForSelector('[data-testid="training-confirm"]');
  await page.click('[data-testid="training-confirm-yes"]');
  await page.waitForSelector('[data-testid="training-done"]');
}
async function openManage() {
  await gotoTab('Challenges');
  await page.locator('.f4c-active-actions .f4c-btn', { hasText: 'Manage' }).first().click();
  await page.waitForSelector('.f4c-manage', { timeout: 5000 });
}

await page.goto(BASE);
await fresh('me');

// ══ A: setup ════════════════════════════════════════════════════════════════
check('A: the setup flow has a Daily Mental Training step', await toTrainingStep({ mode: 'Standard' }));
let opts = await lengths();
check('A: it offers 5, 10, 15 and 30 minutes',
  opts.map(o => o.text).join('|') === '5 minutes a day|10 minutes a day|15 minutes a day|30 minutes a day', opts.map(o => o.text).join('|'));
check('A: Standard recommends 10 and has it selected', opts.find(o => o.on)?.text === '10 minutes a day');
check('A: Standard cannot choose less than 10, and can choose 10, 15 or 30',
  opts[0].disabled && !opts[1].disabled && !opts[2].disabled && !opts[3].disabled, JSON.stringify(opts));
check('A: 10 minutes is labelled as Standard\'s recommendation',
  /A steady session · Recommended for Standard/.test(await page.locator('[data-testid="setup-training"] .mt-length', { hasText: /^10 minutes a day/ }).textContent()));
check('A: the step states Standard\'s minimum',
  /Standard Mode trains for at least 10 minutes/.test(await page.textContent('[data-testid="setup-training"]')));
check('A: the step says the length is fixed and pays the same XP',
  /fixed once the challenge starts/i.test(await page.textContent('[data-testid="setup-training"]'))
    && /same \d+ XP a day/i.test(await page.textContent('[data-testid="setup-training"]')));

// Back to the mode step and through the other two modes.
await H.backToStep(page, '.f4c-mode');
await H.pickMode(page, 'Hard');
for (let i = 0; i < 6 && !(await page.locator('[data-testid="setup-training"]').count()); i++) {
  await page.locator('.f4c-setup .f4c-btn.primary').last().click(); await page.waitForTimeout(300);
}
opts = await lengths();
check('A: Hard Mode requires 30 — the shorter lengths are unavailable',
  opts[0].disabled && opts[1].disabled && opts[2].disabled && !opts[3].disabled && opts[3].on, JSON.stringify(opts));

await H.backToStep(page, '.f4c-mode');
await H.pickMode(page, 'Beginner');
for (let i = 0; i < 6 && !(await page.locator('[data-testid="setup-training"]').count()); i++) {
  await page.locator('.f4c-setup .f4c-btn.primary').last().click(); await page.waitForTimeout(300);
}
opts = await lengths();
check('A: Beginner allows all four and recommends 5',
  opts.length === 4 && opts.every(o => !o.disabled) && opts[0].on, JSON.stringify(opts));
await pickLength(10);
opts = await lengths();
check('A: Beginner can choose 10', opts[1].on && !opts[0].on);
await pickLength(30);
opts = await lengths();
check('A: choosing 30 selects it', opts[3].on && !opts[0].on && !opts[1].on);

// Choosing 30 in Beginner and then moving to Standard keeps 30, which Standard allows.
await H.backToStep(page, '.f4c-mode');
await H.pickMode(page, 'Standard');
for (let i = 0; i < 6 && !(await page.locator('[data-testid="setup-training"]').count()); i++) {
  await page.locator('.f4c-setup .f4c-btn.primary').last().click(); await page.waitForTimeout(300);
}
opts = await lengths();
check('A: a length the new mode allows carries across', opts[3].on, JSON.stringify(opts));

check('A: the review lists the habit at the chosen length', await H.advanceToReview(page)
  && /Mental Training — 30 minutes/.test(await page.textContent('.f4c-reqs'))
  && /One of six practices, chosen each day/.test(await page.textContent('.f4c-reqs')));
check('A: the review lists exactly one Mental Training habit',
  (await page.locator('.f4c-req', { hasText: 'Mental Training' }).count()) === 1);
await finishSetup();

let p = await prof();
check('A: the attempt is stamped with the six practices and 30 minutes',
  JSON.stringify(p.activeChallenge.mentalTraining) === JSON.stringify({ version: 1, minutes: 30 }),
  JSON.stringify(p.activeChallenge.mentalTraining));
check('A: on Standard, template version 6, current habit rules',
  p.activeChallenge.variant === 'standard' && p.activeChallenge.templateVersion === 6 && p.activeChallenge.habitRulesVersion === 2);
const storedMind = p.tasks.find(t => t.id === 'mt_mind');
check('A: the stored habit is named for its length and carries it as a target',
  storedMind.name === 'Mental Training — 30 minutes' && storedMind.target?.value === 30 && storedMind.target?.unit === 'minutes');
check('A: seven daily habits, as before — nothing added',
  p.tasks.length === 7 && p.tasks.map(t => t.id).join() === 'mt_mind,mt_reading,mt_prayer,mt_gratitude,mt_focus,mt_physical,daily_log',
  p.tasks.map(t => t.id).join());
await openManage();
check('A: no "Template update available" prompt', !/Template update available/i.test(await page.textContent('.f4c-manage')));

// ══ B: Today ════════════════════════════════════════════════════════════════
await gotoTab('Today');
await page.waitForSelector('.check-item');
check('B: the habit reads "Mental Training — 30 minutes"',
  (await mindRow().locator('.f4-task-title').textContent()).trim() === 'Mental Training — 30 minutes');
check('B: …with its sentence', (await mindRow().locator('.check-desc').textContent()).trim() === TRAINING_DESC);
check('B: the Guide is still offered on the row', (await mindRow().locator('.check-guide').count()) === 1);
check('B: Begin Training is offered', /Begin Training/.test(await page.textContent('[data-testid="begin-training"]')));
check('B: Begin Training is not part of the checkbox row',
  await page.evaluate(() => document.querySelector('[data-testid="begin-training"]').closest('[role="checkbox"]') === null));
check('B: exactly one Mental Training habit on the page',
  (await page.locator('.check-item', { hasText: 'Mental Training' }).count()) === 1);
check('B: the old "choose a practice" panel is not shown beside it', (await page.locator('.mental-section').count()) === 0);
const dayXP = await rowXP();
check('B: the habit is worth its stamped XP', dayXP > 0 && dayXP === p.tasks.find(t => t.id === 'mt_mind').xp, `${dayXP} XP`);

// ══ C: nothing but confirmation counts ═════════════════════════════════════
const beforeDays = JSON.stringify(await days());
const beforeEarned = await earned();
await mindRow().locator('.check-guide').click();
await page.waitForSelector('.hg-close');
const guideText = await page.textContent('body');
check('C: the Guide explains the six-practice rule',
  /Dead Calm/.test(guideText) && /Inner Mirror/.test(guideText) && /once per day/i.test(guideText));
await page.click('.hg-close');
await page.waitForTimeout(250);

await openTraining();
const cards = await page.evaluate(() => [...document.querySelectorAll('.mtx-practice')].map(b => ({
  id: b.dataset.practice,
  name: b.querySelector('.mtx-practice-name').textContent,
  sub: b.querySelector('.mtx-practice-sub').textContent,
})));
check('C: the selection screen offers the six practices, each with its plain-English subtitle',
  JSON.stringify(cards.map(c => [c.id, c.name, c.sub])) === JSON.stringify(SIX.map(([a, b, c]) => [a, b, c])));
check('C: the selection screen states the length', /Mental Training — 30 minutes/.test(await page.textContent('[data-testid="training-choose"]')));
for (const [id, name, sub] of SIX) {
  await choosePractice(id);
  const s = await page.textContent('[data-testid="training-session"]');
  const steps = await page.locator('.mtx-steps li').count();
  check(`C: ${name} opens with its name, subtitle, steps and examples`,
    s.includes(name) && s.includes(sub) && steps >= 4 && /Develops/.test(s) && /Counts/.test(s) && /Doesn’t count/.test(s)
      && /30 minutes · your daily target/.test(s), `${steps} steps`);
  await backToPractices();
}
await choosePractice('dead_calm');
await page.click('.mtx-timer-start');
await page.waitForTimeout(1300);
check('C: the timer runs on request', (await page.getAttribute('[data-testid="timer"]', 'data-state')) === 'running'
  && /29:5\d/.test(await page.textContent('.mtx-clock')), await page.textContent('.mtx-clock'));
await page.click('[aria-label="Pause timer"]');
check('C: …and pauses', (await page.getAttribute('[data-testid="timer"]', 'data-state')) === 'paused');
await page.click('[aria-label="Reset timer"]');
check('C: …and resets', (await page.getAttribute('[data-testid="timer"]', 'data-state')) === 'idle');
await closeTraining();
check('C: opening, reading, choosing, timing and the Guide stored nothing', JSON.stringify(await days()) === beforeDays);
check('C: …ticked nothing', !(await mindChecked()));
check('C: …and earned nothing', (await earned()) === beforeEarned, `${await earned()}`);

// ══ D: device-free ══════════════════════════════════════════════════════════
await openTraining();
for (const [id, name, , free] of SIX) {
  await choosePractice(id);
  const has = (await page.locator('[data-testid="phone-away"]').count()) === 1;
  check(`D: ${name} ${free ? 'says to put the phone away' : 'can be done with the timer on screen'}`, has === free);
  if (free) {
    check(`D: ${name} needs no timer to be recorded`,
      /no timer needed/i.test(await page.textContent('[data-testid="phone-away"]')));
  }
  await backToPractices();
}
check('D: the selection screen says a session done away from the phone can be recorded',
  /Already trained away from your phone/.test(await page.textContent('[data-testid="training-choose"]')));

// ══ E: "Not yet" records nothing ═══════════════════════════════════════════
await choosePractice('pursuit_of_wisdom');
await page.click('.mtx-timer-start');
await page.waitForTimeout(1100);
await page.click('[aria-label="Pause timer"]');
await page.click('[data-testid="training-finish"]');
await page.waitForSelector('[data-testid="training-confirm"]');
check('E: confirming asks first, naming the practice and the minutes',
  /Record today’s Mental Training\?/.test(await page.textContent('[data-testid="training-confirm"]'))
    && /30 minutes on Pursuit of Wisdom/.test(await page.textContent('[data-testid="training-confirm"]')));
check('E: a timer stopped short says so', (await page.locator('[data-testid="training-timer-short"]').count()) === 1);
check('E: the confirm button states the XP it pays',
  new RegExp(`\\+${dayXP} XP`).test(await page.textContent('[data-testid="training-confirm-yes"]')));
await page.click('.mtx-ghost');
await page.waitForTimeout(200);
check('E: "Not yet" closes the question', (await page.locator('[data-testid="training-confirm"]').count()) === 0);
check('E: …and records nothing', JSON.stringify(await days()) === beforeDays);
check('E: the overlap with Reading is named on Pursuit of Wisdom',
  /doesn’t also count as “Read 5 pages”/.test(await page.textContent('[data-testid="training-overlap"]')));
await backToPractices();
check('E: the rule names every habit that is still done separately',
  /Read 5 pages, Prayer, Write one gratitude and Short Physical Reset are still done separately/.test(await page.textContent('[data-testid="training-rule"]'))
    && /Nothing else is ticked for you/.test(await page.textContent('[data-testid="training-rule"]')));
await closeTraining();

// ══ F: one confirmation, one completion, one reward ════════════════════════
const profBefore = JSON.stringify(await prof());
const daysBeforeAll = await days();
await recordSession('open_sky');
check('F: the completion screen pays the habit\'s XP',
  (await page.getAttribute('[data-testid="training-done"]', 'data-awarded')) === 'yes'
    && (await page.textContent('[data-testid="training-xp"]')).trim() === `+${dayXP} XP`);
check('F: …and shows the day\'s progress', /Today: 1 of 7 habits done/.test(await page.textContent('[data-testid="training-progress"]')));
let rec = await today();
check('F: the habit is complete in storage the moment it is confirmed', rec?.tasks?.mt_mind === true);
// Every field an ordinary day record already has; the session may add one.
const DAY_FIELDS = ['date', 'dayNumber', 'tasks', 'mentalTraining', 'mood', 'confidence', 'sleep', 'energy', 'recovery',
  'workoutEffort', 'stress', 'notes', 'glucoseNotes', 'hoursSlept', 'weight', 'waist', 'chest', 'arms', 'thighs',
  'morningEnergy', 'afternoonEnergy', 'overallEnergy', 'validated', 'isMWD', 'mwdTasks', 'bonusDone', 'bonusOneTime'];
check('F: the practice is recorded as its id, and nothing else about the session',
  rec?.trainingPractice === 'open_sky'
    && Object.keys(rec).filter(k => !DAY_FIELDS.includes(k)).join() === 'trainingPractice'
    && !rec.notes && !(rec.mentalTraining?.notes),
  Object.keys(rec).filter(k => !DAY_FIELDS.includes(k)).join(','));
check('F: no other habit was ticked',
  Object.entries(rec.tasks).filter(([, v]) => v).map(([k]) => k).join() === 'mt_mind', JSON.stringify(rec.tasks));
// Everything else stored is exactly as it was.
const daysAfterAll = await days();
const changedDays = Object.keys({ ...daysBeforeAll, ...daysAfterAll })
  .filter(k => JSON.stringify(daysBeforeAll[k]) !== JSON.stringify(daysAfterAll[k]));
check('F: only today\'s record changed', changedDays.length === 1, changedDays.join(','));
check('F: the attempt itself is untouched', JSON.stringify(await prof()) === profBefore);
await page.click('[data-testid="training-back"]');
await page.waitForTimeout(300);
check('F: "Back to Today" closes the screen', !(await overlayOpen()));
check('F: Today already shows the habit complete', await mindChecked());
check('F: Today\'s XP rose by exactly the habit\'s XP', (await earned()) === beforeEarned + dayXP, `${await earned()}`);
check('F: the row now says which practice it was',
  /Trained today/.test(await page.textContent('[data-testid="begin-training"]'))
    && /Open Sky/.test(await page.textContent('[data-testid="begin-training"]')));
check('F: the ring counts it', /1\s*\/?\s*7/.test(await page.textContent('.f4-ring-num').catch(() => '')) || /1 of 7/.test(await page.textContent('body')));

// ══ G: a second session pays nothing ═══════════════════════════════════════
await openTraining();
check('G: the selection screen says today is already recorded, and by which practice',
  /recorded — Open Sky/.test(await page.textContent('[data-testid="training-already-done"]')));
await choosePractice('dead_calm');
check('G: the action reads "Finish session"', /Finish session/.test(await page.textContent('[data-testid="training-finish"]')));
await page.click('[data-testid="training-finish"]');
check('G: the question says it is already recorded',
  /already recorded/i.test(await page.textContent('[data-testid="training-confirm"]')));
await page.click('[data-testid="training-confirm-yes"]');
await page.waitForSelector('[data-testid="training-done"]');
check('G: the completion screen pays nothing',
  (await page.getAttribute('[data-testid="training-done"]', 'data-awarded')) === 'no'
    && (await page.locator('[data-testid="training-xp"]').count()) === 0
    && /no XP was added/.test(await page.textContent('[data-testid="training-done"]')));
await page.click('[data-testid="training-back"]');
rec = await today();
check('G: the completion and the first practice stand', rec.tasks.mt_mind === true && rec.trainingPractice === 'open_sky');
check('G: XP did not move', (await earned()) === beforeEarned + dayXP);

// ══ H: undo ═════════════════════════════════════════════════════════════════
await mindRow().click();
await page.waitForTimeout(250);
check('H: the row still unticks the habit', !(await mindChecked()) && (await today()).tasks.mt_mind === false);
check('H: …taking its XP back', (await earned()) === beforeEarned);
check('H: …and Begin Training is offered again', /Begin Training/.test(await page.textContent('[data-testid="begin-training"]')));
await recordSession('inner_vision');
check('H: re-recording pays once', (await page.getAttribute('[data-testid="training-done"]', 'data-awarded')) === 'yes');
await page.click('[data-testid="training-back"]');
check('H: …to the same total', (await earned()) === beforeEarned + dayXP, `${await earned()}`);
check('H: …and records the practice that counted', (await today()).trainingPractice === 'inner_vision');
await mindRow().click(); await page.waitForTimeout(150);
await mindRow().click(); await page.waitForTimeout(250);
check('H: ticking by hand still works too, once', (await mindChecked()) && (await earned()) === beforeEarned + dayXP);

// ══ I: reload ═══════════════════════════════════════════════════════════════
const beforeReload = JSON.stringify(await days());
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 15000 });
await gotoTab('Today');
await page.waitForSelector('.check-item');
check('I: the completion survives a reload', await mindChecked());
check('I: …so does the practice', /Inner Vision/.test(await page.textContent('[data-testid="begin-training"]')));
check('I: …and nothing was rewritten by loading', JSON.stringify(await days()) === beforeReload);
check('I: …and the XP is the same', (await earned()) === beforeEarned + dayXP);

// ══ J: navigation ═══════════════════════════════════════════════════════════
await page.evaluate(() => { const m = document.querySelector('.main-content'); if (m) m.scrollTop = 260; });
const scrollBefore = await page.evaluate(() => document.querySelector('.main-content')?.scrollTop || 0);
await openTraining();
check('J: the training screen covers Today', await page.evaluate(() => {
  const r = document.querySelector('[data-testid="mental-training"]').getBoundingClientRect();
  return r.top === 0 && r.height >= window.innerHeight - 1;
}));
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check('J: Escape closes it', !(await overlayOpen()));
check('J: …back where Today was', Math.abs((await page.evaluate(() => document.querySelector('.main-content')?.scrollTop || 0)) - scrollBefore) < 2);
await openTraining();
await choosePractice('moving_stillness');
await backToPractices();
check('J: "Practices" goes back to the six', (await page.locator('.mtx-practice').count()) === 6);
await closeTraining();
check('J: ✕ closes it', !(await overlayOpen()));
await gotoTab('Home');
await gotoTab('Today');
check('J: Today is intact after leaving and coming back', await mindChecked());

// Begin Training is offered for today only. Another day is corrected with its
// checkbox, like every other habit.
await page.click('.day-sel-btn[aria-label="Next day"]');
await page.waitForTimeout(300);
check('J: another day has no Begin Training', (await page.locator('[data-testid="begin-training"]').count()) === 0);
check('J: …but still has the habit to tick', (await page.locator('.check-item', { hasText: 'Mental Training —' }).count()) === 1);
await page.click('.day-sel-btn[aria-label="Previous day"]');
await page.waitForTimeout(300);

// ══ K: the other profile ════════════════════════════════════════════════════
const meDays = JSON.stringify(await days('me'));
const meProf = JSON.stringify(await prof('me'));
const meAccent = await page.evaluate(() => getComputedStyle(document.querySelector('.mt-launch-go')).color);
await page.evaluate(() => localStorage.setItem('activeProfile', JSON.stringify('girlfriend')));
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 15000 });
await startMT({ mode: 'Beginner' });
const gf = await prof('girlfriend');
check('K: the other profile starts its own attempt at Beginner\'s 5 minutes',
  gf.activeChallenge.mentalTraining?.minutes === 5 && gf.tasks.find(t => t.id === 'mt_mind').name === 'Mental Training — 5 minutes');
check('K: its card layout offers Begin Training under the habit',
  (await page.locator('.mt-task .gf-task-card').count()) === 1 && (await page.locator('[data-testid="begin-training"]').count()) === 1);
const gfAccent = await page.evaluate(() => getComputedStyle(document.querySelector('.mt-launch-go')).color);
check('K: each profile in its own colour — purple, then pink',
  /167, 139, 250/.test(meAccent) && /244, 114, 182/.test(gfAccent), `${meAccent} / ${gfAccent}`);
await recordSession('moving_stillness');
await page.click('[data-testid="training-back"]');
check('K: completing on this profile completes this profile\'s habit', (await today('girlfriend'))?.tasks?.mt_mind === true
  && (await today('girlfriend')).trainingPractice === 'moving_stillness');
check('K: the first profile\'s days and attempt are untouched',
  JSON.stringify(await days('me')) === meDays && JSON.stringify(await prof('me')) === meProf);

// ══ L: attempts started before the practices ═══════════════════════════════
const LEGACY_TASKS = [
  { id: 'mt_mind', name: 'Mental Training — 5 minutes', icon: '🧘', color: '#A78BFA', xp: 64, keystone: 3, habitKey: 'meditation' },
  { id: 'mt_reading', name: 'Read 5 pages', desc: '5 pages of a book you are reading. Paper or ebook — any book counts.', icon: '📚', xp: 43, keystone: 2, habitKey: 'reading', guideId: 'mental:reading' },
  { id: 'mt_prayer', name: 'Prayer', desc: 'A few deliberate moments of prayer, in whatever form it takes for you.', icon: '🙏', xp: 43, keystone: 2, habitKey: 'prayer' },
  { id: 'mt_gratitude', name: 'Write one gratitude', icon: '📝', xp: 21, keystone: 1, habitKey: 'gratitude' },
  { id: 'mt_focus', name: '60-min phone-free focus block', icon: '🎯', xp: 21, keystone: 1, habitKey: 'focus_block' },
  { id: 'mt_physical', name: 'Short Physical Reset — 10 minutes', icon: '🚶', xp: 0, keystone: 0, habitKey: 'movement' },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 21, keystone: 0, habitKey: 'daily_log' },
];
async function seedMT({ templateVersion = 6, mentalTraining = null, habitRulesVersion = undefined, tasks = LEGACY_TASKS, dayRecords = {} } = {}) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
  await page.evaluate((cfg) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 7;
    p.me.xpPenalties = false;
    p.me.challengeStart = cfg.start;
    p.me.activeChallenge = {
      templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard',
      durationDays: 21, templateVersion: cfg.templateVersion, passingScore: 70, keystoneRequirement: 65,
      xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 213, coldExposureUpgradeEnabled: false,
      ...(cfg.habitRulesVersion ? { habitRulesVersion: cfg.habitRulesVersion } : {}),
      ...(cfg.mentalTraining ? { mentalTraining: cfg.mentalTraining } : {}),
    };
    p.me.tasks = cfg.tasks.map((t, i) => ({ ...t, source: 'template', order: i }));
    p.me.bonusMissions = [];
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({ me: cfg.dayRecords, girlfriend: {} }));
  }, { start: offset(-2), templateVersion, mentalTraining, habitRulesVersion, tasks, dayRecords });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
  await gotoTab('Today');
  await page.waitForSelector('.check-item', { timeout: 15000 });
}

// A legacy day with the old panel's own record on it.
const legacyDay = { 2: { date: offset(-1), dayNumber: 2, tasks: { mt_mind: true }, mentalTraining: { selected: 'breathwork', completed: true, notes: 'kept' } } };
await seedMT({ dayRecords: legacyDay });
const legacyStored = JSON.stringify(await prof());
check('L: a legacy attempt keeps its own name', (await mindRow().locator('.f4-task-title').textContent()).trim() === 'Mental Training — 5 minutes');
check('L: …and its original wording, prayer included',
  /Breathwork, meditation or prayer/.test(await mindRow().locator('.check-desc').textContent()));
check('L: …and no guide, as it started', (await mindRow().locator('.check-guide').count()) === 0);
check('L: it is not offered Begin Training', (await page.locator('[data-testid="begin-training"]').count()) === 0);
check('L: it keeps the panel it always had', (await page.locator('.mental-section').count()) === 1);
check('L: loading it rewrote nothing', JSON.stringify(await prof()) === legacyStored);
await openManage();
check('L: no update prompt for it either', !/Template update available/i.test(await page.textContent('.f4c-manage')));

// An older template version: the sync it is offered keeps it a legacy attempt.
await seedMT({ templateVersion: 5 });
await openManage();
check('L: an attempt on an older template version is offered its usual sync',
  /Template update available/i.test(await page.textContent('.f4c-manage')));
await page.locator('button', { hasText: 'Update template tasks' }).click();
await page.waitForTimeout(400);
p = await prof();
check('L: syncing a legacy attempt does not turn it into a six-practice one',
  !p.activeChallenge.mentalTraining && p.tasks.find(t => t.id === 'mt_mind').name === 'Mental Training — 5 minutes');
await gotoTab('Today');
check('L: …and Today still has no Begin Training', (await page.locator('[data-testid="begin-training"]').count()) === 0);

// A stamped attempt on an older template version keeps its minutes through a sync.
const STAMPED = LEGACY_TASKS.map(t => t.id === 'mt_mind'
  ? { ...t, name: 'Mental Training — 30 minutes', desc: TRAINING_DESC, target: { value: 30, unit: 'minutes', direction: 'atLeast' } } : t);
await seedMT({ templateVersion: 5, mentalTraining: { version: 1, minutes: 30 }, habitRulesVersion: 2, tasks: STAMPED });
await openManage();
await page.locator('button', { hasText: 'Update template tasks' }).click();
await page.waitForTimeout(400);
p = await prof();
check('L: a sync keeps a six-practice attempt at its own length',
  p.tasks.find(t => t.id === 'mt_mind').name === 'Mental Training — 30 minutes' && p.activeChallenge.mentalTraining.minutes === 30);
await gotoTab('Today');
check('L: …with Begin Training still there', (await page.locator('[data-testid="begin-training"]').count()) === 1);

// ══ O: an attempt already running at Standard's earlier 15 minutes ══════════
// Stored exactly as an attempt started before Standard's minimum became 10:
// stamped with 15 minutes. The new options apply to new attempts only.
const AT_15 = LEGACY_TASKS.map(t => t.id === 'mt_mind'
  ? { ...t, name: 'Mental Training — 15 minutes', desc: TRAINING_DESC, target: { value: 15, unit: 'minutes', direction: 'atLeast' } } : t);
await seedMT({ mentalTraining: { version: 1, minutes: 15 }, habitRulesVersion: 2, tasks: AT_15 });
const at15Stored = JSON.stringify(await prof());
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 15000 });
await gotoTab('Today');
await page.waitForSelector('.check-item', { timeout: 15000 });
check('O: a Standard attempt started at 15 minutes still reads 15 on Today',
  (await mindRow().locator('.f4-task-title').textContent()).trim() === 'Mental Training — 15 minutes');
check('O: opening Forge rewrote nothing about it — stamp, habit, XP', JSON.stringify(await prof()) === at15Stored);
await openTraining();
check('O: Begin Training states its own 15 minutes', /Mental Training — 15 minutes/.test(await page.textContent('[data-testid="training-choose"]')));
await choosePractice('dead_calm');
check('O: …and the session counts toward 15, not the new 10',
  /15 minutes · your daily target/.test(await page.textContent('[data-testid="training-session"]')));
await closeTraining();
await openManage();
check('O: it is not offered an update or a new length', !/Template update available/i.test(await page.textContent('.f4c-manage')));
await gotoTab('Today');
await page.waitForSelector('.check-item', { timeout: 15000 });

// ══ M: widths ═══════════════════════════════════════════════════════════════
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: w === 320 ? 640 : 844 });
  await page.waitForTimeout(250);
  const todayFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  await openTraining();
  const chooseFits = await page.evaluate(() => {
    const el = document.querySelector('.mtx');
    return el.scrollWidth <= el.clientWidth && document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  await choosePractice('pursuit_of_wisdom');
  const session = await page.evaluate(() => {
    const el = document.querySelector('.mtx');
    const btn = document.querySelector('[data-testid="training-finish"]').getBoundingClientRect();
    const timer = document.querySelector('[data-testid="timer"]').getBoundingClientRect();
    return {
      fits: el.scrollWidth <= el.clientWidth,
      finishVisible: btn.bottom <= window.innerHeight && btn.top >= 0 && btn.width > 200,
      timerVisible: timer.bottom <= btn.top + 1 && timer.top >= 0,
    };
  });
  check(`M: ${w}px — Today, the six and a session fit without sideways scrolling`, todayFits && chooseFits && session.fits);
  check(`M: ${w}px — the finish action and the timer stay on screen`, session.finishVisible && session.timerVisible, JSON.stringify(session));
  await closeTraining();
}
await page.setViewportSize({ width: 390, height: 844 });

// ══ N: as a Support Challenge ═══════════════════════════════════════════════
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 15000 });
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = start;
  p.me.xpPenalties = false;
  p.me.activeChallenge = {
    xpEconomyVersion: 2, templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard',
    durationDays: 30, templateVersion: 3, passingScore: 70, keystoneRequirement: 65, weeklyRequirementsStartDate: '2099-01-01',
    effortTier: 'medium_hard', dailyBudget: 300, habitRulesVersion: 2,
  };
  p.me.tasks = [
    { id: 'fl_protein', name: 'Hit protein goal', icon: '🥩', xp: 60, keystone: 3, habitKey: 'protein_target', source: 'template', order: 0, challenges: ['primary'] },
    { id: 'fl_steps', name: 'Walk 8,000+ steps', icon: '🚶', xp: 40, keystone: 2, habitKey: 'daily_steps', source: 'template', order: 1, challenges: ['primary'] },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0, habitKey: 'daily_log', source: 'template', order: 2, challenges: ['primary'] },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
}, offset(-3));
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 15000 });
await gotoTab('Challenges');
await page.locator('.acc-add-support').click();
await page.waitForTimeout(300);
await page.locator('.sup-option', { hasText: 'Mental Training Phase' }).click();
await page.waitForSelector('[data-testid="sup-training-minutes"]');
const supChips = await page.evaluate(() => [...document.querySelectorAll('[data-testid="sup-training-minutes"] .sup-chip')]
  .map(b => ({ t: b.textContent, on: b.getAttribute('aria-pressed') === 'true', off: b.disabled })));
check('N: adding Mental Training as support asks for its daily length too',
  supChips.length === 4 && supChips[0].off && supChips[1].on && /^10 min · Recommended$/.test(supChips[1].t.trim())
    && !supChips[2].off && !supChips[3].off, JSON.stringify(supChips));
await page.locator('[data-testid="sup-training-minutes"] .sup-chip', { hasText: '30 min' }).click();
await page.locator('.sup-add-list', { hasText: 'Mental Training — 30 minutes' }).waitFor({ timeout: 3000 }).catch(() => {});
check('N: the preview lists the habit at the chosen length',
  /Mental Training — 30 minutes/.test(await page.textContent('.sup-confirm')));
await page.locator('.sup-confirm .btn-primary', { hasText: 'Add Support Challenge' }).click();
await page.waitForTimeout(500);
p = await prof();
check('N: the support attempt is stamped with its length',
  p.supportChallenge?.mentalTraining?.minutes === 30 && p.tasks.find(t => t.id === 'mt_mind')?.name === 'Mental Training — 30 minutes');
await gotoTab('Today');
await page.waitForSelector('.lane-section.support');
check('N: Begin Training appears in the support lane, under the habit',
  (await page.locator('.lane-section.support [data-testid="begin-training"]').count()) === 1);
const supBefore = await today();
await recordSession('dead_calm');
await page.click('[data-testid="training-back"]');
const supAfter = await today();
check('N: completing it ticks the support habit and nothing else',
  supAfter?.tasks?.mt_mind === true
    && Object.entries(supAfter.tasks).filter(([, v]) => v).map(([k]) => k).join() === 'mt_mind', JSON.stringify(supAfter?.tasks));
check('N: the primary\'s habits are untouched', !supBefore?.tasks?.fl_protein && !supAfter.tasks.fl_protein && !supAfter.tasks.fl_steps);

// ══ summary ═════════════════════════════════════════════════════════════════
const relevant = errors.filter(e => !/favicon|manifest|service worker|sw\.js/i.test(e));
check('no page errors', relevant.length === 0, relevant.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
