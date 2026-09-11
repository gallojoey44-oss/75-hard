/**
 * End Support Challenge, end to end.
 *
 * The core product rule under test: ending the support challenge touches ONLY
 * the support challenge. The primary attempt's id, start date, day number,
 * tasks, history, score, keystone adherence, XP, streak, letter and upgrades all
 * have to come through byte-identical.
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
const TODAY = dstr(new Date());

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => x.getAttribute('aria-label') === n);
    if (b) b.click();
  }, name);
  await page.waitForTimeout(400);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const arch = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('archives') || '{}')[i] || []), id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);
const xpSplit = () => page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return {
    challenge: parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10),
    lifetime: parseInt((t.match(/Lifetime:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10),
  };
});

const TASKS = [
  { id: 'mt_meditate', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 25, keystone: 3, keystoneHabit: true, habitKey: 'meditation', source: 'template', order: 0, challenges: ['primary'] },
  { id: 'mt_read', name: 'Read 5 pages', icon: '📚', xp: 15, keystone: 1, habitKey: 'reading', source: 'template', order: 1, challenges: ['primary'] },
  { id: 'mt_sleep', name: 'Sleep 7.5–9 hours', icon: '😴', xp: 20, keystone: 2, habitKey: 'sleep_target', source: 'template', order: 2, challenges: ['primary', 'support'], mergedFrom: { primary: 'mt_sleep', support: 'fl_sleep' } },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, habitKey: 'daily_log', source: 'template', order: 3, challenges: ['primary', 'support'] },
  { id: 'fl_protein', name: 'Hit protein: 140–175g', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'protein_target', source: 'template', order: 4, challenges: ['support'] },
  { id: 'fl_steps', name: 'Walk 10,000+ steps', icon: '🚶', xp: 30, keystone: 2, habitKey: 'daily_steps', source: 'template', order: 5, challenges: ['support'] },
];
const PRIMARY_META = {
  templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
  variant: 'standard', durationDays: 14, templateVersion: 3, completionBonusXP: 300,
  passingScore: 70, keystoneRequirement: 65, coldExposureUpgradeEnabled: true,
  coldExposureUpgradeStartDate: offset(-8),
  futureSelfLetter: { why: 'To become someone who keeps promises.', writtenAt: offset(-8) },
};
const SUPPORT_META = {
  templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡',
  variant: 'hard', durationDays: 30, completionBonusXP: 500,
  weeklyRequirementDefs: [
    { id: 'lifting', label: 'Resistance Training', icon: '🏋️', perWeek: 3, xp: 30, keystone: 3, logLabel: 'Log Lifting Session', unit: 'lift' },
  ],
};

async function seed({ supportStart = offset(-8), loggedDays = 9, profileId = 'me', tasks = TASKS, withSessions = true } = {}) {
  await page.evaluate((pid) => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify(pid)); }, profileId);
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 });
  await page.evaluate(({ pid, supportStart, loggedDays, tasks, withSessions, primaryStart, pMeta, sMeta }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 9; p.girlfriend.highestRank = 9;
    p[pid].challengeStart = primaryStart;
    p[pid].activeChallenge = { ...pMeta };
    p[pid].supportChallenge = { ...sMeta };
    p[pid].supportChallengeStart = supportStart;
    p[pid].tasks = tasks;
    p[pid].xpPenalties = false;
    p[pid].weeklySessions = withSessions
      ? [{ id: 'ws_1', type: 'lifting', date: primaryStart }, { id: 'ws_2', type: 'lifting', date: supportStart }]
      : [];
    localStorage.setItem('profiles', JSON.stringify(p));
    const all = JSON.parse(localStorage.getItem('allDays') || '{"me":{},"girlfriend":{}}');
    const recs = {};
    for (let n = 1; n <= loggedDays; n++) {
      const d = new Date(primaryStart + 'T00:00:00'); d.setDate(d.getDate() + n - 1);
      recs[n] = {
        date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        dayNumber: n, validated: true, notes: `day ${n}`,
        tasks: Object.fromEntries(tasks.map(t => [t.id, true])),
        mood: 4, confidence: 4, sleep: 4, energy: 4, recovery: 4, workoutEffort: 4, stress: 2, hoursSlept: 8,
        mentalTraining: { selected: 'meditation', completed: true, notes: '' }, bonusDone: {}, bonusOneTime: [],
      };
    }
    all[pid] = recs;
    localStorage.setItem('allDays', JSON.stringify(all));
    const wr = JSON.parse(localStorage.getItem('weeklyReflections') || '{}');
    wr[pid] = { 1: { went_well: 'Kept the streak.' } };
    localStorage.setItem('weeklyReflections', JSON.stringify(wr));
  }, { pid: profileId, supportStart, loggedDays, tasks, withSessions, primaryStart: offset(-8), pMeta: PRIMARY_META, sMeta: SUPPORT_META });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(500);
}

/** A full snapshot of everything the primary attempt owns. */
const primarySnapshot = () => page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles')).me;
  const all = JSON.parse(localStorage.getItem('allDays')).me;
  return {
    meta: JSON.stringify(p.activeChallenge),
    start: p.challengeStart,
    primaryTasks: JSON.stringify((p.tasks || []).filter(t => (t.challenges || ['primary']).includes('primary'))
      .map(t => ({ id: t.id, xp: t.xp, name: t.name }))),
    days: JSON.stringify(all),
    sessions: JSON.stringify(p.weeklySessions || []),
    reflections: localStorage.getItem('weeklyReflections'),
  };
});

async function endSupport() {
  await gotoTab('Challenges');
  await page.waitForTimeout(400);
  await page.locator('.acc-support-end').click();
  await page.waitForTimeout(400);
  await page.locator('.end-support-modal button', { hasText: /^(End|Cancel) Support Challenge$/ }).click();
  await page.waitForTimeout(800);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: the control appears only when support is active ════════════════════
await seed({});
await gotoTab('Challenges');
await page.waitForTimeout(400);
check('1: an End Support Challenge control is offered', (await page.locator('.acc-support-end').count()) === 1);
check('1: it is labelled End Support Challenge',
  /End Support Challenge/.test(await page.locator('.acc-support-end').textContent()));
check('1: it is not next to the daily checkboxes', await page.evaluate(() =>
  !document.querySelector('.acc-support-end')?.closest('.section-card')?.querySelector('.check-item')));
await gotoTab('Settings');
await page.waitForTimeout(600);
check('1: it is also reachable from Manage Tasks', (await page.locator('.tm-end-support').count()) === 1);

// ══ 2: the confirmation states Primary is unaffected ══════════════════════
await gotoTab('Challenges');
await page.waitForTimeout(400);
await page.locator('.acc-support-end').click();
await page.waitForTimeout(400);
const modal = await page.textContent('.end-support-modal');
check('2: the modal opens', (await page.locator('.end-support-modal').count()) === 1);
check('2: it names the support challenge', /Fat Loss Challenge/.test(modal));
check('2: it says Support-only tasks are removed from the daily plan',
  /Support-only tasks/.test(modal) && /daily plan/.test(modal));
check('2: it states the Primary Challenge continues unchanged',
  /Primary Challenge/.test(modal) && /continue unchanged/.test(modal));
check('2: it names the primary challenge', /Mental Training Phase/.test(modal));
check('2: it says the support progress will be archived', /progress will be archived/.test(modal));
check('2: it never uses the word Delete', !/delete/i.test(modal));
check('2: Cancel is offered', (await page.locator('.end-support-modal button', { hasText: /^Cancel$/ }).count()) === 1);
await page.locator('.end-support-modal button', { hasText: /^Cancel$/ }).click();
await page.waitForTimeout(400);
check('2: cancelling changes nothing', !!(await prof()).supportChallenge);

// ══ 3-9: ending archives only the support attempt ════════════════════════
const beforeSnap = await primarySnapshot();
await gotoTab('Home');
await page.waitForTimeout(400);
const xpBefore = await xpSplit();
const dayNumBefore = await page.evaluate(() => document.querySelector('.hero-day-num')?.textContent?.trim() || null);
await endSupport();

const after = await prof();
check('3: the support slot is cleared', !after.supportChallenge && !after.supportChallengeStart);
const archives = await arch();
check('3: exactly one archive entry was written', archives.length === 1);
check('3: it is the SUPPORT lane', archives[0]?.lane === 'support');
check('3: it is the Fat Loss attempt', archives[0]?.challenge?.templateId === 'fat_loss_phase');
check('3: the primary was NOT archived',
  !archives.some(a => a.challenge?.templateId === 'mental_training_phase'));

const afterSnap = await primarySnapshot();
check('4: the primary challenge descriptor is byte-identical', beforeSnap.meta === afterSnap.meta);
check('5: the primary start date is unchanged', beforeSnap.start === afterSnap.start);
await gotoTab('Home');
await page.waitForTimeout(400);
const dayNumAfter = await page.evaluate(() => document.querySelector('.hero-day-num')?.textContent?.trim() || null);
check('5: the primary day number is unchanged',
  dayNumAfter === dayNumBefore && dayNumBefore != null, `${dayNumBefore} → ${dayNumAfter}`);
check('7: every primary task is unchanged', beforeSnap.primaryTasks === afterSnap.primaryTasks);
check('the primary day records are untouched', beforeSnap.days === afterSnap.days);
check('the primary weekly sessions are untouched', beforeSnap.sessions === afterSnap.sessions);
check('the primary weekly reflections are untouched', beforeSnap.reflections === afterSnap.reflections);
check('the Future Self letter survives', !!after.activeChallenge?.futureSelfLetter?.why);
check('the Cold Exposure upgrade survives',
  after.activeChallenge?.coldExposureUpgradeEnabled === true &&
  !!after.activeChallenge?.coldExposureUpgradeStartDate);

await gotoTab('Home');
await page.waitForTimeout(500);
const xpAfter = await xpSplit();
check('8: Lifetime XP is unchanged', xpAfter.lifetime === xpBefore.lifetime, `${xpBefore.lifetime} → ${xpAfter.lifetime}`);
check('7: Challenge XP is unchanged', xpAfter.challenge === xpBefore.challenge, `${xpBefore.challenge} → ${xpAfter.challenge}`);
check('9: the permanent rank floor is unchanged', (await prof()).highestRank === 9);
check('the carried XP was banked into the support archive',
  (archives[0]?.xpEarned || 0) > 0, String(archives[0]?.xpEarned));

// ══ 13: archive status is honest ══════════════════════════════════════════
const a0 = archives[0];
check('13: the archive is marked Ended Early', a0.endedEarly === true && a0.endReason === 'ended_early');
check('13: it is NOT marked completed', a0.completed === false);
check('13: it claims no pass/fail verdict', a0.passed === null);
check('13: it records the real end date', a0.endedOn === TODAY);
check('13: it records the days it actually ran, not the planned duration',
  a0.daysActive === 9 && a0.plannedDurationDays === 30, `${a0.daysActive} of ${a0.plannedDurationDays}`);
check('3: it preserves the challenge name, mode and duration',
  a0.challenge.name === 'Fat Loss Challenge' && a0.challenge.variant === 'hard' && a0.challenge.durationDays === 30);
check('3: it preserves the start date', a0.challengeStart === offset(-8));
check('3: it preserves the support tasks', (a0.tasks || []).some(t => t.id === 'fl_protein'));
check('3: it preserves the completed days', Object.keys(a0.days || {}).length === 9);
check('3: it preserves support-specific adherence where available',
  a0.keystoneAdherence != null || a0.scoreAvailable === false);
check('19: logged weekly sessions remain on the profile, unharmed',
  ((await prof()).weeklySessions || []).length === 2);
check('11/18: the archive is honest that weekly requirements were primary-only',
  a0.weeklyRequirements?.tracked === false && /primary challenge only/i.test(a0.weeklyRequirements?.reason || ''));

await gotoTab('Settings');
await page.waitForTimeout(600);
const archText = await page.textContent('.archive-list');
check('13: the archive row reads "Ended Early on <date>"', /Ended Early on/.test(archText));
check('13: it shows the days actually active', /9 days active/.test(archText));
check('13: it is labelled as a Support attempt', /Support/.test(archText));
check('13: it shows no Passed/Did Not Pass verdict',
  !/Passed|Did Not Pass/.test(archText), archText.slice(0, 160));
check('13: it explains why there is no verdict', /no pass or fail result/i.test(archText));

// ══ 10-12: tasks ══════════════════════════════════════════════════════════
check('10: support-only tasks are gone',
  !after.tasks.some(t => ['fl_protein', 'fl_steps'].includes(t.id)),
  JSON.stringify(after.tasks.map(t => t.id)));
check('11: shared tasks remain because Primary still requires them',
  after.tasks.some(t => t.id === 'mt_sleep') && after.tasks.some(t => t.id === 'daily_log'));
check('11: shared tasks revert to primary-only ownership',
  after.tasks.filter(t => ['mt_sleep', 'daily_log'].includes(t.id))
    .every(t => JSON.stringify(t.challenges) === '["primary"]'));
check('11: no duplicate primary version of a shared task was created',
  new Set(after.tasks.map(t => t.id)).size === after.tasks.length);
check('primary-only tasks are untouched',
  after.tasks.some(t => t.id === 'mt_meditate') && after.tasks.some(t => t.id === 'mt_read'));
const d = await days();
check('12: shared task completion state is intact',
  Object.values(d).every(rec => rec.tasks?.mt_sleep === true && rec.tasks?.daily_log === true));
check('12: historical completions are not reset',
  Object.keys(d).length === 9 && d[1]?.tasks?.mt_meditate === true);
check('13: the support-only completions stay in history, not erased',
  d[1]?.tasks?.fl_protein === true);

// ══ 8: Today collapses back to primary-only ══════════════════════════════
await gotoTab('Today');
await page.waitForTimeout(600);
check('8: the lane sections are gone', (await page.locator('.lane-section').count()) === 0);
check('8: no SUPPORT CHALLENGE header remains',
  !/SUPPORT CHALLENGE/i.test(await page.textContent('body')));
check('8: the "Also supports" labels are gone', (await page.locator('.check-supports').count()) === 0);
check('8: only the primary tasks are listed',
  (await page.locator('.check-item').count()) === after.tasks.length);
await gotoTab('Home');
await page.waitForTimeout(400);
check('8: Home no longer shows the ended support challenge',
  !/Fat Loss Challenge/.test(await page.textContent('.dashboard')));
check('8: Home still shows the primary challenge',
  /Mental Training Phase/.test(await page.textContent('.dashboard')));

// ══ 16/17: notifications follow the task list ════════════════════════════
check('16: support-only tasks can no longer produce reminders — they are gone',
  !(await prof()).tasks.some(t => /protein|10,000/.test(t.name)));
check('17: primary tasks remain available for reminders',
  (await prof()).tasks.some(t => /Mental Training/.test(t.name)));

// ══ 18: support weekly requirements stop ═════════════════════════════════
await gotoTab('Today');
await page.waitForTimeout(500);
check('18: no Fat Loss weekly requirement is enforced after ending',
  !/Resistance Training/i.test(await page.textContent('body')));

// ══ 20/21: re-adding support ═════════════════════════════════════════════
await gotoTab('Challenges');
await page.waitForTimeout(500);
check('21: no replacement support challenge started automatically', !(await prof()).supportChallenge);
check('20: an Add a Support Challenge action is offered again',
  (await page.locator('.acc-add-support').count()) === 1);
await page.locator('.acc-add-support').click();
await page.waitForTimeout(500);
check('20: Fat Loss is offered again as a startable support challenge',
  (await page.locator('.sup-option', { hasText: 'Fat Loss Challenge' }).count()) === 1);
await page.locator('.sup-option', { hasText: 'Fat Loss Challenge' }).first().click();
await page.waitForTimeout(500);
const confirmBtn = page.locator('.sup-confirm button', { hasText: /^Add Support Challenge$/ });
if (await confirmBtn.count()) { await confirmBtn.click(); await page.waitForTimeout(800); }
const reAdded = await prof();
check('10: re-adding creates a NEW support attempt',
  reAdded.supportChallenge?.templateId === 'fat_loss_phase' && !!reAdded.supportChallengeStart);
check('10: the previous ended-early attempt is retained separately in history',
  (await arch()).filter(x => x.lane === 'support').length === 1 &&
  (await arch())[0].endedEarly === true);
check('10: the old attempt was not silently resumed',
  reAdded.supportChallengeStart === TODAY);

// ══ 23: reload preserves the primary-only state ══════════════════════════
await seed({});
await endSupport();
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(500);
const reloaded = await prof();
check('23: reload keeps the support slot cleared', !reloaded.supportChallenge);
check('23: reload keeps the primary running', reloaded.activeChallenge?.templateId === 'mental_training_phase');
check('23: reload keeps support-only tasks off the list',
  !reloaded.tasks.some(t => t.id === 'fl_protein'));
await gotoTab('Today');
await page.waitForTimeout(500);
check('23: reload renders the unsectioned primary-only list',
  (await page.locator('.lane-section').count()) === 0);

// ══ 22: a scheduled support challenge is CANCELLED, not ended ════════════
await seed({ supportStart: offset(3), loggedDays: 9 });
await gotoTab('Challenges');
await page.waitForTimeout(500);
check('22: a not-yet-started support challenge offers Cancel, not End',
  /Cancel Support Challenge/.test(await page.locator('.acc-support-end').textContent()));
await page.locator('.acc-support-end').click();
await page.waitForTimeout(400);
const cancelModal = await page.textContent('.end-support-modal');
check('22: the modal says Cancel', /Cancel Fat Loss Challenge\?/.test(cancelModal));
check('22: it does not promise an archive that will not be written',
  !/progress will be archived/.test(cancelModal) && /no progress to archive/i.test(cancelModal));
check('22: it still states the primary continues unchanged', /continue unchanged/.test(cancelModal));
const archBeforeCancel = (await arch()).length;
await page.locator('.end-support-modal button', { hasText: /^Cancel Support Challenge$/ }).click();
await page.waitForTimeout(800);
check('22: cancelling clears the support slot', !(await prof()).supportChallenge);
check('22: NO misleading "Ended Early" archive is created for an attempt that never began',
  (await arch()).length === archBeforeCancel, `${(await arch()).length} entries`);
check('22: the primary is still running', (await prof()).activeChallenge?.templateId === 'mental_training_phase');
check('22: support-only tasks are removed', !(await prof()).tasks.some(t => t.id === 'fl_protein'));

// ══ 15: edge cases ═══════════════════════════════════════════════════════
// Ended on the support challenge's Day 1. Day records are keyed by the PRIMARY
// day number, so the primary needs a record on that calendar date for the
// support's day 1 to resolve — seed the full primary range.
await seed({ supportStart: TODAY, loggedDays: 9 });
await endSupport();
const day1Arch = (await arch()).filter(x => x.lane === 'support');
check('15: ending on support Day 1 archives exactly one day, honestly',
  day1Arch.length === 1 && day1Arch[0].daysActive === 1 && day1Arch[0].endedEarly === true,
  JSON.stringify(day1Arch.map(a => a.daysActive)));
check('15: the primary survives a Day 1 support end',
  (await prof()).activeChallenge?.templateId === 'mental_training_phase');

// No completed days at all.
await seed({ supportStart: offset(-3), loggedDays: 0 });
const archBeforeEmpty = (await arch()).length;
await endSupport();
check('15: a support challenge with no logged days writes no phantom archive',
  (await arch()).length === archBeforeEmpty);
check('15: its tasks are still removed', !(await prof()).tasks.some(t => t.id === 'fl_protein'));
check('15: and the primary is untouched', (await prof()).activeChallenge?.templateId === 'mental_training_phase');

// Unchecked support-only tasks today must not create later penalties.
await seed({ supportStart: offset(-8), loggedDays: 9 });
await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('allDays'));
  const t = { ...all.me[9].tasks }; delete t.fl_protein; delete t.fl_steps;
  all.me[9] = { ...all.me[9], tasks: t };
  localStorage.setItem('allDays', JSON.stringify(all));
  const p = JSON.parse(localStorage.getItem('profiles')); p.me.xpPenalties = true;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(500);
await endSupport();
const leftover = await days();
check('14: unchecked support-only tasks leave no trace in the task list',
  !(await prof()).tasks.some(t => ['fl_protein', 'fl_steps'].includes(t.id)));
check('14: they cannot be penalised later — the rows no longer exist',
  Object.values(leftover).every(r => !('fl_protein' in (r.tasks || {})) || r.tasks.fl_protein === true));

// Custom support task.
await seed({
  supportStart: offset(-5), loggedDays: 6,
  tasks: [...TASKS, { id: 'task_custom1', name: 'My own support habit', xp: 12, source: 'custom', order: 6, challenges: ['support'] }],
});
await endSupport();
check('15: a custom SUPPORT task is removed with the challenge',
  !(await prof()).tasks.some(t => t.id === 'task_custom1'));
check('15: it is preserved in the support archive',
  ((await arch()).find(x => x.lane === 'support')?.tasks || []).some(t => t.id === 'task_custom1'));

// ══ 24: backup/restore preserves the ended-early archive ═════════════════
const backup = await page.evaluate(() => {
  const keys = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
  const out = {}; for (const k of keys) { const v = localStorage.getItem(k); if (v != null) out[k] = v; }
  return out;
});
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(800);      // profile selector, no dashboard
await page.evaluate((b) => { for (const [k, v] of Object.entries(b)) localStorage.setItem(k, v); }, backup);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(500);
const restored = (await arch()).find(x => x.lane === 'support');
check('24: the ended-early support archive survives backup/restore',
  !!restored && restored.endedEarly === true && restored.endReason === 'ended_early');
check('24: its honest day count survives', restored.daysActive === 6, String(restored?.daysActive));
check('24: the primary is still primary-only after restore',
  (await prof()).activeChallenge?.templateId === 'mental_training_phase' && !(await prof()).supportChallenge);

// ══ 25: profile isolation ════════════════════════════════════════════════
await seed({ profileId: 'me' });
await page.evaluate((today) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.challengeStart = today;
  p.girlfriend.activeChallenge = { templateId: 'energy_reset_10_day', name: 'Energy Reset', emoji: '⚡', durationDays: 10 };
  p.girlfriend.supportChallenge = { templateId: 'sleep_reset_challenge', name: 'Sleep Reset Challenge', emoji: '😴', durationDays: 14 };
  p.girlfriend.supportChallengeStart = today;
  p.girlfriend.tasks = [{ id: 'er_sleep', name: 'Sleep', xp: 40, source: 'template', order: 0, challenges: ['primary', 'support'] }];
  localStorage.setItem('profiles', JSON.stringify(p));
}, TODAY);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
const gfBefore = JSON.stringify(await prof('girlfriend'));
const gfArchBefore = (await arch('girlfriend')).length;
await endSupport();
check('25: ending support on Male leaves the Female profile byte-identical',
  JSON.stringify(await prof('girlfriend')) === gfBefore);
check('25: the Female support challenge is still running',
  (await prof('girlfriend')).supportChallenge?.templateId === 'sleep_reset_challenge');
check('25: the Female profile gained no archive entry',
  (await arch('girlfriend')).length === gfArchBefore);

// ══ No runtime errors ════════════════════════════════════════════════════
check('no page errors across the full end-support flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
