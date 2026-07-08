import { useState } from 'react';
import { useApp } from '../context/AppContext';
import BuildBanner from './BuildBanner';
import { CHALLENGE_TEMPLATES, METRIC_LABELS } from '../data/challengeTemplates';

const EVIDENCE_COLOR = {
  strong:       '#10B981',
  moderate:     '#F59E0B',
  anecdotal:    '#9090B8',
  user_defined: '#8B5CF6',
};
const RISK_COLOR = {
  low:          '#10B981',
  medium:       '#F59E0B',
  high:         '#EF4444',
  user_defined: '#8B5CF6',
};
const LEVEL_LABEL = { user_defined: 'You decide' };

const VARIANT_TABS = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'standard', label: 'Standard' },
  { key: 'hard',     label: 'Hard' },
];

function levelText(v) {
  return LEVEL_LABEL[v] || v;
}

function durationText(days) {
  if (!days?.length) return '';
  if (days.length === 1) return `${days[0]} days`;
  if (days.length === 2) return `${days[0]} or ${days[1]} days`;
  return `${days.slice(0, -1).join(', ')}, or ${days[days.length - 1]} days`;
}

function VariantPanel({ variant }) {
  if (!variant) return null;
  return (
    <div className="tpl-variant-panel">
      <div className="tpl-variant-section-label">Daily tasks</div>
      <ul className="tpl-task-list">
        {variant.required_daily_tasks.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      {variant.optional_tasks?.length > 0 && (
        <>
          <div className="tpl-variant-section-label">Optional</div>
          <ul className="tpl-task-list optional">
            {variant.optional_tasks.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ChallengeCard({ template, isActive, onStart, setView }) {
  const [expanded, setExpanded] = useState(false);
  const [variantTab, setVariantTab] = useState('standard');

  return (
    <div className={`challenge-card${isActive ? ' active' : ''}`}>
      <button
        className="challenge-card-header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="challenge-card-emoji">{template.emoji}</span>
        <div className="challenge-card-info">
          <div className="challenge-card-name">{template.challenge_name}</div>
          <div className="challenge-card-meta">
            {durationText(template.duration_options_days)}
            {' · '}
            <span style={{ color: EVIDENCE_COLOR[template.evidence_level] }}>
              {levelText(template.evidence_level)} evidence
            </span>
            {' · '}
            <span style={{ color: RISK_COLOR[template.risk_level] }}>
              {levelText(template.risk_level)} risk
            </span>
          </div>
        </div>
        <div className="challenge-card-badges">
          {isActive && <span className="challenge-active-badge">Active</span>}
          <span className="challenge-expand-icon">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="challenge-card-body">
          <p className="challenge-card-desc">{template.purpose}</p>

          <div className="tpl-detail-row">
            <span className="tpl-detail-label">Duration</span>
            <div className="tpl-chip-group">
              {template.duration_options_days.map(d => (
                <span key={d} className="challenge-focus-chip">{d} days</span>
              ))}
            </div>
          </div>

          <div className="tpl-detail-row">
            <span className="tpl-detail-label">Targets</span>
            <div className="tpl-chip-group">
              {template.metrics_targeted.map(m => (
                <span key={m} className="challenge-focus-chip">{METRIC_LABELS[m] || m}</span>
              ))}
            </div>
          </div>

          <div className="tpl-detail-row">
            <span className="tpl-detail-label">Evidence</span>
            <span className="tpl-level-value" style={{ color: EVIDENCE_COLOR[template.evidence_level] }}>
              {levelText(template.evidence_level)}
            </span>
            <span className="tpl-detail-label" style={{ marginLeft: 14 }}>Risk</span>
            <span className="tpl-level-value" style={{ color: RISK_COLOR[template.risk_level] }}>
              {levelText(template.risk_level)}
            </span>
          </div>

          {/* Variant tabs */}
          <div className="tpl-variant-tabs">
            {VARIANT_TABS.map(v => (
              <button
                key={v.key}
                className={`tpl-variant-tab${variantTab === v.key ? ' active' : ''}`}
                onClick={() => setVariantTab(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <VariantPanel variant={template.variants[variantTab]} />

          {template.inspiration_sources?.length > 0 && template.inspiration_sources[0] !== 'User-defined' && (
            <div className="tpl-sources">Informed by: {template.inspiration_sources.join(', ')}</div>
          )}

          {isActive && (
            <button className="btn btn-ghost challenge-card-action" onClick={() => setView('today')}>
              Log Today →
            </button>
          )}
          {!isActive && template.startable && (
            <button className="btn btn-primary challenge-card-action" onClick={onStart}>
              Start Challenge
            </button>
          )}
          {!isActive && !template.startable && (
            <div className="tpl-ready-note">Template ready — start flow coming next.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChallengesView({ setView }) {
  const {
    profile, getDayNumber, getDayCompletion,
    getStreak,
    startChallenge,
  } = useApp();

  const [showStartConfirm, setShowStartConfirm] = useState(false);

  const dayNum    = getDayNumber();
  const todayPct  = dayNum ? getDayCompletion(dayNum) : 0;
  const streak    = getStreak();
  const isRunning = !!profile?.challengeStart;

  const totalDone = dayNum
    ? Array.from({ length: dayNum }, (_, i) => i + 1).filter(n => getDayCompletion(n) === 100).length
    : 0;

  function handleStart75() {
    startChallenge();
    setShowStartConfirm(false);
    setView('today');
  }

  return (
    <div className="challenges-view">
      <BuildBanner />
      <div className="page-header">
        <h2>🎯 Challenges</h2>
      </div>

      <div className="challenges-content">

        {/* Active challenge summary */}
        {isRunning ? (
          <div className="active-challenge-card">
            <div className="acc-label-row">
              <span className="acc-dot" />
              <span className="acc-label">Active Challenge</span>
            </div>
            <div className="acc-name">🔥 75-Day Discipline Challenge</div>
            <div className="acc-stats-row">
              <div className="acc-stat">
                <div className="acc-stat-value">Day {dayNum}</div>
                <div className="acc-stat-label">of 75</div>
              </div>
              <div className="acc-stat">
                <div className="acc-stat-value">{todayPct}%</div>
                <div className="acc-stat-label">Today</div>
              </div>
              <div className="acc-stat">
                <div className="acc-stat-value">{streak}d</div>
                <div className="acc-stat-label">Streak</div>
              </div>
              <div className="acc-stat">
                <div className="acc-stat-value">{totalDone}</div>
                <div className="acc-stat-label">Perfect</div>
              </div>
            </div>
            <div className="acc-progress-wrap">
              <div className="acc-progress-track">
                <div
                  className="acc-progress-fill"
                  style={{ width: `${((dayNum || 0) / 75) * 100}%` }}
                />
              </div>
              <span className="acc-progress-label">{Math.round(((dayNum || 0) / 75) * 100)}% complete</span>
            </div>
            <div className="acc-actions">
              <button className="btn btn-primary" onClick={() => setView('today')}>Log Today →</button>
              <button className="btn btn-ghost" onClick={() => setView('home')}>Dashboard</button>
            </div>
          </div>
        ) : (
          <div className="no-active-challenge">
            <div className="nac-icon">🎯</div>
            <div className="nac-title">No active challenge</div>
            <p className="nac-body">
              Pick a challenge below to get started. Your daily tasks, XP, and progress will track automatically.
            </p>
          </div>
        )}

        {/* Template library */}
        <div className="challenges-section-title">Challenge Library</div>
        <div className="challenges-list">
          {CHALLENGE_TEMPLATES.map(t => (
            <ChallengeCard
              key={t.id}
              template={t}
              isActive={isRunning && t.id === '75_day_discipline_challenge'}
              setView={setView}
              onStart={() => {
                if (t.id === '75_day_discipline_challenge' && !isRunning) {
                  setShowStartConfirm(true);
                }
              }}
            />
          ))}
        </div>

      </div>

      {/* Start challenge confirmation */}
      {showStartConfirm && (
        <div className="modal-overlay" onClick={() => setShowStartConfirm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Start 75-Day Discipline Challenge?</h3>
            <p>Day 1 begins today. Your daily tasks and progress will be tracked automatically.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowStartConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStart75}>Start Today</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
