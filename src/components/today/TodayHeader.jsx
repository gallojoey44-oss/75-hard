import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { computeDayXP, getTaskXP } from '../../utils/gamification';
import { dayRules } from '../../data/xpEconomy';
import ProgressRing from './ProgressRing';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * A message that responds to where the day actually is. A small table rather
 * than an algorithm, so it can be read and judged as copy.
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

/** One challenge's line: name, mode, day of duration, and how far through. */
function Lane({ meta, dayNum, kicker = null, className = '', onOpen = null }) {
  const duration = meta?.durationDays ?? null;
  const mode = meta?.variant ? capitalize(meta.variant) : null;
  // An open-ended run has no duration to be a fraction of.
  const pct = duration && dayNum ? Math.min(100, Math.round((dayNum / duration) * 100)) : null;

  return (
    <div className={`f4-lane${className ? ' ' + className : ''}`}>
      <div className="f4-lane-top">
        {kicker && <span className="f4-lane-kicker">{kicker}</span>}
        <span className="f4-lane-emoji" aria-hidden="true">{meta?.emoji || '🎯'}</span>
        {/* The challenge's own name is the way into it. A separate "View
            Challenge" button cost a row of the card to say what tapping the
            title already says. */}
        {onOpen ? (
          <button type="button" className="f4-lane-title f4-lane-link" onClick={onOpen}>
            {meta?.name || 'Challenge'}
          </button>
        ) : (
          <span className="f4-lane-title">{meta?.name || 'Challenge'}</span>
        )}
        {mode && <span className="f4-lane-mode">· {mode}</span>}
        {dayNum ? (
          <span className="f4-lane-day">
            Day {dayNum}{duration ? <span className="f4-dim"> / {duration}</span> : ''}
          </span>
        ) : null}
      </div>
      {pct != null && (
        <div
          className="f4-lane-bar"
          role="progressbar"
          aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${meta?.name || 'Challenge'} is ${pct}% through`}
        >
          <div className="f4-lane-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * The top of Today: which challenge, how far in, and how today is going — in
 * one card.
 *
 * These were two stacked cards repeating each other's framing, and together
 * they pushed the first habit most of the way down an iPhone. Merged, the page
 * answers "what am I doing and how is it going?" in roughly the height one of
 * them used to take.
 *
 * The XP arithmetic is behind a tap. It has to be available — two totals that
 * look like they exceed the daily budget invite exactly that question — but it
 * does not have to be on screen every day forever.
 *
 * Rank detail lives on Home. What stays here is the rank's NAME, which is
 * identity rather than arithmetic, and cannot be mistaken for a threshold.
 */
export default function TodayHeader({
  tasks, dayData, dayNum, isMWD, mwdDone, mwdTotal, isPast, isFuture, onOpenChallenge,
}) {
  const {
    activeProfile, profile, getChallengeMeta, getDayNumber, getStreak,
    getRankState, getSupportMeta, getSupportDayNumber, isForgeDaily,
  } = useApp();
  const [showXP, setShowXP] = useState(false);

  const meta = getChallengeMeta();
  const challengeDay = getDayNumber();
  const streak = getStreak();
  const rank = getRankState();
  const supportMeta = getSupportMeta?.();
  const supportDay = supportMeta ? getSupportDayNumber?.() : null;
  const baseline = isForgeDaily?.();

  const rules = dayRules(meta);
  const penaltiesOn = profile?.xpPenalties !== false;

  const done = isMWD ? mwdDone : tasks.filter(t => dayData?.tasks?.[t.id]).length;
  const total = isMWD ? mwdTotal : tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Both figures come from the engine, under THIS attempt's rate card.
  const earned = computeDayXP(dayData || {}, tasks, activeProfile, dayNum, dayNum, penaltiesOn, dayNum, rules).gained;
  const ifComplete = computeDayXP(
    { ...(dayData || {}), tasks: { ...(dayData?.tasks || {}), ...Object.fromEntries(tasks.map(t => [t.id, true])) } },
    tasks, activeProfile, dayNum, dayNum, penaltiesOn, dayNum, rules,
  ).gained;
  const remaining = Math.max(0, ifComplete - earned);

  // The parts of "still available": the habits not yet ticked, and whatever
  // day-level award the day has not qualified for yet (the perfect-day bonus).
  const habitsLeftXP = tasks
    .filter(t => !dayData?.tasks?.[t.id])
    .reduce((sum, t) => sum + getTaskXP(t, rules), 0);
  const bonusLeft = Math.max(0, remaining - habitsLeftXP);
  const reconciles = habitsLeftXP + bonusLeft === remaining;
  const perfectEarned = total > 0 && done === total ? rules.perfectDay : 0;

  if (!profile?.challengeStart || !meta) return null;

  return (
    <section className="f4-card f4-today-head-card">
      <div className="f4-challenge-glow" aria-hidden="true" />

      {/* ── Which challenge ── */}
      <div className="f4-challenge-card">
        <div className="f4-challenge-head">
          <span className="f4-live-dot" aria-hidden="true" />
          <span className="f4-challenge-kicker">
            {baseline ? 'Daily Baseline' : supportMeta ? 'Active Challenges' : 'Active Challenge'}
          </span>
          {streak > 0 && (
            <span className="f4-streak" title={`${streak}-day streak`}>
              🔥 {streak}
            </span>
          )}
          {rank.current?.name && (
            <span className="f4-rank-chip" title="Your rank — the detail is on Home">
              🛡️ {rank.current.name}
            </span>
          )}
        </div>

        <Lane meta={meta} dayNum={challengeDay} kicker={supportMeta ? 'Primary' : null} onOpen={onOpenChallenge} />
        {supportMeta && (
          <Lane meta={supportMeta} dayNum={supportDay} kicker="Support" className="support" onOpen={onOpenChallenge} />
        )}
      </div>

      {/* ── How today is going ── */}
      <div className="f4-progress-card">
        <ProgressRing value={pct} size={56} stroke={6} label={`${done} of ${total} requirements complete`}>
          <span className="f4-ring-num">{done}<span className="f4-ring-den">/{total}</span></span>
        </ProgressRing>

        <div className="f4-progress-body">
          <div className="f4-progress-head">
            {isMWD ? 'Minimum Warrior Day' : `${done} of ${total} ${total === 1 ? 'habit' : 'habits'} done`}
          </div>
          <div className="f4-progress-msg">{encouragement({ done, total, isMWD, isPast, isFuture })}</div>
        </div>

        {/* The arithmetic is a tap away rather than always on screen. */}
        <button
          type="button"
          className="f4-xp-stack"
          aria-expanded={showXP}
          aria-label="Today's XP — tap for the breakdown"
          onClick={() => setShowXP(v => !v)}
        >
          <span className="f4-xp-pill earned">
            <span className="f4-xp-val">+{earned.toLocaleString()}</span>
            <span className="f4-xp-lbl">earned</span>
          </span>
          {remaining > 0 && (
            <span className="f4-xp-pill remaining">
              <span className="f4-xp-val">{remaining.toLocaleString()}</span>
              <span className="f4-xp-lbl">left</span>
            </span>
          )}
        </button>
      </div>

      {showXP && (
        <div className="f4-xp-note" role="region" aria-label="Today's XP breakdown">
          {remaining > 0 ? (
            <>
              <strong>{remaining.toLocaleString()} XP left today</strong>
              {reconciles && (
                <>
                  {' = '}
                  {habitsLeftXP > 0 && `${total - done} habit${total - done === 1 ? '' : 's'} left (${habitsLeftXP.toLocaleString()} XP)`}
                  {habitsLeftXP > 0 && bonusLeft > 0 && ' + '}
                  {bonusLeft > 0 && `${bonusLeft.toLocaleString()} XP perfect-day bonus`}
                </>
              )}
            </>
          ) : (
            <>
              <strong>{earned.toLocaleString()} XP earned today</strong>
              {perfectEarned > 0 && ` — every habit plus the ${perfectEarned.toLocaleString()} XP perfect-day bonus`}
            </>
          )}
        </div>
      )}
    </section>
  );
}
