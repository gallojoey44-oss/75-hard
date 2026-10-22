/**
 * The one-time XP reconciliation, end to end.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/xp-reconciliation-e2e-test.mjs
 *
 * Seeds a profile matching the reported state — True Warrior, Lifetime XP in
 * the 8,000s, a 7,500 floor, an abandoned Forge Daily run in its history — and
 * drives the real UI: the exact figure is shown before anything changes, the
 * user approves it, Lifetime XP drops, the rank survives, the archives are
 * untouched, and a second visit cannot charge again.
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
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);

/** Lifetime XP as the Home screen displays it. */
async function shownLifetime() {
  await gotoTab('Home');
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const t = document.querySelector('.xp-split-row')?.textContent || '';
    return parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
  });
}

async function openSettings() {
  await gotoTab('Settings');
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('.xpr-card')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
}

/**
 * Seed: a True Warrior with a healthy completed challenge plus an abandoned
 * 30-day Forge Daily run whose deficit was discarded at archive time.
 */
async function seed() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(() => {
    const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
    const FD = [
      { id: 'fd_sleep', name: 'Hit sleep goal', xp: 8, keystone: 0 },
      { id: 'fd_mind', name: 'Mental Training', xp: 12, keystone: 1 },
      { id: 'fd_read', name: 'Read', xp: 6, keystone: 0 },
    ];
    const p = JSON.parse(localStorage.getItem('profiles'));
    // True Warrior, unlocked permanently.
    p.me.highestRank = 7;
    p.me.xpPenalties = true;
    p.me.xpLedger = undefined;
    // LOCK IN, started today — Day 1, so the current segment is zero.
    p.me.challengeStart = d(0);
    p.me.activeChallenge = {
      templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
      durationDays: 14, templateVersion: 1, completionBonusXP: 700, lockIn: { durationDays: 14 },
    };
    p.me.tasks = [
      { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, source: 'template', order: 0 },
      { id: 'li_flow', name: 'Flow training', icon: '🌊', xp: 35, keystone: 3, source: 'template', order: 1 },
    ];
    p.girlfriend.highestRank = 7;
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));

    // Archive 1: a completed challenge that banked 8,245 XP. Ended in credit,
    // so its penalties were already applied — it must NOT be charged again.
    const healthyDays = {};
    for (let i = 1; i <= 14; i++) healthyDays[i] = { tasks: { h_a: true, h_b: true } };
    const healthy = {
      id: 'arch_healthy', archivedAt: d(-40), challengeStart: d(-54), endDate: d(-41),
      challenge: { templateId: 'legacy_challenge', name: 'Discipline Block', durationDays: 14 },
      endDayNum: 14, xpStartDay: 1, xpOffset: 0,
      tasks: [{ id: 'h_a', name: 'A', xp: 40, keystone: 3 }, { id: 'h_b', name: 'B', xp: 35, keystone: 3 }],
      days: healthyDays,
      // Deliberately NOT reproducible from its own records — a legacy archive.
      // It must be skipped rather than charged on a guess.
      xpEarned: 8245,
      weeklySessions: [], comebackHistory: [],
    };

    // Archive 2: an abandoned Forge Daily run — one logged day then 29 away.
    // Built so its stored figure is exactly max(0, gained − lost) = 0.
    const abandoned = {
      id: 'arch_abandoned', archivedAt: d(-1), challengeStart: d(-30), endDate: d(-1),
      challenge: { templateId: 'forge_daily', name: 'Forge Daily', durationDays: null, isBaseline: true },
      endDayNum: 30, xpStartDay: 1, xpOffset: 0,
      tasks: FD,
      days: { 1: { tasks: { fd_sleep: true, fd_mind: true, fd_read: true } } },
      xpEarned: 0,
      weeklySessions: [], comebackHistory: [],
    };
    localStorage.setItem('archives', JSON.stringify({ me: [healthy, abandoned], girlfriend: [] }));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: the starting state ══════════════════════════════════════════════════
await seed();
const lifetime0 = await shownLifetime();
check('1: the profile starts at 8,245 Lifetime XP', lifetime0 === 8245, `${lifetime0}`);
check('1: the rank is True Warrior',
  /True Warrior/i.test(await page.textContent('.dashboard')));
check('1: no ledger exists yet — nothing has been charged',
  (await prof()).xpLedger == null);

// ══ 2: the XP breakdown shows earned and deductions ════════════════════════
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Details/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(400);
let details = await page.textContent('.rank-details-card');
check('2: Current XP is shown', /Current XP/.test(details), details.replace(/\s+/g, ' ').slice(0, 140));
// The main card carries no standing deduction line. A charge from weeks ago
// read as an ongoing penalty there, so the accounting lives in XP History.
check('2: the main card carries no standing deduction line',
  !/Total XP Earned/.test(details) && !/XP Lost from Missed Days/.test(details));
check('2: XP History is offered instead', /XP History/.test(details));
check('2: XP Until Next Rank is shown', /XP Until Next Rank/.test(details));
check('2: the retired technical labels are gone',
  !/Lifetime XP/i.test(details) && !/Inactivity deductions/i.test(details) && !/of which/i.test(details),
  (details.match(/Lifetime XP|Inactivity deductions|of which/i) || []).join(', ') || 'none present');
check('2: it says ranks and achievements are permanent',
  /rank and achievements are permanent/i.test(details));
check('2: Current XP is the visually prominent figure',
  (await page.locator('.rank-detail-value.big').count()) === 1);
// The figures still have to reconcile — they have just moved to XP History.
await page.locator('.xph-toggle').click();
await page.waitForTimeout(400);
const totals2 = await page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('.xph-total-row')].map(r => [...r.children].map(c => c.textContent.trim()))
));
check('2: the figures reconcile — earned minus lost equals current',
  (() => {
    const num = (k) => parseInt(String(totals2[k] || '0').replace(/[^\d]/g, ''), 10) || 0;
    return num('Total XP earned') - num('Missed-day penalties')
      + num('Cancelled by your rank protection') === num('Current XP');
  })(), JSON.stringify(totals2));
await page.locator('.xph-toggle').click();
await page.waitForTimeout(200);

// ══ 3: the reconciliation card — the figure BEFORE anything changes ════════
await openSettings();
check('3: the reconciliation card is offered', (await page.locator('.xpr-card').count()) === 1);
const card = await page.textContent('.xpr-card');
check('3: the heading is Uncounted Missed Days', /Uncounted Missed Days/.test(card));
check('3: the explanation is the plain-language one',
  /found missed days from your previous challenges that were never deducted/i.test(card));
check('3: no accounting or software vocabulary appears',
  !/reconciliation|archived deficit|penalty ledger|segment|recomput|floor clamp|discarded/i.test(card),
  (card.match(/reconciliation|archived deficit|penalty ledger|segment|recomput|floor clamp|discarded/i) || []).join(', ') || 'clean');

const readRows = async () => Object.fromEntries((await page.evaluate(() =>
  [...document.querySelectorAll('.xpr-row')].map(r => [...r.children].map(c => c.textContent.trim()))
)).map(([k, v]) => [k, /^[−\-]?[\d,]+/.test(v) ? parseInt(String(v).replace(/[^\d]/g, ''), 10) : v]));
const rows = await readRows();
const MISSED_DAYS = 29, MISS_PENALTY = 25, DAY_ONE_EARNED = 26 + 50;
const EXPECTED = MISSED_DAYS * MISS_PENALTY - DAY_ONE_EARNED;   // 649
check('3: the figures are labelled in plain language',
  ['Current XP', 'Missed days found', 'XP you would actually lose', 'Your XP after applying', 'Your permanent rank']
    .every(l => card.includes(l)),
  Object.keys(rows).join(' | '));
check('3: Current XP is shown first', rows['Current XP'] === 8245);
check('3: the missed days found matches the uncounted total',
  rows['Missed days found'] === EXPECTED, String(rows['Missed days found']));
check('3: the real loss is shown — here it fits under the floor, so the same',
  rows['XP you would actually lose'] === EXPECTED, String(rows['XP you would actually lose']));
check('3: the resulting XP is shown', rows['Your XP after applying'] === 8245 - EXPECTED);
check('3: the permanent rank is named', rows['Your permanent rank'] === 'True Warrior');
check('3: it explains the floor in plain language',
  /protects you from falling below 7,500 XP/i.test(card));
check('3: it says achievements and completed challenges remain permanent',
  /achievements and completed challenges remain/i.test(card));
check('3: older challenges it could not check are explained simply, not as an error',
  /could not check/i.test(card) && /reliably/i.test(card));

await page.locator('.xpr-link').first().click();
await page.waitForTimeout(250);
const segs = await page.evaluate(() => [...document.querySelectorAll('.xpr-period')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
check('3: the breakdown is headed "Where did I lose XP?"', /Where did I lose XP/i.test(card));
check('3: it separates not-yet-counted from already-counted',
  /Not yet counted/i.test(await page.textContent('.xpr-segments')));
check('3: the period shows name, dates, missed days, earned and penalties',
  segs.length === 1 && /Forge Daily/.test(segs[0]) && /Days missed 29/.test(segs[0]) &&
  /XP earned \+76/.test(segs[0]) && /Missed-day penalties −725/.test(segs[0]) &&
  /Net adjustment −649/.test(segs[0]),
  segs[0]);
check('3: the healthy challenge is NOT in the list — no double-charging',
  !segs.some(x => /Discipline Block/.test(x)));

// ══ 4: nothing is charged until approval ═══════════════════════════════════
check('4: Lifetime XP is unchanged while only previewing', (await shownLifetime()) === 8245);
check('4: still no ledger on the profile', (await prof()).xpLedger == null);

// ══ 5: approving it ════════════════════════════════════════════════════════
await openSettings();
await page.locator('.xpr-apply').click();
await page.waitForTimeout(300);
const confirmText = await page.textContent('.xpr-confirm');
check('5: confirmation names the profile and the real amount',
  confirmText.includes(String(EXPECTED)) && /undo this afterwards/i.test(confirmText),
  confirmText.replace(/\s+/g, ' ').slice(0, 120));
await page.locator('.xpr-confirm .btn-primary').click();
await page.waitForTimeout(600);
const lifetime1 = await shownLifetime();
check('5: Lifetime XP drops by exactly the stated amount',
  lifetime1 === 8245 - EXPECTED, `${lifetime0} → ${lifetime1}`);
check('5: the ledger records the charge once',
  (await prof()).xpLedger?.reconciled?.amount === EXPECTED);
check('5: it records the previous balance so it can be undone',
  (await prof()).xpLedger?.reconciled?.lifetimeBefore === 8245);

// ══ 6: archives are untouched ══════════════════════════════════════════════
const archivesAfter = await arch();
check('6: both archives survive', archivesAfter.length === 2);
check('6: the banked XP of each archive is unchanged',
  archivesAfter.find(a => a.id === 'arch_healthy').xpEarned === 8245 &&
  archivesAfter.find(a => a.id === 'arch_abandoned').xpEarned === 0);
check('6: no penalty field was written into an archive',
  archivesAfter.every(a => a.penaltyXP === undefined));
check('6: the archived day records are intact',
  Object.keys(archivesAfter.find(a => a.id === 'arch_abandoned').days).length === 1);

// ══ 7: the rank survives ═══════════════════════════════════════════════════
check('7: the rank is still True Warrior after the deduction',
  /True Warrior/i.test(await page.textContent('.dashboard')));
check('7: and the profile still holds the permanent unlock',
  (await prof()).highestRank === 7);
check('7: Lifetime XP is above the floor, so the full charge applied',
  lifetime1 > 7500, `${lifetime1} vs floor 7500`);

// ══ 8: the deduction is recorded in XP History, not on the main card ═══════
// The main card deliberately carries no standing deduction line: a charge
// from weeks ago read as an ongoing penalty there. The permanent accounting
// moved into XP History, which still has to reconcile.
await gotoTab('Home');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Details/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(400);
details = await page.textContent('.rank-details-card');
check('8: the main card carries no standing deduction line',
  !/XP Lost from Missed Days/.test(details) && !/Total XP Earned/.test(details),
  details.replace(/\s+/g, ' ').slice(0, 160));

await page.locator('.xph-toggle').click();
await page.waitForTimeout(400);
const totals8 = await page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('.xph-total-row')].map(r => [...r.children].map(c => c.textContent.trim()))
));
const num8 = (k) => parseInt(String(totals8[k] || '0').replace(/[^\d]/g, ''), 10) || 0;
check('8: XP History shows the historical figure', num8('Missed-day penalties') === EXPECTED,
  JSON.stringify(totals8));
check('8: earned XP is still shown in full, undiminished', num8('Total XP earned') === 8245,
  JSON.stringify(totals8));
check('8: and the history reconciles with the balance',
  num8('Total XP earned') - num8('Missed-day penalties')
    + num8('Cancelled by your rank protection') === num8('Current XP'),
  JSON.stringify(totals8));

// ══ 9: exactly once, across reloads and repeat visits ══════════════════════
for (let i = 0; i < 3; i++) {
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 8000 });
}
check('9: three reloads do not charge again', (await shownLifetime()) === lifetime1);
await openSettings();
check('9: the pending notice is replaced by a record of what was applied',
  /Missed days counted/i.test(await page.textContent('.xpr-card')) &&
  !/Uncounted Missed Days/i.test(await page.textContent('.xpr-card')));
check('9: there is no apply button left to press',
  (await page.locator('.xpr-apply').count()) === 0);
check('9: the ledger still holds a single charge',
  (await prof()).xpLedger?.reconciled?.amount === EXPECTED);

// ══ 10: the other profile is untouched ═════════════════════════════════════
check('10: the second profile is never charged',
  !(await prof('girlfriend')).xpLedger?.reconciled,
  JSON.stringify((await prof('girlfriend')).xpLedger || null));
check('10: and no archives were created for it', (await arch('girlfriend')).length === 0);

// ══ 11: undo restores the previous balance exactly ═════════════════════════
// Undo resets the reconciliation and nothing else: a dismissed comeback
// notice must not come back to life with it.
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.xpLedger = { ...(p.me.xpLedger || {}), seenComeback: 'sentinel-gap' };
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await openSettings();
await page.locator('.xpr-undo').click();
await page.waitForTimeout(600);
check('11: undo restores 8,245 exactly', (await shownLifetime()) === 8245);
check('11: the ledger is cleared', !(await prof()).xpLedger?.reconciled);
check('11: and it leaves an unrelated dismissal alone',
  (await prof()).xpLedger?.seenComeback === 'sentinel-gap',
  String((await prof()).xpLedger?.seenComeback));
await openSettings();
check('11: the offer comes back', (await page.locator('.xpr-apply').count()) === 1);

// ══ 12: the floor holds when the charge would breach it ════════════════════
// Re-seed with a smaller banked balance so the deduction would go below 7,500.
await page.evaluate(() => {
  const a = JSON.parse(localStorage.getItem('archives'));
  a.me = a.me.map(x => (x.id === 'arch_healthy' ? { ...x, xpEarned: 7600 } : x));
  localStorage.setItem('archives', JSON.stringify(a));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
check('12: the starting balance is now 7,600', (await shownLifetime()) === 7600);
await openSettings();
const floorRows = await readRows();
check('12: the real loss is capped at the XP above the floor, not the full total',
  floorRows['XP you would actually lose'] === 100 && floorRows['Missed days found'] === EXPECTED,
  `found ${floorRows['Missed days found']}, actually lose ${floorRows['XP you would actually lose']}`);
check('12: the resulting XP is the floor itself', floorRows['Your XP after applying'] === 7500);
check('12: it explains that the rest is cancelled rather than saved up',
  /is cancelled, not saved up/i.test(await page.textContent('.xpr-card')));
await page.locator('.xpr-apply').click();
await page.waitForTimeout(250);
await page.locator('.xpr-confirm .btn-primary').click();
await page.waitForTimeout(600);
const floored = await shownLifetime();
check('12: Lifetime XP is held at the 7,500 floor, not the raw figure below it',
  floored === 7500 && (7600 - EXPECTED) < 7500, `${floored}, raw would be ${7600 - EXPECTED}`);
check('12: the rank is still True Warrior', /True Warrior/i.test(await page.textContent('.dashboard')));
check('12: the rank unlock is still stored', (await prof()).highestRank === 7);

// ══ 13: a profile with nothing to reconcile never sees the card ════════════
await page.evaluate(() => {
  localStorage.setItem('archives', JSON.stringify({ me: [], girlfriend: [] }));
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.xpLedger = undefined;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Settings');
await page.waitForTimeout(600);
check('13: with no discarded penalties the card is hidden entirely',
  (await page.locator('.xpr-card').count()) === 0);

// ══ 14: mobile layout ══════════════════════════════════════════════════════
await seed();
await openSettings();
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const el = document.querySelector('.xpr-card');
    const r = el.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      inside: r.left >= -1 && r.right <= window.innerWidth + 1,
    };
  });
  check(`14: no horizontal overflow at ${w}px`, m.overflow <= 1, `${m.overflow}px`);
  check(`14: the card fits at ${w}px`, m.inside);
}
await page.setViewportSize({ width: 390, height: 844 });

check('15: no page errors throughout',
  errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
