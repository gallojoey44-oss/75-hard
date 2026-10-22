/**
 * Background push delivery.
 *
 * These tests exist because the previous implementation passed its own tests
 * while delivering nothing. The two defects that made real background delivery
 * impossible were both invisible to a "does the test button work?" check:
 *
 *   1. a stale-day guard that suppressed every reminder unless the app had been
 *      opened earlier the same day — i.e. unless background delivery was not
 *      needed;
 *   2. no catch-up window, so an infrequent dispatcher either missed a reminder
 *      entirely or dumped the whole day's worth at once.
 *
 * So the assertions below are written from the dispatcher's point of view: with
 * this schedule, at this moment, what would actually be sent?
 */
import {
  evaluateSchedule, localNow, toMinutes, inQuietHours,
  cadenceMinutes, CATCH_UP_MINUTES, SCHEDULER_STALE_MINUTES,
} from '../api/_lib/schedule.js';
import { makeDefaultNotifPrefs, timeInQuietHours, minutesOf } from '../src/utils/notificationUtils.js';
import { buildReminderPlan, UNIVERSAL_REMINDERS, PERSONAL_HABITS } from '../src/data/reminderPlan.js';
import { reminderFallbackFor } from '../src/data/reminderCopy.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const TZ = 'America/New_York';
/** A Date that is `hh:mm` local time in New York on the given date. */
function atLocal(dateStr, hh, mm) {
  // New York is UTC-4 in summer; use a July date so the offset is fixed at -4.
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + 4, mm));
}

function schedule(over = {}) {
  return {
    timezone: TZ,
    localDate: '2026-07-15',
    masterEnabled: true,
    quietHours: { start: '22:30', end: '07:00' },
    reminders: {
      water: {
        time: '14:00',
        payload: { title: 'Water', body: '2 of 4 complete today' },
        fallback: { title: 'Water', body: 'Time for your water check-in' },
      },
    },
    ...over,
  };
}

// ══ localNow / toMinutes / quiet hours ══════════════════════════════════════
check('local date and minutes come from the IANA timezone, not UTC',
  localNow(TZ, atLocal('2026-07-15', 14, 30)).date === '2026-07-15' &&
  localNow(TZ, atLocal('2026-07-15', 14, 30)).minutes === 14 * 60 + 30);
check('an evening local time is still the same local date',
  localNow(TZ, atLocal('2026-07-15', 21, 0)).date === '2026-07-15');
check('after local midnight the local date has advanced even though UTC has not',
  localNow(TZ, new Date(Date.UTC(2026, 6, 16, 3, 0))).date === '2026-07-15',
  '23:00 ET on the 15th');
check('toMinutes parses HH:MM', toMinutes('07:05') === 425 && toMinutes('00:00') === 0);
check('quiet hours spanning midnight include both sides',
  inQuietHours({ start: '22:30', end: '07:00' }, 23 * 60) &&
  inQuietHours({ start: '22:30', end: '07:00' }, 2 * 60) &&
  !inQuietHours({ start: '22:30', end: '07:00' }, 12 * 60));
check('quiet hours within one day behave normally',
  inQuietHours({ start: '09:00', end: '11:00' }, 10 * 60) &&
  !inQuietHours({ start: '09:00', end: '11:00' }, 11 * 60));
check('absent quiet hours never suppress', !inQuietHours(null, 0) && !inQuietHours({}, 500));

// ══ 1: a reminder is due once its local time has passed ═════════════════════
let r = evaluateSchedule(schedule(), atLocal('2026-07-15', 14, 1));
check('1: a reminder one minute past its time is due', r.due.length === 1 && r.due[0].type === 'water');
check('1: the fresh dynamic payload is used on the same local day',
  r.due[0].payload.body === '2 of 4 complete today');
check('1: it is not flagged stale', r.due[0].stale === false);

r = evaluateSchedule(schedule(), atLocal('2026-07-15', 13, 59));
check('1: a reminder one minute BEFORE its time is not due', r.due.length === 0);

r = evaluateSchedule(schedule(), atLocal('2026-07-15', 14, 0));
check('1: a reminder exactly at its time is due', r.due.length === 1);

// ══ 2: the catch-up window ══════════════════════════════════════════════════
// Without this, "due" meant "any time today that has already passed", so a
// recovered dispatcher would deliver the whole day at once, hours late.
check('2: the window is a real, bounded number', CATCH_UP_MINUTES > 0 && CATCH_UP_MINUTES <= 180,
  `${CATCH_UP_MINUTES} min`);
r = evaluateSchedule(schedule(), atLocal('2026-07-15', 14, 0 + CATCH_UP_MINUTES));
check('2: still due at exactly the end of the window', r.due.length === 1);
r = evaluateSchedule(schedule(), atLocal('2026-07-15', 14, 0), 90);
check('2: a run moments after the time is inside the window', r.due.length === 1);
r = evaluateSchedule(schedule(), atLocal('2026-07-15', 17, 0));
check('2: three hours late is NOT delivered — that is noise, not a reminder', r.due.length === 0);
r = evaluateSchedule(schedule(), atLocal('2026-07-15', 14, 30), 15);
check('2: the window is configurable per call (for tests and tuning)', r.due.length === 0);

// ══ 3: the stale-day fix — the defect that made background delivery impossible
// The schedule carries pre-rendered copy for one local date. The old code
// suppressed EVERYTHING once that date was not today, which meant reminders
// only ever fired on days the app had already been opened.
const stale = schedule({ localDate: '2026-07-14' });
r = evaluateSchedule(stale, atLocal('2026-07-15', 14, 10));
check('3: a stale day is detected', r.staleDay === true);
check('3: a stale day no longer suppresses the reminder', r.due.length === 1);
check('3: the date-independent fallback copy is sent instead of the stale payload',
  r.due[0].payload.body === 'Time for your water check-in');
check('3: the send is flagged as a fallback so diagnostics can say so', r.due[0].stale === true);

// A reminder with no fallback is still suppressed on a stale day: silence beats
// a stale number. The server must never invent dynamic values.
const staleNoFallback = {
  ...stale,
  reminders: { water: { time: '14:00', payload: { title: 'Water', body: '2 of 4 complete today' } } },
};
r = evaluateSchedule(staleNoFallback, atLocal('2026-07-15', 14, 10));
check('3: with no fallback a stale reminder is suppressed rather than fabricated', r.due.length === 0);
check('3: nothing stale-dated is ever sent as if it were fresh',
  evaluateSchedule(staleNoFallback, atLocal('2026-07-15', 14, 10)).due
    .every(d => d.payload.body !== '2 of 4 complete today'));

// A fresh schedule missing its dynamic payload falls back rather than going silent.
r = evaluateSchedule(
  schedule({ reminders: { water: { time: '14:00', payload: null, fallback: { title: 'W', body: 'generic' } } } }),
  atLocal('2026-07-15', 14, 10));
check('3: a reminder that did not apply at sync time still fires with generic copy',
  r.due.length === 1 && r.due[0].payload.body === 'generic');

// ══ 4: the suppression paths that SHOULD still suppress ═════════════════════
r = evaluateSchedule(schedule({ masterEnabled: false }), atLocal('2026-07-15', 14, 10));
check('4: the master switch off sends nothing', r.due.length === 0);

r = evaluateSchedule(
  schedule({ reminders: { sleep: { time: '23:00', payload: { title: 'S', body: 'b' }, fallback: { title: 'S', body: 'b' } } } }),
  atLocal('2026-07-15', 23, 10));
check('4: quiet hours suppress delivery', r.quiet === true && r.due.length === 0);
check('4: quiet hours are reported, so the user can see WHY nothing arrived', r.quiet === true);

r = evaluateSchedule(schedule({ reminders: {} }), atLocal('2026-07-15', 14, 10));
check('4: an empty reminder set sends nothing', r.due.length === 0);
r = evaluateSchedule(schedule({ reminders: { water: null } }), atLocal('2026-07-15', 14, 10));
check('4: a null reminder entry is skipped without throwing', r.due.length === 0);

// ══ 5: every reminder the plan can deliver has fallback copy ═══════════════
// This is what keeps defect 3 fixed. A reminder with no fallback is silently
// dead on any day the app was not opened. The catalogue is derived now, so the
// property is checked across a plan built from a real challenge.
const planTasks = [
  { id: 't_sleep', name: 'Sleep opportunity: 8+ hours', icon: '😴', xp: 40, keystone: 3, keystoneHabit: true, habitKey: 'sleep_target' },
  { id: 't_flow', name: 'Flow training: 2 focused sessions', icon: '🌊', xp: 35, keystone: 3, keystoneHabit: true, habitKey: 'flow_session' },
  { id: 't_log', name: 'Complete Daily Log', icon: '📊', xp: 10, keystone: 0, habitKey: 'daily_log' },
];
const planCtx = { tasks: planTasks, challengeName: 'LOCK IN', challengeActive: true };
const fullPrefs = {
  reminders: Object.fromEntries(
    buildReminderPlan({ reminders: {} }, planCtx).all.map(r => [r.id, { enabled: true }]),
  ),
};
const everyReminder = buildReminderPlan(fullPrefs, planCtx).all;
check('5: the plan produces reminders at all', everyReminder.length >= 6, `${everyReminder.length}`);
check('5: every deliverable reminder has a fallback',
  everyReminder.filter(r => !r.superseded).every(r => !!reminderFallbackFor(r)),
  everyReminder.filter(r => !r.superseded && !reminderFallbackFor(r)).map(r => r.id).join(', ') || 'all covered');
check('5: fallbacks have both a title and a body',
  everyReminder.filter(r => !r.superseded).every(r => {
    const f = reminderFallbackFor(r);
    return f && typeof f.title === 'string' && f.title && typeof f.body === 'string' && f.body;
  }));
check('5: fallback copy contains no count, date or day number — it must be true on any day',
  everyReminder.filter(r => !r.superseded).every(r => {
    const f = reminderFallbackFor(r);
    return !/\b\d+\b/.test(`${f.title} ${f.body}`);
  }),
  everyReminder.filter(r => !r.superseded && /\b\d+\b/.test(
    `${reminderFallbackFor(r).title} ${reminderFallbackFor(r).body}`)).map(r => r.id).join(', ') || 'clean');
check('5: a superseded personal habit has no fallback — it is never delivered',
  everyReminder.filter(r => r.superseded).every(r => reminderFallbackFor(r) === null));

// ══ 5b: no default setting silently blocks delivery ═════════════════════════
// "Quiet hours are swallowing a reminder you set" looks identical to broken
// push, so the defaults must not do it and the UI must be able to spot it.
const defaults = makeDefaultNotifPrefs();
check('5b: minutesOf parses a reminder time', minutesOf('21:30') === 1290 && Number.isNaN(minutesOf('')));
const defaultPlan = buildReminderPlan({ reminders: {} }, planCtx);
check('5b: no reminder that is ON by default sits inside the default quiet window',
  defaultPlan.deliverable.every(r => !timeInQuietHours(defaults.quietHours, minutesOf(r.time))),
  defaultPlan.deliverable.filter(r => timeInQuietHours(defaults.quietHours, minutesOf(r.time)))
    .map(r => `${r.id}@${r.time}`).join(', ') || 'none blocked');
check('5b: no OFFERED reminder defaults to a time inside quiet hours either',
  defaultPlan.all.every(r => !timeInQuietHours(defaults.quietHours, minutesOf(r.time))),
  defaultPlan.all.filter(r => timeInQuietHours(defaults.quietHours, minutesOf(r.time)))
    .map(r => `${r.id}@${r.time}`).join(', ') || 'none blocked');
check('5b: a reminder moved inside quiet hours IS detected',
  timeInQuietHours(defaults.quietHours, minutesOf('23:15')) &&
  timeInQuietHours(defaults.quietHours, minutesOf('03:00')));
check('5b: the quiet-hours boundary is inclusive at the start and exclusive at the end',
  timeInQuietHours({ start: '22:30', end: '07:00' }, minutesOf('22:30')) &&
  !timeInQuietHours({ start: '22:30', end: '07:00' }, minutesOf('07:00')));
check('5b: the client and server agree on the quiet-hours rule',
  [0, 300, 420, 720, 1290, 1350, 1439].every(m =>
    timeInQuietHours(defaults.quietHours, m) === inQuietHours(defaults.quietHours, m)));
check('5b: notifications start switched off entirely',
  defaults.masterEnabled === false && Object.keys(defaults.reminders).length === 0);

// ══ 6: scheduler cadence — proving the dispatcher actually runs ═════════════
const mins = n => new Date(Date.now() - n * 60000).toISOString();
check('6: one run (or none) cannot establish a cadence',
  cadenceMinutes([]) === null && cadenceMinutes([mins(0)]) === null && cadenceMinutes(null) === null);
check('6: a healthy 5-minute scheduler reads as 5 minutes',
  cadenceMinutes([mins(0), mins(5), mins(10), mins(15)]) === 5);
check('6: the median ignores one long gap after a cold start',
  cadenceMinutes([mins(0), mins(5), mins(10), mins(15), mins(300)]) === 5,
  `got ${cadenceMinutes([mins(0), mins(5), mins(10), mins(15), mins(300)])}`);
check('6: a once-daily Vercel Hobby cron is reported as ~1440 minutes, not as healthy',
  cadenceMinutes([mins(0), mins(1440), mins(2880)]) === 1440);
check('6: unparseable timestamps are ignored rather than throwing',
  cadenceMinutes(['not-a-date', mins(0), mins(5)]) === 5);
check('6: the staleness threshold is well under an hour, so a dead scheduler is caught',
  SCHEDULER_STALE_MINUTES > 0 && SCHEDULER_STALE_MINUTES <= 60, `${SCHEDULER_STALE_MINUTES} min`);

// ══ 7: multiple reminders in one run ════════════════════════════════════════
const many = schedule({
  reminders: {
    morning:  { time: '07:30', payload: { title: 'M', body: 'm' }, fallback: { title: 'M', body: 'm' } },
    water:    { time: '14:00', payload: { title: 'W', body: 'w' }, fallback: { title: 'W', body: 'w' } },
    evening:  { time: '20:30', payload: { title: 'E', body: 'e' }, fallback: { title: 'E', body: 'e' } },
  },
});
r = evaluateSchedule(many, atLocal('2026-07-15', 14, 5));
check('7: only the reminder inside its window is due, not everything earlier today',
  r.due.length === 1 && r.due[0].type === 'water',
  r.due.map(d => d.type).join(',') || 'none');
r = evaluateSchedule(many, atLocal('2026-07-15', 20, 35));
check('7: later in the day the evening reminder is the only one due',
  r.due.length === 1 && r.due[0].type === 'evening');
r = evaluateSchedule(many, atLocal('2026-07-15', 6, 0));
check('7: before the first reminder, nothing is due', r.due.length === 0);

// ══ 8: the evaluation is pure and side-effect free ══════════════════════════
const input = schedule();
const snapshot = JSON.stringify(input);
evaluateSchedule(input, atLocal('2026-07-15', 14, 10));
check('8: evaluating does not mutate the schedule', JSON.stringify(input) === snapshot);
check('8: two evaluations of the same moment agree',
  JSON.stringify(evaluateSchedule(input, atLocal('2026-07-15', 14, 10))) ===
  JSON.stringify(evaluateSchedule(input, atLocal('2026-07-15', 14, 10))));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
