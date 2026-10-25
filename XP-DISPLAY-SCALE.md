# Legacy XP display inconsistency — root cause and fix

**Reported:** a LOCK IN task shows `25 XP`, and completing it increases Lifetime
XP by `250`.

**Verdict: a display inconsistency, not a calculation error. No XP balance was
ever wrong, and no balance changes as a result of this fix.**

---

## 1. What was actually happening

Forge's XP economy is versioned. Each attempt is stamped at start with the
economy ("era") it runs under, and the engine reads that stamp rather than
global config — which is what lets an era-1 attempt keep its original rates
while the app's current economy moves on.

Era 2 stores XP in units **ten times finer** than era 1, because a 27.4 XP/day
budget cannot be divided across eight tasks in whole numbers that still
distinguish a keystone from a supporting habit. Rather than rewrite stored
history, each era declares a display scale and the conversion happens at read
time:

```
displayXP = storedXP × DISPLAY_SCALE[era]        DISPLAY_SCALE = { 1: 10, 2: 1 }
```

Lifetime XP and the rank ladder are a single shared ladder, so
`computeXPBreakdown` applies that multiply to every archive (by its own era) and
to the live segment (by the active attempt's era) — **exactly once each**.

The defect: **only the lifetime total crossed that boundary.** Every other
figure the app showed — task rows, today's earned/remaining, Challenge XP,
missed-day penalties, the comeback notice, XP History rows, archive summaries,
the challenge-result screen, notification copy — was rendered in the attempt's
raw stored units. On a legacy attempt the two scales therefore appeared side by
side, and a 25 XP row moved a 250 XP balance.

Reproduced exactly, before the fix, on a real era-1 LOCK IN attempt:

| Figure | Before ticking | After ticking the "25 XP" task |
|---|---|---|
| Task row | 25 XP | 25 XP |
| Today's earned | +0 | **+25** |
| Challenge XP | 0 | **25** |
| Lifetime XP | 40,000 | **40,250** |

The balance moved by 250 — which was correct. The reward was quoted in the wrong
currency.

### Was the balance ever wrong?

No.

* `computeXPBreakdown` scales each archive once (`toDisplayXP(xpEarned, archiveEraOf(a))`)
  and the live segment once (`gained/lost × displayScaleFor(currentEra)`).
* A ledger charge or forgiveness credit written after era 2 carries
  `ledgerUnits`/`forgivenUnits: 2` and is never scaled a second time.
* Reading the breakdown repeatedly is idempotent — it is a pure function of
  stored records, so no duplicate XP can accumulate.
* The rank floor, the rank ladder and the 100,000-XP Unbreakable benchmark are
  already expressed in display units and are never passed through the
  conversion.

Both of those are covered by assertions in
`tests/xp-display-scale-unit-test.mjs`.

---

## 2. The fix

A single display boundary, `src/utils/xpDisplay.js`:

```js
scaleOfMeta(meta)       // an attempt's scale, from its stamp
scaleOfArchive(entry)   // an archive's scale, from the era it ran under
displayXP(stored, scale)
fmtXP(stored, scale)
makeTaskXP(meta)        // a task-XP reader in display units, carrying the rate card
```

`dayRules(meta)` now carries `displayScale`, so anything already holding an
attempt's rate card has the scale without resolving the era twice.

Two rules hold throughout:

1. **Scale once, at the display edge.** Figures from a display-units source
   (Lifetime XP, the rank ladder and floor, the reconciliation ledger,
   `xpBreakdown.toDisplay`) are not converted again.
2. **One scale per segment**, taken from the attempt whose era that segment is
   counted under. The live segment uses the *primary* attempt's era, because
   that is the era `computeXPBreakdown` converts the live segment with — so what
   a row advertises is what completing it moves the balance by.

### Converted (were raw, now display units)

| Surface | Figures |
|---|---|
| Today — task rows | per-task XP (both profiles), habit guide |
| Today — header | earned, left, the tap-through breakdown, perfect-day bonus |
| Today — Daily Log card | the log habit's XP |
| Today — Bonus Missions | per-mission XP, the daily cap, the earned summary |
| Today — Challenge Performance | required XP earned/available, bonus XP, projection |
| Home | Challenge XP, today's +/−, the XP float, Rank Details |
| Home — comeback notice | the gap's XP cost |
| Home — missed days card | the total and each day |
| Home — XP History | every row, each by its own era |
| Home — challenge result | task XP, passing bonus, bonus missions, total |
| Settings | Challenge XP, every archive figure, the delete-archive warning |
| Library & setup screens | priced requirements, weekly requirements, XP summary |
| Notifications | task reminders, the Daily Log reminder, settings labels |

### Deliberately unchanged

* Everything on disk. The conversion is a multiply at render time; deleting the
  scale table restores the previous display exactly.
* The era-1 and era-2 rate cards. No attempt is repriced, re-stamped or
  promoted; an era-1 attempt stays era 1 and computes the exact stored totals it
  always did.
* Lifetime XP, rank, the rank floor, archives, Daily Log records, both profiles,
  scheduled starts, Comeback, push notifications, backups.
* `XPReconciliation` and `ChallengeXPBreakdown`, which already converted their
  own figures.

### Two era-isolation defects found and fixed on the way

Both were real disagreements between what was shown and what was charged, not
scale problems:

1. **`missedDayDetail` and `recentGap` took no rate card.** They fell back to
   era-1 rules, so an era-2 attempt's missed day was reported at the old flat 25
   while the balance was charged a share of that attempt's budget (90 for a
   medium-hard standard attempt). Both now resolve `dayRules(meta)`.
2. **The Insights XP trend** called `computeDayXP` without rules, scoring era-2
   days against era-1 flat bonuses and penalties. Only the sign of each day is
   displayed, so nothing visible was wrong — but the trend could read the wrong
   way. It now passes the attempt's rate card.

### One pre-existing oddity, reported rather than changed

A support challenge started *now* is stamped era 2, and it can be stacked onto a
primary that is still era 1. The engine then sums both lanes' task XP in one
day, in two different unit scales, and the whole live segment is converted by
the primary's era. An era-2 support task in an era-1 primary's segment therefore
contributes ten times its intended weight to the balance.

This is in the stored economy, not the display: fixing it means repricing one of
the two attempts, which is explicitly out of scope here. The display is honest
about it — a row shows what the balance will actually move by. Worth deciding on
separately.

---

## 3. Tests

| Suite | Checks |
|---|---|
| `tests/xp-display-scale-unit-test.mjs` | 60 |
| `tests/xp-display-scale-e2e-test.mjs` | 61 |

The unit suite pins the scale table and its carriers, the per-task reader, the
"display == balance movement" invariant on both eras, scaled-exactly-once for
archives and ledger amounts, the rank floor passing through unconverted,
penalties under each attempt's own rules, and that unconverted history rows
would *not* reconcile — so the guard cannot silently stop guarding.

The e2e suite drives the real app at iPhone width with an era-1 attempt beside
an era-2 archive and checks: the reported row, the header, the Daily Log card,
Challenge XP and Lifetime XP all move by one figure; XP is paid once; storage is
untouched; unticking reverses exactly; a reload and a profile switch change
nothing; XP History reconciles; Settings and the archive list agree; the
comeback notice and missed-days card quote the penalty actually charged; the
result screen's parts add up; and an era-2 profile's figures are not inflated.

Six existing suites asserted the old raw-unit display for their era-1 fixtures
(`challenge-combination`, `fatloss-hierarchy`, `today-order`, `today-redesign`,
`weekly-requirements`, `welcome-back`). Their expectations were updated to the
converted figures, with the intent of each assertion left intact.
