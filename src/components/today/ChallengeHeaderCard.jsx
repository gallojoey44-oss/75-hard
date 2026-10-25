import { useApp } from '../../context/AppContext';
import { difficultyLabel, getTemplateById } from '../../data/challengeTemplates';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** One lane's line: name, mode, day of duration, progress. */
function LaneRow({ kicker, meta, dayNum, className = '' }) {
  const duration = meta?.durationDays ?? null;
  const tpl = getTemplateById(meta?.templateId);
  const mode = meta?.variant ? capitalize(meta.variant) : null;
  // Open-ended runs (Forge Daily) have no duration to be a fraction of, so they
  // report the day they are on rather than a percentage of nothing.
  const pct = duration && dayNum ? Math.min(100, Math.round((dayNum / duration) * 100)) : null;

  return (
    <div className={`f4-lane${className ? ' ' + className : ''}`}>
      <div className="f4-lane-kicker">{kicker}</div>
      <div className="f4-lane-name">
        <span className="f4-lane-emoji" aria-hidden="true">{meta?.emoji || '🎯'}</span>
        <span className="f4-lane-title">{meta?.name || 'Challenge'}</span>
        {mode && <span className="f4-lane-mode">· {mode}</span>}
      </div>
      <div className="f4-lane-meta">
        {dayNum ? (
          <span className="f4-lane-day">
            Day {dayNum}{duration ? <span className="f4-dim"> of {duration}</span> : ''}
          </span>
        ) : null}
        {tpl && <span className="f4-lane-diff">{difficultyLabel(tpl, meta?.variant || null)}</span>}
      </div>
      {pct != null && (
        <div className="f4-lane-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${meta?.name || 'Challenge'} progress`}>
          <div className="f4-lane-bar-fill" style={{ width: `${pct}%` }} />
          <span className="f4-lane-bar-pct">{pct}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * The Active Challenge header.
 *
 * What a user needs before anything else: which challenge is running, on what
 * mode, how far in, whether the streak is intact, and where their rank stands.
 * Both lanes are shown when a Support Challenge is running — it is a real
 * commitment and hiding it would misrepresent the day.
 *
 * Every figure is read from the store. There is deliberately no "Log Today"
 * action: this IS today's screen, and a button that scrolls back to where you
 * already are is noise.
 */
export default function ChallengeHeaderCard({ onOpenChallenge }) {
  const {
    profile, getChallengeMeta, getDayNumber, getStreak,
    getRankState, getSupportMeta, getSupportDayNumber, isForgeDaily,
  } = useApp();

  const meta = getChallengeMeta();
  const dayNum = getDayNumber();
  const streak = getStreak();
  const rank = getRankState();
  const supportMeta = getSupportMeta?.();
  const supportDay = supportMeta ? getSupportDayNumber?.() : null;
  const baseline = isForgeDaily?.();

  if (!profile?.challengeStart || !meta) return null;

  return (
    <section className="f4-card f4-challenge-card">
      <div className="f4-challenge-glow" aria-hidden="true" />

      <div className="f4-challenge-head">
        <span className="f4-live-dot" aria-hidden="true" />
        <span className="f4-challenge-kicker">
          {baseline ? 'Daily Baseline' : supportMeta ? 'Active Challenges' : 'Active Challenge'}
        </span>
        {streak > 0 && (
          <span className="f4-streak" title={`${streak}-day streak`}>
            🔥 {streak} day{streak === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <LaneRow
        kicker={supportMeta ? 'Primary' : null}
        meta={meta}
        dayNum={dayNum}
      />

      {supportMeta && (
        <LaneRow
          kicker="Support"
          meta={supportMeta}
          dayNum={supportDay}
          className="support"
        />
      )}

      <div className="f4-challenge-foot">
        <div className="f4-rank">
          <span className="f4-rank-badge" aria-hidden="true">🛡️</span>
          <span className="f4-rank-text">
            <span className="f4-rank-name">{rank.current?.name}</span>
            <span className="f4-rank-xp">{rank.xp.toLocaleString()} XP</span>
          </span>
        </div>
        {onOpenChallenge && (
          <button type="button" className="f4-btn f4-btn-quiet" onClick={onOpenChallenge}>
            View Challenge
          </button>
        )}
      </div>
    </section>
  );
}
