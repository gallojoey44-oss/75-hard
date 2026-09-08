import { useState } from 'react';
import { useApp } from '../context/AppContext';
import * as HH from '../data/hormoneHealthConfig';
import {
  lifeImpactForLog, lifeImpactBand, cycleProgress, compareCycles, safetyFlags, flowLabel,
} from '../utils/cycleTracking';
import { getTodayStr, formatDateShort } from '../utils/dateUtils';

/**
 * The Women's Hormone Health challenge panel.
 *
 * The symptom check-in is the only thing that appears by default, and only as a
 * single unobtrusive prompt — there is no daily questionnaire. Everything else
 * (cycle progress, the exercise rule, comfort tools, supplements, safety) is
 * collapsed until asked for.
 *
 * All copy and thresholds come from hormoneHealthConfig; this component holds no
 * challenge constants.
 */
export default function HormoneHealthPanel() {
  const {
    profile, getChallengeMeta, getRawDayNumber, getCycleLog, saveCycleLog, removeCycleLog, getCycles,
  } = useApp();

  const [openCheckIn, setOpenCheckIn] = useState(false);
  const [openProgress, setOpenProgress] = useState(false);
  const [openGuide, setOpenGuide] = useState(false);
  const [openSupplements, setOpenSupplements] = useState(false);

  const meta = getChallengeMeta();
  const cfg = HH.hhConfig(meta);
  if (!cfg) return null;                      // not a Hormone Health attempt

  const rawDay = getRawDayNumber();
  if (!rawDay) return null;                   // scheduled, not begun

  const today = getTodayStr();
  const log = getCycleLog(today);
  const cycles = getCycles();
  // Stages follow the attempt's chosen length, extended to cover any extra
  // cycles actually logged — cycle length varies, so the count is never assumed.
  const stages = cycleProgress(cycles, HH.stagesForDuration(cfg.durationDays || meta.durationDays, cycles.length));
  const changes = compareCycles(cycles);
  const flags = safetyFlags(cycles, profile?.cycleLogs);
  const impact = log ? lifeImpactForLog(log) : null;
  const band = lifeImpactBand(impact);

  const setField = (patch) => saveCycleLog(today, patch);
  const toggleInterference = (id) =>
    saveCycleLog(today, { interference: { ...(log?.interference || {}), [id]: !log?.interference?.[id] } });
  const toggleConcern = (id) =>
    saveCycleLog(today, { concerns: { ...(log?.concerns || {}), [id]: !log?.concerns?.[id] } });

  return (
    <div className="hh-panel">
      <div className="hh-panel-head">
        <span className="hh-panel-title">{HH.IDENTITY.emoji} {HH.IDENTITY.name}</span>
        <span className="hh-panel-sub">{HH.IDENTITY.subtitle}</span>
      </div>

      {/* ── Symptom check-in — one prompt, opened only when relevant ── */}
      <div className="hh-block">
        {!log && !openCheckIn ? (
          <button className="hh-period-btn" onClick={() => { saveCycleLog(today, {}); setOpenCheckIn(true); }}>
            🩸 I&apos;m on my period today
          </button>
        ) : (
          <>
            <button className="hh-block-toggle" onClick={() => setOpenCheckIn(v => !v)}>
              <span className="hh-block-title">🩸 Today&apos;s check-in</span>
              <span className="hh-block-meta">
                {impact != null ? `Life Impact ${impact}/10` : 'tap to fill in'}
              </span>
              <span className="hh-caret">{openCheckIn ? '▾' : '▸'}</span>
            </button>
            {openCheckIn && (
              <div className="hh-checkin">
                <div className="hh-note">
                  All optional. Fill in what you know — a partial check-in still counts.
                  This is a measurement, not a habit: it never affects your score or XP.
                </div>

                {HH.SYMPTOM_SCALES.map(sc => (
                  <div key={sc.id} className="hh-scale">
                    <div className="hh-scale-head">
                      <span className="hh-scale-label">{sc.icon} {sc.label}</span>
                      <span className="hh-scale-value">{log?.[sc.id] || '—'}</span>
                    </div>
                    <div className="hh-scale-row">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button
                          key={n}
                          className={`hh-dot${log?.[sc.id] === n ? ' active' : ''}`}
                          onClick={() => setField({ [sc.id]: log?.[sc.id] === n ? null : n })}
                          aria-label={`${sc.label} ${n}`}
                        >{n}</button>
                      ))}
                    </div>
                    <div className="hh-scale-ends"><span>{sc.low}</span><span>{sc.high}</span></div>
                  </div>
                ))}

                <div className="hh-scale">
                  <div className="hh-scale-label">🩸 Flow</div>
                  <div className="hh-chips">
                    {HH.FLOW_OPTIONS.map(f => (
                      <button
                        key={f.id}
                        className={`hh-chip${log?.flow === f.id ? ' active' : ''}`}
                        onClick={() => setField({ flow: log?.flow === f.id ? null : f.id })}
                      >{f.label}</button>
                    ))}
                  </div>
                </div>

                <label className="hh-check">
                  <input type="checkbox" checked={!!log?.meds} onChange={() => setField({ meds: !log?.meds })} />
                  <span>Took pain medication today</span>
                </label>

                <div className="hh-scale">
                  <div className="hh-scale-label">Did it get in the way of…</div>
                  <div className="hh-chips">
                    {HH.INTERFERENCE_AREAS.map(a => (
                      <button
                        key={a.id}
                        className={`hh-chip${log?.interference?.[a.id] ? ' active warn' : ''}`}
                        onClick={() => toggleInterference(a.id)}
                      >{a.icon} {a.label}</button>
                    ))}
                  </div>
                  <div className="hh-note">
                    This is the question that matters most — not whether you had cramps, but how
                    much your cycle interfered with your life.
                  </div>
                </div>

                {impact != null && (
                  <div className={`hh-impact ${band?.tone || 'info'}`}>
                    <span className="hh-impact-score">{impact}/10</span>
                    <span className="hh-impact-label">Life Impact today · {band?.label}</span>
                  </div>
                )}

                <details className="hh-concerns">
                  <summary>Anything else worth flagging?</summary>
                  <div className="hh-note">Optional. These are the symptoms that are worth a doctor&apos;s attention.</div>
                  {HH.CONCERN_FLAGS.map(f => (
                    <label key={f.id} className="hh-check">
                      <input type="checkbox" checked={!!log?.concerns?.[f.id]} onChange={() => toggleConcern(f.id)} />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </details>

                <button className="hh-remove" onClick={() => { removeCycleLog(today); setOpenCheckIn(false); }}>
                  Not a period day — remove this check-in
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Cycle progress ── */}
      <div className="hh-block">
        <button className="hh-block-toggle" onClick={() => setOpenProgress(v => !v)}>
          <span className="hh-block-title">📈 Cycle progress</span>
          <span className="hh-block-meta">
            {cycles.length ? `${cycles.length} logged` : 'no cycles logged yet'}
          </span>
          <span className="hh-caret">{openProgress ? '▾' : '▸'}</span>
        </button>
        {openProgress && (
          <>
            {stages.map(st => (
              <div key={st.cycle} className={`hh-stage-row${st.cycleData ? ' done' : ''}`}>
                <div className="hh-stage-row-title">{st.title}</div>
                {st.cycleData ? (
                  <>
                    <div className="hh-stage-stats">
                      <span>{formatDateShort(st.cycleData.start)} · {st.cycleData.days} {st.cycleData.days === 1 ? 'day' : 'days'}</span>
                      {st.cycleData.lifeImpact != null && (
                        <strong>Life Impact {st.cycleData.lifeImpact}/10</strong>
                      )}
                    </div>
                    {st.cycleData.avgPain != null && (
                      <div className="hh-stage-stats sub">
                        <span>Avg pain {st.cycleData.avgPain}</span>
                        {st.cycleData.worstPain != null && <span>Worst {st.cycleData.worstPain}</span>}
                        {st.cycleData.exerciseDisruptedDays > 0 && <span>{st.cycleData.exerciseDisruptedDays} exercise days disrupted</span>}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="hh-stage-blurb">{st.blurb}</div>
                )}
              </div>
            ))}
            {changes.length > 0 ? (
              <div className="hh-changes">
                <div className="hh-changes-title">First logged cycle → most recent</div>
                {changes.map(c => (
                  <div key={c.key} className={`hh-change ${c.changed ? (c.improved ? 'improved' : 'worsened') : 'flat'}${c.headline ? ' headline' : ''}`}>
                    <span className="hh-change-label">{c.label}</span>
                    <span className="hh-change-values">{c.from} → {c.to}{c.unit ? ` ${c.unit}` : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="hh-note">
                {cycles.length < 2
                  ? 'A comparison needs at least two logged cycles. Nothing is estimated until then.'
                  : 'Not enough overlapping data between cycles to compare yet.'}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── The exercise rule and comfort tools ── */}
      <div className="hh-block">
        <button className="hh-block-toggle" onClick={() => setOpenGuide(v => !v)}>
          <span className="hh-block-title">🏃 Training &amp; recovery guidance</span>
          <span className="hh-block-meta">{HH.EXERCISE_GUIDANCE.principle}</span>
          <span className="hh-caret">{openGuide ? '▾' : '▸'}</span>
        </button>
        {openGuide && (
          <>
            <div className="hh-rule-cols">
              {[HH.EXERCISE_GUIDANCE.whenGood, HH.EXERCISE_GUIDANCE.whenSymptomatic].map(col => (
                <div key={col.title} className="hh-rule-col">
                  <div className="hh-rule-col-title">{col.title}</div>
                  <div className="hh-rule-col-blurb">{col.blurb}</div>
                  <div className="hh-examples">{col.examples.join(' · ')}</div>
                </div>
              ))}
            </div>
            <div className="hh-rule-notice">{HH.EXERCISE_GUIDANCE.notice}</div>

            <div className="hh-sub-title">{HH.SLEEP_GUIDANCE.title}</div>
            <ul className="hh-list">
              {HH.SLEEP_GUIDANCE.items.map((i, n) => <li key={n}>{i}</li>)}
            </ul>
            <div className="hh-note">{HH.SLEEP_GUIDANCE.notice}</div>

            <div className="hh-sub-title">{HH.MENSTRUATION_TOOLS.title}</div>
            <div className="hh-examples">{HH.MENSTRUATION_TOOLS.items.join(' · ')}</div>
            <div className="hh-note">{HH.MENSTRUATION_TOOLS.blurb}</div>
          </>
        )}
      </div>

      {/* ── Supplements: education only ── */}
      <div className="hh-block">
        <button className="hh-block-toggle" onClick={() => setOpenSupplements(v => !v)}>
          <span className="hh-block-title">💊 Supplements</span>
          <span className="hh-block-meta">optional — none required</span>
          <span className="hh-caret">{openSupplements ? '▾' : '▸'}</span>
        </button>
        {openSupplements && (
          <>
            <div className="hh-supp-headline">{HH.SUPPLEMENT_EDUCATION.headline}</div>
            <div className="hh-note">{HH.SUPPLEMENT_EDUCATION.blurb}</div>
            {HH.SUPPLEMENT_EDUCATION.items.map(it => (
              <div key={it.name} className="hh-supp-item"><strong>{it.name}</strong> — {it.note}</div>
            ))}
            <div className="hh-caution">{HH.SUPPLEMENT_EDUCATION.caution}</div>
          </>
        )}
      </div>

      {/* ── Medical safety — discreet, and only on repeated reports ── */}
      {flags.length > 0 && (
        <div className="hh-block hh-safety-block">
          <div className="hh-safety-title">⚕️ {HH.SAFETY.message.title}</div>
          {flags.map(f => <div key={f.id} className="hh-flag">{f.text}</div>)}
          <p className="hh-safety-body">{HH.SAFETY.message.body}</p>
          <p className="hh-safety-reassurance">{HH.SAFETY.message.reassurance}</p>
        </div>
      )}
    </div>
  );
}
