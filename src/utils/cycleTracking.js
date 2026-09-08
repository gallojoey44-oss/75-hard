import { dayNumberForDate } from './dateUtils';
import {
  SYMPTOM_SCALES, INTERFERENCE_AREAS, CONCERN_FLAGS, LIFE_IMPACT, SAFETY,
  CYCLE_STAGES, FLOW_OPTIONS, hhConfig,
} from '../data/hormoneHealthConfig';

/**
 * Menstrual symptom check-ins, Life Impact scoring and three-cycle comparison.
 *
 * Scope, deliberately narrow: this is used ONLY by the Women's Hormone Health
 * challenge. There is no global cycle tracking, Forge never infers a cycle
 * phase, and no other challenge reads any of this. A check-in exists only
 * because the user chose to mark that day as a menstrual day.
 *
 * Entries live on the attempt, in the same individually-addressable shape the
 * rest of Forge uses:
 *
 *   profiles[profId].cycleLogs = [{ id, date, pain, bloating, energy, mood,
 *                                   sleepQuality, flow, meds, interference,
 *                                   concerns }]
 *
 * Every field is optional. Nothing here is scored, and nothing here awards XP —
 * these are outcome MEASUREMENTS, not habits.
 */

/** A blank check-in for a date. */
export function makeCycleLog(date, values = {}) {
  if (!date) return null;
  return {
    id: `cyc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    pain: null, bloating: null, energy: null, mood: null, sleepQuality: null,
    flow: null,
    meds: false,
    interference: { work: false, exercise: false, sleep: false, social: false },
    concerns: {},
    ...values,
  };
}

/** The check-in for a date, or null. */
export function logForDate(logs, date) {
  return (logs || []).find(l => l?.date === date) || null;
}

/** Chronologically sorted check-ins. */
export function sortedLogs(logs) {
  return [...(logs || [])].filter(l => l?.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ── Life Impact Score ───────────────────────────────────────────────────────

/**
 * How much a symptom set weighs, on 0–10 where 10 is worst.
 * Only the fields actually filled in are averaged, so a partial check-in still
 * produces an honest number rather than being penalised for blanks.
 */
export function severityScore(log) {
  const vals = [];
  for (const s of SYMPTOM_SCALES) {
    const v = log?.[s.id];
    if (typeof v !== 'number' || v <= 0) continue;
    // "Worse when high" scales (pain, bloating) map straight through; the
    // positive ones (energy, mood, sleep) are inverted so 10 always means worst.
    vals.push(s.worseWhenHigh ? v : 11 - v);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Share of life areas the cycle interfered with, on 0–10. */
export function interferenceScore(log) {
  const areas = log?.interference;
  if (!areas) return null;
  const hit = INTERFERENCE_AREAS.filter(a => areas[a.id]).length;
  return (hit / INTERFERENCE_AREAS.length) * 10;
}

/**
 * Life Impact for one day, 0–10.
 *
 * Interference is weighted above raw severity because the question this
 * challenge asks is "how much did this get in the way of your life?", not "did
 * you still have cramps?". When only one of the two is recorded, that one
 * stands alone rather than being diluted by a missing half.
 */
export function lifeImpactForLog(log) {
  const sev = severityScore(log);
  const inter = interferenceScore(log);
  // A check-in with no symptom values AND no interference reported tells us
  // nothing — scoring it 0 would falsely drag a cycle average down. An
  // interference of 0 alongside real symptom values IS information, though:
  // "it hurt, but it did not stop me" is exactly what this score is for.
  if (sev == null && !inter) return null;
  if (sev == null) return round1(inter);
  if (inter == null) return round1(sev);
  return round1(inter * LIFE_IMPACT.interferenceWeight + sev * LIFE_IMPACT.severityWeight);
}

/** The wording band for a Life Impact value. */
export function lifeImpactBand(score) {
  if (score == null) return null;
  return LIFE_IMPACT.bands.find(b => score <= b.max) || LIFE_IMPACT.bands[LIFE_IMPACT.bands.length - 1];
}

function round1(n) { return Math.round(n * 10) / 10; }
function avg(list) { return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null; }

// ── Grouping check-ins into cycles ──────────────────────────────────────────

/** Days between two 'YYYY-MM-DD' dates. */
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

/**
 * Group check-ins into menstrual cycles.
 *
 * A run of logged days is one period; a gap of more than `gapDays` starts the
 * next one. Grouping by observed gaps means Forge never has to predict or infer
 * a cycle — it only reads the days the user actually marked.
 */
export function groupCycles(logs, { gapDays = 3 } = {}) {
  const list = sortedLogs(logs);
  const cycles = [];
  let cur = null;
  for (const log of list) {
    if (cur && daysBetween(cur.end, log.date) <= gapDays) {
      cur.logs.push(log);
      cur.end = log.date;
    } else {
      cur = { logs: [log], start: log.date, end: log.date };
      cycles.push(cur);
    }
  }
  return cycles.map((c, i) => summariseCycle(c, i + 1));
}

/** Aggregate one cycle's check-ins into comparable numbers. */
export function summariseCycle(cycle, index) {
  const logs = cycle.logs;
  const num = (key) => logs.map(l => l[key]).filter(v => typeof v === 'number' && v > 0);
  const impacts = logs.map(lifeImpactForLog).filter(v => v != null);
  const painVals = num('pain');

  const interferenceCounts = {};
  for (const a of INTERFERENCE_AREAS) {
    interferenceCounts[a.id] = logs.filter(l => l.interference?.[a.id]).length;
  }

  return {
    index,
    stage: CYCLE_STAGES.find(s => s.cycle === index) || null,
    start: cycle.start,
    end: cycle.end,
    days: logs.length,
    logs,
    avgPain: round1OrNull(avg(painVals)),
    worstPain: painVals.length ? Math.max(...painVals) : null,
    avgBloating: round1OrNull(avg(num('bloating'))),
    avgEnergy: round1OrNull(avg(num('energy'))),
    avgMood: round1OrNull(avg(num('mood'))),
    avgSleepQuality: round1OrNull(avg(num('sleepQuality'))),
    lifeImpact: round1OrNull(avg(impacts)),
    worstLifeImpact: impacts.length ? Math.max(...impacts) : null,
    interferenceCounts,
    exerciseDisruptedDays: interferenceCounts.exercise,
    workDisruptedDays: interferenceCounts.work,
    heavyFlowDays: logs.filter(l => l.flow === 'heavy').length,
    medsDays: logs.filter(l => l.meds).length,
    concerns: CONCERN_FLAGS.filter(f => logs.some(l => l.concerns?.[f.id])).map(f => f.id),
  };
}

function round1OrNull(n) { return n == null ? null : round1(n); }

// ── Comparing cycles ────────────────────────────────────────────────────────

/** The metrics compared across cycles, and which direction is an improvement. */
export const COMPARISON_METRICS = [
  { key: 'avgPain',              label: 'Average pain',        lowerIsBetter: true },
  { key: 'worstPain',            label: 'Worst pain',          lowerIsBetter: true },
  { key: 'avgEnergy',            label: 'Energy',              lowerIsBetter: false },
  { key: 'avgMood',              label: 'Mood',                lowerIsBetter: false },
  { key: 'avgBloating',          label: 'Bloating',            lowerIsBetter: true },
  { key: 'avgSleepQuality',      label: 'Sleep quality',       lowerIsBetter: false },
  { key: 'exerciseDisruptedDays', label: 'Exercise disruption', lowerIsBetter: true, unit: 'days' },
  { key: 'workDisruptedDays',    label: 'Work / school disruption', lowerIsBetter: true, unit: 'days' },
  { key: 'lifeImpact',           label: 'Life Impact Score',   lowerIsBetter: true, headline: true },
];

/**
 * Compare the first and most recent cycles that both have data for a metric.
 *
 * Returns only metrics with real values at both ends — nothing is invented, and
 * a metric the user never filled in simply does not appear. With fewer than two
 * comparable cycles the result is empty, and the caller says so plainly rather
 * than implying a change.
 */
export function compareCycles(cycles) {
  const out = [];
  if (!cycles || cycles.length < 2) return out;
  const first = cycles[0];
  const last = cycles[cycles.length - 1];

  for (const m of COMPARISON_METRICS) {
    const from = first[m.key];
    const to = last[m.key];
    if (typeof from !== 'number' || typeof to !== 'number') continue;
    const delta = round1(to - from);
    const changed = Math.abs(delta) >= 0.5 || (m.unit === 'days' && delta !== 0);
    const improved = m.lowerIsBetter ? delta < 0 : delta > 0;
    out.push({ ...m, from, to, delta, changed, improved: changed ? improved : null });
  }
  return out;
}

/**
 * The three-cycle progress view: each stage with its cycle data (or null when
 * that cycle has not happened yet).
 */
export function cycleProgress(cycles) {
  return CYCLE_STAGES.map(stage => ({
    ...stage,
    cycleData: (cycles || []).find(c => c.index === stage.cycle) || null,
  }));
}

// ── Medical safety ──────────────────────────────────────────────────────────

/**
 * Discreet, evidence-based prompts to seek medical evaluation.
 *
 * Every rule fires on REPEATED reports, never on a single bad day, and the
 * wording never implies the user did the challenge wrong. Returns [] when
 * nothing warrants raising.
 */
export function safetyFlags(cycles, logs) {
  const flags = [];
  const all = sortedLogs(logs);
  if (!all.length) return flags;

  const severeDays = all.filter(l => typeof l.pain === 'number' && l.pain >= SAFETY.severePainScore);
  const severeCycles = (cycles || []).filter(c => c.logs.some(l => typeof l.pain === 'number' && l.pain >= SAFETY.severePainScore));
  if (severeDays.length >= SAFETY.severePainDays || severeCycles.length >= SAFETY.severePainCycles) {
    flags.push({
      id: 'severe_pain',
      text: `You have logged severe pain (${SAFETY.severePainScore}+/10) on ${severeDays.length} ${severeDays.length === 1 ? 'day' : 'days'}. Pain at that level is worth having assessed.`,
    });
  }

  const blockedDays = all.filter(l => l.interference && INTERFERENCE_AREAS.some(a => l.interference[a.id]));
  if (blockedDays.length >= SAFETY.interferenceDays) {
    flags.push({
      id: 'repeated_interference',
      text: `Your cycle has stopped you doing normal activities on ${blockedDays.length} logged days. Pain that repeatedly prevents ordinary life is a reason to seek evaluation.`,
    });
  }

  const heavyDays = all.filter(l => l.flow === 'heavy');
  if (heavyDays.length >= SAFETY.heavyFlowDays) {
    flags.push({
      id: 'heavy_flow',
      text: `You have logged heavy flow on ${heavyDays.length} days. ${SAFETY.ironNote}`,
    });
  }

  // Worsening across cycles, rather than improving.
  const withImpact = (cycles || []).filter(c => c.lifeImpact != null);
  if (withImpact.length >= SAFETY.worseningCycles) {
    const first = withImpact[0].lifeImpact;
    const last = withImpact[withImpact.length - 1].lifeImpact;
    if (last > first + 1) {
      flags.push({
        id: 'worsening',
        text: `Your Life Impact Score has risen from ${first} to ${last} across cycles. Symptoms that worsen rather than settle are worth investigating.`,
      });
    }
  }

  // Explicitly reported red flags always surface.
  for (const f of CONCERN_FLAGS) {
    if (all.some(l => l.concerns?.[f.id])) {
      flags.push({ id: `concern_${f.id}`, text: `You reported: ${f.label.toLowerCase()}. That is worth raising with a healthcare professional.` });
    }
  }

  return flags;
}

/**
 * Persistent severe symptoms at the END of the challenge, despite completing it.
 * Separated from the running flags so the completion summary can say the one
 * thing that matters most: this is not a discipline failure.
 */
export function persistentSymptomsAtCompletion(cycles) {
  const withImpact = (cycles || []).filter(c => c.lifeImpact != null);
  if (withImpact.length < 2) return false;
  const last = withImpact[withImpact.length - 1];
  return last.lifeImpact >= 6;
}

// ── Challenge-day helpers ───────────────────────────────────────────────────

/** True when this attempt tracks menstrual check-ins. */
export function tracksCycles(meta) {
  return !!hhConfig(meta);
}

/** Check-ins that fall inside the challenge's own date range. */
export function logsInChallenge(logs, challengeStart, rawDay) {
  if (!challengeStart || !rawDay) return [];
  return sortedLogs(logs).filter(l => {
    if (l.date < challengeStart) return false;
    const d = dayNumberForDate(challengeStart, l.date);
    return d != null && d <= rawDay;
  });
}

/** Flow option metadata by id. */
export function flowLabel(id) {
  return FLOW_OPTIONS.find(f => f.id === id)?.label || null;
}
