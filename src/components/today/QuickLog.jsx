import { useState, useEffect, useRef } from 'react';
import RatingSlider from '../RatingSlider';
import { makeTaskXP } from '../../utils/xpDisplay';

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
 * task's own, read from the attempt and converted to the ladder Lifetime XP is
 * on, not a constant.
 */
export default function QuickLog({ dayData, onUpdate, profile, activeProfile, logRef, meta }) {
  const [showMore, setShowMore] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const firstRender = useRef(true);

  const logged = !!dayData?.tasks?.daily_log;
  const logTask = (profile?.tasks || []).find(t => t.id === 'daily_log');
  const logXP = logTask ? makeTaskXP(meta)(logTask) : null;

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

  // ── Hours slept, and what it is allowed to complete ─────────────────────
  //
  // "Hours slept" and "sleep opportunity" are different things, and this used
  // to treat them as one. It ticked a hard-coded `sleep_target` id whatever
  // challenge was running, which meant two wrong behaviours at once: on a
  // challenge that has no such habit it wrote a completion flag for a task
  // that is not in the list and silently did nothing useful, and on one whose
  // sleep habit is an OPPORTUNITY habit it would have claimed time in bed from
  // a figure that measures actual sleep. LOCK IN and Energy Reset both say so
  // in as many words: "the opportunity is what counts — not whether every hour
  // was perfect."
  //
  // So the habit is resolved from THIS attempt's own task list, and auto-
  // completion applies only where the habit really is about hours slept. An
  // opportunity habit is left for the user to tick, and the card says why.
  const sleepHabit = (profile?.tasks || []).find(t => t.habitKey === 'sleep_target');
  const isOpportunity = sleepHabit
    ? /opportunity/i.test(`${sleepHabit.name || ''} ${sleepHabit.desc || ''}`)
    : false;
  const sleepAuto = profile?.sleepAutoComplete !== false;
  const canAutoComplete = sleepAuto && !!sleepHabit && !isOpportunity;
  // The habit's OWN target when it carries one — a challenge asking for 7.5
  // hours should not be judged against a profile default of 8.
  const sleepTarget = (sleepHabit?.target?.unit === 'hours' && Number(sleepHabit.target.value))
    || profile?.sleepTarget || 8;

  function setHours(raw) {
    const hrs = parseFloat(raw);
    const hours = Number.isFinite(hrs) ? hrs : 0;
    const updates = { hoursSlept: hours };
    if (canAutoComplete) {
      updates.tasks = { ...dayData?.tasks, [sleepHabit.id]: hours >= sleepTarget };
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
            {logXP != null ? `${logXP} XP` : 'Not logged'}
          </span>
        )}
      </header>

      {/* The completion condition, stated once. There is no button to press:
          the habit completes itself from the log, which is what stops the
          same action being paid for twice. */}
      <p className="f4-card-sub">
        {logged
          ? 'Saved. Your “Complete Daily Log” habit is ticked for today.'
          : 'Fill in any one of these and your “Complete Daily Log” habit completes itself.'}
      </p>

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
            {canAutoComplete && (
              <div className="sleep-target-hint">≥ {sleepTarget}h completes “{sleepHabit.name}”</div>
            )}
            {sleepAuto && isOpportunity && (
              <div className="sleep-target-hint">
                Tracked only — “{sleepHabit.name}” is about time in bed, so tick it yourself
              </div>
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

      </div>

      {/* Notes are optional, so they take one line until there is something to
          say or somewhere to say it. */}
      <textarea
        className="log-textarea f4-log-notes"
        rows={(dayData?.notes || '').length > 0 || notesOpen ? 3 : 1}
        placeholder="Notes (optional)…"
        value={dayData?.notes || ''}
        aria-label="Notes for today"
        onFocus={() => setNotesOpen(true)}
        onBlur={() => setNotesOpen(false)}
        onChange={e => onUpdate({ notes: e.target.value })}
      />

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
