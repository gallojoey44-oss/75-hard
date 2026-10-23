/**
 * Every challenge's actual XP, as Markdown.
 *
 * Generated from the SHIPPED engine through `previewAttempt`, which is the same
 * call the Challenge Library renders from — so this document and the app cannot
 * disagree. Regenerate it after any economy change; if a figure here no longer
 * matches, the document is stale, not the code.
 *
 *   ./node_modules/.bin/esbuild tools/xp-audit/challenge-xp-tables.mjs \
 *     --bundle --platform=node --format=esm --outfile=/tmp/t.mjs && node /tmp/t.mjs
 */
import { CHALLENGE_TEMPLATES, getDurationOptions, getDefaultDuration, difficultyLabel }
  from '/home/user/75-hard/src/data/challengeTemplates.js';
import { isConfigured, isStartableTemplate } from '/home/user/75-hard/src/data/configuredChallenges.js';
import { previewAttempt } from '/home/user/75-hard/src/data/challengeAttempt.js';
import { DISCIPLINE_75_META, discipline75Tasks } from '/home/user/75-hard/src/context/AppContext.jsx';

const DEFAULT_75_TASKS = discipline75Tasks('me');
import { FORGE_DAILY_META, FORGE_DAILY_TASKS } from '/home/user/75-hard/src/data/challengeTemplates.js';
import { ECONOMY_V2, TIER_LABELS } from '/home/user/75-hard/src/data/xpEconomy.js';
import * as MB from '/home/user/75-hard/src/data/muscleBuildingConfig.js';

const MODES = ['beginner', 'standard', 'hard'];
const n = (x) => (x == null ? '—' : Number(x).toLocaleString());
const L = [];
const say = (s = '') => L.push(s);

say('# Forge challenge XP — every figure, as implemented');
say();
say('Generated from the shipped engine by `tools/xp-audit/challenge-xp-tables.mjs`.');
say('Each challenge is previewed exactly as the Challenge Library previews it, so');
say('these are the figures the app advertises **and** awards.');
say();
say('Difficulty sets a daily XP budget and the requirements divide it, so a');
say('challenge is worth its tier per day regardless of how many boxes it has.');
say();
say('| Rate | Value |');
say('|---|---|');
say(`| Daily budget by tier | ${Object.entries(ECONOMY_V2.tiers).map(([k, v]) => `${TIER_LABELS[k]} ${v}`).join(' · ')} |`);
say(`| Mode multiplier | Beginner ${ECONOMY_V2.modes.beginner} · Standard ${ECONOMY_V2.modes.standard} · Hard ${ECONOMY_V2.modes.hard} |`);
say(`| Perfect day | ${ECONOMY_V2.perfectDayRate * 100}% of the daily budget |`);
say(`| Completion bonus | ${ECONOMY_V2.completionRate * 100}% × budget × days |`);
say(`| Weekly requirements | ${ECONOMY_V2.weeklySessionRate * 100}% of the daily budget, per week |`);
say(`| Optional (Bonus Mission) XP | ${ECONOMY_V2.bonusPerDayRate * 100}% of budget per day, ${ECONOMY_V2.bonusPerAttemptRate * 100}% × budget × days per attempt |`);
say(`| Streak milestones | ${ECONOMY_V2.streakLadder.map(m => `${m.days}d +${m.xp}`).join(' · ')}, capped at ${ECONOMY_V2.streakCapRate * 100}% × budget × days |`);
say(`| Missed day | −${ECONOMY_V2.missedDayRate * 100}% of the daily budget |`);
say(`| Missed single requirement | −${ECONOMY_V2.taskMissRate * 100}% of that requirement |`);
say(`| Keystone weights | ${Object.entries(ECONOMY_V2.weights).map(([k, v]) => `${k}★ ${v}`).join(' · ')} |`);
say();

/** One challenge at one setting. */
function block(title, pv, note = '') {
  if (!pv) return;
  say(`### ${title}`);
  say();
  say(`**${pv.tierLabel} tier${pv.mode ? ` · ${pv.mode} mode ×${pv.modeMultiplier}` : ''} · ` +
    `${pv.durationDays ? `${pv.durationDays} days` : 'open-ended'} · daily budget ${n(pv.dailyBudget)} XP**`);
  if (note) { say(); say(note); }
  say();
  say('| Requirement | Keystone | XP |');
  say('|---|---|---|');
  for (const t of pv.tasks) {
    say(`| ${t.icon || ''} ${t.name} | ${'★'.repeat(t.keystone || 0) || '—'} | ${n(t.xp)} |`);
  }
  say(`| **Daily total** | | **${n(pv.dailyTaskXP)}** |`);
  say();
  if (pv.weekly.length) {
    say('| Weekly requirement | Per week | XP each | XP / week |');
    say('|---|---|---|---|');
    for (const d of pv.weekly) {
      say(`| ${d.icon || ''} ${d.label} | ${d.perWeek}× | ${n(d.xp)} | ${n(d.xp * d.perWeek)} |`);
    }
    say(`| **Weekly total** | | | **${n(pv.weeklyPerWeek)}** |`);
    say();
  }
  say('| Bonus / ceiling | Value |');
  say('|---|---|');
  say(`| Perfect day | +${n(pv.perfectDayBonus)} |`);
  if (pv.streakXP) say(`| Streak milestones (whole attempt) | +${n(pv.streakXP)}${Number.isFinite(pv.streakCap) ? ` (cap ${n(pv.streakCap)})` : ''} |`);
  if (pv.completionBonus) say(`| Completion bonus | +${n(pv.completionBonus)} |`);
  if (pv.weeklyTotal) say(`| Weekly requirements (whole attempt) | +${n(pv.weeklyTotal)} |`);
  say(`| Optional XP ceiling | ${n(pv.bonusPerDayCap)} / day${Number.isFinite(pv.bonusAttemptCap) ? `, ${n(pv.bonusAttemptCap)} / attempt` : ''} |`);
  say(`| Faith reflection | +${n(pv.faithBonus)} |`);
  say(`| Minimum Warrior Day | ${n(pv.recoveryDayXP)} |`);
  say(`| Each missed day | −${n(pv.missedDayPenalty)} |`);
  say(`| Worst case for one day | −${n(pv.dayLossCap)} |`);
  if (pv.projectedPerfectTotal != null) {
    say(`| **Perfect completion total** | **${n(pv.projectedPerfectTotal)}** |`);
  }
  say();
}

say('---');
say();
say('## Summary — every startable challenge at its default setting');
say();
say('| Challenge | Mode | Days | Tier | Daily | Perfect day | Weekly/wk | Streaks | Completion | Perfect total |');
say('|---|---|---|---|---|---|---|---|---|---|');
const rows = [];
for (const t of CHALLENGE_TEMPLATES.filter(isStartableTemplate)) {
  if (isConfigured(t)) {
    const pv = previewAttempt({ template: t });
    rows.push([t.challenge_name, '—', pv, t]);
    continue;
  }
  if (t.id === DISCIPLINE_75_META.templateId) continue;
  for (const mode of MODES) {
    if (!t.variants?.[mode]) continue;
    const pv = previewAttempt({ template: t, variant: mode, durationDays: getDefaultDuration(t) });
    rows.push([t.challenge_name, mode, pv, t]);
  }
}
for (const [name, mode, pv] of rows) {
  say(`| ${name} | ${mode} | ${pv.durationDays ?? '—'} | ${pv.tierLabel} | ${n(pv.dailyTaskXP)} | ` +
    `+${n(pv.perfectDayBonus)} | ${pv.weeklyPerWeek ? n(pv.weeklyPerWeek) : '—'} | ` +
    `${pv.streakXP ? '+' + n(pv.streakXP) : '—'} | ${pv.completionBonus ? '+' + n(pv.completionBonus) : '—'} | ` +
    `${n(pv.projectedPerfectTotal)} |`);
}
// The 75-Day challenge and Forge Daily both carry their task list rather than
// reading it from a template, so they are previewed through the legacy path.
const legacy75 = previewAttempt({
  template: CHALLENGE_TEMPLATES.find(t => t.id === DISCIPLINE_75_META.templateId),
  legacy: { meta: { ...DISCIPLINE_75_META }, tasks: DEFAULT_75_TASKS.map(t => ({ ...t })) },
});
if (legacy75) {
  say(`| 75-Day Discipline Challenge | — | ${legacy75.durationDays} | ${legacy75.tierLabel} | ` +
    `${n(legacy75.dailyTaskXP)} | +${n(legacy75.perfectDayBonus)} | — | ` +
    `${legacy75.streakXP ? '+' + n(legacy75.streakXP) : '—'} | +${n(legacy75.completionBonus)} | ` +
    `${n(legacy75.projectedPerfectTotal)} |`);
}
const baseline = previewAttempt({
  template: null,
  legacy: { meta: { ...FORGE_DAILY_META }, tasks: FORGE_DAILY_TASKS.map(t => ({ ...t })) },
});
if (baseline) {
  say(`| Forge Daily (baseline) | — | open-ended | ${baseline.tierLabel} | ${n(baseline.dailyTaskXP)} | ` +
    `+${n(baseline.perfectDayBonus)} | — | — | — | — |`);
}
say();
say('Forge Daily is the open-ended baseline: no completion to bonus, and no');
say('duration to cap a streak against. The 75-Day challenge installs one task');
say('list and its descriptor carries no mode, so its three modes describe how to');
say('approach it rather than changing what it is worth.');
say();
say('---');
say();
say('## Every challenge in full');
say();

for (const t of CHALLENGE_TEMPLATES.filter(isStartableTemplate)) {
  say(`## ${t.emoji} ${t.challenge_name}`);
  say();
  if (isConfigured(t)) {
    const durations = getDurationOptions(t).map(d => (typeof d === 'object' ? d.days : d));
    const def = getDefaultDuration(t);
    const defDays = typeof def === 'object' ? def.days : def;
    block(`${t.challenge_name} — default setup`, previewAttempt({ template: t }));
    if (durations.length > 1) {
      say('Completion bonus by duration (every other figure is identical — a longer');
      say('run holds the same daily demand for longer):');
      say();
      say('| Duration | Completion bonus | Weekly XP over the attempt | Perfect total |');
      say('|---|---|---|---|');
      for (const d of durations) {
        const pv = previewAttempt({ template: t, configuredSetup: { durationDays: d } });
        say(`| ${d} days${d === defDays ? ' (default)' : ''} | +${n(pv.completionBonus)} | ` +
          `${pv.weeklyTotal ? '+' + n(pv.weeklyTotal) : '—'} | ${n(pv.projectedPerfectTotal)} |`);
      }
      say();
    }
    if (t.id === MB.MUSCLE_BUILDING_TEMPLATE_ID) {
      say('Optional optimization habits join the daily list and re-divide the same');
      say('budget, so each is worth less than every fundamental and the daily total');
      say('never moves:');
      say();
      const all = previewAttempt({
        template: t,
        configuredSetup: { ...MB.defaultSetup(), optimizations: Object.fromEntries(MB.OPTIMIZATION_HABITS.map(h => [h.key, true])) },
      });
      say('| Requirement | XP with all optimizations on |');
      say('|---|---|');
      for (const task of all.tasks) say(`| ${task.icon || ''} ${task.name} | ${n(task.xp)} |`);
      say(`| **Daily total** | **${n(all.dailyTaskXP)}** |`);
      say();
      say('Training sessions divide a fixed weekly budget:');
      say();
      say('| Sessions / week | XP each | XP / week |');
      say('|---|---|---|');
      for (const d of [3, 4, 5, 6]) {
        const pv = previewAttempt({ template: t, configuredSetup: { ...MB.defaultSetup(), trainingDaysPerWeek: d } });
        if (pv.weekly[0]) say(`| ${pv.weekly[0].perWeek}× | ${n(pv.weekly[0].xp)} | ${n(pv.weeklyPerWeek)} |`);
      }
      say();
    }
    continue;
  }

  if (t.id === DISCIPLINE_75_META.templateId) {
    say('Its requirement list is a per-profile default rather than template data,');
    say('and its descriptor carries no mode, so the three modes in the library');
    say('describe how to approach it rather than changing what it is worth.');
    say();
    block('75-Day Discipline Challenge', legacy75);
    continue;
  }

  say(`Rating: ${MODES.filter(m => t.variants?.[m]).map(m => `${m} ${difficultyLabel(t, t.effort_tier_by_variant ? m : null)}`).join(' · ')}`);
  say();
  const durations = getDurationOptions(t);
  for (const mode of MODES) {
    if (!t.variants?.[mode]) continue;
    const def = getDefaultDuration(t);
    block(`${t.challenge_name} · ${mode}`, previewAttempt({ template: t, variant: mode, durationDays: def }),
      durations.length > 1 ? `Shown at the default ${def}-day length.` : '');
  }
  if (durations.length > 1) {
    say('Completion bonus by duration, per mode:');
    say();
    say(`| Duration | ${MODES.filter(m => t.variants?.[m]).join(' | ')} |`);
    say(`|---|${MODES.filter(m => t.variants?.[m]).map(() => '---').join('|')}|`);
    for (const d of durations) {
      const cells = MODES.filter(m => t.variants?.[m])
        .map(m => '+' + n(previewAttempt({ template: t, variant: m, durationDays: d }).completionBonus));
      say(`| ${d} days | ${cells.join(' | ')} |`);
    }
    say();
  }
}

console.log(L.join('\n'));
