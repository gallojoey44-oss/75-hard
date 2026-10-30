import { EVIDENCE } from './evidence';

/**
 * Guides for the habits that are not owned by any one challenge.
 *
 * Right now that is the Daily Log, which every challenge includes and which no
 * challenge explains. It is the habit people most often skip on the assumption
 * that it is bookkeeping — and the one whose absence does the most damage,
 * because the ratings it collects are what the challenge score, the Insights
 * tab and every correlation Forge can offer are read from. A skipped log is not
 * a missing 20 XP; it is a hole in the only data the app has about you.
 */

export const GUIDE_SOURCE = 'forge';

export function guideRef(id) {
  return GUIDES[id] ? `${GUIDE_SOURCE}:${id}` : null;
}

export const GUIDES = {
  dailyLog: {
    id: 'dailyLog',
    title: 'Daily Log',
    icon: '📊',
    tagline: 'The ratings everything else in Forge is calculated from.',
    quickStart: [
      'Open Today and move the sliders. One rating already completes the habit.',
      'Rate the day you actually had, not the day you meant to have.',
      'Do it at roughly the same time each evening, so the numbers are comparable to each other.',
    ],
    why: {
      blurb: 'Every number Forge shows you that is not a tick count comes from here. Your challenge score, the patterns in Insights, whether your energy tracks your sleep, whether your mood drops in the second week — all of it is read from these ratings. Without them Forge can tell you what you did and nothing at all about what it did to you.',
      points: [
        'The log is the only input Forge has that is not a checkbox. Completion tells it whether you did the habits; the ratings tell it whether the habits are working.',
        'Insights needs a run of days to say anything. A fortnight of logged days produces real correlations; a fortnight with half the days missing produces nothing worth reading.',
        'Rating at a consistent time matters more than rating precisely. A 7 at 10pm every night is a usable series; a 7 in the morning and a 4 at midnight is noise.',
        'Gaps are never filled in for you. A day you did not log stays empty — Forge will not guess at how you felt.',
      ],
    },
    how: {
      requirement: 'Rate the day on the Today screen. Saving at least one metric completes the habit.',
      earns: [
        'Checking this habit earns the XP shown on its row, once per day.',
        'It completes when you save a rating, so it is ticked by using the log rather than by ticking a box.',
        'More metrics are more useful to Insights and worth no extra XP. One rating is a complete day as far as the habit is concerned.',
      ],
      notes: 'The row cannot be ticked directly — tapping it takes you to the log, and saving is what completes it. That is deliberate: the XP is for the ratings existing, and it is the one habit whose absence costs you something no amount of XP can show you.',
    },
    optimize: [
      {
        title: 'Log at the same time every evening',
        body: 'Consistency is what makes a series comparable. Pick a point near the end of the day that reliably exists — after dinner, before you read — and use it every day.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Rate quickly and move on',
        body: 'Your first instinct on a 1–10 scale is as good as a considered answer and far more likely to happen daily. Deliberating over whether today was a 6 or a 7 is how the habit becomes a chore.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Use the whole scale',
        body: 'If every day is a 7 or an 8, the series cannot show you anything. A genuinely bad day should get a 3, which is also what makes a good day visible later.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Log the sleep you actually got',
        body: 'Sleep is the metric most worth being honest about, because it is the one most other things correlate with. Rounding up a five-hour night to a seven hides the pattern you most want to see.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Log a bad day as a bad day',
        body: 'The temptation on a poor day is to skip the log or to be generous. Both remove exactly the data point that explains the week. The ratings are not a grade.',
        evidence: EVIDENCE.ESTABLISHED,
      },
    ],
    advanced: [
      {
        title: 'Add a one-line note on unusual days',
        body: 'Travel, illness, a late night, a big event. In three weeks the number alone will not remind you why the day was a 3, and the note is what turns an outlier into an explanation.',
        evidence: EVIDENCE.PROMISING,
      },
      {
        title: 'Log more metrics than the minimum',
        body: 'One rating completes the habit, but correlations need two series to compare. Energy plus sleep is the pair that pays off soonest.',
        evidence: EVIDENCE.ESTABLISHED,
      },
      {
        title: 'Read Insights once a week, not daily',
        body: 'Day-to-day movement in these numbers is mostly noise, and watching it daily mostly produces false conclusions. A weekly look is where the signal is.',
        evidence: EVIDENCE.PROMISING,
      },
    ],
    mistakes: [
      { title: 'Treating it as admin', body: 'It is the only habit that produces data rather than consuming effort. Skipping it costs you the explanation for everything else on the screen.' },
      { title: 'Rating the day you intended to have', body: 'A generous log makes the challenge look better and makes Insights useless. The point of the number is that it is honest.' },
      { title: 'Rating at wildly different times', body: 'How you feel at 8am and at midnight are different measurements. Mixing them produces a series whose variation is mostly about the clock.' },
      { title: 'Backfilling a week at once', body: 'Remembered ratings are reconstructions, and they regress towards average, which flattens exactly the pattern you were trying to find.' },
      { title: 'Skipping it on the days that went badly', body: 'Those are the most informative days in the whole series. A log with the bad days missing cannot tell you what caused them.' },
    ],
    examples: [
      {
        label: 'Evening routine',
        lines: [
          '21:30 — same time as yesterday, which is the part that matters.',
          'Energy 6, mood 7, stress 4, sleep 6.5 hours and quality 5. Four sliders, about twenty seconds.',
          'Nothing unusual happened, so no note.',
          'Saved. The habit ticks itself, and Insights has another comparable day.',
        ],
      },
      {
        label: 'A day worth a note',
        lines: [
          'You flew back late, slept badly in the wrong bed, and the day was a write-off.',
          'Energy 3, mood 4, stress 7, sleep 4.5 hours and quality 2. The numbers are unflattering and correct.',
          'One line in the note: "flight home, 2am, hotel bed."',
          'In three weeks, when Insights shows a dip in that week, that line is the reason it is not a mystery.',
        ],
      },
    ],
  },
};

/** A guide by its local id, or null. */
export function guide(id) {
  return GUIDES[id] || null;
}
