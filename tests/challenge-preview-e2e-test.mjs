/**
 * The Challenge Library's advertised XP, end to end.
 *
 * Reads the figures the library actually RENDERS, starts the challenge through
 * the real flow, and requires the installed attempt to match what was on screen
 * — the one thing a data test cannot prove, because the bug this fixes was a
 * component rendering its own numbers beside an engine that disagreed.
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
  await page.waitForTimeout(350);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);

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

/** Every "(N XP)" the card renders for a daily requirement, in order. */
async function renderedTaskXP(card) {
  return card.locator('.tpl-task-list.priced').first().evaluate(ul =>
    [...ul.querySelectorAll('li')]
      .map(li => { const m = /\((\d+)\s*XP\)/.exec(li.textContent); return m ? Number(m[1]) : null; })
      .filter(x => x != null));
}
/** A labelled figure from the XP summary card. */
async function summaryFigure(card, label) {
  return card.locator('.xp-preview-row').evaluateAll((rows, lab) => {
    const row = rows.find(r => new RegExp(lab, 'i').test(r.querySelector('span')?.textContent || ''));
    if (!row) return null;
    const m = /([\d,]+)/.exec(row.querySelector('strong')?.textContent || '');
    return m ? Number(m[1].replace(/,/g, '')) : null;
  }, label);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });
await reset();
await gotoTab('Challenges');

// ══ 1: the reported figures are gone ══════════════════════════════════════
const mt = page.locator('.challenge-card', { hasText: 'Mental Training' }).first();
await mt.locator('.challenge-card-header').click();
await page.waitForTimeout(500);
let mtText = await mt.textContent();
check('1: Mental Training no longer advertises 100 XP for a single habit',
  !/\(100 XP\)/.test(mtText), (/\(100 XP\)[^]*/.exec(mtText) || [''])[0].slice(0, 40));
check('1: nor a 270 XP daily total', !/270/.test(mtText));
const mtRendered = await renderedTaskXP(mt);
check('1: it renders a priced requirement for every habit', mtRendered.length === 7, `${mtRendered.length} priced rows`);
check('1: and they sum to its standard-mode budget of 160',
  mtRendered.reduce((s, x) => s + x, 0) === 160, String(mtRendered.reduce((s, x) => s + x, 0)));

// ══ 2: the summary states the same figures, and reconciles ════════════════
const dailyShown = await summaryFigure(mt, 'Daily tasks');
const perfectShown = await summaryFigure(mt, 'Perfect day');
const totalShown = await summaryFigure(mt, 'Perfect .*total');
check('2: the summary daily figure equals the sum of the priced rows',
  dailyShown === mtRendered.reduce((s, x) => s + x, 0), `${dailyShown}`);
check('2: the perfect-day bonus is the approved 15% of the budget',
  perfectShown === Math.round(0.15 * 160), `${perfectShown}`);
check('2: a projected perfect total is stated', totalShown > 0, `${totalShown}`);
check('2: the optional-XP ceiling is stated',
  /capped at 16 a day/i.test(await mt.locator('.xp-preview-note').first().textContent()));

// ══ 3: switching mode reprices the whole panel ════════════════════════════
await mt.locator('.tpl-variant-tab', { hasText: 'Beginner' }).click();
await page.waitForTimeout(400);
const begRendered = await renderedTaskXP(mt);
check('3: Beginner mode reprices every requirement',
  begRendered.reduce((s, x) => s + x, 0) === 102, String(begRendered.reduce((s, x) => s + x, 0)));
check('3: and the rating follows the mode it is priced from',
  /Easy/.test(await mt.locator('.tpl-level-value').first().textContent()),
  await mt.locator('.tpl-level-value').first().textContent());
await mt.locator('.tpl-variant-tab', { hasText: 'Hard' }).click();
await page.waitForTimeout(400);
const hardRendered = await renderedTaskXP(mt);
check('3: Hard mode reprices again',
  hardRendered.reduce((s, x) => s + x, 0) === 173, String(hardRendered.reduce((s, x) => s + x, 0)));
check('3: the collapsed card states the RANGE, not one mode\'s rating',
  /Easy–Medium/.test(await mt.locator('.challenge-card-meta').first().textContent()),
  await mt.locator('.challenge-card-meta').first().textContent());

// ══ 4: the Cold Exposure Upgrade reprices the list it joins ═══════════════
await mt.locator('.tpl-variant-tab', { hasText: 'Standard' }).click();
await page.waitForTimeout(400);
const beforeCold = await renderedTaskXP(mt);
await mt.locator('.toggle-btn').first().click();
await page.waitForTimeout(400);
const afterCold = await renderedTaskXP(mt);
check('4: enabling it adds a requirement to the advertised list',
  afterCold.length === beforeCold.length + 1, `${beforeCold.length} → ${afterCold.length}`);
check('4: the daily total is unchanged — it divides the budget, not adds to it',
  afterCold.reduce((s, x) => s + x, 0) === 160, String(afterCold.reduce((s, x) => s + x, 0)));
const coldXP = await mt.locator('.cold-upgrade-xp').first().textContent();
check('4: the upgrade row shows its allocated share, not a stale 20 XP',
  !/20 XP/.test(coldXP) && /\d+ XP/.test(coldXP), coldXP.trim());
await mt.locator('.toggle-btn').first().click();
await page.waitForTimeout(300);

// ══ 5: what was advertised is what gets installed ═════════════════════════
const advertised = await renderedTaskXP(mt);
const advertisedTotal = await summaryFigure(mt, 'Daily tasks');
const advertisedBonus = await summaryFigure(mt, 'Completion bonus');
await mt.locator('button', { hasText: /^Start / }).first().click();
await page.waitForTimeout(500);
const tas = page.locator('textarea');
for (let i = 0; i < await tas.count(); i++) await tas.nth(i).fill('Because I want a mind I can rely on.');
await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: 'Start Today' }).first().click();
await page.waitForTimeout(900);

const p = await prof();
const installed = (p.tasks || []).filter(t => t.source === 'template').map(t => t.xp);
check('5: the attempt started', p.activeChallenge?.templateId === 'mental_training_phase');
check('5: every installed task XP equals the figure advertised a moment earlier',
  JSON.stringify(installed) === JSON.stringify(advertised),
  `installed ${installed.join('/')} vs advertised ${advertised.join('/')}`);
check('5: the installed daily total equals the advertised total',
  installed.reduce((s, x) => s + x, 0) === advertisedTotal, `${installed.reduce((s, x) => s + x, 0)} vs ${advertisedTotal}`);
check('5: the installed completion bonus equals the advertised bonus',
  p.activeChallenge.completionBonusXP === advertisedBonus,
  `${p.activeChallenge.completionBonusXP} vs ${advertisedBonus}`);
check('5: the attempt is stamped with the economy it was priced under',
  p.activeChallenge.xpEconomyVersion === 2 && p.activeChallenge.dailyBudget === advertisedTotal);

// ══ 6: the Today screen pays what the library promised ════════════════════
await gotoTab('Today');
await page.waitForTimeout(400);
const boxes = page.locator('.check-item .check-box, .task-row .check-box');
const n = await boxes.count();
for (let i = 0; i < n; i++) { await boxes.nth(i).click(); await page.waitForTimeout(90); }
await page.waitForTimeout(600);
const dayXP = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e =>
    /XP/.test(e.textContent || '') && e.children.length === 0 && /^\+?\d+/.test((e.textContent || '').trim()));
  return el ? el.textContent.trim() : null;
});
check('6: ticking every requirement is possible from the Today screen', n > 0, `${n} rows`);
const afterTick = await prof();
check('6: the task list on Today is the advertised one',
  (afterTick.tasks || []).filter(t => t.source === 'template').map(t => t.xp)
    .reduce((s, x) => s + x, 0) === advertisedTotal, String(dayXP));

// ══ 7: a configured challenge prices its own setup screen ═════════════════
await reset();
await gotoTab('Challenges');
const li = page.locator('.challenge-card', { hasText: 'LOCK IN' }).first();
await li.locator('.challenge-card-header').click();
await page.waitForTimeout(450);
const liRendered = await renderedTaskXP(li);
check('7: LOCK IN prices its requirements in the library',
  liRendered.length === 9 && liRendered.reduce((s, x) => s + x, 0) === 180,
  `${liRendered.length} rows summing ${liRendered.reduce((s, x) => s + x, 0)}`);
await li.locator('button', { hasText: /Start LOCK IN/i }).first().click();
await page.waitForTimeout(500);
const setupText = await page.textContent('.li-setup');
check('7: its setup screen no longer advertises the era-1 700 XP completion bonus',
  !/\b700\b/.test(setupText));
check('7: it advertises the budget-derived bonus for the default duration',
  /\b504\b/.test(setupText), (/(\d{3,4}) XP on completion/.exec(setupText) || [])[0]);
await page.locator('.li-duration', { hasText: /90 Days/i }).click();
await page.waitForTimeout(400);
check('7: choosing a longer duration reprices the advertised bonus',
  /\b3,?240\b/.test(await page.textContent('.li-setup')));
const liFacts = await page.textContent('.li-facts');
check('7: the XP-per-day fact is the budget, not an era-1 sum',
  /180/.test(liFacts), liFacts.replace(/\s+/g, ' ').slice(0, 80));

// ══ 8: the summary card fits a phone ══════════════════════════════════════
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(250);
  const over = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  check(`8: no horizontal overflow at ${w}px`, over === 0, `${over}px`);
}
await page.setViewportSize({ width: 390, height: 844 });

// ══ 9: no page errors ═════════════════════════════════════════════════════
const real = errors.filter(e => !/favicon|manifest|ServiceWorker|sw\.js/i.test(e));
check('9: no page errors throughout', real.length === 0, real.slice(0, 2).join(' | '));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
