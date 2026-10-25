import { dayRules, displayScaleFor, economyVersionOf } from '../data/xpEconomy';
import { archiveEraOf } from './xpAttempt';
import { getTaskXP } from './gamification';

/**
 * The display-units boundary.
 *
 * Forge's XP engine computes in each attempt's OWN stored units, which is what
 * keeps the eras isolated: an era-1 attempt recomputes to exactly the numbers
 * it ran under, forever. Lifetime XP and the rank ladder, by contrast, live on
 * one shared ladder — era-1 figures are multiplied by `DISPLAY_SCALE[1]` on the
 * way out of storage.
 *
 * Before this module only the lifetime total crossed that boundary, so a legacy
 * attempt showed both scales at once: a task row said "25 XP" and ticking it
 * moved Lifetime XP by 250. The balance was right; the rewards were quoted in
 * the wrong currency.
 *
 * Everything the user READS now goes through here. Nothing stored changes: the
 * conversion is a multiply at render time, by the era that produced the figure,
 * and deleting the scale table restores the old display exactly.
 *
 * Two rules keep it honest:
 *
 *   1. Scale ONCE, at the display edge. A figure that already came from a
 *      display-units source — Lifetime XP, the rank ladder and its floor, the
 *      reconciliation ledger — must not pass through here again.
 *
 *   2. ONE scale per segment, taken from the attempt whose era that segment is
 *      counted under. The live segment is the PRIMARY attempt's era, because
 *      that is the era `computeXPBreakdown` converts the live segment with. A
 *      stacked support challenge from a different era shares the primary's
 *      scale here deliberately: what a row is shown to be worth then matches
 *      what completing it actually moves the balance by, which is the property
 *      the user reads these numbers for.
 */

/** The display scale for an attempt descriptor. */
export function scaleOfMeta(meta) {
  return displayScaleFor(economyVersionOf(meta));
}

/** The display scale for one archived segment, from the era it ran under. */
export function scaleOfArchive(entry) {
  return displayScaleFor(archiveEraOf(entry));
}

/** A stored figure in display units. Null and undefined pass through. */
export function displayXP(stored, scale) {
  if (stored == null) return stored;
  return Math.round((Number(stored) || 0) * (Number(scale) || 1));
}

/** A stored figure as a localised display-units string. */
export function fmtXP(stored, scale) {
  return displayXP(stored, scale).toLocaleString();
}

/**
 * A task-XP reader in display units for one attempt.
 *
 * Returns a function of the task, carrying the attempt's `rules` so a caller
 * that also needs day-level rates (the perfect-day bonus, the day loss cap)
 * does not resolve the era a second time.
 */
export function makeTaskXP(meta) {
  const rules = dayRules(meta);
  const read = (task) => displayXP(getTaskXP(task, rules), rules.displayScale);
  read.rules = rules;
  read.scale = rules.displayScale;
  return read;
}
