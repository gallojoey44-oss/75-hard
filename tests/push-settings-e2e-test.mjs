/**
 * Notification settings — the diagnostics the user needs in order to answer
 * "why am I getting nothing?" without reading any code.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/push-settings-e2e-test.mjs
 *
 * This build is made WITHOUT VITE_VAPID_PUBLIC_KEY, which is the exact
 * production misconfiguration that made real background push impossible while
 * the in-app test button kept working. So the first thing asserted is that the
 * UI says so out loud instead of showing a reassuring "push is active".
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab, button')]
      .find(x => new RegExp(n, 'i').test(x.textContent));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(300);
}
const text = () => page.evaluate(() => document.body.innerText);

// ── Seed: notifications on, with a couple of timed reminders ───────────────
await page.goto(BASE);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 5000 });
await page.evaluate(() => {
  const prefs = {
    masterEnabled: true,
    quietHours: { start: '22:30', end: '07:00' },
    reminders: {
      morning: { enabled: true, time: '07:30' },
      water:   { enabled: true, time: '14:00' },
    },
  };
  localStorage.setItem('notifPrefs', JSON.stringify({ me: prefs, girlfriend: prefs }));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Settings');
await page.waitForTimeout(500);

let body = await text();

// ══ 1: the build-time key problem is stated, not hidden ════════════════════
check('1: the notifications section renders', /Notifications/i.test(body));
check('1: a build with no VAPID public key says background push cannot work',
  /cannot work in this build|VAPID public key was missing/i.test(body),
  body.match(/.{0,80}VAPID.{0,80}/)?.[0] || 'no mention');
check('1: it does NOT claim background push is active',
  !/Background push is active/i.test(body));
check('1: it points at the setup document rather than leaving the user guessing',
  /SETUP-PUSH\.md/i.test(body));

// ══ 2: the device panel reports each precondition separately ═══════════════
// One "enabled" chip is what let a Safari tab with permission look ready while
// no push subscription could ever exist.
check('2: the device panel is shown', /This device/i.test(body));
check('2: Home Screen installation is reported', /Installed to Home Screen/i.test(body));
check('2: notification permission is reported', /Notification permission/i.test(body));
check('2: Push API availability is reported separately from permission',
  /Push API available/i.test(body));
check('2: the presence of a real push subscription is reported',
  /Push subscription on device/i.test(body));

const deviceRows = await page.evaluate(() => {
  const panel = [...document.querySelectorAll('.notif-diag')]
    .find(p => /This device/.test(p.textContent));
  if (!panel) return null;
  return [...panel.querySelectorAll('.notif-diag-row')].map(r => r.innerText.replace(/\s+/g, ' ').trim());
});
check('2: the device rows are real rows, not prose', Array.isArray(deviceRows) && deviceRows.length >= 4,
  `${deviceRows?.length || 0} rows`);
check('2: in a desktop browser tab, installation reads as not installed',
  deviceRows?.some(r => /Installed to Home Screen/.test(r) && /No/.test(r)));
check('2: with no subscription it says None rather than implying one exists',
  deviceRows?.some(r => /Push subscription on device/.test(r) && /None/.test(r)));

// ══ 3: existing notification preferences are untouched ═════════════════════
check('3: the master switch is still present', /Master switch for all/i.test(body));
check('3: reminder rows still render', /Morning|Water/i.test(body));
check('3: quiet hours still render', /Quiet hours/i.test(body));
// The in-app-only reminders are below the fold; expand to see both labels.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Show all reminders/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(250);
const expanded = await text();
check('3: the background / in-app labelling is preserved',
  /Background/.test(expanded) && /In-app only/.test(expanded));
const times = await page.evaluate(() =>
  [...document.querySelectorAll('.notif-time-input')].map(i => i.value));
check('3: the saved reminder times are shown, not reset',
  times.includes('07:30') && times.includes('14:00'), times.join(' '));
check('3: the saved quiet hours are shown', times.includes('22:30') && times.includes('07:00'));

// ══ 4: the 3-minute background test exists and is honest about itself ══════
check('4: the 3-minute scheduled test button exists',
  /Test Background Push in 3 Minutes/i.test(body));
check('4: it explains that the app must be closed for the test to mean anything',
  /close Forge and lock your phone/i.test(body));
check('4: it distinguishes itself from the immediate test',
  /only proves the server was reachable while the app was open/i.test(body));
check('4: the original immediate background test is still available',
  /Send Background Test Push/i.test(body));
check('4: the local test notification button is still available',
  /Send Test Notification/i.test(body));

// With no VAPID key in the build, both server tests must be disabled rather
// than failing confusingly.
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('button')]
    .filter(b => /Background Push in 3 Minutes|Send Background Test Push/i.test(b.textContent))
    .map(b => ({ label: b.textContent.trim(), disabled: b.disabled })));
check('4: both server-push tests are disabled when the build has no key',
  buttons.length === 2 && buttons.every(b => b.disabled),
  buttons.map(b => `${b.label}:${b.disabled}`).join(' | '));

// ══ 5: no crashes ══════════════════════════════════════════════════════════
check('5: no page errors while rendering the diagnostics',
  errors.filter(e => !/favicon|manifest|service worker|404/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

// ══ 6: a reminder set inside quiet hours is flagged, not silently swallowed ═
await page.evaluate(() => {
  const prefs = JSON.parse(localStorage.getItem('notifPrefs'));
  prefs.me.reminders.morning = { enabled: true, time: '23:30' };   // inside 22:30–07:00
  localStorage.setItem('notifPrefs', JSON.stringify(prefs));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Settings');
await page.waitForTimeout(400);
body = await text();
check('6: a reminder inside quiet hours is flagged as undeliverable',
  /inside quiet hours/i.test(body));
await page.evaluate(() => {
  const prefs = JSON.parse(localStorage.getItem('notifPrefs'));
  prefs.me.reminders.morning = { enabled: true, time: '07:30' };
  localStorage.setItem('notifPrefs', JSON.stringify(prefs));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab('Settings');
await page.waitForTimeout(400);
body = await text();
check('6: a reminder outside quiet hours carries no warning',
  !/inside quiet hours/i.test(body));

// ══ 7: the panel survives a profile switch ═════════════════════════════════
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /girlfriend|Female|Switch/i.test(x.textContent));
  if (b) b.click();
});
await page.waitForTimeout(400);
await gotoTab('Settings');
await page.waitForTimeout(400);
body = await text();
check('7: the diagnostics render for the other profile too',
  /This device/i.test(body) && /Push subscription on device/i.test(body));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
