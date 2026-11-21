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
 * Each missed day is shown once. Dismissing the notice acknowledges every day
 * of the gap so far; if the gap then grows, the notice comes back for the NEW
 * days only, with what those days cost — never the running total again, which
 * read as a fresh penalty every morning. It also ages out on its own after a
 * few days of renewed activity.
 *
 * The figures are the real ones: the actual eligible missed days and the
 * penalties the XP system charged for them. The unfinished current day is
 * never included. Showing or dismissing the notice changes no XP.
 */
export default function WelcomeBack() {
  const { activeProfile, getComeback, dismissComebackNotice } = useApp();
  const gap = getComeback(activeProfile);
  if (!gap?.show) return null;

  const days = gap.newMissedDays;
  const from = gap.newFromDate;
  const to = gap.newToDate;
  const range = from && to && from !== to
    ? `${formatDateLong(from)} – ${formatDateLong(to)}`
    : formatDateLong(to || from);
  const label = gap.isUpdate
    ? (days === 1 ? 'more missed day' : 'more missed days')
    : (days === 1 ? 'missed day' : 'missed days');

  return (
    <div className="wb-card" data-update={gap.isUpdate ? 'yes' : 'no'}>
      <button
        className="wb-close"
        onClick={() => dismissComebackNotice(activeProfile)}
        aria-label="Dismiss"
      >✕</button>

      <div className="wb-title">👋 Welcome Back</div>
      <div className="wb-figures">
        <div className="wb-figure">
          <span className="wb-figure-value">{days}</span>
          <span className="wb-figure-label">{label}</span>
        </div>
        <div className="wb-figure">
          <span className="wb-figure-value loss">−{gap.newPenalty.toLocaleString()}</span>
          <span className="wb-figure-label">XP</span>
        </div>
      </div>
      {range && <div className="wb-range">{range}</div>}
      {gap.isUpdate && (
        <p className="wb-note">Since you last checked. The days before were already counted and shown.</p>
      )}
      <p className="wb-note">Your rank and achievements are protected.</p>
      <button className="wb-dismiss" onClick={() => dismissComebackNotice(activeProfile)}>
        Got it
      </button>
    </div>
  );
}
