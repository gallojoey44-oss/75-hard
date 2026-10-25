import { formatDateLong } from '../../utils/dateUtils';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * One running (or scheduled) challenge, compactly.
 *
 * The old card was a second dashboard: four stat tiles, a progress bar, a
 * support block, an upgrade panel and two buttons, so the library sat most of a
 * screen below the fold. Today already answers "how is today going" in its own
 * tab and does it better, so this card answers the questions that belong to the
 * Challenges tab instead — which challenge, how far through, what mode, and
 * where to manage it.
 *
 * `lane` is 'primary' or 'support'. The support card carries the same
 * information at a lower visual weight rather than a different shape, because
 * the two are the same kind of thing and a second layout would only have to be
 * kept in step with the first.
 */
export default function ActiveChallengeCard({
  meta, dayNum, lane = 'primary', scheduled = false, startDate = null,
  habitsDone = null, habitsTotal = null, onOpen, onManage, manageLabel = 'Manage',
}) {
  if (!meta) return null;
  const duration = meta.durationDays ?? null;
  const mode = meta.variant ? capitalize(meta.variant) : null;
  const pct = duration && dayNum ? Math.min(100, Math.round((dayNum / duration) * 100)) : null;
  const daysLeft = duration && dayNum ? Math.max(0, duration - dayNum) : null;
  const support = lane === 'support';

  return (
    // `active-challenge-card` / `acc-support` are kept alongside the new names:
    // this is the same card the suite has always driven, and a redesign has no
    // business moving the handle every test reaches for.
    <section className={`f4c-active active-challenge-card${support ? ' support acc-support' : ''}`}>
      <div className="f4c-active-top">
        <span className="f4c-lane-label">
          {support ? 'Support Challenge' : 'Primary Challenge'}
        </span>
        <span className={`f4c-status${scheduled ? ' scheduled' : ''}`}>
          {scheduled ? 'Scheduled' : 'Active'}
        </span>
      </div>

      {/* The name is the way in, so there is no separate "view" button. */}
      <button type="button" className="f4c-active-head" onClick={onOpen}>
        <span className="f4c-active-emoji" aria-hidden="true">{meta.emoji || '🎯'}</span>
        <span className="f4c-active-id">
          <span className="f4c-active-name">{meta.name || 'Challenge'}</span>
          <span className="f4c-active-meta">
            {scheduled
              ? `Starts ${formatDateLong(startDate)}`
              : <>Day {dayNum}{duration ? ` of ${duration}` : ''}</>}
            {mode && <> · {mode}</>}
          </span>
        </span>
        <span className="f4c-chevron" aria-hidden="true">›</span>
      </button>

      {pct != null && !scheduled && (
        <>
          <div
            className="f4c-bar"
            role="progressbar"
            aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            aria-label={`${meta.name || 'Challenge'} is ${pct}% through`}
          >
            <div className="f4c-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="f4c-active-foot">
            {/* Today's habit count, when the caller has it — one honest line
                rather than a tile grid that repeats the Today tab. */}
            <span>
              {habitsTotal != null
                ? `${habitsDone} of ${habitsTotal} habits done today`
                : `${pct}% complete`}
            </span>
            {daysLeft != null && (
              <span className="f4c-dim">
                {daysLeft === 0 ? 'Final day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
              </span>
            )}
          </div>
        </>
      )}

      <div className="f4c-active-actions">
        <button type="button" className="f4c-btn ghost" onClick={onManage}>{manageLabel}</button>
      </div>
    </section>
  );
}
