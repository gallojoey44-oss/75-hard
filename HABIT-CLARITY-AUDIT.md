# Habit clarity — the audit

Every habit a Forge challenge can put on the Today screen, and whether a person
reading that row can tell what to do.

Read from the registry itself, by enumerating every startable challenge, every
difficulty mode, and the builders the configured challenges construct their
attempts with. 45 habits across 6 challenges.

---

## What the Today row already gives us

`CheckItem` renders four things, and all four already exist:

| Part | Field | Status |
|---|---|---|
| The habit name | `task.name` | present on every habit |
| The measurable requirement | `task.name` + `task.target` | present where there is a number |
| A short description | `task.desc` | **this was the gap** |
| A GUIDE button | `task.guideId` | **present on 8 of 45** |

So this is a content job, not a UI rebuild. The row clamps `desc` to two lines
and offers "Show full requirement" when it does not fit, so a longer
description costs nothing in height.

---

## Coverage before

| Challenge | Habits | Described | With a guide |
|---|---:|---:|---:|
| Fat Loss Challenge | 8 | 1 | 0 |
| Muscle Building | 6 | 4 | 0 |
| Mental Training Phase | 7 | 1 | 0 |
| Women's Hormone Health | 6 | 5 | 0 |
| Energy Reset | 9 | 9 | 0 |
| LOCK IN | 9 | 9 | 8 |
| **Total** | **45** | **29** | **8** |

16 habits showed a blank line where the description belongs. Fat Loss and
Mental Training — two of the three most-started challenges — were almost
entirely blank.

## Coverage after this change

| Challenge | Habits | Described | With a guide |
|---|---:|---:|---:|
| Fat Loss Challenge | 8 | 5 | 0 |
| Muscle Building | 6 | 5 | 0 |
| Mental Training Phase | 7 | 6 | 0 |
| Women's Hormone Health | 6 | 6 | 0 |
| Energy Reset | 9 | 9 | 0 |
| LOCK IN | 9 | 9 | 8 |
| **Total** | **45** | **40** | **8** |

The five still blank are the five flagged below. They are blank on purpose:
each one would require inventing a rule that does not exist in the data, and
an invented rule silently changes what people are being scored against.

---

## Descriptions added

Each one restates a rule that already exists. None of them changes what
completing the habit requires.

**Fat Loss**

- `fl_photo` — One photo of yourself today. Same spot, same light, same time of
  day is what makes the week-to-week comparison worth looking at.
- `fl_protein` — Goal weight in pounds × 0.8–1 = grams of protein for the day.
  A 170 lb goal is roughly 140–170 g.
- `fl_steps` — Steps across the whole day, not one walk. Ten minutes of walking
  is roughly a thousand of them.

**Mental Training** (the page count and block length follow the chosen mode)

- `mt_reading` — 5 pages of a book you are actually reading. Any book counts.
- `mt_prayer` — A few deliberate moments of prayer, in whatever form that takes
  for you.
- `mt_gratitude` — Write down one thing you are grateful for. One line is
  enough — the writing is the point.
- `mt_focus` — One unbroken block with your phone in another room. Not 60
  minutes added up across the day.

**Every challenge**

- `daily_log` — Rate the day on the Today screen. These ratings are what
  Insights and your challenge score are read from.

  This one habit was blank in four separate places: the shared
  `DAILY_LOG_TASK`, and again in Muscle Building's and Hormone Health's own
  builders, which construct their own copy.

---

## Two defects found while auditing

**Energy Reset's down-regulation habit rendered its own options unreadably.**

    Your choice: meditation,diaphragmatic breathing,nsdr,prayer,a quiet walk

`STRESS_OPTIONS.join(',')` with no space, then `.toLowerCase()` over the whole
string, which also turned the acronym NSDR into "nsdr". Now:

    Your choice: Meditation, Diaphragmatic breathing, NSDR, Prayer, A quiet
    walk, or anything else deliberately calming. Five quiet minutes counts —
    it does not have to be formal practice.

**Muscle Building's protein habit is 221 characters**, so the card clamps it
and the rest is behind "Show full requirement". Nothing is lost, but it is the
one description long enough that the detail belongs in a guide instead. Left
as it is until Muscle Building has a guide to move it into.

---

## The remaining gap: guides

37 of 45 habits have no GUIDE button, because guides exist only for LOCK IN.
The registry is already challenge-agnostic — a challenge gets guides by adding
its module to `habitGuides.js` — so this is content, not plumbing.

The LOCK IN guides are good and already carry the five sections asked for:

| Asked for | LOCK IN guide field |
|---|---|
| Practical options | `examples[]`, `quickStart[]` |
| Step-by-step | `quickStart[]`, `how.requirement` |
| Exactly what counts | `how.requirement`, `how.earns[]`, `how.notes` |
| Benefits and strategies | `why{}`, `optimize[]`, `advanced[]` |
| Common mistakes | `mistakes[]` |

So the work is to write guides in that shape for the other challenges, not to
design anything. Suggested order, vaguest requirement first:

1. **Mental Training** — `mt_mind` above all (see the flag), then `mt_focus`.
2. **Fat Loss** — `fl_whole`, `fl_protein`, `fl_photo`.
3. **Energy Reset** — `er_stress`, `er_caffeine`, `er_winddown`.
4. **Hormone Health** — `hh_stress`, `hh_whole_food`.
5. **Muscle Building** — `mb_protein`, `mb_carbs`, `mb_recovery`.

---

## Flagged — five habits whose rules are genuinely undefined

Each one states the rule as it exists today, what is ambiguous about it, and a
recommended wording. None has been applied.

### 1. `mt_mind` — "Mental Training — 2 / 5 / 10 minutes"

**The rule today.** The task carries no description at all. The only statement
of what it means is the challenge's own rationale copy:

> "A few focused minutes of **breathwork, meditation, or prayer** each day is
> what actually rewires your baseline calm and self-control."

Its habit key is `MEDITATION`, labelled "Meditation / mental training".

**The ambiguity, and why it matters for your example.** You suggested
"Practice meditation, mindfulness, or mental visualization for 5 minutes."
Against the rule as written, that changes it in both directions:

- **Breath meditation** — qualifies. Breathwork is named explicitly.
- **Mindfulness** — qualifies. It is a form of meditation and the habit key is
  `MEDITATION`.
- **Mental visualization** — **is not in the current rule anywhere.** Adopting
  your wording would add it.
- **Prayer** — **is** in the current rule, and your wording drops it.

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

**The rule today.** The percentage appears in the habit's name and nowhere
else. 80% of *what* is never defined — meals, calories, or plate volume.

**Recommended wording:**

> Roughly 8 in 10 of the things you eat today are minimally processed. It is a
> judgement call, not a calculation.

**Decide:** whether "8 in 10 things you eat" is the intended reading. If you
mean calories, the wording — and arguably the habit — is different.

### 3. `fl_water` — "Hit water goal"

**The rule today.** There is **no water goal anywhere in the codebase.** No
field on the profile, no default, no setting. The habit asks you to hit a
target Forge never defines or stores.

This is the one flag that may be a missing feature rather than missing words.

**Recommended wording, if the goal stays implicit:**

> Your own daily water target. If you do not have one, roughly 2–3 litres is a
> reasonable default for most people.

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
other two challenges, which is the reading they almost certainly already
intend:

> Time in bed, not time asleep. Give yourself the opportunity and keep the
> wake time steady.

**Decide:** whether to align all four challenges on sleep opportunity. This is
the one flag where doing nothing leaves two challenges quietly measuring
something different from the other two.

---

## Safeguards

No challenge requirement, XP figure, rank, attempt, archive, profile or
notification is changed by any of this. Descriptions are display-only: a
description restates the rule, it never becomes the rule. The flagged five are
left blank rather than guessed at.
