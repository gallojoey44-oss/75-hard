import { useState } from 'react';
import { useApp } from '../context/AppContext';
import BuildBanner from './BuildBanner';
import { formatDateShort } from '../utils/dateUtils';

const CHALLENGE_TEMPLATES = [
  {
    id: '75_discipline',
    name: '75-Day Discipline Challenge',
    emoji: '🔥',
    duration: 75,
    focus: ['Workout', 'Diet', 'Mental', 'Sleep', 'Reading', 'Water'],
    description: 'The full 75-day discipline system. No rest days, complete adherence, total mental and physical transformation.',
    intensity: 'High',
    available: true,
  },
  {
    id: 'sleep_reset',
    name: 'Sleep Reset Challenge',
    emoji: '😴',
    duration: 14,
    focus: ['Sleep', 'Recovery', 'Wind-down', 'Stress'],
    description: 'Two weeks of consistent sleep hygiene. Hit your sleep target every night and rebuild your energy foundation.',
    intensity: 'Low',
    available: false,
  },
  {
    id: 'fat_loss',
    name: 'Fat Loss Phase',
    emoji: '⚡',
    duration: 30,
    focus: ['Diet', 'Workout', 'Steps', 'Water'],
    description: 'A focused 30-day fat loss phase. Clean eating, daily movement, calorie awareness, and consistent effort.',
    intensity: 'Medium',
    available: false,
  },
  {
    id: 'strength',
    name: 'Strength Phase',
    emoji: '💪',
    duration: 30,
    focus: ['Workout', 'Protein', 'Sleep', 'Recovery'],
    description: 'Build strength over 30 days. Prioritize progressive overload, protein intake, and quality recovery.',
    intensity: 'High',
    available: false,
  },
  {
    id: 'mental_training',
    name: 'Mental Training Phase',
    emoji: '🧠',
    duration: 21,
    focus: ['Meditation', 'Journaling', 'Breathwork', 'Visualization'],
    description: 'Three weeks of daily mental training. Build focus, resilience, and self-awareness from the inside out.',
    intensity: 'Low',
    available: false,
  },
  {
    id: 'recovery',
    name: 'Recovery Phase',
    emoji: '🔋',
    duration: 14,
    focus: ['Sleep', 'Stress', 'Active Rest', 'Nutrition'],
    description: 'Two weeks of intentional recovery. Reduce stress, improve sleep quality, and rebuild your baseline wellness.',
    intensity: 'Low',
    available: false,
  },
  {
    id: 'custom',
    name: 'Custom Challenge',
    emoji: '🎯',
    duration: null,
    focus: ['Your tasks', 'Your goals'],
    description: 'Build your own challenge with custom tasks, a custom duration, and your own completion rules.',
    intensity: 'Custom',
    available: false,
  },
];

const INTENSITY_COLOR = {
  Low:    '#10B981',
  Medium: '#F59E0B',
  High:   '#EF4444',
  Custom: '#8B5CF6',
};

function ChallengeCard({ template, isActive, onStart, setView }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`challenge-card${isActive ? ' active' : ''}${!template.available ? ' unavailable' : ''}`}>
      <button
        className="challenge-card-header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="challenge-card-emoji">{template.emoji}</span>
        <div className="challenge-card-info">
          <div className="challenge-card-name">{template.name}</div>
          <div className="challenge-card-meta">
            {template.duration ? `${template.duration} days` : 'Custom'}
            {' · '}
            <span style={{ color: INTENSITY_COLOR[template.intensity] }}>
              {template.intensity}
            </span>
          </div>
        </div>
        <div className="challenge-card-badges">
          {isActive && <span className="challenge-active-badge">Active</span>}
          {!template.available && !isActive && <span className="challenge-soon-badge">Soon</span>}
          <span className="challenge-expand-icon">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="challenge-card-body">
          <p className="challenge-card-desc">{template.description}</p>
          <div className="challenge-focus-chips">
            {template.focus.map(f => (
              <span key={f} className="challenge-focus-chip">{f}</span>
            ))}
          </div>
          {isActive && (
            <button className="btn btn-ghost challenge-card-action" onClick={() => setView('today')}>
              Log Today →
            </button>
          )}
          {!isActive && template.available && (
            <button className="btn btn-primary challenge-card-action" onClick={onStart}>
              Start Challenge
            </button>
          )}
          {!isActive && !template.available && template.id === 'custom' && (
            <p className="challenge-soon-note">
              Custom challenges can be built in Settings — add your own tasks, set your own goals.
            </p>
          )}
          {!isActive && !template.available && template.id !== 'custom' && (
            <p className="challenge-soon-note">
              Coming soon. In the meantime, you can run this focus using custom tasks in Settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChallengesView({ setView }) {
  const {
    profile, getDayNumber, getDayCompletion,
    getStreak, getLongestStreak,
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

        {/* Template list */}
        <div className="challenges-section-title">All Challenges</div>
        <div className="challenges-list">
          {CHALLENGE_TEMPLATES.map(t => (
            <ChallengeCard
              key={t.id}
              template={t}
              isActive={isRunning && t.id === '75_discipline'}
              setView={setView}
              onStart={() => {
                if (t.id === '75_discipline') {
                  if (isRunning) return;
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
