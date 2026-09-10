import { useState } from 'react';
import * as FLH from '../data/fatLossHardConfig';

/**
 * Fat Loss Hard Mode setup — the one step Hard adds to the existing variant
 * start flow (Beginner and Standard skip it entirely and start exactly as
 * before).
 *
 * Two jobs: pick how the protein target is expressed, and screen for the
 * situations where an aggressive fat-loss phase is not appropriate. The screen
 * comes first, and answering yes to any of it surfaces guidance and alternative
 * challenges instead of pushing the target — the user can still proceed, but
 * they do it with the guidance in front of them rather than around it.
 */
export default function FatLossHardSetup({ onCancel, onSubmit }) {
  const [s, setS] = useState(FLH.defaultSetup());
  const [showWhat, setShowWhat] = useState(false);

  const set = (patch) => setS(prev => ({ ...prev, ...patch }));
  const toggleFlag = (id) => setS(prev => {
    const cur = prev.safetyFlags || [];
    if (id === 'none') return { ...prev, safetyFlags: cur.includes('none') ? [] : ['none'] };
    const without = cur.filter(f => f !== 'none');
    return {
      ...prev,
      safetyFlags: without.includes(id) ? without.filter(f => f !== id) : [...without, id],
    };
  });

  const flagged = FLH.isContraindicated(s);
  const answered = (s.safetyFlags || []).length > 0;
  const canStart = answered && (!flagged || s.acknowledged);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card flh-setup" onClick={e => e.stopPropagation()}>
        <div className="flh-hero">
          <div className="flh-hero-emoji">{FLH.IDENTITY.emoji}</div>
          <h3>{FLH.IDENTITY.name}</h3>
          <p className="flh-hero-sub">{FLH.IDENTITY.subtitle}</p>
        </div>

        <div className="flh-positioning">{FLH.IDENTITY.positioning}</div>

        {/* ── What you may notice ── */}
        <div className="flh-field">
          <button className="flh-disclosure" onClick={() => setShowWhat(v => !v)}>
            {showWhat ? '▾' : '▸'} {FLH.WHAT_YOU_MAY_NOTICE.title}
          </button>
          {showWhat && (
            <>
              <ul className="flh-list">
                {FLH.WHAT_YOU_MAY_NOTICE.items.map((i, n) => <li key={n}>{i}</li>)}
              </ul>
              <div className="flh-target">{FLH.WHAT_YOU_MAY_NOTICE.target}</div>
              <div className="flh-disclaimer">{FLH.WHAT_YOU_MAY_NOTICE.disclaimer}</div>
              <div className="flh-note">{FLH.WHAT_YOU_MAY_NOTICE.framing}</div>
            </>
          )}
        </div>

        {/* ── Protein target ── */}
        <div className="flh-field">
          <div className="flh-label">🥩 {FLH.PROTEIN.title}</div>
          <div className="flh-note">{FLH.PROTEIN.why}</div>
          <div className="flh-modes">
            {FLH.PROTEIN.modes.map(m => (
              <button
                key={m.id}
                className={`flh-mode${s.proteinMode === m.id ? ' active' : ''}`}
                onClick={() => set({ proteinMode: m.id })}
                aria-pressed={s.proteinMode === m.id}
              >
                <span className="flh-mode-label">{m.label}</span>
                <span className="flh-mode-hint">{m.hint}</span>
              </button>
            ))}
          </div>
          {s.proteinMode === 'perLb' ? (
            <label className="flh-inline">
              <span>Target bodyweight (lb)</span>
              <input
                type="number" inputMode="numeric" className="inline-input" min="60" max="500"
                value={s.targetWeightLb}
                onChange={e => set({ targetWeightLb: parseInt(e.target.value, 10) || FLH.PROTEIN.defaultTargetWeight })}
              />
            </label>
          ) : (
            <label className="flh-inline">
              <span>Daily protein (g)</span>
              <input
                type="number" inputMode="numeric" className="inline-input" min="40" max="400"
                value={s.proteinFixedGrams}
                onChange={e => set({ proteinFixedGrams: parseInt(e.target.value, 10) || FLH.PROTEIN.defaultFixedGrams })}
              />
            </label>
          )}
          <div className="flh-resolved">Your daily task: <strong>{FLH.proteinLabel(s)}</strong></div>
        </div>

        {/* ── What Hard Mode means ── */}
        <div className="flh-field">
          <div className="flh-label">This is a focused phase, not an extreme one</div>
          <div className="flh-means">
            <div className="flh-means-col is">
              <div className="flh-means-title">It means</div>
              {FLH.SAFETY.meaning.is.map(i => <div key={i} className="flh-means-item">✓ {i}</div>)}
            </div>
            <div className="flh-means-col isnot">
              <div className="flh-means-title">It does not mean</div>
              {FLH.SAFETY.meaning.isNot.map(i => <div key={i} className="flh-means-item">✕ {i}</div>)}
            </div>
          </div>
        </div>

        {/* ── Safety screen ── */}
        <div className="flh-safety">
          <div className="flh-safety-title">⚕️ {FLH.SAFETY.title}</div>
          <div className="flh-note">{FLH.SAFETY.screen.prompt}</div>
          {FLH.SAFETY.screen.options.map(o => (
            <label key={o.id} className="flh-check">
              <input
                type="checkbox"
                checked={(s.safetyFlags || []).includes(o.id)}
                onChange={() => toggleFlag(o.id)}
              />
              <span>{o.label}</span>
            </label>
          ))}

          {flagged && (
            <div className="flh-flagged">
              <div className="flh-flagged-title">{FLH.SAFETY.flagged.title}</div>
              <p className="flh-flagged-body">{FLH.SAFETY.flagged.body}</p>
              <ul className="flh-list">
                {FLH.SAFETY.flagged.guidance.map((g, n) => <li key={n}>{g}</li>)}
              </ul>
              <div className="flh-alternatives">{FLH.SAFETY.flagged.alternatives}</div>
              <label className="flh-check">
                <input
                  type="checkbox"
                  checked={s.acknowledged}
                  onChange={e => set({ acknowledged: e.target.checked })}
                />
                <span>{FLH.SAFETY.flagged.override}</span>
              </label>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(s)} disabled={!canStart}>
            Continue
          </button>
        </div>
        {!answered && (
          <div className="flh-note" style={{ textAlign: 'center' }}>
            Answer the question above to continue.
          </div>
        )}
      </div>
    </div>
  );
}
