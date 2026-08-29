import { useApp } from '../context/AppContext';
import {
  computeChallengeScore, getPassingConfig, isChallengePassed, getPerformanceStatus,
} from '../utils/gamification';
import { LANE } from '../utils/challengeStack';
import { formatDateShort } from '../utils/dateUtils';

const STATUS_COLOR = {
  excellent: '#10B981',
  onTrack: '#3B82F6',
  atRisk: '#F59E0B',
  needsAttention: '#EF4444',
};

/**
 * Progress for the SUPPORT challenge — its own score, its own day count, its own
 * passing line, scored only over the tasks it actually requires.
 *
 * Deliberately a separate, compact card: the primary's Challenge Performance
 * card stays exactly as it is and remains the dominant one.
 */
export default function SupportProgress() {
  const { activeProfile, profiles, allDays, getSupportMeta, getSupportDayNumber, getSupportStart } = useApp();

  const meta = getSupportMeta();
  if (!meta) return null;

  const dayNum = getSupportDayNumber();
  const start = getSupportStart();
  const cfg = getPassingConfig(meta);

  // Not begun yet (a scheduled support start) — show the schedule, not a score.
  if (dayNum == null) {
    return (
      <div className="perf-card support-perf">
        <div className="sp-head">
          <span className="sp-role">SUPPORT</span>
          <span className="sp-name">{meta.emoji} {meta.name}</span>
        </div>
        <div className="sp-pending">Day 1 begins {formatDateShort(start)} — nothing is scored yet.</div>
      </div>
    );
  }

  const score = computeChallengeScore(allDays, profiles, activeProfile, dayNum, LANE.SUPPORT);
  const status = score ? getPerformanceStatus(score.score, cfg.passingScore) : null;

  return (
    <div className="perf-card support-perf">
      <div className="sp-head">
        <span className="sp-role">SUPPORT</span>
        <span className="sp-name">{meta.emoji} {meta.name}</span>
        <span className="sp-day">Day {Math.min(dayNum, meta.durationDays || dayNum)} / {meta.durationDays}</span>
      </div>

      {score ? (
        <>
          <div className="sp-score-row">
            <span className="sp-score" style={{ color: STATUS_COLOR[status.key] }}>{score.score}%</span>
            <span className="sp-status" style={{ color: STATUS_COLOR[status.key] }}>{status.label}</span>
            <span className="sp-pass">passing {cfg.passingScore}%</span>
          </div>
          <div className="sp-bar">
            <div className="sp-bar-fill" style={{ width: `${Math.min(100, score.score)}%`, background: STATUS_COLOR[status.key] }} />
            <div className="sp-bar-mark" style={{ left: `${cfg.passingScore}%` }} />
          </div>
          <div className="sp-note">
            Scored only against this challenge's own requirements. Habits it shares with your
            primary challenge count here too — you log them once.
            {isChallengePassed(score, meta) ? ' Currently passing.' : ''}
          </div>
        </>
      ) : (
        <div className="sp-pending">Complete a task to start building this challenge's score.</div>
      )}
    </div>
  );
}
