/**
 * Fat Loss task hierarchy: star tiers, XP values, Keystone designation,
 * weighted grading and adherence. Scoped to Fat Loss — asserts other templates
 * are untouched.
 */
import { getTemplateById, getDurationOptions } from '../src/data/challengeTemplates.js';
import {
  getTaskXP, getTaskKeystone, isKeystone, keystoneHabitsOf,
  computeChallengeScore, computeDayXP, getPassingConfig,
  DEFAULT_PASSING_SCORE, DEFAULT_KEYSTONE_REQUIREMENT,
} from '../src/utils/gamification.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const fl = getTemplateById('fat_loss_phase');
const std = fl.variants.standard.start_tasks;
const task = (id, list = std) => list.find(t => t.id === id);

// ══ 1–8: the exact table (stars + XP), read through the shared helpers ══════
const EXPECTED = [
  ['fl_protein', 3, 40], ['fl_whole', 3, 40],
  ['fl_steps', 2, 25],   ['fl_sleep', 2, 25],
  ['fl_water', 1, 15],   ['fl_photo', 1, 10], ['daily_log', 1, 10],
];
for (const [id, stars, xp] of EXPECTED) {
  const t = task(id);
  check(`${id}: ${'⭐'.repeat(stars)} and ${xp} XP`, t && getTaskKeystone(t) === stars && getTaskXP(t) === xp,
    t ? `stars=${getTaskKeystone(t)} xp=${getTaskXP(t)}` : 'MISSING');
}

// ══ 9: a perfect required-task day is exactly 165 XP ════════════════════════
const perfect = std.reduce((s, t) => s + getTaskXP(t), 0);
check('9: perfect Standard day = 165 required-task XP', perfect === 165, `got ${perfect}`);
// And computeDayXP awards exactly that for the task portion.
const allDone = Object.fromEntries(std.map(t => [t.id, true]));
const day = (tasks) => ({ tasks, bonusDone: {}, mood: 0, energy: 0, sleep: 0, stress: 0, recovery: 0 });
const xpAll = computeDayXP(day(allDone), std, 'me', 1, 1, false, 1);
check('9/20: computeDayXP awards the configured XP (165 + the 50 all-complete bonus)', xpAll.gained === 165 + 50, `got ${xpAll.gained}`);
for (const [id, , xp] of EXPECTED) {
  const only = computeDayXP(day({ [id]: true }), std, 'me', 1, 1, false, 1);
  check(`20: completing only ${id} awards exactly ${xp}`, only.gained === xp, `got ${only.gained}`);
}

// ══ 3 + 11: exactly TWO genuine Keystone habits ═════════════════════════════
const ks = keystoneHabitsOf(std);
check('3: Keystone habits are exactly protein + whole foods', ks.length === 2 && ks.map(t => t.id).sort().join() === 'fl_protein,fl_whole', ks.map(t => t.id).join());
check('3: both are flagged keystoneHabit', ks.every(t => t.keystoneHabit === true));
check('11: starred-but-supporting tasks are NOT keystone habits', !ks.some(t => ['fl_water', 'fl_photo', 'daily_log', 'fl_steps', 'fl_sleep'].includes(t.id)));
check('Stars still mark supporting tasks for display', isKeystone(task('fl_water')) && getTaskKeystone(task('fl_water')) === 1);

// Adherence math matches the spec example: protein 25/30, whole 20/30 → 75%.
// These assertions target DAILY-task weighting, so weekly requirements are held
// inert by starting them after the challenge ends (their own behaviour is
// covered exhaustively in weekly-requirements-unit-test).
const WEEKLY_OFF = '2099-01-01';
const META = { templateId: 'fat_loss_phase', durationDays: 30, completionBonusXP: 500, weeklyRequirementsStartDate: WEEKLY_OFF };
const profiles = { me: { challengeStart: '2026-01-01', tasks: std, activeChallenge: META, xpPenalties: false } };
const days = {};
for (let i = 1; i <= 30; i++) days[i] = day({ fl_protein: i <= 25, fl_whole: i <= 20 });
const sc = computeChallengeScore({ me: days }, profiles, 'me', 31); // all 30 finalized
check('11: 2 keystones × 30 days = 60 opportunities, 45 done → 75% adherence', sc.keystoneAdherence === 75, `got ${sc.keystoneAdherence}%`);
check('11: keystoneCount reports 2', sc.keystoneCount === 2);

// ══ 10: weighted grading — a missed Keystone costs more than a missed photo ══
const base = {};
for (let i = 1; i <= 10; i++) base[i] = day({ ...allDone });
const full = computeChallengeScore({ me: base }, profiles, 'me', 11);
check('10: all tasks done → 100%', full.score === 100 && full.requiredAvailable === 1650);
const noProtein = {}; const noPhoto = {};
for (let i = 1; i <= 10; i++) {
  const a = { ...allDone }; delete a.fl_protein; noProtein[i] = day(a);
  const b = { ...allDone }; delete b.fl_photo;   noPhoto[i]   = day(b);
}
const sProtein = computeChallengeScore({ me: noProtein }, profiles, 'me', 11);
const sPhoto = computeChallengeScore({ me: noPhoto }, profiles, 'me', 11);
check('10: missing the 40-XP Keystone hurts more than the 10-XP photo', sProtein.score < sPhoto.score, `protein=${sProtein.score}% photo=${sPhoto.score}%`);
check('10: grading is XP-weighted, not flat (protein 76%, photo 94%)', sProtein.score === 76 && sPhoto.score === 94, `${sProtein.score}/${sPhoto.score}`);
check('10: missing a keystone also drops adherence to 0', sProtein.keystoneAdherence === 50 && sPhoto.keystoneAdherence === 100, `${sProtein.keystoneAdherence}/${sPhoto.keystoneAdherence}`);

// ══ 12/13: thresholds unchanged ═════════════════════════════════════════════
const cfg = getPassingConfig(META);
check('12: passing score is still the 70% default', cfg.passingScore === 70 && DEFAULT_PASSING_SCORE === 70);
check('13: keystone requirement default unchanged (65)', cfg.keystoneRequirement === 65 && DEFAULT_KEYSTONE_REQUIREMENT === 65);
check('13: Fat Loss defines no override of either threshold', fl.passing_score == null && fl.keystone_requirement == null);

// ══ 14/15: current-day fairness preserved ═══════════════════════════════════
const today = { me: { 1: day({ fl_protein: true }) } };            // day 1 in progress
const neutral = computeChallengeScore(today, profiles, 'me', 1);
check('14: unchecked tasks today are neutral (only the 40 done counts)', neutral.requiredEarned === 40 && neutral.requiredAvailable === 40 && neutral.score === 100);
const finalized = computeChallengeScore(today, profiles, 'me', 2);  // day 1 now historical
check('15: once historical, the unchecked tasks count as missed', finalized.requiredAvailable === 165 && finalized.requiredEarned === 40);
const todayXP = computeDayXP(day({ fl_protein: true }), std, 'me', 1, 1, true, 1);
check('14: no penalty for unchecked tasks while today is in progress', todayXP.lost === 0 && todayXP.gained === 40);
const pastXP = computeDayXP(day({ fl_protein: true }), std, 'me', 1, 2, true, 2);
check('15: a historical day with misses does incur penalties', pastXP.lost > 0);

// ══ 16: identical task values across 14/30/60 ═══════════════════════════════
check('16: Fat Loss offers 14/30/60', JSON.stringify(getDurationOptions(fl)) === '[14,30,60]');
check('16: task values are duration-independent (one definition per variant)',
  !fl.variants.standard.start_tasks_by_duration && !fl.variants.standard.tasks_by_duration);
for (const d of [14, 30, 60]) {
  const m = { ...META, durationDays: d, weeklyRequirementsStartDate: WEEKLY_OFF };
  const p = { me: { challengeStart: '2026-01-01', tasks: std, activeChallenge: m, xpPenalties: false } };
  const dd = {}; for (let i = 1; i <= d; i++) dd[i] = day({ ...allDone });
  const s = computeChallengeScore({ me: dd }, p, 'me', d + 1);
  check(`16: ${d}-day perfect run = 100% and ${d}×165 available XP`, s.score === 100 && s.requiredAvailable === d * 165, `avail=${s.requiredAvailable}`);
}

// ══ 17: other templates untouched ═══════════════════════════════════════════
const mt = getTemplateById('mental_training_phase');
const mtStd = mt.variants.standard.start_tasks;
check('17: MT keystone habits unchanged (all starred tasks count)', keystoneHabitsOf(mtStd).length === mtStd.filter(isKeystone).length);
check('17: MT Mental Training still 100 XP / 3 stars', getTaskXP(mtStd.find(t => t.id === 'mt_mind')) === 100 && getTaskKeystone(mtStd.find(t => t.id === 'mt_mind')) === 3);
check('17: MT Daily Log still 20 XP / 0 stars (shared constant untouched)', getTaskXP(mtStd.find(t => t.id === 'daily_log')) === 20 && getTaskKeystone(mtStd.find(t => t.id === 'daily_log')) === 0);
check('17: no non-FatLoss template uses keystoneHabit', ['mental_training_phase','sleep_reset_challenge','strength_phase','recovery_phase','75_day_discipline_challenge']
  .every(id => !(getTemplateById(id)?.variants && Object.values(getTemplateById(id).variants).some(v => (v.start_tasks || []).some(t => t.keystoneHabit)))));

// ══ 23: no duplicate task ids in any variant ════════════════════════════════
for (const [name, v] of Object.entries(fl.variants)) {
  const ids = v.start_tasks.map(t => t.id);
  check(`23: ${name} variant has no duplicate task ids`, new Set(ids).size === ids.length, ids.join());
}
check('Hard variant keeps exactly two Keystone habits (deficit is ⭐⭐)', keystoneHabitsOf(fl.variants.hard.start_tasks).length === 2 && getTaskKeystone(task('fl_deficit', fl.variants.hard.start_tasks)) === 2);
check('Beginner variant uses the same hierarchy', keystoneHabitsOf(fl.variants.beginner.start_tasks).length === 2 &&
  getTaskXP(task('fl_protein', fl.variants.beginner.start_tasks)) === 40);

// ══ Keystone rationale copy ═════════════════════════════════════════════════
check('Keystone rationale provided for both habits', !!fl.keystone_why?.fl_protein && !!fl.keystone_why?.fl_whole);
check('Whole-foods copy does NOT claim it creates a deficit by itself',
  /does not create a calorie deficit on its own/.test(fl.keystone_why.fl_whole) && /energy balance/.test(fl.keystone_why.fl_whole));

// Sanity: with weekly requirements ACTIVE (and no sessions logged), a finalized
// week correctly adds its 115 XP to the denominator — daily tasks alone are no
// longer a perfect Fat Loss run.
{
  const live = { ...META, durationDays: 30, weeklyRequirementsStartDate: '2026-01-01' };
  const p = { me: { challengeStart: '2026-01-01', tasks: std, activeChallenge: live, weeklySessions: [], xpPenalties: false } };
  const dd = {}; for (let i = 1; i <= 10; i++) dd[i] = day({ ...allDone });
  const s2 = computeChallengeScore({ me: dd }, p, 'me', 11);
  check('Weekly requirements join the same weighted score when active', s2.requiredAvailable === 1650 + 115 && s2.score < 100, `avail=${s2.requiredAvailable} score=${s2.score}`);
}

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
