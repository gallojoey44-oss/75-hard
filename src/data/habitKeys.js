/**
 * Shared habit identity.
 *
 * Two challenges frequently require the SAME underlying behaviour ("sleep 8
 * hours", "hit protein"). Matching those by task name is fragile — the names
 * carry their targets ("Sleep 7.5+ hours" vs "Sleep 8 hours") and never match
 * exactly. Instead every template task may declare a canonical `habitKey`, and
 * two requirements are the same habit when their keys match.
 *
 * A task may also declare a `target` so the merge can pick the STRICTER of two
 * versions rather than silently keeping one:
 *
 *   target: { value: 8, unit: 'hours', direction: 'atLeast' }
 *
 * `direction` says which way is stricter — 'atLeast' (more is stricter: sleep,
 * protein, steps) or 'atMost' (less is stricter: e.g. a screen-time cap).
 * Tasks with no target still merge; the merge then keeps the primary's wording
 * and flags the pair so the UI can say the targets could not be compared.
 */

export const HABIT_KEYS = {
  SLEEP_TARGET: 'sleep_target',
  PROTEIN_TARGET: 'protein_target',
  DAILY_STEPS: 'daily_steps',
  MEDITATION: 'meditation',
  HYDRATION: 'hydration',
  WHOLE_FOODS: 'whole_foods',
  MOVEMENT: 'movement',
  PROGRESS_PHOTO: 'progress_photo',
  DAILY_LOG: 'daily_log',
  READING: 'reading',
  GRATITUDE: 'gratitude',
  FOCUS_BLOCK: 'focus_block',
  PRAYER: 'prayer',
  COLD_EXPOSURE: 'cold_exposure',
  // Muscle Building
  HYPERTROPHY_TRAINING: 'hypertrophy_training',
  CALORIE_TARGET: 'calorie_target',
  STRESS_RECOVERY: 'stress_recovery',
  PROTEIN_DISTRIBUTION: 'protein_distribution',
  CREATINE: 'creatine',
  // Women's Hormone Health
  EXERCISE_SESSION: 'exercise_session',
  OMEGA3_FOODS: 'omega3_foods',
  IRON_RICH_FOODS: 'iron_rich_foods',
  SYMPTOM_CHECKIN: 'symptom_checkin',
};

/** Human labels for habit keys — used in merge explanations. */
export const HABIT_LABELS = {
  [HABIT_KEYS.SLEEP_TARGET]: 'Sleep target',
  [HABIT_KEYS.PROTEIN_TARGET]: 'Protein target',
  [HABIT_KEYS.DAILY_STEPS]: 'Daily steps',
  [HABIT_KEYS.MEDITATION]: 'Meditation / mental training',
  [HABIT_KEYS.HYDRATION]: 'Hydration',
  [HABIT_KEYS.WHOLE_FOODS]: 'Whole foods',
  [HABIT_KEYS.MOVEMENT]: 'Daily movement',
  [HABIT_KEYS.PROGRESS_PHOTO]: 'Progress photo',
  [HABIT_KEYS.DAILY_LOG]: 'Daily log',
  [HABIT_KEYS.READING]: 'Reading',
  [HABIT_KEYS.GRATITUDE]: 'Gratitude',
  [HABIT_KEYS.FOCUS_BLOCK]: 'Focus block',
  [HABIT_KEYS.PRAYER]: 'Prayer',
  [HABIT_KEYS.COLD_EXPOSURE]: 'Cold exposure',
  [HABIT_KEYS.HYPERTROPHY_TRAINING]: 'Hypertrophy training',
  [HABIT_KEYS.CALORIE_TARGET]: 'Nutrition / energy target',
  [HABIT_KEYS.STRESS_RECOVERY]: 'Recovery practice',
  [HABIT_KEYS.PROTEIN_DISTRIBUTION]: 'Protein distribution',
  [HABIT_KEYS.CREATINE]: 'Creatine',
  [HABIT_KEYS.EXERCISE_SESSION]: 'Exercise session',
  [HABIT_KEYS.OMEGA3_FOODS]: 'Omega-3 foods',
  [HABIT_KEYS.IRON_RICH_FOODS]: 'Iron-rich foods',
  [HABIT_KEYS.SYMPTOM_CHECKIN]: 'Symptom check-in',
};

/**
 * The habit a task represents. Prefers the explicit `habitKey`; falls back to
 * the task id, so two challenges that literally share a task id (Forge's shared
 * Daily Log task, for instance) still merge without needing annotation.
 *
 * Never falls back to the task NAME — names carry targets and would both
 * over-match and under-match.
 */
export function habitKeyOf(task) {
  return task?.habitKey || task?.id || null;
}

/** True when two tasks describe the same underlying behaviour. */
export function isSameHabit(a, b) {
  const ka = habitKeyOf(a), kb = habitKeyOf(b);
  return !!ka && ka === kb;
}

/**
 * Which of two versions of the same habit is stricter.
 *
 * Returns 'a' | 'b' when the targets are directly comparable (same unit and
 * direction), or null when they are not — the caller then keeps the primary's
 * wording and surfaces that the targets could not be reconciled.
 */
export function stricterOf(a, b) {
  const ta = a?.target, tb = b?.target;
  if (!ta || !tb) return null;
  if (ta.unit !== tb.unit || ta.direction !== tb.direction) return null;
  if (typeof ta.value !== 'number' || typeof tb.value !== 'number') return null;
  if (ta.value === tb.value) return 'a';
  if (ta.direction === 'atMost') return ta.value < tb.value ? 'a' : 'b';
  return ta.value > tb.value ? 'a' : 'b';   // 'atLeast' — more is stricter
}
