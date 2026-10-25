/**
 * 🎯 LOCK IN — the six durations, and the Habit Library.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/lock-in-library-e2e-test.mjs
 *
 * Two things are being proved here.
 *
 * First, that the education is genuinely independent of enrolment: that all
 * eight guides are readable with no challenge ever started, that the daily
 * requirements on an inactive challenge card open them, that they are still
 * there after a challenge ends, and — the part that matters most — that
 * reading one never completes a habit or moves XP.
 *
 * Second, that all six durations actually work: each one starts, stores its own
 * ramp, counts its days, and reaches 100% at its own length rather than at 14.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { openChallenge, beginSetup, passReview, pickStartDate, confirmStart, detailsText } from './helpers/challenges.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab, button')]
      .find(x => new RegExp(n, 'i').test(x.textContent));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(350);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);

async function reset() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 }); await page.waitForTimeout(300);
}

/** Start LOCK IN at a chosen duration, through the real library flow. */
async function startLockIn(duration) {
  await gotoTab('Challenges');
  await page.waitForTimeout(400);
  await openChallenge(page, 'LOCK IN');
  await beginSetup(page);
  if (duration) {
    const ok = await page.evaluate((d) => {
      const btn = [...document.querySelectorAll('.li-duration')]
        .find(b => new RegExp(`^\\s*${d} Days`).test(b.textContent || ''));
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return true;
    }, duration);
    if (!ok) throw new Error(`duration ${duration} not offered`);
    await page.waitForTimeout(300);
  }
  await page.locator('.li-setup button', { hasText: 'Continue' }).first().click();
  await page.waitForTimeout(450);
  await passReview(page);
  const tas = page.locator('textarea');
  for (let i = 0; i < await tas.count(); i++) await tas.nth(i).fill('Because scattered days cost me what I care about.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(450);
  await pickStartDate(page, 'today');
await confirmStart(page);
  await page.waitForTimeout(700);
}

// XP economy v2: LOCK IN is a medium_hard challenge, so its daily budget is 180
// at standard mode and its completion bonus is 0.20 x 180 x duration. The
// advertised figure is therefore proportional to length rather than the flat
// per-duration table the setup screen used to carry.
const LOCK_IN_BUDGET = 180;
const bonusFor = (days) => Math.round(0.20 * LOCK_IN_BUDGET * days);
const DURATIONS = [
  [7, 'Lock In Sprint', bonusFor(7)],
  [14, 'Focus Reset', bonusFor(14)],
  [21, 'Discipline Builder', bonusFor(21)],
  [30, 'High Performance', bonusFor(30)],
  [60, 'Deep Discipline', bonusFor(60)],
  [90, 'Lifestyle Transformation', bonusFor(90)],
];

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: the Habit Library with NO challenge ever started ═══════════════════
await reset();
await gotoTab('Challenges');
await page.waitForTimeout(400);
let p = await prof();
check('1: no challenge has been started', !p.activeChallenge || p.activeChallenge.templateId === 'forge_daily');
check('1: the Explore Habits & Strategies entry point is present',
  (await page.locator('.habit-library-entry').count()) === 1);
const entryText = await page.textContent('.habit-library-entry');
check('1: it says what it is and that no challenge is needed',
  /Explore Habits & Strategies/.test(entryText) && /No challenge required/i.test(entryText));
check('1: it advertises eight guides', /8 habit guides/.test(entryText), entryText.slice(0, 90));

await page.locator('.habit-library-entry').click();
await page.waitForTimeout(400);
check('1: the library opens', (await page.locator('.hl-card').count()) === 1);
check('1: all eight guides are listed', (await page.locator('.hl-row').count()) === 8);
let lib = await page.textContent('.hl-card');
check('1: it states that reading never completes a habit or awards XP',
  /never completes a habit and never awards\s+XP/i.test(lib));
check('1: all eight specified habits are there',
  ['Sleep Optimization', 'Flow Training', 'Execute Your Priorities', 'Daily Mission',
   'Physical Energy', 'Attention Training', 'Mental Recovery', 'Stress Off-Switch']
    .every(t => lib.includes(t)),
  ['Sleep Optimization', 'Flow Training', 'Execute Your Priorities', 'Daily Mission',
   'Physical Energy', 'Attention Training', 'Mental Recovery', 'Stress Off-Switch']
    .filter(t => !lib.includes(t)).join(', ') || 'all present');
check('1: the Daily Log is NOT in the library — it is tracking, not education',
  !/Daily Log/i.test(lib));
check('1: the guides are grouped by where they came from', /LOCK IN habits/i.test(lib));

// Open every guide from the library and confirm each is complete.
for (const title of ['Sleep Optimization', 'Flow Training', 'Execute Your Priorities', 'Daily Mission',
                     'Physical Energy', 'Attention Training', 'Mental Recovery', 'Stress Off-Switch']) {
  await page.locator('.hl-row', { hasText: title }).click();
  await page.waitForTimeout(250);
  const g = await page.textContent('.hg-card');
  const ok = ['Quick start', 'Why it matters', 'How to complete it', 'Optimization strategies',
              'Advanced strategies', 'Common mistakes', 'Practical examples'].every(s => g.includes(s));
  check(`1: ${title} opens with all seven blocks`, ok,
    ['Quick start', 'Why it matters', 'How to complete it', 'Optimization strategies',
     'Advanced strategies', 'Common mistakes', 'Practical examples'].filter(s => !g.includes(s)).join(', ') || '');
  // Read-only: the library must not offer a way to tick anything.
  if (title === 'Sleep Optimization') {
    check('1: a library guide shows NO completion checkbox',
      (await page.locator('.hg-check').count()) === 0);
  }
  await page.locator('.hg-close').click();
  await page.waitForTimeout(180);
}
check('1: closing a guide returns to the library, not out of it',
  (await page.locator('.hl-card').count()) === 1);

// Reading guides must not have created any progress.
const xpAfterReading = await page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
check('1: reading eight guides created no day records',
  Object.keys(await days()).length === 0, `${Object.keys(await days()).length} days`);
check('1: reading eight guides awarded no lifetime XP', xpAfterReading === 0, `${xpAfterReading}`);
await page.locator('.hl-card .hl-close').click();
await page.waitForTimeout(300);
check('1: the library closes', (await page.locator('.hl-card').count()) === 0);

// ══ 2: tappable requirements on an INACTIVE challenge card ═══════════════
await openChallenge(page, 'LOCK IN');
check('2: the inactive card lists the daily requirements',
  (await page.locator('.tpl-task-list li').count()) === 9);
check('2: eight of them are tappable',
  (await page.locator('.tpl-task-link').count()) === 8);
check('2: the Daily Log requirement is not tappable',
  (await page.locator('.tpl-task-guided', { hasText: 'Daily Log' }).count()) === 0);
const cardNote = await detailsText(page);
check('2: the card explains that tapping does not complete anything',
  /never\s+completes a habit or awards XP/i.test(cardNote));
check('2: the card stays concise — no guide prose inlined',
  !/Optimization strategies|Common mistakes|pre-flow ritual/i.test(cardNote));
check('2: the page offers all six lengths',
  JSON.stringify((await page.locator('.f4c-dur').allTextContents())
    .map(t => Number((t.match(/\d+/) || [])[0]))) === JSON.stringify([7, 14, 21, 30, 60, 90]),
  (await page.locator('.f4c-dur').allTextContents()).join(' / '));

await page.locator('.tpl-task-guided', { hasText: 'Sleep opportunity' })
  .locator('.tpl-task-link').click();
await page.waitForTimeout(400);
check('2: tapping a requirement opens its guide with no challenge active',
  (await page.locator('.hg-card').count()) === 1 &&
  /Sleep Optimization/.test(await page.textContent('.hg-title')));
check('2: that guide is read-only too', (await page.locator('.hg-check').count()) === 0);
await page.locator('.hg-close').click();
await page.waitForTimeout(300);
check('2: still no day records after opening a guide from the card',
  Object.keys(await days()).length === 0);

// ══ 3: all six durations ═════════════════════════════════════════════════
await page.locator('button', { hasText: /Start LOCK IN/i }).first().click();
await page.waitForTimeout(450);
check('3: the setup screen offers six durations', (await page.locator('.li-duration').count()) === 6);
const durText = await page.textContent('.li-durations');
for (const [d, label] of DURATIONS) {
  check(`3: ${d} days — ${label} is offered and explained`,
    new RegExp(`${d} Days — ${label}`).test(durText));
}
check('3: every duration shows its completion reward',
  DURATIONS.every(([, , xp]) => durText.includes(String(xp))),
  DURATIONS.filter(([, , xp]) => !durText.includes(String(xp))).map(([d]) => d).join(', ') || 'all shown');
check('3: 14 days is marked Recommended',
  /14 Days — Focus Reset\s*Recommended/.test(durText.replace(/\s+/g, ' ')), durText.slice(0, 60));
check('3: every duration has a one-line explanation',
  (await page.locator('.li-duration-blurb').count()) === 6);
await page.keyboard.press('Escape').catch(() => {});
await page.locator('.modal-overlay').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.waitForTimeout(300);

// Start each duration in turn and verify the stored attempt.
for (const [d, label, bonus] of DURATIONS) {
  await reset();
  await startLockIn(d);
  p = await prof();
  const cfg = p.activeChallenge?.lockIn || {};
  check(`3: starting ${d} days stores a ${d}-day attempt`,
    p.activeChallenge?.templateId === 'lock_in_14_day' && p.activeChallenge?.durationDays === d,
    `${p.activeChallenge?.durationDays}`);
  // XP economy v2: the bonus is 0.20 x daily budget x duration, so it is
  // proportional to length and worth the same per day at every duration.
  check(`3: ${d} days stores its proportional completion bonus`,
    p.activeChallenge?.completionBonusXP === Math.round(0.20 * p.activeChallenge.dailyBudget * d),
    `${p.activeChallenge?.completionBonusXP} at budget ${p.activeChallenge?.dailyBudget}`);
  check(`3: ${d} days is worth the same per day as every other length`,
    Math.abs((p.activeChallenge.completionBonusXP / d) - 0.20 * p.activeChallenge.dailyBudget) < 1,
    `${(p.activeChallenge.completionBonusXP / d).toFixed(2)}/day`);
  check(`3: ${d} days snapshots a ramp covering exactly ${d} days`,
    Array.isArray(cfg.flowStages) && cfg.flowStages[0].fromDay === 1 &&
    cfg.flowStages[cfg.flowStages.length - 1].toDay === d,
    cfg.flowStages?.map(s => `${s.minutes}m:${s.fromDay}-${s.toDay}`).join(' '));
  check(`3: ${d} days never asks for a session longer than 50 minutes`,
    cfg.flowStages.every(s => s.minutes <= 50));
  check(`3: ${d} days plans a lighter day about once a week`,
    Array.isArray(cfg.lighterDays) && cfg.lighterDays.length === Math.floor(d / 7) &&
    cfg.lighterDays.every(x => x % 7 === 0 && x <= d),
    `${cfg.lighterDays?.length} days`);
  // Every duration installs the same nine habits for the same daily total:
  // length changes the completion bonus, never the day's worth.
  check(`3: ${d} days installs the same nine tasks summing to the daily budget`,
    (p.tasks || []).length === 9 &&
    (p.tasks || []).reduce((s, t) => s + t.xp, 0) === p.activeChallenge.dailyBudget,
    `${(p.tasks || []).reduce((s, t) => s + t.xp, 0)} vs budget ${p.activeChallenge.dailyBudget}`);
}

// ══ 4: progress, streaks and completion percentage at each length ════════
// Done on the longest and the shortest, with the start date moved back so the
// day counter, the day selector and the panel all have to agree.
for (const [d] of [[7], [90]]) {
  await reset();
  await startLockIn(d);
  await page.evaluate((dd) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    const dt = new Date(); dt.setDate(dt.getDate() - (dd - 1));
    p.me.challengeStart = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    localStorage.setItem('profiles', JSON.stringify(p));
  }, d);
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 8000 });
  await gotoTab('Today');
  await page.waitForTimeout(500);
  const panel = await page.textContent('.li-panel');
  check(`4: on the final day of a ${d}-day run the counter reads Day ${d} of ${d}`,
    new RegExp(`Day ${d} of ${d}`).test(panel), panel.slice(0, 60));
  check(`4: the final day of a ${d}-day run is inside its own ramp`,
    /Today's flow target/.test(panel) && /min/.test(panel));
  await gotoTab('Home');
  await page.waitForTimeout(500);
  const home = await page.textContent('.dashboard');
  check(`4: the home screen counts the ${d}-day run to its own length, not to 14`,
    new RegExp(`(Day )?${d}\\s*(of|/)\\s*${d}`).test(home.replace(/\s+/g, ' ')) || new RegExp(`${d} of ${d}`).test(home),
    (home.match(/Day \d+ of \d+/) || [])[0] || home.slice(0, 60));
}

// ══ 5: guides survive the challenge ending ═══════════════════════════════
await reset();
await startLockIn(7);
// Complete the attempt from the Challenges screen the way a user would end it.
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const dt = new Date(); dt.setDate(dt.getDate() - 6);
  p.me.challengeStart = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Challenges');
await page.waitForTimeout(500);
// End it however the UI allows; if there is no end control, clear it directly —
// what is being tested is guide availability afterwards, not the end flow.
const ended = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')]
    .find(x => /Complete Challenge|End Challenge|Finish Challenge/i.test(x.textContent));
  if (b) { b.click(); return true; }
  return false;
});
if (!ended) {
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.activeChallenge = null;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 8000 });
}
await page.waitForTimeout(700);
await gotoTab('Challenges');
await page.waitForTimeout(500);
p = await prof();
check('5: the challenge is no longer running',
  !p.activeChallenge || p.activeChallenge.templateId !== 'lock_in_14_day' ||
  !!(await arch()).length);
check('5: the Habit Library is still there after the challenge ended',
  (await page.locator('.habit-library-entry').count()) === 1);
await page.locator('.habit-library-entry').click();
await page.waitForTimeout(400);
check('5: all eight guides are still readable', (await page.locator('.hl-row').count()) === 8);
await page.locator('.hl-row', { hasText: 'Flow Training' }).click();
await page.waitForTimeout(300);
check('5: a guide still opens in full after the challenge ended',
  /Quick start/i.test(await page.textContent('.hg-card')));
check('5: and it is still read-only', (await page.locator('.hg-check').count()) === 0);
await page.locator('.hg-close').click();
await page.waitForTimeout(200);
await page.locator('.hl-card .hl-close').click();
await page.waitForTimeout(300);

// ══ 6: during an active challenge, guides stay tied to the day's state ═══
await reset();
await startLockIn(30);
await gotoTab('Today');
await page.waitForTimeout(500);
check('6: the Today screen guides DO offer a checkbox (tracking is live)',
  (await page.locator('.check-guide').count()) === 8);
await page.locator('.check-item', { hasText: 'Attention training' }).locator('.check-guide').click();
await page.waitForTimeout(400);
check('6: a guide opened from Today has a checkbox', (await page.locator('.hg-check').count()) === 1);
let d1 = await days();
check('6: opening it did not complete the habit', d1[1]?.tasks?.li_attention !== true);
await page.locator('.hg-check').click();
await page.waitForTimeout(400);
d1 = await days();
check('6: ticking it inside the guide does complete the habit', d1[1]?.tasks?.li_attention === true);
await page.locator('.hg-close').click();
await page.waitForTimeout(300);

// Same guide, same content, from the library — and still read-only there.
await gotoTab('Challenges');
await page.waitForTimeout(400);
await page.locator('.habit-library-entry').click();
await page.waitForTimeout(400);
await page.locator('.hl-row', { hasText: 'Attention Training' }).click();
await page.waitForTimeout(300);
const fromLibrary = await page.textContent('.hg-card');
check('6: the library shows the same guide content', /Build the endurance that focused work spends/i.test(fromLibrary));
check('6: the library copy has no checkbox even with a challenge running',
  (await page.locator('.hg-check').count()) === 0);
await page.locator('.hg-close').click();
await page.waitForTimeout(200);
await page.locator('.hl-card .hl-close').click();
await page.waitForTimeout(300);
const d2 = await days();
check('6: reading from the library changed nothing',
  JSON.stringify(d2[1]?.tasks) === JSON.stringify(d1[1]?.tasks));

// ══ 7: mobile layout ═════════════════════════════════════════════════════
await page.locator('.habit-library-entry').click();
await page.waitForTimeout(400);
let overflow = await page.evaluate(() => {
  const el = document.querySelector('.hl-card');
  return { page: document.documentElement.scrollWidth - window.innerWidth, card: el.scrollWidth - el.clientWidth };
});
check('7: the library does not scroll sideways at 390px',
  overflow.page <= 1 && overflow.card <= 1, JSON.stringify(overflow));
await page.locator('.hl-row').first().click();
await page.waitForTimeout(300);
overflow = await page.evaluate(() => {
  const el = document.querySelector('.hg-card');
  const r = el.getBoundingClientRect();
  return {
    page: document.documentElement.scrollWidth - window.innerWidth,
    card: el.scrollWidth - el.clientWidth,
    inViewport: r.left >= -1 && r.right <= window.innerWidth + 1,
  };
});
check('7: a guide opened from the library sits inside the viewport',
  overflow.page <= 1 && overflow.card <= 1 && overflow.inViewport, JSON.stringify(overflow));
await page.locator('.hg-close').click();
await page.waitForTimeout(200);
await page.locator('.hl-card .hl-close').click();
await page.waitForTimeout(250);

await page.locator('.challenge-card', { hasText: 'LOCK IN' }).first().locator('.challenge-card-header').click();
await page.waitForTimeout(400);
const cardOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('7: the expanded challenge card does not scroll sideways', cardOverflow <= 1, `${cardOverflow}px`);

// ══ 9: an attempt started BEFORE the other durations existed is untouched ═
// Seeded in the exact shape the previous version wrote: 14 days, a 700 XP
// bonus, the hand-authored ramp, and several days already logged. Introducing
// five more durations must not reset, rewrite or re-scale any of it.
await reset();
await startLockIn(14);
const legacy = await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const dt = new Date(); dt.setDate(dt.getDate() - 5);
  p.me.challengeStart = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  // Exactly what v3.50 stored — note durationDays and completionBonusXP were
  // fixed constants then, and the ramp had no hold phases beyond "Hold".
  p.me.activeChallenge = {
    ...p.me.activeChallenge,
    durationDays: 14,
    completionBonusXP: 700,
    lockIn: {
      durationDays: 14, sleepHours: 8, attentionMinutes: 10,
      recoveryMinutes: 20, shutdownMinutes: 5,
      flowStages: [
        { minutes: 25, fromDay: 1, toDay: 3, label: 'Baseline', note: 'n' },
        { minutes: 35, fromDay: 4, toDay: 7, label: 'Extend', note: 'n' },
        { minutes: 45, fromDay: 8, toDay: 11, label: 'Deepen', note: 'n' },
        { minutes: 50, fromDay: 12, toDay: 14, label: 'Hold', note: 'n' },
      ],
      lighterDays: [7, 14],
    },
  };
  localStorage.setItem('profiles', JSON.stringify(p));
  // Three days of real progress.
  const all = JSON.parse(localStorage.getItem('allDays') || '{}');
  all.me = all.me || {};
  for (const n of [1, 2, 3]) {
    all.me[n] = { date: null, tasks: { li_sleep: true, li_flow: true, li_execute: true }, validated: false };
  }
  localStorage.setItem('allDays', JSON.stringify(all));
  return p.me.activeChallenge;
});
check('9: the legacy attempt was seeded', legacy.durationDays === 14);
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Today');
await page.waitForTimeout(600);
p = await prof();
check('9: the attempt was not reset', p.activeChallenge?.templateId === 'lock_in_14_day');
check('9: its duration is unchanged', p.activeChallenge?.durationDays === 14);
check('9: its completion bonus is unchanged', p.activeChallenge?.completionBonusXP === 700);
check('9: its stored ramp is unchanged',
  JSON.stringify(p.activeChallenge?.lockIn?.flowStages?.map(s => [s.minutes, s.fromDay, s.toDay])) ===
  JSON.stringify([[25, 1, 3], [35, 4, 7], [45, 8, 11], [50, 12, 14]]));
check('9: its lighter days are unchanged',
  JSON.stringify(p.activeChallenge?.lockIn?.lighterDays) === JSON.stringify([7, 14]));
const legacyDays = await days();
check('9: the three logged days survived',
  [1, 2, 3].every(n => legacyDays[n]?.tasks?.li_flow === true));
const legacyPanel = await page.textContent('.li-panel');
check('9: the panel reads the attempt\'s own ramp — Day 6 is 35 minutes',
  /Day 6 of 14/.test(legacyPanel) && /2 × 35 min/.test(legacyPanel), legacyPanel.slice(0, 70));
check('9: the challenge is not offered a template sync that would rewrite it',
  await page.evaluate(() => ![...document.querySelectorAll('button')]
    .some(b => /Update Challenge|Sync/i.test(b.textContent))));

// ══ 8: no crashes ════════════════════════════════════════════════════════
check('8: no page errors throughout',
  errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
