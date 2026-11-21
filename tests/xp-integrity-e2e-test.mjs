/**
 * XP integrity, end to end: the accounting fixes in the real app, on both
 * profiles.
 *
 * Run against a production build:  npx vite preview --port 4173 --strictPort
 * then:                            node tests/xp-integrity-e2e-test.mjs
 *
 * Bug fixes only. The XP rules are checked first and stay what they were: a
 * fully missed Forge Daily day costs 60 XP with penalties on and nothing with
 * them off. Everything after that checks that the accounting around those
 * rules no longer invents XP or repeats it:
 *
 *   1. Home says Forge Daily is not a challenge, and that it has penalties.
 *   2. Settings no longer says broken streaks cost XP, except on an attempt
 *      that really does charge for them.
 *   3. The missed-day notice shows each day once: 7 days −420, then the next
 *      morning "1 more missed day" −60. Dismissing it moves no XP.
 *   4. Starting a challenge from Forge Daily moves no XP, a deficit included.
 *   5. The rank floor: a gap that reaches the floor, followed by a new
 *      challenge, stays at the floor. It used to jump to 75,420.
 *   6. Retroactive edits and the penalties toggle unwind protection that is no
 *      longer needed.
 *   7. Data stored before the fix reads exactly as it did.
 *   8. Profiles stay independent, and nothing overflows on a phone.
 *   9. A transition never runs twice: a control fired twice in one task,
 *      a real double-click, and both lanes finishing at the same moment.
 *
 * Time is a fake clock (Playwright's), so "the next morning" really is a new
 * day for the app rather than an edited start date.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { openChallenge, backToChallenges, beginSetup, passReview, pickStartDate, confirmStart } from './helpers/challenges.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const DAY = 86400000;
const T0 = new Date(); T0.setHours(12, 0, 0, 0);   // midday: nowhere near a day boundary
let now = new Date(T0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateAt = (n) => iso(new Date(now.getTime() + n * DAY));
const longDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
/** A figure as displayed ("−1,234", "+56", "75,000 XP") as a signed number. */
const num = (s) => {
  const m = String(s ?? '').replace(/[,\s]/g, '').match(/([−+-]?)(\d+)/);
  return m ? (m[1] === '−' || m[1] === '-' ? -1 : 1) * Number(m[2]) : NaN;
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function setNow(d) { now = new Date(d); await page.clock.setFixedTime(now); }
async function reload() {
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function gotoTab(name) {
  await page.evaluate((n) => {
    const t = [...document.querySelectorAll('.bottom-nav .nav-tab')].find(x => x.getAttribute('aria-label') === n);
    if (t) t.click();
  }, name);
  await page.waitForTimeout(400);
}
const store = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);
const prof = async (id = 'me') => (await store('profiles'))[id];
async function split() {
  await gotoTab('Home');
  return page.evaluate(() => {
    const t = document.querySelector('.xp-split-row')?.textContent || '';
    const read = (re) => parseInt((t.match(re) || [])[1]?.replace(/,/g, '') ?? 'NaN', 10);
    return { lifetime: read(/Lifetime:\s*([\d,]+)/), challenge: read(/Challenge:\s*([\d,]+)/) };
  });
}
const lifetimeXP = async () => (await split()).lifetime;
const fdNote = () => page.evaluate(() => {
  const n = document.querySelector('[data-testid="fd-penalty-note"]');
  return n ? { penalties: n.dataset.penalties, text: n.textContent.replace(/\s+/g, ' ').trim() } : null;
});
async function notice() {
  await gotoTab('Home');
  return page.evaluate(() => {
    const c = document.querySelector('.wb-card');
    if (!c) return null;
    const figs = [...c.querySelectorAll('.wb-figure')].map(f => ({
      v: f.querySelector('.wb-figure-value')?.textContent.trim(),
      l: f.querySelector('.wb-figure-label')?.textContent.trim(),
    }));
    return {
      update: c.dataset.update, days: figs[0]?.v, label: figs[0]?.l, xp: figs[1]?.v,
      range: c.querySelector('.wb-range')?.textContent.trim() || '',
      text: c.textContent.replace(/\s+/g, ' '),
    };
  });
}
async function dismissNotice() {
  await page.locator('.wb-dismiss').click();
  await page.waitForTimeout(500);
}
/** XP History, read from Rank Details exactly as a person would open it. */
async function history() {
  await gotoTab('Home');
  await page.evaluate(() => {
    if (!document.querySelector('.rank-details-card')) {
      const b = [...document.querySelectorAll('button')].find(x => /Details/i.test(x.textContent));
      if (b) b.click();
    }
  });
  await page.waitForTimeout(400);
  if (!(await page.locator('.xph-body').count())) {
    await page.locator('.xph-toggle').click();
    await page.waitForTimeout(400);
  }
  return page.evaluate(() => {
    const pairs = (els) => Object.fromEntries([...els].map(r => [r.children[0]?.textContent.trim(), r.children[1]?.textContent.trim()]));
    return {
      totals: pairs(document.querySelectorAll('.xph-total-row')),
      periods: [...document.querySelectorAll('.xph-period')].map(p => ({
        name: p.querySelector('.xph-period-name')?.textContent.trim(),
        rows: pairs(p.querySelectorAll('.xph-period-row')),
      })),
    };
  });
}
/** Total earned − penalties + protection = Current XP, read off the screen. */
const reconciles = (h) => num(h.totals['Total XP earned']) - (num(h.totals['Missed-day penalties']) ? Math.abs(num(h.totals['Missed-day penalties'])) : 0)
  + (num(h.totals['Cancelled by your rank protection']) || 0) === num(h.totals['Current XP']);
async function togglePenalties() {
  await gotoTab('Settings');
  await page.locator('.settings-row', { has: page.locator('[data-testid="xp-penalties-desc"]') })
    .locator('button.toggle-btn').click();
  await page.waitForTimeout(500);
}
/** The person's own route into a challenge: library → details → setup → start. */
async function startFromLibrary(cardName) {
  await gotoTab('Challenges');
  await backToChallenges(page);
  await openChallenge(page, cardName);
  if (await page.locator('.f4c-mode').count()) {
    await page.locator('.f4c-mode').filter({ hasText: /^Standard/ }).first().click();
    await page.waitForTimeout(300);
  }
  await beginSetup(page);
  await passReview(page);
  const tas = page.locator('textarea');
  for (let i = 0, n = await tas.count(); i < n; i++) await tas.nth(i).fill('Because I keep the promises I make to myself.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(500);
  await pickStartDate(page, 'today');
  await confirmStart(page);
  await page.waitForTimeout(700);
}

/** The library route up to, but not including, the final confirmation. */
async function toFinalStep(cardName) {
  await gotoTab('Challenges');
  await backToChallenges(page);
  await openChallenge(page, cardName);
  if (await page.locator('.f4c-mode').count()) {
    await page.locator('.f4c-mode').filter({ hasText: /^Standard/ }).first().click();
    await page.waitForTimeout(300);
  }
  await beginSetup(page);
  await passReview(page);
  const tas = page.locator('textarea');
  for (let i = 0, n = await tas.count(); i < n; i++) await tas.nth(i).fill('Because I keep the promises I make to myself.');
  await page.locator('button', { hasText: /Save.*Begin/i }).first().click();
  await page.waitForTimeout(500);
  await pickStartDate(page, 'today');
}

// The Forge Daily baseline exactly as the app stamps it — captured in section 1
// from the real "Start Forge Daily" button, so every fixture runs its real
// rate card rather than a copy of it.
let FD_META = null;
let FD_TASKS = null;
const FULL = () => Object.fromEntries(FD_TASKS.map(t => [t.id, true]));
/** A completed challenge banked at `xp`, on the current economy. */
const ARCHIVE = (id, xp) => ({
  id, archivedAt: '2026-01-31', challengeStart: '2026-01-01', endDate: '2026-01-30', endDayNum: 30, completed: true,
  challenge: { templateId: 'mental_training_phase', name: 'Mental Training Phase', durationDays: 30, xpEconomyVersion: 2 },
  days: { 1: { dayNumber: 1, tasks: { mt_mind: true } } }, tasks: [{ id: 'mt_mind', xp: 100, keystone: 3 }],
  xpEarned: xp, badges: [], finalScore: 84, scoreAvailable: true, passingScore: 70, passed: true,
});

/** Replace both profiles' XP state; a profile passed as null keeps the app's fresh default. */
async function seed({ me = null, girlfriend = null, active = 'me' }) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await reload();
  await page.evaluate(({ me, girlfriend, active, FD_META, FD_TASKS }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    const allDays = { me: {}, girlfriend: {} };
    const archives = { me: [], girlfriend: [] };
    for (const [id, s] of Object.entries({ me, girlfriend })) {
      if (!s) continue;
      p[id].challengeStart = s.start;
      p[id].activeChallenge = s.meta || FD_META;
      p[id].tasks = s.tasks || FD_TASKS;
      p[id].xpPenalties = s.penalties !== false;
      p[id].xpStartDay = 1;
      p[id].xpOffset = 0;
      if (s.highestRank != null) p[id].highestRank = s.highestRank;
      if (s.ledger) p[id].xpLedger = s.ledger;
      p[id].supportChallenge = s.support ? s.support.meta : null;
      p[id].supportChallengeStart = s.support ? s.support.start : null;
      if (s.highestRank != null) p[id].rankHistory = [];
      allDays[id] = s.days || {};
      archives[id] = s.archives || [];
    }
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify(allDays));
    localStorage.setItem('archives', JSON.stringify(archives));
    localStorage.setItem('activeProfile', JSON.stringify(active));
  }, { me, girlfriend, active, FD_META, FD_TASKS });
  await reload();
}
async function setDays(profile, patch) {
  await page.evaluate(({ profile, patch }) => {
    const a = JSON.parse(localStorage.getItem('allDays'));
    a[profile] = { ...(a[profile] || {}), ...patch };
    localStorage.setItem('allDays', JSON.stringify(a));
  }, { profile, patch });
  await reload();
}

await setNow(T0);
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await reload();

// ══ 1: Home — not a challenge, and not penalty-free either ═════════════════
let note = await fdNote();
check('1: with nothing running, Home says there is no active challenge',
  /No Active Challenge/.test(await page.textContent('.dashboard')));
check('1: …and that Forge Daily, once started, charges for missed days',
  note?.penalties === 'on' && /^Once started, Forge Daily counts missed days while XP Penalties are on/.test(note.text)
    && /a fully missed day costs 60 XP/.test(note.text), note?.text);

await page.locator('button', { hasText: 'Start Forge Daily' }).first().click();
await page.waitForTimeout(800);
({ activeChallenge: FD_META, tasks: FD_TASKS } = await prof());
check('1: starting Forge Daily stamps it on the current economy at 120 XP a day',
  FD_META?.templateId === 'forge_daily' && FD_META.isBaseline && FD_META.xpEconomyVersion === 2 && FD_META.dailyBudget === 120,
  JSON.stringify(FD_META));
note = await fdNote();
check('1: with Forge Daily running, Home still says this is not a challenge',
  /No Active Challenge\./.test(await page.textContent('.no-challenge-banner')));
check('1: …and says what a missed day costs while penalties are on',
  note?.penalties === 'on' && /^Forge Daily counts missed days while XP Penalties are on: a fully missed day costs 60 XP/.test(note.text),
  note?.text);
check('1: …that unticked habits on a logged day cost a little too', /habits left unticked on a logged day cost a little too/.test(note?.text || ''));
check('1: …and where to turn penalties off', /turn penalties off in Settings/.test(note?.text || ''));

await togglePenalties();
check('1: the XP Penalties switch still works', (await prof()).xpPenalties === false);
await gotoTab('Home');
note = await fdNote();
check('1: with penalties off, Home says missed days cost nothing',
  note?.penalties === 'off' && note.text === 'XP Penalties are off, so missed days on Forge Daily cost no XP.', note?.text);
await togglePenalties();
check('1: …and switches back on', (await prof()).xpPenalties === true);
await gotoTab('Home');
check('1: …and Home follows it', (await fdNote())?.penalties === 'on');

// The other profile says the same about its own setting.
await page.locator('.dash-switch-btn').first().click();
await page.waitForTimeout(600);
check('1: the second profile is showing', (await store('activeProfile')) === 'girlfriend');
note = await fdNote();
check('1: the second profile gets the same explanation', note?.penalties === 'on' && /60 XP/.test(note.text), note?.text);
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.xpPenalties = false;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await reload();
check('1: …and reflects its own penalty setting, not the other profile\'s',
  (await fdNote())?.penalties === 'off' && (await prof('me')).xpPenalties === true);

// ══ 2: Settings — no claim that broken streaks cost XP ═════════════════════
await page.evaluate(() => localStorage.setItem('activeProfile', JSON.stringify('me')));
await reload();
await gotoTab('Settings');
let desc = (await page.textContent('[data-testid="xp-penalties-desc"]')).replace(/\s+/g, ' ').trim();
check('2: the description no longer mentions streaks', !/streak/i.test(desc), desc);
check('2: it says what does cost XP: missed days and unticked habits',
  /missed days/.test(desc) && /habits left unticked/.test(desc));
check('2: in challenges and in Forge Daily', /in challenges and in Forge Daily/.test(desc));
check('2: the Minimum Warrior Day reduction is still described', /70%/.test(desc));
check('2: the old sentence is nowhere on the page', !/broken streaks/i.test(await page.textContent('body')));

// An attempt from before the current XP rules really does charge for a broken
// streak — so there, and only there, it is said.
await seed({ me: {
  start: dateAt(-3),
  meta: { templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard', durationDays: 30,
    templateVersion: 1, completionBonusXP: 700, lockIn: { durationDays: 30 } },
  tasks: [{ id: 't_sleep', name: 'Sleep', icon: '😴', xp: 40, keystone: 3, source: 'template', order: 0 }],
} });
await gotoTab('Settings');
desc = (await page.textContent('[data-testid="xp-penalties-desc"]')).replace(/\s+/g, ' ').trim();
check('2: an attempt on the earlier XP rules says its streak breaks cost XP, and why',
  /loses XP when a streak breaks, because it started under the earlier XP rules/.test(desc), desc);

// ══ 3: the notice shows each missed day once ═══════════════════════════════
// Day 1 nine days ago, days 1–2 logged: today is day 10, days 3–9 missed.
const startA = dateAt(-9);
await seed({
  me: { start: startA, days: { 1: { tasks: FULL() }, 2: { tasks: FULL() } }, archives: [ARCHIVE('arch_banked', 83000)], highestRank: 7 },
  girlfriend: { start: dateAt(-2), days: { 1: { tasks: FULL() } }, archives: [ARCHIVE('arch_gf', 4200)] },
});
let wb = await notice();
check('3: a seven-day Forge Daily gap is announced', wb?.days === '7' && wb.label === 'missed days' && wb.update === 'no', JSON.stringify(wb));
check('3: …at 60 XP a day: −420', wb?.xp === '−420', wb?.xp);
check('3: …with the dates of the gap', wb?.range === `${longDate(dateAt(-7))} – ${longDate(dateAt(-1))}`, wb?.range);
check('3: …and the rank reassurance', /rank and achievements are protected/i.test(wb?.text || ''));
check('3: …and no "since you last checked" on a first showing', !/Since you last checked/.test(wb?.text || ''));
const xpDay10 = await lifetimeXP();
const ledgerDay10 = (await prof()).xpLedger || {};
await dismissNotice();
check('3: "Got it" hides it', !(await notice()));
let ledger = (await prof()).xpLedger || {};
check('3: the acknowledgement covers the gap through its last day', ledger.seenComeback === `${startA}|3-9`, ledger.seenComeback);
check('3: dismissing changes no XP', (await lifetimeXP()) === xpDay10, `${xpDay10} → ${await lifetimeXP()}`);
check('3: …and records nothing but the acknowledgement',
  ['forgiven', 'forgivenBasis', 'carried', 'reconciled'].every(k => JSON.stringify(ledger[k] ?? null) === JSON.stringify(ledgerDay10[k] ?? null)));
await reload(); await reload();
check('3: reloading does not bring it back', !(await notice()));

// The next morning. The gap is now eight days long; seven were already shown.
await setNow(new Date(T0.getTime() + DAY));
await reload();
wb = await notice();
check('3: the next morning, only the new day is announced', wb?.days === '1' && wb.label === 'more missed day' && wb.update === 'yes', JSON.stringify(wb));
check('3: …with only its own XP: −60, not the running total of −480', wb?.xp === '−60', wb?.xp);
check('3: …dated that day alone', wb?.range === longDate(dateAt(-1)), wb?.range);
check('3: …and says the earlier days were already counted', /already counted and shown/.test(wb?.text || ''));
const xpDay11 = await lifetimeXP();
check('3: overnight the balance moved by exactly that one day', xpDay11 === xpDay10 - 60, `${xpDay10} → ${xpDay11}`);
await dismissNotice();
ledger = (await prof()).xpLedger || {};
check('3: dismissing acknowledges through the new day', ledger.seenComeback === `${startA}|3-10`, ledger.seenComeback);
check('3: …and again changes no XP', (await lifetimeXP()) === xpDay11);

// A day inside the acknowledged gap logged after the fact — a Daily Log only,
// so it becomes a partial day. Its penalty changes; the rest of the gap was
// already shown and stays shown.
await setDays('me', { 6: { tasks: { daily_log: true } } });
check('3: logging a day inside an acknowledged gap does not resurface it', !(await notice()));
const xpEdited = await lifetimeXP();
check('3: the edit moves the balance by that day alone: −60 becomes +17 −27', xpEdited === xpDay11 + 60 + 17 - 27, `${xpDay11} → ${xpEdited}`);
let h = await history();
let fd = h.periods.find(p => p.name === 'Forge Daily');
check('3: XP History counts seven missed days, −420', fd?.rows['Days missed'] === '7' && num(fd?.rows['Missed-day penalties']) === -420, JSON.stringify(fd?.rows));
check('3: …and the partial day as unfinished, −27', num(fd?.rows['Unfinished days']) === -27, JSON.stringify(fd?.rows));
check('3: …and the period\'s own rows add up',
  num(fd?.rows['XP earned']) + num(fd?.rows['Missed-day penalties']) + num(fd?.rows['Unfinished days']) === num(fd?.rows['So far']),
  JSON.stringify(fd?.rows));
const fdNet = num(fd?.rows['So far']);
check('3: the period is in deficit', fdNet < 0, `${fdNet}`);

// ══ 4: starting a challenge from Forge Daily moves no XP ═══════════════════
const gfBefore = { profile: await prof('girlfriend'), days: (await store('allDays')).girlfriend, archives: (await store('archives')).girlfriend };
const xpBeforeStart = await lifetimeXP();
await startFromLibrary('Fat Loss Challenge');
const p4 = await prof();
check('4: Fat Loss started from the library', p4.activeChallenge?.templateId === 'fat_loss_phase', p4.activeChallenge?.templateId);
const xpAfterStart = await lifetimeXP();
check('4: Lifetime XP is exactly where it was', xpAfterStart === xpBeforeStart,
  `${xpBeforeStart} → ${xpAfterStart} (the old archiving added back ${-fdNet})`);
const arch4 = (await store('archives')).me;
const fdArch = arch4.find(a => a.challenge?.templateId === 'forge_daily');
check('4: the Forge Daily period is archived with what it earned and what it lost',
  fdArch?.xpAccounting === 2 && fdArch.xpGained - fdArch.xpLost === fdNet && fdArch.xpLost === 420 + 27,
  fdArch && JSON.stringify({ g: fdArch.xpGained, l: fdArch.xpLost, e: fdArch.xpEarned }));
check('4: …keeping the banked figure older code reads exactly as before', fdArch?.xpEarned === 0);
check('4: …and its day records', Object.keys(fdArch?.days || {}).sort().join() === '1,2,6');
check('4: the earlier archive is untouched', JSON.stringify(arch4.find(a => a.id === 'arch_banked')) === JSON.stringify(ARCHIVE('arch_banked', 83000)));
h = await history();
fd = h.periods.find(p => p.name === 'Forge Daily');
check('4: XP History lists the finished period with its loss, signed', num(fd?.rows.Net) === fdNet, JSON.stringify(fd?.rows));
check('4: …and the totals still add up to Current XP', reconciles(h), JSON.stringify(h.totals));
check('4: …which is the balance on the main card', num(h.totals['Current XP']) === xpAfterStart);
check('4: no notice follows into the new challenge', !(await notice()));
check('4: the other profile was not touched',
  JSON.stringify((await store('allDays')).girlfriend) === JSON.stringify(gfBefore.days)
  && JSON.stringify((await store('archives')).girlfriend) === JSON.stringify(gfBefore.archives)
  && JSON.stringify((await prof('girlfriend')).xpLedger ?? null) === JSON.stringify(gfBefore.profile.xpLedger ?? null));

// ══ 5: the rank floor protects XP but never creates it ═════════════════════
// True Warrior at 75,100, then a week of Forge Daily with nothing logged:
// −420 would take the balance to 74,680, so the floor holds it at 75,000.
const startB = dateAt(-7);
await seed({
  me: { start: dateAt(-1), days: { 1: { tasks: FULL() } }, archives: [ARCHIVE('arch_me', 12000)] },
  girlfriend: { start: startB, archives: [ARCHIVE('arch_near', 75100)], highestRank: 7 },
  active: 'girlfriend',
});
const meBefore = { days: (await store('allDays')).me, archives: (await store('archives')).me, ledger: (await prof('me')).xpLedger ?? null };
check('5: the gap stops at the floor', (await lifetimeXP()) === 75000, `${await lifetimeXP()}`);
let gl = (await prof('girlfriend')).xpLedger || {};
check('5: the shortfall is written off against the penalties it covered',
  gl.forgiven === 320 && gl.forgivenBasis === 420 && gl.forgivenUnits === 2, JSON.stringify(gl));
wb = await notice();
check('5: the notice reports the real cost of the gap', wb?.days === '7' && wb.xp === '−420', JSON.stringify(wb));
await startFromLibrary('Fat Loss Challenge');
check('5: a challenge started from there', (await prof('girlfriend')).activeChallenge?.templateId === 'fat_loss_phase');
check('5: starting it creates no XP: still 75,000, not 75,420', (await lifetimeXP()) === 75000, `${await lifetimeXP()}`);
gl = (await prof('girlfriend')).xpLedger || {};
const carried = gl.carried || [];
check('5: the empty Forge Daily week is kept, with its missed days', carried.length === 1
  && carried[0].name === 'Forge Daily' && carried[0].gained === 0 && carried[0].lost === 420
  && carried[0].missedDays === 7 && carried[0].missedPenalty === 420 && carried[0].challengeStart === startB, JSON.stringify(carried));
check('5: …and the write-off is unchanged', gl.forgiven === 320 && gl.forgivenBasis === 420);
check('5: no archive was invented for it', (await store('archives')).girlfriend.length === 1);
h = await history();
fd = h.periods.find(p => p.name === 'Forge Daily');
check('5: XP History shows the week: 7 days missed, −420, net −420',
  fd?.rows['Days missed'] === '7' && num(fd?.rows['Missed-day penalties']) === -420 && num(fd?.rows.Net) === -420, JSON.stringify(fd?.rows));
check('5: the totals show the protection that holds the floor',
  num(h.totals['Total XP earned']) === 75100 && num(h.totals['Missed-day penalties']) === -420
    && num(h.totals['Cancelled by your rank protection']) === 320 && num(h.totals['Current XP']) === 75000,
  JSON.stringify(h.totals));

// Earning at the floor moves the balance at once: no hidden debt to repay.
const flTask = (await prof('girlfriend')).tasks[0].id;
await setDays('girlfriend', { 1: { tasks: { [flTask]: true } } });
const s5 = await split();
check('5: XP earned at the floor shows immediately, in full',
  s5.challenge > 0 && s5.lifetime === 75000 + s5.challenge, JSON.stringify(s5));
check('5: the other profile was not touched',
  JSON.stringify((await store('allDays')).me) === JSON.stringify(meBefore.days)
  && JSON.stringify((await store('archives')).me) === JSON.stringify(meBefore.archives)
  && JSON.stringify((await prof('me')).xpLedger ?? null) === JSON.stringify(meBefore.ledger));

// ══ 6: retroactive edits and the toggle unwind protection ══════════════════
const startC = dateAt(-7);
await seed({ me: { start: startC, archives: [ARCHIVE('arch_near', 75100)], highestRank: 7 } });
check('6: at the floor', (await lifetimeXP()) === 75000);

await togglePenalties();
check('6: penalties off: the week costs nothing, and the protection goes with it — 75,100, not 75,420',
  (await lifetimeXP()) === 75100, `${await lifetimeXP()}`);
h = await history();
check('6: …so History shows no protection at all', !('Cancelled by your rank protection' in h.totals) && reconciles(h), JSON.stringify(h.totals));
await togglePenalties();
check('6: penalties back on: back to the floor', (await lifetimeXP()) === 75000, `${await lifetimeXP()}`);
check('6: switching off and on never rewrote the stored write-off',
  (await prof()).xpLedger?.forgiven === 320 && (await prof()).xpLedger?.forgivenBasis === 420, JSON.stringify((await prof()).xpLedger));

await setDays('me', { 5: { tasks: FULL() }, 6: { tasks: FULL() }, 7: { tasks: FULL() } });
h = await history();
check('6: logging three of the days afterwards: their 180 of penalties are gone…',
  num(h.totals['Missed-day penalties']) === -240, JSON.stringify(h.totals));
check('6: …and so is 180 of the protection that covered them',
  num(h.totals['Cancelled by your rank protection']) === 140, JSON.stringify(h.totals));
check('6: …so the balance is the floor plus what those days earned', reconciles(h)
  && num(h.totals['Current XP']) === 75000 + (num(h.totals['Total XP earned']) - 75100)
  && (await lifetimeXP()) === num(h.totals['Current XP']), JSON.stringify(h.totals));
ledger = (await prof()).xpLedger || {};
check('6: …and the protection those days no longer need is written down for good',
  ledger.forgiven === 140 && ledger.forgivenBasis === 240, JSON.stringify(ledger));

// The next morning, with nothing logged: the new missed day costs its full 60
// instead of being absorbed by protection the logged days no longer need.
const xpThreeLogged = await lifetimeXP();
await setNow(new Date(now.getTime() + DAY));
await reload();
check('6: a missed day after that costs its full 60', (await lifetimeXP()) === xpThreeLogged - 60,
  `${xpThreeLogged} → ${await lifetimeXP()}`);

await setDays('me', Object.fromEntries([1, 2, 3, 4, 8].map(n => [n, { tasks: FULL() }])));
const s6 = await split();
h = await history();
check('6: logging every missed day leaves no protection behind', !('Cancelled by your rank protection' in h.totals), JSON.stringify(h.totals));
check('6: …and the balance is exactly what was earned: 75,100 + the week',
  s6.lifetime === 75100 + s6.challenge && num(h.totals['Current XP']) === s6.lifetime, `${JSON.stringify(s6)} (the old floor kept +320)`);

// ══ 7: data stored before the fix reads exactly as it did ══════════════════
// A Forge Daily week with nothing logged, a rank-protection credit written by
// the old code (no basis), and a notice dismissed six days into the gap under
// the old acknowledgement format.
const startD = dateAt(-7);
const legacyLedger = { version: 1, reconciled: null, forgiven: 320, forgivenUnits: 2, seenComeback: `${startD}|1-6` };
await seed({
  me: { start: startD, archives: [ARCHIVE('arch_near', 75100)], highestRank: 7, ledger: legacyLedger },
  girlfriend: { start: dateAt(0), archives: [ARCHIVE('arch_gf', 75100)], highestRank: 7,
    ledger: { version: 1, reconciled: null, forgiven: 320, forgivenUnits: 2 } },
});
check('7: an older protection credit keeps the balance it gave: 75,000', (await lifetimeXP()) === 75000, `${await lifetimeXP()}`);
ledger = (await prof()).xpLedger;
check('7: the credit is kept, and stamped with the penalties it covers now',
  ledger.forgiven === 320 && ledger.forgivenBasis === 420 && ledger.forgivenUnits === 2, JSON.stringify(ledger));
check('7: an old-format acknowledgement still counts', ledger.seenComeback === `${startD}|1-6`);
wb = await notice();
check('7: so only the day after it is new: 1 more missed day, −60', wb?.days === '1' && wb.label === 'more missed day' && wb.xp === '−60', JSON.stringify(wb));
check('7: archives and day records are untouched',
  JSON.stringify((await store('archives')).me) === JSON.stringify([ARCHIVE('arch_near', 75100)])
  && JSON.stringify((await store('allDays')).me) === '{}');
await page.evaluate(() => localStorage.setItem('activeProfile', JSON.stringify('girlfriend')));
await reload();
check('7: a credit larger than today\'s penalties is grandfathered too — 75,420 stays 75,420',
  (await lifetimeXP()) === 75420, `${await lifetimeXP()}`);

// ══ 9: a transition never runs twice ═══════════════════════════════════════
// A control clicked twice inside one task — before React has re-rendered —
// used to run its transition twice on the same moment's state: one challenge
// archived twice, or its missed days carried twice. Real double taps were
// never affected, and still behave exactly as one tap.
const fireTwice = (loc) => loc.evaluate((b) => { b.click(); b.click(); });
const meArchives = async () => (await store('archives')).me || [];
const carriedCount = async () => ((await prof()).xpLedger?.carried || []).length;
const RUNNING = () => ({ ...FD_META, templateId: 'mental_training_phase', name: 'Mental Training Phase', isBaseline: false,
  durationDays: 21, variant: 'standard', effortTier: 'medium', dailyBudget: 160, completionBonusXP: 300 });
const WITH_RECORDS = () => ({ start: dateAt(-3), meta: RUNNING(), days: { 1: { tasks: FULL() }, 2: { tasks: FULL() } }, archives: [ARCHIVE('a20', 20000)], highestRank: 4 });
async function archiveAndChooseNew(act) {
  await gotoTab('Settings');
  await page.locator('button', { hasText: 'Start New Challenge' }).first().click();
  await page.waitForTimeout(300);
  await act(page.locator('.modal-actions .btn-primary').last());
  await page.waitForTimeout(900);
  await reload();
}

await seed({ me: WITH_RECORDS() });
let xp0 = await lifetimeXP();
let n0 = (await meArchives()).length;
await archiveAndChooseNew(fireTwice);
check('9: "Archive & Choose New" fired twice in one task archives the challenge once',
  (await meArchives()).length === n0 + 1 && (await prof()).activeChallenge?.templateId === 'forge_daily', `${n0} → ${(await meArchives()).length}`);
check('9: …and moves no XP', (await lifetimeXP()) === xp0, `${xp0} → ${await lifetimeXP()}`);

await seed({ me: WITH_RECORDS() });
xp0 = await lifetimeXP();
n0 = (await meArchives()).length;
await archiveAndChooseNew((loc) => loc.dblclick());
check('9: a real double-click still does exactly what one click does', (await meArchives()).length === n0 + 1 && (await lifetimeXP()) === xp0);

// Above the floor this time, so nothing can hide a duplicated week.
await seed({ me: { start: dateAt(-7), archives: [ARCHIVE('a20', 20000)], highestRank: 4 } });
xp0 = await lifetimeXP();
await toFinalStep('Fat Loss Challenge');
await fireTwice(page.locator('.f4c-setup .f4c-btn.primary').last());
await page.waitForTimeout(900);
await reload();
check('9: "Start" fired twice keeps the empty Forge Daily week once',
  (await carriedCount()) === 1 && (await prof()).activeChallenge?.templateId === 'fat_loss_phase', `${await carriedCount()} carried`);
check('9: …and moves no XP — the week is not charged twice', (await lifetimeXP()) === xp0, `${xp0} → ${await lifetimeXP()}`);

const SUPPORT_META = { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard', durationDays: 21, passingScore: 70, keystoneRequirement: 65 };
const STACKED_TASKS = () => [...FD_TASKS.map(t => ({ ...t, challenges: ['primary'] })),
  { id: 'mt_focus', name: 'Focus', xp: 20, keystone: 1, source: 'template', order: 20, challenges: ['support'] },
  { id: 'mt_physical', name: 'Physical', xp: 30, keystone: 1, source: 'template', order: 21, challenges: ['support'] }];
const PRIMARY = () => ({ ...RUNNING(), templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30 });
const stackedDays = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { tasks: { ...FULL(), mt_focus: true, mt_physical: true } }]));
await seed({ me: { start: dateAt(-3), meta: PRIMARY(), tasks: STACKED_TASKS(), days: stackedDays(3), archives: [ARCHIVE('a20', 20000)], highestRank: 4,
  support: { meta: SUPPORT_META, start: dateAt(-3) } } });
xp0 = await lifetimeXP();
await gotoTab('Challenges');
await page.locator('.acc-support-end').click();
await page.waitForTimeout(400);
await fireTwice(page.locator('.end-support-modal button', { hasText: /^End Support Challenge$/ }));
await page.waitForTimeout(900);
await reload();
check('9: "End Support Challenge" fired twice archives the support once',
  (await meArchives()).filter(a => a.lane === 'support').length === 1 && (await prof()).supportChallenge === null);
check('9: …and moves no XP', (await lifetimeXP()) === xp0, `${xp0} → ${await lifetimeXP()}`);

// Promote, fired twice: the primary finished yesterday beside the support.
await seed({ me: { start: dateAt(-30), meta: PRIMARY(), tasks: STACKED_TASKS(), days: stackedDays(30), archives: [ARCHIVE('a20', 20000)], highestRank: 4,
  penalties: false, support: { meta: SUPPORT_META, start: dateAt(-5) } } });
await gotoTab('Home');
const choice = (await prof()).pendingPrimaryChoice;
const daysBefore = JSON.stringify((await store('allDays')).me);
await fireTwice(page.locator('.primary-choice-card button', { hasText: 'Promote' }));
await page.waitForTimeout(900);
const promoted = await prof();
check('9: "Promote" fired twice promotes once',
  !!choice && promoted.activeChallenge?.templateId === 'mental_training_phase' && promoted.supportChallenge === null
    && promoted.xpStartDay === 6 && JSON.stringify((await store('allDays')).me) === daysBefore,
  `${promoted.activeChallenge?.templateId} start day ${promoted.xpStartDay}`);
await reload();

// Both lanes past their final day at the same moment: the support finishes,
// then — once that is committed — the primary, reading the state the support
// left behind rather than the moment before it.
await seed({ me: { start: dateAt(-15), meta: { ...PRIMARY(), durationDays: 14 }, tasks: STACKED_TASKS(), days: stackedDays(14), archives: [ARCHIVE('a20', 20000)],
  highestRank: 4, penalties: false, support: { meta: { ...SUPPORT_META, durationDays: 7 }, start: dateAt(-9) } } });
await page.waitForTimeout(800);
const both = await prof();
const bothArchives = await meArchives();
check('9: both lanes finishing at once each archive exactly once',
  bothArchives.filter(a => a.lane === 'support').length === 1
    && bothArchives.filter(a => a.lane !== 'support' && a.challenge?.templateId === 'fat_loss_phase').length === 1,
  bothArchives.map(a => `${a.lane || 'primary'}:${a.challenge?.templateId}`).join(', '));
check('9: …and the profile is left consistent: Forge Daily, no support, no choice about one',
  both.activeChallenge?.templateId === 'forge_daily' && both.supportChallenge === null && !both.pendingPrimaryChoice
    && !both.tasks.some(t => (t.challenges || []).includes('support')),
  JSON.stringify({ primary: both.activeChallenge?.templateId, support: both.supportChallenge?.templateId ?? null, choice: !!both.pendingPrimaryChoice }));

// ══ 8: phone widths ════════════════════════════════════════════════════════
await seed({ me: { start: dateAt(-1), days: { 1: { tasks: FULL() } } } });
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 844 });
  await gotoTab('Home');
  const m = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="fd-penalty-note"]');
    const r = el?.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, inside: !!r && r.left >= -1 && r.right <= window.innerWidth + 1 };
  });
  check(`8: the Forge Daily note fits at ${w}px with no sideways scroll`, m.inside && m.overflow <= 1, JSON.stringify(m));
}
await page.setViewportSize({ width: 390, height: 844 });

check('8: no page errors throughout',
  errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0,
  errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
