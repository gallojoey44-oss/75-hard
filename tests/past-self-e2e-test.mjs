/**
 * Letters to My Future Self — in a real browser, against the real backend code.
 *
 * Run against a production build:  npx vite preview --port 4173
 * then:                            node tests/past-self-e2e-test.mjs
 *
 * What is real here, and what is not:
 *
 *   REAL  the app, built for production, in Chromium
 *   REAL  its service worker — a push is delivered into it and it shows the
 *         notification, which is then read back from the browser
 *   REAL  /api/push/sync, /subscribe, /unsubscribe, /status and the scheduled
 *         dispatcher, run in-process by the functions that ship
 *   REAL  web-push: VAPID signing and payload encryption. The payload a test
 *         reads has been decrypted with the device's private key
 *   NOT   the browser vendor's push service (the last network hop is caught),
 *         and the browser's PushManager where a test needs a subscription to
 *         exist — headless Chromium cannot create one
 *   NOT   the finger: no automation can tap a notification, so the tap is the
 *         shipped notificationclick handler run in a sandbox on the real
 *         notification's data, and its output handed to the app
 *
 * Two builds are used. The suite's shared build has no VAPID key, which is the
 * state that says "background push cannot work here"; a second build, made
 * with a key and served on its own port, is where delivery is tested.
 *
 * Nothing here depends on the hour it is run at: a time zone is chosen in which
 * it is currently the middle of the day, and both the browser and the
 * dispatcher are simply told that is where the user lives.
 */
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(String(w.stack || w)); });

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const { startPushBuild } = await import('./helpers/pushBuild.mjs');
const { createFakePushApi } = await import('./helpers/fakePushApi.mjs');
const { loadSW, pushEvent } = await import('./helpers/swSandbox.mjs');

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want),
  JSON.stringify(got) === JSON.stringify(want) ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, { timeout = 9000, every = 100 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(every);
  }
}

// ── A time zone where it is the middle of the day right now ─────────────────
function localParts(zone, at = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(at).map(x => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`, hh: Number(p.hour), mm: Number(p.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
  };
}
// Spread round the globe with no gap wider than four hours, so one of them is
// always between 10:00 and 17:59 — clear of midnight and of quiet hours.
const ZONES = ['Pacific/Auckland', 'Asia/Tokyo', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/Berlin', 'UTC',
  'America/Sao_Paulo', 'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu'];
const ZONE = ZONES.find(z => { const h = localParts(z).hh; return h >= 10 && h <= 17; });
const TODAY = localParts(ZONE).date;
const WEEKDAY = localParts(ZONE).weekday;                       // 0 = Sunday
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** 'HH:MM' on the user's clock, `offset` minutes from now. */
function hhmm(offset = 0) {
  const p = localParts(ZONE);
  const t = p.hh * 60 + p.mm + offset;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function zoneDate(n) {
  const [y, m, d] = TODAY.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Which of `n` messages an every-day schedule sends on TODAY — worked out here, not by the app's own function. */
function rotationIndex(n) {
  const [y, m, d] = TODAY.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) % n;
}
console.log(`(user's time zone for this run: ${ZONE}, ${TODAY} ${hhmm()}, ${DAY_NAMES[WEEKDAY]})`);

// ── Things a person wrote, each unmistakable if it turns up anywhere ────────
const LETTER_A = 'LETTER-CANARY-ALPHA I am tired of starting over every Monday.';
const LETTER_B = 'LETTER-CANARY-BRAVO second letter body.';
const MSG = {
  a1: 'MSG-CANARY-A1 Remember why you started.',
  a2: 'MSG-CANARY-A2 Don’t let fear decide — “not today” 🔥',
  a3: 'MSG-CANARY-A3 Become who you promised.',
  off: 'MSG-CANARY-OFF this one is switched off.',
  b1: 'MSG-CANARY-B1 Her first message.',
  b2: 'MSG-CANARY-B2 Her second message.',
};
const ARCHIVED_WHY = 'CHALLENGE-WHY-ARCHIVED To become someone who keeps promises.';
const ACTIVE_WHY = 'CHALLENGE-WHY-ACTIVE Because my son is watching.';
const CANARY = /LETTER-CANARY|MSG-CANARY|CHALLENGE-WHY/;

// ── Browser plumbing ─────────────────────────────────────────────────────────
const VIEWPORT = { width: 390, height: 844 };
const pageErrors = [];

/** Every notification the PAGE asks for is written down, and still shown. */
const RECORD_NOTIFICATIONS = () => {
  const KEY = '__forge_test_shown';
  const original = ServiceWorkerRegistration.prototype.showNotification;
  ServiceWorkerRegistration.prototype.showNotification = function (title, opts) {
    try {
      const list = JSON.parse(sessionStorage.getItem(KEY) || '[]');
      list.push({ title, body: opts?.body, tag: opts?.tag, data: opts?.data || null });
      sessionStorage.setItem(KEY, JSON.stringify(list));
    } catch { /* recording must never break the app */ }
    return original.call(this, title, opts);
  };
};
/** A browser that CAN hold a push subscription: the one given, once asked for. */
const FAKE_PUSH_MANAGER = (sub) => {
  const KEY = '__forge_test_sub';
  const make = () => ({
    endpoint: sub.endpoint, expirationTime: null, toJSON: () => sub,
    unsubscribe: async () => { localStorage.removeItem(KEY); return true; },
  });
  PushManager.prototype.getSubscription = async function () { return localStorage.getItem(KEY) ? make() : null; };
  PushManager.prototype.subscribe = async function () { localStorage.setItem(KEY, '1'); return make(); };
};

function driver(page) {
  page.on('pageerror', e => pageErrors.push(String(e)));
  const d = {
    page,
    ls: (key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key),
    async ps(id = 'me') { return (await d.ls('profiles'))?.[id]?.pastSelf || null; },
    text: () => page.evaluate(() => document.body.innerText),
    async ready() { await page.waitForSelector('.bottom-nav', { timeout: 20000 }); await page.waitForTimeout(350); },
    async fresh(base, profile = 'me') {
      await page.goto(base);
      await page.evaluate((p) => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('activeProfile', JSON.stringify(p));
      }, profile);
      await page.reload();
      await d.ready();
    },
    async reload() { await page.reload(); await d.ready(); },
    async switchProfile(id) {
      await page.evaluate((p) => localStorage.setItem('activeProfile', JSON.stringify(p)), id);
      await d.reload();
    },
    async nav(name) {
      await page.evaluate((n) => [...document.querySelectorAll('.bottom-nav .nav-tab')]
        .find(x => x.getAttribute('aria-label') === n)?.click(), name);
      await page.waitForTimeout(300);
    },
    activeNav: () => page.evaluate(() => document.querySelector('.bottom-nav .nav-tab.active')?.getAttribute('aria-label') || null),
    async tab(label) { await page.locator('.ps-tab', { hasText: label }).click(); await page.waitForTimeout(200); },
    /** Home → the card → Letters to My Future Self, optionally on one of its parts. */
    async openSpace(label) {
      await d.nav('Home');
      await page.locator('[data-testid="home-future-self"] .btn-primary').click();
      await page.waitForSelector('[data-testid="future-self-space"]');
      if (label) await d.tab(label);
    },
    async addMessage(text) {
      const box = page.locator('[data-testid="past-self-messages"] > .ps-composer');
      await box.locator('.ps-msg-input').fill(text);
      await box.locator('.btn-primary').click();
      await page.waitForTimeout(120);
    },
    async writeLetter({ title = '', body }) {
      await page.locator('.ps-pane > .btn-primary').click();
      await page.waitForSelector('[data-testid="letter-editor"]');
      if (title) await page.locator('.ps-title-input').fill(title);
      await page.locator('.ps-paper').fill(body);
      await page.locator('.ps-save').click();
      await page.waitForTimeout(200);
    },
    sw: (label) => page.locator(`[aria-label="${label}"]`),
    async setTime(t) { await page.locator('input[aria-label="Preferred time"]').fill(t); await page.waitForTimeout(80); },
    serverLine: () => page.locator('[data-testid="server-line"]').innerText(),
    /** Notifications the page itself showed for a past-self message. */
    shown: () => page.evaluate(() => JSON.parse(sessionStorage.getItem('__forge_test_shown') || '[]')
      .filter(n => String(n.tag || '').startsWith('forge-pastself'))),
    forgetShown: () => page.evaluate(() => sessionStorage.removeItem('__forge_test_shown')),
    /** What the browser is actually displaying, read back from the service worker. */
    displayed: () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications())
      .map(n => ({ title: n.title, body: n.body, tag: n.tag, data: n.data }))),
    clearDisplayed: () => page.evaluate(async () => {
      for (const n of await (await navigator.serviceWorker.ready).getNotifications()) n.close();
    }),
    /** Hand the app what the service worker would post when a notification is tapped. */
    deliver: (message) => page.evaluate((m) => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: m })), message),
    reveal: () => page.locator('[data-testid="past-self-reveal"]'),
    xp: () => page.evaluate(() => document.querySelector('.xp-value')?.textContent?.trim() || null),
  };
  return d;
}

/** Everything the feature must leave exactly as it found it, as one string. */
function protectedState(page) {
  return page.evaluate(() => {
    const read = k => JSON.parse(localStorage.getItem(k) || 'null');
    const profiles = read('profiles') || {};
    const strip = (p) => { if (!p) return p; const { pastSelf, ...rest } = p; return rest; };
    return JSON.stringify({
      allDays: read('allDays'), archives: read('archives'), weeklyReflections: read('weeklyReflections'),
      experiments: read('experiments'), notifPrefs: read('notifPrefs'),
      me: strip(profiles.me), girlfriend: strip(profiles.girlfriend),
    });
  });
}

/** Run the shipped notificationclick handler on a notification's data. */
async function tapWithForgeOpen(data, origin) {
  const messages = [];
  const sw = loadSW({ origin, windows: [{ url: `${origin}/`, postMessage: m => messages.push(m), focus: async () => {} }] });
  await sw.fire('notificationclick', { notification: { close() {}, data } });
  return { message: messages[0], opened: sw.opened };
}
async function tapWithForgeClosed(data, origin) {
  const sw = loadSW({ origin });
  await sw.fire('notificationclick', { notification: { close() {}, data } });
  return sw.opened[0];
}

// A running challenge with ten logged days and the Future Self Letter that
// challenge asked for when it began. Section A archives one and starts another.
const MT_TASKS = [
  { id: 'mt_meditate', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 25, keystone: 3, keystoneHabit: true, source: 'template', order: 0, challenges: ['primary'] },
  { id: 'mt_read', name: 'Read 5 pages', icon: '📚', xp: 15, keystone: 1, source: 'template', order: 1, challenges: ['primary'] },
  { id: 'mt_pray', name: 'Prayer', icon: '🙏', xp: 10, keystone: 1, source: 'template', order: 2, challenges: ['primary'] },
  { id: 'mt_grat', name: 'Write one gratitude', icon: '📝', xp: 10, keystone: 1, source: 'template', order: 3, challenges: ['primary'] },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, source: 'template', order: 4, challenges: ['primary'] },
];
async function seedAttempt(drv, why) {
  await drv.page.evaluate(({ tasks, start, why }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    p.me.challengeStart = start;
    p.me.activeChallenge = {
      templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠', variant: 'standard',
      durationDays: 14, templateVersion: 3, rewardXP: 300, completionBonusXP: 300,
      passingScore: 70, keystoneRequirement: 65, coldExposureUpgradeEnabled: true,
      coldExposureUpgradeStartDate: start,
      futureSelfLetter: { why, ifQuit: 'I will know I gave up on him.', writtenAt: start },
    };
    p.me.tasks = tasks;
    p.me.weeklySessions = [];
    localStorage.setItem('profiles', JSON.stringify(p));
    const all = JSON.parse(localStorage.getItem('allDays') || '{"me":{},"girlfriend":{}}');
    const recs = {};
    for (let n = 1; n <= 10; n++) {
      const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + n - 1);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      recs[n] = {
        date, dayNumber: n, mood: 4, confidence: 4, sleep: 4, energy: 4, recovery: 4,
        workoutEffort: 4, stress: 2, hoursSlept: 8, validated: true, notes: `day ${n}`,
        // The last day is left half done, so an accidental completion would show.
        tasks: Object.fromEntries(tasks.map((t, i) => [t.id, n < 10 || i < 2])),
        mentalTraining: { selected: 'meditation', completed: true, notes: '' },
        bonusDone: {}, bonusOneTime: [],
      };
    }
    all.me = recs;
    localStorage.setItem('allDays', JSON.stringify(all));
  }, { tasks: MT_TASKS, start: zoneDate(-9), why });
  await drv.reload();
}

const build = await startPushBuild(4174);
const PUSH = build.url;
const api = await createFakePushApi();
const browser = await chromium.launch({ channel: 'chromium' });
const pastSelfCalls = (from = 0) => api.calls.slice(from).filter(c => c.body?.kind === 'pastSelf');
const lastPastSelf = (from = 0) => pastSelfCalls(from).at(-1)?.body || null;

async function lettersAndProfiles() {
  // ═══════════════════════════════════════════════════════════════════════════
  // A. LETTERS AND MESSAGES — on a profile with a real challenge history
  // ═══════════════════════════════════════════════════════════════════════════
  const ctxA = await browser.newContext({ viewport: VIEWPORT, timezoneId: ZONE, locale: 'en-US', acceptDownloads: true });
  await ctxA.grantPermissions(['notifications'], { origin: BASE });
  await ctxA.addInitScript(RECORD_NOTIFICATIONS);
  const apiCallsA = [];
  await ctxA.route('**/api/**', async (route) => {
    apiCallsA.push({ url: route.request().url(), body: route.request().postData() || '' });
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  const A = driver(await ctxA.newPage());
  const pa = A.page;

  await A.fresh(BASE);
  await seedAttempt(A, ARCHIVED_WHY);
  await A.nav('Settings');
  await pa.locator('button', { hasText: 'Start New Challenge' }).first().click();
  await pa.waitForTimeout(300);
  await pa.locator('button', { hasText: /Archive .* Choose New/ }).first().click();
  await pa.waitForTimeout(700);
  await seedAttempt(A, ACTIVE_WHY);
  // One lap of the app first, so anything it tidies up on a visit has settled.
  for (const t of ['Today', 'Insights', 'Challenges', 'Settings', 'Home']) await A.nav(t);
  await A.reload();

  const archive0 = (await A.ls('archives'))?.me || [];
  check('A0: the fixture has an archived challenge carrying its own letter',
    archive0.some(a => a?.challenge?.futureSelfLetter?.why === ARCHIVED_WHY), `${archive0.length} archive entries`);
  check('A0: and a running challenge carrying its own letter',
    (await A.ls('profiles')).me.activeChallenge?.futureSelfLetter?.why === ACTIVE_WHY);
  const before = await protectedState(pa);
  const xpBefore = await A.xp();
  const keysBefore = await pa.evaluate(() => Object.keys(localStorage).sort());
  check('A0: the fixture shows a real XP total to protect', /\d/.test(xpBefore || ''), String(xpBefore));

  // ── A1: the way in ─────────────────────────────────────────────────────────
  const card = pa.locator('[data-testid="home-future-self"]');
  check('A1: Home has an entry titled "A Message to My Future Self"',
    (await card.locator('.f41-card-title').innerText()) === 'A Message to My Future Self');
  check('A1: with nothing written it invites a first letter',
    (await card.locator('.btn-primary').innerText()) === 'Write my first letter');
  check('A1: and offers nothing to read yet', (await card.locator('.btn-ghost').count()) === 0);
  eq('A1: the bottom bar still has its five tabs — no new one',
    await pa.evaluate(() => [...document.querySelectorAll('.bottom-nav .nav-tab')].map(x => x.getAttribute('aria-label'))),
    ['Home', 'Today', 'Insights', 'Challenges', 'Settings']);

  await A.nav('Today');
  check('A1: nothing was added to Today',
    (await pa.locator('[class^="ps-"], [class*=" ps-"], [data-testid*="future-self"], [data-testid*="past-self"]').count()) === 0);
  check('A1: "Read My Why" is still on Today', (await pa.locator('.why-btn', { hasText: 'Read My Why' }).count()) === 1);
  await pa.locator('.why-btn', { hasText: 'Read My Why' }).click();
  check('A1: and still opens the letter that challenge asked for',
    (await pa.locator('.letter-modal').innerText()).includes(ACTIVE_WHY));
  await pa.locator('.letter-modal .btn-primary').click();

  await A.nav('Home');
  await card.locator('.btn-primary').click();
  await pa.waitForSelector('[data-testid="future-self-space"]');
  check('A1: the card opens Letters to My Future Self', (await pa.locator('.ps-title').innerText()) === 'Letters to My Future Self');
  check('A1: opened from Home, the Home tab stays lit', (await A.activeNav()) === 'Home');
  check('A1: it opens on Letters', (await pa.locator('.ps-tab.on').innerText()).startsWith('Letters'));

  // ── A2: writing a letter ───────────────────────────────────────────────────
  await pa.locator('.ps-pane > .btn-primary').click();
  await pa.waitForSelector('[data-testid="letter-editor"]');
  check('A2: an empty letter cannot be saved', await pa.locator('.ps-save').isDisabled());
  eq('A2: all six prompts are offered',
    await pa.locator('.ps-prompt').allInnerTexts(),
    ['Why am I beginning this journey?', 'Who do I want to become?', 'What am I afraid of?',
      'What weaknesses am I trying to overcome?', 'What should I remember when I feel like quitting?',
      'What would make me proud of myself a year from now?']);
  check('A2: and described as optional', /All optional/.test(await pa.locator('.ps-prompts').innerText()));

  // Tapping a prompt and typing straight away: the words go under the question.
  await pa.locator('.ps-prompt', { hasText: 'Why am I beginning' }).click();
  await pa.keyboard.type('Because I am done quitting.');
  await pa.locator('.ps-prompt', { hasText: 'feel like quitting' }).click();
  await pa.keyboard.type('Start anyway.');
  eq('A2: a tapped prompt becomes a line of the letter, and typing continues beneath it',
    await pa.locator('.ps-paper').inputValue(),
    'Why am I beginning this journey?\nBecause I am done quitting.\n\nWhat should I remember when I feel like quitting?\nStart anyway.');
  await pa.locator('.ps-prompt', { hasText: 'Why am I beginning' }).click();
  check('A2: tapping the same prompt again does not add it twice',
    (await pa.locator('.ps-paper').inputValue()).split('Why am I beginning this journey?').length === 2);

  // Cancelling with words on the page asks first.
  await pa.locator('.ps-editor-bar .ps-link', { hasText: 'Cancel' }).click();      // dialog dismissed
  check('A2: cancelling a letter with writing in it asks before discarding', (await pa.locator('[data-testid="letter-editor"]').count()) === 1);
  pa.once('dialog', dlg => dlg.accept());
  await pa.locator('.ps-editor-bar .ps-link', { hasText: 'Cancel' }).click();
  await pa.waitForTimeout(200);
  check('A2: and discards only when told to', (await pa.locator('[data-testid="letter-editor"]').count()) === 0
    && ((await A.ps())?.letters?.length || 0) === 0);

  // Writing freely, with no prompt at all.
  await A.writeLetter({ title: 'Day one', body: LETTER_A });
  let ps = await A.ps();
  check('A2: a letter written with no prompts saves', ps.letters.length === 1 && ps.letters[0].body === LETTER_A && ps.letters[0].title === 'Day one');
  check('A2: it appears in the list', (await pa.locator('.ps-letter-card').first().innerText()).includes('Day one'));
  const letterId = ps.letters[0].id; const letterCreated = ps.letters[0].createdAt;

  await A.reload();
  check('A2: Home now offers to open the letters', (await card.locator('.btn-primary').innerText()) === 'Open my letters');
  await A.openSpace();
  check('A2: the letter is still there after a reload', (await pa.locator('.ps-letter-card:not(.compact)').count()) === 1);

  // ── A3: reading and editing ────────────────────────────────────────────────
  await pa.locator('.ps-letter-card').first().click();
  check('A3: the letter can be read back, word for word', (await pa.locator('.ps-reader-body').innerText()) === LETTER_A);
  await pa.locator('button', { hasText: 'Edit letter' }).click();
  await pa.locator('.ps-paper').fill(`${LETTER_A}\n\nP.S. I added this later.`);
  await pa.locator('.ps-save').click();
  await pa.waitForTimeout(200);
  ps = await A.ps();
  check('A3: editing changes that letter rather than adding another',
    ps.letters.length === 1 && ps.letters[0].id === letterId && ps.letters[0].body.endsWith('P.S. I added this later.'));
  check('A3: and keeps the date it was first written', ps.letters[0].createdAt === letterCreated);

  await A.writeLetter({ body: LETTER_B });
  ps = await A.ps();
  check('A3: a second letter is kept alongside the first, not over it', ps.letters.length === 2 && ps.letters.some(l => l.id === letterId));
  check('A3: an untitled letter is listed with a plain heading',
    (await pa.locator('.ps-letter-card-title').allInnerTexts()).includes('A letter to my future self'));

  // Deleting asks, and "Keep it" keeps it.
  await pa.locator('.ps-letter-card', { hasText: 'LETTER-CANARY-BRAVO' }).click();
  await pa.locator('button', { hasText: 'Edit letter' }).click();
  await pa.locator('.ps-link.danger', { hasText: 'Delete this letter' }).click();
  await pa.locator('button', { hasText: 'Keep it' }).click();
  check('A3: "Keep it" keeps the letter', ((await A.ps()).letters.length) === 2);
  await pa.locator('.ps-link.danger', { hasText: 'Delete this letter' }).click();
  await pa.locator('.btn-danger', { hasText: 'Delete letter' }).click();
  await pa.waitForTimeout(200);
  ps = await A.ps();
  check('A3: deleting removes that letter and only that letter', ps.letters.length === 1 && ps.letters[0].id === letterId);

  // ── A4: the challenge letters are shown here too, and are not touched ──────
  const fromChallenges = pa.locator('.ps-section', { hasText: 'From your challenges' });
  check('A4: the challenge letters are listed alongside', (await fromChallenges.locator('.ps-letter-card').count()) === 2,
    `${await fromChallenges.locator('.ps-letter-card').count()} listed`);
  await fromChallenges.locator('.ps-letter-card', { hasText: 'Current challenge' }).click();
  check('A4: the running challenge\'s letter opens in the existing viewer',
    (await pa.locator('.letter-modal').innerText()).includes(ACTIVE_WHY));
  check('A4: which offers no way to edit it', (await pa.locator('.letter-modal textarea, .letter-modal input').count()) === 0);
  await pa.locator('.letter-modal .btn-primary').click();
  await fromChallenges.locator('.ps-letter-card', { hasText: 'Completed challenge' }).click();
  check('A4: the archived challenge\'s letter opens too', (await pa.locator('.letter-modal').innerText()).includes(ARCHIVED_WHY));
  await pa.locator('.letter-modal .btn-primary').click();

  // ── A5: short messages ─────────────────────────────────────────────────────
  await A.tab('Messages');
  eq('A5: with none written, three examples are offered',
    await pa.locator('.ps-example-text').allInnerTexts(),
    ['“Remember why you started.”', '“Don’t let fear make your decisions.”', '“Become the person you promised yourself you’d become.”']);
  check('A5: and nothing is saved just by showing them', ((await A.ps()).messages.length) === 0);
  await pa.locator('.ps-example').first().click();
  await pa.waitForTimeout(150);
  ps = await A.ps();
  check('A5: "Use this" saves exactly that sentence', ps.messages.length === 1 && ps.messages[0].text === 'Remember why you started.');

  await A.addMessage(MSG.a2);
  ps = await A.ps();
  check('A5: a message is kept exactly as typed — punctuation, quotes and emoji included', ps.messages[1].text === MSG.a2);
  check('A5: new messages start switched on', ps.messages[1].enabled === true);

  const long = 'x'.repeat(141);
  const composer = pa.locator('[data-testid="past-self-messages"] > .ps-composer');
  await composer.locator('.ps-msg-input').fill(long);
  check('A5: 141 characters is counted', (await composer.locator('.ps-count').innerText()) === '141/140');
  check('A5: and refused, with the reason', await composer.locator('.btn-primary').isDisabled()
    && /Keep it to 140 characters/.test(await composer.locator('.ps-problem').innerText()));
  check('A5: nothing was saved — and nothing was cut down to fit', ((await A.ps()).messages.length) === 2);
  await composer.locator('.ps-msg-input').fill('y'.repeat(140));
  check('A5: exactly 140 is allowed', !(await composer.locator('.btn-primary').isDisabled()));
  await composer.locator('.ps-msg-input').fill('');

  await A.addMessage(MSG.off);
  await A.addMessage(MSG.a3);
  // Edit one.
  const second = pa.locator('.ps-msg').nth(1);
  const idBefore = (await A.ps()).messages[1].id; const createdBefore = (await A.ps()).messages[1].createdAt;
  await second.locator('.ps-link', { hasText: 'Edit' }).click();
  await pa.locator('.ps-msg.editing .ps-msg-input').fill('abandoned edit');
  await pa.locator('.ps-msg.editing .btn-ghost').click();
  check('A5: cancelling an edit leaves the message as it was', (await A.ps()).messages[1].text === MSG.a2);
  await pa.locator('.ps-msg').nth(1).locator('.ps-link', { hasText: 'Edit' }).click();
  await pa.locator('.ps-msg.editing .ps-msg-input').fill(`${MSG.a2} (edited)`);
  await pa.locator('.ps-msg.editing .btn-primary').click();
  await pa.waitForTimeout(150);
  ps = await A.ps();
  check('A5: editing replaces the words of that message only',
    ps.messages.length === 4 && ps.messages[1].text === `${MSG.a2} (edited)` && ps.messages[1].id === idBefore
    && ps.messages[1].createdAt === createdBefore && ps.messages[0].text === 'Remember why you started.');
  // Switch one off.
  await pa.locator('.ps-msg', { hasText: 'MSG-CANARY-OFF' }).locator('.toggle-btn').click();
  await pa.waitForTimeout(120);
  ps = await A.ps();
  check('A5: a message can be switched off without deleting it',
    ps.messages.length === 4 && ps.messages.find(m => m.text === MSG.off).enabled === false);
  check('A5: the count says so', /3 of 4 switched on/.test(await pa.locator('.ps-list-head').innerText()));
  // Delete one.
  const first = pa.locator('.ps-msg').first();
  await first.locator('.ps-link.danger', { hasText: 'Delete' }).click();
  await first.locator('.ps-link', { hasText: 'Keep' }).click();
  check('A5: "Keep" keeps it', ((await A.ps()).messages.length) === 4);
  await first.locator('.ps-link.danger', { hasText: 'Delete' }).click();
  await first.locator('.ps-link.danger', { hasText: 'Delete' }).click();
  await pa.waitForTimeout(150);
  ps = await A.ps();
  check('A5: deleting removes that message and no other',
    ps.messages.length === 3 && !ps.messages.some(m => m.text === 'Remember why you started.'));

  await A.reload();
  ps = await A.ps();
  eq('A5: all of it survives a reload', ps.messages.map(m => [m.text, m.enabled]),
    [[`${MSG.a2} (edited)`, true], [MSG.off, false], [MSG.a3, true]]);

  // ── A6: reading a message — and what it must not do ────────────────────────
  await A.openSpace('Messages');
  await pa.locator('.ps-msg', { hasText: 'MSG-CANARY-A3' }).locator('.ps-link', { hasText: 'Preview' }).click();
  await pa.waitForSelector('[data-testid="past-self-reveal"]');
  check('A6: Preview opens that message, full screen', (await pa.locator('[data-testid="reveal-words"]').innerText()) === MSG.a3);
  check('A6: saying who it is from', /A message from your past self/i.test(await A.reveal().innerText()));
  check('A6: and when it was written', /You wrote this today/.test(await A.reveal().innerText()));
  await pa.locator('.ps-reveal .btn-ghost', { hasText: 'Read my letter' }).click();
  check('A6: the letter can be read from there', (await pa.locator('[data-testid="reveal-letter"]').innerText()).startsWith(LETTER_A));
  await pa.locator('.ps-reveal .btn-ghost', { hasText: 'Back to the message' }).click();
  check('A6: and the message returned to', (await pa.locator('[data-testid="reveal-words"]').innerText()) === MSG.a3);
  check('A6: the screen has no checkbox, XP or streak on it',
    (await pa.locator('.ps-reveal input, .ps-reveal [class*="xp"], .ps-reveal [class*="streak"]').count()) === 0
    && !/\bXP\b/.test(await A.reveal().innerText()));
  await pa.keyboard.press('Escape');
  check('A6: Escape closes it', (await A.reveal().count()) === 0);

  await A.nav('Home');
  check('A6: Home shows how much is kept, and none of the words',
    /1 letter · 3 messages/.test(await card.innerText()) && !CANARY.test(await card.innerText()));
  check('A6: with delivery off, Home says so rather than promising a message',
    /Notifications are off/.test(await card.innerText()));
  await card.locator('.btn-ghost', { hasText: 'Read a message' }).click();
  await pa.waitForSelector('[data-testid="past-self-reveal"]');
  const readNow = await pa.locator('[data-testid="reveal-words"]').innerText();
  check('A6: "Read a message" opens one of the switched-on messages',
    [`${MSG.a2} (edited)`, MSG.a3].includes(readNow), readNow);
  check('A6: never the one that is switched off', readNow !== MSG.off);
  await pa.locator('.ps-reveal .btn-primary', { hasText: 'Carry on' }).click();
  check('A6: "Carry on" returns to where you were', (await A.reveal().count()) === 0 && (await A.activeNav()) === 'Home');

  // ── A7: this build has no background push, and says so ────────────────────
  await A.openSpace('Delivery');
  check('A7: without background push the screen says nothing is stored on a server',
    /Nothing is stored on a server/.test(await A.serverLine()));
  await pa.locator('.ps-seg-btn', { hasText: 'Every day' }).click();
  await A.setTime(hhmm(-2));
  await pa.waitForTimeout(900);                             // let the scheduler settle while it is still off
  await A.forgetShown();
  await A.sw('Send me messages from my past self').click();
  const inApp = await until(async () => { const s = await A.shown(); return s.length ? s : null; });
  check('A7: switched on and due, the app itself delivers while it is open', (inApp || []).length === 1, JSON.stringify(inApp));
  check('A7: with the private wording', inApp?.[0]?.title === 'Forge' && inApp?.[0]?.body === 'A message from your past self is ready.');
  await sleep(1600);
  await A.reload();
  await sleep(1600);
  check('A7: and only once, however long the app stays open or is reloaded', (await A.shown()).length === 1);
  check('A7: this build never contacts a server about it', apiCallsA.filter(c => /pastSelf/.test(c.body)).length === 0,
    `${apiCallsA.length} api calls in total`);
  check('A7: the capability line is honest about it',
    /only while Forge is open/.test(await (async () => { await A.openSpace('Delivery'); return pa.locator('[data-testid="delivery-capability"]').innerText(); })()));
  await A.sw('Send me messages from my past self').click();
  await pa.waitForTimeout(200);
  check('A7: it can be switched off again', (await A.ps()).delivery.enabled === false);
  await A.clearDisplayed();

  // ── A8: nothing else was touched ───────────────────────────────────────────
  await A.nav('Home');
  check('A8: days, tasks, archives, reflections, preferences and both profiles are byte-for-byte unchanged',
    (await protectedState(pa)) === before);
  check('A8: XP is exactly what it was', (await A.xp()) === xpBefore, `${xpBefore} → ${await A.xp()}`);
  const profilesNow = await A.ls('profiles');
  check('A8: the challenge letters are exactly as they were written',
    profilesNow.me.activeChallenge.futureSelfLetter.why === ACTIVE_WHY
    && JSON.stringify((await A.ls('archives')).me) === JSON.stringify(archive0));
  check('A8: the other profile has nothing of this one\'s', profilesNow.girlfriend.pastSelf === undefined);
  const keysNow = await pa.evaluate(() => Object.keys(localStorage).sort());
  eq('A8: no storage key was added or removed (the in-app sent log aside)',
    keysNow.filter(k => k !== 'notifLog'), keysBefore.filter(k => k !== 'notifLog'));

  // ── A9: the backup carries it, and brings it back ──────────────────────────
  await A.nav('Settings');
  const [download] = await Promise.all([
    pa.waitForEvent('download'),
    pa.locator('button', { hasText: 'Export / Backup Data' }).click(),
  ]);
  const backupPath = await download.path();
  const { readFileSync } = await import('node:fs');
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  check('A9: the backup file contains the letters', backup.profiles?.me?.pastSelf?.letters?.[0]?.body?.startsWith(LETTER_A));
  eq('A9: and the messages, as written', backup.profiles.me.pastSelf.messages.map(m => m.text), [`${MSG.a2} (edited)`, MSG.off, MSG.a3]);
  const profilesAtExport = JSON.stringify(await A.ls('profiles'));
  await pa.evaluate(() => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify('me')); });
  await A.reload();
  check('A9: (after wiping the device there is nothing)', (await A.ps()) === null);
  await A.nav('Settings');
  await Promise.all([
    pa.waitForEvent('load', { timeout: 15000 }),          // the app reloads itself after an import
    pa.locator('input[type="file"]').setInputFiles(backupPath),
  ]);
  await A.ready();
  check('A9: restoring the backup brings every letter and message back, unchanged',
    JSON.stringify(await A.ls('profiles')) === profilesAtExport);

  // ═══════════════════════════════════════════════════════════════════════════
  // B. TWO PROFILES — separate letters, separate messages, separate settings
  // ═══════════════════════════════════════════════════════════════════════════
  const meBefore = JSON.stringify((await A.ls('profiles')).me);
  await A.switchProfile('girlfriend');
  const names = await pa.evaluate(() => { const p = JSON.parse(localStorage.getItem('profiles')); return { me: p.me.name, girlfriend: p.girlfriend.name }; });
  check('B1: the other profile\'s Home card starts empty',
    (await card.locator('.btn-primary').innerText()) === 'Write my first letter' && !/letter ·/.test(await card.innerText()));
  await card.locator('.btn-primary').click();
  await pa.waitForSelector('[data-testid="future-self-space"]');
  check('B1: she sees none of his letters', (await pa.locator('.ps-letter-card').count()) === 0 && !CANARY.test(await A.text()));
  await A.tab('Messages');
  check('B1: and none of his messages', (await pa.locator('.ps-msg').count()) === 0 && !CANARY.test(await A.text()));
  await A.tab('Delivery');
  check('B1: with nothing written, delivery cannot be switched on',
    await A.sw('Send me messages from my past self').isDisabled()
    && /Write a message or a letter first/.test(await A.text()));
  await A.tab('Messages');
  await A.addMessage(MSG.b1);
  await A.tab('Letters');
  await A.writeLetter({ title: 'Hers', body: 'Her own letter.' });
  const both = await A.ls('profiles');
  check('B2: what she writes is stored on her profile', both.girlfriend.pastSelf.messages[0].text === MSG.b1 && both.girlfriend.pastSelf.letters[0].title === 'Hers');
  check('B2: and his profile is exactly as it was', JSON.stringify(both.me) === meBefore);

  // A notification for HIM, tapped while HER profile is open.
  await A.deliver({ type: 'FORGE_NAVIGATE', view: 'message', profile: 'me', date: TODAY });
  await pa.waitForSelector('[data-testid="past-self-reveal"]');
  let revealText = await A.reveal().innerText();
  check('B3: a message for the other profile is not shown in this one',
    !CANARY.test(revealText) && revealText.includes(`written by ${names.me}`), revealText.replace(/\s+/g, ' ').slice(0, 120));
  await pa.locator('.ps-reveal .btn-ghost', { hasText: 'Not now' }).click();
  check('B3: "Not now" leaves her where she was', (await A.reveal().count()) === 0 && (await A.ls('activeProfile')) === 'girlfriend');
  await A.deliver({ type: 'FORGE_NAVIGATE', view: 'message', profile: 'me', date: TODAY });
  await pa.waitForSelector('[data-testid="past-self-reveal"]');
  await pa.locator('.ps-reveal .btn-primary', { hasText: `Switch to ${names.me}` }).click();
  await pa.waitForSelector('[data-testid="reveal-words"]');
  check('B3: switching to his profile then shows his message',
    [`${MSG.a2} (edited)`, MSG.a3].includes(await pa.locator('[data-testid="reveal-words"]').innerText())
    && (await A.ls('activeProfile')) === 'me');
  await pa.locator('.ps-reveal-close').click();
  await ctxA.close();

}

async function settingsAndPrivacy() {
  // ═══════════════════════════════════════════════════════════════════════════
  // C. DELIVERY SETTINGS AND PRIVACY — a build with background push configured,
  //    on a device that has no push subscription
  // ═══════════════════════════════════════════════════════════════════════════
  const ctxC = await browser.newContext({ viewport: VIEWPORT, timezoneId: ZONE, locale: 'en-US' });
  await ctxC.grantPermissions(['notifications'], { origin: PUSH });
  await ctxC.addInitScript(RECORD_NOTIFICATIONS);
  await api.attach(ctxC);
  const C = driver(await ctxC.newPage());
  const pc = C.page;
  await C.fresh(PUSH);
  check('C0: (harness) the browser reports notifications as allowed', (await pc.evaluate(() => Notification.permission)) === 'granted');
  const installC = await until(() => pc.evaluate(() => localStorage.getItem('forge_install_id')));
  const recKeyC = `push:pastself:${installC}:me`;

  await C.openSpace('Delivery');
  check('C1: with nothing written the switch is unavailable', await C.sw('Send me messages from my past self').isDisabled());
  await sleep(1300);
  check('C1: and nothing is stored for this device', api.get(recKeyC) === null && !pastSelfCalls().some(c => c.body.enabled));

  await C.tab('Letters');
  await C.writeLetter({ title: 'Private', body: LETTER_A });
  await C.tab('Messages');
  for (const m of [MSG.a1, MSG.off, MSG.a3]) await C.addMessage(m);
  await pc.locator('.ps-msg', { hasText: 'MSG-CANARY-OFF' }).locator('.toggle-btn').click();
  await C.tab('Delivery');
  check('C1: before it is switched on, the screen says so', /^Off$/m.test(await pc.locator('.ps-switch-sub').first().innerText()));

  // ── C2: switched on, private by default ────────────────────────────────────
  let mark = api.calls.length;
  await C.sw('Send me messages from my past self').click();
  let body = await until(() => { const b = lastPastSelf(mark); return b?.enabled ? b : null; });
  check('C2: switching it on tells the server a schedule exists', !!body);
  eq('C2: …the time, the days, the time zone and quiet hours',
    [body?.time, body?.days, body?.timezone, body?.quietHours], ['07:30', null, ZONE, { start: '22:30', end: '07:00' }]);
  check('C2: …and not one word the user wrote', body?.showContent === false && Array.isArray(body?.rotation) && body.rotation.length === 0);
  check('C2: nothing written has left the device at all', !CANARY.test(JSON.stringify(api.calls)));
  check('C2: and nothing written is in the store', !CANARY.test(api.dump()) && api.get(recKeyC)?.showContent === false);
  await until(async () => /schedule only/.test(await C.serverLine()));
  check('C2: the screen reports what the server said it holds', /your schedule only\. None of your words\./.test(await C.serverLine()), await C.serverLine());
  eq('C2: the lock-screen preview shows the private wording',
    [await pc.locator('.ps-lock-title').innerText(), await pc.locator('.ps-lock-body').innerText()],
    ['Forge', 'A message from your past self is ready.']);
  check('C2: the switch says when the next one is due', /^Next: .+, around 7:30 AM$/m.test(await pc.locator('.ps-switch-sub').first().innerText()));
  check('C2: and it is saved as switched on', (await C.ps()).delivery.enabled === true);

  // ── C3: scheduling ─────────────────────────────────────────────────────────
  mark = api.calls.length;
  await pc.locator('.ps-seg-btn', { hasText: 'Specific days' }).click();
  body = await until(() => { const b = lastPastSelf(mark); return b && Array.isArray(b.days) ? b : null; });
  eq('C3: "Specific days" starts on weekdays', body?.days, [1, 2, 3, 4, 5]);
  mark = api.calls.length;
  for (const dname of ['Tue', 'Thu']) await pc.locator('.ps-day', { hasText: dname }).click();
  await pc.locator('.ps-day', { hasText: 'Sun' }).click();
  body = await until(() => { const b = lastPastSelf(mark); return b && b.days?.join() === '0,1,3,5' ? b : null; });
  eq('C3: chosen days are what the server is given', body?.days, [0, 1, 3, 5]);
  check('C3: the summary names them', /Mon, Wed, Fri, Sun, shortly after 7:30 AM/.test(await pc.locator('[data-testid="past-self-delivery"]').innerText()));
  for (const dname of ['Mon', 'Wed', 'Fri']) await pc.locator('.ps-day', { hasText: dname }).click();
  await pc.locator('.ps-day', { hasText: 'Sun' }).click();     // the last one left
  await pc.waitForTimeout(150);
  eq('C3: the last remaining day cannot be removed — a schedule with no days would never send', (await C.ps()).delivery.days, [0]);
  mark = api.calls.length;
  await C.setTime('18:45');
  body = await until(() => { const b = lastPastSelf(mark); return b?.time === '18:45' ? b : null; });
  check('C3: a new preferred time reaches the server', body?.time === '18:45');
  check('C3: the screen does not promise the exact minute',
    /usually arrives within a few minutes of this time, not on the exact minute/.test(await pc.locator('[data-testid="past-self-delivery"]').innerText()));
  check('C3: and says a very late one is skipped', /more than 90 minutes late it is skipped/.test(await pc.locator('[data-testid="past-self-delivery"]').innerText()));

  await C.setTime('23:15');
  check('C3: a time inside quiet hours is called out, since it would never be sent',
    (await pc.locator('[data-testid="quiet-warning"]').count()) === 1
    && /inside your quiet hours/.test(await pc.locator('[data-testid="quiet-warning"]').innerText()));
  await C.setTime('18:45');
  check('C3: and the warning goes when the time is moved', (await pc.locator('[data-testid="quiet-warning"]').count()) === 0);

  await C.reload();
  await C.openSpace('Delivery');
  eq('C3: the schedule survives a reload',
    [await C.sw('Send me messages from my past self').getAttribute('aria-checked'),
      await pc.locator('.ps-seg-btn.on').first().innerText(),
      await pc.locator('.ps-day.on').allInnerTexts(),
      await pc.locator('input[aria-label="Preferred time"]').inputValue()],
    ['true', 'Specific days', ['Sun'], '18:45']);
  await pc.locator('.ps-seg-btn', { hasText: 'Every day' }).click();

  // ── C4: choosing to show the words ─────────────────────────────────────────
  const local = await C.ps();
  const onMsgs = local.messages.filter(m => m.enabled !== false);
  mark = api.calls.length;
  await C.sw('Show my message in the notification').click();
  body = await until(() => { const b = lastPastSelf(mark); return b?.showContent ? b : null; });
  eq('C4: only then are messages uploaded — the switched-on ones, exactly as written',
    body?.rotation, onMsgs.map(m => ({ id: m.id, text: m.text })));
  check('C4: the switched-off message is never sent anywhere', !JSON.stringify(api.calls).includes('MSG-CANARY-OFF') && !api.dump().includes('MSG-CANARY-OFF'));
  check('C4: a letter is never sent, under any setting', !JSON.stringify(api.calls).includes('LETTER-CANARY') && !api.dump().includes('LETTER-CANARY'));
  await until(async () => /2 short messages/.test(await C.serverLine()));
  check('C4: the screen reports the server now holds two messages', /your schedule and 2 short messages\./.test(await C.serverLine()), await C.serverLine());
  check('C4: and explains that this is what showing them requires',
    /your 2 switched-on short messages are kept on Forge’s server\. Your letters are never uploaded\./.test(await pc.locator('[data-testid="past-self-delivery"]').innerText()));
  check('C4: the preview now shows the user\'s own words under Forge\'s heading',
    (await pc.locator('.ps-lock-title').innerText()) === 'From your past self'
    && [MSG.a1, MSG.a3].includes(await pc.locator('.ps-lock-body').innerText()));

  // One chosen message.
  mark = api.calls.length;
  await pc.locator('.ps-seg-btn', { hasText: 'One message' }).click();
  await pc.locator('.ps-pick', { hasText: 'MSG-CANARY-A3' }).click();
  body = await until(() => { const b = lastPastSelf(mark); return b?.rotation?.length === 1 && b.rotation[0].text === MSG.a3 ? b : null; });
  check('C4: choosing one message uploads that one and no other', !!body && api.get(recKeyC).rotation.length === 1 && !api.dump().includes('MSG-CANARY-A1'));
  check('C4: the list of choices leaves out the switched-off message', !(await pc.locator('.ps-pick-list').innerText()).includes('MSG-CANARY-OFF'));
  mark = api.calls.length;
  await pc.locator('.ps-seg-btn', { hasText: 'Rotate' }).click();
  await until(() => lastPastSelf(mark)?.rotation?.length === 2);

  // Editing and deleting while the words are stored.
  await C.tab('Messages');
  mark = api.calls.length;
  await pc.locator('.ps-msg', { hasText: 'MSG-CANARY-A1' }).locator('.ps-link', { hasText: 'Edit' }).click();
  await pc.locator('.ps-msg.editing .ps-msg-input').fill('MSG-CANARY-A1 rewritten by me.');
  await pc.locator('.ps-msg.editing .btn-primary').click();
  await until(() => lastPastSelf(mark)?.rotation?.some(r => r.text === 'MSG-CANARY-A1 rewritten by me.'));
  check('C4: an edited message replaces the stored copy', api.dump().includes('MSG-CANARY-A1 rewritten by me.') && !api.dump().includes(MSG.a1));
  mark = api.calls.length;
  const a3 = pc.locator('.ps-msg', { hasText: 'MSG-CANARY-A3' });
  await a3.locator('.ps-link.danger', { hasText: 'Delete' }).click();
  await a3.locator('.ps-link.danger', { hasText: 'Delete' }).click();
  await until(() => lastPastSelf(mark)?.rotation?.length === 1);
  check('C4: a deleted message is deleted from the server too', !api.dump().includes('MSG-CANARY-A3'));
  mark = api.calls.length;
  await pc.locator('.ps-msg', { hasText: 'MSG-CANARY-A1' }).locator('.toggle-btn').click();
  await until(() => { const b = lastPastSelf(mark); return b && b.showContent === false; });
  check('C4: switching the last message off removes every word from the server', !CANARY.test(api.dump()));
  check('C4: but the schedule stays, because there is still a letter to open', api.get(recKeyC)?.time === '18:45' && (await C.ps()).delivery.enabled === true);
  await pc.locator('.ps-msg', { hasText: 'MSG-CANARY-A1' }).locator('.toggle-btn').click();
  await until(() => api.dump().includes('MSG-CANARY-A1 rewritten by me.'));

  // ── C5: taking it back ─────────────────────────────────────────────────────
  await C.tab('Delivery');
  mark = api.calls.length;
  await C.sw('Show my message in the notification').click();
  await until(() => { const b = lastPastSelf(mark); return b && b.enabled && b.showContent === false; });
  check('C5: switching "show my message" off deletes the stored messages', !CANARY.test(api.dump()) && api.get(recKeyC)?.rotation?.length === 0);
  await until(async () => /schedule only/.test(await C.serverLine()));
  check('C5: and the screen confirms it from the server\'s own answer', /your schedule only\. None of your words\./.test(await C.serverLine()));

  // The server cannot be reached.
  api.setFailing(true);
  await C.setTime('19:10');
  await until(async () => /Couldn’t reach/.test(await C.serverLine()));
  check('C5: when the server cannot be reached the screen says it does not know, rather than assuming',
    /Couldn’t reach Forge’s server, so it may still be holding what it held before/.test(await C.serverLine()), await C.serverLine());
  check('C5: (and the server really does still hold the old time)', api.get(recKeyC)?.time === '18:45');
  api.setFailing(false);
  await pc.locator('[data-testid="server-line"] .ps-inline-link', { hasText: 'Retry' }).click();
  await until(() => api.get(recKeyC)?.time === '19:10');
  check('C5: Retry sends it once the server is back', api.get(recKeyC)?.time === '19:10');
  await until(async () => /schedule only/.test(await C.serverLine()));

  // A test notification, on demand.
  await C.forgetShown();
  await pc.locator('button', { hasText: 'Send a test notification now' }).click();
  const tested = await until(async () => { const s = await C.shown(); return s.length ? s : null; });
  check('C5: "Send a test notification" shows one, worded as the real one will be',
    tested?.length === 1 && tested[0].title === 'Forge' && tested[0].body === 'A message from your past self is ready.' && tested[0].data?.view === 'message');
  await C.clearDisplayed();

  // Off.
  mark = api.calls.length;
  await C.sw('Send me messages from my past self').click();
  await until(() => lastPastSelf(mark)?.enabled === false);
  await until(() => api.get(recKeyC) === null);
  check('C5: switching delivery off deletes the schedule from the server', api.get(recKeyC) === null && !api.keys().some(k => k.startsWith(`push:pastself:${installC}:`)));
  await until(async () => /nothing/.test(await C.serverLine()));
  check('C5: and the screen says the server holds nothing', /On Forge’s server now: nothing\./.test(await C.serverLine()));
  check('C5: the letters and messages themselves are untouched by all of that',
    (await C.ps()).letters.length === 1 && (await C.ps()).messages.length === 2);

  // ── C6: no push subscription on this device → the app delivers, exactly once ─
  await pc.evaluate((today) => localStorage.setItem('notifLog', JSON.stringify({ me: { [today]: { u_morning: true } } })), TODAY);
  await C.forgetShown();
  await C.setTime(hhmm(45));
  await C.sw('Send me messages from my past self').click();
  await sleep(2400);
  check('C6: a message due later today is not sent now', (await C.shown()).length === 0);
  await C.setTime(hhmm(-120));
  await sleep(2400);
  check('C6: one more than 90 minutes overdue is skipped, not sent late', (await C.shown()).length === 0);
  await C.setTime(hhmm(-2));
  const fired = await until(async () => { const s = await C.shown(); return s.length ? s : null; });
  check('C6: one that has just come due is shown by the app', fired?.length === 1, JSON.stringify(fired));
  eq('C6: carrying what the app needs to open the right message',
    fired?.[0]?.data, { view: 'message', profile: 'me', date: TODAY });
  check('C6: the screen says delivery here needs Forge open',
    /only while Forge is open/.test(await pc.locator('[data-testid="delivery-capability"]').innerText()));
  // Everything that re-runs the scheduler: an edit, a tab change, a reload, time passing.
  await C.tab('Messages'); await C.addMessage('one more line');
  await sleep(1500);
  await C.reload();
  await sleep(1500);
  await C.nav('Today'); await C.nav('Home');
  await sleep(1200);
  check('C6: and it is shown exactly once, whatever happens afterwards', (await C.shown()).length === 1, `${(await C.shown()).length} shown`);
  const log = await C.ls('notifLog');
  check('C6: the app\'s sent log records it without disturbing the reminders\' entries',
    log?.me?.[TODAY]?.pastSelf === true && log?.me?.[TODAY]?.u_morning === true, JSON.stringify(log));
  await C.clearDisplayed();
  await ctxC.close();

}

async function backgroundDelivery() {
  let mark; let revealText;
  // ═══════════════════════════════════════════════════════════════════════════
  // D. BACKGROUND DELIVERY — the real dispatcher, real encryption, the real
  //    service worker; one device subscription shared by two profiles
  // ═══════════════════════════════════════════════════════════════════════════
  const device = api.newDevice('iphone');
  const ctxD = await browser.newContext({ viewport: VIEWPORT, timezoneId: ZONE, locale: 'en-US' });
  await ctxD.grantPermissions(['notifications'], { origin: PUSH });
  await ctxD.addInitScript(RECORD_NOTIFICATIONS);
  await ctxD.addInitScript(FAKE_PUSH_MANAGER, device);
  await api.attach(ctxD);
  const D = driver(await ctxD.newPage());
  const pd = D.page;
  await D.fresh(PUSH);
  const install = await until(() => pd.evaluate(() => localStorage.getItem('forge_install_id')));
  const recKey = (id) => `push:pastself:${install}:${id}`;
  const subsFor = (id) => api.store.getSubscriptions(install, id);
  const pastSelfPushes = (id) => api.pushed.filter(p => p.payload?.tag === `forge-pastself-${id}`);
  const reminderPushes = () => api.pushed.filter(p => p.accepted && !String(p.payload?.tag || '').startsWith('forge-pastself'));

  // He is in the middle of a challenge with reminders on, one of them due now.
  // All of that must come through what follows untouched. (The reminder
  // scheduler only runs for a profile that has a day to be on.)
  await seedAttempt(D, ACTIVE_WHY);
  await pd.evaluate((time) => {
    const all = JSON.parse(localStorage.getItem('notifPrefs') || '{}');
    all.me = {
      masterEnabled: true, quietHours: { start: '22:30', end: '07:00' },
      reminders: { u_morning: { enabled: true, time }, u_evening: { enabled: false, time: '20:00' } },
      customHabits: [], prefsVersion: 2,
    };
    localStorage.setItem('notifPrefs', JSON.stringify(all));
  }, hhmm(-3));
  await D.reload();
  await until(() => api.get(`push:sched:${install}:me`));
  const reminderSchedule = () => {
    const s = api.get(`push:sched:${install}:me`);
    return s ? Object.entries(s.reminders || {}).map(([k, v]) => [k, v.time]).sort() : null;
  };
  await until(() => reminderSchedule()?.some(([k]) => k === 'u_morning'));
  const reminders0 = reminderSchedule();
  check('D0: (fixture) the reminder schedule is on the server, as before', Array.isArray(reminders0) && reminders0.some(([k]) => k === 'u_morning'), JSON.stringify(reminders0));
  const morning = api.get(`push:sched:${install}:me`)?.reminders?.u_morning;
  const morningTag = morning?.payload?.tag || morning?.fallback?.tag || null;

  await D.openSpace('Messages');
  for (const m of [MSG.a1, MSG.a2, MSG.a3]) await D.addMessage(m);
  await D.tab('Letters');
  await D.writeLetter({ title: 'Mine', body: LETTER_A });
  await D.tab('Delivery');
  await D.setTime(hhmm(45));
  mark = api.calls.length;
  await D.sw('Send me messages from my past self').click();
  await until(() => lastPastSelf(mark)?.enabled);
  await until(async () => (await subsFor('me')).length === 1);
  check('D1: switching it on registers this device\'s push subscription with the server', (await subsFor('me')).length === 1);
  await until(async () => /even when Forge is closed/.test(await pd.locator('[data-testid="delivery-capability"]').innerText()));
  check('D1: and the screen now says messages arrive with Forge closed',
    /even when Forge is closed/.test(await pd.locator('[data-testid="delivery-capability"]').innerText()));
  eq('D1: the reminder schedule was not replaced or altered by it', reminderSchedule(), reminders0);

  // ── D2: when it must NOT send ──────────────────────────────────────────────
  let run = await api.runCron();
  check('D2: the dispatcher runs', run.status === 200 && run.ok === true, JSON.stringify(run));
  check('D2: a message due later today is not sent', pastSelfPushes('me').length === 0 && run.pastSelfSent === 0);
  const remindersSent = reminderPushes().map(p => p.payload?.tag);
  check('D2: (the reminder that WAS due is sent in the same run, as it always was)',
    remindersSent.includes(morningTag) && morningTag !== null, JSON.stringify({ sent: remindersSent, morningTag }));

  mark = api.calls.length;
  let due = hhmm(-2);
  await D.setTime(due);
  await pd.locator('.ps-seg-btn', { hasText: 'Specific days' }).click();
  // Leave every day selected except today.
  for (const w of [1, 2, 3, 4, 5]) if (w === WEEKDAY) await pd.locator('.ps-day', { hasText: DAY_NAMES[w] }).click();
  for (const w of [0, 6]) if (w !== WEEKDAY) await pd.locator('.ps-day', { hasText: DAY_NAMES[w] }).click();
  await until(() => { const b = lastPastSelf(mark); return b?.time === due && Array.isArray(b.days) && !b.days.includes(WEEKDAY) && b.days.length === 6; });
  check('D2: (the schedule now covers other days only)', !api.get(recKey('me')).days.includes(WEEKDAY), JSON.stringify(api.get(recKey('me')).days));
  run = await api.runCron();
  check('D2: on a day that was not chosen, nothing is sent', pastSelfPushes('me').length === 0 && run.pastSelfSent === 0);

  mark = api.calls.length;
  await pd.locator('.ps-seg-btn', { hasText: 'Every day' }).click();
  const overdue = hhmm(-120);
  await D.setTime(overdue);
  await until(() => { const b = lastPastSelf(mark); return b?.days === null && b.time === overdue; });
  run = await api.runCron();
  check('D2: a message more than 90 minutes overdue is skipped rather than sent at a strange hour', pastSelfPushes('me').length === 0 && run.pastSelfSent === 0);

  // Quiet hours that cover right now.
  const quietNow = { start: hhmm(-60), end: hhmm(60) };
  await pd.evaluate((q) => {
    const all = JSON.parse(localStorage.getItem('notifPrefs'));
    all.me.quietHours = q;
    localStorage.setItem('notifPrefs', JSON.stringify(all));
  }, quietNow);
  await D.reload();
  await D.openSpace('Delivery');
  mark = api.calls.length;
  due = hhmm(-2);
  await D.setTime(due);
  await until(() => { const b = lastPastSelf(mark); return b?.time === due && b.quietHours?.start === quietNow.start; });
  check('D2: the screen warns that this time falls in quiet hours', (await pd.locator('[data-testid="quiet-warning"]').count()) === 1);
  run = await api.runCron();
  check('D2: during quiet hours nothing is sent', pastSelfPushes('me').length === 0 && run.pastSelfSent === 0);
  await pd.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('notifPrefs'));
    all.me.quietHours = { start: '22:30', end: '07:00' };
    localStorage.setItem('notifPrefs', JSON.stringify(all));
  });
  await D.reload();
  await D.openSpace('Delivery');
  await until(() => api.get(recKey('me'))?.quietHours?.start === '22:30' && api.get(recKey('me'))?.time === due);

  // ── D3: when it must send — once ───────────────────────────────────────────
  await D.forgetShown();
  run = await api.runCron();
  const sent = pastSelfPushes('me');
  check('D3: a message that has come due is sent', sent.length === 1 && run.pastSelfSent === 1, JSON.stringify(run));
  check('D3: to this device, signed and accepted by the push service', sent[0]?.device === 'iphone' && sent[0]?.signed && sent[0]?.accepted);
  eq('D3: the lock screen says only that a message is ready',
    [sent[0]?.payload?.title, sent[0]?.payload?.body], ['Forge', 'A message from your past self is ready.']);
  eq('D3: it carries the view, the profile and the user\'s local date — and no message',
    [sent[0]?.payload?.view, sent[0]?.payload?.profile, sent[0]?.payload?.date, 'msg' in (sent[0]?.payload || {})],
    ['message', 'me', TODAY, false]);
  check('D3: nothing the user wrote is in what was sent', !CANARY.test(sent[0]?.raw || ''));
  for (let i = 0; i < 3; i++) run = await api.runCron();
  check('D3: running the dispatcher again, and again, sends nothing more', pastSelfPushes('me').length === 1 && run.pastSelfSent === 0,
    `${pastSelfPushes('me').length} sent after 5 runs`);
  await sleep(1500);
  check('D3: and the app did not ALSO notify — with background push, the server is the only sender', (await D.shown()).length === 0);
  eq('D3: every reminder that was due was sent once in all of those runs, no more',
    reminderPushes().map(p => p.payload?.tag).sort(), [...new Set(remindersSent)].sort());

  // ── D4: the real service worker shows it ───────────────────────────────────
  const cdp = await ctxD.newCDPSession(pd);
  const registrations = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', e => registrations.push(...e.registrations));
  await cdp.send('ServiceWorker.enable');
  const registration = await until(() => registrations.find(r => r.scopeURL.startsWith(PUSH)));
  await D.clearDisplayed();
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: PUSH, registrationId: registration.registrationId, data: sent[0].raw });
  const onScreen = await until(async () => { const n = await D.displayed(); return n.length ? n : null; });
  check('D4: delivered into the real service worker, exactly one notification is displayed', onScreen?.length === 1, JSON.stringify(onScreen));
  eq('D4: reading "Forge — A message from your past self is ready."',
    [onScreen?.[0]?.title, onScreen?.[0]?.body, onScreen?.[0]?.tag], ['Forge', 'A message from your past self is ready.', 'forge-pastself-me']);
  eq('D4: holding only the identifiers the app needs', onScreen?.[0]?.data, { view: 'message', profile: 'me', date: TODAY });
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: PUSH, registrationId: registration.registrationId, data: sent[0].raw });
  await sleep(700);
  check('D4: even a repeated push would replace it rather than stack a second one', (await D.displayed()).length === 1);

  // ── D5: tapping it ─────────────────────────────────────────────────────────
  const mine = (await D.ps()).messages;
  const expected = mine[rotationIndex(mine.length)].text;
  await D.nav('Today');
  await sleep(500);
  const beforeTap = await protectedState(pd);
  const tap = await tapWithForgeOpen(onScreen[0].data, PUSH);
  eq('D5: tapped with Forge open, the worker tells the open window which message', tap.message,
    { type: 'FORGE_NAVIGATE', view: 'message', profile: 'me', date: TODAY });
  check('D5: without opening a second window', tap.opened.length === 0);
  await D.deliver(tap.message);
  await pd.waitForSelector('[data-testid="past-self-reveal"]');
  check('D5: Forge opens the message for that day — the one the rotation had reached',
    (await pd.locator('[data-testid="reveal-words"]').innerText()) === expected, `${await pd.locator('[data-testid="reveal-words"]').innerText()} / expected ${expected}`);
  check('D5: over whatever screen was showing, which is still there afterwards', (await D.activeNav()) === 'Today');
  await pd.locator('.ps-reveal .btn-primary', { hasText: 'Carry on' }).click();
  check('D5: opening and reading it completed nothing and changed no record', (await protectedState(pd)) === beforeTap);

  const launchUrl = await tapWithForgeClosed(onScreen[0].data, PUSH);
  check('D5: tapped with Forge closed, the worker launches it at a URL naming the message',
    launchUrl === `/?view=message&profile=me&date=${TODAY}`, launchUrl);
  const cold = driver(await ctxD.newPage());
  await cold.page.goto(PUSH + launchUrl);
  await cold.page.waitForSelector('[data-testid="past-self-reveal"]', { timeout: 20000 });
  check('D5: Forge starts up showing that same message', (await cold.page.locator('[data-testid="reveal-words"]').innerText()) === expected);
  check('D5: and clears the address, so a refresh does not reopen it', (await cold.page.evaluate(() => location.search)) === '');
  await cold.page.close();
  await D.clearDisplayed();

  // ── D6: the other profile, with her words on the lock screen ───────────────
  await D.switchProfile('girlfriend');
  const herName = (await D.ls('profiles')).girlfriend.name;
  await D.openSpace('Messages');
  for (const m of [MSG.b1, MSG.b2]) await D.addMessage(m);
  await D.tab('Delivery');
  await D.setTime(hhmm(-2));
  await D.sw('Send me messages from my past self').click();
  mark = api.calls.length;
  await D.sw('Show my message in the notification').click();
  await until(() => lastPastSelf(mark)?.rotation?.length === 2);
  await until(async () => (await subsFor('girlfriend')).length === 1);
  const hers = (await D.ps('girlfriend')).messages;
  const herPick = hers[rotationIndex(hers.length)];
  eq('D6: her record holds her two messages and none of his',
    [api.get(recKey('girlfriend')).rotation.map(r => r.text), JSON.stringify(api.get(recKey('girlfriend'))).includes('MSG-CANARY-A')],
    [[MSG.b1, MSG.b2], false]);
  check('D6: his record still holds no words at all', !CANARY.test(JSON.stringify(api.get(recKey('me')))));
  const statusJson = await pd.evaluate(async (id) => (await fetch(`/api/push/status?installId=${id}&profileId=girlfriend`)).json(), install);
  check('D6: the diagnostics endpoint reports how many messages are stored, never what they say',
    statusJson?.pastSelf?.contentStored === 2 && !CANARY.test(JSON.stringify(statusJson)), JSON.stringify(statusJson?.pastSelf));

  // The push service fails once: the message is not lost, and not doubled.
  api.setPushResponse((endpoint, attempt) => (api.pushed.filter(p => p.payload?.tag === 'forge-pastself-girlfriend').length === 0 ? 500 : 201));
  run = await api.runCron();
  check('D6: when the push service fails, the attempt is counted as an error, not as sent',
    run.pastSelfSent === 0 && pastSelfPushes('girlfriend').length === 1 && !pastSelfPushes('girlfriend')[0].accepted, JSON.stringify(run));
  run = await api.runCron();
  const herSent = pastSelfPushes('girlfriend').filter(p => p.accepted);
  check('D6: and the next run delivers it', run.pastSelfSent === 1 && herSent.length === 1);
  run = await api.runCron();
  check('D6: once', pastSelfPushes('girlfriend').filter(p => p.accepted).length === 1 && run.pastSelfSent === 0);
  api.setPushResponse(null);
  eq('D6: her lock screen shows her own words, under Forge\'s heading',
    [herSent[0]?.payload?.title, herSent[0]?.payload?.body], ['From your past self', herPick.text]);
  eq('D6: and names the message, her profile and the date',
    [herSent[0]?.payload?.msg, herSent[0]?.payload?.profile, herSent[0]?.payload?.date], [herPick.id, 'girlfriend', TODAY]);
  check('D6: none of his words are in her notification', !/MSG-CANARY-A|LETTER-CANARY/.test(herSent[0]?.raw || ''));
  check('D6: his message was not sent a second time by any of this', pastSelfPushes('me').length === 1);

  // Her notification, tapped while HIS profile is open.
  const sandbox = loadSW({ origin: PUSH });
  await sandbox.fire('push', pushEvent(herSent[0].payload));
  const herData = sandbox.shown[0].data;
  eq('D6: the worker keeps the message id, profile and date on her notification', herData,
    { view: 'message', msg: herPick.id, profile: 'girlfriend', date: TODAY });
  await D.switchProfile('me');
  await D.deliver((await tapWithForgeOpen(herData, PUSH)).message);
  await pd.waitForSelector('[data-testid="past-self-reveal"]');
  revealText = await D.reveal().innerText();
  check('D6: tapped while his profile is open, her words are not shown', !CANARY.test(revealText) && revealText.includes(`written by ${herName}`));
  await pd.locator('.ps-reveal .btn-primary', { hasText: `Switch to ${herName}` }).click();
  await pd.waitForSelector('[data-testid="reveal-words"]');
  check('D6: switching to her profile shows exactly the message her notification carried',
    (await pd.locator('[data-testid="reveal-words"]').innerText()) === herPick.text);
  await pd.locator('.ps-reveal-close').click();

  // ── D7: one profile opting out does not silence the other ──────────────────
  await D.switchProfile('me');
  await D.openSpace('Delivery');
  mark = api.calls.length;
  await D.sw('Send me messages from my past self').click();
  await until(() => api.get(recKey('me')) === null);
  await sleep(600);
  check('D7: he switches his messages off: his schedule is deleted', api.get(recKey('me')) === null);
  check('D7: …hers is untouched', api.get(recKey('girlfriend'))?.rotation?.length === 2);
  check('D7: …and so is the device subscription they share',
    (await subsFor('girlfriend')).length === 1 && !api.calls.slice(mark).some(c => c.path.endsWith('/unsubscribe')));
  eq('D7: …and so are his reminders', reminderSchedule(), reminders0);

  await D.nav('Settings');
  await pd.waitForSelector('[data-testid="settings-past-self"]');
  check('D7: Settings → Notifications shows his messages as off, separately from reminders',
    /Off · separate from reminders/.test(await pd.locator('[data-testid="settings-past-self"]').innerText()));
  mark = api.calls.length;
  await pd.locator('.settings-row', { hasText: 'Master switch for all' }).locator('.toggle-btn').click();
  await until(() => api.get(`push:sched:${install}:me`) === null);
  await sleep(900);
  check('D7: he switches reminders off too: his reminder schedule is removed', api.get(`push:sched:${install}:me`) === null && (await D.ls('notifPrefs')).me.masterEnabled === false);
  check('D7: …and the shared subscription is STILL there, because she is still using it',
    (await subsFor('girlfriend')).length === 1 && !api.calls.slice(mark).some(c => c.path.endsWith('/unsubscribe'))
    && (await pd.evaluate(() => localStorage.getItem('__forge_test_sub'))) === '1');
  await pd.locator('[data-testid="settings-past-self"] button', { hasText: 'Manage' }).click();
  await pd.waitForSelector('[data-testid="past-self-delivery"]');
  check('D7: "Manage" in Settings opens the delivery settings', (await pd.locator('.ps-tab.on').innerText()) === 'Delivery');
  check('D7: and Back returns to Settings', await (async () => { await pd.locator('.ps-back').click(); await pd.waitForTimeout(250); return (await D.activeNav()) === 'Settings'; })());

  // ── D8: she revokes it all ─────────────────────────────────────────────────
  await D.switchProfile('girlfriend');
  await D.openSpace('Delivery');
  mark = api.calls.length;
  await D.sw('Show my message in the notification').click();
  await until(() => api.get(recKey('girlfriend'))?.showContent === false);
  check('D8: she hides her words again: they are deleted from the server', !CANARY.test(api.dump()));
  mark = api.calls.length;
  await D.sw('Send me messages from my past self').click();
  await until(() => api.get(recKey('girlfriend')) === null);
  await until(() => api.calls.slice(mark).some(c => c.path.endsWith('/unsubscribe')));
  await sleep(500);
  check('D8: she switches delivery off: her schedule is deleted', api.get(recKey('girlfriend')) === null);
  check('D8: with nothing left that needs it, the device subscription is removed as well',
    api.calls.slice(mark).some(c => c.path.endsWith('/unsubscribe')) && !api.keys().some(k => k.startsWith('push:sub:'))
    && (await pd.evaluate(() => localStorage.getItem('__forge_test_sub'))) === null, api.keys().filter(k => /sub/.test(k)).join(', '));
  check('D8: the server is left holding no schedule for either profile on this device, and nobody\'s words at all',
    !api.keys().some(k => k.startsWith(`push:pastself:${install}:`)) && !CANARY.test(api.dump()));
  check('D8: her letters and messages are still hers, on her device', (await D.ps('girlfriend')).messages.length === 2 && (await D.ps('me')).messages.length === 3);
  run = await api.runCron();
  check('D8: and the dispatcher, run again, sends nothing', run.pastSelfSent === 0 && pastSelfPushes('me').length === 1 && pastSelfPushes('girlfriend').filter(p => p.accepted).length === 1);
  await ctxD.close();

}

async function permissionRefused() {
  let mark;
  // ═══════════════════════════════════════════════════════════════════════════
  // E. PERMISSION REFUSED
  // ═══════════════════════════════════════════════════════════════════════════
  const ctxE = await browser.newContext({ viewport: VIEWPORT, timezoneId: ZONE, locale: 'en-US' });   // nothing granted
  await ctxE.addInitScript(RECORD_NOTIFICATIONS);
  await api.attach(ctxE);
  const E = driver(await ctxE.newPage());
  const pe = E.page;
  await E.fresh(PUSH);
  const installE = await until(() => pe.evaluate(() => localStorage.getItem('forge_install_id')));
  check('E0: (harness) notifications have not been allowed', (await pe.evaluate(() => Notification.permission)) === 'default');
  await E.openSpace('Messages');
  await E.addMessage(MSG.a1);
  await E.tab('Delivery');
  mark = api.calls.length;
  await E.sw('Send me messages from my past self').click();        // the browser's prompt is refused
  await pe.waitForSelector('.notif-banner.warn');
  check('E1: when the permission prompt is refused, the screen explains what happened',
    /Notifications are blocked for Forge in your device settings/.test(await pe.locator('.notif-banner.warn').first().innerText()));
  check('E1: the switch stays off', (await E.sw('Send me messages from my past self').getAttribute('aria-checked')) === 'false'
    && (await E.ps()).delivery.enabled === false);
  await sleep(1500);
  check('E1: nothing is stored on the server for a device that cannot be notified',
    !pastSelfCalls(mark).some(c => c.body.enabled) && api.get(`push:pastself:${installE}:me`) === null);
  check('E1: the test button is unavailable', await pe.locator('button', { hasText: 'Send a test notification now' }).isDisabled());
  check('E1: and the screen says notifications are not allowed here',
    /not allowed for Forge on this device/.test(await pe.locator('[data-testid="delivery-capability"]').innerText()));
  await E.sw('Send me messages from my past self').click();
  await pe.waitForTimeout(300);
  check('E1: trying again does not switch it on by the back door', (await E.ps()).delivery.enabled === false);

  // The setting arrives switched on — from a backup — on a device that refuses.
  await pe.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.pastSelf.delivery = { ...p.me.pastSelf.delivery, enabled: true, showContent: true };
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  mark = api.calls.length;
  await E.reload();
  await sleep(1600);
  check('E2: a restored "on" setting uploads nothing from a device that cannot be notified',
    !pastSelfCalls(mark).some(c => c.body.enabled) && !CANARY.test(JSON.stringify(api.calls.slice(mark))) && api.get(`push:pastself:${installE}:me`) === null);
  await E.openSpace('Delivery');
  check('E2: and the screen says nothing can be delivered', /so nothing can be delivered/.test(await pe.locator('[data-testid="past-self-delivery"]').innerText()));
  await until(async () => /nothing/.test(await E.serverLine()));
  check('E2: and that the server holds nothing', /On Forge’s server now: nothing\./.test(await E.serverLine()));
  check('E2: no notification was attempted', (await E.shown()).length === 0);

  // Everything that does not need a notification still works.
  await E.nav('Home');
  await pe.locator('[data-testid="home-future-self"] .btn-ghost', { hasText: 'Read a message' }).click();
  await pe.waitForSelector('[data-testid="reveal-words"]');
  check('E3: with notifications refused, the letters and messages are still there to read',
    (await pe.locator('[data-testid="reveal-words"]').innerText()) === MSG.a1);
  await pe.locator('.ps-reveal-close').click();

  // A message tapped after everything it referred to has been deleted.
  await pe.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.pastSelf.messages = []; p.me.pastSelf.letters = [];
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await E.reload();
  await E.deliver({ type: 'FORGE_NAVIGATE', view: 'message', profile: 'me', date: zoneDate(-1), msg: 'msg_gone' });
  await pe.waitForSelector('[data-testid="past-self-reveal"]');
  check('E4: a notification whose message has since been deleted opens an explanation, not a blank screen',
    /There is nothing here to show/.test(await E.reveal().innerText()));
  await pe.locator('.ps-reveal .btn-primary', { hasText: 'Write one now' }).click();
  await pe.waitForSelector('[data-testid="past-self-messages"]');
  check('E4: and offers to write one', (await pe.locator('.ps-tab.on').innerText()).startsWith('Messages'));
  await ctxE.close();
}

// PS_ONLY=A,D runs just those parts while working on one of them.
const ONLY = (process.env.PS_ONLY || '').split(',').filter(Boolean);
const wanted = (part) => !ONLY.length || ONLY.includes(part);
try {
  if (wanted('A')) await lettersAndProfiles();
  if (wanted('C')) await settingsAndPrivacy();
  if (wanted('D')) await backgroundDelivery();
  if (wanted('E')) await permissionRefused();
  check('Z: no page error in any of it', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('the suite ran to the end', false, String(err?.stack || err).split('\n').slice(0, 4).join(' ⏎ '));
} finally {
  await browser.close().catch(() => {});
  api.restore();
  build.stop();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) for (const f of failed) console.log(`  ✗ ${f.name}${f.extra ? ' — ' + f.extra : ''}`);
process.exit(failed.length ? 1 : 0);
