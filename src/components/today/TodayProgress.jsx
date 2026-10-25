import { useApp } from '../../context/AppContext';
import { computeDayXP } from '../../utils/gamification';
import { dayRules } from '../../data/xpEconomy';
import ProgressRing from './ProgressRing';

/**
 * A message that responds to where the day actually is.
 *
 * Deliberately plain: it reports the state and points at the next action. The
 * strings are a small table rather than an algorithm so they can be read and
 * judged as copy.
 */
function encouragement({ done, total, isMWD, isPast, isFuture }) {
  if (isFuture) return 'Planning ahead — nothing counts until the day arrives.';
  if (isPast) {
    if (total === 0) return 'Nothing was required on this day.';
    return done === total ? 'Completed in full.' : `Finished ${done} of ${total} on this day.`;
  }
  if (isMWD) {
    return done === total
      ? 'Minimum kept. That is what today needed.'
      : 'Do the minimum. The chain stays intact.';
  }
  if (total === 0) return 'No required habits today.';
  if (done === 0) return 'Nothing logged yet — start with your keystone.';
  if (done === total) return 'Every requirement done. Strong day.';
  const left = total - done;
  if (done >= total - 1) return 'One left. Finish it.';
  if (done >= total / 2) return `Over halfway — ${left} to go.`;
  return `Keep going — ${left} left.`;
}

/**
 * Today's progress: how much of the day is done, and what it is worth.
 *
 * Both XP figures come from the engine, under THIS attempt's rate card, so an
 * era-1 attempt still reports era-1 numbers and an era-2 attempt its own. The
 * second figure is what finishing every remaining requirement would add — run
 * through the same `computeDayXP` with the outstanding tasks marked done, which
 * is why it accounts for the perfect-day bonus rather than just summing rows.
 */
export default function TodayProgress({
  tasks, dayData, dayNum, isMWD, mwdDone, mwdTotal, isPast, isFuture,
}) {
  const { activeProfile, profile, getChallengeMeta } = useApp();

  const meta = getChallengeMeta();
  const rules = dayRules(meta);
  const penaltiesOn = profile?.xpPenalties !== false;

  const done = isMWD ? mwdDone : tasks.filter(t => dayData?.tasks?.[t.id]).length;
  const total = isMWD ? mwdTotal : tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // What the day has earned so far, and what finishing it would add.
  const earned = computeDayXP(dayData || {}, tasks, activeProfile, dayNum, dayNum, penaltiesOn, dayNum, rules).gained;
  const ifComplete = computeDayXP(
    { ...(dayData || {}), tasks: { ...(dayData?.tasks || {}), ...Object.fromEntries(tasks.map(t => [t.id, true])) } },
    tasks, activeProfile, dayNum, dayNum, penaltiesOn, dayNum, rules,
  ).gained;
  const remaining = Math.max(0, ifComplete - earned);

  const msg = encouragement({ done, total, isMWD, isPast, isFuture });

  return (
    <section className="f4-card f4-progress-card">
      <ProgressRing value={pct} size={76} stroke={7} label={`${done} of ${total} requirements complete`}>
        <span className="f4-ring-num">{done}<span className="f4-ring-den">/{total}</span></span>
      </ProgressRing>

      <div className="f4-progress-body">
        <div className="f4-progress-kicker">{isMWD ? 'Minimum Warrior Day' : "Today's progress"}</div>
        <div className="f4-progress-head">
          {done} of {total} {total === 1 ? 'habit' : 'habits'} complete
        </div>
        <div className="f4-progress-msg">{msg}</div>
      </div>

      <div className="f4-xp-stack">
        <div className="f4-xp-pill earned">
          <span className="f4-xp-val">+{earned.toLocaleString()}</span>
          <span className="f4-xp-lbl">XP earned</span>
        </div>
        {remaining > 0 && (
          <div className="f4-xp-pill remaining">
            <span className="f4-xp-val">{remaining.toLocaleString()}</span>
            <span className="f4-xp-lbl">still available</span>
          </div>
        )}
      </div>
    </section>
  );
}
