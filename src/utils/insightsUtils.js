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
    recovery: 0, workoutEffort: 0, stress: 0,
    hoursSlept: 0,
    workoutRate: 0, dietRate: 0, mentalRate: 0,
    stressInNotes: false, hungerInNotes: false,
    hasEnergyData: false, hasSleepData: false,
    hasMoodData: false,   hasConfData: false,
    hasRecoveryData: false, hasEffortData: false, hasStressData: false,
    hasHoursSleptData: false,
    missedDays: 0,
    partialDays: 0,
  };
  if (!dayNums.length || !tasks.length) return base;

  let compSum = 0, compCount = 0;
  let energySum = 0, energyCount = 0;
  let sleepSum  = 0, sleepCount  = 0;
  let moodSum   = 0, moodCount   = 0;
  let confSum   = 0, confCount   = 0;
  let recoverySum = 0, recoveryCount = 0;
  let effortSum   = 0, effortCount   = 0;
  let stressSum   = 0, stressCount   = 0;
  let hoursSleptSum = 0, hoursSleptCount = 0;
  let workoutDone = 0, workoutTotal = 0;
  let dietDone    = 0, dietTotal    = 0;
  let mentalDone  = 0, mentalTotal  = 0;
  let stressNoteCount = 0, hungerNoteCount = 0;

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

    if (data.energy        > 0) { energySum    += data.energy;        energyCount++;    }
    if (data.sleep         > 0) { sleepSum      += data.sleep;         sleepCount++;     }
    if (data.mood          > 0) { moodSum       += data.mood;          moodCount++;      }
    if (data.confidence    > 0) { confSum       += data.confidence;    confCount++;      }
    if (data.recovery      > 0) { recoverySum   += data.recovery;      recoveryCount++;  }
    if (data.workoutEffort > 0) { effortSum     += data.workoutEffort; effortCount++;    }
    if (data.stress        > 0) { stressSum     += data.stress;        stressCount++;    }
    if (data.hoursSlept    > 0) { hoursSleptSum += data.hoursSlept;    hoursSleptCount++; }

    if (workoutTask) { workoutTotal++; if (data.tasks?.[workoutTask.id]) workoutDone++; }
    if (dietTask)    { dietTotal++;    if (data.tasks?.[dietTask.id])    dietDone++;    }
    if (mentalTask)  { mentalTotal++;  if (data.tasks?.[mentalTask.id])  mentalDone++;  }

    const dayPct = Math.round((done / tasks.length) * 100);
    if (dayPct < 40) base.missedDays++;
    else if (dayPct < 80) base.partialDays++;

    if (data.notes) {
      const nText = data.notes.toLowerCase();
      if (STRESS_KEYWORDS.some(kw => nText.includes(kw))) stressNoteCount++;
      if (HUNGER_KEYWORDS.some(kw => nText.includes(kw))) hungerNoteCount++;
    }
  }

  base.completion    = compCount       ? Math.round(compSum      / compCount)                    : 0;
  base.energy        = energyCount     ? Math.round((energySum     / energyCount)     * 10) / 10 : 0;
  base.sleep         = sleepCount      ? Math.round((sleepSum      / sleepCount)      * 10) / 10 : 0;
  base.mood          = moodCount       ? Math.round((moodSum       / moodCount)       * 10) / 10 : 0;
  base.confidence    = confCount       ? Math.round((confSum       / confCount)       * 10) / 10 : 0;
  base.recovery      = recoveryCount   ? Math.round((recoverySum   / recoveryCount)   * 10) / 10 : 0;
  base.workoutEffort = effortCount     ? Math.round((effortSum     / effortCount)     * 10) / 10 : 0;
  base.stress        = stressCount     ? Math.round((stressSum     / stressCount)     * 10) / 10 : 0;
  base.hoursSlept    = hoursSleptCount ? Math.round((hoursSleptSum / hoursSleptCount) * 10) / 10 : 0;
  base.workoutRate   = workoutTotal    ? Math.round((workoutDone   / workoutTotal)    * 100)      : 0;
  base.dietRate      = dietTotal       ? Math.round((dietDone      / dietTotal)       * 100)      : 0;
  base.mentalRate    = mentalTotal     ? Math.round((mentalDone    / mentalTotal)     * 100)      : 0;
  base.stressInNotes     = stressNoteCount  >= 2;
  base.hungerInNotes     = hungerNoteCount  >= 2;
  base.hasEnergyData     = energyCount      >= 2;
  base.hasSleepData      = sleepCount       >= 2;
  base.hasMoodData       = moodCount        >= 2;
  base.hasConfData       = confCount        >= 2;
  base.hasRecoveryData   = recoveryCount    >= 2;
  base.hasEffortData     = effortCount      >= 2;
  base.hasStressData     = stressCount      >= 2;
  base.hasHoursSleptData = hoursSleptCount  >= 2;

  return base;
}

/**
 * Generate a coach-style headline based on the 7-day averages.
 * Sleep is checked first when hours-slept data is present.
 */
export function getCoachMessage(avg, sleepTarget = 8) {
  if (avg.daysLogged < 3) {
    return { type: 'info', text: "Keep logging for at least 3 days to build your baseline." };
  }
  if (avg.completion < 60) {
    return { type: 'warn', text: "First bottleneck: consistency. The data matters less than showing up." };
  }

  // Sleep hours — first priority when data exists
  if (avg.hasHoursSleptData && avg.hoursSlept < sleepTarget - 0.5) {
    return { type: 'warn', text: `Sleep is the first bottleneck. You're averaging ${avg.hoursSlept}h vs your ${sleepTarget}h target — training and habits build on sleep.` };
  }

  // Sleep quality poor
  if (avg.hasSleepData && avg.sleep < THRESHOLD_LOW && !avg.hasHoursSleptData) {
    return { type: 'warn', text: "Sleep quality is low. Address sleep before layering on new habits — it's the foundation everything else builds on." };
  }

  // Stress elevated
  if (avg.hasStressData && avg.stress >= 7) {
    return { type: 'warn', text: `Stress averaged ${avg.stress}/10 this week. Your nervous system needs a downshift habit before you add more.` };
  }

  // Low recovery
  if (avg.hasRecoveryData && avg.recovery < THRESHOLD_LOW) {
    return { type: 'warn', text: `Recovery averaged ${avg.recovery}/10 this week. The body may need direct recovery support, not just more training.` };
  }

  // Hard training but poor recovery
  if (avg.hasEffortData && avg.hasRecoveryData && avg.workoutEffort >= 8 && avg.recovery < 6) {
    return { type: 'warn', text: "You're training hard, but recovery is lagging. Output is exceeding input." };
  }

  const hasLow =
    (avg.hasEnergyData    && avg.energy     < THRESHOLD_LOW) ||
    (avg.hasSleepData     && avg.sleep      < THRESHOLD_LOW) ||
    (avg.hasMoodData      && avg.mood       < THRESHOLD_LOW) ||
    (avg.hasConfData      && avg.confidence < THRESHOLD_LOW);

  if (avg.hasRecoveryData && avg.recovery >= 7 && !hasLow && avg.daysLogged >= 5) {
    return { type: 'success', text: "Your routine appears to be supporting recovery. Keep going before adding more." };
  }

  if (avg.completion >= THRESHOLD_COMP && hasLow) {
    return { type: 'warn', text: "You're consistent, but something is holding back how you feel." };
  }
  if (avg.completion >= THRESHOLD_COMP && !hasLow && avg.daysLogged >= 5) {
    return { type: 'success', text: "Your current routine seems to be working. Keep going before adding more." };
  }
  return { type: 'info', text: "Keep building consistency — patterns become clearer with more data." };
}

/**
 * Identify the single highest-priority bottleneck and surface it with
 * recommended habits.
 *
 * Priority order: sleep duration → sleep quality → consistency →
 *   stress → recovery/training load → energy → mood → confidence
 */
export function getPriorityBottleneck(avg, sleepTarget = 8) {
  const none = { bottleneck: null, label: '', emoji: '', coachMsg: '', primary: [], secondary: [] };
  if (avg.daysLogged < 3) return none;

  // 1. Sleep duration — highest priority
  if (avg.hasHoursSleptData && avg.hoursSlept < sleepTarget - 0.5) {
    const deficit = Math.round((sleepTarget - avg.hoursSlept) * 10) / 10;
    return {
      bottleneck: 'sleep_duration',
      label: `Sleep duration — ${avg.hoursSlept}h avg vs ${sleepTarget}h target`,
      emoji: '😴',
      coachMsg: `You're averaging ${deficit}h less sleep than your target each night. Training adaptations, mood, fat loss, and metabolic health all compound on sleep. Fix the duration before adding habits on top.`,
      primary: ['earlier_bedtime', 'no_phone_winddown'],
      secondary: ['bedtime_routine', 'cool_dark_room'],
    };
  }

  // 2. Sleep quality
  if (avg.hasSleepData && avg.sleep < THRESHOLD_LOW) {
    return {
      bottleneck: 'sleep_quality',
      label: `Sleep quality — ${avg.sleep}/10 avg`,
      emoji: '🌙',
      coachMsg: `Sleep quality is averaging ${avg.sleep}/10. Quality determines how restorative your sleep is — light environment, temperature, and evening stimulation are the highest-leverage inputs.`,
      primary: ['evening_light_dim', 'cool_dark_room'],
      secondary: ['red_light_glasses', 'nasal_strips'],
    };
  }

  // 3. Consistency gap
  if (avg.completion < 60) {
    return {
      bottleneck: 'consistency',
      label: `Consistency — ${avg.completion}% task completion`,
      emoji: '📋',
      coachMsg: `Average task completion is ${avg.completion}% over the last 7 days. The routine is likely too demanding for the current season. A smaller, sustainable floor version beats skipping entirely.`,
      primary: ['min_floor_habit', 'micro_commitment'],
      secondary: [],
    };
  }

  // 4. Stress elevated — before recovery per user priority spec
  if (avg.hasStressData && avg.stress >= 7) {
    return {
      bottleneck: 'stress',
      label: `Stress — ${avg.stress}/10 avg`,
      emoji: '🌡️',
      coachMsg: `Stress averaged ${avg.stress}/10 this week. Chronically elevated cortisol compresses sleep quality, raises appetite, and undermines training adaptation. A real-time downshift tool helps most at this level.`,
      primary: ['physiological_sigh', 'recovery_walk'],
      secondary: ['nsdr', 'no_phone_winddown'],
    };
  }

  // 5. Recovery low (including training overload case)
  if (avg.hasRecoveryData && avg.recovery < THRESHOLD_LOW) {
    return {
      bottleneck: 'recovery',
      label: `Recovery — ${avg.recovery}/10 avg`,
      emoji: '🔋',
      coachMsg: `Recovery averaged ${avg.recovery}/10 this week. The body is accumulating fatigue faster than it can clear. Direct recovery inputs — not just extra rest — are needed here.`,
      primary: ['nsdr', 'mobility_session'],
      secondary: ['earlier_bedtime', 'zone2_cardio'],
    };
  }

  // 6. Energy low
  if (avg.hasEnergyData && avg.energy < THRESHOLD_LOW) {
    return {
      bottleneck: 'energy',
      label: `Energy — ${avg.energy}/10 avg`,
      emoji: '⚡',
      coachMsg: `Energy averaged ${avg.energy}/10 this week despite a consistent routine. This typically points to a recovery deficit — sleep quality, circadian timing, hydration, or training load.`,
      primary: ['morning_sunlight', 'hydration_check'],
      secondary: ['nsdr', 'earlier_bedtime'],
    };
  }

  // 7. Mood low
  if (avg.hasMoodData && avg.mood < THRESHOLD_LOW) {
    return {
      bottleneck: 'mood',
      label: `Mood — ${avg.mood}/10 avg`,
      emoji: '😊',
      coachMsg: `Mood averaged ${avg.mood}/10 this week. In the context of a consistent routine, low mood usually points to missing recovery inputs — sleep, sunlight, movement, or an overstimulated nervous system.`,
      primary: ['zone2_cardio', 'gratitude_journal'],
      secondary: ['recovery_walk', 'morning_sunlight'],
    };
  }

  // 8. Confidence low
  if (avg.hasConfData && avg.confidence < THRESHOLD_LOW) {
    return {
      bottleneck: 'confidence',
      label: `Confidence — ${avg.confidence}/10 avg`,
      emoji: '💪',
      coachMsg: `Confidence averaged ${avg.confidence}/10 this week. Confidence is downstream of consistent small wins — it follows behavior, not motivation. One kept promise per day compounds faster than trying to do more.`,
      primary: ['daily_win_journal', 'micro_commitment'],
      secondary: ['phone_free_focus'],
    };
  }

  return none;
}

/**
 * Generate up to 2 personalized habit suggestions based on 7-day averages.
 *
 * Priority order (per spec):
 *   sleep duration (0–2) → sleep quality (3–5) → stress (6–7) →
 *   recovery (8–9) → energy (10–11) → mood (12–13) → confidence (14–15) →
 *   glucose / joey-only (16) → consistency fallback (17–18)
 *
 * Morning sunlight is deferred when sleep hours are below target
 * (fixing duration is the root cause; sunlight helps but doesn't fix it).
 *
 * Each suggestion: { habitId, pattern, message, reason, priority }
 */
export function generateSuggestions(avg, activeHabitIds = [], dismissedHabitIds = [], sleepTarget = 8) {
  if (avg.daysLogged < 3) return [];

  const excluded   = new Set([...activeHabitIds, ...dismissedHabitIds]);
  const candidates = [];
  const sleepDurationLow = avg.hasHoursSleptData && avg.hoursSlept < sleepTarget - 0.5;

  function add(habitId, pattern, message, reason, priority) {
    if (!excluded.has(habitId) && !candidates.find(c => c.habitId === habitId)) {
      candidates.push({ habitId, pattern, message, reason, priority });
    }
  }

  const { completion: comp, energy, sleep, mood, confidence: conf } = avg;

  // ── Sleep duration (priority tier 0) ─────────────────────────────────────
  if (sleepDurationLow) {
    const deficit = Math.round((sleepTarget - avg.hoursSlept) * 10) / 10;
    add('earlier_bedtime',
      `Sleep averaged ${avg.hoursSlept}h this week vs your ${sleepTarget}h target — a ${deficit}h nightly deficit.`,
      `Sleep duration is the first bottleneck. Try going to bed ${deficit}h earlier for 7 days to close the gap.`,
      `Sleep debt accumulates additively. A ${deficit}h nightly deficit means losing ~${Math.round(deficit * 7 * 10) / 10}h of recovery per week. Bedtime determines duration more than wake time for most people — it's the primary lever.`,
      0);
    add('no_phone_winddown',
      `Sleep averaged ${avg.hoursSlept}h vs your ${sleepTarget}h target. Phone use near bed is a common bedtime-delay mechanism.`,
      `Sleep duration is the first bottleneck. A 30-minute phone-free wind down before bed can help you fall asleep earlier.`,
      `Phone use delays bedtime through two mechanisms: blue light pushes melatonin onset later, and psychological engagement raises alertness. Removing both for 30 minutes before bed is often the easiest way to implement an earlier bedtime without willpower.`,
      0);
    add('cool_dark_room',
      `Sleep averaged ${avg.hoursSlept}h vs your ${sleepTarget}h target.`,
      `Sleep duration is the first bottleneck. A cooler, darker room helps you fall asleep faster and stay asleep longer.`,
      `Core body temperature must drop ~2°F to initiate and sustain sleep. A room set to 65–68°F with blackout curtains speeds this drop and reduces early-morning waking — two common causes of short sleep duration.`,
      1);
  }

  // ── Sleep quality (priority tier 1) ──────────────────────────────────────
  if (avg.hasSleepData && sleep < THRESHOLD_LOW) {
    add('evening_light_dim',
      `Sleep quality averaged ${sleep}/10 this week.`,
      `Sleep quality is low. Try dimming overhead lights 2–3 hours before bed for 7 days — it's the lowest-friction sleep input to change.`,
      `Bright overhead lighting in the evening suppresses melatonin production, pushing sleep onset later and reducing sleep depth. Switching to lamps or floor lights 2–3 hours before bed costs nothing and has strong evidence behind it.`,
      sleepDurationLow ? 3 : 2);
    add('cool_dark_room',
      `Sleep quality averaged ${sleep}/10 this week. Room environment directly affects sleep depth.`,
      `Sleep quality is low. A cooler, darker room is one of the most evidence-backed sleep quality improvements you can make.`,
      `Core body temperature must drop ~2°F to initiate deep sleep. A cool (65–68°F), dark room makes this easier and increases time in slow-wave sleep — the most physically restorative phase.`,
      sleepDurationLow ? 3 : 2);
    add('nsdr',
      `Sleep quality averaged ${sleep}/10 this week. NSDR can partially offset the cost of poor nights while you address the root cause.`,
      `Sleep quality is low. A 10–20 min NSDR session in the afternoon can recover some of what poor sleep takes away.`,
      `Non-sleep deep rest (NSDR / Yoga Nidra) triggers the same parasympathetic restoration as early sleep stages. When sleep quality is low, an afternoon NSDR session reduces some of the cognitive and hormonal debt accumulated overnight.`,
      sleepDurationLow ? 4 : 3);
  }

  // ── Stress elevated (priority tier 2 — per spec, above recovery) ─────────
  if (avg.hasStressData && avg.stress >= 7) {
    add('physiological_sigh',
      `Stress averaged ${avg.stress}/10 this week.`,
      `Stress is elevated. Try adding physiological sigh breathing for 7 days — it's the fastest-acting real-time cortisol tool there is.`,
      `When average stress stays at or above 7/10 across a week, cortisol is likely elevated chronically. Physiological sighs (double inhale, long exhale) are the fastest-acting autonomic intervention: used reactively, they prevent cortisol spikes from compounding. 30 seconds, no setup.`,
      6);
    add('recovery_walk',
      `Stress averaged ${avg.stress}/10 this week. Low-intensity outdoor movement is one of the most underused cortisol tools.`,
      `Stress is elevated. A short daily walk — outside if possible — can lower cortisol without adding any training load.`,
      `Walking at an easy pace outdoors lowers cortisol, improves mood through rhythmic movement and sunlight, and resets the nervous system without any recovery cost. When stress is chronically elevated, adding a walk is often more effective than adding more structured activity.`,
      6);
    // Morning sunlight helps stress regulation, but only if sleep is not the root cause
    if (!sleepDurationLow) {
      add('no_phone_winddown',
        `Stress averaged ${avg.stress}/10 this week. Evening screen use can keep cortisol elevated into the night.`,
        `Stress is elevated. A 30-minute phone-free wind down before bed can help your nervous system fully downshift before sleep.`,
        `Evening phone use maintains sympathetic (alert) nervous system activation and delays the natural cortisol decline that begins ~2 hours before sleep. A phone-free wind down lets that decline happen earlier and more completely.`,
        7);
    }
  }

  // ── Recovery low (priority tier 3 — per spec, above energy) ──────────────
  // Case A: Low recovery score regardless of training load
  if (avg.hasRecoveryData && avg.recovery < THRESHOLD_LOW) {
    add('nsdr',
      `Recovery averaged ${avg.recovery}/10 this week.`,
      `Recovery is low. Try a 10–20 min NSDR or Yoga Nidra session for 7 days — it directly targets nervous system recovery.`,
      `NSDR (Non-Sleep Deep Rest) triggers parasympathetic restoration equivalent to early sleep stages — restoring dopamine and shifting the autonomic state toward repair. When recovery scores are consistently low, adding a direct recovery stimulus (not just more sleep time) often produces the fastest improvement.`,
      8);
    add('mobility_session',
      `Recovery averaged ${avg.recovery}/10 this week.`,
      `Recovery is low. Try a daily 10–15 min mobility or stretching session for 7 days to actively support the recovery process.`,
      `Soreness and poor recovery are often compounded by restricted movement and accumulated tension. Regular mobility work drives blood flow, reduces perceived soreness, and signals the nervous system that the body is actively managing fatigue rather than just waiting it out.`,
      8);
    add('earlier_bedtime',
      `Recovery averaged ${avg.recovery}/10 this week. Sleep is the primary recovery input — bedtime is the easiest lever.`,
      `Recovery is low. Try going to bed 30 minutes earlier for 7 days and see if recovery scores improve.`,
      `The majority of physical repair and hormonal recovery occurs in the final sleep hours before waking. Getting to bed earlier — even by 30 minutes — increases time in those critical late sleep phases, which directly drives the recovery metric.`,
      9);
  }

  // Case B: High effort + poor recovery (training overload)
  if (avg.hasEffortData && avg.hasRecoveryData && avg.workoutEffort >= 8 && avg.recovery < THRESHOLD_LOW) {
    add('zone2_cardio',
      `Workout effort averaged ${avg.workoutEffort}/10, but recovery is ${avg.recovery}/10 — output may be outpacing adaptation.`,
      `You're training hard, but recovery is lagging. Try swapping one session per week for easy zone 2 cardio.`,
      `When high-intensity training is the norm, a separate low-intensity zone 2 session on recovery days accelerates clearance of metabolic byproducts without adding stress. It also improves aerobic base, which directly raises recovery capacity over weeks.`,
      9);
  }

  // Case C: High effort + sleep or energy dropping
  if (avg.hasEffortData && avg.workoutEffort >= 7.5) {
    if ((avg.hasSleepData && sleep < THRESHOLD_LOW) || (avg.hasEnergyData && energy < THRESHOLD_LOW)) {
      add('nsdr',
        `Workout effort averaged ${avg.workoutEffort}/10 and ${avg.hasSleepData && sleep < THRESHOLD_LOW ? `sleep quality is ${sleep}/10` : `energy is ${energy}/10`}.`,
        `Training intensity may be outpacing recovery. A 10–20 min NSDR session can help bridge the recovery gap.`,
        `High training intensity compresses recovery windows. When effort stays above 7.5/10 and sleep quality or energy drops, the body is signaling that output is exceeding input. NSDR provides a direct recovery stimulus that sleep alone may not supply.`,
        9);
    }
  }

  // ── Energy low (priority tier 4) ─────────────────────────────────────────
  if (avg.hasEnergyData && energy < THRESHOLD_LOW) {
    if (!sleepDurationLow) {
      add('morning_sunlight',
        `Energy averaged ${energy}/10 this week.`,
        `Energy is low. Try getting 5–10 minutes of morning sunlight within 60 minutes of waking for 7 days.`,
        `Morning sunlight suppresses residual melatonin and triggers the cortisol awakening response — the body's built-in alertness signal. Without it, energy tends to plateau lower through the day, especially with a demanding training routine.`,
        10);
    }
    add('hydration_check',
      `Energy averaged ${energy}/10 this week. Dehydration is a commonly overlooked energy drain.`,
      `Energy is low. Try tracking your water intake and hitting 2.5–3L/day for 7 days — especially on training days.`,
      `Even mild dehydration (1–2% of body weight) measurably reduces energy, cognitive function, and mood. Most people in a demanding training routine underestimate daily fluid needs. Adding electrolytes on hard training days helps maintain performance.`,
      10);
    add('nsdr',
      `Energy averaged ${energy}/10 this week despite a solid routine.`,
      `Energy is low. Try a 10–20 min NSDR session in the afternoon for 7 days to support recovery without requiring more sleep time.`,
      `Cumulative fatigue builds even when sleep looks adequate. NSDR replenishes dopamine stores and directly targets nervous system recovery — one of the few tools that works even when you can't sleep more hours.`,
      11);
  }

  // ── Mood low (priority tier 5) ────────────────────────────────────────────
  if (avg.hasMoodData && mood < THRESHOLD_LOW) {
    add('zone2_cardio',
      `Mood averaged ${mood}/10 this week.`,
      `Mood is low. Try adding 20–30 minutes of easy zone 2 cardio per day for 7 days — it's one of the most consistent mood tools available.`,
      `Zone 2 cardio raises BDNF (brain-derived neurotrophic factor), normalizes cortisol, and provides a sense of accomplishment without taxing recovery. If you're already training hard, a separate easy session often does more for mood than adding intensity.`,
      12);
    add('gratitude_journal',
      `Mood averaged ${mood}/10 this week.`,
      `Mood is low. Try writing down 3 specific things you're grateful for each day for 7 days — it's one of the highest-evidence mood interventions available.`,
      `Gratitude journaling has one of the strongest effect sizes for mood among low-cost daily practices in positive psychology research. It trains the brain's attention toward positive input rather than the default threat-scanning that low mood reinforces.`,
      12);
    add('recovery_walk',
      `Mood averaged ${mood}/10 this week. Low-intensity outdoor movement directly affects mood through multiple pathways.`,
      `Mood is low. A short daily walk outside — even 15 minutes — can meaningfully shift mood through sunlight, rhythmic movement, and lower cortisol.`,
      `Outdoor walking combines sunlight exposure (serotonin and vitamin D), rhythmic bilateral movement (a natural stress regulator), and reduced cortisol — three direct mood inputs in one low-effort habit.`,
      13);
    if (avg.stressInNotes || (avg.hasStressData && avg.stress >= 6)) {
      add('physiological_sigh',
        `Mood averaged ${mood}/10 and ${avg.hasStressData ? `stress averaged ${avg.stress}/10` : 'notes suggest stress is accumulating'} this week.`,
        `Mood is low and stress is present. Try physiological sigh breathing when you notice stress rising — it can prevent acute cortisol spikes from compounding into mood suppression.`,
        `When stress and low mood co-occur, cortisol is likely elevated chronically. Physiological sighs used reactively prevent acute spikes from compounding across the day — distinct from a meditation practice. Works in 30 seconds, anywhere.`,
        13);
    }
  }

  // ── Confidence low (priority tier 6) ─────────────────────────────────────
  if (avg.hasConfData && conf < THRESHOLD_LOW) {
    add('daily_win_journal',
      `Confidence averaged ${conf}/10 this week.`,
      `Confidence is low. Try writing down 1–3 specific wins each evening for 7 days — confidence follows a concrete record of kept promises.`,
      `Confidence builds bottom-up from a documented record of competence, not top-down from motivation or positive thinking. A daily win journal gives the brain concrete evidence to draw from — faster than trying to do more or feel more motivated.`,
      14);
    add('micro_commitment',
      `Confidence averaged ${conf}/10 this week.`,
      `Confidence is low. Pick one small daily promise and keep it without exception for 7 days — self-trust is rebuilt one kept commitment at a time.`,
      `Confidence is downstream of consistent small wins. A micro-commitment that always happens (no exceptions) builds the neural record of reliability that genuine confidence is built on. Identity follows behavior — this is the fastest re-anchor.`,
      14);
    add('phone_free_focus',
      `Confidence averaged ${conf}/10 this week.`,
      `Confidence is low. A daily 90-minute phone-free focus block creates direct proof of being capable and in control of your attention.`,
      `A 90-minute uninterrupted focus block produces direct evidence of competence and self-control. Repeated daily, it accumulates into confidence through demonstrated capability — not motivation, but proof.`,
      15);
  }

  // ── Setback pattern — repeated missed/partial days ─────────────────────────
  const hasSetbackPattern = avg.missedDays >= 2 || avg.partialDays >= 3;
  if (hasSetbackPattern) {
    add('min_floor_habit',
      `${avg.missedDays >= 2 ? `${avg.missedDays} days with very low completion` : `${avg.partialDays} partial days`} this week.`,
      `Consistency is the pattern to rebuild. A minimum floor version of your hardest habit keeps the chain alive on difficult days — better than zero.`,
      `When days keep falling short, the routine is outpacing the current season. A minimum floor target — even one short daily promise — prevents zero-days and rebuilds the identity layer that momentum sits on.`,
      16);
    add('physiological_sigh',
      `${avg.missedDays >= 2 ? 'Multiple low-completion days' : 'Repeated partial days'} this week suggest external pressure is building.`,
      `When life is difficult, a real-time stress tool has an outsized return. Physiological sigh breathing takes 30 seconds and can prevent cortisol spikes from compounding through the day.`,
      `When circumstances make the routine hard to complete, cortisol tends to stay chronically elevated. A rapid-acting tool used reactively prevents acute spikes from compounding — distinct from a scheduled habit. Works anywhere, any time.`,
      16);
  }

  // ── Consistency fallback (for < 60% completion with no priority hit above) ─
  if (comp < 60 && candidates.length === 0) {
    add('min_floor_habit',
      `Task completion averaged ${comp}% this week.`,
      `Consistency is the first bottleneck. Try defining a minimum "floor" version of your hardest habit and hitting just that for 7 days.`,
      `When completion drops below 60%, the routine is likely too demanding for the current season. A floor target — the minimum viable version of your hardest habit — keeps the identity intact on hard days without letting zero-days accumulate.`,
      17);
    add('micro_commitment',
      `Task completion averaged ${comp}% this week.`,
      `Consistency is the first bottleneck. Pick one small daily promise you can keep every single day without exception, and rebuild from there.`,
      `A single micro-commitment that always happens rebuilds self-trust faster than trying to do more. Identity follows behavior — this is the fastest re-anchor when momentum has broken down.`,
      18);
  }

  // ── High workout rate but very low energy ─────────────────────────────────
  if (avg.workoutRate >= 75 && avg.hasEnergyData && energy < THRESHOLD_VERY_LOW) {
    add('nsdr',
      `Workout rate is ${avg.workoutRate}%, but energy averaged ${energy}/10 — training load may be outpacing recovery.`,
      `You're training frequently but energy is very low. A daily NSDR session can help the nervous system catch up on recovery.`,
      `High training frequency without matching recovery creates cumulative fatigue that compounds over 7–14 days. NSDR targets nervous system recovery directly — it's often the missing input when training volume is high but energy stays low.`,
      11);
  }

  // ── High diet completion but hunger in notes ──────────────────────────────
  if (avg.hungerInNotes && avg.dietRate >= 70) {
    add('protein_baseline',
      `Diet adherence is ${avg.dietRate}%, but notes suggest hunger or cravings are present.`,
      `Diet adherence is solid, but hunger keeps showing up. Try tracking daily protein for 7 days — it's often the missing lever.`,
      `Protein is the most satiating macronutrient per calorie. If diet adherence is high but hunger is still elevated, protein adequacy is the most likely lever — before willpower, timing, or restriction.`,
      15);
  }

  // ── Fallback when nothing specific flagged ────────────────────────────────
  if (candidates.length === 0 && avg.daysLogged >= 5) {
    add('physiological_sigh',
      `No clear patterns to flag right now. Things look solid.`,
      `Your current routine seems to be working. This is a good "insurance" habit to have in your toolkit anyway.`,
      `Even when everything looks solid, a real-time stress tool is worth having. Physiological sighs take 30 seconds and are one of the fastest-acting autonomic interventions known.`,
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
    { key: 'recovery',   label: 'Recovery' },
    { key: 'stress',     label: 'Stress' },
  ];

  const deltas = [];
  let improved = 0, worsened = 0;

  for (const { key, label } of metrics) {
    if (baseline[key] > 0 && result[key] > 0) {
      let d = Math.round((result[key] - baseline[key]) * 10) / 10;
      const effectiveD = key === 'stress' ? -d : d;
      deltas.push({ key, label, before: baseline[key], after: result[key], delta: d });
      if (effectiveD >=  0.5) improved++;
      if (effectiveD <= -0.5) worsened++;
    }
  }

  let verdict, verdictText;
  if      (improved >= 2 && worsened === 0) { verdict = 'helped';    verdictText = 'This seemed to help. Consider keeping it.'; }
  else if (worsened >= 2)                   { verdict = 'unclear';   verdictText = 'Results are mixed. This may not be the right fit right now.'; }
  else if (improved >= 1)                   { verdict = 'possibly';  verdictText = 'Some signs of improvement. One more trial may give a clearer signal.'; }
  else                                      { verdict = 'no_effect'; verdictText = 'No clear change detected. Consider a different experiment.'; }

  return { verdict, verdictText, deltas };
}
