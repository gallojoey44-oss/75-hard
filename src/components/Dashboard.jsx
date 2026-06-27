import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateShort, getDateForDayNumber } from '../utils/dateUtils';
import QuoteOfTheDay from './QuoteOfTheDay';
import BuildBanner from './BuildBanner';

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

export default function Dashboard({ setView }) {
  const {
    activeProfile, profile, days,
    getDayNumber, getDayCompletion, getStreak, getLongestStreak,
    startChallenge,
    setActiveProfile,
  } = useApp();

  const [showSwitch, setShowSwitch] = useState(false);

  const dayNum    = getDayNumber();
  const streak    = getStreak();
  const longest   = getLongestStreak();
  const todayPct  = dayNum ? getDayCompletion(dayNum) : 0;
  const totalDone = dayNum
    ? Array.from({ length: dayNum }, (_, i) => i + 1).filter(n => getDayCompletion(n) === 100).length
    : 0;

  const otherProfile = activeProfile === 'me' ? 'girlfriend' : 'me';

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
          <h2>Start Your 75-Day Challenge</h2>
          <p>
            Press the button below to begin. Day 1 starts today and your progress will be saved automatically.
          </p>
          <button className="btn btn-primary btn-full" onClick={() => startChallenge()}>
            Start Challenge
          </button>
        </div>
      </div>
    );
  }

  const isDone = dayNum >= 75;
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
            <p className="text-muted">
              Since {formatDateShort(profile.challengeStart)}
            </p>
          </div>
        </div>
        <button className="dash-switch-btn" onClick={() => setActiveProfile(otherProfile)}>
          Switch
        </button>
      </div>

      {isDone && (
        <div className="challenge-complete">
          <h3>🏆 Challenge Complete!</h3>
          <p>You finished all 75 days. Incredible!</p>
        </div>
      )}

      {showWarning && !isDone && (
        <div className="warn-banner">
          ⚠️ Day {prevDay} wasn't fully completed — you can still edit it in the Calendar.
        </div>
      )}

      {/* Hero Ring */}
      <div className="hero-card">
        <div className="hero-ring-wrap">
          <CircleRing value={dayNum || 0} max={75} size={120} />
          <div className="hero-ring-text">
            <span className="hero-day-num">{isDone ? '75' : (dayNum || '—')}</span>
            <span className="hero-of-75">of 75</span>
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

      {/* 75-day bar */}
      <div className="section-card" style={{ marginBottom: 14 }}>
        <div className="prog-bar-wrap">
          <div className="prog-bar-label">
            <span>Challenge progress</span>
            <span>{totalDone}/{Math.min(dayNum || 0, 75)} perfect days</span>
          </div>
          <div className="prog-bar-track">
            <div className="prog-bar-fill" style={{ width: `${((dayNum || 0) / 75) * 100}%` }} />
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

      {/* Quick actions */}
      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => setView('today')}>
          Log Today →
        </button>
        <button className="btn btn-ghost" onClick={() => setView('calendar')}>
          📅 Calendar
        </button>
      </div>

      {/* Quote of the Day */}
      <QuoteOfTheDay />
    </div>
  );
}
