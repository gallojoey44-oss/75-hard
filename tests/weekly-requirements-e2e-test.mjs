/**
 * Weekly Requirements end-to-end: logging, undo/remove, persistence, profile
 * separation, backup/restore, and protection of pre-existing attempts/archives.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => { const b = [...document.querySelectorAll('.bottom-nav .nav-tab, button')].find(x => new RegExp(n, 'i').test(x.textContent)); if (b) b.click(); }, name);
  await page.waitForTimeout(300);
}
const challengeXP = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
const sessions = () => page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.weeklySessions || []);
const liftRow = () => page.locator('.wr-row', { hasText: 'Lifting' });
const z2Row = () => page.locator('.wr-row', { hasText: 'Zone 2' });

/** Seed an active Fat Loss attempt on `dayNum` of a `duration`-day challenge. */
async function seedFatLoss({ duration = 30, dayNum = 3, sessions = [], startDate = null, profile = 'me' } = {}) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
  const start = new Date(); start.setDate(start.getDate() - (dayNum - 1));
  await page.evaluate(({ startStr, duration, sessions, startDate, profile }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    p[profile].challengeStart = startStr; p[profile].xpPenalties = false;
    p[profile].activeChallenge = {
      templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard',
      durationDays: duration, templateVersion: 3, rewardXP: 500, completionBonusXP: 500,
      passingScore: 70, keystoneRequirement: 65,
      weeklyRequirementsStartDate: startDate || startStr,
    };
    p[profile].tasks = [
      { id: 'fl_protein', name: 'Hit protein goal', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, source: 'template', order: 0 },
      { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, source: 'template', order: 1 },
    ];
    p[profile].weeklySessions = sessions;
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({ me: {}, girlfriend: {} }));
  }, { startStr: dstr(start), duration, sessions, startDate, profile });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
}

// ══ 1–5: the tracker renders with real targets and log buttons ══════════════
await page.goto(BASE);
await seedFatLoss({ dayNum: 3 });
await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
check('1: Weekly Requirements section renders for Fat Loss', (await page.locator('.wr-card').count()) === 1);
const cardText = await page.textContent('.wr-card');
check('2: lifting shows 0 / 3 this week', /Lifting[\s\S]*?0 \/ 3 this week/.test(cardText));
check('3: Zone 2 shows 0 / 2 this week', /Zone 2 Cardio[\s\S]*?0 \/ 2 this week/.test(cardText));
check('4: header names the challenge week', /Week 1/.test(cardText));
check('5: log buttons are present', (await page.locator('.wr-log-btn').count()) === 2);

// Placement: below Daily Tasks, above Challenge Performance.
const order = await page.evaluate(() => {
  const top = el => el ? el.getBoundingClientRect().top : null;
  const daily = [...document.querySelectorAll('.section-card')].find(c => /Daily Tasks/.test(c.textContent));
  return { daily: top(daily), wr: top(document.querySelector('.wr-card')), perf: top(document.querySelector('.perf-card')) };
});
check('2: section sits below Daily Tasks and above Challenge Performance', order.daily < order.wr && order.wr < order.perf);

// ══ 5/6/11: logging persists and awards XP ══════════════════════════════════
await gotoTab('Home'); const xp0 = await challengeXP();
await gotoTab('Today');
await liftRow().locator('.wr-log-btn').first().click();
await page.waitForTimeout(400);
check('5: tapping logs a lifting session', (await sessions()).filter(s => s.type === 'lifting').length === 1);
check('5: the row updates to 1 / 3', /1 \/ 3 this week/.test(await page.textContent('.wr-card')));
await gotoTab('Home');
check('11: a lifting session awards exactly 25 XP', (await challengeXP()) - xp0 === 25, `+${(await challengeXP()) - xp0}`);
await gotoTab('Today');
await z2Row().locator('.wr-log-btn').first().click();
await page.waitForTimeout(400);
await gotoTab('Home');
check('12: a Zone 2 session awards exactly 20 XP', (await challengeXP()) - xp0 === 45, `+${(await challengeXP()) - xp0}`);

// 6: persists across reload, with no duplicate XP
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
check('6: sessions persist after reload', (await sessions()).length === 2);
check('23: no duplicate XP after reload', (await challengeXP()) - xp0 === 45, `+${(await challengeXP()) - xp0}`);

// ══ 7: undo + remove ════════════════════════════════════════════════════════
await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
await liftRow().locator('.wr-log-btn').first().click();
await page.waitForTimeout(400);
check('7: an undo affordance appears after logging', (await page.locator('.wr-undo').count()) === 1);
await page.locator('.wr-undo-btn').click();
await page.waitForTimeout(300);
check('7: undo removes just that session', (await sessions()).filter(s => s.type === 'lifting').length === 1);
// Remove from the week history.
await page.locator('.wr-history-toggle').click();
await page.waitForTimeout(200);
check('4: week history lists logged sessions by weekday', /Lifting/.test(await page.textContent('.wr-history')));
await page.locator('.wr-history .wr-remove-btn').first().click();
await page.waitForTimeout(300);
check('7: removing from history deletes the session', (await sessions()).length === 1);
await gotoTab('Home');
check('7: removal immediately updates XP', (await challengeXP()) - xp0 === 20, `+${(await challengeXP()) - xp0}`);

// ══ 8: multiple sessions on one day, each with a unique id ══════════════════
await gotoTab('Today');
await liftRow().locator('.wr-log-btn').first().click();
await page.waitForTimeout(800);           // clear the double-tap cooldown
await liftRow().locator('.wr-log-btn').first().click();
await page.waitForTimeout(400);
const multi = await sessions();
const lifts = multi.filter(s => s.type === 'lifting');
check('8: two lifting sessions can be logged the same day', lifts.length === 2);
check('8: same date, unique ids', lifts[0].date === lifts[1].date && lifts[0].id !== lifts[1].id);

// ══ 9: current week stays neutral ═══════════════════════════════════════════
await seedFatLoss({ dayNum: 3 });
await gotoTab('Home'); await page.waitForTimeout(200);
const scoreNeutral = await page.textContent('.perf-ring-num');
await gotoTab('Today');
await liftRow().locator('.wr-log-btn').first().click();
await page.waitForTimeout(400);
await gotoTab('Home');
check('9: logging in the current week never lowers the score', parseInt(await page.textContent('.perf-ring-num'), 10) >= parseInt(scoreNeutral, 10));
await gotoTab('Today');
check('9: the card shows current-week progress without penalising it', /1 \/ 3 this week/.test(await page.textContent('.wr-card')));

// ══ 10: a finalized week's shortfall counts as missed ═══════════════════════
// Day 10 → week 1 (days 1–7) is historical with only 1 lift logged.
await seedFatLoss({ dayNum: 10, sessions: [{ id: 'w1', type: 'lifting', date: dstr(new Date(Date.now() - 9 * 864e5)) }] });
const weekly = await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles')).me;
  return { sessions: p.weeklySessions.length, start: p.activeChallenge.weeklyRequirementsStartDate };
});
check('10: the historical session is retained', weekly.sessions === 1);
await gotoTab('Home'); await page.waitForTimeout(200);
await page.locator('.perf-expand-btn').click();
await page.waitForTimeout(200);
const perfText = await page.textContent('.perf-card');
check('11(UI): Challenge Performance shows a Weekly Requirements breakdown', /Weekly Requirements/.test(perfText));
check('11(UI): it reports completed vs required', /Lifting[\s\S]*?\d+ \/ \d+ completed/.test(perfText), perfText.match(/Lifting[^§]{0,60}/)?.[0]);
check('11(UI): the current in-progress week is called out separately', /Current week \(week 2, in progress\)/.test(perfText.replace(/\s+/g, ' ')));

// ══ 19: a pre-existing attempt is not retroactively penalised ═══════════════
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
const legacyStart = new Date(); legacyStart.setDate(legacyStart.getDate() - 20); // day 21, week 3
await page.evaluate(({ startStr }) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.highestRank = 8; p.me.challengeStart = startStr; p.me.xpPenalties = true;
  // Pre-feature attempt: NO weeklyRequirementsStartDate, NO weeklySessions.
  p.me.activeChallenge = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard', durationDays: 30, templateVersion: 3, rewardXP: 500, completionBonusXP: 500, passingScore: 70, keystoneRequirement: 65 };
  p.me.tasks = [{ id: 'fl_protein', name: 'Protein', xp: 40, keystone: 3, keystoneHabit: true, source: 'template', order: 0 }];
  localStorage.setItem('profiles', JSON.stringify(p));
  const dd = {}; for (let i = 1; i <= 20; i++) dd[i] = { dayNumber: i, tasks: { fl_protein: true }, mood: 6, isMWD: false, mwdTasks: {}, bonusDone: {} };
  localStorage.setItem('allDays', JSON.stringify({ me: dd, girlfriend: {} }));
}, { startStr: dstr(legacyStart) });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(400);
const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me);
const today = dstr(new Date());
check('19: migration stamps weeklyRequirementsStartDate = today', migrated.activeChallenge.weeklyRequirementsStartDate === today, migrated.activeChallenge.weeklyRequirementsStartDate);
check('19: no session history is fabricated', Array.isArray(migrated.weeklySessions) && migrated.weeklySessions.length === 0);
await gotoTab('Home'); await page.waitForTimeout(200);
await page.locator('.perf-expand-btn').click(); await page.waitForTimeout(200);
const legacyPerf = await page.textContent('.perf-card');
check('19: earlier weeks contribute no required sessions (nothing marked failed)', !/Lifting[\s\S]*?0 \/ (6|9) completed/.test(legacyPerf));
// Idempotent
const snap1 = await page.evaluate(() => localStorage.getItem('profiles'));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
check('19/24: migration is idempotent', (await page.evaluate(() => localStorage.getItem('profiles'))) === snap1);

// ══ 20: old archives untouched ══════════════════════════════════════════════
await page.evaluate(() => {
  localStorage.setItem('archives', JSON.stringify({ me: [{
    id: 'arch_old', archivedAt: '2026-02-01', challengeStart: '2026-01-01', endDate: '2026-01-30', endDayNum: 30,
    completed: true, completionDate: '2026-01-31',
    challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30 },
    days: { 1: { dayNumber: 1, tasks: { fl_protein: true } } }, tasks: [{ id: 'fl_protein', xp: 25, keystone: 2 }],
    xpEarned: 1000, badges: [], finalScore: 80, scoreAvailable: true, passingScore: 70, passed: true,
  }], girlfriend: [] }));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const oldArch = await page.evaluate(() => JSON.parse(localStorage.getItem('archives')).me[0]);
check('20: old archive has no fabricated weekly data', oldArch.weeklySessions === undefined && oldArch.weeklyRequirements === undefined);
check('20: old archive score/XP unchanged', oldArch.finalScore === 80 && oldArch.xpEarned === 1000 && oldArch.passed === true);

// ══ 21: backup/restore preserves sessions + start date ══════════════════════
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
await seedFatLoss({ dayNum: 3, sessions: [{ id: 'b1', type: 'lifting', date: dstr(new Date()) }, { id: 'b2', type: 'zone2', date: dstr(new Date()) }] });
const backup = await page.evaluate((keys) => { const d = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) d[k] = JSON.parse(v); } return d; }, LS_KEYS);
await page.evaluate(() => localStorage.clear());
await page.evaluate((data) => { for (const k of Object.keys(data)) localStorage.setItem(k, JSON.stringify(data[k])); }, backup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me);
check('21: restore preserves the session list', (restored.weeklySessions || []).length === 2);
check('21: restore preserves the weekly start date', !!restored.activeChallenge.weeklyRequirementsStartDate);
// Older backup with no weekly fields migrates safely.
const oldBackup = JSON.parse(JSON.stringify(backup));
delete oldBackup.profiles.me.weeklySessions;
delete oldBackup.profiles.me.activeChallenge.weeklyRequirementsStartDate;
await page.evaluate(() => localStorage.clear());
await page.evaluate((data) => { for (const k of Object.keys(data)) localStorage.setItem(k, JSON.stringify(data[k])); }, oldBackup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 }); await page.waitForTimeout(300);
const migratedBackup = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me);
check('21: an older backup migrates safely (empty list + stamped start date)',
  Array.isArray(migratedBackup.weeklySessions) && migratedBackup.weeklySessions.length === 0 && migratedBackup.activeChallenge.weeklyRequirementsStartDate === today);

// ══ 22: profile separation ══════════════════════════════════════════════════
await seedFatLoss({ dayNum: 3 });
await gotoTab('Today');
await liftRow().locator('.wr-log-btn').first().click();
await page.waitForTimeout(400);
check('22: male profile has the session', (await sessions()).length === 1);
check('22: female profile is unaffected', (await page.evaluate(() => (JSON.parse(localStorage.getItem('profiles')).girlfriend.weeklySessions || []).length)) === 0);

// ══ Other challenges do not show the tracker ════════════════════════════════
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.activeChallenge = { templateId: 'mental_training_phase', name: 'MT', variant: 'standard', durationDays: 14, templateVersion: 6, passingScore: 70, keystoneRequirement: 65 };
  p.me.tasks = [{ id: 'mt_mind', name: 'Mental Training', xp: 100, keystone: 3, source: 'template', order: 0 }];
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Today'); await page.waitForSelector('.daily-view', { timeout: 5000 });
check('Scoped: Mental Training shows no Weekly Requirements tracker', (await page.locator('.wr-card').count()) === 0);

check('No console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
