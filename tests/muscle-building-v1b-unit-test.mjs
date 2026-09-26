/**
 * Muscle Building V1 update — carbs, protein honesty, specialization, volume
 * ramps, micro-workouts, progression routes, micronutrients, and the
 * fundamentals-vs-optimizations hierarchy.
 *
 * The existing muscle-building suite still covers everything that came before;
 * these checks cover the update and, critically, that an attempt started before
 * it keeps behaving exactly as it did.
 */
import * as MB from '../src/data/muscleBuildingConfig.js';
import { HABIT_KEYS, habitKeyOf } from '../src/data/habitKeys.js';
import {
  weeklyVolume, targetsForWeek, exposuresInWeek, microCounts, makeVolumeEntry, volumeAdherence,
} from '../src/utils/muscleVolume.js';
import {
  classifyProgression, progressionSteps, stallInsight, weeksSinceProgress,
  makeExerciseEntry, groupByExercise, PROGRESSION_ROUTES, DOUBLE_PROGRESSION, STALL_WEEKS,
} from '../src/utils/exerciseLog.js';
import { getCompatibility, canStack, COMPATIBILITY } from '../src/data/challengeCompatibility.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const setup = MB.defaultSetup();
const tasks = MB.buildStartTasks(setup);
const meta = MB.buildChallengeMeta(setup);
const byId = (id, list = tasks) => list.find(t => t.id === id);

// ══ 1. Carbohydrate target ════════════════════════════════════════════════
check('a carbohydrate task exists', !!byId('mb_carbs'));
check('it uses the canonical habitKey carbohydrate_target',
  byId('mb_carbs').habitKey === HABIT_KEYS.CARBOHYDRATE_TARGET &&
  HABIT_KEYS.CARBOHYDRATE_TARGET === 'carbohydrate_target');
check('the three demand ranges match the specification',
  JSON.stringify(MB.CARB_DEMAND_LEVELS.map(l => [l.perLb.min, l.perLb.max])) ===
  JSON.stringify([[0.9, 1.4], [1.4, 1.8], [1.8, 2.3]]));
check('~1.5 g/lb is the default starting reference',
  MB.DEFAULT_CARB_PER_LB === 1.5 && MB.DEFAULT_CARB_DEMAND === 'typical');
check('the default demand level is typical hypertrophy training',
  MB.carbDemandLevel('typical').perLb.suggested === 1.5);
check('carbs scale with bodyweight', MB.suggestedCarbGrams(180, 1.5) === 270);
check('an unknown bodyweight yields no number', MB.suggestedCarbGrams(null) === null);
check('the explanation is the exact specified sentence',
  MB.WHY[HABIT_KEYS.CARBOHYDRATE_TARGET] ===
  'Carbohydrates replenish muscle glycogen and help support high-quality, high-volume resistance training.');
check('it does NOT claim carbs directly cause hypertrophy',
  !/carb\w* (directly )?(cause|build|create)s? (muscle|hypertrophy|growth)/i
    .test(MB.WHY[HABIT_KEYS.CARBOHYDRATE_TARGET]));
check('carbs are customizable at setup', 'carbPerLb' in setup && 'carbDemand' in setup);

// ── Macros must fit inside the calorie target, never be added on top ──────
const roomy = MB.reconcileMacros({ bodyweightLb: 180, calorieTarget: 3000, proteinGrams: 155, carbGrams: 270 });
check('with room to spare, the suggested carb figure passes through',
  roomy.fits && roomy.carb === 270 && !roomy.adjusted);
check('leftover energy is reported as headroom, not stuffed into carbs',
  roomy.headroomKcal > 0);
const tight = MB.reconcileMacros({ bodyweightLb: 180, calorieTarget: 2200, proteinGrams: 155, carbGrams: 270 });
check('when carbs conflict with calories, calorie consistency wins',
  tight.adjusted && tight.carb < tight.suggestedCarb, `${tight.carb} vs ${tight.suggestedCarb}`);
check('the adjusted total never exceeds the calorie target', tight.kcal <= tight.calorieTarget);
check('the user is told why the number moved', /leaves room for about/i.test(tight.note || ''));
check('protein is protected ahead of carbs', tight.protein === 155);
check('adequate fat is protected ahead of carbs',
  tight.fat >= Math.round(180 * MB.FAT_PER_LB.min));
check('the hierarchy is energy → protein → fat → carbs',
  MB.KCAL_PER_G.protein === 4 && MB.KCAL_PER_G.fat === 9 && MB.FAT_PER_LB.min === 0.3);
check('with no calorie target there is nothing to reconcile against',
  MB.reconcileMacros({ bodyweightLb: 180, calorieTarget: null, proteinGrams: 155, carbGrams: 270 }).carb === 270);
const veryTight = MB.reconcileMacros({ bodyweightLb: 180, calorieTarget: 1200, proteinGrams: 155, carbGrams: 270 });
check('an impossible target never produces negative carbs', veryTight.carb >= 0);

// ══ 2. Protein ════════════════════════════════════════════════════════════
check('protein remains the Keystone Habit', byId('mb_protein').keystoneHabit === true);
check('the practical range is 0.8–1.0 g/lb',
  MB.PROTEIN_PER_LB.min === 0.8 && MB.PROTEIN_PER_LB.max === 1.0);
check('the habitKey is unchanged', byId('mb_protein').habitKey === HABIT_KEYS.PROTEIN_TARGET);
check('0.8–0.9 is described as generally sufficient',
  /0\.8–0\.9 g\/lb is generally enough/i.test(MB.PROTEIN_PER_LB.note));
check('1.0 g/lb is described as margin, not more anabolic',
  /adds margin rather than extra growth/i.test(MB.PROTEIN_PER_LB.note));
check('going meaningfully above 1 g/lb is explicitly not encouraged',
  /above 1 g\/lb is not recommended/i.test(MB.PROTEIN_PER_LB.note));
check('no copy implies more protein is more anabolic',
  !/more protein.*(more|better).*(anabolic|growth)/i.test(
    MB.PROTEIN_PER_LB.note + MB.WHY[HABIT_KEYS.PROTEIN_TARGET]));
check('the default suggestion sits inside the range',
  MB.PROTEIN_PER_LB.suggested >= 0.8 && MB.PROTEIN_PER_LB.suggested <= 1.0);
check('the protein task surfaces the honesty note', /adds margin/i.test(byId('mb_protein').desc));

// ══ 3. Protein distribution ═══════════════════════════════════════════════
const dist = MB.OPTIMIZATION_HABITS.find(h => h.habitKey === HABIT_KEYS.PROTEIN_DISTRIBUTION);
check('protein distribution stays an OPTIONAL optimization',
  !!dist && !setup.optimizations.proteinDistribution);
check('it recommends 3–4 substantial feedings', /3–4 substantial/i.test(dist.desc));
check('it advises against most protein in one meal', /rather than most of it in one meal/i.test(dist.desc));
const distWhy = MB.WHY[HABIT_KEYS.PROTEIN_DISTRIBUTION];
check('leucine is mentioned as typical, not tracked', /roughly 2–3\+ g of leucine/i.test(distWhy));
check('manual leucine tracking is explicitly NOT required',
  /you do not need to track that/i.test(distWhy));
check('leucine is explicitly NOT a binary threshold',
  /not an on\/off threshold/i.test(distWhy));
check('no large hypertrophy advantage is claimed when total protein is sufficient',
  /a small refinement, not a large advantage/i.test(distWhy));

// ══ 4-6. Specialization Mode ══════════════════════════════════════════════
check('setup asks the exact specialization question',
  MB.SPECIALIZATION.question === 'Do you want to prioritize specific muscles?');
check('both options are offered with the specified labels',
  MB.SPECIALIZATION.options.map(o => o.label).join(' | ') ===
  'No — Balanced Muscle Growth | Yes — Specialization Block');
check('balanced is the default', setup.specialization.enabled === false);
check('at most TWO priority muscles', MB.SPECIALIZATION.maxPriority === 2);
const choices = MB.specializationChoices().map(c => c.id);
for (const g of ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'])
  check(`selectable muscle group: ${g}`, choices.includes(g));
check('the explanation is the exact specified sentence',
  MB.SPECIALIZATION.explanation ===
  'Specialization gives priority muscles more of your recoverable training volume while other muscles receive enough work to maintain or progress more slowly.');
check('it refuses to imply extra whole-body growth',
  /does not add whole-body muscle beyond what your biology allows/i.test(MB.SPECIALIZATION.honesty));
check('it states the trade explicitly', /the rest get less/i.test(MB.SPECIALIZATION.honesty));
check('6–8 weeks is the recommended block length',
  MB.SPECIALIZATION.recommendedWeeks.min === 6 && MB.SPECIALIZATION.recommendedWeeks.max === 8);
check('a longer challenge is not forced to end the block',
  /If your challenge runs longer, that is fine/i.test(MB.SPECIALIZATION.durationNote));

// ── Volume ────────────────────────────────────────────────────────────────
check('priority volume starts in the 12–16 range',
  MB.SPECIALIZATION.prioritySets.min === 12 && MB.SPECIALIZATION.prioritySets.max === 16);
check('16 sets is NOT hard-coded as the optimum',
  MB.SPECIALIZATION.prioritySets.suggested < 16);
check('the lowest effective volume is favoured, not the maximum',
  /LOWEST volume that keeps you progressing/i.test(MB.SPECIALIZATION.lowestEffectiveNote) &&
  /no prize for doing 16/i.test(MB.SPECIALIZATION.lowestEffectiveNote));
const specTargets = MB.specializationTargets({ priority: ['chest', 'abs'], prioritySets: 13 });
check('priority muscles get the priority target',
  specTargets.chest === 13 && specTargets.abs === 13);
check('non-priority muscles drop to maintenance, not to zero',
  specTargets.back > 0 && specTargets.back < 10, String(specTargets.back));
check('maintenance never falls below the floor',
  Object.entries(specTargets).filter(([k]) => !['chest', 'abs'].includes(k))
    .every(([, v]) => v >= MB.SPECIALIZATION.minMaintenanceSets));
check('priority volume is customizable',
  MB.specializationTargets({ priority: ['chest'], prioritySets: 15 }).chest === 15);

// ── Gradual progression ───────────────────────────────────────────────────
const ramp = MB.volumeRamp({ current: 6, target: 13, weeks: 8 });
check('a user on 6 sets is NOT jumped straight to the target', ramp[0].sets < 13);
check('the ramp matches the worked example (10,10,11,11,12,12,13,13)',
  ramp.map(r => r.sets).join(',') === '10,10,11,11,12,12,13,13');
check('the ramp reaches the target by the end of the block',
  ramp[ramp.length - 1].sets === 13);
check('the ramp never exceeds the target', ramp.every(r => r.sets <= 13));
check('the ramp never drops below where the user started', ramp.every(r => r.sets >= 6));
check('someone already at the target simply stays there',
  MB.volumeRamp({ current: 13, target: 13, weeks: 8 }).every(r => r.sets === 13));
check('someone already above the target is not cut',
  MB.volumeRamp({ current: 16, target: 13, weeks: 8 }).every(r => r.sets >= 16));
check('rampedTarget reads one week out of the ramp',
  MB.rampedTarget({ current: 6, target: 13, weeks: 8, week: 1 }) === 10 &&
  MB.rampedTarget({ current: 6, target: 13, weeks: 8, week: 8 }) === 13);

// ── Frequency ─────────────────────────────────────────────────────────────
check('priority volume is spread across 2–3 weekly exposures',
  MB.SPECIALIZATION.exposures.min === 2 && MB.SPECIALIZATION.exposures.max === 3);
check('the 5+3+5 = 13 illustration is present and marked as an example',
  /5 \+ 3 \+ 5/.test(MB.SPECIALIZATION.exposureNote) &&
  /an illustration, not a prescription/i.test(MB.SPECIALIZATION.exposureNote));

// ══ 7. Micro-workouts ═════════════════════════════════════════════════════
check('a micro-workout with real work counts',
  microCounts(makeVolumeEntry('chest', 3, '2026-09-20', { micro: true })));
check('a single token set does NOT count',
  !microCounts(makeVolumeEntry('chest', 1, '2026-09-20', { micro: true })));
check('ordinary sessions are never filtered',
  microCounts(makeVolumeEntry('chest', 1, '2026-09-20')));
check('the minimum is 2 sets', MB.MICRO_WORKOUTS.minSetsToCount === 2);
check('micro-workouts share the SAME weekly budget',
  /SAME weekly volume budget/i.test(MB.MICRO_WORKOUTS.honesty) &&
  /they do not add to it/i.test(MB.MICRO_WORKOUTS.honesty));
check('meaningless daily pump work is explicitly not rewarded',
  /Easy daily pump work does not count/i.test(MB.MICRO_WORKOUTS.honesty));
check('the goal is stated as distributing, not adding, volume',
  /distribute productive volume across the week, not to accumulate more/i.test(MB.MICRO_WORKOUTS.honesty));

// ══ 8. Progressive overload ═══════════════════════════════════════════════
check('progression is not defined as adding weight every workout',
  PROGRESSION_ROUTES.length >= 5 &&
  PROGRESSION_ROUTES.some(r => r.id === 'reps') && PROGRESSION_ROUTES.some(r => r.id === 'load') &&
  PROGRESSION_ROUTES.some(r => r.id === 'sets') && PROGRESSION_ROUTES.some(r => r.id === 'execution') &&
  PROGRESSION_ROUTES.some(r => r.id === 'rir'));
const E = (load, reps, sets = 3, date = '2026-09-01', rir) =>
  makeExerciseEntry({ exercise: 'incline press', load, reps, sets, rir, date });
check('more reps at the same load is progression',
  classifyProgression(E(60, 8), E(60, 9)) === 'reps');
check('more load at comparable reps is progression',
  classifyProgression(E(60, 12), E(65, 11)) === 'load');
check('a load jump that costs reps (double progression reset) still counts',
  classifyProgression(E(60, 12), E(65, 8)) === 'load', String(classifyProgression(E(60, 12), E(65, 8))));
check('an extra productive set is progression',
  classifyProgression(E(60, 10, 3), E(60, 10, 4)) === 'sets');
check('the same work at a higher RIR is progression',
  classifyProgression(E(60, 10, 3, '2026-09-01', 1), E(60, 10, 3, '2026-09-08', 3)) === 'rir');
check('an identical session is not progression',
  classifyProgression(E(60, 10), E(60, 10)) === null);
check('a genuine regression is not progression',
  classifyProgression(E(60, 10), E(55, 8)) === null);

// The full double-progression walk from the specification.
const walk = [
  E(60, 8, 3, '2026-09-01'), E(60, 9, 3, '2026-09-08'), E(60, 10, 3, '2026-09-15'),
  E(60, 12, 3, '2026-09-22'), E(65, 8, 3, '2026-09-29'),
];
const steps = progressionSteps({ entries: walk });
check('every step of 60×8 → 60×9 → 60×10 → 60×12 → 65×8 is successful progression',
  steps.length === 4, `${steps.length} of 4 — ${steps.map(s => s.route).join(',')}`);
check('the final step is recognised as a LOAD progression',
  steps[steps.length - 1]?.route === 'load');
check('double progression is taught with that exact example',
  DOUBLE_PROGRESSION.example.join(' → ') === '60 lb × 8 → 60 lb × 9 → 60 lb × 10 → 60 lb × 12 → 65 lb × 8');
check('it says plainly that a flat week is not a failure',
  /not failing a week because the bar did not move/i.test(DOUBLE_PROGRESSION.note));

// ── Stall insight ─────────────────────────────────────────────────────────
check('the stall window is 3–4 weeks', STALL_WEEKS === 3);
const flat = [];
for (let w = 0; w < 8; w++) {
  const d = new Date('2026-09-01T00:00:00'); d.setDate(d.getDate() + w * 7);
  const date = d.toISOString().slice(0, 10);
  flat.push(makeExerciseEntry({ exercise: 'bench', load: 100, reps: 8, sets: 3, date }));
  flat.push(makeExerciseEntry({ exercise: 'row', load: 100, reps: 8, sets: 3, date }));
}
const stalled = stallInsight({ entries: flat, challengeStart: '2026-09-01', todayDate: '2026-10-20' });
check('a genuinely flat block produces the stall insight', !!stalled);
check('the wording is the specified sentence',
  stalled?.text === 'Performance has stalled. Review training volume, nutrition, sleep, and recovery.');
const progressing = [];
for (let w = 0; w < 8; w++) {
  const d = new Date('2026-09-01T00:00:00'); d.setDate(d.getDate() + w * 7);
  const date = d.toISOString().slice(0, 10);
  progressing.push(makeExerciseEntry({ exercise: 'bench', load: 100, reps: 8 + w, sets: 3, date }));
  progressing.push(makeExerciseEntry({ exercise: 'row', load: 100, reps: 8 + w, sets: 3, date }));
}
check('a progressing block does NOT trigger a stall',
  !stallInsight({ entries: progressing, challengeStart: '2026-09-01', todayDate: '2026-10-20' }));
check('too little history stays quiet rather than guessing',
  !stallInsight({ entries: flat.slice(0, 2), challengeStart: '2026-09-01', todayDate: '2026-10-20' }));
check('one flat lift among many does not trigger a stall',
  !stallInsight({ entries: [...progressing, ...flat.filter(e => e.exercise === 'bench')], challengeStart: '2026-09-01', todayDate: '2026-10-20' }));

// ══ 9. Stimulus quality, exercise selection, rest ═════════════════════════
check('0–3 RIR remains the general guidance',
  MB.RIR_GUIDANCE.rirRange[0] === 0 && MB.RIR_GUIDANCE.rirRange[1] === 3);
check('failure is not required', /do not need to take every set to absolute failure/i.test(MB.RIR_GUIDANCE.body));
for (const k of ['Controlled execution', 'range of motion', 'stable', 'tension'])
  check(`stimulus quality teaches: ${k}`, new RegExp(k, 'i').test(MB.STIMULUS_QUALITY.items.join(' ')));
check('degrading technique for load is called out as not progression',
  /degrading technique is not progression/i.test(MB.STIMULUS_QUALITY.items.join(' ')));
check('none of this becomes a daily checkbox',
  !tasks.some(t => /rir|range of motion|execution|rest|tempo/i.test(t.name)));
for (const k of ['stable', 'progressively overloaded', 'tension', 'range of motion', 'longer muscle lengths'])
  check(`exercise selection teaches: ${k}`, new RegExp(k, 'i').test(MB.EXERCISE_SELECTION.items.join(' ')));
check('exotic exercises are explicitly not required', /Nothing exotic is required/i.test(MB.EXERCISE_SELECTION.note));
check('specialization encourages multiple movement patterns',
  /two or three useful movement patterns/i.test(MB.EXERCISE_SELECTION.specializationNote) &&
  /an example, not a requirement/i.test(MB.EXERCISE_SELECTION.specializationNote));
check('rest guidance allows ~2+ minutes on compounds', /2\+ minutes/i.test(MB.REST_GUIDANCE.body));
check('no universal 60-second rule is imposed', /no universal 60-second rule/i.test(MB.REST_GUIDANCE.note));
check('rest is not timed or scored', /does not time your rest or score it/i.test(MB.REST_GUIDANCE.note));
check('no rest-timer habit was created', !tasks.some(t => /rest/i.test(t.name)));

// ══ 12. Micronutrient coverage ════════════════════════════════════════════
const micro = MB.OPTIMIZATION_HABITS.find(h => h.habitKey === HABIT_KEYS.MICRONUTRIENT_COVERAGE);
check('micronutrient coverage exists as an optimization', !!micro);
check('it uses the canonical habitKey',
  HABIT_KEYS.MICRONUTRIENT_COVERAGE === 'micronutrient_coverage');
check('it is OPTIONAL and off by default', setup.optimizations.micronutrients === false);
check('it is ONE habit, not a task per nutrient',
  MB.OPTIMIZATION_HABITS.filter(h => /vitamin|mineral|zinc|iron|magnesium/i.test(h.name)).length === 0);
const names = MB.MICRONUTRIENTS.nutrients.map(n => n.name).join(' ');
for (const n of ['Vitamin D', 'Magnesium', 'Zinc', 'Iron', 'Calcium', 'Potassium', 'folate', 'B12', 'B6', 'Sodium', 'Vitamin C', 'Selenium', 'Iodine'])
  check(`micronutrient listed: ${n}`, new RegExp(n.replace(/[()]/g, ''), 'i').test(names));
check('every nutrient names food sources', MB.MICRONUTRIENTS.nutrients.every(n => !!n.sources));
check('the goal is adequacy over time, not 100% of every RDA daily',
  /not 100% of every RDA every day/i.test(micro.desc));
check('deficiency is framed as a bottleneck', /can become a bottleneck/i.test(MB.MICRONUTRIENTS.honesty));
check('more than adequate is explicitly NOT more hypertrophy',
  /does not add hypertrophy/i.test(MB.MICRONUTRIENTS.honesty) &&
  /more is not better/i.test(MB.MICRONUTRIENTS.honesty));
check('megadosing is explicitly discouraged', /megadosing is not an optimization/i.test(MB.MICRONUTRIENTS.honesty));
check('food first is the stated default', /Food first/i.test(MB.MICRONUTRIENTS.foodFirst));
check('supplementation earns only small XP', MB.XP.micronutrients <= 8);

// ══ 13. Creatine ══════════════════════════════════════════════════════════
const creatine = MB.OPTIMIZATION_HABITS.find(h => h.habitKey === HABIT_KEYS.CREATINE);
check('creatine stays optional and off by default', !!creatine && !setup.optimizations.creatine);
check('3–5 g/day with no loading phase', /3–5 g per day/.test(creatine.desc) && /No loading phase/i.test(creatine.desc));
check('creatine never outweighs a fundamental',
  MB.XP.creatine < Math.min(MB.XP.protein, MB.XP.training, MB.XP.nutrition, MB.XP.carbs, MB.XP.sleep));

// ══ 14. Glycogen education ════════════════════════════════════════════════
check('the glycogen explanation is the specified wording',
  MB.GLYCOGEN_EDUCATION.body ===
  'Muscle glycogen stores carbohydrate inside muscle. Glycogen is stored with water, which can contribute to a fuller muscular appearance. Adequate carbohydrate availability can also support high-quality resistance training.');
check('glycogen water is explicitly NOT presented as new muscle',
  /not new muscle tissue/i.test(MB.GLYCOGEN_EDUCATION.caveat));
check('early bodyweight gain from carbs is explained',
  /partly reflects glycogen and water/i.test(MB.GLYCOGEN_EDUCATION.caveat));

// ══ 15. Stress / recovery ═════════════════════════════════════════════════
const recovery = byId('mb_recovery');
check('Daily Recovery Practice is kept', !!recovery);
check('it is never called "lower cortisol"',
  !/lower cortisol|reduce cortisol/i.test(`${recovery.name} ${recovery.desc} ${MB.WHY[HABIT_KEYS.STRESS_RECOVERY]}`));
check('the goal is chronic stress and returning to baseline',
  /chronic psychological stress/i.test(MB.WHY[HABIT_KEYS.STRESS_RECOVERY]) &&
  /return to a relaxed baseline/i.test(MB.WHY[HABIT_KEYS.STRESS_RECOVERY]));
check('cortisol is explicitly not framed as bad',
  /normal, appropriate part of adapting/i.test(MB.WHY[HABIT_KEYS.STRESS_RECOVERY]));
for (const o of ['Meditation', 'breathing', 'NSDR', 'walk', 'Prayer'])
  check(`recovery accepts: ${o}`, new RegExp(o, 'i').test(MB.RECOVERY_PRACTICE.options.join(' ')));

// ══ 16. Optimization hierarchy ════════════════════════════════════════════
for (const k of [HABIT_KEYS.HYPERTROPHY_TRAINING, HABIT_KEYS.PROTEIN_TARGET, HABIT_KEYS.CALORIE_TARGET, HABIT_KEYS.CARBOHYDRATE_TARGET, HABIT_KEYS.SLEEP_TARGET])
  check(`classified as a FUNDAMENTAL: ${k}`, MB.isFundamental(k));
for (const k of [HABIT_KEYS.CREATINE, HABIT_KEYS.PROTEIN_DISTRIBUTION, HABIT_KEYS.MICRONUTRIENT_COVERAGE])
  check(`classified as an OPTIMIZATION: ${k}`, !MB.isFundamental(k) && MB.OPTIMIZATION_KEYS.includes(k));
const optXP = [MB.XP.creatine, MB.XP.proteinDistribution, MB.XP.micronutrients];
const fundXP = [MB.XP.protein, MB.XP.training, MB.XP.nutrition, MB.XP.carbs, MB.XP.sleep];
check('every optimization is priced below the cheapest fundamental',
  Math.max(...optXP) < Math.min(...fundXP), `${Math.max(...optXP)} < ${Math.min(...fundXP)}`);
check('all optimizations together are worth less than one keystone day',
  optXP.reduce((a, b) => a + b, 0) < MB.XP.protein);

// Perfect optionals, poor fundamentals → called out, not rewarded.
const allTasks = MB.buildStartTasks({ ...setup, bodyweightLb: 180, optimizations: { proteinDistribution: true, creatine: true, micronutrients: true } });
const daysBad = {};
for (let n = 1; n <= 14; n++) {
  daysBad[n] = { tasks: Object.fromEntries(allTasks.map(t => [t.id, MB.OPTIMIZATION_KEYS.includes(t.habitKey)])) };
}
const bad = MB.hierarchyBreakdown({ tasks: allTasks, days: daysBad, upto: 14 });
check('perfect optional adherence is measured separately', bad.optimizations.pct === 100);
check('poor fundamentals are measured separately', bad.fundamentals.pct === 0);
check('weak fundamentals are flagged', bad.weakFundamentals === true);
check('optional adherence masking poor basics is detected', bad.masking === true);
check('the message names both numbers and says what actually moves this',
  /optional habits are at 100%/i.test(bad.message) && /training, protein, energy and sleep/i.test(bad.message));
const daysGood = {};
for (let n = 1; n <= 14; n++) daysGood[n] = { tasks: Object.fromEntries(allTasks.map(t => [t.id, true])) };
const good = MB.hierarchyBreakdown({ tasks: allTasks, days: daysGood, upto: 14 });
check('strong fundamentals are not flagged', good.weakFundamentals === false && good.masking === false);
check('the hierarchy rule is stated for the user',
  /perfect creatine with poor training and protein is not a good/i.test(MB.HIERARCHY.rule));

// ══ 17. Deliberately NOT added ════════════════════════════════════════════
const allCopy = JSON.stringify(MB);
for (const banned of ['sauna', 'nitrate', 'flavanol', 'nitric oxide', 'testosterone booster', 'BCAA', 'pre-workout'])
  check(`not added: ${banned}`, !new RegExp(banned, 'i').test(allCopy));
check('no cold-exposure habit was added to Muscle Building',
  !tasks.some(t => /cold/i.test(t.name)) && !MB.OPTIMIZATION_HABITS.some(h => /cold/i.test(h.name)));
check('no pump-for-blood-flow habit was added', !tasks.some(t => /pump/i.test(t.name)));

// ══ 19. Specialization progress checks ════════════════════════════════════
check('checkpoints are Day 0, 2, 4, 6 and 8 weeks',
  JSON.stringify(MB.SPECIALIZATION_CHECKPOINTS) === '[0,14,28,42,56]');
check('a 6-week block stops at week 6',
  JSON.stringify(MB.checkpointDays(6)) === '[0,14,28,42]');
for (const c of ['lighting', 'pose', 'camera distance', 'time of day', 'pumped'])
  check(`photo condition: ${c}`, new RegExp(c, 'i').test(MB.PHOTO_CONDITIONS.items.join(' ')));
check('UNPUMPED is the default for hypertrophy comparisons',
  MB.PHOTO_CONDITIONS.defaultState === 'unpumped' && /Default to UNPUMPED/i.test(MB.PHOTO_CONDITIONS.note));
check('visual fullness is not claimed to be new tissue',
  /not proof of new muscle tissue/i.test(MB.PHOTO_CONDITIONS.honesty));
check('circumference measurements are available',
  MB.MEASUREMENTS.some(m => m.id === 'chest') && MB.MEASUREMENTS.some(m => m.id === 'arms') &&
  MB.MEASUREMENTS.some(m => m.id === 'thighs') && MB.MEASUREMENTS.some(m => m.id === 'waist'));

// ══ 20. Primary + Support compatibility ═══════════════════════════════════
const MBID = MB.MUSCLE_BUILDING_TEMPLATE_ID;
check('MB + Mental Training stays HIGHLY_COMPATIBLE',
  getCompatibility(MBID, 'mental_training_phase').rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('MB + Sleep Reset stays HIGHLY_COMPATIBLE',
  getCompatibility(MBID, 'sleep_reset_challenge').rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('MB + Hormone Health stays HIGHLY_COMPATIBLE',
  getCompatibility(MBID, 'womens_hormone_health').rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('MB + Fat Loss stays CONFLICTING',
  getCompatibility(MBID, 'fat_loss_phase').rating === COMPATIBILITY.CONFLICTING);
check('MB + Strength stays CONDITIONAL',
  getCompatibility(MBID, 'strength_phase').rating === COMPATIBILITY.CONDITIONAL);
check('every task still carries a canonical habitKey for dedup',
  allTasks.every(t => !!habitKeyOf(t)));
check('the new habits use canonical keys other challenges can match',
  allTasks.find(t => t.id === 'mb_carbs').habitKey === HABIT_KEYS.CARBOHYDRATE_TARGET &&
  allTasks.find(t => t.id === 'mb_micronutrients').habitKey === HABIT_KEYS.MICRONUTRIENT_COVERAGE);
check('no duplicate habitKey inside one Muscle Building list',
  new Set(allTasks.map(t => t.habitKey)).size === allTasks.length);

// ══ 21. The daily screen stays small ══════════════════════════════════════
check('the default daily list stays short', tasks.length <= 7, `${tasks.length} tasks`);
check('even with every optimization on it stays manageable',
  allTasks.length <= 9, `${allTasks.length} tasks`);
check('specialization adds NO daily tasks',
  MB.buildStartTasks({ ...setup, specialization: { enabled: true, priority: ['chest', 'abs'], prioritySets: 13 } }).length === tasks.length);
check('no per-muscle daily checkbox was created',
  !tasks.some(t => /chest|back|quads|biceps/i.test(t.name)));

// ══ 22/13. Backward compatibility ═════════════════════════════════════════
// An attempt started BEFORE this update: no carb fields, no specialization.
const legacyMeta = {
  templateId: MBID, durationDays: 60,
  muscleBuilding: {
    trainingDaysPerWeek: 4, bodyweightLb: 180, proteinPerLb: 0.85, proteinGrams: 155,
    nutritionMode: 'lean_bulk', calorieTarget: null, sleepHours: 8,
    volumeTargets: { chest: 10, back: 10, quads: 10 },
    optimizations: { proteinDistribution: true, creatine: false },
    measurements: { weight: true }, gainRateMin: 0.1, gainRateMax: 0.3,
  },
  weeklyRequirementDefs: [MB.trainingRequirementDef(4)],
};
check('a legacy attempt is still recognised as Muscle Building', MB.isMuscleBuilding(legacyMeta));
check('a legacy attempt resolves its config', !!MB.mbConfig(legacyMeta));
check('a legacy attempt is NOT specializing', !MB.isSpecializing(MB.mbConfig(legacyMeta)));
check('a legacy attempt has no priority muscles', MB.priorityMuscles(MB.mbConfig(legacyMeta)).length === 0);
check('legacy volume targets are returned unchanged',
  targetsForWeek(legacyMeta, 3).chest === 10 && targetsForWeek(legacyMeta, 3).back === 10);
const legacyVol = weeklyVolume({
  entries: [makeVolumeEntry('chest', 8, '2026-09-16')],
  meta: legacyMeta, challengeStart: '2026-09-15', rawDay: 3,
});
check('legacy volume still computes', legacyVol.supported === true);
check('legacy attempts render as non-specializing', legacyVol.specializing === false);
check('legacy attempts have no priority rows', legacyVol.priorityRows.length === 0);
check('every legacy row still reports done/target', legacyVol.rows.every(r => 'done' in r && 'target' in r));
check('legacy adherence still computes',
  volumeAdherence({ entries: [], meta: legacyMeta, challengeStart: '2026-09-15', rawDay: 20 }) !== undefined);
check('the unsupported path returns the same shape (no crash on priorityRows)',
  Array.isArray(weeklyVolume({ entries: [], meta: {}, challengeStart: null, rawDay: null }).priorityRows));
check('a legacy attempt gains no new required task mid-challenge — its stored tasks are untouched',
  !('carbGrams' in MB.mbConfig(legacyMeta)));

// ── A new specialization attempt behaves correctly end to end ─────────────
const specMeta = MB.buildChallengeMeta({
  ...setup, bodyweightLb: 180, durationDays: 60,
  specialization: { enabled: true, priority: ['chest', 'abs'], prioritySets: 13, exposures: 3, weeks: 8, currentSets: { chest: 6 } },
});
const scfg = MB.mbConfig(specMeta);
check('the attempt stores its specialization block', MB.isSpecializing(scfg));
check('it stores at most two priority muscles', scfg.specialization.priority.length === 2);
check('more than two are truncated',
  MB.mbConfig(MB.buildChallengeMeta({ ...setup, specialization: { enabled: true, priority: ['chest', 'abs', 'back', 'quads'] } }))
    .specialization.priority.length === 2);
check('volume targets were reallocated toward the priority muscles',
  scfg.volumeTargets.chest === 13 && scfg.volumeTargets.abs === 13 && scfg.volumeTargets.back < 10);
check('the pre-block baseline is preserved for restoring later',
  scfg.baseVolumeTargets.back === 10);
check('week 1 asks for the ramped figure, not the block target',
  targetsForWeek(specMeta, 1).chest === 10);
check('the final block week asks for the full target',
  targetsForWeek(specMeta, 8).chest === 13);
check('a priority muscle with no recorded starting point uses the block target',
  targetsForWeek(specMeta, 1).abs === 13);
const specVol = weeklyVolume({
  entries: [
    makeVolumeEntry('chest', 5, '2026-09-15'),
    makeVolumeEntry('chest', 3, '2026-09-17', { micro: true }),
    makeVolumeEntry('chest', 1, '2026-09-18', { micro: true }),
  ],
  meta: specMeta, challengeStart: '2026-09-15', rawDay: 4,
});
check('the dashboard exposes priority rows first', specVol.priorityRows.map(r => r.id).sort().join(',') === 'abs,chest');
check('non-priority muscles are separated out', specVol.otherRows.every(r => !r.priority));
check('micro-workout sets count toward the same weekly total',
  specVol.rows.find(r => r.id === 'chest').done === 8, String(specVol.rows.find(r => r.id === 'chest').done));
check('the token 1-set micro was excluded',
  specVol.rows.find(r => r.id === 'chest').microSets === 3);
check('training exposures are counted from distinct days',
  specVol.rows.find(r => r.id === 'chest').exposures === 2);
check('the exposure target is reported for priority muscles only',
  specVol.rows.find(r => r.id === 'chest').exposureTarget === 3 &&
  specVol.rows.find(r => r.id === 'back').exposureTarget === null);
check('exposuresInWeek counts days, not entries',
  exposuresInWeek([
    makeVolumeEntry('chest', 3, '2026-09-15'), makeVolumeEntry('chest', 3, '2026-09-15'),
  ], 'chest') === 1);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
