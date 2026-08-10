import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateShort } from '../utils/dateUtils';

/**
 * 📅 Weekly Requirements — real tracking for the Fat Loss Challenge.
 *
 * Sessions are only ever created by an explicit tap; nothing is inferred. Each
 * log can be undone immediately (or removed later from the week's history), and
 * a short cooldown after each tap guards against accidental double taps while
 * still allowing a genuine second session.
 */
export default function WeeklyRequirements() {
  const { getWeeklyRequirements, logWeeklySession, removeWeeklySession, getRawDayNumber } = useApp();
  const [lastLogged, setLastLogged] = useState(null);   // { id, label }
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(null);
  const timerRef = useRef(null);

  const wr = getWeeklyRequirements();
  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!wr?.supported || !wr.current) return null;
  const week = wr.current;
  const rawDay = getRawDayNumber();

  function handleLog(req) {
    if (busy === req.id) return;              // ignore a double tap
    setBusy(req.id);
    setTimeout(() => setBusy(null), 700);
    const s = logWeeklySession(req.id);
    if (!s) return;
    setLastLogged({ id: s.id, label: req.label });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLastLogged(null), 6000);
  }

  function handleUndo() {
    if (!lastLogged) return;
    removeWeeklySession(lastLogged.id);
    setLastLogged(null);
  }

  return (
    <div className="section-card wr-card">
      <div className="section-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span>📅 Weekly Requirements</span>
        <span className="wr-weeklabel">
          Week {week.week}
          {week.partial && <span className="wr-partial" title="Shortened final week — targets are prorated">final {week.days}d</span>}
        </span>
      </div>
      <p className="wr-sub">
        Challenge week {week.week} · day {Math.min(rawDay - week.startDay + 1, week.days)} of {week.days}
      </p>

      {week.requirements.map(req => (
        <div key={req.id} className={`wr-row${req.met ? ' met' : ''}`}>
          <div className="wr-row-head">
            <span className="wr-row-name">{req.icon} {req.label}</span>
            <span className="wr-row-count">{req.done} / {req.target} this week</span>
          </div>
          <div className="wr-segs" role="img" aria-label={`${req.done} of ${req.target} complete`}>
            {Array.from({ length: Math.max(req.target, req.done) }, (_, i) => (
              <span key={i} className={`wr-seg${i < req.done ? (i < req.target ? ' on' : ' extra') : ''}`} />
            ))}
          </div>
          {req.met ? (
            <div className="wr-met">✅ Requirement Met{req.done > req.target ? ` · ${req.done - req.target} extra logged` : ''}</div>
          ) : (
            <button className="btn btn-ghost wr-log-btn" onClick={() => handleLog(req)} disabled={busy === req.id}>
              + {req.logLabel}
            </button>
          )}
          {req.met && (
            <button className="btn btn-ghost wr-log-btn subtle" onClick={() => handleLog(req)} disabled={busy === req.id}>
              + Log another {req.unit}
            </button>
          )}
        </div>
      ))}

      {lastLogged && (
        <div className="wr-undo">
          <span>{lastLogged.label} session logged ✓</span>
          <button className="wr-undo-btn" onClick={handleUndo}>Undo</button>
        </div>
      )}

      <button className="wr-history-toggle" onClick={() => setShowHistory(v => !v)}>
        {showHistory ? '▲ Hide this week' : "▼ This week's sessions"}
      </button>
      {showHistory && (
        <div className="wr-history">
          {week.requirements.every(r => r.sessions.length === 0) && (
            <div className="wr-history-empty">No sessions logged yet this week.</div>
          )}
          {week.requirements.filter(r => r.sessions.length > 0).map(req => (
            <div key={req.id} className="wr-history-group">
              <div className="wr-history-label">{req.icon} {req.label}</div>
              {req.sessions.map(s => (
                <div key={s.id} className="wr-history-item">
                  <span>{new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</span>
                  <span className="wr-history-date">{formatDateShort(s.date)}</span>
                  <button className="wr-remove-btn" onClick={() => removeWeeklySession(s.id)} aria-label="Remove session">Remove</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
