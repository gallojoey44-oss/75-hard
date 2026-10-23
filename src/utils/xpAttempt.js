import {
  CURRENT_ECONOMY_VERSION, economyFor, economyVersionOf, tierBudget,
  allocateTaskXP, completionBonusFor, repriceWeeklyDefs, displayScaleFor,
  TEMPLATE_TIER_FALLBACK,
} from '../data/xpEconomy';
import { getWeeklyRequirementDefs } from './weeklyRequirements';

/**
 * Stamping an attempt with its economy.
 *
 * Everything the XP engine needs is written onto the challenge descriptor and
 * the task snapshot at the moment an attempt STARTS: its economy version, its
 * daily budget, per-task XP, the completion bonus, and repriced weekly
 * requirements.
 *
 * That is what makes era isolation structural rather than a policy. The engine
 * never consults global config at compute time, so:
 *
 *   • an attempt in progress keeps its rates until it is archived, even if the
 *     app's current economy changes underneath it;
 *   • an archive recomputes under the rules it actually ran under, forever;
 *   • a future rebalance is a new version, not a migration of old records.
 */

/**
 * The effort tier for an attempt of this template and mode.
 *
 * Per-VARIANT tiers matter because a mode multiplier cannot express the real
 * spread: Mental Training's beginner variant asks about 7 minutes a day and its
 * hard variant about 25, a 3.6x difference against a 1.27x spread in
 * multipliers. A template may therefore declare `effort_tier_by_variant`, and
 * falls back to its single `effort_tier`.
 */
export function effortTierFor(template, mode) {
  const byVariant = template?.effort_tier_by_variant;
  if (byVariant && mode && byVariant[mode]) return byVariant[mode];
  if (template?.effort_tier) return template.effort_tier;
  return 'medium';
}

/**
 * The tier for an attempt, from the strongest evidence available.
 *
 * Order matters. An already-stamped `effortTier` wins, because a running
 * attempt's tier is part of its identity. Then the descriptor's own
 * `effort_tier`, then the template's.
 *
 * The last clause is the one that matters in practice. The Forge Daily baseline
 * lives in FORGE_DAILY_META rather than CHALLENGE_TEMPLATES, so
 * `getTemplateById` returns nothing for it — and a descriptor stored before
 * tiers existed carries no `effort_tier` either. Without the id fallback the
 * baseline resolved to the default `medium` and was priced at a 160 budget
 * instead of `easy` and 120.
 */
function resolveTier(meta, template, mode) {
  if (meta?.effortTier) return meta.effortTier;
  if (meta?.effort_tier_by_variant?.[mode]) return meta.effort_tier_by_variant[mode];
  if (meta?.effort_tier) return meta.effort_tier;
  if (template) return effortTierFor(template, mode);
  // Not a registry template: fall back on what we know about the id.
  return TEMPLATE_TIER_FALLBACK[meta?.templateId] || 'medium';
}

/**
 * Stamp a new attempt: descriptor fields plus repriced tasks.
 *
 * Returns `{ meta, tasks }`. Pure — it never mutates its inputs.
 *
 * `version` exists so a test can pin an era; production always takes the
 * default.
 */
export function stampAttempt({ meta, tasks, template, version = CURRENT_ECONOMY_VERSION }) {
  if (!meta) return { meta, tasks };
  if (version < 2) {
    // Era 1 attempts are stamped explicitly too, so "unstamped" never has to
    // mean "unknown" again.
    return { meta: { ...meta, xpEconomyVersion: 1 }, tasks };
  }

  const economy = economyFor(version);
  const mode = meta.variant || 'standard';
  const tier = resolveTier(meta, template, mode);
  const budget = tierBudget(tier, mode, economy);
  const duration = Number(meta.durationDays) || 0;

  const stamped = {
    ...meta,
    xpEconomyVersion: version,
    effortTier: tier,
    dailyBudget: budget,
    // An open-ended baseline has no completion to bonus.
    completionBonusXP: duration > 0 ? completionBonusFor(tier, mode, duration, economy) : 0,
  };
  // Era 1 read the completion bonus from `rewardXP` in some templates. Clear it
  // so a stale legacy figure cannot be preferred over the stamped one.
  if ('rewardXP' in stamped) delete stamped.rewardXP;

  // Weekly requirements are repriced from the RESOLVED definitions, not only
  // from defs the descriptor happens to carry.
  //
  // That distinction was a live leak rather than a nicety. Fat Loss beginner
  // and standard have no `weeklyRequirementDefs` of their own — they resolve to
  // the legacy module constant through `getWeeklyRequirementDefs` — so a
  // descriptor-only check skipped them and an attempt started under era 2 still
  // paid era-1 weekly XP: 3x25 + 2x20 = 115 a week against the 80 its budget
  // allows. Materialising the resolved defs onto the attempt also makes it
  // self-describing, which is what lets an archive recompute under its own
  // rules forever.
  const resolvedWeekly = getWeeklyRequirementDefs(stamped);
  if (resolvedWeekly.length) {
    stamped.weeklyRequirementDefs = repriceWeeklyDefs(resolvedWeekly, stamped, economy);
  }

  return { meta: stamped, tasks: allocateTaskXP(tasks || [], budget, economy) };
}

/**
 * Re-price an attempt's task list in place without changing its economy.
 *
 * Used when the task list itself changes mid-attempt — a custom task added, the
 * Cold Exposure Upgrade enabled — so the daily budget stays the guarantee it is
 * meant to be rather than drifting upward with every addition.
 *
 * Era-1 attempts are returned untouched: their task XP is historical.
 */
export function repriceTasks(meta, tasks) {
  if (economyVersionOf(meta) < 2) return tasks;
  const economy = economyFor(economyVersionOf(meta));
  const budget = Number(meta?.dailyBudget) || tierBudget(meta?.effortTier || 'medium', meta?.variant || 'standard', economy);
  return allocateTaskXP(tasks || [], budget, economy);
}

// ── The display conversion layer ────────────────────────────────────────────

/**
 * Convert a stored XP figure to display units, by the era that produced it.
 *
 * Nothing on disk is rewritten: era-1 records keep their original numbers and
 * are multiplied on the way out. Deleting the scale table restores the old
 * display exactly, which is what makes the conversion reversible and auditable
 * rather than a one-way migration.
 */
export function toDisplayXP(storedXP, version) {
  return Math.round((Number(storedXP) || 0) * displayScaleFor(version));
}

/** An archive's banked XP in display units. */
export function archiveDisplayXP(entry) {
  return toDisplayXP(entry?.xpEarned, economyVersionOf(entry?.challenge) || archiveEraOf(entry));
}

/**
 * The era an archive was earned under.
 *
 * Preference order matters: the stamp on the archived descriptor is the
 * strongest evidence, then an explicit stamp on the archive row, then era 1 —
 * because every archive written before versioning existed is era 1 by
 * definition.
 */
export function archiveEraOf(entry) {
  const fromMeta = Number(entry?.challenge?.xpEconomyVersion);
  if (Number.isFinite(fromMeta) && fromMeta >= 1) return fromMeta;
  const fromRow = Number(entry?.xpEconomyVersion);
  if (Number.isFinite(fromRow) && fromRow >= 1) return fromRow;
  return 1;
}

/**
 * A penalty-ledger amount in display units.
 *
 * Amounts recorded before era 2 are in era-1 units and are scaled; amounts
 * recorded afterwards carry `ledgerUnits: 2` and are already display units.
 * Without that flag an era-2 reconciliation would be multiplied a second time.
 */
export function ledgerDisplayAmount(reconciled) {
  const amount = Math.max(0, Number(reconciled?.amount) || 0);
  const units = Number(reconciled?.ledgerUnits);
  if (Number.isFinite(units) && units >= 2) return amount;
  return Math.round(amount * displayScaleFor(1));
}

/**
 * The written-off (forgiven) amount in display units.
 *
 * Same unit question as the ledger: a forgiveness credit written before era 2
 * is in era-1 units. It is marked with `forgivenUnits` when written now, so an
 * era-2 credit is never scaled twice.
 */
export function forgivenDisplayAmount(ledger) {
  const amount = Math.max(0, Number(ledger?.forgiven) || 0);
  const units = Number(ledger?.forgivenUnits);
  if (Number.isFinite(units) && units >= 2) return amount;
  return Math.round(amount * displayScaleFor(1));
}
