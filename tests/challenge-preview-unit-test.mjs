/**
 * What the Challenge Library advertises IS what starting the challenge awards.
 *
 * Every startable template, every mode, every duration and every configurable
 * option is previewed and then started, and the two are required to agree —
 * per task, per weekly requirement, and on every bonus and ceiling.
 *
 * This is the regression the suite exists for: the library used to describe XP
 * with hand-written strings while the attempt was assembled and repriced
 * elsewhere, so after the era-2 rebalance it advertised Mental Training at
 * 100 XP a task and 270 a day against an actual 41 and 160.
 */
import { CHALLENGE_TEMPLATES, getDurationOptions, difficultyLabel, difficultyRange, COLD_SHOWER_TASK }
  from '../src/data/challengeTemplates.js';
import { CONFIGURED_BUILDERS, isConfigured, isStartableTemplate }
  from '../src/data/configuredChallenges.js';
import { previewAttempt, buildAttemptPayload, previewConfigured, NEW_ATTEMPT_DEFAULTS }
  from '../src/data/challengeAttempt.js';
import { stampAttempt } from '../src/utils/xpAttempt.js';
import { getTemplateById } from '../src/data/challengeTemplates.js';
import { dayRules, tierBudget, ECONOMY_V2, TIER_LABELS } from '../src/data/xpEconomy.js';
import { computeDayXP, computeTotalXP } from '../src/utils/gamification.js';
import { getWeeklyRequirementDefs, computeWeeklyRequirements } from '../src/utils/weeklyRequirements.js';
import * as MB from '../src/data/muscleBuildingConfig.js';
import * as ER from '../src/data/energyResetConfig.js';
import * as LI from '../src/data/lockInConfig.js';
import * as HH from '../src/data/hormoneHealthConfig.js';
import * as FLH from '../src/data/fatLossHardConfig.js';
import { DISCIPLINE_75_META, discipline75Tasks } from '../src/context/AppContext.jsx';

/** The 75-Day challenge's task list is a per-profile default, handed in. */
const LEGACY_75 = { meta: DISCIPLINE_75_META, tasks: discipline75Tasks('me') };

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const MODES = ['beginner', 'standard', 'hard'];
const startable = CHALLENGE_TEMPLATES.filter(isStartableTemplate);

/** Every (template, mode, duration, setup) combination the library can show. */
function everyCombination() {
  const out = [];
  for (const template of startable) {
    if (isConfigured(template)) {
      // Each configured challenge across its own duration options, plus the
      // configurable dimension that changes its requirement list.
      const durations = getDurationOptions(template).map(d => (typeof d === 'object' ? d.days : d));
      for (const days of durations.length ? durations : [null]) {
        out.push({ template, configuredSetup: days ? { durationDays: days } : null, label: `${template.id}/${days}d` });
      }
      if (template.id === MB.MUSCLE_BUILDING_TEMPLATE_ID) {
        for (const h of MB.OPTIMIZATION_HABITS) {
          out.push({
            template,
            configuredSetup: { ...MB.defaultSetup(), optimizations: { [h.key]: true } },
            label: `${template.id}/+${h.key}`,
          });
        }
        for (const n of [3, 4, 5, 6]) {
          out.push({
            template,
            configuredSetup: { ...MB.defaultSetup(), trainingDaysPerWeek: n },
            label: `${template.id}/${n}x-week`,
          });
        }
      }
      continue;
    }
    // The 75-Day challenge carries no start_tasks: its list is the profile's
    // own defaults, so the library hands them in exactly as the start does.
    if (template.id === DISCIPLINE_75_META.templateId) {
      out.push({ template, legacy: LEGACY_75, label: `${template.id}/legacy` });
      continue;
    }
    const durations = getDurationOptions(template);
    for (const mode of MODES) {
      if (!template.variants?.[mode]) continue;
      for (const days of durations.length ? durations : [null]) {
        out.push({ template, variant: mode, durationDays: days, label: `${template.id}/${mode}/${days}d` });
        if (template.id === 'mental_training_phase') {
          out.push({
            template, variant: mode, durationDays: days, coldExposureUpgradeEnabled: true,
            label: `${template.id}/${mode}/${days}d/cold`,
          });
        }
      }
    }
  }
  return out;
}

const combos = everyCombination();
check('1: every startable challenge, mode and duration is covered', combos.length >= 40, `${combos.length} combinations`);

// ══ 2: the preview IS the attempt ══════════════════════════════════════════
// The payload the start flow sends is stamped the same way the preview stamps
// it, so advertised and installed cannot differ.
let mismatches = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  if (!pv) { mismatches.push(`${c.label}: no preview`); continue; }
  const payload = buildAttemptPayload(c);
  const started = stampAttempt({
    meta: { ...NEW_ATTEMPT_DEFAULTS, ...payload.challenge },
    tasks: payload.tasks,
    template: getTemplateById(payload.challenge.templateId),
  });
  for (const [i, t] of started.tasks.entries()) {
    if (pv.tasks[i]?.id !== t.id || pv.tasks[i]?.xp !== t.xp) {
      mismatches.push(`${c.label}: task ${t.id} previewed ${pv.tasks[i]?.xp} started ${t.xp}`);
    }
  }
  if (pv.meta.dailyBudget !== started.meta.dailyBudget) mismatches.push(`${c.label}: budget`);
  if (pv.completionBonus !== (started.meta.completionBonusXP || 0)) mismatches.push(`${c.label}: completion bonus`);
  const startedWeekly = getWeeklyRequirementDefs(started.meta);
  for (const [i, d] of startedWeekly.entries()) {
    if (pv.weekly[i]?.id !== d.id || pv.weekly[i]?.xp !== d.xp) {
      mismatches.push(`${c.label}: weekly ${d.id} previewed ${pv.weekly[i]?.xp} started ${d.xp}`);
    }
  }
}
check('2: previewed XP equals started XP for every combination',
  mismatches.length === 0, mismatches.slice(0, 3).join(' | '));

// ══ 3: the advertised daily total is the budget, and the tasks sum to it ═══
let budgetErrors = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  const sum = pv.tasks.reduce((s, t) => s + t.xp, 0);
  if (sum !== pv.dailyBudget) budgetErrors.push(`${c.label}: tasks ${sum} vs budget ${pv.dailyBudget}`);
  if (sum !== pv.dailyTaskXP) budgetErrors.push(`${c.label}: dailyTaskXP disagrees`);
  if (pv.tasks.some(t => !(t.xp > 0))) budgetErrors.push(`${c.label}: a task priced at zero`);
}
check('3: every advertised task list sums to exactly the daily budget',
  budgetErrors.length === 0, budgetErrors.slice(0, 3).join(' | '));

// ══ 4: the advertised budget is the tier and mode it claims ════════════════
let tierErrors = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  const expected = tierBudget(pv.tier, pv.mode || 'standard', ECONOMY_V2);
  if (pv.dailyBudget !== expected) {
    tierErrors.push(`${c.label}: ${pv.tier}/${pv.mode} budget ${pv.dailyBudget} vs ${expected}`);
  }
  if (pv.tierLabel && pv.tierLabel !== TIER_LABELS[pv.tier]) tierErrors.push(`${c.label}: label`);
}
check('4: the advertised budget is exactly tier × mode', tierErrors.length === 0, tierErrors.slice(0, 3).join(' | '));

// ══ 5: a perfect day pays the advertised daily figure ══════════════════════
// Run the real engine over a day with every required task ticked and compare
// with what the card promised.
let dayErrors = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  const dayData = { tasks: Object.fromEntries(pv.tasks.map(t => [t.id, true])) };
  const { gained } = computeDayXP(dayData, pv.tasks, 'me', 1, 1, false, 1, dayRules(pv.meta));
  const advertised = pv.dailyTaskXP + pv.perfectDayBonus;
  if (gained !== advertised) dayErrors.push(`${c.label}: engine ${gained} vs advertised ${advertised}`);
}
check('5: the engine pays the advertised daily task XP plus perfect-day bonus',
  dayErrors.length === 0, dayErrors.slice(0, 3).join(' | '));

// ══ 6: the advertised weekly XP is what the weekly engine makes available ══
let weeklyErrors = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  if (!pv.weekly.length || !pv.durationDays) continue;
  const res = computeWeeklyRequirements({
    sessions: [],
    meta: { ...pv.meta, weeklyRequirementsStartDate: '2020-01-01' },
    challengeStart: '2020-01-01',
    currentRawDay: pv.durationDays + 1,
    penaltiesEnabled: false,
  });
  if (res.availableXP !== pv.weeklyTotal) {
    weeklyErrors.push(`${c.label}: available ${res.availableXP} vs advertised ${pv.weeklyTotal}`);
  }
  const perWeek = pv.weekly.reduce((s, d) => s + d.xp * d.perWeek, 0);
  if (perWeek !== pv.weeklyPerWeek) weeklyErrors.push(`${c.label}: per-week figure`);
}
check('6: advertised weekly XP equals what the weekly engine makes available',
  weeklyErrors.length === 0, weeklyErrors.slice(0, 3).join(' | '));

// ══ 7: weekly requirements are repriced for EVERY attempt that has them ═══
// Fat Loss beginner and standard resolve their requirements from the legacy
// module constant rather than carrying their own, and were therefore skipped by
// a descriptor-only reprice — an era-2 attempt went on paying era-1 weekly XP.
const flStandard = previewAttempt({ template: getTemplateById('fat_loss_phase'), variant: 'standard', durationDays: 30 });
check('7: Fat Loss standard has weekly requirements', flStandard.weekly.length === 2);
check('7: and they are repriced onto its own weekly budget, not the era-1 constant',
  flStandard.weekly.every(d => d.xp !== 25 && d.xp !== 20),
  flStandard.weekly.map(d => `${d.id}=${d.xp}`).join(' '));
check('7: the weekly budget is the approved share of the daily budget',
  flStandard.weeklyPerWeek === Math.round(ECONOMY_V2.weeklySessionRate * flStandard.dailyBudget),
  `${flStandard.weeklyPerWeek} vs ${Math.round(ECONOMY_V2.weeklySessionRate * flStandard.dailyBudget)}`);
check('7: the repriced defs are stamped onto the attempt, so an archive keeps them',
  Array.isArray(flStandard.meta.weeklyRequirementDefs) && flStandard.meta.weeklyRequirementDefs.length === 2);

// ══ 8: previews react to every choice the user can make ═══════════════════
const mtBeg = previewAttempt({ template: getTemplateById('mental_training_phase'), variant: 'beginner', durationDays: 14 });
const mtStd = previewAttempt({ template: getTemplateById('mental_training_phase'), variant: 'standard', durationDays: 14 });
const mtHard = previewAttempt({ template: getTemplateById('mental_training_phase'), variant: 'hard', durationDays: 14 });
check('8: changing mode changes the advertised budget',
  mtBeg.dailyBudget < mtStd.dailyBudget && mtStd.dailyBudget < mtHard.dailyBudget,
  `${mtBeg.dailyBudget} / ${mtStd.dailyBudget} / ${mtHard.dailyBudget}`);
const mt14 = previewAttempt({ template: getTemplateById('mental_training_phase'), variant: 'standard', durationDays: 14 });
const mt30 = previewAttempt({ template: getTemplateById('mental_training_phase'), variant: 'standard', durationDays: 30 });
check('8: changing duration changes the advertised completion bonus',
  mt30.completionBonus > mt14.completionBonus && mt14.dailyBudget === mt30.dailyBudget,
  `${mt14.completionBonus} → ${mt30.completionBonus}`);
const mtCold = previewAttempt({
  template: getTemplateById('mental_training_phase'), variant: 'standard', durationDays: 14,
  coldExposureUpgradeEnabled: true,
});
check('8: the Cold Exposure Upgrade appears in the advertised list',
  mtCold.tasks.some(t => t.id === COLD_SHOWER_TASK.id) && !mtStd.tasks.some(t => t.id === COLD_SHOWER_TASK.id));
check('8: and it divides the same budget rather than adding to it',
  mtCold.dailyBudget === mtStd.dailyBudget &&
  mtCold.tasks.reduce((s, t) => s + t.xp, 0) === mtStd.tasks.reduce((s, t) => s + t.xp, 0),
  `${mtCold.dailyBudget} both`);
check('8: so every other requirement is repriced downward',
  mtCold.tasks.find(t => t.id === 'mt_mind').xp < mtStd.tasks.find(t => t.id === 'mt_mind').xp,
  `${mtStd.tasks.find(t => t.id === 'mt_mind').xp} → ${mtCold.tasks.find(t => t.id === 'mt_mind').xp}`);

const mbBase = previewConfigured(MB.MUSCLE_BUILDING_TEMPLATE_ID, MB.defaultSetup());
const mbOpt = previewConfigured(MB.MUSCLE_BUILDING_TEMPLATE_ID, {
  ...MB.defaultSetup(),
  optimizations: Object.fromEntries(MB.OPTIMIZATION_HABITS.map(h => [h.key, true])),
});
check('8: enabling optimization habits re-divides the same daily budget',
  mbOpt.dailyBudget === mbBase.dailyBudget && mbOpt.tasks.length > mbBase.tasks.length &&
  mbOpt.tasks.reduce((s, t) => s + t.xp, 0) === mbBase.dailyBudget,
  `${mbBase.tasks.length} → ${mbOpt.tasks.length} tasks, budget ${mbOpt.dailyBudget}`);
const optIds = new Set(MB.OPTIMIZATION_HABITS.map(h => h.id));
check('8: and an optimization is still worth less than every fundamental',
  Math.max(...mbOpt.tasks.filter(t => optIds.has(t.id)).map(t => t.xp)) <
  Math.min(...mbOpt.tasks.filter(t => !optIds.has(t.id)).map(t => t.xp)),
  `${Math.max(...mbOpt.tasks.filter(t => optIds.has(t.id)).map(t => t.xp))} vs ${Math.min(...mbOpt.tasks.filter(t => !optIds.has(t.id)).map(t => t.xp))}`);

const mb3 = previewConfigured(MB.MUSCLE_BUILDING_TEMPLATE_ID, { ...MB.defaultSetup(), trainingDaysPerWeek: 3 });
const mb6 = previewConfigured(MB.MUSCLE_BUILDING_TEMPLATE_ID, { ...MB.defaultSetup(), trainingDaysPerWeek: 6 });
check('8: more required sessions divide the same weekly budget, never inflate it',
  mb3.weeklyPerWeek === mb6.weeklyPerWeek && mb6.weekly[0].xp < mb3.weekly[0].xp,
  `${mb3.weekly[0].perWeek}×${mb3.weekly[0].xp} vs ${mb6.weekly[0].perWeek}×${mb6.weekly[0].xp}, both ${mb3.weeklyPerWeek}/week`);

for (const [mod, name] of [[ER, 'Energy Reset'], [LI, 'LOCK IN']]) {
  const ids = Object.keys(mod).includes('DURATION_OPTIONS') ? mod.DURATION_OPTIONS.map(o => o.days) : [];
  const bonuses = ids.map(d => previewConfigured(
    mod.ENERGY_RESET_TEMPLATE_ID || mod.LOCK_IN_TEMPLATE_ID, { durationDays: d },
  ).completionBonus);
  check(`8: ${name} advertises a different completion bonus per duration, rising with length`,
    bonuses.length > 1 && bonuses.every((b, i) => i === 0 || b > bonuses[i - 1]),
    bonuses.join(' < '));
}

// ══ 9: the difficulty rating matches the tier that prices the challenge ════
let ratingErrors = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  const shown = difficultyLabel(c.template, c.variant && c.template.effort_tier_by_variant ? c.variant : null);
  if (shown !== TIER_LABELS[pv.tier]) {
    ratingErrors.push(`${c.label}: shows "${shown}" but priced as ${pv.tier}`);
  }
}
check('9: the rating shown for a mode is the tier its XP is priced from',
  ratingErrors.length === 0, ratingErrors.slice(0, 3).join(' | '));

const mtRange = difficultyRange(getTemplateById('mental_training_phase'));
check('9: a template whose modes differ states the range before one is chosen',
  mtRange.spans && mtRange.label === 'Easy–Medium', mtRange.label);
check('9: and it is coloured by the top of that range', mtRange.tier === 'medium');
const flRange = difficultyRange(getTemplateById('fat_loss_phase'));
check('9: a template with one rating still states just that rating',
  !flRange.spans && flRange.label === 'Medium', flRange.label);

// ══ 10: optional XP ceilings are advertised, and are the approved ones ═════
let capErrors = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  if (pv.bonusPerDayCap !== Math.round(ECONOMY_V2.bonusPerDayRate * pv.dailyBudget)) {
    capErrors.push(`${c.label}: per-day cap`);
  }
  if (pv.durationDays &&
      pv.bonusAttemptCap !== Math.round(ECONOMY_V2.bonusPerAttemptRate * pv.dailyBudget * pv.durationDays)) {
    capErrors.push(`${c.label}: attempt cap`);
  }
}
check('10: the advertised optional-XP ceilings are the approved rates',
  capErrors.length === 0, capErrors.slice(0, 3).join(' | '));

const mtBonus = previewAttempt({ template: getTemplateById('mental_training_phase'), variant: 'standard', durationDays: 14 });
const biggestMission = Math.max(...getTemplateById('mental_training_phase').bonus_missions.map(b => b.xp));
check('10: a Bonus Mission worth more than the daily cap is flagged as capped',
  biggestMission > mtBonus.bonusPerDayCap,
  `mission ${biggestMission} vs cap ${mtBonus.bonusPerDayCap}`);

// ══ 11: no prose string advertises an XP figure any more ═══════════════════
// The hand-written numbers were the second source of truth that drifted.
let proseWithXP = [];
for (const t of CHALLENGE_TEMPLATES) {
  for (const [mode, v] of Object.entries(t.variants || {})) {
    for (const key of ['required_daily_tasks', 'weekly_requirements', 'optional_tasks']) {
      for (const line of (v[key] || [])) {
        if (/\d+\s*XP/i.test(String(line))) proseWithXP.push(`${t.id}/${mode}/${key}: ${line}`);
      }
    }
  }
}
check('11: no template prose advertises an XP figure', proseWithXP.length === 0, proseWithXP.slice(0, 3).join(' | '));

let pricedFromTasks = [];
for (const t of startable) {
  if (isConfigured(t)) continue;
  for (const mode of MODES) {
    const v = t.variants?.[mode];
    if (!v) continue;
    // A startable mode must have real tasks to price. Prose alone is what the
    // library used to show, and it is no longer a source of XP.
    if (t.id === DISCIPLINE_75_META.templateId) continue;   // its list is the profile's own
    const pv = previewAttempt({ template: t, variant: mode, durationDays: getDurationOptions(t)[0] });
    if (!pv?.tasks?.length) pricedFromTasks.push(`${t.id}/${mode}`);
  }
}
check('11: every startable mode has a real task list to price', pricedFromTasks.length === 0, pricedFromTasks.join(' | '));

// ══ 12: the projected perfect total is the sum of its advertised parts ═════
let projErrors = [];
for (const c of combos) {
  const pv = previewAttempt(c);
  if (!pv.durationDays) continue;
  const parts = pv.durationDays * (pv.dailyTaskXP + pv.perfectDayBonus)
    + pv.weeklyTotal + pv.streakXP + pv.completionBonus;
  if (parts !== pv.projectedPerfectTotal) projErrors.push(`${c.label}: ${parts} vs ${pv.projectedPerfectTotal}`);
  if (Number.isFinite(pv.streakCap) && pv.streakXP > pv.streakCap) projErrors.push(`${c.label}: streak over cap`);
}
check('12: the projected perfect total reconciles with its parts',
  projErrors.length === 0, projErrors.slice(0, 3).join(' | '));

// A perfect run through the real engine must reach the advertised total.
const mtMeta = mtStd.meta;
const days = {};
for (let i = 1; i <= mtStd.durationDays; i++) {
  days[i] = { tasks: Object.fromEntries(mtStd.tasks.map(t => [t.id, true])) };
}
const profiles = {
  me: {
    tasks: mtStd.tasks, activeChallenge: mtMeta, challengeStart: null,
    xpPenalties: false, xpStartDay: 1, xpOffset: 0,
  },
};
const totals = computeTotalXP({ me: days }, profiles, 'me', () => 100, mtStd.durationDays, mtStd.durationDays);
check('12: a flawless attempt through the engine earns the advertised total',
  totals.rawTotal === mtStd.projectedPerfectTotal,
  `engine ${totals.rawTotal} vs advertised ${mtStd.projectedPerfectTotal}`);

// ══ 13: era-1 attempts are untouched by any of this ════════════════════════
const era1 = stampAttempt({
  meta: { templateId: 'mental_training_phase', variant: 'standard', durationDays: 14 },
  tasks: getTemplateById('mental_training_phase').variants.standard.start_tasks,
  template: getTemplateById('mental_training_phase'),
  version: 1,
});
check('13: an era-1 attempt keeps its original task XP',
  era1.tasks.find(t => t.id === 'mt_mind').xp === 100, String(era1.tasks.find(t => t.id === 'mt_mind').xp));
check('13: and is still marked era 1', era1.meta.xpEconomyVersion === 1);
check('13: an era-1 attempt keeps the legacy weekly definitions',
  getWeeklyRequirementDefs(stampAttempt({
    meta: { templateId: 'fat_loss_phase', variant: 'standard', durationDays: 30 },
    tasks: getTemplateById('fat_loss_phase').variants.standard.start_tasks,
    template: getTemplateById('fat_loss_phase'),
    version: 1,
  }).meta).every(d => d.xp === 25 || d.xp === 20));

// ══ 14: Fat Loss hard builds its own attempt and is priced like the rest ═══
const flHard = previewAttempt({ template: getTemplateById('fat_loss_phase'), variant: 'hard', durationDays: FLH.HARD_DURATION_DAYS });
check('14: Fat Loss hard advertises its five weekly requirements', flHard.weekly.length === 5,
  `${flHard.weekly.length}`);
check('14: priced from its own weekly budget', flHard.weeklyPerWeek === Math.round(ECONOMY_V2.weeklySessionRate * flHard.dailyBudget),
  `${flHard.weeklyPerWeek}`);
check('14: and its daily list sums to its budget',
  flHard.tasks.reduce((s, t) => s + t.xp, 0) === flHard.dailyBudget, `${flHard.dailyBudget}`);
// The claim is about what the challenge REQUIRES, so it is the requirements
// that are checked. A rationale may still mention a deficit ("preserves muscle
// in a deficit") without asking anyone to count calories.
check('14: no advertised Fat Loss hard requirement asks for a calorie target',
  !flHard.tasks.some(t => /calorie|deficit/i.test(t.name)),
  flHard.tasks.filter(t => /calorie|deficit/i.test(t.name)).map(t => t.name).join(' '));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
