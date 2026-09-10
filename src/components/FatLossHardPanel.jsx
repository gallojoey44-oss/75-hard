import { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as FLH from '../data/fatLossHardConfig';
import ProgressPhoto from './ProgressPhoto';
import { getDateForDayNumber } from '../utils/dateUtils';

/**
 * ⚡ Fat Loss Hard Mode daily panel.
 *
 * Shows only for a Fat Loss attempt running the Hard variant, so Beginner and
 * Standard attempts are completely unaffected.
 *
 * The photo capture is the first thing on screen (it is a daily requirement that
 * needs an actual interaction), followed by this week's emphasis. Everything
 * else — the fullness technique, cardio structure, safety — is collapsed.
 *
 * All copy comes from fatLossHardConfig; this component holds no challenge
 * constants.
 */
export default function FatLossHardPanel() {
  const { profile, getChallengeMeta, getRawDayNumber, getDayNumber } = useApp();

  const [openFullness, setOpenFullness] = useState(false);
  const [openCardio, setOpenCardio] = useState(false);
  const [openWeeks, setOpenWeeks] = useState(false);
  const [openSafety, setOpenSafety] = useState(false);

  const meta = getChallengeMeta();
  if (!FLH.isFatLossHard(meta)) return null;

  const rawDay = getRawDayNumber();
  if (!rawDay) return null;                    // scheduled, not begun

  const day = getDayNumber();
  const duration = meta.durationDays || FLH.HARD_DURATION_DAYS;
  const week = FLH.weekFor(day);
  const date = getDateForDayNumber(profile?.challengeStart, day);

  return (
    <div className="flh-panel">
      <div className="flh-panel-head">
        <span className="flh-panel-title">{FLH.IDENTITY.emoji} Hard Mode</span>
        <span className="flh-panel-sub">Day {day} of {duration}</span>
      </div>

      {/* ── This week's emphasis ── */}
      <div className="flh-week">
        <div className="flh-week-head">
          <span className="flh-week-badge">{week.emoji} Week {week.week}</span>
          <span className="flh-week-title">{week.title}</span>
        </div>
        <div className="flh-week-goal">{week.goal}</div>
        <div className="flh-week-coaching">{week.coaching}</div>
        {week.warning && <div className="flh-week-warning">⚠️ {week.warning}</div>}
      </div>

      {/* ── The daily photo — a real capture, not a checkbox ── */}
      <ProgressPhoto dayNumber={day} date={date} />

      {/* ── The fullness mechanism ── */}
      <div className="flh-block">
        <button className="flh-block-toggle" onClick={() => setOpenFullness(v => !v)}>
          <span className="flh-block-title">🍽️ {FLH.FULLNESS.title}</span>
          <span className="flh-block-meta">instead of counting calories</span>
          <span className="flh-caret">{openFullness ? '▾' : '▸'}</span>
        </button>
        {openFullness && (
          <>
            <div className="flh-headline">{FLH.FULLNESS.plain}</div>
            <div className="flh-note">{FLH.FULLNESS.why}</div>
            <ul className="flh-list">
              {FLH.FULLNESS.howTo.map((i, n) => <li key={n}>{i}</li>)}
            </ul>
            <div className="flh-honesty">{FLH.FULLNESS.honesty}</div>
          </>
        )}
      </div>

      {/* ── Cardio structure ── */}
      <div className="flh-block">
        <button className="flh-block-toggle" onClick={() => setOpenCardio(v => !v)}>
          <span className="flh-block-title">❤️ Your cardio week</span>
          <span className="flh-block-meta">{FLH.CARDIO.principle}</span>
          <span className="flh-caret">{openCardio ? '▾' : '▸'}</span>
        </button>
        {openCardio && (
          <>
            <div className="flh-note">{FLH.CARDIO.blurb}</div>
            <div className="flh-sub-title">{FLH.CARDIO.zone2.title}</div>
            <div className="flh-note">{FLH.CARDIO.zone2.detail}</div>
            <div className="flh-sub-title">{FLH.CARDIO.intervals.title}</div>
            <div className="flh-note">{FLH.CARDIO.intervals.detail}</div>
            <ol className="flh-list numbered">
              {FLH.CARDIO.intervals.template.map((i, n) => <li key={n}>{i}</li>)}
            </ol>
            <div className="flh-note"><strong>{FLH.CARDIO.intervals.totalTime}</strong></div>
            <div className="flh-warning">{FLH.CARDIO.intervals.caution}</div>
            <div className="flh-honesty">{FLH.CARDIO.honesty}</div>
          </>
        )}
      </div>

      {/* ── The 30-day arc ── */}
      <div className="flh-block">
        <button className="flh-block-toggle" onClick={() => setOpenWeeks(v => !v)}>
          <span className="flh-block-title">🗺️ The 30-day arc</span>
          <span className="flh-block-meta">{FLH.WEEKS.map(w => w.title).join(' → ')}</span>
          <span className="flh-caret">{openWeeks ? '▾' : '▸'}</span>
        </button>
        {openWeeks && FLH.WEEKS.map(w => (
          <div key={w.week} className={`flh-arc-row${w.week === week.week ? ' current' : ''}`}>
            <div className="flh-arc-title">{w.emoji} Week {w.week} — {w.title}</div>
            <div className="flh-arc-goal">{w.goal}</div>
            {w.week === week.week && (
              <ul className="flh-list">{w.focus.map((f, n) => <li key={n}>{f}</li>)}</ul>
            )}
          </div>
        ))}
      </div>

      {/* ── Safety — what Hard Mode is and is not ── */}
      <div className="flh-block">
        <button className="flh-block-toggle" onClick={() => setOpenSafety(v => !v)}>
          <span className="flh-block-title">⚕️ What Hard Mode is — and isn&apos;t</span>
          <span className="flh-caret">{openSafety ? '▾' : '▸'}</span>
        </button>
        {openSafety && (
          <>
            <div className="flh-means">
              <div className="flh-means-col is">
                <div className="flh-means-title">It means</div>
                {FLH.SAFETY.meaning.is.map(i => <div key={i} className="flh-means-item">✓ {i}</div>)}
              </div>
              <div className="flh-means-col isnot">
                <div className="flh-means-title">It does not mean</div>
                {FLH.SAFETY.meaning.isNot.map(i => <div key={i} className="flh-means-item">✕ {i}</div>)}
              </div>
            </div>
            <div className="flh-warning">{FLH.SAFETY.running}</div>
          </>
        )}
      </div>
    </div>
  );
}
