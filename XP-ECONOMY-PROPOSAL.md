# Forge — XP Economy Audit & Proposed Rebalance

**Status: proposal awaiting approval. No XP value, rank threshold or stored balance has been changed.**

Every current-system figure below was computed by running the app's real
`computeTotalXP` over synthetic day records, not read off the source or
estimated. Proposed figures come from the model in §4, solved against the
one-year benchmark.

---

## 1. Headline finding

Your instinct about Mental Training is right, and the problem is larger than
one template.

| | per day | one attempt | reaches Unbreakable |
|---|---|---|---|
| **Benchmark you want** | 27.4 XP | — | **day 365** |
| 75 Hard (Male profile) | 203.4 XP | 15,255 XP | **day 50** |
| 75 Hard (Female profile) | 263.4 XP | 19,755 XP | **day 38** |
| Mental Training, standard 7d | 405.7 XP | 2,840 XP | **day 25** |
| Forge Daily alone, no challenge | 133.1 XP | — | **day 76** |

**The economy is roughly 7–15× too generous.** A single perfect 75 Hard attempt
awards 15,255 XP — **153% of the entire rank ladder**. One perfect week of
Mental Training awards 2,840 XP, 28% of the ladder. Over 365 days of perfect
75 Hard a Male profile accrues **72,225 XP**, 7.2× the ladder; a Female profile
**94,125 XP**, 9.4×.

Rank thresholds are currently crossed like this on perfect 75 Hard:

| Rank | XP | Reached on day |
|---|---|---|
| Apprentice | 250 | 2 |
| Disciplined | 750 | 4 |
| Resilient | 1,500 | 8 |
| Warrior | 3,000 | 15 |
| Elite Warrior | 5,000 | 25 |
| True Warrior | 7,500 | 37 |
| Unbreakable | 10,000 | **50** |

---

## 2. Audit of the current system

### 2.1 The XP sources that exist today

| Source | Value | Where |
|---|---|---|
| Task completed | `task.xp`, else 15 if in `HIGH_VALUE_TASK_IDS`, else 10 | `getTaskXP` |
| All tasks complete | **+50** | `computeDayXP` |
| All five ratings logged | **+10** | `computeDayXP` |
| Mental training section | **+15** | `computeDayXP` |
| Faith reflection | **+10** | `computeDayXP` |
| Minimum Warrior Day complete | **+25** | `computeDayXP` |
| Bonus Missions | sum of `bonusDone` — **uncapped** | `getBonusXP` |
| Streak milestones | 3d +30, 7d +100, 14d +250, 30d +750 (**1,130 per streak**) | `computeStreakEvents` |
| Streak break | −30 (once, if streak ≥ 3) | `computeStreakEvents` |
| Comeback | +20 started, +100 completed | `computeComebackXP` |
| Weekly requirements | per-session XP, Fat Loss only | `weeklyRequirements` |
| Completion bonus | `completionBonusXP`, gated on pass + keystone adherence | `computeTotalXP` |
| Whole day missed | **−25 flat** | `computeDayXP` |
| Task missed | `min(xp × 0.25, 12)`, ×0.3 if MWD done | `taskMissPenalty` |
| Per-day loss cap | −80 | `computeDayXP` |

### 2.2 Why the totals diverge so far

Three structural causes, in order of impact:

**(a) XP scales with task count, not difficulty.** Nothing caps a challenge's
daily total. A template with 13 tasks earns more than one with 7 regardless of
how hard either is.

**(b) Two XP schemes coexist.** Legacy tasks (75 Hard) have no `xp` field and
fall back to the flat 10/15 scheme. Newer templates set explicit per-task XP
that is far larger — Mental Training's `mt_mind` alone is **100 XP**, more than
75 Hard's entire 7-task daily slate (95 XP). The reference challenge is on the
old, cheap scheme; everything built since is on the new, expensive one.

**(c) Day-level bonuses are flat, so they dominate cheap days and compound.**
+50 perfect-day and +10 ratings add 60 XP to every single day, over twice
75 Hard's keystone workout task.

### 2.3 Per-challenge current state (engine-computed, perfect adherence)

`task/d` = required-task XP per day. `TOTAL` = whole perfect attempt including
streaks and completion bonus. `→UNBR` = days to 10,000 XP repeating that challenge.

| Challenge | mode | days | task/d | bonus | TOTAL | XP/day | →UNBR |
|---|---|---|---|---|---|---|---|
| 75 Hard (Male) | standard | 75 | 95 | 2,500 | 15,255 | 203.4 | 50 |
| 75 Hard (Female) | standard | 75 | 155 | 2,500 | 19,755 | 263.4 | 38 |
| Mental Training | beginner | 7 | 260 | 400 | 2,770 | 395.7 | 26 |
| Mental Training | standard | 7 | 270 | 400 | 2,840 | 405.7 | 25 |
| Mental Training | hard | 7 | 280 | 400 | 2,910 | 415.7 | 25 |
| Mental Training | standard | 14 | 270 | 400 | 5,400 | 385.7 | 26 |
| Mental Training | standard | 21 | 270 | 400 | 7,710 | 367.1 | 28 |
| LOCK IN | configured | 14 | 212 | 700 | 4,888 | 349.1 | 29 |
| LOCK IN | configured | 30 | 212 | 1,500 | 10,790 | 359.7 | 28 |
| LOCK IN | configured | 90 | 212 | 4,500 | 30,110 | 334.6 | 30 |
| Fat Loss | beginner | 30 | 165 | 500 | 8,380 | 279.3 | 36 |
| Fat Loss | standard | 30 | **165** | 500 | 8,380 | 279.3 | 36 |
| Fat Loss | hard | 30 | 200 | 500 | 9,430 | 314.3 | 32 |
| Energy Reset | configured | 30 | 182 | 1,400 | 9,790 | 326.3 | 31 |
| Muscle Building | configured | 60 | 150 | 900 | 14,630 | 243.8 | 42 |
| Hormone Health | configured | 84 | 145 | 1,200 | 19,550 | 232.7 | 43 |
| Forge Daily | baseline | ∞ | 70 | — | 48,580/yr | 133.1 | 76 |

**Mental Training at 405.7 XP/day is exactly double 75 Hard's 203.4**, while
75 Hard is rated `Hard` and Mental Training `Medium`. The difficulty ranking
and the XP ranking are inverted.

---

## 3. Inconsistencies and exploits found

### 3.1 Streak-break farming — severe, pays +920 XP

The streak ladder (1,130 XP total) fires **once per streak**, not once per
attempt. Breaking a streak re-arms the entire ladder. Measured:

| 62 days of 75 Hard | gained | lost | net |
|---|---|---|---|
| Unbroken | 10,740 | 0 | 10,740 |
| **Day 31 deliberately skipped** | 11,715 | 55 | **11,660** |

**Skipping one day is worth +920 XP net.** A user who skips every 31st day
earns substantially more than one with perfect adherence. This is the single
worst exploit in the system and it rewards exactly the behaviour Forge exists
to discourage.

### 3.2 Same challenge, different profile, different XP

75 Hard has **no `start_tasks` in any of its three variants** — all three are
descriptive strings. It therefore runs on whichever default task list the
profile carries:

- Male profile: 7 tasks → 95 XP/day → 15,255 per attempt
- Female profile: 13 tasks → 155 XP/day → 19,755 per attempt

**+29% for the identical challenge**, decided purely by task count.

### 3.3 Difficulty mode has no effect in Fat Loss

Fat Loss `beginner` and `standard` both award 165 XP/day — identical task
lists with different targets. Beginner does not earn less than Standard
anywhere in that template.

### 3.4 Short challenges pay a higher bonus rate

Completion bonus per day of challenge:

| Challenge | bonus | days | XP/day |
|---|---|---|---|
| Mental Training 7d | 400 | 7 | **57.1** |
| Mental Training 21d | 400 | 21 | 19.0 |
| LOCK IN 7d | 350 | 7 | 50.0 |
| Energy Reset 30d | 1,400 | 30 | 46.7 |
| Fat Loss 14d | 200 | 14 | 14.3 |
| 75 Hard 75d | 2,500 | 75 | 33.3 |

Mental Training's bonus is flat 400 at every duration, so **the 7-day option
pays 3× the per-day rate of the 21-day option**. Repeatedly running the
shortest option is the optimal strategy.

### 3.5 Bonus Missions are uncapped

`getBonusXP` sums `bonusDone` with no ceiling. Mental Training offers 6
missions totalling 105 XP/day — on top of 270 task XP. Optional XP can reorder
the difficulty ranking.

### 3.6 Double-paid actions

- **All five ratings +10** is paid on top of the `daily_log` task (10–20 XP)
  for the same act of filling in the Daily Log.
- **Mental training section +15** is paid on top of the required mental
  training task in challenges that have one.

### 3.7 Inactivity is nearly free

A missed day costs 25 XP against a perfect day worth 155–230 XP — **16%**. Your
own historical period is the illustration: 29 missed days cost −725 while a
*single* completed day returned +76. The penalty only looked large because
almost nothing was earned alongside it.

### 3.8 Forge Daily is a better XP source than most challenges

Forge Daily is the no-challenge baseline and awards 133 XP/day, clearing the
entire ladder in 76 days. It out-earns several real challenges per unit of
effort.

### 3.9 Already fixed, preserved here

- Forge Daily archives capping at 75 days (fixed, keep).
- Shared habits across Primary/Support lanes pay once via `habitKey` (verified
  correct, keep).
- The penalty ledger, rank floor, idempotent opt-in reconciliation and undo
  (shipped last change, untouched by this proposal).

---

## 4. Proposed economy

### 4.1 The model: a daily budget, not a pile of tasks

> **Difficulty sets a daily XP budget. Tasks divide that budget by weight.**

This is the structural fix. Adding a task splits the budget rather than
inflating it, so task count stops driving XP and §3.2 becomes impossible.

```
dailyBudget = TIER[challenge.difficulty] × MODE[selectedMode]
taskXP[i]   = dailyBudget × weight[i] / Σweight     (integer, sums exactly)
```

### 4.2 Proposed constants — one versioned module

```js
export const XP_ECONOMY = {
  version: 2,

  // Base daily task budget, by the challenge's own difficulty rating.
  tiers: { easy: 120, medium: 160, medium_hard: 180, hard: 200, elite: 220 },

  // User-selected mode. Deliberately narrow, so a Hard-mode medium challenge
  // can never out-earn a standard-mode hard one.
  modes: { beginner: 0.85, standard: 1.00, hard: 1.12 },

  // Day-level awards, as a fraction of that day's budget.
  perfectDayRate: 0.15,
  faithRate:      0.05,
  recoveryDayRate: 0.50,   // replaces the day's task XP, not added to it

  // Completion bonus = rate × budget × duration. Linear in duration, so the
  // bonus is worth the same per day at every length.
  completionRate: 0.20,

  // Once per attempt per milestone — never re-armed by breaking a streak.
  streakLadder: [
    { days: 3, xp: 20 }, { days: 7, xp: 50 }, { days: 14, xp: 80 },
    { days: 30, xp: 150 }, { days: 60, xp: 250 }, { days: 75, xp: 300 },
  ],
  streakBreakPenalty: 0,

  // Optional XP, capped so it cannot reorder the difficulty ranking.
  bonusPerDayRate:     0.10,   // of daily budget
  bonusPerAttemptRate: 0.05,   // of attempt task XP

  // Penalties, budget-relative so they stay proportionate at every tier.
  missedDayRate:  0.50,
  taskMissRate:   0.25,
  dayLossCapRate: 0.50,
  recoveryPenaltyMult: 0.3,

  comeback: { start: 20, complete: 100 },

  // Task weighting by keystone tier: what splits the budget.
  weights: { 3: 3.0, 2: 2.0, 1: 1.3, 0: 1.0 },
};

export const RANKS = [
  { rank: 1, name: 'Initiate',      minXP: 0 },
  { rank: 2, name: 'Apprentice',    minXP: 2500 },
  { rank: 3, name: 'Disciplined',   minXP: 7500 },
  { rank: 4, name: 'Resilient',     minXP: 15000 },
  { rank: 5, name: 'Warrior',       minXP: 30000 },
  { rank: 6, name: 'Elite Warrior', minXP: 50000 },
  { rank: 7, name: 'True Warrior',  minXP: 75000 },
  { rank: 8, name: 'Unbreakable',   minXP: 100000 },
];
```

**Why ×10 units (Unbreakable 100,000, not 10,000).** The benchmark fixes the
all-in daily average at 27.4 XP against a 10,000 ladder. Split across 8–9 tasks
that leaves fractional values (2.7 XP, 1.7 XP) and almost no room to
distinguish a keystone from a supporting habit. At ×10 the ratios are
identical, the benchmark is unchanged, and task XP lands on whole numbers in
the same familiar range you have now (40 / 27 / 18 / 13). Balances and
thresholds scale together, so nobody's relative position moves.

### 4.3 Difficulty tier assignments

| Challenge | Current rating | Proposed tier | Note |
|---|---|---|---|
| 75 Hard / 75-Day Discipline | Hard | **hard** | the reference challenge |
| Muscle Building | Medium/Hard | **medium_hard** | unchanged |
| Strength Phase | Medium/Hard | **medium_hard** | unchanged |
| Fat Loss | Medium | **medium** | unchanged |
| Mental Training | Medium | **medium** | unchanged rating; XP drops to match it |
| LOCK IN | Medium | **medium** | unchanged |
| Energy Reset | Medium | **medium** | unchanged |
| Women's Hormone Health | Medium | **medium** | unchanged |
| Sleep Reset | Easy | **easy** | unchanged |
| Recovery Phase | Easy | **easy** | unchanged |
| Forge Daily | (baseline) | **easy** | explicit tier instead of ad-hoc values |
| Custom Challenge | You decide | **medium** | capped at medium; see §6.4 |

No difficulty *rating* changes. What changes is that the ratings now actually
govern XP.

### 4.4 Benchmark verification

365 days of perfect 75 Hard = 4 complete 75-day cycles (300 days) + 65 days
into a 5th, so **4** completion bonuses, not 5.

```
daily budget                200
perfect-day bonus            30
task + perfect × 365     83,950
completion bonus × 4     12,000   (3,000 per cycle)
streak ladder             3,950
                        ───────
LIFETIME XP AT DAY 365   99,900      per day: 273.7
Unbreakable (100,000) reached on  →   DAY 366
```

| Rank | XP | Day reached |
|---|---|---|
| Apprentice | 2,500 | 10 |
| Disciplined | 7,500 | 28 |
| Resilient | 15,000 | 55 |
| Warrior | 30,000 | 110 |
| Elite Warrior | 50,000 | 183 |
| True Warrior | 75,000 | 275 |
| **Unbreakable** | **100,000** | **366** |

The curve is deliberately back-loaded: early ranks arrive quickly enough to
feel responsive, and the last two require most of the year.

### 4.5 Difficulty ordering holds

| tier | beginner | standard | hard |
|---|---|---|---|
| easy | 102 | 120 | 134 |
| medium | 136 | 160 | 179 |
| medium_hard | 153 | 180 | 202 |
| hard | 170 | 200 | 224 |
| elite | 187 | 220 | 246 |

**Hard-mode medium = 179/day < standard-mode hard = 200/day.** A hard mode
never out-earns a genuinely harder challenge, which is what you asked for.
Hard-mode `medium_hard` (202) does just edge standard `hard` (200) — if you
want strict separation, narrowing the hard multiplier to 1.08 removes it.

### 4.6 Completion bonus is duration-neutral

| duration | bonus | per day |
|---|---|---|
| 7d | 224 | 3.20 |
| 14d | 448 | 3.20 |
| 30d | 960 | 3.20 |
| 75d | 2,400 | 3.20 |
| 90d | 2,880 | 3.20 |

Constant per-day value at every length, so restarting short challenges gains
nothing (§3.4 closed).

---

## 5. Worked per-task tables

### 5.1 75 Hard — hard / standard — 200/day

| XP | Keystone | Task |
|---|---|---|
| 40 | ⭐⭐⭐ | 45-minute workout |
| 40 | ⭐⭐⭐ | Diet followed |
| 27 | ⭐⭐ | Sleep target |
| 27 | ⭐⭐ | Mental training |
| 18 | ⭐ | Water goal |
| 18 | ⭐ | 10 pages read |
| 17 | ⭐ | Complete Daily Log |
| 13 | | Progress photo |
| **200** | | **= daily budget** |

Perfect day **+30 → 230**. Missed day **−100**. Completion bonus **3,000**.
Perfect attempt **21,100**. This single task list replaces both profile
defaults, so 75 Hard is worth the same to everyone (§3.2 closed).

### 5.2 Mental Training — medium / standard — 160/day

| XP | Keystone | Task |
|---|---|---|
| 40 | ⭐⭐⭐ | Mental Training (5 min) |
| 27 | ⭐⭐ | Read 5 pages |
| 27 | ⭐⭐ | Prayer |
| 18 | ⭐ | Write one gratitude |
| 18 | ⭐ | 60-min phone-free focus block |
| 17 | ⭐ | Complete Daily Log |
| 13 | | Physical reset (10 min) |
| **160** | | **= daily budget** |

Perfect day **+24 → 184**. Was **270 task XP + 60 = 330/day**; now 184.
`mt_mind` drops from 100 to 40, in line with 75 Hard's keystone tasks.

**Hard mode — 179/day:** 45 / 30 / 30 / 20 / 20 / 19 / 15, perfect day +27 → **206**.
Hard mode now earns 16% more than standard (currently: 4%), while still
sitting below 75 Hard standard (230).

### 5.3 LOCK IN — medium / standard — 160/day

| XP | Keystone | Task |
|---|---|---|
| 26 | ⭐⭐⭐ | Sleep opportunity 8h+ |
| 26 | ⭐⭐⭐ | Flow training × 2 |
| 26 | ⭐⭐⭐ | Execute 2 of 3 priorities |
| 17 | ⭐⭐ | Daily mission: 3 priorities |
| 17 | ⭐⭐ | Physical energy |
| 17 | ⭐⭐ | Attention training |
| 11 | ⭐ | Mental recovery |
| 11 | ⭐ | Stress off-switch |
| 9 | | Complete Daily Log |
| **160** | | **= daily budget** |

Perfect day **+24 → 184**. Completion bonus by duration: 7d 224 · 14d 448 ·
21d 672 · 30d 960 · 60d 1,920 · 90d 2,880 — replacing today's 350/700/1,050/
1,500/3,000/4,500.

### 5.4 Fat Loss — medium / standard — 160/day

| XP | Keystone | Task |
|---|---|---|
| 35 | ⭐⭐⭐ | Hit protein goal |
| 34 | ⭐⭐⭐ | Whole foods 90% |
| 23 | ⭐⭐ | Walk 8,000+ steps |
| 23 | ⭐⭐ | Sleep 7.5–9h |
| 15 | ⭐ | Hit water goal |
| 15 | ⭐ | Progress photo |
| 15 | ⭐ | Complete Daily Log |
| **160** | | **= daily budget** |

Beginner drops to **136/day** (currently identical to standard — §3.3 closed).
Weekly requirements keep their own XP, drawn from a separate weekly budget of
`0.5 × dailyBudget` per required session so they cannot inflate the daily rate.

### 5.5 Forge Daily — easy / standard — 120/day

| XP | Keystone | Task |
|---|---|---|
| 18 | ⭐ | Mental Training |
| 18 | ⭐ | Complete Daily Log |
| 14 | | Hit sleep goal |
| 14 | | Move your body |
| 14 | | Read |
| 14 | | Pray |
| 14 | | Gratitude |
| 14 | | Drink water |
| **120** | | **= daily budget** |

Perfect day **+18 → 138**; no completion bonus (open-ended). A year of perfect
Forge Daily alone yields ~51,000 XP — Elite Warrior, not Unbreakable. The
baseline is now genuinely a baseline (§3.8 closed).

### 5.6 Full matrix — all challenges, all modes

Complete current-vs-proposed figures for every challenge × mode × duration are
in the generated tables (`XP/day` and `→Unbreakable` columns). Summary of
per-day rates at standard mode:

| Challenge | Current XP/day | Proposed XP/day | Change |
|---|---|---|---|
| 75 Hard (Male) | 203.4 | 273.7 | +35% |
| 75 Hard (Female) | 263.4 | 273.7 | +4% |
| Mental Training 14d | 385.7 | 226.6 | **−41%** |
| LOCK IN 14d | 349.1 | 226.6 | **−35%** |
| LOCK IN 90d | 334.6 | 224.9 | −33% |
| Fat Loss 30d | 279.3 | 225.5 | −19% |
| Energy Reset 30d | 326.3 | 225.5 | −31% |
| Muscle Building 60d | 243.8 | 251.6 | +3% |
| Hormone Health 84d | 232.7 | 223.2 | −4% |
| Forge Daily | 133.1 | 138.0 | +4% |

Note these are per-day rates in the **new 100,000-point ladder**. Against the
ladder, every challenge becomes far slower: 75 Hard goes from 50 days to 366.
The *relative* ordering is what changes here — 75 Hard moves from 5th-fastest
to fastest, and Mental Training from fastest to mid-pack, matching their
difficulty ratings.

---

## 6. Anti-exploit measures

| # | Exploit | Fix |
|---|---|---|
| 3.1 | Streak-break farming (+920 XP) | Streak milestones award **once per attempt per milestone**, tracked on the attempt, not the streak. Break penalty removed (the missed day already costs). |
| 3.2 | Profile task-count disparity | 75 Hard gets one canonical `start_tasks` list. Budget model makes count irrelevant anyway. |
| 3.3 | Beginner = Standard | Mode multiplier applies to the budget, so beginner is always 15% below standard. |
| 3.4 | Short-challenge bonus rate | `completionRate × budget × duration` — constant per day. |
| 3.5 | Uncapped Bonus Missions | Per-day cap `0.10 × budget`; per-attempt cap `0.05 × attempt task XP`. |
| 3.6 | Double-paid ratings / mental section | The +10 all-ratings and +15 mental-section awards are **removed**; both are already paid as required tasks. |
| 3.7 | Cheap inactivity | Missed day = `0.50 × budget` (see §7). |
| 3.8 | Forge Daily out-earning challenges | Explicit `easy` tier, 120/day. |
| — | Repeated restarts for bonuses | Completion bonus is already gated on passing score + keystone adherence; duration-neutral rate removes the incentive. |
| — | Same habit under two names | `habitKey` dedup verified working; extend the registry to cover any new template habit. |
| — | XP without completing the requirement | Unchanged — all XP remains derived from stored completion records. |

---

## 7. Penalty rebalance

**Current:** flat −25 per missed day, regardless of challenge, tier or what a
day was worth. That is 16% of a perfect day — and under a leaner economy a
flat −25 would swing from too soft to arbitrary.

**Proposed:** penalties become budget-relative, so they are automatically
proportionate at every difficulty.

| Rule | Current | Proposed |
|---|---|---|
| Whole day missed | −25 flat | **0.50 × daily budget** |
| Single task missed | `min(xp × 0.25, 12)` | `0.25 × task XP` (no flat cap) |
| Per-day loss cap | −80 flat | **0.50 × daily budget** |
| Recovery-day multiplier | ×0.3 | ×0.3 (unchanged) |
| Streak break | −30 | **0** (removed) |

Resulting cost of a missed day:

| tier | perfect day | missed day | as % of a perfect day |
|---|---|---|---|
| easy | +138 | −60 | 43% |
| medium | +184 | −80 | 43% |
| medium_hard | +207 | −90 | 43% |
| hard | +230 | −100 | 43% |
| elite | +253 | −110 | 43% |

A missed day now costs a consistent 43% of what the day would have earned, at
every difficulty — meaningful, identical in relative terms across tiers, and
never more than the day was worth. The swing between a perfect and a missed day
is 330 XP at hard tier, against 180 today.

**Your historical −649 is unaffected.** It was computed under era-1 rules and
stays exactly −649 (see §9).

---

## 8. Proposed XP Breakdown screen

Reachable from the Home rank card and the rank ladder. It reuses the existing
`xpLedger` / `missedDays` architecture rather than introducing a parallel one.

```
╭──────────────────────────────────────────────╮
│  XP Breakdown                      Current XP │
│                                        82,450 │
│                                               │
│  PERMANENT EARNINGS                           │
│    75-Day Discipline Challenge        +21,100 │
│    LOCK IN · Oct 2026                  +3,174 │
│    Forge Daily · Sep–Oct 2026            +760 │
│    Comeback bonuses                      +120 │
│    ─────────────────────────────────────────  │
│    Lifetime XP earned                  83,099 │
│                                               │
│  PENALTIES                                    │
│    Missed challenge tasks                −500 │
│    Forge Daily inactivity                −649 │
│    Cancelled by rank protection          +  0 │
│    ─────────────────────────────────────────  │
│    Total penalties                     −1,149 │
│                                               │
│  PROGRESSION                                  │
│    Current effective XP                82,450 │
│    Highest unlocked rank         True Warrior │
│    Protected rank floor                75,000 │
│    XP to Unbreakable                   17,550 │
╰──────────────────────────────────────────────╯
```

Each earnings row expands to that attempt's own accounting:

```
  LOCK IN · 1–14 Oct 2026 · 14 days · medium/standard   [era 2]
    Task XP earned                            2,240
    Perfect-day bonuses (12 × 24)               288
    Streak milestones (3d, 7d, 14d)             150
    Completion bonus (passed, 86%)              448
    Bonus Missions (capped)                      48
    Missed-day penalties (2 days × −80)        −160
    Unfinished days                             −14
    ──────────────────────────────────────────────
    Banked                                    3,000
```

Design rules:

1. **Historical rates, always.** Every archive stores the economy version it
   ran under; its breakdown is recomputed with *that* version's rules. An
   era-1 attempt is never re-valued at era-2 rates.
2. **Earned and penalties stay separate**, as the ledger already keeps them.
3. **The totals reconcile** — earned − penalties + floor cancellations =
   Current XP — the invariant already enforced in XP History.
4. **Works for current and historical records**, including archives whose
   day-by-day data cannot be re-read (shown as banked-only, as now).
5. Builds on `XPHistory.jsx` and `xpLedger.js`; the per-period rows and
   reconciliation block already exist and are extended, not replaced.

---

## 9. What is preserved exactly

Nothing in the shipped penalty architecture is bypassed:

- Permanent rank unlocks and protected rank floors — unchanged mechanism.
- Archived achievements and challenge results — never rewritten.
- Separate earned and penalty totals — the ledger stays the only deduction.
- Idempotent reconciliation, undo, duplicate-deduction protection — untouched.
- No penalty before a scheduled challenge starts — untouched.
- **Your −649 stays −649**, computed under era-1 rules: 29 missed days × −25 =
  −725, plus the one completed day at +26 task XP and +50 perfect-day = +76,
  net −649. It will be shown per period with the specific days and the rule
  that charged them.
- **The reconciliation is still opt-in.** Nothing is applied until you
  explicitly approve it.

---

## 10. Migration — and the one decision I cannot make for you

### 10.1 The tension

Your balance is **8,245 XP, True Warrior**. Under the current economy that is
about 40 days of perfect 75 Hard. Under the proposed economy, 8,245 (→ 82,450
at ×10) is **275 days** of perfect 75 Hard.

**No choice of units fixes this.** Your existing XP was earned at roughly 7×
the new rate, so it is "worth" far more than the effort behind it under any
new scale. There are only two honest ways out, and they trade off against each
other:

**Option A — grandfather (recommended).** Keep your balance and rank. Multiply
existing balances *and* thresholds by 10 together, so nothing moves relatively:
8,245 → 82,450 against a 100,000 ladder; True Warrior floor 75,000. You remain
82.5% of the way up the ladder, exactly as now.

- *Preserves:* everything. No revaluation, no rank loss, no surprise.
- *Cost:* you reach Unbreakable in **65 days** of new-rate play, then the
  ladder is exhausted. Needs new ranks above Unbreakable to keep progression
  meaningful — which you said you may want anyway.

**Option B — era-rescale.** Convert era-1 earnings at 0.135 (new 27.4/day vs
current 203.4/day): 8,245 → **11,107 XP**, which is rank 3, Disciplined.

- *Preserves:* the integrity of the 365-day benchmark for everyone equally.
- *Cost:* your earned figure falls far below your True Warrior floor, so the
  floor holds the display at 75,000 while the real number is 11,107. The floor
  would be doing all the work and the displayed figure would stop meaning
  anything. **I do not recommend this.**

### 10.2 Recommended migration plan (Option A)

1. **Stamp the economy version on every attempt and archive.** Add
   `xpEconomyVersion` to the challenge descriptor at start, and to each
   archive. Existing archives are backfilled as `version: 1`.
2. **Freeze era 1.** `computeDayXP` and friends take the version from the
   attempt and apply that era's rates. Era-1 archives recompute exactly as they
   do today, forever. This is what makes §8's "historical rates" rule real, and
   it is why your −649 cannot drift.
3. **Scale balances and thresholds together, once.** A single migration
   multiplies stored `xpEarned` on archives, ledger amounts and rank thresholds
   by 10. Relative standing is mathematically unchanged; `highestRank` is
   untouched.
4. **New attempts only.** Era 2 applies to challenges started after the
   migration. **An attempt already in progress keeps era 1 to its end** — no
   mid-attempt revaluation.
5. **Extend the ladder.** Add ranks above Unbreakable so a grandfathered
   profile still has somewhere to go. Thresholds are centralized, so this is a
   data change.
6. **Show the era.** The XP Breakdown labels each period's era, so a large
   era-1 figure next to a smaller era-2 one is explained rather than confusing.

### 10.3 Future flexibility

All of these become single-module, versioned data: rank names and thresholds,
challenge difficulty ratings, mode multipliers, daily and weekly budgets,
perfect-day and completion rates, streak ladder, bonus caps, penalty rates.
Rebalancing again means adding `version: 3` — historical achievements recompute
under their own era and are never touched.

---

## 11. What I need from you before implementing

1. **Approve or amend the tier budgets** — `easy 120 / medium 160 /
   medium_hard 180 / hard 200 / elite 220` and mode multipliers
   `0.85 / 1.00 / 1.12`. These two tables determine every number above.
2. **Confirm the ×10 ladder** (Unbreakable 100,000) versus keeping 10,000 with
   one-decimal task XP.
3. **Choose Option A or B in §10.1.** This is the only decision that changes
   your own displayed balance.
4. **Confirm the difficulty tier assignments in §4.3**, in particular Mental
   Training staying `medium` (which is what cuts it 41%).
5. **Decide on ranks above Unbreakable** — needed under Option A.
6. Whether to narrow the hard multiplier to 1.08 so `medium_hard` hard mode
   (202) no longer edges `hard` standard (200).

On approval I will implement it behind the versioned module, with regression
tests covering the benchmark, the difficulty ordering, every anti-exploit
measure in §6, era isolation for archives, and the migration — and the
production app stays working throughout.

---

### Appendix — how these figures were produced

- Current-system values: the app's own `computeTotalXP` run over synthetic
  perfect/partial adherence day records, per challenge, mode and duration,
  including the repeating streak ladder and the gated completion bonus.
- Task lists: read from `variants[mode].start_tasks` for variant-flow
  templates and from each config module's `buildStartTasks()` for configured
  ones, so no value was transcribed by hand.
- 75 Hard: the legacy profile default task lists, since its variants carry no
  `start_tasks` (§3.2).
- Proposed values: the §4.2 model, with integer task XP allocated by
  largest-remainder so each list sums exactly to its budget.
