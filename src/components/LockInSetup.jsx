import { useState } from 'react';
import * as LI from '../data/lockInConfig';

/**
 * 🎯 LOCK IN setup.
 *
 * One screen, everything pre-filled, startable in a single tap. The four
 * adjustable targets are behind a disclosure because the defaults are the
 * recommendation — nobody should have to make five decisions before day one.
 *
 * Every string and number rendered here comes from lockInConfig.
 */
export default function LockInSetup({ onCancel, onSubmit }) {
  const [s, setS] = useState(LI.defaultSetup());
  const [showTargets, setShowTargets] = useState(false);
  const [showHabits, setShowHabits] = useState(false);

  const set = (patch) => setS(prev => ({ ...prev, ...patch }));
  const tasks = LI.buildStartTasks(s);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card li-setup" onClick={e => e.stopPropagation()}>
        <div className="li-hero">
          <div className="li-hero-emoji">{LI.IDENTITY.emoji}</div>
          <h3>{LI.IDENTITY.name}</h3>
          <p className="li-hero-sub">{LI.IDENTITY.subtitle}</p>
        </div>

        <div className="li-goal">{LI.IDENTITY.goal}</div>
        <div className="li-pitch">{LI.IDENTITY.pitch}</div>

        <div className="li-facts">
          <div className="li-fact">
            <span className="li-fact-value">{LI.DURATION_DAYS}</span>
            <span className="li-fact-label">days</span>
          </div>
          <div className="li-fact">
            <span className="li-fact-value">8</span>
            <span className="li-fact-label">daily habits</span>
          </div>
          <div className="li-fact">
            <span className="li-fact-value">{LI.dailyXPTotal(s)}</span>
            <span className="li-fact-label">XP per day</span>
          </div>
          <div className="li-fact">
            <span className="li-fact-value">{LI.COMPLETION_BONUS_XP}</span>
            <span className="li-fact-label">on completion</span>
          </div>
        </div>

        {/* The flow ramp is the structural thing to understand before starting. */}
        <div className="li-field">
          <div className="li-label">Focus sessions ramp across the fortnight</div>
          <div className="li-ramp">
            {LI.FLOW_STAGES.map(st => (
              <div key={st.minutes} className="li-ramp-step">
                <span className="li-ramp-min">{st.minutes}m</span>
                <span className="li-ramp-days">Days {st.fromDay}–{st.toDay}</span>
              </div>
            ))}
          </div>
          <p className="li-help">
            {LI.FLOW_SESSIONS_PER_DAY} sessions a day at the current target. Day{' '}
            {LI.LIGHTER_DAYS.join(' and Day ')} are planned lighter days — one session instead
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
                  <span className="li-habit-xp">{t.xp} XP</span>
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
          <button className="btn btn-primary" onClick={() => onSubmit({ ...s, durationDays: LI.DURATION_DAYS })}>
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
