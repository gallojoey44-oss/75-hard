const GLUCOSE_KEYWORDS = ['low', 'high', 'spike', 'crash', 'weird', 'unstable', 'drop', 'rise', 'bad'];
const STRESS_KEYWORDS  = ['stress', 'anxious', 'anxiety', 'overwhelm', 'overwhelmed', 'tired', 'exhausted', 'irritable', 'frustrated', 'angry'];
const HUNGER_KEYWORDS  = ['hungry', 'hunger', 'craving', 'cravings', 'snacked', 'overate', 'binge', 'starving'];

const THRESHOLD_COMP     = 75;
const THRESHOLD_LOW      = 6;
const THRESHOLD_VERY_LOW = 5;

/**
 * Compute rolling averages for a set of day numbers.
 * Ratings are 1–10; 0 means "not logged" and is excluded from averages.
 */
export function computeAverages(dayNums, days, tasks) {
  const base = {
    daysLogged: 0, completion: 0,
    energy: 0, sleep: 0, mood: 0, confidence: 0,
    workoutRate: 0, dietRate: 0, mentalRate: 0,
    glucoseWarnings: 0,
    stressInNotes: false, hungerInNotes: false,
    hasEnergyData: false, hasSleepData: false,
    hasMoodData: false,   hasConfData: false,
  };
  if (!dayNums.length || !tasks.length) return base;

  let compSum = 0, compCount = 0;
  let energySum = 0, energyCount = 0;
  let sleepSum  = 0, sleepCount  = 0;
  let moodSum   = 0, moodCount   = 0;
  let confSum   = 0, confCount   = 0;
  let workoutDone = 0, workoutTotal = 0;
  let dietDone    = 0, dietTotal    = 0;
  let mentalDone  = 0, mentalTotal  = 0;
  let glucoseWarnings = 0;
  let stressCount = 0, hungerCount = 0;

  const workoutTask = tasks.find(t => t.id === 'workout'  || t.id === 'gf_workout');
  const dietTask    = tasks.find(t => t.id === 'diet'     || t.id === 'gf_diet');
  const mentalTask  = tasks.find(t => t.id === 'mental'   || t.id === 'gf_mental');

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

    if (workoutTask) { workoutTotal++; if (data.tasks?.[workoutTask.id]) workoutDone++; }
    if (dietTask)    { dietTotal++;    if (data.tasks?.[dietTask.id])    dietDone++;    }
    if (mentalTask)  { mentalTotal++;  if (data.tasks?.[mentalTask.id])  mentalDone++;  }

    if (data.glucoseNotes) {
      const g = data.glucoseNotes.toLowerCase();
      if (GLUCOSE_KEYWORDS.some(kw => g.includes(kw))) glucoseWarnings++;
    }
    if (data.notes) {
      const n2 = data.notes.toLowerCase();
      if (STRESS_KEYWORDS.some(kw => n2.includes(kw))) stressCount++;
      if (HUNGER_KEYWORDS.some(kw => n2.includes(kw))) hungerCount++;
    }
  }

  base.completion  = compCount    ? Math.round(compSum   / compCount)                 : 0;
  base.energy      = energyCount  ? Math.round((energySum / energyCount) * 10) / 10   : 0;
  base.sleep       = sleepCount   ? Math.round((sleepSum  / sleepCount)  * 10) / 10   : 0;
  base.mood        = moodCount    ? Math.round((moodSum   / moodCount)   * 10) / 10   : 0;
  base.confidence  = confCount    ? Math.round((confSum   / confCount)   * 10) / 10   : 0;
  base.workoutRate = workoutTotal ? Math.round((workoutDone / workoutTotal) * 100)     : 0;
  base.dietRate    = dietTotal    ? Math.round((dietDone    / dietTotal)    * 100)     : 0;
  base.mentalRate  = mentalTotal  ? Math.round((mentalDone  / mentalTotal)  * 100)     : 0;
  base.glucoseWarnings = glucoseWarnings;
  base.stressInNotes   = stressCount >= 2;
  base.hungerInNotes   = hungerCount >= 2;
  base.hasEnergyData = energyCount >= 2;
  base.hasSleepData  = sleepCount  >= 2;
  base.hasMoodData   = moodCount   >= 2;
  base.hasConfData   = confCount   >= 2;

  return base;
}

/**
 * Generate a coach-style headline based on the 7-day averages.
 */
export function getCoachMessage(avg) {
  if (avg.daysLogged < 3) {
    return { type: 'info', text: "Keep logging for at least 3 days to build your baseline." };
  }
  if (avg.completion < 60) {
    return { type: 'warn', text: "First bottleneck: consistency. The data matters less than showing up." };
  }

  const hasLow =
    (avg.hasEnergyData && avg.energy     < THRESHOLD_LOW) ||
    (avg.hasSleepData  && avg.sleep      < THRESHOLD_LOW) ||
    (avg.hasMoodData   && avg.mood       < THRESHOLD_LOW) ||
    (avg.hasConfData   && avg.confidence < THRESHOLD_LOW);

  if (avg.completion >= THRESHOLD_COMP && hasLow) {
    return { type: 'warn', text: "You're consistent, but something is holding back how you feel." };
  }
  if (avg.completion >= THRESHOLD_COMP && !hasLow && avg.daysLogged >= 5) {
    return { type: 'success', text: "Your current routine seems to be working. Keep going before adding more." };
  }
  return { type: 'info', text: "Keep building consistency — patterns become clearer with more data." };
}

/**
 * Generate up to 2 personalized habit suggestions based on 7-day averages.
 * Priority order: sleep → energy → mood → confidence → consistency → recovery → diet → glucose
 *
 * Each suggestion: { habitId, pattern, message, reason, priority }
 *   pattern  – one-line data observation shown on the card
 *   message  – brief coach guidance sentence
 *   reason   – detailed scientific/data explanation for "Why am I seeing this?"
 */
export function generateSuggestions(avg, isJoey, activeHabitIds = [], dismissedHabitIds = []) {
  if (avg.daysLogged < 3) return [];

  const excluded   = new Set([...activeHabitIds, ...dismissedHabitIds]);
  const candidates = [];

  function add(habitId, pattern, message, reason, priority) {
    if (!excluded.has(habitId) && !candidates.find(c => c.habitId === habitId)) {
      candidates.push({ habitId, pattern, message, reason, priority });
    }
  }

  const { completion: comp, energy, sleep, mood, confidence: conf } = avg;

  // ── Rule 1: Low completion (< 60%) → consistency habits first ─────────────
  if (comp < 60) {
    add('min_floor_habit',
      `Average task completion is ${comp}% over the last 7 days.`,
      'Consistency is the first bottleneck. Start with a smaller floor target before adding more habits.',
      `When completion drops below 60%, the routine is likely too demanding for the current season. A "floor target" — the minimum viable version of your hardest habit — keeps the identity intact on hard days without letting zero-days accumulate. The goal is never zero.`,
      10);
    add('micro_commitment',
      `Average task completion is ${comp}% — the habit reflex needs rebuilding before adding more.`,
      'Consistency is the first bottleneck. Start with a smaller floor target before adding more habits.',
      `A single daily micro-commitment that always happens (no exceptions) rebuilds self-trust faster than trying to do more. Identity follows behavior — this is the fastest re-anchor when momentum has broken down.`,
      11);
  }

  // ── Rules 2–5: High completion with low ratings (priority: sleep → energy → mood → confidence) ──

  if (comp >= THRESHOLD_COMP) {

    // Sleep — priority tier 1
    if (avg.hasSleepData && sleep < THRESHOLD_LOW) {
      add('evening_light_dim',
        `Completion is ${comp}%, but sleep quality is averaging ${sleep}/10.`,
        'Discipline is strong, but sleep is limiting adaptation.',
        `Bright overhead lighting in the evening blocks melatonin production, pushing sleep onset later. This is one of the most underestimated sleep disruptors because the effect is invisible in the moment. Dimming or switching to low floor lights 2–3 hours before bed is the lowest-friction first step — no supplements, no gadgets, just a light switch.`,
        1);
      add('nsdr',
        `Completion is ${comp}%, but sleep quality is ${sleep}/10. NSDR can partially offset the cost of poor-quality nights.`,
        'Discipline is strong, but sleep is limiting adaptation.',
        `Non-sleep deep rest (Yoga Nidra / NSDR) triggers the same parasympathetic restoration as early sleep stages. A 10–20 min session after training or in the afternoon can offset some of the cognitive and hormonal cost of poor sleep without relying on more sleep time.`,
        2);
      add('physiological_sigh',
        `Completion is ${comp}%, sleep is ${sleep}/10. A wind-down tool may help shift your nervous system before bed.`,
        'Discipline is strong, but sleep is limiting adaptation.',
        `Physiological sighs (double inhale, long exhale) are the fastest-acting breath tool for reducing sympathetic tone. Doing 3–5 before bed can lower residual cortisol and reduce the arousal level that prevents deep sleep onset — particularly useful if you train in the evening.`,
        3);
    }

    // Energy — priority tier 2
    if (avg.hasEnergyData && energy < THRESHOLD_LOW) {
      add('morning_sunlight',
        `Completion is ${comp}%, but energy is averaging ${energy}/10.`,
        "You're doing the tasks, but energy is lagging. Recovery, light exposure, or food timing may need attention.",
        `Morning sunlight suppresses residual melatonin and triggers the cortisol awakening response — the body's built-in alertness signal. Without it, energy tends to ramp up slowly and plateau lower through the day. This is especially common when workouts are happening but energy still feels flat.`,
        4);
      if (isJoey && avg.glucoseWarnings >= 1) {
        add('post_meal_walk',
          `Completion is ${comp}%, energy is ${energy}/10, and glucose notes suggest post-meal patterns worth watching.`,
          "Post-meal energy crashes may be linked to glucose response. A short walk after meals may help.",
          `Post-meal muscle activity drives glucose into cells via a non-insulin pathway (GLUT4 translocation), reducing the amplitude of glucose peaks. Smaller glucose peaks mean fewer 1–2 hour post-meal energy crashes — a common hidden cause of afternoon low energy. Watch Dexcom before and after; carry fast-acting carbs; discuss patterns with a clinician.`,
          4);
      }
      add('nsdr',
        `Completion is ${comp}%, energy is ${energy}/10 despite a solid routine.`,
        "You're doing the tasks, but energy is lagging. Recovery may need direct support.",
        `Cumulative fatigue builds even when individual sleep nights look adequate. NSDR replenishes dopamine stores and directly targets nervous system recovery. Unlike sleep, it can be stacked into a lunch break or post-training window — one of the few tools that works even when you can't sleep more.`,
        5);
    }

    // Mood — priority tier 3
    if (avg.hasMoodData && mood < THRESHOLD_LOW) {
      add('zone2_cardio',
        `Completion is ${comp}%, but mood is averaging ${mood}/10.`,
        'Your routine is consistent, but mood is lagging. Add a low-intensity nervous system/mood support habit.',
        `Zone 2 cardio — low enough to hold a full conversation — is one of the most consistently studied mood interventions. It raises BDNF (brain-derived neurotrophic factor), normalizes cortisol, and provides a clear sense of accomplishment without taxing recovery the way high-intensity training does. If you're already working out hard, a separate easy session may do more for mood than adding more intensity.`,
        6);
      add('morning_sunlight',
        `Completion is ${comp}%, but mood is ${mood}/10. Morning light directly influences serotonin availability.`,
        'Your routine is consistent, but mood is lagging. A circadian anchor may help stabilize the baseline.',
        `Morning sunlight drives serotonin synthesis and helps stabilize the mood-regulating effects of the circadian rhythm. Low serotonin baseline is a common contributor to low mood even in people with a strong exercise and sleep routine — often overlooked because it doesn't feel like a deficiency.`,
        7);
      if (avg.stressInNotes) {
        add('physiological_sigh',
          `Completion is ${comp}%, mood is ${mood}/10, and daily notes suggest stress has been accumulating.`,
          'Your routine is consistent, but mood is lagging. A real-time stress tool may lower the baseline.',
          `When stress accumulates across days, mood tracks cortisol closely. Physiological sighs are the fastest known breath-based way to shift autonomic state — used reactively (in the moment of stress), not as a fixed session. This is different from meditation: it prevents cortisol spikes from compounding rather than trying to undo them later.`,
          7);
      }
    }

    // Confidence — priority tier 4
    if (avg.hasConfData && conf < THRESHOLD_LOW) {
      add('micro_commitment',
        `Completion is ${comp}%, but confidence is averaging ${conf}/10.`,
        'Confidence may need proof-building, not motivation. Choose one promise and keep it daily.',
        `Confidence is downstream of consistent small wins — not motivation or mindset work. When it's low despite a solid completion rate, the gap is usually between doing the tasks and trusting yourself to keep doing them. A micro-commitment that always happens creates the neural record of reliability that genuine confidence is built on.`,
        8);
      add('phone_free_focus',
        `Completion is ${comp}%, but confidence is ${conf}/10.`,
        'Confidence may need proof-building, not motivation. Demonstrated competence compounds.',
        `A 90-minute uninterrupted focus block creates direct evidence of being capable and in control of your attention. Repeated daily, it accumulates into confidence through demonstrated competence — not motivation, but proof. This is particularly effective when confidence is low despite high task completion.`,
        9);
    }
  }

  // ── Rule 6: High workout rate but very low energy → recovery ─────────────
  if (avg.workoutRate >= 75 && avg.hasEnergyData && energy < THRESHOLD_VERY_LOW) {
    add('nsdr',
      `Workout rate is ${avg.workoutRate}%, but energy is ${energy}/10 — training load may be outpacing recovery.`,
      'Training is happening, but recovery may be behind.',
      `High training frequency without matching recovery creates cumulative fatigue that compounds over 7–14 days. This pattern often looks fine until it doesn't — energy crashes, motivation drops, performance stalls. NSDR targets nervous system recovery directly rather than waiting for sleep to compensate.`,
      5);
  }

  // ── Rule 7: High diet completion but hunger in notes ─────────────────────
  if (avg.hungerInNotes && avg.dietRate >= 70) {
    add('protein_baseline',
      `Diet adherence is ${avg.dietRate}%, but notes suggest hunger or cravings are present.`,
      'Diet adherence is good, but hunger may threaten consistency. Protein and meal structure may help.',
      `Protein is the most satiating macronutrient per calorie. If diet adherence is high but hunger is still elevated, protein adequacy is usually the first lever to check — before willpower, meal timing, or further restriction. Adequate protein also directly supports muscle retention and reduces the likelihood of breakdown during a calorie deficit.`,
      6);
  }

  // ── Rule 8: Joey — glucose note patterns ─────────────────────────────────
  if (isJoey && avg.glucoseWarnings >= 2) {
    add('post_meal_walk',
      `Glucose notes over the last 7 days show repeated patterns worth monitoring.`,
      'Watch Dexcom trends, carry fast-acting carbs during workouts, and discuss repeated patterns with a clinician.',
      `Post-meal walking increases muscle glucose uptake via a non-insulin pathway (GLUT4 translocation), which can reduce post-meal glucose amplitude. This is a lifestyle intervention — it is not a substitute for medical guidance, medication adjustment, or insulin management. Always discuss repeated glucose patterns with a clinician.`,
      3);
  }

  // ── Fallback: everything looks solid ─────────────────────────────────────
  if (candidates.length === 0 && avg.daysLogged >= 5) {
    add('physiological_sigh',
      `No clear patterns to flag right now. Things look solid.`,
      'Your current routine seems to be working. Keep going before adding more.',
      `Even when everything looks solid, a real-time stress tool is worth having in the toolkit. Physiological sighs can be done in 30 seconds anywhere — they're one of the fastest-acting autonomic interventions known and require no setup or practice to use effectively.`,
      99);
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
  if      (improved >= 2 && worsened === 0) { verdict = 'helped';    verdictText = 'This seemed to help. Consider keeping it.'; }
  else if (worsened >= 2)                   { verdict = 'unclear';   verdictText = 'Results are mixed. This may not be the right fit right now.'; }
  else if (improved >= 1)                   { verdict = 'possibly';  verdictText = 'Some signs of improvement. One more trial may give a clearer signal.'; }
  else                                      { verdict = 'no_effect'; verdictText = 'No clear change detected. Consider a different experiment.'; }

  return { verdict, verdictText, deltas };
}
