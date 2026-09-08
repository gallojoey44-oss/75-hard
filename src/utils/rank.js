import { RANKS } from './gamification';

/**
 * Permanent rank floor — the normalized rank state every screen derives from.
 *
 * Forge ranks work like Clash Royale arenas: once a tier is reached it is
 * permanently unlocked, and effective Lifetime XP can never fall below that
 * tier's threshold again. XP above the floor stays fully reversible; only the
 * portion that would cross the floor is blocked.
 *
 * Two distinct concepts, deliberately kept apart:
 *
 *   rawLifetimeXP      — the calculated total (archives + current challenge).
 *                        Moves both ways: unchecking a task, editing history,
 *                        recalculating a challenge and so on all lower it.
 *   highestRank        — the highest tier EVER unlocked. Monotonic. This is the
 *                        existing persisted field (profile.highestRank); this
 *                        module gives it the meaning it was always intended to
 *                        have rather than introducing a competing one.
 *
 *   floorXP            = RANKS[highestRank - 1].minXP
 *   effectiveXP        = max(rawLifetimeXP, floorXP)
 *
 * Everything the UI shows — rank name, Lifetime XP, tier progress, XP to next
 * rank, badges, ceremonies — reads `resolveRankState`, so it is structurally
 * impossible for one screen to show a rank while another shows XP below that
 * rank's threshold.
 */

/** The rank a bare XP figure sits in (ignoring any floor). */
export function rankForXP(xp) {
  let current = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if ((xp || 0) >= RANKS[i].minXP) { current = RANKS[i]; break; }
  }
  return current;
}

/** The rank NUMBER a bare XP figure sits in. */
export function rankNumberForXP(xp) {
  return rankForXP(xp).rank;
}

/** Rank definition by number (1-based), clamped to the ladder. */
export function rankByNumber(n) {
  if (!n || n < 1) return RANKS[0];
  return RANKS[Math.min(n, RANKS.length) - 1];
}

/**
 * The permanent XP floor for a highest-unlocked rank.
 * Rank 1 (Initiate) floors at 0, which is also the natural minimum.
 */
export function rankFloorXP(highestRank) {
  if (!highestRank || highestRank < 1) return 0;
  return rankByNumber(highestRank).minXP;
}

/**
 * Effective Lifetime XP: the calculated total, never below the permanent floor.
 * This is the ONLY figure any screen should display or compare against.
 */
export function effectiveLifetimeXP(rawLifetimeXP, highestRank) {
  return Math.max(Math.max(0, rawLifetimeXP || 0), rankFloorXP(highestRank));
}

/**
 * Resolve the highest rank a profile has genuinely unlocked, from the strongest
 * evidence already stored — never fabricating one the user did not earn.
 *
 * Evidence, strongest first (the maximum of all of them wins, since each is a
 * record of something that actually happened):
 *   1. profile.highestRank — the persisted permanent rank
 *   2. profile.rankHistory — the Hall of Legends unlock record
 *   3. the rank implied by current raw Lifetime XP — a rank they demonstrably
 *      hold right now
 *
 * Returns null only when there is no evidence at all AND no XP, i.e. a brand
 * new profile that has not been baselined yet.
 */
export function resolveHighestRank(profile, rawLifetimeXP = 0) {
  const stored = Number.isFinite(profile?.highestRank) ? profile.highestRank : 0;
  const historic = (profile?.rankHistory || []).reduce((m, h) => Math.max(m, h?.rank || 0), 0);
  const byXP = rankNumberForXP(rawLifetimeXP);
  const best = Math.max(stored, historic, byXP);
  return best > 0 ? Math.min(best, RANKS.length) : null;
}

/**
 * The complete normalized rank state for a profile.
 *
 * Tier progress runs from the CURRENT tier's floor to the NEXT tier's threshold,
 * so it reads 0% when sitting exactly on the floor and 100% on reaching the next
 * tier. `xpToNext` always uses the real next-tier threshold — never the current
 * tier's own, which is what produces "N XP to <the rank you already hold>".
 */
export function resolveRankState({ rawLifetimeXP = 0, highestRank = null } = {}) {
  const raw = Math.max(0, rawLifetimeXP || 0);
  // A rank the XP alone proves is held counts even before it is persisted, so
  // the floor is correct on the very first render after a rank-up.
  const unlocked = Math.max(highestRank || 0, rankNumberForXP(raw)) || 1;
  const floorXP = rankFloorXP(unlocked);
  const xp = Math.max(raw, floorXP);

  const current = rankByNumber(unlocked);
  const next = RANKS[unlocked] || null;      // RANKS is 0-indexed; unlocked is 1-based
  const span = next ? next.minXP - current.minXP : 0;
  const progress = next ? Math.max(0, Math.min(100, Math.round(((xp - current.minXP) / span) * 100))) : 100;

  return {
    // Identity
    current,
    next,
    highestRank: unlocked,
    // XP
    xp,                                  // effective — what every screen shows
    rawXP: raw,                          // the calculated total, for diagnostics
    floorXP,                             // the permanent floor
    floored: xp > raw,                   // the floor is actively holding XP up
    atFloor: xp === floorXP && !!next,   // sitting exactly at the start of the tier
    // Progress toward the next tier
    progress,
    xpToNext: next ? Math.max(0, next.minXP - xp) : 0,
    tierSpan: span,
    xpIntoTier: xp - current.minXP,
  };
}

/** True when a rank number has been permanently unlocked. */
export function isRankUnlocked(rankNumber, highestRank) {
  return (highestRank || 0) >= rankNumber;
}
