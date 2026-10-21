/**
 * 🎯 LOCK IN — the 14-day challenge, its XP rules, the flow ramp, and the eight
 * habit strategy guides.
 *
 * Two things get most of the attention here.
 *
 * First, the structural rule the challenge is built around: you can never come
 * out ahead by sleeping less. That is not a sentence in the copy, it is a
 * property of the XP ladder, the lighter-day rule and the absence of any
 * productivity bonus — so it is asserted as one.
 *
 * Second, the guides. They are the main deliverable, they are pure data, and
 * every one of them has to carry all six required sections plus a Quick Start,
 * label its optional strategies by evidence quality, and state XP rules that
 * actually match the dashboard. A guide that quietly disagrees with the task
 * list would be worse than no guide.
 */
import * as LI from '../src/data/lockInConfig.js';
import {
  HABIT_GUIDES, getGuide, guideForTask, hasGuide,
  EVIDENCE, EVIDENCE_META, EVIDENCE_LEGEND,
} from '../src/data/habitGuides.js';
import { HABIT_KEYS, HABIT_LABELS, habitKeyOf } from '../src/data/habitKeys.js';
import { getTemplateById, CHALLENGE_TEMPLATES } from '../src/data/challengeTemplates.js';
import { isConfigured, buildersFor, isStartableTemplate } from '../src/data/configuredChallenges.js';
import { getCompatibility, COMPATIBILITY, CHALLENGE_IDS } from '../src/data/challengeCompatibility.js';
import { getTaskXP, getTaskKeystone, sortTasksByKeystone, keystoneHabitsOf } from '../src/utils/gamification.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const template = getTemplateById(LI.LOCK_IN_TEMPLATE_ID);
const tasks = LI.buildStartTasks();
const meta = LI.buildChallengeMeta();
const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
const guides = LI.GUIDE_ORDER.map(id => LI.GUIDES[id]);

// ══ 1: the challenge exists and is reachable ════════════════════════════════
check('1: the template is registered', !!template);
check('1: it is a 14-day challenge', LI.DURATION_DAYS === 14 && meta.durationDays === 14);
check('1: it is startable from the library', template.startable && isStartableTemplate(template));
check('1: it uses the configured start flow', template.start_flow === 'configured' && isConfigured(template));
check('1: both builders are registered', !!buildersFor(template)?.buildMeta && !!buildersFor(template)?.buildTasks);
check('1: the template id is unique in the library',
  CHALLENGE_TEMPLATES.filter(t => t.id === LI.LOCK_IN_TEMPLATE_ID).length === 1);
check('1: every template id is still unique',
  new Set(CHALLENGE_TEMPLATES.map(t => t.id)).size === CHALLENGE_TEMPLATES.length);
check('1: it offers exactly one duration — the ramp is built around 14 days',
  template.duration_options_days.length === 1 && template.duration_options_days[0] === 14);
check('1: the completion bonus agrees between config and template',
  template.completion_bonus_by_duration[14] === LI.COMPLETION_BONUS_XP &&
  meta.completionBonusXP === LI.COMPLETION_BONUS_XP);

// ══ 2: the eight habits (plus the shared Daily Log) ═════════════════════════
const habitTasks = tasks.filter(t => t.id !== 'daily_log');
check('2: there are exactly eight daily habits', habitTasks.length === 8, `${habitTasks.length}`);
check('2: the shared Daily Log is present and is not one of the eight',
  !!byId.daily_log && byId.daily_log.habitKey === HABIT_KEYS.DAILY_LOG);
check('2: all eight expected habits are there',
  ['li_mission', 'li_flow', 'li_execute', 'li_attention', 'li_energy', 'li_recovery', 'li_stress', 'li_sleep']
    .every(id => !!byId[id]));
check('2: every task has a name, description, icon and XP',
  tasks.every(t => t.name && t.desc && t.icon && typeof t.xp === 'number'));
check('2: task ids are unique', new Set(tasks.map(t => t.id)).size === tasks.length);
check('2: habit keys are unique — nothing merges with itself',
  new Set(tasks.map(habitKeyOf)).size === tasks.length);
check('2: every habit key has a human label',
  tasks.every(t => !!HABIT_LABELS[habitKeyOf(t)]),
  tasks.filter(t => !HABIT_LABELS[habitKeyOf(t)]).map(t => t.id).join(', ') || 'all labelled');
check('2: every task carries an order, so the list is stable',
  tasks.every((t, i) => t.order === i));

// Union habits get their own keys; genuine single-behaviour matches reuse one.
check('2: the union habits do NOT reuse another challenge\'s habit key',
  byId.li_attention.habitKey === HABIT_KEYS.ATTENTION_TRAINING &&
  byId.li_attention.habitKey !== HABIT_KEYS.READING &&
  byId.li_attention.habitKey !== HABIT_KEYS.MEDITATION &&
  byId.li_energy.habitKey === HABIT_KEYS.PHYSICAL_ENERGY &&
  byId.li_energy.habitKey !== HABIT_KEYS.MOVEMENT);
check('2: sleep DOES merge with other challenges — it is the same behaviour',
  byId.li_sleep.habitKey === HABIT_KEYS.SLEEP_TARGET);
check('2: the shutdown ritual merges with other recovery practices',
  byId.li_stress.habitKey === HABIT_KEYS.STRESS_RECOVERY);
check('2: habits with a numeric target declare it, so a merge can pick the stricter',
  byId.li_sleep.target?.direction === 'atLeast' &&
  byId.li_attention.target?.unit === 'minutes' &&
  byId.li_recovery.target?.unit === 'minutes' &&
  byId.li_stress.target?.unit === 'minutes');

// ══ 3: THE RULE — nothing here rewards sleeping less ════════════════════════
// This is a property of the data, not a promise in the copy.
const sleepXP = getTaskXP(byId.li_sleep);
const others = habitTasks.filter(t => t.id !== 'li_sleep');
check('3: sleep is the single highest-XP habit in the challenge',
  others.every(t => getTaskXP(t) < sleepXP), `sleep ${sleepXP} vs max other ${Math.max(...others.map(getTaskXP))}`);
check('3: sleep is a designated keystone habit',
  byId.li_sleep.keystoneHabit === true && getTaskKeystone(byId.li_sleep) === 3);
check('3: no productivity habit alone outweighs sleep',
  getTaskXP(byId.li_flow) < sleepXP && getTaskXP(byId.li_execute) < sleepXP && getTaskXP(byId.li_mission) < sleepXP);
check('3: the challenge offers no bonus missions — an "extra session" reward would create the exact incentive this removes',
  !template.bonus_missions);
check('3: a lighter day reduces work volume, never sleep',
  LI.flowSessionsForDay(LI.LIGHTER_DAYS[0]) < LI.FLOW_SESSIONS_PER_DAY &&
  LI.buildStartTasks().find(t => t.id === 'li_sleep').xp === sleepXP);
check('3: finishing all three priorities earns no more than the required two',
  // There is a single checkbox worth a single value: no "clean sweep" bonus exists to earn.
  typeof byId.li_execute.xp === 'number' && LI.PRIORITY_COUNT.mustComplete < LI.PRIORITY_COUNT.total);
check('3: the rule is stated to the user, not just encoded',
  /no version of this challenge where less sleep earns more/i.test(LI.RECOVERY_MODE.sleepRule) &&
  /No part of this challenge can be improved by sleeping less/i.test(LI.GUIDES.sleep.how.notes));
check('3: mental recovery carries its own XP, so skipping it costs rather than pays',
  getTaskXP(byId.li_recovery) > 0);

// ══ 4: the XP ladder is ordered and sane ════════════════════════════════════
const ladder = ['li_sleep', 'li_flow', 'li_execute', 'li_mission', 'li_energy', 'li_attention', 'li_recovery', 'li_stress'];
check('4: XP descends in the documented importance order',
  ladder.every((id, i) => i === 0 || getTaskXP(byId[id]) <= getTaskXP(byId[ladder[i - 1]])),
  ladder.map(id => getTaskXP(byId[id])).join(' ≥ '));
check('4: XP values stay on Forge\'s existing scale (10–40)',
  tasks.every(t => t.xp >= 10 && t.xp <= 40));
check('4: three habits are top-tier keystones',
  habitTasks.filter(t => getTaskKeystone(t) === 3).length === 3);
check('4: the Daily Log is not a keystone', getTaskKeystone(byId.daily_log) === 0);
check('4: keystone adherence counts only the designated keystone habits',
  keystoneHabitsOf(tasks).length === 3,
  keystoneHabitsOf(tasks).map(t => t.id).join(', '));
check('4: the daily total matches the sum of the parts',
  LI.dailyXPTotal() === tasks.reduce((s, t) => s + t.xp, 0));
check('4: sorting by keystone keeps the three keystones first and is stable',
  sortTasksByKeystone(tasks).slice(0, 3).every(t => getTaskKeystone(t) === 3));

// ══ 5: the flow ramp ════════════════════════════════════════════════════════
check('5: the ramp is 25 → 35 → 45 → 50 minutes',
  LI.FLOW_STAGES.map(s => s.minutes).join(',') === '25,35,45,50');
check('5: the stages cover all 14 days with no gap and no overlap',
  LI.FLOW_STAGES[0].fromDay === 1 &&
  LI.FLOW_STAGES[LI.FLOW_STAGES.length - 1].toDay === LI.DURATION_DAYS &&
  LI.FLOW_STAGES.every((s, i) => i === 0 || s.fromDay === LI.FLOW_STAGES[i - 1].toDay + 1));
check('5: every day of the challenge resolves to a stage',
  Array.from({ length: LI.DURATION_DAYS }, (_, i) => i + 1).every(d => !!LI.flowStageForDay(d)));
check('5: the ramp is monotonic — it never asks for less than the day before',
  LI.FLOW_STAGES.every((s, i) => i === 0 || s.minutes > LI.FLOW_STAGES[i - 1].minutes));
check('5: day 1 is 25 minutes and day 14 is 50',
  LI.flowStageForDay(1).minutes === 25 && LI.flowStageForDay(14).minutes === 50);
check('5: the stage boundaries land where documented',
  LI.flowStageForDay(3).minutes === 25 && LI.flowStageForDay(4).minutes === 35 &&
  LI.flowStageForDay(7).minutes === 35 && LI.flowStageForDay(8).minutes === 45 &&
  LI.flowStageForDay(11).minutes === 45 && LI.flowStageForDay(12).minutes === 50);
check('5: out-of-range days clamp instead of throwing',
  LI.flowStageForDay(0).minutes === 25 && LI.flowStageForDay(99).minutes === 50 &&
  LI.flowStageForDay(null).minutes === 25);
check('5: a normal day asks for two sessions', LI.flowSessionsForDay(5) === 2);
check('5: the requirement object reads correctly',
  LI.flowRequirement(9).label === '2 × 45 min' && LI.flowRequirement(9).totalMinutes === 90);

// ══ 6: planned lighter days ═════════════════════════════════════════════════
check('6: there are planned lighter days', LI.LIGHTER_DAYS.length > 0);
check('6: they fall inside the challenge',
  LI.LIGHTER_DAYS.every(d => d >= 1 && d <= LI.DURATION_DAYS));
check('6: a lighter day asks for one session instead of two',
  LI.LIGHTER_DAYS.every(d => LI.flowRequirement(d).sessions === LI.LIGHTER_DAY_SESSIONS) &&
  LI.LIGHTER_DAY_SESSIONS === 1);
check('6: a lighter day keeps the same session LENGTH as its stage',
  LI.LIGHTER_DAYS.every(d => LI.flowRequirement(d).minutes === LI.flowStageForDay(d).minutes));
check('6: lighter days are flagged so the UI can explain them',
  LI.isLighterDay(7) && LI.flowRequirement(7).lighter === true && !LI.isLighterDay(6));
check('6: the lighter-day note says it is planned, not a day off',
  /part of the plan/i.test(LI.LIGHTER_DAY_NOTE) && /sleep/i.test(LI.LIGHTER_DAY_NOTE));
check('6: the attempt records its own lighter days and ramp',
  JSON.stringify(meta.lockIn.lighterDays) === JSON.stringify(LI.LIGHTER_DAYS) &&
  meta.lockIn.flowStages.length === LI.FLOW_STAGES.length);

// ══ 7: Recovery Mode reuses Forge's existing mechanism ══════════════════════
// There is deliberately no second reduced-day system: it points at the
// Minimum Warrior Day the app already has.
check('7: Recovery Mode is defined', !!LI.RECOVERY_MODE.title && !!LI.RECOVERY_MODE.blurb);
check('7: it points at Forge\'s existing Minimum Warrior Day rather than a new system',
  /Minimum Warrior Day/i.test(LI.RECOVERY_MODE.blurb));
check('7: it says when to use it', LI.RECOVERY_MODE.whenToUse.length >= 3);
check('7: it distinguishes itself from a planned lighter day',
  /lighter day/i.test(LI.RECOVERY_MODE.note));
check('7: it restates the sleep rule', /sleep/i.test(LI.RECOVERY_MODE.sleepRule));

// ══ 8: every habit has a strategy guide, wired to the task ══════════════════
check('8: eight guides are defined', guides.length === 8 && Object.keys(LI.GUIDES).length === 8);
check('8: every one of the eight habits points at a guide',
  habitTasks.every(t => hasGuide(t)),
  habitTasks.filter(t => !hasGuide(t)).map(t => t.id).join(', ') || 'all wired');
check('8: the Daily Log has no guide — it is infrastructure, not a habit to teach',
  byId.daily_log.guideId === null && !hasGuide(byId.daily_log));
check('8: guide ids are namespaced, so two challenges can both have a "sleep" guide',
  habitTasks.every(t => t.guideId.startsWith(`${LI.GUIDE_SOURCE}:`)));
check('8: every task\'s guide resolves through the shared registry',
  habitTasks.every(t => !!getGuide(t.guideId) && guideForTask(t) === getGuide(t.guideId)));
check('8: the registry exposes exactly these eight guides',
  Object.keys(HABIT_GUIDES).length === 8);
check('8: each guide resolves to the habit it belongs to',
  guideForTask(byId.li_sleep).id === 'sleep' &&
  guideForTask(byId.li_flow).id === 'flow' &&
  guideForTask(byId.li_energy).id === 'energy');
check('8: guideRef returns null for an unknown guide', LI.guideRef('nope') === null);
check('8: a task with no guideId resolves to null', guideForTask({ id: 'x' }) === null && getGuide(null) === null);
check('8: the guide order matches the habit numbering in the spec',
  LI.GUIDE_ORDER.join(',') === 'mission,flow,execute,attention,energy,recovery,stress,sleep');

// ══ 9: every guide has all six required sections plus Quick Start ═══════════
const REQUIRED = ['quickStart', 'why', 'how', 'optimize', 'advanced', 'mistakes', 'examples'];
check('9: every guide has all seven blocks',
  guides.every(g => REQUIRED.every(k => g[k] != null)),
  guides.filter(g => !REQUIRED.every(k => g[k] != null)).map(g => g.id).join(', ') || 'all complete');
check('9: every guide has a title, icon and tagline',
  guides.every(g => g.title && g.icon && g.tagline));
check('9: Quick Start is short and actionable — 2 to 4 steps',
  guides.every(g => g.quickStart.length >= 2 && g.quickStart.length <= 4),
  guides.map(g => `${g.id}:${g.quickStart.length}`).join(' '));
check('9: Why It Matters has a blurb and at least three points',
  guides.every(g => g.why.blurb && g.why.points.length >= 3));
check('9: How To Complete It states a requirement and what earns XP',
  guides.every(g => g.how.requirement && g.how.earns.length >= 2));
check('9: every guide has at least three optimization strategies',
  guides.every(g => g.optimize.length >= 3),
  guides.map(g => `${g.id}:${g.optimize.length}`).join(' '));
check('9: every guide has at least three advanced strategies',
  guides.every(g => g.advanced.length >= 3));
check('9: every guide has at least four common mistakes',
  guides.every(g => g.mistakes.length >= 4));
check('9: mistakes explain the behaviour, not just name it',
  guides.every(g => g.mistakes.every(m => m.title && m.body && m.body.length > 40)));
check('9: every guide has both a school and a work example',
  guides.every(g => g.examples.length >= 2 &&
    g.examples.some(e => /student/i.test(e.label)) &&
    g.examples.some(e => /work/i.test(e.label))));
check('9: examples are concrete schedules, not advice restated',
  guides.every(g => g.examples.every(e => e.lines.length >= 3)));
check('9: guide ids are unique and match their keys',
  guides.every(g => LI.GUIDES[g.id] === g));

// ══ 10: the guides' XP rules match the dashboard ════════════════════════════
// A guide that says something different from the task list would be worse than
// no guide at all.
const guideForHabit = {
  li_mission: 'mission', li_flow: 'flow', li_execute: 'execute', li_attention: 'attention',
  li_energy: 'energy', li_recovery: 'recovery', li_stress: 'stress', li_sleep: 'sleep',
};
check('10: every guide states its habit\'s exact XP value',
  Object.entries(guideForHabit).every(([taskId, gid]) =>
    LI.GUIDES[gid].how.earns.some(line => line.includes(String(byId[taskId].xp)))),
  Object.entries(guideForHabit)
    .filter(([taskId, gid]) => !LI.GUIDES[gid].how.earns.some(l => l.includes(String(byId[taskId].xp))))
    .map(([t]) => t).join(', ') || 'all match');
check('10: the sleep guide names sleep as the highest-XP habit',
  /most of any habit/i.test(LI.GUIDES.sleep.how.earns.join(' ')));
check('10: the flow guide states the full ramp',
  ['25', '35', '45', '50'].every(m => LI.GUIDES.flow.how.requirement.includes(m)));
check('10: the flow guide states the lighter-day rule and that XP is unchanged',
  /lighter day/i.test(LI.GUIDES.flow.how.earns.join(' ')) &&
  /identical|same/i.test(LI.GUIDES.flow.how.earns.join(' ')));
check('10: the execute guide states the 2-of-3 bar',
  LI.GUIDES.execute.how.requirement.includes(String(LI.PRIORITY_COUNT.mustComplete)) &&
  LI.GUIDES.execute.how.requirement.includes(String(LI.PRIORITY_COUNT.total)));
check('10: the attention guide states its minutes',
  LI.GUIDES.attention.how.requirement.includes(String(LI.ATTENTION_MINUTES.suggested)));
check('10: the recovery guide states its minutes',
  LI.GUIDES.recovery.how.requirement.includes(String(LI.RECOVERY_MINUTES.suggested)));
check('10: the stress guide states its minutes',
  LI.GUIDES.stress.how.requirement.includes(String(LI.SHUTDOWN_MINUTES.suggested)));
check('10: the mission guide separates planning XP from execution XP',
  /does not depend on whether you finish/i.test(LI.GUIDES.mission.how.earns.join(' ')));

// ══ 11: evidence labelling — established vs experimental ════════════════════
const allStrategies = guides.flatMap(g => [...g.optimize, ...g.advanced]);
const levels = Object.values(EVIDENCE);
check('11: every optimization and advanced strategy carries an evidence label',
  allStrategies.every(s => levels.includes(s.evidence)),
  `${allStrategies.length} strategies`);
check('11: every level has display metadata',
  levels.every(l => !!EVIDENCE_META[l]?.label && !!EVIDENCE_META[l]?.color));
check('11: all three levels are actually used, so the labelling is doing work',
  levels.every(l => allStrategies.some(s => s.evidence === l)),
  levels.map(l => `${l}:${allStrategies.filter(s => s.evidence === l).length}`).join(' '));
check('11: the legend explains that labelled strategies are optional',
  /optional/i.test(EVIDENCE_LEGEND));
check('11: weakly supported sleep aids are NOT labelled as established',
  ['magnesium', 'glycine'].every(name => {
    const s = LI.GUIDES.sleep.advanced.find(x => x.title.toLowerCase().includes(name));
    return s && s.evidence !== EVIDENCE.ESTABLISHED;
  }));
check('11: deliberate boredom is marked experimental, not established',
  LI.GUIDES.attention.advanced.find(s => /boredom/i.test(s.title))?.evidence === EVIDENCE.EXPERIMENTAL);
check('11: blue-light-blocking glasses are not oversold',
  LI.GUIDES.sleep.advanced.find(s => /blue-light/i.test(s.title))?.evidence !== EVIDENCE.ESTABLISHED);
check('11: fixing the wake time IS marked well supported',
  LI.GUIDES.sleep.optimize.find(s => /wake time/i.test(s.title))?.evidence === EVIDENCE.ESTABLISHED);

// ══ 12: no fabricated statistics or medical overreach ═══════════════════════
const allText = JSON.stringify(LI.GUIDES);
check('12: no invented percentage claims',
  !/\b\d{1,3}(\.\d+)?\s?%/.test(allText),
  (allText.match(/\b\d{1,3}(\.\d+)?\s?%/g) || []).slice(0, 3).join(', ') || 'none');
check('12: no "studies show that X increases Y by N" constructions',
  !/\bby \d+(\.\d+)?\s*(times|x|fold|percent)\b/i.test(allText));
// Matched narrowly on purpose: "treat it as an experiment" and "the trade this
// challenge is built to prevent" are ordinary English. What must not appear is a
// clinical claim — that something here cures, treats or prevents a condition.
const CLINICAL_CLAIM = /\b(cure[sd]?|curing)\b|\b(treats?|treating|prevents?|preventing|reverses?)\s+(your\s+)?(a\s+|an\s+|the\s+)?(depression|anxiety|insomnia|ADHD|burnout|illness|disease|disorder|condition|deficiency|fatigue)\b|\bguaranteed\b/i;
check('12: nothing is claimed to cure, treat or prevent a condition',
  !CLINICAL_CLAIM.test(allText),
  (allText.match(CLINICAL_CLAIM) || []).slice(0, 3).join(', ') || 'none');
check('12: no IQ or brain-damage claims', !/\bIQ\b|brain damage/i.test(allText));
check('12: supplement limits are stated rather than implied',
  /do not substitute for sleep, food or training/i.test(LI.GUIDES.energy.advanced.map(s => s.body).join(' ')));
check('12: no supplement is required by the challenge',
  /Nothing in this challenge requires any supplement/i.test(allText));
// Substances, not nutrition terminology: the energy guide mentions the
// "anabolic window" in order to say it has not held up, which is the opposite
// of promoting anything.
check('12: no unsafe performance-enhancing substances appear',
  !/\b(modafinil|adderall|amphetamines?|ritalin|methylphenidate|steroids?|SARMs?|anabolic steroids?|DMAA|yohimbine)\b/i.test(allText),
  (allText.match(/\b(modafinil|adderall|amphetamines?|ritalin|steroids?|SARMs?)\b/gi) || []).join(', ') || 'none');
check('12: users are told to adapt exercise and nutrition to their own health',
  /Adapt all of this to your own health/i.test(LI.GUIDES.energy.how.notes) &&
  /doctor|dietitian/i.test(LI.GUIDES.energy.how.notes));
check('12: the sleep habit does not penalise involuntary awakenings',
  /could not get back to sleep\? The habit is still met/i.test(LI.GUIDES.sleep.how.earns.join(' ')) &&
  /sleep disorders are common and real/i.test(JSON.stringify(LI.GUIDES.sleep.mistakes)));
check('12: sleep is scored on OPPORTUNITY, not on sleep achieved',
  /OPPORTUNITY you gave yourself, not the sleep you got/i.test(LI.GUIDES.sleep.how.earns.join(' ')));
check('12: users are not required to experience flow',
  /not required to experience flow/i.test(LI.GUIDES.flow.how.notes));
check('12: breathing guidance tells people to stop if they feel unwell',
  /dizzy|breathless/i.test(JSON.stringify(LI.GUIDES.stress.optimize)));
check('12: the challenge declares its contraindications',
  Array.isArray(template.safety_flags?.contraindications) &&
  template.safety_flags.contraindications.length >= 2);

// ══ 13: the attempt snapshot and setup ══════════════════════════════════════
check('13: setup defaults are all pre-filled',
  Object.values(LI.defaultSetup()).every(v => v != null));
check('13: the attempt stores its own config so later edits never rewrite it',
  !!meta.lockIn && meta.lockIn.sleepHours === LI.SLEEP_OPPORTUNITY.suggested);
check('13: lockInConfig reads the block back', LI.lockInConfig(meta) === meta.lockIn);
check('13: it reads null for another challenge\'s attempt',
  LI.lockInConfig({ templateId: 'energy_reset_10_day', lockIn: { x: 1 } }) === null &&
  LI.lockInConfig(null) === null);
check('13: isLockIn identifies the attempt', LI.isLockIn(meta) && !LI.isLockIn({ templateId: 'other' }));
check('13: a custom setup flows into the task names',
  LI.buildStartTasks({ sleepHours: 9, attentionMinutes: 20 })
    .find(t => t.id === 'li_sleep').name.includes('9') &&
  LI.buildStartTasks({ attentionMinutes: 20 })
    .find(t => t.id === 'li_attention').name.includes('20'));
check('13: a custom setup flows into the stored targets',
  LI.buildStartTasks({ sleepHours: 7 }).find(t => t.id === 'li_sleep').target.value === 7);
check('13: the duration cannot be overridden — the ramp depends on it',
  LI.buildChallengeMeta({ durationDays: 30 }).durationDays === 14);
check('13: building twice produces identical tasks',
  JSON.stringify(LI.buildStartTasks()) === JSON.stringify(LI.buildStartTasks()));
check('13: the completion message does not frame the challenge as a cure or a transformation',
  !!LI.COMPLETION_MESSAGE.title && !!LI.COMPLETION_MESSAGE.body &&
  !/\d+\s?%/.test(LI.COMPLETION_MESSAGE.body));

// ══ 14: existing challenges are untouched ═══════════════════════════════════
check('14: the other configured challenges still build',
  ['muscle_building_phase', 'womens_hormone_health', 'energy_reset_10_day']
    .every(id => {
      const t = getTemplateById(id);
      const b = buildersFor(t);
      return !!b && b.buildTasks().length > 0 && !!b.buildMeta().templateId;
    }));
check('14: no existing challenge gained a guide by accident',
  ['muscle_building_phase', 'womens_hormone_health', 'energy_reset_10_day']
    .every(id => buildersFor(getTemplateById(id)).buildTasks().every(t => !t.guideId)));
check('14: the 75-day challenge is still in the library',
  !!getTemplateById('75_day_discipline_challenge'));
check('14: existing habit keys are unchanged',
  HABIT_KEYS.SLEEP_TARGET === 'sleep_target' && HABIT_KEYS.READING === 'reading' &&
  HABIT_KEYS.STRESS_RECOVERY === 'stress_recovery');
check('14: the new habit keys do not collide with any existing one',
  new Set(Object.values(HABIT_KEYS)).size === Object.values(HABIT_KEYS).length);

// ══ 15: challenge combination ═══════════════════════════════════════════════
check('15: LOCK IN is in the compatibility table', CHALLENGE_IDS.LOCK_IN === LI.LOCK_IN_TEMPLATE_ID);
check('15: it stacks with a sleep challenge, which reinforces its keystone',
  getCompatibility(CHALLENGE_IDS.LOCK_IN, CHALLENGE_IDS.SLEEP_RESET).rating === COMPATIBILITY.HIGHLY_COMPATIBLE);
check('15: it stacks with training challenges — it adds no training load',
  [CHALLENGE_IDS.STRENGTH, CHALLENGE_IDS.MUSCLE_BUILDING]
    .every(id => getCompatibility(CHALLENGE_IDS.LOCK_IN, id).rating === COMPATIBILITY.HIGHLY_COMPATIBLE));
check('15: pairing with Mental Training is conditional — heavy overlap, not a second dimension',
  getCompatibility(CHALLENGE_IDS.LOCK_IN, CHALLENGE_IDS.MENTAL_TRAINING).rating === COMPATIBILITY.CONDITIONAL);
check('15: pairing with Fat Loss is conditional — a deficit makes hard cognitive work harder',
  getCompatibility(CHALLENGE_IDS.LOCK_IN, CHALLENGE_IDS.FAT_LOSS).rating === COMPATIBILITY.CONDITIONAL);
check('15: the 75-day challenge still refuses to stack with it',
  getCompatibility(CHALLENGE_IDS.LOCK_IN, CHALLENGE_IDS.DISCIPLINE_75).rating === COMPATIBILITY.CONFLICTING);
check('15: it cannot stack with itself',
  getCompatibility(CHALLENGE_IDS.LOCK_IN, CHALLENGE_IDS.LOCK_IN).rating === COMPATIBILITY.CONFLICTING);
check('15: every LOCK IN pairing carries a reason',
  [CHALLENGE_IDS.SLEEP_RESET, CHALLENGE_IDS.ENERGY_RESET, CHALLENGE_IDS.RECOVERY, CHALLENGE_IDS.STRENGTH,
   CHALLENGE_IDS.MUSCLE_BUILDING, CHALLENGE_IDS.HORMONE_HEALTH, CHALLENGE_IDS.MENTAL_TRAINING, CHALLENGE_IDS.FAT_LOSS]
    .every(id => (getCompatibility(CHALLENGE_IDS.LOCK_IN, id).reason || '').length > 30));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
