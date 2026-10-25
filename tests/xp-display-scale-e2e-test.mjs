/**
 * Every XP figure on one ladder — in the real app.
 *
 * The reported defect: on a legacy (era-1) LOCK IN attempt a task row said
 * "25 XP" and ticking it raised Lifetime XP by 250. Forge computes in each
 * attempt's own stored units and converts only on the way into the lifetime
 * total, so the balance was right and every per-task, per-day and per-challenge
 * figure was quoted in the wrong currency.
 *
 * This suite drives the actual UI with a real era-1 attempt alongside an era-2
 * archive, and asserts the one property that matters:
 *
 *     the figure a row advertises == the figure the balance moves by
 *
 * It then repeats the whole thing on an era-2 attempt, where the scale is 1, to
 * prove the conversion is a no-op there — a fix that inflated the rebalanced
 * economy would be a worse bug than the one it replaced.
 *
 * Checked throughout: nothing stored is rewritten, ticking pays once, unticking
 * reverses exactly, a reload and a profile switch change nothing, and no view
 * ever shows two scales at once.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { RANKS, DISPLAY_SCALE } from '../src/data/xpEconomy.js';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function eq(name, got, want) {
  check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
const offset = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const SCALE1 = DISPLAY_SCALE[1];

const browser = await chromium.launch();
// iPhone-sized, because that is where these cards are actually read.
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

/**
 * A profile seeded with no rank floor earns its first ranks on the spot, so the
 * ceremony opens over the screen. Dismissed rather than suppressed: the test
 * drives the same app the user does.
 */
async function dismissRankUp() {
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator('.rankup-overlay').count())) return;
    await page.locator('.rankup-skip').click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function tab(name) {
  await dismissRankUp();
  await page.evaluate((n) => {
    const t = [...document.querySelectorAll('.bottom-nav .nav-tab')].find(x => x.getAttribute('aria-label') === n);
    if (t) t.click();
  }, name);
  await page.waitForTimeout(400);
}

// ── Fixtures ────────────────────────────────────────────────────────────────
//
// ERA-1 stored values, exactly as a pre-rebalance LOCK IN attempt carries them.
const ERA1_TASKS = [
  { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, source: 'template', order: 0 },
  { id: 'li_attention', name: 'Attention training: 10+ minutes', icon: '🧘', xp: 25, keystone: 2, source: 'template', order: 1 },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 20, keystone: 0, source: 'template', order: 2 },
];
const ERA1_PERFECT_DAY = 50;          // era 1's flat perfect-day bonus
const ERA1_ARCHIVE_XP = 4000;         // stored; reads as 40,000

// A rank whose permanent floor sits BELOW the seeded balance, derived from the
// ladder rather than named — a floor above it would clamp the total upward and
// hide every movement this suite measures.
const SEEDED_RANK = [...RANKS].reverse().find(r => r.minXP > 0 && r.minXP < ERA1_ARCHIVE_XP * SCALE1);

/**
 * Seed a profile with an era-1 LOCK IN attempt plus one archive. `archiveEra`
 * picks whether that archive is a legacy record or a stamped era-2 one, so the
 * suite can show the two rendered side by side.
 */
async function seedEra1({ archiveEra = 1, otherProfile = false, highestRank = SEEDED_RANK.rank } = {}) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
  await page.evaluate(({ start, tasks, archXP, archiveEra, highestRank, otherProfile }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = highestRank;
    p.me.challengeStart = start;
    p.me.xpPenalties = false;
    // No xpEconomyVersion: an attempt that predates versioning IS era 1.
    p.me.activeChallenge = {
      templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
      durationDays: 14, passingScore: 70, keystoneRequirement: 65, completionBonusXP: 700,
    };
    p.me.tasks = tasks;
    if (otherProfile) {
      // A second profile on the CURRENT era, to prove the conversion is
      // per-profile and per-attempt rather than global.
      p.girlfriend.highestRank = 3;
      p.girlfriend.challengeStart = start;
      p.girlfriend.xpPenalties = false;
      p.girlfriend.activeChallenge = {
        templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
        durationDays: 14, xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180,
      };
      p.girlfriend.tasks = [
        { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 90, keystone: 3, source: 'template', order: 0 },
        { id: 'li_attention', name: 'Attention training: 10+ minutes', icon: '🧘', xp: 60, keystone: 2, source: 'template', order: 1 },
        { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 30, keystone: 0, source: 'template', order: 2 },
      ];
    }
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
    localStorage.setItem('archives', JSON.stringify({
      me: [{
        id: 'arch_old', archivedAt: start, challengeStart: start, endDate: start, endDayNum: 30,
        challenge: {
          templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30,
          ...(archiveEra === 2 ? { xpEconomyVersion: 2 } : {}),
        },
        days: {}, tasks: [], xpEarned: archXP, completed: true,
      }],
      girlfriend: [],
    }));
  }, {
    start: offset(-2), tasks: ERA1_TASKS, archXP: ERA1_ARCHIVE_XP,
    archiveEra, highestRank, otherProfile,
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
}

// ── Readers ─────────────────────────────────────────────────────────────────

const num = (s) => (s == null ? null : parseInt(String(s).replace(/[^\d-]/g, ''), 10));

const todayRows = () => page.evaluate(() => [...document.querySelectorAll('.check-item')].map(e => ({
  name: e.querySelector('.f4-task-title')?.textContent?.trim(),
  xp: e.querySelector('.check-xp')?.textContent?.trim(),
  checked: e.getAttribute('aria-checked') === 'true',
})));
const headerXP = () => page.evaluate(() => ({
  earned: document.querySelector('.f4-xp-pill.earned .f4-xp-val')?.textContent?.trim() || null,
  left: document.querySelector('.f4-xp-pill.remaining .f4-xp-val')?.textContent?.trim() || null,
}));
const logBadge = () => page.evaluate(() =>
  document.querySelector('.daily-log-card .f4-badge')?.textContent?.trim() || null);
const homeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return {
    challenge: parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10),
    lifetime: parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10),
  };
});
const storedTaskXP = () => page.evaluate(() =>
  Object.fromEntries(JSON.parse(localStorage.getItem('profiles')).me.tasks.map(t => [t.id, t.xp])));
const storedArchiveXP = () => page.evaluate(() =>
  JSON.parse(localStorage.getItem('archives')).me[0].xpEarned);
const storedDayTasks = () => page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('allDays')).me;
  const rec = Object.values(d)[0] || {};
  return Object.entries(rec.tasks || {}).filter(([, v]) => v).map(([k]) => k).sort();
});

/** Tick (or untick) a task row by the text in its title. */
async function toggleRow(title) {
  await page.locator('.check-item', { has: page.locator('.f4-task-title', { hasText: title }) })
    .locator('.check-box').click();
  await page.waitForTimeout(600);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. The reported defect, on the screen it was reported on
// ════════════════════════════════════════════════════════════════════════════

await page.goto(BASE);
await seedEra1();
await tab('Today');

const rows0 = await todayRows();
const attention = rows0.find(r => /Attention training/.test(r.name || ''));
const sleep = rows0.find(r => /Sleep opportunity/.test(r.name || ''));
const log = rows0.find(r => /Daily Log/.test(r.name || ''));

eq('the legacy task reported as "25 XP" now reads 250 XP', attention?.xp, '250 XP');
eq('its legacy keystone reads 400 XP', sleep?.xp, '400 XP');
eq('the legacy Daily Log row reads 200 XP', log?.xp, '200 XP');
eq('the Daily Log card agrees with its task row', await logBadge(), '200 XP');

const before = await headerXP();
eq('nothing is earned before anything is ticked', num(before.earned), 0);
const dayTotal = ERA1_TASKS.reduce((s, t) => s + t.xp, 0) + ERA1_PERFECT_DAY;
eq('the whole day is offered on the lifetime ladder', num(before.left), dayTotal * SCALE1);

await tab('Home');
const home0 = await homeXP();
eq('the legacy archive reads 40,000 in Lifetime XP', home0.lifetime, ERA1_ARCHIVE_XP * SCALE1);
eq('the live legacy segment starts at 0 Challenge XP', home0.challenge, 0);

// Tick it — the exact action in the report.
await tab('Today');
await toggleRow('Attention training');

const afterHeader = await headerXP();
eq("Today's earned moves by the advertised 250", num(afterHeader.earned), 250);
eq('and what is left falls by the same 250', num(afterHeader.left), dayTotal * SCALE1 - 250);

await tab('Home');
const home1 = await homeXP();
eq('Challenge XP moves by the advertised 250', home1.challenge, 250);
eq('Lifetime XP moves by the advertised 250', home1.lifetime - home0.lifetime, 250);
check('the row, the day, the challenge and the balance all moved by one figure',
  num(afterHeader.earned) === home1.challenge
  && home1.lifetime - home0.lifetime === num(afterHeader.earned),
  `today ${afterHeader.earned}, challenge ${home1.challenge}, lifetime +${home1.lifetime - home0.lifetime}`);

// Paid once, not twice: 250, never 2,500 or 25.
check('XP is paid once — not the stored figure, and not ten times the display one',
  home1.challenge !== 25 && home1.challenge !== 2500, `challenge ${home1.challenge}`);

// ── Storage is untouched ────────────────────────────────────────────────────
const stored = await storedTaskXP();
eq('the stored task keeps its original 25', stored.li_attention, 25);
eq('the stored keystone keeps its original 40', stored.li_sleep, 40);
eq('the stored archive keeps its original 4,000', await storedArchiveXP(), ERA1_ARCHIVE_XP);
check('the completion itself was recorded', (await storedDayTasks()).includes('li_attention'));
const era = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('profiles')).me.activeChallenge.xpEconomyVersion ?? null);
eq('the attempt stays era 1 — it is never promoted to the new economy', era, 1);

// ════════════════════════════════════════════════════════════════════════════
// 2. Unticking reverses exactly; a reload changes nothing
// ════════════════════════════════════════════════════════════════════════════

await tab('Today');
await toggleRow('Attention training');
const undone = await headerXP();
eq('unticking returns the day to 0 earned', num(undone.earned), 0);
await tab('Home');
eq('and returns Lifetime XP to exactly where it was', (await homeXP()).lifetime, home0.lifetime);

await tab('Today');
await toggleRow('Sleep opportunity');
await toggleRow('Attention training');
// The Daily Log row deliberately does not toggle — it scrolls to the card, and
// saving one metric is what completes it. That single action is the only way
// its XP is ever earned, so it is the only way to complete the day here.
await page.locator('.daily-log-card .rating-track').first().fill('7');
await page.waitForTimeout(700);
const full = await headerXP();
eq('a full day earns every row plus the perfect-day bonus', num(full.earned), dayTotal * SCALE1);
check('nothing is left when the day is complete', full.left === null || num(full.left) === 0);

await tab('Home');
const homeFull = await homeXP();
eq('Challenge XP equals the day the rows advertised', homeFull.challenge, dayTotal * SCALE1);

await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
const homeReload = await homeXP();
eq('a reload shows the same Challenge XP', homeReload.challenge, homeFull.challenge);
eq('a reload shows the same Lifetime XP', homeReload.lifetime, homeFull.lifetime);
await tab('Today');
const rowsReload = await todayRows();
eq('and the same per-task figures', rowsReload.find(r => /Attention/.test(r.name || ''))?.xp, '250 XP');

// ════════════════════════════════════════════════════════════════════════════
// 3. No view shows two scales at once
// ════════════════════════════════════════════════════════════════════════════

// The XP breakdown behind the header's XP pills must add up to the pills.
await tab('Today');
await page.locator('.f4-xp-stack').click();
await page.waitForTimeout(350);
const noteText = await page.evaluate(() => document.querySelector('.f4-xp-note')?.textContent?.trim() || '');
check('the header breakdown quotes the same total as the pill',
  noteText.includes((dayTotal * SCALE1).toLocaleString()), noteText.slice(0, 120));

// XP History: every row above the reconciliation, on one ladder.
await tab('Home');
// XP History sits inside the Rank Details disclosure.
await page.locator('.xp-details-btn', { hasText: 'Details' }).click();
await page.waitForTimeout(400);
const history = await page.evaluate(() => {
  const toggle = document.querySelector('.xph-toggle');
  if (!toggle) return null;
  toggle.click();
  return new Promise(r => setTimeout(() => {
    const rows = [...document.querySelectorAll('.xph-period')].map(p => ({
      name: p.querySelector('.xph-period-name')?.textContent?.trim(),
      banked: parseInt((p.querySelector('.xph-period-row.net span:last-child')?.textContent || '')
        .replace(/[^\d]/g, '') || '0', 10),
    }));
    const totalRow = [...document.querySelectorAll('.xph-total-row')]
      .find(x => /Current XP/.test(x.textContent || ''));
    const earnedRow = [...document.querySelectorAll('.xph-total-row')]
      .find(x => /Total XP earned/.test(x.textContent || ''));
    r({
      rows,
      current: parseInt((totalRow?.textContent || '').replace(/[^\d]/g, '') || '0', 10),
      earned: parseInt((earnedRow?.textContent || '').replace(/[^\d]/g, '') || '0', 10),
    });
  }, 400));
});
check('XP History opens', !!history && history.rows.length >= 2, JSON.stringify(history));
const archRow = history.rows.find(r => /Fat Loss/.test(r.name || ''));
const liveRow = history.rows.find(r => /LOCK IN/.test(r.name || ''));
eq('the legacy archive row reads 40,000, not 4,000', archRow?.banked, ERA1_ARCHIVE_XP * SCALE1);
eq('the live legacy row reads what Today earned', liveRow?.banked, dayTotal * SCALE1);
eq('the rows sum to the Total XP earned beneath them',
  (archRow?.banked || 0) + (liveRow?.banked || 0), history.earned);
eq('and that reconciles with Current XP', history.current, homeReload.lifetime);

// Settings: Challenge XP sits one row above Lifetime XP.
await tab('Settings');
const settingsXP = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.settings-row')];
  const read = (label) => {
    const r = rows.find(x => (x.querySelector('.settings-row-label')?.textContent || '').trim() === label);
    return r ? parseInt((r.querySelector('.settings-row-value')?.textContent || '').replace(/[^\d]/g, '') || '0', 10) : null;
  };
  return { challenge: read('Challenge XP'), lifetime: read('Lifetime XP'), floor: read('Permanent floor') };
});
eq('Settings quotes the same Challenge XP as Home', settingsXP.challenge, homeReload.challenge);
eq('Settings quotes the same Lifetime XP as Home', settingsXP.lifetime, homeReload.lifetime);
eq('the permanent floor is untouched by the conversion', settingsXP.floor, SEEDED_RANK.minXP);

// The archive list on the same screen.
const archiveShown = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.archive-row-header')][0];
  if (!btn) return null;
  const meta = btn.querySelector('.archive-row-meta')?.textContent || '';
  return parseInt((meta.match(/([\d,]+)\s*XP/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
eq('the archive list shows 40,000 for a 4,000 XP legacy record', archiveShown, ERA1_ARCHIVE_XP * SCALE1);

// ════════════════════════════════════════════════════════════════════════════
// 4. Both eras in one profile's history, each on its own stamp
// ════════════════════════════════════════════════════════════════════════════

// No rank floor here: a floor above the seeded total would clamp it upward and
// hide the very figure under test.
await seedEra1({ archiveEra: 2, highestRank: 0 });
await tab('Home');
const mixed = await homeXP();
eq('an era-2 archive of 4,000 reads 4,000', mixed.lifetime, ERA1_ARCHIVE_XP);
await tab('Today');
eq('while the era-1 attempt beside it still reads 250',
  (await todayRows()).find(r => /Attention/.test(r.name || ''))?.xp, '250 XP');
await toggleRow('Attention training');
await tab('Home');
eq('and ticking it moves the balance by 250, over the unscaled archive',
  (await homeXP()).lifetime - mixed.lifetime, 250);

// ════════════════════════════════════════════════════════════════════════════
// 5. Era 2: the conversion must be a no-op
// ════════════════════════════════════════════════════════════════════════════

await seedEra1({ otherProfile: true, highestRank: 0 });
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')]
    .find(x => /girlfriend|switch/i.test(x.getAttribute('aria-label') || ''));
  if (el) el.click();
});
// Profile switching is in Settings on this build; set it directly and reload,
// which is the same state the switcher produces.
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
await tab('Today');
const e2rows = await todayRows();
eq('an era-2 keystone shows its stored 90 XP unchanged',
  e2rows.find(r => /Sleep opportunity/.test(r.name || ''))?.xp, '90 XP');
eq('an era-2 task shows its stored 60 XP unchanged',
  e2rows.find(r => /Attention/.test(r.name || ''))?.xp, '60 XP');
const e2before = await headerXP();
await toggleRow('Attention training');
const e2after = await headerXP();
eq('ticking an era-2 task earns exactly its stored value', num(e2after.earned), 60);
eq('and what is left falls by 60', num(e2before.left) - num(e2after.left), 60);
await tab('Home');
const e2home = await homeXP();
eq('era-2 Challenge XP is not inflated', e2home.challenge, 60);

// Back to the legacy profile: the two coexist without leaking.
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
await tab('Today');
eq('switching back shows the legacy profile its own 250 XP figure',
  (await todayRows()).find(r => /Attention/.test(r.name || ''))?.xp, '250 XP');
await tab('Home');
eq("the other profile's XP did not follow it", (await homeXP()).challenge, 0);
eq('and its own legacy archive still reads 40,000', (await homeXP()).lifetime, ERA1_ARCHIVE_XP * SCALE1);

// ════════════════════════════════════════════════════════════════════════════
// 6. Penalties and the comeback notice
// ════════════════════════════════════════════════════════════════════════════

await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
await page.evaluate(({ start, tasks, active }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 0;                // no floor, so a charge is visible
  p.me.challengeStart = start;
  p.me.xpPenalties = true;             // penalties ON, so a gap costs XP
  p.me.activeChallenge = {
    templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard', durationDays: 14,
  };
  p.me.tasks = tasks;
  localStorage.setItem('profiles', JSON.stringify(p));
  // Day 1 logged, days 2-4 untouched, back today on day 5.
  localStorage.setItem('allDays', JSON.stringify({
    me: {
      1: { date: start, tasks: { li_sleep: true, li_attention: true, daily_log: true } },
      5: { date: active, tasks: { li_sleep: true } },
    },
    girlfriend: {},
  }));
  localStorage.setItem('archives', JSON.stringify({
    me: [{
      id: 'arch_old', archivedAt: start, challengeStart: start, endDate: start, endDayNum: 30,
      challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30 },
      days: {}, tasks: [], xpEarned: 6000, completed: true,
    }],
    girlfriend: [],
  }));
}, { start: offset(-4), tasks: ERA1_TASKS, active: offset(0) });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
await tab('Home');

const penalty = await page.evaluate(() => {
  const wb = document.querySelector('.wb-figure-value.loss')?.textContent?.trim() || null;
  return wb ? parseInt(wb.replace(/[^\d]/g, ''), 10) : null;
});
// Three untouched past days at era 1's flat 25 = 75 stored, 750 displayed.
eq('the comeback notice quotes the missed days on the lifetime ladder', penalty, 750);

// The figure the notice quotes has to be the figure the balance was charged —
// which the reconciliation under XP History states outright. Both it and the
// missed-days card live inside the Rank Details disclosure.
await page.locator('.xp-details-btn', { hasText: 'Details' }).click();
await page.waitForTimeout(400);
await page.locator('.cmd-toggle').click();
await page.waitForTimeout(300);
const missedCard = await page.evaluate(() => {
  const el = document.querySelector('.cmd-amount');
  const rows = [...document.querySelectorAll('.cmd-row-amount')]
    .map(e => parseInt(e.textContent.replace(/[^\d]/g, ''), 10));
  return { total: el ? parseInt(el.textContent.replace(/[^\d]/g, ''), 10) : null, rows };
});
eq('the missed-days card quotes the same total as the notice', missedCard.total, penalty);
eq('and each missed day inside it is on the lifetime ladder too',
  missedCard.rows.join(','), [250, 250, 250].join(','));

const recon = await page.evaluate(() => {
  const toggle = document.querySelector('.xph-toggle');
  if (!toggle) return null;
  toggle.click();
  return new Promise(r => setTimeout(() => {
    const row = (re) => {
      const el = [...document.querySelectorAll('.xph-total-row')].find(x => re.test(x.textContent || ''));
      return el ? parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10) : null;
    };
    r({ earned: row(/Total XP earned/), penalties: row(/Missed-day penalties/), current: row(/Current XP/) });
  }, 400));
});
eq('the reconciliation deducts exactly the penalty the notice quoted', recon?.penalties, penalty);
eq('and earned minus that penalty is the balance', recon.earned - recon.penalties, recon.current);
const penalised = await homeXP();
eq('which is the Lifetime XP shown on Home', penalised.lifetime, recon.current);
check('so the charge is real, not cosmetic',
  penalised.lifetime < recon.earned, `lifetime ${penalised.lifetime} of ${recon.earned} earned`);

// ════════════════════════════════════════════════════════════════════════════
// 7. Challenge completion
// ════════════════════════════════════════════════════════════════════════════

await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
await page.evaluate(({ tasks }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 5;
  p.me.challengeStart = '2026-01-01';
  p.me.xpPenalties = false;
  p.me.activeChallenge = { templateId: 'forge_daily', name: 'Forge Daily', emoji: '🔥', durationDays: null };
  p.me.tasks = tasks;
  // A finished era-1 attempt's result screen, as the app stores it.
  p.me.lastCompletion = {
    name: 'LOCK IN', emoji: '🎯', variant: 'standard', templateId: 'lock_in_14_day',
    xpEconomyVersion: 1, durationDays: 14, challengeStart: '2026-01-01',
    completionDate: '2026-01-15', xpEarned: 1200, taskXP: 900, bonusXP: 30, completionBonus: 270,
    bonusEarned: true, finalScore: 92, scoreAvailable: true, passingScore: 70, passed: true,
    keystoneRequirement: 65, keystoneAdherence: 95, badges: [], daysLogged: 14, perfectDays: 10,
    avgCompletion: 92, keystonePct: 95, hasKeystones: true, reflections: {}, changes: [],
    weeklyRequirements: { tracked: false },
  };
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
}, { tasks: ERA1_TASKS });
await page.reload(); await page.waitForSelector('.challenge-complete-screen', { timeout: 15000 });

const cc = await page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('.cc-xpline')].map(e => [
    e.querySelector('span:first-child')?.textContent?.trim(),
    parseInt((e.querySelector('span:last-child')?.textContent || '').replace(/[^\d]/g, '') || '0', 10),
  ])));
eq('the result screen quotes task XP on the lifetime ladder', cc['Task XP Earned'], 9000);
eq('its passing bonus too', cc['Passing Bonus'], 2700);
eq('its bonus mission XP too', cc['Bonus Mission XP'], 300);
eq('and the total it added to Lifetime XP', cc['Total Earned'], 12000);
check('the parts still add up to the total',
  cc['Task XP Earned'] + cc['Passing Bonus'] + cc['Bonus Mission XP'] === cc['Total Earned'],
  JSON.stringify(cc));

// ── Summary ────────────────────────────────────────────────────────────────

check('no page errors during the run', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}${f.extra ? ' — ' + f.extra : ''}`);
  process.exit(1);
}
