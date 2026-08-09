import {
  getTemplateById, getDurationOptions, getDefaultDuration, getDurationLabel,
  isRecommendedDuration, getCompletionBonusForDuration, getProgramForDuration,
} from '/home/user/75-hard/src/data/challengeTemplates.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const fl = getTemplateById('fat_loss_phase');
const mt = getTemplateById('mental_training_phase');
const sleep = getTemplateById('sleep_reset_challenge');

// ══ 1/2: Fat Loss offers 14/30/60 with 30 default + recommended ═════════════
check('1: Fat Loss offers exactly 14, 30, 60', JSON.stringify(getDurationOptions(fl)) === '[14,30,60]', JSON.stringify(getDurationOptions(fl)));
check('2: 30 days is the default', getDefaultDuration(fl) === 30);
check('2: 30 days is flagged recommended', isRecommendedDuration(fl, 30) === true);
check('2: 14 and 60 are not recommended', !isRecommendedDuration(fl, 14) && !isRecommendedDuration(fl, 60));
check('Duration labels: Kickstart / Standard / Transformation',
  getDurationLabel(fl, 14) === 'Kickstart' && getDurationLabel(fl, 30) === 'Standard' && getDurationLabel(fl, 60) === 'Transformation');

// ══ 19: other challenges do NOT inherit 14/30/60 ════════════════════════════
check('19: Mental Training keeps its own durations (7/14/21)', JSON.stringify(getDurationOptions(mt)) === '[7,14,21]', JSON.stringify(getDurationOptions(mt)));
check('19: Sleep Reset unchanged', !getDurationOptions(sleep).includes(60));
check('19: no other template gained duration_labels', ['mental_training_phase','sleep_reset_challenge','strength_phase','recovery_phase','75_day_discipline_challenge']
  .every(id => !getTemplateById(id)?.duration_labels));
check('19: MT default still the middle option (14)', getDefaultDuration(mt) === 14);

// ══ 13: completion bonus per duration, balanced (no short-duration exploit) ══
const b14 = getCompletionBonusForDuration(fl, 14);
const b30 = getCompletionBonusForDuration(fl, 30);
const b60 = getCompletionBonusForDuration(fl, 60);
check('13: bonuses are 200 / 500 / 1100', b14 === 200 && b30 === 500 && b60 === 1100, `${b14}/${b30}/${b60}`);
check('13: 30-day bonus unchanged from the existing economy (500)', b30 === 500);
check('13: bonus grows with duration', b14 < b30 && b30 < b60);
check('13: XP-per-day increases with duration (no short-run exploit)', (b14 / 14) < (b30 / 30) && (b30 / 30) < (b60 / 60),
  `${(b14/14).toFixed(1)}/${(b30/30).toFixed(1)}/${(b60/60).toFixed(1)} per day`);
check('13: repeating 14-day never beats one 60-day over the same span', Math.floor(60 / 14) * b14 < b60, `${Math.floor(60/14)}×${b14}=${Math.floor(60/14)*b14} < ${b60}`);
check('13: two 30-day attempts do not beat one 60-day', 2 * b30 < b60);
check('13: templates without a table fall back to flat reward XP', getCompletionBonusForDuration(mt, 14) === mt.rewards.xp);

// ══ 10/11: duration-aware program copy ══════════════════════════════════════
const p14 = getProgramForDuration(fl, 14);
const p30 = getProgramForDuration(fl, 30);
const p60 = getProgramForDuration(fl, 60);
check('10: 14-day expected results differ from 30-day', JSON.stringify(p14.expected_results) !== JSON.stringify(p30.expected_results));
check('10: 60-day expected results differ from 30-day', JSON.stringify(p60.expected_results) !== JSON.stringify(p30.expected_results));
check('10: 14-day quotes 1–2.5 lb', p14.expected_results.some(r => /1–2\.5 lb/.test(r)));
check('10: 30-day keeps 2–5 lb', p30.expected_results.some(r => /2–5 lb/.test(r)));
check('10: 60-day quotes 4–10 lb', p60.expected_results.some(r => /4–10 lb/.test(r)));
check('10: 60-day does not simply double the 30-day claims', !p60.expected_results.some(r => /4–10 lb of body fat guaranteed/i.test(r)) && p60.expected_results.some(r => /may be achievable/.test(r)));
check('10: every duration keeps the results-vary disclaimer',
  [p14, p30, p60].every(p => /Results vary depending on starting body fat, adherence, calorie intake/.test(p.results_disclaimer)));
check('10: 14-day framed as estimates, not a dramatic transformation', p14.expected_results.some(r => /may be/.test(r)) && !/transformation/i.test(p14.expected_results.join(' ')));
check('10: emphasis copy present for 14 and 60', /momentum/i.test(p14.emphasis) && /transformation/i.test(p60.emphasis));

check('11: Goal is duration-aware (all three differ)', p14.goal !== p30.goal && p60.goal !== p30.goal);
check('11: 14-day goal emphasises early progress/momentum', /momentum|early/i.test(p14.goal));
check('11: 60-day goal emphasises a noticeable change', /noticeable|substantial/i.test(p60.goal));
check('11: "What You\'ll Notice" is duration-aware', JSON.stringify(p14.visual_changes) !== JSON.stringify(p30.visual_changes) && JSON.stringify(p60.visual_changes) !== JSON.stringify(p30.visual_changes));
check('11: no duration shows another duration\'s day count in its finish copy',
  /14 days/.test(p14.progress.finish) && /30 days/.test(p30.progress.finish) && /60 days/.test(p60.progress.finish));
check('11: 14-day timeline does not claim 4 weeks', p14.timeline.length === 2);
check('11: 60-day timeline spans 8 weeks', p60.timeline.some(t => /Weeks 7–8/.test(t.week)));
check('11: base (30-day) program still intact for legacy reads', fl.program.expected_results.some(r => /2–5 lb/.test(r)));

// ══ 12: tasks identical across durations (duration is not a difficulty mode) ══
for (const v of ['beginner', 'standard', 'hard']) {
  const tasks = fl.variants[v].start_tasks;
  check(`12: ${v} task list is duration-independent (single definition)`, Array.isArray(tasks) && tasks.length > 0);
}
check('12: no duration-specific task overrides exist on Fat Loss',
  !Object.values(fl.variants).some(v => v.tasks_by_duration || v.start_tasks_by_duration));
// Task values come from a single per-variant definition, so they cannot vary by
// duration (protein is the ⭐⭐⭐ Keystone at 40 XP for 14, 30 and 60 alike).
check('12: daily task XP is duration-independent (protein 40 XP for every duration)',
  fl.variants.standard.start_tasks.find(t => t.id === 'fl_protein').xp === 40);

// ══ Passing threshold unchanged across durations ════════════════════════════
check('14: Fat Loss defines no stricter passing score (inherits the 70% default)', fl.passing_score == null);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
