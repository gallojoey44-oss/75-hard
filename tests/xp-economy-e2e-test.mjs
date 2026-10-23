/**
 * The XP economy v2 migration, end to end in the real app.
 *
 * The cases that could lose someone's progress, and therefore the ones worth
 * driving through the actual UI rather than a unit harness:
 *
 *   • a legacy profile loads, keeps its rank, and its displayed XP converts by
 *     exactly ten — no silent revaluation;
 *   • an era-1 attempt already in progress keeps era-1 rates to its end;
 *   • the open-ended baseline is migrated by archiving its era-1 segment, so
 *     the XP it earned is still there afterwards;
 *   • the two profiles migrate independently;
 *   • the opt-in reconciliation still works, and charges the converted amount.
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

async function openRankDetails() {
  await gotoTab('Home');
  await page.waitForTimeout(500);
  for (let i = 0; i < 3; i++) {
    if (await page.locator('.rank-details-card').count()) break;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Details/i.test(x.textContent));
      if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
    });
    await page.waitForTimeout(500);
  }
  if (!(await page.locator('.rank-details-card').count())) return '';
  return page.textContent('.rank-details-card');
}

/** Read a labelled figure out of the Rank Details card. */
async function rankFigure(label) {
  return page.evaluate((l) => {
    const flat = (document.querySelector('.rank-details-card')?.innerText || '').replace(/\s+/g, ' ');
    const m = flat.match(new RegExp(l + '\\s*(−?[\\d,]+)'));
    return m ? parseInt(m[1].replace(/[^\d]/g, ''), 10) : null;
  }, label);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: a legacy profile converts without being revalued ════════════════════
// A True Warrior with 8,245 era-1 XP banked in an archive and NO active
// challenge stamp — exactly what a profile written before versioning looks like.
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('activeProfile', JSON.stringify('me'));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 7;
  p.me.xpPenalties = true;
  // An era-1 archive: no xpEconomyVersion anywhere.
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'legacy_1', archivedAt: d(-40), challengeStart: d(-54), endDate: d(-41),
    challenge: { templateId: 'legacy', name: 'Discipline Block', durationDays: 14 },
    endDayNum: 14, xpStartDay: 1, xpOffset: 0,
    tasks: [{ id: 'h_a', name: 'A', xp: 40 }, { id: 'h_b', name: 'B', xp: 35 }],
    days: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, { tasks: { h_a: true, h_b: true } }])),
    xpEarned: 8245, weeklySessions: [], comebackHistory: [],
  }], girlfriend: [] }));
  // An era-2 attempt with nothing logged, so the migration has nothing to do
  // and the only thing on test is the conversion of the era-1 archive.
  p.me.challengeStart = d(0);
  p.me.activeChallenge = {
    templateId: 'lock_in_14_day', name: 'LOCK IN', variant: 'standard', durationDays: 14,
    xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180, completionBonusXP: 504,
  };
  p.me.tasks = [{ id: 'li_sleep', name: 'Sleep', xp: 90, keystone: 3, source: 'template', order: 0 },
                { id: 'li_flow', name: 'Flow', xp: 90, keystone: 3, source: 'template', order: 1 }];
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(600);

let details = await openRankDetails();
const currentXP = await rankFigure('Current XP');
check('1: a legacy era-1 balance converts by exactly ten',
  currentXP === 82450, String(currentXP));
check('1: the rank is unchanged', /True Warrior/.test(details));
check('1: the permanent rank is still stored', (await prof()).highestRank === 7);
check('1: the archive itself was NOT rewritten',
  (await arch())[0].xpEarned === 8245, String((await arch())[0].xpEarned));
const toNext = await rankFigure('XP Until Next Rank');
check('1: XP to the next rank is on the converted ladder',
  toNext === 17550, String(toNext));

// ══ 2: an era-1 attempt in progress keeps era-1 rates ══════════════════════
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = d(-5);
  // Finite, unstamped: a challenge that was already running at migration time.
  p.me.activeChallenge = {
    templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
    durationDays: 14, completionBonusXP: 700,
  };
  p.me.tasks = [
    { id: 'li_sleep', name: 'Sleep', icon: '😴', xp: 40, keystone: 3, source: 'template', order: 0 },
    { id: 'li_flow', name: 'Flow', icon: '🌊', xp: 35, keystone: 3, source: 'template', order: 1 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let i = 1; i <= 5; i++) days[i] = { tasks: { li_sleep: true, li_flow: true } };
  localStorage.setItem('allDays', JSON.stringify({ me: days, girlfriend: {} }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(600);
const live = await prof();
check('2: a finite attempt in progress is pinned to era 1',
  live.activeChallenge.xpEconomyVersion === 1, String(live.activeChallenge.xpEconomyVersion));
check('2: its task XP was not repriced',
  live.tasks.find(t => t.id === 'li_sleep').xp === 40,
  String(live.tasks.find(t => t.id === 'li_sleep').xp));
check('2: it was given no era-2 daily budget',
  live.activeChallenge.dailyBudget == null);
check('2: and its completion bonus is untouched',
  live.activeChallenge.completionBonusXP === 700);

// ══ 3: the open-ended baseline is migrated by archiving its segment ════════
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = d(-9);
  p.me.activeChallenge = {
    templateId: 'forge_daily', name: 'Forge Daily', emoji: '🔥',
    variant: null, durationDays: null, isBaseline: true,
  };
  p.me.tasks = [
    { id: 'fd_sleep', name: 'Hit sleep goal', xp: 8, keystone: 0, source: 'template', order: 0 },
    { id: 'fd_mind', name: 'Mental Training', xp: 12, keystone: 1, source: 'template', order: 1 },
    { id: 'daily_log', name: 'Complete Daily Log', xp: 20, keystone: 0, source: 'template', order: 2 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let i = 1; i <= 10; i++) days[i] = { tasks: { fd_sleep: true, fd_mind: true, daily_log: true } };
  localStorage.setItem('allDays', JSON.stringify({ me: days, girlfriend: {} }));
  localStorage.setItem('archives', JSON.stringify({ me: [], girlfriend: [] }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(1200);
const afterBaseline = await prof();
const baselineArchives = await arch();
check('3: the baseline is now era 2',
  afterBaseline.activeChallenge.xpEconomyVersion === 2,
  String(afterBaseline.activeChallenge.xpEconomyVersion));
check('3: it was given the easy tier and its budget',
  afterBaseline.activeChallenge.effortTier === 'easy' &&
  afterBaseline.activeChallenge.dailyBudget === 120,
  `${afterBaseline.activeChallenge.effortTier}/${afterBaseline.activeChallenge.dailyBudget}`);
check('3: its tasks were repriced onto that budget',
  afterBaseline.tasks.filter(t => t.source === 'template').reduce((s, t) => s + t.xp, 0) === 120,
  String(afterBaseline.tasks.filter(t => t.source === 'template').reduce((s, t) => s + t.xp, 0)));
check('3: the era-1 segment was archived rather than repriced',
  baselineArchives.length === 1 && baselineArchives[0].xpEarned > 0,
  `${baselineArchives.length} archive(s), ${baselineArchives[0]?.xpEarned} XP`);
check('3: the archived segment kept its era-1 figures',
  baselineArchives[0].challenge?.xpEconomyVersion == null ||
  baselineArchives[0].challenge?.xpEconomyVersion === 1);
check('3: the new segment starts today at day 1',
  afterBaseline.xpStartDay === 1 && afterBaseline.xpOffset === 0);
check('3: migration is recorded so it cannot run twice',
  !!afterBaseline.xpEconomyMigratedAt);

// The XP earned before migration must still be in the balance.
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(600);
details = await openRankDetails();
const xpAfterMigration = await rankFigure('Current XP');
check('3: the XP earned before migration survives it',
  xpAfterMigration > 0, String(xpAfterMigration));
const archivesAfterReload = await arch();
check('3: and reloading does not archive the segment a second time',
  archivesAfterReload.length === 1, `${archivesAfterReload.length} archive(s)`);

// ══ 4: a new era-2 attempt is stamped and priced ═══════════════════════════
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = d(0);
  p.me.activeChallenge = {
    templateId: 'lock_in_14_day', name: 'LOCK IN', variant: 'standard',
    durationDays: 14, xpEconomyVersion: 2, effortTier: 'medium_hard',
    dailyBudget: 180, completionBonusXP: 504,
  };
  p.me.tasks = [
    { id: 'li_sleep', name: 'Sleep', xp: 29, keystone: 3, source: 'template', order: 0 },
    { id: 'li_flow', name: 'Flow', xp: 29, keystone: 3, source: 'template', order: 1 },
    { id: 'li_exec', name: 'Execute', xp: 29, keystone: 3, source: 'template', order: 2 },
    { id: 'li_mission', name: 'Mission', xp: 19, keystone: 2, source: 'template', order: 3 },
    { id: 'li_energy', name: 'Energy', xp: 19, keystone: 2, source: 'template', order: 4 },
    { id: 'li_attn', name: 'Attention', xp: 19, keystone: 2, source: 'template', order: 5 },
    { id: 'li_rec', name: 'Recovery', xp: 13, keystone: 1, source: 'template', order: 6 },
    { id: 'li_stress', name: 'Stress', xp: 13, keystone: 1, source: 'template', order: 7 },
    { id: 'daily_log', name: 'Complete Daily Log', xp: 10, keystone: 0, source: 'template', order: 8 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = { 1: { tasks: Object.fromEntries(p.me.tasks.map(t => [t.id, true])) } };
  localStorage.setItem('allDays', JSON.stringify({ me: days, girlfriend: {} }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(700);
const era2 = await prof();
check('4: an era-2 attempt is left alone by the migration',
  era2.activeChallenge.xpEconomyVersion === 2 && era2.activeChallenge.dailyBudget === 180);
check('4: its task list still sums to the budget',
  era2.tasks.filter(t => t.source === 'template').reduce((s, t) => s + t.xp, 0) === 180);

// ══ 5: the per-challenge breakdown is reachable and adds up ════════════════
details = await openRankDetails();
await page.evaluate(() => document.querySelector('.xph-toggle')?.click());
await page.waitForTimeout(400);
const toggles = await page.locator('.xph-detail-toggle').count();
check('5: XP History offers a per-challenge breakdown', toggles > 0, `${toggles} period(s)`);
if (toggles > 0) {
  await page.locator('.xph-detail-toggle').first().click();
  await page.waitForTimeout(400);
  check('5: the breakdown opens', (await page.locator('.cxb').count()) > 0);
  const cxb = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.cxb .cxb-row')];
    const out = {};
    for (const r of rows) {
      const k = r.children[0].textContent.split('·')[0].trim();
      out[k] = parseInt((r.children[1].textContent || '').replace(/[^\d]/g, ''), 10) || 0;
    }
    return out;
  });
  check('5: it names the XP rules version it used',
    /XP rules v\d/.test(await page.textContent('.cxb')), JSON.stringify(cxb).slice(0, 110));
  check('5: earned minus deducted equals the period total',
    (cxb['Total earned'] || 0) - (cxb['Total deducted'] || 0) === (cxb['So far'] ?? cxb['Banked']),
    JSON.stringify(cxb));
}

// ══ 6: the two profiles migrate independently ══════════════════════════════
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.highestRank = 5;
  p.girlfriend.challengeStart = d(-4);
  p.girlfriend.activeChallenge = {
    templateId: 'forge_daily', name: 'Forge Daily', durationDays: null, isBaseline: true,
  };
  p.girlfriend.tasks = [
    { id: 'fd_sleep', name: 'Sleep', xp: 8, keystone: 0, source: 'template', order: 0 },
    { id: 'fd_move', name: 'Move', xp: 8, keystone: 0, source: 'template', order: 1 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const all = JSON.parse(localStorage.getItem('allDays'));
  all.girlfriend = { 1: { tasks: { fd_sleep: true, fd_move: true } },
                     2: { tasks: { fd_sleep: true, fd_move: true } } };
  localStorage.setItem('allDays', JSON.stringify(all));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(1400);
const gf = await prof('girlfriend');
const me = await prof('me');
check('6: the second profile migrated on its own',
  gf.activeChallenge.xpEconomyVersion === 2, String(gf.activeChallenge.xpEconomyVersion));
check('6: it kept its own rank', gf.highestRank === 5);
check('6: and the first profile was not disturbed',
  me.activeChallenge.xpEconomyVersion === 2 && me.activeChallenge.dailyBudget === 180);
check('6: each profile has its own archives',
  (await arch('girlfriend')).length >= 1 && (await arch('me')).length >= 1,
  `me ${(await arch('me')).length}, girlfriend ${(await arch('girlfriend')).length}`);

// ══ 7: the opt-in reconciliation still works, on converted amounts ═════════
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  localStorage.clear();
  localStorage.setItem('activeProfile', JSON.stringify('me'));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 7;
  p.me.xpPenalties = true;
  p.me.challengeStart = d(0);
  p.me.activeChallenge = {
    templateId: 'lock_in_14_day', name: 'LOCK IN', variant: 'standard', durationDays: 14,
    xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180, completionBonusXP: 504,
  };
  p.me.tasks = [{ id: 'li_sleep', name: 'Sleep', xp: 90, keystone: 3, source: 'template', order: 0 },
                { id: 'li_flow', name: 'Flow', xp: 90, keystone: 3, source: 'template', order: 1 }];
  localStorage.setItem('profiles', JSON.stringify(p));
  localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
  // A healthy era-1 archive plus an abandoned one whose deficit was clipped.
  const FD = [{ id: 'fd_sleep', name: 'S', xp: 8 }, { id: 'fd_mind', name: 'M', xp: 12 }, { id: 'fd_read', name: 'R', xp: 6 }];
  localStorage.setItem('archives', JSON.stringify({ me: [
    { id: 'arch_healthy', archivedAt: d(-40), challengeStart: d(-54), endDate: d(-41),
      challenge: { templateId: 'legacy', name: 'Discipline Block', durationDays: 14 },
      endDayNum: 14, xpStartDay: 1, xpOffset: 0,
      tasks: [{ id: 'h_a', name: 'A', xp: 40 }, { id: 'h_b', name: 'B', xp: 35 }],
      days: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i + 1, { tasks: { h_a: true, h_b: true } }])),
      xpEarned: 8245, weeklySessions: [], comebackHistory: [] },
    { id: 'arch_abandoned', archivedAt: d(-1), challengeStart: d(-30), endDate: d(-1),
      challenge: { templateId: 'forge_daily', name: 'Forge Daily', durationDays: null, isBaseline: true },
      endDayNum: 30, xpStartDay: 1, xpOffset: 0, tasks: FD,
      days: { 1: { tasks: { fd_sleep: true, fd_mind: true, fd_read: true } } },
      xpEarned: 0, weeklySessions: [], comebackHistory: [] },
  ], girlfriend: [] }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(700);
await gotoTab('Settings');
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('.xpr-card')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
check('7: the reconciliation is still offered', (await page.locator('.xpr-card').count()) === 1);
const rows = await page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('.xpr-row')].map(r => [
    r.children[0].textContent.trim(),
    parseInt((r.children[1].textContent || '').replace(/[^\d]/g, ''), 10) || r.children[1].textContent.trim(),
  ])));
check('7: it is still opt-in — nothing applied yet',
  !(await prof()).xpLedger?.reconciled);
check('7: the uncounted figure is the converted one',
  rows['Missed days found'] === 6490, String(rows['Missed days found']));
check('7: Current XP is the converted balance',
  rows['Current XP'] === 82450, String(rows['Current XP']));
check('7: the rank floor is the converted floor',
  /75,000/.test(await page.textContent('.xpr-card')));

await page.locator('.xpr-apply').click();
await page.waitForTimeout(400);
await page.locator('.xpr-confirm .btn-primary').click();
await page.waitForTimeout(800);
const applied = (await prof()).xpLedger?.reconciled;
check('7: applying records the charge in display units',
  applied?.amount === 6490 && applied?.ledgerUnits === 2,
  `${applied?.amount} units ${applied?.ledgerUnits}`);
details = await openRankDetails();
const afterApply = await rankFigure('Current XP');
check('7: and the balance drops by exactly that',
  afterApply === 82450 - 6490, String(afterApply));
check('7: the rank survives', /True Warrior/.test(details));
check('7: archives were never rewritten',
  (await arch()).find(a => a.id === 'arch_healthy').xpEarned === 8245 &&
  (await arch()).find(a => a.id === 'arch_abandoned').xpEarned === 0);

// ══ 9: migrating the baseline must not pay twice for the same days ═════════
// The regression this pins: the migration archives the era-1 segment and then
// starts a fresh one from today. If the live day records are left in place,
// day 1 of the NEW segment re-reads day 1 of the segment just archived and
// awards era-2 XP for work already banked. A profile at rank 1 is used
// deliberately — with a high rank the floor masks the inflated figure, which
// is exactly why the first version of this test passed while the bug was live.
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  localStorage.clear();
  localStorage.setItem('activeProfile', JSON.stringify('me'));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 1;                 // floor 0, so nothing can be masked
  p.me.xpPenalties = false;             // isolate earnings from penalties
  // Five logged days, all of them finished and in the past: today (day 6) has
  // nothing logged yet, so the whole segment is banked and the new one starts
  // empty. Section 9b covers a migration that lands mid-day.
  p.me.challengeStart = d(-5);
  p.me.activeChallenge = {
    templateId: 'forge_daily', name: 'Forge Daily', durationDays: null, isBaseline: true,
  };
  p.me.tasks = [
    { id: 'fd_sleep', name: 'Sleep', xp: 8, keystone: 0, source: 'template', order: 0 },
    { id: 'fd_mind', name: 'Mental Training', xp: 12, keystone: 1, source: 'template', order: 1 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let i = 1; i <= 5; i++) days[i] = { tasks: { fd_sleep: true, fd_mind: true } };
  localStorage.setItem('allDays', JSON.stringify({ me: days, girlfriend: {} }));
  localStorage.setItem('archives', JSON.stringify({ me: [], girlfriend: [] }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(1400);

const migrated = await prof();
const archived = await arch();
check('9: the era-1 segment was archived', archived.length === 1, `${archived.length}`);
check('9: and the live day records were cleared, not left to be re-read',
  Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('allDays')).me)).length === 0,
  JSON.stringify(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('allDays')).me))));
check('9: the archive kept the day records it needs to recompute',
  Object.keys(archived[0].days || {}).length === 5,
  `${Object.keys(archived[0].days || {}).length} days`);

details = await openRankDetails();
const afterMigration = await rankFigure('Current XP');
// The archived era-1 total, converted. Nothing else has been earned yet.
const expected = archived[0].xpEarned * 10;
check('9: Current XP is exactly the converted archive — no XP paid twice',
  afterMigration === expected, `${afterMigration} vs ${expected}`);
check('9: the new segment starts at zero, not mid-way through old days',
  migrated.xpStartDay === 1 && migrated.xpOffset === 0);

// Idempotence: reloading must not archive again or change the balance.
for (let i = 0; i < 3; i++) {
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.waitForTimeout(500);
}
check('9: three reloads do not archive the segment again',
  (await arch()).length === 1, `${(await arch()).length}`);
details = await openRankDetails();
check('9: and the balance is unchanged — the conversion is idempotent',
  (await rankFigure('Current XP')) === expected, `${await rankFigure('Current XP')}`);
check('9: the rank was not lost', !!(await prof()).highestRank);

// ══ 9b: a migration that lands mid-day keeps the day in progress ═══════════
// The new era-2 segment starts today, so today IS its Day 1. A user who had
// already ticked some of today off before the update must not find it blanked
// — and must not be paid for it twice either. So days strictly before today
// are banked, and today's record is carried over as Day 1 of the new segment.
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('activeProfile', JSON.stringify('me'));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.evaluate(() => {
  const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 1;
  p.me.xpPenalties = false;
  p.me.challengeStart = d(-4);          // today is day 5, and it IS logged
  p.me.activeChallenge = {
    templateId: 'forge_daily', name: 'Forge Daily', durationDays: null, isBaseline: true,
  };
  p.me.tasks = [
    { id: 'fd_sleep', name: 'Sleep', xp: 8, keystone: 0, source: 'template', order: 0 },
    { id: 'fd_mind', name: 'Mental Training', xp: 12, keystone: 1, source: 'template', order: 1 },
  ];
  localStorage.setItem('profiles', JSON.stringify(p));
  const days = {};
  for (let i = 1; i <= 5; i++) days[i] = { dayNumber: i, date: d(i - 5), mood: 4, tasks: { fd_sleep: true, fd_mind: true } };
  localStorage.setItem('allDays', JSON.stringify({ me: days, girlfriend: {} }));
  localStorage.setItem('archives', JSON.stringify({ me: [], girlfriend: [] }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(1400);

const midDay = await page.evaluate(() => JSON.parse(localStorage.getItem('allDays')).me);
const midArch = await arch();
const todayStr = await page.evaluate(() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; });
check('9b: the four finished days were banked, today was not',
  Object.keys(midArch[0]?.days || {}).length === 4 && midArch[0]?.endDayNum === 4,
  `${Object.keys(midArch[0]?.days || {}).length} days, endDayNum ${midArch[0]?.endDayNum}`);
check('9b: today is still on the live slate, re-keyed to Day 1',
  Object.keys(midDay).length === 1 && midDay[1]?.date === todayStr,
  `${JSON.stringify(Object.keys(midDay))} / ${midDay[1]?.date} vs ${todayStr}`);
check('9b: and it kept what the user had already filled in',
  midDay[1]?.tasks?.fd_sleep === true && midDay[1]?.tasks?.fd_mind === true && midDay[1]?.mood === 4);
check('9b: the carried day is NOT also in the archive',
  !Object.values(midArch[0]?.days || {}).some(x => x?.date === todayStr));

details = await openRankDetails();
const midXP = await rankFigure('Current XP');
// The banked four days converted, plus exactly ONE era-2 day: the 120-unit
// easy-tier budget (both template tasks) and the 15% perfect-day bonus.
const ONE_ERA2_PERFECT_DAY = 138;
const midExpected = midArch[0].xpEarned * 10 + ONE_ERA2_PERFECT_DAY;
check('9b: Current XP is the banked segment plus one era-2 day, not two',
  midXP === midExpected,
  `${midXP} vs ${midExpected} (${midArch[0].xpEarned}×10 + ${ONE_ERA2_PERFECT_DAY})`);

await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(600);
check('9b: reloading does not re-archive or re-pay the carried day',
  (await arch()).length === 1 &&
  Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('allDays')).me)).length === 1);
details = await openRankDetails();
check('9b: and the balance is unchanged', (await rankFigure('Current XP')) === midExpected,
  `${await rankFigure('Current XP')}`);

// ══ 10: no page errors throughout ══════════════════════════════════════════
const real = errors.filter(e => !/favicon|manifest|ServiceWorker|sw\.js/i.test(e));
check('8: no page errors throughout', real.length === 0, real.slice(0, 2).join(' | '));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
