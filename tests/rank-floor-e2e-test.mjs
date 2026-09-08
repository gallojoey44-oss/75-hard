/**
 * Permanent rank floor end-to-end: the floor enforced by the state layer, every
 * screen deriving from it, persistence across reload / restart / backup, and
 * profile isolation.
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

// The frozen ladder (mirrored here so the test asserts against real numbers).
const ELITE = 5000, TRUE_W = 7500, UNBREAKABLE = 10000;

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
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const lifetimeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
const rankName = () => page.evaluate(() => document.querySelector('.xp-rank-badge')?.textContent?.trim() || '');
const nextLabel = () => page.evaluate(() => document.querySelector('.xp-next-label')?.textContent?.trim() || '');
const barPct = () => page.evaluate(() => {
  const w = document.querySelector('.xp-bar-fill')?.style?.width || '0%';
  return Math.round(parseFloat(w));
});

/**
 * Seed a profile whose ARCHIVED XP totals `archivedXP`, optionally with a
 * persisted highestRank. Archived XP is the cleanest lever: it is real Lifetime
 * XP, and adjusting it is exactly what a challenge recalculation or a historical
 * edit does.
 */
async function seed({ archivedXP, highestRank = null, rankHistory = null, profile = 'me', activeProfile = 'me', other = null } = {}) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  await page.evaluate(({ archivedXP, highestRank, rankHistory, profile, activeProfile, other, start }) => {
    const mk = (xp) => ([{
      id: `arch_${xp}`, archivedAt: '2026-01-31', challengeStart: '2026-01-01', endDate: '2026-01-30',
      endDayNum: 30, completed: true, challenge: { templateId: 'mental_training_phase', name: 'Mental Training Phase', durationDays: 30 },
      days: { 1: { dayNumber: 1, tasks: { mt_mind: true } } }, tasks: [{ id: 'mt_mind', xp: 100, keystone: 3 }],
      xpEarned: xp, badges: [], finalScore: 84, scoreAvailable: true, passingScore: 70, passed: true,
    }]);
    const p = JSON.parse(localStorage.getItem('profiles'));
    for (const id of ['me', 'girlfriend']) {
      p[id].challengeStart = start;
      p[id].xpPenalties = false;
      p[id].activeChallenge = { templateId: 'forge_daily', name: 'Forge Daily', emoji: '🔥', durationDays: null };
      p[id].tasks = [{ id: 'fd_mind', name: 'Mental Training', xp: 12, keystone: 1, source: 'template', order: 0 }];
      if (highestRank != null) delete p[id].highestRank;
    }
    if (highestRank != null) p[profile].highestRank = highestRank;
    if (rankHistory) p[profile].rankHistory = rankHistory;
    localStorage.setItem('profiles', JSON.stringify(p));
    const arch = { me: [], girlfriend: [] };
    arch[profile] = mk(archivedXP);
    if (other) { arch[other.profile] = mk(other.archivedXP); }
    localStorage.setItem('archives', JSON.stringify(arch));
    localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
    localStorage.setItem('activeProfile', JSON.stringify(activeProfile));
  }, { archivedXP, highestRank, rankHistory, profile, activeProfile, other, start: offset(-3) });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
}

/** Change archived XP in place — the effect a recalculation or edit has. */
async function setArchivedXP(xp, profile = 'me') {
  await page.evaluate(({ xp, profile }) => {
    const a = JSON.parse(localStorage.getItem('archives'));
    a[profile][0].xpEarned = xp;
    localStorage.setItem('archives', JSON.stringify(a));
  }, { xp, profile });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });

// ══ 1: below a new tier, XP moves normally in both directions ═══════════════
await seed({ archivedXP: 4000 });
check('1: a profile below Elite Warrior shows its real XP', (await lifetimeXP()) === 4000, `${await lifetimeXP()}`);
check('1: and the tier that XP sits in', (await rankName()) === 'Warrior', await rankName());
await setArchivedXP(4500);
check('1: gaining XP below the next tier is reflected', (await lifetimeXP()) === 4500);
await setArchivedXP(3200);
check('1: losing XP below the next tier is reflected in full', (await lifetimeXP()) === 3200);
check('1: no floor notice is shown while above the floor',
  (await page.locator('.xp-floor-row').count()) === 0);

// ══ 2: reaching a tier permanently unlocks and persists it ══════════════════
await setArchivedXP(ELITE);
check('2: reaching 5,000 promotes to Elite Warrior', (await rankName()) === 'Elite Warrior');
let p = await prof();
check('2: the unlock is PERSISTED by the state layer, not by the Home screen',
  p.highestRank === 6, `highestRank=${p.highestRank}`);
check('2: it is recorded in rank history too', (p.rankHistory || []).some(h => h.rank === 6));

// ══ 3/4/5: decline stops exactly at the tier threshold ══════════════════════
// Stay INSIDE the Elite Warrior tier (5,000–7,499) — climbing to 7,500 would
// legitimately promote to True Warrior and raise the floor, which is tested
// separately below.
await setArchivedXP(7000);
check('3: XP can climb within the tier', (await lifetimeXP()) === 7000);
await setArchivedXP(6000);
check('3: XP can decline after unlocking a tier', (await lifetimeXP()) === 6000);
await setArchivedXP(ELITE);
check('4: XP can decline all the way to the tier minimum', (await lifetimeXP()) === ELITE);
await setArchivedXP(ELITE - 1);
check('5: XP cannot decline one point below the threshold',
  (await lifetimeXP()) === ELITE, `${await lifetimeXP()}`);
check('5: the rank is not demoted', (await rankName()) === 'Elite Warrior');
await setArchivedXP(0);
check('5: even zero calculated XP holds at the floor', (await lifetimeXP()) === ELITE);
check('5: still Elite Warrior at zero raw XP', (await rankName()) === 'Elite Warrior');
check('5: the floor is explained to the user', (await page.locator('.xp-floor-row').count()) === 1);
check('5: the notice names the floor value',
  /cannot fall below 5,000/.test(await page.textContent('.xp-floor-row')));

// ══ 19: no screen can show a rank beside XP below its threshold ═════════════
check('19: Home shows Elite Warrior with XP at or above 5,000',
  (await rankName()) === 'Elite Warrior' && (await lifetimeXP()) >= ELITE);
await gotoTab('Settings');
const settingsText = await page.textContent('.settings-view');
check('19: Settings shows the same rank', /Rank \(Lifetime\)[\s\S]{0,80}Elite Warrior/.test(settingsText));
check('19: Settings shows the same effective Lifetime XP, not the raw total',
  /Lifetime XP[\s\S]{0,40}5,000 XP/.test(settingsText), settingsText.match(/Lifetime XP[\s\S]{0,40}/)?.[0]);
check('19: Settings surfaces the permanent floor', /Permanent floor[\s\S]{0,60}5,000 XP · Elite Warrior/.test(settingsText));
await gotoTab('Home');
// Ladder + details panels.
await page.locator('.xp-details-btn', { hasText: 'Ladder' }).click();
await page.waitForTimeout(300);
const ladderText = await page.textContent('.rank-ladder-card');
check('19: the Ladder shows the same rank and XP',
  /Elite Warrior/.test(ladderText) && /5,000/.test(ladderText));
check('19: an already-unlocked tier never renders as locked on the ladder', await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.rank-ladder-row, .rank-ladder-item, [class*="rank-ladder"]')];
  const elite = rows.find(r => /Elite Warrior/.test(r.textContent));
  return !elite || !/locked/.test(elite.className);
}));
await page.locator('.xp-details-btn', { hasText: 'Ladder' }).click();
await page.waitForTimeout(200);
await page.locator('.xp-details-btn', { hasText: 'Details' }).click();
await page.waitForTimeout(300);
const detailsText = await page.textContent('.dashboard');
check('19: the Details panel agrees', /Elite Warrior/.test(detailsText) && /5,000/.test(detailsText));
await page.locator('.xp-details-btn').last().click();
await page.waitForTimeout(200);

// ══ 16/17/18: progress and next-rank copy ═══════════════════════════════════
check('16: the progress bar reads 0% at the tier floor', (await barPct()) === 0, `${await barPct()}%`);
check('16: at the floor the copy says start-of-tier, not a pending re-unlock',
  /start of Elite Warrior/.test(await nextLabel()) && !/XP to Elite Warrior/.test(await nextLabel()),
  await nextLabel());
check('18: "XP to next" uses the real NEXT tier',
  /2,500 XP to True Warrior/.test(await nextLabel()), await nextLabel());
await setArchivedXP(6250);
check('17: the midpoint of the tier reads 50%', (await barPct()) === 50, `${await barPct()}%`);
check('18: remaining XP tracks the next threshold',
  /1,250 XP to True Warrior/.test(await nextLabel()), await nextLabel());
await setArchivedXP(TRUE_W - 10);
check('18: at 7,490 the copy reads 10 XP to True Warrior',
  /^10 XP to True Warrior/.test(await nextLabel()), await nextLabel());
check('18: and the rank is still Elite Warrior — this is internally consistent',
  (await rankName()) === 'Elite Warrior' && (await lifetimeXP()) === 7490);
check('17: progress is full just below the next tier', (await barPct()) === 100);

// ══ 14: reaching the next tier raises the floor permanently ═════════════════
await setArchivedXP(TRUE_W);
check('14: reaching 7,500 promotes to True Warrior', (await rankName()) === 'True Warrior');
p = await prof();
check('14: the higher rank is persisted', p.highestRank === 7);
await setArchivedXP(TRUE_W - 1);
check('14: the floor has risen — 7,499 is held at 7,500', (await lifetimeXP()) === TRUE_W);
check('14: the user can never return to Elite Warrior', (await rankName()) === 'True Warrior');
await setArchivedXP(0);
check('14: nothing can push below the new floor', (await lifetimeXP()) === TRUE_W);

// ══ 6/7/8: monotonic, and durable across reload and restart ═════════════════
p = await prof();
check('6: highestRank never decreased despite XP collapsing to 0', p.highestRank === 7);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
check('7: reload preserves the tier floor',
  (await rankName()) === 'True Warrior' && (await lifetimeXP()) === TRUE_W);
check('7: and the persisted rank', (await prof()).highestRank === 7);
const ctx2 = await browser.newContext({ storageState: await page.context().storageState() });
const page2 = await ctx2.newPage();
await page2.goto(BASE);
await page2.waitForSelector('.dashboard', { timeout: 8000 });
await page2.waitForTimeout(500);
check('8: an app restart (fresh context) preserves it', await page2.evaluate(() => {
  const badge = document.querySelector('.xp-rank-badge')?.textContent?.trim();
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  const xp = parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
  return badge === 'True Warrior' && xp === 7500;
}));
await ctx2.close();

// ══ 9: backup / restore ═════════════════════════════════════════════════════
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
const backup = await page.evaluate((keys) => {
  const o = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) o[k] = JSON.parse(v); } return o;
}, LS_KEYS);
await page.evaluate(() => { localStorage.clear(); });
await page.reload(); await page.waitForSelector('.profile-selector, .dashboard', { timeout: 5000 });
await page.evaluate((b) => { for (const [k, v] of Object.entries(b)) localStorage.setItem(k, JSON.stringify(v)); }, backup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
check('9: backup/restore preserves the rank and its floor',
  (await rankName()) === 'True Warrior' && (await lifetimeXP()) === TRUE_W && (await prof()).highestRank === 7);

// ══ 15: MIGRATION — a profile whose XP already sits below its earned tier ═══
// The reported case, reproduced exactly: rank evidence says Elite Warrior, but
// the stored XP total is below the Elite Warrior threshold.
await seed({ archivedXP: ELITE - 100, highestRank: 6 });
check('15: a profile at 4,900 XP with Elite Warrior earned is NOT demoted',
  (await rankName()) === 'Elite Warrior', await rankName());
check('15: its Lifetime XP is normalized UP to the tier floor',
  (await lifetimeXP()) === ELITE, `${await lifetimeXP()}`);
check('15: and the permanent rank is preserved, not rewritten downward',
  (await prof()).highestRank === 6);

// Evidence from rank history alone, with no persisted highestRank.
await seed({ archivedXP: 2000, rankHistory: [{ rank: 5, name: 'Warrior' }, { rank: 6, name: 'Elite Warrior' }] });
check('15: rank history alone rescues the earned tier', (await rankName()) === 'Elite Warrior');
check('15: XP is normalized to that tier\'s floor', (await lifetimeXP()) === ELITE);
check('15: and the permanent rank is now persisted so it cannot happen again',
  (await prof()).highestRank === 6);
check('15: the baseline is silent — no retroactive ceremony',
  (await page.locator('.rankup-overlay').count()) === 0 && !(await prof()).pendingRankUp);

// A rank the user never earned is never fabricated.
await seed({ archivedXP: 300 });
check('15: a genuinely low-XP profile is not inflated',
  (await rankName()) === 'Apprentice' && (await lifetimeXP()) === 300, `${await rankName()} ${await lifetimeXP()}`);

// ══ 10/11/21: challenges and archives ═══════════════════════════════════════
await seed({ archivedXP: ELITE + 500, highestRank: 6 });
const beforeArchives = await page.evaluate(() => localStorage.getItem('archives'));
await gotoTab('Challenges');
await page.waitForTimeout(300);
// Start a challenge through the normal flow (Forge Daily → Mental Training).
await page.evaluate(() => {
  const c = [...document.querySelectorAll('.challenge-card')].find(x => /Mental Training Phase/.test(x.textContent));
  c.querySelector('.challenge-card-header').click();
});
await page.waitForTimeout(300);
await page.locator('.challenge-card', { hasText: 'Mental Training Phase' }).locator('button', { hasText: 'Start Mental Training Phase' }).click();
await page.waitForTimeout(500);
const tas = page.locator('textarea');
for (let i = 0, n = await tas.count(); i < n; i++) await tas.nth(i).fill('Because I want to keep going.');
await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
await page.waitForSelector('.start-when-options', { timeout: 5000 });
await page.locator('.start-when-btn', { hasText: 'Start Today' }).click();
await page.waitForSelector('.daily-view', { timeout: 5000 });
await gotoTab('Home');
p = await prof();
check('10: starting a challenge does not reset the permanent rank', p.highestRank === 6);
check('10: nor the floor — Lifetime XP is still at least 5,000', (await lifetimeXP()) >= ELITE);
check('10: nor the rank shown', (await rankName()) === 'Elite Warrior');
check('21: existing archive data is not rewritten by any of this',
  (await page.evaluate(() => localStorage.getItem('archives'))) === beforeArchives);

// 11: a Challenge XP reset zeroes the challenge, never the Lifetime floor.
await gotoTab('Today');
await page.locator('.check-item').first().click();
await page.waitForTimeout(400);
await gotoTab('Settings');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Reset Challenge XP/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.modal-card button')].find(x => /Reset/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(500);
await gotoTab('Home');
check('11: a Challenge XP reset leaves the Lifetime rank floor intact',
  (await lifetimeXP()) >= ELITE && (await rankName()) === 'Elite Warrior', `${await lifetimeXP()}`);
check('11: and the permanent rank', (await prof()).highestRank === 6);

// ══ 12/13: XP reversals and historical edits respect the floor ══════════════
// Start high INSIDE the Elite Warrior tier — 7,500+ would legitimately promote.
await seed({ archivedXP: 7400, highestRank: 6 });
const walk = [];
for (const xp of [7000, 6500, 5700, 5300, 5000, 4000, 0]) {
  await setArchivedXP(xp);
  walk.push(await lifetimeXP());
}
check('12: reversals above the floor take effect in full',
  walk.slice(0, 4).join() === '7000,6500,5700,5300', walk.join());
check('12: the reversal that reaches the floor lands exactly on it', walk[4] === ELITE);
check('12: reversals that would cross the floor are clamped, not rejected', walk[5] === ELITE && walk[6] === ELITE);
check('13: a historical edit wiping all archived XP still holds the floor',
  (await lifetimeXP()) === ELITE && (await rankName()) === 'Elite Warrior');
check('13: the underlying archive value really did change (the reversal was not blocked)',
  (await page.evaluate(() => JSON.parse(localStorage.getItem('archives')).me[0].xpEarned)) === 0);

// ══ 20: profiles are fully independent ══════════════════════════════════════
await seed({ archivedXP: 9000, highestRank: 7, profile: 'me', other: { profile: 'girlfriend', archivedXP: 300 } });
await page.evaluate(() => {
  const pr = JSON.parse(localStorage.getItem('profiles'));
  delete pr.girlfriend.highestRank;
  pr.girlfriend.rankHistory = [];
  localStorage.setItem('profiles', JSON.stringify(pr));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
check('20: the Male profile holds True Warrior', (await rankName()) === 'True Warrior');
const both = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')));
check('20: each profile has its own permanent rank',
  both.me.highestRank === 7 && both.girlfriend.highestRank === 2,
  `me=${both.me.highestRank} gf=${both.girlfriend.highestRank}`);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
check('20: the Female profile is unaffected by the other profile\'s rank',
  (await rankName()) === 'Apprentice' && (await lifetimeXP()) === 300,
  `${await rankName()} ${await lifetimeXP()}`);
// Collapsing one profile's XP must not touch the other's floor.
await setArchivedXP(0, 'girlfriend');
check('20: the Female profile keeps only its OWN floor',
  (await lifetimeXP()) === 250 && (await rankName()) === 'Apprentice', `${await lifetimeXP()}`);
check('20: the Male profile\'s permanent rank is untouched', (await prof('me')).highestRank === 7);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(500);
check('20: switching back, Male still holds True Warrior at its floor',
  (await rankName()) === 'True Warrior' && (await lifetimeXP()) >= TRUE_W);

check('no page errors across the whole flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
