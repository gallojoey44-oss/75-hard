/**
 * Missed-day notices across the whole lifecycle.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/welcome-back-e2e-test.mjs
 *
 * The complaint this answers: "XP Lost from Missed Days: −25" sat on the Rank
 * Details card forever, so an old deduction looked like an ongoing penalty.
 *
 * So the test follows a profile through the states that matter — away, just
 * back, properly back, challenge finished, new challenge started — and checks
 * what the interface says at each one. The headline assertions are the
 * absences: no standing deduction on the main card, no notice after the
 * challenge is archived, and no re-announcement of the same gap on reload.
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
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);

async function openDetails() {
  await gotoTab('Home');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const open = document.querySelector('.rank-details-card');
    if (!open) {
      const b = [...document.querySelectorAll('button')].find(x => /Details/i.test(x.textContent));
      if (b) b.click();
    }
  });
  await page.waitForTimeout(400);
  return page.textContent('.rank-details-card');
}

/**
 * Seed a LOCK IN run started `startedDaysAgo` ago, with `logged` day numbers
 * completed. Everything else in that range counts as missed.
 */
async function seed({ startedDaysAgo, logged, archives = [] }) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(({ ago, log, arch }) => {
    const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 7;
    p.me.xpPenalties = true;
    p.me.challengeStart = d(-ago);
    p.me.activeChallenge = {
      templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
      durationDays: 30, templateVersion: 1, completionBonusXP: 700, lockIn: { durationDays: 30 },
    };
    p.me.tasks = [
      { id: 't_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, source: 'template', order: 0 },
      { id: 't_flow', name: 'Flow training', icon: '🌊', xp: 35, keystone: 3, source: 'template', order: 1 },
    ];
    localStorage.setItem('profiles', JSON.stringify(p));
    const days = {};
    for (const n of log) days[n] = { tasks: { t_sleep: true, t_flow: true } };
    localStorage.setItem('allDays', JSON.stringify({ me: days, girlfriend: {} }));
    localStorage.setItem('archives', JSON.stringify({ me: arch, girlfriend: [] }));
  }, { ago: startedDaysAgo, log: logged, arch: archives });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.waitForTimeout(400);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: the main card is simple ═════════════════════════════════════════════
// Days 1–2 logged, 3–8 missed, 9 logged, today is day 10.
await seed({ startedDaysAgo: 9, logged: [1, 2, 9] });
let details = await openDetails();
check('1: Current Rank is shown', /Current Rank/.test(details));
check('1: Current XP is shown', /Current XP/.test(details));
check('1: XP Until Next Rank is shown', /XP Until Next Rank/.test(details));
check('1: Challenge XP is shown', /Challenge XP/.test(details));
check('1: achievements and streaks are shown',
  /Best Streak/.test(details) && /Perfect Days/.test(details));
check('1: XP History is offered', /XP History/.test(details));
check('1: NO standing "XP Lost from Missed Days" line on the main card',
  !/XP Lost from Missed Days/.test(details),
  details.replace(/\s+/g, ' ').slice(0, 200));
check('1: and no standing "Total XP Earned" line either',
  !/Total XP Earned/.test(details));

// ══ 2: the Welcome Back notice ═════════════════════════════════════════════
await gotoTab('Home');
await page.waitForTimeout(400);
check('2: the notice appears after returning', (await page.locator('.wb-card').count()) === 1);
const wb = await page.textContent('.wb-card');
check('2: it says Welcome Back', /Welcome Back/i.test(wb));
check('2: it states the number of missed days', /6\s*missed days/i.test(wb.replace(/\s+/g, ' ')), wb.replace(/\s+/g, ' ').slice(0, 120));
check('2: it states the XP cost', /−150/.test(wb), wb.replace(/\s+/g, ' ').slice(0, 120));
check('2: it reassures about rank and achievements',
  /rank and achievements are protected/i.test(wb));
check('2: it shows the dates of the gap', /\w{3,}\s+\d/.test(wb.replace(/\s+/g, ' ')));

// The arithmetic: 6 missed days at the flat 25 XP miss penalty.
check('2: the figures are the real ones — 6 × 25 = 150', /6/.test(wb) && /150/.test(wb));

// ══ 3: today is never counted as missed ════════════════════════════════════
// Day 10 is today and unlogged, but the gap is days 3–8 only.
check('3: today is not included in the missed count',
  !/7\s*missed days/i.test(wb.replace(/\s+/g, ' ')));
await seed({ startedDaysAgo: 0, logged: [] });
await gotoTab('Home');
await page.waitForTimeout(400);
check('3: a brand-new challenge on day 1 shows no notice',
  (await page.locator('.wb-card').count()) === 0);
await seed({ startedDaysAgo: 1, logged: [1] });
await gotoTab('Home');
await page.waitForTimeout(400);
check('3: day 2 with day 1 logged shows no notice',
  (await page.locator('.wb-card').count()) === 0);

// ══ 4: the same gap is never announced twice ═══════════════════════════════
await seed({ startedDaysAgo: 9, logged: [1, 2, 9] });
await gotoTab('Home');
await page.waitForTimeout(400);
check('4: the notice is showing again on a fresh seed', (await page.locator('.wb-card').count()) === 1);
await page.locator('.wb-dismiss').click();
await page.waitForTimeout(500);
check('4: dismissing hides it', (await page.locator('.wb-card').count()) === 0);
check('4: the dismissal is recorded against this specific gap',
  (await prof()).xpLedger?.seenComeback === `${(await prof()).challengeStart}|3-8`,
  (await prof()).xpLedger?.seenComeback);
for (let i = 0; i < 3; i++) {
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.waitForTimeout(300);
}
await gotoTab('Home');
await page.waitForTimeout(400);
check('4: three reloads do not bring it back', (await page.locator('.wb-card').count()) === 0);

// A LATER, different gap is a new event and is announced.
await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('allDays'));
  const p = JSON.parse(localStorage.getItem('profiles'));
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  // Move the start back so there is room for a second gap, and log through 11.
  p.me.challengeStart = d(-16);
  localStorage.setItem('profiles', JSON.stringify(p));
  all.me[10] = { tasks: { t_sleep: true } };
  all.me[11] = { tasks: { t_sleep: true } };
  all.me[16] = { tasks: { t_sleep: true } };   // back again after 12–15 missed
  localStorage.setItem('allDays', JSON.stringify(all));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Home');
await page.waitForTimeout(500);
check('4: a NEW gap is announced even though an earlier one was dismissed',
  (await page.locator('.wb-card').count()) === 1);
const wb2 = await page.textContent('.wb-card');
check('4: and it describes the new gap, not the old one',
  /4\s*missed days/i.test(wb2.replace(/\s+/g, ' ')), wb2.replace(/\s+/g, ' ').slice(0, 120));

// ══ 5: the notice is temporary ═════════════════════════════════════════════
// Several days of renewed activity and it stops on its own, undismissed.
await seed({ startedDaysAgo: 13, logged: [1, 2, 10, 11, 12, 13] });
await gotoTab('Home');
await page.waitForTimeout(400);
check('5: after several days back the notice has aged out by itself',
  (await page.locator('.wb-card').count()) === 0);
check('5: and no dismissal was needed to achieve that',
  !(await prof()).xpLedger?.seenComeback);

// ══ 6: the optional breakdown for the CURRENT challenge ════════════════════
await seed({ startedDaysAgo: 9, logged: [1, 2, 9] });
details = await openDetails();
// Day 10 today, days 1, 2 and 9 logged, so days 3–8 are missed: 6 × 25 = 150.
check('6: the current challenge reports its missed days', /This challenge: 6 missed days/.test(details.replace(/\s+/g, ' ')),
  details.replace(/\s+/g, ' ').match(/This challenge[^−]*−\d+ XP/)?.[0]);
check('6: with the XP it cost', /−150 XP/.test(details));
check('6: the per-day list is collapsed by default',
  (await page.locator('.cmd-row').count()) === 0);
await page.locator('.cmd-toggle').click();
await page.waitForTimeout(300);
check('6: expanding lists each missed day', (await page.locator('.cmd-row').count()) === 6);
check('6: it says today is not counted',
  /isn.t counted/i.test(await page.textContent('.cmd')));

// ══ 7: XP History reconciles ═══════════════════════════════════════════════
await page.locator('.xph-toggle').click();
await page.waitForTimeout(400);
const hist = await page.textContent('.xph-body');
check('7: the live challenge appears under "In progress"', /In progress/.test(hist));
check('7: with its earned XP, days missed and penalties',
  /XP earned/.test(hist) && /Days missed/.test(hist) && /Missed-day penalties/.test(hist));
const totals = await page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('.xph-total-row')].map(r => [...r.children].map(c => c.textContent.trim()))
));
check('7: the totals section shows earned, penalties and Current XP',
  'Total XP earned' in totals && 'Current XP' in totals,
  Object.keys(totals).join(' | '));
check('7: and they reconcile exactly',
  (() => {
    const num = (k) => parseInt(String(totals[k] || '0').replace(/[^\d]/g, ''), 10) || 0;
    const earned = num('Total XP earned');
    const pen = num('Missed-day penalties');
    const prot = num('Cancelled by your rank protection');
    return earned - pen + prot === num('Current XP');
  })(), JSON.stringify(totals));

// What this run has banked while live. Section 8 archives it with exactly this
// figure, as finishing a challenge really does, so the archived breakdown can
// be recomputed instead of falling back to "detail unavailable" — and so
// section 9 can prove the number did not move when it was archived.
const livePeriod = await page.evaluate(() => {
  const period = document.querySelector('.xph-period');
  const out = {};
  for (const r of period.querySelectorAll('.xph-period-row')) {
    out[r.children[0].textContent.trim()] = parseInt(
      (r.children[1].textContent || '').replace(/[^\d]/g, ''), 10) || 0;
  }
  return out;
});
const liveBanked = livePeriod['So far'];
check('7: the live run reports a banked figure', liveBanked > 0, JSON.stringify(livePeriod));
// Six missed days cannot add up to a penalty of 165, so the part that comes
// from days logged but left unfinished gets its own line and the row closes.
check('7: the period\'s own rows add up',
  livePeriod['XP earned'] - livePeriod['Missed-day penalties']
    - (livePeriod['Unfinished days'] || 0) === liveBanked,
  JSON.stringify(livePeriod));
check('7: and the missed-day penalty matches the days missed',
  livePeriod['Missed-day penalties'] === livePeriod['Days missed'] * 25,
  `${livePeriod['Days missed']} × 25 vs ${livePeriod['Missed-day penalties']}`);

// ══ 8: completing the challenge clears the notice from Rank Details ════════
await page.evaluate((banked) => {
  // Archive the run and start fresh, as completing a challenge does.
  const p = JSON.parse(localStorage.getItem('profiles'));
  const all = JSON.parse(localStorage.getItem('allDays'));
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'arch_done', archivedAt: d(0), challengeStart: p.me.challengeStart, endDate: d(0),
    challenge: p.me.activeChallenge, endDayNum: 10, xpStartDay: 1, xpOffset: 0,
    tasks: p.me.tasks, days: all.me, xpEarned: banked, weeklySessions: [], comebackHistory: [],
  }], girlfriend: [] }));
  p.me.challengeStart = d(0);
  p.me.activeChallenge = { templateId: 'forge_daily', name: 'Forge Daily', durationDays: null, isBaseline: true };
  p.me.tasks = [{ id: 'fd_sleep', name: 'Hit sleep goal', icon: '😴', xp: 8, keystone: 0, source: 'template', order: 0 }];
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
}, liveBanked);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Home');
await page.waitForTimeout(500);
check('8: no Welcome Back notice carries into the new period',
  (await page.locator('.wb-card').count()) === 0);
details = await openDetails();
check('8: the finished challenge\'s missed days are gone from the main card',
  !/This challenge:/.test(details), details.replace(/\s+/g, ' ').match(/This challenge[^|]*/)?.[0] || 'absent');
check('8: and there is still no standing deduction line',
  !/XP Lost from Missed Days/.test(details));

// ══ 9: but the record is kept, and the XP stays deducted ═══════════════════
await page.locator('.xph-toggle').click();
await page.waitForTimeout(400);
const hist2 = await page.textContent('.xph-body');
check('9: the finished challenge is listed under Completed', /Completed/.test(hist2));
check('9: it is named', /LOCK IN/.test(hist2));

// The archived period is read back from the records it stored, not guessed.
const done = await page.evaluate(() => {
  const period = [...document.querySelectorAll('.xph-period')]
    .find(p => /LOCK IN/.test(p.querySelector('.xph-period-name')?.textContent || ''));
  if (!period) return null;
  const out = { unavailable: /could not read/i.test(period.textContent) };
  for (const r of period.querySelectorAll('.xph-period-row')) {
    out[r.children[0].textContent.trim()] = parseInt(
      (r.children[1].textContent || '').replace(/[^\d]/g, ''), 10) || 0;
  }
  return out;
});
check('9: its day-by-day record was readable after archiving',
  done && !done.unavailable, JSON.stringify(done));
check('9: the archived run still shows the days that were missed',
  done?.['Days missed'] === 6, String(done?.['Days missed']));
// Archiving must not move any figure: same earned, same penalties, same total.
check('9: its penalties were not refunded by completing it',
  done?.['Missed-day penalties'] === livePeriod['Missed-day penalties'] &&
  (done?.['Unfinished days'] || 0) === (livePeriod['Unfinished days'] || 0) &&
  done?.['XP earned'] === livePeriod['XP earned'] &&
  done?.Banked === liveBanked,
  `archived ${JSON.stringify(done)} vs live ${JSON.stringify(livePeriod)}`);
check('9: the archived period\'s rows still add up',
  done?.['XP earned'] - done?.['Missed-day penalties']
    - (done?.['Unfinished days'] || 0) === done?.Banked,
  JSON.stringify(done));

// ══ 10: starting another challenge ═════════════════════════════════════════
await seed({ startedDaysAgo: 0, logged: [], archives: [] });
await gotoTab('Home');
await page.waitForTimeout(400);
check('10: a fresh challenge shows no notice', (await page.locator('.wb-card').count()) === 0);
details = await openDetails();
check('10: and no current-challenge missed-day block', !/This challenge:/.test(details));

// ══ 11: profile isolation and mobile layout ════════════════════════════════
await seed({ startedDaysAgo: 9, logged: [1, 2, 9] });
check('11: the other profile has no dismissal recorded',
  !(await prof('girlfriend')).xpLedger?.seenComeback);
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 844 });
  await gotoTab('Home');
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const el = document.querySelector('.wb-card');
    const r = el ? el.getBoundingClientRect() : null;
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      inside: !r || (r.left >= -1 && r.right <= window.innerWidth + 1),
    };
  });
  check(`11: no horizontal overflow at ${w}px`, m.overflow <= 1, `${m.overflow}px`);
  check(`11: the notice fits at ${w}px`, m.inside);
}
await page.setViewportSize({ width: 390, height: 844 });

check('12: no page errors throughout',
  errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
