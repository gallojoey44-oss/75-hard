/**
 * Women's Hormone Health — configuration, requirements, XP weighting, symptom
 * check-ins, Life Impact scoring, three-cycle comparison and medical safety.
 */
import * as HH from '../src/data/hormoneHealthConfig.js';
import { HABIT_KEYS, habitKeyOf } from '../src/data/habitKeys.js';
import { COMPATIBILITY, CHALLENGE_IDS, getCompatibility, canStack } from '../src/data/challengeCompatibility.js';
import {
  makeCycleLog, logForDate, severityScore, interferenceScore, lifeImpactForLog, lifeImpactBand,
  groupCycles, summariseCycle, compareCycles, cycleProgress, safetyFlags,
  persistentSymptomsAtCompletion, tracksCycles, logsInChallenge, COMPARISON_METRICS,
} from '../src/utils/cycleTracking.js';
import { hasWeeklyRequirements, getWeeklyRequirementDefs, computeWeeklyRequirements, makeSession } from '../src/utils/weeklyRequirements.js';
import { keystoneHabitsOf, computeTotalXP, getTaskXP } from '../src/utils/gamification.js';
import { mergeSupportTasks, tasksForLane, LANE, isSharedTask } from '../src/utils/challengeStack.js';
import { getDateForDayNumber } from '../src/utils/dateUtils.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const C = CHALLENGE_IDS;
const START = '2026-08-01';
const d = n => getDateForDayNumber(START, n);
const setup = HH.defaultSetup();
const tasks = HH.buildStartTasks(setup);
const meta = HH.buildChallengeMeta(setup);
const byKey = k => tasks.find(t => habitKeyOf(t) === k);

// ══ Purpose and claims ══════════════════════════════════════════════════════
check('the goal is habit-building, not a cure', /sustainable health habits/i.test(HH.IDENTITY.goal));
check('it names the symptoms it may reduce',
  ['cramps', 'fatigue', 'bloating', 'mood', 'sleep'].every(w => HH.IDENTITY.goal.toLowerCase().includes(w)));
check('it explicitly disclaims balancing hormones or treating conditions',
  /does not claim to balance hormones/i.test(HH.IDENTITY.disclaimer) && /treat any medical condition/i.test(HH.IDENTITY.disclaimer));
check('no copy promises a cure or symptom-free outcome', (() => {
  const all = [HH.IDENTITY.goal, HH.IDENTITY.disclaimer, HH.GRADUATION.body, HH.GRADUATION.caveat,
    ...Object.values(HH.WHY)].join(' ');
  return !/\bcure\b|guarantee|eliminate your period|symptom-free for everyone/i.test(all);
})());
check('graduation is framed without promising everyone improves',
  /Not everyone becomes symptom-free, and that is not a failure/i.test(HH.GRADUATION.caveat));

// ══ Durations ═══════════════════════════════════════════════════════════════
check('two durations are offered: 56 and 84 days', HH.DURATIONS.join() === '56,84');
check('they are 8 and 12 weeks',
  HH.DURATION_OPTIONS.map(o => o.weeks).join() === '8,12' &&
  HH.DURATION_OPTIONS.every(o => o.days / 7 === o.weeks));
check('8 weeks is labelled Standard, 12 weeks Recommended',
  HH.durationOption(56).label === 'Standard' && HH.durationOption(84).label === 'Recommended');
check('the headlines read "8 Weeks — Standard" and "12 Weeks — Recommended"',
  HH.durationOption(56).headline === '8 Weeks — Standard' &&
  HH.durationOption(84).headline === '12 Weeks — Recommended');
check('12 weeks is the default and the recommended option', HH.DEFAULT_DURATION === 84);
check('the required UI copy is present for each option',
  HH.durationOption(56).blurb === 'Build the foundations and compare how your cycle responds.' &&
  HH.durationOption(84).blurb === 'Give the habits more time and get a clearer picture across multiple cycles.');
check('8 weeks is framed as the minimum recommended version',
  /minimum recommended version/i.test(HH.durationOption(56).detail));
check('12 weeks is framed as the clearer read, not the harder one',
  /clearest read/i.test(HH.durationOption(84).detail) &&
  /separates a genuine trend from normal month-to-month variation/i.test(HH.durationOption(84).detail));
check('the default attempt is 84 days', meta.durationDays === 84);
check('an 8-week attempt stores 56 days',
  HH.buildChallengeMeta({ ...setup, durationDays: 56 }).durationDays === 56);
check('the attempt records its own chosen length',
  HH.buildChallengeMeta({ ...setup, durationDays: 56 }).hormoneHealth.durationDays === 56);
check('an unknown duration falls back to the recommended one',
  HH.buildChallengeMeta({ ...setup, durationDays: 999 }).durationDays === 84);
check('the longer version earns a larger completion bonus',
  HH.COMPLETION_BONUS_BY_DURATION[56] < HH.COMPLETION_BONUS_BY_DURATION[84] &&
  HH.buildChallengeMeta({ ...setup, durationDays: 56 }).completionBonusXP === HH.COMPLETION_BONUS_BY_DURATION[56]);

// ══ The two versions are IDENTICAL apart from length ════════════════════════
const short8 = HH.buildChallengeMeta({ ...setup, durationDays: 56 });
const long12 = HH.buildChallengeMeta({ ...setup, durationDays: 84 });
check('the daily habits are identical between the two durations',
  JSON.stringify(HH.buildStartTasks({ ...setup, durationDays: 56 })) ===
  JSON.stringify(HH.buildStartTasks({ ...setup, durationDays: 84 })));
check('the weekly requirements are identical',
  JSON.stringify(short8.weeklyRequirementDefs) === JSON.stringify(long12.weeklyRequirementDefs));
check('the 12-week version is not harder — only duration and bonus differ', (() => {
  const strip = (m) => {
    const { durationDays, completionBonusXP, hormoneHealth, ...rest } = m;
    const { durationDays: _d, ...hh } = hormoneHealth;
    return JSON.stringify({ ...rest, hormoneHealth: hh });
  };
  return strip(short8) === strip(long12);
})());

// ══ Cycles are never assumed — only counted ═════════════════════════════════
check('8 weeks typically covers ~2 cycles, 12 weeks ~3',
  HH.typicalCycles(56) === 2 && HH.typicalCycles(84) === 3);
// The typical count is a DISPLAY hint only — the comparison is built from the
// cycles actually logged, never from the number a duration was expected to yield.
check('an 8-week attempt that logged three cycles compares all three', (() => {
  const three = groupCycles([
    ...[1, 2].map(n => makeCycleLog(d(n), { pain: 8 })),
    ...[24, 25].map(n => makeCycleLog(d(n), { pain: 5 })),
    ...[47, 48].map(n => makeCycleLog(d(n), { pain: 3 })),
  ]);
  const cmp = compareCycles(three);
  return three.length === 3 && cmp.find(c => c.key === 'avgPain').from === 8 &&
    cmp.find(c => c.key === 'avgPain').to === 3;
})());
check('a 12-week attempt that logged only one cycle fabricates no comparison',
  compareCycles(groupCycles([makeCycleLog(d(1), { pain: 7 })])).length === 0);
check('an 8-week attempt shows two stages by default',
  HH.stagesForDuration(56).map(s => s.label).join() === 'Baseline,Improvement');
check('a 12-week attempt shows three',
  HH.stagesForDuration(84).map(s => s.label).join() === 'Baseline,Improvement,Consolidation');
check('an 8-week attempt that logs a third cycle still shows it — nothing is hidden',
  HH.stagesForDuration(56, 3).length === 3);
check('a fourth logged cycle gets its own stage rather than disappearing',
  HH.stagesForDuration(84, 4).length === 4 && HH.stagesForDuration(84, 4)[3].cycle === 4);
check('at least one stage always shows', HH.stagesForDuration(56, 0).length >= 1);

// ══ Keystone habit: Sleep & Recovery ════════════════════════════════════════
check('sleep is THE keystone habit', keystoneHabitsOf(tasks).map(t => t.id).join() === 'hh_sleep');
check('sleep carries the highest daily XP',
  byKey(HABIT_KEYS.SLEEP_TARGET).xp === HH.XP.sleep && HH.XP.sleep === Math.max(...tasks.map(t => t.xp)));
check('the sleep target is 7.5–9 hours',
  HH.SLEEP_TARGET.min === 7.5 && HH.SLEEP_TARGET.max === 9 && byKey(HABIT_KEYS.SLEEP_TARGET).target.value === 7.5);
check('it asks for a consistent sleep/wake schedule', /consistent sleep and wake time/i.test(byKey(HABIT_KEYS.SLEEP_TARGET).desc));
check('late-luteal sleep advice is a recommendation, not a requirement',
  /recommendations, not extra boxes to tick/i.test(HH.SLEEP_GUIDANCE.notice));
check('the extra sleep opportunity guidance is present',
  HH.SLEEP_GUIDANCE.items.some(i => /30–60 minutes/.test(i)) &&
  HH.SLEEP_GUIDANCE.items.some(i => /comfortably cool/.test(i)));

// ══ Daily habits ════════════════════════════════════════════════════════════
check('there are five daily habits plus the daily log', tasks.length === 6, `${tasks.length}`);
check('whole-food nutrition is present and high-weighted',
  byKey(HABIT_KEYS.WHOLE_FOODS)?.xp === HH.XP.wholeFood && HH.XP.wholeFood > HH.XP.movement);
check('it does not prescribe a restrictive hormone diet',
  /Not a restrictive diet/i.test(byKey(HABIT_KEYS.WHOLE_FOODS).desc) &&
  /not a restrictive "hormone diet"/i.test(HH.WHY[HABIT_KEYS.WHOLE_FOODS]));
check('daily movement targets 8,000+ steps',
  HH.STEP_TARGET.suggested === 8000 && byKey(HABIT_KEYS.DAILY_STEPS).target.value === 8000);
check('movement exists so there is a floor on low-capability days',
  /days when hard exercise is not realistic/i.test(byKey(HABIT_KEYS.DAILY_STEPS).desc));
check('hydration uses the user\'s own normal target', byKey(HABIT_KEYS.HYDRATION)?.xp === HH.XP.hydration);
check('hydration requires no salt, minerals or electrolyte products',
  /No special salt, trace minerals or electrolyte products required/i.test(HH.HYDRATION.note));
check('electrolytes are mentioned only as optional after heavy sweating',
  /optional/i.test(HH.HYDRATION.electrolyteNote) && /substantial sweating/i.test(HH.HYDRATION.electrolyteNote));
check('stress reduction requires at least 5 minutes',
  HH.STRESS_MINUTES.min === 5 && byKey(HABIT_KEYS.STRESS_RECOVERY).target.value === 5);
check('the user chooses the down-regulation method',
  ['Meditation', 'Diaphragmatic breathing', 'Prayer', 'Journaling', 'Quiet relaxation']
    .every(o => HH.STRESS_OPTIONS.includes(o)));

// ══ Weekly habits ═══════════════════════════════════════════════════════════
const defs = getWeeklyRequirementDefs(meta);
check('the attempt qualifies for weekly requirements via its own defs', hasWeeklyRequirements(meta));
check('there are three weekly requirements', defs.length === 3);
check('exercise is 3 sessions per week',
  defs.find(x => x.id === 'hh_exercise').perWeek === 3 && HH.EXERCISE_PER_WEEK === 3);
check('exercise is one of the highest-weighted requirements',
  defs.find(x => x.id === 'hh_exercise').xp === HH.XP.exercise && HH.XP.exercise > HH.XP.movement);
check('omega-3 foods target 2–3 fatty fish meals per week', HH.OMEGA3_PER_WEEK === 2);
check('omega-3 names real food sources',
  ['Salmon', 'Sardines', 'Trout', 'Herring', 'Mackerel'].every(f => HH.OMEGA3_FOODS.includes(f)));
check('fish oil is never required', /supplements are never required/i.test(defs.find(x => x.id === 'hh_omega3').note));
check('iron-rich foods are a weekly requirement with real sources',
  defs.find(x => x.id === 'hh_iron').perWeek === HH.IRON_RICH_PER_WEEK &&
  ['Beef', 'Seafood', 'Eggs', 'Beans and lentils', 'Leafy greens'].every(f => HH.IRON_RICH_FOODS.includes(f)));
check('iron and liver supplements are never required',
  /no iron or liver supplements required/i.test(defs.find(x => x.id === 'hh_iron').note));
check('the iron education mentions heavy bleeding and testing',
  /heavy menstrual bleeding/i.test(HH.SAFETY.ironNote) && /testing your iron levels/i.test(HH.SAFETY.ironNote));
check('weekly targets are configurable per attempt',
  getWeeklyRequirementDefs(HH.buildChallengeMeta({ ...setup, exercisePerWeek: 5 }))
    .find(x => x.id === 'hh_exercise').perWeek === 5);

// Weekly scoring runs through the existing engine, unchanged.
const metaW = { ...meta, weeklyRequirementsStartDate: START };
let wr = computeWeeklyRequirements({ sessions: [], meta: metaW, challengeStart: START, currentRawDay: 3 });
check('an in-progress week is neutral', wr.earnedXP === 0 && wr.availableXP === 0 && wr.missedUnits === 0);
wr = computeWeeklyRequirements({
  sessions: [1, 3, 5].map(n => makeSession('hh_exercise', d(n))),
  meta: metaW, challengeStart: START, currentRawDay: 8, penaltiesEnabled: true,
});
check('a completed 3-session week scores full exercise marks', wr.earnedXP === 3 * HH.XP.exercise);

// ══ Cycle-aware exercise rule ═══════════════════════════════════════════════
check('the principle is "adjust intensity, not consistency"',
  HH.EXERCISE_GUIDANCE.principle === 'Adjust intensity, not consistency.');
check('training hard is encouraged when energy is good',
  ['Strength training', 'Progressive overload', 'Harder cardio'].every(e => HH.EXERCISE_GUIDANCE.whenGood.examples.includes(e)));
check('scaled options are offered when symptoms are significant',
  ['Moderate strength training', 'Pilates', 'Zone 2 cardio', 'Walking', 'Mobility', 'Yoga']
    .every(e => HH.EXERCISE_GUIDANCE.whenSymptomatic.examples.includes(e)));
check('a scaled session still counts in full',
  /still counts in full/i.test(HH.EXERCISE_GUIDANCE.whenSymptomatic.blurb) &&
  /Scaled sessions count in full/i.test(defs.find(x => x.id === 'hh_exercise').note));
check('it never claims women cannot lift heavy during menstruation',
  /You are not biologically incapable of training hard during your period/i.test(HH.EXERCISE_GUIDANCE.notice));
check('a PR is explicitly allowed if she feels good', /chase a PR if you want one/i.test(HH.EXERCISE_GUIDANCE.notice));

// ══ Menstruation comfort tools — optional, never scored ═════════════════════
check('comfort tools include heating pad, bath, walking, mobility, extra sleep',
  ['Heating pad', 'Warm bath', 'An easy walk', 'Mobility work'].every(i => HH.MENSTRUATION_TOOLS.items.includes(i)) &&
  HH.MENSTRUATION_TOOLS.items.some(i => /sleep opportunity/i.test(i)));
check('they are explicitly not required and do not affect the score',
  /None of these are required and none affect your score/i.test(HH.MENSTRUATION_TOOLS.blurb));
check('no comfort tool became a daily task',
  !tasks.some(t => /heating pad|bath|sauna/i.test(t.name)));

// ══ Symptom check-in ════════════════════════════════════════════════════════
check('the check-in covers pain, energy, mood, bloating and sleep quality',
  ['pain', 'energy', 'mood', 'bloating', 'sleepQuality'].every(id => HH.SYMPTOM_SCALES.some(s => s.id === id)));
check('flow offers light / moderate / heavy', HH.FLOW_OPTIONS.map(f => f.id).join() === 'light,moderate,heavy');
check('interference covers work, exercise, sleep and social plans',
  HH.INTERFERENCE_AREAS.map(a => a.id).join() === 'work,exercise,sleep,social');
check('a new check-in starts entirely blank — nothing is assumed', (() => {
  const l = makeCycleLog('2026-08-05');
  return l.pain === null && l.flow === null && l.meds === false &&
    Object.values(l.interference).every(v => v === false);
})());
check('pain medication use is optional', makeCycleLog('2026-08-05').meds === false);
check('check-ins are found by date', logForDate([makeCycleLog('2026-08-05')], '2026-08-05') !== null);
check('a check-in awards no XP — it is a measurement, not a habit',
  !tasks.some(t => habitKeyOf(t) === HABIT_KEYS.SYMPTOM_CHECKIN));

// ══ Life Impact Score ═══════════════════════════════════════════════════════
const log = (v) => makeCycleLog('2026-08-05', v);
check('severity averages only the fields actually filled in',
  severityScore(log({ pain: 8 })) === 8 && severityScore(log({})) === null);
check('positive scales are inverted so 10 always means worst',
  severityScore(log({ energy: 1 })) === 10 && severityScore(log({ energy: 10 })) === 1);
check('interference is the share of life areas affected',
  interferenceScore(log({ interference: { work: true, exercise: true, sleep: false, social: false } })) === 5 &&
  interferenceScore(log({ interference: { work: true, exercise: true, sleep: true, social: true } })) === 10);
check('a day with no impact at all scores 0',
  lifeImpactForLog(log({ pain: 1, energy: 10, mood: 10, sleepQuality: 10, bloating: 1 })) < 1.5);
const bad = log({ pain: 9, bloating: 8, energy: 2, mood: 2, sleepQuality: 2,
  interference: { work: true, exercise: true, sleep: true, social: true } });
check('a severe, fully disruptive day scores near 10', lifeImpactForLog(bad) >= 8.5, `${lifeImpactForLog(bad)}`);
check('interference is weighted above raw severity', (() => {
  const interfOnly = log({ pain: 1, interference: { work: true, exercise: true, sleep: true, social: true } });
  const painOnly = log({ pain: 10, bloating: 10, interference: { work: false, exercise: false, sleep: false, social: false } });
  return lifeImpactForLog(interfOnly) > lifeImpactForLog(painOnly);
})(), `${lifeImpactForLog(log({ pain: 1, interference: { work: true, exercise: true, sleep: true, social: true } }))}`);
check('symptoms without interference score low — "it hurt, but it did not stop me"',
  lifeImpactForLog(log({ pain: 6 })) === 2.4, `${lifeImpactForLog(log({ pain: 6 }))}`);
check('a partial check-in still produces a score rather than nothing',
  lifeImpactForLog(log({ pain: 6 })) != null);
check('an empty check-in produces no score rather than a fake zero',
  lifeImpactForLog(log({})) === null);
check('the score is banded for wording',
  lifeImpactBand(2).tone === 'good' && lifeImpactBand(9).tone === 'warn');

// ══ Cycle grouping and three-stage progress ═════════════════════════════════
const cycleLogs = [
  // Cycle 1 — rough
  ...[1, 2, 3, 4].map(n => makeCycleLog(d(n), { pain: 8, bloating: 7, energy: 3, mood: 3, sleepQuality: 4, flow: 'heavy',
    interference: { work: true, exercise: true, sleep: true, social: false } })),
  // Cycle 2 — better (a month later)
  ...[29, 30, 31, 32].map(n => makeCycleLog(d(n), { pain: 5, bloating: 5, energy: 6, mood: 6, sleepQuality: 6, flow: 'moderate',
    interference: { work: false, exercise: true, sleep: false, social: false } })),
  // Cycle 3 — better still
  ...[57, 58, 59].map(n => makeCycleLog(d(n), { pain: 3, bloating: 3, energy: 8, mood: 8, sleepQuality: 8, flow: 'light',
    interference: { work: false, exercise: false, sleep: false, social: false } })),
];
const cycles = groupCycles(cycleLogs);
check('consecutive logged days group into one cycle', cycles.length === 3, `${cycles.length}`);
check('each cycle knows its day span', cycles[0].days === 4 && cycles[2].days === 3);
check('cycles are numbered in order', cycles.map(c => c.index).join() === '1,2,3');
check('each cycle carries its stage label',
  cycles.map(c => c.stage.label).join() === 'Baseline,Improvement,Consolidation');
check('the stage ladder is Baseline / Improvement / Consolidation',
  HH.CYCLE_STAGES.map(s => s.label).join() === 'Baseline,Improvement,Consolidation');
check('cycle averages are computed', cycles[0].avgPain === 8 && cycles[2].avgPain === 3);
check('worst pain is tracked separately from the average', cycles[0].worstPain === 8);
check('heavy flow days are counted', cycles[0].heavyFlowDays === 4 && cycles[2].heavyFlowDays === 0);
check('exercise and work disruption are counted per cycle',
  cycles[0].exerciseDisruptedDays === 4 && cycles[0].workDisruptedDays === 4 &&
  cycles[2].exerciseDisruptedDays === 0);
check('Life Impact falls across the three cycles',
  cycles[0].lifeImpact > cycles[1].lifeImpact && cycles[1].lifeImpact > cycles[2].lifeImpact,
  cycles.map(c => c.lifeImpact).join(' → '));
check('a gap of more than three days starts a new cycle',
  groupCycles([makeCycleLog(d(1)), makeCycleLog(d(9))]).length === 2);
check('a gap within three days stays one cycle',
  groupCycles([makeCycleLog(d(1)), makeCycleLog(d(3))]).length === 1);
const progress = cycleProgress(cycles.slice(0, 1));
check('the progress view shows all three stages even when only one is logged',
  progress.length === 3 && !!progress[0].cycleData && progress[1].cycleData === null);

// ══ Cycle comparison ════════════════════════════════════════════════════════
const changes = compareCycles(cycles);
check('every requested metric is compared',
  ['avgPain', 'worstPain', 'avgEnergy', 'avgMood', 'avgBloating', 'avgSleepQuality',
   'exerciseDisruptedDays', 'workDisruptedDays', 'lifeImpact']
    .every(k => COMPARISON_METRICS.some(m => m.key === k)));
check('the comparison runs first cycle → most recent',
  changes.find(c => c.key === 'avgPain').from === 8 && changes.find(c => c.key === 'avgPain').to === 3);
check('less pain reads as an improvement', changes.find(c => c.key === 'avgPain').improved === true);
check('more energy reads as an improvement', changes.find(c => c.key === 'avgEnergy').improved === true);
check('Life Impact is flagged as the headline metric',
  changes.find(c => c.key === 'lifeImpact').headline === true);
check('nothing is fabricated with fewer than two cycles',
  compareCycles(cycles.slice(0, 1)).length === 0 && compareCycles([]).length === 0);
check('a metric never filled in simply does not appear', (() => {
  const sparse = groupCycles([
    makeCycleLog(d(1), { pain: 7 }), makeCycleLog(d(29), { pain: 4 }),
  ]);
  const cmp = compareCycles(sparse);
  return cmp.some(c => c.key === 'avgPain') && !cmp.some(c => c.key === 'avgEnergy');
})());

// ══ Medical safety ══════════════════════════════════════════════════════════
check('no flag fires on a single bad day',
  safetyFlags(groupCycles([makeCycleLog(d(1), { pain: 9 })]), [makeCycleLog(d(1), { pain: 9 })]).length === 0);
const severeLogs = [1, 2, 3].map(n => makeCycleLog(d(n), { pain: 9 }));
check('repeated severe pain raises a flag',
  safetyFlags(groupCycles(severeLogs), severeLogs).some(f => f.id === 'severe_pain'));
const blockedLogs = [1, 2, 3].map(n => makeCycleLog(d(n), { interference: { work: true, exercise: false, sleep: false, social: false } }));
check('repeatedly being stopped from normal activities raises a flag',
  safetyFlags(groupCycles(blockedLogs), blockedLogs).some(f => f.id === 'repeated_interference'));
const heavyLogs = [1, 2, 3].map(n => makeCycleLog(d(n), { flow: 'heavy' }));
const heavyFlags = safetyFlags(groupCycles(heavyLogs), heavyLogs);
check('repeated heavy flow raises a flag', heavyFlags.some(f => f.id === 'heavy_flow'));
check('the heavy-flow flag mentions iron testing', /iron/i.test(heavyFlags.find(f => f.id === 'heavy_flow').text));
const worseLogs = [
  ...[1, 2].map(n => makeCycleLog(d(n), { pain: 3, interference: { work: false, exercise: false, sleep: false, social: false } })),
  ...[29, 30].map(n => makeCycleLog(d(n), { pain: 9, interference: { work: true, exercise: true, sleep: true, social: true } })),
];
check('a worsening trend across cycles raises a flag',
  safetyFlags(groupCycles(worseLogs), worseLogs).some(f => f.id === 'worsening'));
for (const f of HH.CONCERN_FLAGS) {
  const l = [makeCycleLog(d(1), { concerns: { [f.id]: true } })];
  if (!safetyFlags(groupCycles(l), l).some(x => x.id === `concern_${f.id}`)) {
    check(`an explicit report of "${f.label}" always surfaces`, false); break;
  }
}
check('every explicit red flag surfaces immediately', true);
check('fainting, pain between periods and pain during sex are all reportable',
  ['fainting', 'painBetween', 'painDuringSex'].every(id => HH.CONCERN_FLAGS.some(f => f.id === id)));
check('the safety copy names the conditions it should',
  ['endometriosis', 'adenomyosis', 'fibroids', 'anaemia'].every(w => HH.SAFETY.message.body.toLowerCase().includes(w)));
check('it never implies a lack of discipline',
  /not a discipline problem/i.test(HH.SAFETY.message.reassurance) &&
  /does not mean you did the challenge wrong/i.test(HH.SAFETY.message.reassurance));
check('persistent severe symptoms at completion are detected',
  persistentSymptomsAtCompletion(groupCycles(worseLogs)) === true &&
  persistentSymptomsAtCompletion(cycles) === false);

// ══ Supplements ═════════════════════════════════════════════════════════════
check('no supplement is a task', !tasks.some(t => /magnesium|ginger|omega-3 supplement|iron supplement|creatine/i.test(t.name)));
check('the stance is habits first, food first, supplements optional',
  HH.SUPPLEMENT_EDUCATION.headline === 'Habits first. Food first. Supplements optional.');
check('magnesium, ginger, omega-3 and iron are covered as education',
  ['Magnesium', 'Ginger', 'Omega-3', 'Iron'].every(n => HH.SUPPLEMENT_EDUCATION.items.some(i => i.name === n)));
check('iron education requires confirmed deficiency, not speculation',
  /deficiency is confirmed or clinically indicated/i.test(HH.SUPPLEMENT_EDUCATION.items.find(i => i.name === 'Iron').note));
check('a safety caution about interactions is included',
  /interact with medications/i.test(HH.SUPPLEMENT_EDUCATION.caution));
check('none of it is scored', /none of it is scored/i.test(HH.SUPPLEMENT_EDUCATION.blurb));

// ══ XP weighting ════════════════════════════════════════════════════════════
check('highest tier: sleep, whole food, exercise',
  HH.XP.sleep >= HH.XP.wholeFood && HH.XP.wholeFood === HH.XP.exercise &&
  HH.XP.wholeFood > HH.XP.movement);
check('medium tier: movement, stress, omega-3 sit below the top three',
  [HH.XP.movement, HH.XP.stress, HH.XP.omega3].every(v => v < HH.XP.wholeFood));
check('supporting tier: hydration, iron and the check-in sit lowest',
  [HH.XP.hydration, HH.XP.ironRich, HH.XP.symptomCheckIn].every(v => v <= HH.XP.omega3));
check('the keystone is worth clearly more than the smallest supporting habit',
  HH.XP.sleep >= HH.XP.hydration * 4, `${HH.XP.sleep} vs ${HH.XP.hydration}`);
check('XP values sit on Forge\'s existing scale (keystone 40)', HH.XP.sleep === 40);
check('no separate progression system was introduced — plain task XP', tasks.every(t => typeof t.xp === 'number'));

// ══ Shared habits + compatibility ═══════════════════════════════════════════
check("Muscle Building + Women's Hormone Health = HIGHLY_COMPATIBLE",
  getCompatibility(C.MUSCLE_BUILDING, C.HORMONE_HEALTH).rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('Hormone Health + Mental Training = HIGHLY_COMPATIBLE',
  getCompatibility(C.HORMONE_HEALTH, C.MENTAL_TRAINING).rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('Hormone Health + Sleep Reset = HIGHLY_COMPATIBLE',
  getCompatibility(C.HORMONE_HEALTH, C.SLEEP_RESET).rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('Hormone Health + Fat Loss = CONDITIONAL',
  getCompatibility(C.HORMONE_HEALTH, C.FAT_LOSS).rating === COMPATIBILITY.CONDITIONAL);
check('Hormone Health + Strength = CONDITIONAL',
  getCompatibility(C.HORMONE_HEALTH, C.STRENGTH).rating === COMPATIBILITY.CONDITIONAL);
check('Hormone Health + 75-Day Discipline = CONFLICTING',
  !canStack(C.HORMONE_HEALTH, C.DISCIPLINE_75));
check('every Hormone Health pairing explains itself',
  [C.MENTAL_TRAINING, C.SLEEP_RESET, C.FAT_LOSS, C.STRENGTH, C.MUSCLE_BUILDING, C.RECOVERY]
    .every(id => (getCompatibility(C.HORMONE_HEALTH, id).reason || '').length > 20));

const mtLike = [
  { id: 'mt_mind', name: 'Mental Training — 5 minutes', xp: 100, habitKey: HABIT_KEYS.MEDITATION },
  { id: 'sr_sleep', name: 'Sleep 8.5+ hours', xp: 30, habitKey: HABIT_KEYS.SLEEP_TARGET, target: { value: 8.5, unit: 'hours', direction: 'atLeast' } },
  { id: 'sr_stress', name: 'Wind-down routine', xp: 20, habitKey: HABIT_KEYS.STRESS_RECOVERY },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 20, habitKey: HABIT_KEYS.DAILY_LOG },
];
const { tasks: stacked, merges } = mergeSupportTasks(tasks, mtLike);
check('sleep deduplicates across a stacked pair',
  stacked.filter(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).length === 1);
check('stress recovery deduplicates', stacked.filter(t => habitKeyOf(t) === HABIT_KEYS.STRESS_RECOVERY).length === 1);
check('the shared sleep row takes the stricter 8.5h target',
  stacked.find(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).name === 'Sleep 8.5+ hours');
check('shared rows count toward both challenges',
  ['hh_sleep', 'hh_stress', 'daily_log'].every(id => isSharedTask(stacked.find(t => t.id === id))));
check('no habit is duplicated for XP', new Set(stacked.map(t => t.id)).size === stacked.length);
check('three habits merged, only genuinely new work added',
  merges.length === 3 && stacked.length === tasks.length + 1);
check('sleep stays this challenge\'s keystone after stacking',
  keystoneHabitsOf(tasksForLane(stacked, LANE.PRIMARY)).map(t => t.id).join() === 'hh_sleep');

// ══ Self-contained: no global tracking, no effect on other challenges ══════
check('cycle tracking is scoped to this challenge only',
  tracksCycles(meta) && !tracksCycles({ templateId: 'fat_loss_phase' }) &&
  !tracksCycles({ templateId: 'muscle_building_phase' }));
check('another challenge produces no cycles', groupCycles([]).length === 0);
check('check-ins before Day 1 are excluded from the challenge',
  logsInChallenge([makeCycleLog('2026-07-20'), makeCycleLog(d(2))], START, 5).length === 1);
check('check-ins beyond the current day are excluded',
  logsInChallenge([makeCycleLog(d(2)), makeCycleLog(d(40))], START, 5).length === 1);

// ══ Check-ins never affect XP or scoring ═══════════════════════════════════
const profiles = { p: { challengeStart: START, activeChallenge: meta, tasks, weeklySessions: [], cycleLogs, xpPenalties: false } };
const days = {}; for (let i = 1; i <= 5; i++) days[i] = { dayNumber: i, tasks: {}, isMWD: false, mwdTasks: {}, bonusDone: {} };
const withLogs = computeTotalXP({ p: days }, profiles, 'p', () => 0, 5, 5);
const withoutLogs = computeTotalXP({ p: days }, { p: { ...profiles.p, cycleLogs: [] } }, 'p', () => 0, 5, 5);
check('logging 11 symptom check-ins awards exactly zero XP',
  withLogs.rawTotal === withoutLogs.rawTotal, `${withLogs.rawTotal} vs ${withoutLogs.rawTotal}`);

// ══ Config is centralized and extensible ═══════════════════════════════════
check('the config exposes builders rather than scattering constants',
  typeof HH.buildStartTasks === 'function' && typeof HH.buildChallengeMeta === 'function' &&
  typeof HH.weeklyRequirementDefs === 'function' && typeof HH.defaultSetup === 'function');
check('the attempt carries its own config copy',
  meta.hormoneHealth.sleepHours === HH.SLEEP_TARGET.suggested && meta.hormoneHealth.exercisePerWeek === 3);
check('hhConfig only recognises a Hormone Health attempt',
  HH.hhConfig(meta) !== null && HH.hhConfig({ templateId: 'fat_loss_phase' }) === null);
check('every major requirement has a "why this helps" explanation',
  [HABIT_KEYS.SLEEP_TARGET, HABIT_KEYS.WHOLE_FOODS, HABIT_KEYS.EXERCISE_SESSION, HABIT_KEYS.DAILY_STEPS,
   HABIT_KEYS.STRESS_RECOVERY, HABIT_KEYS.HYDRATION, HABIT_KEYS.OMEGA3_FOODS, HABIT_KEYS.IRON_RICH_FOODS]
    .every(k => (HH.WHY[k] || '').length > 40));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
