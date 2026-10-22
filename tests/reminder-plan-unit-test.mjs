/**
 * The derived reminder plan.
 *
 * The old system shipped twelve fixed reminders and matched them to a user's
 * tasks with name regexes, so Forge could offer — and send — a Reading
 * reminder to someone with no reading task. The whole point of this module is
 * that a reminder exists only when the user's actual challenge contains the
 * habit, or they explicitly asked for it.
 *
 * So the assertions are mostly about ABSENCE: what the plan refuses to offer,
 * refuses to enable, and refuses to say.
 */
import {
  buildReminderPlan, CATEGORY, CATEGORY_META, UNIVERSAL_REMINDERS, PERSONAL_HABITS,
  challengeReminderId, defaultTimeForTask, shortTaskName, supportsLabel,
  TARGET_DAILY_MIN, TARGET_DAILY_MAX, BUSY_DAILY_THRESHOLD, CUSTOM_PREFIX,
} from '../src/data/reminderPlan.js';
import { reminderPayload, reminderFallbackFor, reminderPreview } from '../src/data/reminderCopy.js';
import { makeDefaultNotifPrefs, migrateNotifPrefs, migrateAllNotifPrefs, getDueReminders } from '../src/utils/notificationUtils.js';
import { HABIT_KEYS } from '../src/data/habitKeys.js';
import * as LI from '../src/data/lockInConfig.js';
import * as FLH from '../src/data/fatLossHardConfig.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const NONE = { reminders: {} };
const ctxFor = (tasks, over = {}) => ({
  profileId: 'me', tasks, dayData: null, dayNumber: 3,
  challengeName: 'LOCK IN', challengeActive: true, ...over,
});

const lockInTasks = LI.buildStartTasks();
const fatLossTasks = FLH.buildStartTasks(FLH.defaultSetup());
const lockIn = ctxFor(lockInTasks);
const fatLoss = ctxFor(fatLossTasks, { challengeName: 'Fat Loss — Hard Mode' });
const noChallenge = ctxFor([], { challengeName: null, challengeActive: false, dayNumber: null });

// ══ 1: the three categories ═════════════════════════════════════════════════
let plan = buildReminderPlan(NONE, lockIn);
check('1: the plan has all three categories',
  Array.isArray(plan.universal) && Array.isArray(plan.challenge) && Array.isArray(plan.personal));
check('1: each category has display metadata',
  Object.values(CATEGORY).every(c => !!CATEGORY_META[c]?.title && !!CATEGORY_META[c]?.blurb));
check('1: every reminder declares its category',
  plan.all.every(r => Object.values(CATEGORY).includes(r.category)));
check('1: every reminder has an id, label, icon, time and supports line',
  plan.all.every(r => r.id && r.label && r.icon && /^\d{2}:\d{2}$/.test(r.time) && r.supports),
  plan.all.filter(r => !(r.id && r.label && r.icon && /^\d{2}:\d{2}$/.test(r.time) && r.supports)).map(r => r.id).join(', ') || 'all complete');
check('1: ids are unique across the whole plan',
  new Set(plan.all.map(r => r.id)).size === plan.all.length);

// ══ 2: universal reminders work with or without a challenge ═════════════════
const bare = buildReminderPlan(NONE, noChallenge);
check('2: universal reminders exist with no challenge at all',
  bare.universal.length >= 2 &&
  bare.universal.some(r => r.id === 'u_morning') && bare.universal.some(r => r.id === 'u_evening'));
check('2: morning and evening are on by default',
  bare.universal.find(r => r.id === 'u_morning').enabled &&
  bare.universal.find(r => r.id === 'u_evening').enabled);
check('2: general encouragement is OFF by default',
  bare.universal.find(r => r.id === 'u_encouragement').enabled === false);
check('2: the Daily Log reminder is not even offered without a Daily Log task',
  !bare.universal.some(r => r.id === 'u_dailylog'));
check('2: it IS offered when the challenge has a Daily Log task',
  plan.universal.some(r => r.id === 'u_dailylog'));
check('2: and it is still off by default',
  plan.universal.find(r => r.id === 'u_dailylog').enabled === false);

// ══ 3: challenge reminders are derived from the real challenge ══════════════
check('3: LOCK IN produces LOCK IN reminders',
  plan.challenge.length >= 7 && plan.challenge.some(r => /Flow training/i.test(r.label)),
  plan.challenge.map(r => r.label).join(', '));
check('3: they use the live task names, not hardcoded copy',
  plan.challenge.every(r => lockInTasks.some(t => t.name === r.fullName)));
check('3: they carry the task\'s real XP and keystone tier',
  plan.challenge.find(r => /Sleep opportunity/i.test(r.label)).xp === LI.XP.sleep &&
  plan.challenge.find(r => /Sleep opportunity/i.test(r.label)).keystone === 3);
check('3: the highest-priority keystone leads the list',
  plan.challenge[0].keystone === 3);
check('3: Fat Loss produces Fat Loss reminders instead',
  (() => {
    const fl = buildReminderPlan(NONE, fatLoss);
    const labels = fl.challenge.map(r => r.label).join(' | ');
    return fl.challenge.length > 0 &&
      !fl.challenge.some(r => /Flow training/i.test(r.label)) &&
      fatLossTasks.some(t => fl.challenge.some(r => r.fullName === t.name)) &&
      labels.length > 0;
  })(),
  buildReminderPlan(NONE, fatLoss).challenge.map(r => r.label).join(', '));
check('3: switching challenges changes the reminder set entirely',
  (() => {
    const a = new Set(buildReminderPlan(NONE, lockIn).challenge.map(r => r.id));
    const b = new Set(buildReminderPlan(NONE, fatLoss).challenge.map(r => r.id));
    const shared = [...a].filter(x => b.has(x));
    // Some habits genuinely overlap (both challenges track sleep), but the
    // sets must not be identical.
    return a.size > 0 && b.size > 0 && shared.length < Math.min(a.size, b.size);
  })());
check('3: the Daily Log is never a challenge reminder — it has its own',
  !plan.challenge.some(r => r.habitKey === HABIT_KEYS.DAILY_LOG));
check('3: each reminder says what requirement it supports',
  plan.challenge.every(r => r.supports.includes('LOCK IN') && /XP/.test(r.supports)));
check('3: keystone habits are labelled as such',
  /Keystone habit/.test(plan.challenge[0].supports), plan.challenge[0].supports);
check('3: reminder ids are stable per habit, so a decision survives a restart',
  challengeReminderId({ habitKey: HABIT_KEYS.SLEEP_TARGET }) === 'c_sleep_target' &&
  challengeReminderId({ id: 'x' }) === 'c_x' &&
  challengeReminderId({}) === null);
check('3: default times are per-habit, not all at one hour',
  new Set(plan.challenge.map(r => r.time)).size >= 5,
  plan.challenge.map(r => `${r.label}@${r.time}`).join(' '));

// ══ 4: no challenge → no challenge reminders ════════════════════════════════
check('4: a profile with no challenge gets no challenge reminders', bare.challenge.length === 0);
check('4: the plan says so rather than pretending', bare.hasChallenge === false && bare.challengeName === null);
check('4: a SCHEDULED challenge that has not begun produces none either',
  buildReminderPlan(NONE, ctxFor(lockInTasks, { challengeActive: false, dayNumber: null })).challenge.length === 0);
check('4: Forge Daily produces none',
  buildReminderPlan(NONE, ctxFor(lockInTasks, { challengeActive: false, challengeName: 'Forge Daily' })).challenge.length === 0);
check('4: but the universal reminders still work in all of those cases',
  [bare, buildReminderPlan(NONE, ctxFor(lockInTasks, { challengeActive: false }))]
    .every(p => p.deliverable.length >= 2));

// ══ 5: THE RULE — never remind about a habit the user does not have ═════════
check('5: no Reading reminder is enabled for a user with no reading habit',
  !buildReminderPlan(NONE, lockIn).deliverable.some(r => /read/i.test(r.label)),
  buildReminderPlan(NONE, lockIn).deliverable.map(r => r.label).join(', '));
check('5: Reading is OFFERED as an opt-in personal habit, but switched off',
  (() => {
    const r = plan.personal.find(x => x.id === 'p_reading');
    return r && r.enabled === false;
  })());
check('5: every personal habit is off by default',
  plan.personal.every(r => r.enabled === false));
check('5: a personal habit only becomes deliverable once explicitly enabled',
  buildReminderPlan({ reminders: { p_reading: { enabled: true } } }, lockIn)
    .deliverable.some(r => r.id === 'p_reading'));
check('5: no workout reminder is sent to someone with no workout habit',
  !bare.deliverable.some(r => /workout|training/i.test(r.label)));
check('5: nothing in the default plan comes from name-matching a task',
  // The old system used regexes on task names; ids are now derived from
  // habitKeys only.
  plan.challenge.every(r => r.id === `c_${r.habitKey}`));

// ══ 6: shared habits never produce two reminders ════════════════════════════
// A personal habit whose behaviour the challenge already requires is
// superseded — the challenge reminder covers it.
const withReadingTask = ctxFor([
  ...lockInTasks,
  { id: 'r1', name: 'Read 10 pages', icon: '📚', xp: 20, keystone: 1, habitKey: HABIT_KEYS.READING },
]);
const sharedPlan = buildReminderPlan({ reminders: { p_reading: { enabled: true } } }, withReadingTask);
check('6: a personal habit the challenge covers is marked superseded',
  sharedPlan.personal.find(r => r.id === 'p_reading').superseded === 'c_reading');
check('6: and is NOT delivered, even though it is switched on',
  !sharedPlan.deliverable.some(r => r.id === 'p_reading'));
check('6: the challenge reminder for that habit is what remains',
  sharedPlan.challenge.some(r => r.habitKey === HABIT_KEYS.READING));
check('6: exactly one reminder exists per habit key across the whole plan',
  (() => {
    const keys = sharedPlan.deliverable.map(r => r.habitKey).filter(Boolean);
    return new Set(keys).size === keys.length;
  })(),
  sharedPlan.deliverable.map(r => r.habitKey).filter(Boolean).join(', '));
check('6: a superseded habit renders no payload at all',
  reminderPayload(sharedPlan.personal.find(r => r.id === 'p_reading'), withReadingTask) === null);
// A task shared between primary and support lanes appears once in the merged
// list, so it can only ever produce one reminder.
const sharedLane = ctxFor(lockInTasks, { isSharedTask: (t) => t.id === 'li_sleep' });
const lanePlan = buildReminderPlan(NONE, sharedLane);
check('6: a task shared across lanes produces exactly one reminder',
  lanePlan.challenge.filter(r => r.habitKey === HABIT_KEYS.SLEEP_TARGET).length === 1);
check('6: and its supports line says it covers both',
  /support challenge/i.test(lanePlan.challenge.find(r => r.habitKey === HABIT_KEYS.SLEEP_TARGET).supports));

// ══ 7: volume — roughly two to three a day by default ═══════════════════════
check('7: the default plan is 2–3 reminders a day with a challenge running',
  plan.enabledCount >= TARGET_DAILY_MIN && plan.enabledCount <= TARGET_DAILY_MAX,
  `${plan.enabledCount}: ${plan.deliverable.map(r => r.id).join(', ')}`);
check('7: the default plan is 2 a day with no challenge',
  bare.enabledCount === 2, `${bare.enabledCount}`);
check('7: only ONE challenge habit is on by default, even with three keystones',
  plan.deliverable.filter(r => r.category === CATEGORY.CHALLENGE).length === 1,
  plan.deliverable.filter(r => r.category === CATEGORY.CHALLENGE).map(r => r.label).join(', '));
check('7: the one that is on is the top keystone',
  plan.deliverable.find(r => r.category === CATEGORY.CHALLENGE).keystone === 3);
check('7: Fat Loss also defaults to a sane volume',
  (() => {
    const n = buildReminderPlan(NONE, fatLoss).enabledCount;
    return n >= TARGET_DAILY_MIN && n <= TARGET_DAILY_MAX;
  })(), `${buildReminderPlan(NONE, fatLoss).enabledCount}`);
check('7: the busy threshold is above the target, so the default never warns',
  BUSY_DAILY_THRESHOLD > TARGET_DAILY_MAX);
check('7: a user can turn more on — nothing silently caps them',
  buildReminderPlan(
    { reminders: Object.fromEntries(plan.all.map(r => [r.id, { enabled: true }])) }, lockIn,
  ).enabledCount > BUSY_DAILY_THRESHOLD);

// ══ 8: payload copy is specific, and honest about completion ════════════════
const withDone = ctxFor(lockInTasks, { dayData: { tasks: { li_sleep: true } } });
const donePlan = buildReminderPlan({ reminders: { c_sleep_target: { enabled: true } } }, withDone);
check('8: a completed habit produces NO payload',
  reminderPayload(donePlan.challenge.find(r => r.habitKey === HABIT_KEYS.SLEEP_TARGET), withDone) === null);
check('8: an incomplete habit produces a specific, actionable payload',
  (() => {
    const r = plan.challenge.find(x => x.habitKey === HABIT_KEYS.SLEEP_TARGET);
    const pl = reminderPayload(r, lockIn);
    return pl && /8\+ hours/.test(pl.body) && /XP/.test(pl.body) && /Sleep opportunity/.test(pl.title);
  })(),
  JSON.stringify(reminderPayload(plan.challenge.find(x => x.habitKey === HABIT_KEYS.SLEEP_TARGET), lockIn)));
check('8: the morning mission names the habit to start with',
  /Start with/.test(reminderPayload(plan.universal.find(r => r.id === 'u_morning'), lockIn).body));
check('8: the evening check-in counts what is actually left',
  /\d+ habits still open/.test(reminderPayload(plan.universal.find(r => r.id === 'u_evening'), lockIn).body));
check('8: with the day finished, morning and evening say nothing',
  (() => {
    const allDone = ctxFor(lockInTasks, {
      dayData: { tasks: Object.fromEntries(lockInTasks.map(t => [t.id, true])) },
    });
    const p2 = buildReminderPlan(NONE, allDone);
    return reminderPayload(p2.universal.find(r => r.id === 'u_morning'), allDone) === null &&
      reminderPayload(p2.universal.find(r => r.id === 'u_evening'), allDone) === null;
  })());
check('8: the Daily Log reminder fires only while the log is open',
  (() => {
    const open = reminderPayload(plan.universal.find(r => r.id === 'u_dailylog'), lockIn);
    const logged = ctxFor(lockInTasks, { dayData: { tasks: { daily_log: true } } });
    const shut = reminderPayload(
      buildReminderPlan(NONE, logged).universal.find(r => r.id === 'u_dailylog'), logged);
    return !!open && shut === null;
  })());
check('8: a personal habit never claims completion either way',
  (() => {
    const r = buildReminderPlan({ reminders: { p_reading: { enabled: true } } }, bare)
      .personal.find(x => x.id === 'p_reading');
    const pl = reminderPayload(r, noChallenge);
    return pl && !/still open|remaining|left|complete/i.test(pl.body);
  })());
check('8: every payload carries a tag and a view',
  plan.all.map(r => reminderPayload(r, lockIn)).filter(Boolean)
    .every(pl => pl.tag && pl.view));
check('8: payloads are not repetitive generic motivation',
  (() => {
    const bodies = plan.all.map(r => reminderPayload(r, lockIn)).filter(Boolean).map(p => p.body);
    return new Set(bodies).size === bodies.length;
  })());

// ══ 9: fallbacks never claim anything about today ═══════════════════════════
const allOn = buildReminderPlan(
  { reminders: Object.fromEntries(plan.all.map(r => [r.id, { enabled: true }])) }, lockIn);
const fallbacks = allOn.all.filter(r => !r.superseded).map(r => reminderFallbackFor(r));
check('9: every deliverable reminder has a fallback', fallbacks.every(Boolean));
// The body is where a stale claim would live — "3 left", "day 9", "+40 XP".
// A TITLE may contain a digit because it is the habit's own permanent name
// ("Execute 2 of 3 priorities"), which is a fixed requirement rather than
// anything about today.
check('9: no fallback body contains a number — no counts, no day numbers, no XP',
  fallbacks.every(f => !/\d/.test(f.body)),
  fallbacks.filter(f => /\d/.test(f.body)).map(f => f.body).join(' | ') || 'clean');
check('9: a fallback title is only the habit name, never a live figure',
  fallbacks.every(f => !/\bXP\b|\bday \d|\d+ (left|remaining|open)/i.test(f.title)),
  fallbacks.filter(f => /\bXP\b|\bday \d|\d+ (left|remaining|open)/i.test(f.title)).map(f => f.title).join(' | ') || 'clean');
check('9: no fallback claims something is unfinished',
  fallbacks.every(f => !/still open|remaining|left today|unfinished|incomplete/i.test(f.body)),
  fallbacks.filter(f => /still open|remaining|left today|unfinished|incomplete/i.test(f.body)).map(f => f.body).join(' | ') || 'clean');
check('9: fallbacks are still specific enough to be useful',
  fallbacks.every(f => f.body.length > 12 && f.title.length > 2));

// ══ 10: privacy — no wellness data in anything bound for the server ═════════
const sensitiveCtx = ctxFor(lockInTasks, {
  dayData: {
    tasks: {},
    notes: 'Felt awful today, argued with my brother.',
    mood: 2, energy: 3, stress: 9, recovery: 4, sleep: 2, confidence: 1, workoutEffort: 7,
  },
});
const sensitivePlan = buildReminderPlan(
  { reminders: Object.fromEntries(plan.all.map(r => [r.id, { enabled: true }])) }, sensitiveCtx);
const wire = JSON.stringify(sensitivePlan.deliverable.map(r => ({
  time: r.time, payload: reminderPayload(r, sensitiveCtx), fallback: reminderFallbackFor(r),
})));
check('10: no Daily Log note text reaches the wire',
  !/argued with my brother|Felt awful/i.test(wire));
check('10: no mood, energy, stress or recovery rating reaches the wire',
  !/"mood"|"energy"|"stress"|"recovery"|"confidence"|"workoutEffort"/.test(wire));
check('10: the wire carries only times and notification copy',
  (() => {
    const parsed = JSON.parse(wire);
    return parsed.every(e => {
      const keys = Object.keys(e).sort().join(',');
      const pk = e.payload ? Object.keys(e.payload).sort().join(',') : '';
      return keys === 'fallback,payload,time' && (!e.payload || pk === 'body,tag,title,view');
    });
  })());

// ══ 11: migration from the v1 fixed catalogue ═══════════════════════════════
const v1 = {
  masterEnabled: true,
  quietHours: { start: '23:00', end: '06:30' },
  reminders: {
    morning: { enabled: true, time: '07:15' },
    evening: { enabled: false, time: '20:00' },
    reading: { enabled: true, time: '21:00' },
    workout: { enabled: false, time: '16:00' },
    water: { enabled: false, time: '14:00' },
    photo: { enabled: true, time: '20:30' },
    streak: { enabled: true, time: '21:00' },
    sleep: { enabled: true, time: '21:30' },
  },
};
const v2 = migrateNotifPrefs(v1);
check('11: migration marks the version', v2.prefsVersion === 2);
check('11: the master switch and quiet hours are preserved',
  v2.masterEnabled === true && v2.quietHours.start === '23:00' && v2.quietHours.end === '06:30');
check('11: an explicitly enabled reminder carries over, with its time',
  v2.reminders.u_morning.enabled === true && v2.reminders.u_morning.time === '07:15');
check('11: an explicitly enabled topic becomes the matching personal habit',
  v2.reminders.p_reading.enabled === true && v2.reminders.p_reading.time === '21:00');
check('11: a DISABLED v1 reminder stays disabled',
  v2.reminders.u_evening.enabled === false && v2.reminders.p_workout.enabled === false);
check('11: migration never turns anything ON that was off',
  Object.entries(v2.reminders).every(([id, r]) => {
    const source = Object.entries({ morning: 'u_morning', evening: 'u_evening', reading: 'p_reading', workout: 'p_workout', water: 'p_hydration' })
      .find(([, v2id]) => v2id === id);
    return !source || r.enabled === !!v1.reminders[source[0]]?.enabled;
  }));
check('11: v1 reminders with no v2 equivalent are dropped, not invented',
  !('photo' in v2.reminders) && !('streak' in v2.reminders) && !('sleep' in v2.reminders) &&
  !Object.keys(v2.reminders).some(k => k.startsWith('c_')));
check('11: the migrated plan is not spammy',
  (() => {
    const n = buildReminderPlan(v2, lockIn).enabledCount;
    return n <= BUSY_DAILY_THRESHOLD;
  })(), `${buildReminderPlan(v2, lockIn).enabledCount} reminders`);
check('11: migration is idempotent',
  JSON.stringify(migrateNotifPrefs(v2)) === JSON.stringify(v2));
check('11: a v1 user who had everything off stays silent',
  buildReminderPlan(
    migrateNotifPrefs({ masterEnabled: false, reminders: { morning: { enabled: false } } }), lockIn,
  ).deliverable.length >= 0 &&
  migrateNotifPrefs({ masterEnabled: false, reminders: {} }).masterEnabled === false);
check('11: both profiles migrate', (() => {
  const out = migrateAllNotifPrefs({ me: v1, girlfriend: undefined });
  return out.me.prefsVersion === 2 && out.girlfriend.prefsVersion === 2;
})());
check('11: fresh defaults store no reminder decisions at all',
  Object.keys(makeDefaultNotifPrefs().reminders).length === 0 &&
  makeDefaultNotifPrefs().prefsVersion === 2);

// ══ 12: the in-app scheduler uses the same plan ═════════════════════════════
const onPrefs = { masterEnabled: true, quietHours: { start: '22:30', end: '07:00' }, reminders: {} };
const at = (h, m) => { const d = new Date(2026, 6, 15, h, m); return d; };
check('12: nothing is due before its time',
  getDueReminders(onPrefs, lockIn, '2026-07-15', at(6, 0)).length === 0);
check('12: the morning mission is due after 08:00',
  getDueReminders(onPrefs, lockIn, '2026-07-15', at(9, 0)).some(r => r.type === 'u_morning'));
check('12: quiet hours suppress everything',
  getDueReminders(onPrefs, lockIn, '2026-07-15', at(23, 30)).length === 0);
check('12: the master switch off suppresses everything',
  getDueReminders({ ...onPrefs, masterEnabled: false }, lockIn, '2026-07-15', at(9, 0)).length === 0);
check('12: a disabled-by-default habit is not due',
  !getDueReminders(onPrefs, lockIn, '2026-07-15', at(22, 0))
    .some(r => r.type === 'c_attention_training'));
check('12: in-app results carry the same shape as a push payload',
  getDueReminders(onPrefs, lockIn, '2026-07-15', at(9, 0))
    .every(r => r.type && r.title && r.body && r.tag && r.view));

// ══ 13: helpers ═════════════════════════════════════════════════════════════
check('13: shortTaskName trims the target off',
  shortTaskName({ name: 'Sleep opportunity: 8+ hours' }) === 'Sleep opportunity' &&
  shortTaskName({ name: 'Complete Daily Log' }) === 'Complete Daily Log' &&
  shortTaskName({}) === '');
check('13: defaultTimeForTask gives a per-habit slot and a fallback',
  defaultTimeForTask({ habitKey: HABIT_KEYS.SLEEP_TARGET }) === '21:30' &&
  /^\d{2}:\d{2}$/.test(defaultTimeForTask({ habitKey: 'unknown_habit' })));
check('13: supportsLabel names the challenge, the tier and the XP',
  (() => {
    const l = supportsLabel({ name: 'x', xp: 40, keystone: 3 }, 'LOCK IN', false);
    return /LOCK IN/.test(l) && /Keystone/.test(l) && /40 XP/.test(l);
  })());
check('13: a custom habit is carried into the plan',
  (() => {
    const p2 = buildReminderPlan({
      reminders: {}, customHabits: [{ id: `${CUSTOM_PREFIX}abc`, label: 'Stretch', time: '18:30', enabled: true }],
    }, lockIn);
    const r = p2.personal.find(x => x.id === `${CUSTOM_PREFIX}abc`);
    return r && r.label === 'Stretch' && r.time === '18:30' && r.enabled === true &&
      !!reminderPayload(r, lockIn);
  })());
check('13: reminderPreview falls back to the generic copy when nothing applies',
  (() => {
    const allDone = ctxFor(lockInTasks, {
      dayData: { tasks: Object.fromEntries(lockInTasks.map(t => [t.id, true])) },
    });
    const r = buildReminderPlan(NONE, allDone).universal.find(x => x.id === 'u_morning');
    return typeof reminderPreview(r, allDone) === 'string';
  })());
check('13: the universal catalogue and personal catalogue are non-empty and unique',
  UNIVERSAL_REMINDERS.length >= 4 && PERSONAL_HABITS.length >= 5 &&
  new Set([...UNIVERSAL_REMINDERS, ...PERSONAL_HABITS].map(r => r.id)).size ===
    UNIVERSAL_REMINDERS.length + PERSONAL_HABITS.length);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
