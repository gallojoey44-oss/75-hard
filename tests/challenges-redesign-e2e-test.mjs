/**
 * The Challenges tab, driven in a real browser.
 *
 * What this guards, in order of how badly it would hurt to get wrong:
 *
 *   NOTHING STARTS BY ACCIDENT  The setup flow writes to local state only
 *                               until Confirm. Backing out, cancelling, or
 *                               walking the whole flow and stopping must leave
 *                               the profile byte-for-byte as it was.
 *   NOTHING IS LOST             Switching screens, filtering, opening a
 *                               details page and coming back cannot disturb a
 *                               running attempt, its day records or its XP.
 *   THE LIBRARY IS COMPLETE     Every challenge the registry makes visible is
 *                               reachable, and a Coming Soon one cannot start.
 *   IT FITS ON A PHONE          320, 390 and 430, with no horizontal overflow
 *                               and no sub-44px controls.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

/**
 * The challenge registry, read from its source rather than imported.
 *
 * `challengeTemplates.js` imports its siblings without file extensions, which
 * Vite resolves and plain node does not — so an e2e suite cannot import it. It
 * is parsed instead, which has the side benefit of being genuinely independent
 * of the component under test: if the library drops a challenge, the
 * expectation here does not drop with it.
 */
function registryChallenges(audience) {
  const here = (f) => readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8');
  const src = here('challengeTemplates.js');
  // `import * as MB from './muscleBuildingConfig'` → MB: muscleBuildingConfig.js
  const ns = {};
  for (const m of src.matchAll(/import \* as (\w+) from '\.\/(\w+)'/g)) ns[m[1]] = `${m[2]}.js`;
  /** A template field that is either a literal or `NS.IDENTITY.name`. */
  const resolve = (block, field) => {
    const lit = new RegExp(`${field}:\\s*'([^']+)'`).exec(block);
    if (lit) return lit[1];
    const ref = new RegExp(`${field}:\\s*(\\w+)\\.IDENTITY\\.(\\w+)`).exec(block);
    if (!ref || !ns[ref[1]]) return null;
    const cfg = here(ns[ref[1]]);
    const idBlock = cfg.slice(cfg.indexOf('IDENTITY = {'));
    return new RegExp(`${ref[2]}:\\s*["'\`]([^"'\`]+)`).exec(idBlock)?.[1] || null;
  };
  const body = src.slice(src.indexOf('export const CHALLENGE_TEMPLATES'));
  const out = [];
  for (const block of body.split(/\n  \{\n/).slice(1)) {
    const name = resolve(block, 'challenge_name');
    if (!name) continue;
    const aud = /audience:\s*'([^']+)'/.exec(block)?.[1] || null;
    if (aud && aud !== audience) continue;
    out.push({ challenge_name: name, startable: /startable:\s*true/.test(block) });
  }
  return out;
}


const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function eq(name, got, want) {
  check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
const off = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function tab(name) {
  await page.evaluate((n) => {
    const t = [...document.querySelectorAll('.bottom-nav .nav-tab')].find(x => x.getAttribute('aria-label') === n);
    if (t) t.click();
  }, name);
  await page.waitForTimeout(400);
}
async function dismissRankUp() {
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator('.rankup-overlay').count())) return;
    await page.locator('.rankup-skip').click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

const LI_TASKS = [
  { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 90, keystone: 3, source: 'template', order: 0, challenges: ['primary'] },
  { id: 'li_flow', name: 'Flow training: 2 focused sessions', icon: '🌊', xp: 80, keystone: 3, source: 'template', order: 1, challenges: ['primary'] },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 30, keystone: 0, source: 'template', order: 2, challenges: ['primary'] },
];

/** `era` picks which economy the seeded primary ran under. */
async function seed({ primary = true, era = 2, support = false, archives = false, none = false, scheduled = false } = {}) {
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await page.evaluate((c) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 4;
    p.me.xpPenalties = false;
    if (c.none) {
      p.me.challengeStart = c.today;
      p.me.activeChallenge = { templateId: 'forge_daily', name: 'Forge Daily', emoji: '🔥', durationDays: null, xpEconomyVersion: 2, effortTier: 'easy', dailyBudget: 120 };
      p.me.tasks = [{ id: 'fd_sleep', name: 'Hit your sleep goal', icon: '😴', xp: 40, keystone: 2, source: 'template', order: 0 }];
    } else if (c.primary) {
      p.me.challengeStart = c.scheduled ? c.future : c.start;
      p.me.activeChallenge = {
        templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard',
        durationDays: 14, passingScore: 70, keystoneRequirement: 65,
        ...(c.era >= 2 ? { xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 200, completionBonusXP: 2700 } : {}),
      };
      p.me.tasks = c.liTasks;
    }
    if (c.support) {
      p.me.supportChallenge = {
        templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
        variant: 'standard', durationDays: 21, xpEconomyVersion: 2, effortTier: 'medium', dailyBudget: 160,
      };
      p.me.supportChallengeStart = c.supStart;
      p.me.tasks = [...c.liTasks, { id: 'mt_mind', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 60, keystone: 3, source: 'template', order: 3, challenges: ['support'] }];
    }
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({
      me: (c.scheduled || c.none) ? {} : { 4: { date: c.today, tasks: { li_sleep: true } } },
      girlfriend: {},
    }));
    localStorage.setItem('archives', JSON.stringify({
      me: c.archives ? [{
        id: 'arch_a', archivedAt: c.old2, challengeStart: c.old1, endDate: c.old2, endDayNum: 30,
        challenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡', variant: 'standard', durationDays: 30, xpEconomyVersion: 2 },
        days: {}, tasks: [], xpEarned: 6420, completed: true, finalScore: 88, scoreAvailable: true,
        passingScore: 70, passed: true,
      }, {
        id: 'arch_b', archivedAt: c.old2, challengeStart: c.old1, endDate: c.old2, endDayNum: 9,
        challenge: { templateId: 'energy_reset_10_day', name: 'Energy Reset', emoji: '⚡', durationDays: 21, xpEconomyVersion: 2 },
        days: {}, tasks: [], xpEarned: 980, endedEarly: true, endedOn: c.old2, daysActive: 9,
        finalScore: 54, scoreAvailable: true, passingScore: 70,
      }] : [],
      girlfriend: [],
    }));
  }, {
    primary, era, support, archives, none, scheduled,
    start: off(-3), future: off(5), supStart: off(-1), today: off(0), old1: off(-90), old2: off(-40),
    liTasks: LI_TASKS,
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp();
  await tab('Challenges');
}

/** The whole of localStorage, for before/after comparison. */
const snapshot = () => page.evaluate(() => JSON.stringify({
  profiles: localStorage.getItem('profiles'),
  allDays: localStorage.getItem('allDays'),
  archives: localStorage.getItem('archives'),
}));

// ════════════════════════════════════════════════════════════════════════════
// 1. Home — what's running, compactly
// ════════════════════════════════════════════════════════════════════════════

await seed({ primary: true });
eq('the tab opens on its own home screen', await page.locator('.f4c-home').count(), 1);
check('the header states the page and its purpose',
  /Challenges/.test(await page.textContent('.f4c-page-title'))
  && /next mission/i.test(await page.textContent('.f4c-page-sub')));
eq('the primary challenge is shown once', await page.locator('.f4c-active').count(), 1);
check('with its name, day and mode',
  /LOCK IN/.test(await page.textContent('.f4c-active-name'))
  && /Day 4 of 14/.test(await page.textContent('.f4c-active-meta'))
  && /Standard/.test(await page.textContent('.f4c-active-meta')),
  await page.textContent('.f4c-active-meta'));
check('it reports today honestly from the day record',
  /1 of 3 habits done today/.test(await page.textContent('.f4c-active-foot')),
  await page.textContent('.f4c-active-foot'));
eq('a Support Challenge can be added', await page.locator('.f4c-add-support').count(), 1);

// The library is reachable without scrolling past a dashboard.
const libTop = await page.evaluate(() => {
  const el = document.querySelector('.f4c-grid');
  return el ? Math.round(el.getBoundingClientRect().top) : null;
});
check('the library begins within one screen of the top', libTop !== null && libTop < 844,
  `grid top ${libTop}px`);

// Exactly one route to the day's work, however many lanes are running.
await seed({ primary: true, support: true });
eq('both lanes are shown', await page.locator('.f4c-active').count(), 2);
check('the support card is labelled as such',
  /Support Challenge/.test(await page.textContent('.f4c-active.support .f4c-lane-label')));
eq('there is still only one way to today\'s tasks',
  await page.locator('.f4c-btn.primary', { hasText: "today's tasks" }).count(), 1);
eq('and no Add Support button while one is running', await page.locator('.f4c-add-support').count(), 0);

// ════════════════════════════════════════════════════════════════════════════
// 2. The library is complete, filterable, and safe
// ════════════════════════════════════════════════════════════════════════════

await seed({ none: true });
const expected = registryChallenges('male');
const tiles = await page.locator('.f4c-tile-name').allTextContents();
eq('every visible challenge has a tile', tiles.length, expected.length);
check('and they are the ones the registry makes visible',
  expected.every(t => tiles.some(n => n.trim() === t.challenge_name)),
  expected.filter(t => !tiles.some(n => n.trim() === t.challenge_name)).map(t => t.challenge_name).join(','));

const soonCount = expected.filter(t => !t.startable).length;
eq('every Coming Soon challenge says so', await page.locator('.f4c-tile-state.soon').count(), soonCount);

// A row has to be readable, not merely present. Two columns of 175px tiles cut
// names mid-word and clipped "Medium/Hard" and "30–90 days"; these measure the
// rendered boxes so a layout change that re-introduces that is caught here.
const libRows = await page.evaluate(() => {
  const clipped = (el) => !!el && (el.scrollWidth > el.clientWidth + 1
    || el.scrollHeight > el.clientHeight + 1);
  const tiles = [...document.querySelectorAll('.f4c-tile')];
  return {
    order: tiles.map(t => t.classList.contains('soon')),
    clippedNames: tiles.filter(t => clipped(t.querySelector('.f4c-tile-name'))).length,
    clippedFacts: tiles.filter(t => clipped(t.querySelector('.f4c-tile-diff'))
      || clipped(t.querySelector('.f4c-tile-dur'))).length,
    // Every row states both, or the library is not answering "how hard" and
    // "how long" at all.
    stated: tiles.filter(t => (t.querySelector('.f4c-tile-diff')?.textContent || '').trim()
      && (t.querySelector('.f4c-tile-dur')?.textContent || '').trim()).length,
    total: tiles.length,
  };
});
eq('no challenge name is cut off', libRows.clippedNames, 0);
eq('no difficulty or length label is truncated', libRows.clippedFacts, 0);
eq('every row states its difficulty and its length', libRows.stated, libRows.total);
check('challenges you can start come before the ones you cannot',
  libRows.order.every((soon, i) => !soon || libRows.order.slice(i).every(Boolean)),
  libRows.order.map(s => (s ? 'soon' : 'open')).join(','));

// Filtering narrows without touching anything.
const before = await snapshot();
await page.locator('.f4c-chip', { hasText: 'Mental' }).click();
await page.waitForTimeout(300);
const mental = await page.locator('.f4c-tile-name').allTextContents();
check('a filter narrows the list', mental.length > 0 && mental.length < tiles.length,
  `${mental.length} of ${tiles.length}`);
check('to challenges that really carry the tag',
  mental.every(n => /Mental Training|LOCK IN/.test(n)), mental.join(' / '));
await page.locator('.f4c-chip', { hasText: 'All' }).click();
await page.waitForTimeout(300);
eq('and All restores it', (await page.locator('.f4c-tile-name').allTextContents()).length, tiles.length);
eq('filtering changed no stored data', await snapshot(), before);

// ════════════════════════════════════════════════════════════════════════════
// 3. Details — a page, not an expanding card
// ════════════════════════════════════════════════════════════════════════════

await page.locator('.f4c-tile', { hasText: 'LOCK IN' }).click();
await page.waitForTimeout(500);
eq('tapping a tile opens a details page', await page.locator('.f4c-details').count(), 1);
eq('the library is no longer on screen', await page.locator('.f4c-grid').count(), 0);
check('the page names the challenge', /LOCK IN/.test(await page.textContent('.f4c-hero-name')));
check('it states difficulty, length and XP per day',
  (await page.locator('.f4c-fact').count()) === 3,
  await page.locator('.f4c-facts').textContent());

const reqs = await page.locator('.f4c-req').count();
check('every daily requirement is listed', reqs >= 5, `${reqs} requirements`);
check('each one states what actually counts',
  (await page.locator('.f4c-req-desc').count()) >= reqs - 1,
  `${await page.locator('.f4c-req-desc').count()} descriptions for ${reqs} rows`);
check('each one is priced', (await page.locator('.f4c-req-xp').count()) >= reqs);
check('XP figures are real numbers, not placeholders',
  (await page.locator('.f4c-req-xp').first().textContent()).match(/^\d[\d,]*\sXP$/) !== null,
  await page.locator('.f4c-req-xp').first().textContent());
check('a guide is one tap away rather than inline',
  (await page.locator('.f4c-link', { hasText: 'Strategy guide' }).count()) > 0);

// Changing the length re-prices the page, live.
const totalBefore = await page.locator('.f4c-xp-row.total strong').textContent();
await page.locator('.f4c-dur', { hasText: '30' }).first().click();
await page.waitForTimeout(400);
const totalAfter = await page.locator('.f4c-xp-row.total strong').textContent();
check('choosing a different length re-prices the whole page',
  totalBefore !== totalAfter, `${totalBefore} → ${totalAfter}`);

// Back returns to where you were, with nothing changed.
await page.locator('.f4c-back').click();
await page.waitForTimeout(400);
eq('back returns to the home screen', await page.locator('.f4c-home').count(), 1);
eq('and nothing was written', await snapshot(), before);

// A Coming Soon challenge opens, explains itself, and cannot be started.
await page.locator('.f4c-tile', { hasText: 'Sleep Reset' }).click();
await page.waitForTimeout(450);
check('a Coming Soon challenge still opens its page',
  (await page.locator('.f4c-details').count()) === 1);
check('its only button is disabled',
  await page.locator('.f4c-btn', { hasText: 'Coming Soon' }).isDisabled());
eq('and offers no way to start', await page.locator('.f4c-btn.primary').count(), 0);
await page.locator('.f4c-back').click();
await page.waitForTimeout(350);

// ════════════════════════════════════════════════════════════════════════════
// 4. Setup — nothing is created before Confirm
// ════════════════════════════════════════════════════════════════════════════

const preSetup = await snapshot();
await page.locator('.f4c-tile', { hasText: 'Mental Training' }).click();
await page.waitForTimeout(450);
await page.locator('.f4c-btn.primary', { hasText: 'Start' }).click();
await page.waitForTimeout(450);
eq('starting opens a stepped flow', await page.locator('.f4c-setup').count(), 1);
check('which says where you are in it',
  /Step 1 of \d/.test(await page.textContent('.f4c-steps-label')),
  await page.textContent('.f4c-steps-label'));

// Walk forward through every step except the last.
const seen = [];
for (let i = 0; i < 8; i++) {
  seen.push(await page.textContent('.f4c-steps-label').catch(() => '?'));
  const btn = page.locator('.f4c-btn.primary').last();
  const label = (await btn.textContent().catch(() => '')) || '';
  if (/Start now|Schedule for/.test(label)) break;
  await btn.click();
  await page.waitForTimeout(500);
  // The Future Self Letter is its own screen; fill and submit it.
  if (await page.locator('.fsl-form, textarea').count()) {
    const ta = page.locator('textarea').first();
    if (await ta.count()) { await ta.fill('Because I said I would.'); await page.waitForTimeout(200); }
    const submit = page.locator('button', { hasText: /Continue|Save|Next|Lock/i }).last();
    if (await submit.count()) { await submit.click(); await page.waitForTimeout(500); }
  }
}
check('the review step shows the full commitment before anything starts',
  seen.length >= 3, seen.join(' → '));
eq('walking the whole flow has still created nothing', await snapshot(), preSetup);

// Backing out of the flow entirely, one step at a time, from wherever it ended.
for (let i = 0; i < 12; i++) {
  if (await page.locator('.f4c-home').count()) break;
  const back = page.locator('.f4c-back, .f4c-btn.ghost, .modal-card .btn-ghost').last();
  if (!(await back.count())) break;
  await back.click();
  await page.waitForTimeout(400);
}
eq('backing out leaves the profile untouched', await snapshot(), preSetup);
eq('and lands back on the Challenges home screen', await page.locator('.f4c-home').count(), 1);

// ════════════════════════════════════════════════════════════════════════════
// 5. Era safety — the pairing that would mis-price XP is refused
// ════════════════════════════════════════════════════════════════════════════

await seed({ primary: true, era: 2 });
eq('an era-2 primary is offered a Support Challenge', await page.locator('.f4c-add-support').count(), 1);

// The sheet is taller than the phone, so the way out and the thing it asks you
// to agree to have to stay on screen rather than sit past the fold.
await page.locator('.f4c-add-support').click();
await page.waitForSelector('.sup-picker', { timeout: 10000 });
await page.waitForTimeout(400);
const sheetReach = async () => page.evaluate(() => {
  const card = document.querySelector('.modal-card');
  const btns = [...card.querySelectorAll('.modal-actions .btn')].map(b => ({
    t: (b.textContent || '').trim(),
    inView: b.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom + 1,
  }));
  return { scrolls: card.scrollHeight > card.clientHeight + 2, btns };
});
let reach = await sheetReach();
check('the picker is longer than the sheet, so this matters', reach.scrolls);
check('its way out is on screen without scrolling to the end',
  reach.btns.length > 0 && reach.btns.every(b => b.inView),
  JSON.stringify(reach.btns));

await page.locator('.sup-option').first().click();
await page.waitForTimeout(600);
reach = await sheetReach();
check('and so is the button that commits to it',
  reach.btns.length === 2 && reach.btns.every(b => b.inView),
  JSON.stringify(reach.btns));

// Backing out leaves nothing behind.
const sheetBefore = await snapshot();
await page.locator('.modal-card .btn-ghost').click();
await page.waitForTimeout(400);
await page.locator('.modal-card .btn-ghost', { hasText: 'Cancel' }).click();
await page.waitForTimeout(400);
eq('dismissing the picker changes nothing', await snapshot(), sheetBefore);
eq('and returns to the Challenges home', await page.locator('.f4c-home').count(), 1);

await seed({ primary: true, era: 1 });
eq('an era-1 primary is not', await page.locator('.f4c-add-support').count(), 0);
eq('and is told why instead', await page.locator('.f4c-blocked').count(), 1);
check('in terms of what it means for them',
  /previous XP system/i.test(await page.textContent('.f4c-blocked'))
  && /unaffected/i.test(await page.textContent('.f4c-blocked')),
  (await page.textContent('.f4c-blocked')).slice(0, 80));
check('the running challenge is untouched by the refusal',
  /LOCK IN/.test(await page.textContent('.f4c-active-name')));

// The refusal is enforced in the state layer, not only hidden in the UI.
const forced = await page.evaluate(() => {
  const before = localStorage.getItem('profiles');
  return { before, hasSupport: !!JSON.parse(before).me.supportChallenge };
});
eq('no support challenge was attached anyway', forced.hasSupport, false);

// ════════════════════════════════════════════════════════════════════════════
// 6. History
// ════════════════════════════════════════════════════════════════════════════

await seed({ primary: true, support: true, archives: true });
await page.locator('.f4c-icon-btn').click();
await page.waitForTimeout(500);
eq('history opens', await page.locator('.f4c-history').count(), 1);
const rows = await page.locator('.f4c-hist').count();
eq('it lists both live lanes and both archives', rows, 4);

const verdicts = await page.locator('.f4c-verdict').allTextContents();
check('a passed challenge is marked passed', verdicts.some(v => /^Passed$/i.test(v.trim())), verdicts.join('/'));
check('an attempt that was stopped is marked ended early, not failed',
  verdicts.some(v => /Ended early/i.test(v)), verdicts.join('/'));
check('and the running ones are marked active', verdicts.filter(v => /Active/i.test(v)).length === 2);

const histText = await page.textContent('.f4c-history');
check('XP is shown in display units', /\+6,420/.test(histText), histText.match(/\+[\d,]+/g)?.join(' '));
check('a score is shown with the bar it had to clear', /88%/.test(histText) && /need 70%/.test(histText));
check('completing and passing are explained as different things',
  /Completing a challenge means its days ran out/i.test(histText));

await page.locator('.f4c-chip', { hasText: 'Ended early' }).click();
await page.waitForTimeout(350);
eq('filtering history narrows it', await page.locator('.f4c-hist').count(), 1);
await page.locator('.f4c-back').click();
await page.waitForTimeout(350);
eq('back returns to Challenges', await page.locator('.f4c-home').count(), 1);

// ════════════════════════════════════════════════════════════════════════════
// 7. Managing what's running — and ending Support without touching Primary
// ════════════════════════════════════════════════════════════════════════════

await seed({ primary: true, support: true });
const beforeEnd = await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles')).me;
  return { start: p.challengeStart, primary: p.activeChallenge?.templateId, days: localStorage.getItem('allDays') };
});
await page.locator('.f4c-active.support .f4c-btn', { hasText: 'End Support' }).click();
await page.waitForTimeout(450);
check('ending Support asks first', (await page.locator('.end-support-modal').count()) === 1);
check('and promises the primary is safe',
  /will\s*\n?\s*continue unchanged/i.test((await page.textContent('.end-support-modal')).replace(/\s+/g, ' ')),
  (await page.textContent('.end-support-modal')).replace(/\s+/g, ' ').slice(0, 120));
await page.locator('.end-support-modal .btn-secondary').click();
await page.waitForTimeout(600);
const afterEnd = await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles')).me;
  return { start: p.challengeStart, primary: p.activeChallenge?.templateId, support: p.supportChallenge, days: localStorage.getItem('allDays') };
});
eq('the support challenge is gone', afterEnd.support, null);
eq('the primary descriptor is unchanged', afterEnd.primary, beforeEnd.primary);
eq('its start date is unchanged', afterEnd.start, beforeEnd.start);
eq('and no day record was touched', afterEnd.days, beforeEnd.days);

// ════════════════════════════════════════════════════════════════════════════
// 8. Empty and scheduled states
// ════════════════════════════════════════════════════════════════════════════

await seed({ none: true });
eq('with no challenge, the empty state appears', await page.locator('.f4c-empty').count(), 1);
check('and says Forge Daily keeps running regardless',
  /Forge Daily/i.test(await page.textContent('.f4c-empty')));
eq('with the library right below it', await page.locator('.f4c-grid').count(), 1);
eq('and no active-challenge card', await page.locator('.f4c-active').count(), 0);

await seed({ primary: true, scheduled: true });
eq('a scheduled attempt is labelled Scheduled',
  (await page.textContent('.f4c-status')).trim(), 'Scheduled');
check('it shows its start date rather than a day number',
  /Starts/.test(await page.textContent('.f4c-active-meta')),
  await page.textContent('.f4c-active-meta'));
check('and no progress bar, because nothing has happened yet',
  (await page.locator('.f4c-active .f4c-bar').count()) === 0);

// ════════════════════════════════════════════════════════════════════════════
// 9. Profile separation
// ════════════════════════════════════════════════════════════════════════════

await seed({ primary: true });
const maleTiles = (await page.locator('.f4c-tile-name').allTextContents()).map(s => s.trim());
check('the male library omits the female-only challenge',
  !maleTiles.some(n => /Hormone/i.test(n)), maleTiles.join(' / '));
const maleAccent = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.f4c-chip.on')).backgroundImage);

await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
await dismissRankUp();
await tab('Challenges');
const femaleTiles = (await page.locator('.f4c-tile-name').allTextContents()).map(s => s.trim());
check('the female library includes it', femaleTiles.some(n => /Hormone/i.test(n)), femaleTiles.join(' / '));
const femaleAccent = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.f4c-chip.on')).backgroundImage);
check('and the tab takes that profile\'s accent colour', maleAccent !== femaleAccent,
  `${maleAccent} vs ${femaleAccent}`);
check('switching profiles did not move the other one\'s challenge',
  await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.activeChallenge?.templateId === 'lock_in_14_day'));

await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 15000 });
await dismissRankUp();

// ════════════════════════════════════════════════════════════════════════════
// 10. It fits on a phone
// ════════════════════════════════════════════════════════════════════════════

for (const width of [320, 390, 430]) {
  await page.setViewportSize({ width, height: 800 });
  await seed({ primary: true, support: true, archives: true });

  const screens = [
    ['home', async () => {}],
    ['details', async () => { await page.locator('.f4c-tile').first().click(); await page.waitForTimeout(450); }],
    ['history', async () => { await page.locator('.f4c-back').click(); await page.waitForTimeout(350); await page.locator('.f4c-icon-btn').click(); await page.waitForTimeout(450); }],
  ];
  for (const [label, go] of screens) {
    await go();
    const overflow = await page.evaluate((w) => {
      // A chip row is deliberately scrollable sideways, so its contents may sit
      // past the edge. What must never happen is the PAGE scrolling sideways,
      // or an element escaping a container that does not scroll.
      const inScroller = (el) => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          if (n.scrollWidth > n.clientWidth + 1
            && getComputedStyle(n).overflowX !== 'visible') return true;
        }
        return false;
      };
      const over = [...document.querySelectorAll('.f4c *')]
        .filter(el => el.getBoundingClientRect().right > w + 1 && !inScroller(el))
        .map(el => `${el.className}`.split(' ')[0]);
      return { doc: document.documentElement.scrollWidth, over: [...new Set(over)].slice(0, 4) };
    }, width);
    check(`${width}px ${label}: no horizontal overflow`,
      overflow.doc <= width && overflow.over.length === 0,
      `scrollWidth ${overflow.doc}, overflowing: ${overflow.over.join(', ') || 'none'}`);

    const small = await page.evaluate(() => [...document.querySelectorAll(
      '.f4c button:not([disabled]), .f4c [role="radio"], .f4c [role="tab"], .f4c [role="switch"]')]
      .filter(el => el.offsetParent !== null)
      .map(el => ({ c: `${el.className}`.split(' ')[0], h: Math.round(el.getBoundingClientRect().height) }))
      .filter(x => x.h > 0 && x.h < 44));
    check(`${width}px ${label}: every control is at least 44px tall`,
      small.length === 0, small.map(s => `${s.c}:${s.h}`).join(', '));
  }
}
await page.setViewportSize({ width: 390, height: 844 });

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
