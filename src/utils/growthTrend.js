import { getDateForDayNumber } from './dateUtils';
import { challengeWeeks } from './weeklyRequirements';
import { GAIN_RATE, mbConfig, nutritionMode, MEASUREMENTS } from '../data/muscleBuildingConfig';
import { overallPerformance } from './exerciseLog';

/**
 * Bodyweight trend, physique check-ins, and the INPUTS-vs-OUTPUTS coaching
 * feedback for Muscle Building.
 *
 * Weight is read from the day records the user already logs — nothing new is
 * stored. Individual weigh-ins are noisy, so every judgement here is made on
 * WEEKLY AVERAGES: a single heavy morning never triggers coaching.
 *
 * Nothing in this file ever modifies a target. It produces insights the user
 * reads and acts on; changing calories or volume stays the user's decision.
 */

/** Weekly average bodyweight for each challenge week that has any weigh-ins. */
export function weeklyWeights({ days, meta, challengeStart, rawDay }) {
  if (!meta?.durationDays || !challengeStart || !rawDay) return [];
  const out = [];
  for (const week of challengeWeeks(meta)) {
    if (week.startDay > rawDay) break;
    const vals = [];
    for (let d = week.startDay; d <= Math.min(week.endDay, rawDay); d++) {
      const w = Number(days?.[d]?.weight) || 0;
      if (w > 0) vals.push(w);
    }
    if (!vals.length) continue;
    out.push({
      week: week.week,
      startDay: week.startDay,
      endDay: week.endDay,
      complete: week.endDay < rawDay,
      logs: vals.length,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      date: getDateForDayNumber(challengeStart, week.startDay),
    });
  }
  return out;
}

/**
 * Bodyweight trend against the attempt's configured gain-rate range.
 *
 * Rates are percent of bodyweight per week — a scale that works for any body
 * size, unlike an absolute pound figure. The range is per-attempt data (set at
 * setup, defaulted from the chosen nutrition mode), so no single rate is
 * presented as universally optimal.
 */
export function bodyweightTrend({ days, meta, challengeStart, rawDay }) {
  const cfg = mbConfig(meta);
  if (!cfg) return { supported: false };
  const weeks = weeklyWeights({ days, meta, challengeStart, rawDay });
  const min = cfg.gainRateMin ?? GAIN_RATE.defaultMin;
  const max = cfg.gainRateMax ?? GAIN_RATE.defaultMax;

  if (weeks.length < 2) {
    return { supported: true, weeks, points: weeks.length, rangeMin: min, rangeMax: max, ratePct: null, status: 'building' };
  }

  // Rate over the whole logged span, annualised down to a per-week figure — more
  // stable than comparing only the last two weeks.
  const first = weeks[0], last = weeks[weeks.length - 1];
  const spanWeeks = Math.max(1, last.week - first.week);
  const totalPct = first.avg > 0 ? ((last.avg - first.avg) / first.avg) * 100 : 0;
  const ratePct = totalPct / spanWeeks;

  // Consecutive recent weeks with essentially no change — the stall signal.
  let flatWeeks = 0;
  for (let i = weeks.length - 1; i > 0; i--) {
    const change = weeks[i - 1].avg > 0 ? Math.abs((weeks[i].avg - weeks[i - 1].avg) / weeks[i - 1].avg) * 100 : 0;
    if (change < GAIN_RATE.flatThreshold) flatWeeks++;
    else break;
  }

  let status = 'onTarget';
  if (ratePct > max * GAIN_RATE.fastFactor) status = 'fast';
  else if (ratePct > max) status = 'aboveTarget';
  else if (ratePct < min) status = 'belowTarget';

  return {
    supported: true,
    weeks, points: weeks.length,
    rangeMin: min, rangeMax: max,
    ratePct: Math.round(ratePct * 100) / 100,
    totalChange: Math.round((last.avg - first.avg) * 10) / 10,
    firstAvg: first.avg, lastAvg: last.avg,
    flatWeeks,
    status,
    mode: nutritionMode(cfg.nutritionMode),
  };
}

/** Measurements the user opted into, with their most recent logged value. */
export function measurementCheckIns({ days, meta, rawDay }) {
  const cfg = mbConfig(meta);
  if (!cfg) return [];
  const selected = cfg.measurements || {};
  return MEASUREMENTS.filter(m => selected[m.id]).map(m => {
    if (!m.field) return { ...m, latest: null, latestDay: null };   // photos have no numeric field
    let latest = null, latestDay = null;
    for (let d = 1; d <= (rawDay || 0); d++) {
      const v = Number(days?.[d]?.[m.field]) || 0;
      if (v > 0) { latest = v; latestDay = d; }
    }
    return { ...m, latest, latestDay };
  });
}

/**
 * INPUTS vs OUTPUTS coaching.
 *
 * Inputs  — training adherence, weekly volume, daily-task adherence (protein,
 *           nutrition, sleep, recovery), optional optimization habits.
 * Outputs — exercise performance trend, bodyweight trend.
 *
 * Insights only fire when there is enough evidence, and each one suggests a
 * direction rather than making a change. Returns [] when the challenge is too
 * young or too sparsely logged to say anything honest.
 */
export function growthInsights({
  days, meta, challengeStart, rawDay, exerciseEntries, weeklyRequirements, volumeAdherence, taskAdherencePct,
}) {
  const cfg = mbConfig(meta);
  if (!cfg || !rawDay) return [];
  const out = [];
  const weight = bodyweightTrend({ days, meta, challengeStart, rawDay });
  const perf = overallPerformance(exerciseEntries);

  // Adherence across the inputs we actually have evidence for.
  const trainingPct = weeklyRequirements?.availableXP > 0
    ? Math.round((weeklyRequirements.earnedXP / weeklyRequirements.availableXP) * 100)
    : null;
  const inputs = [taskAdherencePct, trainingPct, volumeAdherence?.pct].filter(v => typeof v === 'number');
  const adherence = inputs.length ? Math.round(inputs.reduce((a, b) => a + b, 0) / inputs.length) : null;
  const strongAdherence = adherence != null && adherence >= 80;

  // ── Gaining faster than the chosen target ────────────────────────────────
  if (weight.supported && weight.status === 'fast') {
    out.push({
      id: 'gain_too_fast',
      tone: 'warn',
      icon: '⚖️',
      text: `Your weight is increasing faster than your selected muscle-gain target (${weight.ratePct}% vs ${weight.rangeMin}–${weight.rangeMax}% per week). Consider slightly reducing calorie intake if limiting fat gain is a priority.`,
    });
  } else if (weight.supported && weight.status === 'belowTarget' && weight.points >= 3 && strongAdherence) {
    out.push({
      id: 'gain_too_slow',
      tone: 'info',
      icon: '⚖️',
      text: `Your weight is tracking below your ${weight.rangeMin}–${weight.rangeMax}% per week target. If growth is the priority, a small increase in daily calories may help.`,
    });
  }

  // ── Stalled growth trend ─────────────────────────────────────────────────
  const stalled = weight.supported && weight.flatWeeks >= GAIN_RATE.stallWeeks;
  const flatPerf = perf?.flat === true;
  if (stalled && flatPerf) {
    out.push({
      id: 'stall_both',
      tone: 'warn',
      icon: '📉',
      text: 'Your growth trend has stalled. Nutrition, training stimulus, or recovery may need adjustment.',
    });
  } else if (stalled) {
    out.push({
      id: 'stall_weight',
      tone: 'info',
      icon: '📉',
      text: `Bodyweight has been flat for ${weight.flatWeeks} weeks. If you are still progressing in the gym this can be fine — otherwise nutrition may need a look.`,
    });
  }

  // ── The headline inputs-vs-outputs comparison ────────────────────────────
  if (strongAdherence && stalled && flatPerf) {
    out.push({
      id: 'inputs_outputs',
      tone: 'warn',
      icon: '🔍',
      text: `Adherence is high (${adherence}%), but performance and bodyweight have been flat for ${weight.flatWeeks} weeks. Consider reviewing calorie intake or training volume.`,
    });
  } else if (!strongAdherence && adherence != null && stalled) {
    out.push({
      id: 'adherence_first',
      tone: 'info',
      icon: '🎯',
      text: `Progress has stalled while adherence is ${adherence}%. Tighten the fundamentals — protein, training sessions and weekly volume — before changing your targets.`,
    });
  }

  // ── Volume shortfall, the most actionable training input ─────────────────
  if (volumeAdherence && volumeAdherence.pct < 70 && volumeAdherence.weeks >= 2) {
    out.push({
      id: 'volume_low',
      tone: 'info',
      icon: '🏋️',
      text: `Weekly hard sets are running at ${volumeAdherence.pct}% of your targets. Volume is the clearest dose of training that drives growth — closing that gap is usually the first fix.`,
    });
  }

  // ── Positive confirmation, so the feedback is not only corrective ────────
  if (!out.length && strongAdherence && perf && perf.progressing > 0 && weight.status === 'onTarget') {
    out.push({
      id: 'on_track',
      tone: 'good',
      icon: '✅',
      text: `Adherence is strong, ${perf.progressing} of ${perf.tracked} tracked lifts are progressing, and bodyweight is inside your target range. Keep going.`,
    });
  }

  return out;
}
