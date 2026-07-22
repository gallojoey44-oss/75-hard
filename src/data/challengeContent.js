// Shared challenge-experience content: difficulty guidance, the Future Self
// Letter, weekly reflection, and the app's core philosophy. Kept as data so
// wording stays consistent across the app.

export const PHILOSOPHY = {
  headline: 'Consistency > Intensity',
  body: 'Small habits completed every day outperform impossible habits completed once. Forge optimizes for long-term success, not maximum difficulty.',
};

export const DIFFICULTY_GUIDE = {
  beginner: {
    label: 'Beginner',
    recommended: false,
    points: [
      'Best for new users',
      'Returning after a break',
      'Small sustainable habits',
    ],
  },
  standard: {
    label: 'Standard',
    recommended: true,
    points: [
      'Recommended for most users',
      'Best balance of challenge and consistency',
    ],
  },
  hard: {
    label: 'Hard',
    recommended: false,
    points: [
      'Intended for users who have already built these habits',
      'We recommend completing Standard first',
    ],
  },
};

export const HARD_CONFIRM = {
  title: 'Start on Hard?',
  body: 'This version is intentionally demanding.\n\nWe recommend completing Standard before attempting Hard.\n\nWould you still like to continue?',
  continueLabel: 'Continue on Hard',
  backLabel: 'Choose Standard instead',
};

// Future Self Letter — required before a challenge begins, archived per
// challenge, never overwritten.
export const FUTURE_SELF_PROMPTS = [
  { key: 'why',        label: 'Why are you starting this challenge?', required: true },
  { key: 'ifQuit',     label: 'What happens if you quit?' },
  { key: 'become',     label: 'Who are you trying to become?' },
  { key: 'leaveBehind', label: 'What are you trying to leave behind?' },
  { key: 'thankYou',   label: 'What do you hope your future self thanks you for?' },
];

export const WEEKLY_REFLECTION_PROMPTS = [
  { key: 'helped',  label: 'Which task helped you the most?' },
  { key: 'avoided', label: 'Which task did you avoid?' },
  { key: 'tooHard', label: 'Which task felt too difficult?' },
];

export const KEYSTONE_EXPLAINER = 'These habits produce the greatest results.';
