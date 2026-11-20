import { EVIDENCE } from './evidence';

/**
 * Women's Hormone Health — strategy guides.
 *
 * Written more carefully than the rest, and more modestly. The challenge's own
 * framing is that these are the unglamorous foundations — sleep, food,
 * movement, stress — rather than a hormonal intervention, and these guides do
 * not claim more than that. Nothing here diagnoses anything, nothing here is a
 * substitute for a doctor, and where the honest answer is "this is worth
 * raising with a clinician", that is what it says.
 *
 * Three of the six habits have no guide: the step target, the hydration target
 * and the Daily Log each say what they need to in one line, and padding them
 * out would be the opposite of useful.
 *
 * Imports nothing but the evidence vocabulary, so hormoneHealthConfig can
 * attach these without the two modules importing each other.
 */

export const GUIDE_SOURCE = 'hormone';

export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

export const GUIDES = {
  // ───────────────────────────────────────────────────────────────── Sleep
  sleep: {
    id: 'sleep',
    title: 'Sleep & Consistency',
    icon: '😴',
    tagline: 'A steady sleep and wake time, and more room on the rough days.',
    quickStart: [
      'Fix your wake time and keep it within about an hour, weekends included.',
      'Count the window on the habit row backwards from it and set a going-to-bed alarm.',
      'On a rough day, give yourself extra sleep opportunity rather than pushing through.',
    ],
    why: {
      blurb: 'Sleep is the keystone habit of this challenge because it is the foundation the rest sit on: appetite, mood, stress tolerance and energy all move with it, and all of them are things people most often want help with here. Consistency matters as much as duration.',
      points: [
        'Irregular sleep timing is associated with worse sleep quality independently of how long you sleep. A steady wake time is the cheapest thing you can do about it.',
        'Short and disrupted sleep affects the hormones governing hunger and fullness, which is one reason a bad week of sleep so often shows up as a bad week of eating.',
        'Sleep is commonly more disturbed in the days before a period, and in perimenopause. Giving yourself extra opportunity on those days is the habit working as intended, not a concession.',
        'The habit asks for opportunity, not measured sleep. How much of the window you spend asleep is not something you can decide.',
      ],
    },
    how: {
      requirement: 'Keep a reasonably consistent sleep and wake time, within the window on the habit row. On rough days, give yourself extra sleep opportunity.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'A night in bed for the window that you slept badly through still counts.',
        'Logging hours slept in the Daily Log records the night; it never completes this habit for you.',
      ],
      notes: 'Persistent insomnia, or sleep that is disturbed in a way this does not touch, is worth raising with a doctor. This habit is a foundation, not a treatment.',
    },
    optimize: [
      {
        title: 'Anchor the wake time, let the bedtime flex',
        body: 'The wake time is what stabilises the rhythm, and it is the easier of the two to control. Holding it steady does more than a rigid bedtime you miss half the time.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Set an alarm for going to bed',
        body: 'Hardly anybody does, and it is the highest-return change available. The decision that costs you the window is made late in the evening, not in the morning.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Widen the window in the week before a period',
        body: 'Sleep is frequently more broken then. Planning an extra half hour in bed for those days is a sensible adjustment rather than a failure of discipline.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep the room cool and dark',
        body: 'Both are one-off changes rather than nightly effort, and a cooler room is consistently associated with better sleep — particularly where night sweats are a factor.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Track the pattern across a cycle, not a week',
        body: 'Seven days is too short to see a cyclical pattern. The Daily Log over a full challenge will show you more than any single bad fortnight can.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Treat a nap as planned, early and short',
        body: 'Twenty minutes before mid-afternoon tends to help without costing the night. A long late nap moves tonight\'s window too.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Counting hours asleep instead of the opportunity', body: 'You cannot decide to fall asleep. The window is the part you control, and the part being asked for.' },
      { title: 'Catching up at weekends', body: 'A three-hour lie-in repays a little of the debt and moves the clock, which usually costs the following two nights.' },
      { title: 'Pushing through a rough stretch', body: 'The habit explicitly says to give yourself more opportunity on those days. Ignoring that is ignoring the rule, not exceeding it.' },
      { title: 'Expecting it to fix something medical', body: 'If sleep stays badly disturbed with a consistent schedule and a reasonable window, that is information to take to a doctor.' },
    ],
    examples: [
      {
        label: 'An ordinary week',
        lines: [
          'Wake time is 06:45 on weekdays and 07:30 at weekends — inside the hour, which is what matters.',
          'An alarm at 22:15 starts the evening winding down; lights out around 22:45.',
          'One night you are awake for an hour in the middle. The window was given, so the habit is complete.',
          'You log the broken night in the Daily Log, which is where the pattern will show up later.',
        ],
      },
      {
        label: 'A rough few days',
        lines: [
          'Sleep has been broken for three nights and the days are hard going.',
          'Rather than holding the usual window, you move lights-out half an hour earlier for those days.',
          'The wake time stays where it is, so the rhythm holds.',
          'That is the habit as written — extra opportunity on the rough days — so it is ticked, not compromised.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Whole foods
  wholeFood: {
    id: 'wholeFood',
    title: 'Mostly Whole Foods',
    icon: '🥗',
    tagline: 'Enough of everything. Explicitly not a restrictive diet.',
    quickStart: [
      'Build each meal round protein, then add something that grew.',
      'Eat enough. Under-eating is the more common problem here than over-eating.',
      'Aim for colour across the day rather than perfection at any one meal.',
    ],
    why: {
      blurb: 'This habit is about adequacy, not restriction. Enough protein, enough fruit and vegetables, enough quality carbohydrate and enough fat — the challenge names all four on purpose, because the version of "eating well" that causes problems is the one that quietly removes one of them.',
      points: [
        'Persistently low energy intake, and low carbohydrate or fat intake in particular, is associated with menstrual disruption. Eating enough is the point, and it is why the habit says this is not a restrictive diet.',
        'Protein and fibre both make a day\'s energy steadier, which makes the stress and sleep habits easier to keep.',
        'Iron and calcium are the two that most often come up short. Both are addressed far better by food variety than by anything else you can do daily.',
        'There is nothing to count here, and nothing excluded. "Mostly" is the operative word in the habit.',
      ],
    },
    how: {
      requirement: 'Eat mostly minimally processed food, with enough protein, fruit, vegetables, quality carbohydrate and healthy fats. It is not a restrictive diet.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'A judgement about the day as a whole. Nothing is weighed, counted or logged.',
        'One processed thing does not fail the day.',
      ],
      notes: 'If you are vegetarian or vegan, or you know your iron has been low, pairing iron-rich foods with vitamin C is worth doing deliberately — and persistently low iron is a blood test, not a habit.',
    },
    optimize: [
      {
        title: 'Decide the protein first',
        body: 'It is the component that cannot be added at the end of a meal, and the one most often missing from an otherwise good day.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Pair iron with vitamin C',
        body: 'Vitamin C substantially improves absorption of the iron in plant foods. Lemon over the greens, peppers in the stir fry, fruit with the fortified cereal. Free, and it genuinely matters.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Do not cut the fat',
        body: 'Fat is named in the habit for a reason. Very low fat intake is one of the more common ways a "clean" diet becomes an inadequate one.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep frozen vegetables and tinned fish in the house',
        body: 'Nutritionally sound, they do not spoil, and they remove the main excuse on a tired evening.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Rotate rather than optimise',
        body: 'The same four healthy meals forever is a narrow diet with a good reputation. Changing the vegetable is worth more than adding a supplement.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Notice appetite changes across the cycle',
        body: 'Appetite commonly rises in the second half of the cycle. Expecting it, and eating accordingly, works better than treating it as a lapse.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Turning it into a diet', body: 'The habit says explicitly that it is not one. The restrictive reading is the one most likely to cause the problems this challenge is trying to help with.' },
      { title: 'Eating healthily but not enough', body: 'Under-eating is the commoner failure here, and it is the one that shows up in energy, mood and cycle rather than on the scale.' },
      { title: 'Cutting out a whole food group', body: 'Whichever one it is, something it was carrying now has to come from somewhere else — usually from nowhere.' },
      { title: 'Reaching for supplements before food', body: 'They have a place, usually after a test. Variety is cheaper, better evidenced and does more.' },
    ],
    examples: [
      {
        label: 'An ordinary day',
        lines: [
          'Breakfast — Greek yoghurt, berries and nuts, or eggs on wholemeal toast.',
          'Lunch — leftovers with a large salad, lemon squeezed over the greens.',
          'Snack — fruit and a handful of nuts.',
          'Dinner — salmon or lentils, potatoes or rice, two vegetables. Protein, colour and enough of everything, with nothing counted.',
        ],
      },
      {
        label: 'A busy day you did not plan',
        lines: [
          'Breakfast was rushed, so it is yoghurt and fruit from the shop.',
          'Lunch is a sandwich, which is fine, with a piece of fruit rather than crisps.',
          'Afternoon — you eat properly rather than skipping, because under-eating is the failure mode this habit watches for.',
          'Dinner is frozen vegetables and tinned fish over rice, in eight minutes. Mostly whole, enough of everything, ticked.',
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────── Down-regulation
  stress: {
    id: 'stress',
    title: 'Down-Regulation',
    icon: '🧘',
    tagline: 'Five deliberate minutes. Your choice of practice.',
    quickStart: [
      'Pick one and keep it: breathing, meditation, prayer, journaling, or quiet relaxation.',
      'Five minutes is a complete session — the habit row states the minimum.',
      'Give it a fixed slot rather than waiting for a calm moment to appear.',
    ],
    why: {
      blurb: 'Chronic stress affects sleep, appetite and mood, which are three of the four things this challenge is built on. The habit is small on purpose: a brief daily practice that actually happens is worth considerably more than a long one that happens occasionally.',
      points: [
        'Slow breathing with a longer exhale moves the balance towards the parasympathetic side within a few minutes — the quickest lever available without equipment.',
        'Stress and sleep run in both directions, so a deliberate five minutes in the afternoon is partly an intervention on that night\'s sleep.',
        'The list of qualifying practices is wide by design. What matters is that it is deliberate and that input stops.',
        'This is not a treatment for anxiety or depression. If either is in the picture, this habit sits alongside proper support rather than instead of it.',
      ],
    },
    how: {
      requirement: 'Spend at least the minutes on the habit row in a deliberate calming practice — meditation, diaphragmatic breathing, prayer, journaling, quiet relaxation, or anything else of that kind.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'It does not have to be a formal practice. Sitting quietly and breathing slowly counts.',
        'Quiet is part of it: the same minutes with a podcast running are a break rather than down-regulation.',
      ],
      notes: 'If you are also running a challenge with its own down-regulation habit, one session satisfies both and is paid once — Forge merges shared habits instead of duplicating them.',
    },
    optimize: [
      {
        title: 'Four in, eight out, for five minutes',
        body: 'The simplest version, and the one with the clearest rationale. No app, no posture, nothing to learn.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Give it a time, not an intention',
        body: 'A practice with a slot gets done. One that waits for a quiet moment gets done on the days it was least needed.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Write it down if sitting still does not suit you',
        body: 'Journaling is on the list for a reason — for some people getting the thought out is what quiet sitting is trying to achieve.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Use it as a boundary between parts of the day',
        body: 'Five minutes on arriving home changes the evening. The same five at bedtime only changes bedtime.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Put it where the cycle makes the day hardest',
        body: 'If the days before a period are consistently worse, that is where these five minutes are worth the most. The Daily Log is what makes that pattern visible.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep it when life gets busy',
        body: 'It is the first habit people drop and the one whose absence compounds, because it is also acting on sleep.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Waiting until you feel like it', body: 'The days you least want five quiet minutes are the days they do the most.' },
      { title: 'Making it long', body: 'Twenty minutes is a lovely practice and a poor daily habit. Five is in the rule because five happens.' },
      { title: 'Leaving input running', body: 'Music, a podcast, a screen. Without quiet it is a short break, not a downshift.' },
      { title: 'Expecting it to replace support', body: 'For anxiety or low mood that is more than a hard week, this sits alongside proper help, not in place of it.' },
    ],
    examples: [
      {
        label: 'A working afternoon',
        lines: [
          '15:30 — the point the day reliably sags, noticed over the first week of logs.',
          'Phone in a drawer, five minutes of four-in, eight-out at the desk.',
          'You feel ordinary afterwards, which is the usual outcome, and the next hour is better.',
          'Tick the habit.',
        ],
      },
      {
        label: 'A day with no quiet anywhere',
        lines: [
          'The house is full and there is nowhere to sit still.',
          'Five minutes writing instead — what is actually bothering you, on paper, unedited.',
          'Journaling is named in the rule, so that is a complete session.',
          'Tick it.',
        ],
      },
    ],
  },
};

/** A guide by its local id, or null. */
export function guide(id) {
  return GUIDES[id] || null;
}
