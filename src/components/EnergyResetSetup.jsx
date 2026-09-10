import { useState } from 'react';
import * as ER from '../data/energyResetConfig';

/**
 * ⚡ 10-Day Energy Reset setup.
 *
 * One screen, everything pre-filled, startable in a single tap. The whole selling
 * point is that you can begin today, so nothing here is mandatory — the optional
 * baseline and the targets are both behind disclosures.
 *
 * Every string and number rendered here comes from energyResetConfig; this
 * component holds no challenge constants.
 */
export default function EnergyResetSetup({ onCancel, onSubmit }) {
  const [s, setS] = useState(ER.defaultSetup());
  const [showBaseline, setShowBaseline] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [showNutrients, setShowNutrients] = useState(false);

  const set = (patch) => setS(prev => ({ ...prev, ...patch }));
  const setBaseline = (key, value) => setS(prev => ({
    ...prev,
    baseline: { ...(prev.baseline || {}), [key]: prev.baseline?.[key] === value ? null : value },
  }));

  const tasks = ER.buildStartTasks(s);
  const weekly = ER.weeklyRequirementDefs(s);
  const option = ER.durationOption(s.durationDays);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card er-setup" onClick={e => e.stopPropagation()}>
        <div className="er-hero">
          <div className="er-hero-emoji">{ER.IDENTITY.emoji}</div>
          <h3>{ER.IDENTITY.name}</h3>
          <p className="er-hero-sub">{ER.IDENTITY.subtitle}</p>
        </div>

        <div className="er-goal">{ER.goalFor(s.durationDays)}</div>
        <div className="er-pitch">{ER.IDENTITY.pitch}</div>

        {/* ── Duration ── */}
        <div className="er-field">
          <div className="er-label">How long?</div>
          <div className="er-durations">
            {ER.DURATION_OPTIONS.map(o => (
              <button
                key={o.days}
                className={`er-duration${s.durationDays === o.days ? ' active' : ''}`}
                onClick={() => set({ durationDays: o.days })}
                aria-pressed={s.durationDays === o.days}
              >
                <span className="er-duration-head">
                  {o.days} Days — {o.label}
                  {o.days === ER.DEFAULT_DURATION && <span className="er-duration-rec">Recommended</span>}
                </span>
                <span className="er-duration-blurb">{o.blurb}</span>
                <span className="er-duration-reward">
                  {ER.COMPLETION_BONUS_BY_DURATION[o.days]} XP on completion
                </span>
              </button>
            ))}
          </div>
          <div className="er-hint">{ER.durationOption(s.durationDays).detail}</div>
          <div className="er-hint">
            The habits, targets, XP weighting and energy tracking are the same in all four.
            A longer version is not harder — it runs for longer, which earns more on completion
            and gives the insights more days to work with.
          </div>
          <div className="er-hint">{ER.insightDepth(s.durationDays).note}</div>
        </div>

        {/* ── The measurement, explained before the habits ── */}
        <div className="er-field">
          <div className="er-label">⚡ What gets measured</div>
          <div className="er-measure">
            {ER.ENERGY_PROMPT.fields.map(f => (
              <div key={f.key} className="er-measure-row">
                <span className="er-measure-icon">{f.icon}</span>
                <span className="er-measure-name">{f.label}</span>
                <span className="er-measure-scale">{ER.ENERGY_PROMPT.scale.min}–{ER.ENERGY_PROMPT.scale.max}</span>
              </div>
            ))}
          </div>
          <div className="er-hint">{ER.ENERGY_PROMPT.blurb}</div>
          <div className="er-hint">
            At the end, Forge compares your first {ER.windowForDuration(s.durationDays)} rated days
            against your last {ER.windowForDuration(s.durationDays)} — enough on each side to smooth
            out a single unusually good or bad day. Nothing to wait for: you start logging on Day 1.
          </div>
          <div className="er-hint">{ER.ENERGY_PROMPT.missingNote}</div>
        </div>

        {/* ── Optional pre-challenge baseline ── */}
        <div className="er-field">
          <button className="er-disclosure" onClick={() => setShowBaseline(v => !v)}>
            {showBaseline ? '▾' : '▸'} {ER.BASELINE_PROMPT.title}
            <span className="er-disclosure-note">optional</span>
          </button>
          {showBaseline && (
            <div className="er-baseline">
              <div className="er-hint">{ER.BASELINE_PROMPT.blurb}</div>
              {ER.ENERGY_PROMPT.fields.map(f => (
                <div key={f.key} className="er-scale">
                  <div className="er-scale-head">
                    <span className="er-scale-label">{f.icon} {f.label}</span>
                    <span className="er-scale-value">{s.baseline?.[f.key] || '—'}</span>
                  </div>
                  <div className="er-scale-row">
                    {Array.from({ length: ER.ENERGY_PROMPT.scale.max }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        className={`er-dot${s.baseline?.[f.key] === n ? ' active' : ''}`}
                        onClick={() => setBaseline(f.key, n)}
                        aria-label={`${f.label} ${n}`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="er-hint">{ER.BASELINE_PROMPT.skipNote}</div>
              <div className="er-hint">
                Either way there is no waiting period before Day 1 — the comparison works from the
                days you log inside the challenge.
              </div>
            </div>
          )}
        </div>

        {/* ── Daily habits ── */}
        <div className="er-field">
          <div className="er-label">Daily habits</div>
          <ul className="tpl-task-list">
            {tasks.map(t => (
              <li key={t.id}>
                {t.icon} {t.name} ({t.xp} XP){t.keystoneHabit ? ' ⭐⭐⭐ Keystone' : ''}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Weekly exercise ── */}
        <div className="er-field">
          <div className="er-label">Weekly exercise</div>
          <ul className="tpl-task-list weekly">
            {weekly.map(d => (
              <li key={d.id}>
                {d.icon} {d.label} — {d.perWeek}× per week ({d.xp} XP each)
                <span className="er-req-note">{d.note}</span>
              </li>
            ))}
          </ul>
          <div className="er-hint">{ER.EXERCISE_GUIDE.blurb}</div>
          <div className="er-hint">{ER.EXERCISE_GUIDE.notice}</div>
        </div>

        {/* ── Nutrient education (never a tracking requirement) ── */}
        <div className="er-field">
          <button className="er-disclosure" onClick={() => setShowNutrients(v => !v)}>
            {showNutrients ? '▾' : '▸'} What &quot;nutrient-dense&quot; means here
            <span className="er-disclosure-note">nothing to track</span>
          </button>
          {showNutrients && (
            <div className="er-nutrients">
              <div className="er-hint">{ER.MICRONUTRIENT_NOTE}</div>
              {ER.MICRONUTRIENTS.map(n => (
                <div key={n.id} className="er-nutrient">
                  <strong>{n.name}</strong> — {n.sources}
                </div>
              ))}
              <div className="er-caution">{ER.MICRONUTRIENT_CAUTION}</div>
            </div>
          )}
        </div>

        {/* ── Targets (pre-filled) ── */}
        <div className="er-field">
          <button className="er-disclosure" onClick={() => setShowTargets(v => !v)}>
            {showTargets ? '▾' : '▸'} Your targets
            <span className="er-disclosure-note">using suggested values</span>
          </button>
          {showTargets && (
            <div className="er-targets">
              <label className="er-inline">
                <span>Sleep opportunity (hours)</span>
                <input
                  type="number" step="0.5" inputMode="decimal" className="inline-input"
                  min={ER.SLEEP_OPPORTUNITY.min} max={ER.SLEEP_OPPORTUNITY.max}
                  value={s.sleepHours}
                  onChange={e => set({ sleepHours: parseFloat(e.target.value) || ER.SLEEP_OPPORTUNITY.suggested })}
                />
              </label>
              <label className="er-inline">
                <span>Morning light (minutes)</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="1"
                  value={s.lightMinutes}
                  onChange={e => set({ lightMinutes: parseInt(e.target.value, 10) || ER.MORNING_LIGHT.minutes })}
                />
              </label>
              <label className="er-inline">
                <span>Daily steps</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="0" step="500"
                  value={s.stepTarget}
                  onChange={e => set({ stepTarget: parseInt(e.target.value, 10) || ER.STEP_TARGET.suggested })}
                />
              </label>
              <label className="er-inline">
                <span>Downshift (minutes)</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min={ER.STRESS_MINUTES.min}
                  value={s.stressMinutes}
                  onChange={e => set({ stressMinutes: parseInt(e.target.value, 10) || ER.STRESS_MINUTES.suggested })}
                />
              </label>
              <label className="er-inline">
                <span>Caffeine cutoff (hours before bed)</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="0" max="16"
                  value={s.caffeineCutoffHours}
                  onChange={e => set({ caffeineCutoffHours: parseInt(e.target.value, 10) || ER.CAFFEINE_CUTOFF.suggested })}
                />
              </label>
              <label className="er-inline">
                <span>Resistance sessions / week</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="0" max="7"
                  value={s.resistancePerWeek}
                  onChange={e => set({ resistancePerWeek: Math.max(0, parseInt(e.target.value, 10) || ER.WEEKLY_DEFAULTS.resistancePerWeek) })}
                />
              </label>
              <label className="er-inline">
                <span>Aerobic sessions / week</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="0" max="7"
                  value={s.aerobicPerWeek}
                  onChange={e => set({ aerobicPerWeek: Math.max(0, parseInt(e.target.value, 10) || ER.WEEKLY_DEFAULTS.aerobicPerWeek) })}
                />
              </label>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(s)}>
            Continue · {option.days} days
          </button>
        </div>
      </div>
    </div>
  );
}
