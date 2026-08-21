/**
 * Scheduled (future) challenge starts — core logic.
 *
 * Covers the authoritative scheduled/active distinction, the null day number
 * that gates every downstream system, automatic local-date activation, and the
 * fact that a pre-start attempt produces no XP, no score and no weekly
 * requirement evaluation.
 */
import {
  CHALLENGE_STATE, getChallengeState, isScheduled, isChallengeActive,
  challengeDayNumber, daysUntilStart, dateOffsetFromToday, startsInWords,
  scheduledHeading,
} from '../src/utils/challengeSchedule.js';
import { computeChallengeScore, computeTotalXP } from '../src/utils/gamification.js';
import { computeWeeklyRequirements, makeSession } from '../src/utils/weeklyRequirements.js';
import { getTodayStr, getDayNumberFromStart } from '../src/utils/dateUtils.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const TODAY = getTodayStr();
const TOMORROW = dateOffsetFromToday(1);
const IN_FIVE = dateOffsetFromToday(5);
const YESTERDAY = dateOffsetFromToday(-1);

// ══ state machine: exactly three states, derived from one date ══════════════
check('no start date → NONE', getChallengeState({}) === CHALLENGE_STATE.NONE);
check('1: a tomorrow start is SCHEDULED', getChallengeState({ challengeStart: TOMORROW }) === CHALLENGE_STATE.SCHEDULED);
check('2: an arbitrary future start is SCHEDULED', getChallengeState({ challengeStart: IN_FIVE }) === CHALLENGE_STATE.SCHEDULED);
check("13: today's start is ACTIVE", getChallengeState({ challengeStart: TODAY }) === CHALLENGE_STATE.ACTIVE);
check('23: an existing past start is ACTIVE (unchanged behaviour)', getChallengeState({ challengeStart: YESTERDAY }) === CHALLENGE_STATE.ACTIVE);
check('isScheduled / isChallengeActive are exact complements for a set date',
  isScheduled({ challengeStart: TOMORROW }) && !isChallengeActive({ challengeStart: TOMORROW }) &&
  isChallengeActive({ challengeStart: TODAY }) && !isScheduled({ challengeStart: TODAY }));

// ══ 5: no day number before Day 1 ═══════════════════════════════════════════
check('5: challengeDayNumber is null while scheduled (never a fake Day 1)', challengeDayNumber(TOMORROW) === null);
check('5: five days out is also null', challengeDayNumber(IN_FIVE) === null);
check('5: the raw clamping helper would have wrongly said Day 1', getDayNumberFromStart(TOMORROW) === 1);
check('13: on the start date it becomes Day 1', challengeDayNumber(TODAY) === 1);
check('14: the next local date is Day 2', challengeDayNumber(TODAY, dateOffsetFromToday(1)) === 2);
check('14: five days in is Day 6', challengeDayNumber(TODAY, dateOffsetFromToday(5)) === 6);

// ══ 13: activation is a pure local-date comparison, no stored flag ══════════
// The SAME stored attempt reads scheduled "today" and active "tomorrow" with no
// write in between — activation cannot be missed, duplicated or fired early.
const attempt = { challengeStart: TOMORROW };
check('13: same stored attempt is scheduled today and active tomorrow',
  isScheduled(attempt, TODAY) && isChallengeActive(attempt, TOMORROW));
check('13: it does NOT activate on the day before the start',
  challengeDayNumber(TOMORROW, TODAY) === null && challengeDayNumber(TOMORROW, TOMORROW) === 1);
// Cross a DST boundary and a month/year end using plain local date strings.
check('local-date comparison is timezone/DST safe (lexicographic strings)',
  challengeDayNumber('2026-11-02', '2026-11-01') === null &&
  challengeDayNumber('2026-11-02', '2026-11-02') === 1 &&
  challengeDayNumber('2025-12-31', '2026-01-01') === 2);

// ══ countdown + copy ════════════════════════════════════════════════════════
check('daysUntilStart: 1 for tomorrow, 5 for five days out',
  daysUntilStart(TOMORROW) === 1 && daysUntilStart(IN_FIVE) === 5);
check('daysUntilStart is 0 once the challenge is running', daysUntilStart(TODAY) === 0 && daysUntilStart(YESTERDAY) === 0);
check('4: heading reads "Challenge Starts Tomorrow" one day out', scheduledHeading(TOMORROW) === 'Challenge Starts Tomorrow');
check('4: further out the heading names the date', /^Challenge Starts .+\d+$/.test(scheduledHeading(IN_FIVE)), scheduledHeading(IN_FIVE));
check('startsInWords: tomorrow / today', startsInWords(TOMORROW) === 'tomorrow' && startsInWords(TODAY) === 'today');
check('dateOffsetFromToday crosses month ends correctly',
  dateOffsetFromToday(1, '2026-01-31') === '2026-02-01' && dateOffsetFromToday(1, '2026-02-28') === '2026-03-01');

// ══ fixtures ════════════════════════════════════════════════════════════════
const TASKS = [
  { id: 'fl_protein', name: 'Hit protein goal', xp: 40, keystoneHabit: true },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 10 },
];
const metaFor = (start) => ({
  templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30,
  passingScore: 70, keystoneRequirement: 65, weeklyRequirementsStartDate: start,
});
function profiles(start, days = {}) {
  return {
    p: { challengeStart: start, activeChallenge: metaFor(start), tasks: TASKS, weeklySessions: [], xpPenalties: true },
  };
}
const dayNumOrNull = (start) => challengeDayNumber(start);

// ══ 7/8/9/10: nothing accrues before Day 1 ══════════════════════════════════
// A scheduled attempt with somehow-present day records still yields nothing:
// the null raw day short-circuits scoring, and computeTotalXP refuses outright.
const dirty = { 1: { dayNumber: 1, tasks: { fl_protein: true, daily_log: true }, notes: 'x' } };
const schedProfs = profiles(TOMORROW, dirty);
const schedDays = { p: dirty };

check('7/8: no challenge score exists while scheduled',
  computeChallengeScore(schedDays, schedProfs, 'p', dayNumOrNull(TOMORROW)) === null);
const schedXP = computeTotalXP(schedDays, schedProfs, 'p', () => 100, 1, 1);
check('9: no XP is earned before Day 1 (no farming a Day 1 that has not arrived)', schedXP.gained === 0 && schedXP.total === 0);
check('6/9: no XP is lost before Day 1 (no missed-task penalties)', schedXP.lost === 0 && schedXP.rawTotal === 0);

// The identical data on an ACTIVE attempt does produce a score and XP — proving
// the difference is the schedule state, not the fixture being empty.
const activeProfs = profiles(TODAY);
const activeXP = computeTotalXP({ p: dirty }, activeProfs, 'p', () => 100, 1, 1);
check('control: the same data on an active attempt DOES score', computeChallengeScore({ p: dirty }, activeProfs, 'p', 1) !== null);
check('control: the same data on an active attempt DOES earn XP', activeXP.gained > 0);

// ══ 11/15: weekly requirements begin on Day 1, never on the setup day ═══════
let wr = computeWeeklyRequirements({
  sessions: [], meta: metaFor(TOMORROW), challengeStart: TOMORROW,
  currentRawDay: dayNumOrNull(TOMORROW), penaltiesEnabled: true,
});
check('11: no weekly requirements are tracked before Day 1',
  wr.availableXP === 0 && wr.missedUnits === 0 && wr.missedPenalty === 0);
check('11: no lifting/Zone 2 requirement exists pre-start', !wr.current);

// Week 1 = Days 1–7 counted from the SCHEDULED start. Simulate "tomorrow" being
// today: day 1 of the challenge is the start date, and week 1 ends 7 days later.
wr = computeWeeklyRequirements({
  sessions: [], meta: metaFor(TOMORROW), challengeStart: TOMORROW, currentRawDay: 1, penaltiesEnabled: true,
});
check('15: on Day 1 week 1 opens with the full 3 lift / 2 Zone 2 target',
  wr.current?.week === 1 && wr.current.requirements.find(r => r.id === 'lifting').target === 3);
check('15: week 1 spans days 1–7 measured from the scheduled start',
  wr.weeks[0].startDay === 1 && wr.weeks[0].endDay === 7);
// A session logged on the setup day (the day BEFORE the start) falls outside
// every challenge week, so it can neither credit nor be required.
const preStartSession = makeSession('lifting', TODAY);
wr = computeWeeklyRequirements({
  sessions: [preStartSession], meta: metaFor(TOMORROW), challengeStart: TOMORROW, currentRawDay: 1,
});
check('15: today is NOT part of week 1 of a challenge starting tomorrow',
  wr.current.requirements.find(r => r.id === 'lifting').done === 0);

// ══ 17: rescheduling is free — it changes only the date ═════════════════════
// Re-anchoring Day 1 to a different future date yields the same "nothing has
// happened" result, and moving it back and forth is lossless.
for (const d of [TOMORROW, IN_FIVE, dateOffsetFromToday(30), TOMORROW]) {
  const x = computeTotalXP({ p: dirty }, profiles(d), 'p', () => 100, 1, 1);
  const s = computeChallengeScore({ p: dirty }, profiles(d), 'p', dayNumOrNull(d));
  if (x.rawTotal !== 0 || s !== null) { check(`17: rescheduling to ${d} stays inert`, false); break; }
}
check('17: rescheduling freely between future dates never accrues XP or a grade', true);

// ══ 18: Start Now converts the current local date into Day 1 ════════════════
// (The context helper is just reschedule(today); the observable result is that
// the attempt becomes active with Day 1 = today.)
check('18: an attempt moved to today is ACTIVE on Day 1',
  isChallengeActive({ challengeStart: TODAY }) && challengeDayNumber(TODAY) === 1);

// ══ 22/24: existing challenges and archives are untouched ═══════════════════
// Every attempt that predates this feature has a start date of today or earlier,
// so the derivation is a strict no-op for them — migration cannot invent a
// future start.
for (let back = 0; back <= 400; back += 7) {
  const start = dateOffsetFromToday(-back);
  if (challengeDayNumber(start) !== getDayNumberFromStart(start)) {
    check('22: pre-existing attempts keep their exact day number', false, start); break;
  }
}
check('22: pre-existing attempts keep their exact day number (0–400 days back)', true);
check('24: an archived attempt carries its own start date, never re-derived from today',
  getChallengeState({ challengeStart: '2024-01-01' }) === CHALLENGE_STATE.ACTIVE);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
