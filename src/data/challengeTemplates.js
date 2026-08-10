// Official Forge challenge template library.
// Display metadata (emoji, startable) lives alongside the template data;
// the start flow currently exists only for the 75-Day Discipline Challenge.

export const METRIC_LABELS = {
  hours_slept:               'Hours Slept',
  sleep_quality:             'Sleep Quality',
  energy_rating:             'Energy',
  mood_rating:               'Mood',
  stress_rating:             'Stress',
  confidence_rating:         'Confidence',
  recovery_rating:           'Recovery',
  workout_effort:            'Workout Effort',
  daily_task_completion_pct: 'Task Completion',
  user_selected_metrics:     'Your Chosen Metrics',
};

export function getTemplateById(id) {
  return CHALLENGE_TEMPLATES.find(t => t.id === id) || null;
}

// ── Unified Daily Log ────────────────────────────────────────────────────────
// A single support task that replaces every separate metric-logging task
// (Log mood / stress / energy / sleep, etc.). It is completed once the user
// saves at least one metric for the day, awards 20 XP once, and is NOT a
// keystone habit — it renders below the action tasks with no keystone stars.
export const DAILY_LOG_TASK = {
  id: 'daily_log',
  name: 'Complete Daily Log',
  icon: '📊',
  color: '#8B9DC3',
  xp: 20,
  keystone: 0,
};

// ─── Cold Exposure Upgrade (Mental Training only) ────────────────────────────
// Cold exposure is the ONLY optional Forge activity that can be promoted into a
// required challenge task, and ONLY for the Mental Training challenge. It is a
// required SUPPORT task (20 XP, never a keystone) — deliberately not weighted
// like Mental Training itself, so enabling the upgrade raises difficulty without
// disproportionately inflating available XP.
export const MENTAL_TRAINING_TEMPLATE_ID = 'mental_training_phase';
export const COLD_SHOWER_TASK_ID = 'mt_cold_shower';
// The legacy OPTIONAL cold-exposure Bonus Mission. It is hidden on and after the
// required upgrade's activation date so the same cold finish can't be credited
// twice (once as bonus XP, once as the required task) on a single day.
export const COLD_SHOWER_BONUS_ID = 'bm_cold';
export const COLD_SHOWER_TASK = {
  id: COLD_SHOWER_TASK_ID,
  name: 'Cold Shower — 30–60 second cold finish',
  icon: '🚿',
  color: '#4EA8DE',
  xp: 20,
  keystone: 0,
  desc: 'A 30–60 second cold finish. Skip if you feel dizzy, hypoglycemic, sick, or unusually weak.',
};

/** True only when a challenge attempt explicitly enabled the Cold Exposure Upgrade. */
export function isColdExposureEnabled(meta) {
  return meta?.templateId === MENTAL_TRAINING_TEMPLATE_ID && meta?.coldExposureUpgradeEnabled === true;
}

/**
 * Date-aware requirement check. The Cold Shower is a required task ONLY for the
 * activation date and every day after it — never retroactively. `dateStr` is a
 * local YYYY-MM-DD string; lexicographic comparison is correct for that format.
 *
 * A legacy attempt enabled at setup carries no start date; it is required from
 * day one (migration backfills its start date to the challenge start so the two
 * behave identically). The upgrade is never removable, so this only ever gates
 * EARLIER dates out — it never turns a required day back off.
 */
export function isColdExposureRequiredForDate(meta, dateStr) {
  if (!isColdExposureEnabled(meta)) return false;
  const startDate = meta.coldExposureUpgradeStartDate;
  if (!startDate) return true;
  return !!dateStr && dateStr >= startDate;
}

/**
 * Return a task list with the required Cold Shower task present exactly once,
 * inserted just before Complete Daily Log (or appended if there is none), when
 * `enabled` is true — and guaranteed absent when false. Never duplicates and
 * never depends on any other task's state. Used identically at challenge start,
 * on template sync, and in the setup preview so the three always agree.
 */
export function applyColdExposureUpgrade(tasks, enabled) {
  const list = (Array.isArray(tasks) ? tasks : []).filter(t => t.id !== COLD_SHOWER_TASK_ID);
  if (!enabled) return list;
  const dailyIdx = list.findIndex(t => t.id === 'daily_log');
  const insertAt = dailyIdx >= 0 ? dailyIdx : list.length;
  const next = [...list];
  next.splice(insertAt, 0, { ...COLD_SHOWER_TASK, source: 'template' });
  return next;
}

// ─── Per-template duration options ───────────────────────────────────────────
// A template opts into multiple durations by listing them in
// duration_options_days, optionally naming each one (duration_labels), marking a
// recommended/default one, and giving each a completion bonus. Templates that
// list a single duration keep their existing single-duration behaviour, so these
// choices are never forced on challenges that have not opted in.

/** The durations a template offers (always at least one). */
export function getDurationOptions(template) {
  const opts = template?.duration_options_days;
  return Array.isArray(opts) && opts.length ? opts : [];
}

/** Default/pre-selected duration: explicit default, else the middle option. */
export function getDefaultDuration(template) {
  const opts = getDurationOptions(template);
  if (!opts.length) return null;
  const explicit = template?.default_duration_days;
  if (explicit != null && opts.includes(explicit)) return explicit;
  return opts[Math.floor((opts.length - 1) / 2)];
}

/** Short name for a duration ("Kickstart", "Standard", …) or null. */
export function getDurationLabel(template, days) {
  return template?.duration_labels?.[days] ?? null;
}

/** True when this duration is the one the template recommends. */
export function isRecommendedDuration(template, days) {
  const rec = template?.recommended_duration_days ?? template?.default_duration_days;
  return rec != null && rec === days;
}

/**
 * Completion bonus for a given duration. Templates may set a per-duration table;
 * otherwise the template's flat reward XP applies to every duration.
 */
export function getCompletionBonusForDuration(template, days) {
  const table = template?.completion_bonus_by_duration;
  if (table && table[days] != null) return table[days];
  return template?.rewards?.xp || 0;
}

/**
 * Program content resolved for a duration: the base program with that duration's
 * overrides merged over it (goal, expected results, what-you'll-notice, timeline,
 * progress copy). Durations without an override use the base content.
 */
export function getProgramForDuration(template, days) {
  const program = template?.program;
  if (!program) return null;
  const override = program.by_duration?.[days];
  return override ? { ...program, ...override } : program;
}

// The Forge-owned metric-logging task ids the Daily Log consolidates. Only
// these built-in ids are ever merged — never genuine custom tasks, even if a
// user names one "mood" or "energy".
export const METRIC_LOG_TASK_IDS = new Set([
  'mt_mood', 'mt_stress', 'mt_energy', // Mental Training Phase
  'sleep_log',                          // 75-Day default (Male)
]);

/**
 * Replace any built-in metric-logging tasks in a task list with a single
 * Daily Log task (placed last, below the action tasks). Custom tasks and other
 * template tasks are preserved in their existing relative order.
 * Returns { tasks, changed }. Idempotent: once a list has the Daily Log task
 * and no metric-log tasks, it is returned unchanged (changed = false).
 */
export function consolidateDailyLogTasks(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const hadMetricLog = list.some(t => METRIC_LOG_TASK_IDS.has(t.id));
  const kept = list.filter(t => !METRIC_LOG_TASK_IDS.has(t.id));
  const hasDailyLog = kept.some(t => t.id === 'daily_log');
  const next = hasDailyLog ? kept : [...kept, { ...DAILY_LOG_TASK, source: 'template' }];
  const changed = hadMetricLog || !hasDailyLog;
  if (!changed) return { tasks: list, changed: false };
  return { tasks: next.map((t, i) => ({ ...t, order: i })), changed: true };
}

// Forge Daily — the permanent baseline mode. It is active whenever no
// challenge is running: open-ended (no duration), lighter tasks, smaller XP,
// so users keep a streak alive without feeling overwhelmed. Challenges
// temporarily replace it; when a challenge ends, the app returns here.
export const FORGE_DAILY_META = {
  templateId: 'forge_daily',
  name: 'Forge Daily',
  emoji: '🔥',
  variant: null,
  durationDays: null, // open-ended, never "completes"
  isBaseline: true,
};

export const FORGE_DAILY_TASKS = [
  { id: 'fd_sleep', name: 'Hit sleep goal',   icon: '😴', color: '#A78BFA', xp: 8,  keystone: 0 },
  { id: 'fd_move',  name: 'Move your body',   icon: '🏃', color: '#FF6B6B', xp: 8,  keystone: 0 },
  { id: 'fd_mind',  name: 'Mental Training',  icon: '🧘', color: '#8B5CF6', xp: 12, keystone: 1 },
  { id: 'fd_read',  name: 'Read',             icon: '📚', color: '#74B9FF', xp: 6,  keystone: 0 },
  { id: 'fd_pray',  name: 'Pray',             icon: '🙏', color: '#A8E6CF', xp: 6,  keystone: 0 },
  { id: 'fd_grat',  name: 'Gratitude',        icon: '📝', color: '#F9E04B', xp: 5,  keystone: 0 },
  { id: 'fd_water', name: 'Drink water',      icon: '💧', color: '#45B7D1', xp: 5,  keystone: 0 },
  { ...DAILY_LOG_TASK },
];

// The "what's your next goal?" menu shown after a challenge completes.
// startableTemplateId maps to a real template when one exists; others open
// the Challenges tab so the user can explore.
export const NEXT_GOALS = [
  { id: 'mental',   label: 'Mental Training',       emoji: '🧠', templateId: 'mental_training_phase' },
  { id: 'sleep',    label: 'Sleep',                 emoji: '😴', templateId: 'sleep_reset_challenge' },
  { id: 'fatloss',  label: 'Fat Loss',              emoji: '⚡', templateId: 'fat_loss_phase' },
  { id: 'strength', label: 'Strength',              emoji: '💪', templateId: 'strength_phase' },
  { id: 'recovery', label: 'Recovery',              emoji: '🔋', templateId: 'recovery_phase' },
  { id: 'skin',     label: 'Skin Health',           emoji: '✨', templateId: null },
  { id: 'hormone',  label: "Women's Hormone Health", emoji: '🌸', templateId: null, audience: 'female' },
  { id: 'custom',   label: 'Custom',                emoji: '🎯', templateId: 'custom_challenge_framework' },
];

// ── Profile-specific visibility ──────────────────────────────────────────────
// Challenges and goals can carry an `audience` ('all' | 'male' | 'female').
// Anything without one is visible to everyone. This single helper is used by
// every screen that lists challenges/goals, so adding another profile-specific
// challenge later only means tagging it — no screen changes required.

export function profileAudience(profileId) {
  // The two example profiles map to audiences by their stable ids.
  return profileId === 'girlfriend' ? 'female' : 'male';
}

export function isVisibleForProfile(item, profileId) {
  const aud = item?.audience;
  if (!aud || aud === 'all') return true;
  return aud === profileAudience(profileId);
}

export function visibleChallenges(profileId) {
  return CHALLENGE_TEMPLATES.filter(t => isVisibleForProfile(t, profileId));
}

export function visibleNextGoals(profileId) {
  return NEXT_GOALS.filter(g => isVisibleForProfile(g, profileId));
}

export const CHALLENGE_TEMPLATES = [
  {
    id: 'sleep_reset_challenge',
    overall_difficulty: 'Easy',
    emoji: '😴',
    startable: false,
    challenge_name: 'Sleep Reset Challenge',
    purpose: 'Rebuild sleep consistency, improve sleep quality, and support better daytime energy.',
    duration_options_days: [7, 14],
    metrics_targeted: ['hours_slept', 'sleep_quality', 'energy_rating', 'mood_rating', 'stress_rating'],
    insights_triggers: {
      pre_recommendation: "average('hours_slept', 7) < user_sleep_target OR average('sleep_quality', 7) < 6 OR average('energy_rating', 7) < 6",
      in_progress_monitoring: 'sleep_quality, hours_slept, energy_rating, stress_rating',
    },
    success_threshold: 'task_compliance >= 0.80 AND sleep_quality improves by at least 1 point OR hours_slept improves toward target',
    rewards: { xp: 300, badge_id: 'sleep_rebuilt' },
    safety_flags: {
      contraindications: ['severe untreated sleep issues', 'medical advice to follow a specific sleep plan'],
      notes: 'If sleep remains poor despite consistent sleep opportunity, consider discussing sleep quality issues with a clinician.',
    },
    evidence_level: 'strong',
    risk_level: 'low',
    inspiration_sources: ['Andrew Huberman', 'Matthew Walker', 'Peter Attia'],
    variants: {
      beginner: {
        difficulty: 'easy',
        required_daily_tasks: [
          'Get outdoor morning light for 5–10 minutes.',
          'Set a consistent bedtime window.',
          'Dim lights 30–60 minutes before bed.',
          'Log hours slept and sleep quality.',
        ],
        optional_tasks: [
          'No phone 30 minutes before bed.',
          'Cool, dark room checklist.',
        ],
      },
      standard: {
        difficulty: 'medium',
        required_daily_tasks: [
          'Get outdoor morning light for 10 minutes.',
          'Hit your chosen sleep target or give yourself enough sleep opportunity.',
          'No phone 30 minutes before bed.',
          'Dim overhead lights 1–2 hours before bed.',
          'Log hours slept and sleep quality.',
        ],
        optional_tasks: [
          'Red light glasses reminder.',
          'Nasal strip reminder.',
          'Evening breathwork.',
        ],
      },
      hard: {
        difficulty: 'hard',
        required_daily_tasks: [
          'Get outdoor morning light for 10–20 minutes.',
          'Hit your chosen sleep target.',
          'No phone 60 minutes before bed.',
          'Dim lights 2 hours before bed.',
          'Caffeine cutoff followed.',
          'Log hours slept, sleep quality, and energy.',
        ],
        optional_tasks: [
          'Consistent wake time.',
          'Cool, dark room checklist.',
          'NSDR earlier in the day.',
        ],
      },
    },
  },
  {
    id: 'fat_loss_phase',
    overall_difficulty: 'Medium',
    emoji: '⚡',
    startable: true,
    start_flow: 'variant',
    template_version: 3,
    task_id_prefix: 'fl_',
    challenge_name: 'Fat Loss Challenge',
    category: 'Body Composition',
    purpose: 'Lose body fat while preserving muscle, improving energy, increasing confidence, and building sustainable habits.',
    tagline: 'Lose fat. Keep muscle. Build habits that last.',
    // Fat Loss runs for a user-chosen length. Duration is how long the program
    // is followed — NOT a difficulty mode (the Beginner/Standard/Hard variants
    // stay independent and the task list is identical across durations).
    duration_options_days: [14, 30, 60],
    default_duration_days: 30,
    recommended_duration_days: 30,
    duration_labels: { 14: 'Kickstart', 30: 'Standard', 60: 'Transformation' },
    // Completion bonus per duration. Deliberately increasing per DAY with length
    // (14.3 / 16.7 / 18.3 XP per day) so sustained adherence pays off and there
    // is no exploit in repeatedly picking the short option: 4×14d = 800 < 1100
    // for one 60d, and 2×30d = 1000 < 1100. 30 days keeps its existing 500 so
    // the current economy and every past attempt are unchanged.
    completion_bonus_by_duration: { 14: 200, 30: 500, 60: 1100 },
    metrics_targeted: ['daily_task_completion_pct', 'energy_rating', 'workout_effort', 'sleep_quality', 'confidence_rating'],
    insights_triggers: {
      pre_recommendation: 'diet_compliance is low OR user selects body composition goal OR completion is consistent but body composition goal is active',
      in_progress_monitoring: 'energy_rating, sleep_quality, workout_effort, recovery_rating',
    },
    success_threshold: 'task_compliance >= 0.80 AND user reports improved consistency, body composition, or confidence',
    // Keystone context, shown in challenge details/coaching — never on the daily
    // checklist (the stars already carry the hierarchy there).
    keystone_why: {
      fl_protein: 'Protein is the habit that protects your results. It supports muscle retention while you are in a deficit, keeps you fuller between meals, and aids recovery — all of which shape the body-composition outcome, not just the scale number.',
      fl_whole: 'Whole-food nutrition makes calorie control and satiety far easier to sustain, and it raises overall diet quality. It does not create a calorie deficit on its own — fat loss still depends primarily on sustained energy balance — but it is what makes staying in that deficit realistic.',
    },
    rewards: { xp: 500, badge_id: 'body_fat_slayer', badge_label: 'Body Fat Slayer' },
    safety_flags: {
      contraindications: ['history of disordered eating', 'medical advice not to diet', 'acute burnout'],
      notes: 'Avoid overly aggressive restriction. The goal is sustainable consistency, not crash dieting.',
    },
    evidence_level: 'strong',
    risk_level: 'medium',
    inspiration_sources: ['Layne Norton', 'Peter Attia', 'Andrew Huberman'],
    // Full transformation-program content, rendered as sections on the card
    program: {
      goal: 'Lose body fat while preserving muscle, improving energy, increasing confidence, and building sustainable habits.',
      expected_results: [
        'Lose approximately 2–5 lb of body fat',
        'Lose roughly 0.5–1.5 inches from waist',
        'Improved muscle definition',
        'Better cardiovascular fitness',
        'Better insulin sensitivity',
        'Better energy',
        'Better sleep',
        'Increased confidence',
      ],
      results_disclaimer: 'Results vary depending on starting body fat, adherence, calorie intake, and individual response.',
      visual_changes: [
        'Leaner face',
        'Smaller waist',
        'Better fitting clothes',
        'Sharper jawline',
        'More chest definition',
        'Better shoulder definition',
        'Increased arm vascularity',
        'More visible abs (depending on starting body fat)',
      ],
      why_it_works: [
        { pillar: 'Protein',           points: ['Preserves muscle while dieting', 'Keeps you full'] },
        { pillar: 'Strength Training', points: ['Signals the body to keep muscle during a calorie deficit'] },
        { pillar: 'Walking',           points: ['Increases calorie expenditure with minimal recovery cost'] },
        { pillar: 'Zone 2 Cardio',     points: ['Improves cardiovascular health', 'Burns additional calories', 'Improves endurance'] },
        { pillar: 'Whole Foods',       points: ['Improve satiety', 'Make staying in a calorie deficit easier'] },
        { pillar: 'Sleep',             points: ['Improves recovery', 'Helps regulate hunger', 'Improves workout performance'] },
        { pillar: 'Calorie Deficit',   points: ['The primary driver of body fat loss'] },
      ],
      timeline: [
        { week: 'Week 1', points: ['Reduced bloating', 'Initial weight loss (mostly water)', 'Better energy'] },
        { week: 'Week 2', points: ['Waist begins shrinking', 'Clothes fit better'] },
        { week: 'Week 3', points: ['Leaner face', 'Muscle definition becoming noticeable'] },
        { week: 'Week 4', points: ['Most noticeable visual improvements', 'Better conditioning', 'Increased confidence', 'Visible body recomposition'] },
      ],
      progress: {
        items: [
          'Daily progress photo — a required task, not optional',
          'Weekly waist measurement',
          'Daily weigh-in (optional but encouraged)',
        ],
        finish: 'Finish all 30 days and you get your transformation report: before vs after, weight change, estimated body fat change, waist change, completion stats, and your XP earned.',
      },
      // Duration-aware copy. The base content above is the 30-day Standard
      // program; 14 and 60 override the sections that would otherwise imply a
      // 30-day timeframe. All figures stay framed as estimates and every
      // duration keeps the same results-vary disclaimer.
      by_duration: {
        14: {
          emphasis: 'Build momentum and create visible early progress.',
          goal: 'Build momentum fast: start losing body fat, sharpen your nutrition and activity habits, and create visible early progress you can carry forward.',
          expected_results: [
            'Early scale/body-composition progress',
            'Approximately 1–2.5 lb of body-fat loss may be achievable with an appropriate deficit',
            'Early reduction in waist measurement/bloating may be noticeable',
            'Improved consistency with nutrition, steps, training, and cardio',
            'Early improvements in muscle definition may begin to appear',
            'Better cardiovascular conditioning',
            'Potential improvements in energy and confidence',
          ],
          visual_changes: [
            'Reduced bloating',
            'Slightly leaner face',
            'Waistband feeling looser',
            'Early muscle definition starting to show',
          ],
          timeline: [
            { week: 'Week 1', points: ['Reduced bloating', 'Initial weight loss (mostly water)', 'Better energy'] },
            { week: 'Week 2', points: ['Waist begins shrinking', 'Clothes fit better', 'Habits starting to feel automatic'] },
          ],
          progress: {
            items: [
              'Daily progress photo — a required task, not optional',
              'Waist measurement at start and finish',
              'Daily weigh-in (optional but encouraged)',
            ],
            finish: 'Finish all 14 days and you get your progress report: before vs after, weight change, waist change, completion stats, and your XP earned.',
          },
        },
        60: {
          emphasis: 'Enough time for a clearly noticeable transformation when adherence is high.',
          goal: 'Give the process enough time for a clearly noticeable body-composition change: sustained fat loss with muscle preserved, and habits that hold after the challenge ends.',
          expected_results: [
            'Potential for a substantial visible body-composition change',
            'Approximately 4–10 lb of body-fat loss may be achievable depending on starting size and calorie deficit',
            'Noticeably leaner waist and improved muscle definition',
            'More meaningful cardiovascular fitness improvements',
            'Stronger nutrition and activity habits',
            'Potential improvements in energy, sleep, and confidence',
            'Greater opportunity to preserve/build fitness while reducing body fat',
          ],
          visual_changes: [
            'Noticeably leaner face and jawline',
            'Clearly smaller waist',
            'Clothes fitting noticeably differently',
            'More visible muscle definition across chest, shoulders and arms',
            'More visible abs (depending on starting body fat)',
            'Better overall posture and conditioning',
          ],
          timeline: [
            { week: 'Weeks 1–2', points: ['Reduced bloating', 'Initial weight loss (mostly water)', 'Better energy'] },
            { week: 'Weeks 3–4', points: ['Waist shrinking', 'Clothes fit better', 'Muscle definition becoming noticeable'] },
            { week: 'Weeks 5–6', points: ['Leaner face', 'Conditioning clearly improved', 'Habits feel automatic'] },
            { week: 'Weeks 7–8', points: ['Most noticeable visual change', 'Visible body recomposition', 'Increased confidence'] },
          ],
          progress: {
            items: [
              'Daily progress photo — a required task, not optional',
              'Weekly waist measurement',
              'Daily weigh-in (optional but encouraged)',
            ],
            finish: 'Finish all 60 days and you get your transformation report: before vs after, weight change, estimated body fat change, waist change, completion stats, and your XP earned.',
          },
        },
      },
    },
    variants: {
      beginner: {
        difficulty: 'easy',
        expected_results: '1–2 lb body fat loss',
        required_daily_tasks: [
          '⭐⭐⭐ Hit protein goal (0.8–1.0 g per lb of goal body weight) (40 XP).',
          '⭐⭐⭐ Eat mostly whole foods (80%+) (40 XP).',
          '⭐⭐ Walk 6,000+ steps (25 XP).',
          '⭐⭐ Sleep 7.5+ hours (25 XP).',
          '⭐ Hit water goal (15 XP).',
          '⭐ Take a progress photo (10 XP).',
          '⭐ Complete Daily Log (10 XP).',
        ],
        weekly_requirements: [
          'Lift 3x',
          '1 × 30-minute Zone 2 cardio',
        ],
        optional_tasks: [
          'Daily weigh-in.',
          'Post-meal walk.',
        ],
        // Fat Loss task hierarchy (same importance model in every variant; only
        // the targets differ): ⭐⭐⭐ Keystone 40 XP · ⭐⭐ Important 25 XP ·
        // ⭐ Supporting 10–15 XP. Daily Log is overridden locally so the shared
        // DAILY_LOG_TASK constant (used by other challenges) stays untouched.
        start_tasks: [
          { id: 'fl_photo',   name: 'Take progress photo',                 icon: '📸', color: '#74B9FF', xp: 10, keystone: 1 },
          { id: 'fl_protein', name: 'Hit protein goal (0.8–1 g/lb goal weight)', icon: '🥩', color: '#FF6B6B', xp: 40, keystone: 3, keystoneHabit: true },
          { id: 'fl_steps',   name: 'Walk 6,000+ steps',                   icon: '🚶', color: '#FFB347', xp: 25, keystone: 2 },
          { id: 'fl_whole',   name: 'Eat mostly whole foods (80%+)',       icon: '🥗', color: '#6BCB77', xp: 40, keystone: 3, keystoneHabit: true },
          { id: 'fl_water',   name: 'Hit water goal',                      icon: '💧', color: '#45B7D1', xp: 15, keystone: 1 },
          { id: 'fl_sleep',   name: 'Sleep 7.5+ hours',                    icon: '😴', color: '#A78BFA', xp: 25, keystone: 2 },
          { ...DAILY_LOG_TASK, xp: 10, keystone: 1 },
        ],
      },
      standard: {
        difficulty: 'medium',
        expected_results: '2–4 lb body fat loss',
        required_daily_tasks: [
          '⭐⭐⭐ Hit protein goal (0.8–1.0 g per lb of goal body weight) (40 XP).',
          '⭐⭐⭐ Eat mostly whole foods (90%) (40 XP).',
          '⭐⭐ Walk 8,000+ steps (25 XP).',
          '⭐⭐ Sleep 7.5–9 hours (25 XP).',
          '⭐ Hit water goal (15 XP).',
          '⭐ Take a progress photo (10 XP).',
          '⭐ Complete Daily Log (10 XP).',
        ],
        weekly_requirements: [
          '🏋️ Lift 3x — required (25 XP each)',
          '❤️ 2 × 30-minute Zone 2 cardio — required (20 XP each)',
          'Track these throughout each 7-day challenge week.',
        ],
        optional_tasks: [
          'Daily weigh-in.',
          'Post-meal walk after largest meal.',
        ],
        // ⭐⭐⭐ Keystone 40 · ⭐⭐ Important 25 · ⭐ Supporting 10–15.
        // Perfect day = 40+40+25+25+15+10+10 = 165 required-task XP.
        start_tasks: [
          { id: 'fl_photo',   name: 'Take progress photo',                 icon: '📸', color: '#74B9FF', xp: 10, keystone: 1 },
          { id: 'fl_protein', name: 'Hit protein goal (0.8–1 g/lb goal weight)', icon: '🥩', color: '#FF6B6B', xp: 40, keystone: 3, keystoneHabit: true },
          { id: 'fl_steps',   name: 'Walk 8,000+ steps',                   icon: '🚶', color: '#FFB347', xp: 25, keystone: 2 },
          { id: 'fl_whole',   name: 'Eat mostly whole foods (90%)',        icon: '🥗', color: '#6BCB77', xp: 40, keystone: 3, keystoneHabit: true },
          { id: 'fl_water',   name: 'Hit water goal',                      icon: '💧', color: '#45B7D1', xp: 15, keystone: 1 },
          { id: 'fl_sleep',   name: 'Sleep 7.5–9 hours',                   icon: '😴', color: '#A78BFA', xp: 25, keystone: 2 },
          { ...DAILY_LOG_TASK, xp: 10, keystone: 1 },
        ],
      },
      hard: {
        difficulty: 'hard',
        expected_results: 'Already active: 3–5 lb body fat loss · Beginners: 4–6 lb body fat loss',
        required_daily_tasks: [
          '⭐⭐⭐ Hit protein goal (0.8–1.0 g per lb of goal body weight) (40 XP).',
          '⭐⭐⭐ Eat mostly whole foods (~90% of intake) (40 XP).',
          '⭐⭐ Walk 10,000+ steps (25 XP).',
          '⭐⭐ Stay in a moderate calorie deficit (~300–600 calories) (25 XP).',
          '⭐⭐ Sleep 7.5–9 hours (25 XP).',
          '⭐ Hit water goal (15 XP).',
          '⭐ Take a progress photo (10 XP).',
          '⭐ Complete Daily Log (10 XP).',
        ],
        weekly_requirements: [
          'Lift 3x per week',
          '3 × 30-minute Zone 2–3 cardio sessions',
          'Measure waist',
          'Review weekly progress',
        ],
        optional_tasks: [
          'Daily weigh-in.',
          'Plan meals for tomorrow.',
        ],
        // Same hierarchy; Hard adds the calorie-deficit task as ⭐⭐ Important
        // (Fat Loss keeps exactly TWO Keystone habits: protein + whole foods).
        start_tasks: [
          { id: 'fl_photo',   name: 'Take progress photo',                 icon: '📸', color: '#74B9FF', xp: 10, keystone: 1 },
          { id: 'fl_protein', name: 'Hit protein goal (0.8–1 g/lb goal weight)', icon: '🥩', color: '#FF6B6B', xp: 40, keystone: 3, keystoneHabit: true },
          { id: 'fl_steps',   name: 'Walk 10,000+ steps',                  icon: '🚶', color: '#FFB347', xp: 25, keystone: 2 },
          { id: 'fl_deficit', name: 'Stay in calorie deficit (~300–600 cal)', icon: '🔻', color: '#F97316', xp: 25, keystone: 2 },
          { id: 'fl_whole',   name: 'Eat mostly whole foods (~90%)',       icon: '🥗', color: '#6BCB77', xp: 40, keystone: 3, keystoneHabit: true },
          { id: 'fl_water',   name: 'Hit water goal',                      icon: '💧', color: '#45B7D1', xp: 15, keystone: 1 },
          { id: 'fl_sleep',   name: 'Sleep 7.5–9 hours',                   icon: '😴', color: '#A78BFA', xp: 25, keystone: 2 },
          { ...DAILY_LOG_TASK, xp: 10, keystone: 1 },
        ],
      },
    },
  },
  {
    id: 'strength_phase',
    overall_difficulty: 'Medium/Hard',
    emoji: '💪',
    startable: false,
    challenge_name: 'Strength Phase',
    purpose: 'Build strength, muscle, and confidence through progressive training and recovery.',
    duration_options_days: [21, 30],
    metrics_targeted: ['workout_effort', 'recovery_rating', 'confidence_rating', 'sleep_quality', 'energy_rating'],
    insights_triggers: {
      pre_recommendation: 'confidence_rating is low OR user selects strength goal OR workout consistency is low',
      in_progress_monitoring: 'workout_effort, recovery_rating, sleep_quality, energy_rating',
    },
    success_threshold: 'strength_workout_compliance >= 0.80 AND user logs progression in reps, load, form, or consistency',
    rewards: { xp: 450, badge_id: 'iron_will' },
    safety_flags: {
      contraindications: ['acute injury', 'medical restriction from resistance training'],
      notes: 'Train with good form and scale intensity if recovery, sleep, or pain worsens.',
    },
    evidence_level: 'strong',
    risk_level: 'medium',
    inspiration_sources: ['Peter Attia', 'Layne Norton', 'Andrew Huberman'],
    variants: {
      beginner: {
        difficulty: 'easy',
        required_daily_tasks: [
          'Complete 3 strength sessions per week.',
          'Log workout effort.',
          'Log recovery / soreness.',
          'Hit protein target.',
          'Hit sleep target or log sleep quality.',
        ],
        optional_tasks: [
          'Mobility warmup.',
          'Track one main lift or exercise.',
        ],
      },
      standard: {
        difficulty: 'medium',
        required_daily_tasks: [
          'Complete 4 strength sessions per week.',
          'Track reps, weight, or progression.',
          'Hit protein target.',
          'Log workout effort.',
          'Log recovery / soreness.',
          'Hit sleep target.',
        ],
        optional_tasks: [
          'Mobility or warmup routine.',
          'Post-workout meal reminder.',
        ],
      },
      hard: {
        difficulty: 'hard',
        required_daily_tasks: [
          'Complete 4–5 planned strength sessions per week.',
          'Track progressive overload.',
          'Hit protein target.',
          'Log workout effort and recovery.',
          'Hit sleep target.',
          'Complete mobility or warmup work.',
        ],
        optional_tasks: [
          'Weekly performance review.',
          'Deload recommendation if recovery drops.',
        ],
      },
    },
  },
  {
    id: 'mental_training_phase',
    overall_difficulty: 'Medium',
    emoji: '🧠',
    startable: true,
    start_flow: 'variant', // start button with variant + duration selection
    // Bump when the variant task lists change, so active challenges can offer
    // a sync to the latest version without resetting progress.
    template_version: 6,
    // All template-owned task ids share this prefix — used to tell template
    // tasks apart from user-added custom tasks on lists saved before tasks
    // carried an explicit source.
    task_id_prefix: 'mt_',
    // Optional Bonus Missions seeded when the challenge starts. They award bonus
    // XP but are never required, never counted in required progress, and never
    // affect challenge/streak/MWD completion. Cold exposure stays optional.
    bonus_missions: [
      { id: 'bm_cold',    icon: '🚿', name: 'Cold shower or cold finish',          xp: 20, desc: 'Optional and brief. Skip if you have any medical reason — never required.' },
      { id: 'bm_nophone', icon: '📵', name: 'No phone for 30 minutes before bed',  xp: 20 },
      { id: 'bm_avoided', icon: '🧱', name: 'Do one thing you were avoiding',      xp: 20 },
      { id: 'bm_outside', icon: '🌤️', name: 'Spend 10 minutes outside',            xp: 15 },
      { id: 'bm_read5',   icon: '📚', name: 'Read 5 extra pages',                  xp: 15 },
      { id: 'bm_help',    icon: '🤝', name: 'Perform one helpful act for someone', xp: 15 },
    ],
    challenge_name: 'Mental Training Phase',
    purpose: 'Train the mind through action. Build focus, calm under pressure, and self-control with short daily mental and physical discipline work.',
    tagline: 'Physical discipline sharpens mental control. Do the hard small thing.',
    // Keystone habit context for coaching ("Learn why this habit matters").
    keystone_why: {
      mt_mind: 'Mental Training is the foundation of this challenge. A few focused minutes of breathwork, meditation, or prayer each day is what actually rewires your baseline calm and self-control — everything else compounds on it.',
      mt_reading: 'Reading feeds the mind you are training. Even a couple of pages a day reinforces growth, sharpens focus, and gives your brain something better than a scroll.',
      mt_prayer: 'Prayer lowers ego and restores focus. It anchors the day in something larger than mood.',
    },
    physical_examples: ['Short walk', 'Mobility', 'Stretching', 'Push-ups', 'Air squats', 'Plank', 'Wall sit', 'Shadowboxing', 'Light bodyweight circuit'],
    duration_options_days: [7, 14, 21],
    metrics_targeted: ['stress_rating', 'confidence_rating', 'mood_rating', 'energy_rating'],
    insights_triggers: {
      pre_recommendation: 'stress_rating is high OR confidence_rating is low OR notes mention overwhelmed, scattered, anxious, angry, distracted, or unfocused',
      in_progress_monitoring: 'stress_rating, confidence_rating, mood_rating, energy_rating, completion, notes',
    },
    success_threshold: 'task_compliance >= 0.80 AND stress improves OR confidence improves OR user completes mental training consistently',
    rewards: { xp: 400, badge_id: 'trained_mind' },
    safety_flags: {
      contraindications: ['mental health crisis requiring professional support'],
      notes: 'This is daily mental training, not a replacement for professional care. The cold shower finish is optional — skip it if you have a medical reason, feel lightheaded, or react poorly to cold. Keep cold exposure brief; it is a discipline cue, not an endurance test.',
    },
    evidence_level: 'moderate',
    risk_level: 'low',
    inspiration_sources: ['Andrew Huberman', 'Matthew Walker', 'James Clear'],
    variants: {
      beginner: {
        difficulty: 'easy',
        progression: 'Build the habit.',
        required_daily_tasks: [
          '⭐⭐⭐ Mental Training — 2 minutes (100 XP).',
          '⭐⭐ Read 2 pages (40 XP).',
          '⭐⭐ Prayer (40 XP).',
          '⭐ Write one gratitude (20 XP).',
          '⭐ 30-minute phone-free focus block (20 XP).',
          '🚶 Short Physical Reset — 5 minutes (20 XP).',
          '📊 Complete Daily Log (20 XP).',
        ],
        optional_tasks: [],
        start_tasks: [
          { id: 'mt_mind',      name: 'Mental Training — 2 minutes',         icon: '🧘', color: '#A78BFA', xp: 100, keystone: 3 },
          { id: 'mt_reading',   name: 'Read 2 pages',                        icon: '📚', color: '#74B9FF', xp: 40, keystone: 2 },
          { id: 'mt_prayer',    name: 'Prayer',                              icon: '🙏', color: '#A8E6CF', xp: 40, keystone: 2 },
          { id: 'mt_gratitude', name: 'Write one gratitude',                 icon: '📝', color: '#F9E04B', xp: 20, keystone: 1 },
          { id: 'mt_focus',     name: '30-min phone-free focus block',       icon: '🎯', color: '#FFB347', xp: 20, keystone: 1 },
          { id: 'mt_physical',  name: 'Short Physical Reset — 5 minutes',    icon: '🚶', color: '#4ECDC4', xp: 20, keystone: 0, desc: 'Any intentional movement counts — even a walk.' },
          { ...DAILY_LOG_TASK },
        ],
      },
      standard: {
        difficulty: 'medium',
        progression: 'Strengthen the habit.',
        required_daily_tasks: [
          '⭐⭐⭐ Mental Training — 5 minutes (100 XP).',
          '⭐⭐ Read 5 pages (40 XP).',
          '⭐⭐ Prayer (40 XP).',
          '⭐ Write one gratitude (20 XP).',
          '⭐ 60-minute phone-free focus block (20 XP).',
          '🚶 Short Physical Reset — 10 minutes (30 XP).',
          '📊 Complete Daily Log (20 XP).',
        ],
        optional_tasks: [],
        start_tasks: [
          { id: 'mt_mind',      name: 'Mental Training — 5 minutes',         icon: '🧘', color: '#A78BFA', xp: 100, keystone: 3 },
          { id: 'mt_reading',   name: 'Read 5 pages',                        icon: '📚', color: '#74B9FF', xp: 40, keystone: 2 },
          { id: 'mt_prayer',    name: 'Prayer',                              icon: '🙏', color: '#A8E6CF', xp: 40, keystone: 2 },
          { id: 'mt_gratitude', name: 'Write one gratitude',                 icon: '📝', color: '#F9E04B', xp: 20, keystone: 1 },
          { id: 'mt_focus',     name: '60-min phone-free focus block',       icon: '🎯', color: '#FFB347', xp: 20, keystone: 1 },
          { id: 'mt_physical',  name: 'Short Physical Reset — 10 minutes',   icon: '🚶', color: '#4ECDC4', xp: 30, keystone: 0, desc: 'Any intentional movement counts — even a walk.' },
          { ...DAILY_LOG_TASK },
        ],
      },
      hard: {
        difficulty: 'hard',
        progression: 'Optimize the habit.',
        required_daily_tasks: [
          '⭐⭐⭐ Mental Training — 10 minutes (100 XP).',
          '⭐⭐ Read 10 pages (40 XP).',
          '⭐⭐ Prayer (40 XP).',
          '⭐ Write one gratitude (20 XP).',
          '⭐ 90-minute phone-free focus block (20 XP).',
          '🚶 Short Physical Reset — 15 minutes (40 XP).',
          '📊 Complete Daily Log (20 XP).',
        ],
        optional_tasks: [],
        start_tasks: [
          { id: 'mt_mind',      name: 'Mental Training — 10 minutes',        icon: '🧘', color: '#A78BFA', xp: 100, keystone: 3 },
          { id: 'mt_reading',   name: 'Read 10 pages',                       icon: '📚', color: '#74B9FF', xp: 40, keystone: 2 },
          { id: 'mt_prayer',    name: 'Prayer',                              icon: '🙏', color: '#A8E6CF', xp: 40, keystone: 2 },
          { id: 'mt_gratitude', name: 'Write one gratitude',                 icon: '📝', color: '#F9E04B', xp: 20, keystone: 1 },
          { id: 'mt_focus',     name: '90-min phone-free focus block',       icon: '🎯', color: '#FFB347', xp: 20, keystone: 1 },
          { id: 'mt_physical',  name: 'Short Physical Reset — 15 minutes',   icon: '🚶', color: '#4ECDC4', xp: 40, keystone: 0, desc: 'Any intentional movement counts — even a walk.' },
          { ...DAILY_LOG_TASK },
        ],
      },
    },
  },
  {
    id: 'recovery_phase',
    overall_difficulty: 'Easy',
    emoji: '🔋',
    startable: false,
    challenge_name: 'Recovery Phase',
    purpose: 'Improve recovery, reduce accumulated fatigue, and rebuild energy without quitting movement.',
    duration_options_days: [7, 14],
    metrics_targeted: ['recovery_rating', 'sleep_quality', 'energy_rating', 'stress_rating', 'workout_effort'],
    insights_triggers: {
      pre_recommendation: 'recovery_rating is low OR workout_effort is high while energy or sleep is dropping OR stress_rating is high',
      in_progress_monitoring: 'recovery_rating, sleep_quality, energy_rating, stress_rating',
    },
    success_threshold: 'recovery_rating improves OR energy improves OR user completes lower-intensity recovery tasks consistently',
    rewards: { xp: 350, badge_id: 'recovery_rebuilt' },
    safety_flags: {
      contraindications: ['acute injury needing medical care'],
      notes: 'This phase is meant to reduce strain, not push intensity.',
    },
    evidence_level: 'strong',
    risk_level: 'low',
    inspiration_sources: ['Andrew Huberman', 'Peter Attia', 'Matthew Walker'],
    variants: {
      beginner: {
        difficulty: 'easy',
        required_daily_tasks: [
          'Complete 10–15 minutes of easy movement.',
          'Complete 5 minutes of stretching or mobility.',
          'Log recovery / soreness.',
          'Hit sleep target or log sleep quality.',
        ],
        optional_tasks: [
          'NSDR.',
          'Evening wind-down.',
        ],
      },
      standard: {
        difficulty: 'medium',
        required_daily_tasks: [
          'Complete 20 minutes of easy Zone 2 or walking.',
          'Complete mobility or stretching.',
          'Complete NSDR or relaxation.',
          'Log recovery, stress, and sleep quality.',
          'Avoid unnecessary high-intensity training.',
        ],
        optional_tasks: [
          'Earlier bedtime reminder.',
          'No phone wind-down.',
        ],
      },
      hard: {
        difficulty: 'hard',
        required_daily_tasks: [
          'Complete 30 minutes of easy movement or Zone 2.',
          'Complete 15–20 minutes of mobility, NSDR, or relaxation.',
          'Hit sleep target.',
          'Log recovery, stress, sleep, and energy.',
          'Keep training intensity intentionally low.',
        ],
        optional_tasks: [
          'Recovery walk after work.',
          'Deload training plan.',
        ],
      },
    },
  },
  {
    id: '75_day_discipline_challenge',
    overall_difficulty: 'Hard',
    emoji: '🔥',
    startable: true,
    challenge_name: '75-Day Discipline Challenge',
    purpose: 'Build consistency, self-trust, and execution through a longer structured challenge.',
    duration_options_days: [75],
    metrics_targeted: ['daily_task_completion_pct', 'confidence_rating', 'mood_rating', 'energy_rating', 'stress_rating'],
    insights_triggers: {
      pre_recommendation: 'user selects long challenge OR completion consistency is low OR user wants a discipline phase',
      in_progress_monitoring: 'completion, sleep, energy, stress, confidence',
    },
    success_threshold: 'complete the 75-day challenge with consistent logging and task completion',
    rewards: { xp: 2500, badge_id: 'forged_elite' },
    // Stricter completion rules for the flagship long challenge (configurable).
    passing_score: 80,
    keystone_requirement: 70,
    safety_flags: {
      contraindications: ['acute injury', 'severe burnout', 'medical advice to avoid intense challenges'],
      notes: 'Use Minimum Day or Comeback Mode when needed. The goal is resilience, not self-punishment.',
    },
    evidence_level: 'moderate',
    risk_level: 'medium',
    inspiration_sources: ['Layne Norton', 'James Clear', 'Peter Attia', 'Andrew Huberman'],
    variants: {
      beginner: {
        difficulty: 'easy',
        required_daily_tasks: [
          'Complete daily movement.',
          'Follow your nutrition goal.',
          'Hit water goal.',
          'Read or learn for 5 minutes.',
          'Complete mental training.',
          'Log daily ratings.',
        ],
        optional_tasks: [
          'Progress photo reminder.',
          'Quote reflection.',
        ],
      },
      standard: {
        difficulty: 'medium',
        required_daily_tasks: [
          'Complete 45-minute workout.',
          'Follow diet / eat clean.',
          'Hit water goal.',
          'Read 10 pages.',
          'Take progress photo.',
          'Complete mental training.',
          'Hit sleep target.',
          'Complete quote/reflection.',
        ],
        optional_tasks: [
          'Faith reflection.',
          'Post-meal walk.',
          'No-phone wind-down.',
        ],
      },
      hard: {
        difficulty: 'hard',
        required_daily_tasks: [
          'Complete 45-minute workout.',
          'Complete additional movement or conditioning.',
          'Follow diet / eat clean.',
          'Hit water goal.',
          'Read 10 pages.',
          'Take progress photo.',
          'Complete mental training.',
          'Hit sleep target.',
          'Complete quote/reflection.',
        ],
        optional_tasks: [
          'Strict phone cutoff.',
          'Weekly body metrics.',
          'Weekly performance review.',
        ],
      },
    },
  },
  {
    id: 'custom_challenge_framework',
    overall_difficulty: 'You decide',
    emoji: '🎯',
    startable: false,
    challenge_name: 'Custom Challenge',
    purpose: 'Let users create a personalized challenge based on their own goals and metrics.',
    duration_options_days: [7, 14, 21, 30, 75],
    metrics_targeted: ['user_selected_metrics'],
    insights_triggers: {
      pre_recommendation: 'user creates custom challenge OR Insights suggests targeted experiment',
      in_progress_monitoring: 'user_selected_metrics, completion, notes',
    },
    success_threshold: 'task_compliance >= 0.80 OR user-defined success criteria met',
    rewards: { xp: 400, badge_id: 'self_architect' },
    safety_flags: {
      contraindications: [],
      notes: 'Custom challenges should stay realistic, safe, and measurable.',
    },
    evidence_level: 'user_defined',
    risk_level: 'user_defined',
    inspiration_sources: ['User-defined'],
    variants: {
      beginner: {
        difficulty: 'easy',
        required_daily_tasks: [
          'Track 1 custom daily task.',
          'Log one target metric.',
        ],
        optional_tasks: [],
      },
      standard: {
        difficulty: 'medium',
        required_daily_tasks: [
          'Track 2 custom daily tasks.',
          'Log selected metrics.',
          'Review progress weekly.',
        ],
        optional_tasks: [],
      },
      hard: {
        difficulty: 'hard',
        required_daily_tasks: [
          'Track 3 custom daily tasks.',
          'Log selected metrics.',
          'Review progress weekly.',
          'Complete a reflection at the end of the challenge.',
        ],
        optional_tasks: [],
      },
    },
  },
];
