/**
 * Weekly Requirements core: challenge weeks, prorated partial weeks, XP,
 * current-week neutrality, finalized-week misses, and score integration.
 */
import {
  WEEKLY_REQUIREMENT_DEFS, hasWeeklyRequirements, weekOfDay, targetForWeek,
  challengeWeeks, computeWeeklyRequirements, weeklyAdherence, makeSession,
  effectiveStartWeek,
} from '../src/utils/weeklyRequirements.js';
import { computeChallengeScore, computeTotalXP } from '../src/utils/gamification.js';
import { getDateForDayNumber } from '../src/utils/dateUtils.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const START = '2026-08-01';
const meta = (over = {}) => ({ templateId: 'fat_loss_phase', durationDays: 30, weeklyRequirementsStartDate: START, ...over });
// Sessions on given challenge days.
const sess = (type, ...dayNums) => dayNums.map(d => ({ ...makeSession(type, getDateForDayNumber(START, d)) }));

// ══ 2/3: targets ════════════════════════════════════════════════════════════
const lift = WEEKLY_REQUIREMENT_DEFS.find(d => d.id === 'lifting');
const z2 = WEEKLY_REQUIREMENT_DEFS.find(d => d.id === 'zone2');
check('2: lifting target is 3/week', lift.perWeek === 3);
check('3: Zone 2 target is 2/week', z2.perWeek === 2);
check('11: lifting session is 25 XP', lift.xp === 25);
check('12: Zone 2 session is 20 XP', z2.xp === 20);
check('8: max weekly requirement XP is 115', lift.perWeek * lift.xp + z2.perWeek * z2.xp === 115);
check('1: Fat Loss has weekly requirements', hasWeeklyRequirements(meta()));
check('Other challenges do not', !hasWeeklyRequirements({ templateId: 'mental_training_phase', durationDays: 14 }));

// ══ 4: challenge weeks are 7-day blocks from the start, not calendar weeks ══
check('4: day 1 → week 1, day 7 → week 1, day 8 → week 2', weekOfDay(1) === 1 && weekOfDay(7) === 1 && weekOfDay(8) === 2);
check('4: day 15 → week 3', weekOfDay(15) === 3);
const w30 = challengeWeeks(meta());
check('4: 30 days → 5 week blocks (4 full + 1 partial)', w30.length === 5 && w30[0].startDay === 1 && w30[0].endDay === 7 && w30[3].endDay === 28);
check('4: week spans are contiguous 7-day blocks', w30.slice(0, 4).every(w => w.days === 7));

// ══ 16/17/18: partial final weeks are prorated deterministically ════════════
check('targetForWeek: full week returns the full target', targetForWeek(3, 7) === 3 && targetForWeek(2, 7) === 2);
const w14 = challengeWeeks(meta({ durationDays: 14 }));
check('16: 14 days → exactly 2 full weeks, no partial', w14.length === 2 && w14.every(w => w.days === 7 && !w.partial));
const last30 = w30[4];
check('17: 30-day final week is 2 days, needs 1 lift + 1 Zone 2', last30.days === 2 && last30.partial && last30.targets.lifting === 1 && last30.targets.zone2 === 1,
  JSON.stringify(last30.targets));
const w60 = challengeWeeks(meta({ durationDays: 60 }));
const last60 = w60[w60.length - 1];
check('18: 60 days → 8 full weeks + a 4-day partial', w60.length === 9 && last60.days === 4);
check('18: 4-day final week needs 2 lifts + 1 Zone 2', last60.targets.lifting === 2 && last60.targets.zone2 === 1, JSON.stringify(last60.targets));
check('17/18: never requires a full 3 lifts in a short final week', last30.targets.lifting < 3 && last60.targets.lifting < 3);

// ══ 9: the CURRENT week stays neutral ═══════════════════════════════════════
// Day 3 of week 1, nothing logged.
let r = computeWeeklyRequirements({ sessions: [], meta: meta(), challengeStart: START, currentRawDay: 3 });
check('9: current week with 0 sessions is fully neutral (0 earned / 0 available)', r.earnedXP === 0 && r.availableXP === 0 && r.missedUnits === 0);
check('9: the current week is not marked finalized', r.current && r.current.isCurrent && !r.current.finalized);
check('9: requirement is not marked met or failed yet', r.current.requirements.find(x => x.id === 'lifting').remaining === 3);
// One lift logged mid-week counts positively on both sides.
r = computeWeeklyRequirements({ sessions: sess('lifting', 2), meta: meta(), challengeStart: START, currentRawDay: 3 });
check('9: a logged session counts immediately (25 earned / 25 available)', r.earnedXP === 25 && r.availableXP === 25);
check('9: remaining sessions stay neutral, no missed units', r.missedUnits === 0 && r.missedPenalty === 0);

// ══ 10: once the week is historical, the shortfall is missed ════════════════
// Week 1 finalized (currentRawDay 8), 2 of 3 lifts and 1 of 2 Zone 2 logged.
r = computeWeeklyRequirements({
  sessions: [...sess('lifting', 1, 3), ...sess('zone2', 5)],
  meta: meta(), challengeStart: START, currentRawDay: 8, penaltiesEnabled: true,
});
check('10: finalized week puts the full target in the denominator', r.availableXP === 3 * 25 + 2 * 20, `${r.availableXP}`);
check('10: earned reflects what was logged (2×25 + 1×20 = 70)', r.earnedXP === 70, `${r.earnedXP}`);
check('10: 1 missed lift + 1 missed Zone 2 = 2 missed units', r.missedUnits === 2);
check('10/24: penalty uses the existing 25%-capped rule once (6 + 5 = 11)', r.missedPenalty === 11, `${r.missedPenalty}`);
const noPen = computeWeeklyRequirements({ sessions: [...sess('lifting', 1, 3)], meta: meta(), challengeStart: START, currentRawDay: 8, penaltiesEnabled: false });
check('10: no penalty when the profile has penalties disabled', noPen.missedPenalty === 0);

// ══ 8: multiple sessions in a day are allowed; credit is capped ═════════════
r = computeWeeklyRequirements({ sessions: sess('lifting', 2, 2, 2, 2, 2), meta: meta(), challengeStart: START, currentRawDay: 8 });
check('8: five lifts on one day are all recorded', r.weeks[0].requirements.find(x => x.id === 'lifting').done === 5);
check('15: credit is capped at the weekly target (75, not 125)', r.weeks[0].requirements.find(x => x.id === 'lifting').credited === 3 && r.earnedXP === 75);
check('15: capped credit can never exceed the available XP', r.earnedXP <= r.availableXP);

// ══ 14/15: score integration, and it cannot exceed 100% ═════════════════════
const tasks = [{ id: 'fl_protein', xp: 40, keystone: 3, keystoneHabit: true }, { id: 'fl_photo', xp: 10, keystone: 1 }];
const day = (t) => ({ tasks: t, bonusDone: {}, mood: 0, energy: 0, sleep: 0, stress: 0, recovery: 0 });
function profiles(sessions, over = {}) {
  return { me: { challengeStart: START, tasks, activeChallenge: meta(over), weeklySessions: sessions, xpPenalties: false } };
}
// 7 perfect days + a perfect week 1 of sessions; day 8 = week 2 in progress.
const days = {}; for (let i = 1; i <= 7; i++) days[i] = day({ fl_protein: true, fl_photo: true });
const perfectWeek = [...sess('lifting', 1, 3, 5), ...sess('zone2', 2, 6)];
let sc = computeChallengeScore({ me: days }, profiles(perfectWeek), 'me', 8);
check('14: weekly XP joins the weighted score (7×50 daily + 115 weekly available)', sc.requiredAvailable === 7 * 50 + 115, `${sc.requiredAvailable}`);
check('15: a perfect week + perfect days = exactly 100%', sc.score === 100);
const over = [...perfectWeek, ...sess('lifting', 4, 4, 4), ...sess('zone2', 4, 4)];
sc = computeChallengeScore({ me: days }, profiles(over), 'me', 8);
check('15: extra sessions cannot push the score above 100%', sc.score === 100 && sc.requiredEarned <= sc.requiredAvailable);
// Missing the whole of week 1 drops the score but only after it finalises.
sc = computeChallengeScore({ me: days }, profiles([]), 'me', 8);
check('14: a finalized week with no sessions adds 115 to the denominator only', sc.requiredAvailable === 7 * 50 + 115 && sc.requiredEarned === 350);
const inProgress = computeChallengeScore({ me: days }, profiles([]), 'me', 7);
check('9: while week 1 is still in progress it adds nothing to the denominator', inProgress.requiredAvailable === 6 * 50 + 50, `${inProgress.requiredAvailable}`);
check('score object exposes the weekly breakdown', !!sc.weekly && sc.weekly.supported === true);

// ══ 13: XP integration ══════════════════════════════════════════════════════
const noop = () => 0;
const xpNone = computeTotalXP({ me: days }, profiles([]), 'me', noop, 7, 7);
const xpWeek = computeTotalXP({ me: days }, profiles(perfectWeek), 'me', noop, 7, 7);
check('13: a perfect week of sessions adds exactly 115 XP', xpWeek.gained - xpNone.gained === 115, `${xpWeek.gained - xpNone.gained}`);
const xpOne = computeTotalXP({ me: days }, profiles(sess('lifting', 1)), 'me', noop, 7, 7);
check('11: one lifting session awards exactly 25 XP', xpOne.gained - xpNone.gained === 25);
const xpZ = computeTotalXP({ me: days }, profiles(sess('zone2', 1)), 'me', noop, 7, 7);
check('12: one Zone 2 session awards exactly 20 XP', xpZ.gained - xpNone.gained === 20);
check('23: recomputing is stable — no duplicate XP on repeat calls',
  computeTotalXP({ me: days }, profiles(perfectWeek), 'me', noop, 7, 7).gained === xpWeek.gained);

// ══ 19: pre-existing attempts are not retroactively penalised ═══════════════
// Attempt started 2026-08-01 but weekly tracking only began on day 15 (week 3).
const migrated = meta({ weeklyRequirementsStartDate: getDateForDayNumber(START, 15) });
check('19: effective start week is week 3', effectiveStartWeek(migrated, START) === 3);
r = computeWeeklyRequirements({ sessions: [], meta: migrated, challengeStart: START, currentRawDay: 22, penaltiesEnabled: true });
check('19: untracked earlier weeks add nothing to the denominator', r.availableXP === 115, `${r.availableXP}`);
// Only week 3 is both tracked and finalized (week 4 is in progress, week 5
// future), so exactly one week's worth of units can be missed — weeks 1–2 are
// invisible to scoring entirely.
check('19: only the tracked+finalized week can produce misses (5 units, 28 XP)',
  r.missedUnits === 5 && r.missedPenalty === 3 * 6 + 2 * 5, `units=${r.missedUnits} pen=${r.missedPenalty}`);
const untrackedOnly = computeWeeklyRequirements({ sessions: [], meta: migrated, challengeStart: START, currentRawDay: 14, penaltiesEnabled: true });
check('19: before the tracked week begins, nothing is evaluated or penalised',
  untrackedOnly.availableXP === 0 && untrackedOnly.missedUnits === 0 && untrackedOnly.missedPenalty === 0);
check('19: weeks 1–2 are marked untracked', r.weeks[0].tracked === false && r.weeks[1].tracked === false && r.weeks[2].tracked === true);

// ══ adherence summary ═══════════════════════════════════════════════════════
r = computeWeeklyRequirements({ sessions: [...sess('lifting', 1, 3), ...sess('zone2', 5)], meta: meta(), challengeStart: START, currentRawDay: 8 });
const adh = weeklyAdherence(r);
check('11: adherence reports 2/3 lifting = 67%', adh.lifting.done === 2 && adh.lifting.required === 3 && adh.lifting.pct === 67);
check('11: adherence reports 1/2 Zone 2 = 50%', adh.zone2.pct === 50);

// ══ sessions carry unique ids ═══════════════════════════════════════════════
const many = sess('lifting', 1, 1, 1, 2, 2);
check('4/8: every session gets a unique id', new Set(many.map(s => s.id)).size === many.length);
check('sessions record type + date', many.every(s => s.type === 'lifting' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
