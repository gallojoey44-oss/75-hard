/**
 * Showing up, for the last seven days.
 *
 * Home used to report consistency as two numbers in two grey tiles — best
 * streak and perfect days — both lifetime totals, neither of which answers
 * "how am I doing right now". A streak is only meaningful next to the days
 * that made it, so the row of days IS the card and the figures sit beside it.
 *
 * Every circle is one real date: filled when every required habit was done,
 * half when some were, hollow when none were, and outlined when nothing was
 * running that day. Today is ringed rather than marked missed — the day is not
 * over, and Forge never counts it against anyone before it is.
 */
export default function ConsistencyCard({ consistency, streak, longest, onOpenCalendar }) {
  const { days, perfect, counted } = consistency;

  return (
    <section className="f41-card f41-consistency">
      <div className="f41-card-head">
        <h3 className="f41-card-title">Consistency</h3>
        {onOpenCalendar && (
          <button type="button" className="f41-link" onClick={onOpenCalendar}>
            History ›
          </button>
        )}
      </div>

      <div className="f41-con-figures">
        <div className="f41-con-fig">
          <span className="f41-con-num">{streak}</span>
          <span className="f41-con-label">day streak</span>
        </div>
        <div className="f41-con-fig">
          {/* Out of the days that were actually tracked — a week with a gap in
              it is not seven days of failure. */}
          <span className="f41-con-num">{perfect}<span className="f41-con-of">/{counted}</span></span>
          <span className="f41-con-label">perfect this week</span>
        </div>
        <div className="f41-con-fig">
          <span className="f41-con-num">{longest}</span>
          <span className="f41-con-label">best ever</span>
        </div>
      </div>

      <ol className="f41-week" aria-label="The last seven days">
        {days.map(d => (
          <li key={d.date} className="f41-week-day">
            <span
              className={`f41-dot ${d.state}${d.isToday ? ' now' : ''}`}
              title={`${d.date} · ${d.state === 'none' ? 'no challenge running' : `${d.pct}% of habits`}`}
            >
              {d.state === 'done' && <span className="f41-dot-tick" aria-hidden="true">✓</span>}
            </span>
            <span className="f41-week-label">{d.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
