/**
 * What you have actually done lately.
 *
 * Three kinds of event, because these are the three Forge records a date for:
 * a rank unlocked, a challenge finished, and a day completed in full. It is
 * deliberately not a list of ticked tasks — Today owns that, and repeating it
 * here would make Home a worse copy of a better screen.
 *
 * Nothing is estimated. A badge has no stored earn-date, so no badge appears
 * here with a date attached; it appears in the collection instead. XP is shown
 * only where a real figure exists, already converted to the ladder the
 * lifetime balance moves on.
 */
export default function RecentWins({ wins }) {
  if (!wins.length) {
    return (
      <section className="f41-card f41-wins">
        <div className="f41-card-head">
          <h3 className="f41-card-title">Recent wins</h3>
        </div>
        <p className="f41-empty">
          Finish a day in full and it will be recorded here.
        </p>
      </section>
    );
  }

  return (
    <section className="f41-card f41-wins">
      <div className="f41-card-head">
        <h3 className="f41-card-title">Recent wins</h3>
        <span className="f41-card-meta">Proof of your progress</span>
      </div>
      <ul className="f41-win-list">
        {wins.map((w, i) => (
          <li key={`${w.kind}-${w.date}-${i}`} className={`f41-win ${w.kind}`}>
            <span className="f41-win-icon" aria-hidden="true">{w.icon}</span>
            <span className="f41-win-body">
              <span className="f41-win-title">{w.title}</span>
              {w.detail && <span className="f41-win-detail">{w.detail}</span>}
            </span>
            <span className="f41-win-right">
              {w.xp != null && w.xp > 0 && (
                <span className="f41-win-xp">+{w.xp.toLocaleString()} XP</span>
              )}
              {w.xpLabel && <span className="f41-win-xp soft">{w.xpLabel}</span>}
              <span className="f41-win-when">{w.when}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
