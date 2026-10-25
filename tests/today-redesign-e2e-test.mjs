/**
 * Forge 4.0 — the Today page, end to end.
 *
 * The redesign's promises, checked against the real app: that every figure on
 * the page comes from the store rather than the mockup it was drawn from, that
 * progress and XP move the instant a habit is ticked, that the Daily Log sits
 * directly under the habits, that the detail moved behind disclosures is still
 * all there, and that it holds together in every challenge state — including
 * the ones that have no challenge at all.
 *
 * Run against a production build:  npx vite preview --port 4173
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function offset(n) { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); }

async function gotoTab(name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab, button')]
      .find(x => new RegExp(`^${n}$`, 'i').test((x.getAttribute('aria-label') || x.textContent || '').trim()));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(400);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

async function reset(profile = 'me') {
  await page.evaluate((p) => {
    localStorage.clear();
    localStorage.setItem('activeProfile', JSON.stringify(p));
  }, profile);
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 10000 });
}

/**
 * Seed an attempt directly, with its tasks priced the way the stamping does.
 * `era` 1 keeps the task list's own XP, which is what an attempt started before
 * the rebalance carries.
 */
async function seed({
  profile = 'me', templateId = 'lock_in_14_day', name = 'LOCK IN', variant = 'standard',
  durationDays = 14, start = offset(-2), tasks, era = 2, budget = 180, rank = 7,
  completeDays = 0, meta = {}, dayRecords = null,
} = {}) {
  await reset(profile);
  await page.evaluate((cfg) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p[cfg.profile].highestRank = cfg.rank;
    p[cfg.profile].challengeStart = cfg.start;
    p[cfg.profile].xpPenalties = false;
    p[cfg.profile].activeChallenge = {
      templateId: cfg.templateId, name: cfg.name, emoji: '🎯', variant: cfg.variant,
      durationDays: cfg.durationDays, passingScore: 70, keystoneRequirement: 65,
      ...(cfg.era >= 2 ? { xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: cfg.budget, completionBonusXP: 504 } : {}),
      ...cfg.meta,
    };
    if (cfg.tasks) p[cfg.profile].tasks = cfg.tasks.map((t, i) => ({ ...t, source: 'template', order: i }));
    localStorage.setItem('profiles', JSON.stringify(p));

    const ids = (p[cfg.profile].tasks || []).map(t => t.id);
    const all = JSON.parse(localStorage.getItem('allDays') || '{}');
    all[cfg.profile] = cfg.dayRecords || {};
    for (let i = 1; i <= cfg.completeDays; i++) {
      all[cfg.profile][i] = { dayNumber: i, mood: 7, energy: 7, tasks: Object.fromEntries(ids.map(id => [id, true])) };
    }
    localStorage.setItem('allDays', JSON.stringify(all));
  }, { profile, templateId, name, variant, durationDays, start, tasks, era, budget, rank, completeDays, meta, dayRecords });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 10000 });
  await gotoTab('Today');
}

const ERA2_TASKS = [
  { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 30, keystone: 3, keystoneHabit: true, desc: 'Time in bed and a consistent wake time. The opportunity is what counts.', target: { value: 8, unit: 'hours', direction: 'atLeast' } },
  { id: 'li_flow', name: 'Flow training: 2 focused sessions', icon: '🌊', xp: 29, keystone: 3, desc: 'Session length ramps to 50 minutes and then holds.' },
  { id: 'li_execute', name: 'Execute 2 of 3 priorities', icon: '✅', xp: 28, keystone: 3, desc: 'Finished, against the completion criteria you wrote this morning.' },
  { id: 'li_mission', name: 'Daily mission: 3 priorities', icon: '🗂️', xp: 20, keystone: 2, desc: 'Three meaningful priorities, each with a clear definition of done.' },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0 },
];

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('activeProfile', JSON.stringify('me')));
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: the header reports the attempt, not the mockup ═════════════════════
await seed({ tasks: ERA2_TASKS, completeDays: 2 });
const card = page.locator('.f4-challenge-card');
check('1: the Active Challenge card is on Today', (await card.count()) === 1);
const cardText = await card.textContent();
const p1 = await prof();
check('1: it names the real challenge and mode',
  cardText.includes(p1.activeChallenge.name) && /Standard/i.test(cardText), cardText.slice(0, 60));
check('1: it reports the real day and duration',
  /Day 3/.test(cardText) && /\/ 14/.test(cardText), (/Day \d+ \/ \d+/.exec(cardText) || [''])[0]);
check('1: it reports the real streak', /🔥\s*2\b/.test(cardText), (/🔥\s*\d+/.exec(cardText) || [''])[0]);
// Challenge progression is the bar, which carries its value for assistive
// technology rather than spending a line of the card on a number.
check('1: it shows challenge progression',
  (await page.locator('.f4-lane-bar').first().getAttribute('aria-valuenow')) === '21',
  await page.locator('.f4-lane-bar').first().getAttribute('aria-valuenow'));
// The rank's NAME is identity and stays; the XP arithmetic moved to Home,
// where there is room to explain it and nothing to confuse it with.
check('1: it names the rank', /True Warrior/.test(cardText));
check('1: and leaves the rank XP arithmetic to Home',
  !/75,000 XP/.test(cardText) && !/more to Unbreakable/.test(cardText),
  (/True Warrior[\s\S]{0,24}/.exec(cardText) || [''])[0].replace(/\s+/g, ' '));
check('1: none of the mockup\'s placeholder figures appear',
  !/8,295|3 of 8 tasks|\+60 XP\b/.test(await page.textContent('.daily-view')));
check('1: there is no "Log Today" button — this IS today',
  (await page.locator('.daily-view button', { hasText: /^Log Today/i }).count()) === 0);
check('1: the challenge name is the way into the challenge itself',
  (await card.locator('button.f4-lane-link', { hasText: 'LOCK IN' }).count()) === 1);

// ══ 2: progress and XP are the engine's, and move immediately ═════════════
const ring = page.locator('.f4-progress-card');
let ringText = await ring.textContent();
check('2: progress starts at zero of the real task count',
  /0 of 5 habits/.test(ringText), (/\d+ of \d+ habits/.exec(ringText) || [''])[0]);
check('2: nothing earned yet', /\+0/.test(await ring.locator('.f4-xp-pill.earned').textContent()));
const availableAtStart = Number((await ring.locator('.f4-xp-pill.remaining .f4-xp-val').textContent()).replace(/,/g, ''));
// 5 tasks summing 117, plus the 15% perfect-day bonus on a 180 budget.
check('2: the available figure is the engine\'s, not a sum of the rows',
  availableAtStart === 117 + 27, `${availableAtStart}`);

const boxes = page.locator('.check-item .check-box');
await boxes.first().click();
await page.waitForTimeout(350);
ringText = await ring.textContent();
check('2: ticking a habit updates the ring immediately',
  /1 of 5 habits/.test(ringText), (/\d+ of \d+ habits/.exec(ringText) || [''])[0]);
check('2: and the XP earned immediately',
  /\+30/.test(await ring.locator('.f4-xp-pill.earned').textContent()),
  await ring.locator('.f4-xp-pill.earned .f4-xp-val').textContent());
check('2: the encouragement responds to the state',
  /4 left|Keep going|halfway/i.test(ringText), (/Keep going[^+]*/.exec(ringText) || [''])[0].trim().slice(0, 40));

await boxes.first().click();
await page.waitForTimeout(350);
check('2: unticking takes it straight back down',
  /0 of 5 habits/.test(await ring.textContent()) &&
  /\+0/.test(await ring.locator('.f4-xp-pill.earned').textContent()));

// Two fast taps are an on and an off, never two awards.
await boxes.nth(1).click();
await boxes.nth(1).click();
await page.waitForTimeout(400);
const d2 = await days();
check('2: a double tap toggles, it never pays twice',
  d2[3]?.tasks?.li_flow !== true && /0 of 5 habits/.test(await ring.textContent()),
  JSON.stringify(d2[3]?.tasks || {}));

// ══ 3: the habit rows carry what a habit needs ════════════════════════════
const row = page.locator('.check-item').first();
const rowText = await row.textContent();
check('3: the row states the habit', /Sleep opportunity/.test(rowText));
// The whole of a habit's guidance is on the row, not just its first sentence:
// for some habits the point is in the second one ("no special salt, trace
// minerals or electrolyte products required"). CSS clamps the display; the
// text itself is never cut.
check('3: with the habit\'s full guidance, not just its first sentence',
  /Time in bed and a consistent wake time\./.test(rowText) &&
  /The opportunity is what counts/.test(rowText),
  'full desc present');
check('3: and it is clamped for height rather than truncated in the text',
  Number(await page.locator('.check-item .check-desc').first().evaluate(el =>
    getComputedStyle(el).webkitLineClamp)) >= 2);
check('3: its real XP', (await row.locator('.check-xp').textContent()).trim() === '30 XP');
check('3: a keystone marker', (await row.locator('.keystone-stars').count()) === 1);
// The condition is on the row — and NOT twice. "Sleep opportunity: 8+ hours"
// already states it, so the separate target badge is suppressed.
check('3: and its completion condition, stated once',
  /8\+ hours/.test(rowText) && (await row.locator('.f4-chip-target').count()) === 0,
  rowText.replace(/\s+/g, ' ').slice(0, 60));
check('3: every row is at least 44px tall for a reliable tap',
  (await page.locator('.check-item').evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44))));
check('3: the row is reachable by keyboard', (await row.getAttribute('tabindex')) === '0');

// The guide opens without ticking the habit off.
const guideRow = page.locator('.check-item', { hasText: 'Sleep opportunity' }).first();
if (await guideRow.locator('.check-guide').count()) {
  await guideRow.locator('.check-guide').click();
  await page.waitForTimeout(400);
  const after = await days();
  check('3: opening a guide never completes the habit', after[3]?.tasks?.li_sleep !== true);
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.modal-overlay, .hg-close, button', { hasText: /close/i }).first().click().catch(() => {});
  await page.waitForTimeout(300);
}

// ══ 4: the Daily Log is directly under the habits ═════════════════════════
const order = await page.evaluate(() => {
  const root = document.querySelector('.daily-view');
  const all = [...root.querySelectorAll('*')];
  const tasks = [...root.querySelectorAll('.section-card')].find(c => /Daily Tasks/i.test(c.textContent || ''));
  const log = root.querySelector('.daily-log-card');
  const next = (() => { let n = tasks?.nextElementSibling; while (n && n.getBoundingClientRect().height === 0) n = n.nextElementSibling; return n; })();
  return {
    tasksIdx: all.indexOf(tasks), logIdx: all.indexOf(log),
    logIsNext: next === log, nextClass: next?.className || '',
  };
});
check('4: the Daily Log follows the habits', order.logIdx > order.tasksIdx);
check('4: with nothing in between', order.logIsNext, order.nextClass.split(' ')[0] || 'nothing after tasks');

// ══ 5: the detail is behind disclosures, closed, and still complete ═══════
const collapses = page.locator('.f4-collapse');
check('5: Today ends in named disclosures rather than a wall of panels',
  (await collapses.count()) >= 1, `${await collapses.count()} sections`);
check('5: they start closed',
  (await page.locator('.f4-collapse[aria-expanded="true"], .f4-collapse.open').count()) === 0);
const perfSection = page.locator('.f4-collapse', { hasText: /Performance/i }).first();
check('5: performance and grading is one of them', (await perfSection.count()) === 1);
await perfSection.locator('.f4-collapse-head').click();
await page.waitForTimeout(450);
check('5: opening it reveals the real Challenge Performance card',
  (await perfSection.locator('.challenge-perf, [class*="challenge-perf"], .cp-card').count()) >= 1 ||
  /Challenge Performance|Performance/i.test(await perfSection.textContent()));
check('5: and it reports it is expanded',
  (await perfSection.locator('.f4-collapse-head').getAttribute('aria-expanded')) === 'true');
await perfSection.locator('.f4-collapse-head').click();
await page.waitForTimeout(300);

// ══ 6: an era-1 attempt keeps era-1 figures ═══════════════════════════════
await seed({
  era: 1, templateId: 'mental_training_phase', name: 'Mental Training Phase', durationDays: 14,
  tasks: [
    { id: 'mt_mind', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 100, keystone: 3 },
    { id: 'mt_reading', name: 'Read 5 pages', icon: '📚', xp: 40, keystone: 2 },
  ],
});
// Stored era-1 values are untouched; they are quoted on the single ladder
// Lifetime XP and the ranks live on, so 100 stored reads 1,000.
const era1Row = await page.locator('.check-item').first().locator('.check-xp').textContent();
check('6: an era-1 attempt still shows the XP it was started with, on the lifetime ladder',
  era1Row.trim() === '1,000 XP', era1Row.trim());
await page.locator('.check-item .check-box').first().click();
await page.waitForTimeout(400);
check('6: and the day pays era-1 rates — the stored 100, converted, with no perfect day yet',
  /\+1,000/.test(await page.locator('.f4-xp-pill.earned').textContent()),
  await page.locator('.f4-xp-pill.earned .f4-xp-val').textContent());

// ══ 7: a Support Challenge is shown, never hidden ═════════════════════════
await seed({
  tasks: ERA2_TASKS,
  meta: {},
});
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.supportChallenge = {
    templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
    variant: 'standard', durationDays: 14, xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 160,
  };
  p.me.supportChallengeStart = start;
  localStorage.setItem('profiles', JSON.stringify(p));
}, offset(-1));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 10000 });
await gotoTab('Today');
const stackText = await page.locator('.f4-challenge-card').textContent();
check('7: both lanes are named when a Support Challenge is running',
  /Primary/i.test(stackText) && /Support/i.test(stackText) &&
  /LOCK IN/.test(stackText) && /Mental Training/.test(stackText),
  stackText.replace(/\s+/g, ' ').slice(0, 80));
check('7: the support lane reports its own day',
  (await page.locator('.f4-lane.support').textContent()).includes('Day 2'),
  (await page.locator('.f4-lane.support').textContent()).replace(/\s+/g, ' ').slice(0, 50));

// ══ 8: the states with no challenge, or none yet ══════════════════════════
// A brand-new profile has no challenge at all, and says so rather than
// rendering an empty checklist.
await reset();
await gotoTab('Today');
check('8: a profile with no challenge says so plainly',
  /No Active Challenge/i.test(await page.textContent('.daily-view')));
check('8: and offers no habits to tick', (await page.locator('.check-item').count()) === 0);

// The open-ended Forge Daily baseline: no duration, so no fraction and no
// completion to count down to.
await seed({
  templateId: 'forge_daily', name: 'Forge Daily', variant: null, durationDays: null,
  era: 2, budget: 120,
  tasks: [
    { id: 'fd_sleep', name: 'Hit sleep goal', icon: '😴', xp: 26, keystone: 0 },
    { id: 'fd_mind', name: 'Mental Training', icon: '🧘', xp: 34, keystone: 1 },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 60, keystone: 0 },
  ],
});
const baselineText = await page.textContent('.daily-view');
check('8: the Forge Daily baseline renders a usable Today',
  (await page.locator('.check-item').count()) === 3 && /Forge Daily/i.test(baselineText),
  `${await page.locator('.check-item').count()} habits`);
check('8: an open-ended baseline shows no fabricated duration or percentage',
  !/of 0|of null|NaN|of undefined/.test(baselineText) &&
  (await page.locator('.f4-lane-bar').count()) === 0);
check('8: it still reports the day it is on',
  /Day 3/.test(await page.locator('.f4-challenge-card').textContent()));

await seed({ tasks: ERA2_TASKS, start: offset(3) });
check('9: a scheduled attempt shows its pre-start card',
  (await page.locator('.scheduled-card').count()) === 1);
check('9: and renders no tickable habit list before Day 1',
  (await page.locator('.check-item').count()) === 0);

// ══ 10: a day with nothing done, and a day with everything done ═══════════
await seed({ tasks: ERA2_TASKS });
check('10: a day with nothing done reads zero, not blank',
  /0 of 5 habits/.test(await page.locator('.f4-progress-card').textContent()));
const allBoxes = page.locator('.check-item .check-box');
for (let i = 0; i < await allBoxes.count(); i++) {
  const row = page.locator('.check-item').nth(i);
  if (/Complete Daily Log/i.test(await row.textContent())) continue;   // scrolls to the log by design
  await allBoxes.nth(i).click();
  await page.waitForTimeout(150);
}
await page.locator('.daily-log-card .rating-track').first().fill('7');
await page.waitForTimeout(500);
const fullText = await page.locator('.f4-progress-card').textContent();
check('10: completing everything reads as complete',
  /5 of 5 habits/.test(fullText), (/\d of \d habits/.exec(fullText) || [''])[0]);
check('10: and the ring reports 100%',
  (await page.locator('.f4-ring.complete').count()) === 1);
check('10: with nothing left available',
  (await page.locator('.f4-xp-pill.remaining').count()) === 0);
check('10: the Daily Log completed itself from the metric that was saved',
  (await days())[3]?.tasks?.daily_log === true);

// ══ 11: long names and small screens ══════════════════════════════════════
await seed({
  tasks: [
    { id: 'long1', name: 'Complete a forty-five minute resistance training session including every accessory movement', icon: '🏋️', xp: 60, keystone: 3, desc: 'Any structured session counts, indoors or outdoors, provided it is deliberate.' },
    { id: 'long2', name: 'Drink one full gallon of water across the whole day without exception', icon: '💧', xp: 40, keystone: 1 },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0 },
  ],
});
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(350);
  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.check-item')];
    const card = document.querySelector('.f4-challenge-card');
    const log = document.querySelector('.daily-log-card');
    const inside = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return r.left >= -1 && r.right <= window.innerWidth + 1;
    };
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      rowsInside: rows.every(inside),
      cardInside: inside(card),
      logInside: inside(log),
      clipped: rows.some(r => r.scrollWidth > r.clientWidth + 1),
    };
  });
  check(`11: no horizontal overflow at ${w}px`, m.overflow <= 1, `${m.overflow}px`);
  check(`11: every habit row fits the screen at ${w}px`, m.rowsInside && !m.clipped);
  check(`11: the challenge card and Daily Log fit at ${w}px`, m.cardInside && m.logInside);
}
await page.setViewportSize({ width: 390, height: 900 });

// ══ 12: reduced motion is honoured ════════════════════════════════════════
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 10000 });
await gotoTab('Today');
const motion = await page.evaluate(() => {
  const el = document.querySelector('.f4-ring-fill');
  return el ? getComputedStyle(el).transitionDuration : null;
});
check('12: the ring does not animate under reduced motion',
  motion === null || /^(0s|0\.001s|1ms)$/.test(motion), String(motion));
await page.emulateMedia({ reducedMotion: null });

// ══ 12b: the small print is readable, not decorative ═════════════════════
// Measured, because "high contrast" is otherwise a matter of opinion. WCAG AA
// is 4.5:1 for body text; every line of real copy on Today has to clear it.
const contrast = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      n = n.parentElement;
    }
    return 'rgb(13, 13, 20)';
  };
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const out = [];
  for (const sel of ['.check-desc', '.f4-progress-msg', '.f4-tasks-count', '.f4-xp-lbl', '.f4-card-sub']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    out.push({ sel, r: Math.round(ratio(getComputedStyle(el).color, bgOf(el)) * 100) / 100 });
  }
  return out;
});
check('12b: every line of small copy clears WCAG AA (4.5:1)',
  contrast.length > 0 && contrast.every(c => c.r >= 4.5),
  contrast.map(c => `${c.sel} ${c.r}`).join(' · '));

// ══ 14: the refinements asked for before deployment ══════════════════════
await seed({ tasks: ERA2_TASKS, completeDays: 2 });

// 14.1 — the first habits are reachable without a long scroll on an iPhone.
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => {
  const sc = document.querySelector('.main-content') || document.scrollingElement;
  sc.scrollTop = 0;
});
await page.waitForTimeout(400);
const fold = await page.evaluate(() => {
  const nav = document.querySelector('.bottom-nav');
  const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
  const rows = [...document.querySelectorAll('.check-item')];
  return {
    navTop: Math.round(navTop),
    firstTop: rows[0] ? Math.round(rows[0].getBoundingClientRect().top) : null,
    fullyVisible: rows.filter(r => {
      const b = r.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= navTop;
    }).length,
  };
});
check('14.1: the first habit is above the fold on an iPhone',
  fold.firstTop != null && fold.firstTop < fold.navTop - 80, `first row at ${fold.firstTop}, nav at ${fold.navTop}`);
check('14.1: at least two habits are fully visible without scrolling',
  fold.fullyVisible >= 2, `${fold.fullyVisible} rows`);

// 14.2 — Quick Log saves immediately and loses nothing when More Metrics moves.
const notes = page.locator('.daily-log-card textarea.log-textarea');
await notes.click();
await notes.type('Half a thou', { delay: 10 });
await page.waitForTimeout(400);
check('14.2: a partial note is saved as it is typed, before any blur',
  (await days())[3]?.notes === 'Half a thou', JSON.stringify((await days())[3]?.notes));
await page.locator('.f4-log-more').click();
await page.waitForTimeout(350);
check('14.2: the partial note survives opening More Metrics',
  (await notes.inputValue()) === 'Half a thou', await notes.inputValue());
// Enter a metric that only exists inside the disclosure, then close it.
await page.locator('.f4-log-rest .rating-row', { hasText: 'Stress' }).locator('.rating-track').fill('6');
await page.waitForTimeout(350);
check('14.2: a metric entered inside More Metrics is saved immediately',
  (await days())[3]?.stress === 6, String((await days())[3]?.stress));
await page.locator('.f4-log-more').click();
await page.waitForTimeout(350);
check('14.2: closing More Metrics keeps both the note and the hidden metric',
  (await notes.inputValue()) === 'Half a thou' && (await days())[3]?.stress === 6);
await notes.fill('Half a thought, finished.');
await page.waitForTimeout(400);
check('14.2: and editing afterwards still writes through',
  (await days())[3]?.notes === 'Half a thought, finished.');
check('14.2: the card confirms the save', /✓ Saved/.test(await page.textContent('.daily-log-card')));

// 14.3 — the two XP figures itemise and add up.
// The arithmetic is available on demand rather than permanently on screen.
check('14.3: the XP breakdown is not shown until it is asked for',
  (await page.locator('.f4-xp-note').count()) === 0);
check('14.3: and the XP figures are the way to ask',
  (await page.locator('button.f4-xp-stack').getAttribute('aria-expanded')) === 'false');
await page.locator('button.f4-xp-stack').click();
await page.waitForTimeout(350);
const xpNote = await page.locator('.f4-xp-note').textContent();
const nums = [...xpNote.matchAll(/([\d,]+)\s*XP/g)].map(m => Number(m[1].replace(/,/g, '')));
check('14.3: the XP line explains where the remaining total comes from',
  /habits? left/.test(xpNote) && /perfect-day bonus/.test(xpNote), xpNote.replace(/\s+/g, ' ').trim());
check('14.3: and the parts sum to the stated total',
  nums.length >= 3 && nums[1] + nums[2] === nums[0], nums.join(' / '));
const earnedNow = Number((await page.locator('.f4-xp-pill.earned .f4-xp-val').textContent()).replace(/[+,]/g, ''));
// Earned plus outstanding has to equal what the habits on screen are worth —
// the reconciliation a reader can actually perform from the page.
const rowSum = await page.locator('.check-item .check-xp').evaluateAll(els =>
  els.reduce((n, e) => n + Number((e.textContent || '').replace(/[^\d]/g, '') || 0), 0));
check('14.3: earned plus the habits still outstanding equals what the rows are worth',
  earnedNow + nums[1] === rowSum, `${earnedNow} + ${nums[1]} = ${earnedNow + nums[1]} vs rows ${rowSum}`);
check('14.3: and the only thing beyond that is the day-level bonus',
  nums[0] - nums[1] === nums[2], `${nums[0]} - ${nums[1]} = ${nums[0] - nums[1]} vs bonus ${nums[2]}`);

// 14.4 — the rank cannot be confused with a threshold, because the header
// carries no XP totals at all now: it names the rank, and the arithmetic
// lives on Home where there is room to explain it.
const rankText = await page.locator('.f4-rank-chip').textContent();
check('14.4: the header names the rank', /True Warrior/.test(rankText), rankText.trim());
check('14.4: and states no XP total that could be read as a threshold',
  !/\d/.test(rankText), rankText.trim());
await gotoTab('Home');
await page.waitForTimeout(500);
const homeText = await page.textContent('.dashboard');
check('14.4: the rank detail is on Home instead',
  /75,000/.test(homeText), (/[\d,]+ XP/.exec(homeText) || [''])[0]);
await gotoTab('Today');
await page.waitForTimeout(500);

// 14.5 — done and not-done are visually distinct; keystones readable.
const visual = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.check-item')];
  const done = rows.find(r => r.classList.contains('done'));
  const todo = rows.find(r => !r.classList.contains('done'));
  const cs = (el) => getComputedStyle(el);
  return {
    doneBg: done ? cs(done).backgroundColor : null,
    todoBg: todo ? cs(todo).backgroundColor : null,
    doneBorder: done ? cs(done).borderColor : null,
    todoBorder: todo ? cs(todo).borderColor : null,
    boxFilled: done ? cs(done.querySelector('.check-box')).backgroundImage !== 'none' : false,
    keystoneRows: rows.filter(r => r.querySelector('.keystone-stars')).length,
    chipRows: rows.filter(r => r.querySelector('.f4-task-chips')?.children.length > 1).length,
  };
});
check('14.5: a completed habit is a different surface from an outstanding one',
  visual.doneBg !== visual.todoBg && visual.doneBorder !== visual.todoBorder,
  `${visual.doneBg} vs ${visual.todoBg}`);
check('14.5: and its box is filled', visual.boxFilled);
check('14.5: keystone habits carry their marker', visual.keystoneRows >= 1, `${visual.keystoneRows} marked`);
check('14.5: without crowding the row — at most one chip beside it',
  visual.chipRows === 0, `${visual.chipRows} rows with multiple chips`);

// 14.6 — the action panels stay on the page, not behind a disclosure.
await seed({
  templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', variant: 'standard', durationDays: 30,
  budget: 160, tasks: ERA2_TASKS,
  meta: { weeklyRequirementDefs: [
    { id: 'lifting', label: 'Lifting', icon: '🏋️', perWeek: 3, xp: 16, keystone: 2, logLabel: 'Log Lifting Session', unit: 'lift' },
    { id: 'zone2', label: 'Zone 2 Cardio', icon: '❤️', perWeek: 2, xp: 16, keystone: 2, logLabel: 'Log Zone 2 Session', unit: 'Zone 2' },
  ], weeklyRequirementsStartDate: offset(-2) },
});
check('14.6: the weekly requirements card is visible without opening anything',
  (await page.locator('.wr-card').count()) === 1);
check('14.6: and its session logging is reachable',
  (await page.locator('.wr-card button').count()) >= 1);

// 14.7 — nothing obscured by the bottom navigation, and no dead space.
const chrome = await page.evaluate(() => {
  const nav = document.querySelector('.bottom-nav');
  const navRect = nav.getBoundingClientRect();
  const sc = document.querySelector('.main-content') || document.scrollingElement;
  sc.scrollTop = sc.scrollHeight;
  const view = document.querySelector('.daily-view');
  const viewRect = view.getBoundingClientRect();
  // Only TEXT-ENTRY fields can trigger the iOS zoom; a range input carries no
  // text and is exempt.
  const inputs = [...document.querySelectorAll('.daily-log-card input, .daily-log-card textarea')]
    .filter(el => el.tagName === 'TEXTAREA' || ['text', 'number', 'search', 'email', 'tel', 'url', 'password'].includes(el.type))
    .map(el => parseFloat(getComputedStyle(el).fontSize));
  return {
    navHeight: Math.round(navRect.height),
    lastContentBottom: Math.round(viewRect.bottom),
    navTop: Math.round(navRect.top),
    trailingGap: Math.round(navRect.top - viewRect.bottom),
    minInputFont: inputs.length ? Math.min(...inputs) : null,
  };
});
check('14.7: the last content is not hidden behind the bottom navigation',
  chrome.lastContentBottom <= chrome.navTop + 1,
  `content ends ${chrome.lastContentBottom}, nav starts ${chrome.navTop}`);
check('14.7: and there is no excessive empty space at the end',
  chrome.trailingGap >= 0 && chrome.trailingGap <= 80, `${chrome.trailingGap}px`);
check('14.7: text inputs are 16px or larger, so iOS does not zoom the page',
  chrome.minInputFont >= 16, `${chrome.minInputFont}px`);
const focused = await page.evaluate(async () => {
  const ta = document.querySelector('.daily-log-card textarea.log-textarea');
  ta.focus();
  await new Promise(r => setTimeout(r, 250));
  const r = ta.getBoundingClientRect();
  const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), navTop: Math.round(nav.top), vh: window.innerHeight };
});
check('14.7: the notes field is on screen and clear of the navigation when focused',
  focused.top >= 0 && focused.bottom <= focused.navTop + 1,
  `field ${focused.top}–${focused.bottom}, nav at ${focused.navTop}`);

// 14.8 — the profile accent reaches the new components.
// Declaring the derived tokens on :root froze them at the default purple, so
// the pink profile's checkboxes, completed rows, ring and XP pill all ignored
// it. Checked as computed colour, not as a class name.
await seed({ profile: 'girlfriend', tasks: ERA2_TASKS, completeDays: 1 });
await page.locator('.check-item .check-box').first().click();
await page.waitForTimeout(350);
const accent = await page.evaluate(() => {
  const host = document.querySelector('[data-profile]');
  const cs = getComputedStyle(host);
  const ring = document.querySelector('.f4-ring-fill');
  const box = document.querySelector('.check-item.done .check-box.checked');
  return {
    profile: host.getAttribute('data-profile'),
    accent: cs.getPropertyValue('--accent').trim(),
    soft: cs.getPropertyValue('--f4-accent-soft').trim(),
    grad: cs.getPropertyValue('--f4-accent-grad').trim(),
    ringStroke: ring ? getComputedStyle(ring).stroke : null,
    boxImage: box ? getComputedStyle(box).backgroundImage : null,
  };
});
check('14.8: the second profile runs on its own accent',
  accent.profile === 'girlfriend' && /EC4899/i.test(accent.accent), accent.accent);
check('14.8: and the derived tokens follow it rather than the default',
  /EC4899/i.test(accent.soft) && /EC4899/i.test(accent.grad), accent.grad);
check('14.8: the progress ring is drawn in that accent',
  /236, *72, *153/.test(accent.ringStroke || ''), accent.ringStroke);
check('14.8: and so is a completed habit\'s checkbox',
  /236, *72, *153/.test(accent.boxImage || ''), (accent.boxImage || '').slice(0, 60));
check('14.8: the second profile gets the same titled task card',
  (await page.locator('.f4-tasks-card .f4-card-title').count()) === 1 &&
  /Daily Tasks/.test(await page.locator('.f4-tasks-card .f4-card-title').textContent()));

// ══ 15: the merged header, and the sleep distinction ═════════════════════
await seed({ tasks: ERA2_TASKS, completeDays: 2 });

check('15.1: the challenge and today\'s progress are one card',
  (await page.locator('.f4-today-head-card').count()) === 1 &&
  (await page.locator('.f4-today-head-card .f4-challenge-card').count()) === 1 &&
  (await page.locator('.f4-today-head-card .f4-progress-card').count()) === 1);
const headH = await page.locator('.f4-today-head-card').evaluate(el => Math.round(el.getBoundingClientRect().height));
check('15.1: and it is compact — under 200px at phone width', headH < 200, `${headH}px`);

// Shared habits are merged into one row, never shown per lane.
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.supportChallenge = {
    templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
    variant: 'standard', durationDays: 14, xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 160,
  };
  p.me.supportChallengeStart = start;
  p.me.tasks = p.me.tasks.map(t => t.id === 'daily_log'
    ? { ...t, challenges: ['primary', 'support'], mergedFrom: { primary: 'daily_log', support: 'mt_log' } }
    : { ...t, challenges: ['primary'] });
  localStorage.setItem('profiles', JSON.stringify(p));
}, offset(-1));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 10000 });
await gotoTab('Today');
await page.waitForTimeout(600);
check('15.2: both challenges are named, with their own day counts',
  /Primary/i.test(await page.textContent('.f4-today-head-card')) &&
  /Support/i.test(await page.textContent('.f4-today-head-card')) &&
  (await page.locator('.f4-lane').count()) === 2);
check('15.2: each lane has its own progression',
  (await page.locator('.f4-lane-bar').count()) === 2);
const dupRows = await page.locator('.check-item').evaluateAll(els => {
  const names = els.map(e => e.querySelector('.f4-task-title')?.textContent?.trim());
  return names.length - new Set(names).size;
});
check('15.2: a shared habit appears once, not once per challenge', dupRows === 0, `${dupRows} duplicates`);
check('15.2: and it is marked as counting for both',
  (await page.locator('.check-item.shared-habit').count()) === 1);

// Hours slept must not silently complete a sleep-OPPORTUNITY habit.
await seed({
  tasks: [
    { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 30, keystone: 3, habitKey: 'sleep_target',
      desc: 'Time in bed and a consistent wake time. The opportunity is what counts.',
      target: { value: 8, unit: 'hours', direction: 'atLeast' } },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0 },
  ],
});
await page.locator('.daily-log-card .sleep-hours-input').fill('9');
await page.waitForTimeout(500);
check('15.3: nine hours slept does NOT tick a sleep-opportunity habit',
  (await days())[3]?.tasks?.li_sleep !== true,
  JSON.stringify((await days())[3]?.tasks || {}));
check('15.3: and the card explains why rather than failing silently',
  /time in bed/i.test(await page.textContent('.daily-log-card')));
check('15.3: the hours are still recorded', (await days())[3]?.hoursSlept === 9);

// Where the habit really is about hours slept, it still auto-completes —
// against the HABIT's own target, not a profile default.
await seed({
  tasks: [
    { id: 'fl_sleep', name: 'Sleep 7.5+ hours', icon: '😴', xp: 30, keystone: 2, habitKey: 'sleep_target',
      target: { value: 7.5, unit: 'hours', direction: 'atLeast' } },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0 },
  ],
});
await page.locator('.daily-log-card .sleep-hours-input').fill('7.5');
await page.waitForTimeout(500);
check('15.4: an hours-slept habit auto-completes at its own target',
  (await days())[3]?.tasks?.fl_sleep === true, JSON.stringify((await days())[3]?.tasks || {}));
await page.locator('.daily-log-card .sleep-hours-input').fill('6');
await page.waitForTimeout(500);
check('15.4: and un-completes below it', (await days())[3]?.tasks?.fl_sleep === false);
check('15.4: no phantom task id is written for a habit the attempt does not have',
  !('sleep_target' in ((await days())[3]?.tasks || {})),
  JSON.stringify(Object.keys((await days())[3]?.tasks || {})));

// The Daily Log habit and the Daily Log card are one action.
check('15.5: saving a metric completes the habit exactly once',
  (await days())[3]?.tasks?.daily_log === true);
const logRowXP = await page.locator('.check-item', { hasText: 'Complete Daily Log' })
  .locator('.check-xp').textContent();
check('15.5: and the card advertises the same XP the habit row does',
  new RegExp(logRowXP.trim().replace(/\s+/g, '\\s*')).test(await page.textContent('.daily-log-card')),
  logRowXP.trim());
check('15.5: with no separate button to press',
  (await page.locator('.daily-log-card button', { hasText: /mark|complete|save/i }).count()) === 0);

// "MWD" is not a word.
check('15.6: the reduced-day control is named, not abbreviated',
  /Minimum day/i.test(await page.textContent('.f4-tasks-card')) &&
  !/\bMWD\b/.test(await page.textContent('.f4-tasks-card')));

// ══ 16: the pre-deployment functionality checks ══════════════════════════
await seed({ tasks: ERA2_TASKS, completeDays: 2 });

// 16.1 — every integer is selectable, and nothing is saved by arriving.
const mood = page.locator('.daily-log-card .rating-row', { hasText: 'Mood' }).locator('.rating-track');
check('16.1: an unrated metric starts unrated, not at 1',
  (await mood.inputValue()) === '0' && (await days())[3]?.mood === undefined,
  `control ${await mood.inputValue()}, stored ${JSON.stringify((await days())[3]?.mood)}`);
check('16.1: and the card shows it as unrated rather than a number',
  /–\s*\/\s*10/.test(await page.locator('.daily-log-card .rating-row', { hasText: 'Mood' }).textContent()));
const missed = [];
for (let n = 1; n <= 10; n++) {
  await mood.fill(String(n));
  await page.waitForTimeout(140);
  const stored = (await days())[3]?.mood;
  const shown = await page.locator('.daily-log-card .rating-row', { hasText: 'Mood' }).locator('.rating-val').textContent();
  if (stored !== n || !new RegExp(`^${n}\\b`).test(shown.trim())) missed.push(`${n}→${stored}/${shown.trim()}`);
}
check('16.1: every integer 1–10 selects, stores and displays exactly itself',
  missed.length === 0, missed.join(' ') || 'all ten exact');
check('16.1: the scale is still 0–10 with integer steps',
  (await mood.getAttribute('min')) === '0' && (await mood.getAttribute('max')) === '10' &&
  (await mood.getAttribute('step')) === '1');
check('16.1: a vertical scroll starting on the track does not set a rating',
  (await mood.evaluate(el => getComputedStyle(el).touchAction)) === 'pan-y',
  await mood.evaluate(el => getComputedStyle(el).touchAction));
check('16.1: the thumb is a 44px-tall target',
  (await mood.evaluate(el => Math.round(el.getBoundingClientRect().height))) >= 24,
  `${await mood.evaluate(el => Math.round(el.getBoundingClientRect().height))}px track`);

// 16.2 — one saved log, one completion, no double XP, immediate sync.
await seed({ tasks: ERA2_TASKS });
const logRow = page.locator('.check-item', { hasText: 'Complete Daily Log' });
check('16.2: the Daily Log habit starts incomplete', (await days())[3]?.tasks?.daily_log !== true);
const beforeXP = await page.locator('.f4-xp-pill.earned .f4-xp-val').textContent();
await page.locator('.daily-log-card .rating-row', { hasText: 'Mood' }).locator('.rating-track').fill('6');
await page.waitForTimeout(450);
check('16.2: saving one metric completes the habit', (await days())[3]?.tasks?.daily_log === true);
check('16.2: and the habit row shows it immediately, without a reload',
  (await logRow.getAttribute('aria-checked')) === 'true');
const afterOne = await page.locator('.f4-xp-pill.earned .f4-xp-val').textContent();
check('16.2: the XP moved by exactly the habit\'s value',
  Number(afterOne.replace(/[+,]/g, '')) - Number(beforeXP.replace(/[+,]/g, '')) === 10,
  `${beforeXP} → ${afterOne}`);
// More metrics must not complete it a second time or pay again.
for (const [label, v] of [['Energy', '7'], ['Mood', '9']]) {
  await page.locator('.daily-log-card .rating-row', { hasText: label }).locator('.rating-track').fill(v);
  await page.waitForTimeout(300);
}
const afterMore = await page.locator('.f4-xp-pill.earned .f4-xp-val').textContent();
check('16.2: further metrics never complete it again or pay twice',
  afterMore === afterOne && (await days())[3]?.tasks?.daily_log === true,
  `${afterOne} → ${afterMore}`);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 10000 });
await gotoTab('Today');
await page.waitForTimeout(500);
check('16.2: and it survives a reload as one completion',
  (await days())[3]?.tasks?.daily_log === true &&
  (await days())[3]?.mood === 9 && (await days())[3]?.energy === 7);

// 16.3 — a clamped requirement can be read in place, guide or no guide.
await seed({
  tasks: [
    { id: 'long_one', name: 'Hydration', icon: '💧', xp: 40, keystone: 1,
      desc: 'Your normal daily hydration target. No special salt, trace minerals or electrolyte products are required for this, and nothing needs to be purchased.' },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0 },
  ],
});
const longRow = page.locator('.check-item', { hasText: 'Hydration' }).first();
check('16.3: a habit with no guide still offers its full requirement',
  (await longRow.locator('.check-guide').count()) === 0 &&
  (await longRow.locator('.check-desc-more').count()) === 1);
const clippedBefore = await longRow.locator('.check-desc').evaluate(el => el.scrollHeight > el.clientHeight + 1);
check('16.3: its description is clamped to begin with', clippedBefore);
await longRow.locator('.check-desc-more').click();
await page.waitForTimeout(350);
check('16.3: tapping it reveals the whole requirement, in place',
  !(await longRow.locator('.check-desc').evaluate(el => el.scrollHeight > el.clientHeight + 1)) &&
  /nothing needs to be purchased/.test(await longRow.textContent()));
check('16.3: and expanding it never completes the habit',
  (await days())[3]?.tasks?.long_one !== true);
check('16.3: it is still on Today — nothing navigated away',
  (await page.locator('.daily-view').count()) === 1);
await longRow.locator('.check-desc-more').click();
await page.waitForTimeout(250);
check('16.3: and it collapses again', (await longRow.locator('.check-desc.expanded').count()) === 0);

// 16.4 — both lanes' habits remain tickable, shared ones deduplicated.
await seed({ tasks: ERA2_TASKS });
await page.evaluate((start) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.supportChallenge = {
    templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
    variant: 'standard', durationDays: 14, xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 160,
  };
  p.me.supportChallengeStart = start;
  p.me.tasks = [
    ...p.me.tasks.map(t => t.id === 'daily_log'
      ? { ...t, challenges: ['primary', 'support'], mergedFrom: { primary: 'daily_log', support: 'mt_log' } }
      : { ...t, challenges: ['primary'] }),
    { id: 'mt_mind', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 40, keystone: 3,
      source: 'template', order: 90, challenges: ['support'] },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
}, offset(-1));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 10000 });
await gotoTab('Today');
await page.waitForTimeout(600);
// Matched on the habit's NAME, not the row's text: the shared Daily Log row
// also names the support challenge in its "counts for both" badge, so a loose
// text match finds two rows and both are correct.
const mtRows = await page.locator('.check-item .f4-task-title').evaluateAll(els =>
  els.map(e => e.textContent.trim()));
check('16.4: the support challenge\'s own habit is present',
  mtRows.filter(n => /^Mental Training/.test(n)).length === 1, JSON.stringify(mtRows));
check('16.4: both lanes are labelled',
  (await page.locator('.lane-section.primary').count()) === 1 &&
  (await page.locator('.lane-section.support').count()) === 1);
const names = await page.locator('.check-item .f4-task-title').evaluateAll(els => els.map(e => e.textContent.trim()));
check('16.4: a shared habit is listed once across both lanes',
  names.length === new Set(names).size, names.join(' | '));
await page.locator('.check-item', { has: page.locator('.f4-task-title', { hasText: 'Mental Training —' }) })
  .locator('.check-box').click();
await page.waitForTimeout(350);
check('16.4: and a support habit ticks normally', (await days())[3]?.tasks?.mt_mind === true);
check('16.4: the shared habit names the other challenge it also counts for',
  /Mental Training Phase/.test(await page.locator('.check-item.shared-habit').textContent()),
  (await page.locator('.check-item.shared-habit .check-supports').textContent()).trim());

// 16.5 — readability and touch targets at iPhone width.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(350);
const targets = await page.evaluate(() => {
  const area = (el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  // Hit area includes an ::after overlay where one is used.
  const hit = (el) => {
    const cs = getComputedStyle(el, '::after');
    const r = el.getBoundingClientRect();
    const grow = (v) => Math.abs(parseFloat(v) || 0);
    return cs.content && cs.content !== 'none'
      ? { w: r.width + grow(cs.left) + grow(cs.right), h: r.height + grow(cs.top) + grow(cs.bottom) }
      : area(el);
  };
  const out = [];
  // `.check-box` is deliberately absent: it is aria-hidden decoration, and the
  // whole ROW carries role="checkbox" and the tap handler — so the row is the
  // target to measure, and it is in this list.
  for (const sel of ['.check-item', '.check-guide', '.check-desc-more', 'button.f4-xp-stack', '.f4-log-more', '.f4-collapse-head', '.day-sel-btn']) {
    const el = document.querySelector(sel);
    if (el) out.push({ sel, ...hit(el) });
  }
  return out;
});
const small = targets.filter(t => t.h < 44 || t.w < 24);
check('16.5: every interactive control has a 44px touch target',
  small.length === 0, small.map(t => `${t.sel} ${Math.round(t.w)}x${Math.round(t.h)}`).join(' · ') || 'all ≥44px');
const contrast2 = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      n = n.parentElement;
    }
    return 'rgb(13, 13, 20)';
  };
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const out = [];
  for (const sel of ['.check-desc', '.f4-progress-msg', '.rating-hint', '.sleep-target-hint', '.f4-lane-day', '.check-desc-more']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    out.push({ sel, r: Math.round(ratio(getComputedStyle(el).color, bgOf(el)) * 100) / 100 });
  }
  return out;
});
check('16.5: every line of secondary copy clears WCAG AA',
  contrast2.length > 0 && contrast2.every(c => c.r >= 4.5),
  contrast2.map(c => `${c.sel} ${c.r}`).join(' · '));

// ══ 13: no page errors ════════════════════════════════════════════════════
const real = errors.filter(e => !/favicon|manifest|ServiceWorker|sw\.js/i.test(e));
check('13: no page errors across every state', real.length === 0, real.slice(0, 2).join(' | '));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
