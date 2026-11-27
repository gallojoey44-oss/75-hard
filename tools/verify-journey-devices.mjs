#!/usr/bin/env node
/**
 * Two devices, through the app, against a real Supabase project.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node tools/verify-journey-devices.mjs
 *
 * Builds Forge pointed at the project — exactly what Vercel does with the two
 * VITE_ variables — serves it on this machine, and drives two separate browser
 * contexts (two phones: separate storage, separate sessions) through sign-in,
 * friends, a Journey, a shared goal to completion, Our Future and a check-in.
 * Everything one phone does must reach the other through the project alone.
 *
 * No email is sent. When the app asks the project to email a code, that one
 * request is answered on this machine instead; the code the app then accepts
 * is a real one, issued by the project's Auth server through the admin API.
 * The service-role key is used for that and to delete the two throwaway
 * accounts at the end — never by the app, which only ever has the anon key.
 *
 * It also checks that nothing personal leaves either phone, and that each
 * phone's own Forge data and XP are exactly as they were.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = Number(process.env.JOURNEY_CHECK_PORT || 4176);
if (!URL_ || !ANON || !SERVICE) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

// ── Build and serve Forge pointed at the project ───────────────────────────
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vite = join(root, 'node_modules', '.bin', 'vite');
const out = mkdtempSync(join(tmpdir(), 'forge-journey-check-'));
const env = { ...process.env, VITE_SUPABASE_URL: URL_, VITE_SUPABASE_ANON_KEY: ANON };
const built = spawnSync(vite, ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, env, encoding: 'utf8' });
if (built.status !== 0) { console.error(built.stderr || built.stdout); process.exit(1); }
const server = spawn(vite, ['preview', '--outDir', out, '--port', String(PORT), '--strictPort'], { cwd: root, env, stdio: 'ignore' });
const BASE = `http://localhost:${PORT}`;
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ }
  await new Promise(r => setTimeout(r, 300));
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const tag = Math.random().toString(36).slice(2, 7);
const people = {
  a: { email: `forge-check-${tag}-a@example.com`, username: `ja${tag}`, name: 'Alex' },
  b: { email: `forge-check-${tag}-b@example.com`, username: `jb${tag}`, name: 'Blair' },
};
const created = [];
const browser = await chromium.launch();
const SYNC = 30000;

function offset(n) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];

async function phone(name, profile) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const ph = { name, page, context, sent: [], errors: [] };
  page.on('pageerror', e => ph.errors.push(String(e)));
  page.on('request', r => { if (r.url().startsWith(URL_)) ph.sent.push(`${r.method()} ${r.url()}\n${r.postData() || ''}`); });
  // "Email me a code": answered here, so the project sends no email.
  await page.route(/\/auth\/v1\/otp(\?|$)/, (route) => {
    const origin = route.request().headers().origin || BASE;
    const cors = {
      'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS',
    };
    route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{}' });
  });
  await page.goto(BASE);
  await page.evaluate((p) => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify(p)); }, profile);
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 20000 });
  // Each phone's own private Forge data.
  await page.evaluate(({ profile, secret, start }) => {
    const p = JSON.parse(localStorage.getItem('profiles') || '{}');
    if (!p[profile]) throw new Error('no local profile to seed');
    p[profile].challengeStart = start;
    p[profile].xpPenalties = false;
    p[profile].activeChallenge = {
      templateId: 'lock_in_14_day', name: 'LOCK IN', emoji: '🎯', variant: 'standard', durationDays: 14,
      passingScore: 70, keystoneRequirement: 65, xpEconomyVersion: 2, effortTier: 'medium_hard', dailyBudget: 180, completionBonusXP: 504,
    };
    p[profile].tasks = [
      { id: 'li_flow', name: `Flow training ${secret}`, icon: '🌊', xp: 29, keystone: 3, source: 'template', order: 0 },
      { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0, source: 'template', order: 1 },
    ];
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('allDays', JSON.stringify({ [profile]: {
      1: { dayNumber: 1, tasks: { li_flow: true, daily_log: true }, mood: 8, energy: 7, stress: 3, notes: `Private note ${secret}` },
    } }));
  }, { profile, secret: `SECRET-${name.toUpperCase()}`, start: offset(-1) });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 20000 });
  await page.reload();
  await page.waitForSelector('.dashboard', { timeout: 20000 });
  for (let i = 0; i < 3 && (await page.locator('.rankup-skip').count()); i++) await page.locator('.rankup-skip').first().click();
  return ph;
}

const state = (ph) => ph.page.evaluate((keys) => JSON.stringify(Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]))), LS_KEYS);
async function tab(ph, name) {
  await ph.page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')].find(x => new RegExp(`^${n}$`, 'i').test((x.getAttribute('aria-label') || x.textContent || '').trim()));
    if (b) b.click();
  }, name);
  await ph.page.waitForTimeout(300);
  for (let i = 0; i < 3 && (await ph.page.locator('.rankup-skip').count()); i++) await ph.page.locator('.rankup-skip').first().click();
}
const xp = async (ph) => { await tab(ph, 'Home'); return (await ph.page.textContent('.f41-rank-xp-num'))?.trim(); };
const text = (ph, sel) => ph.page.textContent(sel);
const back = (ph) => ph.page.locator('.jr-back').first().click();
async function sees(ph, selector) { try { await ph.page.waitForSelector(selector, { timeout: SYNC }); return true; } catch { return false; } }
async function seesText(ph, needle, scope) {
  try { await ph.page.waitForFunction(([s, n]) => (document.querySelector(s)?.textContent || '').includes(n), [scope, needle], { timeout: SYNC }); return true; } catch { return false; }
}
async function closeCelebration(ph) {
  const c = ph.page.locator('[data-testid="journey-celebration"] button');
  if (await c.count()) await c.first().click().catch(() => {});
}

async function signIn(ph, person) {
  await tab(ph, 'Home');
  await ph.page.locator('[data-testid="home-journey"] .jr-home-btn').click();
  await ph.page.waitForSelector('#jr-email', { timeout: 20000 });
  await ph.page.fill('#jr-email', person.email);
  await ph.page.click('button:has-text("Email me a code")');
  await ph.page.waitForSelector('#jr-code', { timeout: 20000 });
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: person.email });
  if (link.error) throw new Error(`code for ${person.email}: ${link.error.message}`);
  await ph.page.fill('#jr-code', link.data.properties.email_otp);
  await ph.page.click('button:has-text("Sign in")');
  await ph.page.waitForSelector('[data-testid="journey-username"]', { timeout: 20000 });
  await ph.page.fill('#jr-username', person.username);
  await ph.page.fill('#jr-display', person.name);
  await ph.page.click('button:has-text("Continue")');
  await ph.page.waitForSelector('[data-testid="journey-home"]', { timeout: 20000 });
}

let A; let B;
try {
  for (const p of Object.values(people)) {
    const made = await admin.auth.admin.createUser({ email: p.email, email_confirm: true });
    if (made.error) throw new Error(`create ${p.email}: ${made.error.message}`);
    created.push(made.data.user.id);
  }
  A = await phone('Alex', 'me');
  B = await phone('Blair', 'girlfriend');
  const aBefore = await state(A); const bBefore = await state(B);
  const aXP = await xp(A); const bXP = await xp(B);
  check('two phones start with their own private Forge data', aBefore.includes('SECRET-ALEX') && bBefore.includes('SECRET-BLAIR') && /\d/.test(aXP || ''));

  // Accounts
  await signIn(A, people.a);
  await signIn(B, people.b);
  check('each phone signs in with a code from the project and chooses a username',
    (await text(A, '[data-testid="journey-home"]')).includes(`@${people.a.username}`)
      && (await text(B, '[data-testid="journey-home"]')).includes(`@${people.b.username}`));

  // Friends
  await A.page.click('[data-testid="journey-friends-btn"]');
  await A.page.fill('[data-testid="journey-add-friend"] input[aria-label="Username"]', people.b.username);
  await A.page.click('[data-testid="journey-add-friend"] button:has-text("Find")');
  check('an exact username finds the other person', await sees(A, '[data-testid="journey-found"]'));
  await A.page.click('[data-testid="journey-found"] button:has-text("Send request")');
  check('the request reaches the other phone', await seesText(B, '1', '[data-testid="journey-friends-btn"]'));
  await B.page.click('[data-testid="journey-friends-btn"]');
  await B.page.click('[data-testid="journey-incoming"] button:has-text("Accept")');
  check('accepted on one phone, friends on both', await seesText(A, `@${people.b.username}`, '[data-testid="journey-friend-list"]'));

  // Journey
  await back(A); await back(B);
  await A.page.click('[data-testid="journey-start"] button:has-text("Invite")');
  await A.page.click('.jr-sheet button:has-text("Send invitation")');
  check('the invitation reaches the other phone', await sees(B, '[data-testid="journey-invite"]'));
  await B.page.click('[data-testid="journey-invite"] button:has-text("Accept")');
  check('accepted: the Journey is active on both phones',
    await seesText(B, 'You & Alex', '[data-testid="journey-members"]') && await seesText(A, 'You & Blair', '[data-testid="journey-members"]'));

  // A shared goal, to completion
  await A.page.click('[data-testid="journey-new-goal"]');
  await A.page.click('.jr-chip:has-text("Four workouts together")');
  await A.page.click('button:has-text("Suggest to Blair")');
  check('a suggested goal reaches the other phone', await seesText(B, 'Alex suggested this', '[data-testid="journey-goals"]'));
  await B.page.click('[data-testid="journey-goal-row"]');
  await B.page.click('[data-testid="journey-goal-agree"]');
  await B.page.waitForSelector('[data-testid="journey-add-form"]', { timeout: SYNC });
  await B.page.fill('[data-testid="journey-add-form"] input[type="number"]', '2');
  await B.page.click('[data-testid="journey-add-btn"]');
  check('a contribution on one phone shows on the other', await seesText(A, '2', '[data-testid="journey-goal-total"]'));
  await A.page.fill('[data-testid="journey-add-form"] input[type="number"]', '2');
  await A.page.click('[data-testid="journey-add-btn"]');
  check('the combined total completes the goal, celebrated on both phones',
    await sees(A, '[data-testid="journey-celebration"]') && await sees(B, '[data-testid="journey-celebration"]'));
  await closeCelebration(A); await closeCelebration(B);
  await back(A); await back(B);
  check('the milestone is listed on both phones',
    await seesText(A, 'Four workouts together', '[data-testid="journey-milestones"]') && await seesText(B, 'Four workouts together', '[data-testid="journey-milestones"]'));

  // Our Future and a check-in
  await B.page.click('[data-testid="journey-future-btn"]');
  await B.page.click('[data-testid="journey-plan-add"]');
  await B.page.fill('#jr-plan-title', 'Visit Japan');
  await B.page.click('button:has-text("Add to Our Future")');
  await A.page.click('[data-testid="journey-future-btn"]');
  check('an Our Future plan added on one phone shows on the other', await seesText(A, 'Visit Japan', '[data-testid="journey-future"]'));
  await back(A); await back(B);
  await A.page.click('[data-testid="journey-checkin-btn"]');
  await A.page.locator('[data-testid="journey-checkin-mine"] textarea').nth(0).fill('We trained four times');
  await A.page.click('[data-testid="journey-checkin-save"]');
  await B.page.click('[data-testid="journey-checkin-btn"]');
  check('a saved check-in can be read on the other phone', await seesText(B, 'We trained four times', '[data-testid="journey-checkin-theirs"]'));
  await back(A); await back(B);

  // Privacy and personal Forge
  const sent = A.sent.join('\n') + B.sent.join('\n');
  check('no request from either phone carried personal data',
    !/SECRET|Private note|"mood"|"stress"|"energy"|allDays|li_flow/.test(sent), `${A.sent.length + B.sent.length} requests inspected`);
  check('neither phone shows the other\'s personal data',
    !(await A.page.textContent('body')).includes('SECRET-BLAIR') && !(await B.page.textContent('body')).includes('SECRET-ALEX'));
  for (const ph of [A, B]) { await ph.page.reload(); await ph.page.waitForSelector('.dashboard', { timeout: 20000 }); }
  check('each phone\'s own Forge data is exactly as it was', (await state(A)) === aBefore && (await state(B)) === bBefore);
  check('and so is each phone\'s XP', (await xp(A)) === aXP && (await xp(B)) === bXP, `${aXP} / ${bXP}`);
  check('no page errors on either phone', A.errors.length + B.errors.length === 0, [...A.errors, ...B.errors].slice(0, 2).join(' | '));

  // Leaving: gone on both
  await tab(B, 'Home');
  await B.page.locator('[data-testid="home-journey"] .jr-home-btn').click();
  await B.page.waitForSelector('[data-testid="journey-account-btn"]', { timeout: 20000 });
  await B.page.click('[data-testid="journey-account-btn"]');
  await B.page.click('[data-testid="journey-leave"]');
  await B.page.click('.jr-sheet button:has-text("Leave and delete")');
  await tab(A, 'Home');
  await A.page.locator('[data-testid="home-journey"] .jr-home-btn').click();
  check('leaving ends the Journey on both phones', await sees(B, '[data-testid="journey-start"]') && await sees(A, '[data-testid="journey-start"]'));
} catch (err) {
  check('the two-device check ran to the end', false, err.message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`(removed ${created.length} test account${created.length === 1 ? '' : 's'})`);
  await browser.close();
  server.kill();
  rmSync(out, { recursive: true, force: true });
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
