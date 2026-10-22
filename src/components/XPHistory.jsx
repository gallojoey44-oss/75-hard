import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ChallengeXPBreakdown from './ChallengeXPBreakdown';

/**
 * XP History — the permanent record, kept out of the way.
 *
 * Every challenge and Forge Daily period that contributed XP, with what was
 * earned and what missed days cost. Archived periods keep their figures
 * forever; the live challenge appears here too and simply moves into the
 * archived list when it ends, which is what stops an old deduction from
 * hanging around on the main card.
 *
 * It ends with a reconciliation, because a history that does not add up to the
 * balance is worse than no history: total earned, minus everything deducted,
 * plus anything the rank floor cancelled, equals Current XP.
 */
export default function XPHistory() {
  const { activeProfile, getXPHistory } = useApp();
  const [open, setOpen] = useState(false);

  const { rows, breakdown, floor } = getXPHistory(activeProfile);
  if (!rows.length && breakdown.earned === 0) return null;

  const n = (x) => Math.round(Math.abs(Number(x) || 0)).toLocaleString();
  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
    catch { return d; }
  };
  const archived = rows.filter(r => r.archived);
  const live = rows.find(r => !r.archived);

  return (
    <div className="xph">
      <button className="xph-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="xph-toggle-label">📜 XP History</span>
        <span className="xph-toggle-meta">{rows.length} {rows.length === 1 ? 'period' : 'periods'}</span>
        <span className="xph-caret">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="xph-body">
          {live && (
            <>
              <div className="xph-group">In progress</div>
              <Period row={live} n={n} fmt={fmt} detailId="current" />
            </>
          )}
          {archived.length > 0 && (
            <>
              <div className="xph-group">Completed</div>
              {[...archived].reverse().map(r => (
                <Period key={r.id} row={r} n={n} fmt={fmt} detailId={r.id} />
              ))}
            </>
          )}

          {/* The sums have to reconcile with the balance, or this section is
              misleading rather than informative. */}
          <div className="xph-total">
            <div className="xph-total-row">
              <span>Total XP earned</span><span>{n(breakdown.earned)}</span>
            </div>
            {breakdown.grossPenalties > 0 && (
              <div className="xph-total-row deduct">
                <span>Missed-day penalties</span><span>−{n(breakdown.grossPenalties)}</span>
              </div>
            )}
            {breakdown.forgiven > 0 && (
              <div className="xph-total-row protected">
                <span>Cancelled by your rank protection</span><span>+{n(breakdown.forgiven)}</span>
              </div>
            )}
            <div className="xph-total-row net">
              <span>Current XP</span><span>{n(breakdown.net)}</span>
            </div>
            {breakdown.net < floor && (
              <p className="xph-note">
                Your rank holds your XP at {n(floor)} — you keep everything you have unlocked.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Period({ row, n, fmt, detailId = null }) {
  const [open, setOpen] = useState(false);
  const dates = row.startDate
    ? `${fmt(row.startDate)}${row.endDate ? ` – ${fmt(row.endDate)}` : ' – now'}`
    : fmt(row.endDate);
  return (
    <div className="xph-period">
      <div className="xph-period-head">
        <span className="xph-period-name">{row.name}</span>
        <span className="xph-period-date">{dates}</span>
      </div>
      {row.detailAvailable ? (
        <div className="xph-period-rows">
          <div className="xph-period-row"><span>XP earned</span><span>+{n(row.earned)}</span></div>
          {row.missedDays > 0 && (
            <div className="xph-period-row">
              <span>Days missed</span><span>{row.missedDays}</span>
            </div>
          )}
          {row.penalties > 0 && (
            <div className="xph-period-row deduct">
              <span>Missed-day penalties</span><span>−{n(row.penalties)}</span>
            </div>
          )}
          {row.partialPenalties > 0 && (
            <div className="xph-period-row deduct">
              <span>Unfinished days</span><span>−{n(row.partialPenalties)}</span>
            </div>
          )}
          <div className="xph-period-row net">
            <span>{row.archived ? 'Banked' : 'So far'}</span><span>{n(row.banked)} XP</span>
          </div>
          {detailId && (
            <button className="xph-detail-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
              {open ? 'Hide where this XP came from' : 'Where did this XP come from?'}
            </button>
          )}
          {open && detailId && <ChallengeXPBreakdown which={detailId} />}
        </div>
      ) : (
        <div className="xph-period-rows">
          <div className="xph-period-row net">
            <span>Banked</span><span>{n(row.banked)} XP</span>
          </div>
          <p className="xph-note">
            Forge could not read this challenge&apos;s day-by-day records, so the breakdown
            isn&apos;t available. The XP above is unaffected.
          </p>
        </div>
      )}
    </div>
  );
}
