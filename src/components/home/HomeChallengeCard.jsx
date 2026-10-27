function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * The running challenge — or both of them — in one card, with the way in.
 *
 * Home used to spend four separate blocks on this: a 120px progress ring, a
 * two-bar progress card, a two-tile stats grid and a "Log Today" button at the
 * very bottom of the page. Between them they said "Day 5 of 14" three times
 * and pushed everything else below the fold. One card answers the same
 * questions — which challenge, how far in, how today is going, and how to get
 * on with it — and the second lane joins it rather than repeating it.
 *
 * The lane markup keeps the names the suite reads: `stack-card` when two lanes
 * run, `stack-lane`/`stack-role`/`stack-name`/`stack-progress` inside them,
 * and `hero-day-num` holding the primary's day number and nothing else.
 */
export default function HomeChallengeCard({
  meta, dayNum, duration, baseline, habitsDone, habitsTotal, todayPct,
  supportInfo = null, onOpenChallenge, onGoToday,
}) {
  const pct = !baseline && duration && dayNum
    ? Math.min(100, Math.round((dayNum / duration) * 100))
    : null;
  const daysLeft = !baseline && duration && dayNum ? Math.max(0, duration - dayNum) : null;
  const supPct = supportInfo?.dayNumber && supportInfo?.duration
    ? Math.min(100, Math.round((supportInfo.dayNumber / supportInfo.duration) * 100))
    : null;

  return (
    <section className={`f41-card f41-chal hero-card${supportInfo ? ' stack-card' : ''}`}>
      <div className="f41-card-head">
        <h3 className="f41-card-title">
          {supportInfo ? 'Active challenges' : 'Active challenge'}
        </h3>
        <span className="f41-status">{baseline ? 'Baseline' : 'Active'}</span>
      </div>

      <div className="f41-lane stack-lane primary">
        {supportInfo && <span className="f41-lane-role stack-role">PRIMARY</span>}

        <button type="button" className="f41-chal-head" onClick={onOpenChallenge}>
          <span className="f41-chal-emoji" aria-hidden="true">{meta?.emoji || '🔥'}</span>
          <span className="f41-chal-id">
            <span className="f41-chal-name stack-name">
              {baseline ? 'Forge Daily' : (meta?.name || 'Challenge')}
            </span>
            {/* The day number alone lives in `hero-day-num`; the words around it
                are siblings, so the figure stays machine-readable. */}
            <span className="f41-chal-meta stack-progress">
              Day <span className="hero-day-num">{dayNum || 1}</span>
              {!baseline && duration ? <span className="hero-of-75"> / {duration}</span> : null}
              {meta?.variant && !baseline ? ` · ${capitalize(meta.variant)}` : ''}
            </span>
          </span>
          <span className="f41-chevron" aria-hidden="true">›</span>
        </button>

        {pct != null && (
          <div className="f41-chal-bar" role="progressbar"
            aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            aria-label={`${meta?.name || 'Challenge'} is ${pct}% through`}>
            <div className="f41-chal-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}

        <div className="f41-chal-foot">
          <span className="hero-stat-value">
            {habitsTotal != null
              ? `${habitsDone} of ${habitsTotal} habits done today`
              : `Today ${todayPct}%`}
          </span>
          {daysLeft != null && (
            <span className="f41-chal-left">
              {daysLeft === 0 ? 'Final day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
            </span>
          )}
        </div>
      </div>

      {/* The second lane: the same information at a lower weight, because it is
          the same kind of thing and a different shape would only have to be
          kept in step with the first. */}
      {supportInfo && (
        <div className="f41-lane stack-lane support">
          <span className="f41-lane-role stack-role">SUPPORT</span>
          <div className="f41-chal-head static">
            <span className="f41-chal-emoji" aria-hidden="true">{supportInfo.emoji || '🤝'}</span>
            <span className="f41-chal-id">
              <span className="f41-chal-name stack-name">{supportInfo.name}</span>
              <span className="f41-chal-meta stack-progress">
                {supportInfo.dayNumber
                  ? `Day ${supportInfo.dayNumber} / ${supportInfo.duration}`
                  : 'Scheduled'}
              </span>
            </span>
          </div>
          {supPct != null && (
            <div className="f41-chal-bar" role="progressbar"
              aria-valuenow={supPct} aria-valuemin={0} aria-valuemax={100}
              aria-label={`${supportInfo.name} is ${supPct}% through`}>
              <div className="f41-chal-bar-fill" style={{ width: `${supPct}%` }} />
            </div>
          )}
        </div>
      )}

      <button type="button" className="f41-cta" onClick={onGoToday}>
        Go to today&apos;s tasks →
      </button>
    </section>
  );
}
