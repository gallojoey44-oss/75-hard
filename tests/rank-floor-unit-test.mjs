/**
 * Permanent rank floor — the normalized rank state.
 *
 * Once a tier is unlocked it can never be lost: effective Lifetime XP is the
 * calculated total clamped up to that tier's threshold. XP above the floor stays
 * fully reversible; only the portion that would cross the floor is blocked.
 */
import { RANKS } from '../src/utils/gamification.js';
import {
  rankForXP, rankNumberForXP, rankByNumber, rankFloorXP, effectiveLifetimeXP,
  resolveHighestRank, resolveRankState, isRankUnlocked,
} from '../src/utils/rank.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
const byName = n => RANKS.find(r => r.name === n);
const WARRIOR = byName('Warrior');
const ELITE = byName('Elite Warrior');
const TRUE = byName('True Warrior');
const UNBREAKABLE = byName('Unbreakable');
// Thresholds live in the central ladder and moved with XP economy v2, so this
// suite asserts the FLOOR RULE against the ladder's own values rather than
// against figures copied out of it — the rule is what is under test.
const state = (raw, highest) => resolveRankState({ rawLifetimeXP: raw, highestRank: highest });

// ══ The ladder is the single configuration ══════════════════════════════════
check('thresholds come from the central ladder, not from any component',
  ELITE.minXP > WARRIOR.minXP && TRUE.minXP > ELITE.minXP && UNBREAKABLE.minXP > TRUE.minXP,
  `Warrior=${WARRIOR.minXP} Elite=${ELITE.minXP} True=${TRUE.minXP} Unbreakable=${UNBREAKABLE.minXP}`);
check('ranks are strictly ascending', RANKS.every((r, i) => i === 0 || r.minXP > RANKS[i - 1].minXP));
check('rankFloorXP resolves a tier threshold',
  rankFloorXP(ELITE.rank) === ELITE.minXP && rankFloorXP(TRUE.rank) === TRUE.minXP);
check('rank 0 / unset floors at 0', rankFloorXP(0) === 0 && rankFloorXP(null) === 0);
check('rankByNumber clamps beyond the ladder', rankByNumber(99) === RANKS[RANKS.length - 1]);

// ══ 1: below a new tier, XP moves freely both ways ══════════════════════════
// A point inside the Warrior tier, below the next threshold.
const MID_WARRIOR = Math.round((WARRIOR.minXP + ELITE.minXP) / 2);
let s = state(MID_WARRIOR, WARRIOR.rank);
check('1: below the next tier the user sits in their unlocked tier', s.current.name === 'Warrior');
check('1: XP can rise toward the next tier',
  state(MID_WARRIOR + 100, WARRIOR.rank).xp === MID_WARRIOR + 100);
check('1: XP can fall while still above the floor',
  state(WARRIOR.minXP + 100, WARRIOR.rank).xp === WARRIOR.minXP + 100);
check('1: nothing is floored while above the floor',
  !state(WARRIOR.minXP + 100, WARRIOR.rank).floored);

// ══ 2: reaching a tier unlocks it ═══════════════════════════════════════════
s = state(ELITE.minXP, WARRIOR.rank);
check('2: reaching the threshold resolves as Elite Warrior before it is persisted',
  s.current.name === 'Elite Warrior' && s.highestRank === ELITE.rank);
check('2: the new tier immediately becomes the floor', s.floorXP === ELITE.minXP);

// ══ 3/4/5: decline stops exactly at the threshold ═══════════════════════════
check('3: XP can decline after unlocking a tier',
  state(TRUE.minXP + 100, ELITE.rank).xp === TRUE.minXP + 100);
for (const raw of [UNBREAKABLE.minXP - 1, TRUE.minXP + 500, TRUE.minXP, ELITE.minXP + 500, ELITE.minXP + 1]) {
  if (state(raw, ELITE.rank).xp !== raw) { check(`3: ${raw} is untouched above the floor`, false); break; }
}
check('3: every value above the floor is reported unchanged', true);
check('4: XP can decline all the way to the tier minimum',
  state(ELITE.minXP, ELITE.rank).xp === ELITE.minXP);
check('5: XP cannot decline one point below the threshold',
  state(ELITE.minXP - 1, ELITE.rank).xp === ELITE.minXP, `${state(ELITE.minXP - 1, ELITE.rank).xp}`);
check('5: even a total collapse to 0 holds at the floor', state(0, ELITE.rank).xp === ELITE.minXP);
check('5: a negative calculated total still holds at the floor', state(-500, ELITE.rank).xp === ELITE.minXP);
check('5: the rank never regresses below the unlocked tier',
  state(0, ELITE.rank).current.name === 'Elite Warrior');
check('5: the state reports that the floor is holding XP up',
  state(ELITE.minXP - 1, ELITE.rank).floored === true);
check('5: effectiveLifetimeXP is the same rule, standalone',
  effectiveLifetimeXP(ELITE.minXP - 1, ELITE.rank) === ELITE.minXP &&
  effectiveLifetimeXP(ELITE.minXP + 1000, ELITE.rank) === ELITE.minXP + 1000);

// ══ 6: highest unlocked tier never decreases ════════════════════════════════
check('6: a low XP total cannot lower the resolved permanent rank',
  state(0, TRUE.rank).highestRank === TRUE.rank);
check('6: resolving never returns a rank below the stored one',
  [0, 1, 100, ELITE.minXP - 1, TRUE.minXP - 1].every(x => state(x, TRUE.rank).highestRank === TRUE.rank));
check('6: a HIGHER rank proven by XP does raise it',
  state(UNBREAKABLE.minXP, ELITE.rank).highestRank === UNBREAKABLE.rank);

// ══ 15: migration — evidence-based, never demoting, never fabricating ═══════
// The reported case: rank shown as Elite Warrior with XP below that threshold.
check('15: a profile persisted at Elite Warrior but below it is normalized UP, not demoted', (() => {
  const below = ELITE.minXP - 100;
  const prof = { highestRank: ELITE.rank, rankHistory: [] };
  const resolved = resolveHighestRank(prof, below);
  const st = state(below, resolved);
  return resolved === ELITE.rank && st.current.name === 'Elite Warrior' && st.xp === ELITE.minXP;
})());
check('15: rank history alone is sufficient evidence', (() => {
  const prof = { rankHistory: [{ rank: 5 }, { rank: 6 }] };
  return resolveHighestRank(prof, 100) === ELITE.rank;
})());
check('15: current XP alone is sufficient evidence',
  resolveHighestRank({}, TRUE.minXP + 100) === TRUE.rank);
check('15: the strongest evidence wins across sources',
  resolveHighestRank({ highestRank: 3, rankHistory: [{ rank: 5 }] }, 100) === 5 &&
  resolveHighestRank({ highestRank: 6, rankHistory: [{ rank: 2 }] }, 100) === 6 &&
  resolveHighestRank({ highestRank: 2, rankHistory: [{ rank: 2 }] }, TRUE.minXP + 100) === TRUE.rank);
check('15: a rank the user never earned is never fabricated',
  resolveHighestRank({ highestRank: 2, rankHistory: [{ rank: 1 }, { rank: 2 }] }, 300) === 2);
check('15: a brand-new profile at 0 XP baselines to Initiate (floor 0 — a no-op)',
  resolveHighestRank({}, 0) === RANKS[0].rank && rankFloorXP(RANKS[0].rank) === 0);
check('15: a profile object with nothing at all still resolves safely',
  resolveHighestRank(null, 0) === RANKS[0].rank);
check('15: evidence is clamped to the real ladder',
  resolveHighestRank({ highestRank: 99 }, 0) === RANKS.length);

// ══ 16/17/18: tier progress and next-rank copy ══════════════════════════════
s = state(ELITE.minXP, ELITE.rank);
check('16: progress is 0% sitting exactly on the tier floor', s.progress === 0);
check('16: at the floor the state flags "start of tier", not a pending re-unlock', s.atFloor === true);
check('16: the rank at the floor is still the unlocked tier', s.current.name === 'Elite Warrior');
// Reaching the next threshold PROMOTES: progress fills to 100% just below it,
// and the moment it is crossed the user is at 0% of the tier they just unlocked.
check('17: progress fills to 100% immediately below the next tier',
  state(TRUE.minXP - 1, ELITE.rank).progress === 100, `${state(TRUE.minXP - 1, ELITE.rank).progress}%`);
check('17: crossing the threshold promotes rather than parking at 100%', (() => {
  const st = state(TRUE.minXP, ELITE.rank);
  return st.current.name === 'True Warrior' && st.progress === 0 && st.atFloor === true;
})());
check('17: the midpoint reads 50%',
  state(Math.round((ELITE.minXP + TRUE.minXP) / 2), ELITE.rank).progress === 50);
check('17: a fifth of the way into the top tier reads 20%', (() => {
  const at = TRUE.minXP + Math.round((UNBREAKABLE.minXP - TRUE.minXP) * 0.2);
  return state(at, TRUE.rank).progress === 20;
})(), `${state(TRUE.minXP + Math.round((UNBREAKABLE.minXP - TRUE.minXP) * 0.2), TRUE.rank).progress}%`);
check('18: "XP to next" uses the NEXT tier threshold, not the current one', (() => {
  const at = TRUE.minXP + 1000;
  return state(at, TRUE.rank).next.name === 'Unbreakable' &&
    state(at, TRUE.rank).xpToNext === UNBREAKABLE.minXP - at;
})());
check('18: just short of True Warrior, the remainder is exact', (() => {
  const st = state(TRUE.minXP - 10, ELITE.rank);
  return st.current.name === 'Elite Warrior' && st.next.name === 'True Warrior' && st.xpToNext === 10;
})());
check('18: xpToNext is never negative', state(9999999, ELITE.rank).xpToNext === 0);
check('18: the top rank has no next tier and reads 100%',
  state(12000, UNBREAKABLE.rank).next === null && state(12000, UNBREAKABLE.rank).progress === 100);
check('16/17: progress is always clamped to 0–100',
  [0, 1, 4999, 5000, 6000, 7500, 99999].every(x => {
    const p = state(x, ELITE.rank).progress;
    return p >= 0 && p <= 100;
  }));

// ══ 19: a rank can never be shown beside XP below its threshold ═════════════
// Exhaustive over every rank and a wide XP sweep — the invariant that makes the
// reported inconsistency structurally impossible.
let violations = 0;
for (const r of RANKS) {
  for (const raw of [-100, 0, 1, 249, 250, 749, 1499, 2999, 4999, 5000, 7499, 7500, 9999, 10000, 25000]) {
    const st = state(raw, r.rank);
    if (st.xp < st.current.minXP) violations++;
    if (st.current.rank < r.rank) violations++;         // never demoted
  }
}
check('19: no (rank, XP) pair can ever be displayed below that rank\'s threshold', violations === 0, `${violations}`);
check('19: the displayed XP is always the effective figure', (() => {
  const below = ELITE.minXP - 1000;
  return state(below, ELITE.rank).xp === ELITE.minXP && state(below, ELITE.rank).rawXP === below;
})());

// ══ 12/13: XP reversals respect the floor but stay reversible ═══════════════
// Simulate a sequence of reversals (unchecking tasks, editing history, a
// challenge recalculation) against a profile that has unlocked Elite Warrior.
// Steps sized from the tier itself, so the sequence crosses the floor
// wherever the ladder sits: four reversals that stay above it, then one that
// would go through it.
const STEP = Math.round((TRUE.minXP - ELITE.minXP) / 5);
let raw = ELITE.minXP + STEP * 4;
const expected = [];
const seen = [];
for (let i = 0; i < 6; i++) {
  raw -= STEP;
  expected.push(Math.max(raw, ELITE.minXP));
  seen.push(state(raw, ELITE.rank).xp);
}
check('12: reversals above the floor take effect in full',
  seen.slice(0, 3).join() === expected.slice(0, 3).join(), seen.join());
check('12: reversals crossing the floor are clamped, not rejected outright',
  seen[3] === expected[3] && seen[4] === ELITE.minXP);
check('12: the reversal that would cross the floor stops at it', seen[5] === ELITE.minXP);
check('13: further historical edits cannot push below the floor',
  state(-99999, ELITE.rank).xp === ELITE.minXP);
check('12: XP above the floor is still genuinely reversible',
  state(ELITE.minXP + 1000, ELITE.rank).xp === ELITE.minXP + 1000 &&
  state(ELITE.minXP + 500, ELITE.rank).xp === ELITE.minXP + 500);

// ══ 11: challenge XP resets do not touch the Lifetime floor ═════════════════
// A challenge XP reset zeroes the CURRENT challenge contribution; archived XP
// and the permanent floor are untouched.
check('11: zeroing the current challenge leaves the floor intact',
  state(0, TRUE.rank).xp === TRUE.minXP && state(0, TRUE.rank).current.name === 'True Warrior');

// ══ 14: reaching the next tier raises the floor permanently ═════════════════
s = state(UNBREAKABLE.minXP, TRUE.rank);
check('14: reaching Unbreakable resolves the higher rank', s.highestRank === UNBREAKABLE.rank);
check('14: the new floor is the new tier threshold', s.floorXP === UNBREAKABLE.minXP);
check('14: after the raise, falling one short is held at the new floor',
  state(UNBREAKABLE.minXP - 1, UNBREAKABLE.rank).xp === UNBREAKABLE.minXP);
check('14: the user can never return to True Warrior',
  state(0, UNBREAKABLE.rank).current.name === 'Unbreakable');

// ══ isRankUnlocked ══════════════════════════════════════════════════════════
check('unlocked ranks are reported as unlocked',
  isRankUnlocked(ELITE.rank, TRUE.rank) && isRankUnlocked(TRUE.rank, TRUE.rank));
check('higher ranks are still locked', !isRankUnlocked(UNBREAKABLE.rank, TRUE.rank));

// ══ bare helpers ════════════════════════════════════════════════════════════
check('rankForXP maps to the containing tier',
  rankForXP(0).name === 'Initiate' &&
  rankForXP(ELITE.minXP - 1).name === 'Warrior' &&
  rankForXP(ELITE.minXP).name === 'Elite Warrior' &&
  rankForXP(TRUE.minXP).name === 'True Warrior');
check('rankForXP holds at every threshold and one below it',
  RANKS.every((r, i) => rankForXP(r.minXP).rank === r.rank &&
    (i === 0 || rankForXP(r.minXP - 1).rank === RANKS[i - 1].rank)));
check('rankNumberForXP agrees', rankNumberForXP(TRUE.minXP) === TRUE.rank);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
