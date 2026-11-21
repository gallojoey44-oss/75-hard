import { economyVersionOf } from '../data/xpEconomy';
import { getTemplateById } from '../data/challengeTemplates';
import { archiveEraOf, stampAttempt } from './xpAttempt';
import { dayNumberForDate } from './dateUtils';

/**
 * Promoting a Support Challenge to primary.
 *
 * A support challenge never carried an economy stamp of its own: its rows are
 * priced and counted under the PRIMARY's rate card, so it never needed one.
 * Promoted as it was, it arrived in the primary slot unstamped, and an
 * unstamped attempt is read as the pre-October economy — ten times the current
 * display scale and the old penalty rules, for the rest of its run.
 *
 * And promotion only happens after the primary has finished. The days the two
 * ran side by side were banked in that primary's archive, so the promoted
 * challenge must not count them a second time.
 *
 * Both answers are worked out from what is stored at the moment of promotion.
 * Nothing already recorded is touched, and nothing is repriced: the promoted
 * challenge keeps exactly the habit values it was paying as a support.
 */

const BASELINE = 'forge_daily';

/**
 * The primary the support ran beside, now finished: the newest primary-lane
 * archive that began no later than the support and ended on or after the day
 * it began. Null when there is none (a primary that ended with no day records
 * leaves no archive).
 */
export function finishedPrimaryArchive(archives, supportStart) {
  if (!supportStart) return null;
  const candidates = (archives || []).filter(a => a
    && a.lane !== 'support'
    && a.challenge?.templateId !== BASELINE
    && (a.challengeStart || '') <= supportStart
    && (a.endDate || '') >= supportStart);
  candidates.sort((a, b) => String(b.endDate || '').localeCompare(String(a.endDate || '')));
  return candidates[0] || null;
}

/**
 * What a promotion needs to know, from the profile and its archives.
 *
 *   era            The economy the support ran under, which the promoted
 *                  attempt keeps: the economy of the primary it ran beside.
 *                  Recorded when that primary finished; for a choice left
 *                  waiting from before that was recorded, read from the
 *                  finished primary's archive; failing both, the economy its
 *                  rows are being counted under now.
 *   bankedThrough  The last date already banked in the finished primary's
 *                  record, or null when nothing was.
 *   firstUnbanked  The first day, in the support's own numbering, that is not
 *                  already counted. The promoted attempt's XP starts there.
 */
export function promotionBasis(profile, archives) {
  const supportStart = profile?.supportChallengeStart || null;
  const choice = profile?.pendingPrimaryChoice || null;
  const recordedEra = Number(choice?.supportEconomyVersion);
  const hasRecordedBank = !!choice && Object.prototype.hasOwnProperty.call(choice, 'bankedThrough');
  const finished = (!Number.isFinite(recordedEra) || !hasRecordedBank)
    ? finishedPrimaryArchive(archives, supportStart)
    : null;

  const era = Number.isFinite(recordedEra) && recordedEra >= 1
    ? recordedEra
    : finished
      ? archiveEraOf(finished)
      : economyVersionOf(profile?.activeChallenge);

  const bankedThrough = hasRecordedBank ? (choice.bankedThrough || null) : (finished?.endDate || null);
  const firstUnbanked = bankedThrough && supportStart && bankedThrough >= supportStart
    ? (dayNumberForDate(supportStart, bankedThrough) || 0) + 1
    : 1;

  return { era, bankedThrough, firstUnbanked: Math.max(1, firstUnbanked) };
}

/**
 * The promoted attempt's descriptor: the support's own, stamped with `era`.
 *
 * On the current economy it receives exactly the stamp a new attempt of the
 * same template, mode and length gets — tier, daily budget, completion bonus,
 * weekly requirements — so its penalties and bonuses follow the same rules as
 * any other challenge. Its habit rows are deliberately NOT passed through
 * here: they keep the XP they were already paying.
 *
 * A support that ran under the pre-October economy stays on it, explicitly
 * stamped, exactly as every attempt started under it keeps that economy to its
 * end.
 */
export function promotedDescriptor(supportMeta, era) {
  const meta = { ...(supportMeta || {}) };
  if (Number(era) >= 2) {
    return stampAttempt({
      meta,
      tasks: [],
      template: getTemplateById(meta.templateId) || null,
      version: Number(era),
    }).meta;
  }
  return { ...meta, xpEconomyVersion: 1 };
}
