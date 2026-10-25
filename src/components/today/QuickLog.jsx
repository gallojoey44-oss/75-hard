import { useState, useEffect, useRef } from 'react';
import RatingSlider from '../RatingSlider';
import { getTaskXP } from '../../utils/gamification';
import { dayRules } from '../../data/xpEconomy';

/**
 * 📊 The Daily Log.
 *
 * Sits directly under the daily habits, because recording how the day went
 * belongs with doing the day — not after the scorecard.
 *
 * The four things people log every single day lead: mood, energy, hours slept
 * and a note. Everything else the app has always tracked — confidence, sleep
 * quality, recovery, workout effort, stress — is one tap away under "More
 * metrics", unchanged, on the same 1–10 scales and writing to the same fields,
 * so history stays comparable. Nothing was converted to a shorter scale and no
 * metric was dropped.
 *
 * Completion is NOT a checkbox. Saving any one metric marks the shared
 * `daily_log` task complete exactly once (see DailyView.handleUpdate), and the
 * task row scrolls here rather than toggling — so its XP is earned once, by
 * actually logging, and never independently of this card. The XP shown is the
 * task's own, read from the attempt, not a constant.
 */
export default function QuickLog({ dayData, onUpdate, profile, activeProfile, logRef, meta }) {
  const [showMore, setShowMore] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const firstRender = useRef(true);

  const logged = !!dayData?.tasks?.daily_log;
  const logTask = (profile?.tasks || []).find(t => t.id === 'daily_log');
  const logXP = logTask ? getTaskXP(logTask, dayRules(meta)) : null;

  // Saved feedback. Every edit here writes straight through to the store, so
  // the only honest thing to show is that it has been written — briefly, then
  // out of the way. Skips the first render so opening the card never claims a
  // save that did not happen.
  const stamp = JSON.stringify([
    dayData?.mood, dayData?.energy, dayData?.hoursSlept, dayData?.notes,
    dayData?.confidence, dayData?.sleep, dayData?.recovery,
    dayData?.workoutEffort, dayData?.stress,
  ]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSavedAt(Date.now());
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [stamp]);

  const sleepTarget = profile?.sleepTarget ?? 8;
  const sleepAuto = profile?.sleepAutoComplete !== false;
  const sleepTaskId = activeProfile === 'me' ? 'sleep_target' : 'gf_sleep_target';

  function setHours(raw) {
    const hrs = parseFloat(raw);
    const updates = { hoursSlept: Number.isFinite(hrs) ? hrs : 0 };
    if (sleepAuto) {
      updates.tasks = { ...dayData?.tasks, [sleepTaskId]: (Number.isFinite(hrs) ? hrs : 0) >= sleepTarget };
    }
    onUpdate(updates);
  }

  return (
    <section className="f4-card section-card daily-log-card" ref={logRef}>
      <header className="f4-card-head">
        <span className="f4-card-title">📊 Daily Log</span>
        {logged ? (
          <span className="daily-log-done f4-badge success">
            ✓ Logged{logXP != null ? ` · +${logXP} XP` : ''}
          </span>
        ) : (
          <span className="daily-log-hint f4-badge">
            Log one metric{logXP != null ? ` · ${logXP} XP` : ''}
          </span>
        )}
      </header>

      <p className="f4-card-sub">Track your mood, energy, sleep and more.</p>

      {/* ── The daily four ── */}
      <div className="f4-log-quick">
        <RatingSlider
          label="Mood" emoji="😊"
          value={dayData?.mood || 0}
          onChange={v => onUpdate({ mood: v })}
        />
        <RatingSlider
          label="Energy" emoji="⚡"
          value={dayData?.energy || 0}
          onChange={v => onUpdate({ energy: v })}
        />

        <div className="sleep-hours-row f4-log-hours">
          <div className="f4-log-hours-label">
            <div className="sleep-hours-label">😴 Hours Slept</div>
            {sleepAuto && (
              <div className="sleep-target-hint">≥ {sleepTarget}h auto-completes your sleep habit</div>
            )}
          </div>
          <input
            type="number"
            className="sleep-hours-input"
            value={dayData?.hoursSlept || ''}
            min={0}
            max={16}
            step={0.5}
            placeholder="0"
            inputMode="decimal"
            aria-label="Hours slept"
            onChange={e => setHours(e.target.value)}
          />
          <span className="sleep-hours-unit">hrs</span>
        </div>

        <textarea
          className="log-textarea"
          rows={2}
          placeholder="How did today go? Any notes…"
          value={dayData?.notes || ''}
          aria-label="Notes for today"
          onChange={e => onUpdate({ notes: e.target.value })}
        />
      </div>

      {/* ── Everything else, unchanged and one tap away ── */}
      <button
        type="button"
        className="f4-log-more"
        aria-expanded={showMore}
        onClick={() => setShowMore(v => !v)}
      >
        {showMore ? '▾' : '▸'} {showMore ? 'Fewer metrics' : 'More metrics'}
        <span className="f4-log-more-hint">Confidence · Sleep Quality · Recovery · Workout Effort · Stress</span>
      </button>

      {showMore && (
        <div className="f4-log-rest">
          <RatingSlider
            label="Confidence" emoji="💪"
            value={dayData?.confidence || 0}
            onChange={v => onUpdate({ confidence: v })}
          />
          <RatingSlider
            label="Sleep Quality" emoji="⭐"
            value={dayData?.sleep || 0}
            onChange={v => onUpdate({ sleep: v })}
          />
          <RatingSlider
            label="Recovery / Soreness" emoji="🔋"
            value={dayData?.recovery || 0}
            onChange={v => onUpdate({ recovery: v })}
            hint="1 = very sore · 10 = fully recovered"
          />
          <RatingSlider
            label="Workout Effort" emoji="🏋️"
            value={dayData?.workoutEffort || 0}
            onChange={v => onUpdate({ workoutEffort: v })}
            hint="1 = very easy · 10 = extremely hard"
          />
          <RatingSlider
            label="Stress" emoji="🌡️"
            value={dayData?.stress || 0}
            onChange={v => onUpdate({ stress: v })}
            hint="1 = very calm · 10 = very stressed"
          />
        </div>
      )}

      <div className={`f4-saved${savedAt ? ' on' : ''}`} role="status" aria-live="polite">
        {savedAt ? '✓ Saved' : ''}
      </div>
    </section>
  );
}
