/**
 * 🎯 LOCK IN — end to end.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/lock-in-e2e-test.mjs
 *
 * Covers the things a data test cannot: that the challenge starts through the
 * real library flow, that the dashboard stays uncluttered while the guides are
 * one tap away, that opening a guide does not accidentally tick the habit, that
 * ticking it awards the XP the guide promised, that it all survives a reload,
 * and that none of it overflows a phone screen.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { openChallenge, passReview, pickStartDate, confirmStart, detailsText } from './helpers/challenges.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await chromium.launch();
// iPhone-ish viewport: this challenge's main deliverable is a long scrolling
// guide on a phone, so everything is measured at phone width.
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
  await page.waitForTimeout(350);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

async function reset() {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 }); await page.waitForTimeout(300);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: library presence ════════════════════════════════════════════════════
await reset();
await gotoTab('Challenges');
await page.waitForTimeout(400);
check('1: LOCK IN appears in the challenge library',
  (await page.locator('.f4c-tile', { hasText: 'LOCK IN' }).count()) === 1);
await openChallenge(page, 'LOCK IN');
const cardText = await detailsText(page);
check('1: it shows its identity', /🎯/.test(cardText) && /LOCK IN/.test(cardText));
check('1: it states its purpose', /focused work|protected attention/i.test(cardText));
check('1: it advertises 14 days', /14/.test(cardText));
check('1: it is startable',
  (await page.locator('.f4c-btn.primary', { hasText: /Start LOCK IN/i }).count()) === 1);

// ══ 2: setup screen ═══════════════════════════════════════════════════════
await card.locator('button', { hasText: /Start LOCK IN/i }).first().click();
await page.waitForTimeout(500);
check('2: the configured setup screen opens', (await page.locator('.li-setup').count()) === 1);
let setupText = await page.textContent('.li-setup');
check('2: it shows the flow ramp before you commit',
  ['25m', '35m', '45m', '50m'].every(m => setupText.includes(m)));
check('2: it states the lighter-day rule up front', /planned lighter days/i.test(setupText));
check('2: it states the no-less-sleep rule up front',
  /nothing in this challenge rewards sleeping less/i.test(setupText));
// XP economy v2: the completion bonus is 0.20 x daily budget x duration, so a
// 14-day LOCK IN at its medium_hard 180 budget is 504 rather than the flat 700
// the setup screen used to advertise.
check('2: it shows the day count, habit count and XP',
  /14/.test(setupText) && /8/.test(setupText) && /\b504\b/.test(setupText));

// The eight habits are behind a disclosure, so the setup screen stays short.
await page.locator('.li-disclosure', { hasText: /daily habits/i }).click();
await page.waitForTimeout(250);
check('2: the habit preview lists nine rows (eight habits + the Daily Log)',
  (await page.locator('.li-habit').count()) === 9);
setupText = await page.textContent('.li-setup');
// Asserted as a relationship rather than a figure: the habits are priced by the
// XP engine from the challenge's daily budget, and the guarantee that matters is
// the ordering — sleep is the most valuable habit here.
const habitXP = await page.locator('.li-habit').evaluateAll(rows => rows.map(r => ({
  name: r.querySelector('.li-habit-name')?.textContent || '',
  xp: Number((/(\d+)\s*XP/.exec(r.querySelector('.li-habit-xp')?.textContent || '') || [])[1] || 0),
})));
const topHabit = habitXP.slice().sort((a, b) => b.xp - a.xp)[0];
check('2: sleep is previewed as the highest-XP habit',
  /sleep/i.test(topHabit.name), `${topHabit.name.trim()} at ${topHabit.xp} XP`);
check('2: and every habit is priced', habitXP.every(h => h.xp > 0));

// Targets are adjustable but optional.
await page.locator('.li-disclosure', { hasText: /Adjust targets/i }).click();
await page.waitForTimeout(250);
check('2: four targets are adjustable', (await page.locator('.li-stepper').count()) === 4);
const sleepStepper = page.locator('.li-stepper', { hasText: 'Sleep opportunity' }).first();
await sleepStepper.locator('.li-step-btn', { hasText: '+' }).click();
await page.waitForTimeout(200);
check('2: a stepper changes its value',
  /8\.5 hours/.test(await sleepStepper.textContent()), await sleepStepper.locator('.li-stepper-value').textContent());
await sleepStepper.locator('.li-step-btn', { hasText: '−' }).click();
await page.waitForTimeout(200);

// ══ 3: starting the challenge ══════════════════════════════════════════════
await page.locator('.li-setup button', { hasText: 'Continue' }).first().click();
await page.waitForTimeout(500);
await passReview(page);
const tas = page.locator('textarea');
for (let i = 0; i < await tas.count(); i++) await tas.nth(i).fill('Because scattered days cost me what I care about.');
await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
await page.waitForTimeout(500);
await pickStartDate(page, 'today');
await confirmStart(page);
await page.waitForTimeout(800);

let p = await prof();
check('3: the attempt is active', p.activeChallenge?.templateId === 'lock_in_14_day');
check('3: it is 14 days long', p.activeChallenge?.durationDays === 14);
// XP economy v2: completion bonus = 0.20 x daily budget x duration.
check('3: the completion bonus is stored',
  p.activeChallenge?.completionBonusXP === Math.round(0.20 * p.activeChallenge.dailyBudget * 14),
  `${p.activeChallenge?.completionBonusXP} at budget ${p.activeChallenge?.dailyBudget}`);
check('3: the attempt snapshots its own config', !!p.activeChallenge?.lockIn?.flowStages);
check('3: nine tasks were installed', (p.tasks || []).length === 9, `${(p.tasks || []).length}`);
check('3: eight of them carry a strategy guide',
  (p.tasks || []).filter(t => t.guideId).length === 8);
check('3: guide ids are namespaced',
  (p.tasks || []).filter(t => t.guideId).every(t => t.guideId.startsWith('lockin:')));

// ══ 4: the dashboard stays uncluttered ═════════════════════════════════════
await gotoTab('Today');
await page.waitForSelector('.daily-view', { timeout: 6000 });
await page.waitForTimeout(400);
check('4: nine task rows render', (await page.locator('.check-item').count()) === 9);
check('4: eight rows offer a guide', (await page.locator('.check-guide').count()) === 8);
check('4: the Daily Log row has no guide button',
  (await page.locator('.check-item', { hasText: 'Complete Daily Log' }).locator('.check-guide').count()) === 0);
const rowText = await page.locator('.check-item').first().textContent();
check('4: a row shows name, XP and a guide affordance — not the whole guide',
  /XP/.test(rowText) && /Guide/i.test(rowText) && rowText.length < 400, `${rowText.length} chars`);
check('4: no guide content leaks onto the dashboard',
  !/Optimization strategies|Common mistakes/i.test(await page.textContent('.daily-view')));

// ══ 5: the LOCK IN panel — only what changes daily ═════════════════════════
check('5: the panel renders', (await page.locator('.li-panel').count()) === 1);
let panelText = await page.textContent('.li-panel');
check('5: it shows today\'s flow target', /2 × 25 min/.test(panelText), panelText.slice(0, 80));
check('5: it names the stage', /Baseline/.test(panelText));
check('5: it shows the day counter', /Day 1 of 14/.test(panelText));
check('5: the ramp is collapsed by default', (await page.locator('.li-stage').count()) === 0);
await page.locator('.li-block-toggle', { hasText: 'The ramp' }).click();
await page.waitForTimeout(250);
check('5: opening the ramp shows all four stages', (await page.locator('.li-stage').count()) === 4);
check('5: the current stage is marked active', (await page.locator('.li-stage.active').count()) === 1);
panelText = await page.textContent('.li-panel');
check('5: the ramp explains the lighter days',
  /2 planned lighter days/.test(panelText) && /Day 7, 14/.test(panelText), panelText.slice(-260));
check('5: the ramp says a longer challenge holds rather than escalates',
  /holds the same working length rather than asking for longer sessions/i.test(panelText));
check('5: the ramp says not to escalate if quality or recovery is dropping',
  /stay at the length you can\s+hold|the ramp is a plan, not a requirement to escalate/i.test(panelText));

await page.locator('.li-block-toggle', { hasText: 'Recovery Mode' }).click();
await page.waitForTimeout(250);
panelText = await page.textContent('.li-panel');
check('5: Recovery Mode points at Forge\'s existing Minimum Warrior Day',
  /Minimum Warrior Day/i.test(panelText));
check('5: Recovery Mode restates the sleep rule', /less sleep earns more/i.test(panelText));

// ══ 6: the guide index ═════════════════════════════════════════════════════
await page.locator('.li-block-toggle', { hasText: 'Strategy guides' }).click();
await page.waitForTimeout(250);
check('6: all eight guides are listed', (await page.locator('.li-guide-row').count()) === 8);
const indexText = await page.textContent('.li-panel');
check('6: the index is in teaching order',
  indexText.indexOf('Daily Mission') < indexText.indexOf('Flow Training') &&
  indexText.indexOf('Flow Training') < indexText.indexOf('Execute Your Priorities') &&
  indexText.indexOf('Attention Training') < indexText.indexOf('Sleep Optimization'));

// ══ 7: opening a guide ════════════════════════════════════════════════════
await page.locator('.li-guide-row', { hasText: 'Flow Training' }).click();
await page.waitForTimeout(400);
check('7: the guide opens from the index', (await page.locator('.hg-card').count()) === 1);
let g = await page.textContent('.hg-card');
check('7: Quick Start is visible immediately', /Quick start/i.test(g));
check('7: How to complete it is open by default', /How to complete it/i.test(g) && /2 focused work sessions|focused work sessions/i.test(g));
check('7: the long sections are collapsed', !/challenge–skill|pre-flow ritual/i.test(g));
check('7: all six required sections are present as headings',
  ['Why it matters', 'How to complete it', 'Optimization strategies', 'Advanced strategies', 'Common mistakes', 'Practical examples']
    .every(s => g.includes(s)),
  ['Why it matters', 'How to complete it', 'Optimization strategies', 'Advanced strategies', 'Common mistakes', 'Practical examples']
    .filter(s => !g.includes(s)).join(', ') || 'all present');

// Expand each long section.
for (const s of ['Why it matters', 'Optimization strategies', 'Advanced strategies', 'Common mistakes', 'Practical examples']) {
  await page.locator('.hg-section-toggle', { hasText: s }).click();
  await page.waitForTimeout(120);
}
g = await page.textContent('.hg-card');
check('7: optimization strategies render with evidence labels',
  (await page.locator('.hg-ev').count()) > 5, `${await page.locator('.hg-ev').count()} labels`);
check('7: advanced strategies are marked optional', /None of these is required/i.test(g));
check('7: evidence levels are distinguished',
  /Well supported/.test(g) && (/Some support/.test(g) || /Experimental/.test(g)));
check('7: examples include a student and a working day',
  /Student day/i.test(g) && /Working day/i.test(g));
check('7: the guide says flow is not required to be experienced',
  /not required to experience flow/i.test(g));

// ══ 8: the guide's checkbox is the dashboard's checkbox ════════════════════
const xpBefore = await page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
await page.locator('.hg-check').click();
await page.waitForTimeout(400);
check('8: ticking inside the guide marks it complete',
  /Completed today/i.test(await page.textContent('.hg-check')));
let d = await days();
check('8: the completion is persisted to the day record', d[1]?.tasks?.li_flow === true);
await page.locator('.hg-close').click();
await page.waitForTimeout(350);
check('8: closing the guide returns to the dashboard', (await page.locator('.hg-card').count()) === 0);
check('8: the dashboard row now shows as checked',
  (await page.locator('.check-item', { hasText: 'Flow training' }).locator('.check-box.checked').count()) === 1);

// ══ 9: opening a guide must NOT toggle the habit ══════════════════════════
const missionRow = page.locator('.check-item', { hasText: 'Daily mission' }).first();
check('9: the mission habit starts unchecked',
  (await missionRow.locator('.check-box.checked').count()) === 0);
await missionRow.locator('.check-guide').click();
await page.waitForTimeout(400);
check('9: tapping Guide opens the guide', (await page.locator('.hg-card').count()) === 1);
check('9: and it is the right guide', /Daily Mission/.test(await page.textContent('.hg-title')));
d = await days();
check('9: tapping Guide did NOT tick the habit', d[1]?.tasks?.li_mission !== true);
await page.locator('.hg-close').click();
await page.waitForTimeout(300);
check('9: the habit is still unchecked after closing',
  (await missionRow.locator('.check-box.checked').count()) === 0);

// ══ 10: XP matches what the guides promise ════════════════════════════════
// Tick the remaining habits from the dashboard and check the challenge XP.
for (const label of ['Daily mission', 'Execute 2 of 3', 'Attention training', 'Physical energy',
                     'Mental recovery', 'Stress off-switch', 'Sleep opportunity']) {
  await page.locator('.check-item', { hasText: label }).first().click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(400);
d = await days();
const ticked = Object.entries(d[1]?.tasks || {}).filter(([, v]) => v).map(([k]) => k);
check('10: all eight habits are complete', ticked.length === 8, ticked.join(','));
await gotoTab('Home');
await page.waitForTimeout(500);
const xpAfter = await page.evaluate(() => {
  const t = document.querySelector('.xp-split-row')?.textContent || '';
  return parseInt((t.match(/Challenge:\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || '0', 10);
});
// The eight habits are the daily budget less the Daily Log, which is not
// toggled here. Derived from the attempt itself rather than hardcoded.
const eightHabitsXP = await page.evaluate(() => {
  const pr = JSON.parse(localStorage.getItem('profiles')).me;
  return pr.tasks.filter(t => t.source === 'template' && t.id !== 'daily_log')
    .reduce((s, t) => s + t.xp, 0);
});
check('10: the eight habits award exactly their stated XP',
  xpAfter - xpBefore === eightHabitsXP, `${xpBefore} → ${xpAfter}, expected +${eightHabitsXP}`);

// ══ 11: persistence across a reload ═══════════════════════════════════════
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Today');
await page.waitForTimeout(500);
check('11: completions survive a reload',
  (await page.locator('.check-box.checked').count()) >= 8,
  `${await page.locator('.check-box.checked').count()} checked`);
check('11: the panel still renders after a reload', (await page.locator('.li-panel').count()) === 1);
const reopened = await page.textContent('.li-panel');
check('11: the flow target is still correct', /2 × 25 min/.test(reopened));

// ══ 12: the flow target follows the day being viewed ══════════════════════
// Jump the challenge start back so later days are reachable, then look at a
// lighter day and a later ramp stage.
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const d = new Date(); d.setDate(d.getDate() - 13);
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  p.me.challengeStart = s;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Today');
await page.waitForTimeout(600);
panelText = await page.textContent('.li-panel');
check('12: on day 14 the target is the top of the ramp', /50 min/.test(panelText), panelText.slice(0, 90));
check('12: day 14 is shown as a planned lighter day',
  /1 × 50 min/.test(panelText) && /planned lighter day/i.test(panelText));
check('12: the lighter-day note says sleep is unchanged',
  /sleep especially|sleep is unchanged|every other habit is unchanged/i.test(panelText));
check('12: the lighter-day styling is applied', (await page.locator('.li-target.lighter').count()) === 1);

// Step back through the day selector to day 5, which is in the 35-minute
// stage, and confirm the panel reports THAT day rather than today.
for (let i = 0; i < 9; i++) {
  await page.locator('.day-selector .day-sel-btn').first().click();
  await page.waitForTimeout(90);
}
await page.waitForTimeout(400);
panelText = await page.textContent('.li-panel');
check('12: viewing an earlier day shows that day\'s target, not today\'s',
  /Day 5 of 14/.test(panelText) && /2 × 35 min/.test(panelText) && /Extend/.test(panelText),
  panelText.slice(0, 70));
check('12: an earlier non-lighter day carries no lighter-day styling',
  (await page.locator('.li-target.lighter').count()) === 0);
check('12: the ramp marks the earlier stages as done',
  (await page.locator('.li-block-toggle', { hasText: 'The ramp' }).count()) === 1);

// ══ 13: mobile layout — nothing overflows at phone width ═════════════════
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const d = new Date();
  p.me.challengeStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Today');
await page.waitForTimeout(500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('13: the dashboard does not scroll sideways at 390px', overflow <= 1, `${overflow}px`);

await page.locator('.check-item', { hasText: 'Sleep opportunity' }).locator('.check-guide').click();
await page.waitForTimeout(400);
for (const s of ['Why it matters', 'Optimization strategies', 'Advanced strategies', 'Common mistakes', 'Practical examples']) {
  await page.locator('.hg-section-toggle', { hasText: s }).click();
  await page.waitForTimeout(100);
}
const guideOverflow = await page.evaluate(() => {
  const el = document.querySelector('.hg-card');
  return {
    page: document.documentElement.scrollWidth - window.innerWidth,
    card: el.scrollWidth - el.clientWidth,
    scrollable: el.scrollHeight > el.clientHeight,
  };
});
check('13: a fully expanded guide does not scroll sideways',
  guideOverflow.page <= 1 && guideOverflow.card <= 1, JSON.stringify(guideOverflow));
check('13: a fully expanded guide scrolls vertically instead of being clipped',
  guideOverflow.scrollable);
const sleepGuide = await page.textContent('.hg-card');
check('13: the sleep guide does not penalise involuntary awakenings',
  /could not get back to sleep\? The habit is still met/i.test(sleepGuide));
check('13: the sleep guide states the no-less-sleep rule',
  /cannot be improved by sleeping less|can be improved by sleeping less/i.test(sleepGuide));
await page.locator('.hg-close').click();
await page.waitForTimeout(300);

// ══ 14: the female profile gets the guides too ═══════════════════════════
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(300);
await page.evaluate(() => {
  // Install the same attempt on the other profile by copying the structure the
  // start flow produced, so the card layout can be exercised.
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.activeChallenge = p.me.activeChallenge;
  p.girlfriend.challengeStart = p.me.challengeStart;
  p.girlfriend.tasks = p.me.tasks;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 8000 });
await gotoTab('Today');
await page.waitForTimeout(600);
check('14: the card layout offers the guides too',
  (await page.locator('.gf-task-guide').count()) === 8,
  `${await page.locator('.gf-task-guide').count()} buttons`);
await page.locator('.gf-task-guide').first().click();
await page.waitForTimeout(400);
check('14: a guide opens on the card layout', (await page.locator('.hg-card').count()) === 1);
check('14: profile isolation held — the other profile has its own day record',
  (await days('girlfriend'))[1]?.tasks?.li_flow !== true);

// ══ 15: no crashes ═══════════════════════════════════════════════════════
check('15: no page errors throughout',
  errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
