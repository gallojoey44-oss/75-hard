import { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as MB from '../data/muscleBuildingConfig';
import { volumeAdherence } from '../utils/muscleVolume';
import { trendSummaries, makeExerciseEntry, overallPerformance, stallInsight, DOUBLE_PROGRESSION, PROGRESSION_ROUTES } from '../utils/exerciseLog';
import { bodyweightTrend, measurementCheckIns, growthInsights } from '../utils/growthTrend';
import { getTodayStr, getDateForDayNumber } from '../utils/dateUtils';
import { HABIT_KEYS } from '../data/habitKeys';

/**
 * The Muscle Building challenge panel.
 *
 * Ordered by importance so the dashboard stays readable: weekly training first
 * (the challenge's dominant requirement), then weekly hard-set volume, then the
 * slower-moving outputs — bodyweight trend and lift performance — and finally
 * coaching insights. Everything it renders comes from muscleBuildingConfig and
 * the three Muscle Building utils; this component holds no challenge constants.
 */
export default function MuscleBuildingPanel() {
  const {
    activeProfile, profile, allDays, getChallengeMeta, getRawDayNumber,
    getWeeklyVolume, logVolumeSets, removeVolumeEntry,
    getWeeklyRequirements, logExercise,
  } = useApp();

  const [openVolume, setOpenVolume] = useState(false);
  const [openLog, setOpenLog] = useState(false);
  const [form, setForm] = useState({ exercise: '', load: '', reps: '', sets: '', rir: '' });
  const [lastEntry, setLastEntry] = useState(null);

  const meta = getChallengeMeta();
  const cfg = MB.mbConfig(meta);
  if (!cfg) return null;                       // not a Muscle Building attempt

  const rawDay = getRawDayNumber();
  if (!rawDay) return null;                    // scheduled, not begun

  const days = allDays[activeProfile] || {};
  const challengeStart = profile?.challengeStart;
  const vol = getWeeklyVolume();
  const wr = getWeeklyRequirements();
  const training = wr?.current?.requirements?.find(r => r.id === 'hypertrophy_training') || null;
  const weight = bodyweightTrend({ days, meta, challengeStart, rawDay });
  const trends = trendSummaries(profile?.exerciseLog, 3);
  const perf = overallPerformance(profile?.exerciseLog);
  // Fires only after several weeks of no movement across most tracked lifts.
  const stall = stallInsight({
    entries: profile?.exerciseLog,
    challengeStart,
    todayDate: getDateForDayNumber(challengeStart, rawDay),
  });
  const checkIns = measurementCheckIns({ days, meta, rawDay });

  const volAdh = volumeAdherence({ entries: profile?.volumeSets, meta, challengeStart, rawDay });
  const insights = growthInsights({
    days, meta, challengeStart, rawDay,
    exerciseEntries: profile?.exerciseLog,
    weeklyRequirements: wr,
    volumeAdherence: volAdh,
    taskAdherencePct: null,
  });

  // Opt-in optimizations, so the panel can report their adherence separately
  // from the fundamentals.
  const optimizations = MB.OPTIMIZATION_HABITS.filter(h => cfg.optimizations?.[h.key]);
  const todayRec = days[rawDay];
  const optDone = optimizations.filter(h => todayRec?.tasks?.[h.id]).length;

  function submitExercise() {
    const entry = makeExerciseEntry({ ...form, date: getTodayStr() });
    if (!entry) return;
    logExercise(form);
    setLastEntry(entry);
    setForm({ exercise: '', load: '', reps: '', sets: '', rir: '' });
  }

  return (
    <div className="mb-panel">
      <div className="mb-panel-head">
        <span className="mb-panel-title">{MB.IDENTITY.emoji} {MB.IDENTITY.name}</span>
        <span className="mb-panel-sub">{MB.IDENTITY.subtitle}</span>
      </div>

      {/* ── Weekly training — the dominant requirement ── */}
      {training && (
        <div className="mb-block">
          <div className="mb-block-title">🏋️ Training this week</div>
          <div className="mb-training-row">
            <span className="mb-training-count">{training.done} / {training.target}</span>
            <span className="mb-training-label">sessions{vol.week ? ` · week ${vol.week.week}` : ''}</span>
          </div>
          <div className="mb-bar">
            <div className="mb-bar-fill training" style={{ width: `${Math.min(100, (training.done / Math.max(1, training.target)) * 100)}%` }} />
          </div>
          <div className="mb-why">{MB.WHY[HABIT_KEYS.HYPERTROPHY_TRAINING]}</div>
        </div>
      )}

      {/* ── PRIORITY MUSCLES — the specialization dashboard ──
          Shown prominently and above general volume, because during a block
          these are the muscles the user is actually making decisions about. */}
      {vol.supported && vol.specializing && (
        <div className="mb-block mb-priority-block">
          <div className="mb-block-title">⭐ Priority muscles</div>
          {vol.priorityRows.map(r => {
            const trend = perf?.pct == null ? null : (perf.pct >= 50 ? 'up' : perf.flat ? 'flat' : 'mixed');
            return (
              <div key={r.id} className="mb-priority-row">
                <div className="mb-priority-head">
                  <span className="mb-priority-name">{r.icon} {r.label} ⭐</span>
                  <span className={`mb-priority-pct${r.met ? ' met' : ''}`}>{r.pct}%</span>
                </div>
                <div className="mb-priority-stat">
                  <span>Weekly Volume</span><strong>{r.done} / {r.target} sets</strong>
                </div>
                <div className="mb-vol-bar"><div className="mb-vol-fill" style={{ width: `${r.pct}%` }} /></div>
                <div className="mb-priority-stat">
                  <span>Training Exposures</span>
                  <strong className={r.exposuresMet ? '' : 'warn'}>{r.exposures} / {r.exposureTarget}</strong>
                </div>
                <div className="mb-priority-stat">
                  <span>Performance Trend</span>
                  <strong>{trend === 'up' ? '↑' : trend === 'flat' ? '→' : trend === 'mixed' ? '↗' : '—'}</strong>
                </div>
                {r.microSets > 0 && (
                  <div className="mb-note">{r.microSets} of these came from micro-workouts — same budget, spread out.</div>
                )}
                <button className="mb-vol-add wide" onClick={() => logVolumeSets(r.id, 1)}>+1 set</button>
              </div>
            );
          })}
          <div className="mb-why">{MB.WHY.specialization}</div>
          <div className="mb-note">{MB.SPECIALIZATION.lowestEffectiveNote}</div>
        </div>
      )}

      {/* ── Weekly hard-set volume ── */}
      {vol.supported && (
        <div className="mb-block">
          <button className="mb-block-toggle" onClick={() => setOpenVolume(v => !v)}>
            <span className="mb-block-title">📊 {vol.specializing ? 'Other muscles' : 'Weekly volume'}</span>
            <span className="mb-block-meta">
              {vol.specializing
                ? `${vol.otherRows.filter(r => r.met).length}/${vol.otherRows.length} at maintenance`
                : `${vol.metCount}/${vol.rows.length} targets met · ${vol.totalDone}/${vol.totalTarget} sets`}
            </span>
            <span className="mb-caret">{openVolume ? '▾' : '▸'}</span>
          </button>
          {openVolume && (
            <>
              <div className="mb-volume-list">
                {(vol.specializing ? vol.otherRows : vol.rows).map(r => (
                  <div key={r.id} className={`mb-vol-row${r.met ? ' met' : ''}`}>
                    <span className="mb-vol-name">{r.icon} {r.label}</span>
                    <span className="mb-vol-count">{r.done} / {r.target} sets</span>
                    <div className="mb-vol-bar"><div className="mb-vol-fill" style={{ width: `${r.pct}%` }} /></div>
                    <button className="mb-vol-add" onClick={() => logVolumeSets(r.id, 1)} aria-label={`Add a set for ${r.label}`}>+1</button>
                  </div>
                ))}
              </div>
              <div className="mb-why">{vol.specializing ? MB.SPECIALIZATION.explanation : MB.WHY.volume}</div>
              <div className="mb-note">
                Logging sets tracks your training dose — it awards no XP, so there is nothing to farm.
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Performance stall — only after several flat weeks ── */}
      {stall && (
        <div className="mb-block mb-stall">
          <div className="mb-block-title">⚠️ {stall.text}</div>
          <div className="mb-note">
            {stall.stalled} of {stall.tracked} tracked exercises have not progressed by any route
            for about {stall.weeks} weeks. That is a signal to look at volume, food, sleep and
            recovery — not a reason to add more sets by default.
          </div>
        </div>
      )}

      {/* ── Bodyweight trend ── */}
      {weight.supported && (
        <div className="mb-block">
          <div className="mb-block-title">⚖️ Bodyweight trend</div>
          {weight.ratePct == null ? (
            <div className="mb-note">
              Log your weight on a few days and a weekly trend will appear here. Single weigh-ins
              are noisy — the trend is what matters.
            </div>
          ) : (
            <>
              <div className="mb-weight-row">
                <span className={`mb-weight-rate ${weight.status}`}>
                  {weight.ratePct > 0 ? '+' : ''}{weight.ratePct}% / week
                </span>
                <span className="mb-weight-target">target {weight.rangeMin}–{weight.rangeMax}% · {weight.mode.label}</span>
              </div>
              <div className="mb-note">
                {weight.firstAvg.toFixed(1)} → {weight.lastAvg.toFixed(1)} lb across {weight.points} logged weeks.
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Performance trend + exercise logging ── */}
      <div className="mb-block">
        <button className="mb-block-toggle" onClick={() => setOpenLog(v => !v)}>
          <span className="mb-block-title">📈 Performance</span>
          <span className="mb-block-meta">
            {trends.length ? `${trends.filter(t => t.trend === 'progressing').length} progressing` : 'log a lift to start'}
          </span>
          <span className="mb-caret">{openLog ? '▾' : '▸'}</span>
        </button>
        {trends.length > 0 && (
          <ul className="mb-trend-list">
            {trends.map(t => <li key={t.key} className={`mb-trend ${t.trend}`}>{t.text}</li>)}
          </ul>
        )}
        {openLog && (
          <div className="mb-exercise-form">
            <input
              className="inline-input" placeholder="Exercise (e.g. incline dumbbell press)"
              value={form.exercise} onChange={e => setForm({ ...form, exercise: e.target.value })}
            />
            <div className="mb-exercise-row">
              <input className="inline-input" type="number" inputMode="decimal" placeholder="load"
                value={form.load} onChange={e => setForm({ ...form, load: e.target.value })} />
              <input className="inline-input" type="number" inputMode="numeric" placeholder="reps"
                value={form.reps} onChange={e => setForm({ ...form, reps: e.target.value })} />
              <input className="inline-input" type="number" inputMode="numeric" placeholder="sets"
                value={form.sets} onChange={e => setForm({ ...form, sets: e.target.value })} />
              <input className="inline-input" type="number" inputMode="numeric" placeholder="RIR"
                value={form.rir} onChange={e => setForm({ ...form, rir: e.target.value })} />
            </div>
            <button className="btn btn-secondary btn-full" onClick={submitExercise} disabled={!form.exercise.trim()}>
              Log Exercise
            </button>
            {lastEntry && <div className="mb-note">Logged {lastEntry.exercise}.</div>}
            <div className="mb-note">
              RIR is optional and never scored. {MB.RIR_GUIDANCE.body}
            </div>
          </div>
        )}
      </div>

      {/* ── Optional optimization adherence ── */}
      {optimizations.length > 0 && (
        <div className="mb-block">
          <div className="mb-block-title">✨ Optimization</div>
          <div className="mb-note">
            {optDone} / {optimizations.length} logged today · {optimizations.map(h => h.name).join(', ')}.
            Optional by design — worth less than every fundamental.
          </div>
        </div>
      )}

      {/* ── Physique check-ins ── */}
      {checkIns.length > 0 && (
        <div className="mb-block">
          <div className="mb-block-title">📏 Physique check-in</div>
          <div className="mb-checkin-row">
            {checkIns.map(m => (
              <span key={m.id} className="mb-checkin">
                {m.icon} {m.label}
                {m.field ? <strong>{m.latest ? ` ${m.latest}${m.unit}` : ' —'}</strong> : ''}
              </span>
            ))}
          </div>
          <div className="mb-note">
            Check in every {MB.CHECKIN_INTERVAL_DAYS.min}–{MB.CHECKIN_INTERVAL_DAYS.max} days. Measurements
            and photos stay on this profile.
          </div>
        </div>
      )}

      {/* ── Coaching insights (inputs vs outputs) ── */}
      {insights.length > 0 && (
        <div className="mb-block insights">
          <div className="mb-block-title">🧭 Coaching</div>
          {insights.map(i => (
            <div key={i.id} className={`mb-insight ${i.tone}`}>
              <span className="mb-insight-icon">{i.icon}</span>
              <span>{i.text}</span>
            </div>
          ))}
          <div className="mb-note">
            Forge never changes your targets for you — these are suggestions to act on if you agree.
          </div>
        </div>
      )}
    </div>
  );
}
