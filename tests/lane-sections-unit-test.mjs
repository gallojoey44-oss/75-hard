/**
 * Primary + Support lane sections — task ownership and display grouping.
 *
 * This is a UI/organisation change over the EXISTING combination architecture.
 * These checks assert the grouping is a pure view (it never adds, removes or
 * rewrites a row), that ownership comes from lane provenance rather than task
 * names, that a shared habit appears exactly once, and that nothing about XP,
 * dedup, grading or keystones moved.
 */
import {
  LANE, lanesOfTask, taskInLane, isSharedTask, tasksForLane,
  groupTasksForDisplay, ownershipOf, OWNERSHIP, OWNERSHIP_LABEL,
  alsoSupportsLabel, supportsLabel, mergeSupportTasks, stripSupportTasks,
  hasSupportChallenge,
} from '../src/utils/challengeStack.js';
import { HABIT_KEYS } from '../src/data/habitKeys.js';
import {
  sortTasksByKeystone, getTaskKeystone, getTaskXP, keystoneHabitsOf,
  computeChallengeScore, computeDayXP,
} from '../src/utils/gamification.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

// A realistic Mental Training primary + Fat Loss support stack.
const MT = [
  { id: 'mt_meditate', name: 'Mental Training — 5 minutes', xp: 25, keystone: 3, keystoneHabit: true, habitKey: HABIT_KEYS.MEDITATION },
  { id: 'mt_read', name: 'Read 5 pages', xp: 15, keystone: 1, habitKey: HABIT_KEYS.READING },
  { id: 'mt_pray', name: 'Prayer', xp: 10, keystone: 1, habitKey: HABIT_KEYS.PRAYER },
  { id: 'mt_sleep', name: 'Sleep 7+ hours', xp: 20, keystone: 2, habitKey: HABIT_KEYS.SLEEP_TARGET, target: { value: 7, unit: 'hours', direction: 'atLeast' } },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 10, keystone: 1, habitKey: HABIT_KEYS.DAILY_LOG },
];
const FL = [
  { id: 'fl_protein', name: 'Hit protein: 140–175g', xp: 40, keystone: 3, keystoneHabit: true, habitKey: HABIT_KEYS.PROTEIN_TARGET },
  { id: 'fl_whole', name: 'Eat mostly whole foods (~90%)', xp: 40, keystone: 3, keystoneHabit: true, habitKey: HABIT_KEYS.WHOLE_FOODS },
  { id: 'fl_steps', name: 'Walk 10,000+ steps', xp: 30, keystone: 2, habitKey: HABIT_KEYS.DAILY_STEPS },
  { id: 'fl_sleep', name: 'Sleep 7.5–9 hours', xp: 25, keystone: 2, habitKey: HABIT_KEYS.SLEEP_TARGET, target: { value: 7.5, unit: 'hours', direction: 'atLeast' } },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 10, keystone: 1, habitKey: HABIT_KEYS.DAILY_LOG },
];

const { tasks: merged } = mergeSupportTasks(MT, FL);
const profile = {
  tasks: merged,
  activeChallenge: { templateId: 'mental_training_phase', name: 'Mental Training Phase', emoji: '🧠' },
  challengeStart: '2026-09-01',
  supportChallenge: { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', emoji: '⚡' },
  supportChallengeStart: '2026-09-01',
};

// ══ Ownership comes from provenance, never from names ══════════════════════
check('1: a task with no provenance defaults to primary',
  ownershipOf({ id: 'x', name: 'Anything' }) === OWNERSHIP.PRIMARY);
check('a user-added custom task is primary, whatever it is called',
  ownershipOf({ id: 'task_1', name: 'Walk 10,000+ steps', source: 'custom' }) === OWNERSHIP.PRIMARY);
check('ownership ignores the task NAME entirely',
  ownershipOf({ id: 'a', name: 'Fat Loss thing', challenges: ['primary'] }) === OWNERSHIP.PRIMARY &&
  ownershipOf({ id: 'b', name: 'Mental Training thing', challenges: ['support'] }) === OWNERSHIP.SUPPORT);
check('a two-lane task is SHARED',
  ownershipOf({ id: 'c', challenges: ['primary', 'support'] }) === OWNERSHIP.SHARED);
check('20: the three ownership labels are Primary / Support / Shared',
  OWNERSHIP_LABEL.primary === 'Primary' && OWNERSHIP_LABEL.support === 'Support' &&
  OWNERSHIP_LABEL.shared === 'Shared');

// ══ The grouping is a pure view ═══════════════════════════════════════════
const g = groupTasksForDisplay(merged, sortTasksByKeystone);
const rendered = [...g.primary, ...g.support];
check('every stored task is displayed exactly once',
  rendered.length === merged.length &&
  new Set(rendered.map(t => t.id)).size === merged.length,
  `${rendered.length} rendered vs ${merged.length} stored`);
check('the grouping invents no rows',
  rendered.every(t => merged.some(m => m.id === t.id)));
check('the grouping rewrites no rows',
  rendered.every(t => {
    const src = merged.find(m => m.id === t.id);
    return src.name === t.name && src.xp === t.xp && getTaskKeystone(src) === getTaskKeystone(t);
  }));
check('8: no task appears in both sections',
  !g.primary.some(p => g.support.some(s => s.id === p.id)));

// ══ 6/7/8: what lands where ═══════════════════════════════════════════════
check('6: primary-only tasks appear under Primary',
  ['mt_meditate', 'mt_read', 'mt_pray'].every(id => g.primary.some(t => t.id === id)));
check('6: primary-only tasks do NOT appear under Support',
  !['mt_meditate', 'mt_read', 'mt_pray'].some(id => g.support.some(t => t.id === id)));
check('7: support-only tasks appear under Support',
  ['fl_protein', 'fl_whole', 'fl_steps'].every(id => g.support.some(t => t.id === id)));
check('7: support-only tasks do NOT appear under Primary',
  !['fl_protein', 'fl_whole', 'fl_steps'].some(id => g.primary.some(t => t.id === id)));
check('8: the shared sleep habit renders exactly ONCE',
  rendered.filter(t => t.habitKey === HABIT_KEYS.SLEEP_TARGET).length === 1);
check('8: the shared Daily Log renders exactly ONCE',
  rendered.filter(t => t.id === 'daily_log').length === 1);
check('shared tasks are placed under PRIMARY, as specified',
  g.shared.every(t => g.primary.some(p => p.id === t.id)) &&
  !g.shared.some(t => g.support.some(s => s.id === t.id)));
check('the shared rows are the sleep habit and the daily log',
  g.shared.map(t => t.id).sort().join(',') === 'daily_log,mt_sleep');

// ══ Order ═════════════════════════════════════════════════════════════════
const primaryIds = g.primary.map(t => t.id);
check('primary-only tasks come before shared ones',
  Math.max(primaryIds.indexOf('mt_meditate'), primaryIds.indexOf('mt_read'), primaryIds.indexOf('mt_pray'))
    < Math.min(primaryIds.indexOf('mt_sleep'), primaryIds.indexOf('daily_log')));
check('2/3: the primary keystone leads its group', primaryIds[0] === 'mt_meditate');
check('existing importance ordering is preserved WITHIN each group',
  g.support.map(t => getTaskKeystone(t)).every((k, i, a) => i === 0 || a[i - 1] >= k),
  JSON.stringify(g.support.map(t => `${t.id}:${getTaskKeystone(t)}`)));
check('the support keystones lead the support group',
  ['fl_protein', 'fl_whole'].includes(g.support[0].id));

// ══ 9: the shared badge names the other challenge ═════════════════════════
const sharedTask = merged.find(t => t.id === 'mt_sleep');
check('9: a shared row is labelled as also supporting the other challenge',
  alsoSupportsLabel(sharedTask, profile) === 'Also supports Fat Loss Challenge');
check('9: a primary-only row gets no badge',
  alsoSupportsLabel(merged.find(t => t.id === 'mt_read'), profile) === null);
check('9: a support-only row gets no badge',
  alsoSupportsLabel(merged.find(t => t.id === 'fl_protein'), profile) === null);
check('the long-form supports label still works and is unchanged',
  supportsLabel(sharedTask, profile) === 'Supports: Mental Training Phase + Fat Loss Challenge');

// ══ 1: single-challenge behaviour is untouched ════════════════════════════
const soloProfile = { tasks: MT.map(t => ({ ...t, challenges: ['primary'] })), activeChallenge: profile.activeChallenge };
check('1: with no support challenge, nothing is stacked', !hasSupportChallenge(soloProfile));
const solo = groupTasksForDisplay(soloProfile.tasks, sortTasksByKeystone);
check('1: a solo challenge puts every task in the primary group',
  solo.primary.length === MT.length && solo.support.length === 0);
check('1: a solo challenge has no shared rows', solo.shared.length === 0);
check('1: solo ordering is exactly the existing keystone sort',
  JSON.stringify(solo.primary.map(t => t.id)) ===
  JSON.stringify(sortTasksByKeystone(soloProfile.tasks).map(t => t.id)));
check('1: every solo task is labelled Primary in Manage Tasks',
  soloProfile.tasks.every(t => ownershipOf(t) === OWNERSHIP.PRIMARY));

// Forge Daily / no challenge at all.
const baseline = groupTasksForDisplay([{ id: 'fd_sleep', name: 'Hit sleep goal', xp: 8 }], sortTasksByKeystone);
check('Forge Daily renders as a single unsectioned group',
  baseline.primary.length === 1 && baseline.support.length === 0);

// ══ 10-12: the combination architecture is NOT changed ════════════════════
check('10: a shared row counts toward BOTH lanes',
  taskInLane(sharedTask, LANE.PRIMARY) && taskInLane(sharedTask, LANE.SUPPORT));
check('10: per-challenge adherence still filters the one list',
  tasksForLane(merged, LANE.PRIMARY).some(t => t.id === 'mt_sleep') &&
  tasksForLane(merged, LANE.SUPPORT).some(t => t.id === 'mt_sleep'));
check('11: the shared row carries ONE XP value',
  typeof sharedTask.xp === 'number' && sharedTask.xp === 20);
check('11: the merged row keeps the PRIMARY id and XP — no re-pricing',
  sharedTask.id === 'mt_sleep' && sharedTask.xp === MT.find(t => t.id === 'mt_sleep').xp);
check('11: the stricter target won the merge (7.5h over 7h)',
  sharedTask.target.value === 7.5 && sharedTask.name === 'Sleep 7.5–9 hours');
check('12: there is exactly one row, so there is exactly one completion record',
  merged.filter(t => t.habitKey === HABIT_KEYS.SLEEP_TARGET).length === 1);

// XP is paid once because there is only one row to pay.
const day = (tasks) => ({ tasks, bonusDone: {}, mood: 0, energy: 0, sleep: 0, stress: 0, recovery: 0 });
const onlyShared = computeDayXP(day({ mt_sleep: true }), merged, 'me', 1, 1, false, 1);
check('11: completing the shared task awards its XP exactly once',
  onlyShared.gained === 20, `got ${onlyShared.gained}`);
const totalXP = merged.reduce((s, t) => s + getTaskXP(t), 0);
const allDone = Object.fromEntries(merged.map(t => [t.id, true]));
const perfect = computeDayXP(day(allDone), merged, 'me', 1, 1, false, 1);
check('11: a perfect stacked day pays each row once (+ the all-complete bonus)',
  perfect.gained === totalXP + 50, `${perfect.gained} vs ${totalXP} + 50`);

// ══ 13/14: keystones and XP unchanged ═════════════════════════════════════
check('13: the primary keystone keeps its keystone flag',
  merged.find(t => t.id === 'mt_meditate').keystoneHabit === true);
check('13: the support challenge keeps its OWN keystone habits',
  merged.filter(t => t.keystoneHabit && ownershipOf(t) === OWNERSHIP.SUPPORT)
    .map(t => t.id).sort().join(',') === 'fl_protein,fl_whole');
check('13: support keystones are not flattened by being support',
  merged.filter(t => ownershipOf(t) === OWNERSHIP.SUPPORT)
    .every(t => getTaskKeystone(t) === FL.find(f => f.id === t.id)?.keystone));
check('13: keystoneHabitsOf still sees every keystone across both lanes',
  keystoneHabitsOf(merged).length === 3);
check('14: every primary XP value is unchanged by stacking',
  MT.filter(t => t.id !== 'mt_sleep' && t.id !== 'daily_log')
    .every(t => merged.find(m => m.id === t.id).xp === t.xp));
check('14: every support-only XP value is its own',
  ['fl_protein', 'fl_whole', 'fl_steps']
    .every(id => merged.find(m => m.id === id).xp === FL.find(f => f.id === id).xp));

// ══ 15/16: grading and perfect-day logic unchanged ════════════════════════
const META = { templateId: 'mental_training_phase', durationDays: 14, weeklyRequirementsStartDate: '2099-01-01' };
const SUPPORT_META = { templateId: 'fat_loss_phase', name: 'Fat Loss Challenge', durationDays: 30, weeklyRequirementsStartDate: '2099-01-01' };
const profiles = { me: {
  challengeStart: '2026-01-01', tasks: merged, activeChallenge: META, xpPenalties: false,
  supportChallenge: SUPPORT_META, supportChallengeStart: '2026-01-01',
} };
const daysAll = {}; for (let i = 1; i <= 10; i++) daysAll[i] = day({ ...allDone });
const scored = computeChallengeScore({ me: daysAll }, profiles, 'me', 11);
check('15: a fully completed stacked run still grades 100%', scored.score === 100);
// Grading is already per-lane: the PRIMARY challenge is graded over the primary
// lane's rows, which includes the shared ones exactly once. The support lane is
// graded separately over its own filter of the same single list. That is the
// existing combination architecture and this change does not touch it.
const primaryXP = tasksForLane(merged, LANE.PRIMARY).reduce((s, t) => s + getTaskXP(t), 0);
const supportXP = tasksForLane(merged, LANE.SUPPORT).reduce((s, t) => s + getTaskXP(t), 0);
check('15: the primary grade is scoped to the primary lane',
  scored.requiredAvailable === 10 * primaryXP, `${scored.requiredAvailable} vs ${10 * primaryXP}`);
check('15: the shared row is counted inside the primary lane exactly once',
  tasksForLane(merged, LANE.PRIMARY).filter(t => t.id === 'mt_sleep').length === 1);
const supScore = computeChallengeScore({ me: daysAll }, profiles, 'me', 11, LANE.SUPPORT);
check('15: the support lane is graded over its own filter of the same list',
  supScore.requiredAvailable === 10 * supportXP, `${supScore.requiredAvailable} vs ${10 * supportXP}`);
check('15: the shared row counts toward the support grade too',
  supportXP > FL.filter(t => !['mt_sleep', 'daily_log'].includes(t.id)).length * 0);
check('16: the two lane grades overlap only on the shared rows',
  primaryXP + supportXP - totalXP === g.shared.reduce((s, t) => s + getTaskXP(t), 0),
  `${primaryXP} + ${supportXP} - ${totalXP}`);
const daysNoShared = {}; for (let i = 1; i <= 10; i++) { const a = { ...allDone }; delete a.mt_sleep; daysNoShared[i] = day(a); }
const scoredMiss = computeChallengeScore({ me: daysNoShared }, profiles, 'me', 11);
check('16: missing the shared task costs its XP once in the primary grade',
  scoredMiss.requiredEarned === 10 * (primaryXP - 20), `${scoredMiss.requiredEarned}`);
const supMiss = computeChallengeScore({ me: daysNoShared }, profiles, 'me', 11, LANE.SUPPORT);
check('10: and the SAME miss also costs the support grade — one action, both challenges',
  supMiss.requiredEarned === 10 * (supportXP - 20), `${supMiss.requiredEarned}`);
check('11: but total XP paid for it is still just once',
  computeDayXP(day({ mt_sleep: true }), merged, 'me', 1, 1, false, 1).gained === 20);

// ══ 21: existing combinations display safely ══════════════════════════════
const legacy = [
  { id: 'old_a', name: 'Legacy task' },                       // no provenance at all
  { id: 'old_b', name: 'Another', challenges: [] },           // empty provenance
  { id: 'old_c', name: 'Support-ish', challenges: ['support'] },
];
const legacyGroup = groupTasksForDisplay(legacy, sortTasksByKeystone);
check('21: a task with no provenance displays under Primary',
  legacyGroup.primary.some(t => t.id === 'old_a'));
check('21: an empty provenance array is treated as primary',
  legacyGroup.primary.some(t => t.id === 'old_b'));
check('21: a support-tagged legacy task displays under Support',
  legacyGroup.support.some(t => t.id === 'old_c'));
check('21: no legacy task is lost or duplicated',
  legacyGroup.primary.length + legacyGroup.support.length === 3);
check('21: grouping an empty list is safe',
  groupTasksForDisplay([]).primary.length === 0 && groupTasksForDisplay(null).support.length === 0);

// ══ Removing the support challenge reverts cleanly ════════════════════════
const stripped = stripSupportTasks(merged);
check('ending support leaves only the primary lane',
  stripped.every(t => ownershipOf(t) === OWNERSHIP.PRIMARY));
check('the shared row survives with its id, so its history resolves',
  stripped.some(t => t.id === 'mt_sleep'));
check('support-only rows are gone',
  !stripped.some(t => ['fl_protein', 'fl_whole', 'fl_steps'].includes(t.id)));
const back = groupTasksForDisplay(stripped, sortTasksByKeystone);
check('and the list renders unsectioned again',
  back.support.length === 0 && back.primary.length === stripped.length);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
