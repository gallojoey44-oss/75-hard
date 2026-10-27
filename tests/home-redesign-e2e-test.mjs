/**
 * The Home tab, driven in a real browser.
 *
 * Home now reports four things it did not report before — recent adherence, a
 * dated feed of wins, the closest milestones, and the whole achievement
 * collection — and every one of them is a chance to show a number that is not
 * true. So this suite reads the SCREEN and compares it to what is in storage,
 * rather than trusting either on its own.
 *
 * It also guards two boundaries the redesign must not cross: Home never writes
 * to storage however much of it you open, and the other four tabs are left
 * exactly as they were.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4173/';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function eq(name, got, want) {
  check(name, JSON.stringify(got) === JSON.stringify(want),
    `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = iso(new Date());

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const TASKS = [
  { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 90, keystone: 3, source: 'template', order: 0, challenges: ['primary'] },
  { id: 'li_flow', name: 'Flow training', icon: '🌊', xp: 80, keystone: 3, source: 'template', order: 1, challenges: ['primary'] },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 30, keystone: 0, source: 'template', order: 2, challenges: ['primary'] },
];
const ALL = { li_sleep: true, li_flow: true, daily_log: true };

async function tab(name) {
  await page.evaluate((n) => {
    const t = [...document.querySelectorAll('.bottom-nav .nav-tab')].find(x => x.getAttribute('aria-label') === n);
    if (t) t.click();
  }, name);
  await page.waitForTimeout(450);
}

async function seed({ support = false, baseline = false, archives = true, era = 2 } = {}) {
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 20000 });
  await page.evaluate((c) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 7;
    p.me.xpPenalties = true;
    p.me.challengeStart = c.start;
    p.me.rankHistory = [
      { rank: 6, name: 'Elite Warrior', philosophy: 'You protect your standards.', date: null, lifetimeXP: 50000 },
      { rank: 7, name: 'True Warrior', philosophy: 'You act from principle, not mood.', date: c.rankDate, lifetimeXP: 75120 },
    ];
    if (c.baseline) {
      p.me.activeChallenge = { templateId: 'forge_daily', name: 'Forge Daily', emoji: '🔥', durationDays: null, xpEconomyVersion: 2, effortTier: 'easy', dailyBudget: 120 };
    } else {
      p.me.activeChallenge = {
        templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
        durationDays: 14, passingScore: 70, keystoneRequirement: 65,
        ...(c.era >= 2 ? { xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 200, completionBonusXP: 2700 } : {}),
      };
    }
    p.me.tasks = c.tasks;
    if (c.support) {
      p.me.supportChallenge = {
        templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
        variant: 'standard', durationDays: 21, xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 160,
      };
      p.me.supportChallengeStart = c.supStart;
    }
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({
      me: {
        1: { date: c.d4, tasks: { ...c.all } },
        2: { date: c.d3, tasks: { ...c.all } },
        3: { date: c.d2, tasks: { li_sleep: true } },
        4: { date: c.d1, tasks: {} },
        5: { date: c.today, tasks: { li_sleep: true } },
      },
      girlfriend: {},
    }));
    localStorage.setItem('archives', JSON.stringify({
      me: c.archives ? [
        { id: 'arch_e2', archivedAt: c.old2, challengeStart: c.old1, endDate: c.old2, endDayNum: 30,
          challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', durationDays: 30, xpEconomyVersion: 2 },
          days: {}, tasks: [], xpEarned: 6420, completed: true, passed: true, finalScore: 88, scoreAvailable: true, passingScore: 70 },
        { id: 'arch_e1', archivedAt: c.old1, challengeStart: c.old0, endDate: c.old1, endDayNum: 14,
          challenge: { templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', durationDays: 14, xpEconomyVersion: 1 },
          days: {}, tasks: [], xpEarned: 420, completed: true, passed: true, finalScore: 91, scoreAvailable: true, passingScore: 70 },
      ] : [],
      girlfriend: [],
    }));
  }, {
    support, baseline, archives, era, tasks: TASKS, all: ALL,
    today: TODAY, start: day(-4), supStart: day(-2), rankDate: day(-9),
    d4: day(-4), d3: day(-3), d2: day(-2), d1: day(-1),
    old0: day(-200), old1: day(-160), old2: day(-80),
  });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 20000 });
  await page.waitForTimeout(700);
}

const snapshot = () => page.evaluate(() => JSON.stringify({
  profiles: localStorage.getItem('profiles'),
  allDays: localStorage.getItem('allDays'),
  archives: localStorage.getItem('archives'),
}));

// ════════════════════════════════════════════════════════════════════════════
// 1. Every section is present, once
// ════════════════════════════════════════════════════════════════════════════

await seed();

const sections = await page.evaluate(() => ({
  rank: document.querySelectorAll('.f41-rank').length,
  consistency: document.querySelectorAll('.f41-consistency').length,
  challenge: document.querySelectorAll('.f41-chal').length,
  perf: document.querySelectorAll('.perf-card').length,
  ach: document.querySelectorAll('.f41-ach').length,
  wins: document.querySelectorAll('.f41-wins').length,
  cta: document.querySelectorAll('.f41-cta').length,
}));
eq('Home shows one rank card', sections.rank, 1);
eq('one consistency card', sections.consistency, 1);
eq('one active-challenge card', sections.challenge, 1);
eq('one performance card', sections.perf, 1);
eq('one achievements card', sections.ach, 1);
eq('one recent-wins card', sections.wins, 1);
eq('and exactly one route to today', sections.cta, 1);

// ════════════════════════════════════════════════════════════════════════════
// 2. The rank card agrees with the rank state
// ════════════════════════════════════════════════════════════════════════════

const rank = await page.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent?.trim() || null;
  return {
    badge: t('.xp-rank-badge'),
    next: t('.xp-next-label'),
    barW: document.querySelector('.xp-bar-fill')?.style?.width || null,
    split: document.querySelector('.xp-split-row')?.textContent || '',
    pct: t('.f41-rank-next-pct'),
    dots: document.querySelectorAll('.f41-rank-dot').length,
    here: document.querySelectorAll('.f41-rank-dot.here').length,
  };
});
eq('the rank is named', rank.badge, 'True Warrior');
check('the next rank and the distance to it are stated',
  /^[\d,]+ XP to Unbreakable$/.test(rank.next), rank.next);
check('the split still reads Challenge and Lifetime',
  /Challenge:\s*[\d,]+/.test(rank.split) && /Lifetime:\s*[\d,]+/.test(rank.split),
  rank.split.replace(/\s+/g, ' '));
eq('there is one dot per rank', rank.dots, 8);
eq('exactly one of them is the rank you hold', rank.here, 1);
check('the bar width matches the stated percentage',
  rank.barW === rank.pct, `${rank.barW} vs ${rank.pct}`);

// The figure on screen is the figure in the rank state, not a second opinion.
const lifetimeOnScreen = Number((rank.split.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, ''));
const xpNum = await page.evaluate(() =>
  Number(document.querySelector('.xp-value')?.textContent?.replace(/,/g, '') || 0));
eq('the headline XP and the Lifetime figure are the same number', xpNum, lifetimeOnScreen);

// ════════════════════════════════════════════════════════════════════════════
// 3. Consistency reports the days as they were logged
// ════════════════════════════════════════════════════════════════════════════

const con = await page.evaluate(() => {
  const dots = [...document.querySelectorAll('.f41-dot')];
  return {
    count: dots.length,
    states: dots.map(d => [...d.classList].filter(c => c !== 'f41-dot').join('.')),
    labels: [...document.querySelectorAll('.f41-week-label')].map(e => e.textContent.trim()),
    figures: [...document.querySelectorAll('.f41-con-num')].map(e => e.textContent.trim()),
  };
});
eq('seven days are shown', con.count, 7);
eq('each has a weekday letter', con.labels.length, 7);
check('the last day is marked as today',
  /now/.test(con.states[6]), con.states.join(' | '));
check('the two fully-logged days read as done',
  con.states.filter(s => /\bdone\b/.test(s)).length === 2, con.states.join(' | '));
check('the untouched day inside the challenge reads as missed',
  con.states.some(s => /missed/.test(s)), con.states.join(' | '));
check('days before the challenge began are untracked, not missed',
  con.states.slice(0, 2).every(s => /none/.test(s)), con.states.slice(0, 2).join(' | '));

// The headline figure has to agree with the dots beside it.
const perfectShown = Number((con.figures[1] || '').match(/^(\d+)/)?.[1] ?? -1);
eq('the perfect-day count matches the dots that are filled',
  perfectShown, con.states.filter(s => /\bdone\b/.test(s)).length);

// ════════════════════════════════════════════════════════════════════════════
// 4. The active challenge, and the one way into today
// ════════════════════════════════════════════════════════════════════════════

const chal = await page.evaluate(() => ({
  name: document.querySelector('.f41-chal-name')?.textContent?.trim() || null,
  day: document.querySelector('.hero-day-num')?.textContent?.trim() || null,
  meta: document.querySelector('.f41-chal-meta')?.textContent?.replace(/\s+/g, ' ').trim() || null,
  foot: document.querySelector('.f41-chal-foot')?.textContent?.replace(/\s+/g, ' ').trim() || null,
  bar: document.querySelector('.f41-chal-bar-fill')?.style?.width || null,
}));
eq('the running challenge is named', chal.name, 'LOCK IN');
eq('the day number is the number alone', chal.day, '5');
check('with its length beside it', /Day 5 \/ 14/.test(chal.meta), chal.meta);
check('today is reported as a habit count, not a second task list',
  /1 of 3 habits done today/.test(chal.foot), chal.foot);
check('and the days left are stated', /9 days remaining/.test(chal.foot), chal.foot);
check('the progress bar is set from the day count',
  chal.bar === '36%', chal.bar);

await page.locator('.f41-cta').click();
await page.waitForTimeout(600);
eq('the call to action opens Today', await page.locator('.daily-view, .daily').count() > 0, true);
await tab('Home');

// ════════════════════════════════════════════════════════════════════════════
// 5. Performance is complete, but folded
// ════════════════════════════════════════════════════════════════════════════

const perfBefore = await page.evaluate(() => ({
  ring: document.querySelector('.perf-ring-num')?.textContent?.trim() || null,
  text: document.querySelector('.perf-card')?.textContent || '',
  projection: document.querySelectorAll('.perf-projection').length,
  breakdown: document.querySelectorAll('.perf-breakdown').length,
  compact: document.querySelectorAll('.perf-card.perf-compact').length,
}));
eq('the card is in its compact form on Home', perfBefore.compact, 1);
check('the score is on screen without asking', /^\d+%$/.test(perfBefore.ring), perfBefore.ring);
check('so is the passing score', /70%/.test(perfBefore.text));
check('so is the grading status',
  /(Excellent|On Track|At Risk|Needs Attention|Keystone Needed)/.test(perfBefore.text),
  perfBefore.text.slice(0, 80).replace(/\s+/g, ' '));
eq('the projection is folded away', perfBefore.projection, 0);
eq('and so is the breakdown', perfBefore.breakdown, 0);

await page.locator('.perf-expand-btn').click();
await page.waitForTimeout(400);
const perfAfter = await page.evaluate(() => ({
  projection: document.querySelectorAll('.perf-projection').length,
  breakdown: document.querySelectorAll('.perf-breakdown').length,
  text: document.querySelector('.perf-card')?.textContent || '',
}));
eq('one tap brings the projection back', perfAfter.projection, 1);
eq('and the full breakdown with it', perfAfter.breakdown, 1);
check('including keystone adherence', /Keystone adherence/.test(perfAfter.text));
check('and the per-task performance', /Performance by task/.test(perfAfter.text));
await page.locator('.perf-expand-btn').click();
await page.waitForTimeout(300);

// ════════════════════════════════════════════════════════════════════════════
// 6. Achievements: what is held, what is close, and all of it
// ════════════════════════════════════════════════════════════════════════════

const ach = await page.evaluate(() => ({
  earned: document.querySelectorAll('.f41-badge').length,
  counter: document.querySelector('.f41-ach .f41-card-meta')?.textContent?.trim() || null,
  miles: [...document.querySelectorAll('.f41-mile')].map(m => ({
    label: m.querySelector('.f41-mile-label')?.textContent?.trim(),
    detail: m.querySelector('.f41-mile-detail')?.textContent?.trim(),
    width: m.querySelector('.f41-mile-bar-fill')?.style?.width,
  })),
  rows: document.querySelectorAll('.f41-col-row').length,
}));
check('badges that are held are shown', ach.earned > 0, `${ach.earned}`);
check('with a count of the whole collection', /^\d+ of \d+$/.test(ach.counter), ach.counter);
check('the next rank leads the milestones', /Unbreakable/.test(ach.miles[0]?.label || ''),
  JSON.stringify(ach.miles));
check('every milestone states a real distance',
  ach.miles.every(m => /\d/.test(m.detail || '')), JSON.stringify(ach.miles));
check('and a bar that matches it',
  ach.miles.every(m => /^\d+%$/.test(m.width || '')), JSON.stringify(ach.miles.map(m => m.width)));
eq('the collection is closed until asked for', ach.rows, 0);

await page.locator('.f41-expand').click();
await page.waitForTimeout(400);
const collection = await page.evaluate(() => ({
  rows: document.querySelectorAll('.f41-col-row').length,
  locked: document.querySelectorAll('.f41-col-row.locked').length,
}));
const total = Number((ach.counter || '').split(' of ')[1]);
eq('opening it shows every achievement', collection.rows, total);
check('with the ones not yet earned marked as such',
  collection.locked === total - ach.earnedCount || collection.locked > 0,
  `${collection.locked} locked of ${collection.rows}`);
await page.locator('.f41-expand').click();
await page.waitForTimeout(300);

// ════════════════════════════════════════════════════════════════════════════
// 7. Recent wins are real, dated, and not the Today list
// ════════════════════════════════════════════════════════════════════════════

const wins = await page.evaluate(() => [...document.querySelectorAll('.f41-win')].map(w => ({
  kind: [...w.classList].filter(c => c !== 'f41-win').join(),
  title: w.querySelector('.f41-win-title')?.textContent?.trim(),
  when: w.querySelector('.f41-win-when')?.textContent?.trim(),
  xp: w.querySelector('.f41-win-xp')?.textContent?.trim() || null,
})));
check('there are wins to show', wins.length > 0, `${wins.length}`);
check('every one of them is dated', wins.every(w => !!w.when), JSON.stringify(wins));
check('the dated rank unlock is among them',
  wins.some(w => w.kind === 'rank' && /True Warrior/.test(w.title)), JSON.stringify(wins));
check('the backfilled rank is not — Forge never stored when it happened',
  !wins.some(w => /Elite Warrior/.test(w.title)), JSON.stringify(wins));
check('a finished challenge reports the XP it banked',
  wins.some(w => w.kind === 'challenge' && /\+[\d,]+ XP/.test(w.xp || '')), JSON.stringify(wins));
check('no win repeats a single task from the Today list',
  !wins.some(w => /Sleep opportunity|Flow training|Complete Daily Log/.test(w.title)),
  JSON.stringify(wins.map(w => w.title)));

// An era-1 challenge is quoted on the ladder the balance moves on: 420 stored
// under the old economy is 4,200 of today's XP.
check('an era-1 challenge is quoted in current XP',
  wins.some(w => /4,200 XP/.test(w.xp || '')),
  JSON.stringify(wins.filter(w => w.kind === 'challenge')));

// ════════════════════════════════════════════════════════════════════════════
// 8. Home reads. It never writes.
// ════════════════════════════════════════════════════════════════════════════

const before = await snapshot();
for (const sel of ['.xp-details-btn', '.f41-expand', '.perf-expand-btn']) {
  const els = await page.locator(sel).count();
  for (let i = 0; i < els; i++) {
    await page.locator(sel).nth(i).click();
    await page.waitForTimeout(200);
  }
}
await page.waitForTimeout(400);
eq('opening every panel on Home changes no stored data', await snapshot(), before);
check('the rank ladder opens', (await page.locator('.rank-ladder-card').count()) === 1);
check('the rank details open', (await page.locator('.rank-details-card').count()) === 1);
check('and XP History is still reachable from them',
  (await page.locator('.xph-toggle').count()) === 1);

// ════════════════════════════════════════════════════════════════════════════
// 9. Two lanes
// ════════════════════════════════════════════════════════════════════════════

await seed({ support: true });
const lanes = await page.evaluate(() => ({
  stack: document.querySelectorAll('.stack-card').length,
  text: document.querySelector('.stack-card')?.textContent?.replace(/\s+/g, ' ') || '',
  primaryName: document.querySelector('.stack-lane.primary .stack-name')?.textContent?.trim(),
  supportName: document.querySelector('.stack-lane.support .stack-name')?.textContent?.trim(),
  primarySize: parseFloat(getComputedStyle(document.querySelector('.stack-lane.primary .stack-name')).fontSize),
  supportSize: parseFloat(getComputedStyle(document.querySelector('.stack-lane.support .stack-name')).fontSize),
  ctas: document.querySelectorAll('.f41-cta').length,
}));
eq('both lanes live in one card', lanes.stack, 1);
check('it labels them PRIMARY and SUPPORT',
  /PRIMARY/.test(lanes.text) && /SUPPORT/.test(lanes.text), lanes.text.slice(0, 120));
eq('the primary is named', lanes.primaryName, 'LOCK IN');
eq('the support is named', lanes.supportName, 'Mental Training Phase');
check('each lane keeps its own day count',
  /Day 5 \/ 14/.test(lanes.text) && /Day 3 \/ 21/.test(lanes.text), lanes.text);
check('the primary reads as the dominant one',
  lanes.primarySize > lanes.supportSize, `${lanes.primarySize} vs ${lanes.supportSize}`);
eq('there is still one route to today', lanes.ctas, 1);

// ════════════════════════════════════════════════════════════════════════════
// 10. Forge Daily has no challenge furniture to show
// ════════════════════════════════════════════════════════════════════════════

await seed({ baseline: true, archives: false });
const base = await page.evaluate(() => ({
  name: document.querySelector('.f41-chal-name')?.textContent?.trim(),
  status: document.querySelector('.f41-status')?.textContent?.trim(),
  bar: document.querySelectorAll('.f41-chal-bar').length,
  left: /remaining/.test(document.querySelector('.f41-chal-foot')?.textContent || ''),
  perf: document.querySelectorAll('.perf-card').length,
  day: document.querySelector('.hero-day-num')?.textContent?.trim(),
}));
eq('Forge Daily is named as itself', base.name, 'Forge Daily');
eq('and labelled as the baseline', base.status, 'Baseline');
eq('it has no fixed length, so no progress bar', base.bar, 0);
eq('and nothing counting down', base.left, false);
eq('an unscored baseline shows no performance card', base.perf, 0);
check('but it still reports which day it is', /^\d+$/.test(base.day || ''), base.day);

// ════════════════════════════════════════════════════════════════════════════
// 11. The other four tabs are untouched
// ════════════════════════════════════════════════════════════════════════════

await seed();
const others = {};
for (const [name, sel] of [
  ['Today', '.check-item'],
  ['Challenges', '.f4c-home'],
  ['Insights', '.main-content'],
  ['Settings', '.settings-section'],
]) {
  await tab(name);
  others[name] = await page.locator(sel).count();
}
check('Today still renders its task list', others.Today > 0, `${others.Today}`);
check('Challenges still renders its home screen', others.Challenges === 1);
check('Insights still renders', others.Insights === 1);
check('Settings still renders its sections', others.Settings > 0, `${others.Settings}`);

// Today keeps the FULL performance card — compact is Home's mode alone. On
// Today it lives behind the named disclosure Forge 4.0 put it behind, so it is
// opened the way a person opens it.
await tab('Today');
const perfSection = page.locator('.f4-collapse', { hasText: /Performance/i }).first();
check('the grading breakdown is still behind its disclosure on Today',
  (await perfSection.count()) === 1 && (await page.locator('.perf-card').count()) === 0);
await perfSection.locator('.f4-collapse-head').click();
await page.waitForTimeout(500);
const todayPerf = await page.evaluate(() => ({
  cards: document.querySelectorAll('.perf-card').length,
  compact: document.querySelectorAll('.perf-card.perf-compact').length,
  projection: document.querySelectorAll('.perf-projection').length,
}));
check('and opens in full, not in Home\'s compact form',
  todayPerf.cards === 1 && todayPerf.compact === 0, JSON.stringify(todayPerf));
check('with its projection showing, as it always did', todayPerf.projection >= 1,
  JSON.stringify(todayPerf));

// ════════════════════════════════════════════════════════════════════════════
// 12. It fits on a phone
// ════════════════════════════════════════════════════════════════════════════

for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 844 });
  await tab('Home');
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    small: [...document.querySelectorAll('.f41-cta, .f41-expand, .f41-rank-tool, .f41-link')]
      .filter(b => b.getBoundingClientRect().height < 36)
      .map(b => `${b.className}:${Math.round(b.getBoundingClientRect().height)}`),
  }));
  eq(`${w}px: no horizontal overflow`, fit.overflow, 0);
  eq(`${w}px: every control is big enough to tap`, fit.small, []);
}
await page.setViewportSize({ width: 390, height: 844 });

eq('no page errors through the whole run', errors, []);

// ── Summary ─────────────────────────────────────────────────────────────────

await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
