import { useState } from 'react';
import { useApp } from '../context/AppContext';

/**
 * "Uncounted Missed Days" — the one-time adjustment, in plain language.
 *
 * Internally this is the historical reconciliation of discarded penalties
 * against the rank floor (see utils/xpLedger.js). None of that vocabulary
 * appears here. What the user sees is: we found missed days that were never
 * counted, here is what you would actually lose, here is where it comes from,
 * and nothing you have earned is taken away.
 *
 * The figure that leads is the REAL loss — capped to the XP held above the
 * protected rank minimum — not the raw total, which would show a balance the
 * user can never actually fall to.
 *
 * The card hides itself when there is nothing to show.
 */
export default function XPReconciliation() {
  const {
    activeProfile, profile,
    previewXPReconciliation, applyXPReconciliation, undoXPReconciliation,
  } = useApp();

  const [confirming, setConfirming] = useState(false);
  const [showWhere, setShowWhere] = useState(false);

  const preview = previewXPReconciliation(activeProfile);
  const applied = profile?.xpLedger?.reconciled || null;
  const n = (x) => Math.round(Math.abs(x)).toLocaleString();

  if (!applied && preview.uncounted <= 0 && preview.unverifiedCount === 0) return null;

  // ── Already applied — kept as a record, with an undo ──
  if (applied) {
    return (
      <div className="xpr-card applied">
        <div className="xpr-head">
          <span className="xpr-title">✅ Missed days counted</span>
          <span className="xpr-amount">−{n(applied.amount)} XP</span>
        </div>
        <p className="xpr-body">
          Applied on {new Date(applied.at).toLocaleDateString()}, covering{' '}
          {applied.segments.length} previous{' '}
          {applied.segments.length === 1 ? 'challenge' : 'challenges'}.
          {applied.forgiven > 0 && (
            <> A further {n(applied.forgiven)} XP was cancelled because your rank protects you
            from falling below {n(applied.floor)} XP.</>
          )}{' '}
          Your completed challenges and achievements are unchanged.
        </p>

        <WhereDidILose
          open={showWhere}
          onToggle={() => setShowWhere(v => !v)}
          applied={applied.segments}
          pending={[]}
          excluded={0}
        />

        <button className="btn btn-ghost btn-full xpr-undo" onClick={() => undoXPReconciliation(activeProfile)}>
          Undo this adjustment
        </button>
      </div>
    );
  }

  // ── Not yet applied ──
  const floorAbsorbs = preview.forgiven > 0;

  return (
    <div className="xpr-card">
      <div className="xpr-head">
        <span className="xpr-title">📋 Uncounted Missed Days</span>
      </div>

      <p className="xpr-body">
        Forge found missed days from your previous challenges that were never deducted from your
        XP. You can review them before choosing whether to apply them.
      </p>

      {/* The impact, in the order it makes sense: where you are, what was
          found, what it actually costs, where you end up. */}
      <div className="xpr-maths">
        <div className="xpr-row">
          <span>Current XP</span><span>{n(preview.currentXP)}</span>
        </div>
        <div className="xpr-row muted">
          <span>Missed days found</span><span>−{n(preview.uncounted)} XP</span>
        </div>
        <div className="xpr-row deduct">
          <span>XP you would actually lose</span><span>−{n(preview.actualLoss)} XP</span>
        </div>
        <div className="xpr-row total">
          <span>Your XP after applying</span><span>{n(preview.xpAfter)}</span>
        </div>
        <div className="xpr-row rank">
          <span>Your permanent rank</span><span>{preview.rankName}</span>
        </div>
      </div>

      <p className="xpr-note">
        {floorAbsorbs ? (
          <>
            Your rank protects you from falling below {n(preview.floor)} XP, so only{' '}
            {n(preview.actualLoss)} XP of the {n(preview.uncounted)} found can be taken — the rest
            is cancelled, not saved up. Your achievements and completed challenges remain
            permanent.
          </>
        ) : (
          <>
            Your rank protects you from falling below {n(preview.floor)} XP. Your achievements and
            completed challenges remain permanent.
          </>
        )}
      </p>

      {preview.unverifiedCount > 0 && (
        <p className="xpr-note">
          {preview.unverifiedCount} older{' '}
          {preview.unverifiedCount === 1 ? 'challenge was' : 'challenges were'} left out because
          Forge could not check {preview.unverifiedCount === 1 ? 'its' : 'their'} records
          reliably. Nothing was deducted for{' '}
          {preview.unverifiedCount === 1 ? 'it' : 'them'}.
        </p>
      )}

      <WhereDidILose
        open={showWhere}
        onToggle={() => setShowWhere(v => !v)}
        applied={[]}
        pending={preview.charged}
        excluded={preview.unverifiedCount}
      />

      {confirming ? (
        <div className="xpr-confirm">
          <p className="xpr-confirm-text">
            Apply −{n(preview.actualLoss)} XP to <strong>{profile?.name}</strong>? You can undo
            this afterwards.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => { applyXPReconciliation(activeProfile); setConfirming(false); }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary btn-full xpr-apply"
          disabled={preview.actualLoss <= 0}
          onClick={() => setConfirming(true)}
        >
          {preview.actualLoss > 0 ? 'Review and apply' : 'Nothing to apply'}
        </button>
      )}
    </div>
  );
}

/**
 * "Where did I lose XP?" — per challenge or Forge Daily period.
 *
 * Shows what a person would want to know about a stretch of time: what it was,
 * when, how many days were missed, what they earned, what it cost. Already
 * applied and not yet applied are separate lists so the two are never confused.
 */
function WhereDidILose({ open, onToggle, applied, pending, excluded }) {
  const total = applied.length + pending.length;
  if (total === 0 && excluded === 0) return null;
  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <>
      <button className="xpr-link" onClick={onToggle}>
        {open ? '▾' : '▸'} Where did I lose XP?
      </button>
      {open && (
        <div className="xpr-segments">
          {pending.length > 0 && (
            <>
              <div className="xpr-group">Not yet counted</div>
              {pending.map(s => <Period key={s.id} s={s} fmt={fmt} />)}
            </>
          )}
          {applied.length > 0 && (
            <>
              <div className="xpr-group">Already counted</div>
              {applied.map(s => <Period key={s.id} s={s} fmt={fmt} />)}
            </>
          )}
          {excluded > 0 && (
            <div className="xpr-excluded">
              {excluded} older {excluded === 1 ? 'challenge' : 'challenges'} left out — Forge could
              not check {excluded === 1 ? 'its' : 'their'} records reliably, so nothing was
              deducted.
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Period({ s, fmt }) {
  const n = (x) => Math.round(Math.abs(Number(x) || 0)).toLocaleString();
  return (
    <div className="xpr-period">
      <div className="xpr-period-head">
        <span className="xpr-period-name">{s.name}</span>
        <span className="xpr-period-date">
          {s.startDate ? `${fmt(s.startDate)} – ` : ''}{fmt(s.endDate)}
        </span>
      </div>
      <div className="xpr-period-rows">
        {s.missedDays != null && (
          <div className="xpr-period-row">
            <span>Days missed</span><span>{s.missedDays}</span>
          </div>
        )}
        {s.gained != null && (
          <div className="xpr-period-row">
            <span>XP earned</span><span>+{n(s.gained)}</span>
          </div>
        )}
        {s.lost != null && (
          <div className="xpr-period-row">
            <span>Missed-day penalties</span><span>−{n(s.lost)}</span>
          </div>
        )}
        <div className="xpr-period-row net">
          <span>Net adjustment</span><span>−{n(s.discarded)} XP</span>
        </div>
      </div>
    </div>
  );
}
