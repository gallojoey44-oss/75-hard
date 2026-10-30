import { EVIDENCE } from './evidence';

/**
 * Mental Training Phase — strategy guides.
 *
 * Same shape and the same two rules as the Fat Loss guides: `how.requirement`
 * restates the rule the challenge already enforces, and every figure that
 * differs between Beginner, Standard and Hard Mode points at the number on the
 * habit row rather than naming one — reading is 2, 5 or 10 pages, the focus
 * block is 30, 60 or 90 minutes, and the row knows which.
 *
 * Two of this challenge's habits have no guide on purpose:
 *
 *  • `mt_mind` — "Mental Training — 2 / 5 / 10 minutes" has never been defined
 *    anywhere except the challenge's rationale copy, which names breathwork,
 *    meditation or prayer. A guide's "How to complete it" IS the rule, so
 *    writing one would settle a question the audit has put to the user.
 *  • `mt_prayer` — the description says it plainly and respectfully. Optimizing
 *    somebody's prayer, with evidence tags, is not Forge's business.
 */

export const GUIDE_SOURCE = 'mental';

export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

export const GUIDES = {
  // ─────────────────────────────────────────────────── 0. Mental training
  // Offered only to attempts on habit rules version 2 — see data/habitRules.js.
  // Version 1 attempts were started when the only statement of this habit's
  // scope was the challenge's rationale copy, naming breathwork, meditation or
  // prayer; they keep that, and they are not offered this.
  mind: {
    id: 'mind',
    title: 'Mental Training',
    icon: '🧘',
    tagline: 'A few focused minutes of deliberate mental practice. Sitting quietly counts.',
    quickStart: [
      'Check the length on the habit row — 2, 5 or 10 minutes, depending on your mode.',
      'Pick one practice and keep it for the challenge. Switching methods every day is how people conclude they cannot do this.',
      'Sit somewhere ordinary, set a timer that is not your phone, and start.',
    ],
    why: {
      blurb: 'This is the challenge\'s keystone habit, and it is deliberately short. The point is not to become good at meditating — it is to spend a few minutes every day deliberately directing your attention, which is the capacity every other habit here draws on.',
      points: [
        'Brief, regular practice is better supported than occasional long sessions for the things people actually want from it: attention, and a less reactive baseline.',
        'The length follows your mode, starting at two minutes for a reason. A twenty-minute first session mostly teaches you that you cannot sit for twenty minutes.',
        'The practice does not have to go well. Noticing you have drifted and coming back IS the repetition — it is not the thing interrupting it.',
        'Mental Training has a separate Prayer habit with its own XP. Keeping the two apart is why this habit\'s list of methods does not include prayer.',
      ],
    },
    how: {
      requirement: 'Spend the minutes on the habit row in deliberate mental practice: meditation, mindfulness, breathwork or visualization. The length is on the row and follows your chosen mode.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'Any of the four methods counts in full. There is no hierarchy between them.',
        'A distracted session still counts. The requirement is the minutes, not the quality.',
      ],
      notes: 'Prayer has its own habit in this challenge and its own XP, so one session of prayer does not also satisfy this one. Attempts started before this rule was settled follow the earlier wording, which did include prayer here — those are unchanged, and this guide is not offered to them.',
    },
    optimize: [
      {
        title: 'Same time, same place, every day',
        body: 'The decision that kills this habit is "when shall I do it". Removing that decision is worth more than any technique.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Follow the breath when you have no other plan',
        body: 'Count the exhale to four and start again. It needs no app, no instruction and no belief about what it is doing.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Use a timer that is not your phone',
        body: 'Unlocking the phone to start is what ends most short practices. A kitchen timer removes the whole problem.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep one method for the whole challenge',
        body: 'Trying a different technique every few days means never getting past the awkward first week of any of them.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Try visualization for something specific',
        body: 'Rehearsing a concrete, upcoming thing — a conversation, a lift, a performance — has more support behind it than general visualization does. Keep it specific and keep it short.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Lengthen only after the habit is secure',
        body: 'Two weeks of unbroken short sessions earns the right to make them longer. Lengthening first is the usual route to stopping.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Put it before the hardest part of the day',
        body: 'The state is most useful going into something demanding rather than recovering from it.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Expecting a clear mind', body: 'A wandering mind is the normal condition and the material the practice works on. Coming back is the rep.' },
      { title: 'Grading the session', body: 'Judging whether it went well is the most reliable way to stop doing it. The minutes are the requirement.' },
      { title: 'Starting at ten minutes', body: 'Your mode sets the length for a reason. The ramp is the design, not a limitation.' },
      { title: 'Waiting for a calm moment', body: 'The calm moment does not arrive. The practice is what produces it, not what requires it.' },
    ],
    examples: [
      {
        label: 'Five minutes, first thing',
        lines: [
          '06:50 — before the phone is unlocked, which is the only reliably quiet part of the day.',
          'Kitchen timer for five minutes, sitting on the edge of the bed.',
          'Your mind wanders perhaps thirty times. Each time you notice, you go back to the breath.',
          'Timer goes. Tick the habit.',
        ],
      },
      {
        label: 'Ten minutes, using visualization',
        lines: [
          'There is a difficult conversation tomorrow, so today\'s session has a subject.',
          'Five minutes following the breath to settle, then five rehearsing the conversation concretely — what you open with, what they are likely to say.',
          'Specific rather than general, which is the version with something behind it.',
          'Tick it.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── 1. Focus block
  focus: {
    id: 'focus',
    title: 'Phone-Free Focus Block',
    icon: '🎯',
    tagline: 'One unbroken block. The phone is in another room, not face down.',
    quickStart: [
      'Check the length on the habit row — 30, 60 or 90 minutes, depending on your mode.',
      'Decide the one thing you will do in the block before it starts. Choosing inside the block is how blocks get wasted.',
      'Phone in another room. Not in your pocket, not face down on the desk.',
    ],
    why: {
      blurb: 'This habit trains the thing that makes everything else in the challenge possible: the ability to stay with one task while something easier is available. It is deliberately one block rather than a daily total, because the capacity being trained is continuity.',
      points: [
        'Switching tasks has a real cost in both time and errors. Every interruption means reloading context, and the cost is paid again on the way back.',
        'There is evidence that a phone within reach degrades performance on attention-demanding tasks even when it is never picked up. How large that effect is, is argued about; that distance is cheaper than discipline is not.',
        'The block is uninterrupted on purpose. Sixty minutes assembled from six ten-minute fragments trains the opposite of what this habit is for.',
        'It gets easier quickly, and the first week is the worst of it. The discomfort in the first ten minutes is the habit working, not a sign you are bad at it.',
      ],
    },
    how: {
      requirement: 'Complete one unbroken focus block at today\'s length, with your phone in another room. The length is on the habit row; it is not a total assembled across the day.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'One block of the stated length, on one task, without picking up your phone.',
        'It does not have to have gone well. A block in which you worked badly on the right thing still counts.',
      ],
      notes: 'Interrupted by something real — a child, a phone call you had to take, a fire alarm? Start the block again when you can. A block you abandoned halfway is not a completed block, and marking it as one makes your own record useless to you.',
    },
    optimize: [
      {
        title: 'Put the phone in a different room, every time',
        body: 'Face down on the desk is still within reach, and within reach is the condition under study. Another room turns a reflex into a decision you would have to stand up for, which is worth doing whatever the size of the effect turns out to be.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Decide the task before the block opens',
        body: 'Write one sentence: what you will have done when the block ends. A block that opens with "right, what shall I do" has already lost ten minutes to the easiest available thing.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Run the same two-minute ritual to start',
        body: 'Water, one tab, notebook open, timer started. Repeated enough, the ritual starts the work for you and starting stops being a decision.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep a capture sheet beside you',
        body: 'Every "I must remember to…" goes on paper, not into a browser tab. Writing it down discharges it without leaving the block.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Book it at the same time every day',
        body: 'A standing block defends itself. One that moves around the day has to be rescheduled daily, and rescheduling is where it quietly disappears.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Close the block by writing the next first step',
        body: 'The last thirty seconds go on one line about where to pick up. It makes tomorrow\'s block start without a warm-up, and it is the cheapest improvement available here.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Use a visible timer rather than a phone timer',
        body: 'A kitchen timer or a desk clock removes the last reason to have the phone nearby. Being able to see the time remaining also stops the clock-checking that a hidden timer encourages.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Work somewhere with no social cost to ignoring people',
        body: 'A library, an empty meeting room, a corner of a café. Much of what interrupts a block at home or in an office is a person, and a person is harder to put in another room than a phone.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Counting a day of scattered focus as the block', body: 'Sixty minutes of work spread across six interruptions is a normal working day. The habit is asking for the thing that is not that.' },
      { title: 'Leaving the phone face down on the desk', body: 'The evidence is about proximity, not about whether you looked at it. If it is within arm\'s reach, you are running the harder version of the habit for no benefit.' },
      { title: 'Picking a task you were never going to start', body: 'A block aimed at the thing you have avoided for a week usually becomes an hour of tidying. Pick the first concrete step of it instead.' },
      { title: 'Making the first week the hard mode', body: 'If 60 minutes is your target and you have never done 20, the first few blocks will feel like proof you cannot do this. Do the block anyway; the discomfort is not information.' },
      { title: 'Treating a bad block as a failed one', body: 'The habit measures that you stayed, not that you produced. Staying for the full length on a day when the work was going badly is the rep that counts most.' },
    ],
    examples: [
      {
        label: 'Student, 60-minute block',
        lines: [
          'The night before: one line in your notes — "block: draft the three body paragraphs of the essay."',
          '09:00 — phone goes in your bag, bag goes in the locker. Laptop open on the document, nothing else.',
          'Timer on the desk, water, one sheet of paper for anything that occurs to you mid-block.',
          '10:00 — the timer goes. Write one line about where to start tomorrow, then take a real break away from the desk. Tick the habit.',
        ],
      },
      {
        label: 'Working from home, 30-minute block',
        lines: [
          '08:30 — before anyone needs you, which is the only reliably quiet half hour of the day.',
          'Phone on the kitchen counter, charging. Door shut. Slack closed, not minimised.',
          'Twice in the half hour you think of something urgent; both go on the paper and neither is actually urgent.',
          '09:00 — done. The habit is ticked and the rest of the day can be as fragmented as it likes.',
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────── 2. Reading
  reading: {
    id: 'reading',
    title: 'Daily Reading',
    icon: '📚',
    tagline: 'A few pages a day, of a book you are actually reading.',
    quickStart: [
      'Check the page count on the habit row — 2, 5 or 10, depending on your mode.',
      'Choose one book and keep it where you will be when you have the time: bedside, bag, kitchen table.',
      'Read the pages at a fixed point in the day rather than "when there is a moment". There is never a moment.',
    ],
    why: {
      blurb: 'The page count is low on purpose. This habit is not about reading a lot — it is about making reading something that happens daily rather than something you intend to do. A target you can hit on your worst day is a target that survives the challenge.',
      points: [
        'Two pages is a floor, not a ceiling. Most days you will read more, and the days you do not are the days the habit earns its keep.',
        'A target small enough to be absurd removes the excuse. "I did not have time to read" stops being true at two pages.',
        'Reading before sleep, away from a screen, is one of the few wind-down activities that is genuinely restful rather than stimulating.',
        'One book at a time finishes books. Four books on the go is a reading list, not a reading habit.',
      ],
    },
    how: {
      requirement: 'Read today\'s page count from a book you are actually reading. The number is on the habit row and comes from your chosen mode.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'Any book counts. Fiction, non-fiction, something you reread every year — Forge has no opinion on what you read.',
        'More pages than the target is fine and earns the same. The habit is daily, not cumulative.',
      ],
      notes: 'A physical book and an ebook both count — the target is pages, and both have them. An audiobook does not satisfy a page target on its own; there is nothing wrong with listening, it simply is not what this habit measures. A listening alternative would need a rule of its own, with its own measure.',
    },
    optimize: [
      {
        title: 'Put the book where the time is',
        body: 'The ten minutes you will actually read in are on the bus, in bed, or waiting for the kettle. A book in the wrong room loses to the phone in your pocket every time.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Attach it to something that already happens',
        body: 'After brushing your teeth, after dinner, on the train. Tying the pages to an existing event is far more reliable than finding time for them.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Read the pages first, then decide whether to continue',
        body: 'The target is the entry fee, not the session. Open the book intending to read exactly two pages and you will usually read fifteen; plan to read for an hour and you will often not open it.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Abandon books you are not reading',
        body: 'A book you are three weeks into and dreading is the main reason this habit stalls. Put it down. The rule says a book you are actually reading, and that is the operative word.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep a second, easier book',
        body: 'Something light for the days when the main one is too much work. The choice is between an easy book and no book, not between an easy book and a serious one.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    advanced: [
      {
        title: 'Write one line about what you read',
        body: 'A single sentence in a notebook, not a summary. Retrieving something immediately after reading it does more for retention than rereading the same pages.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Read on paper in the last hour before bed',
        body: 'If the pages double as your wind-down, paper avoids the screen entirely. Whether screen light itself matters much is argued about; the content on a phone is the part nobody argues about.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Mark the page you are on, not the time you read',
        body: 'Measuring reading in minutes quietly turns it into an obligation. Measuring it in pages keeps the unit the same as the habit\'s.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Choosing an ambitious book to impress yourself', body: 'The 700-page classic you feel you should read is the book that ends the streak on day six. Read the one you want to pick up.' },
      { title: 'Saving it for bedtime and falling asleep', body: 'If the pages consistently happen at the one moment you are least able to read, move them to the morning. Last thing at night is the default, not the best slot.' },
      { title: 'Reading on a phone', body: 'Nothing in the rule forbids it, but it puts the habit on the device every other habit here is trying to get you away from. A reader or paper removes the question.' },
      { title: 'Treating the target as the point', body: 'Two pages is the smallest unit that counts, not the amount you should read. Hitting exactly two pages for thirty days is a completed challenge and a wasted month of reading.' },
      { title: 'Having four books on the go', body: 'Parallel reading feels productive and finishes nothing, and an unfinished book is much easier to stop returning to.' },
    ],
    examples: [
      {
        label: 'Morning, 5 pages',
        lines: [
          'The book lives next to the kettle, because that is where you stand still for four minutes every morning.',
          'Coffee on, book open, five pages before you look at a screen.',
          'Most mornings that becomes eight or ten, because stopping mid-chapter is harder than continuing.',
          'Tick the habit before you open your email, and the day\'s first act was not your inbox.',
        ],
      },
      {
        label: 'A day with nothing left in it, 2 pages',
        lines: [
          '23:10 — you have done everything else and you are too tired to read.',
          'Two pages is two minutes. You read them sitting on the edge of the bed.',
          'You remember roughly none of it, which does not matter — the habit is daily reading, and tonight it was two pages.',
          'Tick it. The streak is intact, and tomorrow you will read properly.',
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────── 3. Gratitude
  gratitude: {
    id: 'gratitude',
    title: 'Daily Gratitude',
    icon: '📝',
    tagline: 'Write down one thing. The writing is the point.',
    quickStart: [
      'One thing, one line, written down — not thought about.',
      'Be specific. "The walk home in the cold" beats "my health" by a distance.',
      'Keep it somewhere boring and permanent: the same notebook, the same note on your phone, every day.',
    ],
    why: {
      blurb: 'Written gratitude is one of the better-supported of the simple interventions, though the effects reported are modest rather than transformative. What evidence there is points at specificity and at the writing, not at volume: one concrete line is doing the work, and a list of ten abstractions is not.',
      points: [
        'Writing forces the thought to be finished. Noticing something in passing and writing it down are different cognitive acts, and only one of them is the habit.',
        'Specific entries work better than general ones. The mechanism appears to involve actually recalling the event, which "my family" does not require you to do.',
        'The effect fades with repetition of the same material, which is a good reason to write about today rather than keeping a standing list of things you are grateful for in general.',
        'It is deliberately the cheapest habit in the challenge. Thirty seconds, every day, is the whole ask.',
      ],
    },
    how: {
      requirement: 'Write down one thing you are grateful for. One line is enough.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'Anywhere you write is fine — a notebook, a note on your phone, the back of an envelope. Forge does not store it and never asks to see it.',
        'One line meets the requirement in full. There is no extra credit for three.',
      ],
      notes: 'Thinking about something gratefully and writing it down are not the same habit, and this one is the second. If you did not write it, it is not done.',
    },
    optimize: [
      {
        title: 'Write about today, not about your life',
        body: 'Something that happened in the last twenty-four hours. Standing gratitudes — health, family, home — are true, repeat endlessly, and stop producing anything after a week.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Go for detail over scale',
        body: 'Small and specific beats large and abstract: the particular conversation, the particular ten minutes. The detail is what makes you recall the thing rather than name it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Include people, and say what they did',
        body: 'Entries about other people\'s actions tend to land harder than entries about circumstances. "Sam covered for me at 4pm" is a different sentence from "good colleagues".',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep it in one place',
        body: 'The same notebook or the same note, appended to daily. Scattered entries cannot be reread, and rereading three weeks of them is most of the payoff.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Attach it to the end of the day',
        body: 'It needs a day to have happened first, and it doubles as a full stop on the day. Tie it to something fixed — after you brush your teeth, before you read.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Occasionally write why, not just what',
        body: 'One extra clause — why it mattered, or what it would have been like without it — appears to do more than the entry alone. Not every day; it gets mechanical.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Write it for someone, sometimes',
        body: 'Every week or two, write the entry as a message to the person it is about and actually send it. Expressed gratitude is better supported than private gratitude.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Reread the week on the same day each week',
        body: 'Five minutes of rereading turns thirty scattered lines into something you can see the shape of. A practice rather than a finding.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Writing the same thing every day', body: 'Three weeks of "my family" is a completed habit that did nothing. The novelty is not decoration — it is where the effect comes from.' },
      { title: 'Thinking it instead of writing it', body: 'The requirement is a written line. Mentally noting something on the way to bed is a nice moment and not this habit.' },
      { title: 'Saving it up and backfilling three days at once', body: 'Written on Thursday, three entries for Monday to Wednesday are a reconstruction. Write today\'s today, and skip the days you missed.' },
      { title: 'Making it a performance', body: 'Nobody reads this. Long, careful, well-phrased entries are the version of the habit people abandon in the second week.' },
      { title: 'Forcing it on a genuinely bad day', body: 'On a bad day, write something small and true — the coffee, the bus arriving. Reaching for something profound when you do not feel it produces a line you do not believe, which is worse than a mundane one.' },
    ],
    examples: [
      {
        label: 'A good day',
        lines: [
          '22:40 — notebook on the bedside table, which is where it always is.',
          'One line: "The twenty minutes in the park at lunch — first properly cold day, had the place to myself."',
          'Specific, from today, and about something you could picture again in a month.',
          'Book shut. Habit ticked. Thirty seconds.',
        ],
      },
      {
        label: 'A bad day',
        lines: [
          'The day was genuinely poor and nothing feels worth writing down.',
          'The rule does not ask for profound, so you write: "Hot shower after being out in the rain."',
          'That is a complete entry. It is specific, it is from today, and it is true.',
          'Tick the habit. A mundane honest line is the correct output for a bad day.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────── 4. Physical reset
  physical: {
    id: 'physical',
    title: 'Short Physical Reset',
    icon: '🚶',
    tagline: 'A few deliberate minutes of movement. A walk counts.',
    quickStart: [
      'Check the length on the habit row — 5, 10 or 15 minutes, depending on your mode.',
      'Pick the lowest-friction option you have: a walk outside, usually.',
      'Put it where the day stalls — mid-afternoon, or straight after sitting down for too long.',
    ],
    why: {
      blurb: 'This is the one physical habit in a challenge that is otherwise entirely mental, and it is here because attention is a physical state as much as a mental one. A short, deliberate break in which you move does more for the next hour of thinking than the same minutes spent on your phone.',
      points: [
        'Brief breaks with movement reliably restore performance on sustained attention tasks better than breaks spent on a screen.',
        'A short walk is enough. The requirement is single-digit minutes in most modes, because the mechanism is the break and the movement, not the training effect.',
        'Deliberate is the operative word: the same ten minutes spent walking to the kitchen while reading your phone is not a reset.',
        'It is the one habit here with no cognitive load, which makes it the one to use when the day has gone badly.',
      ],
    },
    how: {
      requirement: 'Do today\'s number of minutes of intentional movement. The length is on the habit row; any intentional movement counts, including a walk.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'A walk, stretching, mobility work, a few flights of stairs, part of a workout — the rule says intentional movement, and means it.',
        'A longer session you were doing anyway covers it. You do not need a separate token walk on a day you trained.',
      ],
      notes: 'This habit was added to Mental Training after the challenge first shipped, so an attempt started before that gets it inserted automatically, just above the Daily Log, with the XP and length matching its mode. Nothing else about the attempt changes.',
    },
    optimize: [
      {
        title: 'Put it at the point the day stalls',
        body: 'Most people have a predictable flat stretch, usually mid-afternoon. That is where these minutes pay for themselves rather than being a chore.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Go outside if you can',
        body: 'Outdoor breaks appear to restore attention better than indoor ones, and daylight has the side benefit of helping your body clock. Inside still counts.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Leave the phone behind',
        body: 'Ten minutes of walking while scrolling is ten minutes of scrolling. The reset is in the absence of input, not in the steps.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Use it as a transition, not an interruption',
        body: 'Between two different kinds of work, or between work and home. A break that marks a boundary gets taken; a break in the middle of something does not.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Have an indoor default',
        body: 'Stairs, a mobility sequence, pacing while something cooks. The habit is most often missed to weather, and a named fallback removes the decision.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Pair it with the step target if you are running Fat Loss too',
        body: 'Forge already pays one habit once when two challenges share it, and a deliberate walk can satisfy this and move your step count at the same time. Nothing is double-counted; the walk simply does two jobs.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Move before demanding work, not only after it',
        body: 'A short walk immediately before a focus block is a cheap way to arrive at it alert. Worth trying; the evidence is mostly about breaks rather than warm-ups.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Take it at the same time daily',
        body: 'A fixed slot turns it from something you fit in to something that is simply part of the afternoon. The habit is short enough that no day genuinely cannot hold it.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Treating it as a workout', body: 'Five to fifteen minutes is not training and is not trying to be. Aiming to make it a session is the reason it gets skipped on busy days.' },
      { title: 'Walking while on your phone', body: 'The requirement is intentional movement, and scrolling while walking is movement that happens to be occurring. You will know the difference.' },
      { title: 'Skipping it on the day you most need it', body: 'The flat, badly-going day is exactly the day these minutes were put in the challenge for. It is the cheapest habit here — do it first, not last.' },
      { title: 'Only counting a dedicated walk', body: 'If you went to the gym, played football, or cycled to work, the habit is covered. Inventing a separate ten-minute walk on top is not what the rule asks for.' },
      { title: 'Waiting for a clear window', body: 'The window does not arrive. Ten minutes between two things is the habit; a quiet afternoon is not a requirement.' },
    ],
    examples: [
      {
        label: 'Desk afternoon, 10 minutes',
        lines: [
          '15:10 — the predictable flat hour. Phone stays on the desk.',
          'Out of the building, once round the block, no destination and no podcast.',
          'Back at 15:22, which is twelve minutes, and the next hour of work is noticeably less of a slog.',
          'Tick the habit.',
        ],
      },
      {
        label: 'A day you trained anyway, 5 minutes',
        lines: [
          'You went to the gym at 07:00 for forty minutes.',
          'That is intentional movement well past the five minutes the row asks for, so the habit is already covered.',
          'No token walk needed, no separate session, nothing to add.',
          'Tick it and move on.',
        ],
      },
    ],
  },
};

/** A guide by its local id, or null. */
export function guide(id) {
  return GUIDES[id] || null;
}
