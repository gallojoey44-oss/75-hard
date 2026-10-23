/**
 * The audit behind the Challenge Library XP fix.
 *
 * Originally: every XP figure the library SHOWED, against the figure starting
 * the challenge actually produced. That run found 262 of 336 displayed figures
 * stale — Mental Training advertising 100 XP a task and 270 a day against an
 * actual 41 and 160 — because the library rendered hand-written strings and
 * config-module constants while `stampAttempt` repriced the attempt separately.
 *
 * Since that fix the library renders only `previewAttempt`, so the "shown"
 * column here no longer corresponds to anything on screen: it is the figure the
 * template or config module AUTHORS, and the difference from the allocation is
 * by design — an author's numbers are a priority ladder within a tier, and the
 * daily budget is what difficulty governs.
 *
 * It is kept for two reasons: it is the record of what was wrong, and it is the
 * quickest way to see how the allocator treats each challenge's own ladder. The
 * guarantee that previews match reality is enforced by
 * `tests/challenge-preview-unit-test.mjs` and `challenge-preview-e2e-test.mjs`.
 *
 * Bundle before running (it imports app source by absolute path):
 *   ./node_modules/.bin/esbuild tools/xp-audit/ui-preview-audit.mjs \
 *     --bundle --platform=node --format=esm --outfile=/tmp/x.mjs && node /tmp/x.mjs
 */
import { CHALLENGE_TEMPLATES, getDurationOptions, getCompletionBonusForDuration, difficultyLabel }
  from '/home/user/75-hard/src/data/challengeTemplates.js';
import { CONFIGURED_BUILDERS, isConfigured, isStartableTemplate }
  from '/home/user/75-hard/src/data/configuredChallenges.js';
import { previewAttempt } from '/home/user/75-hard/src/data/challengeAttempt.js';
import { WEEKLY_REQUIREMENT_DEFS } from '/home/user/75-hard/src/utils/weeklyRequirements.js';
import * as MB from '/home/user/75-hard/src/data/muscleBuildingConfig.js';
import * as ER from '/home/user/75-hard/src/data/energyResetConfig.js';
import * as LI from '/home/user/75-hard/src/data/lockInConfig.js';
import { COLD_SHOWER_TASK } from '/home/user/75-hard/src/data/challengeTemplates.js';

const MODES = ['beginner', 'standard', 'hard'];
let stale = 0, checked = 0;

function row(label, shown, actual, note = '') {
  checked++;
  const bad = shown != null && Number(shown) !== Number(actual);
  if (bad) stale++;
  // DIFF, not STALE: the authored figure is a within-tier ladder, and the
  // allocation scales it onto the challenge's daily budget.
  const flag = shown == null ? '    ' : bad ? 'DIFF ' : 'same ';
  console.log(`  ${flag} ${label.padEnd(46)} shown ${String(shown ?? '—').padStart(6)}   actual ${String(actual).padStart(6)}  ${note}`);
}

/** The XP figure baked into a hand-written preview string, if any. */
function parseXP(s) {
  const m = /\((\d+)\s*XP/i.exec(s);
  return m ? Number(m[1]) : null;
}

console.log('═══ AUTHORED LADDER vs ALLOCATED XP ═══');
console.log('The library renders the ALLOCATED column. See the header comment.\n');

for (const tpl of CHALLENGE_TEMPLATES) {
  if (!isStartableTemplate(tpl)) {
    console.log(`\n### ${tpl.emoji} ${tpl.challenge_name} — not startable, skipped`);
    continue;
  }
  const durations = getDurationOptions(tpl);

  if (isConfigured(tpl)) {
    const builders = CONFIGURED_BUILDERS[tpl.id];
    const pv = previewAttempt({ template: tpl });
    console.log(`\n### ${tpl.emoji} ${tpl.challenge_name} (configured) — tier ${pv.tier}, budget ${pv.dailyBudget}`);
    // The library and the setup screens print cfg.buildTasks() XP directly.
    for (const t of builders.buildTasks()) {
      const actual = pv.tasks.find(x => x.id === t.id);
      row(`task ${t.id}`, t.xp, actual ? actual.xp : 0);
    }
    const metaWeekly = builders.buildMeta().weeklyRequirementDefs || [];
    for (const d of metaWeekly) {
      const actual = pv.weekly.find(x => x.id === d.id);
      row(`weekly ${d.id} (per session)`, d.xp, actual ? actual.xp : 0);
    }
    if (tpl.id === MB.MUSCLE_BUILDING_TEMPLATE_ID) {
      // Optimization habits are previewed from their own constant, but they join
      // the daily task list and therefore SPLIT the same budget.
      for (const h of MB.OPTIMIZATION_HABITS) {
        const on = previewAttempt({
          template: tpl,
          configuredSetup: { ...MB.defaultSetup(), optimizations: { [h.key]: true } },
        });
        const actual = on.tasks.find(x => x.id === h.id);
        row(`optional ${h.id}`, h.xp, actual ? actual.xp : 0, '(enabling it re-splits the budget)');
      }
    }
    if (tpl.id === ER.ENERGY_RESET_TEMPLATE_ID) {
      for (const [days, xp] of Object.entries(ER.COMPLETION_BONUS_BY_DURATION || {})) {
        const p = previewAttempt({ template: tpl, configuredSetup: { ...ER.defaultSetup(), durationDays: Number(days) } });
        row(`completion bonus @${days}d`, xp, p.completionBonus);
      }
    }
    if (tpl.id === LI.LOCK_IN_TEMPLATE_ID) {
      for (const days of (LI.DURATIONS || []).map(d => d.days ?? d)) {
        const p = previewAttempt({ template: tpl, configuredSetup: { ...LI.defaultSetup(), durationDays: Number(days) } });
        row(`completion bonus @${days}d`, LI.completionBonusFor(days), p.completionBonus);
      }
    }
    continue;
  }

  for (const mode of MODES) {
    const v = tpl.variants?.[mode];
    if (!v) continue;
    for (const days of durations.length ? durations : [null]) {
      const pv = previewAttempt({ template: tpl, variant: mode, durationDays: days });
      if (!pv) continue;
      console.log(`\n### ${tpl.emoji} ${tpl.challenge_name} · ${mode} · ${days}d — tier ${pv.tier}, budget ${pv.dailyBudget}, label "${difficultyLabel(tpl, mode)}"`);

      // Hand-written daily strings carry their own order and wording, so they
      // are matched to the task they describe by name rather than by index.
      const shownDaily = (v.required_daily_tasks || []).map(parseXP);
      const shownTotal = shownDaily.reduce((s, x) => s + (x || 0), 0);
      const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      v.required_daily_tasks?.forEach((s, i) => {
        const words = norm(s).split(' ').filter(w => w.length > 2);
        const t = pv.tasks
          .map(x => ({ x, hits: words.filter(w => norm(x.name).includes(w)).length }))
          .sort((a, b) => b.hits - a.hits)[0];
        const matched = t && t.hits >= 1 ? t.x : null;
        row(`daily ${String(s).slice(0, 38)}`, shownDaily[i],
          matched ? matched.xp : 'unmatched', matched ? `→ ${matched.id}` : '(no task matched)');
      });
      row('TOTAL daily task XP', shownTotal || null, pv.dailyTaskXP);

      (v.weekly_requirements || []).forEach((s, i) => {
        const d = pv.weekly[i];
        row(`weekly[${i}] ${String(s).slice(0, 32)}`, parseXP(s), d ? d.xp : 0);
      });
      // Fat Loss beginner/standard resolve to the legacy module constant.
      if (!v.weekly_requirements?.length && pv.weekly.length) {
        for (const d of pv.weekly) {
          const legacy = WEEKLY_REQUIREMENT_DEFS.find(x => x.id === d.id);
          row(`weekly ${d.id} (legacy constant)`, legacy ? legacy.xp : null, d.xp);
        }
      }

      (v.optional_tasks || []).forEach((s, i) => {
        const shown = parseXP(s);
        if (shown != null) row(`optional[${i}] ${String(s).slice(0, 32)}`, shown, 'n/a (not a priced task)');
      });

      for (const bm of (tpl.bonus_missions || [])) {
        row(`bonus mission ${bm.id}`, bm.xp, Math.min(bm.xp, pv.bonusPerDayCap),
          `(per-day cap ${pv.bonusPerDayCap}, attempt cap ${pv.bonusAttemptCap})`);
      }

      row('completion bonus', getCompletionBonusForDuration(tpl, days), pv.completionBonus);
      if (tpl.id === 'mental_training_phase') {
        row('cold shower upgrade task', COLD_SHOWER_TASK.xp,
          previewAttempt({ template: tpl, variant: mode, durationDays: days, coldExposureUpgradeEnabled: true })
            .tasks.find(t => t.id === COLD_SHOWER_TASK.id)?.xp ?? 0);
      }
    }
  }
}

console.log(`\n═══ ${stale} of ${checked} authored figures differ from their allocation ═══`);
console.log('None of these is displayed: the library reads previewAttempt only.');
