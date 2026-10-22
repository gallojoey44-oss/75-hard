import { useApp } from '../context/AppContext';
import { formatDateLong } from '../utils/dateUtils';

/**
 * The Welcome Back notice.
 *
 * A standing "XP Lost from Missed Days" line on the Rank Details card made an
 * old deduction look like an ongoing penalty. This says the same thing at the
 * moment it is actually useful — you were away, here is what it cost, your
 * rank is safe — and then goes away.
 *
 * It appears once per stretch of inactivity, identified by a stable key, so a
 * reload never re-announces the same gap. It also ages out on its own after a
 * few days of renewed activity, so someone who is plainly back is not still
 * being told they were gone.
 *
 * The figures are the real ones: the actual eligible missed days and the
 * penalties the XP system charged for them. The unfinished current day is
 * never included.
 */
export default function WelcomeBack() {
  const { activeProfile, getComeback, dismissComebackNotice } = useApp();
  const gap = getComeback(activeProfile);
  if (!gap?.show) return null;

  const range = gap.fromDate && gap.toDate && gap.fromDate !== gap.toDate
    ? `${formatDateLong(gap.fromDate)} – ${formatDateLong(gap.toDate)}`
    : formatDateLong(gap.toDate || gap.fromDate);

  return (
    <div className="wb-card">
      <button
        className="wb-close"
        onClick={() => dismissComebackNotice(activeProfile)}
        aria-label="Dismiss"
      >✕</button>

      <div className="wb-title">👋 Welcome Back</div>
      <div className="wb-figures">
        <div className="wb-figure">
          <span className="wb-figure-value">{gap.missedDays}</span>
          <span className="wb-figure-label">{gap.missedDays === 1 ? 'missed day' : 'missed days'}</span>
        </div>
        <div className="wb-figure">
          <span className="wb-figure-value loss">−{gap.penalty.toLocaleString()}</span>
          <span className="wb-figure-label">XP</span>
        </div>
      </div>
      {range && <div className="wb-range">{range}</div>}
      <p className="wb-note">Your rank and achievements are protected.</p>
      <button className="wb-dismiss" onClick={() => dismissComebackNotice(activeProfile)}>
        Got it
      </button>
    </div>
  );
}
