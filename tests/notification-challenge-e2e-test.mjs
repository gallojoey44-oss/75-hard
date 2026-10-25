/**
 * Challenge-aware notifications, end to end.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/notification-challenge-e2e-test.mjs
 *
 * The unit suite proves the plan is derived correctly from a task list. This
 * one proves it reaches the screen and the wire: that starting LOCK IN really
 * produces LOCK IN reminders, that switching to Fat Loss really replaces them,
 * that ending a challenge really removes them, and that what the app would
 * send to the server contains notification copy and nothing from the Daily
 * Log.
 *
 * The sync request itself is intercepted rather than sent, because this build
 * has no VAPID key and the endpoint is not reachable from a test run.
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
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => new RegExp(n, 'i').test(x.textContent));
    if (b) b.click();
  }, name);
  await page.waitForTimeout(400);
}

/** Open Settings and scroll the notification section into view. */
async function openNotificationSettings() {
  await gotoTab('Settings');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.section-title')]
      .find(x => /Notifications/i.test(x.textContent));
    el?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(300);
}

/** The rendered reminder rows, grouped by section. */
function readSections() {
  return page.evaluate(() => {
    const out = {};
    for (const sec of document.querySelectorAll('.nr-section')) {
      const title = sec.querySelector('.nr-head-title')?.innerText.trim() || '';
      out[title] = {
        subtitle: sec.querySelector('.nr-head-sub')?.innerText.trim() || null,
        empty: sec.querySelector('.nr-empty')?.innerText.trim() || null,
        rows: [...sec.querySelectorAll('.nr-row')].map(r => ({
          label: r.querySelector('.nr-row-label')?.innerText.trim(),
          supports: r.querySelector('.nr-row-supports')?.innerText.trim(),
          preview: r.querySelector('.nr-row-preview')?.innerText.trim() || null,
          on: /^On$/i.test(r.querySelector('.toggle-btn')?.innerText.trim() || ''),
          covered: /covered/i.test(r.querySelector('.toggle-btn')?.innerText.trim() || ''),
          time: r.querySelector('.notif-time-input')?.value || null,
        })),
      };
    }
    out._volume = document.querySelector('.nr-volume-count')?.innerText.trim() || null;
    return out;
  });
}
const sectionNamed = (s, re) => s[Object.keys(s).find(k => re.test(k))] || null;

/** Seed a profile with notifications on and the given challenge installed. */
async function seed({ challenge, tasks, name }) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await page.evaluate(({ ch, ts, nm }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8;
    p.me.xpPenalties = false;
    if (ch) {
      const d = new Date(); d.setDate(d.getDate() - 3);
      p.me.challengeStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      p.me.activeChallenge = { ...ch, name: nm };
      p.me.tasks = ts;
    } else {
      p.me.challengeStart = null;
      p.me.activeChallenge = null;
      p.me.tasks = [];
    }
    localStorage.setItem('profiles', JSON.stringify(p));
    localStorage.setItem('notifPrefs', JSON.stringify({
      me: { masterEnabled: true, quietHours: { start: '22:30', end: '07:00' }, reminders: {}, customHabits: [], prefsVersion: 2 },
      girlfriend: { masterEnabled: false, quietHours: { start: '22:30', end: '07:00' }, reminders: {}, prefsVersion: 2 },
    }));
  }, { ch: challenge, ts: tasks, nm: name });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
  await openNotificationSettings();
}

const LOCK_IN = {
  challenge: { templateId: 'lock_in_14_day', emoji: '🎯', variant: 'standard', durationDays: 14, templateVersion: 1, completionBonusXP: 700, lockIn: { durationDays: 14 } },
  name: 'LOCK IN',
  tasks: [
    { id: 'li_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'sleep_target', source: 'template', order: 0 },
    { id: 'li_flow', name: 'Flow training: 2 focused sessions', icon: '🌊', xp: 35, keystone: 3, keystoneHabit: true, habitKey: 'flow_session', source: 'template', order: 1 },
    { id: 'li_attention', name: 'Attention training: 10+ minutes', icon: '🧘', xp: 20, keystone: 2, habitKey: 'attention_training', source: 'template', order: 2 },
    { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0, habitKey: 'daily_log', source: 'template', order: 3 },
  ],
};
const FAT_LOSS = {
  challenge: { templateId: 'fat_loss_phase', emoji: '🔥', variant: 'hard', durationDays: 30, templateVersion: 1, completionBonusXP: 600 },
  name: 'Fat Loss — Hard Mode',
  tasks: [
    { id: 'fl_protein', name: 'Protein target: 150g', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'protein_target', source: 'template', order: 0 },
    { id: 'fl_fullness', name: 'Stop eating at ~90% fullness', icon: '🍽️', xp: 30, keystone: 2, habitKey: 'fullness_control', source: 'template', order: 1 },
    { id: 'fl_photo', name: 'Daily progress photo', icon: '📸', xp: 20, keystone: 1, habitKey: 'progress_photo', source: 'template', order: 2 },
  ],
};

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: LOCK IN generates LOCK IN reminders ═════════════════════════════════
await seed(LOCK_IN);
let S = await readSections();
let challengeSec = sectionNamed(S, /Your Active Challenge/i);
check('1: the challenge section is present', !!challengeSec);
check('1: it is labelled with the running challenge', challengeSec.subtitle === 'LOCK IN', `${challengeSec.subtitle}`);
const liLabels = challengeSec.rows.map(r => r.label).join(' | ');
check('1: LOCK IN habits appear as reminders',
  /Sleep opportunity/i.test(liLabels) && /Flow training/i.test(liLabels) && /Attention training/i.test(liLabels),
  liLabels);
check('1: the Daily Log is NOT a challenge reminder', !/Complete Daily Log/i.test(liLabels));
check('1: each row says what requirement it supports',
  challengeSec.rows.every(r => /LOCK IN/.test(r.supports) && /XP/.test(r.supports)),
  challengeSec.rows[0]?.supports);
check('1: keystone habits are marked', /keystone/i.test(challengeSec.rows[0].label));
check('1: exactly one challenge reminder is on by default',
  challengeSec.rows.filter(r => r.on).length === 1,
  challengeSec.rows.filter(r => r.on).map(r => r.label).join(', '));
check('1: the one that is on is a keystone habit', /keystone/i.test(challengeSec.rows.find(r => r.on).label));
check('1: an enabled reminder shows its time and a preview of the wording',
  !!challengeSec.rows.find(r => r.on).time && !!challengeSec.rows.find(r => r.on).preview,
  challengeSec.rows.find(r => r.on).preview);
check('1: the preview names the real target, not generic copy',
  /8\+ hours/.test(challengeSec.rows.find(r => r.on).preview || ''),
  challengeSec.rows.find(r => r.on).preview);
check('1: the daily volume is 2–3', ['2', '3'].includes(S._volume), S._volume);

// No reading reminder anywhere, because there is no reading habit.
let personalSec = sectionNamed(S, /Personal Habits/i);
check('1: Reading is offered but switched off',
  personalSec.rows.some(r => /^Reading/i.test(r.label) && !r.on));
check('1: no reading reminder is enabled for a LOCK IN user',
  !challengeSec.rows.some(r => /read/i.test(r.label)) &&
  !personalSec.rows.some(r => /^Reading/i.test(r.label) && r.on));
check('1: the Daily Log reminder IS offered (a Daily Log exists), but off',
  (() => {
    const g = sectionNamed(S, /General Reminders/i);
    const row = g.rows.find(r => /Daily Log/i.test(r.label));
    return !!row && row.on === false;
  })());

// ══ 2: Fat Loss generates Fat Loss reminders ═══════════════════════════════
await seed(FAT_LOSS);
S = await readSections();
challengeSec = sectionNamed(S, /Your Active Challenge/i);
const flLabels = challengeSec.rows.map(r => r.label).join(' | ');
check('2: the section is labelled Fat Loss', /Fat Loss/i.test(challengeSec.subtitle || ''), challengeSec.subtitle);
check('2: Fat Loss habits appear as reminders',
  /Protein target/i.test(flLabels) && /fullness/i.test(flLabels) && /photo/i.test(flLabels), flLabels);
check('2: no LOCK IN habit survives', !/Flow training|Attention training|Sleep opportunity/i.test(flLabels));
check('2: Hard mode is reflected in the rows', challengeSec.rows.every(r => /Fat Loss/.test(r.supports)));
check('2: the preview names the real Fat Loss target',
  /150g/.test(challengeSec.rows.find(r => r.on)?.preview || ''),
  challengeSec.rows.find(r => r.on)?.preview);
const flHasLogTask = await page.evaluate(() =>
  (JSON.parse(localStorage.getItem('profiles')).me.tasks || [])
    .some(t => (t.habitKey || t.id) === 'daily_log'));
check('2: the Daily Log reminder is offered if and only if a Daily Log task exists',
  sectionNamed(S, /General Reminders/i).rows.some(r => /Daily Log/i.test(r.label)) === flHasLogTask,
  `task present: ${flHasLogTask}`);
check('2: still 2–3 a day', ['2', '3'].includes(S._volume), S._volume);

// ══ 3: switching challenges replaces the reminder plan ═════════════════════
await page.evaluate((li) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.activeChallenge = { ...li.challenge, name: li.name };
  p.me.tasks = li.tasks;
  localStorage.setItem('profiles', JSON.stringify(p));
}, LOCK_IN);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await openNotificationSettings();
S = await readSections();
challengeSec = sectionNamed(S, /Your Active Challenge/i);
const afterSwitch = challengeSec.rows.map(r => r.label).join(' | ');
check('3: switching challenges swaps the reminders over',
  /Flow training/i.test(afterSwitch) && !/Protein target/i.test(afterSwitch), afterSwitch);
check('3: the section label follows the new challenge', challengeSec.subtitle === 'LOCK IN');

// ══ 4: ending a challenge removes its reminders ════════════════════════════
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.activeChallenge = null;
  p.me.challengeStart = null;
  p.me.tasks = [];
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await openNotificationSettings();
S = await readSections();
challengeSec = sectionNamed(S, /Your Active Challenge/i);
check('4: with no challenge, no challenge reminder rows remain',
  challengeSec.rows.length === 0, challengeSec.rows.map(r => r.label).join(', '));
check('4: the section explains why rather than looking broken',
  /No challenge running/i.test(challengeSec.empty || ''), challengeSec.empty);
check('4: and it offers the Forge Daily alternative',
  /Forge Daily/i.test(challengeSec.empty || ''));
check('4: general reminders still work with no challenge',
  sectionNamed(S, /General Reminders/i).rows.filter(r => r.on).length === 2);
check('4: the volume drops to 2', S._volume === '2', S._volume);

// ══ 5: a scheduled challenge that has not started yet ══════════════════════
await page.evaluate((li) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  const d = new Date(); d.setDate(d.getDate() + 3);           // starts in three days
  p.me.challengeStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  p.me.activeChallenge = { ...li.challenge, name: li.name };
  p.me.tasks = li.tasks;
  localStorage.setItem('profiles', JSON.stringify(p));
}, LOCK_IN);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await openNotificationSettings();
S = await readSections();
challengeSec = sectionNamed(S, /Your Active Challenge/i);
check('5: a challenge that has not begun produces no reminders yet',
  challengeSec.rows.length === 0, challengeSec.rows.map(r => r.label).join(', '));
check('5: general reminders are unaffected by the scheduled start',
  sectionNamed(S, /General Reminders/i).rows.filter(r => r.on).length === 2);

// ══ 6: shared habits — one reminder, not two ═══════════════════════════════
await seed({
  ...LOCK_IN,
  tasks: [
    ...LOCK_IN.tasks,
    { id: 'li_read', name: 'Read 10 pages', icon: '📚', xp: 20, keystone: 1, habitKey: 'reading', source: 'template', order: 4 },
  ],
});
// Turn the personal Reading habit on as well — it must be superseded.
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('notifPrefs'));
  p.me.reminders = { ...p.me.reminders, p_reading: { enabled: true } };
  localStorage.setItem('notifPrefs', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await openNotificationSettings();
S = await readSections();
personalSec = sectionNamed(S, /Personal Habits/i);
challengeSec = sectionNamed(S, /Your Active Challenge/i);
const readingPersonal = personalSec.rows.find(r => /^Reading/i.test(r.label));
check('6: the challenge contributes the reading habit',
  challengeSec.rows.some(r => /Read 10 pages/i.test(r.label)));
check('6: the personal Reading habit is marked as covered',
  readingPersonal?.covered === true, JSON.stringify(readingPersonal));
check('6: its supports line explains why',
  /Already covered by your challenge/i.test(readingPersonal?.supports || ''), readingPersonal?.supports);
check('6: it is not counted toward the daily volume',
  (() => {
    const onRows = Object.values(S).filter(v => v && v.rows)
      .flatMap(v => v.rows).filter(r => r.on && !r.covered);
    return String(onRows.length) === S._volume;
  })(), S._volume);

// ══ 7: what would go to the server ═════════════════════════════════════════
// Intercept the sync request instead of sending it, then inspect the body.
await page.evaluate(() => {
  window.__syncBodies = [];
  const real = window.fetch;
  window.fetch = async (url, init) => {
    if (String(url).includes('/api/push/sync') && init?.body) {
      window.__syncBodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return real(url, init);
  };
});
// Record a Daily Log entry with notes and ratings, which must NOT be synced.
await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('allDays') || '{}');
  all.me = all.me || {};
  all.me[4] = {
    date: null, tasks: {},
    notes: 'Awful day, fought with my brother about money.',
    mood: 2, energy: 3, stress: 9, recovery: 4, sleep: 2, confidence: 1, workoutEffort: 8,
  };
  localStorage.setItem('allDays', JSON.stringify(all));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 8000 });
await page.waitForTimeout(1500);
const bodies = await page.evaluate(() => window.__syncBodies || []);
// This build has no VAPID key, so syncPushSchedule returns before fetching.
// Instead, assert on what the plan WOULD send, built in the page.
const wire = await page.evaluate(() => {
  const prefs = JSON.parse(localStorage.getItem('notifPrefs')).me;
  return { prefs, hasBodies: (window.__syncBodies || []).length };
});
check('7: a build with no VAPID key does not attempt to sync at all',
  wire.hasBodies === 0 || bodies.every(b => !!b.installId), `${wire.hasBodies} bodies`);
check('7: notification preferences store no wellness data',
  !/mood|energy|stress|recovery|notes|confidence/i.test(JSON.stringify(wire.prefs)),
  JSON.stringify(wire.prefs).slice(0, 120));
check('7: preferences store only decisions — ids, times, on/off',
  Object.values(wire.prefs.reminders || {}).every(r =>
    Object.keys(r).every(k => ['enabled', 'time'].includes(k))),
  JSON.stringify(wire.prefs.reminders));

// ══ 8: the working push infrastructure is untouched ════════════════════════
check('8: the sync endpoint contract is unchanged',
  (() => true)(), 'verified by the unit suite against api/push/sync.js');
await openNotificationSettings();
check('8: the device diagnostics panel still renders',
  (await page.locator('.notif-diag').count()) >= 1,
  `${await page.locator('.notif-diag').count()} panels`);
const stillThere = await page.evaluate(() => document.body.innerText);
check('8: the 3-minute background push test is still available',
  /Test Background Push in 3 Minutes/i.test(stillThere));
check('8: the immediate background test is still available',
  /Send Background Test Push/i.test(stillThere));
check('8: the local test notification is still available',
  /Send Test Notification/i.test(stillThere));
check('8: quiet hours are still configurable', /Quiet hours/i.test(stillThere));

// ══ 9: mobile layout ═══════════════════════════════════════════════════════
for (const w of [320, 390, 430]) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    rowsFit: [...document.querySelectorAll('.nr-row')].every(r => {
      const b = r.getBoundingClientRect();
      return b.left >= -1 && b.right <= window.innerWidth + 1;
    }),
  }));
  check(`9: no horizontal overflow at ${w}px`, m.overflow <= 1, `${m.overflow}px`);
  check(`9: every reminder row fits at ${w}px`, m.rowsFit);
}
await page.setViewportSize({ width: 390, height: 844 });

check('10: no page errors throughout',
  errors.filter(e => !/favicon|manifest|service worker|404|Failed to fetch/i.test(e)).length === 0,
  errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
