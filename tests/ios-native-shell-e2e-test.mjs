/**
 * The iPhone app (Capacitor) and the web app, from the same production build.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/ios-native-shell-e2e-test.mjs
 *
 * Part A runs the build as the web app and checks that nothing the iPhone app
 * needed changed it: the service worker, the Home Screen and update sections,
 * the notification guidance, the backup download, and that no Capacitor code
 * is ever loaded.
 *
 * Part B runs the same build inside a simulated native shell. It recreates what
 * the iPhone app's web view gives the page before any script runs — the
 * `window.webkit.messageHandlers.bridge` Capacitor recognises iOS by, the
 * native plugin list, and `nativePromise`, the call into Swift — and answers
 * those calls from the test, recording them. It checks a fresh start, no service
 * worker, no Web Push or /api traffic, the web-only sections hidden, honest
 * notification copy, the backup going through Filesystem + Share instead of a
 * download, restore, both profiles, reloads and every tab.
 *
 * What a browser cannot prove — signing, safe areas on a real notch, the
 * keyboard, the real share sheet, the camera, storage surviving an app kill —
 * is listed in IOS.md as checks for a real iPhone.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const LS_KEYS = ['profiles', 'allDays', 'activeProfile', 'quoteData', 'experiments', 'dismissedHints', 'archives', 'notifPrefs', 'weeklyReflections'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// The app names the file from the UTC date, as it always has.
const backupName = () => `75hard-backup-${new Date().toISOString().slice(0, 10)}.json`;

// The chunks the main bundle loads only on demand. Today those are exactly the
// Capacitor plugins, so the web app must never request one.
const indexHtml = await (await fetch(BASE + '/')).text();
const mainSrc = indexHtml.match(/<script[^>]+src="([^"]+\.js)"/)[1];
const mainJs = await (await fetch(BASE + mainSrc)).text();
const lazyChunks = JSON.parse((mainJs.match(/m\.f=(\[[^\]]*\])/) || [, '[]'])[1]).filter(f => f.endsWith('.js'));
check('setup: the build has lazily loaded chunks to watch', lazyChunks.length >= 2, lazyChunks.join(', '));

// ── What the iPhone app's native shell provides (simulated) ──────────────────
function nativeShell() {
  window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
  const calls = [];
  window.__nativeCalls = calls;
  window.__shareBehaviour = 'complete';
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    PluginHeaders: [
      { name: 'Filesystem', methods: ['writeFile', 'readFile', 'deleteFile', 'getUri', 'stat', 'mkdir', 'readdir'].map(name => ({ name, rtype: 'promise' })) },
      { name: 'Share', methods: [{ name: 'share', rtype: 'promise' }, { name: 'canShare', rtype: 'promise' }] },
    ],
    nativePromise(plugin, method, options) {
      calls.push({ plugin, method, options: JSON.parse(JSON.stringify(options || {})) });
      if (plugin === 'Filesystem' && method === 'writeFile') {
        return Promise.resolve({ uri: `file:///var/mobile/Containers/Data/Application/TEST/Library/Caches/${options.path}` });
      }
      if (plugin === 'Share' && method === 'share') {
        // The plugin's own words when the sheet is dismissed, or fails.
        if (window.__shareBehaviour === 'cancel') return Promise.reject(new Error('Share canceled'));
        if (window.__shareBehaviour === 'fail') return Promise.reject(new Error('Error sharing item'));
        return Promise.resolve({ activityType: 'com.apple.DocumentManagerUICore.SaveToFiles' });
      }
      return Promise.reject(new Error(`unexpected native call ${plugin}.${method}`));
    },
    nativeCallback() { throw new Error('no callback-style native calls are expected'); },
  };
}

const browser = await chromium.launch();

async function session({ native }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true,
  });
  if (native) await context.addInitScript(nativeShell);
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => requests.push(r.url()));
  return { context, page, errors, requests };
}

async function gotoTab(page, name) {
  await page.locator(`.bottom-nav .nav-tab[aria-label="${name}"]`).click();
  await page.waitForTimeout(250);
}
const settingsTitles = (page) => page.$$eval('.section-title', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
const storage = (page) => page.evaluate((keys) => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), LS_KEYS);

// ═════════════════════════════════════════════════════════════════════════════
// A. The web app is unchanged
// ═════════════════════════════════════════════════════════════════════════════
{
  const { context, page, errors, requests } = await session({ native: false });
  await page.goto(BASE);
  await page.waitForSelector('.profile-selector', { timeout: 8000 });
  check('A1: a first visit starts at the profile picker', (await page.locator('.profile-card').count()) === 2);
  await page.locator('.profile-card.me').click();
  await page.waitForSelector('.dashboard', { timeout: 5000 });

  check('A2: the web app never defines window.Capacitor', await page.evaluate(() => typeof window.Capacitor === 'undefined'));
  const reg = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then(r => r.active?.scriptURL || r.installing?.scriptURL || 'registered'),
    new Promise(res => setTimeout(() => res(null), 8000)),
  ]));
  check('A3: the service worker still registers on the web', !!reg && /sw\.js/.test(reg), String(reg));

  await gotoTab(page, 'Settings');
  const titles = await settingsTitles(page);
  check('A4: Settings still shows "Add to iPhone Home Screen"', titles.some(t => /Add to iPhone Home Screen/.test(t)));
  check('A4: and "App Updates" with Check for Updates', titles.some(t => /App Updates/.test(t)) && (await page.getByRole('button', { name: 'Check for Updates' }).count()) === 1);
  check('A4: the backup text is the web one', /Export saves all your progress to a file\./.test(await page.textContent('.settings-view, main')));
  const notifText = await page.locator('.section-title', { hasText: 'Notifications' }).locator('xpath=..').innerText();
  check('A5: notifications keep the web guidance', /Install Forge on your Home Screen and enable notifications/.test(notifText));
  check('A5: and show no iPhone-app note', (await page.locator('[data-testid="native-notif-note"]').count()) === 0);
  check('A5: the status chip is a web one', ['Unsupported', 'Not requested', 'Enabled', 'Denied'].includes(await page.locator('.notif-status-chip').textContent()), await page.locator('.notif-status-chip').textContent());

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.getByRole('button', { name: /Export \/ Backup Data/ }).click(),
  ]);
  check('A6: Export still downloads a file on the web', download.suggestedFilename() === backupName(), download.suggestedFilename());
  const fs = await import('node:fs');
  const body = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  const ls = await storage(page);
  check('A6: holding exactly what is stored', LS_KEYS.every(k => (ls[k] == null ? body[k] === undefined : JSON.stringify(body[k]) === JSON.stringify(JSON.parse(ls[k])))));
  check('A7: the web app requested none of the Capacitor chunks', !requests.some(u => lazyChunks.some(c => u.endsWith('/' + c))));
  check('A8: no errors on the web', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ═════════════════════════════════════════════════════════════════════════════
// B. The iPhone app (simulated native shell)
// ═════════════════════════════════════════════════════════════════════════════
const { context, page, errors, requests } = await session({ native: true });
const calls = () => page.evaluate(() => window.__nativeCalls);
await page.goto(BASE);
await page.waitForSelector('.profile-selector', { timeout: 8000 });
check('B1: the app starts fresh, at the profile picker', (await page.locator('.profile-card').count()) === 2);
check('B1: with nothing stored yet', await page.evaluate(() => localStorage.getItem('allDays') === null && localStorage.getItem('archives') === null));
check('B2: the page recognises the iPhone app', await page.evaluate(() => window.Capacitor.isNativePlatform() === true && window.Capacitor.getPlatform() === 'ios'));

await page.locator('.profile-card.me').click();
await page.waitForSelector('.dashboard', { timeout: 5000 });
await page.waitForTimeout(2500);   // registerSW would have run on load by now
check('B3: no service worker is registered in the app', await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length === 0));
check('B3: and none controls the page', await page.evaluate(() => !navigator.serviceWorker.controller));
check('B3: the update banner never appears', (await page.locator('.update-banner').count()) === 0);
check('B4: dark theme background', await page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(13, 13, 20)'));

for (const tab of ['Today', 'Insights', 'Challenges', 'Settings', 'Home']) {
  await gotoTab(page, tab);
  check(`B5: the ${tab} tab opens`, (await page.locator('.main-content').count()) === 1 && (await page.locator(`.bottom-nav .nav-tab.active[aria-label="${tab}"]`).count()) === 1);
}

// Start Forge Daily as a new user would, and log something, so there is real
// progress to persist, back up and restore.
await gotoTab(page, 'Home');
const startDaily = page.locator('button', { hasText: 'Start Forge Daily' }).first();
check('B6: a new profile can start Forge Daily', (await startDaily.count()) === 1);
await startDaily.click();
await page.waitForTimeout(700);
await gotoTab(page, 'Today');
await page.waitForSelector('.daily-view', { timeout: 5000 });
const firstItem = page.locator('.check-item').first();
const hasTask = (await firstItem.count()) > 0;
if (hasTask) { await firstItem.click(); await page.waitForTimeout(300); }
const ticked = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('allDays') || '{}').me || {};
  return Object.values(d).some(day => Object.values(day.tasks || {}).some(Boolean));
});
check('B6: progress is saved in the app', hasTask && ticked);

// ── Settings: web-only sections hidden ──
await gotoTab(page, 'Settings');
const titles = await settingsTitles(page);
check('B7: no "Add to iPhone Home Screen" section', !titles.some(t => /Add to iPhone Home Screen/.test(t)));
check('B7: no "App Updates" section or Check for Updates', !titles.some(t => /App Updates/.test(t)) && (await page.getByRole('button', { name: 'Check for Updates' }).count()) === 0);
check('B7: the version is still shown', titles.some(t => /App Version/.test(t)) && /v\d+\.\d+\.\d+/.test(await page.locator('.section-title', { hasText: 'App Version' }).locator('xpath=..').innerText()));
check('B7: Backup & Restore is still there', titles.some(t => /Backup/.test(t)) && (await page.getByRole('button', { name: /Import \/ Restore Data/ }).count()) === 1);
check('B7: and explains Save to Files', /choose Save to Files to keep your backup/.test(await page.locator('.section-title', { hasText: 'Backup' }).locator('xpath=..').innerText()));

// ── Notifications: honest about the app ──
const notifBox = page.locator('.section-title', { hasText: 'Notifications' }).locator('xpath=..');
let notifText = await notifBox.innerText();
check('B8: the iPhone-app note is shown', (await page.locator('[data-testid="native-notif-note"]').count()) === 1 && /aren.t available in the iPhone app yet/.test(notifText));
check('B8: the status reads "Not in the app yet"', (await notifBox.locator('.notif-status-chip').textContent()) === 'Not in the app yet');
check('B8: no Home Screen or Safari advice', !/Home Screen|Safari|installed Forge app/.test(notifText));
check('B8: no "This device" push checklist', !/This device|Push API available/.test(notifText));
check('B8: no VAPID or server wording', !/VAPID|SETUP-PUSH|server/i.test(notifText));
check('B8: no Enable Notifications button', (await page.getByRole('button', { name: /Enable Notifications/ }).count()) === 0);
await notifBox.locator('.settings-row', { hasText: 'Master switch' }).locator('.toggle-btn').click();
await page.waitForTimeout(400);
notifText = await notifBox.innerText();
check('B9: reminder choices can still be set and are saved', await page.evaluate(() => JSON.parse(localStorage.getItem('notifPrefs')).me.masterEnabled === true) && /Quiet hours/.test(notifText));
check('B9: but there are no test-notification buttons', !/Send Test Notification|Background Test Push|Test Background Push/.test(notifText));

// ── Messages from your past self ──
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.pastSelf = { messages: [{ id: 'msg_native_1', text: 'Keep going.', enabled: true, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }] };
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 5000 });
await gotoTab(page, 'Settings');
await page.locator('[data-testid="settings-past-self"] .ps-settings-btn').click();
await page.waitForSelector('[data-testid="past-self-delivery"]', { timeout: 5000 });
check('B10: past-self delivery says the app cannot notify yet', /The iPhone app can’t show notifications yet\./.test(await page.locator('[data-testid="delivery-capability"]').innerText()));
await page.locator('[data-testid="past-self-delivery"] [role="switch"][aria-label="Send me messages from my past self"]').click();
await page.waitForTimeout(300);
const paneText = await page.locator('[data-testid="past-self-delivery"]').innerText();
check('B10: switching it on explains why it cannot', /The iPhone app can’t send notifications yet, so there is nothing to switch on here\./.test(paneText));
check('B10: and it stays off', await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.pastSelf?.delivery?.enabled !== true));
check('B10: no Home Screen advice there either', !/Home Screen/.test(paneText));
await page.getByRole('button', { name: /Back/ }).first().click().catch(() => {});
await page.waitForTimeout(300);

// ── Backup: written to the app's cache and handed to the share sheet ──
await gotoTab(page, 'Settings');
let downloaded = false;
page.on('download', () => { downloaded = true; });
const before = (await calls()).length;
await page.getByRole('button', { name: /Export \/ Backup Data/ }).click();
await page.waitForFunction((n) => window.__nativeCalls.length >= n + 2, before, { timeout: 5000 }).catch(() => {});
const exportCalls = (await calls()).slice(before);
const write = exportCalls.find(c => c.plugin === 'Filesystem' && c.method === 'writeFile');
const share = exportCalls.find(c => c.plugin === 'Share' && c.method === 'share');
check('B11: the backup is written with Filesystem.writeFile', !!write);
check('B11: named as on the web, into the cache folder, as UTF-8', write?.options.path === backupName() && write?.options.directory === 'CACHE' && write?.options.encoding === 'utf8', JSON.stringify(write && { ...write.options, data: undefined }));
const exported = write ? JSON.parse(write.options.data) : {};
const lsNow = await storage(page);
check('B11: holding exactly what is stored, same format as the web backup',
  LS_KEYS.every(k => (lsNow[k] == null ? exported[k] === undefined : JSON.stringify(exported[k]) === JSON.stringify(JSON.parse(lsNow[k])))) && write?.options.data === JSON.stringify(exported, null, 2));
check('B11: then offered to the share sheet as that file', !!share && JSON.stringify(share.options.files) === JSON.stringify([`file:///var/mobile/Containers/Data/Application/TEST/Library/Caches/${backupName()}`]));
check('B11: in that order', exportCalls.indexOf(write) < exportCalls.indexOf(share));
check('B11: no browser download is attempted', !downloaded);
await page.waitForTimeout(300);
check('B11: no error is shown', (await page.getByText('Couldn’t create the backup file', { exact: false }).count()) === 0 && (await page.getByText("Couldn't create the backup file", { exact: false }).count()) === 0);
check('B11: the button is ready again', await page.getByRole('button', { name: /Export \/ Backup Data/ }).isEnabled());

await page.evaluate(() => { window.__shareBehaviour = 'cancel'; });
await page.getByRole('button', { name: /Export \/ Backup Data/ }).click();
await page.waitForTimeout(500);
check('B12: closing the share sheet is not reported as an error', (await page.locator('.update-status-row.warn').count()) === 0);
await page.evaluate(() => { window.__shareBehaviour = 'fail'; });
await page.getByRole('button', { name: /Export \/ Backup Data/ }).click();
await page.waitForTimeout(500);
check('B12: a real failure is reported', /Couldn.t create the backup file/.test(await page.locator('.section-title', { hasText: 'Backup' }).locator('xpath=..').innerText()));
await page.evaluate(() => { window.__shareBehaviour = 'complete'; });

// ── Restore: the same file picker reads the backup back ──
const restored = JSON.parse(JSON.stringify(exported));
restored.profiles.me.name = 'Restored In App';
await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({
  name: backupName(), mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored, null, 2)),
});
await page.waitForSelector('text=Restored! Reloading…', { timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1800);
await page.waitForSelector('.dashboard', { timeout: 8000 });
check('B13: restoring a backup works in the app', await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.name === 'Restored In App'));
check('B13: and keeps the logged progress', await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('allDays') || '{}').me || {};
  return Object.values(d).some(day => Object.values(day.tasks || {}).some(Boolean));
}));

// ── Both profiles, each with its own accent; everything survives reloads ──
await gotoTab(page, 'Settings');
await page.locator('.section-title', { hasText: 'Switch Profile' }).locator('xpath=..').locator('button').first().click();
await page.waitForTimeout(400);
check('B14: switching to the second profile', (await page.locator('.app[data-profile="girlfriend"]').count()) === 1);
check('B14: with its own accent', await page.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--accent').trim().toUpperCase() === '#EC4899'));
check('B14: and its own, empty data', await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('allDays') || '{}').girlfriend || {};
  return !Object.values(d).some(day => Object.values(day.tasks || {}).some(Boolean));
}));
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 5000 });
check('B15: the active profile survives a reload', (await page.locator('.app[data-profile="girlfriend"]').count()) === 1);
await gotoTab(page, 'Settings');
await page.locator('.section-title', { hasText: 'Switch Profile' }).locator('xpath=..').locator('button').first().click();
await page.waitForTimeout(400);
check('B15: switching back keeps the first profile’s accent', await page.evaluate(() => getComputedStyle(document.querySelector('.app')).getPropertyValue('--accent').trim().toUpperCase() === '#8B5CF6'));
check('B15: and its progress', await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('allDays') || '{}').me || {};
  return Object.values(d).some(day => Object.values(day.tasks || {}).some(Boolean));
}));
check('B15: notification choices survive too', await page.evaluate(() => JSON.parse(localStorage.getItem('notifPrefs')).me.masterEnabled === true));

// ── Nothing web-only ran ──
check('B16: the app made no /api requests (no Web Push sync)', !requests.some(u => /\/api\//.test(new URL(u).pathname)), requests.filter(u => /\/api\//.test(u)).join(', '));
check('B16: no service worker script was fetched', !requests.some(u => /\/sw\.js(\?|$)/.test(u)));
check('B16: the Capacitor chunks were loaded only for the backup', lazyChunks.every(c => requests.some(u => u.endsWith('/' + c))));
check('B17: no errors in the app', errors.length === 0, errors.join(' | '));
check('B17: only the expected native calls were made', (await calls()).every(c => (c.plugin === 'Filesystem' && c.method === 'writeFile') || (c.plugin === 'Share' && c.method === 'share')));

await context.close();
await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL ${f.name}${f.extra ? ' — ' + f.extra : ''}`);
  process.exit(1);
}
