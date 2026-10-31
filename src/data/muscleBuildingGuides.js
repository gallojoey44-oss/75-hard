import { EVIDENCE } from './evidence';

/**
 * Muscle Building — strategy guides.
 *
 * Same shape and the same two rules as the other guide modules: the stated
 * requirement restates what the challenge already enforces, and every figure
 * that comes from the person's own setup — the calorie target, the carb grams,
 * the nutrition mode — is pointed at on the habit row rather than named here.
 * Muscle Building builds its tasks from a setup form, so almost every number
 * in it is personal; a guide that printed one would be wrong for everybody
 * except the person it was written for.
 *
 * Imports nothing but the evidence vocabulary, so muscleBuildingConfig can
 * attach these guides without the two modules importing each other.
 */

export const GUIDE_SOURCE = 'muscle';

export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

export const GUIDES = {
  // ──────────────────────────────────────────────────────────────── Protein
  protein: {
    id: 'protein',
    title: 'Protein Target',
    icon: '🥩',
    tagline: 'Enough to build with, and no reason to go further.',
    quickStart: [
      'Your target is on the habit row: 0.8–1 g per pound of your bodyweight.',
      'Put a protein source in every main meal. Three solid meals usually gets you most of the way.',
      'Learn the protein in four foods you eat often, and you will not need to track anything.',
    ],
    why: {
      blurb: 'Training is the signal to build; protein is the material. Below roughly 0.7 g/lb the material runs short and the signal is wasted. Above about 1 g/lb there is no further return — this is one of the few places in nutrition where the ceiling is reasonably well mapped.',
      points: [
        'Protein intake and muscle gain rise together up to a point and then flatten. The flattening is the useful part: it tells you when to stop paying attention to this number.',
        'This target is per pound of your CURRENT bodyweight, not a goal weight. Muscle Building is about what you have to train and feed now.',
        'When you are eating adequate calories, 0.8–0.9 g/lb is generally enough. The top of the range is margin, not extra growth.',
        'Going meaningfully above 1 g/lb is not recommended here. It displaces the carbohydrate that fuels the training, and the training is the half that actually drives the adaptation.',
      ],
    },
    how: {
      requirement: 'Reach the protein target on the habit row, totalled across the whole day. It is 0.8–1 g per pound of your bodyweight.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'A daily total, not a per-meal rule. Anything you ate counts.',
        'The bottom of the range is a pass. 0.8 g/lb is a complete day.',
      ],
      notes: 'This is the challenge\'s keystone habit, so it carries more weight in your score than the rest. If a day has to be partial, protect this one.',
    },
    optimize: [
      {
        title: 'Decide the protein first, then build the meal',
        body: 'It is the component that cannot be added at the end. Plan the chicken, the mince, the tofu — the rest of the plate assembles itself around it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Memorise four numbers instead of tracking everything',
        body: 'A chicken breast, a tin of tuna, a pot of Greek yoghurt and your scoop of powder covers most days. Four figures beats an app you will stop opening by week two.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Keep one zero-effort option in the house',
        body: 'Powder, cottage cheese, tinned fish. Not optimal — just the thing that closes a 30 g gap at 9pm instead of missing the habit.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Eat a protein-containing meal reasonably near training',
        body: 'Within a few hours either side is sufficient. The "anabolic window" turned out to be far wider than it was once sold as, so total daily intake matters much more than timing.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Spread it over three or four meals',
        body: 'Total intake dominates, but there is reasonable evidence that even distribution supports slightly better muscle protein synthesis than one large serving. Worth doing when it is free; not worth reorganising your day for.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Track three days, then stop',
        body: 'Most people are badly wrong about their intake in one direction. Three honest logged days fixes that for good, and then you can put the app away.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Favour whole-food sources where it is easy',
        body: 'They bring micronutrients and fibre with them, and they are more filling, which matters during a surplus. Powder is a convenience, not a problem.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Treating more as better', body: 'Past about 1 g/lb you are buying nothing and crowding out carbohydrate. The challenge says so explicitly — this is one of the rare numbers with a known top end.' },
      { title: 'Using a goal weight', body: 'That is the Fat Loss habit. Here the target is your bodyweight now, because that is the body being trained.' },
      { title: 'Backloading the whole day into dinner', body: 'A 180 g target is a reasonable day and a miserable single meal. Backloading is the most common reason an otherwise fine day misses this habit.' },
      { title: 'Counting incidental protein generously', body: 'Bread, rice, oats and nuts add up to less than people credit. A day of "a bit of protein in everything" is usually 40 g short.' },
    ],
    examples: [
      {
        label: 'A 180 lb lifter — roughly 145–180 g',
        lines: [
          'Breakfast — four eggs and a pot of Greek yoghurt: about 45 g.',
          'Lunch — a large chicken breast with rice: about 50 g. Running total 95 g.',
          'Post-training — a scoop of powder in milk: about 30 g. Running total 125 g.',
          'Dinner — mince or salmon, normal portion: about 40 g. Lands at 165 g, comfortably inside the range.',
        ],
      },
      {
        label: 'A day without a kitchen',
        lines: [
          'You are travelling, so nothing gets cooked and the target still stands.',
          'Breakfast from a shop: yoghurt and a protein drink, about 40 g.',
          'Lunch: the sandwich with the most meat in it plus a second pot of yoghurt, about 40 g. Running total 80 g.',
          'Evening: whatever is served, plus a shake from the tub in your bag. Lands around 150 g, which is a pass.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────── Nutrition
  nutrition: {
    id: 'nutrition',
    title: 'Nutrition Target',
    icon: '🍽️',
    tagline: 'Eat for the mode you chose, not for the mood you are in.',
    quickStart: [
      'Your mode and your figure are on the habit row — Lean Bulk, Recomp or Maximum Gain, each with a different surplus.',
      'Find one repeatable day that hits it and reuse it. Variety is for meals, not for arithmetic.',
      'Weigh yourself in the same conditions a few times a week and read the weekly average, not any one morning.',
    ],
    why: {
      blurb: 'Muscle is built out of surplus energy, and the size of the surplus decides how much of what you gain is muscle and how much is fat. That is the whole reason this habit exists separately from protein: the mode you picked at setup is a deliberate trade between speed and leanness.',
      points: [
        'A modest surplus supports close to the maximum rate of muscle gain most people can achieve. A larger one mostly adds fat, faster.',
        'Rate of gain is the signal to steer by. Lean Bulk aims at a slow, steady climb; Recomp sits near maintenance and accepts slower growth; Maximum Gain trades leanness for speed.',
        'Scale weight moves for reasons that have nothing to do with tissue — water, salt, food in transit. A weekly average is a measurement; a single morning is noise.',
        'Undereating is the more common failure. People aiming to build frequently eat at maintenance and conclude the training is not working.',
      ],
    },
    how: {
      requirement: 'Eat to the nutrition target on the habit row. The row names your chosen mode and, where you set one, the calorie figure that goes with it.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'It is the day as a whole, not any single meal.',
        'If you set no calorie figure at setup, the row states the mode and the judgement is yours — eat in the direction it describes.',
      ],
      notes: 'Changing your mind about the mode is a setup decision, not a daily one. Switching modes mid-week makes the weekly average unreadable, which is the only instrument this habit has.',
    },
    optimize: [
      {
        title: 'Build two or three default days',
        body: 'A training day, a rest day, and an eating-out day, each already known to land near the target. Deciding once beats deciding at every meal.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Steer by the weekly average weight',
        body: 'Weigh in the same conditions — first thing, after the bathroom, before eating — and compare this week\'s average to last week\'s. Adjust only if the trend is wrong for two weeks running.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Add calories in liquid when solid food runs out',
        body: 'Milk, a shake, oats blended in. During a surplus the limit is usually appetite rather than willingness, and drinks bypass it.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep the surplus on training days',
        body: 'Putting more of the week\'s extra energy around the sessions that use it is a sensible default. The weekly total is what matters most, so do not over-engineer it.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Recalculate when your weight has moved meaningfully',
        body: 'A target set 10 lb ago is no longer the same surplus. Revisit it every few weeks rather than every week.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Drop to Recomp if fat gain is outpacing the plan',
        body: 'A deliberate change of mode is not a failure — it is the control this challenge gives you. Make it at setup, between phases, not halfway through a week.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Treating a surplus as permission', body: 'Lean Bulk is a modest surplus with a number attached. "Bulking" without one is just eating more and finding out later.' },
      { title: 'Reacting to a single morning on the scale', body: 'Two pounds overnight is water. Changing your intake because of it is steering by noise.' },
      { title: 'Eating at maintenance and expecting growth', body: 'The most common version of this habit failing is invisible: the day felt like a lot of food and landed where last month did.' },
      { title: 'Changing the mode every week', body: 'Each change resets the only trend you can read. Pick one and give it a month.' },
    ],
    examples: [
      {
        label: 'Lean Bulk, training day',
        lines: [
          'Breakfast — oats with milk, yoghurt and fruit. Dense, easy, repeatable.',
          'Lunch — rice, chicken, vegetables, a decent amount of olive oil.',
          'Around training — a shake and a banana, which is where the extra energy of a training day goes.',
          'Dinner — normal portion plus a side you would not have on a rest day. Lands at the row\'s figure without any single meal feeling unusual.',
        ],
      },
      {
        label: 'A week of steering',
        lines: [
          'Monday to Sunday, you weigh in five mornings under the same conditions.',
          'Last week\'s average: 181.2 lb. This week\'s: 181.4 lb.',
          'That is a slower climb than Lean Bulk intends, but it is one week, so you change nothing.',
          'Next week it is 181.5 lb. Two weeks of too-slow is a trend, so you raise the target modestly — once, not daily.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────── Carbs
  carbs: {
    id: 'carbs',
    title: 'Carb Target',
    icon: '🍚',
    tagline: 'The fuel the training actually runs on.',
    quickStart: [
      'Your figure is on the habit row — it was set from your training volume at setup.',
      'Put the largest share around training: the meal before and the meal after.',
      'Rice, potatoes, oats, pasta, fruit, bread. This is the one target that is genuinely easy to hit.',
    ],
    why: {
      blurb: 'Resistance training runs substantially on stored carbohydrate. Low intake does not stop you training, but it reliably makes the last sets worse — and the last sets are where most of the stimulus is. This habit exists so that the quality of the session is not quietly limited by what you ate.',
      points: [
        'Muscle glycogen is the main fuel for sets in the typical hypertrophy range. Running it low shows up as reps you could have had and did not.',
        'The target follows your training volume, which is why it was set from your setup form rather than from a general rule.',
        'It sits inside your calorie target, not on top of it. Carbs are the fuel, the nutrition habit is the budget.',
        'Hitting protein and carbs both, inside the calorie target, is what leaves fat to fill the remainder — which is why there is no separate fat habit.',
      ],
    },
    how: {
      requirement: 'Reach the carbohydrate target on the habit row, across the whole day and inside your calorie target.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'A daily total. The timing advice below is optimization, not requirement.',
        'If no gram figure is shown, the row states the habit and the judgement is yours — eat enough to train well.',
      ],
      notes: 'Carbohydrate is not a separate licence. It comes out of the same calorie target the nutrition habit sets, which is why the two are checked together.',
    },
    optimize: [
      {
        title: 'Load the meal before training',
        body: 'A substantial carbohydrate meal one to three hours before is the single highest-return piece of timing here, and it is the one most people get wrong by training on an empty tank.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Refill afterwards rather than chasing a window',
        body: 'Replacing what the session used matters; doing it within thirty minutes does not. Eat a normal meal when you get home.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Use dense staples, not snacks',
        body: 'Rice, potatoes, pasta and oats get you there in three meals. Trying to reach a high target on fruit and vegetables alone means eating volume you do not have room for.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Keep fibre reasonable on heavy training days',
        body: 'Very high fibre right before a session is uncomfortable for many people. Save the big salad for later in the day.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    advanced: [
      {
        title: 'Put more of the week\'s carbohydrate on training days',
        body: 'Shifting some from rest days to training days is a reasonable refinement once the weekly total is already right. It is a refinement, not a requirement.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Notice which sessions feel flat, and look at the day before',
        body: 'Low-carb days often show up in the NEXT day\'s training rather than the same one. The Daily Log is where that pattern becomes visible.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Cutting carbs because they feel like the indulgent one', body: 'In a building phase they are the fuel. Cutting them and keeping the training volume is how people end up training badly on purpose.' },
      { title: 'Treating the target as extra calories', body: 'It lives inside the calorie target. Adding it on top turns a Lean Bulk into a Maximum Gain without the decision being made.' },
      { title: 'Training fasted and wondering why the last sets collapse', body: 'They collapse because the fuel is not there. This is the easiest session-quality problem in the whole challenge to fix.' },
      { title: 'Chasing an exact gram figure', body: 'Within 20 g is the same day physiologically. Precision here buys nothing and costs the habit.' },
    ],
    examples: [
      {
        label: 'Training day, target around 250 g',
        lines: [
          'Breakfast — 80 g oats with milk and a banana: about 80 g of carbohydrate.',
          'Lunch — a large bowl of rice with chicken: about 90 g. Running total 170 g.',
          'Pre-training — a second banana and a slice of toast: about 40 g. Running total 210 g.',
          'Dinner — potatoes with whatever else: about 50 g. Lands at 260 g, close enough.',
        ],
      },
      {
        label: 'Rest day',
        lines: [
          'No session, so the same target is less urgent but still the day\'s figure.',
          'Normal meals with a proper carbohydrate portion at each one.',
          'If you land 30 g under on a rest day, nothing is lost — the habit is checked daily, so near enough is a pass.',
          'What you do not do is make it up with a huge evening, which mostly affects sleep.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────── Sleep
  // Attached only to attempts on habit rules version 2 — see data/habitRules.js.
  sleep: {
    id: 'sleep',
    title: 'Sleep Opportunity',
    icon: '😴',
    tagline: 'The hours you set aside to sleep. Not hours asleep, and not hours in bed.',
    quickStart: [
      'Count backwards from your wake time and set a going-to-bed alarm, not just a waking one.',
      'Keep the wake time steady, including at weekends. It anchors everything else.',
      'Lights out at the start of it. The window is time set aside to sleep, not time spent in bed.',
    ],
    why: {
      blurb: 'Training is the stimulus and sleep is where the adaptation happens. The habit asks for time in bed rather than hours asleep because the opportunity is the part you can actually decide — how much of it you spend asleep is largely not up to you, and holding yourself to it makes bad nights worse.',
      points: [
        'Short sleep is associated with reduced training performance, worse recovery and a less favourable hormonal picture for building muscle.',
        'Nobody is asleep for the whole window they set aside. Allowing eight hours is how most people get something over seven hours of sleep.',
        'A consistent wake time does more for sleep quality than a consistent bedtime, and it is easier to control.',
        'Measuring the opportunity also removes the trap of lying awake doing arithmetic about how much sleep is left.',
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
      notes: 'The figure itself follows your setup and is on the row, unchanged. This reading of it — hours set aside rather than hours asleep — applies to attempts started after the rule was settled; an attempt already running keeps the wording it was started under, and is not offered this guide.',
    },
    optimize: [
      {
        title: 'Set the wake time first, then work backwards',
        body: 'Decide when you get up, subtract the window on the row, and that is your lights-out. Planning from the bedtime end means the window shrinks whenever the evening runs long.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Keep the wake time within about an hour at weekends',
        body: 'A three-hour weekend lie-in is a time-zone change twice a week. Consistency here is worth more than any supplement in this challenge.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Set an alarm for going to bed',
        body: 'Almost nobody does this and it is the single most effective intervention available. The decision that costs you sleep is made at 23:40, not at 07:00.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Train earlier when you can',
        body: 'Hard sessions late at night leave some people wired. If your sleep is worse on training nights, moving the session is cheaper than fixing the sleep.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Keep the window on deload weeks too',
        body: 'Recovery weeks are when the adaptation catches up. Shortening sleep because the training is lighter removes the point of the week.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Stop auditing your own sleep quality',
        body: 'Tracking sleep closely makes some people sleep worse, which has a name in the literature. Log it in the Daily Log and leave it there.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Counting hours asleep', body: 'Falling asleep is not something you can decide, so it is not what is being asked. The window you set aside is the part you control, and it is the whole requirement.' },
      { title: 'Counting the hour in bed on your phone', body: 'Scrolling in the dark is time in bed, not time set aside to sleep. It is the most common way the window gets reported as given when it was not — and it is also the thing most likely to have shortened it.' },
      { title: 'Only protecting sleep on training days', body: 'The building happens on the rest days. Those are the nights that matter most.' },
      { title: 'Treating a bad night as a failed habit', body: 'You cannot decide to fall asleep. You can decide to set the hours aside and put the lights out, and that is what is being asked.' },
      { title: 'Borrowing from sleep to finish the day', body: 'The hour taken at 23:00 is paid back the next afternoon with interest, usually out of the session.' },
    ],
    examples: [
      {
        label: 'An eight-hour window',
        lines: [
          'Wake time is 06:30 and stays 06:30, Saturday included.',
          'Eight hours back from that is 22:30, so a phone alarm goes off at 22:10 to start getting ready.',
          'Lights out at 22:35. You are awake for twenty minutes somewhere in the middle of the night.',
          'The window was given. Tick the habit.',
        ],
      },
      {
        label: 'A night that went wrong',
        lines: [
          'Lights out at 22:30, and you did not fall asleep until well after midnight.',
          'You are awake at 06:30 anyway, because the wake time is the anchor.',
          'The hours were set aside and you were genuinely trying, so the window was given — which is the whole requirement.',
          'The opportunity was there, so the habit is complete — and you log the poor night in the Daily Log, which is where it belongs.',
          'You do not nap for two hours in the afternoon, which would move tonight\'s window as well.',
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────── Recovery
  recovery: {
    id: 'recovery',
    title: 'Daily Recovery Practice',
    icon: '🌿',
    tagline: 'Five deliberate minutes of down-regulation. It does not have to be formal.',
    quickStart: [
      'Pick one option and keep it: breathing, meditation, NSDR, or a walk without your phone.',
      'Five minutes is a complete session. The habit row states the minimum.',
      'Attach it to something fixed — after training, or before the evening meal.',
    ],
    why: {
      blurb: 'Hard training is a stressor, and it is added to everything else in your week. This habit is a small, repeatable way of spending time in the state where recovery happens, rather than hoping the day leaves room for it on its own.',
      points: [
        'Slow breathing with a longer exhale shifts the balance towards the parasympathetic side within a few minutes. It is one of the quickest physiological levers available without equipment.',
        'Chronic stress is associated with worse sleep and worse recovery, both of which are the actual currency of a building phase.',
        'It is deliberately short and deliberately flexible. A five-minute practice you do daily beats a twenty-minute one you do twice.',
        'It is not meant to be a mood intervention. The point is the state, not whether the session felt profound.',
      ],
    },
    how: {
      requirement: 'Spend at least the minutes on the habit row in a deliberate calming practice — meditation, diaphragmatic breathing, NSDR, a quiet walk, or anything else of that kind.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'It does not have to be formal practice. Sitting quietly and breathing slowly counts.',
        'A quiet walk counts only if it is quiet — the same walk with a podcast on is not down-regulation.',
      ],
      notes: 'If you are also running a challenge with its own down-regulation habit, the same session satisfies both and is paid once. Forge merges shared habits rather than duplicating them.',
    },
    optimize: [
      {
        title: 'Make the exhale longer than the inhale',
        body: 'Four in, six or eight out, for five minutes. It is the simplest version of this habit and the one with the most direct physiological rationale.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Do it at the same time every day',
        body: 'A practice with a slot gets done. One that waits for a calm moment gets done on the days you needed it least.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Put it after training rather than before',
        body: 'It marks the end of the session and starts the recovery, instead of blunting the arousal you want going in.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Do not use your phone to time it',
        body: 'Unlocking the phone is what ends most short practices. A kitchen timer, or simply counting breaths, avoids the whole problem.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    advanced: [
      {
        title: 'Try NSDR on heavy days',
        body: 'Ten to twenty minutes of guided non-sleep deep rest is reported to leave people noticeably restored. Evidence is thin and mostly small studies; the downside is twenty minutes.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Use it as a boundary between work and the evening',
        body: 'Five minutes on arriving home does more than five minutes at bedtime, because it changes the three hours that follow it.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Waiting to feel like it', body: 'The days you least want five quiet minutes are the days they do the most. Treat it as a fixture, not a response.' },
      { title: 'Making it long', body: 'Twenty minutes is a lovely practice and a poor habit. The row asks for five because five happens daily.' },
      { title: 'Doing it with input running', body: 'Music, a podcast, a screen. Down-regulation is the absence of input; without that it is just a short break.' },
      { title: 'Judging the session', body: 'A distracted five minutes still counts. Grading your own meditation is the reliable way to stop meditating.' },
    ],
    examples: [
      {
        label: 'After training',
        lines: [
          'Session finishes, you sit on the bench rather than leaving immediately.',
          'Five minutes of four-in, eight-out breathing, eyes closed, phone in the bag.',
          'You feel ordinary afterwards, which is the normal outcome and not a failure.',
          'Tick the habit on the way out.',
        ],
      },
      {
        label: 'A rest day',
        lines: [
          'No session to attach it to, so it goes in the fixed slot: before dinner.',
          'A ten-minute walk round the block with nothing playing.',
          'That is longer than the row asks for, which is fine and earns the same.',
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
