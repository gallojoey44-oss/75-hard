import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getTodayStr } from '../utils/dateUtils';
import { HABIT_LIBRARY, getHabit } from '../data/habitLibrary';
import { computeAverages, generateSuggestions, assessExperiment, getCoachMessage, getPriorityBottleneck } from '../utils/insightsUtils';
import { detectSetback } from '../utils/gamification';
import BuildBanner from './BuildBanner';

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function CoachMessage({ msg }) {
  const style = {
    success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '✅', color: '#10B981' },
    warn:    { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '⚡', color: '#F59E0B' },
    info:    { bg: 'var(--card2)',          border: 'var(--border)',         icon: 'ℹ️', color: 'var(--text2)' },
  }[msg.type] || {};

  return (
    <div className="ins-coach-card" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <span className="ins-coach-icon">{style.icon}</span>
      <span className="ins-coach-text" style={{ color: style.color }}>{msg.text}</span>
    </div>
  );
}

function PriorityBottleneckCard({ bottleneck }) {
  if (!bottleneck?.bottleneck) return null;
  const isSleep = bottleneck.bottleneck === 'sleep_duration' || bottleneck.bottleneck === 'sleep_quality';
  return (
    <div className={`bottleneck-card${isSleep ? ' sleep' : ''}`}>
      <div className="bottleneck-header">
        <span className="bottleneck-emoji">{bottleneck.emoji}</span>
        <div>
          <div className="bottleneck-title">Priority Bottleneck</div>
          <div className="bottleneck-label">{bottleneck.label}</div>
        </div>
      </div>
      <div className="bottleneck-msg">{bottleneck.coachMsg}</div>
      {bottleneck.primary.length > 0 && (
        <div>
          <div className="bottleneck-habits-label">Start with</div>
          <div className="bottleneck-chips">
            {bottleneck.primary.map(id => {
              const h = getHabit(id);
              return h ? <span key={id} className="bottleneck-chip">{h.emoji} {h.name}</span> : null;
            })}
          </div>
        </div>
      )}
      {bottleneck.secondary.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="bottleneck-habits-label">Also consider</div>
          <div className="bottleneck-chips">
            {bottleneck.secondary.map(id => {
              const h = getHabit(id);
              return h ? <span key={id} className="bottleneck-chip secondary">{h.emoji} {h.name}</span> : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, hasData, warn }) {
  return (
    <div className="ins-metric-cell">
      <div className={`ins-metric-value${warn ? ' warn' : ''}`}>
        {hasData ? value : '—'}
      </div>
      <div className="ins-metric-label">{label}</div>
      {warn && hasData && <div className="ins-metric-warn-dot" />}
    </div>
  );
}

function RatingBar({ value, max = 10, invertWarn = false }) {
  if (!value) return null;
  const pct  = Math.round((value / max) * 100);
  const warn = invertWarn ? value >= 7 : value < 6;
  return (
    <div className="ins-bar-track">
      <div className={`ins-bar-fill${warn ? ' warn' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MetricBarRow({ label, value, hasData, invertWarn = false }) {
  return (
    <div className="ins-bar-row">
      <span className="ins-bar-label">{label}</span>
      {hasData ? (
        <>
          <RatingBar value={value} invertWarn={invertWarn} />
          <span className="ins-bar-val">{value}</span>
        </>
      ) : (
        <span className="ins-no-data">No data yet</span>
      )}
    </div>
  );
}

function SummaryCard({ avg, label }) {
  if (avg.daysLogged === 0) return null;
  return (
    <div className="ins-summary-card">
      <div className="ins-summary-header">
        <span className="ins-summary-label">{label}</span>
        <span className="ins-summary-days">{avg.daysLogged} days logged</span>
      </div>

      <div className="ins-metric-grid">
        <MetricCell label="Completion"  value={`${avg.completion}%`}  hasData={avg.daysLogged > 0}   warn={avg.completion < 60} />
        <MetricCell label="Energy"      value={avg.energy}            hasData={avg.hasEnergyData}    warn={avg.hasEnergyData   && avg.energy     < 6} />
        <MetricCell label="Sleep"       value={avg.sleep}             hasData={avg.hasSleepData}     warn={avg.hasSleepData    && avg.sleep      < 6} />
        <MetricCell label="Mood"        value={avg.mood}              hasData={avg.hasMoodData}      warn={avg.hasMoodData     && avg.mood       < 6} />
        <MetricCell label="Confidence"  value={avg.confidence}        hasData={avg.hasConfData}      warn={avg.hasConfData     && avg.confidence < 6} />
        <MetricCell label="Recovery"    value={avg.recovery}          hasData={avg.hasRecoveryData}  warn={avg.hasRecoveryData && avg.recovery   < 6} />
        <MetricCell label="Wkt Effort"  value={avg.workoutEffort}     hasData={avg.hasEffortData}    warn={false} />
        <MetricCell label="Stress"      value={avg.stress}            hasData={avg.hasStressData}    warn={avg.hasStressData   && avg.stress    >= 7} />
      </div>

      <MetricBarRow label="Energy"      value={avg.energy}        hasData={avg.hasEnergyData} />
      <MetricBarRow label="Sleep"       value={avg.sleep}         hasData={avg.hasSleepData} />
      <MetricBarRow label="Mood"        value={avg.mood}          hasData={avg.hasMoodData} />
      <MetricBarRow label="Confidence"  value={avg.confidence}    hasData={avg.hasConfData} />
      <MetricBarRow label="Recovery"    value={avg.recovery}      hasData={avg.hasRecoveryData} />
      <MetricBarRow label="Wkt Effort"  value={avg.workoutEffort} hasData={avg.hasEffortData} />
      <MetricBarRow label="Stress"      value={avg.stress}        hasData={avg.hasStressData} invertWarn />
    </div>
  );
}

const EVIDENCE_COLOR = { strong: '#10B981', moderate: '#F59E0B', anecdotal: '#9090B8' };
const DIFF_COLOR     = { easy: '#10B981',   medium: '#F59E0B',   hard: '#EF4444' };

function SuggestionCard({ suggestion, onStart, onAddTask, onDismiss }) {
  const habit = getHabit(suggestion.habitId);
  const [showReason, setShowReason] = useState(false);
  if (!habit) return null;

  return (
    <div className="ins-suggest-card">
      {/* Metric noticed */}
      <div className="ins-suggest-pattern">
        <span className="ins-suggest-pattern-icon">📊</span>
        <div>
          <div className="ins-suggest-pattern-label">METRIC NOTICED</div>
          <div>{suggestion.pattern}</div>
        </div>
      </div>

      {/* Coach recommendation */}
      <div className="ins-suggest-message">{suggestion.message}</div>

      {/* Habit block */}
      <div className="ins-suggest-habit">
        <div className="ins-suggest-habit-header">
          <span className="ins-suggest-habit-emoji">{habit.emoji}</span>
          <div>
            <div className="ins-suggest-habit-name">Try: {habit.name}</div>
            <div className="ins-suggest-source">Source: {habit.source}</div>
          </div>
        </div>

        <div className="ins-suggest-meta">
          <span className="ins-meta-chip" style={{ color: EVIDENCE_COLOR[habit.evidenceLevel] }}>
            📊 {habit.evidenceLevel}
          </span>
          <span className="ins-meta-chip">🛡 {habit.riskLevel} risk</span>
          <span className="ins-meta-chip" style={{ color: DIFF_COLOR[habit.difficulty] }}>
            ⚡ {habit.difficulty}
          </span>
          <span className="ins-meta-chip">📅 {habit.trialDays} days</span>
        </div>

        {/* Daily task + trial length */}
        <div className="ins-suggest-task">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="ins-suggest-task-label">DAILY TASK</span>
            <span className="ins-suggest-task-trial">📅 {habit.trialDays}-day trial</span>
          </div>
          <span>{habit.task}</span>
        </div>

        {/* Why this habit helps */}
        <div className="ins-suggest-why">
          <span className="ins-suggest-why-label">WHY IT MAY HELP</span>
          <span>{habit.why}</span>
        </div>

        {/* Why am I seeing this? (data-driven, collapsible) */}
        <button
          className="ins-reason-toggle"
          onClick={() => setShowReason(v => !v)}
          aria-expanded={showReason}
        >
          <span className="ins-reason-toggle-arrow">{showReason ? '▲' : '▼'}</span>
          Why am I seeing this?
        </button>
        {showReason && (
          <div className="ins-reason-body">{suggestion.reason}</div>
        )}

        {habit.safetyNote && (
          <div className="ins-safety-note">ℹ️ {habit.safetyNote}</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="ins-suggest-actions">
        <button className="btn btn-primary ins-action-btn" onClick={onStart}>
          Start 7-Day Experiment
        </button>
        <div className="ins-suggest-actions-row2">
          <button className="btn btn-ghost ins-action-btn-sm" onClick={onAddTask}>
            + Add to Daily Tasks
          </button>
          <button className="btn btn-ghost ins-action-btn-sm" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function ExperimentCard({ experiment, currentDayNum, onRemove }) {
  const habit = getHabit(experiment.habitId);
  if (!habit) return null;

  const { startDayNum, endDayNum, status, baseline, result } = experiment;

  if (status === 'active') {
    const elapsed = Math.min(Math.max(currentDayNum - startDayNum + 1, 0), 7);
    const pct     = Math.round((elapsed / 7) * 100);

    return (
      <div className="ins-exp-card">
        <div className="ins-exp-header">
          <span className="ins-exp-emoji">{habit.emoji}</span>
          <div className="ins-exp-info">
            <div className="ins-exp-name">{habit.name}</div>
            <div className="ins-exp-day">Day {Math.min(elapsed, 7)} of 7</div>
          </div>
          <button className="btn btn-ghost ins-exp-remove" onClick={onRemove} title="Remove experiment">✕</button>
        </div>
        <div className="ins-exp-bar-wrap">
          <div className="ins-exp-bar-track">
            <div className="ins-exp-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="ins-exp-pct">{pct}%</span>
        </div>
      </div>
    );
  }

  if (status === 'completed' && result) {
    const assessment = assessExperiment(baseline, result);
    if (!assessment) return null;

    const verdictClass = {
      helped:    'helped',
      possibly:  'possible',
      no_effect: 'neutral',
      unclear:   'neutral',
    }[assessment.verdict] || 'neutral';

    return (
      <div className="ins-exp-card completed">
        <div className="ins-exp-header">
          <span className="ins-exp-emoji">{habit.emoji}</span>
          <div className="ins-exp-info">
            <div className="ins-exp-name">{habit.name}</div>
            <div className="ins-exp-day">Days {startDayNum}–{endDayNum} · Complete</div>
          </div>
        </div>
        <div className="ins-result-table">
          {assessment.deltas.map(d => {
            // For stress, lower is better — flip color coding
            const invert = d.key === 'stress';
            const deltaClass = d.delta > 0.3
              ? (invert ? 'down' : 'up')
              : d.delta < -0.3
                ? (invert ? 'up' : 'down')
                : 'flat';
            return (
              <div key={d.key} className="ins-result-row">
                <span className="ins-result-label">{d.label}</span>
                <span className="ins-result-before">{d.before}</span>
                <span className="ins-result-arrow">→</span>
                <span className="ins-result-after">{d.after}</span>
                <span className={`ins-result-delta ${deltaClass}`}>
                  {d.delta > 0 ? '+' : ''}{d.delta}
                </span>
              </div>
            );
          })}
        </div>
        <div className={`ins-verdict ${verdictClass}`}>{assessment.verdictText}</div>
      </div>
    );
  }

  return null;
}

function SetbackInsightCard({ setback, comebackMode, onStartComeback }) {
  if (!setback.hasSetback) return null;

  const isComeback = comebackMode?.active;

  const recs = [
    { icon: '🛡️', label: 'Minimum Warrior Day', desc: 'On overwhelming days, do just the 6 MWD tasks. Chain stays alive.' },
    { icon: '↩️', label: 'Comeback Mode', desc: 'A 3-day plan back to full pace. No reset, no shame.' },
    { icon: '💨', label: 'Physiological Sigh', desc: '30-second stress reset. Double inhale, long exhale. Works immediately.' },
    { icon: '🧘', label: 'NSDR / Recovery Rest', desc: '10–20 min rest in the afternoon. Nervous system recovery.' },
    { icon: '🎯', label: 'Micro-commitment', desc: 'One small daily promise, kept without exception. Identity rebuilds from here.' },
  ];

  return (
    <div className="setback-card">
      <div className="setback-header">
        <span className="setback-icon">📉</span>
        <div>
          <div className="setback-title">Pattern noticed</div>
          <div className="setback-sub">
            {setback.incompleteDays} of the last 7 days had low completion.
          </div>
        </div>
      </div>
      <p className="setback-body">
        You&apos;re not broken. You&apos;re collecting data. Difficult stretches are part of every long challenge — the question is what you do next.
      </p>
      <div className="setback-recs">
        {recs.map((r, i) => (
          <div key={i} className="setback-rec-row">
            <span className="setback-rec-icon">{r.icon}</span>
            <div>
              <div className="setback-rec-label">{r.label}</div>
              <div className="setback-rec-desc">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
      {!isComeback && (
        <button className="btn btn-primary setback-comeback-btn" onClick={onStartComeback}>
          ↩️ Start Comeback Mode
        </button>
      )}
      {isComeback && (
        <div className="setback-comeback-active">↩️ Comeback Mode is active — keep going.</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────

export default function InsightsView() {
  const {
    activeProfile, profile, allDays,
    getDayNumber, addTask, getDayCompletion,
    experiments, updateExperiment, startExperiment,
    dismissHint, dismissedHints,
    startComeback,
  } = useApp();

  const [recalcKey, setRecalcKey] = useState(0);
  const [recalcFlash, setRecalcFlash] = useState(false);

  const dayNum     = getDayNumber();
  const days       = allDays[activeProfile] || {};
  const tasks      = profile?.tasks || [];
  const isJoey     = activeProfile === 'me';
  const today      = getTodayStr();
  const sleepTarget = profile?.sleepTarget ?? 8;

  const last7  = dayNum ? Array.from({ length: 7  }, (_, i) => dayNum - i).filter(n => n >= 1) : [];
  const last14 = dayNum ? Array.from({ length: 14 }, (_, i) => dayNum - i).filter(n => n >= 1) : [];

  // recalcKey forces recompute when the button is pressed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const avg7  = computeAverages(last7,  days, tasks);
  const avg14 = computeAverages(last14, days, tasks);

  const profileExps = experiments[activeProfile] || [];
  const profileDism = dismissedHints[activeProfile] || {};

  const activeExps    = profileExps.filter(e => e.status === 'active');
  const completedExps = profileExps.filter(e => e.status === 'completed');
  const activeHabits  = activeExps.map(e => e.habitId);

  const dismissedIds = Object.entries(profileDism)
    .filter(([, expiry]) => expiry >= today)
    .map(([id]) => id);

  const suggestions  = generateSuggestions(avg7, activeHabits, dismissedIds, sleepTarget);
  const coachMsg     = getCoachMessage(avg7, sleepTarget);
  const bottleneck   = getPriorityBottleneck(avg7, sleepTarget);
  const setback      = dayNum ? detectSetback(allDays, activeProfile, getDayCompletion, dayNum) : { hasSetback: false };
  const comebackMode = profile?.comebackMode || {};

  // Auto-complete experiments that have passed their endDayNum
  useEffect(() => {
    if (!dayNum) return;
    for (const exp of activeExps) {
      if (dayNum > exp.endDayNum) {
        const resultNums = Array.from({ length: 7 }, (_, i) => exp.startDayNum + i);
        const result = computeAverages(resultNums, days, tasks);
        updateExperiment(exp.id, { status: 'completed', result });
      }
    }
  }, [dayNum]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRecalc() {
    setRecalcKey(k => k + 1);
    setRecalcFlash(true);
    setTimeout(() => setRecalcFlash(false), 1000);
  }

  function handleStartExperiment(habitId) {
    if (!dayNum) return;
    startExperiment(habitId, getHabit(habitId)?.name || habitId, last7, dayNum);
  }

  function handleAddTask(habitId) {
    const habit = getHabit(habitId);
    if (!habit) return;
    const taskName = habit.name.length > 40 ? habit.name.slice(0, 40) : habit.name;
    addTask(isJoey
      ? { name: taskName, icon: habit.emoji }
      : { name: taskName, color: '#A78BFA' }
    );
  }

  // ── Empty states ──────────────────────────────────────────────────────────

  if (!profile?.challengeStart) {
    return (
      <div className="insights-view">
        <BuildBanner />
        <div className="page-header"><h2>🔍 Insights</h2></div>
        <div className="ins-empty">
          <div className="ins-empty-icon">📊</div>
          <h3>Start your challenge first</h3>
          <p>Go to Home and start your 75-day challenge to begin tracking insights.</p>
        </div>
      </div>
    );
  }

  if (avg7.daysLogged < 3) {
    return (
      <div className="insights-view">
        <BuildBanner />
        <div className="page-header"><h2>🔍 Insights</h2></div>
        <div className="ins-empty">
          <div className="ins-empty-icon">📈</div>
          <h3>Building your baseline</h3>
          <p>Keep logging your daily ratings for at least 3 days — insights will appear once there's enough data to spot patterns.</p>
          <div className="ins-progress-hint">{avg7.daysLogged} / 3 days with data</div>
        </div>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <div className="insights-view" key={recalcKey}>
      <BuildBanner />
      <div className="page-header">
        <h2>🔍 Insights</h2>
        <button
          className={`btn btn-ghost ins-recalc-btn${recalcFlash ? ' flash' : ''}`}
          onClick={handleRecalc}
        >
          {recalcFlash ? '✓ Updated' : '↻ Recalculate'}
        </button>
      </div>

      <div className="ins-content">

        {/* 1. Priority bottleneck */}
        <PriorityBottleneckCard bottleneck={bottleneck} />

        {/* Setback insight */}
        <SetbackInsightCard
          setback={setback}
          comebackMode={comebackMode}
          onStartComeback={() => dayNum && startComeback(dayNum)}
        />

        {/* 2. Coach message */}
        <CoachMessage msg={coachMsg} />

        {/* 2. Weekly summary */}
        <SummaryCard avg={avg7} label="📊 Last 7 Days" />

        {avg14.daysLogged >= 10 && (
          <details className="ins-details">
            <summary className="ins-details-summary">📊 Last 14 Days</summary>
            <div style={{ padding: '0 0 12px' }}>
              <SummaryCard avg={avg14} label="Last 14 Days" />
            </div>
          </details>
        )}

        {/* 3. Recommended Tasks */}
        {suggestions.length > 0 && (
          <div className="ins-section">
            <div className="ins-section-title">💡 Recommended Tasks</div>
            <p className="ins-section-sub">
              Based on your last 7 days. Add to your daily checklist or run a 7-day experiment, then come back to compare.
            </p>
            {suggestions.map(s => (
              <SuggestionCard
                key={s.habitId}
                suggestion={s}
                onStart={() => handleStartExperiment(s.habitId)}
                onAddTask={() => handleAddTask(s.habitId)}
                onDismiss={() => dismissHint(s.habitId)}
              />
            ))}
          </div>
        )}

        {suggestions.length === 0 && avg7.daysLogged >= 5 && (
          <div className="ins-all-good">
            <div className="ins-all-good-icon">✅</div>
            <p>No patterns to flag right now. Keep logging daily ratings for ongoing tracking.</p>
          </div>
        )}

        {/* 4. Currently Testing */}
        {activeExps.length > 0 && (
          <div className="ins-section">
            <div className="ins-section-title">🧪 Currently Testing</div>
            {activeExps.map(exp => (
              <ExperimentCard
                key={exp.id}
                experiment={exp}
                currentDayNum={dayNum}
                days={days}
                tasks={tasks}
                onRemove={() => updateExperiment(exp.id, { status: 'dismissed' })}
              />
            ))}
          </div>
        )}

        {/* Past experiments */}
        {completedExps.length > 0 && (
          <div className="ins-section">
            <div className="ins-section-title">📋 Past Experiments</div>
            {completedExps.map(exp => (
              <ExperimentCard
                key={exp.id}
                experiment={exp}
                currentDayNum={dayNum}
                days={days}
                tasks={tasks}
                onRemove={() => {}}
              />
            ))}
          </div>
        )}

        {/* 5. Full Habit Library */}
        <details className="ins-details">
          <summary className="ins-details-summary">📚 Full Habit Library ({HABIT_LIBRARY.length} habits)</summary>
          <div className="ins-library">
            {HABIT_LIBRARY.map(h => (
              <div key={h.id} className="ins-library-row">
                <span className="ins-library-emoji">{h.emoji}</span>
                <div className="ins-library-info">
                  <div className="ins-library-name">{h.name}</div>
                  <div className="ins-library-meta">
                    {h.source} · {h.evidenceLevel} evidence · {h.riskLevel} risk
                  </div>
                </div>
                <button
                  className="btn btn-ghost ins-library-add"
                  onClick={() => handleAddTask(h.id)}
                  title="Add to daily tasks"
                >
                  + Task
                </button>
              </div>
            ))}
          </div>
        </details>

        {/* Disclaimer */}
        <div className="ins-disclaimer">
          These are creator-informed experiments, not medical advice. Always consult a qualified health professional before making significant changes to your diet, exercise, or health routine.
        </div>
      </div>
    </div>
  );
}
