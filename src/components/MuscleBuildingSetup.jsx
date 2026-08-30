import { useState } from 'react';
import * as MB from '../data/muscleBuildingConfig';

/**
 * Muscle Building setup — the minimum useful customization, on one screen.
 *
 * Every option and default is read from muscleBuildingConfig, so changing what
 * the challenge asks for is a data edit there, not a change here. Advanced
 * choices (per-muscle set targets, measurement selection) are collapsed by
 * default so the common path is: pick a duration, pick training days, go.
 */
export default function MuscleBuildingSetup({ onCancel, onSubmit }) {
  const [s, setS] = useState(MB.defaultSetup());
  const [showVolume, setShowVolume] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [customProtein, setCustomProtein] = useState(false);

  const set = (patch) => setS(prev => ({ ...prev, ...patch }));
  const suggested = MB.suggestedProteinGrams(s.bodyweightLb, s.proteinPerLb);
  const mode = MB.nutritionMode(s.nutritionMode);

  function setMode(id) {
    const m = MB.nutritionMode(id);
    // The gain-rate range follows the chosen mode unless the user edits it.
    set({ nutritionMode: id, gainRateMin: m.gainRate.min, gainRateMax: m.gainRate.max });
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card mb-setup" onClick={e => e.stopPropagation()}>
        <h3>{MB.IDENTITY.emoji} {MB.IDENTITY.name}</h3>
        <p className="mb-setup-sub">{MB.IDENTITY.subtitle}</p>
        <p className="mb-setup-goal">{MB.IDENTITY.goal}</p>

        <div className="mb-pillars">
          {MB.PILLARS.map(p => (
            <span key={p.id} className="mb-pillar-chip" title={p.blurb}>{p.icon} {p.label}</span>
          ))}
        </div>

        {/* ── Duration ── */}
        <div className="mb-field">
          <label className="mb-label">Duration</label>
          <div className="mb-chips">
            {MB.DURATIONS.map(d => (
              <button
                key={d}
                className={`mb-chip${s.durationDays === d ? ' active' : ''}`}
                onClick={() => set({ durationDays: d })}
              >
                {d} days · {MB.DURATION_LABELS[d]}
                {d === MB.DEFAULT_DURATION && <span className="mb-rec">Recommended</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Training days ── */}
        <div className="mb-field">
          <label className="mb-label">How many resistance-training days per week?</label>
          <div className="mb-chips">
            {MB.TRAINING_DAY_OPTIONS.map(n => (
              <button
                key={n}
                className={`mb-chip${s.trainingDaysPerWeek === n ? ' active' : ''}`}
                onClick={() => set({ trainingDaysPerWeek: n })}
              >
                {n} days
              </button>
            ))}
          </div>
          <div className="mb-hint">
            Sessions are tracked per challenge week, not as a daily checkbox — {s.trainingDaysPerWeek} planned
            sessions every 7 days.
          </div>
        </div>

        {/* ── Protein ── */}
        <div className="mb-field">
          <label className="mb-label">Protein target</label>
          <div className="mb-row">
            <label className="mb-inline">
              <span>Bodyweight (lb)</span>
              <input
                type="number" inputMode="decimal" className="inline-input" placeholder="optional"
                value={s.bodyweightLb || ''}
                onChange={e => set({ bodyweightLb: parseFloat(e.target.value) || null })}
              />
            </label>
            <label className="mb-inline">
              <span>g per lb</span>
              <input
                type="number" step="0.05" inputMode="decimal" className="inline-input"
                min={MB.PROTEIN_PER_LB.min} max={MB.PROTEIN_PER_LB.max}
                value={s.proteinPerLb}
                onChange={e => set({ proteinPerLb: parseFloat(e.target.value) || MB.PROTEIN_PER_LB.suggested })}
              />
            </label>
          </div>
          {!customProtein ? (
            <div className="mb-hint">
              {suggested
                ? <>Suggested: <strong>{suggested} g/day</strong>. </>
                : <>Enter your bodyweight for a suggestion, or set a target directly. </>}
              Muscle-building range is {MB.PROTEIN_PER_LB.min}–{MB.PROTEIN_PER_LB.max} g per lb.
              {' '}<button className="mb-link" onClick={() => setCustomProtein(true)}>Set a custom target</button>
            </div>
          ) : (
            <label className="mb-inline full">
              <span>Custom target (g/day)</span>
              <input
                type="number" inputMode="numeric" className="inline-input"
                value={s.proteinGrams || ''}
                placeholder={suggested ? String(suggested) : 'grams'}
                onChange={e => set({ proteinGrams: parseInt(e.target.value, 10) || null })}
              />
            </label>
          )}
        </div>

        {/* ── Nutrition ── */}
        <div className="mb-field">
          <label className="mb-label">Nutrition target</label>
          <div className="mb-chips">
            {MB.NUTRITION_MODES.map(m => (
              <button
                key={m.id}
                className={`mb-chip${s.nutritionMode === m.id ? ' active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="mb-hint">{mode.blurb}</div>
          <label className="mb-inline full">
            <span>Daily calorie target (optional)</span>
            <input
              type="number" inputMode="numeric" className="inline-input" placeholder="use my own target"
              value={s.calorieTarget || ''}
              onChange={e => set({ calorieTarget: parseInt(e.target.value, 10) || null })}
            />
          </label>
          <div className="mb-hint">
            Leave blank to keep the task as “Hit Nutrition Target” and track against whatever
            target you already use. Expected gain: {s.gainRateMin}–{s.gainRateMax}% bodyweight per week.
          </div>
        </div>

        {/* ── Sleep ── */}
        <div className="mb-field">
          <label className="mb-label">Sleep target</label>
          <div className="mb-chips">
            {[7, 7.5, 8, 8.5, 9].map(h => (
              <button
                key={h}
                className={`mb-chip${s.sleepHours === h ? ' active' : ''}`}
                onClick={() => set({ sleepHours: h })}
              >
                {h}h{h === MB.SLEEP_TARGET.suggested ? ' ·  suggested' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* ── Weekly volume targets ── */}
        <div className="mb-field">
          <button className="mb-disclosure" onClick={() => setShowVolume(v => !v)}>
            {showVolume ? '▾' : '▸'} Weekly muscle-group set targets
            <span className="mb-disclosure-note">using suggested defaults</span>
          </button>
          {showVolume && (
            <>
              <div className="mb-hint">
                ~{MB.DEFAULT_SET_TARGET} challenging sets per week per major muscle is a useful starting
                reference, not a universal rule. Adjust anything here.
              </div>
              <div className="mb-volume-grid">
                {MB.MUSCLE_GROUPS.map(m => (
                  <label key={m.id} className="mb-volume-row">
                    <span className="mb-volume-name">{m.icon} {m.label}</span>
                    <input
                      type="number" inputMode="numeric" min="0" max="40" className="inline-input mb-volume-input"
                      value={s.volumeTargets[m.id]}
                      onChange={e => set({ volumeTargets: { ...s.volumeTargets, [m.id]: Math.max(0, parseInt(e.target.value, 10) || 0) } })}
                    />
                    <span className="mb-volume-unit">sets</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Optional optimization habits ── */}
        <div className="mb-field">
          <label className="mb-label">Optional optimization habits</label>
          {MB.OPTIMIZATION_HABITS.map(h => (
            <label key={h.id} className="mb-check">
              <input
                type="checkbox"
                checked={!!s.optimizations[h.key]}
                onChange={e => set({ optimizations: { ...s.optimizations, [h.key]: e.target.checked } })}
              />
              <span>
                <strong>{h.icon} {h.setupLabel}</strong>
                <span className="mb-check-desc">{MB.WHY[h.habitKey]}</span>
              </span>
            </label>
          ))}
          <div className="mb-hint">
            Both are optional and worth less XP than any fundamental. You are never penalised for a
            habit you did not enable.
          </div>
        </div>

        {/* ── Physique tracking ── */}
        <div className="mb-field">
          <button className="mb-disclosure" onClick={() => setShowMeasurements(v => !v)}>
            {showMeasurements ? '▾' : '▸'} Physique tracking
            <span className="mb-disclosure-note">
              {MB.MEASUREMENTS.filter(m => s.measurements[m.id]).length} selected
            </span>
          </button>
          {showMeasurements && (
            <>
              <div className="mb-hint">
                All optional. Check in every {MB.CHECKIN_INTERVAL_DAYS.min}–{MB.CHECKIN_INTERVAL_DAYS.max} days —
                measurements move slowly. Everything stays on this profile.
              </div>
              {MB.MEASUREMENTS.map(m => (
                <label key={m.id} className="mb-check">
                  <input
                    type="checkbox"
                    checked={!!s.measurements[m.id]}
                    onChange={e => set({ measurements: { ...s.measurements, [m.id]: e.target.checked } })}
                  />
                  <span>{m.icon} {m.label}{m.unit ? ` (${m.unit})` : ''}</span>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="mb-rir-note">
          <strong>{MB.RIR_GUIDANCE.headline}.</strong> {MB.RIR_GUIDANCE.body}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(s)}>Continue</button>
        </div>
      </div>
    </div>
  );
}
