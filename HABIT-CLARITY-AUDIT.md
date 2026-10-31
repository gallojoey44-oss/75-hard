# Habit clarity — the audit, the decisions, and what changed for whom

Every habit a Forge challenge can put on the Today screen, whether a person
reading that row at 7am can tell what to do, and — for the habits whose rule
was genuinely undefined — which attempts the settled rule applies to.

Read from the registry itself, by enumerating every startable challenge, every
difficulty mode, and the builders the configured challenges construct their
attempts with. Fat Loss Hard Mode is listed as its own challenge because it
builds its own habit list rather than reusing the template's.

---

## 1. Coverage

| Challenge | Habits | Described | With a guide |
|---|---:|---:|---:|
| Fat Loss Challenge | 8 | 8 | 6 |
| Fat Loss — Hard Mode | 8 | 8 | 6 |
| Mental Training Phase | 7 | 7 | 5 |
| Muscle Building | 6 | 6 | 5 |
| Women's Hormone Health | 6 | 6 | 3 |
| Energy Reset | 9 | 9 | 6 |
| LOCK IN | 9 | 9 | 8 |
| **Total** | **53** | **53** | **39** |

Counted on an attempt started today. An attempt started before the rules were
settled sees slightly fewer — that is the whole point of section 4, and the
difference is exactly the four habits listed there.

Before any of this work: 37 described, 8 with a guide, and guides existed for
one challenge out of seven.

**The habits with no guide, and why.** The Daily Log in all seven challenges
(Forge's standing decision that it is tracking, not teaching — see decision 7);
`mt_prayer`, where the description says it plainly and optimising somebody's
prayer with evidence tags is not Forge's business; and five habits that say
what they need to in one line, where a five-section article would be padding:
the step targets in Energy Reset and Hormone Health, the two hydration habits
there, and Fat Loss's water goal.

---

## 2. Guides

Seventeen new guides across four challenges, in the same shape as the LOCK IN
ones, which already carried the five sections asked for:

| Asked for | Guide field |
|---|---|
| How to perform it | `quickStart[]`, `how.requirement` |
| Concrete valid examples | `examples[]` — two worked days per guide |
| Exact completion criteria | `how.requirement`, `how.earns[]`, `how.notes` |
| Strategies and benefits | `why{}`, `optimize[]`, `advanced[]` |
| Common mistakes | `mistakes[]` |

- **Fat Loss** (`fatLossGuides.js`) — Protein Target, Daily Steps, Stop at ~90%
  Fullness, Progress Photo, Sleep Opportunity, Mostly Whole Foods.
- **Mental Training** (`mentalTrainingGuides.js`) — Mental Training,
  Phone-Free Focus Block, Daily Reading, Daily Gratitude, Short Physical Reset.
- **Muscle Building** (`muscleBuildingGuides.js`) — Protein Target, Nutrition
  Target, Carb Target, Sleep Opportunity, Daily Recovery Practice.
- **Energy Reset** (`energyResetGuides.js`) — Sleep Opportunity, Morning Light,
  Nutrient-Dense Whole Foods, Deliberate Caffeine, Downshifting, Evening
  Wind-Down.
- **Women's Hormone Health** (`hormoneHealthGuides.js`) — Sleep & Consistency,
  Mostly Whole Foods, Down-Regulation. Written more modestly than the rest:
  nothing in it diagnoses anything, and where the honest answer is "that is
  worth raising with a doctor", that is what it says.

Two rules every guide is written under, because a guide's "How to complete it"
**is** the challenge's contract with the person reading it:

1. The requirement restates what the challenge already enforces and never adds
   a condition. Where a figure comes from the mode or from the person's own
   setup — 2/5/10 pages, 30/60/90 minutes, 6/8/10k steps, the calorie target,
   the carb grams — the guide points at the number on the habit row rather than
   naming one. A guide that hardcodes "8,000" is wrong for two thirds of its
   readers, and a regression check now fails if one does.
2. A habit whose rule had never been stated gets no guide until the rule is
   settled, and then only on attempts started under it.

---

## 3. The versioning question

**You asked whether bumping `template_version` was necessary to deliver
descriptions and guides. It was not, and it is reverted.** Fat Loss is back on
3 and Mental Training on 6; no "Template update available" prompt appears, and
nothing offers to rewrite an active challenge's requirements.

The reason it looked necessary: `desc` and `guideId` are stored on the
attempt's own task list when a challenge starts, alongside the id, name, XP,
target and keystone weight. Freezing the whole list at start time is
deliberate — a later rebalance must never change what a running challenge is
worth. But two of those stored fields are not part of the attempt's definition
at all. One is a sentence explaining the rule; the other points at an article.

So those two are now resolved when the row is DRAWN, from the live challenge
definition, by `data/habitPresentation.js`. The boundary is exact: only `desc`
and `guideId` are ever replaced, nothing is written back to storage, and the
scoring path deliberately reads the stored list rather than the presented one.

The effect, proved end to end against a seeded attempt whose stored tasks carry
no descriptions and no guide references at all:

- the rows show the new text and the Guide buttons;
- `profiles.me.tasks` in localStorage is identical before and after;
- XP, keystone weights and targets are untouched;
- no update prompt appears anywhere in Challenges.

A support challenge is resolved against **its own** attempt, not the primary's,
since the two can be on different rule versions.

One limitation, stated plainly: the configured challenges — Energy Reset,
Muscle Building, Hormone Health, LOCK IN — build their habit text from the
setup form, with the person's own figures in it, and that setup is not stored
in a form this can replay. So for those four, descriptions stay exactly as the
attempt recorded them and only the guide is refreshed. Their descriptions were
already complete, so nothing is lost.

---

## 4. Your seven decisions — what changed, and for whom

Where a decision changes what completing a habit means, it applies to
**attempts started from now on**. An attempt already running, and every
archived one, keeps the reading it was started under, for life. That is
enforced by a version stamped on the attempt itself (`data/habitRules.js`),
not by a date, a migration or a prompt. Nothing is rewritten and nobody is
asked to update anything.

### Purely informational — applies to every attempt, old and new

These state a rule that already existed. None of them changes what completing
the habit requires.

| Decision | What a row now says |
|---|---|
| **2. `fl_water`** | "Your usual daily hydration target. Not a weight-manipulation tool." No number is shown, because no Fat Loss setup field stores one — Hard Mode and Hormone Health already used this exact wording. |
| **6. `mt_reading`** | "N pages of a book you are reading. Paper or ebook — any book counts." The guide adds: an audiobook does not satisfy a page target on its own, and a listening alternative would need its own measurable rule. |
| **7. Daily Log** | "Save at least one metric — it completes itself and awards XP once." No guide, per your decision and Forge's existing one. |

### Versioned — new attempts only

| Decision | Version 1 attempts (already running) | Version 2 attempts (started from now) |
|---|---|---|
| **1. `fl_whole`** | Unchanged: the percentage in the habit name, no sentence. | "Roughly eight/nine meals in ten minimally processed. Not a ban list." The unit is **meals**, following Hard Mode's existing wording, and the percentage follows the mode. Hard Mode keeps its own sentence — a version states a difference, not a replacement. Gains the Mostly Whole Foods guide. |
| **3. `mt_mind`** | "Breathwork, meditation or prayer. Following your breath quietly counts." — the rule exactly as the challenge's own rationale copy states it. Prayer eligibility intact. No guide. | "Meditation, mindfulness, breathwork or visualization." Prayer moves out, because Mental Training has a separate Prayer habit worth its own XP and one practice should not tick two requirements meant to be separate. Gains the Mental Training guide. |
| **4. `fl_sleep`** | Unchanged: a number and no sentence. | "Hours set aside to sleep, lights out — not time in bed on your phone." Gains the Sleep Opportunity guide. |
| **5. `mb_sleep`** | Unchanged. | Same wording, same guide. |

**Two judgement calls inside those, worth your eye.**

*`fl_whole` was versioned rather than treated as informational.* The percentage
is unchanged and Hard Mode already said "meals", so it could be argued either
way — but in Beginner and Standard the unit had never been stated anywhere, so
stating it creates a rule where somebody might have been reading a different
one. Versioning it is the conservative choice. Flipping it to informational is
a one-line change if you would rather everyone saw it.

*`mt_mind` version 2 drops prayer and keeps breathwork.* You asked for
meditation, mindfulness and visualization to be eligible, for existing prayer
eligibility to stay intact, and to avoid counting one practice twice where
separate requirements are intended. Read together, that points at prayer moving
to its own habit for new attempts. Breathwork stays because it is eligible
today and dropping it would narrow the rule without being asked for.

**Sleep Opportunity, as finally worded.** The hours are the ones you
*deliberately set aside* to sleep — lights out and genuinely trying. That is
narrower than time in bed: an hour spent in bed on your phone, reading or
working is not part of the window. What is explicitly *not* required is falling
asleep, because how much of the window you sleep through is not something
anyone can decide. The mode's figure is untouched and stays on the row. Both
guides say all of this in "How to complete it", and both carry a worked example
of the distinction.

Energy Reset, Hormone Health and LOCK IN keep their own sleep wording. Their
rules were already stated and were not among your decisions, so applying this
refinement to them would change what their existing attempts are being held to
— exactly the thing the versioning exists to prevent.

**On decision 5's second clause** — nothing auto-completes a sleep habit from
logged hours, and nothing ever did. The Daily Log completes itself when any one
metric is saved, and that is the only automatic completion in the app. Now
tested explicitly: nine hours logged ticks the Daily Log and nothing else.

**Flagged for later, per decision 4.** `fl_water` keeps "Your usual daily
hydration target. Not a weight-manipulation tool." and names no figure, because
no configured numeric target exists anywhere in Forge — no profile field, no
default, no setting. Giving Fat Loss a hydration target at setup, the way it
configures protein, is a real improvement and is recorded as one in the source
beside the habit. Nothing invents a universal number in the meantime.

---

## 5. Verifying that nothing misrepresents its original rule

Four ways a description or guide could tell somebody a rule they were not
started under, each now checked rather than assumed:

1. **A version could ship new wording at version 1**, reaching every attempt
   ever started. Version 1 entries are asserted to add nothing of their own.
   `mt_mind` is the single listed exception, because its version 1 text
   restates the rule the challenge's own rationale copy already stated — and
   adding a second name to that list has to be an argued decision.
2. **A version entry could be inert**, in which case the new rule is reaching
   version 1 attempts by some other route. Every versioned habit is asserted to
   actually differ between versions.
3. **A guide for a new rule is readable in the Habit Library** by somebody whose
   attempt is on the old one — the library is deliberately independent of
   enrolment. Every guide a version introduces is asserted to say, in its own
   completion rules, which attempts it describes.
4. **A guide could name a figure the row contradicts.** Guides shared by rows
   that disagree about the number must not name one, and guides whose habits
   are built from the setup form must send you to the row.

That fourth check found a real case. The Fat Loss protein guide stated
"0.8–1 g per pound of your goal body weight" — true in Beginner and Standard,
but Hard Mode lets you choose a **fixed daily gram figure** instead, and for
anyone on that setting the guide was describing a rule that was not theirs. The
requirement now names both routes and points at the row.

A full side-by-side of every guide's stated requirement against the habit rows
that open it was read by hand as well; nothing else disagreed.

---

## 6. Four defects found while auditing

**A tap in the middle of a habit row stopped completing the habit.** Adding a
description to "Walk 8,000+ steps" pushed it to three lines, which put "Show
full requirement" and its 44px touch area in the dead centre of the row. Every
control inside a row stops propagation, so tapping the middle expanded the text
and awarded nothing. Which rows collided was luck of layout and depends on
device width, so the fix is structural: the disclosure moved into the row's
right-hand column, which is at the row's edge and can never contain its centre.
A regression check now asserts that geometrically.

**Then the relocated control swallowed taps meant for the Guide button.** The
right-hand column is too narrow to stack two 44px touch targets without them
overlapping, and the disclosure's hit area sat over the Guide chip. So a habit
with a guide shows no disclosure, and the guide carries the habit's own
sentence in full at the top of "How to complete it" — which is where the rest
of a clamped description now lives. Found by the screenshot run, not by a
person.

**Two habits rendered their own options unreadably.** Energy Reset's
down-regulation habit printed `meditation,diaphragmatic breathing,nsdr,prayer`
— no spaces, and the whole string lowercased, which turned the acronym NSDR
into "nsdr". Muscle Building's recovery habit had the same defect. Both now
read properly.

**A flag describing a feature that does not exist.** Hard Mode's `fl_photo`
carries `photoCapture: true`, commented as "the daily panel renders a real
camera/upload control". Nothing in the app reads that flag and no such control
exists. Left in place — removing it is a separate decision about whether the
feature is still wanted — and the Progress Photo guide is written on the truth:
Forge does not ask for the photo and does not store it.

---

## 7. Safeguards

No challenge requirement, XP figure, rank, attempt, archive, profile or
notification is changed by any of this. Descriptions and guides are
display-only: a description restates the rule, it never becomes the rule.

- **`habit-guides-unit-test.mjs`** — every `guideId` on every task of every
  challenge resolves to a real, complete guide; every guide has every field
  `HabitGuide` renders; every strategy carries an evidence label; the
  mode-dependent guides point at the habit row rather than a hardcoded figure;
  no habit on the undefined-rule list has acquired a guide; a new attempt is
  stamped with the current rules version and an unstamped one is version 1 for
  life; and the presentation layer replaces `desc` and `guideId` and provably
  nothing else, never mutating the stored list.
- **`habit-clarity-e2e-test.mjs`** — an attempt whose stored tasks carry no
  text at all shows the new descriptions and guides, with localStorage
  unchanged and no update prompt anywhere; version 1 and version 2 attempts of
  the same challenge show different sleep rules in the same build; opening,
  expanding and reading a guide completes nothing and moves no XP, while
  ticking from inside it does; nine hours logged ticks the Daily Log and
  nothing else; every startable challenge offers guides with no external
  personality named in them; and the reading and focus-block targets stay
  correct at all three difficulties.
- **`today-redesign-e2e-test.mjs` 16.6** — nothing that stops propagation may
  sit at the centre of any habit row, and a tap there completes the habit.
- **`no-attribution-unit-test.mjs`** — the removal of every external-personality
  attribution still holds, in source and in the built bundle. All seventeen new
  guides are written in Forge's own voice and name nobody.
