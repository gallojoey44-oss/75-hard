import { useCallback, useEffect, useRef, useState } from 'react';
import { nameOf } from './config';

/** The screen frame every Journey screen shares: back, title, optional action. */
export function Shell({ title, lede, onBack, backLabel = 'Back', action = null, children, testid }) {
  return (
    <div className="jr-space" data-testid={testid || 'journey'}>
      <header className="jr-head">
        <div className="jr-head-row">
          <button type="button" className="jr-back" onClick={onBack} aria-label={backLabel}>
            <span aria-hidden="true">‹</span> {backLabel}
          </button>
          {action}
        </div>
        <h1 className="jr-title">{title}</h1>
        {lede && <p className="jr-lede">{lede}</p>}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, meta, children, className = '', testid }) {
  return (
    <section className={`jr-card ${className}`} data-testid={testid}>
      {(title || meta) && (
        <div className="jr-card-head">
          {title && <h2 className="jr-card-title">{title}</h2>}
          {meta && <span className="jr-card-meta">{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Avatar({ person, me = false, size = 40 }) {
  const label = nameOf(person).replace(/^@/, '');
  return (
    <span
      className={`jr-avatar${me ? ' me' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {label.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export function Progress({ value, target, label }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="jr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(value, target)}
      aria-label={label || `${value} of ${target}`}>
      <div className="jr-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Inline status line: an error from the server, said plainly. */
export function Notice({ text, tone = 'error' }) {
  if (!text) return null;
  return <p className={`jr-notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{text}</p>;
}

/**
 * Run an async action with a busy flag and a friendly error. Returns
 * [busy, error, run, setError].
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      if (mounted.current) setError(err?.message || 'Something went wrong. Try again.');
      return undefined;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);
  return [busy, error, run, setError];
}

/** A plain confirmation sheet for anything that cannot be undone. */
export function Confirm({ title, body, confirmLabel, danger = false, onConfirm, onCancel, busy = false }) {
  return (
    <div className="jr-sheet-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="jr-sheet" onClick={e => e.stopPropagation()}>
        <h3 className="jr-sheet-title">{title}</h3>
        {body && <p className="jr-sheet-body">{body}</p>}
        <div className="jr-sheet-actions">
          <button type="button" className={`btn btn-full ${danger ? 'jr-btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-ghost btn-full" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Shared progress worth marking. Quiet, and gone with a tap. */
export function Celebration({ title, detail, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="jr-celebrate" role="status" aria-live="polite" onClick={onClose} data-testid="journey-celebration">
      <div className="jr-celebrate-card">
        <div className="jr-celebrate-emoji" aria-hidden="true">🎉</div>
        <div className="jr-celebrate-title">{title}</div>
        {detail && <div className="jr-celebrate-detail">{detail}</div>}
        <button type="button" className="btn btn-primary jr-celebrate-btn" onClick={onClose}>Together</button>
      </div>
    </div>
  );
}

export function formatDay(value) {
  if (!value) return '';
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function timeAgo(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return formatDay(value);
}
