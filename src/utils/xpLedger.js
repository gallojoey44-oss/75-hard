import { computeTotalXP, computeLifetimeXP } from './gamification';
import { dayNumberForDate } from './dateUtils';

/**
 * The XP penalty ledger.
 *
 * Forge's inactivity penalties have always been CALCULATED correctly — an
 * untouched past day costs 25 XP, on a challenge and on Forge Daily alike —
 * but they could never reduce Lifetime XP, for two reasons:
 *
 *   1. computeLifetimeXP took max(0, currentRawTotal), so a segment that had
 *      gone negative contributed zero instead of subtracting.
 *   2. An archived segment stores `xpEarned = max(0, gained - lost)`, so any
 *      deficit was clipped away at archive time and never recorded anywhere.
 *
 * This module closes both, without ever rewriting history:
 *
 *   • Archives are READ ONLY. `xpEarned` and every other stored field keep
 *     their original values forever. Nothing here writes to an archive.
 *   • The deficit that was clipped is recovered by RE-RUNNING THE SAME RULES
 *     over the day records each archive already stores (`entry.days`,
 *     `entry.tasks`, `entry.endDayNum`). It is recomputed, not estimated.
 *   • The result is recorded once, with the user's approval, in a separate
 *     per-profile ledger. The ledger is the only thing subtracted.
 *
 * Effective Lifetime XP = earned - penalties, clamped up to the floor of the
 * highest rank ever unlocked. A rank, once unlocked, is never lost.
 */

export const LEDGER_VERSION = 1;

/** A fresh, unreconciled ledger. */
export function makeLedger() {
  return { version: LEDGER_VERSION, reconciled: null };
}

/** True once the one-time historical reconciliation has been applied. */
export function isReconciled(ledger) {
  return !!ledger?.reconciled;
}

/** The XP this profile's ledger currently deducts. */
export function ledgerPenalty(ledger) {
  return Math.max(0, Number(ledger?.reconciled?.amount) || 0);
}

/**
 * Re-run computeTotalXP over one archived segment, using the archive's own
 * stored day records and task list.
 *
 * This deliberately calls the SAME function the live app uses rather than
 * reimplementing the rules, so a reconciliation can never diverge from what
 * the app would have charged at the time.
 */
function recompute(entry, penaltiesEnabled) {
  const profId = '_archive';
  const profiles = { [profId]: {
    challengeStart: entry.challengeStart,
    activeChallenge: entry.challenge,
    tasks: entry.tasks || [],
    xpPenalties: penaltiesEnabled,
    xpStartDay: entry.xpStartDay ?? 1,
    xpOffset: entry.xpOffset ?? 0,
    weeklySessions: entry.weeklySessions || [],
    comebackHistory: entry.comebackHistory || [],
  } };
  const allDays = { [profId]: entry.days || {} };
  // Day completion for streak evaluation, derived from the archived records
  // exactly as the live app derives it.
  const tasks = entry.tasks || [];
  const completion = (n) => {
    const d = (entry.days || {})[n];
    if (!d || !tasks.length) return 0;
    const done = tasks.filter(t => d.tasks?.[t.id]).length;
    return Math.round((done / tasks.length) * 100);
  };
  const dayNum = entry.endDayNum || 1;
  return computeTotalXP(allDays, profiles, profId, completion, dayNum, dayNum);
}

/**
 * What one archived segment contributes to the reconciliation.
 *
 * Returns { id, name, stored, gained, lost, discarded, verified, reason }.
 *
 * `discarded` is the amount `max(0, gained - lost)` clipped away at archive
 * time — i.e. penalties the system charged and then threw out. When the
 * segment ended in credit, nothing was clipped and `discarded` is 0, so a
 * healthy challenge is never retro-charged.
 *
 * VERIFICATION. A segment is only reconciled when the recomputation
 * reproduces the figure actually stored in the archive. If a template has
 * since changed, or records are incomplete, the numbers will not match — and
 * the honest answer is then to charge nothing and say so, rather than to
 * invent a penalty from data we cannot stand behind.
 */
export function archiveDeficit(entry) {
  const base = {
    id: entry?.id || null,
    name: entry?.challenge?.name || 'Challenge',
    endDate: entry?.endDate || entry?.archivedAt || null,
    stored: Math.max(0, Number(entry?.xpEarned) || 0),
    gained: 0, lost: 0, discarded: 0, verified: false, reason: null,
  };
  if (!entry || !entry.days || !entry.endDayNum) {
    return { ...base, reason: 'no day records stored' };
  }

  let withPenalties;
  let withoutPenalties;
  try {
    withPenalties = recompute(entry, true);
    withoutPenalties = recompute(entry, false);
  } catch (err) {
    return { ...base, reason: `could not recompute (${String(err?.message || err)})` };
  }

  const matchesOn = Math.max(0, withPenalties.rawTotal) === base.stored;
  const matchesOff = Math.max(0, withoutPenalties.rawTotal) === base.stored;

  // The profile's penalty setting is not stored on the archive, so it is
  // inferred from which variant reproduces the stored figure. When only the
  // penalties-OFF variant matches, this profile had penalties disabled for
  // that challenge and nothing was ever charged — so nothing was discarded.
  if (matchesOff && !matchesOn) {
    return { ...base, gained: withoutPenalties.gained, lost: 0, discarded: 0, verified: true, reason: 'penalties were off' };
  }
  if (!matchesOn) {
    return {
      ...base,
      gained: withPenalties.gained, lost: withPenalties.lost,
      reason: `recomputed ${Math.max(0, withPenalties.rawTotal)} XP but the archive stores ${base.stored}`,
    };
  }

  const discarded = Math.max(0, withPenalties.lost - withPenalties.gained);
  return {
    ...base,
    gained: withPenalties.gained,
    lost: withPenalties.lost,
    discarded,
    verified: true,
    reason: discarded > 0 ? null : 'nothing was clipped — penalties already applied',
  };
}

/**
 * A full preview of the one-time reconciliation for a profile.
 *
 * Nothing is applied. This is what the confirmation screen shows, so the exact
 * adjustment is visible before anything changes.
 */
export function previewReconciliation(archiveList) {
  const segments = (archiveList || []).map(archiveDeficit);
  const charged = segments.filter(s => s.verified && s.discarded > 0);
  const skipped = segments.filter(s => !s.verified);
  return {
    segments,
    charged,
    skipped,
    amount: charged.reduce((s, x) => s + x.discarded, 0),
    archiveCount: segments.length,
    // Surfaced rather than buried: a segment we could not reproduce is not
    // charged, and the user is told how many there were.
    unverifiedCount: skipped.length,
  };
}

/**
 * The applied ledger entry for a reconciliation, including enough information
 * to show it later and to undo it.
 */
export function buildReconciliation(preview, lifetimeBefore) {
  return {
    at: new Date().toISOString(),
    version: LEDGER_VERSION,
    amount: preview.amount,
    lifetimeBefore,
    archiveCount: preview.archiveCount,
    unverifiedCount: preview.unverifiedCount,
    segments: preview.charged.map(s => ({
      id: s.id, name: s.name, endDate: s.endDate, discarded: s.discarded,
    })),
  };
}

/**
 * The full Lifetime XP breakdown for a profile.
 *
 * earned      everything banked in archives plus everything earned in the
 *             current segment — never reduced, so history stays intact
 * penalties   the ledger's one-time historical figure, plus the current
 *             segment's live deficit
 * net         earned - penalties, before the floor
 *
 * The current segment is counted RAW: a deficit now reduces Lifetime XP
 * directly, which is the behaviour that was previously clipped at zero.
 */
export function computeXPBreakdown({ archives, currentSegment, ledger }) {
  const archived = (archives || []).reduce((s, a) => s + (Number(a?.xpEarned) || 0), 0);
  const currentGained = Math.max(0, Number(currentSegment?.gained) || 0);
  const currentLost = Math.max(0, Number(currentSegment?.lost) || 0);
  const historical = ledgerPenalty(ledger);

  const earned = archived + currentGained;
  const penalties = historical + currentLost;
  return {
    archivedXP: archived,
    currentEarned: currentGained,
    currentPenalty: currentLost,
    historicalPenalty: historical,
    earned,
    penalties,
    net: earned - penalties,
  };
}

/**
 * Raw Lifetime XP for a profile: the breakdown's net.
 *
 * Kept as a thin wrapper so every caller goes through one definition. The
 * floor is applied separately, in the rank layer, so an unlocked rank is never
 * lost however far this falls.
 */
export function rawLifetimeWithLedger({ archives, currentSegment, ledger }) {
  return computeXPBreakdown({ archives, currentSegment, ledger }).net;
}

/**
 * The day number a segment had reached when it was archived.
 *
 * Exposed for diagnostics: it is what distinguishes "this challenge ran its
 * course" from "this challenge was abandoned weeks ago".
 */
export function archivedRawDay(entry) {
  if (!entry?.challengeStart || !entry?.archivedAt) return entry?.endDayNum || null;
  return dayNumberForDate(entry.challengeStart, entry.archivedAt) || entry.endDayNum || null;
}

/** Back-compat: lifetime XP with no ledger behaves exactly as before. */
export function legacyLifetime(archives, currentRawTotal) {
  return computeLifetimeXP(archives, currentRawTotal);
}
