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
check('2: the breakdown shows Earned', /Earned/i.test(details), details.slice(0, 120));
check('2: it shows Lifetime XP', /Lifetime XP/i.test(details));
check('2: with nothing deducted yet, no deduction row is shown',
  !/Inactivity deductions/i.test(details));

// ══ 3: the reconciliation card — the figure BEFORE anything changes ════════
await openSettings();
check('3: the reconciliation card is offered', (await page.locator('.xpr-card').count()) === 1);
const card = await page.textContent('.xpr-card');
check('3: it states that these penalties were calculated and discarded',
  /charged these inactivity penalties at the time and then discarded/i.test(card));
check('3: it promises archived records are not changed',
  /archived challenge records are not changed/i.test(card));
const amount = await page.evaluate(() => {
  const t = document.querySelector('.xpr-amount')?.textContent || '';
  return parseInt(t.replace(/[^\d]/g, ''), 10);
});
// The arithmetic, stated so the expected figure is derived rather than
// asserted: 29 missed days × 25 = 725 lost, against day 1's 26 XP of tasks
// plus the 50 XP perfect-day bonus = 76 gained. The clip was 725 − 76.
const MISSED_DAYS = 29, MISS_PENALTY = 25, DAY_ONE_EARNED = 26 + 50;
const EXPECTED = MISSED_DAYS * MISS_PENALTY - DAY_ONE_EARNED;   // 649
check('3: the exact figure is shown and matches the discarded deficit',
  amount === EXPECTED, `−${amount} XP, expected −${EXPECTED}`);
const maths = await page.evaluate(() => [...document.querySelectorAll('.xpr-row')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
check('3: the arithmetic is shown line by line',
  maths.some(r => /Lifetime XP now 8,245/.test(r)) &&
  maths.some(r => new RegExp(`Discarded penalties −${EXPECTED}`).test(r)) &&
  maths.some(r => new RegExp(`After reconciliation ${(8245 - EXPECTED).toLocaleString()}`).test(r)),
  maths.join(' | '));
check('3: it explains the rank floor protects the rank itself',
  /can never fall below 7,500 XP/i.test(card), card.match(/never fall below[^.]*/)?.[0]);
check('3: the legacy archive it could not reproduce is reported, not charged',
  /could not be recalculated exactly/i.test(card));

await page.locator('.xpr-link').first().click();
await page.waitForTimeout(250);
const segs = await page.evaluate(() => [...document.querySelectorAll('.xpr-seg')].map(s => s.innerText.replace(/\s+/g, ' ').trim()));
check('3: it names the challenge being charged',
  segs.length === 1 && /Forge Daily/.test(segs[0]) && segs[0].includes(String(EXPECTED)), segs.join(' | '));
check('3: the healthy challenge is NOT in the list — no double-charging',
  !segs.some(s => /Discipline Block/.test(s)));

// ══ 4: nothing is charged until approval ═══════════════════════════════════
check('4: Lifetime XP is unchanged while only previewing', (await shownLifetime()) === 8245);
check('4: still no ledger on the profile', (await prof()).xpLedger == null);

// ══ 5: approving it ════════════════════════════════════════════════════════
await openSettings();
await page.locator('.xpr-apply').click();
await page.waitForTimeout(300);
const confirmText = await page.textContent('.xpr-confirm');
check('5: confirmation names the profile and the amount',
  confirmText.includes(String(EXPECTED)) && /can be undone/i.test(confirmText),
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

// ══ 8: the breakdown now shows the deduction ═══════════════════════════════
await gotoTab('Home');
await page.waitForTimeout(400);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Details/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(400);
details = await page.textContent('.rank-details-card');
check('8: an inactivity deduction row appears', /Inactivity deductions/i.test(details));
check('8: it shows the historical figure', details.includes(String(EXPECTED)),
  details.replace(/\s+/g, ' ').slice(0, 200));
check('8: earned XP is still shown in full, undiminished', /8,245/.test(details));

// ══ 9: exactly once, across reloads and repeat visits ══════════════════════
for (let i = 0; i < 3; i++) {
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 8000 });
}
check('9: three reloads do not charge again', (await shownLifetime()) === lifetime1);
await openSettings();
check('9: the card now reports it as applied rather than offering it again',
  /Historical XP reconciled/i.test(await page.textContent('.xpr-card')));
check('9: there is no apply button left to press',
  (await page.locator('.xpr-apply').count()) === 0);
check('9: the ledger still holds a single charge',
  (await prof()).xpLedger?.reconciled?.amount === EXPECTED);

// ══ 10: the other profile is untouched ═════════════════════════════════════
check('10: the second profile has no ledger', (await prof('girlfriend')).xpLedger == null);
check('10: and no archives were created for it', (await arch('girlfriend')).length === 0);

// ══ 11: undo restores the previous balance exactly ═════════════════════════
await openSettings();
await page.locator('.xpr-undo').click();
await page.waitForTimeout(600);
check('11: undo restores 8,245 exactly', (await shownLifetime()) === 8245);
check('11: the ledger is cleared', !(await prof()).xpLedger?.reconciled);
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
const floorCard = await page.textContent('.xpr-card');
check('12: the preview warns the floor will hold it', /Held at your rank floor/i.test(floorCard), floorCard.replace(/\s+/g, ' ').slice(0, 200));
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
