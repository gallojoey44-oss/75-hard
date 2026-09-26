import { useState } from 'react';
import * as MB from '../data/muscleBuildingConfig';
import { HABIT_KEYS } from '../data/habitKeys';

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
  const setSpec = (patch) => set({ specialization: { ...(s.specialization || {}), ...patch } });
  const togglePriority = (id) => {
    const cur = s.specialization?.priority || [];
    if (cur.includes(id)) return setSpec({ priority: cur.filter(x => x !== id) });
    if (cur.length >= MB.SPECIALIZATION.maxPriority) return undefined;
    return setSpec({ priority: [...cur, id] });
  };
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

        {/* ── Carbohydrate ── */}
        {/* Placed after energy and protein on purpose: carbohydrate takes what
            remains of the calorie target, it does not get added on top of it. */}
        <div className="mb-field">
          <label className="mb-label">Carbohydrate target</label>
          <div className="mb-chips">
            {MB.CARB_DEMAND_LEVELS.map(l => (
              <button
                key={l.id}
                className={`mb-chip${s.carbDemand === l.id ? ' active' : ''}`}
                onClick={() => set({ carbDemand: l.id, carbPerLb: l.perLb.suggested })}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="mb-hint">{MB.carbDemandLevel(s.carbDemand).blurb}</div>
          <label className="mb-inline">
            <span>g per lb of bodyweight</span>
            <input
              type="number" step="0.1" inputMode="decimal" className="inline-input"
              min={MB.CARB_DEMAND_LEVELS[0].perLb.min} max={MB.CARB_DEMAND_LEVELS[2].perLb.max}
              value={s.carbPerLb}
              onChange={e => set({ carbPerLb: parseFloat(e.target.value) || MB.DEFAULT_CARB_PER_LB })}
            />
          </label>
          {(() => {
            const n = MB.resolveNutrition(s);
            if (!n.suggestedCarbGrams) {
              return <div className="mb-hint">Enter your bodyweight above for a suggested carb target.</div>;
            }
            return (
              <>
                <div className="mb-resolved">
                  Daily carb target: <strong>{n.carbGrams} g</strong>
                  {n.macros.adjusted && <span className="mb-adjusted"> (trimmed from {n.suggestedCarbGrams} g)</span>}
                </div>
                {n.macros.adjusted && <div className="mb-warn">{n.macros.note}</div>}
                {!s.calorieTarget && (
                  <div className="mb-hint">
                    With no calorie target set, this is a straight reference figure. Set one above and
                    Forge will fit protein, fat and carbs inside it.
                  </div>
                )}
              </>
            );
          })()}
          <div className="mb-hint">{MB.WHY[HABIT_KEYS.CARBOHYDRATE_TARGET]}</div>
        </div>

        {/* ── Specialization ── */}
        <div className="mb-field">
          <label className="mb-label">{MB.SPECIALIZATION.question}</label>
          <div className="mb-chips">
            {MB.SPECIALIZATION.options.map(o => (
              <button
                key={o.id}
                className={`mb-chip${(s.specialization?.enabled ? 'specialize' : 'balanced') === o.id ? ' active' : ''}`}
                onClick={() => setSpec({ enabled: o.id === 'specialize', priority: o.id === 'specialize' ? (s.specialization?.priority || []) : [] })}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="mb-hint">
            {(s.specialization?.enabled ? MB.SPECIALIZATION.options[1] : MB.SPECIALIZATION.options[0]).blurb}
          </div>

          {s.specialization?.enabled && (
            <>
              <div className="mb-hint">{MB.SPECIALIZATION.explanation}</div>
              <div className="mb-warn">{MB.SPECIALIZATION.honesty}</div>

              <div className="mb-label" style={{ marginTop: 10 }}>
                Priority muscles (up to {MB.SPECIALIZATION.maxPriority})
              </div>
              <div className="mb-chips">
                {MB.specializationChoices().map(m => {
                  const on = (s.specialization?.priority || []).includes(m.id);
                  const full = (s.specialization?.priority || []).length >= MB.SPECIALIZATION.maxPriority;
                  return (
                    <button
                      key={m.id}
                      className={`mb-chip${on ? ' active' : ''}`}
                      disabled={!on && full}
                      onClick={() => togglePriority(m.id)}
                    >
                      {m.icon} {m.label}
                    </button>
                  );
                })}
              </div>

              {(s.specialization?.priority || []).length > 0 && (
                <>
                  <label className="mb-inline">
                    <span>Weekly sets for priority muscles</span>
                    <input
                      type="number" inputMode="numeric" className="inline-input"
                      min={MB.SPECIALIZATION.prioritySets.min} max={MB.SPECIALIZATION.prioritySets.max + 6}
                      value={s.specialization.prioritySets}
                      onChange={e => setSpec({ prioritySets: parseInt(e.target.value, 10) || MB.SPECIALIZATION.prioritySets.suggested })}
                    />
                  </label>
                  <div className="mb-hint">
                    {MB.SPECIALIZATION.prioritySets.min}–{MB.SPECIALIZATION.prioritySets.max} is a
                    starting range, not a target to max out. {MB.SPECIALIZATION.lowestEffectiveNote}
                  </div>

                  <div className="mb-label" style={{ marginTop: 10 }}>Where are you starting from?</div>
                  <div className="mb-hint">
                    Your current weekly sets for each priority muscle. Forge ramps up from here
                    rather than dropping you straight onto the full target.
                  </div>
                  {(s.specialization.priority || []).map(id => {
                    const m = MB.MUSCLE_GROUPS.find(x => x.id === id);
                    const cur = s.specialization.currentSets?.[id];
                    const ramp = MB.volumeRamp({
                      current: Number.isFinite(Number(cur)) ? Number(cur) : s.specialization.prioritySets,
                      target: s.specialization.prioritySets,
                      weeks: s.specialization.weeks,
                    });
                    return (
                      <div key={id}>
                        <label className="mb-inline">
                          <span>{m?.icon} {m?.label} — sets per week now</span>
                          <input
                            type="number" inputMode="numeric" className="inline-input" min="0" max="40"
                            value={cur ?? ''}
                            placeholder="—"
                            onChange={e => setSpec({
                              currentSets: { ...(s.specialization.currentSets || {}), [id]: e.target.value === '' ? undefined : (parseInt(e.target.value, 10) || 0) },
                            })}
                          />
                        </label>
                        {Number.isFinite(Number(cur)) && (
                          <div className="mb-ramp">
                            Ramp: {ramp.map(r => r.sets).join(' → ')} sets
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <label className="mb-inline">
                    <span>Weekly sessions per priority muscle</span>
                    <input
                      type="number" inputMode="numeric" className="inline-input"
                      min={MB.SPECIALIZATION.exposures.min} max={MB.SPECIALIZATION.exposures.max + 2}
                      value={s.specialization.exposures}
                      onChange={e => setSpec({ exposures: parseInt(e.target.value, 10) || MB.SPECIALIZATION.exposures.suggested })}
                    />
                  </label>
                  <div className="mb-hint">{MB.SPECIALIZATION.exposureNote}</div>
                  <div className="mb-hint">{MB.SPECIALIZATION.durationNote}</div>
                </>
              )}
            </>
          )}
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
