const GLUCOSE_KEYWORDS = ['low', 'high', 'spike', 'crash', 'weird', 'unstable', 'drop', 'rise', 'bad'];
const THRESHOLD_COMP   = 75;  // completion % to qualify as "disciplined"
const THRESHOLD_LOW    = 6;   // rating below this = worth flagging
const THRESHOLD_VERY_LOW = 5; // rating below this = more urgent

/**
 * Compute rolling averages for a set of day numbers.
 * Ratings are 1–10; 0 means "not logged" and is excluded from averages.
 */
export function computeAverages(dayNums, days, tasks) {
  const base = {
    daysLogged: 0, completion: 0,
    energy: 0, sleep: 0, mood: 0, confidence: 0,
    workoutRate: 0, glucoseWarnings: 0,
    hasEnergyData: false, hasSleepData: false,
    hasMoodData: false,  hasConfData: false,
  };
  if (!dayNums.length || !tasks.length) return base;

  let compSum = 0, compCount = 0;
  let energySum = 0, energyCount = 0;
  let sleepSum  = 0, sleepCount  = 0;
  let moodSum   = 0, moodCount   = 0;
  let confSum   = 0, confCount   = 0;
  let workoutDone = 0, workoutTotal = 0;
  let glucoseWarnings = 0;

  const workoutTask = tasks.find(t => t.id === 'workout' || t.id === 'gf_workout');

  for (const n of dayNums) {
    const data = days[n];
    if (!data) continue;
    base.daysLogged++;

    const done = tasks.filter(t => data.tasks?.[t.id]).length;
    compSum += Math.round((done / tasks.length) * 100);
    compCount++;

    if (data.energy     > 0) { energySum += data.energy;     energyCount++; }
    if (data.sleep      > 0) { sleepSum  += data.sleep;      sleepCount++;  }
    if (data.mood       > 0) { moodSum   += data.mood;       moodCount++;   }
    if (data.confidence > 0) { confSum   += data.confidence; confCount++;   }

    if (workoutTask) {
      workoutTotal++;
      if (data.tasks?.[workoutTask.id]) workoutDone++;
    }

    if (data.glucoseNotes) {
      const lower = data.glucoseNotes.toLowerCase();
      if (GLUCOSE_KEYWORDS.some(kw => lower.includes(kw))) glucoseWarnings++;
    }
  }

  base.completion  = compCount   ? Math.round(compSum / compCount)                       : 0;
  base.energy      = energyCount ? Math.round((energySum / energyCount) * 10) / 10       : 0;
  base.sleep       = sleepCount  ? Math.round((sleepSum  / sleepCount)  * 10) / 10       : 0;
  base.mood        = moodCount   ? Math.round((moodSum   / moodCount)   * 10) / 10       : 0;
  base.confidence  = confCount   ? Math.round((confSum   / confCount)   * 10) / 10       : 0;
  base.workoutRate = workoutTotal ? Math.round((workoutDone / workoutTotal) * 100)         : 0;
  base.glucoseWarnings = glucoseWarnings;
  base.hasEnergyData = energyCount >= 2;
  base.hasSleepData  = sleepCount  >= 2;
  base.hasMoodData   = moodCount   >= 2;
  base.hasConfData   = confCount   >= 2;

  return base;
}

/**
 * Generate up to 2 habit suggestions based on 7-day averages.
 * Habits already in active experiments or recently dismissed are excluded.
 */
export function generateSuggestions(avg, isJoey, activeHabitIds = [], dismissedHabitIds = []) {
  if (avg.daysLogged < 3) return [];

  const excluded  = new Set([...activeHabitIds, ...dismissedHabitIds]);
  const candidates = [];

  function add(habitId, pattern, priority) {
    if (!excluded.has(habitId) && !candidates.find(c => c.habitId === habitId)) {
      candidates.push({ habitId, pattern, priority });
    }
  }

  // Consistent effort but energy lagging
  if (avg.completion >= THRESHOLD_COMP && avg.hasEnergyData && avg.energy < THRESHOLD_LOW) {
    add('morning_sunlight',
      `You're completing ${avg.completion}% of tasks — but energy is averaging ${avg.energy}/10. Morning light may help anchor your rhythm.`,
      1);
  }

  // Good completion but sleep quality low
  if (avg.completion >= THRESHOLD_COMP && avg.hasSleepData && avg.sleep < THRESHOLD_LOW) {
    add('evening_light_dim',
      `Effort is strong at ${avg.completion}%, but sleep quality is averaging ${avg.sleep}/10. Evening light dimming is a low-friction first step.`,
      1);
  }

  // Consistent but confidence is lagging
  if (avg.completion >= THRESHOLD_COMP && avg.hasConfData && avg.confidence < THRESHOLD_LOW) {
    add('micro_commitment',
      `Discipline is high (${avg.completion}%) but confidence is at ${avg.confidence}/10. A daily micro-commitment may help rebuild self-trust.`,
      2);
  }

  // Good effort but mood is low
  if (avg.completion >= THRESHOLD_COMP && avg.hasMoodData && avg.mood < THRESHOLD_LOW) {
    add('zone2_cardio',
      `Strong effort (${avg.completion}%) but mood is at ${avg.mood}/10. Zone 2 cardio is one of the most consistently effective mood tools.`,
      1);
  }

  // Workout rate high but energy very low → recovery
  if (avg.workoutRate >= 75 && avg.hasEnergyData && avg.energy < THRESHOLD_VERY_LOW) {
    add('nsdr',
      `Workout rate is ${avg.workoutRate}% but energy is at ${avg.energy}/10. Recovery may need support.`,
      2);
  }

  // Joey-specific: glucose patterns
  if (isJoey && avg.glucoseWarnings >= 2) {
    add('post_meal_walk',
      `Glucose notes over the past 7 days show repeated patterns worth monitoring. A post-meal walk may help smooth response. Always carry fast carbs and discuss patterns with a clinician.`,
      1);
  }

  // Fallback if nothing triggered
  if (candidates.length === 0 && avg.daysLogged >= 5) {
    add('physiological_sigh',
      `Things are looking solid. Here's one simple tool that's useful in any situation.`,
      5);
  }

  return candidates.sort((a, b) => a.priority - b.priority).slice(0, 2);
}

/**
 * Compare baseline vs experiment-period averages.
 * Returns verdict and per-metric deltas.
 */
export function assessExperiment(baseline, result) {
  if (!baseline || !result) return null;

  const metrics = [
    { key: 'energy',     label: 'Energy' },
    { key: 'sleep',      label: 'Sleep' },
    { key: 'mood',       label: 'Mood' },
    { key: 'confidence', label: 'Confidence' },
  ];

  const deltas = [];
  let improved = 0, worsened = 0;

  for (const { key, label } of metrics) {
    if (baseline[key] > 0 && result[key] > 0) {
      const d = Math.round((result[key] - baseline[key]) * 10) / 10;
      deltas.push({ key, label, before: baseline[key], after: result[key], delta: d });
      if (d >=  0.5) improved++;
      if (d <= -0.5) worsened++;
    }
  }

  let verdict, verdictText;
  if      (improved >= 2 && worsened === 0) { verdict = 'helped';        verdictText = 'This seemed to help. Consider keeping it.'; }
  else if (worsened >= 2)                   { verdict = 'unclear';       verdictText = 'Results are mixed. This may not be the right fit right now.'; }
  else if (improved >= 1)                   { verdict = 'possibly';      verdictText = 'Some signs of improvement. One more trial may give a clearer signal.'; }
  else                                       { verdict = 'no_effect';    verdictText = 'No clear change detected. Consider a different experiment.'; }

  return { verdict, verdictText, deltas };
}
