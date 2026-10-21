import { HABIT_KEYS } from './habitKeys';

/**
 * 🎯 LOCK IN — the complete challenge definition.
 *
 * Fourteen days of balanced high performance: productivity, sustained
 * attention, flow, physical energy, recovery and stress resilience, held
 * together by sleep. Everything challenge-specific lives here — the identity,
 * the eight daily habits, the XP weighting, the flow progression, the lighter
 * days, and the eight educational strategy guides. The template entry, the
 * setup screen, the daily panel and the habit guides are all generated from
 * these constants.
 *
 * WHAT MAKES IT DIFFERENT from Forge's other challenges is that the education
 * is first-class. Every habit carries a full strategy guide (GUIDES below)
 * reachable from the daily task row, so the challenge teaches the user how to
 * perform the habit well rather than only asking whether they did it.
 *
 * THE RULE THAT SHAPES THE XP LADDER: you can never earn more by sleeping less.
 * Sleep carries the highest XP of any habit, there is no productivity bonus
 * that outweighs it, and the lighter-day rule reduces work volume while leaving
 * sleep untouched. See XP and LIGHTER_DAYS.
 *
 * To evolve it later, change data here, not logic elsewhere:
 *   • add/remove a daily habit   → DAILY_HABITS
 *   • change XP weighting        → XP (the priority ladder is documented there)
 *   • change a strategy guide    → GUIDES
 *   • change the flow ramp       → FLOW_STAGES
 *   • change the lighter days    → LIGHTER_DAYS
 */

export const LOCK_IN_TEMPLATE_ID = 'lock_in_14_day';

export const DURATION_DAYS = 14;
export const COMPLETION_BONUS_XP = 700;

export const IDENTITY = {
  id: LOCK_IN_TEMPLATE_ID,
  name: 'LOCK IN',
  shortName: 'LOCK IN',
  subtitle: 'Deep Focus. Real Output. Sustainable Energy.',
  emoji: '🎯',
  goal: '14 days of focused work, protected attention and real recovery — building the capacity to do demanding work without burning out.',
  pitch: 'Two weeks to find out what you can actually do when your attention, energy and recovery are all working for you instead of against you.',
};

// ── XP weighting ────────────────────────────────────────────────────────────
// Forge's existing scale (keystones 40, supporting habits 10–30). The importance
// ladder, highest to lowest, and the reason for each tier:
//
//   Sleep optimization      40  HIGHEST  the input every other habit depends on,
//                                        and the one nothing compensates for.
//                                        Deliberately the single highest-value
//                                        habit in the challenge so that cutting
//                                        sleep to do more work always LOSES XP.
//   Flow training           35  HIGH     the trainable skill at the centre of
//                                        the challenge
//   Execute your priorities 30  HIGH     output, not effort — the thing the
//                                        challenge is ultimately for
//   Daily mission           25  MEDIUM   the planning that makes the two above
//                                        possible
//   Physical energy         25  MEDIUM   the substrate for cognitive work
//   Attention training      20  MEDIUM   builds the endurance flow work spends
//   Mental recovery         15  SUPPORT  protects tomorrow's capacity
//   Stress off-switch       12  SUPPORT  ends the day deliberately
//   Daily log               10           shared Forge task
export const XP = {
  sleep: 40,
  flow: 35,
  execute: 30,
  mission: 25,
  energy: 25,
  attention: 20,
  recovery: 15,
  stress: 12,
  dailyLog: 10,
};

// ── Editable targets ────────────────────────────────────────────────────────
export const PRIORITY_COUNT = { total: 3, mustComplete: 2 };
export const FLOW_SESSIONS_PER_DAY = 2;
export const ATTENTION_MINUTES = { suggested: 10, min: 10 };
export const RECOVERY_MINUTES = { suggested: 20, min: 20 };
export const SHUTDOWN_MINUTES = { suggested: 5, min: 5 };
export const SLEEP_OPPORTUNITY = { suggested: 8, min: 6, max: 10, unit: 'hours' };

/**
 * The flow-session progression across the 14 days.
 *
 * Focus duration is trained like any other capacity: start at a length you can
 * actually hold and extend it. The ramp is 25 → 35 → 45 → 50 minutes, and the
 * target is the length of EACH of the day's two sessions.
 *
 * 50 minutes is the end of the ramp rather than a waypoint on the way to
 * something longer. Longer blocks are not automatically better, and a session
 * you abandon teaches the opposite of what this habit is for.
 */
export const FLOW_STAGES = [
  { minutes: 25, fromDay: 1,  toDay: 3,  label: 'Baseline', note: 'Short enough that starting is never the hard part. Find out what a genuinely undistracted 25 minutes feels like.' },
  { minutes: 35, fromDay: 4,  toDay: 7,  label: 'Extend',   note: 'Past the point where most people reach for their phone. This is where the habit starts to be worth something.' },
  { minutes: 45, fromDay: 8,  toDay: 11, label: 'Deepen',   note: 'Long enough to get properly into something difficult. Protect the start of these.' },
  { minutes: 50, fromDay: 12, toDay: 14, label: 'Hold',     note: 'The top of the ramp. The goal is to hold this well, not to keep climbing.' },
];

/**
 * Planned lighter days.
 *
 * Two weeks of escalating focus work with no planned relief is how people
 * finish a challenge and never do it again. These days are built into the plan
 * from the start — they are not failures, not a penalty, and not optional extra
 * credit for skipping them.
 *
 * On a lighter day the FLOW requirement drops to one session instead of two.
 * Nothing else changes, and sleep in particular is untouched: a lighter day
 * reduces work volume, never recovery.
 */
export const LIGHTER_DAYS = [7, 14];
export const LIGHTER_DAY_SESSIONS = 1;

export const LIGHTER_DAY_NOTE =
  'Planned lighter day — one flow session instead of two. This is part of the plan, not a day off: every other habit is unchanged, and sleep especially. You cannot earn anything extra by ignoring it.';

/**
 * Recovery Mode.
 *
 * Forge already has this: a Minimum Warrior Day (MWD). Rather than adding a
 * second parallel concept, LOCK IN names Forge's existing mechanism and
 * explains when to use it, so there is exactly one way to take a reduced day
 * and exactly one place the app records it.
 */
export const RECOVERY_MODE = {
  title: 'Recovery Mode',
  blurb: 'For the days when the honest answer is that you have nothing to spend. Switch the day to a Minimum Warrior Day from the Today screen: a short reduced list that keeps the streak honest instead of forcing you to either fake a full day or break it.',
  whenToUse: [
    'You are ill, injured, or genuinely sleep-deprived.',
    'Something outside your control took the day.',
    'You have hit real cognitive fatigue — not "I do not feel like it", but "there is nothing there".',
  ],
  note: 'Recovery Mode is not the same as a planned lighter day. Lighter days are scheduled in advance (Days 7 and 14) and reduce only the flow requirement; Recovery Mode is something you reach for when the day has already gone wrong.',
  sleepRule: 'Either way, sleep is never the thing you cut. There is no version of this challenge where less sleep earns more.',
};

/** The flow stage covering a day number (clamped to the ramp's ends). */
export function flowStageForDay(dayNum) {
  const d = Number(dayNum) || 1;
  return FLOW_STAGES.find(s => d >= s.fromDay && d <= s.toDay)
    || (d < FLOW_STAGES[0].fromDay ? FLOW_STAGES[0] : FLOW_STAGES[FLOW_STAGES.length - 1]);
}

/** True when a day number is a planned lighter day. */
export function isLighterDay(dayNum) {
  return LIGHTER_DAYS.includes(Number(dayNum));
}

/** How many flow sessions a given day asks for. */
export function flowSessionsForDay(dayNum) {
  return isLighterDay(dayNum) ? LIGHTER_DAY_SESSIONS : FLOW_SESSIONS_PER_DAY;
}

/**
 * The full flow requirement for a day, as one object the UI can render without
 * recomputing anything: how many sessions, how long each, and why.
 */
export function flowRequirement(dayNum) {
  const stage = flowStageForDay(dayNum);
  const sessions = flowSessionsForDay(dayNum);
  return {
    dayNum: Number(dayNum) || 1,
    minutes: stage.minutes,
    sessions,
    stage,
    lighter: isLighterDay(dayNum),
    label: `${sessions} × ${stage.minutes} min`,
    totalMinutes: sessions * stage.minutes,
  };
}

// ── Evidence labelling ──────────────────────────────────────────────────────
/**
 * Every optimization and advanced strategy carries one of these.
 *
 * The point is that a user can tell at a glance whether they are reading
 * something well established or something one small study hinted at. Nothing in
 * the guides invents a statistic, and nothing experimental is presented as
 * settled.
 */
export const EVIDENCE = {
  ESTABLISHED: 'established',
  PROMISING: 'promising',
  EXPERIMENTAL: 'experimental',
};

export const EVIDENCE_META = {
  [EVIDENCE.ESTABLISHED]: {
    key: EVIDENCE.ESTABLISHED, label: 'Well supported', dot: '🟢', color: '#10B981',
    blurb: 'Consistent evidence, or a direct consequence of something well established.',
  },
  [EVIDENCE.PROMISING]: {
    key: EVIDENCE.PROMISING, label: 'Some support', dot: '🟡', color: '#F59E0B',
    blurb: 'Real evidence, but limited, mixed, or mostly from small studies. Worth trying; do not treat as settled.',
  },
  [EVIDENCE.EXPERIMENTAL]: {
    key: EVIDENCE.EXPERIMENTAL, label: 'Experimental', dot: '🔵', color: '#60A5FA',
    blurb: 'Mostly practice and plausible reasoning rather than good evidence. Harmless to try, but no promises.',
  },
};

export const EVIDENCE_LEGEND =
  'Optimization and advanced strategies are labelled by how good the evidence is. Everything required by the challenge is in “How to complete it” — the labelled strategies are all optional.';

// ── The eight strategy guides ───────────────────────────────────────────────
/**
 * One guide per daily habit, each with the same six sections plus a Quick Start.
 *
 * Shape:
 *   quickStart  string[]                 — do these three things today
 *   why         { blurb, points[] }      — mechanism, stated modestly
 *   how         { requirement, earns[], notes? } — the XP rules, matching the dashboard
 *   optimize    { title, body, evidence }[]
 *   advanced    { title, body, evidence }[]
 *   mistakes    { title, body }[]
 *   examples    { label, lines[] }[]      — a student day and a working day
 *
 * The `how` section is the contract: it must say exactly what the dashboard
 * checkbox means. If a habit's definition changes, change it in DAILY_HABITS
 * and here together.
 */
export const GUIDES = {
  // ─────────────────────────────────────────────────────────────── 1. Mission
  mission: {
    id: 'mission',
    title: 'Daily Mission',
    icon: '🗂️',
    tagline: 'Decide what matters before the day decides for you.',
    quickStart: [
      'Write down exactly three priorities for today — no more.',
      'For each one, write what "done" looks like in a single sentence.',
      'Put the hardest one in a specific time block on your calendar.',
    ],
    why: {
      blurb: 'Planning does not make you work harder; it removes the decisions that stop you working at all. Most lost time is not spent on the wrong task — it is spent deciding which task to start.',
      points: [
        'Specific, challenging goals reliably produce better performance than vague intentions to "work hard" — this is one of the most consistently replicated findings in the goal-setting literature.',
        'Deciding in advance WHEN and WHERE you will do something measurably increases the chance you actually do it. The plan does the work your willpower would otherwise have to.',
        'Three priorities is a constraint, not a limit on ambition. A list of ten priorities has no priorities in it.',
        'Choosing in the morning, when the day is still yours, beats choosing at 2pm when you are already tired and reactive.',
      ],
    },
    how: {
      requirement: 'Write down three meaningful priorities for the day, each with a clear definition of what finishing it means.',
      earns: [
        `Checking this habit earns ${XP.mission} XP once per day.`,
        'XP is for having planned the day — it does not depend on whether you finish the priorities. That is the Execute Your Priorities habit, which is scored separately.',
        'It takes a few minutes. Do it before you open anything else.',
      ],
      notes: 'A "meaningful" priority is one you would be glad to have finished at the end of the day. Clearing your inbox is maintenance; it is rarely a priority.',
    },
    optimize: [
      {
        title: 'Give every priority a completion criterion',
        body: '"Work on the essay" cannot be finished. "Draft the three body paragraphs" can. Write the version you can tick, and you remove the end-of-day argument with yourself about whether it counted.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Time block the hard one first',
        body: 'Give your most demanding priority a specific start time and a specific place, and defend it like a meeting. Vague intentions lose to whatever is in front of you; a scheduled block has to be actively cancelled.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Schedule demanding work for your own high-energy window',
        body: 'Alertness varies predictably across the day, but the shape differs between people. Spend a few days noticing when demanding work feels easiest and when it feels like wading, then put your hardest priority in the good window and admin in the bad one.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Decompose anything you are avoiding',
        body: 'Avoidance is usually a sign the task is too big to start, not that you are lazy. Break it until the first step takes under fifteen minutes and requires no decisions. "Open the document and write the first heading" is a legitimate priority if it unblocks the rest.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Plan the day before, if mornings are rushed',
        body: 'Writing tomorrow\'s three priorities at the end of today means you start the day already pointed somewhere. It also closes the day, which the Stress Off-Switch habit builds on.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Pre-commit a response to the obvious obstacle',
        body: 'Add one line to your plan: "if X happens, I will do Y." Naming the likely derailment in advance, with a specific response, is a well-studied way of making plans survive contact with the day.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Keep a separate capture list',
        body: 'Everything that arrives mid-day goes on a capture list, not into today\'s three. You review it when you plan tomorrow. This keeps the day\'s shape intact without pretending new work does not exist.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Theme your days',
        body: 'Assign whole days a dominant type of work — writing days, meeting days, admin days. It reduces the number of gear changes you make in a week. Worth trying if you control your calendar; it is a practice rather than a research finding.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Writing a to-do list instead of priorities', body: 'Eleven items is a list of everything you can think of. It tells you nothing about what to do next, which is the entire job of a plan.' },
      { title: 'Measuring the day in hours worked', body: 'Busyness is the easiest thing to produce and the easiest thing to mistake for progress. Being at your desk for nine hours is an input, not an outcome.' },
      { title: 'Planning a day that could not possibly fit', body: 'If three priorities plus your actual commitments do not fit in the hours available, you have not planned a day — you have planned a disappointment. Cut one.' },
      { title: 'Leaving the hardest thing until "later"', body: 'Later is when you are most depleted and most interruptible. The task does not get easier by waiting; you get worse at it.' },
      { title: 'Re-planning instead of working', body: 'Reorganising the list is comfortable and feels productive. If you have planned the day, the plan is finished — go and do the first thing.' },
    ],
    examples: [
      {
        label: 'Student day',
        lines: [
          '08:10 — Over breakfast, write three priorities: (1) finish problem set 4 questions 1–5, (2) draft the intro and outline for the history essay, (3) review lecture 9 notes and make ten cards.',
          '08:15 — Block 09:00–09:45 and 11:00–11:45 for priorities 1 and 2, in the library, phone in the bag.',
          'Lectures and seminars go in as fixed commitments; priority 3 goes in the 16:00 gap.',
          'Everything else that comes up today — emails, society admin, the reading for Thursday — goes on the capture list.',
        ],
      },
      {
        label: 'Working day',
        lines: [
          '08:30 — Before email: three priorities. (1) Ship the pricing page changes, (2) write the first draft of the Q3 proposal, (3) unblock Dana on the migration.',
          'Hardest is the proposal draft, and mornings are your good window, so it gets 09:00–09:50 with the door shut.',
          'Standups and the 14:00 review are fixed; priority 3 is a twenty-minute conversation booked at 11:30.',
          '17:30 — Tomorrow\'s three get written before you shut down, which doubles as the start of your off-switch routine.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────── 2. Flow
  flow: {
    id: 'flow',
    title: 'Flow Training',
    icon: '🌊',
    tagline: 'Train focus like a capacity, because that is what it is.',
    quickStart: [
      'Check today\'s target in the LOCK IN panel — it changes as the challenge progresses.',
      'Before you start: phone in another room, one task chosen, one tab open.',
      'Run the same 2-minute ritual every time so starting stops being a decision.',
    ],
    why: {
      blurb: 'Deep, uninterrupted work is a trainable capacity. This habit trains it directly: progressively longer sessions, with the conditions set up so that concentration is possible rather than heroic.',
      points: [
        'Switching between tasks has a real, measurable cost in time and errors. Every switch means reloading context, and the cost is paid again on the way back.',
        'The conditions most associated with deep absorption are consistent and unglamorous: a task that is challenging but within reach, a clear goal, and quick feedback on whether what you are doing is working.',
        'Starting is the hardest part of focused work, and a fixed pre-session ritual moves starting from a decision to a reflex.',
        'The ramp from 25 to 50 minutes matters because capacity is built, not summoned. A 50-minute block on day one mostly teaches you that you cannot do 50-minute blocks.',
      ],
    },
    how: {
      requirement: `Complete ${FLOW_SESSIONS_PER_DAY} focused work sessions at today's target length. The target progresses across the challenge: ${FLOW_STAGES.map(s => `${s.minutes} min (Days ${s.fromDay}–${s.toDay})`).join(', ')}.`,
      earns: [
        `Checking this habit earns ${XP.flow} XP once per day.`,
        `On a planned lighter day (Day ${LIGHTER_DAYS.join(' and Day ')}), the requirement is ${LIGHTER_DAY_SESSIONS} session instead of ${FLOW_SESSIONS_PER_DAY}. The XP is identical — a lighter day is worth exactly as much as a full one.`,
        'A session counts if you worked on one thing, without switching, for the target length. It does not have to have felt good.',
      ],
      notes: 'You are not required to experience flow. Flow is a state you cannot summon on demand, and grading yourself on whether it arrived would make this habit unachievable. What you can control — and what this habit asks for — is the conditions and the time.',
    },
    optimize: [
      {
        title: 'Build a 2–5 minute pre-flow ritual and never vary it',
        body: 'Same steps, same order, every session. For example: water on the desk, phone in another room, close everything except the one document, write the session\'s goal on paper, start the timer. The content matters less than the invariance — you are building a cue, and a cue only works if it is consistent.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'One task. Not one project — one task',
        body: 'Decide the single thing before the timer starts, specifically enough that you cannot drift. "Work on the proposal" drifts. "Write the risks section" does not.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Put the phone in another room',
        body: 'Not face-down, not in a drawer — out of reach. Silencing it still leaves the decision to check it available to you dozens of times an hour, and every one of those decisions costs something.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Use a blocker so willpower is not the mechanism',
        body: 'A website and app blocker running on a schedule removes the choice entirely. The goal is to need no self-control at all during the session, because self-control is exactly what gets thin when the work is hard.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Match the difficulty to where you actually are',
        body: 'Work far above your current ability produces anxiety and avoidance; work far below it produces boredom and phone-checking. If you keep bouncing out of sessions, the task is usually mis-pitched rather than your focus being broken.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Give yourself feedback inside the session',
        body: 'Deep absorption is associated with knowing, moment to moment, whether what you are doing is working. Write the goal where you can see it, and work in a way that shows visible progress — words appearing, tests going green, problems ticked off.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Set the desk up once, not every time',
        body: 'Everything you need within reach, everything you do not out of sight, decent light, comfortable temperature, and a dedicated spot if you can manage one. A workspace you have to tidy before you can start is a workspace that delays starting.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep a distraction pad',
        body: 'When an unrelated thought arrives mid-session — and it will — write one line on paper and carry on. You neither lose the thought nor chase it. This is the cheapest technique here and one of the most effective.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Noise-cancelling headphones',
        body: 'In a noisy shared space these help straightforwardly, by removing the noise. Expect less in a quiet room — the benefit is mostly the noise reduction, not something the headphones add.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Find your own background sound',
        body: 'Some people focus better with instrumental music, brown noise or rain; others are measurably worse with any of it, and lyrics in particular tend to interfere with language-heavy work. The research is genuinely mixed and individual differences are large. Test it on yourself for a week rather than trusting a playlist title.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Stop mid-sentence to make restarting easy',
        body: 'Finishing a session with a half-written sentence or an obvious next step gives tomorrow\'s session a running start. A long-standing writer\'s practice; the plausible mechanism is that an unfinished task is easier to re-enter than a blank one.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Keep a session log',
        body: 'One line per session: what you worked on, what the target was, and whether you held it. Two weeks of this tells you more about your own focus — what time of day, what kind of task, what wrecks it — than any general advice can.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Same place, same time, every day',
        body: 'If you can run your sessions at the same hour in the same spot, the context itself starts doing some of the work of starting. Worth trying if your schedule allows it.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Treating a session as a container for whatever you feel like', body: 'A 45-minute block spent moving between four tasks is not a flow session; it is four short sessions with switching costs between them.' },
      { title: '"Just checking" something mid-session', body: 'A ten-second glance at a message does not cost ten seconds. It costs the time to get back to where you were, and sometimes the rest of the session.' },
      { title: 'Chasing the feeling', body: 'If you only count sessions where you felt absorbed, you will count almost none. Most good work is done in sessions that felt ordinary.' },
      { title: 'Jumping the ramp', body: 'Going straight to 50 minutes on day two usually produces one abandoned session and a story about having bad focus. The ramp is there to be followed.' },
      { title: 'Stacking sessions with no gap', body: 'Back-to-back blocks with no break borrow from the second one. Put a real break between them — that is what the Mental Recovery habit is for.' },
      { title: 'Using the ritual as the work', body: 'If the preparation takes fifteen minutes, it has become procrastination with good branding. Two to five minutes.' },
    ],
    examples: [
      {
        label: 'Student day (Day 5 — 35 min target)',
        lines: [
          '09:00 — Library, phone in the bag, laptop blocker on until 10:30. Goal written on paper: "problem set Q1–3".',
          '09:02 — Timer for 35 minutes. One task, no tabs.',
          '09:37 — Stop. Walk to get water, no phone. Ten minutes off the screen.',
          '10:00 — Second session, 35 minutes: essay outline. Different task, same ritual.',
          'Anything that pops into your head mid-session goes on the distraction pad and gets dealt with at lunch.',
        ],
      },
      {
        label: 'Working day (Day 10 — 45 min target)',
        lines: [
          '08:55 — Calendar blocked 09:00–09:45 as busy. Slack quit, not minimised. Phone in a drawer in the other room.',
          '09:00 — Session one: the proposal draft, 45 minutes, nothing else open.',
          '09:45 — Stand up, leave the desk, do not open your phone. This is a real break.',
          '11:15 — Session two: 45 minutes on the pricing changes, after the standup rather than before it, so the break is genuine.',
          'Afternoon is for meetings and shallow work — you have already done the work that needed your best attention.',
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────── 3. Execute
  execute: {
    id: 'execute',
    title: 'Execute Your Priorities',
    icon: '✅',
    tagline: 'Finished things, not time spent.',
    quickStart: [
      `Finish at least ${PRIORITY_COUNT.mustComplete} of this morning's ${PRIORITY_COUNT.total} priorities.`,
      'Start with the one you least want to do, while you still have something to spend.',
      'If something turns out to be far bigger than you thought, redefine it honestly rather than abandoning it.',
    ],
    why: {
      blurb: 'This is the habit that keeps the challenge honest. Planning and focusing are both measurable and both easy to do without producing anything. This one asks what actually got finished.',
      points: [
        'Hours worked and work completed come apart quickly, and hours are much easier to accumulate. Measuring output is uncomfortable for exactly that reason.',
        `The bar is ${PRIORITY_COUNT.mustComplete} of ${PRIORITY_COUNT.total}, not ${PRIORITY_COUNT.total} of ${PRIORITY_COUNT.total}, because a standard you hit only on perfect days teaches you to stop trying on imperfect ones.`,
        'Tracking completion gives you real data about your own estimation. Most people discover they plan about twice as much as they can do, and that is useful to know rather than shameful.',
        'A task with a clear finish line can be finished. Half of execution is defining the work so that finishing is possible.',
      ],
    },
    how: {
      requirement: `Complete at least ${PRIORITY_COUNT.mustComplete} of the ${PRIORITY_COUNT.total} priorities you set in your Daily Mission.`,
      earns: [
        `Checking this habit earns ${XP.execute} XP once per day.`,
        `${PRIORITY_COUNT.mustComplete} of ${PRIORITY_COUNT.total} is the requirement. Finishing all ${PRIORITY_COUNT.total} earns the same XP — there is no bonus for a clean sweep, and deliberately none for working later to get one.`,
        'You judge whether a priority is finished, against the completion criterion you wrote this morning. The criterion is what makes that judgement honest.',
      ],
      notes: 'If you finish two and the third turns out to be a week of work, that is a successful day and a planning lesson. Record it as it happened.',
    },
    optimize: [
      {
        title: 'Write priorities you can prove you finished',
        body: 'Each one should name a specific artefact or outcome: a section drafted, a bug fixed and deployed, a set of cards made. If you cannot tell from the words whether it is done, rewrite it before you start.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Decompose until the first step is obvious',
        body: 'Big work stalls at the start because the first move is unclear. Break it down until step one needs no thinking. The rest of the task usually becomes visible once you are inside it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Do the thing you are avoiding first',
        body: 'Avoided tasks get more expensive as the day goes on, because the avoidance compounds and your capacity drops. Putting it first also means the day cannot be quietly spent on easier things.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Track completion across the fortnight',
        body: 'Note how many of three you finished each day. By the end of the challenge you have fourteen data points on your own planning accuracy, which is worth more than any generic advice about estimation.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'When a task turns out to be much harder than expected',
        body: 'Do not simply drop it. Either carve out the part that genuinely fits today and finish that, or stop and rescope it deliberately. Then write down what you had wrong — the estimate, the dependencies, or the definition. That is the actual lesson.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Finish something before you start the next thing',
        body: 'Three tasks each nearly finished is nothing finished. Taking one to done before opening the next gives you real completions and far less context to carry.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Keep a done list',
        body: 'A running log of what you actually finished, separate from your to-do list. It is a more accurate record of a fortnight than a list of everything you meant to do, and considerably better for morale.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Estimate before, record after',
        body: 'Write how long you think each priority will take, then what it took. Two weeks of this makes your estimation error visible and specific, usually by a consistent factor you can correct for.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Run a two-minute end-of-day review',
        body: 'What got finished, what did not, and why. Keep it short and factual. It feeds tomorrow\'s mission and gives the Stress Off-Switch something concrete to close.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Counting effort as completion', body: '"I worked on it for three hours" is not finishing it. The habit asks what is done, which is the harder and more useful question.' },
      { title: 'Rewriting the priority at 10pm to match what you did', body: 'Moving the target to cover the shot destroys the only thing this habit measures. Record the miss; it costs you one day\'s XP and buys you real information.' },
      { title: 'Choosing easy priorities to protect the streak', body: 'Three trivial tasks will reliably get you the XP and will not move anything. The challenge is fourteen days long — gaming it is not worth what it costs you.' },
      { title: 'Abandoning a task the moment it gets hard', body: 'Difficulty is usually information about scope, not a signal to quit. Rescope deliberately instead of dropping it silently.' },
      { title: 'Letting meetings and messages eat the priorities', body: 'If the priorities only get attention after everything reactive is done, they will not get attention. Protect them first.' },
    ],
    examples: [
      {
        label: 'Student day',
        lines: [
          'Morning priorities: (1) problem set Q1–5, (2) essay intro and outline, (3) ten cards from lecture 9.',
          '09:00–10:20 — Problem set. Q1–4 go fine; Q5 turns out to need a method you have not covered.',
          'Rescope honestly: Q5 moves to tomorrow with a note to ask in the seminar. Q1–4 counts as finished for priority 1.',
          '11:00 — Essay intro and outline, done by 11:45. That is two of three — the habit is met.',
          '16:00 — Cards get made anyway because the day went well. No extra XP, and that is the point: the bar does not move.',
        ],
      },
      {
        label: 'Working day',
        lines: [
          'Morning priorities: (1) ship the pricing page, (2) draft the Q3 proposal, (3) unblock Dana.',
          '09:00 — Proposal draft first; it is the one you are avoiding. Done at 09:50.',
          '11:30 — Twenty minutes with Dana. Priority 3 done.',
          '14:00 — The pricing deploy hits a failing test owned by another team. You cannot finish it today.',
          'Two of three finished, logged as such. The deploy is tomorrow\'s priority 1, with the dependency written down so you plan it properly this time.',
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── 4. Attention
  attention: {
    id: 'attention',
    title: 'Attention Training',
    icon: '🧘',
    tagline: 'Build the endurance that focused work spends.',
    quickStart: [
      `${ATTENTION_MINUTES.suggested} minutes of reading or meditation. Pick one and start today.`,
      'Phone in another room for the whole ten minutes.',
      'When your mind wanders, bring it back. The bringing back is the training.',
    ],
    why: {
      blurb: 'Flow Training spends attention; this habit trains it. Ten minutes of deliberately sustained, single-stream attention a day, with nothing competing for it.',
      points: [
        'Mindfulness training shows small-to-moderate improvements on attention measures in healthy adults. The literature is real but mixed, with plenty of small studies and inconsistent control conditions — worth doing, not a guarantee.',
        'Sustained reading is practice at exactly the thing focused work requires: holding one stream of information without switching. Whether that transfers to other tasks is less well established than it is often claimed, but the practice itself is the same shape as the skill.',
        'Noticing that your attention has wandered, and returning it, is the trainable move. A session full of wandering and returning is a good session, not a failed one.',
        'Habitual rapid switching — the scroll, the tab, the notification — is practice too. It is practice at the opposite thing.',
      ],
    },
    how: {
      requirement: `${ATTENTION_MINUTES.suggested} minutes of reading or meditation, in one unbroken stretch.`,
      earns: [
        `Checking this habit earns ${XP.attention} XP once per day.`,
        'Either counts. Reading or meditation, your choice, and you can switch between them day to day.',
        'It has to be continuous. Ten minutes broken into three pieces trains something different from ten minutes held.',
      ],
      notes: 'Reading means sustained prose — a book, a long article, a paper. Scrolling a feed, however long you do it for, is the thing this habit exists to counteract.',
    },
    optimize: [
      {
        title: 'Extend gradually, like the flow ramp',
        body: 'Ten minutes is the requirement. If it becomes genuinely easy, add two or three minutes at a time rather than doubling it. Attention endurance builds the same way physical endurance does, and overreaching produces abandoned sessions.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Put the phone in another room, not on the table',
        body: 'The same rule as flow sessions, for the same reason: you are removing the option, not resisting it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Anchor it to something you already do',
        body: 'Right after coffee, on the train, immediately before bed. An existing routine is a far more reliable cue than an intention to find ten minutes at some point.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Read paper if screens pull you away',
        body: 'A physical book has no notifications and no other tabs. If your reading sessions keep dissolving into something else, the device is often the reason rather than your attention.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep the meditation simple',
        body: 'Attention on the breath, notice when it has wandered, bring it back. That is the whole instruction. You do not need an app, a technique, or a tradition to get the training effect.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Reduce compulsive scrolling in general',
        body: 'This is not a requirement of the challenge, but the two habits pull against each other. Removing the most reflexive app from your home screen, or logging out of it, costs nothing and makes the ten minutes easier.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Distraction-free walks',
        body: 'A walk with no phone, no podcast and no music. Plausibly a form of the same training, and it doubles as mental recovery. The evidence for it as attention training specifically is thin, but the cost is zero.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Deliberate boredom',
        body: 'Sitting with nothing to do — queueing, waiting, travelling — instead of reflexively filling it. The idea is that tolerating understimulation reduces the pull of constant novelty. It is an appealing argument with weak supporting evidence, so treat it as an experiment on yourself rather than a technique with a known effect.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Read something slightly too hard',
        body: 'Material that requires rereading demands more sustained attention than material that goes down easily. Same principle as challenge–skill balance in flow work: a little resistance is where the training is.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Note where your attention actually goes',
        body: 'During meditation, make a mental note of what pulls you away — a specific worry, a task, a conversation. Over a fortnight the pattern is often obvious and frequently actionable. Several of those will turn out to belong in your Stress Off-Switch.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Treating a wandering mind as failure', body: 'Attention wandering is not the problem; it is the raw material. If your mind never wandered there would be nothing to train.' },
      { title: 'Counting scrolling as reading', body: 'Thirty minutes of feed is not a longer version of ten minutes of reading. It is practice at switching, which is the opposite habit.' },
      { title: 'Doing it with the phone face-down beside you', body: 'Face-down still leaves the decision available every thirty seconds. Another room.' },
      { title: 'Starting at thirty minutes', body: 'An ambitious first session that gets abandoned at minute six teaches you that you cannot do this. Ten minutes, held, is worth more.' },
      { title: 'Multitasking the session', body: 'Reading with a podcast on, or meditating while mentally planning the day, is two streams of attention. The single stream is the entire point.' },
    ],
    examples: [
      {
        label: 'Student day',
        lines: [
          '07:45 — Ten minutes of reading with breakfast. Phone charging in the bedroom, book on the table.',
          'Or: ten minutes on the bus with headphones in and nothing playing, attention on the breath.',
          'On a heavy day, do it at 22:30 instead as part of the wind-down — it folds neatly into the sleep habit.',
        ],
      },
      {
        label: 'Working day',
        lines: [
          '08:20 — Ten minutes of a book before you open your laptop. The crucial detail is before, not after.',
          'Or: ten minutes at lunch, away from the desk, no screen.',
          'By the second week, if ten minutes has become easy, go to twelve. Not twenty-five.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────── 5. Physical energy
  energy: {
    id: 'energy',
    title: 'Physical Energy',
    icon: '⚡',
    tagline: 'Cognitive work runs on a body. Fuel it.',
    quickStart: [
      'Move today — a training session or a decent walk, whichever fits.',
      'Eat real meals with protein in each one, and do not skip lunch on a hard day.',
      'Drink water through the day rather than catching up at 5pm.',
    ],
    why: {
      blurb: 'Demanding mental work is harder on a body that is under-fuelled, under-moved and dehydrated. This habit is deliberately broad: movement, adequate food and fluid, every day. No tracking, no targets to hit.',
      points: [
        'Even mild dehydration is reliably associated with worse concentration, more fatigue and worse mood. It is also the easiest of these to fix.',
        'Glucose is the brain\'s main fuel, and skipped meals on a demanding day tend to show up as exactly the mid-afternoon flatness people blame on their focus.',
        'Protein across the day supports satiety and maintains muscle, especially alongside training. Spread across meals rather than concentrated in one is the easier version to actually do.',
        'Regular exercise has well-established effects on mood, sleep quality and cardiovascular health. The more modest and honest claim about same-day cognition is that moving tends to make the rest of the day feel better; that alone is worth the time.',
        'Vitamins and minerals participate in energy metabolism, and a varied diet of real food covers them without anyone counting milligrams.',
      ],
    },
    how: {
      requirement: 'Move your body, eat adequately, and stay hydrated. Your judgement on all three.',
      earns: [
        `Checking this habit earns ${XP.energy} XP once per day.`,
        'All three parts, your honest call. A 40-minute walk and three real meals is a complete day here; so is a hard gym session.',
        'There is no step target, calorie target or water target to hit. Deliberately — this is a habit, not a tracking exercise.',
      ],
      notes: 'Adapt all of this to your own health, training and circumstances. If you have a medical condition, an eating disorder history, or are under a doctor\'s or dietitian\'s care, their guidance takes priority over anything here.',
    },
    optimize: [
      {
        title: 'Drink before you are thirsty',
        body: 'A glass on waking and a bottle on your desk does most of the work. Thirst lags, so by the time you notice it you have usually already lost a bit of concentration to it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Protein in every meal',
        body: 'Rather than a daily total to hit, aim for a real portion at each meal. It is simpler to execute, and distributing protein through the day is at least as good as concentrating it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Do not skip carbohydrates on hard cognitive days',
        body: 'Low-carbohydrate approaches suit some people well, but a day of demanding work on top of deliberately minimal fuel is a common and avoidable cause of flatness. Eat enough.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Walk, specifically',
        body: 'Walking is the most reliably repeatable movement there is: no equipment, no recovery cost, no scheduling. It also pairs with Mental Recovery, so one walk can serve both habits.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Train earlier if training wrecks your sleep',
        body: 'Hard sessions late at night cost some people their sleep, and sleep is the habit everything else here depends on. If that is you, move the session earlier rather than accepting the trade.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Eat across the food groups over the week',
        body: 'Variety across meat or fish or legumes, dairy or alternatives, leafy greens, other vegetables, fruit, whole grains, nuts and seeds covers the micronutrients that energy metabolism depends on, without you tracking anything.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Keep caffeine away from bedtime',
        body: 'Caffeine takes around five hours to clear half of a dose, and that varies a lot between people. An afternoon coffee is a sleep problem for many, and sleep is worth more here than the alertness you borrowed.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Creatine, 3–5 g per day',
        body: 'One of the best-supported supplements for strength and power, and safe in healthy people over long periods. Effects on cognition are a different and much weaker story: some signal in sleep-deprived or stressed conditions, little in well-rested healthy adults. Reasonable to take if you train; do not expect a focus benefit.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Magnesium-rich foods',
        body: 'Nuts, seeds, legumes, whole grains and leafy greens. Deficiency is genuinely associated with fatigue, but supplementing above sufficiency has little evidence behind it for energy or focus in healthy people. Food first.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Omega-3-rich foods',
        body: 'Oily fish two or three times a week, or walnuts, flax and chia. The food-based case is reasonable; supplement evidence for cognition in healthy young adults is weak and inconsistent.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Recovery nutrition around hard training',
        body: 'Protein and carbohydrate within a few hours of a hard session supports recovery. The narrow "anabolic window" framing has not held up well — total daily intake matters considerably more than precise timing.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'What supplements can and cannot do',
        body: 'Supplements correct deficiencies and add a few percent at the margins. They do not substitute for sleep, food or training, and the ones marketed hardest for energy and focus are generally the ones with the weakest evidence. Nothing in this challenge requires any supplement.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    mistakes: [
      { title: 'Working through lunch on your hardest day', body: 'The day you most need fuel is the day it is most tempting to skip it. This is one of the most common self-inflicted afternoon crashes there is.' },
      { title: 'Using caffeine to replace sleep', body: 'It borrows alertness and charges interest. On top of a short night it tends to make the afternoon worse, not better.' },
      { title: 'Treating supplements as the lever', body: 'Optimising a supplement stack while sleeping six hours is working on the smallest variable available.' },
      { title: 'Training so hard it costs the rest of the challenge', body: 'This is a focus challenge. If your training is leaving you too wrecked to do deep work, it is competing with the thing you came for.' },
      { title: 'All-or-nothing movement', body: 'No time for a full session is not a reason to do nothing. A twenty-minute walk is a complete version of this habit.' },
    ],
    examples: [
      {
        label: 'Student day',
        lines: [
          '07:40 — Glass of water on waking. Breakfast with eggs or yoghurt, not just toast.',
          '12:30 — Actual lunch, away from the desk. Protein, carbohydrate, something green.',
          '17:00 — Gym, or a 30-minute walk if the day has gone sideways. Either counts.',
          'Water bottle in your bag and refilled between lectures, so hydration is not a 9pm catch-up.',
        ],
      },
      {
        label: 'Working day',
        lines: [
          '07:00 — Water, then breakfast with protein in it.',
          '08:00 — Train before work if that is your slot; otherwise walk at lunch and train in the evening.',
          '12:45 — Leave the building for lunch. The walk there counts toward movement and doubles as a recovery break.',
          'No coffee after about 14:00 if you are in bed at 23:00 — the sleep habit is worth more than the afternoon cup.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── 6. Mental recovery
  recovery: {
    id: 'recovery',
    title: 'Mental Recovery',
    icon: '🌿',
    tagline: 'Recovery is part of the work, not a reward for it.',
    quickStart: [
      `${RECOVERY_MINUTES.suggested} minutes of genuinely restorative downtime today.`,
      'No screens, no feeds, no "productive" podcast. Something that actually rests you.',
      'Take it between your flow sessions, not after everything is finished.',
    ],
    why: {
      blurb: 'Sustained demanding work produces real fatigue, and fatigue degrades exactly the capacities this challenge is trying to build. Recovery is what makes tomorrow\'s sessions possible.',
      points: [
        'Prolonged mental effort reliably produces subjective fatigue and a measurable drop in performance on demanding tasks. Pushing through it does not remove the fatigue; it defers it.',
        'Short breaks during a work day have modest but consistent benefits for fatigue and vigour. The effect is not dramatic, which is why breaks need to be scheduled rather than earned.',
        'Time in natural settings is associated with improved mood and attention. Effect sizes are modest and the literature is mixed, but a walk outside is cheap and the downside is nothing.',
        'A break only restores you if it is genuinely different from the work. Moving from a hard document to a fast-scrolling feed changes the content, not the demand.',
      ],
    },
    how: {
      requirement: `Take intentional breaks during the day, including at least ${RECOVERY_MINUTES.suggested} minutes of genuinely restorative downtime.`,
      earns: [
        `Checking this habit earns ${XP.recovery} XP once per day.`,
        `The ${RECOVERY_MINUTES.suggested} minutes can be one block or split across the day, as long as it is real rest rather than a different kind of stimulation.`,
        'You judge what counts as restorative for you. Be honest about it — the habit is worthless if you check it for twenty minutes of scrolling.',
      ],
      notes: 'This is a required habit with its own XP. Resting is not something you are getting away with here; it is on the list.',
    },
    optimize: [
      {
        title: 'Get outside and leave the phone',
        body: 'A short walk outdoors with no phone is the highest-value version of this for most people: it is movement, it is a change of environment, and there is nothing competing for your attention.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Put a break between flow sessions',
        body: 'Back-to-back deep sessions borrow from the second one. A real break in between is what makes two good sessions possible instead of one good one and one mediocre one.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Change the demand, not just the content',
        body: 'Swapping a difficult document for a fast feed keeps your attention working just as hard. Stretching, staring out of a window, tidying something, talking to someone — these change what is being asked of you.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Stand up and move',
        body: 'Light movement in a break — a walk round the building, some stretching — tends to leave people feeling better than sitting still does, and it breaks up a long day of sitting.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Talk to someone, about nothing in particular',
        body: 'Genuine social contact is restorative for most people and strongly associated with wellbeing more broadly. A conversation with a friend is a legitimate recovery break, not time off from the challenge.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Schedule it like the work',
        body: 'Breaks that happen when you happen to feel like one happen late or not at all. Put them in the day with the flow sessions.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Naps, with care',
        body: 'A short nap of roughly ten to twenty minutes is well supported for alertness without much grogginess. Longer or later naps can cost you the night, and sleep is the keystone here — so keep them short and keep them early.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Non-sleep deep rest and similar protocols',
        body: 'Lying down with a guided relaxation or body-scan recording. People commonly report it as restorative, and the acute relaxation effects of such practices are plausible, but the specific branded protocols have little direct evidence. Try it; do not treat it as established.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Protect one genuinely unproductive hour',
        body: 'An hour a day with no optimisation attached to it at all — not reading something improving, not a productive podcast. Hard for people who are drawn to a challenge like this, and often the most valuable thing on the list.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Treating rest as a reward for finishing', body: 'Rest taken only after everything is done is rest that mostly does not happen. It belongs in the middle of the day, not at the end of the list.' },
      { title: 'Calling a feed a break', body: 'Scrolling is low-effort and high-stimulation. It feels like a break and tends not to leave you restored.' },
      { title: 'Feeling guilty throughout the break', body: 'Twenty minutes spent resting while thinking about not working is neither rest nor work. It is a required habit — spend it without the commentary.' },
      { title: 'Optimising the recovery', body: 'Turning a break into another protocol to execute defeats the purpose. Sometimes sitting outside doing nothing is the whole technique.' },
      { title: 'Skipping recovery to get ahead', body: 'This is the trade the challenge is built to prevent. Recovery has its own XP precisely so that cutting it costs you rather than paying you.' },
    ],
    examples: [
      {
        label: 'Student day',
        lines: [
          '10:00 — Between the two flow sessions, leave the library. Ten minutes outside, no phone.',
          '15:30 — Twenty minutes in the park on the way home, or coffee with someone, properly away from work.',
          'Evening — Not more study. The day\'s work is done; this is the part that makes tomorrow possible.',
        ],
      },
      {
        label: 'Working day',
        lines: [
          '09:45 — Session one ends. Stand up, walk to make tea, do not open your phone. Ten minutes.',
          '12:45 — Lunch away from the desk, outside if the weather allows.',
          '16:00 — The dead-feeling part of the afternoon: a ten-minute walk round the block instead of pushing through it.',
          'That is twenty-plus minutes of real downtime across the day, none of it taken from sleep.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────── 7. Stress off-switch
  stress: {
    id: 'stress',
    title: 'Stress Off-Switch',
    icon: '🔌',
    tagline: 'End the day deliberately, so it stops following you.',
    quickStart: [
      `A ${SHUTDOWN_MINUTES.suggested}-minute shutdown ritual at the end of your working day.`,
      'Write down what is unfinished and when you will deal with it. Then close the laptop.',
      'Say the same closing line every night. It sounds silly and it works.',
    ],
    why: {
      blurb: 'Work does not end when you stop working — it ends when your mind stops rehearsing it. A short, repeatable shutdown gives the day an actual boundary.',
      points: [
        'Acute stress is a normal, useful response that resolves when the demand passes. The problem is chronic activation: a stress response that never fully switches off, which is associated with worse sleep, mood and health over time.',
        'Unfinished tasks tend to intrude on your attention afterwards. Research on this effect found that making a specific plan for how to finish something substantially reduces those intrusions — you do not have to complete it, you have to plan it.',
        'Slow breathing at around five or six breaths per minute shifts autonomic balance and reliably produces acute calming. It is the fastest tool here and costs nothing.',
        'Rumination — turning the same problem over without moving toward action — predicts worse mood and worse sleep. Separating what you can control from what you cannot is a direct counter to it.',
        'Meaningful relationships and a sense of purpose are among the most consistent correlates of resilience and wellbeing. They are also the first things a demanding fortnight tends to crowd out.',
      ],
    },
    how: {
      requirement: `Complete a ${SHUTDOWN_MINUTES.suggested}-minute shutdown ritual at the end of your working day.`,
      earns: [
        `Checking this habit earns ${XP.stress} XP once per day.`,
        'Five minutes is the whole requirement. It is the shortest habit in the challenge and one of the most load-bearing.',
        'Any form counts: writing the loose ends down, slow breathing, journalling, a short walk that marks the transition.',
      ],
      notes: 'The point is a boundary, not a technique. Pick one sequence and repeat it — a ritual that changes every night is not a ritual.',
    },
    optimize: [
      {
        title: 'Write the unfinished things down with a plan',
        body: 'Not just a list — a line each about when and how you will deal with it. This is the specific move shown to reduce intrusive thoughts about unfinished work, and it is why a shutdown ritual works better than simply deciding to stop thinking about it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Breathe slowly, with a longer exhale',
        body: 'Around five or six breaths a minute, exhale longer than the inhale, for two or three minutes. Comfortable, not forced — if you feel dizzy or breathless, stop and breathe normally. The acute calming effect is well supported.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Separate what you control from what you do not',
        body: 'Two columns. For the controllable column, write the next action. For the other, the honest answer is that worrying is not a contribution. This is the most direct thing you can do about rumination.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Use a physical transition',
        body: 'The walk home, a shower, changing clothes, shutting the laptop in a drawer. A body-level boundary does work that a mental intention to stop does not, particularly if you work where you live.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep the same closing phrase',
        body: 'Literally saying something like "shutdown complete" at the end of the sequence gives it a definite end. It is self-conscious for about three days and then it becomes a genuine cue.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Journal when something is actually sitting on you',
        body: 'Writing about what you are thinking and feeling has a modest but real literature behind it for processing difficult material. Not required nightly — useful on the nights the shutdown does not take.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Cyclic sighing and other structured breathing',
        body: 'A pattern of double inhales with long exhales. One small randomised trial found daily practice improved mood and reduced breathing rate more than mindfulness meditation over a month. Promising, but it is one small study — treat it as worth trying, not as established.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'A worry window',
        body: 'A fixed fifteen minutes earlier in the day for deliberately turning over what is bothering you, so that it has somewhere to go other than bedtime. Used in therapeutic practice for rumination; the evidence base for the standalone technique is modest.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Protect the relationships and the reasons',
        body: 'Fourteen days of focused work makes it easy to let people and everything non-instrumental slide. Social connection and a sense of purpose are among the most robust predictors of resilience there are, so keep at least one evening in the fortnight genuinely for someone else.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Name the intrusion when it comes back',
        body: 'When work thoughts arrive after shutdown, note it in one word and return to what you were doing — the same move as in attention training. Over a fortnight the pattern of what comes back is usually informative.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Treating "stop working" as the ritual', body: 'Closing the laptop while still turning the day over is not a boundary. The writing-down is the part that does the work.' },
      { title: 'A different ritual every night', body: 'The value is in the repetition. Five identical minutes beat fifteen improvised ones.' },
      { title: 'Doing it in bed', body: 'Reviewing the day once you are already lying down tends to turn into rumination and pushes the sleep habit later. Do it at the end of the work day, not the end of the evening.' },
      { title: 'Confusing the off-switch with the wind-down', body: 'This habit ends work. The wind-down in Sleep Optimization prepares for sleep. They are different jobs at different times of the evening.' },
      { title: 'Skipping it on the worst days', body: 'The day you most want to keep working through is the day the boundary matters most. It is five minutes.' },
    ],
    examples: [
      {
        label: 'Student day',
        lines: [
          '18:00 — Study is over for the day. Two minutes writing what is unfinished and when it happens tomorrow — that becomes tomorrow\'s mission.',
          '18:03 — Two minutes of slow breathing, or the walk back from the library with nothing playing.',
          '18:05 — "Done." Books shut, bag packed. The evening is genuinely yours, including the guilt-free part.',
        ],
      },
      {
        label: 'Working day',
        lines: [
          '17:25 — Five-minute shutdown. Loose ends written with a when-and-how for each. Tomorrow\'s three priorities drafted.',
          '17:29 — Laptop closed and put away, not left open on the table.',
          '17:30 — "Shutdown complete." Change out of work clothes if you work from home; it is a surprisingly effective boundary.',
          'If work thoughts come back at 21:00: one word on the notepad, back to the evening.',
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────── 8. Sleep
  sleep: {
    id: 'sleep',
    title: 'Sleep Optimization',
    icon: '😴',
    tagline: 'The habit that makes the other seven possible.',
    quickStart: [
      `Protect ${SLEEP_OPPORTUNITY.suggested} hours of sleep opportunity tonight — time in bed, not time asleep.`,
      'Pick one wake time and hold it, including at the weekend.',
      'Get outside in the morning light, and dim everything in the last hour.',
    ],
    why: {
      blurb: 'This is the highest-XP habit in LOCK IN, deliberately. Sleep is the input every other habit here depends on, and it is the one nothing else compensates for.',
      points: [
        'Sleep restriction produces clear, repeatable decrements in attention, vigilance and mood. Of everything in this challenge, this is the variable with the most consistent effect on cognitive performance.',
        'Your sleep timing is governed by an internal clock that is set largely by light. Bright light in the morning and dim light in the evening are the main everyday levers you have on it.',
        'A consistent wake time anchors that clock more reliably than a consistent bedtime does, because you control when you get up and you do not control when you fall asleep.',
        'Caffeine has a half-life of roughly five hours, varying widely between individuals, and can disrupt sleep even when taken many hours before bed.',
        'Cool, dark and quiet are the conditions most consistently associated with better sleep. They are also the cheapest things on this list to change.',
      ],
    },
    how: {
      requirement: `Protect an adequate sleep opportunity — around ${SLEEP_OPPORTUNITY.suggested} hours in bed — and keep a reasonably consistent sleep schedule.`,
      earns: [
        `Checking this habit earns ${XP.sleep} XP once per day — the most of any habit in the challenge.`,
        'The requirement is the OPPORTUNITY you gave yourself, not the sleep you got. If you were in bed with the lights off for the window you planned, the habit is met.',
        'Woke at 3am and could not get back to sleep? The habit is still met. You are not penalised for anything you did not choose.',
      ],
      notes: `No part of this challenge can be improved by sleeping less. Sleep carries the highest XP, there is no bonus that outweighs it, and planned lighter days reduce work volume rather than sleep. Trading sleep for more work is always a net loss here — by design.`,
    },
    optimize: [
      {
        title: 'Fix the wake time first',
        body: 'Pick one time, hold it every day including weekends, and let the bedtime follow. It is the single most repeatable thing on this list and it anchors everything else.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Get outdoor light in the morning',
        body: 'Ten minutes or so outside, reasonably soon after waking. Outdoor light is far brighter than indoor light even under cloud, and through a window is much weaker than outside. Combine it with something you already do.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Make the bedroom cool, dark and quiet',
        body: 'Cooler than feels obvious, dark enough that you cannot read, quiet or consistently masked. Blackout curtains, an eye mask and earplugs are unglamorous and effective.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Move your caffeine cutoff earlier than feels necessary',
        body: 'With a half-life around five hours, a 15:00 coffee still has a meaningful amount on board at bedtime, and sensitivity varies a lot. If you suspect caffeine is costing you sleep, it probably is.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Dim the last hour',
        body: 'Overhead lights off, lamps on, screens down. Bright light in the evening pushes your clock later, which makes an early wake time harder the next morning.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Use warm or red-toned lighting in the evening',
        body: 'Warm-toned, low lamps rather than bright white overheads. A reasonable, low-cost application of the same principle as dimming — it is the overall brightness that matters most, with colour a secondary factor.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep a short, boring wind-down',
        body: 'The same handful of steps in the same order every night, with falling stimulation. Boring is the mechanism, not a shortcoming.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep alcohol away from bedtime',
        body: 'Alcohol makes people fall asleep faster and reliably worsens sleep quality in the second half of the night. A nightcap is one of the more common hidden causes of a bad night.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Red-tinted blue-light-blocking glasses',
        body: 'For evenings where screens or bright lights are genuinely unavoidable. Several small trials report better sleep outcomes with amber or red-tinted lenses, but the literature is limited and inconsistent, and clear "blue-light" computer glasses have performed poorly in trials. Reasonable as a backstop when you cannot control the light; not a substitute for dimming it.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Magnesium',
        body: 'Studies are small, often in older adults or people who were deficient, and results are inconsistent. Correcting a genuine shortfall plausibly helps; there is little to suggest extra magnesium improves sleep in someone already getting enough. Food sources first.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Glycine',
        body: 'A few small studies, mostly in Japan and some industry-linked, report better subjective sleep quality with around three grams before bed. Interesting and low-risk, but the evidence base is thin — file it under worth-an-experiment rather than recommended.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'A hot shower or bath before bed',
        body: 'Warming the skin and then cooling helps core temperature fall, which is part of normal sleep onset. Reasonably supported, modest effect, and pleasant regardless.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Get out of bed if you are awake and frustrated',
        body: 'Lying awake for a long stretch teaches an association between bed and being awake. Getting up, doing something dull in dim light, and returning when sleepy is the core move in the best-supported treatment for insomnia.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    mistakes: [
      { title: 'Borrowing from sleep to finish the day\'s work', body: 'The most expensive trade available to you during this challenge, and the one the XP ladder is built to make unattractive. You will pay for it in tomorrow\'s flow sessions.' },
      { title: 'Sleeping in at the weekend to catch up', body: 'A two-hour lie-in on Saturday shifts your clock and makes Monday harder. Hold the wake time; nap earlier in the day if you need to.' },
      { title: 'Chasing a sleep score', body: 'Anxiety about your tracker\'s numbers is itself a sleep problem. The habit here is the opportunity you protected, which you can control.' },
      { title: 'Blaming yourself for a bad night', body: 'Awakenings happen, and sleep disorders are common and real. Nothing in this habit penalises them — it asks only for the window.' },
      { title: 'Scrolling in bed', body: 'The content is usually a bigger problem than the light. A stimulating feed is a poor last thing before sleep regardless of what colour the screen is.' },
      { title: 'Treating sleep as the leftover time', body: 'If bedtime is whatever is left after everything else, it will always be too late. Work backwards from your wake time instead.' },
    ],
    examples: [
      {
        label: 'Student day',
        lines: [
          '07:30 — Same wake time every day of the challenge, lectures or not.',
          '07:45 — Outside for ten minutes: walk to get coffee, or just stand in the daylight.',
          '14:00 — Last caffeine of the day.',
          '22:30 — Overhead lights off, lamps on. Phone charging in another room. Ten minutes of reading — which is also the Attention Training habit.',
          '23:15 — Lights out. That is a protected eight-hour window before a 07:30 wake.',
        ],
      },
      {
        label: 'Working day',
        lines: [
          '06:45 — Fixed wake time, alarm across the room.',
          '07:00 — Daylight, outdoors, while the coffee brews.',
          '13:30 — Caffeine cutoff, moved earlier after you noticed the 16:00 coffee was costing you.',
          '21:45 — Lamps only. Shower. Laptop already shut and put away at the shutdown ritual.',
          '22:30 — In bed, lights out, for a 06:45 wake. If you are still awake at 23:15 and frustrated, get up, sit in dim light, come back when sleepy.',
        ],
      },
    ],
  },
};

/** Guide ids in the order they are taught (matching the habit numbering). */
export const GUIDE_ORDER = ['mission', 'flow', 'execute', 'attention', 'energy', 'recovery', 'stress', 'sleep'];

/**
 * The namespace these guides are registered under in habitGuides.js.
 *
 * Tasks store the namespaced id, because two challenges may both have a guide
 * called "sleep" without meaning the same thing by it. Built here rather than
 * imported from the registry, which imports this module.
 */
export const GUIDE_SOURCE = 'lockin';

/** The namespaced guide id a task stores for one of these guides. */
export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

/** A guide by its local id, or null. */
export function guide(id) {
  return GUIDES[id] || null;
}

// ── The eight daily habits ─────────────────────────────────────────────────
/**
 * Habit definitions. Each one carries the `guideId` of its strategy guide, so
 * the daily task row can open the guide without the UI knowing anything about
 * LOCK IN specifically.
 *
 * On habit keys: Flow Training, Execute, Attention Training, Physical Energy,
 * Mental Recovery and the off-switch get keys of their own rather than reusing
 * Forge's existing ones, because they are UNIONS of behaviours (reading OR
 * meditation; movement AND food AND fluid). Merging them with a single-behaviour
 * habit from another challenge would let one check satisfy a requirement it does
 * not actually cover. Sleep is a genuine match for SLEEP_TARGET and merges
 * normally; the shutdown ritual is a genuine match for STRESS_RECOVERY.
 */
export const DAILY_HABITS = [
  {
    id: 'li_sleep', habitKey: HABIT_KEYS.SLEEP_TARGET, guideId: guideRef('sleep'),
    icon: '😴', color: '#A78BFA', xp: XP.sleep, keystone: 3, keystoneHabit: true,
    build: (s) => ({
      name: `Sleep opportunity: ${s.sleepHours}+ hours`,
      target: { value: s.sleepHours, unit: 'hours', direction: 'atLeast' },
      desc: 'Time in bed and a consistent wake time. The opportunity is what counts — not whether every hour was perfect.',
    }),
  },
  {
    id: 'li_flow', habitKey: HABIT_KEYS.FLOW_SESSION, guideId: guideRef('flow'),
    icon: '🌊', color: '#60A5FA', xp: XP.flow, keystone: 3, keystoneHabit: true,
    build: () => ({
      name: 'Flow training: 2 focused sessions',
      desc: `Session length ramps across the challenge: ${FLOW_STAGES.map(s => `${s.minutes}`).join(' → ')} minutes. Today's target is in the LOCK IN panel.`,
    }),
  },
  {
    id: 'li_execute', habitKey: HABIT_KEYS.PRIORITY_EXECUTION, guideId: guideRef('execute'),
    icon: '✅', color: '#10B981', xp: XP.execute, keystone: 3, keystoneHabit: true,
    build: () => ({
      name: `Execute ${PRIORITY_COUNT.mustComplete} of ${PRIORITY_COUNT.total} priorities`,
      desc: 'Finished, against the completion criteria you wrote this morning. Output, not hours.',
    }),
  },
  {
    id: 'li_mission', habitKey: HABIT_KEYS.DAILY_MISSION, guideId: guideRef('mission'),
    icon: '🗂️', color: '#F59E0B', xp: XP.mission, keystone: 2,
    build: () => ({
      name: `Daily mission: ${PRIORITY_COUNT.total} priorities`,
      desc: 'Three meaningful priorities, each with a clear definition of done, and the hardest one time-blocked.',
    }),
  },
  {
    id: 'li_energy', habitKey: HABIT_KEYS.PHYSICAL_ENERGY, guideId: guideRef('energy'),
    icon: '⚡', color: '#FBBF24', xp: XP.energy, keystone: 2,
    build: () => ({
      name: 'Physical energy: move, eat, hydrate',
      desc: 'Daily movement, adequate food with protein in each meal, and water through the day. Nothing to track.',
    }),
  },
  {
    id: 'li_attention', habitKey: HABIT_KEYS.ATTENTION_TRAINING, guideId: guideRef('attention'),
    icon: '🧘', color: '#34D399', xp: XP.attention, keystone: 2,
    build: (s) => ({
      name: `Attention training: ${s.attentionMinutes}+ minutes`,
      target: { value: s.attentionMinutes, unit: 'minutes', direction: 'atLeast' },
      desc: 'Reading or meditation, one unbroken stretch, phone in another room.',
    }),
  },
  {
    id: 'li_recovery', habitKey: HABIT_KEYS.MENTAL_RECOVERY, guideId: guideRef('recovery'),
    icon: '🌿', color: '#6BCB77', xp: XP.recovery, keystone: 1,
    build: (s) => ({
      name: `Mental recovery: ${s.recoveryMinutes}+ minutes`,
      target: { value: s.recoveryMinutes, unit: 'minutes', direction: 'atLeast' },
      desc: 'Genuinely restorative downtime. A feed is not a break — and this is a required habit, not a reward.',
    }),
  },
  {
    id: 'li_stress', habitKey: HABIT_KEYS.STRESS_RECOVERY, guideId: guideRef('stress'),
    icon: '🔌', color: '#818CF8', xp: XP.stress, keystone: 1,
    build: (s) => ({
      name: `Stress off-switch: ${s.shutdownMinutes} minutes`,
      target: { value: s.shutdownMinutes, unit: 'minutes', direction: 'atLeast' },
      desc: 'A short, repeated shutdown ritual that ends the working day: loose ends written down, then closed.',
    }),
  },
  {
    id: 'daily_log', habitKey: HABIT_KEYS.DAILY_LOG, guideId: null,
    icon: '📊', color: '#8B9DC3', xp: XP.dailyLog, keystone: 0,
    build: () => ({
      name: 'Complete Daily Log',
      desc: 'Your ratings for the day — the record of how the fortnight actually went.',
    }),
  },
];

/** Setup defaults. Every value is pre-filled so the challenge starts in one tap. */
export function defaultSetup() {
  return {
    durationDays: DURATION_DAYS,
    sleepHours: SLEEP_OPPORTUNITY.suggested,
    attentionMinutes: ATTENTION_MINUTES.suggested,
    recoveryMinutes: RECOVERY_MINUTES.suggested,
    shutdownMinutes: SHUTDOWN_MINUTES.suggested,
  };
}

/** The daily task list for an attempt. */
export function buildStartTasks(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  return DAILY_HABITS.map((h, i) => {
    const { build, ...rest } = h;
    return { ...rest, ...build(s), order: i };
  });
}

/** Total XP available from the daily habits (excluding the completion bonus). */
export function dailyXPTotal(setup = defaultSetup()) {
  return buildStartTasks(setup).reduce((sum, t) => sum + (t.xp || 0), 0);
}

/** The challenge-attempt metadata written by the setup flow. */
export function buildChallengeMeta(setup = defaultSetup()) {
  const s = { ...defaultSetup(), ...setup };
  return {
    templateId: LOCK_IN_TEMPLATE_ID,
    name: IDENTITY.name,
    emoji: IDENTITY.emoji,
    subtitle: IDENTITY.subtitle,
    variant: 'standard',
    durationDays: DURATION_DAYS,
    templateVersion: 1,
    completionBonusXP: COMPLETION_BONUS_XP,
    // The attempt's own copy of its configuration, so later edits to this file
    // never rewrite a running challenge.
    lockIn: {
      durationDays: DURATION_DAYS,
      sleepHours: s.sleepHours,
      attentionMinutes: s.attentionMinutes,
      recoveryMinutes: s.recoveryMinutes,
      shutdownMinutes: s.shutdownMinutes,
      flowStages: FLOW_STAGES,
      lighterDays: LIGHTER_DAYS,
    },
  };
}

/** The LOCK IN config block of an attempt, or null. */
export function lockInConfig(meta) {
  return meta?.templateId === LOCK_IN_TEMPLATE_ID ? (meta.lockIn || null) : null;
}

/** True when this attempt is a LOCK IN attempt. */
export function isLockIn(meta) {
  return meta?.templateId === LOCK_IN_TEMPLATE_ID;
}

// ── Completion ─────────────────────────────────────────────────────────────
export const COMPLETION_MESSAGE = {
  title: 'LOCK IN complete',
  body: 'Fourteen days of planned priorities, protected focus, real recovery and defended sleep. You trained focus from 25 minutes to 50 and you did it without borrowing from the night — which is the part most people get wrong.',
  next: 'The habits underneath this — sleep, attention, recovery — are the foundation under every other challenge in Forge. Whatever you run next, they carry over.',
};
