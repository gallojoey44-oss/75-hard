/**
 * Friends and Our Journey — two phones, end to end.
 *
 * Two separate browser contexts are two separate phones: separate storage,
 * separate sessions, nothing shared between them but the server. Each person
 * signs in through the real UI with a code read from a real email, and every
 * change one makes must reach the other through the server alone.
 *
 * Runs against the local Supabase stack (tests/journey/stack.mjs) and a build
 * of Forge pointed at it (tests/journey/build.mjs, :4175).
 *
 *   A. Personal Forge first: both phones carry their own private data
 *   B. Signing in with an emailed code, choosing usernames
 *   C. Friends: a request by username, accepted on the other phone
 *   D. A Journey: invited, nothing shared until accepted, then active on both
 *   E. A shared goal: suggested, agreed, contributions from both phones,
 *      combined progress, completion celebrated on both, kept after reload
 *   F. Our Future and the weekly check-in, across phones
 *   G. Privacy: nothing personal ever leaves a phone; an outsider sees nothing
 *   H. Invite links, revoked codes, declining
 *   I. Leaving and removing: both phones, content gone, friendship as chosen
 *   J. Personal Forge untouched: profiles, XP, the other profile, backups
 *   K. 320, 390 and 430px
 *   L. Offline before Our Journey was ever opened: a clear message, and
 *      personal Forge carries on
 *
 * JOURNEY_SHOTS=<dir> saves screenshots of the main screens.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { bootStack, latestCode, dockerAvailable } from './journey/stack.mjs';
import { startJourneyBuild } from './journey/build.mjs';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
if (!dockerAvailable()) { console.log('FAIL  Docker is required for this suite and is not available'); process.exit(1); }

const SHOTS = process.env.JOURNEY_SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const { gateway } = await bootStack();
const build = await startJourneyBuild(4175);
const BASE = build.url;
const browser = await chromium.launch();
const SYNC = 25000;   // two polls and then some

function offset(n) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];

async function phone(name, profile, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  const page = await context.newPage();
  const ph = { name, page, context, errors: [], sent: [] };
  page.on('pageerror', e => ph.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') ph.errors.push(m.text()); });
  // Everything this phone sends to the Journey server, to prove what leaves it.
  page.on('request', r => { if (r.url().startsWith('http://localhost:54321')) ph.sent.push(`${r.method()} ${r.url()}\n${r.postData() || ''}`); });
  await page.goto(BASE);
  await page.evaluate((p) => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify(p)); }, profile);
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 15000 });
  return ph;
}

async function gotoTab(page, name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => new RegExp(`^${n}$`, 'i').test((x.getAttribute('aria-label') || x.textContent || '').trim()));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(300);
}

async function dismissRankUp(page) {
  for (let i = 0; i < 3 && (await page.locator('.rankup-skip').count()); i++) {
    await page.locator('.rankup-skip').first().click();
    await page.waitForTimeout(250);
  }
}

/** A phone's own private Forge data: a challenge, two logged days, notes, ratings. */
async function seedPersonal(ph, profile, secret) {
  await ph.page.evaluate(({ profile, secret, start }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p[profile].challengeStart = start;
    p[profile].xpPenalties = false;
    p[profile].activeChallenge = {
      templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard', durationDays: 14,
      passingScore: 70, keystoneRequirement: 65, xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180, completionBonusXP: 504,
    };
    p[profile].tasks = [
      { id: 'li_flow', name: `Flow training ${secret}`, icon: '🌊', xp: 29, keystone: 3, source: 'template', order: 0 },
      { id: 'li_execute', name: 'Execute 2 of 3 priorities', icon: '✅', xp: 28, keystone: 3, source: 'template', order: 1 },
      { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0, source: 'template', order: 2 },
    ];
    localStorage.setItem('profiles', JSON.stringify(p));
    const all = JSON.parse(localStorage.getItem('allDays') || '{}');
    all[profile] = {
      1: { dayNumber: 1, tasks: { li_flow: true, li_execute: true, daily_log: true }, mood: 8, energy: 7, stress: 3, notes: `Private note ${secret}` },
      2: { dayNumber: 2, tasks: { li_flow: true, daily_log: true }, mood: 4, energy: 3, stress: 8, notes: `Hard day ${secret}` },
    };
    localStorage.setItem('allDays', JSON.stringify(all));
  }, { profile, secret, start: offset(-2) });
  await ph.page.reload();
  await ph.page.waitForSelector('.dashboard', { timeout: 15000 });
  await dismissRankUp(ph.page);
}

const forgeState = (ph) => ph.page.evaluate((keys) => JSON.stringify(Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]))), LS_KEYS);
const homeXP = async (ph) => { await gotoTab(ph.page, 'Home'); await dismissRankUp(ph.page); return (await ph.page.textContent('.f41-rank-xp-num'))?.trim(); };

async function openJourney(ph) {
  await gotoTab(ph.page, 'Home');
  await dismissRankUp(ph.page);
  await ph.page.locator('[data-testid="home-journey"] .jr-home-btn').click();
  await ph.page.waitForSelector('[data-testid^="journey"]', { timeout: 15000 });
}

async function signInUI(ph, email) {
  await ph.page.waitForSelector('#jr-email');
  await ph.page.fill('#jr-email', email);
  const since = Date.now() - 1000;
  await ph.page.click('button:has-text("Email me a code")');
  await ph.page.waitForSelector('#jr-code', { timeout: 15000 });
  const code = await latestCode(email, { after: since });
  await ph.page.fill('#jr-code', code);
  await ph.page.click('button:has-text("Sign in")');
}

async function chooseUsername(ph, username, name) {
  await ph.page.waitForSelector('[data-testid="journey-username"]', { timeout: 15000 });
  await ph.page.fill('#jr-username', username);
  await ph.page.fill('#jr-display', name);
  await ph.page.click('button:has-text("Continue")');
  await ph.page.waitForSelector('[data-testid="journey-home"]', { timeout: 15000 });
}

const text = (ph, sel = 'body') => ph.page.textContent(sel);
const back = (ph) => ph.page.locator('.jr-back').first().click();
async function shot(ph, name) {
  if (!SHOTS) return;
  await ph.page.waitForTimeout(300);
  await ph.page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
/** Close a celebration if it is still up (it also closes itself). */
async function closeCelebration(ph) {
  const c = ph.page.locator('[data-testid="journey-celebration"] button');
  if (await c.count()) await c.first().click().catch(() => {});
  await ph.page.waitForTimeout(150);
}
async function sees(ph, selector, opts = {}) {
  try { await ph.page.waitForSelector(selector, { timeout: SYNC, ...opts }); return true; } catch { return false; }
}
async function seesText(ph, needle, scope = 'body') {
  try {
    await ph.page.waitForFunction(([s, n]) => (document.querySelector(s)?.textContent || '').includes(n), [scope, needle], { timeout: SYNC });
    return true;
  } catch { return false; }
}

// ══ A: personal Forge first ══════════════════════════════════════════════════
const A = await phone('Alex', 'me');
const B = await phone('Blair', 'girlfriend');
await seedPersonal(A, 'me', 'SECRET-ALEX');
await seedPersonal(A, 'girlfriend', 'SECRET-OTHER-PROFILE');
await seedPersonal(B, 'girlfriend', 'SECRET-BLAIR');
await A.page.reload(); await A.page.waitForSelector('.dashboard'); await dismissRankUp(A.page);
const xpBefore = await homeXP(A);
const stateBefore = await forgeState(A);
const bStateBefore = await forgeState(B);
check('A: each phone has its own private Forge data and XP', /\d/.test(xpBefore || '') && stateBefore.includes('SECRET-ALEX'), `Home shows ${xpBefore} XP`);
check('A: Home offers Our Journey', (await A.page.locator('[data-testid="home-journey"]').count()) === 1
  && /Grow together with someone you trust/.test(await text(A, '[data-testid="home-journey"]')));
await shot(A, '01-home-card');

// ══ B: signing in ════════════════════════════════════════════════════════════
await openJourney(A);
check('B: opening it asks to sign in, saying what stays private',
  /Only what you add to a Journey is shared/.test(await text(A, '[data-testid="journey-signin"]'))
    && /Personal Forge keeps working without signing in/.test(await text(A, '[data-testid="journey-signin"]')));
await shot(A, '02-sign-in');
await signInUI(A, 'alex@example.test');
check('B: the emailed code signs Alex in', await sees(A, '[data-testid="journey-username"]'));
await chooseUsername(A, 'alex', 'Alex');
check('B: Alex chooses a username and arrives at Our Journey',
  /Grow together/.test(await text(A, '[data-testid="journey-home"]')) && /@alex/.test(await text(A, '[data-testid="journey-home"]')));
await shot(A, '03-journey-empty');
await openJourney(B);
await signInUI(B, 'blair@example.test');
await chooseUsername(B, 'blair', 'Blair');
check('B: Blair, on another phone, does the same', /@blair/.test(await text(B, '[data-testid="journey-home"]')));

// ══ C: friends ═══════════════════════════════════════════════════════════════
await A.page.click('[data-testid="journey-friends-btn"]');
await A.page.fill('[data-testid="journey-add-friend"] input[aria-label="Username"]', 'blair');
await A.page.click('[data-testid="journey-add-friend"] button:has-text("Find")');
check('C: an exact username finds Blair', await sees(A, '[data-testid="journey-found"]') && /Blair/.test(await text(A, '[data-testid="journey-found"]')));
await A.page.click('[data-testid="journey-found"] button:has-text("Send request")');
check('C: Alex sends a request, and it waits', await seesText(A, 'Requests you sent', '[data-testid="journey-friends"]'));
await shot(A, '04-friends');
check('C: Blair\'s phone shows the request waiting', await seesText(B, '1', '[data-testid="journey-friends-btn"]'));
await B.page.click('[data-testid="journey-friends-btn"]');
check('C: …from Alex', await seesText(B, 'Alex', '[data-testid="journey-incoming"]'));
await B.page.click('[data-testid="journey-incoming"] button:has-text("Accept")');
check('C: Blair accepts', await seesText(B, 'Alex', '[data-testid="journey-friend-list"]'));
check('C: Alex\'s phone shows Blair as a friend', await seesText(A, '@blair', '[data-testid="journey-friend-list"]'));

// ══ D: a Journey ═════════════════════════════════════════════════════════════
await back(A);
check('D: Alex can start a Journey with Blair', await sees(A, '[data-testid="journey-start"]'));
await A.page.click('[data-testid="journey-start"] button:has-text("Invite")');
await A.page.click('.jr-sheet button:has-text("Send invitation")');
check('D: Alex\'s phone waits for Blair', await seesText(A, 'Waiting for Blair to accept', '[data-testid="journey-waiting"]'));
await back(B);
check('D: Blair\'s phone shows the invitation', await sees(B, '[data-testid="journey-invite"]')
  && /Only what either of you adds to it is shared/.test(await text(B, '[data-testid="journey-invite"]')));
await shot(B, '05-invitation');
await B.page.click('[data-testid="journey-invite"] button:has-text("Accept")');
check('D: Blair accepts, and the Journey begins', await seesText(B, 'You & Alex', '[data-testid="journey-members"]'));
check('D: Alex\'s phone shows it too', await seesText(A, 'You & Blair', '[data-testid="journey-members"]'));
await shot(A, '06-journey-active');

// ══ E: a shared goal ═════════════════════════════════════════════════════════
await A.page.click('[data-testid="journey-new-goal"]');
await A.page.click('.jr-chip:has-text("Four workouts together")');
await A.page.click('button:has-text("Suggest to Blair")');
check('E: Alex suggests a goal, and it waits for Blair', await seesText(A, 'Waiting for Blair to agree'));
await shot(A, '07-goal-proposed');
check('E: Blair\'s phone asks Blair to agree', await seesText(B, 'Alex suggested this', '[data-testid="journey-goals"]'));
await B.page.click('[data-testid="journey-goal-row"]');
await B.page.click('[data-testid="journey-goal-agree"]');
check('E: Blair agrees; the goal starts', await sees(B, '[data-testid="journey-add-form"]'));
await B.page.fill('[data-testid="journey-add-form"] input[type="number"]', '2');
await B.page.fill('[data-testid="journey-add-form"] input[aria-label="Note"]', 'Evening swim');
await B.page.click('[data-testid="journey-add-btn"]');
check('E: Blair adds two', await seesText(B, '2', '[data-testid="journey-goal-total"]'));
check('E: Alex\'s phone shows 2 of 4', await seesText(A, '2', '[data-testid="journey-goal-total"]'));
await A.page.click('[data-testid="journey-add-btn"]');
check('E: Alex adds one: 3 of 4 on Alex\'s phone', await seesText(A, '3', '[data-testid="journey-goal-total"]'));
check('E: Alex sees who added what', /Blair\s*added 2 workouts/.test(await text(A, '[data-testid="journey-contributions"]'))
  && /You\s*added 1 workout(?!s)/.test(await text(A, '[data-testid="journey-contributions"]'))
  && /Evening swim/.test(await text(A, '[data-testid="journey-contributions"]')));
check('E: Blair\'s phone shows 3 of 4', await seesText(B, '3', '[data-testid="journey-goal-total"]'));
await shot(A, '08-goal-progress');
await B.page.click('[data-testid="journey-add-btn"]');
check('E: Blair\'s last one completes it — celebrated on Blair\'s phone', await sees(B, '[data-testid="journey-celebration"]')
  && /Goal complete: Four workouts together/.test(await text(B, '[data-testid="journey-celebration"]')));
await shot(B, '09-celebration');
check('E: …and on Alex\'s phone', await sees(A, '[data-testid="journey-celebration"]'));
await closeCelebration(A);
await closeCelebration(B);
await A.page.reload(); await A.page.waitForSelector('.dashboard');
await B.page.reload(); await B.page.waitForSelector('.dashboard');
await openJourney(A); await openJourney(B);
check('E: after a reload both phones still show it complete, in Recent milestones',
  await seesText(A, 'Four workouts together', '[data-testid="journey-milestones"]')
    && await seesText(B, 'Four workouts together', '[data-testid="journey-milestones"]'));
check('E: and the celebration is not repeated', (await A.page.locator('[data-testid="journey-celebration"]').count()) === 0);

// ══ F: Our Future and the check-in ═══════════════════════════════════════════
await A.page.click('[data-testid="journey-future-btn"]');
await A.page.click('[data-testid="journey-plan-add"]');
await A.page.fill('#jr-plan-title', 'Visit Japan');
await A.page.click('[data-testid="journey-plan-form"] .jr-chip:has-text("Travel")');
await A.page.fill('#jr-plan-notes', 'Kyoto in spring');
await A.page.click('button:has-text("Add to Our Future")');
check('F: Alex adds a plan to Our Future, under the area they chose', await seesText(A, 'Visit Japan', '[data-testid="journey-plan-group"]')
  && /Travel/.test(await text(A, '[data-testid="journey-plan-group"]')));
await shot(A, '10-our-future');
await B.page.click('[data-testid="journey-future-btn"]');
check('F: Blair\'s phone shows it', await seesText(B, 'Visit Japan', '[data-testid="journey-future"]'));
await B.page.click('.jr-check[aria-label="Mark Visit Japan as achieved"]');
check('F: Blair marks it achieved', await seesText(B, 'Visit Japan', '[data-testid="journey-plan-achieved"]'));
check('F: Alex\'s phone moves it to Achieved and celebrates', await seesText(A, 'Visit Japan', '[data-testid="journey-plan-achieved"]')
  && await sees(A, '[data-testid="journey-celebration"]'));
await closeCelebration(A);
await back(A); await back(B);
await A.page.click('[data-testid="journey-checkin-btn"]');
const prompts = A.page.locator('[data-testid="journey-checkin-mine"] textarea');
await prompts.nth(0).fill('We trained four times');
await prompts.nth(2).fill('Your patience on Tuesday');
await A.page.click('[data-testid="journey-checkin-save"]');
check('F: Alex checks in — answering only what they want', await seesText(A, 'Saved. Blair can see it now.'));
await shot(A, '11-check-in');
check('F: Blair\'s Home shows Alex checked in', await seesText(B, '✓ Alex', '[data-testid="journey-checkin-card"]'));
await B.page.click('[data-testid="journey-checkin-btn"]');
check('F: Blair reads Alex\'s check-in', await seesText(B, 'Your patience on Tuesday', '[data-testid="journey-checkin-theirs"]'));
await back(A); await back(B);

// ══ G: privacy ═══════════════════════════════════════════════════════════════
const everythingSent = A.sent.join('\n') + B.sent.join('\n');
check('G: nothing personal ever left either phone — no habits, notes or ratings in any request',
  !/SECRET|Private note|Hard day|"mood"|"stress"|"energy"|"xp"|allDays|li_flow/.test(everythingSent), `${A.sent.length + B.sent.length} requests inspected`);
const aScreens = await text(A); const bScreens = await text(B);
check('G: neither phone ever shows the other\'s personal data', !aScreens.includes('SECRET-BLAIR') && !bScreens.includes('SECRET-ALEX'));
const C = await phone('Casey', 'me');
await openJourney(C);
await signInUI(C, 'casey@example.test');
await chooseUsername(C, 'casey', 'Casey');
check('G: an outsider who signs in sees no one, and no Journey', /Grow together/.test(await text(C, '[data-testid="journey-home"]'))
  && !/Alex|Blair|workouts|Japan/.test(await text(C, '[data-testid="journey-home"]')));

// ══ H: invite links ══════════════════════════════════════════════════════════
await A.page.click('[data-testid="journey-friends-btn"]');
const code = (await text(A, '[data-testid="journey-my-code"]')).replace('-', '').trim();
await C.page.goto(`${BASE}/?friend=${code}`);
check('H: an invite link opens Our Journey and asks before sending anything',
  await seesText(C, 'Send a friend request to Alex', '[data-testid="journey-link-invite"]'));
check('H: the link put nothing in the address bar history', !C.page.url().includes('friend='));
await C.page.click('[data-testid="journey-link-invite"] button:has-text("Send request")');
check('H: Casey sends the request', await seesText(C, 'Requests you sent', '[data-testid="journey-friends"]'));
check('H: Alex sees it, and declines', await seesText(A, 'Casey', '[data-testid="journey-incoming"]'));
await A.page.click('[data-testid="journey-incoming"] button:has-text("Decline")');
check('H: …and it is gone from Casey\'s phone too', await (async () => {
  try { await C.page.waitForFunction(() => !document.querySelector('[data-testid="journey-outgoing"]'), null, { timeout: SYNC }); return true; } catch { return false; }
})());
await A.page.click('[data-testid="journey-my-invite"] button:has-text("New code")');
await A.page.click('.jr-sheet button:has-text("New code")');
await A.page.waitForFunction((old) => !document.querySelector('[data-testid="journey-my-code"]').textContent.replace('-', '').includes(old), code, { timeout: 10000 });
await C.page.fill('input[aria-label="Invite code"]', code);
await C.page.click('button:has-text("Use code")');
check('H: after Alex makes a new code, the old one no longer works', await seesText(C, 'That invite code isn’t valid', '[data-testid="journey-add-friend"]'));

// ══ I: leaving and removing ══════════════════════════════════════════════════
await B.page.click('[data-testid="journey-account-btn"]');
check('I: Blair can read exactly what is and is not shared',
  /Never shared:/.test(await text(B, '[data-testid="journey-privacy"]')) && /mood, stress and energy ratings/.test(await text(B, '[data-testid="journey-privacy"]')));
await shot(B, '12-privacy');
await B.page.click('[data-testid="journey-leave"]');
await B.page.click('.jr-sheet button:has-text("Leave and delete")');
check('I: Blair leaves; the Journey ends on Blair\'s phone', await sees(B, '[data-testid="journey-start"]'));
await back(A);
check('I: and on Alex\'s phone, its content gone', await sees(A, '[data-testid="journey-start"]')
  && !/Four workouts|Visit Japan/.test(await text(A, '[data-testid="journey-home"]')));
check('I: they are still friends', /Blair/.test(await text(A, '[data-testid="journey-start"]')));
await A.page.click('[data-testid="journey-friends-btn"]');
await A.page.click('[data-testid="journey-friend-list"] button:has-text("Remove")');
await A.page.click('.jr-sheet button:has-text("Remove")');
check('I: Alex removes Blair as a friend', await seesText(A, 'No friends yet', '[data-testid="journey-friend-list"]'));
check('I: Blair\'s phone no longer lists Alex', await (async () => {
  try { await B.page.waitForFunction(() => !document.querySelector('[data-testid="journey-start"]') && /Add a friend/.test(document.body.textContent), null, { timeout: SYNC }); return true; } catch { return false; }
})());

// ══ J: personal Forge untouched ══════════════════════════════════════════════
await A.page.reload(); await A.page.waitForSelector('.dashboard'); await dismissRankUp(A.page);
const xpAfter = await homeXP(A);
check('J: Lifetime XP is exactly what it was', xpAfter === xpBefore, `${xpBefore} → ${xpAfter}`);
check('J: every personal Forge record on Alex\'s phone is exactly as it was', (await forgeState(A)) === stateBefore);
check('J: and on Blair\'s', (await forgeState(B)) === bStateBefore);
const keys = await A.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('forge-journey')).sort());
check('J: Our Journey keeps to its own keys', keys.length > 0 && keys.every(k => /^forge-journey-(auth|cache|seen)-me$/.test(k)), keys.join(' '));
await A.page.evaluate(() => localStorage.setItem('activeProfile', JSON.stringify('girlfriend')));
await A.page.reload(); await A.page.waitForSelector('.dashboard'); await dismissRankUp(A.page);
check('J: the other profile on Alex\'s phone is not signed in — an account is not a profile',
  /Grow together with someone you trust/.test(await text(A, '[data-testid="home-journey"]')));
await openJourney(A);
check('J: …it asks to sign in on its own', await sees(A, '[data-testid="journey-signin"]'));
await A.page.evaluate(() => localStorage.setItem('activeProfile', JSON.stringify('me')));
await A.page.reload(); await A.page.waitForSelector('.dashboard'); await dismissRankUp(A.page);
await gotoTab(A.page, 'Settings');
const [download] = await Promise.all([
  A.page.waitForEvent('download', { timeout: 10000 }),
  A.page.locator('button', { hasText: 'Export / Backup Data' }).click(),
]);
const backup = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
check('J: a backup holds personal Forge only — no Journey session, cache or token',
  !JSON.stringify(backup).includes('forge-journey') && !/access_token|refresh_token/.test(JSON.stringify(backup))
    && Object.keys(backup).every(k => LS_KEYS.includes(k) || k === 'exportedAt' || k === 'version'), Object.keys(backup).join(' '));
await A.page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
await A.page.waitForTimeout(2200);
await A.page.waitForSelector('.dashboard', { timeout: 15000 });
await dismissRankUp(A.page);
check('J: restoring a backup leaves the Journey sign-in alone', /You|Invite a friend|Add a friend/.test(await text(A, '[data-testid="home-journey"]'))
  && !/Grow together with someone you trust/.test(await text(A, '[data-testid="home-journey"]')));

// ══ K: widths ════════════════════════════════════════════════════════════════
// Back to a Journey with content for the layout checks.
await openJourney(A);
await A.page.click('[data-testid="journey-friends-btn"]');
await A.page.fill('[data-testid="journey-add-friend"] input[aria-label="Username"]', 'casey');
await A.page.click('[data-testid="journey-add-friend"] button:has-text("Find")');
await A.page.click('[data-testid="journey-found"] button:has-text("Send request")');
await C.page.click('.jr-back');
await C.page.click('[data-testid="journey-friends-btn"]');
await C.page.click('[data-testid="journey-incoming"] button:has-text("Accept")');
await C.page.click('.jr-back');
await back(A);
await A.page.click('[data-testid="journey-start"] button:has-text("Invite")');
await A.page.click('.jr-sheet button:has-text("Send invitation")');
await sees(C, '[data-testid="journey-invite"]');
await C.page.click('[data-testid="journey-invite"] button:has-text("Accept")');
await sees(A, '[data-testid="journey-members"]');
await A.page.click('[data-testid="journey-new-goal"]');
await A.page.click('.jr-chip:has-text("Read and discuss a chapter")');
await A.page.click('button:has-text("Suggest to Casey")');
await sees(A, '[data-testid="journey-goal"]');
await back(A);
for (const w of [320, 390, 430]) {
  await A.page.setViewportSize({ width: w, height: w === 320 ? 640 : 844 });
  const fits = [];
  for (const go of ['home', 'friends', 'future', 'checkin', 'goal']) {
    if (go === 'friends') await A.page.click('[data-testid="journey-friends-btn"]');
    if (go === 'future') await A.page.click('[data-testid="journey-future-btn"]');
    if (go === 'checkin') await A.page.click('[data-testid="journey-checkin-btn"]');
    if (go === 'goal') await A.page.click('[data-testid="journey-goal-row"]');
    await A.page.waitForTimeout(200);
    const ok = await A.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    if (!ok) fits.push(go);
    if (go !== 'home') await back(A);
  }
  check(`K: ${w}px — every Journey screen fits without sideways scrolling`, fits.length === 0, fits.join(' '));
}
await A.page.setViewportSize({ width: 390, height: 844 });
if (SHOTS) { await gotoTab(A.page, 'Home'); await dismissRankUp(A.page); await A.page.locator('[data-testid="home-journey"]').scrollIntoViewIfNeeded(); await A.page.screenshot({ path: `${SHOTS}/13-home-card-active.png` }); }

// ══ L: offline, before Our Journey was ever opened ═══════════════════════════
const D = await phone('Dana', 'me');
await seedPersonal(D, 'me', 'SECRET-DANA');
await D.context.setOffline(true);
await D.page.locator('[data-testid="home-journey"] .jr-home-btn').click();
check('L: offline, opening Our Journey for the first time says it needs a connection',
  await sees(D, '[data-testid="journey-unavailable"]') && /needs a connection/.test(await text(D, '[data-testid="journey-unavailable"]')));
await D.page.click('[data-testid="journey-unavailable"] .ps-back');
await gotoTab(D.page, 'Today');
await D.page.locator('.daily-log-card .rating-row', { hasText: 'Mood' }).locator('.rating-track').fill('7');
await D.page.waitForTimeout(300);
check('L: …and personal Forge carries on, offline: Today logs as usual',
  await D.page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('allDays')).me).some(d => d.mood === 7)));
await D.context.setOffline(false);
await D.context.close();

const errs = [...A.errors, ...B.errors, ...C.errors].filter(e => !/favicon|manifest|service worker|sw\.js/i.test(e));
check('no page errors on any phone', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close();
build.stop();
await gateway.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
