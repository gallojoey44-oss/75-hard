/**
 * ⚡ Fat Loss HARD MODE end to end.
 *
 * Walks the real flows: the Hard start path with its safety screen and protein
 * setup, the daily panel, real photo capture into IndexedDB (auto-completing the
 * task), the differentiated weekly cardio, the four-week arc, Day 30 completion
 * with the before/after report — and that starting Standard is completely
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
  await page.waitForTimeout(350);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

/** Read the photo store directly, so we verify real persistence. */
const storedPhotos = (profileId = 'me') => page.evaluate((pid) => new Promise((resolve) => {
  const req = indexedDB.open('forge-photos', 1);
  req.onsuccess = () => {
    const db = req.result;
    try {
      const store = db.transaction('photos', 'readonly').objectStore('photos');
      const all = store.index('profileId').getAll(pid);
      all.onsuccess = () => resolve((all.result || []).map(r => ({
        key: r.key, dayNumber: r.dayNumber, bytes: r.bytes, width: r.width, height: r.height,
      })).sort((a, b) => a.dayNumber - b.dayNumber));
      all.onerror = () => resolve([]);
    } catch { resolve([]); }
  };
  req.onerror = () => resolve([]);
}), profileId);

async function reset() {
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('activeProfile', JSON.stringify('me'));
    await new Promise((r) => { const d = indexedDB.deleteDatabase('forge-photos'); d.onsuccess = r; d.onerror = r; d.onblocked = r; });
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(300);
}

/** A real PNG, uploaded through the actual file input. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAV0lEQVR42u3QMQEAAAgDoC251a3g' +
  'LwaSTDlWFxERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERE' +
  'RERERERERERERERERERERERF5egF7YAABIiKKCwAAAABJRU5ErkJggg==', 'base64');

async function uploadPhoto() {
  const input = page.locator('.flh-photo input[type=file]');
  await input.setInputFiles({ name: 'progress.png', mimeType: 'image/png', buffer: PNG_1PX });
  await page.waitForTimeout(900);
}

/** Start Fat Loss at a given variant through the real library flow. */
async function startFatLoss({ variant = 'hard', proteinMode = null, flags = ['none'] } = {}) {
  await gotoTab('Challenges');
  await page.waitForTimeout(400);
  const card = page.locator('.challenge-card', { hasText: 'Fat Loss Challenge' });
  await card.locator('.challenge-card-header').click();
  await page.waitForTimeout(400);
  const tab = { beginner: /^Beginner/, standard: /^Standard/, hard: /^Hard/ }[variant];
  await card.locator('button', { hasText: tab }).first().click();
  await page.waitForTimeout(300);
  await card.locator('button', { hasText: 'Start Fat Loss Challenge' }).first().click();
  await page.waitForTimeout(600);
  if (variant === 'hard') {
    // The existing Hard warning, then the new Hard Mode setup.
    const cont = page.locator('.modal-card button', { hasText: /continue|understand|i'm ready|start/i }).last();
    if (await cont.count()) { await cont.click(); await page.waitForTimeout(500); }
    if (proteinMode === 'fixed') {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.flh-mode')].find(x => /One fixed number/i.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(250);
    }
    for (const f of flags) {
      await page.evaluate((label) => {
        const l = [...document.querySelectorAll('.flh-safety .flh-check')]
          .find(x => new RegExp(label, 'i').test(x.textContent));
        if (l) l.querySelector('input').click();
      }, { none: 'None of these', lean: 'already very lean', ed: 'eating disorder' }[f] || f);
      await page.waitForTimeout(200);
    }
    return;   // caller finishes (or asserts on the flagged state)
  }
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('Because I want to finish what I start.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Start Today' }).first().click();
  await page.waitForTimeout(700);
}

async function finishHardStart() {
  await page.locator('.flh-setup button', { hasText: /^Continue$/ }).first().click();
  await page.waitForTimeout(500);
  const tas = page.locator('textarea');
  const n = await tas.count();
  for (let i = 0; i < n; i++) await tas.nth(i).fill('Because I want to finish what I start.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Start Today' }).first().click();
  await page.waitForTimeout(800);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ The library card ══════════════════════════════════════════════════════
await reset();
await gotoTab('Challenges');
await page.waitForTimeout(400);
const card = page.locator('.challenge-card', { hasText: 'Fat Loss Challenge' });
check('the Fat Loss Challenge is still in the library', (await card.count()) === 1);
await card.locator('.challenge-card-header').click();
await page.waitForTimeout(400);
check('it still offers all three difficulty modes',
  (await card.locator('button', { hasText: /^Beginner/ }).count()) === 1 &&
  (await card.locator('button', { hasText: /^Standard/ }).count()) === 1 &&
  (await card.locator('button', { hasText: /^Hard/ }).count()) === 1);
await card.locator('button', { hasText: /^Hard/ }).first().click();
await page.waitForTimeout(400);
const hardText = await card.textContent();
check('Hard advertises 10,000 steps', /10,000\+ steps/.test(hardText));
// Scoped to Hard's REQUIREMENTS. The card also carries the Fat Loss program's
// shared education, which accurately says fat loss depends on energy balance —
// that is not a Hard Mode requirement and is shared by all three variants.
const hardReqs = await card.locator('.tpl-variant-panel .tpl-task-list').first().textContent();
check('Hard requires the fullness habit', /Stop eating at ~90% full/.test(hardReqs));
check('Hard requires NO calorie target',
  !/calorie|deficit|kcal/i.test(hardReqs), hardReqs.slice(0, 140));
check('Hard advertises the three differentiated cardio sessions',
  /Zone 2–3 cardio ×2/.test(hardText) && /Interval session ×1/.test(hardText));
check('Hard advertises resistance training ×3', /Resistance training ×3/.test(hardText));
check('Hard advertises the weekly waist measurement and review',
  /Waist measurement ×1/.test(hardText) && /Weekly review ×1/.test(hardText));
check('Hard frames results as a typical target, not a guarantee',
  /Typical target/.test(hardText) && /Results vary/.test(hardText));
check('the interval session is not described as 30 flat-out minutes',
  /not 30 minutes flat out/.test(hardText));

// ══ Standard is completely unaffected ═════════════════════════════════════
await reset();
await startFatLoss({ variant: 'standard' });
const pStd = await prof();
check('starting Standard creates a Standard attempt',
  pStd.activeChallenge?.templateId === 'fat_loss_phase' && pStd.activeChallenge?.variant === 'standard');
check('Standard keeps its original 7 tasks', pStd.tasks.length === 7, JSON.stringify(pStd.tasks.map(t => t.id)));
check('Standard has no fullness habit', !pStd.tasks.some(t => t.id === 'fl_fullness'));
check('Standard keeps its 8,000-step target',
  pStd.tasks.find(t => t.id === 'fl_steps').target.value === 8000);
check('Standard gets NO per-attempt weekly defs — it uses the legacy ones',
  !pStd.activeChallenge?.weeklyRequirementDefs);
check('Standard has no Hard Mode config block', !pStd.activeChallenge?.fatLossHard);
await gotoTab('Today');
await page.waitForTimeout(400);
check('the Hard Mode panel does not appear on Standard', (await page.locator('.flh-panel').count()) === 0);
check('Standard still shows its legacy weekly requirements',
  /Lifting/i.test(await page.textContent('body')));

// ══ The Hard start flow ═══════════════════════════════════════════════════
await reset();
await startFatLoss({ variant: 'hard', flags: [] });
check('the Hard Mode setup screen opens', (await page.locator('.flh-setup').count()) === 1);
const setupText = await page.textContent('.flh-setup');
check('it positions Hard against Normal', /Normal Fat Loss teaches the habits/.test(setupText));
check('it offers both protein modes',
  /Per pound of target weight/.test(setupText) && /One fixed number/.test(setupText));
check('it states what Hard Mode means and does not mean',
  /More structure/.test(setupText) && /Crash dieting/.test(setupText) && /Daily HIIT/.test(setupText));
check('it screens for the contraindicated situations',
  /already very lean, or underweight/.test(setupText) &&
  /pregnant/i.test(setupText) && /eating disorder/i.test(setupText));
check('Continue is blocked until the safety question is answered',
  await page.locator('.flh-setup button', { hasText: /^Continue$/ }).isDisabled());
check('it says so', /Answer the question above/.test(setupText));

// ── Flagging a contraindication surfaces guidance instead of the target ───
await page.evaluate(() => {
  const l = [...document.querySelectorAll('.flh-safety .flh-check')]
    .find(x => /already very lean/i.test(x.textContent));
  if (l) l.querySelector('input').click();
});
await page.waitForTimeout(350);
const flaggedText = await page.textContent('.flh-setup');
check('flagging "very lean" surfaces guidance', /not the right challenge right now/i.test(flaggedText));
check('the guidance is not framed as a discipline failure',
  /not a judgement about discipline/i.test(flaggedText));
check('alternative challenges are offered',
  /Energy Reset/.test(flaggedText) && /Muscle Building/.test(flaggedText) && /Forge Daily/.test(flaggedText));
check('Continue stays blocked until the guidance is acknowledged',
  await page.locator('.flh-setup button', { hasText: /^Continue$/ }).isDisabled());
await page.evaluate(() => {
  const l = [...document.querySelectorAll('.flh-flagged .flh-check')].pop();
  if (l) l.querySelector('input').click();
});
await page.waitForTimeout(300);
check('acknowledging the guidance allows the user to proceed anyway',
  !(await page.locator('.flh-setup button', { hasText: /^Continue$/ }).isDisabled()));

// ══ Starting Hard Mode ════════════════════════════════════════════════════
await reset();
await startFatLoss({ variant: 'hard', flags: ['none'] });
await finishHardStart();
const p = await prof();
check('starting Hard creates a Hard Fat Loss attempt',
  p.activeChallenge?.templateId === 'fat_loss_phase' && p.activeChallenge?.variant === 'hard');
check('it received the Hard Mode task list', p.tasks.length === 8, JSON.stringify(p.tasks.map(t => t.id)));
check('there is NO calorie-deficit task', !p.tasks.some(t => t.id === 'fl_deficit'));
check('the fullness habit is present', p.tasks.some(t => t.id === 'fl_fullness'));
check('the step target is 10,000', p.tasks.find(t => t.id === 'fl_steps').target.value === 10000);
check('the attempt carries its own Hard Mode config', !!p.activeChallenge?.fatLossHard);
check('the attempt carries its own weekly requirement defs',
  (p.activeChallenge?.weeklyRequirementDefs || []).length === 5);
check('the weekly defs are 3 lifts + 2 Zone 2–3 + 1 interval + waist + review', await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('profiles')).me.activeChallenge.weeklyRequirementDefs;
  const by = Object.fromEntries(d.map(x => [x.id, x.perWeek]));
  return by.lifting === 3 && by.zone2 === 2 && by.intervals === 1 && by.waist === 1 && by.review === 1;
}));
check('safety flags were recorded as none', (p.activeChallenge.fatLossHard.safetyFlags || []).length === 0);

// ══ The daily panel ═══════════════════════════════════════════════════════
await gotoTab('Today');
await page.waitForTimeout(500);
check('the Hard Mode panel appears', (await page.locator('.flh-panel').count()) === 1);
const panelText = await page.textContent('.flh-panel');
check('it shows Day 1 of 30', /Day 1 of 30/.test(panelText));
check('it shows the Week 1 emphasis', /Week 1/.test(panelText) && /Lock In/.test(panelText));
check('week 1 is about establishing execution', /perfect execution/i.test(panelText));
check('the photo capture control is present', (await page.locator('.flh-photo').count()) >= 1);
check('the photo is labelled as required',
  /Required/.test(await page.textContent('.flh-photo')));
check('privacy is stated on the capture control',
  /stay on this device/i.test(await page.textContent('.flh-photo')));

// ══ Real photo capture ════════════════════════════════════════════════════
check('no photos are stored before uploading', (await storedPhotos()).length === 0);
check('the photo task starts unchecked', !((await days())[1]?.tasks?.fl_photo));
await uploadPhoto();
const stored = await storedPhotos();
check('uploading stores a real photo record', stored.length === 1, JSON.stringify(stored));
check('it is keyed to this profile and day', stored[0]?.key === 'me:1' && stored[0]?.dayNumber === 1);
check('the stored image has real bytes', (stored[0]?.bytes || 0) > 0);
check('recording the photo auto-completes the task', !!((await days())[1]?.tasks?.fl_photo));
check('the control now shows the photo', (await page.locator('.flh-photo-frame img').count()) === 1);
check('and reports it as recorded', /Recorded/.test(await page.textContent('.flh-photo')));

// Removing the photo must untick the task — it can never claim a photo exists.
await page.locator('.flh-photo button', { hasText: 'Remove' }).first().click();
await page.waitForTimeout(700);
check('removing the photo deletes it from storage', (await storedPhotos()).length === 0);
check('and unticks the task', !((await days())[1]?.tasks?.fl_photo));
await uploadPhoto();
check('re-uploading restores both', (await storedPhotos()).length === 1 && !!((await days())[1]?.tasks?.fl_photo));

// Photos are scoped per profile.
check('the other profile has no photos', (await storedPhotos('girlfriend')).length === 0);

// ══ Weekly training ═══════════════════════════════════════════════════════
const bodyText = await page.textContent('body');
check('the Hard weekly requirements are shown',
  /Resistance Training/i.test(bodyText) && /Zone 2–3/.test(bodyText) && /Interval/i.test(bodyText));
check('the waist measurement is a weekly requirement', /Waist Measurement/i.test(bodyText));
check('the weekly review is a weekly requirement', /Weekly Review/i.test(bodyText));
for (const [label, type] of [['Log Lifting Session', 'lifting'], ['Log Interval Session', 'intervals'], ['Log Waist Measurement', 'waist']]) {
  const btn = page.locator('button', { hasText: new RegExp(label, 'i') }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(400); }
  check(`logging a ${type} session records it`,
    ((await prof()).weeklySessions || []).some(s => s.type === type));
}

// ══ The four-week arc ═════════════════════════════════════════════════════
async function seedHardRun({ upto = 30, withPhotos = 0, waist = true, weight = false }) {
  await reset();
  await page.evaluate(({ upto, waist, weight, start }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.challengeStart = start;
    p.me.highestRank = 8;
    p.me.activeChallenge = {
      templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'hard',
      durationDays: 30, templateVersion: 3, completionBonusXP: 500,
      passingScore: 80, keystoneRequirement: 70,
      badgeId: 'body_fat_slayer',
      fatLossHard: { proteinMode: 'perLb', targetWeightLb: 175, proteinGrams: 140, stepTarget: 10000, wholeFoodPct: 90, acknowledgedSafety: true, safetyFlags: [] },
      weeklyRequirementDefs: [
        { id: 'lifting', label: 'Resistance Training', icon: '🏋️', perWeek: 3, xp: 30, keystone: 3, logLabel: 'Log Lifting Session', unit: 'lift' },
        { id: 'zone2', label: 'Zone 2–3 Cardio', icon: '❤️', perWeek: 2, xp: 20, keystone: 2, logLabel: 'Log Zone 2–3 Session', unit: 'session' },
        { id: 'intervals', label: 'Interval Session', icon: '🔥', perWeek: 1, xp: 25, keystone: 2, logLabel: 'Log Interval Session', unit: 'session' },
        { id: 'waist', label: 'Waist Measurement', icon: '📏', perWeek: 1, xp: 15, keystone: 1, logLabel: 'Log Waist Measurement', unit: 'measurement' },
        { id: 'review', label: 'Weekly Review', icon: '🔍', perWeek: 1, xp: 10, keystone: 1, logLabel: 'Log Weekly Review', unit: 'review' },
      ],
      futureSelfLetter: { why: 'Finish what I start.', writtenAt: start },
    };
    p.me.tasks = [
      { id: 'fl_protein', name: 'Hit protein: 140–175g', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'protein_target', source: 'template', order: 0, challenges: ['primary'] },
      { id: 'fl_whole', name: 'Eat mostly whole foods (~90%)', icon: '🥗', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'whole_foods', source: 'template', order: 1, challenges: ['primary'] },
      { id: 'fl_steps', name: 'Walk 10,000+ steps', icon: '🚶', xp: 30, keystone: 2, habitKey: 'daily_steps', source: 'template', order: 2, challenges: ['primary'] },
      { id: 'fl_fullness', name: 'Stop eating at ~90% full — satisfied, not stuffed.', icon: '🍽️', xp: 30, keystone: 2, habitKey: 'fullness_control', source: 'template', order: 3, challenges: ['primary'] },
      { id: 'fl_sleep', name: 'Sleep 7.5–9 hours', icon: '😴', xp: 25, keystone: 2, habitKey: 'sleep_target', source: 'template', order: 4, challenges: ['primary'] },
      { id: 'fl_water', name: 'Hit water goal', icon: '💧', xp: 15, keystone: 1, habitKey: 'hydration', source: 'template', order: 5, challenges: ['primary'] },
      { id: 'fl_photo', name: 'Daily progress photo', icon: '📸', xp: 10, keystone: 1, habitKey: 'progress_photo', photoCapture: true, source: 'template', order: 6, challenges: ['primary'] },
      { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, habitKey: 'daily_log', source: 'template', order: 7, challenges: ['primary'] },
    ];
    const sessions = [];
    for (let wk = 0; wk < 5; wk++) {
      for (let i = 0; i < 3; i++) sessions.push({ id: `l${wk}${i}`, type: 'lifting', date: start });
      for (let i = 0; i < 2; i++) sessions.push({ id: `z${wk}${i}`, type: 'zone2', date: start });
      sessions.push({ id: `x${wk}`, type: 'intervals', date: start });
      sessions.push({ id: `w${wk}`, type: 'waist', date: start });
      sessions.push({ id: `r${wk}`, type: 'review', date: start });
    }
    p.me.weeklySessions = sessions;
    localStorage.setItem('profiles', JSON.stringify(p));
    const all = { me: {}, girlfriend: {} };
    for (let n = 1; n <= upto; n++) {
      const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + n - 1);
      const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      all.me[n] = {
        date, dayNumber: n, validated: true, notes: '',
        tasks: Object.fromEntries(p.me.tasks.map(t => [t.id, true])),
        mood: 4, confidence: 4, sleep: 4, energy: 4, recovery: 4, workoutEffort: 4, stress: 2, hoursSlept: 8,
        mentalTraining: { selected: null, completed: false, notes: '' }, bonusDone: {}, bonusOneTime: [],
        ...(waist && (n === 1 || n === upto) ? { waist: n === 1 ? 34 : 32.5 } : {}),
        ...(weight && (n === 1 || n === upto) ? { weight: n === 1 ? 185 : 181 } : {}),
      };
    }
    localStorage.setItem('allDays', JSON.stringify(all));
  }, { upto, waist, weight, start: offset(-(upto - 1)) });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 }); await page.waitForTimeout(700);
  // Seed photos through the real capture control on day 1 and the final day.
  for (let i = 0; i < withPhotos; i++) {
    const day = i === 0 ? 1 : upto;
    await page.evaluate(({ day, pid }) => new Promise((resolve) => {
      // Write directly for speed — same store, same key shape as the UI writes.
      const req = indexedDB.open('forge-photos', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'key' });
          s.createIndex('profileId', 'profileId', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const canvas = document.createElement('canvas');
        canvas.width = 40; canvas.height = 60;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = day === 1 ? '#884422' : '#2288aa';
        ctx.fillRect(0, 0, 40, 60);
        canvas.toBlob((blob) => {
          const st = db.transaction('photos', 'readwrite').objectStore('photos');
          const r = st.put({ key: `${pid}:${day}`, profileId: pid, dayNumber: day, date: null, blob, width: 40, height: 60, bytes: blob.size, takenAt: Date.now() });
          r.onsuccess = () => resolve(true);
          r.onerror = () => resolve(false);
        }, 'image/jpeg', 0.8);
      };
      req.onerror = () => resolve(false);
    }), { day, pid: 'me' });
  }
  if (withPhotos) { await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 }); await page.waitForTimeout(800); }
}

for (const [day, week, title] of [[3, 1, 'Lock In'], [10, 2, 'Build Momentum'], [17, 3, 'Push'], [26, 4, 'Finish']]) {
  await seedHardRun({ upto: day });
  await gotoTab('Today');
  await page.waitForTimeout(500);
  const t = await page.textContent('.flh-panel');
  check(`day ${day} shows Week ${week} — ${title}`, new RegExp(`Week ${week}`).test(t) && t.includes(title));
  if (week === 3) {
    check('Week 3 explicitly refuses to add restriction',
      /does NOT mean eating less/i.test(t));
    check('Week 3 warns against cutting calories or adding cardio',
      /Do not reduce calories, add extra cardio/i.test(t));
  }
}

// ══ Day 30 completion — the before/after experience ═══════════════════════
await seedHardRun({ upto: 30, withPhotos: 2, waist: true, weight: true });
await gotoTab('Home');
await page.waitForTimeout(700);
const home = await page.textContent('.dashboard');
check('Day 30 shows the Hard Mode completion report', /Hard Mode Complete/i.test(home));
check('the before/after photo pair is rendered', (await page.locator('.tf-pair .tf-frame img').count()) === 2);
check('the photos are labelled Day 1 and Day 30', await page.evaluate(() => {
  const l = [...document.querySelectorAll('.tf-frame-label')].map(e => e.textContent);
  return l.includes('Day 1') && l.includes('Day 30');
}));
check('a photo scrubber is offered', (await page.locator('.tf-scrub-range').count()) === 1);
check('the report states photos never leave the device',
  /never uploads them/i.test(await page.textContent('.tf-photos')));
check('waist change is reported', /Waist change/.test(home) && /-1\.5 in/.test(home));
check('weight change is reported when a scale was used', /Weight change/.test(home) && /-4 lb/.test(home));
check('protein adherence is reported', /Protein target hit/.test(home) && /30\/30/.test(home));
check('10k step adherence is reported', /10k steps hit/.test(home));
check('90% fullness adherence is reported', /90% fullness held/.test(home));
check('sleep adherence is reported', /Sleep target hit/.test(home));
check('lifting sessions are counted', /Lifting sessions/.test(home));
check('cardio sessions are counted and split by type',
  /Cardio sessions/.test(home) && /Zone 2–3/.test(home) && /interval/.test(home));
check('total XP earned is reported', /XP earned/.test(home));
check('the badge is awarded', /Body Fat Slayer/.test(home));
check('Forge refuses to claim a body-fat percentage change',
  /no validated body-composition measurement/i.test(home));
check('the results-vary disclaimer is shown',
  /Results vary\. Starting body composition/.test(home));

// ── The challenge works fully with no scale ──────────────────────────────
await seedHardRun({ upto: 30, withPhotos: 2, waist: true, weight: false });
await gotoTab('Home');
await page.waitForTimeout(700);
const noScale = await page.textContent('.dashboard');
check('with no weight logged, the report still renders', /Hard Mode Complete/i.test(noScale));
check('waist change still carries the result', /-1\.5 in/.test(noScale));
check('the missing weight is shown as unavailable, not zero', /Weight change/.test(noScale) && !/0 lb/.test(noScale));
check('it says the waist and photos are the measurement',
  /your waist and photos are the measurement/i.test(noScale));
check('the before/after photos still render', (await page.locator('.tf-pair .tf-frame img').count()) === 2);

// ── With no photos at all, the stats report still works ──────────────────
await seedHardRun({ upto: 30, withPhotos: 0, waist: true, weight: false });
await gotoTab('Home');
await page.waitForTimeout(600);
check('with no stored photos the report still renders', /Hard Mode Complete/i.test(await page.textContent('.dashboard')));
check('and simply omits the photo section', (await page.locator('.tf-photos').count()) === 0);

// ══ Profile isolation ═════════════════════════════════════════════════════
await seedHardRun({ upto: 5, withPhotos: 1 });
const gfBefore = await prof('girlfriend');
check('starting Hard on Male leaves the Female profile untouched',
  !gfBefore.activeChallenge && (await storedPhotos('girlfriend')).length === 0);
check('Male photos are keyed to Male only',
  (await storedPhotos('me')).every(x => x.key.startsWith('me:')));

// ══ Mobile layout ═════════════════════════════════════════════════════════
await page.setViewportSize({ width: 360, height: 740 });
await gotoTab('Today');
await page.waitForTimeout(600);
const overflow = await page.evaluate(() => ({
  body: document.body.scrollWidth - document.body.clientWidth,
  panel: (() => { const p = document.querySelector('.flh-panel'); return p ? p.scrollWidth - p.clientWidth : 0; })(),
}));
check('no horizontal overflow at 360px', overflow.body <= 1, JSON.stringify(overflow));
check('the Hard Mode panel fits the viewport', overflow.panel <= 1);
await seedHardRun({ upto: 30, withPhotos: 2 });
await page.setViewportSize({ width: 360, height: 740 });
await gotoTab('Home');
await page.waitForTimeout(700);
check('the before/after pair fits a phone viewport', await page.evaluate(() => {
  const p = document.querySelector('.tf-pair');
  return !p || p.scrollWidth - p.clientWidth <= 1;
}));
await page.setViewportSize({ width: 390, height: 844 });

// ══ No runtime errors ═════════════════════════════════════════════════════
check('no page errors across the full Hard Mode flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
