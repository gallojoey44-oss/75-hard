import { computeTotalXP, computeLifetimeXP } from './gamification';
import { missedDayDetail } from './missedDays';
import { dayNumberForDate, getDayNumberFromStart } from './dateUtils';
import { toDisplayXP, archiveEraOf, ledgerDisplayAmount, forgivenDisplayAmount } from './xpAttempt';
import { displayScaleFor, CURRENT_ECONOMY_VERSION } from '../data/xpEconomy';

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
 *
 * ── Transitions and the floor ────────────────────────────────────────────
 *
 * Two holes remained, both at the moment a segment ends.
 *
 *   • Archiving still clipped. A segment that ended in deficit was archived as
 *     max(0, gained - lost), and one with no day records was not archived at
 *     all — so starting a new challenge handed the deficit straight back, and
 *     a Forge Daily period spent entirely away cost nothing once it ended. New
 *     archives record their GROSS figures (`xpGained`, `xpLost`, marked
 *     `xpAccounting: 2`) and contribute exactly what the live segment did. A
 *     segment that cannot be archived leaves the same figures in the ledger's
 *     `carried` list. Either way, ending a segment moves no XP.
 *
 *   • Rank protection outlived what it protected. The floor's write-off is a
 *     stored credit, and when the penalties it cancelled later disappeared — a
 *     refund at a transition, a missed day logged after the fact, penalties
 *     switched off — the credit stayed behind and the balance rose above
 *     anything earned. The credit now remembers the penalty total it was
 *     written against (`forgivenBasis`), and penalties that disappear cancel
 *     the credit before they raise the balance. Penalties gone for good write
 *     the credit down for good (forgivenessRatchet), so later missed days are
 *     charged rather than refilling it; switching penalties off and on again
 *     restores the balance exactly. Earning XP after reaching the floor still
 *     moves the balance immediately.
 *
 * Archives written before this are read exactly as before (`xpEarned`), and a
 * credit written before it keeps its full value, so no balance changes on the
 * day this ships; only what happens next is different.
 */

export const LEDGER_VERSION = 1;

/** The accounting mode new archives are written in. */
export const GROSS_ACCOUNTING = 2;

/** True for an archive that records its gross earned and lost XP. */
export function hasGrossAccounting(entry) {
  return entry?.xpAccounting === GROSS_ACCOUNTING
    && Number.isFinite(Number(entry?.xpGained))
    && Number.isFinite(Number(entry?.xpLost));
}

/**
 * What one archive contributes to Lifetime XP, in display units.
 *
 * A gross archive contributes exactly what its live segment contributed the
 * moment before it was archived — earned XP and penalties separately, a
 * deficit included. An archive written before gross accounting contributes the
 * XP it banked, as it always has; its clipped deficit, if any, is what the
 * one-time reconciliation exists for.
 */
export function archiveContribution(entry) {
  const era = archiveEraOf(entry);
  if (hasGrossAccounting(entry)) {
    return { gained: toDisplayXP(entry.xpGained, era), lost: toDisplayXP(entry.xpLost, era) };
  }
  return { gained: toDisplayXP(entry?.xpEarned, era), lost: 0 };
}

/**
 * Segments that ended with nothing to archive, carried in the ledger.
 *
 * A Forge Daily period with no day records at all is the usual one: every day
 * of it was missed, so there is nothing to archive and everything to account
 * for. Each entry is in DISPLAY units and says where it came from.
 */
export function carriedSegments(ledger) {
  return Array.isArray(ledger?.carried) ? ledger.carried.filter(c => c && typeof c === 'object') : [];
}

/** A ledger with one more carried segment appended. Never rewrites the others. */
export function appendCarried(ledger, entry) {
  if (!entry) return ledger;
  return { ...(ledger || makeLedger()), carried: [...carriedSegments(ledger), entry] };
}

/** The carried segments' combined earned and lost XP, in display units. */
export function carriedTotals(ledger) {
  return carriedSegments(ledger).reduce((s, c) => ({
    gained: s.gained + (Number(c.gained) || 0),
    lost: s.lost + (Number(c.lost) || 0),
  }), { gained: 0, lost: 0 });
}

/**
 * The rank-protection credit that still applies, in display units.
 *
 * `forgiven` was written against a penalty total, `forgivenBasis`. Penalties
 * that have disappeared since — a missed day logged after the fact, penalties
 * switched off, a record deleted — cancel the credit first, because a
 * write-off can never outlive the charge it wrote off. Penalties that ADD to
 * the total leave the credit alone. A credit with no basis was written before
 * this rule existed and keeps its full value.
 */
export function effectiveForgiven(ledger, grossPenalties) {
  const stored = forgivenDisplayAmount(ledger);
  if (stored <= 0) return 0;
  const basis = Number(ledger?.forgivenBasis);
  if (ledger?.forgivenBasis == null || !Number.isFinite(basis)) return stored;
  const removed = Math.max(0, basis - (Number(grossPenalties) || 0));
  return Math.max(0, stored - removed);
}

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
    startDate: entry?.challengeStart || null,
    days: entry?.endDayNum || 0,
    stored: Math.max(0, Number(entry?.xpEarned) || 0),
    gained: 0, lost: 0, missedDays: 0, missedPenalty: 0, discarded: 0,
    era: archiveEraOf(entry), scale: displayScaleFor(archiveEraOf(entry)),
    discardedDisplay: 0, verified: false, reason: null,
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

  // Which days were missed, and what those days alone cost. Delegated to the
  // same helper the live challenge uses, over the archive's own records, so a
  // period's count and its charge are produced by one engine and cannot
  // disagree — an archive once reported one more missed day than it had
  // charged for, because this was a second hand-rolled loop.
  const detailFor = (penaltiesEnabled) => missedDayDetail({
    days: entry.days,
    tasks: entry.tasks || [],
    meta: entry.challenge,
    challengeStart: entry.challengeStart,
    // Both bounds come from the same place computeTotalXP gets them, or the
    // count disagrees with the charge: the penalty boundary is derived from
    // challengeStart (so a segment whose start is far enough back has no
    // unfinished day left in it), and the segment ends at endDayNum.
    rawDay: getDayNumberFromStart(entry.challengeStart) ?? entry.endDayNum,
    dayNum: entry.endDayNum,
    penaltiesEnabled,
    xpStartDay: entry.xpStartDay ?? 1,
  });

  // The profile's penalty setting is not stored on the archive, so it is
  // inferred from which variant reproduces the stored figure. When only the
  // penalties-OFF variant matches, this profile had penalties disabled for
  // that challenge and nothing was ever charged — so nothing was discarded.
  if (matchesOff && !matchesOn) {
    // The days were still missed; they simply were not charged for.
    const off = detailFor(false);
    return {
      ...base, gained: withoutPenalties.gained, lost: 0,
      missedDays: off.missedDays, missedPenalty: 0,
      discarded: 0, discardedDisplay: 0, verified: true, reason: 'penalties were off',
    };
  }
  if (!matchesOn) {
    return {
      ...base,
      gained: withPenalties.gained, lost: withPenalties.lost,
      reason: `recomputed ${Math.max(0, withPenalties.rawTotal)} XP but the archive stores ${base.stored}`,
    };
  }

  // A gross archive already counts its whole deficit in Lifetime XP (see
  // archiveContribution), so nothing about it was discarded and there is
  // nothing for the reconciliation to recover. Charging it here would take the
  // same penalty twice.
  const discarded = hasGrossAccounting(entry) ? 0 : Math.max(0, withPenalties.lost - withPenalties.gained);
  const detail = detailFor(true);
  return {
    ...base,
    gained: withPenalties.gained,
    lost: withPenalties.lost,
    missedDays: detail.missedDays,
    // The part of `lost` attributable to days with no activity at all. The
    // remainder comes from days that were logged but left incomplete, and the
    // two are reported separately rather than summed under one misleading
    // "missed days" label.
    missedPenalty: detail.totalPenalty,
    discarded,
    // The same figure in display units. The reconciliation compares against a
    // rank floor, which is in display units, so mixing the two would charge
    // the wrong amount by a factor of ten.
    discardedDisplay: toDisplayXP(discarded, base.era),
    verified: true,
    reason: discarded > 0 ? null : 'already counted',
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
    amount: charged.reduce((s, x) => s + (x.discardedDisplay ?? x.discarded), 0),
    archiveCount: segments.length,
    // Surfaced rather than buried: a segment we could not reproduce is not
    // charged, and the user is told how many there were.
    unverifiedCount: skipped.length,
  };
}

/**
 * How much of an uncounted total can actually be charged.
 *
 * A rank's XP floor is a PROTECTED BALANCE, not a display trick. Charging more
 * than the XP a profile holds above its floor would leave an invisible debt:
 * the balance would show the floor, and the next 20 XP earned would silently
 * go to paying it off instead of moving the number. So the excess is forgiven
 * outright, here, at the moment the charge is fixed.
 *
 * Returns { total, applied, forgiven, headroom }.
 */
export function capToFloor(total, lifetimeBefore, floor) {
  const want = Math.max(0, Number(total) || 0);
  const headroom = Math.max(0, (Number(lifetimeBefore) || 0) - (Number(floor) || 0));
  const applied = Math.min(want, headroom);
  return { total: want, applied, forgiven: want - applied, headroom };
}

/**
 * The applied ledger entry for a reconciliation, including enough information
 * to show it later and to undo it.
 *
 * `amount` is what is actually deducted — already capped to the floor, so the
 * balance it produces is real and the next XP earned moves it immediately.
 * `uncounted` keeps the full figure that was found, and `forgiven` the part
 * written off, so the screen can show both without recomputing.
 */
export function buildReconciliation(preview, lifetimeBefore, floor, forgivenBefore = 0, forgivenBasisBefore = null) {
  const cap = capToFloor(preview.amount, lifetimeBefore, floor);
  return {
    at: new Date().toISOString(),
    version: LEDGER_VERSION,
    // Stored in DISPLAY units and marked as such: an amount written before
    // era 2 is in era-1 units and is scaled on read, so the marker is what
    // keeps the two apart.
    ledgerUnits: CURRENT_ECONOMY_VERSION,
    amount: cap.applied,
    uncounted: cap.total,
    forgiven: cap.forgiven,
    floor,
    lifetimeBefore,
    forgivenBefore,
    // What the rank-protection credit was measured against before this, so
    // undoing restores the credit exactly — amount and basis together.
    forgivenBasisBefore,
    archiveCount: preview.archiveCount,
    unverifiedCount: preview.unverifiedCount,
    segments: preview.charged.map(s => ({
      id: s.id, name: s.name, endDate: s.endDate, startDate: s.startDate,
      missedDays: s.missedDays, gained: s.gained, lost: s.lost, discarded: s.discarded,
      era: s.era, discardedDisplay: s.discardedDisplay,
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
 * directly, which is the behaviour that was previously clipped at zero. A
 * gross archive and a carried segment are counted the same way, so the
 * figure does not move when the live segment becomes one of them.
 */
export function computeXPBreakdown({ archives, currentSegment, ledger, currentEra = 1 }) {
  // Each record is converted to display units by the ERA THAT PRODUCED IT.
  // Era-1 archives keep their stored figures on disk and are scaled on the way
  // out, so the conversion never touches history and can be undone by removing
  // the scale table.
  let archivedEarned = 0;
  let archivedLost = 0;
  for (const a of archives || []) {
    const c = archiveContribution(a);
    archivedEarned += c.gained;
    archivedLost += c.lost;
  }
  const carried = carriedTotals(ledger);
  const curScale = displayScaleFor(currentEra);
  const currentGained = Math.max(0, Number(currentSegment?.gained) || 0) * curScale;
  const currentLost = Math.max(0, Number(currentSegment?.lost) || 0) * curScale;
  const historical = ledgerDisplayAmount(ledger?.reconciled);
  const earned = archivedEarned + carried.gained + currentGained;
  const penalties = historical + archivedLost + carried.lost + currentLost;
  const forgiven = effectiveForgiven(ledger, penalties);
  return {
    archivedXP: archivedEarned, archivedPenalty: archivedLost,
    carriedEarned: carried.gained, carriedPenalty: carried.lost,
    currentEarned: currentGained, currentPenalty: currentLost,
    historicalPenalty: historical, forgiven, earned,
    penalties: Math.max(0, penalties - forgiven),
    grossPenalties: penalties,
    net: earned - penalties + forgiven,
  };
}

/**
 * The ledger fields to write when a live deficit has pushed the balance below
 * the protected floor, or null when nothing needs writing.
 *
 * The new credit is the credit that still applies plus the new shortfall, and
 * it is stamped with the penalty total it was written against — which is what
 * lets a later disappearance of those penalties cancel it (effectiveForgiven).
 * Written in display units.
 */
export function forgivenessUpdate(inputs, floor) {
  const b = computeXPBreakdown(inputs);
  const f = Math.max(0, Number(floor) || 0);
  if (b.net >= f) return null;
  const forgivable = Math.max(0, b.grossPenalties - b.forgiven);
  const short = Math.min(f - b.net, forgivable);
  if (!(short > 0)) return null;
  return {
    forgiven: b.forgiven + short,
    forgivenUnits: CURRENT_ECONOMY_VERSION,
    forgivenBasis: b.grossPenalties,
  };
}

/**
 * Writes the credit down when penalties it was written against have gone for
 * good — a missed day logged after the fact, a record deleted — or null when
 * there is nothing to write.
 *
 * Reading already ignores the part of the credit those penalties no longer
 * need (effectiveForgiven). Writing it down as well is what keeps it gone:
 * otherwise the penalties for NEW missed days would refill the cancelled part
 * of the credit, and those days would go uncharged while the balance was
 * above the floor.
 *
 * `inputs` must measure the live segment as it would stand with XP Penalties
 * ON. Switching penalties off takes them away only until they are switched
 * back on, and that round trip has to return the balance exactly to where it
 * was — so it never writes the credit down.
 */
export function forgivenessRatchet(inputs) {
  const ledger = inputs?.ledger;
  if (forgivenDisplayAmount(ledger) <= 0) return null;
  const basis = Number(ledger?.forgivenBasis);
  if (ledger?.forgivenBasis == null || !Number.isFinite(basis)) return null;
  const b = computeXPBreakdown(inputs);
  if (!(b.grossPenalties < basis)) return null;
  return {
    forgiven: b.forgiven,
    forgivenUnits: CURRENT_ECONOMY_VERSION,
    forgivenBasis: b.grossPenalties,
  };
}

/**
 * A credit written before the basis existed is given one now, equal to the
 * penalties it stands against today. That changes nothing about the balance —
 * the credit keeps its full value — but from here on, penalties that
 * disappear cancel it before they raise the balance. Null when there is
 * nothing to stamp.
 */
export function forgivenessBasisStamp(inputs) {
  const ledger = inputs?.ledger;
  if (forgivenDisplayAmount(ledger) <= 0) return null;
  if (ledger?.forgivenBasis != null && Number.isFinite(Number(ledger.forgivenBasis))) return null;
  return { forgivenBasis: computeXPBreakdown(inputs).grossPenalties };
}

/**
 * How much more must be forgiven for the floor to be a real balance.
 *
 * Called whenever XP is evaluated. It returns 0 almost always; when a live
 * deficit has pushed the net below the floor it returns the shortfall, which
 * the caller persists. Because the credit is stored and only ever grows, the
 * next XP earned moves the balance rather than disappearing into the gap.
 */
export function forgivenessShortfall({ archives, currentSegment, ledger, currentEra = 1 }, floor) {
  const b = computeXPBreakdown({ archives, currentSegment, ledger, currentEra });
  const f = Math.max(0, Number(floor) || 0);
  if (b.net >= f) return 0;
  // Only a PENALTY can be forgiven. Without this bound, a profile holding a
  // rank but little earned XP — a fresh profile, or one whose history was
  // cleared — would be credited the whole distance to its floor and then earn
  // XP on top of it. Forgiveness cancels a charge; it never grants XP.
  const forgivable = Math.max(0, b.grossPenalties - b.forgiven);
  return Math.min(f - b.net, forgivable);
}

/**
 * Raw Lifetime XP for a profile: the breakdown's net.
 *
 * Kept as a thin wrapper so every caller goes through one definition. The
 * floor is applied separately, in the rank layer, so an unlocked rank is never
 * lost however far this falls.
 */
export function rawLifetimeWithLedger({ archives, currentSegment, ledger, currentEra = 1 }) {
  return computeXPBreakdown({ archives, currentSegment, ledger, currentEra }).net;
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
