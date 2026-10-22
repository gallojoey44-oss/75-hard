/**
 * XP economy audit — stage 2: the real task lists, per template and mode.
 *
 * Variant-flow templates expose runtime tasks at variants[mode].start_tasks.
 * Configured templates build theirs from their own config module. Both paths
 * are exercised here so no number in the audit is hand-copied.
 */
import {
  CHALLENGE_TEMPLATES, FORGE_DAILY_META, FORGE_DAILY_TASKS,
  getDurationOptions, getDefaultDuration, getCompletionBonusForDuration,
  DAILY_LOG_TASK, COLD_SHOWER_TASK,
} from '/home/user/75-hard/src/data/challengeTemplates.js';
import { CONFIGURED_BUILDERS, isConfigured } from '/home/user/75-hard/src/data/configuredChallenges.js';
import { getTaskXP, getTaskKeystone } from '/home/user/75-hard/src/utils/gamification.js';

const L = [];
const log = (...a) => L.push(a.join(' '));
const sum = (ts) => (ts || []).reduce((s, t) => s + getTaskXP(t), 0);

function showTasks(ts, indent = '      ') {
  for (const x of ts || []) {
    log(`${indent}${String(getTaskXP(x)).padStart(3)}xp k${getTaskKeystone(x)}${x.keystoneHabit ? '*' : ' '} ${x.id} — ${x.name}`);
  }
}

for (const t of CHALLENGE_TEMPLATES) {
  log('='.repeat(78));
  const durs = getDurationOptions(t);
  log(`${t.id}  [${t.overall_difficulty}]  ${t.challenge_name}`);
  log(`  durations: ${durs.join('/') || '(none)'}  default=${getDefaultDuration(t) ?? '-'}  startable=${!!t.startable}  flow=${t.start_flow || 'variant-default'}`);
  log(`  rewards.xp=${t.rewards?.xp ?? 0}  bonus_by_duration=${JSON.stringify(t.completion_bonus_by_duration || null)}`);
  for (const d of durs) log(`    completionBonus(${d}d) = ${getCompletionBonusForDuration(t, d)}`);
  log(`  passing_score=${t.passing_score ?? 'default(70)'}  keystone_requirement=${t.keystone_requirement ?? 'default(65)'}`);

  const bm = t.bonus_missions || [];
  if (bm.length) {
    log(`  BONUS MISSIONS: n=${bm.length} totalXP=${bm.reduce((s, b) => s + (b.xp || 0), 0)}  [${bm.map(b => `${b.id}:${b.xp}`).join(' ')}]`);
  }

  if (isConfigured(t)) {
    const b = CONFIGURED_BUILDERS[t.id];
    if (!b) { log('  CONFIGURED but no builder registered'); continue; }
    try {
      const meta = b.buildMeta();
      const tasks = b.buildTasks();
      log(`  CONFIGURED default setup: duration=${meta.durationDays} completionBonusXP=${meta.completionBonusXP ?? meta.rewardXP ?? '-'} passingScore=${meta.passingScore ?? '-'} keystoneReq=${meta.keystoneRequirement ?? '-'}`);
      log(`  tasks n=${tasks.length} dailySum=${sum(tasks)}`);
      showTasks(tasks);
      if (meta.weeklyRequirements) log(`  weeklyRequirements: ${JSON.stringify(meta.weeklyRequirements)}`);
    } catch (e) {
      log(`  BUILDER ERROR: ${e.message}`);
    }
    continue;
  }

  for (const [mode, v] of Object.entries(t.variants || {})) {
    const ts = v.start_tasks || [];
    log(`  MODE ${mode} (difficulty=${v.difficulty}) tasks=${ts.length} dailySum=${sum(ts)}`);
    if (v.weekly_requirements) log(`    weekly_requirements(text): ${JSON.stringify(v.weekly_requirements)}`);
    showTasks(ts);
    if (!ts.length && v.required_daily_tasks) {
      log(`    (descriptive only, ${v.required_daily_tasks.length} required_daily_tasks strings — no start_tasks)`);
    }
  }
}

log('='.repeat(78));
log('FORGE DAILY (baseline, open-ended)');
log(`  tasks n=${FORGE_DAILY_TASKS.length} dailySum=${sum(FORGE_DAILY_TASKS)}`);
showTasks(FORGE_DAILY_TASKS);
log('');
log(`DAILY_LOG_TASK default: xp=${getTaskXP(DAILY_LOG_TASK)} id=${DAILY_LOG_TASK.id}`);
log(`COLD_SHOWER_TASK: xp=${getTaskXP(COLD_SHOWER_TASK)} id=${COLD_SHOWER_TASK.id}`);

console.log(L.join('\n'));
