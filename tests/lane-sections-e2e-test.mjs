/**
 * Primary + Support lane sections on the Today page, end to end.
 *
 * Asserts the visual hierarchy the combination system always implied but never
 * showed: Primary first with stronger emphasis, Support second, shared habits
 * rendered once under Primary with a badge — and that a solo challenge, Forge
 * Daily, XP, grades and Manage Tasks are all unaffected.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.FORGE_BASE || 'http://localhost:4173';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function offset(n) { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); }
const TODAY = dstr(new Date());

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

async function gotoTab(name) {
  await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.bottom-nav .nav-tab')]
      .find(x => x.getAttribute('aria-label') === n);
    if (b) b.click();
  }, name);
  await page.waitForTimeout(400);
}
const prof = (id = 'me') => page.evaluate((i) => JSON.parse(localStorage.getItem('profiles'))[i], id);
const days = (id = 'me') => page.evaluate((i) => (JSON.parse(localStorage.getItem('allDays') || '{}')[i] || {}), id);

const MT_TASKS = [
  { id: 'mt_meditate', name: 'Mental Training — 5 minutes', icon: '🧘', xp: 25, keystone: 3, keystoneHabit: true, habitKey: 'meditation', source: 'template', order: 0, challenges: ['primary'] },
  { id: 'mt_read', name: 'Read 5 pages', icon: '📚', xp: 15, keystone: 1, habitKey: 'reading', source: 'template', order: 1, challenges: ['primary'] },
  { id: 'mt_pray', name: 'Prayer', icon: '🙏', xp: 10, keystone: 1, habitKey: 'prayer', source: 'template', order: 2, challenges: ['primary'] },
  { id: 'mt_sleep', name: 'Sleep 7.5–9 hours', icon: '😴', xp: 20, keystone: 2, habitKey: 'sleep_target', source: 'template', order: 3, challenges: ['primary', 'support'], mergedFrom: { primary: 'mt_sleep', support: 'fl_sleep' } },
  { id: 'daily_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 1, habitKey: 'daily_log', source: 'template', order: 4, challenges: ['primary', 'support'], mergedFrom: { primary: 'daily_log', support: 'daily_log' } },
  { id: 'fl_protein', name: 'Hit protein: 140–175g', icon: '🥩', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'protein_target', source: 'template', order: 5, challenges: ['support'] },
  { id: 'fl_whole', name: 'Eat mostly whole foods (~90%)', icon: '🥗', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'whole_foods', source: 'template', order: 6, challenges: ['support'] },
  { id: 'fl_steps', name: 'Walk 10,000+ steps', icon: '🚶', xp: 30, keystone: 2, habitKey: 'daily_steps', source: 'template', order: 7, challenges: ['support'] },
];

async function reset(profileId = 'me') {
  await page.evaluate((pid) => { localStorage.clear(); localStorage.setItem('activeProfile', JSON.stringify(pid)); }, profileId);
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 });
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p.me.highestRank = 8; p.girlfriend.highestRank = 8;
    localStorage.setItem('profiles', JSON.stringify(p));
  });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(300);
}

/** Seed a primary attempt, optionally with a support challenge stacked. */
async function seed({ stacked = true, profileId = 'me', tasks = MT_TASKS } = {}) {
  await reset(profileId);
  await page.evaluate(({ stacked, profileId, tasks, start }) => {
    const p = JSON.parse(localStorage.getItem('profiles'));
    p[profileId].challengeStart = start;
    p[profileId].activeChallenge = {
      templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠',
      variant: 'standard', durationDays: 14, templateVersion: 3, completionBonusXP: 300,
      passingScore: 70, keystoneRequirement: 65,
    };
    if (stacked) {
      p[profileId].supportChallenge = {
        templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡',
        variant: 'hard', durationDays: 30, completionBonusXP: 500,
      };
      p[profileId].supportChallengeStart = start;
      p[profileId].tasks = tasks;
    } else {
      p[profileId].supportChallenge = null;
      p[profileId].supportChallengeStart = null;
      p[profileId].tasks = tasks.filter(t => (t.challenges || ['primary']).includes('primary'))
        .map(t => ({ ...t, challenges: ['primary'] }));
    }
    localStorage.setItem('profiles', JSON.stringify(p));
    const all = JSON.parse(localStorage.getItem('allDays') || '{"me":{},"girlfriend":{}}');
    all[profileId] = {};
    localStorage.setItem('allDays', JSON.stringify(all));
  }, { stacked, profileId, tasks, start: TODAY });
  await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
}

await page.goto(BASE);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('me')); });
await page.reload();
await page.waitForSelector('.dashboard', { timeout: 10000 });

// ══ 1: a solo challenge looks exactly as it always has ════════════════════
await seed({ stacked: false });
await gotoTab('Today');
await page.waitForTimeout(500);
check('1: a solo challenge shows NO lane sections', (await page.locator('.lane-section').count()) === 0);
check('1: no Primary Challenge header appears', (await page.locator('.lane-kicker').count()) === 0);
const soloStored = (await prof()).tasks.length;
check('1: the flat task list renders every stored task',
  (await page.locator('.check-item').count()) === soloStored, String(soloStored));
check('1: the keystone explainer is still shown', (await page.locator('.keystone-explainer').count()) === 1);
check('1: Manage Tasks is still available', (await page.locator('.manage-tasks-link').count()) >= 1);
const soloIds = await page.evaluate(() => [...document.querySelectorAll('.check-item')].map(e => e.textContent.slice(0, 24)));
check('1: the solo order is unchanged (keystone first)', /Mental Training/.test(soloIds[0]), JSON.stringify(soloIds));

// ══ 2-5: stacked shows two labelled sections ══════════════════════════════
await seed({ stacked: true });
await gotoTab('Today');
await page.waitForTimeout(500);
check('2: stacking shows exactly two lane sections', (await page.locator('.lane-section').count()) === 2);
const sectionOrder = await page.evaluate(() =>
  [...document.querySelectorAll('.lane-section')].map(e => e.className));
check('3: the Primary section is first', /primary/.test(sectionOrder[0]), JSON.stringify(sectionOrder));
check('4: the Support section is second', /support/.test(sectionOrder[1]));
const headers = await page.evaluate(() =>
  [...document.querySelectorAll('.lane-header')].map(e => e.textContent));
check('2: the Primary header is labelled', /PRIMARY CHALLENGE/i.test(headers[0]));
check('2: the Support header is labelled', /SUPPORT CHALLENGE/i.test(headers[1]));
check('5: the Primary header names Mental Training Phase', /Mental Training Phase/.test(headers[0]));
check('5: the Support header names Fat Loss Challenge', /Fat Loss Challenge/.test(headers[1]));
check('the Primary header carries the ⚔️ marker', /⚔️/.test(headers[0]));
check('the Support header carries the 🛡️ marker', /🛡️/.test(headers[1]));
check('both sections stay inside the one Daily Tasks card',
  (await page.evaluate(() => {
    const card = [...document.querySelectorAll('.section-card')]
      .find(c => /Daily Tasks/.test(c.querySelector('.section-title')?.textContent || ''));
    return card ? card.querySelectorAll('.lane-section').length : -1;
  })) === 2);
check('the MWD and Manage Tasks controls are still present',
  (await page.locator('.mwd-toggle-btn').count()) === 1 &&
  (await page.locator('.manage-tasks-link').count()) >= 1);

// ══ 6-8: what lands where, and shared rows appear once ════════════════════
const laneIds = await page.evaluate(() => {
  const read = (sel) => [...document.querySelectorAll(`${sel} .check-item`)].map(e => e.textContent);
  return { primary: read('.lane-section.primary'), support: read('.lane-section.support') };
});
const inPrimary = (s) => laneIds.primary.some(t => t.includes(s));
const inSupport = (s) => laneIds.support.some(t => t.includes(s));
check('6: Mental Training tasks are under Primary',
  inPrimary('Mental Training — 5 minutes') && inPrimary('Read 5 pages') && inPrimary('Prayer'));
check('6: they are NOT under Support',
  !inSupport('Read 5 pages') && !inSupport('Prayer'));
check('7: Fat Loss tasks are under Support',
  inSupport('Hit protein') && inSupport('whole foods') && inSupport('10,000+ steps'));
check('7: they are NOT under Primary',
  !inPrimary('Hit protein') && !inPrimary('10,000+ steps'));
check('8: the shared sleep habit renders exactly ONCE across both sections',
  (await page.locator('.check-item', { hasText: 'Sleep 7.5–9 hours' }).count()) === 1);
check('8: the shared Daily Log renders exactly ONCE',
  (await page.locator('.check-item', { hasText: 'Complete Daily Log' }).count()) === 1);
check('8: the shared rows sit under Primary',
  inPrimary('Sleep 7.5–9 hours') && inPrimary('Complete Daily Log') &&
  !inSupport('Sleep 7.5–9 hours') && !inSupport('Complete Daily Log'));
const storedCount = (await prof()).tasks.length;
check('every stored task is rendered exactly once in total',
  laneIds.primary.length + laneIds.support.length === storedCount,
  `${laneIds.primary.length} + ${laneIds.support.length} vs ${storedCount} stored`);

// ══ 9: shared rows say so ═════════════════════════════════════════════════
const sharedBadges = await page.evaluate(() =>
  [...document.querySelectorAll('.check-supports')].map(e => e.textContent));
check('9: shared rows carry an "also supports" badge', sharedBadges.length === 2, JSON.stringify(sharedBadges));
check('9: the badge names the OTHER challenge',
  sharedBadges.every(b => /Also supports Fat Loss Challenge/.test(b)));
check('9: primary-only rows carry no badge', await page.evaluate(() =>
  [...document.querySelectorAll('.lane-section.primary .check-item')]
    .filter(e => /Read 5 pages|Prayer/.test(e.textContent))
    .every(e => !e.querySelector('.check-supports'))));
check('9: support-only rows carry no badge', await page.evaluate(() =>
  [...document.querySelectorAll('.lane-section.support .check-item')]
    .every(e => !e.querySelector('.check-supports'))));

// ══ Ordering within the sections ══════════════════════════════════════════
check('the primary keystone leads the Primary section',
  /Mental Training — 5 minutes/.test(laneIds.primary[0]), laneIds.primary[0]);
check('primary-only rows come before the shared rows',
  laneIds.primary.findIndex(t => t.includes('Prayer')) <
  laneIds.primary.findIndex(t => t.includes('Sleep 7.5–9 hours')));
check('the support keystones lead the Support section',
  /Hit protein|whole foods/.test(laneIds.support[0]), laneIds.support[0]);

// ══ 13: keystone styling survives in both lanes ═══════════════════════════
check('13: the primary keystone keeps its keystone styling',
  (await page.locator('.lane-section.primary .check-item.keystone-3').count()) === 1);
check('13: the support challenge keystones are NOT flattened',
  (await page.locator('.lane-section.support .check-item.keystone-3').count()) === 2);
check('13: mid-tier stars survive in both lanes',
  (await page.locator('.check-item.keystone-2').count()) === 2);
check('13: XP values are rendered on both lanes\' rows',
  (await page.locator('.lane-section.support .check-item').first().textContent()).includes('XP'));

// ══ 10-12: completing a shared task ═══════════════════════════════════════
await page.locator('.check-item', { hasText: 'Sleep 7.5–9 hours' }).first().click();
await page.waitForTimeout(500);
const d1 = (await days())[1];
check('10: completing the shared task records ONE completion', d1?.tasks?.mt_sleep === true);
check('12: no second completion record is created for the support side',
  !d1?.tasks?.fl_sleep, JSON.stringify(Object.keys(d1?.tasks || {})));
check('10: the user does not have to check it twice',
  (await page.locator('.check-item', { hasText: 'Sleep 7.5–9 hours' }).count()) === 1);
check('11: it is still one row per stored task after completion',
  (await page.evaluate(() => document.querySelectorAll('.check-item').length)) === storedCount);
const xpAfterShared = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => /Challenge XP/i.test(e.textContent || '') && e.children.length < 5);
  return el ? el.textContent : '';
});
check('11: exactly one completion key exists for the shared habit',
  Object.keys(d1?.tasks || {}).filter(k => /sleep/i.test(k)).length === 1,
  JSON.stringify(Object.keys(d1?.tasks || {})));

// ══ 14-16: XP, grades and perfect day unchanged ═══════════════════════════
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.tasks.map(t => [t.id, t.xp, t.challenges]));
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('profiles')).me.tasks.map(t => [t.id, t.xp, t.challenges]));
check('14: no task XP changed', JSON.stringify(before) === JSON.stringify(after));
check('18: reload preserves task ownership', await page.evaluate((seeded) => {
  const stored = JSON.parse(localStorage.getItem('profiles')).me.tasks;
  return seeded.every(s => {
    const t = stored.find(x => x.id === s.id);
    return t && JSON.stringify(t.challenges) === JSON.stringify(s.challenges);
  });
}, MT_TASKS.map(t => ({ id: t.id, challenges: t.challenges }))));
await gotoTab('Today');
await page.waitForTimeout(500);
check('18: reload preserves the two sections', (await page.locator('.lane-section').count()) === 2);
check('18: reload preserves which task is in which section', await page.evaluate(() =>
  [...document.querySelectorAll('.lane-section.support .check-item')]
    .every(e => /protein|whole foods|steps/i.test(e.textContent))));

// Complete every row → perfect day.
await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('allDays'));
  const p = JSON.parse(localStorage.getItem('profiles'));
  all.me[1] = { ...(all.me[1] || {}), date: null, dayNumber: 1, tasks: Object.fromEntries(p.me.tasks.map(t => [t.id, true])) };
  localStorage.setItem('allDays', JSON.stringify(all));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(500);
await gotoTab('Home');
await page.waitForTimeout(400);
const homeText = await page.textContent('.dashboard');
check('16: a fully checked stacked day reads as 100%', /100%/.test(homeText));
check('15: the challenge grade still renders', /%/.test(homeText));

// ══ 20: Manage Tasks ownership ════════════════════════════════════════════
await gotoTab('Settings');
await page.waitForTimeout(600);
const chips = await page.evaluate(() =>
  [...document.querySelectorAll('.task-manager-item')].map(e => ({
    name: (e.querySelector('.task-name-edit')?.textContent || '').slice(0, 30),
    lane: e.querySelector('.task-lane-chip')?.textContent || null,
  })));
check('20: every task row carries an ownership chip',
  chips.length === storedCount && chips.every(c => !!c.lane),
  `${chips.length} rows vs ${storedCount} stored`);
check('20: primary-only tasks are labelled Primary',
  chips.filter(c => /Read 5 pages|Prayer|Mental Training/.test(c.name)).every(c => c.lane === 'Primary'));
check('20: support-only tasks are labelled Support',
  chips.filter(c => /protein|whole foods|steps/i.test(c.name)).every(c => c.lane === 'Support'));
check('20: shared tasks are labelled Shared',
  chips.filter(c => /Sleep 7.5|Daily Log/.test(c.name)).every(c => c.lane === 'Shared'));
check('20: a legend explains the three labels',
  /counts for both, paid once/i.test(await page.textContent('.tm-lane-legend')));

// Editing a task must not corrupt its ownership.
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.tasks = p.me.tasks.map(t => t.id === 'mt_sleep' ? { ...t, name: 'Sleep — renamed by hand' } : t);
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
const renamed = (await prof()).tasks.find(t => t.id === 'mt_sleep');
check('renaming a shared task preserves its two-lane ownership',
  JSON.stringify(renamed.challenges) === '["primary","support"]');
await gotoTab('Today');
await page.waitForTimeout(500);
check('the renamed shared task still renders once, under Primary, with its badge',
  (await page.locator('.check-item', { hasText: 'Sleep — renamed by hand' }).count()) === 1 &&
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.lane-section.primary .check-item')]
      .find(e => /renamed by hand/.test(e.textContent));
    return !!el && !!el.querySelector('.check-supports');
  }));

// ══ 19: profile isolation ═════════════════════════════════════════════════
await seed({ stacked: true, profileId: 'me' });
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.girlfriend.challengeStart = null;
  p.girlfriend.activeChallenge = null;
  p.girlfriend.supportChallenge = null;
  localStorage.setItem('profiles', JSON.stringify(p));
});
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(300);
const gf = await prof('girlfriend');
check('19: stacking on Male leaves the Female profile with no support challenge',
  !gf.supportChallenge && !gf.activeChallenge);
await page.evaluate(() => { localStorage.setItem('activeProfile', JSON.stringify('girlfriend')); });
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
await gotoTab('Today');
await page.waitForTimeout(500);
check('19: the Female profile shows no lane sections', (await page.locator('.lane-section').count()) === 0);

// The female task-card layout also sections correctly when stacked.
await seed({ stacked: true, profileId: 'girlfriend' });
await gotoTab('Today');
await page.waitForTimeout(600);
check('the Female card layout also shows two lane sections',
  (await page.locator('.lane-section').count()) === 2);
check('and renders every task exactly once there too',
  (await page.locator('.gf-task-card').count()) === (await prof('girlfriend')).tasks.length);
check('shared rows are badged in the Female layout too',
  (await page.locator('.gf-task-supports').count()) >= 1 ||
  (await page.locator('.check-supports').count()) >= 1);

// ══ Forge Daily is unchanged ══════════════════════════════════════════════
await reset('me');
await page.evaluate((today) => {
  const p = JSON.parse(localStorage.getItem('profiles'));
  p.me.challengeStart = today;
  p.me.activeChallenge = { templateId: 'forge_daily', name: 'Forge Daily', emoji: '🔥', durationDays: null, isBaseline: true };
  p.me.supportChallenge = null; p.me.supportChallengeStart = null;
  localStorage.setItem('profiles', JSON.stringify(p));
}, TODAY);
await page.reload(); await page.waitForSelector('.dashboard', { timeout: 6000 }); await page.waitForTimeout(400);
await gotoTab('Today');
await page.waitForTimeout(500);
check('Forge Daily shows no lane sections', (await page.locator('.lane-section').count()) === 0);
check('Forge Daily still lists its tasks', (await page.locator('.check-item').count()) > 0);

// ══ 21: an all-shared support challenge degrades gracefully ═══════════════
await seed({
  stacked: true,
  tasks: MT_TASKS.filter(t => (t.challenges || []).includes('primary')),
});
await gotoTab('Today');
await page.waitForTimeout(500);
check('21: a support challenge with no unique tasks still shows its section',
  (await page.locator('.lane-section.support').count()) === 1);
check('21: and explains why it is empty rather than looking broken',
  /already covered by a Mental Training Phase task/i.test(await page.textContent('.lane-section.support')));

// ══ Mobile ════════════════════════════════════════════════════════════════
await seed({ stacked: true });
await page.setViewportSize({ width: 360, height: 740 });
await gotoTab('Today');
await page.waitForTimeout(600);
const overflow = await page.evaluate(() => ({
  body: document.body.scrollWidth - document.body.clientWidth,
  header: Math.max(0, ...[...document.querySelectorAll('.lane-header')].map(e => e.scrollWidth - e.clientWidth)),
}));
check('no horizontal overflow at 360px', overflow.body <= 1, JSON.stringify(overflow));
check('the lane headers fit the viewport', overflow.header <= 1);
check('both sections are still visible on a phone', (await page.locator('.lane-section').count()) === 2);
await page.setViewportSize({ width: 390, height: 844 });

// ══ No runtime errors ═════════════════════════════════════════════════════
check('no page errors across the full lane-sections flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
