# XP Economy — raw computed tables

Generated from the app's own modules. See XP-ECONOMY-PROPOSAL.md for analysis.

## Stage 1-2: task inventory (current)

```
==============================================================================
sleep_reset_challenge  [Easy]  Sleep Reset Challenge
  durations: 7/14  default=7  startable=false  flow=variant-default
  rewards.xp=300  bonus_by_duration=null
    completionBonus(7d) = 300
    completionBonus(14d) = 300
  passing_score=default(70)  keystone_requirement=default(65)
  MODE beginner (difficulty=easy) tasks=0 dailySum=0
    (descriptive only, 4 required_daily_tasks strings — no start_tasks)
  MODE standard (difficulty=medium) tasks=0 dailySum=0
    (descriptive only, 5 required_daily_tasks strings — no start_tasks)
  MODE hard (difficulty=hard) tasks=0 dailySum=0
    (descriptive only, 6 required_daily_tasks strings — no start_tasks)
==============================================================================
fat_loss_phase  [Medium]  Fat Loss Challenge
  durations: 14/30/60  default=30  startable=true  flow=variant
  rewards.xp=500  bonus_by_duration={"14":200,"30":500,"60":1100}
    completionBonus(14d) = 200
    completionBonus(30d) = 500
    completionBonus(60d) = 1100
  passing_score=default(70)  keystone_requirement=default(65)
  MODE beginner (difficulty=easy) tasks=7 dailySum=165
    weekly_requirements(text): ["Lift 3x","1 × 30-minute Zone 2 cardio"]
       10xp k1  fl_photo — Take progress photo
       40xp k3* fl_protein — Hit protein goal (0.8–1 g/lb goal weight)
       25xp k2  fl_steps — Walk 6,000+ steps
       40xp k3* fl_whole — Eat mostly whole foods (80%+)
       15xp k1  fl_water — Hit water goal
       25xp k2  fl_sleep — Sleep 7.5+ hours
       10xp k1  daily_log — Complete Daily Log
  MODE standard (difficulty=medium) tasks=7 dailySum=165
    weekly_requirements(text): ["🏋️ Lift 3x — required (25 XP each)","❤️ 2 × 30-minute Zone 2 cardio — required (20 XP each)","Track these throughout each 7-day challenge week."]
       10xp k1  fl_photo — Take progress photo
       40xp k3* fl_protein — Hit protein goal (0.8–1 g/lb goal weight)
       25xp k2  fl_steps — Walk 8,000+ steps
       40xp k3* fl_whole — Eat mostly whole foods (90%)
       15xp k1  fl_water — Hit water goal
       25xp k2  fl_sleep — Sleep 7.5–9 hours
       10xp k1  daily_log — Complete Daily Log
  MODE hard (difficulty=hard) tasks=8 dailySum=200
    weekly_requirements(text): ["🏋️ Resistance training ×3 — your existing programme counts","❤️ Zone 2–3 cardio ×2 — 30 minutes each","🔥 Interval session ×1 — roughly 15–25 minutes total, not 30 minutes flat out","📏 Waist measurement ×1","🔍 Weekly review ×1"]
       40xp k3* fl_protein — Hit protein: 140–175g
       40xp k3* fl_whole — Eat mostly whole foods (~90%)
       30xp k2  fl_steps — Walk 10,000+ steps
       30xp k2  fl_fullness — Stop eating at ~90% full — satisfied, not stuffed.
       25xp k2  fl_sleep — Sleep 7.5–9 hours
       15xp k1  fl_water — Hit water goal
       10xp k1  fl_photo — Daily progress photo
       10xp k1  daily_log — Complete Daily Log
==============================================================================
strength_phase  [Medium/Hard]  Strength Phase
  durations: 21/30  default=21  startable=false  flow=variant-default
  rewards.xp=450  bonus_by_duration=null
    completionBonus(21d) = 450
    completionBonus(30d) = 450
  passing_score=default(70)  keystone_requirement=default(65)
  MODE beginner (difficulty=easy) tasks=0 dailySum=0
    (descriptive only, 5 required_daily_tasks strings — no start_tasks)
  MODE standard (difficulty=medium) tasks=0 dailySum=0
    (descriptive only, 6 required_daily_tasks strings — no start_tasks)
  MODE hard (difficulty=hard) tasks=0 dailySum=0
    (descriptive only, 6 required_daily_tasks strings — no start_tasks)
==============================================================================
muscle_building_phase  [Medium/Hard]  Muscle Building
  durations: 30/60/90  default=60  startable=true  flow=configured
  rewards.xp=900  bonus_by_duration={"30":500,"60":900,"90":1400}
    completionBonus(30d) = 500
    completionBonus(60d) = 900
    completionBonus(90d) = 1400
  passing_score=default(70)  keystone_requirement=default(65)
  CONFIGURED default setup: duration=60 completionBonusXP=900 passingScore=- keystoneReq=-
  tasks n=6 dailySum=150
       40xp k3* mb_protein — Hit protein target
       30xp k2  mb_nutrition — Hit Nutrition Target
       30xp k2  mb_carbs — Hit carb target
       25xp k2  mb_sleep — Sleep 8+ hours
       15xp k1  mb_recovery — Daily Recovery Practice
       10xp k1  daily_log — Complete Daily Log
==============================================================================
mental_training_phase  [Medium]  Mental Training Phase
  durations: 7/14/21  default=14  startable=true  flow=variant
  rewards.xp=400  bonus_by_duration=null
    completionBonus(7d) = 400
    completionBonus(14d) = 400
    completionBonus(21d) = 400
  passing_score=default(70)  keystone_requirement=default(65)
  BONUS MISSIONS: n=6 totalXP=105  [bm_cold:20 bm_nophone:20 bm_avoided:20 bm_outside:15 bm_read5:15 bm_help:15]
  MODE beginner (difficulty=easy) tasks=7 dailySum=260
      100xp k3  mt_mind — Mental Training — 2 minutes
       40xp k2  mt_reading — Read 2 pages
       40xp k2  mt_prayer — Prayer
       20xp k1  mt_gratitude — Write one gratitude
       20xp k1  mt_focus — 30-min phone-free focus block
       20xp k0  mt_physical — Short Physical Reset — 5 minutes
       20xp k0  daily_log — Complete Daily Log
  MODE standard (difficulty=medium) tasks=7 dailySum=270
      100xp k3  mt_mind — Mental Training — 5 minutes
       40xp k2  mt_reading — Read 5 pages
       40xp k2  mt_prayer — Prayer
       20xp k1  mt_gratitude — Write one gratitude
       20xp k1  mt_focus — 60-min phone-free focus block
       30xp k0  mt_physical — Short Physical Reset — 10 minutes
       20xp k0  daily_log — Complete Daily Log
  MODE hard (difficulty=hard) tasks=7 dailySum=280
      100xp k3  mt_mind — Mental Training — 10 minutes
       40xp k2  mt_reading — Read 10 pages
       40xp k2  mt_prayer — Prayer
       20xp k1  mt_gratitude — Write one gratitude
       20xp k1  mt_focus — 90-min phone-free focus block
       40xp k0  mt_physical — Short Physical Reset — 15 minutes
       20xp k0  daily_log — Complete Daily Log
==============================================================================
womens_hormone_health  [Medium]  Women's Hormone Health
  durations: 56/84  default=84  startable=true  flow=configured
  rewards.xp=1200  bonus_by_duration={"56":800,"84":1200}
    completionBonus(56d) = 800
    completionBonus(84d) = 1200
  passing_score=default(70)  keystone_requirement=default(65)
  CONFIGURED default setup: duration=84 completionBonusXP=1200 passingScore=- keystoneReq=-
  tasks n=6 dailySum=145
       40xp k3* hh_sleep — Sleep 7.5–9 hours
       35xp k2  hh_whole_food — Eat mostly whole foods
       25xp k2  hh_movement — Walk 8,000+ steps
       25xp k1  hh_stress — 5+ minutes of down-regulation
       10xp k1  hh_hydration — Hit your hydration target
       10xp k1  daily_log — Complete Daily Log
==============================================================================
energy_reset_10_day  [Medium]  Energy Reset
  durations: 7/10/14/30  default=10  startable=true  flow=configured
  rewards.xp=400  bonus_by_duration={"7":250,"10":400,"14":600,"30":1400}
    completionBonus(7d) = 250
    completionBonus(10d) = 400
    completionBonus(14d) = 600
    completionBonus(30d) = 1400
  passing_score=default(70)  keystone_requirement=default(65)
  CONFIGURED default setup: duration=10 completionBonusXP=400 passingScore=- keystoneReq=-
  tasks n=9 dailySum=182
       40xp k3* er_sleep — Sleep opportunity: 8+ hours
       30xp k3  er_light — Morning light: 10+ minutes outdoors
       30xp k2  er_nutrition — Eat nutrient-dense whole foods
       20xp k2  er_steps — Walk 8,000+ steps
       15xp k1  er_hydration — Drink water soon after waking
       15xp k2  er_caffeine — Caffeine used deliberately
       12xp k1  er_stress — 5+ minutes of downshifting
       10xp k1  er_winddown — Evening wind-down
       10xp k1  daily_log — Complete Daily Log
==============================================================================
lock_in_14_day  [Medium]  LOCK IN
  durations: 7/14/21/30/60/90  default=14  startable=true  flow=configured
  rewards.xp=700  bonus_by_duration={"7":350,"14":700,"21":1050,"30":1500,"60":3000,"90":4500}
    completionBonus(7d) = 350
    completionBonus(14d) = 700
    completionBonus(21d) = 1050
    completionBonus(30d) = 1500
    completionBonus(60d) = 3000
    completionBonus(90d) = 4500
  passing_score=default(70)  keystone_requirement=default(65)
  CONFIGURED default setup: duration=14 completionBonusXP=700 passingScore=- keystoneReq=-
  tasks n=9 dailySum=212
       40xp k3* li_sleep — Sleep opportunity: 8+ hours
       35xp k3* li_flow — Flow training: 2 focused sessions
       30xp k3* li_execute — Execute 2 of 3 priorities
       25xp k2  li_mission — Daily mission: 3 priorities
       25xp k2  li_energy — Physical energy: move, eat, hydrate
       20xp k2  li_attention — Attention training: 10+ minutes
       15xp k1  li_recovery — Mental recovery: 20+ minutes
       12xp k1  li_stress — Stress off-switch: 5 minutes
       10xp k0  daily_log — Complete Daily Log
==============================================================================
recovery_phase  [Easy]  Recovery Phase
  durations: 7/14  default=7  startable=false  flow=variant-default
  rewards.xp=350  bonus_by_duration=null
    completionBonus(7d) = 350
    completionBonus(14d) = 350
  passing_score=default(70)  keystone_requirement=default(65)
  MODE beginner (difficulty=easy) tasks=0 dailySum=0
    (descriptive only, 4 required_daily_tasks strings — no start_tasks)
  MODE standard (difficulty=medium) tasks=0 dailySum=0
    (descriptive only, 5 required_daily_tasks strings — no start_tasks)
  MODE hard (difficulty=hard) tasks=0 dailySum=0
    (descriptive only, 5 required_daily_tasks strings — no start_tasks)
==============================================================================
75_day_discipline_challenge  [Hard]  75-Day Discipline Challenge
  durations: 75  default=75  startable=true  flow=variant-default
  rewards.xp=2500  bonus_by_duration=null
    completionBonus(75d) = 2500
  passing_score=80  keystone_requirement=70
  MODE beginner (difficulty=easy) tasks=0 dailySum=0
    (descriptive only, 6 required_daily_tasks strings — no start_tasks)
  MODE standard (difficulty=medium) tasks=0 dailySum=0
    (descriptive only, 8 required_daily_tasks strings — no start_tasks)
  MODE hard (difficulty=hard) tasks=0 dailySum=0
    (descriptive only, 9 required_daily_tasks strings — no start_tasks)
==============================================================================
custom_challenge_framework  [You decide]  Custom Challenge
  durations: 7/14/21/30/75  default=21  startable=false  flow=variant-default
  rewards.xp=400  bonus_by_duration=null
    completionBonus(7d) = 400
    completionBonus(14d) = 400
    completionBonus(21d) = 400
    completionBonus(30d) = 400
    completionBonus(75d) = 400
  passing_score=default(70)  keystone_requirement=default(65)
  MODE beginner (difficulty=easy) tasks=0 dailySum=0
    (descriptive only, 2 required_daily_tasks strings — no start_tasks)
  MODE standard (difficulty=medium) tasks=0 dailySum=0
    (descriptive only, 3 required_daily_tasks strings — no start_tasks)
  MODE hard (difficulty=hard) tasks=0 dailySum=0
    (descriptive only, 4 required_daily_tasks strings — no start_tasks)
==============================================================================
FORGE DAILY (baseline, open-ended)
  tasks n=8 dailySum=70
        8xp k0  fd_sleep — Hit sleep goal
        8xp k0  fd_move — Move your body
       12xp k1  fd_mind — Mental Training
        6xp k0  fd_read — Read
        6xp k0  fd_pray — Pray
        5xp k0  fd_grat — Gratitude
        5xp k0  fd_water — Drink water
       20xp k0  daily_log — Complete Daily Log

DAILY_LOG_TASK default: xp=20 id=daily_log
COLD_SHOWER_TASK: xp=20 id=mt_cold_shower
```

## Stage 3: current-system simulation

```
CURRENT SYSTEM — per challenge/mode/duration, computed by the real engine

challenge                      mode           d  task/d  req+pd  bonus   TOTAL  XP/day  →UNBRK
----------------------------------------------------------------------------------------------------
75 Hard (profile: Male)        standard      75      95     155   2500   15255   203.4      50
75 Hard (profile: Female)      standard      75     155     215   2500   19755   263.4      38
Fat Loss Challenge             beginner      14     165     225    200    3730   266.4      38
Fat Loss Challenge             beginner      30     165     225    500    8380   279.3      36
Fat Loss Challenge             beginner      60     165     225   1100   15730   262.2      39
Fat Loss Challenge             standard      14     165     225    200    3730   266.4      38
Fat Loss Challenge             standard      30     165     225    500    8380   279.3      36
Fat Loss Challenge             standard      60     165     225   1100   15730   262.2      39
Fat Loss Challenge             hard          14     200     260    200    4220   301.4      34
Fat Loss Challenge             hard          30     200     260    500    9430   314.3      32
Fat Loss Challenge             hard          60     200     260   1100   17830   297.2      34
Muscle Building                configured-default  30     150     210    500    7930   264.3      38
Muscle Building                configured-default  60     150     210    900   14630   243.8      42
Muscle Building                configured-default  90     150     210   1400   21430   238.1      42
Mental Training Phase          beginner       7     260     320    400    2770   395.7      26
Mental Training Phase          beginner      14     260     320    400    5260   375.7      27
Mental Training Phase          beginner      21     260     320    400    7500   357.1      28
Mental Training Phase          standard       7     270     330    400    2840   405.7      25
Mental Training Phase          standard      14     270     330    400    5400   385.7      26
Mental Training Phase          standard      21     270     330    400    7710   367.1      28
Mental Training Phase          hard           7     280     340    400    2910   415.7      25
Mental Training Phase          hard          14     280     340    400    5540   395.7      26
Mental Training Phase          hard          21     280     340    400    7920   377.1      27
Women's Hormone Health         configured-default  56     145     205    800   13410   239.5      42
Women's Hormone Health         configured-default  84     145     205   1200   19550   232.7      43
Energy Reset                   configured-default   7     182     242    250    2074   296.3      34
Energy Reset                   configured-default  10     182     242    400    2950   295.0      34
Energy Reset                   configured-default  14     182     242    600    4368   312.0      33
Energy Reset                   configured-default  30     182     242   1400    9790   326.3      31
LOCK IN                        configured-default   7     212     272    350    2384   340.6      30
LOCK IN                        configured-default  14     212     272    700    4888   349.1      29
LOCK IN                        configured-default  21     212     272   1050    7142   340.1      30
LOCK IN                        configured-default  30     212     272   1500   10790   359.7      28
LOCK IN                        configured-default  60     212     272   3000   20450   340.8      30
LOCK IN                        configured-default  90     212     272   4500   30110   334.6      30

Legend: task/d = required-task XP per day. req+pd = plus perfect-day(50) and all-ratings(10).
        TOTAL = engine total for a perfect run INCLUDING repeating streak ladder + completion bonus.
        XP/day = TOTAL / duration. →UNBRK = days of this challenge, repeated, to reach 10,000 XP.

====================================================================================================
365-DAY PROJECTION (repeat the same challenge back to back)

challenge                      mode           d     30d     90d     180d     365d
----------------------------------------------------------------------------------------------------
75 Hard (profile: Male)        standard      75    6102   18306    36612    74241
75 Hard (profile: Female)      standard      75    7902   23706    47412    96141
Fat Loss Challenge             beginner      14    7993   23979    47957    97246
Fat Loss Challenge             beginner      30    8380   25140    50280   101957
Fat Loss Challenge             beginner      60    7865   23595    47190    95691
Fat Loss Challenge             standard      14    7993   23979    47957    97246
Fat Loss Challenge             standard      30    8380   25140    50280   101957
Fat Loss Challenge             standard      60    7865   23595    47190    95691
Fat Loss Challenge             hard          14    9043   27129    54257   110021
Fat Loss Challenge             hard          30    9430   28290    56580   114732
Fat Loss Challenge             hard          60    8915   26745    53490   108466
Muscle Building                configured-default  30    7930   23790    47580    96482
Muscle Building                configured-default  60    7315   21945    43890    88999
Muscle Building                configured-default  90    7143   21430    42860    86911
Mental Training Phase          beginner       7   11871   35614    71229   144436
Mental Training Phase          beginner      14   11271   33814    67629   137136
Mental Training Phase          beginner      21   10714   32143    64286   130357
Mental Training Phase          standard       7   12171   36514    73029   148086
Mental Training Phase          standard      14   11571   34714    69429   140786
Mental Training Phase          standard      21   11014   33043    66086   134007
Mental Training Phase          hard           7   12471   37414    74829   151736
Mental Training Phase          hard          14   11871   35614    71229   144436
Mental Training Phase          hard          21   11314   33943    67886   137657
Women's Hormone Health         configured-default  56    7184   21552    43104    87404
Women's Hormone Health         configured-default  84    6982   20946    41893    84949
Energy Reset                   configured-default   7    8889   26666    53331   108144
Energy Reset                   configured-default  10    8850   26550    53100   107675
Energy Reset                   configured-default  14    9360   28080    56160   113880
Energy Reset                   configured-default  30    9790   29370    58740   119112
LOCK IN                        configured-default   7   10217   30651    61303   124309
LOCK IN                        configured-default  14   10474   31423    62846   127437
LOCK IN                        configured-default  21   10203   30609    61217   124135
LOCK IN                        configured-default  30   10790   32370    64740   131278
LOCK IN                        configured-default  60   10225   30675    61350   124404
LOCK IN                        configured-default  90   10037   30110    60220   122113

====================================================================================================
FORGE DAILY (open-ended baseline)
  task XP/day = 70
  365 perfect days: gained=48580 lost=0 → 133.1 XP/day
  days to Unbreakable at that rate: 76

====================================================================================================
STREAK LADDER — how much of a perfect run is streak bonuses
   30 perfect days: total=  2930  of which streak bonuses=  1130  (38.6%)
   60 perfect days: total=  4730  of which streak bonuses=  1130  (23.9%)
   90 perfect days: total=  6530  of which streak bonuses=  1130  (17.3%)
  180 perfect days: total= 11930  of which streak bonuses=  1130  (9.5%)
  365 perfect days: total= 23030  of which streak bonuses=  1130  (4.9%)
```

## Stage 4: exploit probes

```
====================================================================================
EXPLOIT 1 — streak-break farming
The streak ladder (3/7/14/30 = 30+100+250+750 = 1,130) fires once per STREAK,
not once per attempt. So deliberately breaking a streak re-arms the whole ladder.
  62 days unbroken        : gained=10740 lost=0 net=10740
  62 days, day 31 skipped : gained=11715 lost=55 net=11660
  NET EFFECT OF SKIPPING A DAY: +920 XP  ← skipping PAYS

====================================================================================
EXPLOIT 2 — short-challenge completion-bonus rate
Completion bonus per DAY of challenge, current values:
  Mental Training 7d         400 XP /  7d =  57.1 XP/day
  Mental Training 14d        400 XP / 14d =  28.6 XP/day
  Mental Training 21d        400 XP / 21d =  19.0 XP/day
  LOCK IN 7d                 350 XP /  7d =  50.0 XP/day
  LOCK IN 90d               4500 XP / 90d =  50.0 XP/day
  Energy Reset 7d            250 XP /  7d =  35.7 XP/day
  Energy Reset 30d          1400 XP / 30d =  46.7 XP/day
  Fat Loss 14d               200 XP / 14d =  14.3 XP/day
  Fat Loss 60d              1100 XP / 60d =  18.3 XP/day
  75 Hard 75d               2500 XP / 75d =  33.3 XP/day

====================================================================================
EXPLOIT 3 — same challenge, different profile, different XP
  75 Hard task XP/day, Male   (7 tasks) : 95
  75 Hard task XP/day, Female (13 tasks): 155
  full perfect 75-day attempt — Male: 15255  Female: 19755  (+4500 = 29% more for the SAME challenge)

====================================================================================
BENCHMARK — 365 days of perfect 75 Hard, cycle accurate
365 days = 4 complete 75-day cycles (300 days) + 65 days into a 5th.
  Male: cycle=15255  partial65=11205  → 365-day LIFETIME XP = 72225
         that is 7.2x the entire rank ladder (10,000 = Unbreakable)
         Male crosses Unbreakable on about day 50
  Female: cycle=19755  partial65=15105  → 365-day LIFETIME XP = 94125
         that is 9.4x the entire rank ladder (10,000 = Unbreakable)
         Female crosses Unbreakable on about day 38

====================================================================================
RANK LADDER vs ONE ATTEMPT
  Entire ladder Initiate→Unbreakable = 10000 XP
  ONE perfect 75 Hard attempt (Male)  = 15255 XP  (153% of the ladder)
  ONE perfect Mental Training 7d      = see stage 3 (2,840 XP = 28% of the ladder in ONE WEEK)
  Current rank thresholds:
     1 Initiate            0 XP  → day 0 of perfect 75 Hard
     2 Apprentice        250 XP  → day 2 of perfect 75 Hard
     3 Disciplined       750 XP  → day 4 of perfect 75 Hard
     4 Resilient        1500 XP  → day 8 of perfect 75 Hard
     5 Warrior          3000 XP  → day 15 of perfect 75 Hard
     6 Elite Warrior    5000 XP  → day 25 of perfect 75 Hard
     7 True Warrior     7500 XP  → day 37 of perfect 75 Hard
     8 Unbreakable     10000 XP  → day 50 of perfect 75 Hard

====================================================================================
FORGE DAILY with no challenge at all
  365 perfect Forge Daily days: 48580 XP → Unbreakable on day 76
  (Forge Daily is the no-challenge baseline. It alone clears the whole ladder in under 3 months.)

====================================================================================
PENALTY PROPORTIONALITY (current)
  A perfect 75 Hard day earns      : 155 XP
  A fully missed day costs         : 25 XP (flat)
  Ratio                            : a missed day costs 16% of a perfect day
  → inactivity is cheap relative to earnings, which is why 29 missed days (-725)
    were swamped by a single completed day (+76) only because that day was
    the ONLY day logged. In a normal month the penalty is nearly invisible.
```

## Stage 5-6: proposed economy

```
BENCHMARK — 365 days perfect 75 Hard, x10 scale, integer XP
  daily budget=200  perfect-day=30  completion/cycle=3000
  task+perfect=83950  completion=12000  streak=3950  → LIFETIME AT 365 = 99900
  per day = 273.7   Unbreakable (100,000) on day 366

  Rank progression on perfect 75 Hard:
    Initiate             0  day    0
    Apprentice       2,500  day   10
    Disciplined      7,500  day   28
    Resilient       15,000  day   55
    Warrior         30,000  day  110
    Elite Warrior   50,000  day  183
    True Warrior    75,000  day  275
    Unbreakable    100,000  day  366

============================================================================================
INTEGER TASK TABLES — daily budget split by keystone weight, sums exactly

  75 Hard — hard/standard (200/day)
        40 xp  *** 45-min workout
        40 xp  *** Diet followed
        27 xp  **  Sleep target
        27 xp  **  Mental training
        18 xp  *   Water goal
        18 xp  *   10 pages read
        17 xp  *   Complete Daily Log
        13 xp      Progress photo
       200 xp  = daily budget
      +30 perfect-day  =>  230 per perfect day
      missed day costs -100

  Mental Training — medium/standard (160/day)
        40 xp  *** Mental Training (5 min)
        27 xp  **  Read 5 pages
        27 xp  **  Prayer
        18 xp  *   Write one gratitude
        18 xp  *   60-min phone-free block
        17 xp  *   Complete Daily Log
        13 xp      Physical reset (10 min)
       160 xp  = daily budget
      +24 perfect-day  =>  184 per perfect day
      missed day costs -80

  Mental Training — medium/hard (179/day)
        45 xp  *** Mental Training (10 min)
        30 xp  **  Read 10 pages
        30 xp  **  Prayer
        20 xp  *   Write one gratitude
        20 xp  *   90-min phone-free block
        19 xp  *   Complete Daily Log
        15 xp      Physical reset (15 min)
       179 xp  = daily budget
      +27 perfect-day  =>  206 per perfect day
      missed day costs -90

  LOCK IN — medium/standard (160/day)
        26 xp  *** Sleep opportunity 8h+
        26 xp  *** Flow training x2
        26 xp  *** Execute 2 of 3 priorities
        17 xp  **  Daily mission
        17 xp  **  Physical energy
        17 xp  **  Attention training
        11 xp  *   Mental recovery
        11 xp  *   Stress off-switch
         9 xp      Complete Daily Log
       160 xp  = daily budget
      +24 perfect-day  =>  184 per perfect day
      missed day costs -80

  Fat Loss — medium/standard (160/day)
        35 xp  *** Hit protein goal
        34 xp  *** Whole foods 90%
        23 xp  **  Walk 8,000+ steps
        23 xp  **  Sleep 7.5-9h
        15 xp  *   Hit water goal
        15 xp  *   Progress photo
        15 xp  *   Complete Daily Log
       160 xp  = daily budget
      +24 perfect-day  =>  184 per perfect day
      missed day costs -80

  Forge Daily — easy/standard (120/day)
        18 xp  *   Mental Training
        14 xp      Hit sleep goal
        14 xp      Move your body
        14 xp      Read
        14 xp      Pray
        14 xp      Gratitude
        14 xp      Drink water
        18 xp  *   Complete Daily Log
       120 xp  = daily budget
      +18 perfect-day  =>  138 per perfect day
      missed day costs -60

============================================================================================
ALL CHALLENGES — proposed, every mode
challenge                tier         mode        d  task/d  perf  compl  max/day  attempt  XP/day   →UNBR
--------------------------------------------------------------------------------------------------------------
75 Hard                  hard         beginner   75     170    26   2550      196    18100   234.8     426
75 Hard                  hard         standard   75     200    30   3000      230    21100   273.7     366
75 Hard                  hard         hard       75     224    34   3360      258    23560   305.6     328
Mental Training          medium       beginner    7     136    20    190      156     1352   193.0     519
Mental Training          medium       beginner   14     136    20    381      156     2715   193.8     516
Mental Training          medium       beginner   21     136    20    571      156     3997   189.8     527
Mental Training          medium       standard    7     160    24    224      184     1582   225.9     443
Mental Training          medium       standard   14     160    24    448      184     3174   226.6     442
Mental Training          medium       standard   21     160    24    672      184     4686   222.5     450
Mental Training          medium       hard        7     179    27    251      206     1763   251.7     398
Mental Training          medium       hard       14     179    27    501      206     3535   252.4     397
Mental Training          medium       hard       21     179    27    752      206     5228   248.2     403
LOCK IN                  medium       beginner    7     136    20    190      156     1352   193.0     519
LOCK IN                  medium       beginner   14     136    20    381      156     2715   193.8     516
LOCK IN                  medium       beginner   21     136    20    571      156     3997   189.8     527
LOCK IN                  medium       beginner   30     136    20    816      156     5796   192.7     519
LOCK IN                  medium       beginner   60     136    20   1632      156    11542   191.9     522
LOCK IN                  medium       beginner   90     136    20   2448      156    17338   192.2     521
LOCK IN                  medium       standard    7     160    24    224      184     1582   225.9     443
LOCK IN                  medium       standard   14     160    24    448      184     3174   226.6     442
LOCK IN                  medium       standard   21     160    24    672      184     4686   222.5     450
LOCK IN                  medium       standard   30     160    24    960      184     6780   225.5     444
LOCK IN                  medium       standard   60     160    24   1920      184    13510   224.7     446
LOCK IN                  medium       standard   90     160    24   2880      184    20290   224.9     445
LOCK IN                  medium       hard        7     179    27    251      206     1763   251.7     398
LOCK IN                  medium       hard       14     179    27    501      206     3535   252.4     397
LOCK IN                  medium       hard       21     179    27    752      206     5228   248.2     403
LOCK IN                  medium       hard       30     179    27   1074      206     7554   251.2     399
LOCK IN                  medium       hard       60     179    27   2148      206    15058   250.4     400
LOCK IN                  medium       hard       90     179    27   3222      206    22612   250.7     399
Fat Loss                 medium       beginner   14     136    20    381      156     2715   193.8     516
Fat Loss                 medium       beginner   30     136    20    816      156     5796   192.7     519
Fat Loss                 medium       beginner   60     136    20   1632      156    11542   191.9     522
Fat Loss                 medium       standard   14     160    24    448      184     3174   226.6     442
Fat Loss                 medium       standard   30     160    24    960      184     6780   225.5     444
Fat Loss                 medium       standard   60     160    24   1920      184    13510   224.7     446
Fat Loss                 medium       hard       14     179    27    501      206     3535   252.4     397
Fat Loss                 medium       hard       30     179    27   1074      206     7554   251.2     399
Fat Loss                 medium       hard       60     179    27   2148      206    15058   250.4     400
Muscle Building          medium_hard  beginner   30     153    23    918      176     6498   216.1     463
Muscle Building          medium_hard  beginner   60     153    23   1836      176    12946   215.3     465
Muscle Building          medium_hard  beginner   90     153    23   2754      176    19444   215.6     464
Muscle Building          medium_hard  standard   30     180    27   1080      207     7590   252.4     397
Muscle Building          medium_hard  standard   60     180    27   2160      207    15130   251.6     398
Muscle Building          medium_hard  standard   90     180    27   3240      207    22720   251.9     398
Muscle Building          medium_hard  hard       30     202    30   1212      232     8472   281.8     355
Muscle Building          medium_hard  hard       60     202    30   2424      232    16894   280.9     356
Muscle Building          medium_hard  hard       90     202    30   3636      232    25366   281.2     356
Energy Reset             medium       beginner    7     136    20    190      156     1352   193.0     519
Energy Reset             medium       beginner   10     136    20    272      156     1902   189.8     527
Energy Reset             medium       beginner   14     136    20    381      156     2715   193.8     516
Energy Reset             medium       beginner   30     136    20    816      156     5796   192.7     519
Energy Reset             medium       standard    7     160    24    224      184     1582   225.9     443
Energy Reset             medium       standard   10     160    24    320      184     2230   222.5     450
Energy Reset             medium       standard   14     160    24    448      184     3174   226.6     442
Energy Reset             medium       standard   30     160    24    960      184     6780   225.5     444
Energy Reset             medium       hard        7     179    27    251      206     1763   251.7     398
Energy Reset             medium       hard       10     179    27    358      206     2488   248.3     403
Energy Reset             medium       hard       14     179    27    501      206     3535   252.4     397
Energy Reset             medium       hard       30     179    27   1074      206     7554   251.2     399
Hormone Health           medium       beginner   56     136    20   1523      156    10559   186.4     537
Hormone Health           medium       beginner   84     136    20   2285      156    16239   190.8     525
Hormone Health           medium       standard   56     160    24   1792      184    12396   218.8     458
Hormone Health           medium       standard   84     160    24   2688      184    18994   223.2     449
Hormone Health           medium       hard       56     179    27   2005      206    13841   244.3     410
Hormone Health           medium       hard       84     179    27   3007      206    21161   248.7     403
Sleep Reset              easy         beginner    7     102    15    143      117     1032   147.3     679
Sleep Reset              easy         beginner   14     102    15    286      117     2074   148.1     676
Sleep Reset              easy         standard    7     120    18    168      138     1204   171.9     582
Sleep Reset              easy         standard   14     120    18    336      138     2418   172.6     580
Sleep Reset              easy         hard        7     134    20    188      154     1336   190.8     525
Sleep Reset              easy         hard       14     134    20    375      154     2681   191.4     523
Recovery                 easy         beginner    7     102    15    143      117     1032   147.3     679
Recovery                 easy         beginner   14     102    15    286      117     2074   148.1     676
Recovery                 easy         standard    7     120    18    168      138     1204   171.9     582
Recovery                 easy         standard   14     120    18    336      138     2418   172.6     580
Recovery                 easy         hard        7     134    20    188      154     1336   190.8     525
Recovery                 easy         hard       14     134    20    375      154     2681   191.4     523
Strength                 medium_hard  beginner   21     153    23    643      176     4489   213.1     470
Strength                 medium_hard  beginner   30     153    23    918      176     6498   216.1     463
Strength                 medium_hard  standard   21     180    27    756      207     5253   249.4     401
Strength                 medium_hard  standard   30     180    27   1080      207     7590   252.4     397
Strength                 medium_hard  hard       21     202    30    848      232     5870   278.7     359
Strength                 medium_hard  hard       30     202    30   1212      232     8472   281.8     355
Custom                   medium       beginner    7     136    20    190      156     1352   193.0     519
Custom                   medium       beginner   14     136    20    381      156     2715   193.8     516
Custom                   medium       beginner   21     136    20    571      156     3997   189.8     527
Custom                   medium       beginner   30     136    20    816      156     5796   192.7     519
Custom                   medium       beginner   75     136    20   2040      156    14590   189.2     529
Custom                   medium       standard    7     160    24    224      184     1582   225.9     443
Custom                   medium       standard   14     160    24    448      184     3174   226.6     442
Custom                   medium       standard   21     160    24    672      184     4686   222.5     450
Custom                   medium       standard   30     160    24    960      184     6780   225.5     444
Custom                   medium       standard   75     160    24   2400      184    17050   221.1     453
Custom                   medium       hard        7     179    27    251      206     1763   251.7     398
Custom                   medium       hard       14     179    27    501      206     3535   252.4     397
Custom                   medium       hard       21     179    27    752      206     5228   248.2     403
Custom                   medium       hard       30     179    27   1074      206     7554   251.2     399
Custom                   medium       hard       75     179    27   2685      206    18985   246.2     407

============================================================================================
PENALTY PROPORTIONALITY — proposed vs current
  easy         perfect day=+ 138  missed day=-  60  (43% of a perfect day)
  medium       perfect day=+ 184  missed day=-  80  (43% of a perfect day)
  medium_hard  perfect day=+ 207  missed day=-  90  (43% of a perfect day)
  hard         perfect day=+ 230  missed day=- 100  (43% of a perfect day)
  elite        perfect day=+ 253  missed day=- 110  (43% of a perfect day)
  current: perfect day=+155, missed day=-25 (16% of a perfect day) — inactivity nearly free

============================================================================================
MIGRATION ARITHMETIC — the user's own balance
  Current: 8245 XP, True Warrior, floor 7500, verified historical deficit -649
  After opting into reconciliation (unchanged, era-1 rules): 7596 XP

  Option A — grandfather (x10 units, balance and thresholds scale together):
    8245 -> 82,450 XP against a 100,000 ladder; True Warrior floor 75,000
    relative position unchanged (82.5% of the ladder either way)
    days of new-rate perfect 75 Hard to Unbreakable from there: 65
  Option B — era-rescale era-1 earnings to the new rate:
    era-1 conversion factor = 0.135 (new 27.4/day vs current 203.4/day)
    8245 -> 11,107 XP, which is rank 3 (Disciplined)
    the permanent floor would hold the DISPLAY at 75,000 (True Warrior kept), but the earned figure
    would sit far below it, so the floor would be doing all the work — not recommended
```
