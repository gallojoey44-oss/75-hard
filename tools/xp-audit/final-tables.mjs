/**
 * The finalized per-challenge XP breakdown, generated from the shipped code.
 * Markdown, so it can go straight into the proposal for review.
 */
import * as ER from '/home/user/75-hard/src/data/energyResetConfig.js';
import * as HH from '/home/user/75-hard/src/data/hormoneHealthConfig.js';
import * as LI from '/home/user/75-hard/src/data/lockInConfig.js';
import * as MB from '/home/user/75-hard/src/data/muscleBuildingConfig.js';
import * as FLH from '/home/user/75-hard/src/data/fatLossHardConfig.js';
import { CHALLENGE_TEMPLATES, FORGE_DAILY_TASKS, FORGE_DAILY_META } from '/home/user/75-hard/src/data/challengeTemplates.js';
import { stampAttempt } from '/home/user/75-hard/src/utils/xpAttempt.js';
import { dayRules, tierBudget, repriceWeeklyDefs, TIER_LABELS } from '/home/user/75-hard/src/data/xpEconomy.js';

const L = [];
const log = (...a) => L.push(a.join(''));
const stars = (k) => (k ? '⭐'.repeat(k) : '—');
const tpl = (id) => CHALLENGE_TEMPLATES.find(t => t.id === id);

function table({ name, tier, mode, duration, tasks, weeklyDefs = null, note = null }) {
  const base = { templateId: name, name, variant: mode, durationDays: duration };
  if (weeklyDefs) base.weeklyRequirementDefs = weeklyDefs;
  const st = stampAttempt({ meta: base, tasks, template: { effort_tier: tier } });
  const r = dayRules(st.meta);
  const b = st.meta.dailyBudget;
  log(`\n#### ${name} — ${TIER_LABELS[tier]} · ${mode} · ${duration ? duration + ' days' : 'open-ended'}`);
  if (note) log(`\n${note}`);
  log(`\n| XP | Keystone | Habit |`);
  log(`|---|---|---|`);
  for (const t of [...st.tasks].sort((a, c) => c.xp - a.xp)) {
    log(`| **${t.xp}** | ${stars(t.keystone || 0)} | ${(t.name || t.id).replace(/\|/g, '/')} |`);
  }
  log(`| **${st.tasks.reduce((s, t) => s + t.xp, 0)}** | | **= daily budget** |`);
  const lines = [
    `Perfect day **${b} + ${r.perfectDay} = ${b + r.perfectDay}**`,
    `missed day **−${r.missedDay}** (${Math.round((r.missedDay / (b + r.perfectDay)) * 100)}% of a perfect day)`,
  ];
  if (duration) lines.push(`completion bonus **${st.meta.completionBonusXP}**`);
  lines.push(`optional cap **${r.bonusPerDayCap}/day**`);
  log(`\n${lines.join(' · ')}`);
  if (st.meta.weeklyRequirementDefs) {
    const w = st.meta.weeklyRequirementDefs;
    log(`\nWeekly requirements: ${w.map(d => `${d.label || d.id} ${d.perWeek}× at ${d.xp} XP`).join(' · ')} — **${w.reduce((s, d) => s + d.perWeek * d.xp, 0)} XP/week**`);
  }
  if (duration) {
    const attempt = duration * (b + r.perfectDay) + st.meta.completionBonusXP + Math.min(
      r.streakLadder.filter(m => m.days <= duration).reduce((s, m) => s + m.xp, 0), r.streakCap);
    log(`\nA perfect attempt banks **${attempt.toLocaleString()} XP**.`);
  }
}

log('## Finalized per-challenge XP breakdown');
log('\nGenerated from the shipped code. Keystone weights 3.0 / 2.0 / 1.3 / 1.0,');
log('mode multipliers 0.85 / 1.00 / 1.08, unchanged daily budgets.');
log('\n| Tier | Beginner | Standard | Hard |');
log('|---|---|---|---|');
for (const t of ['easy', 'medium', 'medium_hard', 'hard', 'elite']) {
  log(`| ${TIER_LABELS[t]} | ${tierBudget(t, 'beginner')} | **${tierBudget(t, 'standard')}** | ${tierBudget(t, 'hard')} |`);
}

const L75 = [
  { id: 'workout', name: '45-minute workout complete' }, { id: 'diet', name: 'Diet followed' },
  { id: 'mental', name: 'Mental training complete' }, { id: 'water', name: 'Water goal hit' },
  { id: 'reading', name: '10 pages read' }, { id: 'photo', name: 'Progress photo taken' },
  { id: 'daily_log', name: 'Complete Daily Log', xp: 20 },
];
log('\n### The reference challenge');
table({ name: '75-Day Discipline Challenge', tier: 'hard', mode: 'standard', duration: 75, tasks: L75,
  note: 'The benchmark anchor. Forge\'s own standard variant — one workout, not canonical 75 Hard\'s two (§2). Its legacy tasks carry no keystone tiers, so they are weighted by the era-1 high-value scheme, which is why the top three are level.' });

log('\n### Configured challenges');
table({ name: 'LOCK IN', tier: 'medium_hard', mode: 'standard', duration: 14, tasks: LI.buildStartTasks() });
table({ name: 'Muscle Building', tier: 'medium_hard', mode: 'standard', duration: 60,
  tasks: MB.buildStartTasks(), weeklyDefs: MB.buildChallengeMeta().weeklyRequirementDefs });
table({ name: 'Energy Reset', tier: 'medium', mode: 'standard', duration: 10, tasks: ER.buildStartTasks() });
table({ name: "Women's Hormone Health", tier: 'medium', mode: 'standard', duration: 84,
  tasks: HH.buildStartTasks(), weeklyDefs: HH.weeklyRequirementDefs() });

log('\n### Variant challenges, every mode');
const mt = tpl('mental_training_phase');
for (const [mode, tier] of [['beginner', 'easy'], ['standard', 'medium'], ['hard', 'medium']]) {
  table({ name: 'Mental Training Phase', tier, mode, duration: 14, tasks: mt.variants[mode].start_tasks,
    note: mode === 'beginner' ? 'Moved to the Easy tier by the effort audit: about seven minutes of stated active work a day (§4).' : null });
}
const fl = tpl('fat_loss_phase');
for (const mode of ['beginner', 'standard', 'hard']) {
  const v = fl.variants[mode];
  table({ name: 'Fat Loss Challenge', tier: 'medium', mode, duration: 30, tasks: v.start_tasks,
    weeklyDefs: mode === 'hard' ? FLH.weeklyRequirementDefs() : [
      { id: 'lifting', label: 'Lifting', perWeek: 3, xp: 25, keystone: 2 },
      { id: 'zone2', label: 'Zone 2 Cardio', perWeek: 2, xp: 20, keystone: 2 },
    ] });
}

log('\n### The baseline');
table({ name: 'Forge Daily', tier: 'easy', mode: 'standard', duration: null, tasks: FORGE_DAILY_TASKS,
  note: 'Open-ended, so no completion bonus. A perfect year yields about 51,200 XP — Elite Warrior, not Unbreakable.' });

log('\n### Completion bonuses — duration-neutral');
log('\n`0.20 × daily budget × duration`, so the bonus is worth the same per day');
log('at every length and no duration can be farmed for a better rate.');
log('\n| Duration | Easy (120) | Medium (160) | Medium/Hard (180) | Hard (200) |');
log('|---|---|---|---|---|');
for (const d of [7, 10, 14, 21, 30, 56, 60, 75, 84, 90]) {
  const c = (t) => Math.round(0.20 * tierBudget(t, 'standard') * d);
  log(`| ${d} days | ${c('easy')} | ${c('medium')} | ${c('medium_hard')} | ${c('hard')} |`);
}
log('\nPer day, in every column: **24.0 / 32.0 / 36.0 / 40.0 XP**.');

console.log(L.join('\n'));
