import { useState } from 'react';
import { useApp } from '../context/AppContext';

/**
 * The one-time historical XP reconciliation.
 *
 * Forge has always CALCULATED inactivity penalties and then discarded any that
 * took a challenge below zero, because an archive stores max(0, gained − lost).
 * This recovers those discarded penalties by re-running the same rules over the
 * day records each archive already holds.
 *
 * Three rules this screen exists to honour:
 *
 *   • Nothing is charged automatically. The exact figure is shown first, and
 *     the user approves it on their own profile. No other profile is touched.
 *   • Archived challenge records are never rewritten. The deduction lives in a
 *     separate ledger; the history stays exactly as it was recorded.
 *   • It can be undone, restoring the previous balance precisely.
 *
 * The card hides itself when there is nothing to reconcile, so a profile with
 * no discarded penalties never sees it.
 */
export default function XPReconciliation() {
  const {
    activeProfile, profile,
    previewXPReconciliation, applyXPReconciliation, undoXPReconciliation,
  } = useApp();

  const [confirming, setConfirming] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  const [done, setDone] = useState(null);

  const preview = previewXPReconciliation(activeProfile);
  const applied = profile?.xpLedger?.reconciled || null;

  // Nothing discarded and nothing applied — there is nothing to say.
  if (!applied && preview.amount <= 0 && preview.unverifiedCount === 0) return null;

  const n = (x) => Math.round(x).toLocaleString();

  // ── Already applied: show what happened, and offer to undo it ──
  if (applied) {
    return (
      <div className="xpr-card applied">
        <div className="xpr-head">
          <span className="xpr-title">✅ Historical XP reconciled</span>
          <span className="xpr-amount">−{n(applied.amount)} XP</span>
        </div>
        <p className="xpr-body">
          Applied {new Date(applied.at).toLocaleDateString()} across {applied.segments.length}{' '}
          {applied.segments.length === 1 ? 'challenge' : 'challenges'}. Your archived records were
          not changed — the deduction is held separately, and your rank floor still protects you.
        </p>
        {applied.segments.length > 0 && (
          <>
            <button className="xpr-link" onClick={() => setShowSegments(v => !v)}>
              {showSegments ? '▾' : '▸'} What was charged
            </button>
            {showSegments && (
              <div className="xpr-segments">
                {applied.segments.map(s => (
                  <div key={s.id} className="xpr-seg">
                    <span className="xpr-seg-name">{s.name}</span>
                    <span className="xpr-seg-date">{s.endDate || ''}</span>
                    <span className="xpr-seg-amount">−{n(s.discarded)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <button className="btn btn-ghost btn-full xpr-undo" onClick={() => { undoXPReconciliation(activeProfile); setDone(null); }}>
          Undo — restore {n(applied.lifetimeBefore)} XP
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="xpr-card applied">
        <div className="xpr-head">
          <span className="xpr-title">✅ Applied</span>
          <span className="xpr-amount">−{n(done)} XP</span>
        </div>
        <p className="xpr-body">Your XP breakdown now shows the deduction.</p>
      </div>
    );
  }

  // ── Not yet applied: the exact figure, before anything changes ──
  return (
    <div className="xpr-card">
      <div className="xpr-head">
        <span className="xpr-title">⚖️ Historical inactivity penalties</span>
        <span className="xpr-amount pending">−{n(preview.amount)} XP</span>
      </div>

      <p className="xpr-body">
        Forge charged these inactivity penalties at the time and then discarded them, because a
        challenge&apos;s archived total is never allowed below zero. Applying this recovers them.
        Your archived challenge records are not changed.
      </p>

      <div className="xpr-maths">
        <div className="xpr-row">
          <span>Lifetime XP now</span><span>{n(preview.lifetimeBefore)}</span>
        </div>
        <div className="xpr-row deduct">
          <span>Discarded penalties</span><span>−{n(preview.amount)}</span>
        </div>
        <div className="xpr-row total">
          <span>After reconciliation</span><span>{n(preview.lifetimeAfter)}</span>
        </div>
        {preview.effectiveAfter !== preview.lifetimeAfter && (
          <div className="xpr-row floor">
            <span>Held at your rank floor</span><span>{n(preview.effectiveAfter)}</span>
          </div>
        )}
      </div>

      <p className="xpr-note">
        Your rank is permanent. Lifetime XP can never fall below {n(preview.floor)} XP while you
        hold your current rank, so this costs you progress toward the next rank — never the rank
        you already earned.
      </p>

      {preview.unverifiedCount > 0 && (
        <p className="xpr-note warn">
          {preview.unverifiedCount}{' '}
          {preview.unverifiedCount === 1 ? 'archived challenge could' : 'archived challenges could'}{' '}
          not be recalculated exactly, so nothing was charged for{' '}
          {preview.unverifiedCount === 1 ? 'it' : 'them'}.
        </p>
      )}

      {preview.charged.length > 0 && (
        <>
          <button className="xpr-link" onClick={() => setShowSegments(v => !v)}>
            {showSegments ? '▾' : '▸'} Where it comes from ({preview.charged.length}{' '}
            {preview.charged.length === 1 ? 'challenge' : 'challenges'})
          </button>
          {showSegments && (
            <div className="xpr-segments">
              {preview.charged.map(s => (
                <div key={s.id} className="xpr-seg">
                  <span className="xpr-seg-name">{s.name}</span>
                  <span className="xpr-seg-date">{s.endDate || ''}</span>
                  <span className="xpr-seg-amount">−{n(s.discarded)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {confirming ? (
        <div className="xpr-confirm">
          <p className="xpr-confirm-text">
            Apply −{n(preview.amount)} XP to <strong>{profile?.name}</strong>? This affects only
            this profile and can be undone.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const amount = preview.amount;
                if (applyXPReconciliation(activeProfile)) setDone(amount);
                setConfirming(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary btn-full xpr-apply"
          disabled={preview.amount <= 0}
          onClick={() => setConfirming(true)}
        >
          Review and apply
        </button>
      )}
    </div>
  );
}
