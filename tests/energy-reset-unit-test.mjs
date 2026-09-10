/**
 * ⚡ Energy Reset — challenge definition, the four durations, and energy math.
 *
 * Covers the XP importance ladder, the daily/weekly split, shared-habit identity
 * (so overlapping behaviours merge instead of paying twice), the before/after
 * energy comparison including every missing-data edge case, and the association
 * patterns — which must never be phrased as causation.
 */
import * as ER from '../src/data/energyResetConfig.js';
import {
  ENERGY_FIELDS, ENERGY_KEYS, ratingOf, hasEnergyData, averageEnergy, ratedDays,
  pctChange, normalizeBaseline, energyComparison, energyAssociations,
  buildEnergySummary, WINDOW_SIZE, MIN_RATED_DAYS, ASSOCIATION_MIN,
  effectiveWindow, weeklyEnergyTrajectory,
} from '../src/utils/energyTracking.js';
import { HABIT_KEYS, habitKeyOf, isSameHabit, stricterOf } from '../src/data/habitKeys.js';
import { getTemplateById, CHALLENGE_TEMPLATES } from '../src/data/challengeTemplates.js';
import { getCompatibility, canStack, COMPATIBILITY } from '../src/data/challengeCompatibility.js';
import { hasWeeklyRequirements, getWeeklyRequirementDefs, challengeWeeks, targetForWeek } from '../src/utils/weeklyRequirements.js';
import {
  getDurationOptions, getDefaultDuration, getDurationLabel, isRecommendedDuration,
  getCompletionBonusForDuration,
} from '../src/data/challengeTemplates.js';
import { mergeSupportTasks } from '../src/utils/challengeStack.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const meta = ER.buildChallengeMeta();
const tasks = ER.buildStartTasks();
const weekly = ER.weeklyRequirementDefs();

// ══ Identity and template registration ═════════════════════════════════════
check('the challenge is named Energy Reset', ER.IDENTITY.name === 'Energy Reset');
check('its identity is the lightning bolt', ER.IDENTITY.emoji === '⚡');
check('the goal sentence is phrased for the chosen length',
  ER.goalFor(10) === '10 days to wake up sharper, reduce energy crashes, and feel consistently energized throughout the day.' &&
  ER.goalFor(30) === '30 days to wake up sharper, reduce energy crashes, and feel consistently energized throughout the day.');
check('the library card shows the recommended length\'s goal',
  ER.IDENTITY.goal === ER.goalFor(ER.DEFAULT_DURATION));
const tpl = getTemplateById(ER.ENERGY_RESET_TEMPLATE_ID);
check('it is registered in the challenge library', !!tpl && tpl.startable === true);
check('it uses the existing configured start flow', tpl.start_flow === 'configured');
check('it is among the shortest challenges in the library',
  Math.min(...CHALLENGE_TEMPLATES.filter(t => t.startable)
    .map(t => Math.min(...(t.duration_options_days || [999])))) <= 7);

// ══ The four durations ═════════════════════════════════════════════════════
check('it is NOT exclusively a 10-day challenge', ER.DURATIONS.length === 4);
check('the four lengths are 7, 10, 14 and 30 days',
  JSON.stringify(ER.DURATIONS) === '[7,10,14,30]');
check('7 days is labelled Quick Reset', ER.DURATION_LABELS[7] === 'Quick Reset');
check('10 days is labelled Standard Reset', ER.DURATION_LABELS[10] === 'Standard Reset');
check('14 days is labelled Full Reset', ER.DURATION_LABELS[14] === 'Full Reset');
check('30 days is labelled Energy Maxing', ER.DURATION_LABELS[30] === 'Energy Maxing');
check('10 days is the recommended default', ER.DEFAULT_DURATION === 10 && meta.durationDays === 10);
const blurbOf = (d) => ER.durationOption(d).blurb;
check('7-day blurb is the exact specified sentence',
  blurbOf(7) === 'A short intervention focused on immediately improving daily habits and energy.');
check('10-day blurb is the exact specified sentence',
  blurbOf(10) === 'The recommended default. Long enough to potentially notice a meaningful change while remaining very easy to commit to.');
check('14-day blurb is the exact specified sentence',
  blurbOf(14) === 'Allows more time for sleep consistency, nutrition, exercise, circadian habits, and energy patterns to stabilize.');
check('30-day blurb is the exact specified sentence',
  blurbOf(30) === 'The deepest version. Designed for users who want to optimize their energy habits, build consistency, and collect enough data for stronger personalized insights.');
check('every duration explains what it is for', ER.DURATION_OPTIONS.every(o => !!o.detail && o.detail.length > 30));
check('an unknown duration falls back to the recommended one',
  ER.durationOption(99).days === ER.DEFAULT_DURATION && ER.buildChallengeMeta({ durationDays: 99 }).durationDays === 10);

// ── It uses Forge's EXISTING per-template duration architecture ────────────
check('the template opts into the shared duration system',
  JSON.stringify(getDurationOptions(tpl)) === JSON.stringify(ER.DURATIONS));
check('the shared default helper resolves 10 days', getDefaultDuration(tpl) === 10);
check('the shared label helper resolves each name',
  getDurationLabel(tpl, 7) === 'Quick Reset' && getDurationLabel(tpl, 30) === 'Energy Maxing');
check('the shared recommended helper marks 10 days, and only 10 days',
  isRecommendedDuration(tpl, 10) && ER.DURATIONS.filter(d => isRecommendedDuration(tpl, d)).length === 1);
check('the shared completion-bonus helper reads the per-duration table',
  ER.DURATIONS.every(d => getCompletionBonusForDuration(tpl, d) === ER.COMPLETION_BONUS_BY_DURATION[d]));

// ── XP grows with length, without demoting the shorter programs ───────────
check('longer durations award a greater completion reward',
  ER.DURATIONS.every((d, i) => i === 0 ||
    ER.COMPLETION_BONUS_BY_DURATION[d] > ER.COMPLETION_BONUS_BY_DURATION[ER.DURATIONS[i - 1]]),
  JSON.stringify(ER.COMPLETION_BONUS_BY_DURATION));
check('every duration carries a real completion reward',
  ER.DURATIONS.every(d => ER.COMPLETION_BONUS_BY_DURATION[d] > 0));
check('the attempt stores the bonus for the length actually chosen',
  ER.DURATIONS.every(d => ER.buildChallengeMeta({ durationDays: d }).completionBonusXP === ER.COMPLETION_BONUS_BY_DURATION[d]));
check('no completion message calls a shorter run inferior, failed or partial',
  ER.DURATIONS.every(d => !/inferior|failed|only a|just a|lesser|incomplete|partial/i.test(
    Object.values(ER.completionMessage(d)).join(' '))));
check('the 7-day message states plainly it is a finished challenge',
  /finished Energy Reset — not a short version of one/i.test(ER.completionMessage(7).body));
check('every duration has its own completion messaging',
  new Set(ER.DURATIONS.map(d => ER.completionMessage(d).title)).size === 4);
check('completion titles name the program the user chose',
  ER.DURATIONS.every(d => ER.completionMessage(d).title.includes(ER.DURATION_LABELS[d])));

// ── The habits are IDENTICAL across all four lengths ──────────────────────
function stripDuration(m) {
  const { durationDays, completionBonusXP, energyReset, ...rest } = m;
  const { durationDays: _d, ...cfgRest } = energyReset || {};
  return JSON.stringify({ ...rest, energyReset: cfgRest });
}
check('the daily task list is byte-identical across all four durations',
  new Set(ER.DURATIONS.map(d => JSON.stringify(ER.buildStartTasks({ durationDays: d })))).size === 1);
check('the weekly requirements are identical across all four durations',
  new Set(ER.DURATIONS.map(d => JSON.stringify(ER.weeklyRequirementDefs({ durationDays: d })))).size === 1);
check('ONLY duration and completion reward differ between the four attempts',
  new Set(ER.DURATIONS.map(d => stripDuration(ER.buildChallengeMeta({ durationDays: d })))).size === 1);
check('a longer version is not made harder — same targets everywhere',
  ER.DURATIONS.every(d => {
    const t = ER.buildStartTasks({ durationDays: d });
    return t.find(x => x.id === 'er_steps').target.value === 8000 &&
      t.find(x => x.id === 'er_sleep').xp === 40 && t.length === 9;
  }));

// ── Insight richness scales with available data ───────────────────────────
check('longer durations surface more patterns',
  ER.insightDepth(30).maxAssociations > ER.insightDepth(7).maxAssociations);
check('the shortest run still surfaces patterns', ER.insightDepth(7).maxAssociations >= 3);
check('a week-by-week trajectory appears only where there is more than one week',
  !ER.insightDepth(7).trajectory && !ER.insightDepth(10).trajectory &&
  ER.insightDepth(14).trajectory && ER.insightDepth(30).trajectory);
check('every duration explains its own insight depth',
  ER.DURATIONS.every(d => !!ER.insightDepth(d).note));
check('the comparison window grows with duration',
  ER.windowForDuration(7) === 3 && ER.windowForDuration(10) === 3 &&
  ER.windowForDuration(14) === 4 && ER.windowForDuration(30) === 7);
check('no duration compares only Day 1 against the final day',
  ER.DURATIONS.every(d => ER.windowForDuration(d) >= 3));
check('the window always leaves the two sides disjoint at that duration',
  ER.DURATIONS.every(d => ER.windowForDuration(d) * 2 <= d));

// ══ XP: the required importance ladder ═════════════════════════════════════
const xpOf = (id) => tasks.find(t => t.id === id)?.xp;
const wxpOf = (id) => weekly.find(d => d.id === id)?.xp;
check('requirements do NOT all award identical XP', new Set(tasks.map(t => t.xp)).size > 1);
check('sleep is the highest-XP requirement of all',
  xpOf('er_sleep') > Math.max(...tasks.filter(t => t.id !== 'er_sleep').map(t => t.xp), ...weekly.map(d => d.xp)),
  `sleep=${xpOf('er_sleep')}`);
check('sleep is the challenge keystone habit',
  tasks.find(t => t.id === 'er_sleep')?.keystoneHabit === true);
check('exactly one keystone habit', tasks.filter(t => t.keystoneHabit).length === 1);
const high = [xpOf('er_light'), xpOf('er_nutrition'), wxpOf('er_resistance')];
const medium = [xpOf('er_steps'), xpOf('er_hydration'), xpOf('er_caffeine')];
const support = [xpOf('er_stress'), xpOf('er_winddown')];
check('HIGH tier (morning light, nutrient-dense, exercise) sits below sleep',
  high.every(v => v < xpOf('er_sleep')), JSON.stringify(high));
check('HIGH tier sits above every MEDIUM requirement',
  Math.min(...high) > Math.max(...medium), `${Math.min(...high)} > ${Math.max(...medium)}`);
check('MEDIUM tier (steps, hydration, caffeine) sits above every SUPPORTING one',
  Math.min(...medium) > Math.max(...support), `${Math.min(...medium)} > ${Math.max(...support)}`);
check('SUPPORTING tier (stress downshift, wind-down) is the lowest',
  Math.max(...support) < Math.min(...medium));
check('morning light and nutrient-dense eating share the HIGH weighting',
  xpOf('er_light') === xpOf('er_nutrition'));

// ══ Daily requirements: all nine, exercise excluded ════════════════════════
const ids = tasks.map(t => t.id);
for (const [id, label] of [
  ['er_sleep', 'sleep opportunity'], ['er_light', 'morning light'], ['er_nutrition', 'nutrient-dense eating'],
  ['er_steps', 'daily movement'], ['er_hydration', 'morning hydration'], ['er_caffeine', 'caffeine discipline'],
  ['er_stress', 'stress downshift'], ['er_winddown', 'evening wind-down'], ['daily_log', 'daily log'],
]) check(`daily requirement present: ${label}`, ids.includes(id));
check('exercise is NOT a daily task', !tasks.some(t => /exercise|resistance|aerobic|cardio/i.test(t.name)));
check('steps target is 8,000', tasks.find(t => t.id === 'er_steps')?.target?.value === 8000);
check('morning light asks for 10+ minutes', tasks.find(t => t.id === 'er_light')?.target?.value === 10);
check('morning light is anchored to ~60 minutes after waking',
  ER.MORNING_LIGHT.withinMinutesOfWaking === 60 && /60 minutes of waking/.test(tasks.find(t => t.id === 'er_light').desc));
check('morning light copy is explicitly flexible about weather/light',
  /overcast|grey day/i.test(tasks.find(t => t.id === 'er_light').desc) &&
  /flexible/i.test(ER.MORNING_LIGHT_GUIDE.notice));
check('sleep is framed as OPPORTUNITY, not forced sleep',
  /opportunity/i.test(tasks.find(t => t.id === 'er_sleep').name) &&
  /time in bed/i.test(tasks.find(t => t.id === 'er_sleep').desc));
check('sleep emphasises a consistent wake time',
  /consistent wake time/i.test(tasks.find(t => t.id === 'er_sleep').desc));
check('hydration is soon after waking', /after waking/i.test(tasks.find(t => t.id === 'er_hydration').name));
check('electrolytes are optional and activity-dependent, not universal',
  /optional|worth it if/i.test(tasks.find(t => t.id === 'er_hydration').desc) &&
  /sweat/i.test(tasks.find(t => t.id === 'er_hydration').desc));
check('caffeine habit covers BOTH compensation and bedtime timing',
  /paper over|short night/i.test(tasks.find(t => t.id === 'er_caffeine').desc) &&
  /clear of bedtime/i.test(tasks.find(t => t.id === 'er_caffeine').desc));
check('caffeine is not framed as abstinence',
  /not an abstinence rule/i.test(tasks.find(t => t.id === 'er_caffeine').desc) &&
  /do not have to quit/i.test(ER.CAFFEINE.items.join(' ')));
check('stress downshift asks for 5+ minutes', tasks.find(t => t.id === 'er_stress')?.target?.value === 5);
check('stress downshift lists the required examples',
  ['Meditation', 'Diaphragmatic breathing', 'NSDR', 'Prayer'].every(o => ER.STRESS_OPTIONS.includes(o)) &&
  ER.STRESS_OPTIONS.some(o => /quiet walk/i.test(o)));
check('evening wind-down covers stimulation, light and routine',
  /lower stimulation/i.test(tasks.find(t => t.id === 'er_winddown').desc) &&
  /dimmer light/i.test(tasks.find(t => t.id === 'er_winddown').desc) &&
  /predictable routine/i.test(tasks.find(t => t.id === 'er_winddown').desc));

// ══ Micronutrients: education, never tracking ══════════════════════════════
const nutrientNames = ER.MICRONUTRIENTS.map(n => n.name).join(' ');
for (const n of ['Folate', 'B12', 'Iron', 'Magnesium', 'B1', 'B2', 'B3', 'B6', 'Iodine', 'Selenium'])
  check(`micronutrient covered with food sources: ${n}`,
    new RegExp(n.replace(/[()]/g, ''), 'i').test(nutrientNames) &&
    ER.MICRONUTRIENTS.every(m => !!m.sources));
check('users are explicitly NOT asked to track micronutrients',
  /do not need to track/i.test(ER.MICRONUTRIENT_NOTE));
check('users are explicitly NOT asked to hit every RDA daily',
  /no tracking, no RDA targets/i.test(tasks.find(t => t.id === 'er_nutrition').desc));
check('no micronutrient is a task or a weekly requirement',
  !tasks.some(t => /folate|b12|iodine|selenium|magnesium/i.test(t.name)) &&
  !weekly.some(d => /folate|b12|iodine|selenium|magnesium/i.test(d.label)));
check('persistent fatigue is pointed at a doctor, not at discipline',
  /doctor/i.test(ER.MICRONUTRIENT_CAUTION) && /not fixed by discipline/i.test(ER.MICRONUTRIENT_CAUTION));

// ══ Weekly exercise requirement ════════════════════════════════════════════
check('exercise runs through the existing generic weekly engine', hasWeeklyRequirements(meta));
check('the attempt carries its own weekly defs', getWeeklyRequirementDefs(meta).length === 2);
check('it requires resistance training', weekly.some(d => /resistance/i.test(d.label)));
check('and aerobic / Zone 2 work', weekly.some(d => /aerobic|zone 2/i.test(d.label)));
check('weekly exercise is NOT required daily', weekly.every(d => d.perWeek < 7));
check('it explicitly accommodates an existing training programme',
  /already training/i.test(weekly.find(d => d.id === 'er_resistance').note) &&
  /were doing anyway/i.test(ER.EXERCISE_GUIDE.items.join(' ')));
check('a session logged for another challenge counts here too — no double work',
  /count here too/i.test(ER.EXERCISE_GUIDE.notice) && /logged once/i.test(ER.EXERCISE_GUIDE.notice));
check('ten days is explicitly not the moment to overhaul training',
  /not the moment to overhaul/i.test(ER.EXERCISE_GUIDE.blurb));
const wk = challengeWeeks(meta);
check('10 days is one full week plus a 3-day week', wk.length === 2 && wk[0].days === 7 && wk[1].days === 3);
check('the short final week is prorated by the existing engine',
  targetForWeek(2, 3) === 1 && Object.values(wk[1].targets).every(t => t === 1),
  JSON.stringify(wk[1].targets));
check('the final week is flagged partial', wk[1].partial === true && wk[0].partial === false);
check('the full week uses the full target', Object.values(wk[0].targets).every(t => t === 2));

// ══ Overlap with other challenges — one action, one XP ═════════════════════
check('every daily habit declares a canonical habit key', tasks.every(t => !!habitKeyOf(t)));
check('shared behaviours reuse existing keys rather than inventing new ones',
  tasks.find(t => t.id === 'er_steps').habitKey === HABIT_KEYS.DAILY_STEPS &&
  tasks.find(t => t.id === 'er_sleep').habitKey === HABIT_KEYS.SLEEP_TARGET &&
  tasks.find(t => t.id === 'er_nutrition').habitKey === HABIT_KEYS.WHOLE_FOODS &&
  tasks.find(t => t.id === 'er_stress').habitKey === HABIT_KEYS.STRESS_RECOVERY &&
  tasks.find(t => t.id === 'er_hydration').habitKey === HABIT_KEYS.HYDRATION);
check('genuinely new behaviours get new keys',
  tasks.find(t => t.id === 'er_light').habitKey === HABIT_KEYS.MORNING_LIGHT &&
  tasks.find(t => t.id === 'er_caffeine').habitKey === HABIT_KEYS.CAFFEINE_DISCIPLINE &&
  tasks.find(t => t.id === 'er_winddown').habitKey === HABIT_KEYS.EVENING_WINDDOWN);

// A primary challenge that already requires steps and sleep.
const PRIMARY = [
  { id: 'fl_steps', name: 'Walk 10,000+ steps', habitKey: HABIT_KEYS.DAILY_STEPS, xp: 25, target: { value: 10000, unit: 'steps', direction: 'atLeast' }, source: 'template', order: 0 },
  { id: 'fl_sleep', name: 'Sleep 7+ hours', habitKey: HABIT_KEYS.SLEEP_TARGET, xp: 30, target: { value: 7, unit: 'hours', direction: 'atLeast' }, source: 'template', order: 1 },
  { id: 'daily_log', name: 'Complete Daily Log', habitKey: HABIT_KEYS.DAILY_LOG, xp: 10, source: 'template', order: 2 },
];
const merged = mergeSupportTasks(PRIMARY, tasks.map(t => ({ ...t, source: 'template' })));
const rows = merged.tasks;
check('overlapping steps produce ONE row, not two',
  rows.filter(t => habitKeyOf(t) === HABIT_KEYS.DAILY_STEPS).length === 1);
check('overlapping sleep produces ONE row, not two',
  rows.filter(t => habitKeyOf(t) === HABIT_KEYS.SLEEP_TARGET).length === 1);
check('the shared Daily Log is not duplicated',
  rows.filter(t => habitKeyOf(t) === HABIT_KEYS.DAILY_LOG).length === 1);
check('a merged row keeps ONE XP value — the same action is never paid twice',
  rows.filter(t => habitKeyOf(t) === HABIT_KEYS.DAILY_STEPS)
    .every(t => typeof t.xp === 'number' && t.xp === 25));
check('the stricter steps target survives the merge (10k beats 8k)',
  stricterOf(PRIMARY[0], tasks.find(t => t.id === 'er_steps')) === 'a');
check('the stricter sleep target survives the merge (8h beats 7h)',
  stricterOf(tasks.find(t => t.id === 'er_sleep'), PRIMARY[1]) === 'a');
check('non-overlapping Energy Reset habits are all added',
  ['er_light', 'er_caffeine', 'er_winddown', 'er_stress', 'er_nutrition', 'er_hydration']
    .every(id => rows.some(t => t.id === id)));
check('a merged row is marked as serving both challenges',
  rows.filter(t => habitKeyOf(t) === HABIT_KEYS.DAILY_STEPS).every(t => !!t.mergedFrom || (t.challenges || []).length > 1));

// ══ Compatibility ══════════════════════════════════════════════════════════
check('Energy Reset stacks with Mental Training',
  getCompatibility(ER.ENERGY_RESET_TEMPLATE_ID, 'mental_training_phase').rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('and with Muscle Building',
  canStack(ER.ENERGY_RESET_TEMPLATE_ID, 'muscle_building_phase'));
check('and with Sleep Reset', canStack(ER.ENERGY_RESET_TEMPLATE_ID, 'sleep_reset_challenge'));
check('Fat Loss is conditional, not conflicting — a deficit can itself cause fatigue',
  getCompatibility(ER.ENERGY_RESET_TEMPLATE_ID, 'fat_loss_phase').rating === COMPATIBILITY.CONDITIONAL);
check('75-Day Discipline remains a solo challenge',
  getCompatibility(ER.ENERGY_RESET_TEMPLATE_ID, '75_day_discipline_challenge').rating === COMPATIBILITY.CONFLICTING);
check('it cannot stack with itself', !canStack(ER.ENERGY_RESET_TEMPLATE_ID, ER.ENERGY_RESET_TEMPLATE_ID));

// ══ Energy ratings: the primitives ═════════════════════════════════════════
check('three dimensions are tracked', ENERGY_FIELDS.length === 3);
check('they are morning, afternoon and overall',
  ENERGY_KEYS.join(',') === 'morningEnergy,afternoonEnergy,overallEnergy');
check('ratings are 1-10', ER.ENERGY_PROMPT.scale.min === 1 && ER.ENERGY_PROMPT.scale.max === 10);
check('0 means NOT RATED, never "rated zero"', ratingOf({ overallEnergy: 0 }, 'overallEnergy') === null);
check('out-of-range values are rejected',
  ratingOf({ overallEnergy: 11 }, 'overallEnergy') === null && ratingOf({ overallEnergy: -3 }, 'overallEnergy') === null);
check('a valid rating is returned as-is', ratingOf({ overallEnergy: 7 }, 'overallEnergy') === 7);
check('a record with no ratings has no energy data', !hasEnergyData({ mood: 5, tasks: {} }));
check('a partial record still counts as rated', hasEnergyData({ overallEnergy: 6 }));
check('averages ignore unrated dimensions',
  averageEnergy([{ overallEnergy: 6 }, { overallEnergy: 8 }]).overallEnergy === 7);
check('an entirely unrated dimension averages to null',
  averageEnergy([{ overallEnergy: 6 }]).morningEnergy === null);
check('percent change matches the worked example', pctChange(5.8, 7.4) === 28);
check('percent change guards divide-by-zero', pctChange(0, 5) === null);

// ══ Before/after comparison ════════════════════════════════════════════════
/** Build day records: ratings[n] = [morning, afternoon, overall] or null. */
function makeDays(ratings, taskMap = {}) {
  const out = {};
  ratings.forEach((r, i) => {
    const n = i + 1;
    out[n] = { date: `2026-09-${String(n).padStart(2, '0')}`, dayNumber: n, tasks: taskMap[n] || {} };
    if (r) { out[n].morningEnergy = r[0]; out[n].afternoonEnergy = r[1]; out[n].overallEnergy = r[2]; }
  });
  return out;
}

// A clean 10-day improvement.
const improving = makeDays([
  [5, 4, 5], [6, 5, 5], [5, 5, 6],
  [6, 6, 6], [6, 6, 7], [7, 6, 7], [7, 7, 7],
  [8, 8, 8], [8, 7, 8], [8, 8, 8],
]);
const cmp = energyComparison({ days: improving, endDayNum: 10 });
check('all ten rated days are found', cmp.ratedDayCount === 10);
check('there is enough data for a comparison', cmp.enoughData);
check('the derived baseline is the first three rated days',
  cmp.source === 'derived' && JSON.stringify(cmp.beforeDays) === '[1,2,3]');
check('the "after" window is the last three days', JSON.stringify(cmp.afterDays) === '[8,9,10]');
check('before and after windows never overlap',
  cmp.beforeDays.every(d => !cmp.afterDays.includes(d)));
check('the headline average improves', cmp.average.after > cmp.average.before);
check('the headline percentage is computed', typeof cmp.average.pct === 'number' && cmp.average.pct > 0);
check('every dimension is reported separately', cmp.dimensions.length === 3);
check('morning energy is compared', cmp.dimensions[0].before === 5.3 && cmp.dimensions[0].after === 8);
check('afternoon energy is compared', cmp.dimensions[1].before != null && cmp.dimensions[1].after != null);
check('window size is three days', WINDOW_SIZE === 3);

// An explicit pre-challenge baseline takes precedence.
const withBase = energyComparison({ days: improving, endDayNum: 10, baseline: { morningEnergy: 3, afternoonEnergy: 3, overallEnergy: 3 } });
check('a user-supplied baseline is used when present', withBase.source === 'baseline');
check('with a baseline, the whole tail is available for the "after" window',
  JSON.stringify(withBase.afterDays) === '[8,9,10]');
check('the baseline changes the comparison', withBase.average.before === 3);
check('an empty baseline object falls back to derived', normalizeBaseline({}) === null);
check('a partial baseline is kept', normalizeBaseline({ overallEnergy: 5 })?.overallEnergy === 5);
check('a null baseline is null', normalizeBaseline(null) === null);

// ══ Missing data / edge cases ══════════════════════════════════════════════
const none = energyComparison({ days: makeDays([null, null, null, null, null]), endDayNum: 5 });
check('no ratings at all → not enough data, no fabricated change',
  !none.enoughData && none.ratedDayCount === 0 && none.average.before === null && none.average.after === null);
const one = energyComparison({ days: makeDays([[5, 5, 5]]), endDayNum: 10 });
check('a single rated day cannot produce a before/after', !one.enoughData);
const three = energyComparison({ days: makeDays([[5, 5, 5], [6, 6, 6], [7, 7, 7]]), endDayNum: 10 });
check('three rated days is still below the derived threshold', !three.enoughData && MIN_RATED_DAYS.derived === 4);
const four = energyComparison({ days: makeDays([[5, 5, 5], [6, 6, 6], [7, 7, 7], [8, 8, 8]]), endDayNum: 10 });
check('four rated days is enough, and the two sides stay balanced and disjoint',
  four.enoughData && JSON.stringify(four.beforeDays) === '[1,2]' && JSON.stringify(four.afterDays) === '[3,4]');
check('the window degrades gracefully rather than swallowing a short run',
  effectiveWindow(7, 5) === 2 && effectiveWindow(3, 10) === 3 && effectiveWindow(7, 30) === 7);
check('the window never collapses below one day', effectiveWindow(7, 1) === 1 && effectiveWindow(3, 0) === 1);
// A 30-day run with sparse ratings still produces a real comparison.
const sparse30 = energyComparison({
  days: makeDays([[4,4,4], null, [4,4,4], null, null, [5,5,5], null, null, [7,7,7], null, [8,8,8]]),
  endDayNum: 30, windowSize: 7,
});
check('a long run with few ratings still compares early against late',
  sparse30.enoughData && sparse30.beforeDays.length === 2 && sparse30.afterDays.length === 2);
check('and its two sides never overlap',
  sparse30.beforeDays.every(d => !sparse30.afterDays.includes(d)));
const twoWithBase = energyComparison({ days: makeDays([[5, 5, 5], [7, 7, 7]]), endDayNum: 10, baseline: { overallEnergy: 4 } });
check('with a baseline, two rated days is enough', twoWithBase.enoughData && MIN_RATED_DAYS.withBaseline === 2);
const sparse = energyComparison({ days: makeDays([[5, 5, 5], null, null, [6, 6, 6], null, [7, 7, 7], null, [8, 8, 8]]), endDayNum: 10 });
check('skipped days are excluded, not counted as zero',
  sparse.ratedDayCount === 4 && sparse.average.before > 0 && sparse.average.after > 0);
check('skipped days do not drag the average down',
  sparse.average.before >= 5 && sparse.average.after >= 6);
// Only one dimension ever rated.
const partial = {};
for (let n = 1; n <= 6; n++) partial[n] = { dayNumber: n, tasks: {}, overallEnergy: n };
const partialCmp = energyComparison({ days: partial, endDayNum: 6 });
check('a user who only rates Overall still gets a real headline',
  partialCmp.enoughData && partialCmp.average.before === 2 && partialCmp.average.after === 5);
check('dimensions rated at only one end are reported as uncomparable, not as change',
  partialCmp.dimensions.filter(d => d.pct === null).length === 2);
check('an unrated dimension never invents a percentage',
  partialCmp.dimensions.find(d => d.key === 'morningEnergy').pct === null);
check('endDayNum of 0 is handled', energyComparison({ days: improving, endDayNum: 0 }).ratedDayCount === 0);
check('undefined days object is handled', energyComparison({}).enoughData === false);
check('ratedDays tolerates a missing map', ratedDays(undefined, 10).length === 0);

// ══ Associations — patterns, never causation ═══════════════════════════════
// Light completed on the high-energy days, not on the low ones.
const assocDays = makeDays(
  [[4, 4, 4], [4, 4, 4], [5, 5, 5], [4, 4, 4], [8, 8, 8], [8, 8, 8], [7, 7, 7], [8, 8, 8], [4, 4, 4], [8, 8, 8]],
  { 5: { er_light: true }, 6: { er_light: true }, 7: { er_light: true }, 8: { er_light: true }, 10: { er_light: true } },
);
const assoc = energyAssociations({ days: assocDays, endDayNum: 10, tasks });
const light = assoc.find(a => a.taskId === 'er_light');
check('an association is found for morning light', !!light && light.higher);
check('it reports the size of the gap', light.diff > 1);
check('it reports how many days sit on each side', light.daysWith === 5 && light.daysWithout === 5);
check('it is phrased as an association, not causation',
  /averaged .* higher on days you completed/i.test(light.text));
check('no association text claims a cause',
  assoc.every(a => !/because|caused|causes|due to|thanks to|proves/i.test(a.text)));
check('the standing caveat says plainly this is not proof of cause',
  /not proof of cause/i.test(ER.LAGGED_HABIT_KEYS && buildEnergySummary({ days: assocDays, endDayNum: 10, tasks }).caveat));
check('a habit completed every single day yields no association',
  !energyAssociations({
    days: makeDays(Array(10).fill([6, 6, 6]), Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, { er_light: true }]))),
    endDayNum: 10, tasks,
  }).some(a => a.taskId === 'er_light'));
check('a habit never completed yields no association',
  !energyAssociations({ days: makeDays(Array(10).fill([6, 6, 6])), endDayNum: 10, tasks })
    .some(a => a.taskId === 'er_light'));
check('a difference below the noise floor is not surfaced',
  ASSOCIATION_MIN.diff === 0.5 &&
  !energyAssociations({
    days: makeDays([[6, 6, 6], [6, 6, 6], [6, 6, 6], [6, 6, 6]], { 1: { er_light: true }, 2: { er_light: true } }),
    endDayNum: 4, tasks,
  }).length);
check('fewer than two days on either side is not enough for a pattern',
  ASSOCIATION_MIN.perGroup === 2 &&
  !energyAssociations({
    days: makeDays([[4, 4, 4], [8, 8, 8], [4, 4, 4]], { 2: { er_light: true } }),
    endDayNum: 3, tasks,
  }).length);
check('the strongest pattern is listed first',
  assoc.length < 2 || assoc[0].diff >= assoc[1].diff);

// Sleep is compared against the NEXT day — last night shows up today.
check('sleep and wind-down are lagged habits',
  ER.LAGGED_HABIT_KEYS.includes(HABIT_KEYS.SLEEP_TARGET) &&
  ER.LAGGED_HABIT_KEYS.includes(HABIT_KEYS.EVENING_WINDDOWN));
const sleepDays = makeDays(
  [[4, 4, 4], [8, 8, 8], [4, 4, 4], [8, 8, 8], [4, 4, 4], [8, 8, 8], [4, 4, 4], [8, 8, 8]],
  { 1: { er_sleep: true }, 3: { er_sleep: true }, 5: { er_sleep: true }, 7: { er_sleep: true } },
);
const sleepAssoc = energyAssociations({ days: sleepDays, endDayNum: 8, tasks, lagKeys: ER.LAGGED_HABIT_KEYS })
  .find(a => a.taskId === 'er_sleep');
check('the sleep pattern uses the FOLLOWING day\'s rating', !!sleepAssoc && sleepAssoc.lagged);
check('and is phrased as "after nights you completed…"',
  /after nights you completed/i.test(sleepAssoc.text));
check('it reports the afternoon dimension, as specified',
  /afternoon energy/i.test(sleepAssoc.text));

// ══ The full completion summary ════════════════════════════════════════════
const summary = buildEnergySummary({ days: improving, endDayNum: 10, tasks, lagKeys: ER.LAGGED_HABIT_KEYS });
check('the summary is marked as tracked', summary.tracked === true);
check('it carries the before/after comparison', summary.average.after > summary.average.before);
check('it carries per-dimension results', summary.dimensions.length === 3);
check('it always carries the observational caveat', !!summary.caveat);
const emptySummary = buildEnergySummary({ days: {}, endDayNum: 10, tasks });
check('with no data it reports that honestly instead of inventing a result',
  !emptySummary.enoughData && emptySummary.associations.length === 0);
check('no data means no fabricated percentage', emptySummary.average.pct === null);

// ══ Attempt config isolation ═══════════════════════════════════════════════
check('the attempt stores its own configuration copy', !!meta.energyReset);
check('erConfig resolves only for an Energy Reset attempt',
  !!ER.erConfig(meta) && ER.erConfig({ templateId: 'fat_loss_phase' }) === null);
check('tracksEnergy is templateId-scoped',
  ER.tracksEnergy(meta) && !ER.tracksEnergy({ templateId: 'mental_training_phase' }));
check('a custom setup is reflected in the built tasks',
  ER.buildStartTasks({ stepTarget: 12000 }).find(t => t.id === 'er_steps').target.value === 12000);
check('a custom weekly target is reflected in the attempt defs',
  ER.buildChallengeMeta({ resistancePerWeek: 4 }).weeklyRequirementDefs.find(d => d.id === 'er_resistance').perWeek === 4);
check('the completion bonus matches the chosen duration',
  meta.completionBonusXP === ER.COMPLETION_BONUS_BY_DURATION[ER.DEFAULT_DURATION] && meta.completionBonusXP > 0);
check('the attempt stores its own duration copy',
  ER.DURATIONS.every(d => ER.buildChallengeMeta({ durationDays: d }).energyReset.durationDays === d));
check('every habit has a "why this helps" entry',
  tasks.every(t => !!ER.WHY[t.habitKey]));

// ══ Week-by-week trajectory (longer durations) ═════════════════════════════
const traj30 = {};
for (let n = 1; n <= 28; n++) traj30[n] = { dayNumber: n, tasks: {}, overallEnergy: 4 + Math.floor((n - 1) / 7) };
const weeks = weeklyEnergyTrajectory({ days: traj30, endDayNum: 28 });
check('the trajectory splits a 28-day run into four challenge weeks', weeks.length === 4);
check('each week reports its own average',
  weeks.map(w => w.average).join(',') === '4,5,6,7');
check('each week reports how many days it rests on', weeks.every(w => w.ratedDays === 7));
check('a week with no ratings reports null rather than zero',
  weeklyEnergyTrajectory({ days: { 1: { overallEnergy: 5 } }, endDayNum: 14 })[1].average === null);

const summary30 = buildEnergySummary({
  days: traj30, endDayNum: 28, tasks, lagKeys: ER.LAGGED_HABIT_KEYS,
  windowSize: ER.windowForDuration(30), maxAssociations: ER.insightDepth(30).maxAssociations,
  trajectory: true, depthNote: ER.insightDepth(30).note,
});
check('a 30-day summary includes the week-by-week trajectory', summary30.trajectory?.length === 4);
check('it compares a week of days against a week of days',
  summary30.beforeDays.length === 7 && summary30.afterDays.length === 7);
check('a long run reports improvement across the month', summary30.average.after > summary30.average.before);
check('it carries the depth note explaining what the length bought', !!summary30.depthNote);

const summary7 = buildEnergySummary({
  days: makeDays([[4,4,4],[4,4,4],[5,5,5],[6,6,6],[7,7,7],[7,7,7],[8,8,8]]), endDayNum: 7, tasks,
  windowSize: ER.windowForDuration(7), maxAssociations: ER.insightDepth(7).maxAssociations,
  trajectory: ER.insightDepth(7).trajectory,
});
check('a 7-day run still produces a real before/after', summary7.enoughData);
check('it compares its first three rated days against its last three',
  JSON.stringify(summary7.beforeDays) === '[1,2,3]' && JSON.stringify(summary7.afterDays) === '[5,6,7]');
check('a 7-day run shows no trajectory — one week is not a trajectory', summary7.trajectory === null);
check('the number of surfaced patterns is capped by the duration\'s depth',
  buildEnergySummary({ days: assocDays, endDayNum: 10, tasks, maxAssociations: 1 }).associations.length <= 1);
check('the evidence bar for a pattern does not move with duration',
  ASSOCIATION_MIN.perGroup === 2 && ASSOCIATION_MIN.diff === 0.5);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
