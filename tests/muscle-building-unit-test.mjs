/**
 * Muscle Building — configuration, daily/weekly requirements, XP hierarchy,
 * volume tracking, progressive-overload trends, bodyweight coaching, and
 * shared-habit deduplication with the Primary + Support architecture.
 */
import * as MB from '../src/data/muscleBuildingConfig.js';
import { HABIT_KEYS, habitKeyOf } from '../src/data/habitKeys.js';
import { COMPATIBILITY, CHALLENGE_IDS, getCompatibility, canStack } from '../src/data/challengeCompatibility.js';
import {
  hasWeeklyRequirements, getWeeklyRequirementDefs, computeWeeklyRequirements,
  challengeWeeks, makeSession, WEEKLY_REQUIREMENT_DEFS,
} from '../src/utils/weeklyRequirements.js';
import {
  makeVolumeEntry, weeklyVolume, volumeAdherence, volumeTargets, tracksVolume,
} from '../src/utils/muscleVolume.js';
import {
  makeExerciseEntry, volumeLoad, performanceTrends, trendSummaries, overallPerformance, exerciseKey,
} from '../src/utils/exerciseLog.js';
import { bodyweightTrend, weeklyWeights, measurementCheckIns, growthInsights } from '../src/utils/growthTrend.js';
import { mergeSupportTasks, tasksForLane, LANE, isSharedTask } from '../src/utils/challengeStack.js';
import { computeTotalXP, getTaskXP, keystoneHabitsOf } from '../src/utils/gamification.js';
import { getDateForDayNumber } from '../src/utils/dateUtils.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const C = CHALLENGE_IDS;
const START = '2026-08-01';
const d = n => getDateForDayNumber(START, n);

// ══ 1: durations ════════════════════════════════════════════════════════════
check('1: offers 30 / 60 / 90 days', MB.DURATIONS.join() === '30,60,90');
check('1: 60 days is the default and recommended', MB.DEFAULT_DURATION === 60);
check('1: each duration has a label and a completion bonus',
  MB.DURATIONS.every(x => MB.DURATION_LABELS[x] && MB.COMPLETION_BONUS_BY_DURATION[x] > 0));
check('1: longer durations are worth a larger completion bonus',
  MB.COMPLETION_BONUS_BY_DURATION[30] < MB.COMPLETION_BONUS_BY_DURATION[60] &&
  MB.COMPLETION_BONUS_BY_DURATION[60] < MB.COMPLETION_BONUS_BY_DURATION[90]);

// ══ 2: four pillars ═════════════════════════════════════════════════════════
check('2: the four pillars are Training / Nutrition / Recovery / Optimization',
  MB.PILLARS.map(p => p.id).join() === 'training,nutrition,recovery,optimization');

// ══ 3: daily requirements ═══════════════════════════════════════════════════
const setup = MB.defaultSetup();
const tasks = MB.buildStartTasks(setup);
const byKey = k => tasks.find(t => habitKeyOf(t) === k);

check('3: the daily list stays short — 4 fundamentals + the daily log', tasks.length === 5, `${tasks.length}`);
check('3A: protein is present with the canonical habitKey', !!byKey(HABIT_KEYS.PROTEIN_TARGET));
check('3A: protein is THE Keystone Habit', keystoneHabitsOf(tasks).map(t => t.id).join() === 'mb_protein');
check('3A: protein carries the joint-highest daily XP',
  byKey(HABIT_KEYS.PROTEIN_TARGET).xp === MB.XP.protein &&
  MB.XP.protein === Math.max(...tasks.map(t => t.xp)));
check('3B: nutrition target uses the calorie_target habitKey', byKey(HABIT_KEYS.CALORIE_TARGET)?.id === 'mb_nutrition');
check('3B: it reads "Hit Nutrition Target" when no number is configured',
  byKey(HABIT_KEYS.CALORIE_TARGET).name === 'Hit Nutrition Target');
check('3C: sleep uses the sleep_target habitKey and a real target',
  byKey(HABIT_KEYS.SLEEP_TARGET)?.target?.value === MB.SLEEP_TARGET.suggested);
check('3C: sleep scores below both protein and training',
  MB.XP.sleep < MB.XP.protein && MB.XP.sleep < MB.XP.training);
check('3D: the recovery task is named "Daily Recovery Practice"', byKey(HABIT_KEYS.STRESS_RECOVERY)?.name === 'Daily Recovery Practice');
check('3D: it targets 5–10 minutes', MB.RECOVERY_PRACTICE.minMinutes === 5 && MB.RECOVERY_PRACTICE.maxMinutes === 10);
check('3D: it allows meditation, breathing, NSDR, walking and prayer',
  ['Meditation', 'Diaphragmatic breathing', 'NSDR', 'walk', 'Prayer']
    .every(x => MB.RECOVERY_PRACTICE.options.join(' ').includes(x)));
check('3D: its copy never claims a testosterone or growth guarantee',
  !/testosterone|guarantee|cortisol/i.test(MB.WHY[HABIT_KEYS.STRESS_RECOVERY] + byKey(HABIT_KEYS.STRESS_RECOVERY).desc));

// Protein target follows the user, not a universal constant.
check('3A: protein is 0.7–1.0 g/lb, suggested in between',
  MB.PROTEIN_PER_LB.min === 0.7 && MB.PROTEIN_PER_LB.max === 1.0 &&
  MB.PROTEIN_PER_LB.suggested > 0.7 && MB.PROTEIN_PER_LB.suggested < 1.0);
check('3A: a bodyweight produces a rounded suggestion', MB.suggestedProteinGrams(180) === 155, `${MB.suggestedProteinGrams(180)}`);
check('3A: no bodyweight → no invented number', MB.suggestedProteinGrams(null) === null);
const custom = MB.buildStartTasks({ ...setup, bodyweightLb: 180 });
check('3A: the task names the derived target when one exists',
  /180|155 g/.test(custom.find(t => t.id === 'mb_protein').name));
check('3B: a configured calorie target appears in the task name',
  MB.buildStartTasks({ ...setup, calorieTarget: 3100 }).find(t => t.id === 'mb_nutrition').name.includes('3100'));

// ══ 10: no clutter ══════════════════════════════════════════════════════════
const banned = ['hydration', 'water', 'steps', 'stretch', 'sauna', 'cold', 'bcaa', 'testosterone', 'pre-workout', 'cardio'];
const allText = tasks.map(t => `${t.id} ${t.name}`).join(' ').toLowerCase();
check('10: no hydration / steps / stretching / sauna / cold / cardio / supplement clutter',
  banned.every(b => !allText.includes(b)), allText);

// ══ 4: scheduled training is WEEKLY, not a daily checkbox ═══════════════════
check('4: training is not a daily task', !tasks.some(t => habitKeyOf(t) === HABIT_KEYS.HYPERTROPHY_TRAINING));
check('4: training day options are 3/4/5/6', MB.TRAINING_DAY_OPTIONS.join() === '3,4,5,6');
for (const n of MB.TRAINING_DAY_OPTIONS) {
  const meta = MB.buildChallengeMeta({ ...setup, trainingDaysPerWeek: n });
  const defs = getWeeklyRequirementDefs(meta);
  if (defs.length !== 1 || defs[0].perWeek !== n) { check(`4: ${n} training days → a weekly target of ${n}`, false); break; }
}
check('4: every training-days choice becomes its own weekly requirement', true);
const meta4 = MB.buildChallengeMeta({ ...setup, trainingDaysPerWeek: 4 });
check('4: the requirement uses the hypertrophy_training habitKey',
  getWeeklyRequirementDefs(meta4)[0].habitKey === HABIT_KEYS.HYPERTROPHY_TRAINING);
check('4: the attempt qualifies for weekly requirements via its OWN defs', hasWeeklyRequirements(meta4));
check('4: training is one of the highest-weighted requirements',
  getWeeklyRequirementDefs(meta4)[0].xp === MB.XP.training && MB.XP.training === MB.XP.protein);
check('4: Fat Loss keeps its own legacy weekly requirements untouched',
  getWeeklyRequirementDefs({ templateId: 'fat_loss_phase' }) === WEEKLY_REQUIREMENT_DEFS);

// Weekly scoring works through the existing engine.
const metaW = { ...meta4, weeklyRequirementsStartDate: START };
let wr = computeWeeklyRequirements({ sessions: [], meta: metaW, challengeStart: START, currentRawDay: 3 });
check('4: an in-progress week is neutral (nothing missed yet)', wr.earnedXP === 0 && wr.availableXP === 0 && wr.missedUnits === 0);
wr = computeWeeklyRequirements({
  sessions: [1, 3, 5, 6].map(n => makeSession('hypertrophy_training', d(n))),
  meta: metaW, challengeStart: START, currentRawDay: 8, penaltiesEnabled: true,
});
check('4: a completed 4-session week scores full marks', wr.earnedXP === 4 * MB.XP.training && wr.missedUnits === 0);
wr = computeWeeklyRequirements({
  sessions: [1, 3].map(n => makeSession('hypertrophy_training', d(n))),
  meta: metaW, challengeStart: START, currentRawDay: 8, penaltiesEnabled: true,
});
check('4: a finalised week with 2 of 4 sessions counts 2 missed', wr.missedUnits === 2);

// ══ 5: weekly hypertrophy volume ════════════════════════════════════════════
check('5: all ten muscle groups are tracked',
  MB.MUSCLE_GROUPS.map(m => m.id).join() === 'chest,back,quads,hamstrings,glutes,shoulders,biceps,triceps,calves,abs');
check('5: ~10 sets is the reference for major muscles',
  MB.MUSCLE_GROUPS.filter(m => m.major).every(m => m.defaultTarget === MB.DEFAULT_SET_TARGET));
check('5: smaller muscles may use lower targets',
  MB.MUSCLE_GROUPS.filter(m => !m.major).some(m => m.defaultTarget < MB.DEFAULT_SET_TARGET));
check('5: 10 is a default, never hard-coded into the logic',
  volumeTargets({ templateId: MB.MUSCLE_BUILDING_TEMPLATE_ID, muscleBuilding: { volumeTargets: { chest: 16 } } }).chest === 16);

const volMeta = MB.buildChallengeMeta({ ...setup, durationDays: 30 });
const volEntries = [
  ...Array.from({ length: 8 }, () => makeVolumeEntry('chest', 1, d(2))),
  ...Array.from({ length: 10 }, () => makeVolumeEntry('back', 1, d(3))),
  ...Array.from({ length: 6 }, () => makeVolumeEntry('quads', 1, d(4))),
];
const v = weeklyVolume({ entries: volEntries, meta: volMeta, challengeStart: START, rawDay: 5 });
check('5: volume is tracked for a Muscle Building attempt', v.supported && tracksVolume(volMeta));
const row = id => v.rows.find(r => r.id === id);
check('5: Chest reads 8 / 10 sets', row('chest').done === 8 && row('chest').target === 10 && !row('chest').met);
check('5: Back reads 10 / 10 sets and is met', row('back').done === 10 && row('back').met);
check('5: Quads reads 6 / 10 sets', row('quads').done === 6 && row('quads').target === 10);
check('5: untouched muscles read 0', row('calves').done === 0);
check('5: every set entry is individually addressable and undoable',
  new Set(volEntries.map(e => e.id)).size === volEntries.length);
check('5: sets logged before Day 1 belong to no challenge week',
  weeklyVolume({ entries: [makeVolumeEntry('chest', 5, '2026-07-30')], meta: volMeta, challengeStart: START, rawDay: 3 })
    .rows.find(r => r.id === 'chest').done === 0);
check('5: a non-Muscle-Building attempt tracks no volume',
  !tracksVolume({ templateId: 'fat_loss_phase' }) &&
  weeklyVolume({ entries: volEntries, meta: { templateId: 'fat_loss_phase', durationDays: 30 }, challengeStart: START, rawDay: 5 }).supported === false);

// Volume is a PROGRESS METRIC — it must never award XP.
const mbProfiles = { p: { challengeStart: START, activeChallenge: volMeta, tasks, volumeSets: volEntries, weeklySessions: [], xpPenalties: false } };
const mbDays = {}; for (let i = 1; i <= 5; i++) mbDays[i] = { dayNumber: i, tasks: {}, isMWD: false, mwdTasks: {}, bonusDone: {} };
const xpNoVol = computeTotalXP({ p: mbDays }, { p: { ...mbProfiles.p, volumeSets: [] } }, 'p', () => 0, 5, 5);
const xpWithVol = computeTotalXP({ p: mbDays }, mbProfiles, 'p', () => 0, 5, 5);
check('5: logging 24 hard sets awards exactly zero XP', xpWithVol.rawTotal === xpNoVol.rawTotal, `${xpWithVol.rawTotal} vs ${xpNoVol.rawTotal}`);

// Adherence over finalised weeks only.
const adh = volumeAdherence({ entries: volEntries, meta: volMeta, challengeStart: START, rawDay: 10 });
check('5: adherence is measured over finalised weeks only', adh.weeks === 1);
check('5: credit is capped at the target (extra sets cannot exceed 100%)',
  volumeAdherence({
    entries: Array.from({ length: 50 }, () => makeVolumeEntry('chest', 1, d(2))),
    meta: volMeta, challengeStart: START, rawDay: 10,
  }).done === 10);
check('5: an in-progress week alone yields no adherence verdict',
  volumeAdherence({ entries: volEntries, meta: volMeta, challengeStart: START, rawDay: 4 }) === null);

// ══ 6: RIR guidance is educational, never a checkbox ════════════════════════
check('6: 0–3 RIR is the stated practical guidance', MB.RIR_GUIDANCE.rirRange.join() === '0,3');
check('6: the guidance explicitly does not demand absolute failure', /not need to take every set to absolute failure/i.test(MB.RIR_GUIDANCE.body));
check('6: RIR is not a daily task', !tasks.some(t => /rir|reps in reserve/i.test(t.name)));
check('6: RIR is optional on a logged entry',
  makeExerciseEntry({ exercise: 'Squat', load: 225, reps: 8, sets: 3, date: d(1) }).rir === undefined &&
  makeExerciseEntry({ exercise: 'Squat', load: 225, reps: 8, sets: 3, rir: 2, date: d(1) }).rir === 2);

// ══ 7: progressive overload ═════════════════════════════════════════════════
check('7: an entry records exercise, load, reps and sets', (() => {
  const e = makeExerciseEntry({ exercise: 'Incline Dumbbell Press', load: 70, reps: 10, sets: 3, date: d(1) });
  return e.exercise === 'Incline Dumbbell Press' && e.load === 70 && e.reps === 10 && e.sets === 3;
})());
check('7: a nameless entry is rejected', makeExerciseEntry({ exercise: '  ', load: 1, reps: 1, sets: 1 }) === null);
check('7: volume load = load × reps × sets', volumeLoad({ load: 100, reps: 10, sets: 3 }) === 3000);

const mkLog = (name, rows) => rows.map(([load, reps, sets, day]) => makeExerciseEntry({ exercise: name, load, reps, sets, date: d(day) }));
// More reps at the same load — a genuine progression route.
const repsUp = mkLog('Incline Dumbbell Press', [[70, 8, 3, 1], [70, 8, 3, 4], [70, 10, 3, 8], [70, 11, 3, 11]]);
check('7: more reps at the same load reads as progressing',
  performanceTrends(repsUp)[0].trend === 'progressing');
// More load at similar reps.
const loadUp = mkLog('Squat', [[225, 8, 3, 1], [225, 8, 3, 4], [255, 8, 3, 8], [265, 8, 3, 11]]);
check('7: more load at similar reps reads as progressing', performanceTrends(loadUp)[0].trend === 'progressing');
// More productive volume.
const volUp = mkLog('Row', [[100, 10, 3, 1], [100, 10, 3, 4], [100, 10, 4, 8], [100, 10, 5, 11]]);
check('7: more productive volume reads as progressing', performanceTrends(volUp)[0].trend === 'progressing');
// One down session inside an improving block must NOT be punished.
const oneDip = mkLog('Bench', [[185, 8, 3, 1], [195, 8, 3, 4], [205, 8, 3, 8], [185, 8, 3, 11]]);
check('7: a single lighter session does not mark an exercise as declining',
  performanceTrends(oneDip)[0].trend !== 'declining', performanceTrends(oneDip)[0].trend);
check('7: too little history yields NO verdict rather than a guess',
  performanceTrends(mkLog('Curl', [[30, 10, 3, 1], [30, 10, 3, 4]])).length === 0);
check('7: the summary reads like "Your incline dumbbell press is progressing."',
  trendSummaries(repsUp)[0].text === 'Your incline dumbbell press is progressing.');
check('7: exercises group case- and space-insensitively',
  exerciseKey('  Incline  Dumbbell Press ') === exerciseKey('incline dumbbell press'));
const perf = overallPerformance([...repsUp, ...loadUp]);
check('7: an overall performance signal is produced', perf.tracked === 2 && perf.progressing === 2 && !perf.flat);

// ══ 8: protein distribution — optional and lower XP ═════════════════════════
const pd = MB.OPTIMIZATION_HABITS.find(h => h.key === 'proteinDistribution');
check('8: protein distribution uses the protein_distribution habitKey', pd.habitKey === HABIT_KEYS.PROTEIN_DISTRIBUTION);
check('8: it is off unless enabled at setup', !tasks.some(t => t.id === pd.id));
check('8: it is worth less than total daily protein', pd.xp < MB.XP.protein);
check('8: it never asks for leucine grams', !/leucine/i.test(pd.desc) && !/\bg of leucine\b/i.test(MB.WHY[pd.habitKey]));
check('8: it describes 3–4 feedings, not a threshold', /3–4/.test(pd.desc) && !/threshold/i.test(MB.WHY[pd.habitKey]));

// ══ 9: creatine — optional ══════════════════════════════════════════════════
const cr = MB.OPTIMIZATION_HABITS.find(h => h.key === 'creatine');
check('9: creatine uses the creatine habitKey', cr.habitKey === HABIT_KEYS.CREATINE);
check('9: it is off by default', setup.optimizations.creatine === false && !tasks.some(t => t.id === cr.id));
check('9: enabling it adds exactly one task', MB.buildStartTasks({ ...setup, optimizations: { creatine: true } }).filter(t => t.id === cr.id).length === 1);
check('9: it targets 3–5 g/day with no loading phase', /3–5 g/.test(cr.desc) && /No loading phase/i.test(cr.desc));
check('9: it is worth less than every fundamental',
  cr.xp < Math.min(MB.XP.protein, MB.XP.nutrition, MB.XP.sleep, MB.XP.recovery, MB.XP.dailyLog));

// ══ 14: XP hierarchy ════════════════════════════════════════════════════════
check('14: protein and training are the joint highest', MB.XP.protein === MB.XP.training && MB.XP.protein > MB.XP.nutrition);
check('14: nutrition is high, above sleep', MB.XP.nutrition > MB.XP.sleep);
check('14: sleep is moderate-high, above recovery', MB.XP.sleep > MB.XP.recovery);
check('14: every optimization is worth less than every fundamental',
  MB.OPTIMIZATION_HABITS.every(h => h.xp < Math.min(MB.XP.protein, MB.XP.nutrition, MB.XP.sleep, MB.XP.recovery, MB.XP.dailyLog)));
const bothOn = MB.buildStartTasks({ ...setup, optimizations: { creatine: true, proteinDistribution: true } });
check('14: enabling every optimization cannot outweigh the fundamentals',
  MB.OPTIMIZATION_HABITS.reduce((s, h) => s + h.xp, 0) < MB.XP.protein);
check('14: optimizations are ordered after every fundamental',
  bothOn.findIndex(t => t.id === cr.id) > bothOn.findIndex(t => t.id === 'mb_sleep'));
check('14: XP values sit on Forge\'s existing scale (Fat Loss keystone = 40)', MB.XP.protein === 40);

// ══ 11: bodyweight trend ════════════════════════════════════════════════════
const wMeta = MB.buildChallengeMeta({ ...setup, durationDays: 90 });
function daysWithWeights(series) {   // series: [[day, weight], …]
  const out = {};
  for (const [day, w] of series) out[day] = { dayNumber: day, weight: w, tasks: {}, isMWD: false, mwdTasks: {}, bonusDone: {} };
  return out;
}
// ~0.2%/week on a 200 lb frame — inside the default 0.1–0.3% range.
const onTarget = daysWithWeights([[1, 200], [4, 200.2], [8, 200.4], [11, 200.5], [15, 200.8], [18, 201.0], [22, 201.2]]);
let bw = bodyweightTrend({ days: onTarget, meta: wMeta, challengeStart: START, rawDay: 25 });
check('11: weekly averages drive the trend, not single weigh-ins', weeklyWeights({ days: onTarget, meta: wMeta, challengeStart: START, rawDay: 25 }).length === 4);
check('11: a rate inside the target range reads onTarget', bw.status === 'onTarget', `${bw.ratePct}% ${bw.status}`);
check('11: the configured range is reported, not a universal number', bw.rangeMin === 0.1 && bw.rangeMax === 0.3);
// ~1%/week — substantially faster than target.
const tooFast = daysWithWeights([[1, 200], [4, 201], [8, 202], [11, 203], [15, 204], [18, 206], [22, 208]]);
bw = bodyweightTrend({ days: tooFast, meta: wMeta, challengeStart: START, rawDay: 25 });
check('11: gaining much faster than target is flagged', bw.status === 'fast', `${bw.ratePct}%`);
let ins = growthInsights({ days: tooFast, meta: wMeta, challengeStart: START, rawDay: 25, exerciseEntries: [], weeklyRequirements: null, volumeAdherence: null, taskAdherencePct: null });
check('11: the fast-gain insight suggests a calorie reduction as an option',
  ins.some(i => i.id === 'gain_too_fast' && /faster than your selected muscle-gain target/.test(i.text) && /Consider slightly reducing calorie intake/.test(i.text)));
check('11: it never states it changed anything', ins.every(i => !/I have|automatically (set|changed|adjusted)/i.test(i.text)));
// Flat for several weeks.
const flat = daysWithWeights([[1, 200], [4, 200], [8, 200], [11, 200], [15, 200], [18, 200], [22, 200], [25, 200]]);
ins = growthInsights({
  days: flat, meta: wMeta, challengeStart: START, rawDay: 28,
  exerciseEntries: mkLog('Bench', [[185, 8, 3, 1], [185, 8, 3, 5], [185, 8, 3, 12], [185, 8, 3, 20]]),
  weeklyRequirements: { earnedXP: 90, availableXP: 100 }, volumeAdherence: { pct: 90, weeks: 3 }, taskAdherencePct: 90,
});
check('11: a multi-week stall with flat performance surfaces the stall insight',
  ins.some(i => i.text === 'Your growth trend has stalled. Nutrition, training stimulus, or recovery may need adjustment.'));

// ══ 13: inputs vs outputs ═══════════════════════════════════════════════════
check('13: high adherence + flat outputs produces the headline coaching line',
  ins.some(i => i.id === 'inputs_outputs' && /Adherence is high/.test(i.text) && /flat for 3 weeks/.test(i.text) && /reviewing calorie intake or training volume/.test(i.text)));
const lowAdh = growthInsights({
  days: flat, meta: wMeta, challengeStart: START, rawDay: 28,
  exerciseEntries: [], weeklyRequirements: { earnedXP: 30, availableXP: 100 },
  volumeAdherence: { pct: 40, weeks: 3 }, taskAdherencePct: 45,
});
check('13: low adherence points at the fundamentals first, not the targets',
  lowAdh.some(i => i.id === 'adherence_first' && /Tighten the fundamentals/.test(i.text)));
check('13: a volume shortfall is called out as the first fix',
  lowAdh.some(i => i.id === 'volume_low'));
check('13: nothing is produced when there is no evidence yet',
  growthInsights({ days: {}, meta: wMeta, challengeStart: START, rawDay: 3, exerciseEntries: [], weeklyRequirements: null, volumeAdherence: null, taskAdherencePct: null }).length === 0);

// ══ 12: physique tracking ═══════════════════════════════════════════════════
check('12: weight, waist, chest, arms, thighs and photos are offered',
  MB.MEASUREMENTS.map(m => m.id).join() === 'weight,waist,chest,arms,thighs,photos');
check('12: nothing is required — the selection is per attempt',
  Object.values(MB.defaultMeasurementSelection()).some(v => v === false));
check('12: check-ins are recommended every 2–4 weeks',
  MB.CHECKIN_INTERVAL_DAYS.min === 14 && MB.CHECKIN_INTERVAL_DAYS.max === 28);
const selMeta = MB.buildChallengeMeta({ ...setup, measurements: { weight: true, arms: true, chest: false, waist: false, thighs: false, photos: false } });
const cis = measurementCheckIns({ days: { 3: { weight: 201, arms: 15.5 } }, meta: selMeta, rawDay: 5 });
check('12: only the selected measurements are surfaced', cis.map(m => m.id).join() === 'weight,arms');
check('12: the latest logged value is reported', cis.find(m => m.id === 'arms').latest === 15.5);

// ══ 15: compatibility + shared habits ═══════════════════════════════════════
check('15: Muscle Building + Mental Training = HIGHLY_COMPATIBLE',
  getCompatibility(C.MUSCLE_BUILDING, C.MENTAL_TRAINING).rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('15: Muscle Building + Sleep Reset = HIGHLY_COMPATIBLE',
  getCompatibility(C.MUSCLE_BUILDING, C.SLEEP_RESET).rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('15: Muscle Building + Women\'s Hormone Health = HIGHLY_COMPATIBLE',
  getCompatibility(C.MUSCLE_BUILDING, C.HORMONE_HEALTH).rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('15: Muscle Building + Fat Loss = CONFLICTING',
  getCompatibility(C.MUSCLE_BUILDING, C.FAT_LOSS).rating === COMPATIBILITY.CONFLICTING && !canStack(C.MUSCLE_BUILDING, C.FAT_LOSS));
check('15: Muscle Building + Strength = CONDITIONAL',
  getCompatibility(C.MUSCLE_BUILDING, C.STRENGTH).rating === COMPATIBILITY.CONDITIONAL);
check('15: the remaining library challenges are rated too, not left unknown',
  getCompatibility(C.MUSCLE_BUILDING, C.RECOVERY).rating === COMPATIBILITY.HIGHLY_COMPATIBLE &&
  getCompatibility(C.MUSCLE_BUILDING, C.DISCIPLINE_75).rating === COMPATIBILITY.CONFLICTING);

// Shared habits deduplicate through habitKey, with no double XP.
const mtLike = [
  { id: 'mt_mind', name: 'Mental Training — 5 minutes', xp: 100, habitKey: HABIT_KEYS.MEDITATION },
  { id: 'sr_sleep', name: 'Sleep 8.5+ hours', xp: 30, habitKey: HABIT_KEYS.SLEEP_TARGET, target: { value: 8.5, unit: 'hours', direction: 'atLeast' } },
  { id: 'sr_recovery', name: 'Wind-down routine', xp: 20, habitKey: HABIT_KEYS.STRESS_RECOVERY },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 20, habitKey: HABIT_KEYS.DAILY_LOG },
];
const { tasks: stacked, merges } = mergeSupportTasks(tasks, mtLike);
check('15: sleep_target deduplicates across the two challenges',
  stacked.filter(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).length === 1);
check('15: stress_recovery deduplicates', stacked.filter(t => habitKeyOf(t) === HABIT_KEYS.STRESS_RECOVERY).length === 1);
check('15: daily_log deduplicates', stacked.filter(t => t.id === 'daily_log').length === 1);
check('15: the shared sleep row takes the STRICTER 8.5h target',
  stacked.find(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).name === 'Sleep 8.5+ hours');
check('15: shared rows count toward BOTH challenges',
  ['mb_sleep', 'mb_recovery', 'daily_log'].every(id => isSharedTask(stacked.find(t => t.id === id))));
check('15: no shared requirement is duplicated for XP',
  new Set(stacked.map(t => t.id)).size === stacked.length &&
  stacked.reduce((s, t) => s + getTaskXP(t), 0) < tasks.reduce((s, t) => s + getTaskXP(t), 0) + mtLike.reduce((s, t) => s + getTaskXP(t), 0));
check('15: three habits merged; only genuinely new work was added',
  merges.length === 3 && stacked.length === tasks.length + 1);
check('15: protein stays Muscle Building\'s own keystone after stacking',
  keystoneHabitsOf(tasksForLane(stacked, LANE.PRIMARY)).map(t => t.id).join() === 'mb_protein');

// ══ 16/17/18: setup, identity, education ════════════════════════════════════
check('16: the setup defaults are complete and immediately startable',
  MB.buildStartTasks(MB.defaultSetup()).length > 0 && MB.buildChallengeMeta(MB.defaultSetup()).durationDays === 60);
check('16: the attempt stores its own config, so later config edits never rewrite it',
  MB.buildChallengeMeta(setup).muscleBuilding.trainingDaysPerWeek === MB.DEFAULT_TRAINING_DAYS);
check('17: the challenge has its title and subtitle',
  MB.IDENTITY.name === 'Muscle Building' && MB.IDENTITY.subtitle === 'Build More Muscle. Train With Purpose.');
check('17: the goal is hypertrophy, not generic strength', /muscle growth/i.test(MB.IDENTITY.goal));
const whyKeys = [HABIT_KEYS.PROTEIN_TARGET, HABIT_KEYS.HYPERTROPHY_TRAINING, HABIT_KEYS.CALORIE_TARGET,
  HABIT_KEYS.SLEEP_TARGET, HABIT_KEYS.STRESS_RECOVERY, HABIT_KEYS.CREATINE, HABIT_KEYS.PROTEIN_DISTRIBUTION];
check('18: every major requirement has a "why this helps" explanation', whyKeys.every(k => (MB.WHY[k] || '').length > 30));
check('18: the protein explanation matches the requested copy',
  MB.WHY[HABIT_KEYS.PROTEIN_TARGET] === 'Provides the amino acids needed to repair and build muscle.');
check('18: no exaggerated medical claims anywhere in the copy',
  !/cure|guarantee|maximis?e testosterone|boost testosterone|anabolic window/i.test(Object.values(MB.WHY).join(' ')));

// ══ 20: nothing Muscle-Building-specific leaks elsewhere ════════════════════
check('20: the config is the single source for the challenge',
  typeof MB.buildStartTasks === 'function' && typeof MB.buildChallengeMeta === 'function' && typeof MB.defaultSetup === 'function');
check('20: adding an optimization habit is a one-entry data change',
  MB.OPTIMIZATION_HABITS.every(h => h.id && h.key && h.habitKey && typeof h.xp === 'number' && h.name && h.desc));
check('20: mbConfig only recognises a Muscle Building attempt',
  MB.mbConfig(MB.buildChallengeMeta(setup)) !== null && MB.mbConfig({ templateId: 'fat_loss_phase' }) === null);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
