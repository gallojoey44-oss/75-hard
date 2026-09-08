import { useState } from 'react';
import * as HH from '../data/hormoneHealthConfig';

/**
 * Women's Hormone Health setup.
 *
 * Deliberately short. There are no difficulty variants, so the only things worth
 * asking are the length and the personal targets — and the targets are all
 * pre-filled. Everything rendered here comes from hormoneHealthConfig; this
 * component holds no challenge constants.
 *
 * The one thing it insists on is that the user has read what this challenge
 * does and does not claim, and what to do if symptoms are severe.
 */
export default function HormoneHealthSetup({ onCancel, onSubmit }) {
  const [s, setS] = useState(HH.defaultSetup());
  const [showTargets, setShowTargets] = useState(false);
  const [showSupplements, setShowSupplements] = useState(false);

  const set = (patch) => setS(prev => ({ ...prev, ...patch }));

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card hh-setup" onClick={e => e.stopPropagation()}>
        <h3>{HH.IDENTITY.emoji} {HH.IDENTITY.name}</h3>
        <p className="hh-setup-sub">{HH.IDENTITY.subtitle}</p>
        <p className="hh-setup-goal">{HH.IDENTITY.goal}</p>

        {/* What this is not — stated before anything else. */}
        <div className="hh-disclaimer">{HH.IDENTITY.disclaimer}</div>

        {/* ── Duration ── */}
        <div className="hh-field">
          <div className="hh-label">How long?</div>
          <div className="hh-durations">
            {HH.DURATION_OPTIONS.map(o => (
              <button
                key={o.days}
                className={`hh-duration${s.durationDays === o.days ? ' active' : ''}`}
                onClick={() => set({ durationDays: o.days })}
                aria-pressed={s.durationDays === o.days}
              >
                <span className="hh-duration-head">
                  {o.weeks} Weeks — {o.label}
                  {o.days === HH.DEFAULT_DURATION && <span className="hh-duration-rec">Recommended</span>}
                </span>
                <span className="hh-duration-days">{o.days} days</span>
                <span className="hh-duration-blurb">{o.blurb}</span>
              </button>
            ))}
          </div>
          <div className="hh-hint">{HH.durationOption(s.durationDays).detail}</div>
          <div className="hh-hint">
            The habits, XP, exercise philosophy, nutrition and symptom tracking are exactly the
            same in both. The longer version is not harder — it just gives you more time.
          </div>
          <div className="hh-hint">
            Cycle length varies, so this usually covers around {HH.typicalCycles(s.durationDays)} cycles —
            but at the end Forge compares whatever cycles you actually logged, not a number it assumed.
          </div>
        </div>

        {/* ── The three stages ── */}
        <div className="hh-field">
          <div className="hh-label">How progress is measured</div>
          {HH.stagesForDuration(s.durationDays).map(st => (
            <div key={st.cycle} className="hh-stage">
              <div className="hh-stage-title">{st.title}</div>
              <div className="hh-stage-blurb">{st.blurb}</div>
            </div>
          ))}
        </div>

        {/* ── Daily habits preview ── */}
        <div className="hh-field">
          <div className="hh-label">Daily habits</div>
          <ul className="tpl-task-list">
            {HH.buildStartTasks(s).map(t => (
              <li key={t.id}>
                {t.icon} {t.name} ({t.xp} XP){t.keystoneHabit ? ' ⭐⭐⭐ Keystone' : ''}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Weekly habits preview ── */}
        <div className="hh-field">
          <div className="hh-label">Weekly habits</div>
          <ul className="tpl-task-list weekly">
            {HH.weeklyRequirementDefs(s).map(d => (
              <li key={d.id}>
                {d.icon} {d.label} — {d.perWeek}× per week ({d.xp} XP each)
                <span className="hh-req-note">{d.note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── The exercise rule — the most important guidance here ── */}
        <div className="hh-exercise-rule">
          <div className="hh-rule-headline">{HH.EXERCISE_GUIDANCE.principle}</div>
          <div className="hh-rule-cols">
            <div className="hh-rule-col">
              <div className="hh-rule-col-title">{HH.EXERCISE_GUIDANCE.whenGood.title}</div>
              <div className="hh-rule-col-blurb">{HH.EXERCISE_GUIDANCE.whenGood.blurb}</div>
            </div>
            <div className="hh-rule-col">
              <div className="hh-rule-col-title">{HH.EXERCISE_GUIDANCE.whenSymptomatic.title}</div>
              <div className="hh-rule-col-blurb">{HH.EXERCISE_GUIDANCE.whenSymptomatic.blurb}</div>
            </div>
          </div>
          <div className="hh-rule-notice">{HH.EXERCISE_GUIDANCE.notice}</div>
        </div>

        {/* ── Personal targets (collapsed — sensible defaults are pre-filled) ── */}
        <div className="hh-field">
          <button className="hh-disclosure" onClick={() => setShowTargets(v => !v)}>
            {showTargets ? '▾' : '▸'} Your targets
            <span className="hh-disclosure-note">using suggested values</span>
          </button>
          {showTargets && (
            <div className="hh-targets">
              <label className="hh-inline">
                <span>Sleep target (hours)</span>
                <input
                  type="number" step="0.5" inputMode="decimal" className="inline-input"
                  min={HH.SLEEP_TARGET.min} max={HH.SLEEP_TARGET.max}
                  value={s.sleepHours}
                  onChange={e => set({ sleepHours: parseFloat(e.target.value) || HH.SLEEP_TARGET.suggested })}
                />
              </label>
              <label className="hh-inline">
                <span>Daily steps</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="0" step="500"
                  value={s.stepTarget}
                  onChange={e => set({ stepTarget: parseInt(e.target.value, 10) || HH.STEP_TARGET.suggested })}
                />
              </label>
              <label className="hh-inline">
                <span>Down-regulation (minutes)</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min={HH.STRESS_MINUTES.min}
                  value={s.stressMinutes}
                  onChange={e => set({ stressMinutes: parseInt(e.target.value, 10) || HH.STRESS_MINUTES.suggested })}
                />
              </label>
              <label className="hh-inline full">
                <span>Your hydration target</span>
                <input
                  type="text" className="inline-input" placeholder="e.g. 2.5 litres — your normal target"
                  value={s.hydrationNote}
                  onChange={e => set({ hydrationNote: e.target.value })}
                />
              </label>
              <div className="hh-hint">{HH.HYDRATION.note} {HH.HYDRATION.electrolyteNote}</div>
              <label className="hh-inline">
                <span>Exercise sessions / week</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="1" max="7"
                  value={s.exercisePerWeek}
                  onChange={e => set({ exercisePerWeek: Math.max(1, parseInt(e.target.value, 10) || HH.EXERCISE_PER_WEEK) })}
                />
              </label>
              <label className="hh-inline">
                <span>Fatty fish meals / week</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="0" max="7"
                  value={s.omega3PerWeek}
                  onChange={e => set({ omega3PerWeek: Math.max(0, parseInt(e.target.value, 10) || HH.OMEGA3_PER_WEEK) })}
                />
              </label>
              <label className="hh-inline">
                <span>Iron-rich meals / week</span>
                <input
                  type="number" inputMode="numeric" className="inline-input" min="0" max="14"
                  value={s.ironRichPerWeek}
                  onChange={e => set({ ironRichPerWeek: Math.max(0, parseInt(e.target.value, 10) || HH.IRON_RICH_PER_WEEK) })}
                />
              </label>
            </div>
          )}
        </div>

        {/* ── Supplements: optional education, never a requirement ── */}
        <div className="hh-field">
          <button className="hh-disclosure" onClick={() => setShowSupplements(v => !v)}>
            {showSupplements ? '▾' : '▸'} Supplements
            <span className="hh-disclosure-note">optional — none required</span>
          </button>
          {showSupplements && (
            <div className="hh-supplements">
              <div className="hh-supp-headline">{HH.SUPPLEMENT_EDUCATION.headline}</div>
              <div className="hh-hint">{HH.SUPPLEMENT_EDUCATION.blurb}</div>
              {HH.SUPPLEMENT_EDUCATION.items.map(it => (
                <div key={it.name} className="hh-supp-item">
                  <strong>{it.name}</strong> — {it.note}
                </div>
              ))}
              <div className="hh-caution">{HH.SUPPLEMENT_EDUCATION.caution}</div>
            </div>
          )}
        </div>

        {/* ── Medical safety acknowledgment ── */}
        <div className="hh-safety">
          <div className="hh-safety-title">⚕️ Before you start</div>
          <p className="hh-safety-body">{HH.SAFETY.message.body}</p>
          <p className="hh-safety-reassurance">{HH.SAFETY.message.reassurance}</p>
          <label className="hh-check">
            <input
              type="checkbox"
              checked={s.acknowledgedSafety}
              onChange={e => set({ acknowledgedSafety: e.target.checked })}
            />
            <span>I understand this challenge builds habits and does not treat a medical condition.</span>
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit(s)}
            disabled={!s.acknowledgedSafety}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
