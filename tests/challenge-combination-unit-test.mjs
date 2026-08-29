/**
 * Challenge Combination — core logic.
 *
 * Compatibility is data; shared habits are identified by canonical habitKey and
 * merged into ONE row; XP is therefore deduplicated structurally; and each lane
 * keeps its own independent score over its own requirements.
 */
import {
  COMPATIBILITY, COMPATIBILITY_META, CHALLENGE_IDS, COMPATIBILITY_PAIRS,
  getCompatibility, canStack, needsWarning, groupByCompatibility,
} from '../src/data/challengeCompatibility.js';
import { HABIT_KEYS, habitKeyOf, isSameHabit, stricterOf } from '../src/data/habitKeys.js';
import {
  LANE, lanesOfTask, taskInLane, isSharedTask, tasksForLane, supportsLabel,
  mergeSupportTasks, stripSupportTasks, previewMerge,
  challengeOf, startOf, hasSupportChallenge, laneDayNumber, recordKeyForLaneDay,
} from '../src/utils/challengeStack.js';
import { computeChallengeScore, computeTotalXP, getTaskXP } from '../src/utils/gamification.js';
import { getDateForDayNumber } from '../src/utils/dateUtils.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const C = CHALLENGE_IDS;

// ══ 1: compatibility is a data table, not scattered logic ═══════════════════
const expected = [
  [C.FAT_LOSS, C.MENTAL_TRAINING, COMPATIBILITY.HIGHLY_COMPATIBLE],
  [C.FAT_LOSS, C.SLEEP_RESET, COMPATIBILITY.HIGHLY_COMPATIBLE],
  [C.MUSCLE_BUILDING, C.MENTAL_TRAINING, COMPATIBILITY.HIGHLY_COMPATIBLE],
  [C.MUSCLE_BUILDING, C.SLEEP_RESET, COMPATIBILITY.HIGHLY_COMPATIBLE],
  [C.MUSCLE_BUILDING, C.HORMONE_HEALTH, COMPATIBILITY.HIGHLY_COMPATIBLE],
  [C.FAT_LOSS, C.HORMONE_HEALTH, COMPATIBILITY.CONDITIONAL],
  [C.STRENGTH, C.MUSCLE_BUILDING, COMPATIBILITY.CONDITIONAL],
  [C.STRENGTH, C.FAT_LOSS, COMPATIBILITY.CONDITIONAL],
  [C.FAT_LOSS, C.MUSCLE_BUILDING, COMPATIBILITY.CONFLICTING],
];
for (const [a, b, rating] of expected) {
  const got = getCompatibility(a, b);
  check(`1: ${a} + ${b} → ${rating}`, got.rating === rating, got.rating);
}
check('1: every pairing is unordered (a+b === b+a)',
  expected.every(([a, b]) => getCompatibility(a, b).rating === getCompatibility(b, a).rating));
check('1: every pairing carries a human-readable reason',
  expected.every(([a, b]) => (getCompatibility(a, b).reason || '').length > 20));
check('1: reasons are distinct per pairing (not one generic string)',
  new Set(expected.map(([a, b]) => getCompatibility(a, b).reason)).size === expected.length);
check('1: the table is the only source — every row has both ids, a rating and a reason',
  COMPATIBILITY_PAIRS.every(p => p.a && p.b && COMPATIBILITY_META[p.rating] && p.reason));

// Extensibility: an unknown challenge id is handled without any code change.
const unknown = getCompatibility(C.FAT_LOSS, 'some_future_challenge');
check('1: an unrated pairing is CONDITIONAL, not silently endorsed', unknown.rating === COMPATIBILITY.CONDITIONAL);
check('1: an unrated pairing still explains itself', (unknown.reason || '').length > 20);
check('1: a challenge can never stack with itself', getCompatibility(C.FAT_LOSS, C.FAT_LOSS).rating === COMPATIBILITY.CONFLICTING);

// ══ 2: selection rules follow the rating ════════════════════════════════════
check('2: highly compatible is selectable with no warning',
  canStack(C.FAT_LOSS, C.MENTAL_TRAINING) && !needsWarning(C.FAT_LOSS, C.MENTAL_TRAINING));
check('2: conditional is selectable but warns first',
  canStack(C.STRENGTH, C.FAT_LOSS) && needsWarning(C.STRENGTH, C.FAT_LOSS));
check('2: conflicting can never run simultaneously', !canStack(C.FAT_LOSS, C.MUSCLE_BUILDING));
check('2: ratings expose their own selectable/warn rules as data',
  COMPATIBILITY_META[COMPATIBILITY.HIGHLY_COMPATIBLE].selectable === true &&
  COMPATIBILITY_META[COMPATIBILITY.CONDITIONAL].warn === true &&
  COMPATIBILITY_META[COMPATIBILITY.CONFLICTING].selectable === false);

const grouped = groupByCompatibility(C.FAT_LOSS, [
  { id: C.MENTAL_TRAINING }, { id: C.SLEEP_RESET }, { id: C.STRENGTH }, { id: C.MUSCLE_BUILDING },
]);
check('2: options are grouped best-first (green → yellow → red)',
  grouped.map(g => g.rating).join(',') ===
  [COMPATIBILITY.HIGHLY_COMPATIBLE, COMPATIBILITY.CONDITIONAL, COMPATIBILITY.CONFLICTING].join(','));
check('2: each group carries its dot and label', grouped.every(g => g.meta.dot && g.meta.label));
check('2: each option carries its own why', grouped.every(g => g.items.every(i => i.compatibility.reason)));

// ══ 4: shared habits are identified by canonical key, not by name ═══════════
const mbSleep = { id: 'mb_sleep', name: 'Sleep 8 hours', xp: 30, habitKey: HABIT_KEYS.SLEEP_TARGET, target: { value: 8, unit: 'hours', direction: 'atLeast' } };
const mtSleep = { id: 'mt_sleep', name: 'Sleep 8 hours', xp: 25, habitKey: HABIT_KEYS.SLEEP_TARGET, target: { value: 8, unit: 'hours', direction: 'atLeast' } };
const flSleep = { id: 'fl_sleep', name: 'Sleep 7.5–9 hours', xp: 25, habitKey: HABIT_KEYS.SLEEP_TARGET, target: { value: 7.5, unit: 'hours', direction: 'atLeast' } };
const protein = { id: 'fl_protein', name: 'Hit protein goal', xp: 40, habitKey: HABIT_KEYS.PROTEIN_TARGET, keystoneHabit: true };
const meditate = { id: 'mt_mind', name: 'Mental Training — 5 minutes', xp: 100, habitKey: HABIT_KEYS.MEDITATION };
const reading = { id: 'mt_reading', name: 'Read 5 pages', xp: 40, habitKey: HABIT_KEYS.READING };

check('4: identical habit keys match even with different task ids', isSameHabit(mbSleep, mtSleep));
check('4: different habits never match', !isSameHabit(mbSleep, protein));
check('4: matching falls back to task id when no key is declared',
  isSameHabit({ id: 'daily_log' }, { id: 'daily_log' }) && !isSameHabit({ id: 'a' }, { id: 'b' }));
check('4: matching never uses the task NAME',
  !isSameHabit({ id: 'x', name: 'Sleep 8 hours' }, { id: 'y', name: 'Sleep 8 hours' }));
check('4: habitKeyOf prefers the declared key', habitKeyOf(mbSleep) === HABIT_KEYS.SLEEP_TARGET);

// ══ 4: differing targets resolve to the STRICTER requirement ════════════════
check('4: 8h is stricter than 7.5h', stricterOf(mbSleep, flSleep) === 'a' && stricterOf(flSleep, mbSleep) === 'b');
check('4: equal targets need no choice', stricterOf(mbSleep, mtSleep) === 'a');
check('4: atMost inverts which value is stricter',
  stricterOf({ target: { value: 30, unit: 'min', direction: 'atMost' } },
             { target: { value: 60, unit: 'min', direction: 'atMost' } }) === 'a');
check('4: incomparable targets return null rather than guessing',
  stricterOf(protein, meditate) === null &&
  stricterOf({ target: { value: 1, unit: 'hours', direction: 'atLeast' } },
             { target: { value: 1, unit: 'steps', direction: 'atLeast' } }) === null);

// ══ 4: merging produces ONE row per habit ═══════════════════════════════════
const primaryTasks = [protein, flSleep, { id: 'daily_log', name: 'Complete Daily Log', xp: 10, habitKey: HABIT_KEYS.DAILY_LOG }];
const supportTasks = [meditate, reading, mbSleep, { id: 'daily_log', name: 'Complete Daily Log', xp: 20, habitKey: HABIT_KEYS.DAILY_LOG }];
const { tasks: merged, merges } = mergeSupportTasks(primaryTasks, supportTasks);

check('4: the shared sleep habit is a single row', merged.filter(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).length === 1);
check('4: the shared daily log is a single row', merged.filter(t => t.id === 'daily_log').length === 1);
check('4: 3 primary + 4 support with 2 shared → 5 rows', merged.length === 5, `${merged.length}`);
check('4: the merged sleep row keeps the STRICTER 8-hour wording',
  merged.find(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).name === 'Sleep 8 hours');
check('4: the merged row keeps the PRIMARY task id, so stored completions still resolve',
  merged.find(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).id === 'fl_sleep');
check('4: the merged row is tagged for BOTH challenges',
  isSharedTask(merged.find(t => t.id === 'fl_sleep')) && isSharedTask(merged.find(t => t.id === 'daily_log')));
check('4: support-only tasks are tagged support-only',
  lanesOfTask(merged.find(t => t.id === 'mt_mind')).join() === LANE.SUPPORT);
check('4: primary-only tasks stay primary-only',
  lanesOfTask(merged.find(t => t.id === 'fl_protein')).join() === LANE.PRIMARY);
check('4: the merge records enough metadata to explain itself',
  merges.length === 2 && merges.every(m => m.habitKey && m.kept && m.label));
check('4: the sleep merge names the stricter side', merges.find(m => m.habitKey === HABIT_KEYS.SLEEP_TARGET).stricter === LANE.SUPPORT);
check('4: the merged row remembers both original task ids',
  merged.find(t => t.id === 'fl_sleep').mergedFrom.support === 'mb_sleep');

// Incomparable targets keep the primary wording and say so.
const odd = mergeSupportTasks([{ id: 'p1', name: 'Hit protein goal', xp: 40, habitKey: HABIT_KEYS.PROTEIN_TARGET }],
                              [{ id: 's1', name: 'Eat 1g/lb protein', xp: 30, habitKey: HABIT_KEYS.PROTEIN_TARGET }]);
check('4: incomparable targets keep the primary wording and flag the conflict',
  odd.tasks[0].name === 'Hit protein goal' && odd.tasks[0].targetConflict === true);

// ══ 5: one behaviour = one XP award ═════════════════════════════════════════
const sharedRow = merged.find(t => t.id === 'fl_sleep');
check('5: the shared row pays the PRIMARY xp, once', getTaskXP(sharedRow) === 25);
check('5: stacking never re-prices the primary economy',
  getTaskXP(merged.find(t => t.id === 'fl_protein')) === 40);
const mergedDayXP = merged.reduce((s, t) => s + getTaskXP(t), 0);
const naiveDayXP = [...primaryTasks, ...supportTasks].reduce((s, t) => s + getTaskXP(t), 0);
check('5: merged XP is strictly less than naively concatenating both lists',
  mergedDayXP < naiveDayXP, `${mergedDayXP} < ${naiveDayXP}`);
check('5: the saving equals exactly the duplicated rows', naiveDayXP - mergedDayXP === 30 + 20, `${naiveDayXP - mergedDayXP}`);

// ══ 5: completion counts for BOTH challenges' adherence ═════════════════════
check('5: the shared row is in the primary lane set', tasksForLane(merged, LANE.PRIMARY).some(t => t.id === 'fl_sleep'));
check('5: the shared row is in the support lane set', tasksForLane(merged, LANE.SUPPORT).some(t => t.id === 'fl_sleep'));
check('5: each lane sees only its own requirements',
  tasksForLane(merged, LANE.PRIMARY).length === 3 && tasksForLane(merged, LANE.SUPPORT).length === 4);

// ══ 3/8: absent provenance means primary — the migration default ════════════
check('8: a task with no provenance belongs to the primary lane',
  lanesOfTask({ id: 'legacy' }).join() === LANE.PRIMARY && taskInLane({ id: 'legacy' }, LANE.PRIMARY));
check('8: a legacy task is never treated as shared', !isSharedTask({ id: 'legacy' }));
check('8: a single-challenge profile has no support lane',
  !hasSupportChallenge({ challengeStart: '2026-08-01', activeChallenge: { name: 'X' } }));
check('8: tasksForLane on an untagged list returns the whole list unchanged',
  tasksForLane(primaryTasks, LANE.PRIMARY).length === primaryTasks.length);

// ══ End support: primary is left exactly as it was ══════════════════════════
const reverted = stripSupportTasks(merged);
check('3: ending support drops support-only rows', !reverted.some(t => t.id === 'mt_mind' || t.id === 'mt_reading'));
check('3: shared rows survive and revert to primary-only',
  reverted.some(t => t.id === 'fl_sleep') && !isSharedTask(reverted.find(t => t.id === 'fl_sleep')));
check('3: the primary keeps every one of its own rows',
  primaryTasks.every(pt => reverted.some(rt => rt.id === pt.id)));
check('3: reverted rows keep their ids, so logged completions survive',
  reverted.map(t => t.id).join() === 'fl_protein,fl_sleep,daily_log');

// ══ Preview ═════════════════════════════════════════════════════════════════
const pv = previewMerge(primaryTasks, supportTasks);
check('4: preview reports the shared count and the true number of added rows',
  pv.sharedCount === 2 && pv.addedCount === 2 && pv.totalCount === 5);

// ══ 6/7: the two lanes keep separate progress ═══════════════════════════════
const PRIMARY_START = '2026-08-01';
const SUPPORT_START = '2026-08-08';   // a week later — different start dates
const profile = {
  challengeStart: PRIMARY_START,
  activeChallenge: { templateId: 'muscle_building_phase', name: 'Muscle Building', durationDays: 60, passingScore: 70, keystoneRequirement: 65 },
  supportChallengeStart: SUPPORT_START,
  supportChallenge: { templateId: C.MENTAL_TRAINING, name: 'Mental Training', durationDays: 21, passingScore: 70, keystoneRequirement: 65 },
  tasks: merged,
  weeklySessions: [],
};
check('6: each lane reports its own challenge and start date',
  challengeOf(profile, LANE.PRIMARY).name === 'Muscle Building' &&
  challengeOf(profile, LANE.SUPPORT).name === 'Mental Training' &&
  startOf(profile, LANE.PRIMARY) === PRIMARY_START && startOf(profile, LANE.SUPPORT) === SUPPORT_START);
check('6: on 2026-08-12 the lanes are on different days (Day 12 / Day 5)',
  laneDayNumber(profile, LANE.PRIMARY, '2026-08-12') === 12 &&
  laneDayNumber(profile, LANE.SUPPORT, '2026-08-12') === 5);

// Support day N resolves to the shared day record through the calendar date.
check('7: support day 1 maps to the primary day covering the same date',
  recordKeyForLaneDay(profile, LANE.SUPPORT, 1) === 8);
check('7: support day 5 maps to primary day 12', recordKeyForLaneDay(profile, LANE.SUPPORT, 5) === 12);
check('7: the mapping round-trips through real calendar dates',
  getDateForDayNumber(SUPPORT_START, 5) === getDateForDayNumber(PRIMARY_START, 12));

// ══ 5/6: independent scores over the same completions ═══════════════════════
// Days 8–11 fully complete (support days 1–4 finalised), day 12 in progress.
const days = {};
for (let i = 1; i <= 12; i++) {
  days[i] = { dayNumber: i, date: getDateForDayNumber(PRIMARY_START, i), tasks: {}, isMWD: false, mwdTasks: {}, bonusDone: {} };
}
for (let i = 1; i <= 11; i++) for (const t of merged) days[i].tasks[t.id] = true;
const profiles = { p: profile };
const allDays = { p: days };

const pScore = computeChallengeScore(allDays, profiles, 'p', 12, LANE.PRIMARY);
const sScore = computeChallengeScore(allDays, profiles, 'p', 5, LANE.SUPPORT);
check('6: both lanes produce their own score object', !!pScore && !!sScore);
check('6: each score names its own lane and challenge',
  pScore.lane === LANE.PRIMARY && sScore.lane === LANE.SUPPORT &&
  pScore.challengeName === 'Muscle Building' && sScore.challengeName === 'Mental Training');
check('6: each lane reports its own duration', pScore.duration === 60 && sScore.duration === 21);
check('6: each lane finalises its own number of days',
  pScore.finalizedDays === 11 && sScore.finalizedDays === 4, `p=${pScore.finalizedDays} s=${sScore.finalizedDays}`);
check('5: completing shared habits scores 100% for BOTH challenges',
  pScore.score === 100 && sScore.score === 100, `p=${pScore.score} s=${sScore.score}`);

// A day where ONLY the shared row is done proves the completion counts twice for
// adherence while still being a single logged behaviour.
const sharedOnly = {};
for (let i = 1; i <= 9; i++) {
  sharedOnly[i] = { dayNumber: i, date: getDateForDayNumber(PRIMARY_START, i), tasks: { fl_sleep: true, daily_log: true }, isMWD: false, mwdTasks: {}, bonusDone: {} };
}
const soProfiles = { p: profile }, soAll = { p: sharedOnly };
const pShared = computeChallengeScore(soAll, soProfiles, 'p', 9, LANE.PRIMARY);
const sShared = computeChallengeScore(soAll, soProfiles, 'p', 2, LANE.SUPPORT);
check('5: the same shared completions credit the primary lane', pShared.requiredEarned > 0);
check('5: and independently credit the support lane', sShared.requiredEarned > 0);
check('5: yet each lane scores against its OWN denominator, so the scores differ',
  pShared.score !== sShared.score, `p=${pShared.score} s=${sShared.score}`);

// ══ 5: XP is paid once, from the single merged list ═════════════════════════
const xp = computeTotalXP(allDays, profiles, 'p', () => 100, 11, 12);
// The counterfactual: the SAME profile if the two challenges' task lists had
// simply been concatenated instead of merged. Every day record marks the same
// behaviours done; the only difference is that duplicated habits appear twice.
const naiveTasks = [
  ...primaryTasks.map(t => ({ ...t, challenges: [LANE.PRIMARY] })),
  ...supportTasks.map(t => ({ ...t, id: `sup_${t.id}`, challenges: [LANE.SUPPORT] })),
];
const naiveDays = {};
for (const [k, d] of Object.entries(days)) {
  // Same behaviours performed, same days: every requirement on the list is done
  // on days 1–11, exactly as in the merged profile.
  const t = {};
  if (Number(k) <= 11) for (const nt of naiveTasks) t[nt.id] = true;
  naiveDays[k] = { ...d, tasks: t };
}
const naiveXP = computeTotalXP({ p: naiveDays }, { p: { ...profile, tasks: naiveTasks } }, 'p', () => 100, 11, 12);
check('5: merging pays strictly less XP than duplicating the shared habits would',
  xp.gained < naiveXP.gained, `merged=${xp.gained} duplicated=${naiveXP.gained}`);
check('5: the XP saved is exactly the duplicated rows over 11 days',
  naiveXP.gained - xp.gained === (30 + 20) * 11, `${naiveXP.gained - xp.gained}`);
check('5: XP is computed from one list, so there is no second entry to double-pay',
  new Set(merged.map(t => t.id)).size === merged.length);

// ══ 3: supports label names both challenges ═════════════════════════════════
check('4/6: a shared row is labelled with both challenge names',
  supportsLabel(merged.find(t => t.id === 'fl_sleep'), profile) === 'Supports: Muscle Building + Mental Training');
check('4: an unshared row gets no label', supportsLabel(merged.find(t => t.id === 'fl_protein'), profile) === null);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
