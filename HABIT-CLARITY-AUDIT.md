# Habit clarity — the audit, and what was done about it

Every habit a Forge challenge can put on the Today screen, and whether a person
reading that row at 7am can tell what to do.

Read from the registry itself, by enumerating every startable challenge, every
difficulty mode, and the builders the configured challenges construct their
attempts with. Fat Loss Hard Mode is listed as its own challenge below because
it builds its own habit list rather than reusing the template's.

---

## What the Today row already gives us

`CheckItem` renders four things, and all four already existed:

| Part | Field | Status before |
|---|---|---|
| The habit name | `task.name` | present on every habit |
| The measurable requirement | `task.name` + `task.target` | present where there is a number |
| A short description | `task.desc` | **16 habits blank** |
| A GUIDE button | `task.guideId` | **present on 8 of 53** |

So this was a content job, not a UI rebuild — with one exception, below, where
adding the content exposed a real bug in the row.

---

## Coverage

| Challenge | Habits | Described | With a guide |
|---|---:|---:|---:|
| Fat Loss Challenge | 8 | 5 | 4 |
| Fat Loss — Hard Mode | 8 | 8 | 4 |
| Mental Training Phase | 7 | 6 | 4 |
| Muscle Building | 6 | 5 | 0 |
| Women's Hormone Health | 6 | 6 | 0 |
| Energy Reset | 9 | 9 | 0 |
| LOCK IN | 9 | 9 | 8 |
| **Total** | **53** | **48** | **20** |

Before this change: 37 described, 8 with a guide.

Everything still blank is on the flagged list below. Those are blank on
purpose — each one would require inventing a rule that does not exist in the
data, and an invented rule silently changes what people are being scored
against.

---

## 1. Descriptions

Each one restates a rule that already exists, and each one fits the row's two
lines at iPhone width — a description whose example is cut off has failed at
the one job it was added for.

**Fat Loss**

- `fl_photo` — One photo of yourself today. Same spot, same light, same time of
  day.
- `fl_protein` — Goal weight in lb × 0.8–1 = grams per day. A 170 lb goal is
  about 140–170 g.
- `fl_steps` — Your day's total, not one walk. Ten minutes is about 1,000
  steps.

**Mental Training** (the page count and block length follow the chosen mode)

- `mt_reading` — 5 pages of a book you are actually reading. Any book counts.
- `mt_prayer` — A few deliberate moments of prayer, in whatever form it takes
  for you.
- `mt_gratitude` — Write down one thing you are grateful for. One line is
  enough.
- `mt_focus` — One unbroken block, phone in another room — not added up across
  the day.

**Every challenge**

- `daily_log` — Rate the day here. Your score and Insights come from these
  ratings.

  This one habit was blank in four separate places: the shared
  `DAILY_LOG_TASK`, and again in Muscle Building's and Hormone Health's own
  builders, which construct their own copy.

---

## 2. Guides

Eight new guides, in the same shape as the LOCK IN ones, which already carry
the five sections asked for:

| Asked for | Guide field |
|---|---|
| Practical options | `examples[]`, `quickStart[]` |
| Step-by-step | `quickStart[]`, `how.requirement` |
| Exactly what counts | `how.requirement`, `how.earns[]`, `how.notes` |
| Benefits and strategies | `why{}`, `optimize[]`, `advanced[]` |
| Common mistakes | `mistakes[]` |

**Fat Loss** (`src/data/fatLossGuides.js`) — Protein Target, Daily Steps, Stop
at ~90% Fullness, Progress Photo.

**Mental Training** (`src/data/mentalTrainingGuides.js`) — Phone-Free Focus
Block, Daily Reading, Daily Gratitude, Short Physical Reset.

A ninth, for the Daily Log, was written and then withdrawn — see decision 7.

Two rules these guides are written under, because a guide's "How to complete
it" **is** the challenge's contract with the person reading it:

1. The requirement restates the rule the challenge already enforces, and never
   adds a condition. Where a figure differs between modes — 2/5/10 pages,
   30/60/90 minutes, 6/8/10k steps — the guide points at the number on the
   habit row rather than naming one, because a guide that hardcodes "8,000" is
   wrong for two thirds of the people reading it.
2. A habit whose rule Forge has never actually stated gets **no guide**. Those
   are the flagged five, below.

Two habits are deliberately left without one for a different reason:
`mt_prayer`, where the description says it plainly and optimising somebody's
prayer with evidence tags is not Forge's business; and `mb_protein`, whose
221-character description is the one long enough that the detail belongs in a
Muscle Building guide — which is the next batch of work, not this one.

### Still to write

33 habits have no guide: all of Energy Reset, Hormone Health and Muscle
Building, plus the flagged habits. The registry is
challenge-agnostic — a challenge gets guides by adding its module to
`habitGuides.js` — so this is content, not plumbing. Suggested order, vaguest
requirement first: Energy Reset (`er_stress`, `er_caffeine`, `er_winddown`),
Hormone Health (`hh_stress`, `hh_whole_food`), Muscle Building (`mb_protein`,
`mb_carbs`, `mb_recovery`).

---

## 3. Three defects found while auditing

**A tap in the middle of a habit row stopped completing the habit.**

Adding a description to "Walk 8,000+ steps" pushed the row to three lines, and
three lines put "Show full requirement" — with the 44px touch area it needs —
in the dead centre of the row. Every control inside a row stops propagation, so
tapping the middle of that habit expanded the text and awarded nothing. The
regression suite caught it as `+0 XP`; a person would have caught it as a habit
that would not tick.

Which rows collided was luck of layout — the same control sat harmlessly over
the description on four other rows — and whether a description wraps at all
depends on the device's width. So the fix is structural: the disclosure moved
into the row's right-hand column, beside the XP and the Guide button, where the
other tap-swallowing controls already live. That column is at the row's edge
and can never contain its centre, at any width or text length. A habit that
already has a guide no longer shows the disclosure at all, because the guide is
the full requirement.

Guarded by a new check that asserts the invariant geometrically: nothing that
stops propagation may sit at the centre of any habit row.

**Energy Reset's down-regulation habit rendered its own options unreadably.**

    Your choice: meditation,diaphragmatic breathing,nsdr,prayer,a quiet walk

`STRESS_OPTIONS.join(',')` with no space, then `.toLowerCase()` over the whole
string, which also turned the acronym NSDR into "nsdr". Now:

    Your choice: Meditation, Diaphragmatic breathing, NSDR, Prayer, A quiet
    walk, or anything else deliberately calming. Five quiet minutes counts —
    it does not have to be formal practice.

**A flag describing a feature that does not exist.** Hard Mode's `fl_photo`
carries `photoCapture: true`, commented as "the daily panel renders a real
camera/upload control". Nothing in the app reads that flag and no such control
exists. Left in place — removing it is a separate decision about whether the
feature is still wanted — but the Progress Photo guide is written on the truth:
Forge does not ask for the photo and does not store it.

---

## 4. How an attempt already running gets any of this

Descriptions and guide ids are stored on the attempt's own task list at the
moment a challenge starts, so a challenge already underway would otherwise show
none of it until the next one.

Forge already has the mechanism for exactly this: `template_version`. Fat Loss
goes 3 → 4 and Mental Training 6 → 7, which makes "Template update available"
appear in Challenges with an explicit **Update template tasks** button. It
refreshes the template-owned tasks, keeps custom tasks, and touches no start
date, day record, XP figure or archive. It is the user's choice and it is the
path the suite already covers.

The configured challenges — Energy Reset, Muscle Building, Hormone Health,
LOCK IN — have no template version to bump, so their new Daily Log guide
reaches new attempts only. Their descriptions were already complete, so nothing
is lost mid-challenge.

---

## 5. Flagged — seven decisions that are yours, not mine

Each one states the rule as it exists today, what is ambiguous about it, and a
recommended wording. **None has been applied**, and none of these habits has
been given a guide, because a guide's "How to complete it" would settle the
question by default.

New since the first pass: Hard Mode turns out to have already answered two of
these in its own words. That does not make the decision mine, but it does mean
two of them are now "apply Forge's existing sentence to the other modes" rather
than "invent a rule".

### 1. `mt_mind` — "Mental Training — 2 / 5 / 10 minutes"

**The rule today.** The task carries no description at all. The only statement
of what it means is the challenge's own rationale copy:

> "A few focused minutes of **breathwork, meditation, or prayer** each day is
> what actually rewires your baseline calm and self-control."

Its habit key is `MEDITATION`, labelled "Meditation / mental training".

**The ambiguity.** You suggested "Practice meditation, mindfulness, or mental
visualization for 5 minutes." Against the rule as written, that changes it in
both directions:

- **Breath meditation** — qualifies. Breathwork is named explicitly.
- **Mindfulness** — qualifies. It is a form of meditation and the habit key is
  `MEDITATION`.
- **Mental visualization** — **is not in the current rule anywhere.** Adopting
  that wording would add it.
- **Prayer** — **is** in the current rule, and that wording drops it.

Prayer dropping out matters twice over, because Mental Training also has a
separate `mt_prayer` habit worth 40 XP. If prayer satisfies `mt_mind` as well,
one session ticks two habits — which may be intended, or may be an overlap
nobody noticed.

**Recommended wording** — keeps the rule exactly as it stands:

> Five focused minutes of breathwork, meditation, or prayer. Sitting quietly
> and following your breath counts.

**Decide:** (a) take the recommendation, (b) add visualisation deliberately,
(c) also rule on whether prayer can satisfy both this and `mt_prayer`.

### 2. `fl_whole` — "Eat mostly whole foods (80%+ / 90% / ~90%)"

**The rule today.** In Beginner and Standard the percentage appears in the
habit's name and nowhere else; 80% of *what* is never defined.

**Hard Mode has already answered it**, on the card:

> "Roughly nine meals in ten minimally processed. Not a ban list — the
> remaining 10% is deliberate room, not a failure."

So the unit Forge means is **meals**, not calories and not plate volume.

**Recommended wording** for Beginner and Standard — Hard Mode's own sentence,
with the percentage following the mode:

> Roughly eight meals in ten minimally processed. Not a ban list.

**Decide:** whether to apply Hard Mode's reading to the other two modes. If you
meant calories, the wording — and arguably the habit — is different.

### 3. `fl_water` — "Hit water goal"

**The rule today.** There is **no water goal anywhere in the codebase.** No
field on the profile, no default, no setting. The habit asks you to hit a
target Forge never defines or stores.

**Hard Mode has already answered this one too:** "Your usual target. Not a
weight-manipulation tool." Hormone Health says much the same — "Your normal
daily hydration target. No special salt, trace minerals or electrolyte
products required."

**Recommended wording** for Beginner and Standard:

> Your usual daily target. Not a weight-manipulation tool.

**Decide:** (a) take that wording, (b) make the goal a real configurable field
in Fat Loss setup, or (c) rename the habit to something self-defining.

### 4 & 5. `fl_sleep` and `mb_sleep` — "Sleep 7.5+ hours" / "Sleep 8+ hours"

**The rule today.** Both carry a numeric target and no description. Neither
says whether it means hours **in bed** or hours **asleep** — a difference of
roughly 45 minutes for most people, on a keystone habit.

Forge has already answered this elsewhere. LOCK IN and Energy Reset both call
it *sleep opportunity* and say so on the card: "Time in bed and a consistent
wake time. The opportunity is what counts — not whether every hour was
perfect."

**Recommended wording** — makes Fat Loss and Muscle Building agree with the
other two challenges:

> Time in bed, not time asleep. Give yourself the opportunity and keep the
> wake time steady.

**Decide:** whether to align all four challenges on sleep opportunity. This is
the one flag where doing nothing leaves two challenges quietly measuring
something different from the other two.

### 6. `mt_reading` — does an audiobook count? *(new)*

**The rule today.** "Read 2 / 5 / 10 pages", and the description says a book
you are actually reading, any book counts. "Any book" settles the *genre*
question and says nothing about *medium* — and an audiobook has no pages, so
the target itself does not transfer.

Flagged rather than decided: the guide says what the rule says, and leaves the
medium open. Two clean answers exist —

> (a) Pages of a book you are reading. Audiobooks do not count towards this
> one.
> (b) Pages, or the equivalent listening time if you are using an audiobook.

**Decide:** (a), (b), or leave it genuinely open.

### 7. Should the Daily Log have a guide at all? *(new — and I reversed myself)*

**The rule today.** Forge has a standing decision that the Daily Log is
infrastructure rather than something to teach. It is kept out of the Habit
Library, its row is not tappable into a guide, its `guideId` is explicitly
`null`, and three separate suites assert all of that in those words: *"the
Daily Log has no guide — it is infrastructure, not a habit to teach"*.

**What I did, and undid.** I wrote it one anyway — it is the habit people most
often skip as bookkeeping, and the one whose absence does the most damage,
since the ratings it collects are what the challenge score, Insights and every
correlation Forge can offer are read from. The regression suite caught it
immediately: adding the guide would have put a GUIDE button on the Daily Log of
every challenge at once and listed it in the Habit Library, both of which the
existing decision forbids. So it is reverted, and the suite now asserts the
absence from the new side as well.

**Decide:** (a) leave the standing decision alone, (b) give the Daily Log a
guide — which means the Habit Library gains a non-habit entry and three
assertions change on purpose, or (c) something narrower, such as explaining
what the ratings feed in the log card itself rather than in a guide.

---

## 6. Safeguards

No challenge requirement, XP figure, rank, attempt, archive, profile or
notification is changed by any of this. Descriptions and guides are
display-only: a description restates the rule, it never becomes the rule. The
flagged habits are left blank rather than guessed at.

Three regression checks hold the line:

- **`habit-guides-unit-test.mjs`** — every `guideId` on every task of every
  challenge resolves to a real, complete guide; every guide has every field
  `HabitGuide` renders; every strategy carries an evidence label; the
  mode-dependent guides point at the habit row rather than a hardcoded figure;
  and **no habit on the flagged list has been given a guide** — nor the Daily
  Log — so settling one of those questions has to be a deliberate edit to that
  list.
- **`today-redesign-e2e-test.mjs` 16.6** — nothing that stops propagation may
  sit at the centre of any habit row, and a tap there completes the habit.
- **`no-attribution-unit-test.mjs`** — the removal of every external-personality
  attribution still holds, in source and in the built bundle. The new guides
  are written in Forge's own voice and name nobody.
