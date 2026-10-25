import { CURRENT_ECONOMY_VERSION, economyVersionOf, displayScaleFor } from '../data/xpEconomy';

/**
 * Stacking across an economy boundary.
 *
 * The XP engine applies ONE rate card to a day and ONE display scale to a
 * segment, both taken from the PRIMARY attempt. That is correct for a single
 * challenge and for a stack whose two halves were priced the same way — and it
 * is what keeps the eras isolated.
 *
 * It breaks for a stack that straddles the rebalance. `mergeSupportTasks` keeps
 * each lane's own stored XP, so an era-2 support task sits in the same list as
 * era-1 primary tasks in units a tenth the size. The day sums them as if they
 * were the same currency and the whole segment is then multiplied by the
 * primary's scale, so an era-2 support habit stored at 40 moves Lifetime XP by
 * 400 instead of 40 — ten times its intended weight, every day, for the length
 * of the attempt.
 *
 * There is no non-destructive fix at stack time. Re-stamping the support
 * attempt into era 1 would reprice a challenge the library advertised under the
 * current economy; re-stamping the primary would revalue days already logged.
 * Both are exactly the kind of silent repricing the economy's versioning exists
 * to prevent.
 *
 * So the pairing is REFUSED, with the reason stated plainly, and the running
 * challenge is left completely alone. The block is temporary by nature: the
 * primary is an attempt, it ends, and the next one is stamped with the current
 * economy like everything else.
 */

/** The economy an attempt started NOW would be stamped with. */
export function currentEra() {
  return CURRENT_ECONOMY_VERSION;
}

/**
 * Whether a support attempt of `supportEra` can safely run beside this primary.
 *
 * Returns `{ ok, primaryEra, supportEra, scale, reason }`. `reason` is written
 * for the person reading it, not for a log.
 */
export function checkStackEras(primaryMeta, supportEra = CURRENT_ECONOMY_VERSION) {
  const primaryEra = economyVersionOf(primaryMeta);
  if (primaryEra === supportEra) {
    return { ok: true, primaryEra, supportEra, scale: 1, reason: null };
  }
  // How far out the pairing would be: the factor the primary's segment is
  // converted by, against the support attempt's own.
  const scale = displayScaleFor(primaryEra) / displayScaleFor(supportEra);
  return {
    ok: false,
    primaryEra,
    supportEra,
    scale,
    reason: 'This challenge started under Forge\'s previous XP system, and a new '
      + 'Support Challenge would be priced under the current one. Running them together '
      + 'would award the Support Challenge\'s habits the wrong amount of XP, so Forge '
      + 'does not allow the pairing. Your current challenge, its progress and its XP are '
      + 'unaffected — you can add a Support Challenge to your next one.',
  };
}

/** Convenience: can a support challenge be added to this primary at all? */
export function canStackEra(primaryMeta) {
  return checkStackEras(primaryMeta).ok;
}
