/**
 * Today page — section order, and the Daily Log's completion contract.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/today-order-e2e-test.mjs
 *
 * The Daily Log used to sit BELOW Challenge Performance, so recording how the
 * day went meant scrolling past the scorecard. These assertions read the real
 * document order and real bounding boxes, because "it's above the performance
 * card" is a fact about the DOM, not an opinion.
 *
 * The second half pins the rule that matters more than the layout: the
 * "Complete Daily Log" task row must reflect the actual Daily Log and must not
 * be a second, independent way to collect the same 20 XP.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

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
  await page.waitForTimeout(400);
}
const days = (id = 'me') =>
  page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

/** Seed an active LOCK IN challenge a few days in, then open Today. */
async function setup(profileId = 'me') {
  await page.evaluate((pid) => {
    localStorage.clear();
    localStorage.setItem('activeProfile', JSON.stringify(pid));
  }, profileId);
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate((pid) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    const d = new Date(); d.setDate(d.getDate() - 4);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    p[pid].highestRank = 8;
    p[pid].challengeStart = s;
    // The four untouched days before today would each incur a miss penalty,
    // which swamps the 10 XP under test and clamps the total to zero.
    p[pid].xpPenalties = false;
    p[pid].activeChallenge = {
      templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
      durationDays: 14, templateVersion: 1, completionBonusXP: 700,
      lockIn: { durationDays: 14, sleepHours: 8, attentionMinutes: 10, recoveryMinutes: 20, shutdownMinutes: 5 },
    };
    p[pid].tasks = [
      { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, source: 'template', order: 0 },
      { id: 'li_flow', name: 'Flow training: 2 focused sessions', icon: '🌊', xp: 35, keystone: 3, source: 'template', order: 1 },
      { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0, habitKey: 'daily_log', source: 'template', order: 2 },
    ];
    localStorage.setItem('profiles', JSON.stringify(p));
  }, profileId);
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await gotoTab('Today');
  await page.waitForSelector('.daily-view', { timeout: 8000 });
  await page.waitForTimeout(400);
}

/** Document order and vertical positions of the Today page's main sections. */
function layout() {
  return page.evaluate(() => {
    const root = document.querySelector('.daily-view');
    const named = [];
    const seen = new Set();
    const mark = (el, label) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      named.push({ label, el });
    };
    // The tasks card is the section-card whose title mentions Daily Tasks.
    const cards = [...root.querySelectorAll('.section-card')];
    mark(cards.find(c => /Daily Tasks|Today's Tasks/i.test(c.textContent || '')), 'tasks');
    mark(root.querySelector('.daily-log-card'), 'log');
    mark(root.querySelector('.weekly-req, .wr-card, [class*="weekly-req"]'), 'weekly');
    mark([...root.children].find(c => /Bonus Missions/i.test(c.textContent || '') && c.querySelector('.section-title, .bonus-head')), 'bonus');
    mark(root.querySelector('.li-panel'), 'lockin');
    mark(root.querySelector('.challenge-perf, .cp-card, [class*="challenge-perf"]'), 'perf');

    const all = [...root.querySelectorAll('*')];
    const docIndex = (el) => all.indexOf(el);
    const out = {};
    for (const { label, el } of named) {
      const r = el.getBoundingClientRect();
      out[label] = { docIndex: docIndex(el), top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, h: r.height };
    }
    // Challenge Performance has no stable class in every build — fall back to
    // locating it by its heading text among the top-level children.
    if (!out.perf) {
      const el = [...root.children].find(c => /Challenge Performance|Performance Breakdown/i.test(c.textContent || ''));
      if (el) {
        const r = el.getBoundingClientRect();
        out.perf = { docIndex: docIndex(el), top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, h: r.height };
      }
    }
    out._pageOverflow = document.documentElement.scrollWidth - window.innerWidth;
    return out;
  });
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: the Daily Log is directly under the daily tasks ═══════════════════
await setup('me');
let L = await layout();
check('1: the daily tasks card is present', !!L.tasks);
check('1: the Daily Log is present', !!L.log);
check('1: the Daily Log comes AFTER the daily tasks', L.log.docIndex > L.tasks.docIndex,
  `tasks@${L.tasks?.docIndex} log@${L.log?.docIndex}`);
check('1: nothing else sits between them in the document',
  (() => {
    // Every other named section must be outside the (tasks, log) range.
    const between = Object.entries(L).filter(([k, v]) =>
      !k.startsWith('_') && !['tasks', 'log'].includes(k) &&
      v.docIndex > L.tasks.docIndex && v.docIndex < L.log.docIndex);
    return between.length === 0;
  })(),
  Object.entries(L).filter(([k, v]) => !k.startsWith('_') && !['tasks', 'log'].includes(k) &&
    v.docIndex > L.tasks.docIndex && v.docIndex < L.log.docIndex).map(([k]) => k).join(', ') || 'nothing between');

// ══ 2: the required page order ═══════════════════════════════════════════
check('2: Daily Log comes before Challenge Performance',
  L.perf ? L.log.docIndex < L.perf.docIndex : true,
  L.perf ? `log@${L.log.docIndex} perf@${L.perf.docIndex}` : 'performance card not rendered');
check('2: Daily Log comes before the challenge panel',
  L.lockin ? L.log.docIndex < L.lockin.docIndex : true,
  L.lockin ? `log@${L.log.docIndex} panel@${L.lockin.docIndex}` : 'no panel');
check('2: Daily Log comes before Bonus Missions',
  L.bonus ? L.log.docIndex < L.bonus.docIndex : true);
check('2: the Daily Log is physically above Challenge Performance on the page',
  L.perf ? L.log.bottom <= L.perf.top : true,
  L.perf ? `log ends ${Math.round(L.log.bottom)}, perf starts ${Math.round(L.perf.top)}` : '');

// ══ 3: spacing — 16–20px between the tasks and the Daily Log ═════════════
const gap = await page.evaluate(() => {
  const root = document.querySelector('.daily-view');
  const log = root.querySelector('.daily-log-card');
  let prev = log.previousElementSibling;
  while (prev && prev.getBoundingClientRect().height === 0) prev = prev.previousElementSibling;
  const a = prev.getBoundingClientRect();
  const b = log.getBoundingClientRect();
  return { gap: Math.round((b.top - a.bottom) * 10) / 10, prevClass: prev.className };
});
check('3: 16–20px of vertical space above the Daily Log',
  gap.gap >= 16 && gap.gap <= 20, `${gap.gap}px (after .${gap.prevClass.split(' ')[0]})`);

// ══ 4: no scrolling past analytics to reach the log ══════════════════════
// The point of the change: the Daily Log has to be reachable before the
// scorecard, not after it.
check('4: the Daily Log starts above the fold-plus-one-screen',
  L.log.top < 844 * 2, `${Math.round(L.log.top)}px from the top`);
if (L.perf) {
  check('4: Challenge Performance no longer sits between tasks and log',
    !(L.perf.docIndex > L.tasks.docIndex && L.perf.docIndex < L.log.docIndex));
}

// ══ 5: the Daily Log still works, unchanged ══════════════════════════════
const fields = await page.evaluate(() => {
  const card = document.querySelector('.daily-log-card');
  return {
    title: /Daily Log/i.test(card.textContent),
    notes: !!card.querySelector('textarea.log-textarea'),
    sleepHours: !!card.querySelector('.sleep-hours-input'),
    sliders: card.querySelectorAll('input[type="range"], .rating-slider, [class*="rating"]').length,
    text: card.textContent,
  };
});
check('5: the card keeps its title', fields.title);
check('5: the notes field is still there', fields.notes);
check('5: the hours-slept input is still there', fields.sleepHours);
// The four logged every day lead; the rest are one tap away under "More
// metrics". Every metric the app has ever stored is still here, on the same
// 1-10 scales, writing to the same fields.
const QUICK = ['Mood', 'Energy'];
const REST = ['Confidence', 'Sleep Quality', 'Recovery', 'Workout Effort', 'Stress'];
check('5: the daily four lead the card',
  QUICK.every(m => new RegExp(m, 'i').test(fields.text)) && fields.sleepHours && fields.notes,
  QUICK.filter(m => !new RegExp(m, 'i').test(fields.text)).join(', ') || 'all present');
await page.locator('.f4-log-more').click();
await page.waitForTimeout(300);
const expanded = await page.evaluate(() => document.querySelector('.daily-log-card').textContent);
check('5: every other metric is one tap away, not removed',
  REST.every(m => new RegExp(m, 'i').test(expanded)),
  REST.filter(m => !new RegExp(m, 'i').test(expanded)).join(', ') || 'all present');
// The control is a draggable 1-10 track rather than ten small buttons, which
// is easier to hit on a phone. What matters is that the SCALE is unchanged:
// every rating still writes a 1-10 integer to the same field, so stored days
// and archives stay comparable.
const scales = await page.locator('.daily-log-card .rating-track').evaluateAll(els =>
  els.map(e => ({ min: e.min, max: e.max, step: e.step })));
check('5: and they are still 1-10 scales, not a shorter one',
  scales.length === QUICK.length + REST.length &&
  scales.every(s => s.max === '10' && s.step === '1'),
  `${scales.length} controls, ${JSON.stringify(scales[0])}`);
// The XP it advertises is the Daily Log task's OWN XP under this attempt's
// economy, not a constant. It used to say 20 whatever the task was worth.
const logTaskXP = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.check-item')]
    .find(e => /Complete Daily Log/i.test(e.textContent || ''));
  return Number((/([\d,]+)\s*XP/.exec(row?.querySelector('.check-xp')?.textContent || '') || [])[1]?.replace(/,/g, ''));
});
check('5: it advertises the XP the Daily Log task actually awards',
  Number.isFinite(logTaskXP) && new RegExp(`${logTaskXP} XP`).test(expanded),
  `task row says ${logTaskXP} XP`);
await page.locator('.f4-log-more').click();
await page.waitForTimeout(200);

// ══ 6: "Complete Daily Log" reflects the real log, and cannot double-pay ══
let d = await days();
check('6: the Daily Log starts incomplete', d[5]?.tasks?.daily_log !== true);
const logRow = page.locator('.check-item', { hasText: 'Complete Daily Log' });
check('6: the task row is still in the daily task list', (await logRow.count()) === 1);
check('6: the row starts unchecked', (await logRow.locator('.check-box.checked').count()) === 0);

// Tapping the row must NOT tick it — it should take you to the Daily Log.
const scrollBefore = await page.evaluate(() => window.scrollY);
await logRow.click();
await page.waitForTimeout(600);
d = await days();
check('6: tapping the task row does NOT complete it',
  d[5]?.tasks?.daily_log !== true, JSON.stringify(d[5]?.tasks || {}));
check('6: tapping the task row scrolls to the Daily Log instead',
  Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore) > 10 ||
  (await page.evaluate(() => {
    const r = document.querySelector('.daily-log-card').getBoundingClientRect();
    return r.top >= -2 && r.top < window.innerHeight;
  })));
check('6: the row is still unchecked after tapping',
  (await logRow.locator('.check-box.checked').count()) === 0);

// Saving a metric is what completes it — once.
const xpBefore = await page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
await page.locator('.daily-log-card .sleep-hours-input').fill('8');
await page.waitForTimeout(600);
d = await days();
check('6: saving a metric completes the Daily Log task', d[5]?.tasks?.daily_log === true);
check('6: the task row now shows as checked',
  (await logRow.locator('.check-box.checked').count()) === 1);
check('6: the card now reports it as logged',
  /✓ Logged/.test(await page.textContent('.daily-log-card')));

// Saving a second metric must not pay again.
await page.evaluate(() => {
  const card = document.querySelector('.daily-log-card');
  const ta = card.querySelector('textarea.log-textarea');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'A second edit.');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(500);
d = await days();
check('6: a second edit does not re-complete or duplicate anything',
  d[5]?.tasks?.daily_log === true && d[5]?.notes === 'A second edit.');
await gotoTab('Home');
await page.waitForTimeout(500);
const xpAfter = await page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
// An era-1 attempt: the task's stored 10 is quoted on the lifetime ladder as
// 100. What this guards is unchanged — it is paid once, by logging.
check('6: the Daily Log paid its XP exactly once',
  xpAfter - xpBefore === 100, `${xpBefore} → ${xpAfter} (stored task xp 10)`);

// And tapping the row again cannot un-complete or re-award it.
await gotoTab('Today');
await page.waitForTimeout(500);
await page.locator('.check-item', { hasText: 'Complete Daily Log' }).click();
await page.waitForTimeout(500);
d = await days();
check('6: tapping a completed row cannot un-complete the log',
  d[5]?.tasks?.daily_log === true);
await gotoTab('Home');
await page.waitForTimeout(500);
const xpFinal = await page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
check('6: XP is unchanged after tapping again', xpFinal === xpAfter, `${xpAfter} → ${xpFinal}`);

// ══ 7: saved metrics survive a reload ════════════════════════════════════
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Today');
await page.waitForTimeout(600);
const persisted = await page.evaluate(() => {
  const card = document.querySelector('.daily-log-card');
  return {
    hours: card.querySelector('.sleep-hours-input')?.value,
    notes: card.querySelector('textarea.log-textarea')?.value,
    logged: /✓ Logged/.test(card.textContent),
  };
});
check('7: the hours slept survived the reload', persisted.hours === '8', persisted.hours);
check('7: the notes survived the reload', persisted.notes === 'A second edit.');
check('7: the completed state survived the reload', persisted.logged);
L = await layout();
check('7: the order still holds after a reload',
  L.log.docIndex > L.tasks.docIndex && (!L.perf || L.log.docIndex < L.perf.docIndex));

// ══ 8: the female profile gets the same order ════════════════════════════
await setup('girlfriend');
const gf = await page.evaluate(() => {
  const root = document.querySelector('.daily-view');
  const all = [...root.querySelectorAll('*')];
  const log = root.querySelector('.daily-log-card');
  const tasks = root.querySelector('.gf-tasks');
  const perf = [...root.children].find(c => /Challenge Performance|Performance Breakdown/i.test(c.textContent || ''));
  return {
    hasLog: !!log, hasTasks: !!tasks,
    logIdx: all.indexOf(log), tasksIdx: all.indexOf(tasks),
    perfIdx: perf ? all.indexOf(perf) : -1,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  };
});
check('8: the card layout also has the Daily Log', gf.hasLog && gf.hasTasks);
check('8: it is below the task cards', gf.logIdx > gf.tasksIdx, `${gf.tasksIdx} → ${gf.logIdx}`);
check('8: and above Challenge Performance',
  gf.perfIdx === -1 || gf.logIdx < gf.perfIdx, `log@${gf.logIdx} perf@${gf.perfIdx}`);

// ══ 9: mobile layout ═════════════════════════════════════════════════════
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(350);
  const m = await page.evaluate(() => {
    const card = document.querySelector('.daily-log-card');
    const r = card.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      left: r.left, right: r.right, vw: window.innerWidth,
    };
  });
  check(`9: no horizontal overflow at ${w}px`, m.overflow <= 1, `${m.overflow}px`);
  check(`9: the Daily Log stays inside the viewport at ${w}px`,
    m.left >= -1 && m.right <= m.vw + 1, `${Math.round(m.left)}–${Math.round(m.right)} of ${m.vw}`);
}
await page.setViewportSize({ width: 390, height: 844 });

check('10: no page errors throughout',
  errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
