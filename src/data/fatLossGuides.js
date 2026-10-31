import { EVIDENCE } from './evidence';
// Hard Mode already states the fullness rule, why it exists and the honest
// limit of the claim. The guide quotes those rather than paraphrasing them, so
// the card and the guide cannot drift apart. The dependency runs one way:
// fatLossHardConfig refers to these guides by their literal id string, because
// importing guideRef back would make the two modules circular and FULLNESS
// would be read before it exists.
import { FULLNESS } from './fatLossHardConfig';

/**
 * Fat Loss Challenge — strategy guides.
 *
 * Four of the challenge's habits had a name, a number and nothing else: a
 * person reading "Hit protein goal (0.8–1 g/lb goal weight)" at 7am has been
 * handed arithmetic, not an instruction. These guides say what to actually do.
 *
 * Same shape as the LOCK IN guides, documented in lockInConfig.GUIDES, because
 * HabitGuide renders from data alone and knows nothing about which challenge
 * supplied it.
 *
 * Two rules this file follows, deliberately:
 *
 *  1. `how.requirement` restates the rule the challenge ALREADY enforces. It
 *     never adds a condition, and where a figure differs between Beginner,
 *     Standard and Hard Mode it points at the number on the habit row rather
 *     than naming one — the row is the attempt's own truth, and a guide that
 *     hardcodes "8,000" is wrong for two thirds of the people reading it.
 *  2. Habits whose rule Forge has never actually defined — whole foods at
 *     "80%+ of what", the undefined water goal, sleep hours in bed versus
 *     asleep — get no guide here. Writing one would mean inventing the rule
 *     people are being scored against. They are listed in the audit instead.
 */

export const GUIDE_SOURCE = 'fatloss';

export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

export const GUIDES = {
  // ──────────────────────────────────────────────────────────────── 1. Protein
  protein: {
    id: 'protein',
    title: 'Protein Target',
    icon: '🥩',
    tagline: 'The one number worth knowing, and it comes from your goal weight.',
    quickStart: [
      'Work out your number once: goal weight in pounds × 0.8 to 1 = grams for the day. A 170 lb goal is roughly 140–170 g.',
      'Put a protein source in your first meal. Days that start without one almost never catch up.',
      'Learn the protein in four foods you already eat often. That is enough to run this without tracking anything.',
    ],
    why: {
      blurb: 'In a deficit your body will take weight from wherever it can, and some of that is muscle. Eating enough protein is the single most reliable way to make the weight you lose mostly fat — and it happens to be the macronutrient that keeps you full the longest, which makes everything else about the challenge easier.',
      points: [
        'Higher protein intake during weight loss consistently preserves more lean mass than lower protein intake at the same calorie level. This is one of the better-established findings in the area.',
        'Protein is the most satiating of the three macronutrients per calorie. A high-protein day is usually a less hungry day, which is why this habit is a keystone rather than a detail.',
        'It is measured against your GOAL weight, not your current weight. That keeps the number stable while your weight moves, and it stops the target inflating just because you have further to go.',
        'The range exists because precision is not the point. The bottom of it counts.',
      ],
    },
    how: {
      requirement: 'Reach the protein target on the habit row, totalled across the whole day. In Beginner and Standard that is 0.8–1 g per pound of your goal body weight. Hard Mode prints the grams instead, worked out from the goal weight you entered — or from the fixed daily figure, if that is the mode you chose at setup.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'Goal weight, not current weight. If your goal is 150 lb, the target is roughly 120–150 g regardless of what you weigh today — and if you chose a fixed daily number at setup instead, that number is the target and this ratio does not apply to you.',
        'Anything you ate counts — it is a daily total, not a per-meal rule.',
      ],
      notes: 'This is one of the two ⭐⭐⭐ keystone habits, which means it carries more weight in your challenge score than the rest. If a day has to be partial, this is the one to protect.',
    },
    optimize: [
      {
        title: 'Anchor every meal with a protein source first',
        body: 'Decide the protein, then build the meal around it. It is the one component that is hard to add retrospectively, and a day built the other way round routinely lands 40 g short with no obvious place to put it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Learn four numbers instead of tracking everything',
        body: 'The protein in a chicken breast, a tin of tuna, a pot of Greek yoghurt and your scoop of powder covers most days. Four memorised figures beats an app you will stop opening by day nine.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Front-load it',
        body: 'Getting half the day\'s protein in before lunch turns the evening from a rescue mission into a formality. It also means a disrupted evening does not cost you the habit.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep one no-effort option in the house',
        body: 'Powder, cottage cheese, tinned fish — something that needs no cooking and no decision. The point is not that it is optimal; it is that it closes a 30 g gap at 9pm when the alternative is missing the habit.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Weigh meat raw, or accept you are estimating',
        body: 'Cooked meat has lost water, so the same 150 g reads differently depending on when you weighed it. Pick one convention and stay with it. Estimating is fine — estimating inconsistently is what produces a target you think you hit and did not.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Spread it across three or four meals',
        body: 'Total intake matters most, but there is reasonable evidence that spreading protein across the day supports muscle retention slightly better than taking most of it in one sitting. Worth doing if it costs you nothing; not worth engineering your day around.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Track for three days, then stop',
        body: 'Most people are badly wrong about their intake in one direction or the other, and three logged days fixes that permanently. Then put the app away — you now know what your day looks like.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Lean on the higher end of the range on training days',
        body: 'If you are lifting, 1 g/lb rather than 0.8 is the sensible end of the range to sit at. The challenge accepts either; this is a preference, not a requirement.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Using current weight instead of goal weight', body: 'If you are 60 lb from your goal, this inflates the target by nearly 50 g a day and makes a reasonable habit feel impossible. Read the habit name again: goal weight.' },
      { title: 'Counting incidental protein generously', body: 'Bread, rice and nuts contribute, but nowhere near what people credit them with. A day of "a bit of protein in everything" is usually a 90 g day.' },
      { title: 'Leaving it all to dinner', body: 'A 150 g target is a reasonable day and an unpleasant single meal. Backloading is the most common reason this habit gets missed on a day that was otherwise fine.' },
      { title: 'Trusting the front of the packet', body: '"High protein" is a marketing claim with a low bar. Turn it over and read the number per serving — then check what the serving is.' },
      { title: 'Treating the range as a minimum of 1 g/lb', body: '0.8 g/lb counts. Deciding privately that only the top of the range is a real pass is how people end a good day feeling like they failed.' },
    ],
    examples: [
      {
        label: '170 lb goal — roughly 140–170 g',
        lines: [
          'Breakfast — 200 g Greek yoghurt and a scoop of powder: about 45 g. Half the morning\'s work done before 9am.',
          'Lunch — a chicken breast in whatever else you were having: about 45 g. Running total 90 g.',
          'Snack — a tin of tuna or a handful of jerky: about 25 g. Running total 115 g.',
          'Dinner — salmon or mince, normal portion: about 35 g. Lands at 150 g, comfortably inside the range.',
        ],
      },
      {
        label: '130 lb goal — roughly 105–130 g, eating out',
        lines: [
          'Breakfast — three eggs on toast: about 20 g.',
          'Lunch is a restaurant and you do not control the menu, so you pick the thing with the obvious protein in it rather than the one with the best side: about 35 g. Running total 55 g.',
          'Afternoon — a yoghurt from the shop next door: about 15 g. Running total 70 g.',
          'Dinner — normal portion of chicken or tofu at home: about 35 g. Lands at 105 g, which is the bottom of the range and therefore a pass.',
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────── 2. Steps
  steps: {
    id: 'steps',
    title: 'Daily Steps',
    icon: '🚶',
    tagline: 'The cheapest energy expenditure there is, and it costs you no recovery.',
    quickStart: [
      'Check the number on the habit row — it is 6,000, 8,000 or 10,000 depending on the mode you chose.',
      'Look at what you already walk on a normal day. Most people are closer than they think, and the gap is usually one deliberate walk.',
      'Attach that walk to something that already happens every day: after lunch, after work, on the phone to someone.',
    ],
    why: {
      blurb: 'Walking adds energy expenditure without adding fatigue. It is the one form of activity you can increase substantially while still recovering from your training, which is exactly what you want during a fat-loss phase.',
      points: [
        'Daily movement outside formal exercise accounts for a large and highly variable share of total energy expenditure. It is also the part that quietly collapses when you start dieting.',
        'Unlike hard cardio, walking does not meaningfully interfere with recovery from resistance training, so it can go up without anything else going down.',
        'A step target is self-auditing. Unlike "be more active", you can tell at 2pm whether you are on course.',
        'Consistency beats volume here. Hitting the target most days does more than one 20,000-step Sunday.',
      ],
    },
    how: {
      requirement: 'Reach today\'s step target. The figure is on the habit row and comes from the mode your attempt was started in; it is a whole-day total, from whatever device you normally count with.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'All walking counts, and it counts cumulatively — a day of errands can get you there with no dedicated walk at all.',
        'There is no requirement to walk in one block, and no bonus for doing so.',
      ],
      notes: 'Forge does not read your phone or your watch. You check the habit when you have hit the number; the count comes from whatever you already use.',
    },
    optimize: [
      {
        title: 'Attach the walk to a fixed daily event',
        body: 'After lunch, after the school run, immediately after shutting the laptop. A walk tied to an existing anchor survives a busy week; a walk scheduled for "later" does not.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Check the count at lunchtime, not at bedtime',
        body: 'Looking at 2,000 steps at 10pm is information you can do nothing with. Looking at it at 1pm turns an impossible evening into a twenty-minute walk.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Take your calls standing and moving',
        body: 'Any call that does not need a screen is a walk you were going to spend the time on anyway. This is usually the single largest free gain available to a desk worker.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Walk the last part of any journey',
        body: 'Park at the far end, get off a stop early, leave the car at home for anything under a mile. These are decisions made once, not willpower spent daily.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Use three short walks rather than one long one',
        body: 'Ten minutes is roughly a thousand steps. Three of them is a third of a 10,000 target and fits around a day that will not give you an hour.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Walk shortly after your largest meal',
        body: 'A gentle walk after eating is associated with a smaller post-meal glucose rise. Pleasant, easy, and a reasonable way to decide which walk to prioritise — but the step total is what the habit asks for, not the timing.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Have an indoor fallback for bad weather',
        body: 'A treadmill, a long corridor, a shopping centre, pacing while something cooks. The habit fails far more often to rain than to lack of time.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Weight the walk, carefully',
        body: 'Carrying a loaded pack raises the cost of the same distance. It also raises the load on your back and knees, so if you try it, start light and keep it short. Entirely optional and not what the habit measures.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Counting the gym session as steps', body: 'An hour of lifting is perhaps 1,500 steps. Training is not a substitute for the step target, which is the whole reason the target exists separately.' },
      { title: 'Only looking at the number at the end of the day', body: 'The count is useful as a steering instrument and useless as a verdict. Check it while you can still act on it.' },
      { title: 'Putting the whole thing on one weekend walk', body: 'Nothing in the rules forbids it, but the habit is checked daily, so a Saturday hike earns one day\'s XP and leaves Monday to Friday untouched.' },
      { title: 'Leaving the phone on the desk', body: 'If your count comes from your phone, walking without it means walking for nothing as far as the habit is concerned. Decide which device is your counter and keep it with you.' },
      { title: 'Treating a near miss as a failure', body: '7,800 against an 8,000 target is not a pass, but it is also not a reason to write the day off. Walk the last five minutes.' },
    ],
    examples: [
      {
        label: 'Desk job, 8,000 target',
        lines: [
          'Morning — walk to the station instead of driving: 1,800.',
          'Lunch — twenty minutes out of the building, no destination: 2,000. Running total 3,800.',
          '15:00 — a call you were going to take anyway, taken on your feet: 1,200. Running total 5,000.',
          'Evening — the walk home plus a loop round the block before dinner: 3,200. Lands at 8,200.',
        ],
      },
      {
        label: 'A day you have no spare time, 6,000 target',
        lines: [
          'You check at 13:00 and you are on 1,100. That is the whole point of checking early.',
          'You park at the far end of the supermarket car park and do the shop on foot rather than in two trips: 1,600. Running total 2,700.',
          'You take the stairs and the long way to everything for the rest of the afternoon: 1,300. Running total 4,000.',
          'Twenty minutes after dinner, deliberately: 2,100. Lands at 6,100 on a day that had no room in it.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────── 3. Fullness
  fullness: {
    id: 'fullness',
    title: 'Stop at ~90% Fullness',
    icon: '🍽️',
    tagline: 'Hard Mode\'s answer to calorie counting: leave the last ten percent.',
    quickStart: FULLNESS.howTo.slice(0, 3),
    why: {
      blurb: FULLNESS.why,
      points: [
        FULLNESS.honesty,
        'Fullness signals lag the last few bites by roughly ten minutes, so eating quickly means deciding you are satisfied using information that has not arrived yet.',
        'Most overeating is procedural rather than hungry: the plate was full, the serving dish was there, the meal was not over yet. A rule about when to stop interrupts the procedure.',
        'It transfers. Unlike a tracked calorie target, this habit works at a restaurant, at someone else\'s house and on holiday, with nothing to look up.',
      ],
    },
    how: {
      requirement: FULLNESS.short,
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'It is a judgement call about your own day, and it is meant to be. There is no number to hit and nothing to weigh.',
        'One meal going past 90% does not automatically fail the day — you are reporting on how the day went overall.',
      ],
      notes: FULLNESS.howTo[4],
    },
    optimize: [
      {
        title: 'Put the fork down before the plate is empty',
        body: 'Leaving something — three bites, a corner of the plate — is the entire skill in one action. It is also the version of this habit you can actually check: either you left something or you did not.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Ask the mid-meal question',
        body: 'Halfway through: could I comfortably eat a bit more? If the honest answer is already no, you have gone past 90% and the rest of the plate is momentum.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Slow the first five minutes',
        body: 'Most of a meal\'s volume goes down at the start, before any fullness signal exists. Slowing the opening does more than slowing the end.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Serve once, away from the serving dish',
        body: 'Plate the food in the kitchen and eat at the table. A second helping should require standing up — that is usually enough for the decision to become conscious.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Eat the protein and vegetables first',
        body: 'They are the most filling part of the plate per calorie, so 90% arrives sooner and arrives with the nutritious part already eaten.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Use a smaller plate for one week',
        body: 'Portion size tracks the container more than people like to believe. Changing the plate changes the default without requiring a decision at every meal. Effects reported in the literature are real but modest.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Put the meal down for two minutes halfway through',
        body: 'An enforced pause gives the lag time to catch up, and makes the second half of the meal a choice rather than a continuation.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Rate your fullness out of ten in the Daily Log notes',
        body: 'Naming the number builds the calibration faster than trying to feel it. After a fortnight most people can tell 8 from 10 without thinking about it.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Treating it as eating less food', body: 'This is not a smaller-portions habit. It is a stop-at-the-right-moment habit, and on a high-protein day the right moment often arrives with food still on the plate.' },
      { title: 'Finishing the plate because it is there', body: 'The plate is not a target. If the serving was bigger than 90% of your appetite, the remainder goes in the fridge.' },
      { title: 'Going to 100% and calling it 90%', body: 'The test is whether you could comfortably eat a little more. "Stuffed but it was healthy food" is not a pass.' },
      { title: 'Eating so little that the evening collapses', body: 'Undershooting badly at dinner is how people end up eating at 10pm. 90% means satisfied — it is not 60%.' },
      { title: 'Writing off the whole day after one big meal', body: 'The next meal is the next rep. This is a skill being trained over thirty days, not a test you fail once.' },
    ],
    examples: [
      {
        label: 'Dinner at home',
        lines: [
          'Plate the food in the kitchen; the pan stays on the hob rather than coming to the table.',
          'Eat the protein and the vegetables first, at a deliberately slower pace for the first five minutes.',
          'Halfway: could you comfortably eat a bit more? Yes — carry on.',
          'Three quarters through, the answer becomes "not really". Fork down, the last few bites go in a box for tomorrow\'s lunch. That is the habit.',
        ],
      },
      {
        label: 'Dinner out, no control over the portion',
        lines: [
          'You order the dish with the obvious protein in it rather than the one with the best sides.',
          'The portion arrives at roughly 150% of what you need, which is normal and not a problem.',
          'You eat at conversation pace and run the mid-meal check when the plate is about half gone.',
          'You stop with a visible amount left, which feels rude for about four seconds and is the entire habit for the day.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────── 4. Sleep
  // Offered only to attempts on habit rules version 2 — see data/habitRules.js.
  // Earlier attempts were started when the habit said "Sleep 7.5+ hours" and
  // nothing else, and they keep that.
  sleep: {
    id: 'sleep',
    title: 'Sleep Opportunity',
    icon: '😴',
    tagline: 'The hours you set aside to sleep. Not hours asleep, and not hours in bed.',
    quickStart: [
      'Fix your wake time and keep it, weekends included.',
      'Count the window on the habit row backwards from it, and set an alarm to START getting ready for bed.',
      'Lights out at the start of it. The window is time set aside to sleep, not time spent in bed.',
    ],
    why: {
      blurb: 'Short sleep makes a deficit much harder to run. It raises appetite, blunts the fullness signal the challenge asks you to read, and makes the day you were going to walk 8,000 steps in feel like one you would rather sit down for. The habit measures the opportunity because that is the part you can actually decide.',
      points: [
        'Short sleep is associated with higher hunger and lower fullness signalling, which is precisely the combination that makes a deficit feel like willpower.',
        'It is also associated with a greater share of weight lost coming from lean mass rather than fat — which is the specific outcome this challenge\'s protein habit exists to prevent.',
        'Nobody is asleep for the whole window they set aside. Allowing eight hours is how most people get something over seven hours of sleep.',
        'A consistent wake time stabilises the rhythm more effectively than a consistent bedtime, and it is easier to control.',
      ],
    },
    how: {
      requirement: 'Give yourself the sleep opportunity on the habit row: the hours you deliberately set aside to sleep, lights out and genuinely trying. Falling asleep is not required — how much of the window you sleep through is not something you can decide — but time in bed doing something else is not part of it.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'A night you were in the window for and slept badly through still counts in full. The opportunity was given, and that is the whole requirement.',
        'Time in bed on your phone, reading for an hour, or working does not count towards the window. Lights out, genuinely trying, is what the hours are measuring.',
        'Logging hours slept in the Daily Log records the night. It never completes this habit for you, and no logged figure can — the window is something only you know you gave yourself.',
      ],
      notes: 'The figure itself follows your mode and is on the row, unchanged. This reading of it — hours set aside rather than hours asleep — applies to attempts started after the rule was settled; an attempt already running keeps the wording it was started under, and is not offered this guide.',
    },
    optimize: [
      {
        title: 'Decide the wake time, then work backwards',
        body: 'Planning from the bedtime end means the window shrinks whenever the evening runs long. Planning from the wake time means the evening gives way instead.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Set an alarm for going to bed',
        body: 'Hardly anybody does, and it is the highest-return change available here. The decision that costs you sleep is made at 23:40.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Protect it hardest in the first fortnight',
        body: 'That is when appetite is adjusting and when a short night does the most damage to the rest of the day\'s habits.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep weekends within about an hour',
        body: 'A three-hour lie-in is a time-zone change twice a week, and Monday pays for it — usually in the protein and steps habits.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Stop auditing your own sleep quality',
        body: 'Close self-tracking makes some people sleep worse, which has a name in the literature. The Daily Log rating is enough.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Expect the hungry evening after a short night',
        body: 'Knowing it is coming is most of handling it. Plan the evening meal rather than deciding it at 21:00 on four hours\' sleep.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Counting hours asleep', body: 'Falling asleep is not something you can decide, so it is not what is being asked. The window you set aside is the part you control, and it is the whole requirement.' },
      { title: 'Counting the hour in bed on your phone', body: 'Scrolling in the dark is time in bed, not time set aside to sleep. It is the most common way the window gets reported as given when it was not — and it is also the thing most likely to have shortened it.' },
      { title: 'Treating a bad night as a failed day', body: 'You cannot decide to fall asleep. You can decide to set the hours aside and put the lights out, and that is what is being asked.' },
      { title: 'Cutting sleep to fit the training in', body: 'Trading an hour of sleep for a session is a bad trade during a deficit, and it usually costs you the following day as well.' },
      { title: 'Letting the wake time float', body: 'It is the anchor the rest of the day hangs off. Moving it daily is why a compliant week can still feel awful.' },
    ],
    examples: [
      {
        label: 'A 7.5-hour window',
        lines: [
          'Wake time is 06:30 and stays 06:30, Saturday included.',
          '7.5 hours back is 23:00, so an alarm at 22:40 starts the wind-down.',
          'Lights out at 23:05. You are awake for twenty minutes in the middle of the night.',
          'The window was given, so the habit is complete.',
        ],
      },
      {
        label: 'The night after a short one',
        lines: [
          'You slept five hours and the day has been hungry and flat — which is the expected pattern, not a character failure.',
          'You eat the planned dinner rather than improvising at 21:00.',
          'Lights out at the normal time rather than trying to repay the whole debt in one night, and the phone charges in the hall.',
          'Had you spent that hour in bed scrolling instead, the window would not have been set aside and the habit would not be done.',
          'Tick it, and let tomorrow be the day it resets.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── 5. Whole foods
  // Also version 2 only. The percentage was in the habit's name and nowhere
  // else, so "80% of what" had no answer in Beginner or Standard until the
  // unit was settled as meals — which is what Hard Mode's card already said.
  whole: {
    id: 'whole',
    title: 'Mostly Whole Foods',
    icon: '🥗',
    tagline: 'Counted in meals. Not a ban list.',
    quickStart: [
      'Count in meals: the habit row\'s percentage is roughly how many of the day\'s meals are minimally processed.',
      'Build each one round a protein source and something that grew.',
      'Spend the remainder deliberately rather than accidentally.',
    ],
    why: {
      blurb: 'Minimally processed food is more filling per calorie, harder to overeat, and carries the protein and fibre the rest of the challenge depends on. The percentage is not a purity score — it is a working majority, with room left in it on purpose.',
      points: [
        'Highly processed food is easier to eat quickly and in quantity, which is the mechanism that matters most during a deficit.',
        'Whole foods bring protein and fibre with them, so this habit quietly makes the protein target and the fullness habit easier.',
        'The unit is meals, not calories and not plate volume. That is the reading Hard Mode has always used, and it is now the reading everywhere.',
        'The remaining fraction is deliberate room. A rule with no room in it is one you break and then abandon.',
      ],
    },
    how: {
      requirement: 'Make roughly the habit row\'s share of the day\'s meals minimally processed. The percentage follows the mode you chose.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'Counted in meals across the day, not in calories and not per plate.',
        'It is a judgement call, and it is meant to be. Nothing is weighed or logged.',
      ],
      notes: 'Counting in meals is the reading that applies to attempts started after the rule was settled; an attempt already running keeps the wording it was started under, and Hard Mode said this all along. It is one of the two keystone habits, so it carries more weight in your score than the rest — and it is not the fullness habit, which is about when you stop rather than what is on the plate.',
    },
    optimize: [
      {
        title: 'Spend the remainder on purpose',
        body: 'Decide in advance which meal is the flexible one — the dinner out, the thing you actually want. An unplanned remainder is just the day going wrong twice.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Fix breakfast and lunch, flex dinner',
        body: 'The two meals you control most are the cheapest ones to make minimally processed, and they bank most of the day\'s percentage before anything unpredictable happens.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Judge by how it was made, not by how it is marketed',
        body: 'A protein bar is processed; a potato is not. "Healthy" on the packet is a claim about positioning, not about the food.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Keep the easy whole options stocked',
        body: 'Frozen vegetables, tinned fish, eggs, rice, fruit. Most failures of this habit are a shopping problem rather than a willpower one.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Cook once, eat three times',
        body: 'A single session producing three lunches is the most reliable way to raise the percentage without raising the effort.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Watch the drinks',
        body: 'They do not look like meals and are easy to leave out of the count. They are also where a surprising share of a day\'s calories can sit.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Reading it as a ban list', body: 'The remaining share is in the rule. Treating the habit as "nothing processed ever" is how it gets abandoned on day five.' },
      { title: 'Counting it in calories', body: 'The unit is meals. Switching to calories makes it a tracking habit, which is exactly what this challenge avoids.' },
      { title: 'Confusing it with the fullness habit', body: 'Hard Mode has both. This one is what you eat; that one is when you stop.' },
      { title: 'Failing the whole day over one item', body: '"Roughly" and "mostly" are both in the rule. One biscuit is not a failed day.' },
    ],
    examples: [
      {
        label: 'Standard mode — nine meals in ten',
        lines: [
          'Across the day you eat five times: breakfast, lunch, a snack, dinner, something in the evening.',
          'Four of those are built round protein and something that grew.',
          'The evening one is ice cream, which you decided on this morning rather than at 21:30.',
          'That is comfortably inside "roughly nine in ten" over the week. Tick it.',
        ],
      },
      {
        label: 'A day away from home',
        lines: [
          'Breakfast is a hotel buffet: eggs and fruit rather than pastries.',
          'Lunch is a sandwich, because that is what there was. That is one of the day\'s flexible slots spent.',
          'Afternoon — fruit from a shop rather than the vending machine.',
          'Dinner out: the dish with the obvious protein and a side of vegetables. Most of the day minimally processed, which is a pass.',
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────── 6. Photo
  photo: {
    id: 'photo',
    title: 'Progress Photo',
    icon: '📸',
    tagline: 'The scale measures today. The photo measures the month.',
    quickStart: [
      'Pick one spot in your home with light that does not change — not a window.',
      'Take it at the same time of day, before eating or drinking. First thing in the morning is easiest to repeat.',
      'Mark where you stand and how far back the camera goes. Same spot, same distance, every time.',
    ],
    why: {
      blurb: 'Body weight moves for reasons that have nothing to do with fat: water, salt, food in transit, where you are in your cycle. A photo taken under identical conditions is the measurement that filters most of that out — not because it is precise, but because it is comparable.',
      points: [
        'Day-to-day weight changes of two or three pounds are routine and mean almost nothing. Monthly photographic change is slower, quieter and far harder to misread.',
        'Comparability is the whole value, and it comes entirely from consistency. A photo in different light, at a different time of day, in different clothes is a new measurement rather than a comparison.',
        'It also catches what the scale cannot: recomposition. Holding the same weight while visibly changing shape is a success the scale reports as a failure.',
        'You are a poor judge of your own daily appearance and a decent judge of a four-week comparison. The photo exists for the comparison, not for today.',
      ],
    },
    how: {
      requirement: 'Take one photo of yourself today.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'One photo is the requirement. More angles are useful and entirely optional.',
        'Forge does not ask you to upload it, and does not store it. Where the photo lives is up to you — the habit is that you took it.',
      ],
      notes: 'It is a required habit in every mode, including Hard Mode, where it is explicitly not optional. It is worth little XP because it takes thirty seconds, not because it matters little.',
    },
    optimize: [
      {
        title: 'Fix the light before anything else',
        body: 'Pick a spot lit by the same bulb every time, and avoid daylight — a window makes a February photo and an April photo incomparable no matter how carefully you stand.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Same time of day, same state',
        body: 'First thing in the morning, before eating or drinking, is the most repeatable state you have. An evening photo after a full day of food is a different measurement.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Mark the floor and the camera position',
        body: 'A piece of tape where your feet go and a fixed shelf for the phone removes the two variables people most often change without noticing: distance and angle.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Wear the same minimal clothing',
        body: 'Not for anyone else\'s benefit. Clothing hides exactly the change you are trying to see, and different clothing week to week makes the series useless.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Stand relaxed, not braced',
        body: 'Posing, bracing or holding your breath produces a photo of your effort rather than your progress — and it flatters the early photos, which is the wrong direction to bias a comparison.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Front, side and back',
        body: 'Three angles catch changes one angle hides, and the side view is usually the most informative of the three. Optional: the habit asks for one photo.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Use a two-second timer rather than holding the phone',
        body: 'Holding the camera changes your posture and your arm position, which are two of the things you are trying to keep constant.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Only look at the series every two weeks',
        body: 'Taking the photo daily and reviewing it daily are different activities, and the second one mostly produces discouragement. Take it every day; compare it fortnightly.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Comparing today to yesterday', body: 'There is nothing in a one-day difference but light, posture and the last meal. The series is a monthly instrument.' },
      { title: 'Only taking it on good days', body: 'A set of photos taken when you felt lean is a record of your mood, not your progress. The bloated days are part of the data.' },
      { title: 'Changing the conditions once you start seeing change', body: 'Better light and a flattering angle feel like an upgrade and silently break the comparison. Keep the setup boring.' },
      { title: 'Deleting the early photos', body: 'The first week is the only baseline you will ever have, and it is the photo you will most want in a month. Keep it somewhere you will not tidy it away.' },
      { title: 'Skipping it because nothing has changed yet', body: 'Of course nothing has changed yet — that is what a baseline is. The photo you take on a day when it feels pointless is the one that makes week six worth looking at.' },
    ],
    examples: [
      {
        label: 'Morning routine',
        lines: [
          '07:05 — out of bed, bathroom, before any food or water.',
          'Hallway light on, phone on the second shelf, feet on the tape mark.',
          'Two-second timer, standing relaxed, front on. One photo, thirty seconds in total.',
          'It goes into a dedicated album on your phone so the series stays together. Tick the habit and get on with the day.',
        ],
      },
      {
        label: 'Away from home',
        lines: [
          'You are in a hotel, so the fixed spot does not exist and the light is wrong. Take it anyway.',
          'Pick the most neutral light in the room, away from the window, and stand a sensible distance back.',
          'Note mentally that this one is off-series — useful for continuity, not for comparison.',
          'Tick the habit. A slightly inconsistent photo keeps the streak and the routine; a missed one breaks both.',
        ],
      },
    ],
  },
};

/** A guide by its local id, or null. */
export function guide(id) {
  return GUIDES[id] || null;
}
