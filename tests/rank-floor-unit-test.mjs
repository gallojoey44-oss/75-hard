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
const WARRIOR = byName('Warrior');            // 3,000
const ELITE = byName('Elite Warrior');        // 5,000
const TRUE = byName('True Warrior');          // 7,500
const UNBREAKABLE = byName('Unbreakable');    // 10,000
const state = (raw, highest) => resolveRankState({ rawLifetimeXP: raw, highestRank: highest });

// ══ The ladder is the single configuration ══════════════════════════════════
check('thresholds come from the central ladder, not from any component',
  ELITE.minXP === 5000 && TRUE.minXP === 7500 && UNBREAKABLE.minXP === 10000,
  `Elite=${ELITE.minXP} True=${TRUE.minXP}`);
check('ranks are strictly ascending', RANKS.every((r, i) => i === 0 || r.minXP > RANKS[i - 1].minXP));
check('rankFloorXP resolves a tier threshold', rankFloorXP(ELITE.rank) === 5000 && rankFloorXP(TRUE.rank) === 7500);
check('rank 0 / unset floors at 0', rankFloorXP(0) === 0 && rankFloorXP(null) === 0);
check('rankByNumber clamps beyond the ladder', rankByNumber(99) === RANKS[RANKS.length - 1]);

// ══ 1: below a new tier, XP moves freely both ways ══════════════════════════
let s = state(4000, WARRIOR.rank);
check('1: below the next tier the user sits in their unlocked tier', s.current.name === 'Warrior');
check('1: XP can rise toward the next tier', state(4500, WARRIOR.rank).xp === 4500);
check('1: XP can fall while still above the floor', state(3400, WARRIOR.rank).xp === 3400);
check('1: nothing is floored while above the floor', !state(3400, WARRIOR.rank).floored);

// ══ 2: reaching a tier unlocks it ═══════════════════════════════════════════
s = state(5000, WARRIOR.rank);
check('2: reaching 5,000 resolves as Elite Warrior even before it is persisted',
  s.current.name === 'Elite Warrior' && s.highestRank === ELITE.rank);
check('2: the new tier immediately becomes the floor', s.floorXP === 5000);

// ══ 3/4/5: decline stops exactly at the threshold ═══════════════════════════
check('3: XP can decline after unlocking a tier', state(9000, ELITE.rank).xp === 9000);
for (const raw of [9700, 9000, 8000, 7600, 5001]) {
  if (state(raw, ELITE.rank).xp !== raw) { check(`3: ${raw} is untouched above the floor`, false); break; }
}
check('3: every value above the floor is reported unchanged', true);
check('4: XP can decline all the way to the tier minimum', state(5000, ELITE.rank).xp === 5000);
check('5: XP cannot decline one point below the threshold',
  state(4999, ELITE.rank).xp === 5000, `${state(4999, ELITE.rank).xp}`);
check('5: even a total collapse to 0 holds at the floor', state(0, ELITE.rank).xp === 5000);
check('5: a negative calculated total still holds at the floor', state(-500, ELITE.rank).xp === 5000);
check('5: the rank never regresses below the unlocked tier',
  state(0, ELITE.rank).current.name === 'Elite Warrior');
check('5: the state reports that the floor is holding XP up', state(4999, ELITE.rank).floored === true);
check('5: effectiveLifetimeXP is the same rule, standalone',
  effectiveLifetimeXP(4999, ELITE.rank) === 5000 && effectiveLifetimeXP(6000, ELITE.rank) === 6000);

// ══ 6: highest unlocked tier never decreases ════════════════════════════════
check('6: a low XP total cannot lower the resolved permanent rank',
  state(0, TRUE.rank).highestRank === TRUE.rank);
check('6: resolving never returns a rank below the stored one',
  [0, 1, 100, 4999, 7499].every(x => state(x, TRUE.rank).highestRank === TRUE.rank));
check('6: a HIGHER rank proven by XP does raise it',
  state(10000, ELITE.rank).highestRank === UNBREAKABLE.rank);

// ══ 15: migration — evidence-based, never demoting, never fabricating ═══════
// The reported case: rank shown as Elite Warrior with XP below that threshold.
check('15: a profile with persisted Elite Warrior and 4,900 XP is normalized UP, not demoted', (() => {
  const prof = { highestRank: ELITE.rank, rankHistory: [] };
  const resolved = resolveHighestRank(prof, 4900);
  const st = state(4900, resolved);
  return resolved === ELITE.rank && st.current.name === 'Elite Warrior' && st.xp === 5000;
})());
check('15: rank history alone is sufficient evidence', (() => {
  const prof = { rankHistory: [{ rank: 5 }, { rank: 6 }] };
  return resolveHighestRank(prof, 100) === ELITE.rank;
})());
check('15: current XP alone is sufficient evidence',
  resolveHighestRank({}, 7600) === TRUE.rank);
check('15: the strongest evidence wins across sources',
  resolveHighestRank({ highestRank: 3, rankHistory: [{ rank: 5 }] }, 100) === 5 &&
  resolveHighestRank({ highestRank: 6, rankHistory: [{ rank: 2 }] }, 100) === 6 &&
  resolveHighestRank({ highestRank: 2, rankHistory: [{ rank: 2 }] }, 7600) === TRUE.rank);
check('15: a rank the user never earned is never fabricated',
  resolveHighestRank({ highestRank: 2, rankHistory: [{ rank: 1 }, { rank: 2 }] }, 300) === 2);
check('15: a brand-new profile at 0 XP baselines to Initiate (floor 0 — a no-op)',
  resolveHighestRank({}, 0) === RANKS[0].rank && rankFloorXP(RANKS[0].rank) === 0);
check('15: a profile object with nothing at all still resolves safely',
  resolveHighestRank(null, 0) === RANKS[0].rank);
check('15: evidence is clamped to the real ladder',
  resolveHighestRank({ highestRank: 99 }, 0) === RANKS.length);

// ══ 16/17/18: tier progress and next-rank copy ══════════════════════════════
s = state(5000, ELITE.rank);
check('16: progress is 0% sitting exactly on the tier floor', s.progress === 0);
check('16: at the floor the state flags "start of tier", not a pending re-unlock', s.atFloor === true);
check('16: the rank at the floor is still the unlocked tier', s.current.name === 'Elite Warrior');
// Reaching the next threshold PROMOTES: progress fills to 100% just below it,
// and the moment it is crossed the user is at 0% of the tier they just unlocked.
check('17: progress fills to 100% immediately below the next tier',
  state(7499, ELITE.rank).progress === 100, `${state(7499, ELITE.rank).progress}%`);
check('17: crossing the threshold promotes rather than parking at 100%', (() => {
  const st = state(7500, ELITE.rank);
  return st.current.name === 'True Warrior' && st.progress === 0 && st.atFloor === true;
})());
check('17: the midpoint reads 50%', state(6250, ELITE.rank).progress === 50);
check('17: the worked example — 8,000 in a 7,500→10,000 tier is 20%',
  state(8000, TRUE.rank).progress === 20, `${state(8000, TRUE.rank).progress}%`);
check('18: "XP to next" uses the NEXT tier threshold, not the current one',
  state(8000, TRUE.rank).next.name === 'Unbreakable' && state(8000, TRUE.rank).xpToNext === 2000);
check('18: at 7,490 with Elite unlocked, 10 XP remain to True Warrior', (() => {
  const st = state(7490, ELITE.rank);
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
check('19: the displayed XP is always the effective figure',
  state(4000, ELITE.rank).xp === 5000 && state(4000, ELITE.rank).rawXP === 4000);

// ══ 12/13: XP reversals respect the floor but stay reversible ═══════════════
// Simulate a sequence of reversals (unchecking tasks, editing history, a
// challenge recalculation) against a profile that has unlocked Elite Warrior.
let raw = 9700;
const seen = [];
for (const delta of [-700, -1000, -1500, -800, -400, -2000]) {
  raw += delta;
  seen.push(state(raw, ELITE.rank).xp);
}
check('12: reversals above the floor take effect in full',
  seen.slice(0, 3).join() === '9000,8000,6500', seen.join());
check('12: reversals crossing the floor are clamped, not rejected outright',
  seen[3] === 5700 && seen[4] === 5300);
check('12: the reversal that would cross the floor stops at it', seen[5] === 5000);
check('13: further historical edits cannot push below the floor',
  state(-99999, ELITE.rank).xp === 5000);
check('12: XP above the floor is still genuinely reversible',
  state(6000, ELITE.rank).xp === 6000 && state(5500, ELITE.rank).xp === 5500);

// ══ 11: challenge XP resets do not touch the Lifetime floor ═════════════════
// A challenge XP reset zeroes the CURRENT challenge contribution; archived XP
// and the permanent floor are untouched.
check('11: zeroing the current challenge leaves the floor intact',
  state(0, TRUE.rank).xp === 7500 && state(0, TRUE.rank).current.name === 'True Warrior');

// ══ 14: reaching the next tier raises the floor permanently ═════════════════
s = state(10000, TRUE.rank);
check('14: reaching Unbreakable resolves the higher rank', s.highestRank === UNBREAKABLE.rank);
check('14: the new floor is the new tier threshold', s.floorXP === 10000);
check('14: after the raise, falling to 9,999 is held at 10,000',
  state(9999, UNBREAKABLE.rank).xp === 10000);
check('14: the user can never return to True Warrior',
  state(0, UNBREAKABLE.rank).current.name === 'Unbreakable');

// ══ isRankUnlocked ══════════════════════════════════════════════════════════
check('unlocked ranks are reported as unlocked',
  isRankUnlocked(ELITE.rank, TRUE.rank) && isRankUnlocked(TRUE.rank, TRUE.rank));
check('higher ranks are still locked', !isRankUnlocked(UNBREAKABLE.rank, TRUE.rank));

// ══ bare helpers ════════════════════════════════════════════════════════════
check('rankForXP maps to the containing tier',
  rankForXP(0).name === 'Initiate' && rankForXP(4999).name === 'Warrior' &&
  rankForXP(5000).name === 'Elite Warrior' && rankForXP(7500).name === 'True Warrior');
check('rankNumberForXP agrees', rankNumberForXP(7500) === TRUE.rank);

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
