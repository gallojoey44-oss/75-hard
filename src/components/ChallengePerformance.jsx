import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  computeChallengeScore, getPassingConfig, getPerformanceStatus, isChallengePassed,
  projectFinalScore, computeTaskBreakdown, getTaskXP, getBonusXP,
} from '../utils/gamification';

const STATUS_COLOR = {
  excellent: '#ffd47a',
  onTrack:   '#7c9cff',
  atRisk:    '#f5b23a',
  needs:     '#ff7a7a',
};

// Required-task XP earned/available for a single day (mirrors the scoring core).
function dailyRequired(dayData, tasks) {
  let earned = 0, available = 0;
  for (const t of tasks) { const xp = getTaskXP(t); available += xp; if (dayData?.tasks?.[t.id]) earned += xp; }
  return { earned, available, pct: available > 0 ? Math.round((earned / available) * 100) : 0 };
}

function ScoreRing({ score, passing, color }) {
  const r = 52, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, score)) / 100);
  const ang = (passing / 100) * 2 * Math.PI - Math.PI / 2;
  const mx = cx + r * Math.cos(ang), my = cy + r * Math.sin(ang);
  return (
    <svg className="perf-ring" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
      {/* Passing-line marker */}
      <circle cx={mx} cy={my} r="4.5" fill="#ffd47a" stroke="#1a1226" strokeWidth="1.5" />
      <text x={cx} y={cy - 2} textAnchor="middle" className="perf-ring-num">{score}%</text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="perf-ring-sub">score</text>
    </svg>
  );
}

export default function ChallengePerformance({ setView }) {
  const { activeProfile, profile, profiles, allDays, getChallengeMeta, getDayNumber, getRawDayNumber, isForgeDaily } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const prevScoreRef = useRef(null);

  const meta = getChallengeMeta();
  const dayNum = getDayNumber();
  // Score off the RAW local day so today counts neutrally: unchecked current-day
  // tasks never drag the confirmed score, completing one raises it live.
  const rawDay = getRawDayNumber();
  const score = computeChallengeScore(allDays, profiles, activeProfile, rawDay);
  const cfg = getPassingConfig(meta);

  // Daily change feedback — meaningful updates only (crossing the passing line,
  // or a notable score move). Auto-hides; never spams low-value actions.
  useEffect(() => {
    if (!score) { prevScoreRef.current = null; return; }
    const cur = score.score;
    const prev = prevScoreRef.current;
    if (prev != null && prev !== cur) {
      const pass = cfg.passingScore;
      let msg = null;
      if (prev < pass && cur >= pass) msg = 'You are now above the passing line.';
      else if (prev >= pass && cur < pass) msg = `You are currently below the ${pass}% passing line. There is still time to recover.`;
      else if (Math.abs(cur - prev) >= 2) msg = `Challenge Score ${cur > prev ? 'increased' : 'changed'} from ${prev}% to ${cur}%.`;
      if (msg) setFeedback({ key: Date.now(), text: msg });
    }
    prevScoreRef.current = cur;
  }, [score?.score, cfg.passingScore]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 4500);
    return () => clearTimeout(t);
  }, [feedback]);

  // Only scorable active challenges (fixed-duration, not the Forge Daily baseline).
  if (isForgeDaily() || !score) return null;

  const status = getPerformanceStatus(score.score);
  const color = STATUS_COLOR[status.key];
  const abovePassing = score.score >= cfg.passingScore;
  const keystoneShort = score.keystoneCount > 0 && abovePassing && score.keystoneAdherence < cfg.keystoneRequirement;
  const passed = isChallengePassed(score, meta);
  const projection = projectFinalScore(score, meta);

  const tasks = profile?.tasks || [];
  const todayData = (allDays[activeProfile] || {})[dayNum];
  const todayReq = dailyRequired(todayData, tasks);
  const todayBonus = getBonusXP(todayData);
  const breakdown = expanded ? computeTaskBreakdown(allDays, profiles, activeProfile, rawDay) : [];

  // "Building" — the very first day, before any day has finalised and before
  // anything is completed today. There is no confirmed score to show yet.
  const building = !score.hasConfirmed && score.requiredEarned === 0;
  // Today is still in progress if there's an active current day with tasks left.
  const todayInProgress = score.inProgressDay != null && todayReq.pct < 100;

  const statusLine = building
    ? 'Your Challenge Score will appear as you complete tasks and finish days.'
    : keystoneShort
      ? 'Passing score reached, but Keystone requirement not met.'
      : status.message;

  return (
    <div className="perf-card">
      <div className="perf-head">
        <span className="perf-title">⚔️ Challenge Performance</span>
        <span className="perf-status-badge" style={{ color, borderColor: color }}>
          {keystoneShort ? 'Keystone Needed' : status.label}
        </span>
      </div>

      <div className="perf-main">
        <ScoreRing score={score.score} passing={cfg.passingScore} color={color} />
        <div className="perf-main-info">
          <div className="perf-row"><span>Current Score</span><strong style={{ color }}>{building ? '—' : `${score.score}%`}</strong></div>
          <div className="perf-row"><span>Passing Score</span><strong>{cfg.passingScore}%</strong></div>
          <div className="perf-passbar">
            <div className="perf-passbar-track">
              <div className="perf-passbar-fill" style={{ width: `${Math.min(100, score.score)}%`, background: color }} />
              <div className="perf-passbar-mark" style={{ left: `${cfg.passingScore}%` }} title={`Passing ${cfg.passingScore}%`} />
            </div>
          </div>
          <div className="perf-statusmsg">{statusLine}</div>
        </div>
      </div>

      {todayInProgress && !building && (
        <div className="perf-inprogress">
          Today is still in progress. This is your confirmed score so far — complete
          high-value tasks to strengthen it. Unchecked tasks today are not counted against you yet.
        </div>
      )}

      {feedback && <div key={feedback.key} className="perf-feedback">{feedback.text}</div>}

      {projection && projection.insufficient && (
        <div className="perf-projection">
          <div className="perf-proj-row">
            <span>📊 Projected Final Score <em>(estimate)</em></span>
          </div>
          <div className="perf-proj-guide">Projection will update as more days are completed.</div>
        </div>
      )}

      {projection && !projection.insufficient && (
        <div className="perf-projection">
          <div className="perf-proj-row">
            <span>📊 Projected Final Score <em>(estimate)</em></span>
            <strong>{projection.projected}%</strong>
          </div>
          <div className="perf-proj-result">
            {projection.willPass
              ? 'Projected Result: Pass'
              : 'Projected Result: Completion Bonus currently at risk'}
          </div>
          {projection.remainingDays > 0 && projection.needRemaining > 0 && (
            <div className="perf-proj-guide">
              Estimate: to finish at {cfg.passingScore}%, earn at least {projection.needRemaining.toLocaleString()} of
              the remaining {projection.remainingAvailable.toLocaleString()} required XP.
            </div>
          )}
        </div>
      )}

      <button className="perf-expand-btn" onClick={() => setExpanded(v => !v)}>
        {expanded ? '▲ Hide breakdown' : '▼ Performance breakdown'}
      </button>

      {expanded && (
        <div className="perf-breakdown">
          <div className="perf-grid">
            <div className="perf-cell"><span>Required XP earned</span><strong>{score.requiredEarned.toLocaleString()}</strong></div>
            <div className="perf-cell"><span>Required XP available</span><strong>{score.requiredAvailable.toLocaleString()}</strong></div>
            <div className="perf-cell"><span>Keystone adherence</span><strong>{score.keystoneAdherence}% <em>(need {cfg.keystoneRequirement}%)</em></strong></div>
            <div className="perf-cell"><span>Completed days</span><strong>{score.completedDays}</strong></div>
            <div className="perf-cell"><span>Missed days</span><strong>{score.missedDays}</strong></div>
            <div className="perf-cell"><span>Bonus XP (separate)</span><strong className="perf-bonus">+{(Object.values(allDays[activeProfile] || {}).reduce((s, d) => s + getBonusXP(d), 0)).toLocaleString()}</strong></div>
          </div>

          {/* Today's performance */}
          <div className="perf-today">
            <div className="perf-subhead">Today&apos;s Performance</div>
            <div className="perf-row"><span>Daily Score</span><strong>{todayReq.pct}%</strong></div>
            <div className="perf-row"><span>Challenge Score</span><strong>{score.score}%</strong></div>
            <div className="perf-row"><span>Passing Score</span><strong>{cfg.passingScore}%</strong></div>
            <div className="perf-row"><span>Bonus XP earned today</span><strong className="perf-bonus">+{todayBonus}</strong></div>
            <div className="perf-note">Bonus XP does not affect your Daily or Challenge Score.</div>
          </div>

          {/* Per-task breakdown */}
          <div className="perf-subhead">Performance by task</div>
          <div className="perf-tasklist">
            {breakdown.map(t => {
              const ts = getPerformanceStatus(t.pct);
              return (
                <div key={t.id} className="perf-task-row">
                  <div className="perf-task-name">{t.name}{t.keystone > 0 && <span className="perf-ks">{'⭐'.repeat(t.keystone)}</span>}</div>
                  <div className="perf-task-meta">
                    <span className="perf-task-count">{t.done} of {t.total}</span>
                    <span className="perf-task-pct" style={{ color: STATUS_COLOR[ts.key] }}>{t.pct}%</span>
                    <span className="perf-task-tier" style={{ color: STATUS_COLOR[ts.key] }}>{ts.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {setView && (
            <button className="btn btn-ghost perf-today-link" onClick={() => setView('today')}>Log Today →</button>
          )}
        </div>
      )}
    </div>
  );
}
