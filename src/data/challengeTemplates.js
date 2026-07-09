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

export const CHALLENGE_TEMPLATES = [
  {
    id: 'sleep_reset_challenge',
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
    emoji: '⚡',
    startable: false,
    challenge_name: 'Fat Loss Phase',
    purpose: 'Improve body composition through consistent training, whole-food nutrition, protein, movement, and sleep.',
    duration_options_days: [14, 30],
    metrics_targeted: ['daily_task_completion_pct', 'energy_rating', 'workout_effort', 'sleep_quality', 'confidence_rating'],
    insights_triggers: {
      pre_recommendation: 'diet_compliance is low OR user selects body composition goal OR completion is consistent but body composition goal is active',
      in_progress_monitoring: 'energy_rating, sleep_quality, workout_effort, recovery_rating',
    },
    success_threshold: 'task_compliance >= 0.80 AND user reports improved consistency, body composition, or confidence',
    rewards: { xp: 500, badge_id: 'body_recomp' },
    safety_flags: {
      contraindications: ['history of disordered eating', 'medical advice not to diet', 'acute burnout'],
      notes: 'Avoid overly aggressive restriction. The goal is sustainable consistency, not crash dieting.',
    },
    evidence_level: 'strong',
    risk_level: 'medium',
    inspiration_sources: ['Layne Norton', 'Peter Attia', 'Andrew Huberman'],
    variants: {
      beginner: {
        difficulty: 'easy',
        required_daily_tasks: [
          'Hit a daily protein minimum.',
          'Complete daily movement.',
          'Drink water goal.',
          'Eat mostly whole foods.',
          'Log energy and sleep.',
        ],
        optional_tasks: [
          'Progress photo reminder.',
          'Post-meal walk.',
        ],
      },
      standard: {
        difficulty: 'medium',
        required_daily_tasks: [
          'Hit a daily protein target.',
          'Complete workout or planned movement.',
          'Eat mostly whole foods.',
          'Limit ultra-processed snacks.',
          'Hit water goal.',
          'Hit sleep target or log sleep quality.',
        ],
        optional_tasks: [
          'Track weekly body weight average.',
          'Progress photo reminder.',
          'Post-meal walk after largest meal.',
        ],
      },
      hard: {
        difficulty: 'hard',
        required_daily_tasks: [
          'Hit daily protein target.',
          'Complete workout or daily movement target.',
          'Eat whole-food meals with calorie awareness.',
          'Avoid ultra-processed snacks.',
          'Hit water goal.',
          'Hit sleep target.',
          'Take progress photo.',
        ],
        optional_tasks: [
          'Track weekly weight average.',
          'Track waist weekly.',
          'Plan meals for tomorrow.',
        ],
      },
    },
  },
  {
    id: 'strength_phase',
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
    emoji: '🧠',
    startable: true,
    start_flow: 'variant', // start button with variant + duration selection
    // Bump when the variant task lists change, so active challenges can offer
    // a sync to the latest version without resetting progress.
    template_version: 2,
    challenge_name: 'Mental Training Phase',
    purpose: 'Train the mind through action. Build focus, calm under pressure, and self-control with short daily mental and physical discipline work.',
    tagline: 'Physical discipline sharpens mental control. Do the hard small thing.',
    physical_examples: ['Pushups', 'Plank', 'Wall sit', 'Air squats', 'Shadowboxing', 'Mobility flow'],
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
        required_daily_tasks: [
          '2 minutes of breathwork or stillness.',
          '5-minute physical discipline block.',
          'Gratitude / Prayer complete.',
          'Write one daily win.',
          'Log stress and confidence.',
          'Quote of the Day complete.',
        ],
        optional_tasks: [
          'Gratitude note.',
        ],
        start_tasks: [
          { id: 'mt_mind',      name: '2 min breathwork or stillness',       icon: '🫁', color: '#A78BFA' },
          { id: 'mt_body',      name: '5-min physical discipline block',     icon: '🥊', color: '#FF6B6B' },
          { id: 'mt_gratitude', name: 'Gratitude / Prayer complete',         icon: '🙏', color: '#A8E6CF' },
          { id: 'mt_win',       name: 'Write one daily win',                 icon: '🏆', color: '#F9E04B' },
          { id: 'mt_log',       name: 'Log stress + confidence',             icon: '📊', color: '#74B9FF' },
          { id: 'mt_reflect',   name: 'Quote of the Day complete',           icon: '📜', color: '#DDA0DD' },
        ],
      },
      standard: {
        difficulty: 'medium',
        required_daily_tasks: [
          '5–10 minutes of breathwork, meditation, prayer, or NSDR.',
          '10-minute physical discipline block.',
          '30–60 second cold shower finish (optional if cold affects you poorly).',
          'Gratitude / Prayer complete.',
          'Write one daily win and one thing you controlled well.',
          'Complete Quote of the Day.',
          'Log stress, mood, and confidence.',
        ],
        optional_tasks: [
          '90-minute phone-free focus block.',
          'Do one thing you were avoiding.',
        ],
        start_tasks: [
          { id: 'mt_mind',      name: '5–10 min breathwork, meditation, prayer, or NSDR', icon: '🧘', color: '#A78BFA' },
          { id: 'mt_body',      name: '10-min physical discipline block',    icon: '🥊', color: '#FF6B6B' },
          { id: 'mt_cold',      name: '30–60 sec cold shower finish (optional)', icon: '🚿', color: '#45B7D1' },
          { id: 'mt_gratitude', name: 'Gratitude / Prayer complete',         icon: '🙏', color: '#A8E6CF' },
          { id: 'mt_win',       name: 'Daily win + one thing I controlled well', icon: '🏆', color: '#F9E04B' },
          { id: 'mt_reflect',   name: 'Complete Quote of the Day',           icon: '📜', color: '#DDA0DD' },
          { id: 'mt_log',       name: 'Log stress, mood + confidence',       icon: '📊', color: '#74B9FF' },
        ],
      },
      hard: {
        difficulty: 'hard',
        required_daily_tasks: [
          '10–20 minutes of mental training.',
          '15-minute physical discipline block.',
          '60–120 second cold shower finish (optional if cold affects you poorly).',
          'One 60–90 minute phone-free focus block.',
          'Gratitude / Prayer complete.',
          'Write one daily win and one lesson.',
          'Complete Quote/Faith task if enabled.',
          'Log stress, mood, confidence, and energy.',
        ],
        optional_tasks: [
          'No phone 30 minutes before bed.',
          'Read 10 pages.',
        ],
        start_tasks: [
          { id: 'mt_mind',      name: '10–20 min mental training',           icon: '🧘', color: '#A78BFA' },
          { id: 'mt_body',      name: '15-min physical discipline block',    icon: '🥊', color: '#FF6B6B' },
          { id: 'mt_cold',      name: '60–120 sec cold shower finish (optional)', icon: '🚿', color: '#45B7D1' },
          { id: 'mt_focus',     name: '60–90 min phone-free focus block',    icon: '🎯', color: '#FFB347' },
          { id: 'mt_gratitude', name: 'Gratitude / Prayer complete',         icon: '🙏', color: '#A8E6CF' },
          { id: 'mt_win',       name: 'Daily win + one lesson',              icon: '🏆', color: '#F9E04B' },
          { id: 'mt_reflect',   name: 'Complete Quote/Faith task if enabled', icon: '📜', color: '#DDA0DD' },
          { id: 'mt_log',       name: 'Log stress, mood, confidence + energy', icon: '📊', color: '#74B9FF' },
        ],
      },
    },
  },
  {
    id: 'recovery_phase',
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
