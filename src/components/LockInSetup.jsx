import { useState, useMemo } from 'react';
import * as LI from '../data/lockInConfig';
import { previewConfigured } from '../data/challengeAttempt';
import { displayXP } from '../utils/xpDisplay';
import { XPSummaryCard } from './XPPreview';

/**
 * 🎯 LOCK IN setup.
 *
 * One screen, everything pre-filled, startable in a single tap. The four
 * adjustable targets are behind a disclosure because the defaults are the
 * recommendation — nobody should have to make five decisions before day one.
 *
 * Every string and number rendered here comes from lockInConfig.
 */
export default function LockInSetup({ onCancel, onSubmit, initialSetup = null }) {
  // The browsing screen may already have settled on a length; it is used
  // as the starting point here so the same question is not asked twice with
  // two different answers.
  const [s, setS] = useState(() => ({ ...LI.defaultSetup(), ...(initialSetup || {}) }));
  const [showTargets, setShowTargets] = useState(false);
  const [showHabits, setShowHabits] = useState(false);

  const set = (patch) => setS(prev => ({ ...prev, ...patch }));
  // Priced from the attempt these choices would start, so every figure on this
  // screen is the figure the challenge will award.
  const preview = useMemo(() => previewConfigured(LI.LOCK_IN_TEMPLATE_ID, s), [s]);
  const bonusByDuration = useMemo(() => Object.fromEntries(
    LI.DURATION_OPTIONS.map(o => [
      o.days,
      previewConfigured(LI.LOCK_IN_TEMPLATE_ID, { ...s, durationDays: o.days }).completionBonus,
    ]),
  ), [s]);
  const tasks = preview.tasks;
  // A new attempt is stamped with the current era, so this is 1 — applied all
  // the same, so the setup screen prices habits by the same rule the task rows
  // will once the challenge is running.
  const xpd = (v) => displayXP(v, preview.displayScale).toLocaleString();
  const option = LI.durationOption(s.durationDays);
  const ramp = LI.rampFor(s.durationDays);
  const lighterDays = LI.lighterDaysFor(s.durationDays);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card li-setup" onClick={e => e.stopPropagation()}>
        <div className="li-hero">
          <div className="li-hero-emoji">{LI.IDENTITY.emoji}</div>
          <h3>{LI.IDENTITY.name}</h3>
          <p className="li-hero-sub">{LI.IDENTITY.subtitle}</p>
        </div>

        <div className="li-goal">{LI.goalFor(s.durationDays)}</div>
        <div className="li-pitch">{LI.IDENTITY.pitch}</div>

        {/* ── Duration: six lengths, explained before you commit ── */}
        <div className="li-field">
          <div className="li-label">How long?</div>
          <div className="li-durations">
            {LI.DURATION_OPTIONS.map(o => (
              <button
                key={o.days}
                className={`li-duration${s.durationDays === o.days ? ' active' : ''}`}
                onClick={() => set({ durationDays: o.days })}
                aria-pressed={s.durationDays === o.days}
              >
                <span className="li-duration-head">
                  {o.days} Days — {o.label}
                  {o.days === LI.DEFAULT_DURATION && <span className="li-duration-rec">Recommended</span>}
                </span>
                <span className="li-duration-blurb">{o.blurb}</span>
                <span className="li-duration-reward">
                  {bonusByDuration[o.days]} XP on completion
                </span>
              </button>
            ))}
          </div>
          <p className="li-help">{option.detail}</p>
        </div>

        <div className="li-facts">
          <div className="li-fact">
            <span className="li-fact-value">{s.durationDays}</span>
            <span className="li-fact-label">days</span>
          </div>
          <div className="li-fact">
            <span className="li-fact-value">8</span>
            <span className="li-fact-label">daily habits</span>
          </div>
          <div className="li-fact">
            <span className="li-fact-value">{xpd(preview.dailyTaskXP)}</span>
            <span className="li-fact-label">XP per day</span>
          </div>
          <div className="li-fact">
            <span className="li-fact-value">{xpd(preview.completionBonus)}</span>
            <span className="li-fact-label">on completion</span>
          </div>
        </div>

        <XPSummaryCard preview={preview} />

        {/* The flow ramp is the structural thing to understand before starting. */}
        <div className="li-field">
          <div className="li-label">How the focus sessions progress</div>
          <div className="li-ramp">
            {ramp.map(st => (
              <div key={`${st.label}-${st.fromDay}`} className="li-ramp-step">
                <span className="li-ramp-min">{st.minutes}m</span>
                <span className="li-ramp-days">
                  {st.fromDay === st.toDay ? `Day ${st.fromDay}` : `Days ${st.fromDay}–${st.toDay}`}
                </span>
              </div>
            ))}
          </div>
          <p className="li-help">
            {LI.FLOW_SESSIONS_PER_DAY} sessions a day at the current target, topping out
            at {ramp[ramp.length - 1].minutes} minutes. A longer challenge holds that length for
            longer — it never asks for longer sessions.
          </p>
          <p className="li-help">
            {lighterDays.length} planned lighter {lighterDays.length === 1 ? 'day' : 'days'} —
            roughly one a week (Day {lighterDays.join(', ')}). One session instead
            of {LI.FLOW_SESSIONS_PER_DAY}, for the same XP.
          </p>
        </div>

        {/* The rule that shapes the whole XP ladder, stated before you start. */}
        <div className="li-rule">
          Sleep is the highest-XP habit here, and nothing in this challenge rewards sleeping less.
          Lighter days cut work volume, never recovery.
        </div>

        {/* ── Habits preview ── */}
        <div className="li-field">
          <button className="li-disclosure" onClick={() => setShowHabits(v => !v)}>
            {showHabits ? '▾' : '▸'} The {tasks.length} daily habits
          </button>
          {showHabits && (
            <div className="li-habits">
              {tasks.map(t => (
                <div key={t.id} className="li-habit">
                  <span className="li-habit-icon">{t.icon}</span>
                  <span className="li-habit-text">
                    <span className="li-habit-name">
                      {t.name}
                      {t.keystone > 0 && <span className="keystone-stars">{'⭐'.repeat(t.keystone)}</span>}
                    </span>
                    <span className="li-habit-desc">{t.desc}</span>
                  </span>
                  <span className="li-habit-xp">{xpd(t.xp)} XP</span>
                </div>
              ))}
              <p className="li-help">
                Every habit except the Daily Log has a full strategy guide — tap &ldquo;Guide&rdquo; on
                any habit once the challenge starts.
              </p>
            </div>
          )}
        </div>

        {/* ── Adjustable targets ── */}
        <div className="li-field">
          <button className="li-disclosure" onClick={() => setShowTargets(v => !v)}>
            {showTargets ? '▾' : '▸'} Adjust targets (optional)
          </button>
          {showTargets && (
            <div className="li-targets">
              <Stepper
                label="Sleep opportunity"
                unit="hours"
                value={s.sleepHours}
                min={LI.SLEEP_OPPORTUNITY.min}
                max={LI.SLEEP_OPPORTUNITY.max}
                step={0.5}
                onChange={v => set({ sleepHours: v })}
                help="Time in bed, not time asleep. Set it to your own sleep need."
              />
              <Stepper
                label="Attention training"
                unit="minutes"
                value={s.attentionMinutes}
                min={LI.ATTENTION_MINUTES.min}
                max={60}
                step={5}
                onChange={v => set({ attentionMinutes: v })}
                help="Reading or meditation. Ten minutes is the recommendation — extend it later, not now."
              />
              <Stepper
                label="Mental recovery"
                unit="minutes"
                value={s.recoveryMinutes}
                min={LI.RECOVERY_MINUTES.min}
                max={120}
                step={10}
                onChange={v => set({ recoveryMinutes: v })}
                help="Genuinely restorative downtime, in one block or spread across the day."
              />
              <Stepper
                label="Shutdown ritual"
                unit="minutes"
                value={s.shutdownMinutes}
                min={LI.SHUTDOWN_MINUTES.min}
                max={30}
                step={5}
                onChange={v => set({ shutdownMinutes: v })}
                help="Five minutes is enough. The repetition matters more than the length."
              />
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Back</button>
          <button className="btn btn-primary" onClick={() => onSubmit({ ...s, durationDays: LI.resolveDuration(s.durationDays) })}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, unit, value, min, max, step, onChange, help }) {
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div className="li-stepper">
      <div className="li-stepper-row">
        <span className="li-stepper-label">{label}</span>
        <div className="li-stepper-controls">
          <button
            className="li-step-btn"
            onClick={() => onChange(clamp(value - step))}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
          >−</button>
          <span className="li-stepper-value">{value} {unit}</span>
          <button
            className="li-step-btn"
            onClick={() => onChange(clamp(value + step))}
            disabled={value >= max}
            aria-label={`Increase ${label}`}
          >+</button>
        </div>
      </div>
      {help && <p className="li-help">{help}</p>}
    </div>
  );
}
