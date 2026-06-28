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
    recovery: 0, workoutEffort: 0, stress: 0,
    hoursSlept: 0,
    workoutRate: 0, dietRate: 0, mentalRate: 0,
    glucoseWarnings: 0,
    stressInNotes: false, hungerInNotes: false,
    hasEnergyData: false, hasSleepData: false,
    hasMoodData: false,   hasConfData: false,
    hasRecoveryData: false, hasEffortData: false, hasStressData: false,
    hasHoursSleptData: false,
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
  let glucoseWarnings = 0;
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

    if (data.glucoseNotes) {
      const g = data.glucoseNotes.toLowerCase();
      if (GLUCOSE_KEYWORDS.some(kw => g.includes(kw))) glucoseWarnings++;
    }
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
  base.glucoseWarnings   = glucoseWarnings;
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

  // Sleep quality poor (when hours not tracked)
  if (avg.hasSleepData && avg.sleep < THRESHOLD_LOW && !avg.hasHoursSleptData) {
    return { type: 'warn', text: "Sleep quality is low. Address sleep before layering on new habits — it's the foundation everything else builds on." };
  }

  // Stress elevated
  if (avg.hasStressData && avg.stress >= 7) {
    return { type: 'warn', text: "Stress is elevated. Add a nervous system downshift habit." };
  }

  // Hard training but poor recovery
  if (avg.hasEffortData && avg.hasRecoveryData && avg.workoutEffort >= 8 && avg.recovery < 6) {
    return { type: 'warn', text: "You're training hard, but recovery is lagging." };
  }

  const hasLow =
    (avg.hasEnergyData    && avg.energy     < THRESHOLD_LOW) ||
    (avg.hasSleepData     && avg.sleep      < THRESHOLD_LOW) ||
    (avg.hasMoodData      && avg.mood       < THRESHOLD_LOW) ||
    (avg.hasConfData      && avg.confidence < THRESHOLD_LOW);

  // Recovery high + no low metrics → positive
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
 * recommended habits. Returns null bottleneck when data is insufficient.
 */
export function getPriorityBottleneck(avg, sleepTarget = 8, isJoey = false) {
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

  // 4. Training load vs recovery
  if (avg.hasEffortData && avg.hasRecoveryData && avg.workoutEffort >= 8 && avg.recovery < THRESHOLD_LOW) {
    return {
      bottleneck: 'training_load',
      label: `Training load — effort ${avg.workoutEffort}/10, recovery ${avg.recovery}/10`,
      emoji: '🏋️',
      coachMsg: `Workout effort is consistently high (${avg.workoutEffort}/10) while recovery is lagging (${avg.recovery}/10). Training load is outpacing adaptation. Recovery needs direct support, not just rest days.`,
      primary: ['nsdr', 'zone2_cardio'],
      secondary: ['evening_light_dim'],
    };
  }

  // 5. Stress elevated
  if (avg.hasStressData && avg.stress >= 7) {
    return {
      bottleneck: 'stress',
      label: `Stress — ${avg.stress}/10 avg`,
      emoji: '🌡️',
      coachMsg: `Stress is averaging ${avg.stress}/10. Chronically elevated cortisol compresses sleep quality, raises appetite, and undermines training adaptation. A real-time downshift tool helps most here.`,
      primary: ['physiological_sigh', 'nsdr'],
      secondary: ['morning_sunlight'],
    };
  }

  // 6. Energy low
  if (avg.hasEnergyData && avg.energy < THRESHOLD_LOW) {
    return {
      bottleneck: 'energy',
      label: `Energy — ${avg.energy}/10 avg`,
      emoji: '⚡',
      coachMsg: `Energy is averaging ${avg.energy}/10 despite a consistent routine. This typically points to a recovery deficit — sleep quality, circadian timing, or training load not matching recovery.`,
      primary: ['morning_sunlight', 'nsdr'],
      secondary: isJoey ? ['post_meal_walk'] : ['zone2_cardio'],
    };
  }

  // 7. Mood low
  if (avg.hasMoodData && avg.mood < THRESHOLD_LOW) {
    return {
      bottleneck: 'mood',
      label: `Mood — ${avg.mood}/10 avg`,
      emoji: '😊',
      coachMsg: `Mood is averaging ${avg.mood}/10. In the context of a consistent routine, low mood usually points to missing recovery inputs — sleep, sunlight, or an overstimulated nervous system.`,
      primary: ['zone2_cardio', 'morning_sunlight'],
      secondary: ['physiological_sigh'],
    };
  }

  // 8. Confidence low
  if (avg.hasConfData && avg.confidence < THRESHOLD_LOW) {
    return {
      bottleneck: 'confidence',
      label: `Confidence — ${avg.confidence}/10 avg`,
      emoji: '💪',
      coachMsg: `Confidence is averaging ${avg.confidence}/10. Confidence is downstream of consistent small wins — it follows behavior, not motivation. One kept promise per day compounds faster than trying to do more.`,
      primary: ['micro_commitment', 'phone_free_focus'],
      secondary: [],
    };
  }

  return none;
}

/**
 * Generate up to 2 personalized habit suggestions based on 7-day averages.
 *
 * Priority order: sleep duration → sleep quality → training gap →
 *   stress → energy → mood → confidence → consistency
 *
 * Morning sunlight is deferred when sleep hours are low (circadian anchor
 * helps, but fixing duration is the root cause).
 *
 * Each suggestion: { habitId, pattern, message, reason, priority }
 */
export function generateSuggestions(avg, isJoey, activeHabitIds = [], dismissedHabitIds = [], sleepTarget = 8) {
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

  // ── Rule 1: Low completion → consistency habits first ─────────────────────
  if (comp < 60) {
    add('min_floor_habit',
      `Average task completion is ${comp}% over the last 7 days.`,
      'Consistency is the first bottleneck. Start with a smaller floor target before adding more habits.',
      `When completion drops below 60%, the routine is likely too demanding for the current season. A "floor target" — the minimum viable version of your hardest habit — keeps the identity intact on hard days without letting zero-days accumulate.`,
      10);
    add('micro_commitment',
      `Average task completion is ${comp}% — the habit reflex needs rebuilding before adding more.`,
      'Consistency is the first bottleneck. A single daily promise that always happens re-anchors the identity.',
      `A micro-commitment that always happens (no exceptions) rebuilds self-trust faster than trying to do more. Identity follows behavior — this is the fastest re-anchor when momentum has broken down.`,
      11);
  }

  if (comp >= THRESHOLD_COMP) {

    // ── Sleep duration (priority tier 0) ─────────────────────────────────────
    if (sleepDurationLow) {
      const deficit = Math.round((sleepTarget - avg.hoursSlept) * 10) / 10;
      add('earlier_bedtime',
        `Averaging ${avg.hoursSlept}h vs your ${sleepTarget}h sleep target (${deficit}h deficit per night).`,
        'Sleep duration is the first bottleneck. The most direct fix is going to bed earlier.',
        `Sleep debt is additive. A ${deficit}h nightly deficit means losing ~${Math.round(deficit * 7 * 10) / 10}h of recovery per week. Bedtime determines sleep duration more than wake time for most people — it's the primary lever.`,
        0);
      add('no_phone_winddown',
        `Averaging ${avg.hoursSlept}h vs ${sleepTarget}h target. Phone use near bed is a common bedtime-delay mechanism.`,
        'Sleep duration is the first bottleneck. Removing the last barrier to bed may be the fastest fix.',
        `Phone use delays bedtime through two mechanisms: blue light pushes melatonin onset later, and psychological engagement raises alertness. A 30-minute phone-free wind-down removes both.`,
        0);
      add('bedtime_routine',
        `Averaging ${avg.hoursSlept}h vs ${sleepTarget}h target. A consistent pre-sleep routine anchors earlier bedtimes.`,
        'Sleep duration is the first bottleneck. A routine makes an earlier bedtime self-reinforcing.',
        `Without a predictable pre-sleep routine, bedtime drifts later whenever willpower runs low. A 10–15 minute wind-down sequence (same time, same cues each night) creates a conditioned sleep response — the body begins shifting toward sleep before you're in bed.`,
        1);
    }

    // ── Sleep quality (priority tier 1) ──────────────────────────────────────
    if (avg.hasSleepData && sleep < THRESHOLD_LOW) {
      add('evening_light_dim',
        `Completion is ${comp}%, but sleep quality is averaging ${sleep}/10.`,
        'Discipline is strong, but sleep quality is limiting adaptation.',
        `Bright overhead lighting in the evening blocks melatonin production, pushing sleep onset later. Dimming or switching to low floor lights 2–3 hours before bed is the lowest-friction first step — no supplements, no gadgets.`,
        sleepDurationLow ? 2 : 1);
      add('cool_dark_room',
        `Sleep quality is ${sleep}/10. Room temperature and darkness are directly linked to deep sleep time.`,
        'Discipline is strong, but sleep quality is limiting adaptation.',
        `Core body temperature must drop ~2°F to initiate sleep. A cool (65–68°F), dark room facilitates this drop and increases time spent in deep slow-wave sleep — the most physically restorative phase.`,
        sleepDurationLow ? 2 : 1);
      add('nsdr',
        `Completion is ${comp}%, but sleep quality is ${sleep}/10. NSDR can partially offset the cost of poor nights.`,
        'Discipline is strong, but sleep quality is limiting adaptation.',
        `Non-sleep deep rest (NSDR / Yoga Nidra) triggers parasympathetic restoration similar to early sleep stages. A 10–20 min afternoon session offsets some of the cognitive and hormonal cost of poor sleep nights.`,
        sleepDurationLow ? 3 : 2);
    }

    // ── Training load vs recovery (priority tier 2) ───────────────────────
    if (avg.hasEffortData && avg.hasRecoveryData && avg.workoutEffort >= 8 && avg.recovery < THRESHOLD_LOW) {
      add('nsdr',
        `Workout effort is averaging ${avg.workoutEffort}/10, but recovery is ${avg.recovery}/10 — training load may be outpacing adaptation.`,
        "You're training hard, but recovery is lagging.",
        `When effort is consistently high (8+/10) but recovery stays below 6/10, the body is accumulating fatigue faster than it can adapt. NSDR directly targets nervous system recovery — it restores dopamine and shifts the autonomic state toward repair.`,
        3);
      add('zone2_cardio',
        `Effort is averaging ${avg.workoutEffort}/10 but recovery is ${avg.recovery}/10. Lower-intensity active recovery may help.`,
        "You're training hard, but recovery is lagging.",
        `When high-intensity training is the norm, adding a low-intensity zone 2 session on recovery days accelerates clearance of metabolic byproducts without adding significant stress. It also improves aerobic base, which directly supports recovery capacity.`,
        4);
    }

    // High effort + sleep or energy dropping
    if (avg.hasEffortData && avg.workoutEffort >= 7.5) {
      if ((avg.hasSleepData && sleep < THRESHOLD_LOW) || (avg.hasEnergyData && energy < THRESHOLD_LOW)) {
        add('nsdr',
          `Workout effort is ${avg.workoutEffort}/10, and ${avg.hasSleepData && sleep < THRESHOLD_LOW ? `sleep is ${sleep}/10` : `energy is ${energy}/10`}.`,
          'Training intensity may be outpacing recovery.',
          `High training intensity compresses recovery windows. When effort stays above 7.5/10 and either sleep quality or energy starts dropping, the body is signaling that output is exceeding input. NSDR provides a direct recovery stimulus that sleep alone may not fully supply.`,
          4);
        add('evening_light_dim',
          `Workout effort is ${avg.workoutEffort}/10 and sleep quality is ${sleep}/10 — high training intensity may be disrupting sleep architecture.`,
          'Training intensity may be outpacing recovery.',
          `Evening workouts or unmanaged evening light exposure can delay melatonin onset and reduce slow-wave sleep — the most restorative phase. Dimming overhead lights 2–3 hours before bed is the lowest-cost first step to protect sleep quality when training load is high.`,
          5);
      }
    }

    // ── Stress elevated (priority tier 2.5) ──────────────────────────────
    if (avg.hasStressData && avg.stress >= 7) {
      add('physiological_sigh',
        `Stress is averaging ${avg.stress}/10 over the last 7 days.`,
        'Stress is elevated. Add a nervous system downshift habit.',
        `When average stress stays at or above 7/10 across a week, cortisol baseline is elevated chronically. Physiological sighs are the fastest-acting autonomic intervention: used reactively (in moments of stress), they prevent cortisol spikes from compounding across the day. 30 seconds, no setup required.`,
        5);
      // Morning sunlight for stress regulation — only if sleep is not the primary issue
      if (!sleepDurationLow) {
        add('morning_sunlight',
          `Stress is averaging ${avg.stress}/10. Morning light helps regulate the cortisol awakening response.`,
          'Stress is elevated. Add a nervous system downshift habit.',
          `The cortisol awakening response (CAR) in the first 30–45 minutes after waking is the body's primary daily stress regulation mechanism. Morning sunlight syncs this response to a predictable rhythm, reducing erratic cortisol fluctuations that amplify perceived stress throughout the day.`,
          6);
      }
    }

    // ── Energy (priority tier 3) ──────────────────────────────────────────
    if (avg.hasEnergyData && energy < THRESHOLD_LOW) {
      // Morning sunlight deferred when sleep hours are low (fixing duration is root cause)
      if (!sleepDurationLow) {
        add('morning_sunlight',
          `Completion is ${comp}%, but energy is averaging ${energy}/10.`,
          "You're doing the tasks, but energy is lagging. Recovery, light exposure, or food timing may need attention.",
          `Morning sunlight suppresses residual melatonin and triggers the cortisol awakening response — the body's built-in alertness signal. Without it, energy tends to plateau lower through the day, particularly when workouts and a demanding routine are involved.`,
          6);
      }
      if (isJoey && avg.glucoseWarnings >= 1) {
        add('post_meal_walk',
          `Completion is ${comp}%, energy is ${energy}/10, and glucose notes suggest post-meal patterns.`,
          "Post-meal energy crashes may be linked to glucose response. A short walk after meals may help.",
          `Post-meal muscle activity drives glucose into cells via a non-insulin pathway (GLUT4 translocation), reducing the amplitude of glucose peaks. Smaller peaks mean fewer 1–2 hour post-meal energy crashes.`,
          6);
      }
      add('nsdr',
        `Completion is ${comp}%, energy is ${energy}/10 despite a solid routine.`,
        "You're doing the tasks, but energy is lagging. Recovery may need direct support.",
        `Cumulative fatigue builds even when sleep nights look adequate. NSDR replenishes dopamine stores and directly targets nervous system recovery — one of the few tools that works even when you can't sleep more.`,
        7);
    }

    // ── Mood (priority tier 4) ────────────────────────────────────────────
    if (avg.hasMoodData && mood < THRESHOLD_LOW) {
      add('zone2_cardio',
        `Completion is ${comp}%, but mood is averaging ${mood}/10.`,
        'Your routine is consistent, but mood is lagging. Add a low-intensity nervous system/mood support habit.',
        `Zone 2 cardio raises BDNF (brain-derived neurotrophic factor), normalizes cortisol, and provides accomplishment without taxing recovery. If you're already training hard, a separate easy session may do more for mood than adding intensity.`,
        8);
      if (!sleepDurationLow) {
        add('morning_sunlight',
          `Completion is ${comp}%, but mood is ${mood}/10. Morning light directly influences serotonin availability.`,
          'Your routine is consistent, but mood is lagging. A circadian anchor may help stabilize the baseline.',
          `Morning sunlight drives serotonin synthesis and stabilizes mood through circadian rhythm regulation. Low serotonin baseline is a common contributor to low mood even in people with a strong exercise and sleep routine.`,
          9);
      }
      if (avg.stressInNotes || (avg.hasStressData && avg.stress >= 6)) {
        add('physiological_sigh',
          `Completion is ${comp}%, mood is ${mood}/10, and ${avg.hasStressData ? `stress is averaging ${avg.stress}/10` : 'notes suggest stress is accumulating'}.`,
          'Your routine is consistent, but mood is lagging. A real-time stress tool may lower the baseline.',
          `When stress and low mood co-occur, cortisol is likely elevated chronically. Physiological sighs used reactively prevent acute cortisol spikes from compounding — distinct from a meditation practice. Works in 30 seconds anywhere.`,
          9);
      }
    }

    // ── Confidence (priority tier 5) ──────────────────────────────────────
    if (avg.hasConfData && conf < THRESHOLD_LOW) {
      add('micro_commitment',
        `Completion is ${comp}%, but confidence is averaging ${conf}/10.`,
        'Confidence may need proof-building, not motivation. Choose one promise and keep it daily.',
        `Confidence is downstream of consistent small wins. A micro-commitment that always happens creates the neural record of reliability that genuine confidence is built on — faster than trying to do more.`,
        10);
      add('phone_free_focus',
        `Completion is ${comp}%, but confidence is ${conf}/10.`,
        'Confidence may need proof-building, not motivation. Demonstrated competence compounds.',
        `A 90-minute uninterrupted focus block creates direct evidence of being capable and in control of attention. Repeated daily, it accumulates into confidence through demonstrated competence — not motivation, but proof.`,
        11);
    }
  }

  // ── High workout rate but very low energy ─────────────────────────────────
  if (avg.workoutRate >= 75 && avg.hasEnergyData && energy < THRESHOLD_VERY_LOW) {
    add('nsdr',
      `Workout rate is ${avg.workoutRate}%, but energy is ${energy}/10 — training load may be outpacing recovery.`,
      'Training is happening, but recovery may be behind.',
      `High training frequency without matching recovery creates cumulative fatigue that compounds over 7–14 days. NSDR targets nervous system recovery directly rather than waiting for sleep to compensate.`,
      7);
  }

  // ── High diet completion but hunger in notes ──────────────────────────────
  if (avg.hungerInNotes && avg.dietRate >= 70) {
    add('protein_baseline',
      `Diet adherence is ${avg.dietRate}%, but notes suggest hunger or cravings are present.`,
      'Diet adherence is good, but hunger may threaten consistency. Protein and meal structure may help.',
      `Protein is the most satiating macronutrient per calorie. If diet adherence is high but hunger is still elevated, protein adequacy is the most likely lever — before willpower, timing, or restriction.`,
      8);
  }

  // ── Joey — glucose note patterns ──────────────────────────────────────────
  if (isJoey && avg.glucoseWarnings >= 2) {
    add('post_meal_walk',
      `Glucose notes over the last 7 days show repeated patterns worth monitoring.`,
      'Watch Dexcom trends, carry fast-acting carbs during workouts, and discuss repeated patterns with a clinician.',
      `Post-meal walking increases muscle glucose uptake via a non-insulin pathway (GLUT4 translocation), reducing post-meal glucose amplitude. This is a lifestyle intervention — not a substitute for medical guidance.`,
      3);
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  if (candidates.length === 0 && avg.daysLogged >= 5) {
    add('physiological_sigh',
      `No clear patterns to flag right now. Things look solid.`,
      'Your current routine seems to be working. Keep going before adding more.',
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
