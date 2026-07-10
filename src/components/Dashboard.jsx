import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import BuildBanner from './BuildBanner';
import QuoteOfTheDay from './QuoteOfTheDay';
import {
  computeTotalXP, computeTodayXP, computeLifetimeXP, getRankInfo,
  computeBadges, detectSetback, BADGE_DEFS, RANKS,
} from '../utils/gamification';
import { buildTimeline, entriesInLastNDays } from '../utils/archiveUtils';
import { computeAveragesFromEntries, getPriorityBottleneck } from '../utils/insightsUtils';

function CircleRing({ value, max, size = 120 }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth="10" fill="none" />
      <circle
        cx={size/2} cy={size/2} r={r}
        stroke="var(--accent)" strokeWidth="10" fill="none"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

function XPWidget({ rankInfo, challengeXP, todayXP, onToggleDetails, showDetails, onToggleLadder, showLadder }) {
  return (
    <div className="xp-widget">
      <div className="xp-widget-top">
        <div className="xp-rank-badge">{rankInfo.current.name}</div>
        <span style={{ flex: 1 }} />
        <span className="xp-value">{rankInfo.xp.toLocaleString()} XP</span>
        <button className="xp-details-btn" onClick={onToggleLadder}>
          {showLadder ? '▲ Ladder' : '🪜 Ladder'}
        </button>
        <button className="xp-details-btn" onClick={onToggleDetails}>
          {showDetails ? '▲' : '▼ Details'}
        </button>
      </div>
      <div className="xp-split-row">
        <span className="xp-split-item">🔥 Challenge: <strong>{challengeXP.toLocaleString()}</strong></span>
        <span className="xp-split-item">🏛 Lifetime: <strong>{rankInfo.xp.toLocaleString()}</strong></span>
      </div>
      <div className="xp-bar-wrap">
        <div className="xp-bar-track">
          <div className="xp-bar-fill" style={{ width: `${rankInfo.progress}%` }} />
        </div>
        {rankInfo.next ? (
          <span className="xp-next-label">{(rankInfo.next.minXP - rankInfo.xp).toLocaleString()} XP to {rankInfo.next.name}</span>
        ) : (
          <span className="xp-next-label">Max rank — Unbreakable</span>
        )}
      </div>
      {(todayXP.gained > 0 || todayXP.lost > 0) && (
        <div className="xp-today-row">
          {todayXP.gained > 0 && <span className="xp-today-gain">+{todayXP.gained}</span>}
          {todayXP.lost > 0 && <span className="xp-today-loss">-{todayXP.lost}</span>}
          <span className="xp-today-label">today</span>
        </div>
      )}
    </div>
  );
}

function RankLadderCard({ rankInfo }) {
  return (
    <div className="rank-ladder-card">
      <div className="rank-details-title">🪜 Rank Ladder</div>
      <div className="rank-ladder-summary">
        <div className="rank-ladder-summary-row">
          <span className="rank-ladder-summary-label">Current rank</span>
          <span className="rank-ladder-summary-value">{rankInfo.current.name}</span>
        </div>
        <div className="rank-ladder-summary-row">
          <span className="rank-ladder-summary-label">Lifetime XP</span>
          <span className="rank-ladder-summary-value">{rankInfo.xp.toLocaleString()}</span>
        </div>
        {rankInfo.next ? (
          <>
            <div className="rank-ladder-summary-row">
              <span className="rank-ladder-summary-label">Next rank</span>
              <span className="rank-ladder-summary-value">{rankInfo.next.name}</span>
            </div>
            <div className="rank-ladder-summary-row">
              <span className="rank-ladder-summary-label">XP to next rank</span>
              <span className="rank-ladder-summary-value">{(rankInfo.next.minXP - rankInfo.xp).toLocaleString()}</span>
            </div>
          </>
        ) : (
          <div className="rank-ladder-summary-row">
            <span className="rank-ladder-summary-label">Next rank</span>
            <span className="rank-ladder-summary-value">Max rank reached</span>
          </div>
        )}
      </div>
      <div className="xp-bar-track" style={{ marginBottom: 12 }}>
        <div className="xp-bar-fill" style={{ width: `${rankInfo.progress}%` }} />
      </div>
      <div className="rank-ladder-list">
        {RANKS.map(r => {
          const status = r.rank < rankInfo.current.rank ? 'done'
            : r.rank === rankInfo.current.rank ? 'current' : 'locked';
          return (
            <div key={r.rank} className={`rank-ladder-row ${status}`}>
              <span className="rank-ladder-status">
                {status === 'done' ? '✓' : status === 'current' ? '▶' : '🔒'}
              </span>
              <div className="rank-ladder-info">
                <div className="rank-ladder-name">{r.name}</div>
                <div className="rank-ladder-desc">{r.desc}</div>
              </div>
              <span className="rank-ladder-xp">{r.minXP.toLocaleString()} XP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankDetailsCard({ rankInfo, challengeXP, archivedChallenges, longest, totalDone, comebackCompletions }) {
  return (
    <div className="rank-details-card">
      <div className="rank-details-title">Rank Details</div>
      <div className="rank-details-grid">
        <div className="rank-detail-row">
          <span className="rank-detail-label">Current Rank</span>
          <span className="rank-detail-value">{rankInfo.current.name}</span>
        </div>
        {rankInfo.next && (
          <div className="rank-detail-row">
            <span className="rank-detail-label">Next Rank</span>
            <span className="rank-detail-value">{rankInfo.next.name}</span>
          </div>
        )}
        <div className="rank-detail-row">
          <span className="rank-detail-label">Lifetime XP</span>
          <span className="rank-detail-value">{rankInfo.xp.toLocaleString()}</span>
        </div>
        <div className="rank-detail-row">
          <span className="rank-detail-label">Challenge XP</span>
          <span className="rank-detail-value">{challengeXP.toLocaleString()}</span>
        </div>
        {archivedChallenges > 0 && (
          <div className="rank-detail-row">
            <span className="rank-detail-label">Past Challenges</span>
            <span className="rank-detail-value">{archivedChallenges}</span>
          </div>
        )}
        {rankInfo.next && (
          <div className="rank-detail-row">
            <span className="rank-detail-label">XP to Next</span>
            <span className="rank-detail-value">{(rankInfo.next.minXP - rankInfo.xp).toLocaleString()}</span>
          </div>
        )}
        <div className="rank-detail-row">
          <span className="rank-detail-label">Best Streak</span>
          <span className="rank-detail-value">{longest}d</span>
        </div>
        <div className="rank-detail-row">
          <span className="rank-detail-label">Perfect Days</span>
          <span className="rank-detail-value">{totalDone}</span>
        </div>
        {comebackCompletions > 0 && (
          <div className="rank-detail-row">
            <span className="rank-detail-label">Comebacks</span>
            <span className="rank-detail-value">{comebackCompletions}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BadgeRow({ badges }) {
  if (!badges.length) return null;
  return (
    <div className="badge-row">
      {badges.map(b => (
        <div key={b.id} className="badge-chip" title={b.desc}>
          <span className="badge-chip-emoji">{b.emoji}</span>
          <span className="badge-chip-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function ComebackCard({ dayNum, comebackMode, setback, onStart, onDismiss, onComplete }) {
  useEffect(() => {
    if (comebackMode?.active && comebackMode.dayStart != null && dayNum >= comebackMode.dayStart + 3) {
      onComplete(comebackMode.dayStart);
    }
  }, [dayNum, comebackMode, onComplete]);

  if (comebackMode?.active) {
    const elapsed = dayNum - (comebackMode.dayStart || dayNum);
    const phase = Math.min(elapsed, 2);
    const phases = [
      { label: 'Day 1', desc: 'Minimum Warrior Day — just show up', icon: '🚶' },
      { label: 'Day 2', desc: 'Normal tasks, lower intensity', icon: '💪' },
      { label: 'Day 3', desc: 'Full challenge — back in full', icon: '🔥' },
    ];
    return (
      <div className="comeback-card active">
        <div className="comeback-header">
          <span className="comeback-icon">↩️</span>
          <div>
            <div className="comeback-title">Comeback Mode — Day {Math.min(phase + 1, 3)} of 3</div>
            <div className="comeback-sub">Keep going. You&apos;re building something.</div>
          </div>
        </div>
        <div className="comeback-phases">
          {phases.map((p, i) => (
            <div
              key={i}
              className={`comeback-phase${i < phase ? ' done' : i === phase ? ' current' : ''}`}
            >
              <span>{p.icon}</span>
              <div>
                <div className="comeback-phase-label">{p.label}</div>
                <div className="comeback-phase-desc">{p.desc}</div>
              </div>
              {i < phase && <span className="comeback-check">✓</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!setback.hasSetback) return null;
  return (
    <div className="comeback-card">
      <div className="comeback-header">
        <span className="comeback-icon">↩️</span>
        <div>
          <div className="comeback-title">You&apos;re not starting over.</div>
          <div className="comeback-sub">You&apos;re returning.</div>
        </div>
      </div>
      <p className="comeback-body">
        {setback.incompleteDays} of your last 7 days were incomplete.
        A 3-day comeback plan gets you back to full pace — without resetting your challenge.
      </p>
      <div className="comeback-actions">
        <button className="btn btn-primary comeback-start-btn" onClick={onStart}>
          Start Comeback Mode
        </button>
        <button className="btn btn-ghost comeback-dismiss-btn" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ setView }) {
  const {
    activeProfile, profile, profiles, days, allDays, archives,
    getChallengeMeta, getDayNumber, getDayCompletion, getStreak, getLongestStreak,
    startChallenge,
    setActiveProfile,
    startComeback, dismissComeback, completeComeback,
  } = useApp();

  const [showSwitch, setShowSwitch] = useState(false);
  const [showRankDetails, setShowRankDetails] = useState(false);
  const [showRankLadder, setShowRankLadder] = useState(false);
  const [xpAnim, setXpAnim] = useState(null);
  const prevXpRef = useRef(null);

  const meta      = getChallengeMeta();
  const duration  = meta.durationDays || 75;
  const dayNum    = getDayNumber();
  const streak    = getStreak();
  const longest   = getLongestStreak();
  const todayPct  = dayNum ? getDayCompletion(dayNum) : 0;
  const totalDone = dayNum
    ? Array.from({ length: dayNum }, (_, i) => i + 1).filter(n => getDayCompletion(n) === 100).length
    : 0;

  const otherProfile = activeProfile === 'me' ? 'girlfriend' : 'me';

  const profileArchives = archives[activeProfile] || [];
  const xpData     = dayNum ? computeTotalXP(allDays, profiles, activeProfile, getDayCompletion, dayNum, dayNum) : { total: 0, rawTotal: 0 };
  const lifetimeXP = computeLifetimeXP(profileArchives, xpData.rawTotal || 0);
  // Rank is based on Lifetime XP — it survives starting a new challenge
  const rankInfo = getRankInfo(lifetimeXP);
  const todayXP  = dayNum ? computeTodayXP(allDays, profiles, activeProfile, getDayCompletion, dayNum) : { gained: 0, lost: 0, streakBonus: 0 };

  // Badges are lifetime achievements: current challenge + everything archived
  const rawBadges = dayNum ? computeBadges(allDays, profiles, activeProfile, getDayCompletion, dayNum) : [];
  const badgeIds  = new Set(rawBadges.map(b => b.id));
  for (const arch of profileArchives) for (const id of arch.badges || []) badgeIds.add(id);
  if (lifetimeXP >= 7500) badgeIds.add('true_warrior_rank');
  const badges = BADGE_DEFS.filter(b => badgeIds.has(b.id));

  // Top insight preview — highest-priority bottleneck from the last 7 days
  // (merged across archived + active challenges, same data Insights uses)
  const timeline = buildTimeline(profile, days, profileArchives);
  const avg7Home = computeAveragesFromEntries(entriesInLastNDays(timeline, 7));
  const topInsight = getPriorityBottleneck(avg7Home, profile?.sleepTarget ?? 8);

  const setback     = dayNum ? detectSetback(allDays, activeProfile, getDayCompletion, dayNum) : { hasSetback: false };
  const comebackMode = profile?.comebackMode || { active: false, dayStart: null, dismissedAt: null };
  const comebackCompletions = (profile?.comebackHistory || []).filter(cb => cb.completed).length;

  const showComebackCard = !!(comebackMode.active || (
    setback.hasSetback &&
    !comebackMode.active &&
    (comebackMode.dismissedAt == null || dayNum > comebackMode.dismissedAt + 3)
  ));

  // XP float animation on gain
  useEffect(() => {
    if (prevXpRef.current !== null && lifetimeXP > prevXpRef.current) {
      const diff = lifetimeXP - prevXpRef.current;
      setXpAnim({ key: Date.now(), text: `+${diff}` });
    }
    prevXpRef.current = lifetimeXP;
  }, [lifetimeXP]);

  if (!profile?.challengeStart) {
    return (
      <div className="dashboard">
        <BuildBanner />
        <div className="dash-top">
          <div className="dash-profile-info">
            <span className="dash-emoji">{profile?.emoji}</span>
            <div>
              <h2>{profile?.name}</h2>
              <p className="text-muted">No active challenge</p>
            </div>
          </div>
          <button className="dash-switch-btn" onClick={() => setActiveProfile(otherProfile)}>
            Switch
          </button>
        </div>

        <div className="start-challenge">
          <div className="start-challenge-emoji">🔥</div>
          <h2>Start a Challenge</h2>
          <p>
            Begin your 75-Day Discipline Challenge. Day 1 starts today — tasks, XP, and progress track automatically.
          </p>
          <button className="btn btn-primary btn-full" onClick={() => startChallenge()}>
            Start 75-Day Discipline Challenge
          </button>
          <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => setView('challenges')}>
            Browse All Challenges
          </button>
        </div>
      </div>
    );
  }

  const isDone = dayNum >= duration;
  const prevDay = dayNum ? dayNum - 1 : null;
  const prevPct = prevDay ? getDayCompletion(prevDay) : 100;
  const showWarning = prevDay && prevPct < 100 && prevDay > 0;

  return (
    <div className="dashboard">
      <BuildBanner />
      <div className="dash-top">
        <div className="dash-profile-info">
          <span className="dash-emoji">{profile.emoji}</span>
          <div>
            <h2>{profile.name}</h2>
            <p className="text-muted dash-challenge-label">
              {meta.emoji} Active Challenge: {meta.name}
              {meta.variant ? ` · ${meta.variant.charAt(0).toUpperCase() + meta.variant.slice(1)}` : ''}
            </p>
          </div>
        </div>
        <button className="dash-switch-btn" onClick={() => setActiveProfile(otherProfile)}>
          Switch
        </button>
      </div>

      {/* XP / Rank widget with animation */}
      <div style={{ position: 'relative' }}>
        <XPWidget
          rankInfo={rankInfo}
          challengeXP={xpData.total}
          todayXP={todayXP}
          onToggleDetails={() => setShowRankDetails(v => !v)}
          showDetails={showRankDetails}
          onToggleLadder={() => setShowRankLadder(v => !v)}
          showLadder={showRankLadder}
        />
        {xpAnim && (
          <div key={xpAnim.key} className="xp-float">{xpAnim.text} XP</div>
        )}
      </div>

      {/* Rank ladder (expandable) */}
      {showRankLadder && <RankLadderCard rankInfo={rankInfo} />}

      {/* Rank details (expandable) */}
      {showRankDetails && (
        <RankDetailsCard
          rankInfo={rankInfo}
          challengeXP={xpData.total}
          archivedChallenges={profileArchives.length}
          longest={longest}
          totalDone={totalDone}
          comebackCompletions={comebackCompletions}
        />
      )}

      {/* Quote of the Day — identity and motivation live on Home */}
      <QuoteOfTheDay />

      {isDone && (
        <div className="challenge-complete">
          <h3>🏆 Challenge Complete!</h3>
          <p>You finished all {duration} days. Incredible!</p>
        </div>
      )}

      {showWarning && !isDone && (
        <div className="warn-banner">
          ⚠️ Day {prevDay} wasn&apos;t fully completed — you can still edit it with the Day Selector on the Today tab.
        </div>
      )}

      {/* Comeback card */}
      {!isDone && showComebackCard && (
        <ComebackCard
          dayNum={dayNum}
          comebackMode={comebackMode}
          setback={setback}
          onStart={() => startComeback(dayNum)}
          onDismiss={() => dismissComeback(dayNum)}
          onComplete={(startDay) => completeComeback(startDay)}
        />
      )}

      {/* Hero Ring */}
      <div className="hero-card">
        <div className="hero-ring-wrap">
          <CircleRing value={dayNum || 0} max={duration} size={120} />
          <div className="hero-ring-text">
            <span className="hero-day-num">{isDone ? duration : (dayNum || '—')}</span>
            <span className="hero-of-75">of {duration}</span>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat-row">
            <span className="hero-stat-label">🔥 Streak</span>
            <span className={`hero-stat-value${streak > 0 ? ' streak' : ''}`}>{streak}d</span>
          </div>
          <div className="hero-stat-row">
            <span className="hero-stat-label">Today</span>
            <span className="hero-stat-value">{todayPct}%</span>
          </div>
        </div>
      </div>

      {/* Challenge progress bar */}
      <div className="section-card" style={{ marginBottom: 14 }}>
        <div className="prog-bar-wrap">
          <div className="prog-bar-label">
            <span>Challenge progress</span>
            <span>{totalDone}/{Math.min(dayNum || 0, duration)} perfect days</span>
          </div>
          <div className="prog-bar-track">
            <div className="prog-bar-fill" style={{ width: `${((dayNum || 0) / duration) * 100}%` }} />
          </div>
        </div>
        <div className="prog-bar-wrap">
          <div className="prog-bar-label">
            <span>Today</span>
            <span>{todayPct}%</span>
          </div>
          <div className="prog-bar-track">
            <div
              className={`prog-bar-fill${todayPct === 100 ? ' success' : ''}`}
              style={{ width: `${todayPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">🏆 Best Streak</div>
          <div className="stat-card-value">{longest}d</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">✅ Perfect Days</div>
          <div className="stat-card-value">{totalDone}</div>
        </div>
      </div>

      {/* Top insight preview */}
      {topInsight?.bottleneck && (
        <button className="ins-preview-card" onClick={() => setView('insights')}>
          <span className="ins-preview-emoji">{topInsight.emoji}</span>
          <div className="ins-preview-body">
            <div className="ins-preview-title">Top Insight · {topInsight.label}</div>
            <div className="ins-preview-msg">{topInsight.coachMsg}</div>
          </div>
          <span className="ins-preview-arrow">→</span>
        </button>
      )}

      {/* Recent badges */}
      <BadgeRow badges={badges} />

      {/* Log Today */}
      <button className="btn btn-primary btn-full" onClick={() => setView('today')}>
        ✅ Log Today →
      </button>
    </div>
  );
}
