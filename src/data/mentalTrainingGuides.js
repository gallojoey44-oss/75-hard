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
 * The core habit, `mt_mind`, has a guide that depends on the attempt:
 *
 *  • `training` — attempts started with the six practices (data/
 *    mentalPractices.js). Its "How to complete it" is the six-practice rule.
 *  • none — attempts started before them, whose only statement of the habit
 *    was the challenge's rationale copy naming breathwork, meditation or
 *    prayer. A guide's "How to complete it" IS the rule, so writing one for
 *    them would change the rule of an attempt already running.
 *
 * An interim guide written for habit rules version 2 ("meditation,
 * mindfulness, breathwork or visualization", at 2, 5 or 10 minutes) was
 * retired before it was ever released: the six practices replaced that rule
 * for every attempt it could have applied to.
 *
 * `mt_prayer` has no guide on purpose: the description says it plainly and
 * respectfully. Optimizing somebody's prayer, with evidence tags, is not
 * Forge's business.
 */

export const GUIDE_SOURCE = 'mental';

export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

export const GUIDES = {
  // ─────────────────────────────────── 0a. Mental Training: six practices
  // Offered only to attempts stamped with a practice set — see
  // data/mentalPractices.js. The practices' own steps live on the training
  // screen; this guide is the rule and the reasoning around it.
  training: {
    id: 'training',
    title: 'Mental Training — Six Practices',
    icon: '🧘',
    tagline: 'One deliberate practice a day, for the minutes on the row. Six ways to do it.',
    quickStart: [
      'Tap Begin Training under the habit and choose one of the six practices.',
      'Read its steps — they take seconds — then do it for the minutes on the row. The timer is optional.',
      'Come back and confirm. That ticks this habit once and pays its XP once, whichever practice you chose.',
    ],
    why: {
      blurb: 'This is the challenge\'s keystone habit: a set block of time each day spent deliberately directing your attention. The six practices come at that from different directions — stillness, the world outside, the body, an idea, a hard moment ahead, your own thinking — so you can choose the one the day calls for.',
      points: [
        'The requirement is the minutes of deliberate practice, not one technique. Varying the practice from day to day is allowed; many people keep one main practice and use the others when a day calls for it.',
        'A session does not have to go well to count. Noticing that your attention has drifted and bringing it back is the repetition itself.',
        'Your daily length was chosen when this attempt started and stays fixed for it. Every length pays the same XP, so there is no reward for choosing less.',
        'This is training, not treatment. If you are struggling with your mental health, it is not a substitute for professional support.',
      ],
    },
    how: {
      requirement: 'Spend the minutes on the habit row on ONE of the six practices: Dead Calm (meditation & breathwork), Open Sky (mindful nature observation), Moving Stillness (mindful stretching & mobility), Pursuit of Wisdom (reflective reading), Inner Vision (visualization & mental rehearsal) or Inner Mirror (journaling & introspection). Your attention has to be on the practice: walking while scrolling, stretching in front of a screen or skimming pages does not count.',
      earns: [
        'Completing it earns the XP shown on its row, once per day, whichever practice you chose.',
        'Opening a practice, reading its steps or starting the timer earns nothing. Confirming that you did it is what ticks the habit.',
        'Already ticked today? Another session is welcome, and adds no XP.',
      ],
      notes: 'One practice, one habit. Time you count here counts for Mental Training only: Reading, Prayer, Gratitude and the Short Physical Reset are still done separately, and finishing a session never ticks any of them for you. Attempts started before the six practices existed keep the rule they started with.',
    },
    optimize: [
      {
        title: 'Decide when, not just what',
        body: 'A fixed time and place each day removes the decision that most often ends a daily habit. Choosing the practice can wait until you sit down; choosing the time cannot.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Really put the phone away',
        body: 'Open Sky, Moving Stillness, Pursuit of Wisdom and Inner Mirror are designed to be done without it. Read the steps, put the phone in another room, and come back to record the session.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Use a timer that is not your phone',
        body: 'A watch or kitchen timer keeps the phone out of reach. The timer on the training screen is there if you want it, and never required.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Match the practice to the day',
        body: 'Inner Vision before something demanding, Dead Calm after something stressful, Open Sky after a day indoors. A reasonable rule of thumb rather than a finding.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    advanced: [
      {
        title: 'Rehearse the setback, not just the success',
        body: 'In Inner Vision, picturing an obstacle and your planned response to it has more behind it than picturing only the outcome you want.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Turn reading into one action',
        body: 'In Pursuit of Wisdom, end each session by naming one thing you will do differently today. An idea you act on is easier to remember than one you only agreed with.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Lengthen in your next attempt, not this one',
        body: 'If the minutes start to feel easy, choose a longer length when you start your next Mental Training Phase. This attempt keeps the length it started with.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Multitasking the minutes', body: 'A practice done while scrolling, listening to something or watching a screen is a different activity. The attention is the requirement.' },
      { title: 'Counting the same minutes twice', body: 'Reflective reading does not also cover your reading pages, and journaling does not also cover your gratitude line. Each habit gets its own time.' },
      { title: 'Grading the session', body: 'Judging whether it went well is the most reliable way to stop doing it. Turning up for the minutes is what counts.' },
      { title: 'Waiting for a calm moment', body: 'The calm moment does not arrive on its own. Pick the time and start.' },
    ],
    examples: [
      {
        label: 'Ten minutes of Dead Calm, first thing',
        lines: [
          '06:50 — before the phone is unlocked, which is the one reliably quiet part of the day.',
          'A minute of slow breathing to settle, then nine following the breath.',
          'Your mind wanders perhaps twenty times. Each time you notice, you go back.',
          'Back to Forge, confirm, done.',
        ],
      },
      {
        label: 'Thirty minutes of Open Sky after work',
        lines: [
          'Phone left on the hall table. A slow loop of the park.',
          'Five things you can see, four you can hear, three you can feel — then just keep noticing.',
          'Caught yourself planning dinner twice; came back to the trees both times.',
          'Home, confirm the session. Your Physical Reset is still its own ten minutes.',
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
