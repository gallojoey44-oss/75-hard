import { EVIDENCE } from './evidence';

/**
 * Energy Reset — strategy guides.
 *
 * Ten days aimed at one measurement: how your energy actually behaves. The
 * habits are mostly simple to state and harder to place in a real day, so
 * these guides are weighted towards WHEN and WHERE rather than what.
 *
 * Three of the challenge's nine habits have no guide, and that is the point of
 * the brief rather than an omission: the step target, the morning water and
 * the Daily Log each say everything they need to in one line, and wrapping a
 * five-section article round "drink water soon after waking" would be padding.
 *
 * Imports nothing but the evidence vocabulary, so energyResetConfig can attach
 * these without the two modules importing each other.
 */

export const GUIDE_SOURCE = 'energy';

export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

export const GUIDES = {
  // ───────────────────────────────────────────────────────────────── Sleep
  sleep: {
    id: 'sleep',
    title: 'Sleep Opportunity',
    icon: '😴',
    tagline: 'The keystone of the whole challenge. Time in bed, consistent wake time.',
    quickStart: [
      'Fix your wake time first, including at weekends, and keep it for the ten days.',
      'Count the window on the habit row backwards from that, and set an alarm to START getting ready.',
      'Give yourself the full window even on nights you expect to sleep badly.',
    ],
    why: {
      blurb: 'Energy Reset is built around measuring your energy, and sleep is the input that moves it most. The habit asks for time in bed rather than hours asleep because the opportunity is the part you decide — how much of it you spend asleep is largely not up to you, and holding yourself to that number makes a bad night worse.',
      points: [
        'Insufficient sleep is the most reliable cause of the flat, foggy day this challenge exists to diagnose. If it is short, nothing else here will fix the energy ratings.',
        'A consistent wake time anchors your body clock more effectively than a consistent bedtime, and it is far easier to control.',
        'Nobody sleeps for the whole time they are in bed. An eight-hour opportunity is how most people get seven hours of sleep.',
        'This is the challenge\'s keystone habit — it carries more weight in your score than the rest, because it carries more weight in the outcome.',
      ],
    },
    how: {
      requirement: 'Give yourself the sleep opportunity on the habit row — time in bed with the lights out — and keep a consistent wake time.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'A night where you were in bed for the window but slept badly still counts. The opportunity was given.',
        'Logging hours slept in the Daily Log records the night. It never completes this habit for you.',
      ],
      notes: 'If you have an untreated sleep disorder, this challenge is not the right tool and the opportunity will not fix it. That is a conversation with a doctor, not a habit.',
    },
    optimize: [
      {
        title: 'Decide the wake time, then work backwards',
        body: 'Planning from the bedtime end means the window shrinks every time the evening runs long. Planning from the wake time means the evening has to give way instead.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Set an alarm for going to bed',
        body: 'Almost nobody does this, and it is the highest-return change available here. The decision that costs you sleep is made at 23:40, not at 07:00.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep weekends within about an hour',
        body: 'A three-hour lie-in on Saturday is a time-zone shift twice a week, and Monday pays for it. Ten days is short enough to hold the line.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Protect the hour before bed, not the whole evening',
        body: 'One quiet, dim, predictable hour is achievable. Reorganising your entire evening is not, and the attempt is usually what ends the habit.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Keep a nap short and early if you take one',
        body: 'Twenty minutes before mid-afternoon tends to help without costing the night. A long late nap moves tonight\'s window and shows up in tomorrow\'s rating.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Do not audit your own sleep quality closely',
        body: 'Detailed self-tracking makes some people sleep worse, which has a name in the literature. The Daily Log rating is enough for ten days.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Counting hours asleep', body: 'This habit deliberately measures the opportunity. If you were in bed for the window, it is done.' },
      { title: 'Letting the wake time float', body: 'The wake time is the anchor the other eight habits hang off. Moving it daily is why a good week can still feel bad.' },
      { title: 'Making up for a short night by sleeping in', body: 'It repays some of the debt and moves the clock, which usually costs the next two nights.' },
      { title: 'Treating a bad night as a failed day', body: 'You cannot decide to fall asleep. You can decide to be in bed, and that is the whole requirement.' },
    ],
    examples: [
      {
        label: 'Eight-hour window, working week',
        lines: [
          'Wake time is 06:45 and does not move for the ten days.',
          'Eight hours back is 22:45, so an alarm at 22:20 starts the wind-down.',
          'Lights out at 22:50 — five minutes late, which is not worth worrying about.',
          'Tick the habit.',
        ],
      },
      {
        label: 'A late night you did not choose',
        lines: [
          'You get home at 00:40 and the window is already impossible.',
          'You still get up at 06:45, because the anchor is worth more than the hour.',
          'The habit is not complete today, and the Daily Log will show why tomorrow\'s energy rating is low.',
          'Tonight you go back to the normal window rather than trying to repay the debt in one night.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Morning light
  light: {
    id: 'light',
    title: 'Morning Light',
    icon: '☀️',
    tagline: 'Ten minutes outside, early. Overcast still counts.',
    quickStart: [
      'Go outside within about an hour of waking, for the minutes on the habit row.',
      'Outside — not at a window. Glass removes most of what makes this work.',
      'Attach it to something you already do: the first coffee, the commute, letting the dog out.',
    ],
    why: {
      blurb: 'Your body clock is set largely by light, and the signal it responds to is far brighter than any indoor room. Getting outside early is the cheapest way to tell your system when the day starts — which is what makes the evening wind-down and the sleep window possible later.',
      points: [
        'Outdoor light on an overcast day is still many times brighter than a well-lit indoor room. The relevant comparison is not "sunny or not" but "outside or not".',
        'Light exposure in the morning is associated with an earlier, more stable body clock, which generally means falling asleep more easily at night.',
        'Through a window is substantially weaker. Standing on a doorstep for the same ten minutes is a different intervention.',
        'This pairs directly with the evening wind-down habit: bright early and dim late is the same lever pulled in both directions.',
      ],
    },
    how: {
      requirement: 'Spend at least the minutes on the habit row outdoors, within roughly 60 minutes of waking.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'Overcast counts. Rain counts. The requirement is outdoors, not sunshine.',
        'It can be useful time — walking to the station, a coffee on the step, the first part of your step count.',
      ],
      notes: 'Sunglasses defeat most of the point, and looking directly at the sun is never part of it. Outside, eyes open, ordinary daylight.',
    },
    optimize: [
      {
        title: 'Stack it on something that already happens',
        body: 'The first coffee outside, the walk to the car, taking the bins out. A habit with no new time requirement is one that survives a bad morning.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Earlier beats longer',
        body: 'Ten minutes at 07:00 does more for the clock than half an hour at 11:00. If the morning is tight, go out sooner rather than staying out longer.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Give it longer on a grey day',
        body: 'Overcast is still far brighter than indoors, but it is dimmer than clear sky. Fifteen or twenty minutes is a sensible adjustment, not a different habit.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Combine it with the step target',
        body: 'A ten-minute walk is roughly a thousand steps and the whole of this habit at once. Two rows, one activity.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Use a light box when it is dark before you leave',
        body: 'In winter, at high latitude, or on an early shift, a 10,000 lux box for twenty minutes is the reasonable substitute. It is a substitute, not an upgrade.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Get outside again mid-afternoon',
        body: 'A second dose appears to help hold the rhythm, and it is a good break anyway. Optional and not what the habit measures.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Standing at a window', body: 'Glass cuts the intensity dramatically. It is the single most common way this habit gets done without being done.' },
      { title: 'Waiting for good weather', body: 'Grey and wet still clears the bar comfortably. The weather is the most frequent reason this habit lapses, and the least valid one.' },
      { title: 'Doing it at lunchtime', body: 'Still pleasant, but the point is the timing. After the first hour or so the signal is doing much less for your clock.' },
      { title: 'Wearing sunglasses', body: 'They remove most of what you went outside for. Save them for the middle of the day.' },
    ],
    examples: [
      {
        label: 'Commuting',
        lines: [
          '07:10 — out of the door, coffee in hand, fifteen minutes on foot to the station.',
          'Grey, drizzling, perfectly adequate.',
          'That is the light habit and about 1,500 steps, before the day has started.',
          'Tick it on the platform.',
        ],
      },
      {
        label: 'Working from home in winter',
        lines: [
          '07:30 — still dark, so the light box goes on at the kitchen table for twenty minutes while you eat.',
          '08:45 — it is light, so you take ten minutes round the block before sitting down.',
          'The outdoor ten minutes is what the row asks for; the box covered the hour before it was possible.',
          'Tick it.',
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────── Nutrition
  nutrition: {
    id: 'nutrition',
    title: 'Nutrient-Dense Whole Foods',
    icon: '🥗',
    tagline: 'No tracking, no targets. A deliberate effort across the food groups.',
    quickStart: [
      'Build each meal round a protein source and something that grew.',
      'Aim for colour across the day — greens, something orange, something red.',
      'Do not count anything. This habit has no numbers by design.',
    ],
    why: {
      blurb: 'Energy metabolism runs on micronutrients, and the most common dietary cause of a flat fortnight is not calories but a narrow diet. This habit asks for breadth rather than restriction, because breadth is what covers the gaps you cannot see.',
      points: [
        'Iron, B vitamins, magnesium and vitamin D all have fatigue among the symptoms of low status. A varied whole-food diet is the sensible first move before any of them becomes a question for a blood test.',
        'Minimally processed food also tends to carry more fibre and protein per calorie, which makes the day\'s energy steadier.',
        'There is no RDA target here on purpose. Ten days of tracking micronutrients would produce precision nobody needs and a habit nobody keeps.',
        'It is not a restrictive diet, and treating it as one is the main way it fails.',
      ],
    },
    how: {
      requirement: 'Eat mostly minimally processed food, with a deliberate effort across the food groups that carry the micronutrients energy metabolism runs on.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'It is a judgement about the day as a whole. There is nothing to weigh, count or log.',
        'One processed thing does not fail the day. "Mostly" is the operative word.',
      ],
      notes: 'If you suspect a genuine deficiency — persistent fatigue that sleep does not touch — that is a blood test, not a habit. This challenge is not a diagnostic.',
    },
    optimize: [
      {
        title: 'Anchor every meal with protein and a plant',
        body: 'Two decisions per meal, made in that order, produces a nutrient-dense day without any thought about micronutrients at all.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Rotate rather than optimise',
        body: 'Eating the same four "healthy" meals forever is a narrow diet with a good reputation. Changing the vegetable is worth more than changing the supplement.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep frozen vegetables in the house',
        body: 'Nutritionally they are fine, they do not spoil, and they remove the main excuse on a tired evening. This is the least glamorous and most effective item here.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Eat something with iron alongside something with vitamin C',
        body: 'Vitamin C substantially improves absorption of the iron in plant foods. Lemon on the greens, peppers in the stir fry — free, and it actually matters.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Notice which meals precede the flat afternoons',
        body: 'The Daily Log makes this visible over ten days. For many people one particular lunch is doing most of the damage.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Front-load the vegetables',
        body: 'Most people eat nearly all of theirs at dinner. Moving some to lunch is an easy way to widen the day.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    mistakes: [
      { title: 'Turning it into a diet', body: 'Nothing here asks you to restrict, count or exclude. A habit that becomes a diet is one you stop in week two.' },
      { title: 'Eating healthily but narrowly', body: 'Chicken and rice twice a day is minimally processed and nutritionally thin. Breadth is the actual requirement.' },
      { title: 'Reaching for supplements first', body: 'They have their place, usually after a test. Food is the cheaper and better-evidenced starting point for ten days.' },
      { title: 'Failing the day over one biscuit', body: '"Mostly" is in the rule. An all-or-nothing reading is why this kind of habit lapses on day four.' },
    ],
    examples: [
      {
        label: 'An ordinary day',
        lines: [
          'Breakfast — eggs, wholemeal toast, a handful of berries.',
          'Lunch — leftovers with a big side salad and a squeeze of lemon over the greens.',
          'Snack — fruit and a handful of nuts rather than whatever is in the office kitchen.',
          'Dinner — salmon, potatoes, two vegetables. Colour across the day without a single calculation.',
        ],
      },
      {
        label: 'A day you were not in charge of',
        lines: [
          'Breakfast at a hotel: eggs and fruit rather than pastries, which was the only choice you got to make.',
          'Lunch is a sandwich because that is what there was. Fine.',
          'You buy a bag of fruit in the afternoon instead of the vending machine.',
          'Dinner out, so you pick the dish with vegetables in it. Mostly minimally processed, which is a pass.',
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────── Caffeine
  caffeine: {
    id: 'caffeine',
    title: 'Deliberate Caffeine',
    icon: '☕',
    tagline: 'Not an abstinence rule. A timing rule, and an honesty rule.',
    quickStart: [
      'Work out your cut-off: bedtime minus the hours on the habit row. Most people land around midday.',
      'Keep the morning coffee. Nothing here asks you to stop.',
      'Notice when you are reaching for it to cover a short night rather than to work.',
    ],
    why: {
      blurb: 'Caffeine does not create energy; it blocks the signal that you are tired. Used early it is genuinely useful. Used late it shortens and fragments the night that was going to fix the tiredness — which is how a flat week becomes a flat fortnight.',
      points: [
        'Caffeine has a long half-life, commonly around five to six hours, and it varies a lot between people. An afternoon coffee is still meaningfully present at bedtime.',
        'It can reduce sleep quality even when you fall asleep without trouble, which is why "it does not affect me" is unreliable evidence.',
        'Using it to paper over a short night is the specific pattern this habit is aimed at, because it hides exactly the signal the challenge is trying to measure.',
        'The requirement is your honest call, not a test. Nothing here is checking your cup count.',
      ],
    },
    how: {
      requirement: 'Keep caffeine roughly the number of hours on the habit row clear of your bedtime, and do not use it to paper over a short night.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'Zero caffeine is not required and is not the goal. Early caffeine fully satisfies this.',
        'It is your own honest judgement about the day. Forge is not counting cups.',
      ],
      notes: 'Tea, energy drinks, pre-workout, cola and dark chocolate all count. Pre-workout before an evening session is the most commonly missed one.',
    },
    optimize: [
      {
        title: 'Set the cut-off as a time, not a feeling',
        body: 'Bedtime minus the hours on the row gives you a clock time. "Not too late" is not a rule and will not survive a tired Wednesday.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Delay the first one by an hour',
        body: 'Having it with breakfast rather than immediately on waking suits many people better, and it moves the whole day\'s pattern earlier. Mild evidence; harmless to try.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Swap the afternoon cup for the walk',
        body: 'The usual 15:00 slump responds about as well to ten minutes outside, and that one is also two other habits on this list.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep decaf in the house',
        body: 'Much of the afternoon coffee is the ritual rather than the drug. Decaf keeps the ritual and moves the cut-off earlier without a fight.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Watch the dose, not just the timing',
        body: 'Three large coffees before 10:00 is a different day from one. If sleep is still poor with a clean cut-off, the total is the next thing to look at.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Expect two rough days if you cut back sharply',
        body: 'Headache and flatness for 24–72 hours is normal and passes. Tapering over a few days avoids most of it.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    mistakes: [
      { title: 'Reading this as "give up caffeine"', body: 'It is not an abstinence rule and never was. Morning coffee is entirely compatible with a completed habit.' },
      { title: 'Forgetting pre-workout', body: 'An evening session with a scoop of pre-workout is often 200 mg at 19:00 — far more disruptive than the coffee you did skip.' },
      { title: 'Using it to rescue a bad night', body: 'This is the pattern the habit names explicitly. It borrows from tonight to pay for this morning.' },
      { title: 'Trusting "it does not affect me"', body: 'It can shorten deep sleep without affecting how quickly you drop off. Ten days of honest timing is how you find out.' },
    ],
    examples: [
      {
        label: 'A ten-hour clearance, 22:30 bedtime',
        lines: [
          'Cut-off is 12:30, which you write on the fridge for the ten days.',
          '07:45 — coffee with breakfast. 10:30 — second coffee, still comfortably inside.',
          '15:00 — the slump arrives and you walk round the block instead, which is also the step and light habits working.',
          'Tick the habit at the end of the day.',
        ],
      },
      {
        label: 'A short night',
        lines: [
          'You slept five hours and the first instinct is a third coffee at 14:00.',
          'That is precisely the pattern the habit names, so you have the second one before the cut-off and nothing after it.',
          'The afternoon is genuinely worse. That is the honest reading the Daily Log needs.',
          'You go to bed inside the window, and tomorrow is the day that fixes it.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────── Down-regulation
  stress: {
    id: 'stress',
    title: 'Downshifting',
    icon: '🧘',
    tagline: 'Five quiet minutes. It does not have to be formal practice.',
    quickStart: [
      'Pick one option and keep it: breathing, meditation, NSDR, prayer, or a quiet walk.',
      'Five minutes is a complete session — the habit row states the minimum.',
      'Put it at the point the day is worst, usually mid-afternoon or on arriving home.',
    ],
    why: {
      blurb: 'Most people spend the whole day in some degree of sympathetic activation and never deliberately leave it. This habit is a small, repeatable visit to the other state, which is where energy is recovered rather than spent.',
      points: [
        'Slow breathing with a longer exhale shifts the balance towards the parasympathetic side within minutes. It is the quickest lever here, and it costs nothing.',
        'Daytime stress and evening sleep are closely linked, so this habit is partly a sleep intervention that happens at 15:00.',
        'The range of qualifying practices is deliberately wide. What matters is that it is deliberate and that input stops.',
        'Five minutes daily beats twenty minutes twice a week, by a wide margin, for the thing this challenge measures.',
      ],
    },
    how: {
      requirement: 'Spend at least the minutes on the habit row deliberately downshifting — meditation, diaphragmatic breathing, NSDR, prayer, a quiet walk, or anything else of that kind.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'It does not have to be a formal practice. Sitting still and breathing slowly counts.',
        'A quiet walk counts only if it is quiet. The same walk with a podcast is a break, not a downshift.',
      ],
      notes: 'If you are also running a challenge with its own down-regulation habit, one session satisfies both and is paid once — Forge merges shared habits instead of duplicating them.',
    },
    optimize: [
      {
        title: 'Four in, eight out, for five minutes',
        body: 'The simplest version of the habit and the one with the clearest rationale. No app, no posture, no learning curve.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Give it a fixed slot',
        body: 'A practice with a time gets done. One that waits for a calm moment gets done on the days it was least needed.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Use it as a boundary',
        body: 'Five minutes on arriving home changes the three hours after it. The same five minutes at bedtime only changes bedtime.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Keep the phone out of it',
        body: 'Unlocking the phone to start a timer is what ends most short practices. Count breaths, or use a kitchen timer.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
    ],
    advanced: [
      {
        title: 'Try NSDR on the flattest days',
        body: 'Ten to twenty minutes of guided non-sleep deep rest leaves many people noticeably restored. The evidence is thin and mostly small studies; the cost is twenty minutes.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Do it before the thing you are dreading',
        body: 'Five minutes before a difficult conversation or a hard task is where the state change is most useful, rather than after it.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Waiting until you feel like it', body: 'The days you least want five quiet minutes are the days they do the most. It is a fixture, not a response.' },
      { title: 'Making it long', body: 'Twenty minutes is a lovely practice and a poor daily habit. The row asks for five because five actually happens.' },
      { title: 'Leaving input running', body: 'Music, a podcast, a screen. Downshifting is the absence of input; with it, this is just a short sit.' },
      { title: 'Grading the session', body: 'A distracted five minutes counts in full. Judging your own practice is the most reliable way to stop doing it.' },
    ],
    examples: [
      {
        label: 'Mid-afternoon at a desk',
        lines: [
          '15:10 — the predictable flat hour, which you have now noticed three days running.',
          'Phone face down in a drawer, timer on the desk, five minutes of four-in, eight-out.',
          'You feel ordinary afterwards, which is the normal result, and the next hour is better.',
          'Tick the habit.',
        ],
      },
      {
        label: 'A day with no quiet room',
        lines: [
          'The house is full and the office is open-plan, so there is nowhere to sit still.',
          'You take a ten-minute walk at lunchtime with nothing playing — no podcast, no calls.',
          'That is a quiet walk, which the rule names explicitly.',
          'Tick it, and it covers part of the step target too.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── Wind-down
  winddown: {
    id: 'winddown',
    title: 'Evening Wind-Down',
    icon: '🌙',
    tagline: 'Dimmer, quieter, and the same every night.',
    quickStart: [
      'Pick an hour before your lights-out time and dim the house — lamps, not ceiling lights.',
      'Do the same three things in the same order, every night. The order is the signal.',
      'Decide in advance where the phone spends that hour. Anywhere but your hand.',
    ],
    why: {
      blurb: 'Sleep is not a switch, and an evening that runs at full brightness and full stimulation until the moment the lights go out gives your system nothing to work with. A wind-down is a predictable, repeated sequence that tells your body what is coming — and predictability is most of its value.',
      points: [
        'Bright light in the evening pushes your body clock later, which is the opposite of what the morning light habit is doing. The two are the same lever in both directions.',
        'A fixed routine works partly through association: repeated often enough, the sequence itself becomes a cue, independent of what each step does.',
        'What is on the screen matters at least as much as the screen. A stressful inbox at 22:30 is the problem; the backlight is secondary.',
        'This is the lowest-XP habit here and the one that makes the keystone sleep habit achievable, which is a better reason to do it than the points.',
      ],
    },
    how: {
      requirement: 'Lower the stimulation and the light for the period before bed, and run the same predictable routine.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'There is no prescribed length or content. Your routine, run tonight, is the requirement.',
        'It is a judgement about your own evening, and it is meant to be.',
      ],
      notes: 'The point is repetition, not perfection. A shortened version of your usual routine beats skipping it on the nights you are late.',
    },
    optimize: [
      {
        title: 'Dim the house, not just the screen',
        body: 'Overhead lights off, lamps on, an hour out. Ambient light is doing far more than the phone\'s night mode ever will.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Fix the sequence and keep it short',
        body: 'Three steps in the same order — tidy the kitchen, shower, read. Short enough to run on a late night is what makes it nightly.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Decide where the phone goes',
        body: 'Charging in another room removes the decision. Keeping it beside you means making that decision again every night, while tired.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Write tomorrow down before you start',
        body: 'Most lying-awake is unfinished thinking. Two minutes putting it on paper before the routine begins is the cheapest version of dealing with it.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    advanced: [
      {
        title: 'Run the same routine when you are away',
        body: 'A hotel room has none of your cues, which is exactly when a portable sequence earns its keep. Take the book.',
        evidence: EVIDENCE.EXPERIMENTAL,
      },
      {
        title: 'Keep the bedroom cool and dark',
        body: 'A cooler room is associated with better sleep, and light leaking in is a common and fixable problem. Both are one-off changes rather than nightly ones.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Making it an hour-long ritual', body: 'An elaborate routine survives about four nights. Three steps, ten minutes, every night, is the version that works.' },
      { title: 'Relying on a blue-light filter', body: 'The content is more stimulating than the colour temperature. A filter on a work inbox changes very little.' },
      { title: 'Only doing it on good nights', body: 'The late, frazzled evenings are the ones it exists for. Run the short version instead of skipping.' },
      { title: 'Finishing the day in bed on your phone', body: 'It replaces the wind-down with its opposite, in the place you least want the association.' },
    ],
    examples: [
      {
        label: 'A normal evening, lights out at 22:45',
        lines: [
          '21:45 — ceiling lights off, two lamps on, phone goes on to charge in the hall.',
          '21:50 — kitchen tidied and tomorrow\'s three things written on paper.',
          '22:10 — shower, then reading in bed on paper.',
          '22:45 — lights out. Same order as last night, which is the whole point.',
        ],
      },
      {
        label: 'A late night',
        lines: [
          'You get in at 23:20 and the full routine is not happening.',
          'You run the short version: lamps instead of the big light, phone in the hall, five pages.',
          'Fifteen minutes rather than an hour, and the sequence is intact.',
          'Tick it — a shortened wind-down is a wind-down, and skipping it is what breaks the chain.',
        ],
      },
    ],
  },
};

/** A guide by its local id, or null. */
export function guide(id) {
  return GUIDES[id] || null;
}
